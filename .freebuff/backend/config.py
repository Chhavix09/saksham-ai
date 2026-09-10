"""Application configuration loaded from environment variables.

Never commit secrets. Copy `.env.example` to `.env` and fill in real values.
"""

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env", env_file_encoding="utf-8", extra="ignore"
    )

    app_name: str = "Scheme Up"
    environment: str = "development"  # development | production

    # Defaults to SQLite so the project runs with zero setup.
    # For production use PostgreSQL, e.g.
    #   postgresql+psycopg://user:pass@localhost:5432/sakshamai
    database_url: str = "sqlite:///./sakshamai.db"

    jwt_secret: str = "dev-only-secret-change-me-in-production"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 60 * 24 * 7  # 7 days
    remember_me_expire_minutes: int = 60 * 24 * 30  # 30 days

    # Comma separated list of allowed origins.
    cors_origins: str = "http://localhost:5173,http://localhost:5174,http://127.0.0.1:5173,http://127.0.0.1:5174"

    # Simple in-memory rate limiting for auth endpoints.
    rate_limit_requests: int = 30
    rate_limit_window_seconds: int = 60

    # Whether the optional ML ranking layer may be used when scikit-learn is installed.
    enable_ml: bool = True

    # ------------------------------------------------------------- AI assistant
    # Provider: "openai" | "anthropic" | "gemini" | "none" (chat disabled).
    # All credentials stay server-side; the frontend never sees keys.
    ai_provider: str = "none"
    ai_model: str = ""  # provider default used when empty
    ai_api_key: str = ""  # via environment: AI_API_KEY=...
    # Gemini users often name this key explicitly; AI_API_KEY takes precedence.
    gemini_api_key: str = ""  # via environment: GEMINI_API_KEY=...
    # Custom endpoint for OpenAI-compatible APIs (Groq, OpenRouter, Azure, local...).
    ai_base_url: str = ""  # e.g. https://api.groq.com/openai/v1
    ai_timeout_seconds: int = 45
    ai_max_output_tokens: int = 700
    ai_request_limit_per_minute: int = 12  # per-client rate limit for chat


settings = Settings()
if not settings.ai_api_key and settings.gemini_api_key:
    settings.ai_api_key = settings.gemini_api_key
