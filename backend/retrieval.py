"""
Retrieval module for RepoDocs.
Handles vector similarity search and LLM response generation with streaming.
"""

import os
import json
import logging
from typing import AsyncGenerator, Optional

from hf_embeddings import DirectHuggingFaceEmbeddings
from langchain_groq import ChatGroq
from langchain_core.messages import HumanMessage, AIMessage, SystemMessage

from vectorstore import SimpleVectorStore
from utils import truncate_text

logger = logging.getLogger(__name__)

# ── System prompt for the codebase assistant ──────────────────────────────────

SYSTEM_PROMPT = """You are RepoDocs, an expert codebase assistant. Your job is to answer questions about a GitHub repository using ONLY the provided code context.

RULES:
1. Answer ONLY based on the code context provided below. If the context doesn't contain enough information, say so clearly.
2. ALWAYS cite the specific file path and line numbers when referencing code. Use the format: `file_path` (lines X-Y).
3. When explaining code, be thorough but concise. Use code snippets from the context when helpful.
4. If asked about architecture or structure, describe how the files relate to each other based on the context.
5. If the question is about something not in the provided code, clearly state that the information isn't available in the indexed codebase.
6. Format your answers with markdown for readability — use headers, code blocks, and lists where appropriate.

CODE CONTEXT:
{context}"""

FOLLOWUP_PROMPT = """Based on the conversation so far and the code context, suggest exactly 3 brief follow-up questions the user might want to ask. Return them as a JSON array of strings. Only return the JSON array, nothing else.

Example: ["How does the auth middleware validate tokens?", "What database models are defined?", "Where is error handling implemented?"]"""


def get_vectorstore(session_id: str) -> SimpleVectorStore:
    """Load a vector store for a given session."""
    persist_dir = os.getenv("FAISS_INDEX_DIR", "./faiss_indexes")
    index_path = os.path.join(persist_dir, session_id)

    return SimpleVectorStore.load_local(index_path)


def get_embeddings() -> DirectHuggingFaceEmbeddings:
    """Get the HuggingFace API embeddings instance."""
    return DirectHuggingFaceEmbeddings(
        model="sentence-transformers/all-MiniLM-L6-v2",
        token=os.getenv("HF_TOKEN"),
    )


def retrieve_relevant_chunks(session_id: str, query: str, k: int = 5) -> list[dict]:
    """
    Perform similarity search against the session's vector store.
    Returns the top-k most relevant chunks with metadata.
    """
    store = get_vectorstore(session_id)
    embeddings = get_embeddings()

    try:
        query_embedding = embeddings.embed_query(query)
        results = store.similarity_search(query_embedding, k=k)
    except Exception as e:
        logger.error(f"Similarity search failed: {e}")
        return []

    chunks = []
    for result in results:
        chunks.append({
            "text": result["text"],
            "metadata": result["metadata"],
            "relevance_score": round(result["score"], 4),
        })

    return chunks


def format_context(chunks: list[dict]) -> str:
    """Format retrieved chunks into a context string for the LLM."""
    context_parts = []
    for i, chunk in enumerate(chunks, 1):
        meta = chunk["metadata"]
        file_path = meta.get("file_path", "unknown")
        start_line = meta.get("start_line", "?")
        end_line = meta.get("end_line", "?")

        context_parts.append(
            f"--- Source {i}: {file_path} (lines {start_line}-{end_line}) ---\n"
            f"{chunk['text']}\n"
        )

    return "\n".join(context_parts)


def build_messages(
    query: str,
    context: str,
    chat_history: list[dict],
) -> list:
    """Build the message list for the LLM call."""
    messages = [SystemMessage(content=SYSTEM_PROMPT.format(context=context))]

    # Add chat history (last 10 exchanges to stay within context window)
    for msg in chat_history[-20:]:
        role = msg.get("role", "user")
        content = msg.get("content", "")
        if role == "user":
            messages.append(HumanMessage(content=content))
        elif role == "assistant":
            messages.append(AIMessage(content=content))

    messages.append(HumanMessage(content=query))
    return messages


async def generate_streaming_response(
    session_id: str,
    message: str,
    chat_history: list[dict],
) -> AsyncGenerator[str, None]:
    """
    Stream a response from the LLM using retrieved code context.
    Yields SSE-formatted events.
    """
    # Retrieve relevant chunks
    chunks = retrieve_relevant_chunks(session_id, message, k=5)

    if not chunks:
        error_data = json.dumps({
            "type": "error",
            "content": "No relevant code found for your question. The repository may not have been indexed properly.",
        })
        yield f"data: {error_data}\n\n"
        return

    # Format sources for the response
    sources = []
    for chunk in chunks:
        meta = chunk["metadata"]
        sources.append({
            "file_path": meta.get("file_path", "unknown"),
            "start_line": meta.get("start_line", 0),
            "end_line": meta.get("end_line", 0),
            "preview": truncate_text(chunk["text"], 300),
            "full_text": chunk["text"],
        })

    # Send sources first
    sources_data = json.dumps({"type": "sources", "sources": sources})
    yield f"data: {sources_data}\n\n"

    # Build context and messages
    context = format_context(chunks)
    messages = build_messages(message, context, chat_history)

    # Stream LLM response via Groq
    llm = ChatGroq(
        model_name=os.getenv("GROQ_MODEL", "llama-3.1-8b-instant"),
        temperature=0.1,
        groq_api_key=os.getenv("GROQ_API_KEY"),
    )

    full_response = ""
    retry_count = 0
    max_retries = 1

    while retry_count <= max_retries:
        try:
            async for chunk in llm.astream(messages):
                token = chunk.content
                if token:
                    full_response += token
                    token_data = json.dumps({"type": "token", "content": token})
                    yield f"data: {token_data}\n\n"
            break  # Success, exit retry loop
        except Exception as e:
            retry_count += 1
            if retry_count > max_retries:
                logger.error(f"LLM request failed after {max_retries + 1} attempts: {e}")
                error_data = json.dumps({
                    "type": "error",
                    "content": "Failed to generate a response. Please try again.",
                })
                yield f"data: {error_data}\n\n"
                return
            logger.warning(f"LLM request failed, retrying ({retry_count}/{max_retries}): {e}")

    # Generate follow-up suggestions
    try:
        followup_messages = [
            SystemMessage(content=FOLLOWUP_PROMPT),
            HumanMessage(content=f"User question: {message}\n\nAssistant answer: {full_response[:500]}"),
        ]
        followup_llm = ChatGroq(
            model_name=os.getenv("GROQ_MODEL", "llama-3.1-8b-instant"),
            temperature=0.7,
            groq_api_key=os.getenv("GROQ_API_KEY"),
        )
        followup_resp = await followup_llm.ainvoke(followup_messages)
        suggestions = json.loads(followup_resp.content)
        if isinstance(suggestions, list) and len(suggestions) > 0:
            suggestions_data = json.dumps({
                "type": "suggestions",
                "suggestions": suggestions[:3],
            })
            yield f"data: {suggestions_data}\n\n"
    except Exception as e:
        logger.warning(f"Failed to generate follow-up suggestions: {e}")

    # Send done event
    done_data = json.dumps({"type": "done"})
    yield f"data: {done_data}\n\n"
