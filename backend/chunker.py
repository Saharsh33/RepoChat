from tree_sitter_languages import get_parser
import re
import os
import warnings

warnings.filterwarnings("ignore", category=FutureWarning)

MAX_LINES = 100
OVERLAP_LINES = 20

TARGET_TYPES = {
    # Python
    "function_definition",
    "class_definition",
    "async_function_definition",

    # Go
    "function_declaration",
    "method_declaration",
    "type_declaration",

    # JS/TS
    "function_declaration",
    "method_definition",
    "class_declaration",

    # Rust
    "function_item",

    # Java
    "method_declaration",
    "class_declaration"
}

LANGUAGE_MAP = {
    ".py": "python",
    ".js": "javascript",
    ".ts": "typescript",
    ".go": "go",
    ".rs": "rust",
    ".java": "java",
    ".cpp": "cpp",
    ".c": "c"
}


def read_file(file_path):

    with open(file_path, "r", encoding="utf-8") as f:
        return f.read()


def create_subchunks(lines, metadata):

    chunks = []

    start = 0

    while start < len(lines):

        end = min(start + MAX_LINES, len(lines))

        chunk_lines = lines[start:end]

        chunk = {
            **metadata,
            "start_line": metadata["start_line"] + start,
            "end_line": metadata["start_line"] + end - 1,
            "content": "".join(chunk_lines)
        }

        chunks.append(chunk)

        if end == len(lines):
            break

        start += MAX_LINES - OVERLAP_LINES

    return chunks


def process_node(node, code, file_path, chunks):

    if node.type in TARGET_TYPES:

        content = code[node.start_byte:node.end_byte]

        content_lines = content.splitlines()

        signature = content_lines[0].strip() if content_lines else ""

        metadata = {
            "file": file_path,
            "type": node.type,
            "signature": signature,
            "start_line": node.start_point[0] + 1,
            "end_line": node.end_point[0] + 1,
        }

        lines_with_newlines = content.splitlines(keepends=True)

        if len(lines_with_newlines) > MAX_LINES:

            subchunks = create_subchunks(
                lines_with_newlines,
                metadata
            )

            chunks.extend(subchunks)

        else:

            chunk = {
                **metadata,
                "content": content
            }

            chunks.append(chunk)

    for child in node.children:
        process_node(child, code, file_path, chunks)


def chunk_code_file(file_path):

    ext = os.path.splitext(file_path)[1]

    language = LANGUAGE_MAP.get(ext)

    if not language:
        return []

    try:
        parser = get_parser(language)

    except Exception as e:
        print(f"Parser error for {file_path}: {e}")
        return []

    code = read_file(file_path)

    try:
        tree = parser.parse(bytes(code, "utf8"))

    except Exception as e:
        print(f"Parse error for {file_path}: {e}")
        return []

    root = tree.root_node

    chunks = []

    process_node(root, code, file_path, chunks)

    # fallback plaintext chunking
    if not chunks:

        lines = code.splitlines(keepends=True)

        metadata = {
            "file": file_path,
            "type": "plaintext",
            "signature": "",
            "start_line": 1,
            "end_line": len(lines)
        }

        chunks = create_subchunks(lines, metadata)

    return chunks


def chunk_markdown_file(file_path):

    text = read_file(file_path)

    pattern = r'(^## .*?$|^### .*?$)'

    sections = re.split(pattern, text, flags=re.MULTILINE)

    chunks = []

    current_heading = ""

    for section in sections:

        if section.startswith("##") or section.startswith("###"):

            current_heading = section.strip()

            continue

        if not section.strip():
            continue

        content = current_heading + "\n\n" + section.strip()

        chunk = {
            "file": file_path,
            "type": "markdown",
            "signature": current_heading,
            "start_line": 0,
            "end_line": 0,
            "content": content
        }

        chunks.append(chunk)

    return chunks