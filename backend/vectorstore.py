"""
Simple vector store using NumPy for cosine similarity search.
No external vector DB required — stores embeddings as .npy files on disk.
"""

import os
import json
import pickle
import logging
import numpy as np
from typing import Optional

logger = logging.getLogger(__name__)


class SimpleVectorStore:
    """
    A lightweight vector store that uses NumPy for cosine similarity search.
    Persists to disk as .npy (embeddings) and .pkl (metadata) files.
    """

    def __init__(self):
        self.embeddings: Optional[np.ndarray] = None
        self.texts: list[str] = []
        self.metadatas: list[dict] = []

    def add_texts(self, texts: list[str], embeddings: list[list[float]], metadatas: list[dict]):
        """Add texts with their pre-computed embeddings and metadata."""
        new_embeddings = np.array(embeddings, dtype=np.float32)

        if self.embeddings is None:
            self.embeddings = new_embeddings
        else:
            self.embeddings = np.vstack([self.embeddings, new_embeddings])

        self.texts.extend(texts)
        self.metadatas.extend(metadatas)

    def similarity_search(self, query_embedding: list[float], k: int = 5) -> list[dict]:
        """
        Find the top-k most similar documents using cosine similarity.
        Returns list of dicts with 'text', 'metadata', and 'score' keys.
        """
        if self.embeddings is None or len(self.texts) == 0:
            return []

        query_vec = np.array(query_embedding, dtype=np.float32)

        # Normalize vectors for cosine similarity
        query_norm = query_vec / (np.linalg.norm(query_vec) + 1e-10)
        embed_norms = self.embeddings / (
            np.linalg.norm(self.embeddings, axis=1, keepdims=True) + 1e-10
        )

        # Cosine similarity
        similarities = np.dot(embed_norms, query_norm)

        # Get top-k indices
        k = min(k, len(self.texts))
        top_indices = np.argsort(similarities)[::-1][:k]

        results = []
        for idx in top_indices:
            results.append({
                "text": self.texts[idx],
                "metadata": self.metadatas[idx],
                "score": float(similarities[idx]),
            })

        return results

    def save_local(self, path: str):
        """Save the vector store to disk."""
        os.makedirs(path, exist_ok=True)

        if self.embeddings is not None:
            np.save(os.path.join(path, "embeddings.npy"), self.embeddings)

        with open(os.path.join(path, "texts.json"), "w", encoding="utf-8") as f:
            json.dump(self.texts, f, ensure_ascii=False)

        with open(os.path.join(path, "metadatas.json"), "w", encoding="utf-8") as f:
            json.dump(self.metadatas, f, ensure_ascii=False)

    @classmethod
    def load_local(cls, path: str) -> "SimpleVectorStore":
        """Load a vector store from disk."""
        store = cls()

        embeddings_path = os.path.join(path, "embeddings.npy")
        texts_path = os.path.join(path, "texts.json")
        metadatas_path = os.path.join(path, "metadatas.json")

        if os.path.exists(embeddings_path):
            store.embeddings = np.load(embeddings_path)

        if os.path.exists(texts_path):
            with open(texts_path, "r", encoding="utf-8") as f:
                store.texts = json.load(f)

        if os.path.exists(metadatas_path):
            with open(metadatas_path, "r", encoding="utf-8") as f:
                store.metadatas = json.load(f)

        return store

    @property
    def count(self) -> int:
        return len(self.texts)
