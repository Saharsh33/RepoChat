"""
Tests for worker.ingestion.file_walker — file discovery logic.
"""

import os

from worker.ingestion.file_walker import get_files, ALLOWED_EXTENSIONS, SKIP_DIRS


class TestGetFiles:
    """Tests for get_files()."""

    def test_finds_allowed_extensions(self, tmp_repo):
        """Should discover .py, .js, and .md files."""
        files = get_files(str(tmp_repo))
        basenames = {os.path.basename(f) for f in files}

        assert "calculator.py" in basenames
        assert "greeter.js" in basenames
        assert "README.md" in basenames

    def test_finds_nested_files(self, tmp_repo):
        """Should recurse into subdirectories."""
        files = get_files(str(tmp_repo))
        basenames = {os.path.basename(f) for f in files}

        assert "utils.py" in basenames, "Expected to find lib/utils.py"

    def test_skips_excluded_dirs(self, tmp_repo):
        """Should not traverse node_modules/ or __pycache__/."""
        files = get_files(str(tmp_repo))

        for f in files:
            parts = f.split(os.sep)
            for skip_dir in SKIP_DIRS:
                assert skip_dir not in parts, (
                    f"File {f} is inside excluded directory '{skip_dir}'"
                )

    def test_skips_minified_js(self, tmp_repo):
        """Should skip *.min.js files."""
        files = get_files(str(tmp_repo))
        basenames = {os.path.basename(f) for f in files}

        assert "bundle.min.js" not in basenames

    def test_skips_unsupported_extensions(self, tmp_repo):
        """Should not include .png or other non-code files."""
        files = get_files(str(tmp_repo))
        basenames = {os.path.basename(f) for f in files}

        assert "logo.png" not in basenames

    def test_empty_directory(self, tmp_path):
        """Empty directory returns empty list."""
        files = get_files(str(tmp_path))
        assert files == []

    def test_all_allowed_extensions(self, tmp_path):
        """Every extension in ALLOWED_EXTENSIONS is discovered."""
        for ext in ALLOWED_EXTENSIONS:
            fname = f"sample{ext}"
            (tmp_path / fname).write_text(f"content for {ext}", encoding="utf-8")

        files = get_files(str(tmp_path))
        found_exts = {os.path.splitext(f)[1] for f in files}

        for ext in ALLOWED_EXTENSIONS:
            assert ext in found_exts, f"Expected {ext} to be discovered"
