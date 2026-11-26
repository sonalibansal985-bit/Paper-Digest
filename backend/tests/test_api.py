"""Flask backend API tests using Flask's built-in test client."""

import sys
import unittest
from pathlib import Path
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))

from backend.app.main import app  # noqa: E402


class FlaskApiTests(unittest.TestCase):
    def setUp(self):
        self.client = app.test_client()

    def test_info_endpoints(self):
        self.assertEqual(self.client.get("/").get_json()["status"], "running")
        self.assertEqual(self.client.get("/api").get_json()["status"], "running")
        self.assertEqual(self.client.get("/health").get_json()["status"], "healthy")
        self.assertIn("success", self.client.get("/api/test").get_json())

    def test_backend_does_not_serve_frontend_files(self):
        # Frontend is a separate static repo; this service is API-only.
        for path in ("/index.html", "/reader.html", "/js/app.js"):
            self.assertEqual(self.client.get(path).status_code, 404)

    def test_empty_question_is_rejected(self):
        response = self.client.post("/api/ask", json={"question": "   "})
        self.assertEqual(response.status_code, 400)
        self.assertIn("detail", response.get_json())

    @patch("backend.app.main.arxiv.fetch_papers")
    def test_papers_endpoint_passes_count_and_seed(self, fetch):
        fetch.return_value = [{"id": "1"}]
        response = self.client.get("/api/papers?count=5&seed=demo")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.get_json()["count"], 1)
        fetch.assert_called_once_with(count=5, seed="demo", force=False)

    def test_cors_allows_the_static_frontend_origin(self):
        response = self.client.options(
            "/api/ask",
            headers={
                "Origin": "https://paper-digest-frontend.vercel.app",
                "Access-Control-Request-Method": "POST",
            },
        )
        self.assertEqual(response.status_code, 204)
        self.assertEqual(response.headers["Access-Control-Allow-Origin"], "*")
        self.assertIn("POST", response.headers["Access-Control-Allow-Methods"])

    @patch.dict("os.environ", {"ALLOWED_ORIGINS": "https://frontend.example"})
    def test_cors_can_be_restricted_by_environment(self):
        allowed = self.client.get(
            "/health", headers={"Origin": "https://frontend.example"}
        )
        blocked = self.client.get(
            "/health", headers={"Origin": "https://other.example"}
        )
        self.assertEqual(
            allowed.headers["Access-Control-Allow-Origin"], "https://frontend.example"
        )
        self.assertNotIn("Access-Control-Allow-Origin", blocked.headers)


if __name__ == "__main__":
    unittest.main()
