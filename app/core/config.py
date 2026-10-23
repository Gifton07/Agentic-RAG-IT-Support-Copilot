from functools import lru_cache
from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict

BASE_DIR = Path(__file__).resolve().parents[2]

class Settings(BaseSettings):
    app_name: str = "Enterprise IT Support Agentic RAG Copilot"
    app_env: str = "development"
    gemini_api_key: str = ""
    tavily_api_key: str = ""
    pinecone_api_key: str = ""
    pinecone_index_name: str = "agentic-rag"
    pinecone_namespace: str = "company-it-kb"
    embedding_model: str = "gemini-embedding-001"
    huggingface_api_key: str = ""
    gemini_model: str = "gemini-3.5-flash-lite"
    top_k: int = 4
    max_retries: int = 6
    admin_api_key: str = "change-me"
    # Database for simple chat history and audit logs
    audit_db_path: str = str(BASE_DIR / "data" / "audit.db")
    # Directory for uploaded files 
    upload_dir: str = str(BASE_DIR / "uploads")
    # Directory for sample knowledge base files
    sample_kb_dir: str = str(BASE_DIR / "data" / "sample_kb")

    model_config = SettingsConfigDict(env_file=str(BASE_DIR / ".env"), extra="ignore")




@lru_cache
def get_settings() -> Settings:
    return Settings()