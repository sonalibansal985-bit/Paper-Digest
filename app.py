"""Vercel entrypoint: exposes the Flask app for WSGI hosting.

Local development still uses: flask --app backend.app.main run --port 8000
"""

from backend.app.main import app

__all__ = ["app"]
