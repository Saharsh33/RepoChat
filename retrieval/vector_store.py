import os
from typing import List
import uuid
from retrieval.chroma_client import client
from retrieval.schema import ChunkSchema, ChunkType, RetrievedChunkSchema
from worker.embeddings.embedder import get_model


# Absolute stable path
BASE_DIR = os.path.dirname(os.path.abspath(__file__))

VECTOR_DB_PATH = os.path.join(BASE_DIR, "vector_db")


def get_collection(repo_id):
    return client.get_or_create_collection(name=f"repo_{repo_id}")


def store_chunks(chunks: List[ChunkSchema], embedding: list, repo_id: str):
    collection = get_collection(repo_id)

    ids = []
    content = []
    metadatas = []

    for chunk in chunks:
        ids.append(chunk.id)
        content.append(chunk.content)
        metadatas.append(chunk.to_metadata())

    batch_size = 5000
    for i in range(0, len(ids), batch_size):
        collection.add(
            ids = ids[i: i+batch_size],
            embeddings=embedding[i: i+batch_size],
            documents=content[i: i+batch_size],
            metadatas=metadatas[i: i+batch_size],
        )

def retrieve(query, repo_id, top_k) -> List[RetrievedChunkSchema]:
    collection = get_collection(repo_id)

    model = get_model()
    query_embedding = model.encode([query], show_progress_bar=True)

    results = collection.query(
        query_embeddings=query_embedding.tolist(),
        n_results=top_k,
        include=["documents", "metadatas", "distances"]
    )

    if not results["ids"] or not results["ids"][0]:
        return []
    
    res_ids = results.get("ids")
    res_docs = results.get("documents")
    res_meta = results.get("metadatas")
    res_dist = results.get("distances")

    if res_ids is None or res_docs is None or res_meta is None or res_dist is None:
        return []

    if len(res_ids) == 0 or len(res_ids[0]) == 0:
        return []

    retrieved_chunks = []

    ids = res_ids[0]
    documents = res_docs[0]
    metadatas = res_meta[0]
    distances = res_dist[0]

    for i in range(len(ids)):
        similarity_score = 1.0 - distances[i]
        
        if similarity_score < 0.25: 
            continue
            
        metadata = metadatas[i]
        if metadata is None:
            continue
        
        raw_type = str(metadata.get("chunk_type", "plaintext"))
        try:
            enum_chunk_type = ChunkType(raw_type)
        except ValueError:
            enum_chunk_type = ChunkType.PLAINTEXT
        
        chunk = RetrievedChunkSchema(
            id=str(ids[i]),
            content=str(documents[i]),
            file_path=str(metadata.get("file_path", "")),
            start_line=str(metadata.get("start_line", "0")),
            end_line=str(metadata.get("end_line", "0")),
            chunk_type=enum_chunk_type,
            score=float(similarity_score)
        )
        retrieved_chunks.append(chunk)
        
    return retrieved_chunks