from repo_loader import clone_repo
from file_walker import get_files

from chunker import (
    chunk_code_file,
    chunk_markdown_file
)

from embedder import generate_embeddings
from vector_store import store_chunks

import json
import os
import shutil


def ingest_repo(repo_url: str):

    # clone repo
    repo_path = clone_repo(repo_url)

    # get all files
    files = get_files(repo_path)

    all_chunks = []

    # process files
    for file in files:

        print(f"Processing: {file}")

        if file.endswith((".md", ".rst", ".txt")):

            chunks = chunk_markdown_file(file)

        else:

            chunks = chunk_code_file(file)

        all_chunks.extend(chunks)

    print(f"\nTotal chunks: {len(all_chunks)}")

    # save chunks locally
    os.makedirs("chunks", exist_ok=True)

    with open("chunks/chunks.json", "w") as f:

        json.dump(all_chunks, f, indent=2)

    # generate embeddings
    print("\nGenerating embeddings...")

    embeddings = generate_embeddings(all_chunks)

    # store in chromadb
    print("\nStoring in ChromaDB...")

    store_chunks(all_chunks, embeddings)

    # delete cloned repo
    print("\nDeleting cloned repository...")

    shutil.rmtree(repo_path)

    print("Repository deleted")

    print("\nDone")

