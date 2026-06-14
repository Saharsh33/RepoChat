"""
Tests for llm.query_pipeline — query rewriting and intent routing.
"""

import json
from unittest.mock import patch

from llm.query_pipeline import rewrite_and_route, _route_only


class TestRouteOnly:
    """Tests for _route_only() — keyword-based classification with no history."""

    def test_overview_query(self):
        result = _route_only("What does this project do?")
        assert result["query_type"] == "overview"
        assert result["rewritten_query"] == "What does this project do?"

    def test_overview_explain(self):
        result = _route_only("Explain this project")
        assert result["query_type"] == "overview"

    def test_architecture_query(self):
        result = _route_only("How is the project structured?")
        assert result["query_type"] == "architecture"

    def test_architecture_folder(self):
        result = _route_only("What is the folder structure?")
        assert result["query_type"] == "architecture"

    def test_architecture_components(self):
        result = _route_only("What are the main components?")
        assert result["query_type"] == "architecture"

    def test_implementation_query(self):
        result = _route_only("How does the auth middleware validate tokens?")
        assert result["query_type"] == "implementation"

    def test_casual_hello(self):
        result = _route_only("hello")
        assert result["query_type"] == "casual"

    def test_casual_thanks(self):
        result = _route_only("thanks")
        assert result["query_type"] == "casual"

    def test_casual_hey(self):
        result = _route_only("hey")
        assert result["query_type"] == "casual"

    def test_unknown_defaults_to_implementation(self):
        """Queries that don't match any keyword pattern default to implementation."""
        result = _route_only("Where is the database connection pool configured?")
        assert result["query_type"] == "implementation"


class TestRewriteAndRoute:
    """Tests for rewrite_and_route() — with chat history (mocks Groq)."""

    def test_no_history_skips_rewrite(self):
        """When history is empty, should use _route_only (no LLM call)."""
        result = rewrite_and_route("What does this project do?", history=[])
        assert result["query_type"] == "overview"
        assert result["rewritten_query"] == "What does this project do?"

    @patch("llm.query_pipeline.generate_response")
    def test_rewrite_with_history(self, mock_generate):
        """With history, the LLM rewrites the follow-up question."""
        mock_generate.return_value = json.dumps({
            "rewritten_query": "How does the JWT authentication middleware work in auth_service.py?",
            "query_type": "implementation"
        })

        history = [
            {"role": "user", "content": "Tell me about the auth system"},
            {"role": "assistant", "content": "The auth system uses JWT tokens..."},
        ]

        result = rewrite_and_route("How does it work exactly?", history)

        assert result["query_type"] == "implementation"
        assert "JWT" in result["rewritten_query"]
        mock_generate.assert_called_once()

    @patch("llm.query_pipeline.generate_response")
    def test_rewrite_handles_markdown_wrapped_json(self, mock_generate):
        """LLM sometimes wraps JSON in ```json ... ``` — parser handles it."""
        mock_generate.return_value = '```json\n{"rewritten_query": "standalone question", "query_type": "overview"}\n```'

        history = [{"role": "user", "content": "previous question"}]
        result = rewrite_and_route("follow up", history)

        assert result["query_type"] == "overview"
        assert result["rewritten_query"] == "standalone question"

    @patch("llm.query_pipeline.generate_response")
    def test_rewrite_fallback_on_invalid_json(self, mock_generate):
        """If LLM returns garbage, falls back to original query + implementation."""
        mock_generate.return_value = "This is not JSON at all"

        history = [{"role": "user", "content": "previous question"}]
        result = rewrite_and_route("my follow-up", history)

        assert result["rewritten_query"] == "my follow-up"
        assert result["query_type"] == "implementation"

    @patch("llm.query_pipeline.generate_response")
    def test_rewrite_invalid_query_type_defaults(self, mock_generate):
        """If LLM returns an unknown query_type, it defaults to implementation."""
        mock_generate.return_value = json.dumps({
            "rewritten_query": "some question",
            "query_type": "unknown_type"
        })

        history = [{"role": "user", "content": "previous question"}]
        result = rewrite_and_route("follow up", history)

        assert result["query_type"] == "implementation"
