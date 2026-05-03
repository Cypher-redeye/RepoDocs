"""
Utility functions for RepoDocs backend.
File filtering, tree building, GitHub URL parsing, and helpers.
"""

import re
import hashlib
from typing import Optional
from urllib.parse import urlparse


# ── File Extension Whitelist ──────────────────────────────────────────────────

ALLOWED_EXTENSIONS = {
    ".py", ".js", ".ts", ".jsx", ".tsx",
    ".java", ".go", ".md", ".txt",
    ".env.example", ".html", ".css", ".scss",
    ".json", ".yaml", ".yml", ".toml",
    ".rs", ".rb", ".php", ".c", ".cpp", ".h",
    ".sh", ".bat", ".ps1", ".sql",
    ".dockerfile", ".makefile",
}

# ── Directories / Patterns to Skip ──────────────────────────────────────────

SKIP_DIRS = {
    "node_modules", ".git", "dist", "build", "__pycache__",
    ".next", ".nuxt", "vendor", ".venv", "venv", "env",
    ".tox", ".mypy_cache", ".pytest_cache", "coverage",
    ".idea", ".vscode", ".vs", "target", "bin", "obj",
    ".cache", ".parcel-cache", ".turbo",
}

SKIP_FILES = {
    "package-lock.json", "yarn.lock", "pnpm-lock.yaml",
    "poetry.lock", "Pipfile.lock", "composer.lock",
    "Gemfile.lock", "Cargo.lock", "go.sum",
}

BINARY_EXTENSIONS = {
    ".png", ".jpg", ".jpeg", ".gif", ".svg", ".ico",
    ".bmp", ".webp", ".mp4", ".mp3", ".wav", ".ogg",
    ".pdf", ".zip", ".tar", ".gz", ".rar", ".7z",
    ".exe", ".dll", ".so", ".dylib", ".woff", ".woff2",
    ".ttf", ".eot", ".pyc", ".pyo", ".class", ".jar",
    ".o", ".a", ".lib", ".wasm",
}


def parse_github_url(url: str) -> tuple[str, str]:
    """
    Extract owner and repo name from a GitHub URL.
    Supports formats:
      - https://github.com/owner/repo
      - https://github.com/owner/repo.git
      - github.com/owner/repo
      - https://github.com/owner/repo/tree/main/...
    """
    url = url.strip().rstrip("/")

    # Remove .git suffix
    if url.endswith(".git"):
        url = url[:-4]

    patterns = [
        r"(?:https?://)?github\.com/([^/]+)/([^/]+?)(?:/tree/[^/]+.*)?$",
        r"(?:https?://)?github\.com/([^/]+)/([^/]+?)(?:/blob/[^/]+.*)?$",
        r"(?:https?://)?github\.com/([^/]+)/([^/]+)$",
    ]

    for pattern in patterns:
        match = re.match(pattern, url)
        if match:
            return match.group(1), match.group(2)

    raise ValueError(
        f"Invalid GitHub URL: '{url}'. "
        "Expected format: https://github.com/owner/repo"
    )


def validate_github_url(url: str) -> Optional[str]:
    """
    Validate a GitHub URL and return an error message if invalid, or None if valid.
    Uses strict hostname parsing to prevent SSRF attacks.
    """
    if not url or not url.strip():
        return "URL cannot be empty."

    url = url.strip()

    # Strict hostname validation to prevent SSRF
    try:
        parsed = urlparse(url)
        if parsed.scheme not in ("https", "http", ""):
            return "URL must use HTTPS."
        if parsed.hostname not in ("github.com", "www.github.com"):
            return "URL must be a GitHub repository URL (e.g., https://github.com/owner/repo)."
    except Exception:
        return "Invalid URL format."

    try:
        owner, repo = parse_github_url(url)
        if not owner or not repo:
            return "Could not extract owner and repository from URL."
    except ValueError as e:
        return str(e)

    return None


def generate_session_id(repo_url: str) -> str:
    """Generate a deterministic session ID from the repo URL."""
    normalized = repo_url.strip().lower().rstrip("/")
    if normalized.endswith(".git"):
        normalized = normalized[:-4]
    return hashlib.sha256(normalized.encode()).hexdigest()[:16]


def validate_session_id(session_id: str) -> bool:
    """Validate that a session ID is a safe hex string to prevent path traversal."""
    return bool(re.match(r'^[a-f0-9]{16}$', session_id))


# ── Input Sanitization ────────────────────────────────────────────────────────

MAX_MESSAGE_LENGTH = 5000
MAX_HISTORY_LENGTH = 50


def sanitize_user_message(message: str) -> str:
    """Sanitize and truncate user chat messages."""
    if not message:
        return ""
    return message[:MAX_MESSAGE_LENGTH].strip()


def generate_collection_name(session_id: str) -> str:
    """Generate a ChromaDB collection name from session ID."""
    return f"repo_{session_id}"


def should_skip_path(path: str) -> bool:
    """Check if a file path should be skipped based on directory or file rules."""
    parts = path.split("/")

    # Check if any directory in the path is in SKIP_DIRS
    for part in parts[:-1]:
        if part in SKIP_DIRS:
            return True

    # Check if the file itself is in SKIP_FILES
    filename = parts[-1] if parts else ""
    if filename in SKIP_FILES:
        return True

    return False


def is_allowed_file(path: str) -> bool:
    """Check if a file should be included based on its extension."""
    if should_skip_path(path):
        return False

    filename = path.split("/")[-1].lower()

    # Check binary extensions
    for ext in BINARY_EXTENSIONS:
        if filename.endswith(ext):
            return False

    # Check for specific allowed filenames
    if filename in {"dockerfile", "makefile", ".gitignore", ".dockerignore"}:
        return True

    # Check extension whitelist
    for ext in ALLOWED_EXTENSIONS:
        if filename.endswith(ext):
            return True

    return False


def build_file_tree(file_paths: list[str]) -> dict:
    """
    Build a hierarchical file tree from a list of file paths.
    Returns a nested dict structure suitable for the frontend.
    """
    tree = {}

    for path in sorted(file_paths):
        parts = path.split("/")
        current = tree
        for i, part in enumerate(parts):
            if i == len(parts) - 1:
                # Leaf node (file)
                current[part] = {"type": "file", "path": path}
            else:
                # Directory node
                if part not in current:
                    current[part] = {"type": "dir", "children": {}}
                elif isinstance(current[part], dict) and "children" in current[part]:
                    pass
                else:
                    current[part] = {"type": "dir", "children": {}}
                current = current[part]["children"]

    return _tree_to_list(tree)


def _tree_to_list(tree: dict) -> list[dict]:
    """Convert the nested dict tree to a list format for the frontend."""
    result = []
    for name, value in sorted(tree.items(), key=lambda x: (x[1].get("type", "") != "dir", x[0])):
        if value.get("type") == "dir":
            result.append({
                "name": name,
                "type": "dir",
                "children": _tree_to_list(value.get("children", {})),
            })
        else:
            result.append({
                "name": name,
                "type": "file",
                "path": value.get("path", ""),
            })
    return result


def estimate_tokens(text: str) -> int:
    """Rough estimate of token count (1 token ≈ 4 chars)."""
    return len(text) // 4


def truncate_text(text: str, max_chars: int = 500) -> str:
    """Truncate text to a maximum number of characters."""
    if len(text) <= max_chars:
        return text
    return text[:max_chars] + "..."
