# /api/ia_app/app/__init__.py
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
MODEL_DIR = BASE_DIR / "model_assets"
DATA_CACHE_DIR = BASE_DIR / "data_cache"

__all__ = ["BASE_DIR", "MODEL_DIR", "DATA_CACHE_DIR"]

