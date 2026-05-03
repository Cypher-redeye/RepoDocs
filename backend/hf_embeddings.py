import os
import time
import logging
from langchain_core.embeddings import Embeddings
from langchain_huggingface import HuggingFaceEndpointEmbeddings

logger = logging.getLogger(__name__)

class DirectHuggingFaceEmbeddings(Embeddings):
    """
    Wraps the official HuggingFaceEndpointEmbeddings but adds robust retry logic
    to bypass the infamous StopIteration bugs when endpoints are asleep.
    """
    def __init__(self, model="sentence-transformers/all-MiniLM-L6-v2", token=None):
        self.model = model
        self.token = token or os.getenv("HF_TOKEN")
        self.underlying = HuggingFaceEndpointEmbeddings(
            model=self.model,
            huggingfacehub_api_token=self.token,
        )

    def embed_documents(self, texts: list[str]) -> list[list[float]]:
        valid_texts = [t if t.strip() else " " for t in texts]
        
        # Retry up to 5 times for StopIteration (model loading/rate limit)
        for attempt in range(5):
            try:
                return self.underlying.embed_documents(valid_texts)
            except StopIteration:
                if attempt < 4:
                    logger.info(f"HuggingFace endpoint asleep or rate limited. Retrying ({attempt+1}/5)...")
                    time.sleep(10)  # Wait 10s for the model to wake up
                    continue
                raise RuntimeError("HuggingFace Inference API is unavailable. The model might be loading or the rate limit is exhausted. Please try again later.")
            except Exception as e:
                if attempt < 4 and ("loading" in str(e).lower() or "timeout" in str(e).lower()):
                    logger.info(f"HuggingFace model loading. Retrying ({attempt+1}/5)...")
                    time.sleep(10)
                    continue
                raise RuntimeError(f"HuggingFace API Error: {str(e)}")

    def embed_query(self, text: str) -> list[float]:
        return self.embed_documents([text])[0]
