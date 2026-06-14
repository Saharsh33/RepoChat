"""
Shared pytest fixtures for RepoChat tests.

Provides:
- db_session: SQLite in-memory database with all models created
- tmp_repo: Temporary directory with sample source files
- mock_chroma_collection: Fake ChromaDB collection backed by dicts
"""

import os
import sys
import textwrap

import pytest
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

# ---------------------------------------------------------------------------
# Ensure project root is on sys.path so imports like `backend.*` work
# ---------------------------------------------------------------------------
PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from backend.database import Base  # noqa: E402
from backend.models import Repo, Chunk, Message, User  # noqa: E402, F401


# ---------------------------------------------------------------------------
# Database fixture — SQLite in-memory
# ---------------------------------------------------------------------------

@pytest.fixture()
def db_engine():
    """Create a disposable SQLite in-memory engine with all tables."""
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )

    # SQLite needs foreign key enforcement turned on explicitly
    @event.listens_for(engine, "connect")
    def _set_sqlite_pragma(dbapi_conn, _connection_record):
        cursor = dbapi_conn.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()

    Base.metadata.create_all(bind=engine)
    yield engine
    engine.dispose()


@pytest.fixture()
def db_session(db_engine):
    """Yield a DB session that rolls back after each test."""
    Session = sessionmaker(bind=db_engine)
    session = Session()
    yield session
    session.rollback()
    session.close()


# ---------------------------------------------------------------------------
# Temporary repo fixture — sample files for ingestion tests
# ---------------------------------------------------------------------------

SAMPLE_PYTHON = textwrap.dedent("""\
    class Calculator:
        \"\"\"A simple calculator class.\"\"\"

        def add(self, a, b):
            return a + b

        def subtract(self, a, b):
            return a - b


    def helper_function(x):
        \"\"\"Stand-alone helper.\"\"\"
        return x * 2
""")

SAMPLE_JS = textwrap.dedent("""\
    function greet(name) {
        return `Hello, ${name}!`;
    }

    class Greeter {
        constructor(name) {
            this.name = name;
        }

        sayHello() {
            return greet(this.name);
        }
    }
""")

SAMPLE_MARKDOWN = textwrap.dedent("""\
    # Project Title

    Some intro text.

    ## Installation

    Run `pip install mypackage`.

    ## Usage

    Import and use it.

    ### Advanced Usage

    More details here.
""")


@pytest.fixture()
def tmp_repo(tmp_path):
    """Create a temporary directory mimicking a cloned repo."""
    # Python file
    py_file = tmp_path / "calculator.py"
    py_file.write_text(SAMPLE_PYTHON, encoding="utf-8")

    # JavaScript file
    js_file = tmp_path / "greeter.js"
    js_file.write_text(SAMPLE_JS, encoding="utf-8")

    # Markdown file
    md_file = tmp_path / "README.md"
    md_file.write_text(SAMPLE_MARKDOWN, encoding="utf-8")

    # Minified JS (should be skipped)
    min_js = tmp_path / "bundle.min.js"
    min_js.write_text("var a=1;", encoding="utf-8")

    # Unsupported extension (should be skipped)
    img_file = tmp_path / "logo.png"
    img_file.write_bytes(b"\x89PNG")

    # Directories that should be skipped
    (tmp_path / "node_modules").mkdir()
    (tmp_path / "node_modules" / "dep.js").write_text("module.exports={};")
    (tmp_path / "__pycache__").mkdir()
    (tmp_path / "__pycache__" / "cached.pyc").write_bytes(b"\x00")

    # Nested valid file
    subdir = tmp_path / "lib"
    subdir.mkdir()
    (subdir / "utils.py").write_text("def util(): pass\n", encoding="utf-8")

    return tmp_path


# ---------------------------------------------------------------------------
# Mock ChromaDB collection
# ---------------------------------------------------------------------------

class MockChromaCollection:
    """In-memory fake of a ChromaDB collection for testing."""

    def __init__(self):
        self._store = {}  # id -> {document, metadata, embedding}

    def add(self, ids, documents, metadatas, embeddings=None):
        for i, cid in enumerate(ids):
            self._store[cid] = {
                "document": documents[i],
                "metadata": metadatas[i],
                "embedding": embeddings[i] if embeddings else None,
            }

    def get(self, include=None):
        ids = list(self._store.keys())
        docs = [self._store[k]["document"] for k in ids]
        metas = [self._store[k]["metadata"] for k in ids]
        return {"ids": ids, "documents": docs, "metadatas": metas}

    def query(self, query_embeddings, n_results=10, include=None):
        """Simplified: return all stored items sorted by cosine-ish distance."""
        ids = list(self._store.keys())
        # Fake distances — just return ascending order
        dists = [float(i) * 0.1 for i in range(len(ids))]
        return {
            "ids": [ids[:n_results]],
            "distances": [dists[:n_results]],
        }

    def count(self):
        return len(self._store)

    def delete(self, ids=None):
        if ids:
            for cid in ids:
                self._store.pop(cid, None)


@pytest.fixture()
def mock_chroma_collection():
    return MockChromaCollection()
