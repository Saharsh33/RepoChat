"""
Tests for retrieval.vector_store — store_chunks and retrieve logic.

Uses chromadb.EphemeralClient to avoid any persistent storage.
Mocks the embedding function to avoid hitting the HuggingFace API.
"""

from unittest.mock import patch

import chromadb

from retrieval.schema import ChunkSchema, ChunkType, RetrievalMode
from retrieval.vector_store import store_chunks, retrieve, retrieve_diverse, tokenize


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_chunk(cid, content, file_path="test.py", chunk_type=ChunkType.PLAINTEXT):
    """Create a ChunkSchema with sensible defaults."""
    return ChunkSchema(
        id=cid,
        content=content,
        file_path=file_path,
        chunk_type=chunk_type,
        signature="",
        start_line="1",
        end_line="10",
    )


def _fake_embedding(dim=384):
    """Return a deterministic fake embedding vector."""
    import random
    random.seed(42)
    return [random.random() for _ in range(dim)]


def _make_embeddings(n, dim=384):
    """Return n distinct fake embedding vectors."""
    import random
    result = []
    for i in range(n):
        random.seed(i)
        result.append([random.random() for _ in range(dim)])
    return result


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------

class TestTokenize:
    def test_basic_tokenization(self):
        tokens = tokenize("Hello, world! How are you?")
        assert tokens == ["hello", "world", "how", "are", "you"]

    def test_code_tokenization(self):
        tokens = tokenize("def my_function(self, arg1):")
        assert "def" in tokens
        assert "my_function" in tokens


class TestStoreAndRetrieve:
    """Integration tests for store_chunks + retrieve using EphemeralClient."""

    @patch("retrieval.vector_store.get_client")
    @patch("retrieval.vector_store.embed_query")
    def test_store_and_retrieve_semantic(self, mock_embed_query, mock_get_client):
        """Store chunks, then retrieve them in semantic mode."""
        client = chromadb.EphemeralClient()
        mock_get_client.return_value = client

        # Store some chunks
        chunks = [
            _make_chunk("c1", "def add(a, b): return a + b", "math.py"),
            _make_chunk("c2", "def subtract(a, b): return a - b", "math.py"),
            _make_chunk("c3", "# README\nThis is a project", "README.md",
                        ChunkType.MARKDOWN),
        ]
        embeddings = _make_embeddings(3)
        store_chunks(chunks, embeddings, "test_repo")

        # Verify stored
        collection = client.get_collection("repo_test_repo")
        assert collection.count() == 3

        # Retrieve — mock embed_query to return a fake vector
        mock_embed_query.return_value = _fake_embedding()

        results = retrieve(
            query="addition function",
            repo_id="test_repo",
            top_k=3,
            mode=RetrievalMode.SEMANTIC,
        )

        assert len(results) > 0
        assert all(hasattr(r, "score") for r in results)
        assert all(hasattr(r, "content") for r in results)

    @patch("retrieval.vector_store.get_client")
    @patch("retrieval.vector_store.embed_query")
    def test_hybrid_retrieval_includes_bm25(self, mock_embed_query, mock_get_client):
        """Hybrid mode combines semantic and BM25 scores."""
        client = chromadb.EphemeralClient()
        mock_get_client.return_value = client

        chunks = [
            _make_chunk("c1", "authentication login password user", "auth.py"),
            _make_chunk("c2", "database connection pool query", "db.py"),
            _make_chunk("c3", "login user password verify bcrypt", "login.py"),
        ]
        embeddings = _make_embeddings(3)
        store_chunks(chunks, embeddings, "hybrid_repo")

        mock_embed_query.return_value = _fake_embedding()

        results = retrieve(
            query="login password",
            repo_id="hybrid_repo",
            top_k=3,
            mode=RetrievalMode.HYBRID,
        )

        assert len(results) > 0
        # In hybrid mode, chunks containing "login" and "password" should score higher
        contents = [r.content for r in results]
        # At least one of the top results should contain our keywords
        assert any("login" in c for c in contents)

    @patch("retrieval.vector_store.get_client")
    @patch("retrieval.vector_store.embed_query")
    def test_retrieve_diverse_limits_per_file(self, mock_embed_query, mock_get_client):
        """retrieve_diverse() respects max_per_file limit."""
        client = chromadb.EphemeralClient()
        mock_get_client.return_value = client

        # 4 chunks from same file, 1 from another
        chunks = [
            _make_chunk("c1", "func one", "same_file.py"),
            _make_chunk("c2", "func two", "same_file.py"),
            _make_chunk("c3", "func three", "same_file.py"),
            _make_chunk("c4", "func four", "same_file.py"),
            _make_chunk("c5", "other content", "other_file.py"),
        ]
        embeddings = _make_embeddings(5)
        store_chunks(chunks, embeddings, "diverse_repo")

        mock_embed_query.return_value = _fake_embedding()

        results = retrieve_diverse(
            query="function",
            repo_id="diverse_repo",
            top_k=5,
            max_per_file=2,
        )

        # Count results per file
        from collections import Counter
        file_counts = Counter(r.file_path for r in results)
        for path, count in file_counts.items():
            assert count <= 2, f"File {path} has {count} results, expected <= 2"

    @patch("retrieval.vector_store.get_client")
    @patch("retrieval.vector_store.embed_query")
    def test_empty_collection_returns_empty(self, mock_embed_query, mock_get_client):
        """Querying an empty collection returns empty list."""
        client = chromadb.EphemeralClient()
        mock_get_client.return_value = client

        mock_embed_query.return_value = _fake_embedding()

        results = retrieve(
            query="anything",
            repo_id="empty_repo",
            top_k=5,
            mode=RetrievalMode.SEMANTIC,
        )
        assert results == []

    @patch("retrieval.vector_store.get_client")
    @patch("retrieval.vector_store.embed_query")
    def test_keyword_only_mode(self, mock_embed_query, mock_get_client):
        """Keyword-only retrieval uses BM25 without semantic scores."""
        client = chromadb.EphemeralClient()
        mock_get_client.return_value = client

        chunks = [
            _make_chunk("c1", "python flask web server routes", "server.py"),
            _make_chunk("c2", "react component render state hooks", "app.js"),
        ]
        embeddings = _make_embeddings(2)
        store_chunks(chunks, embeddings, "kw_repo")

        # embed_query should NOT be called in keyword mode
        results = retrieve(
            query="flask web server",
            repo_id="kw_repo",
            top_k=2,
            mode=RetrievalMode.KEYWORD,
        )

        assert len(results) > 0
        # Flask-related chunk should rank higher
        assert "flask" in results[0].content.lower()
