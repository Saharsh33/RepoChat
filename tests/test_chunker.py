"""
Tests for worker.ingestion.chunker — code and markdown chunking.
"""


from worker.ingestion.chunker import (
    chunk_code_file,
    chunk_markdown_file,
    create_subchunks,
    MAX_LINES,
)


class TestChunkCodeFile:
    """Tests for chunk_code_file()."""

    def test_chunk_python_file(self, tmp_repo):
        """Python file with functions and a class produces typed chunks."""
        py_file = str(tmp_repo / "calculator.py")
        chunks = chunk_code_file(py_file)

        assert len(chunks) > 0, "Expected at least one chunk from calculator.py"

        types_found = {c["type"] for c in chunks}
        # Should find class and function definitions
        assert "class_definition" in types_found, "Expected a class_definition chunk"
        assert "function_definition" in types_found, "Expected a function_definition chunk"

        # Every chunk must have required keys
        for chunk in chunks:
            assert "file" in chunk
            assert "content" in chunk
            assert "start_line" in chunk
            assert "end_line" in chunk
            assert chunk["start_line"] >= 1
            assert chunk["end_line"] >= chunk["start_line"]

    def test_chunk_js_file(self, tmp_repo):
        """JavaScript file with functions and classes produces chunks."""
        js_file = str(tmp_repo / "greeter.js")
        chunks = chunk_code_file(js_file)

        assert len(chunks) > 0, "Expected at least one chunk from greeter.js"

        types_found = {c["type"] for c in chunks}
        assert "function_declaration" in types_found or "class_declaration" in types_found

    def test_unsupported_extension_returns_empty(self, tmp_path):
        """File with unrecognized extension returns empty list."""
        unknown = tmp_path / "data.xyz"
        unknown.write_text("some data here\n", encoding="utf-8")
        chunks = chunk_code_file(str(unknown))
        assert chunks == []

    def test_plaintext_fallback(self, tmp_path):
        """Code file with no AST-recognized nodes falls back to plaintext."""
        # A .py file with only comments and whitespace — no function/class defs
        py_file = tmp_path / "empty_ish.py"
        py_file.write_text("# Just a comment\nx = 1\ny = 2\n", encoding="utf-8")
        chunks = chunk_code_file(str(py_file))

        assert len(chunks) > 0, "Expected plaintext fallback chunks"
        assert chunks[0]["type"] == "plaintext"

    def test_large_function_subchunking(self, tmp_path):
        """Function exceeding MAX_LINES is split into overlapping subchunks."""
        # Generate a Python function with > MAX_LINES lines
        lines = [f"    x_{i} = {i}" for i in range(MAX_LINES + 30)]
        big_func = "def big_function():\n" + "\n".join(lines) + "\n"

        py_file = tmp_path / "big.py"
        py_file.write_text(big_func, encoding="utf-8")

        chunks = chunk_code_file(str(py_file))

        assert len(chunks) >= 2, "Expected multiple subchunks for large function"

        # Verify overlap: second chunk's start_line should overlap with first
        if len(chunks) >= 2:
            first_end = chunks[0]["end_line"]
            second_start = chunks[1]["start_line"]
            assert second_start < first_end, (
                f"Expected overlap: chunk2 starts at {second_start}, "
                f"chunk1 ends at {first_end}"
            )

    def test_chunk_has_signature(self, tmp_repo):
        """Chunks for recognized nodes include a signature (first line)."""
        py_file = str(tmp_repo / "calculator.py")
        chunks = chunk_code_file(py_file)

        for chunk in chunks:
            if chunk["type"] != "plaintext":
                assert "signature" in chunk
                assert len(chunk["signature"]) > 0


class TestChunkMarkdownFile:
    """Tests for chunk_markdown_file()."""

    def test_chunk_markdown_file(self, tmp_repo):
        """Markdown file is split by ## and ### headings."""
        md_file = str(tmp_repo / "README.md")
        chunks = chunk_markdown_file(md_file)

        assert len(chunks) > 0, "Expected at least one chunk from README.md"

        # All chunks should be markdown type
        for chunk in chunks:
            assert chunk["type"] == "markdown"
            assert "content" in chunk
            assert len(chunk["content"]) > 0

    def test_markdown_heading_becomes_signature(self, tmp_repo):
        """Each chunk's signature should be the heading it belongs to."""
        md_file = str(tmp_repo / "README.md")
        chunks = chunk_markdown_file(md_file)

        signatures = [c["signature"] for c in chunks]
        # Our sample markdown has ## Installation, ## Usage, ### Advanced Usage
        assert any("Installation" in s for s in signatures)
        assert any("Usage" in s for s in signatures)

    def test_empty_markdown(self, tmp_path):
        """Empty markdown file returns empty list."""
        md_file = tmp_path / "empty.md"
        md_file.write_text("", encoding="utf-8")
        chunks = chunk_markdown_file(str(md_file))
        assert chunks == []


class TestCreateSubchunks:
    """Tests for the create_subchunks helper."""

    def test_short_content_single_chunk(self):
        """Content shorter than MAX_LINES produces a single subchunk."""
        lines = [f"line {i}\n" for i in range(10)]
        metadata = {"file": "test.py", "type": "function_definition",
                     "signature": "def f():", "start_line": 1, "end_line": 10}
        chunks = create_subchunks(lines, metadata)
        assert len(chunks) == 1
        assert chunks[0]["start_line"] == 1

    def test_long_content_multiple_chunks(self):
        """Content longer than MAX_LINES produces overlapping subchunks."""
        lines = [f"line {i}\n" for i in range(MAX_LINES + 50)]
        metadata = {"file": "test.py", "type": "function_definition",
                     "signature": "def f():", "start_line": 1,
                     "end_line": MAX_LINES + 50}
        chunks = create_subchunks(lines, metadata)
        assert len(chunks) >= 2
