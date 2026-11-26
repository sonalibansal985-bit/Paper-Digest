"""Vercel entrypoint: exposes the backend-only Flask app for WSGI hosting.

Local development: flask --app backend.app.main run --port 8000
"""

from backend.app.main import app

__all__ = ["app"]
