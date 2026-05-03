"""
RepoDocs — FastAPI Application
RAG-powered codebase chat. Paste a GitHub repo URL and chat with the code.
"""

import os
import asyncio
import logging
from contextlib import asynccontextmanager

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, BackgroundTasks, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, JSONResponse
from pydantic import BaseModel, Field
from slowapi import Limiter
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

from ingestion import ingest_repository, session_store, cleanup_session, cleanup_expired_sessions
from retrieval import generate_streaming_response
from utils import (
    parse_github_url, validate_github_url, generate_session_id,
    validate_session_id, sanitize_user_message,
    MAX_MESSAGE_LENGTH, MAX_HISTORY_LENGTH,
)

# ── Load environment ──────────────────────────────────────────────────────────
load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"), override=True)
load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env.example"))

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


# ── Rate Limiter ──────────────────────────────────────────────────────────────
limiter = Limiter(key_func=get_remote_address)


# ── Lifespan ──────────────────────────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("🚀 RepoDocs backend starting up...")
    os.makedirs(os.getenv("FAISS_INDEX_DIR", "./faiss_indexes"), exist_ok=True)
    yield
    # Clean up expired sessions on shutdown
    cleanup_expired_sessions()
    logger.info("👋 RepoDocs backend shutting down...")


# ── App init ──────────────────────────────────────────────────────────────────
app = FastAPI(
    title="RepoDocs API",
    description="RAG-powered codebase chat — paste a GitHub repo URL and ask anything.",
    version="1.0.0",
    lifespan=lifespan,
)

app.state.limiter = limiter


@app.exception_handler(RateLimitExceeded)
async def rate_limit_handler(request: Request, exc: RateLimitExceeded):
    return JSONResponse(
        status_code=429,
        content={"detail": "Too many requests. Please slow down."},
    )


# ── CORS — Restrict to known origins ─────────────────────────────────────────
ALLOWED_ORIGINS = os.getenv(
    "CORS_ORIGINS", "http://localhost:5173,http://localhost:3000"
).split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in ALLOWED_ORIGINS],
    allow_credentials=False,
    allow_methods=["GET", "POST", "DELETE"],
    allow_headers=["Content-Type"],
)


# ── Request / Response Models ─────────────────────────────────────────────────
class IngestRequest(BaseModel):
    repo_url: str = Field(..., description="GitHub repository URL")


class IngestResponse(BaseModel):
    session_id: str
    total_chunks: int
    file_count: int
    file_tree: list
    skipped_count: int = 0


class ChatRequest(BaseModel):
    session_id: str
    message: str
    chat_history: list[dict] = Field(default_factory=list)


class StatusResponse(BaseModel):
    status: str  # processing | ready | error
    progress_percent: int
    stage: str = ""
    repo_name: str = ""
    file_count: int = 0
    total_chunks: int = 0
    skipped_count: int = 0
    file_tree: list = Field(default_factory=list)


# ── Routes ────────────────────────────────────────────────────────────────────

@app.post("/api/ingest", response_model=IngestResponse)
@limiter.limit("5/minute")
async def ingest_repo(payload: IngestRequest, background_tasks: BackgroundTasks, request: Request):
    """
    Ingest a GitHub repository: fetch files, chunk, embed, and store.
    Kicks off processing in the background and returns immediately.
    """
    # Validate URL
    error = validate_github_url(payload.repo_url)
    if error:
        raise HTTPException(status_code=400, detail=error)

    try:
        owner, repo = parse_github_url(payload.repo_url)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    session_id = generate_session_id(payload.repo_url)
    max_files = int(os.getenv("MAX_FILES", "500"))
    github_token = os.getenv("GITHUB_TOKEN", "").strip() or None

    # Check if already processing or ready
    if session_id in session_store:
        status = session_store[session_id].get("status")
        if status == "processing":
            raise HTTPException(
                status_code=409,
                detail="This repository is currently being processed."
            )
        if status == "ready":
            # Return existing session
            return IngestResponse(
                session_id=session_id,
                total_chunks=session_store[session_id].get("total_chunks", 0),
                file_count=session_store[session_id].get("file_count", 0),
                file_tree=session_store[session_id].get("file_tree", []),
                skipped_count=session_store[session_id].get("skipped_count", 0),
            )

    # Initialize session as processing
    session_store[session_id] = {
        "status": "processing",
        "progress_percent": 0,
        "stage": "Starting...",
        "repo_name": f"{owner}/{repo}",
        "repo_url": payload.repo_url,
        "file_tree": [],
        "total_chunks": 0,
        "file_count": 0,
        "skipped_count": 0,
    }

    # Start ingestion in background
    background_tasks.add_task(
        _run_ingestion,
        session_id=session_id,
        repo_url=payload.repo_url,
        owner=owner,
        repo=repo,
        max_files=max_files,
        github_token=github_token,
    )

    return IngestResponse(
        session_id=session_id,
        total_chunks=0,
        file_count=0,
        file_tree=[],
        skipped_count=0,
    )


async def _run_ingestion(
    session_id: str,
    repo_url: str,
    owner: str,
    repo: str,
    max_files: int,
    github_token: str | None,
):
    """Background task wrapper for ingestion."""
    try:
        await ingest_repository(
            session_id=session_id,
            repo_url=repo_url,
            owner=owner,
            repo=repo,
            max_files=max_files,
            github_token=github_token,
        )
    except Exception as e:
        logger.exception(f"Background ingestion failed: {e}")
        if session_id in session_store:
            session_store[session_id]["status"] = "error"
            session_store[session_id]["stage"] = str(e)


@app.post("/api/chat")
@limiter.limit("20/minute")
async def chat(payload: ChatRequest, request: Request):
    """
    Chat with an ingested repository. Streams the response via SSE.
    """
    session_id = payload.session_id

    # Validate session ID format to prevent path traversal
    if not validate_session_id(session_id):
        raise HTTPException(status_code=400, detail="Invalid session ID.")

    # Validate session exists and is ready
    if session_id not in session_store:
        raise HTTPException(status_code=404, detail="Session not found. Please ingest a repository first.")

    status = session_store[session_id].get("status")
    if status == "processing":
        raise HTTPException(status_code=409, detail="Repository is still being processed.")
    if status == "error":
        raise HTTPException(status_code=500, detail="Repository ingestion failed. Please try again.")

    if not payload.message.strip():
        raise HTTPException(status_code=400, detail="Message cannot be empty.")

    # Validate message length
    if len(payload.message) > MAX_MESSAGE_LENGTH:
        raise HTTPException(status_code=400, detail=f"Message too long (max {MAX_MESSAGE_LENGTH} characters).")

    # Sanitize message
    sanitized_message = sanitize_user_message(payload.message)

    # Truncate chat history to prevent memory abuse
    chat_history = payload.chat_history[-MAX_HISTORY_LENGTH:] if payload.chat_history else []

    return StreamingResponse(
        generate_streaming_response(
            session_id=session_id,
            message=sanitized_message,
            chat_history=chat_history,
        ),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@app.get("/api/status/{session_id}", response_model=StatusResponse)
@limiter.limit("60/minute")
async def get_status(session_id: str, request: Request):
    """Get the current ingestion status for a session."""
    if not validate_session_id(session_id):
        raise HTTPException(status_code=400, detail="Invalid session ID.")
    if session_id not in session_store:
        raise HTTPException(status_code=404, detail="Session not found.")

    data = session_store[session_id]
    return StatusResponse(
        status=data.get("status", "processing"),
        progress_percent=data.get("progress_percent", 0),
        stage=data.get("stage", ""),
        repo_name=data.get("repo_name", ""),
        file_count=data.get("file_count", 0),
        total_chunks=data.get("total_chunks", 0),
        skipped_count=data.get("skipped_count", 0),
        file_tree=data.get("file_tree", []),
    )


@app.delete("/api/session/{session_id}")
async def delete_session(session_id: str):
    """Clean up a session's vector store index and metadata."""
    if not validate_session_id(session_id):
        raise HTTPException(status_code=400, detail="Invalid session ID.")
    if session_id not in session_store:
        raise HTTPException(status_code=404, detail="Session not found.")

    success = cleanup_session(session_id)
    if success:
        return {"message": "Session cleaned up successfully."}
    else:
        raise HTTPException(status_code=500, detail="Failed to clean up session.")


@app.get("/api/health")
async def health():
    """Health check endpoint."""
    return {"status": "ok", "service": "RepoDocs"}


# ── Run server ────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
