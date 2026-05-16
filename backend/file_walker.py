import os

ALLOWED_EXTENSIONS = {
    ".py", ".js", ".ts",
    ".java", ".go",
    ".cpp", ".c", ".rs",
    ".rb", ".md", ".rst", ".txt"
}

SKIP_DIRS = {
    "node_modules",
    ".git",
    "dist",
    "build",
    "venv",
    "__pycache__"
}


def get_files(repo_path):

    valid_files = []

    for root, dirs, files in os.walk(repo_path):

        # remove skipped dirs
        dirs[:] = [d for d in dirs if d not in SKIP_DIRS]

        for file in files:

            # skip minified js
            if file.endswith(".min.js"):
                continue

            ext = os.path.splitext(file)[1]

            if ext in ALLOWED_EXTENSIONS:

                full_path = os.path.join(root, file)

                valid_files.append(full_path)

    return valid_files