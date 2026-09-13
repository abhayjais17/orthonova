from pydantic_settings import BaseSettings
from typing import List
from functools import lru_cache


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    # Database
    database_url: str = "mysql+pymysql://root:password@localhost:3306/orthonova"

    # API
    cors_origins: List[str] = ["http://localhost:3000", "http://127.0.0.1:3000"]
    app_env: str = "development"
    debug: bool = True

    # ML Model thresholds
    # These define when a risk level is assigned based on model probability
    risk_threshold_low: float = 0.33  # prob < 0.33 = Low
    risk_threshold_moderate: float = 0.67  # 0.33 <= prob < 0.67 = Moderate
    # prob >= 0.67 = High

    # Screening gate parameters
    min_age_for_screening: int = 40  # Below this, auto-fail gate
    max_age_for_screening: int = 100  # Above this, auto-fail gate (or refer to doctor)

    class Config:
        env_file = ".env"


@lru_cache()
def get_settings() -> Settings:
    """Get cached settings instance."""
    settings = Settings()

    # DEBUG: Print exact hostname being used
    print("=" * 80)
    print("DEBUG: DATABASE_URL from config:")
    print(f"  Full URL: {settings.database_url}")
    if '@' in settings.database_url:
        # Extract hostname from connection string
        after_at = settings.database_url.split('@')[1]
        hostname = after_at.split(':')[0] if ':' in after_at else after_at.split('/')[0]
        print(f"  Extracted hostname: [{hostname}]")
        print(f"  Hostname length: {len(hostname)} characters")
        print(f"  Hostname repr: {repr(hostname)}")
    print("=" * 80)

    return settings
