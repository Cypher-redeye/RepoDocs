"""
Ingestion pipeline for RepoDocs.
Handles GitHub repo fetching, file chunking, embedding, and vector storage.
"""

import os
import time
import asyncio
import logging
from typing import Optional

import httpx
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_huggingface import HuggingFaceEndpointEmbeddings

from vectorstore import SimpleVectorStore
from utils import (
    parse_github_url,
    is_allowed_file,
    build_file_tree,
)

logger = logging.getLogger(__name__)

# ── Global session store ──────────────────────────────────────────────────────
# Tracks ingestion progress per session
session_store: dict[str, dict] = {}

# Sessions expire after 24 hours
SESSION_TTL_SECONDS = 60 * 60 * 24


async def fetch_repo_tree(owner: str, repo: str, github_token: Optional[str] = None) -> list[dict]:
    """
    Fetch the full file tree of a GitHub repository using the Git Trees API.
    Returns a list of dicts with 'path', 'type', 'size', and 'sha' keys.
    """
    headers = {
        "Accept": "application/vnd.github.v3+json",
        "User-Agent": "RepoDocs/1.0",
    }
    if github_token:
        headers["Authorization"] = f"token {github_token}"
        logger.debug("Using GitHub token: %s...%s", github_token[:4], github_token[-4:])

    async with httpx.AsyncClient(timeout=30.0) as client:
        # First get the default branch
        repo_resp = await client.get(
            f"https://api.github.com/repos/{owner}/{repo}",
            headers=headers,
        )

        if repo_resp.status_code == 404:
            raise ValueError(
                f"Repository '{owner}/{repo}' not found. "
                "Make sure it's a public repository."
            )
        if repo_resp.status_code == 403:
            raise ValueError(
                "GitHub API rate limit exceeded. "
                "Set GITHUB_TOKEN in .env to increase the limit."
            )
        repo_resp.raise_for_status()
        default_branch = repo_resp.json().get("default_branch", "main")

        # Get the full tree recursively
        try:
            tree_resp = await client.get(
                f"https://api.github.com/repos/{owner}/{repo}/git/trees/{default_branch}?recursive=1",
                headers=headers,
            )
            tree_resp.raise_for_status()
        except httpx.HTTPStatusError as e:
            if e.response.status_code == 409:
                raise ValueError(f"Repository '{owner}/{repo}' is empty. Please push your code to GitHub first!")
            raise
            
        tree_data = tree_resp.json()

        if tree_data.get("truncated", False):
            logger.warning(f"Repository tree was truncated for {owner}/{repo}")

        return [
            item for item in tree_data.get("tree", [])
            if item.get("type") == "blob"
        ]


async def fetch_file_content(
    client: httpx.AsyncClient,
    owner: str,
    repo: str,
    file_path: str,
    github_token: Optional[str] = None,
) -> Optional[str]:
    """Fetch the raw content of a single file from GitHub."""
    headers = {
        "Accept": "application/vnd.github.v3.raw",
        "User-Agent": "RepoDocs/1.0",
    }
    if github_token:
        headers["Authorization"] = f"token {github_token}"

    try:
        resp = await client.get(
            f"https://api.github.com/repos/{owner}/{repo}/contents/{file_path}",
            headers=headers,
        )
        if resp.status_code != 200:
            logger.warning(f"Failed to fetch {file_path}: HTTP {resp.status_code}")
            return None
        return resp.text
    except Exception as e:
        logger.warning(f"Failed to decode or fetch {file_path}: {e}")
        return None


def chunk_file_content(
    content: str,
    file_path: str,
    repo_url: str,
    chunk_size: int = 800,
    chunk_overlap: int = 100,
) -> list[dict]:
    """
    Split file content into chunks with metadata including line numbers.
    """
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=chunk_size,
        chunk_overlap=chunk_overlap,
        length_function=len,
        separators=["\n\nclass ", "\n\ndef ", "\n\n", "\n", " ", ""],
    )

    chunks = splitter.split_text(content)
    lines = content.split("\n")
    result = []

    for chunk_text in chunks:
        # Find the start line of this chunk in the original content
        start_idx = content.find(chunk_text)
        if start_idx == -1:
            start_line = 1
            end_line = len(lines)
        else:
            start_line = content[:start_idx].count("\n") + 1
            end_line = start_line + chunk_text.count("\n")

        result.append({
            "text": chunk_text,
            "metadata": {
                "file_path": file_path,
                "start_line": start_line,
                "end_line": end_line,
                "repo_url": repo_url,
            },
        })

    return result


async def ingest_repository(
    session_id: str,
    repo_url: str,
    owner: str,
    repo: str,
    max_files: int = 500,
    github_token: Optional[str] = None,
) -> dict:
    """
    Main ingestion pipeline:
    1. Fetch repo tree from GitHub
    2. Filter allowed files
    3. Fetch file contents
    4. Chunk all files
    5. Embed and store in vector store
    6. Return summary
    """
    persist_dir = os.getenv("FAISS_INDEX_DIR", "./faiss_indexes")
    index_path = os.path.join(persist_dir, session_id)

    # Initialize session tracking
    session_store[session_id] = {
        "status": "processing",
        "progress_percent": 0,
        "stage": "Fetching repository tree...",
        "repo_name": f"{owner}/{repo}",
        "repo_url": repo_url,
        "file_tree": [],
        "total_chunks": 0,
        "file_count": 0,
        "skipped_count": 0,
        "created_at": time.time(),
    }

    try:
        # ── Stage 1: Fetch tree ───────────────────────────────────────────
        session_store[session_id]["stage"] = "Fetching repository tree..."
        session_store[session_id]["progress_percent"] = 5

        tree_items = await fetch_repo_tree(owner, repo, github_token)

        # Filter files
        allowed_files = [
            item for item in tree_items
            if is_allowed_file(item["path"])
        ]
        skipped_count = len(tree_items) - len(allowed_files)
        session_store[session_id]["skipped_count"] = skipped_count

        if len(allowed_files) > max_files:
            raise ValueError(
                f"Repository has {len(allowed_files)} indexable files "
                f"(limit is {max_files}). Consider indexing a specific folder."
            )

        if not allowed_files:
            raise ValueError("No indexable code files found in this repository.")

        file_paths = [item["path"] for item in allowed_files]
        session_store[session_id]["file_tree"] = build_file_tree(file_paths)
        session_store[session_id]["progress_percent"] = 15

        # ── Stage 2: Fetch file contents ──────────────────────────────────
        session_store[session_id]["stage"] = "Fetching files..."
        all_chunks = []
        total_files = len(file_paths)

        # Fetch files in batches to respect rate limits
        batch_size = 10
        async with httpx.AsyncClient(timeout=30.0) as client:
            for batch_start in range(0, total_files, batch_size):
                batch_end = min(batch_start + batch_size, total_files)
                batch_paths = file_paths[batch_start:batch_end]

                tasks = [
                    fetch_file_content(client, owner, repo, fp, github_token)
                    for fp in batch_paths
                ]
                contents = await asyncio.gather(*tasks, return_exceptions=True)

                for fp, content in zip(batch_paths, contents):
                    if isinstance(content, Exception) or content is None:
                        skipped_count += 1
                        continue

                    chunks = chunk_file_content(content, fp, repo_url)
                    all_chunks.extend(chunks)

                # Update progress (15% to 70% during fetching)
                progress = 15 + int((batch_end / total_files) * 55)
                session_store[session_id]["progress_percent"] = min(progress, 70)
                session_store[session_id]["stage"] = (
                    f"Fetching files... ({batch_end}/{total_files})"
                )
                session_store[session_id]["file_count"] = batch_end

        if not all_chunks:
            raise ValueError("No content could be extracted from the repository.")

        session_store[session_id]["skipped_count"] = skipped_count

        # ── Stage 3: Embed and store ──────────────────────────────────────
        session_store[session_id]["stage"] = "Embedding code chunks..."
        session_store[session_id]["progress_percent"] = 75

        from hf_embeddings import DirectHuggingFaceEmbeddings
        hf_embeddings = DirectHuggingFaceEmbeddings(
            model="sentence-transformers/all-MiniLM-L6-v2",
            token=os.getenv("HF_TOKEN"),
        )

        texts = [c["text"] for c in all_chunks]
        metadatas = [c["metadata"] for c in all_chunks]

        # Generate embeddings via HuggingFace
        session_store[session_id]["stage"] = "Generating embeddings..."
        session_store[session_id]["progress_percent"] = 80

        # Run synchronously in a thread pool to avoid blocking async loop
        embedded_vectors = await asyncio.to_thread(hf_embeddings.embed_documents, texts)

        # Store in our simple vector store
        session_store[session_id]["stage"] = "Storing vectors..."
        session_store[session_id]["progress_percent"] = 90

        store = SimpleVectorStore()
        store.add_texts(texts=texts, embeddings=embedded_vectors, metadatas=metadatas)
        store.save_local(index_path)

        session_store[session_id]["progress_percent"] = 95
        session_store[session_id]["stage"] = "Finalizing..."

        # ── Done ──────────────────────────────────────────────────────────
        successful_files = total_files - (skipped_count - (len(tree_items) - len(allowed_files)))
        session_store[session_id].update({
            "status": "ready",
            "progress_percent": 100,
            "stage": "Ready!",
            "total_chunks": len(all_chunks),
            "file_count": max(0, successful_files),
        })

        return {
            "session_id": session_id,
            "total_chunks": len(all_chunks),
            "file_count": len(file_paths),
            "file_tree": session_store[session_id]["file_tree"],
            "skipped_count": skipped_count,
        }

    except Exception as e:
        logger.exception(f"Ingestion failed for {repo_url}: {e}")
        session_store[session_id].update({
            "status": "error",
            "progress_percent": 0,
            "stage": str(e),
        })
        raise


def cleanup_session(session_id: str) -> bool:
    """Remove a session's vector store index and metadata."""
    import shutil
    persist_dir = os.getenv("FAISS_INDEX_DIR", "./faiss_indexes")
    index_path = os.path.join(persist_dir, session_id)

    try:
        if os.path.exists(index_path):
            shutil.rmtree(index_path)

        if session_id in session_store:
            del session_store[session_id]

        return True
    except Exception as e:
        logger.error(f"Cleanup failed for session {session_id}: {e}")
        return False


def cleanup_expired_sessions():
    """Remove sessions that have exceeded the TTL."""
    now = time.time()
    expired = [
        sid for sid, data in session_store.items()
        if now - data.get("created_at", 0) > SESSION_TTL_SECONDS
    ]
    for sid in expired:
        logger.info(f"Expiring session {sid}")
        cleanup_session(sid)
    if expired:
        logger.info(f"Cleaned up {len(expired)} expired session(s).")
