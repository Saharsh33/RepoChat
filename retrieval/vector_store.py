import chromadb

client = chromadb.PersistentClient(
    path="./vector_db"
)

collection = client.get_or_create_collection(
    name="repo_chunks"
)


def store_chunks(chunks, embeddings):

    ids = []
    documents = []
    metadatas = []

    for i, chunk in enumerate(chunks):

        ids.append(f"chunk_{i}")

        documents.append(chunk["content"])

        metadatas.append({
            "file": chunk.get("file", ""),
            "type": chunk.get("type", "")
        })

    collection.add(
        ids=ids,
        documents=documents,
        embeddings=embeddings.tolist(),
        metadatas=metadatas
    )