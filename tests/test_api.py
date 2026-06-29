"""
Tests for FastAPI endpoints — integration tests using TestClient.

Uses SQLite in-memory database to avoid requiring Postgres.
Patches the database dependency so all routes use the test DB.
"""

import os
import sys
from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

# Ensure project root is importable
PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from backend.database import Base, get_db
from backend.main import app


# ---------------------------------------------------------------------------
# Test DB setup
# ---------------------------------------------------------------------------

TEST_ENGINE = create_engine(
    "sqlite:///:memory:",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)


@event.listens_for(TEST_ENGINE, "connect")
def _set_sqlite_pragma(dbapi_conn, _connection_record):
    cursor = dbapi_conn.cursor()
    cursor.execute("PRAGMA foreign_keys=ON")
    cursor.close()


TestSession = sessionmaker(bind=TEST_ENGINE)


def override_get_db():
    db = TestSession()
    try:
        yield db
    finally:
        db.close()


# Override the DB dependency for all tests
app.dependency_overrides[get_db] = override_get_db


@pytest.fixture(autouse=True)
def setup_db():
    """Create tables before each test, drop after."""
    Base.metadata.create_all(bind=TEST_ENGINE)
    yield
    Base.metadata.drop_all(bind=TEST_ENGINE)


@pytest.fixture()
def client():
    return TestClient(app)


# ---------------------------------------------------------------------------
# Helper
# ---------------------------------------------------------------------------

def _register_user(client, username="testuser", password="testpass123"):
    """Register a user and return the JWT token."""
    res = client.post("/api/auth/register", json={
        "username": username,
        "password": password,
    })
    assert res.status_code == 200, f"Registration failed: {res.text}"
    return res.json()["access_token"]


def _auth_headers(token):
    return {"Authorization": f"Bearer {token}"}


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------

class TestHomeEndpoint:
    def test_home_returns_200(self, client):
        res = client.get("/")
        assert res.status_code == 200
        assert res.json() == {"message": "Backend running"}


class TestAuthEndpoints:
    def test_register_creates_user(self, client):
        res = client.post("/api/auth/register", json={
            "username": "newuser",
            "password": "securepass",
        })
        assert res.status_code == 200
        data = res.json()
        assert "access_token" in data
        assert data["token_type"] == "bearer"

    def test_register_duplicate_username_fails(self, client):
        _register_user(client, "dupuser", "pass123")
        res = client.post("/api/auth/register", json={
            "username": "dupuser",
            "password": "pass456",
        })
        assert res.status_code == 400

    def test_login_with_valid_credentials(self, client):
        _register_user(client, "loginuser", "mypassword")

        res = client.post("/api/auth/token", data={
            "username": "loginuser",
            "password": "mypassword",
        })
        assert res.status_code == 200
        assert "access_token" in res.json()

    def test_login_with_wrong_password(self, client):
        _register_user(client, "loginuser2", "correctpass")

        res = client.post("/api/auth/token", data={
            "username": "loginuser2",
            "password": "wrongpass",
        })
        assert res.status_code == 401

    def test_me_endpoint_with_valid_token(self, client):
        token = _register_user(client, "meuser", "pass")
        res = client.get("/api/auth/me", headers=_auth_headers(token))
        assert res.status_code == 200
        assert res.json()["username"] == "meuser"

    def test_me_endpoint_without_token(self, client):
        res = client.get("/api/auth/me")
        assert res.status_code == 401


class TestRepoEndpoints:
    def test_create_repo_requires_auth(self, client):
        """POST /api/repos without auth returns 401."""
        res = client.post("/api/repos", json={"github_url": "https://github.com/user/repo"})
        assert res.status_code == 401

    def test_list_repos_empty(self, client):
        """Authenticated user with no repos gets empty list."""
        token = _register_user(client)
        res = client.get("/api/repos", headers=_auth_headers(token))
        assert res.status_code == 200
        assert res.json() == []

    @patch("backend.routes.repos.run_ingest")
    def test_create_repo_authenticated(self, mock_ingest, client):
        """Authenticated user can create a repo."""

        token = _register_user(client)
        res = client.post(
            "/api/repos",
            json={"github_url": "https://github.com/user/testrepo"},
            headers=_auth_headers(token),
        )
        assert res.status_code == 200
        data = res.json()
        assert data["message"] == "Repository ingestion started"
        assert "repo_id" in data

    @patch("backend.routes.repos.run_ingest")
    def test_list_repos_after_creation(self, mock_ingest, client):
        """After creating a repo, it appears in the list."""

        token = _register_user(client)
        client.post(
            "/api/repos",
            json={"github_url": "https://github.com/user/myrepo"},
            headers=_auth_headers(token),
        )

        res = client.get("/api/repos", headers=_auth_headers(token))
        repos = res.json()
        assert len(repos) == 1
        assert repos[0]["repo_name"] == "myrepo"

    @patch("backend.routes.repos.run_ingest")
    def test_repo_status_endpoint(self, mock_ingest, client):
        """GET /api/repos/{id}/status returns repo details."""

        token = _register_user(client)
        create_res = client.post(
            "/api/repos",
            json={"github_url": "https://github.com/user/statusrepo"},
            headers=_auth_headers(token),
        )
        repo_id = create_res.json()["repo_id"]

        res = client.get(f"/api/repos/{repo_id}/status", headers=_auth_headers(token))
        assert res.status_code == 200
        assert res.json()["status"] == "pending"

    def test_repo_status_not_found(self, client):
        """Status for non-existent repo returns 404."""
        token = _register_user(client)
        res = client.get("/api/repos/99999/status", headers=_auth_headers(token))
        assert res.status_code == 404

    @patch("backend.routes.repos.run_ingest")
    def test_repos_isolated_per_user(self, mock_ingest, client):
        """User A cannot see User B's repos."""

        token_a = _register_user(client, "user_a", "pass")
        token_b = _register_user(client, "user_b", "pass")

        client.post(
            "/api/repos",
            json={"github_url": "https://github.com/a/repo"},
            headers=_auth_headers(token_a),
        )

        # User B should see no repos
        res = client.get("/api/repos", headers=_auth_headers(token_b))
        assert res.json() == []
