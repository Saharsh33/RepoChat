import os
import uuid
import chromadb


# Absolute stable path
BASE_DIR = os.path.dirname(os.path.abspath(__file__))

VECTOR_DB_PATH = os.path.join(BASE_DIR, "vector_db")


def get_collection():

    # Fresh client INSIDE worker process
    client = chromadb.PersistentClient(
        path=VECTOR_DB_PATH
    )

    collection = client.get_or_create_collection(
        name="repo_chunks"
    )

    return collection


def store_chunks(chunks, embeddings, repo_name):

    print(f"\nUsing ChromaDB path: {VECTOR_DB_PATH}")

    collection = get_collection()

    ids = []
    documents = []
    metadatas = []

    # CRITICAL:
    # force pure Python floats
    embeddings = [
        [float(x) for x in embedding]
        for embedding in embeddings
    ]

    for i, chunk in enumerate(chunks):

        ids.append(f"{repo_name}_{uuid.uuid4()}")

        documents.append(chunk["content"])

        metadatas.append({
            "file": chunk.get("file", ""),
            "type": chunk.get("type", "")
        })

        print(f"Prepared chunk {i+1}/{len(chunks)}")

    try:

        print(f"\nCalling collection.add()...")

        collection.add(
            ids=ids,
            documents=documents,
            embeddings=embeddings,
            metadatas=metadatas
        )

        print("Finished storing chunks in ChromaDB.")

    except Exception as e:

        print("\nCHROMADB ERROR:")
        print(str(e))

        raise