import os
import re
from typing import List, Dict
from retrieval.chroma_client import client
from retrieval.schema import ChunkSchema, ChunkType, RetrievedChunkSchema, RetrievalMode
from worker.embeddings.embedder import get_model
from rank_bm25 import BM25Okapi

# Absolute stable path
BASE_DIR = os.path.dirname(os.path.abspath(__file__))

VECTOR_DB_PATH = os.path.join(BASE_DIR, "vector_db")


def get_collection(repo_id: str):
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

def tokenize(text: str) -> List[str]:
    return re.findall(r'\w+', text.lower())

def retrieve(query: str, repo_id: str, top_k: int = 10, mode: RetrievalMode = RetrievalMode.HYBRID) -> List[RetrievedChunkSchema]:
    collection = get_collection(repo_id)

    all_stored = collection.get(include=["documents", "metadatas"])
    
    all_ids = all_stored.get("ids")
    all_docs = all_stored.get("documents")
    all_metadatas = all_stored.get("metadatas")

    if not all_ids or all_docs is None or all_metadatas is None:
        return []

    # for fast lookup later on
    chunk_lookup = {}
    for idx, cid in enumerate(all_ids):
        chunk_lookup[cid] = {
            "content": all_docs[idx],
            "metadata": all_metadatas[idx]
        }
    
    final_scores: Dict[str, float] = {}

    # semantic search calculation
    semantic_scores: Dict[str, float] = {}
    if mode == RetrievalMode.SEMANTIC or mode == RetrievalMode.HYBRID:
        model = get_model()
        query_embedding = model.encode([query], show_progress_bar=True)

        sem_results = collection.query(
            query_embeddings=query_embedding.tolist(), #type: ignore
            n_results=top_k,
            include=["distances"]
        )

        sem_ids = sem_results.get("ids")
        sem_dists = sem_results.get("distances")

        if sem_ids is not None and sem_dists is not None:
            if len(sem_ids) > 0 and len(sem_dists) > 0:
                s_ids = sem_ids[0]
                s_dists = sem_dists[0]
                
                for i in range(len(s_ids)):
                    # convert to similarity score
                    similarity = 1.0 - float(s_dists[i])
                    semantic_scores[s_ids[i]] = similarity

    # bm25 keyword calculation
    bm25_scores: Dict[str, float] = {}
    if mode == RetrievalMode.KEYWORD or mode == RetrievalMode.HYBRID:
        tokenized_corpus = [tokenize(doc) for doc in all_docs]
        bm25 = BM25Okapi(tokenized_corpus)
        
        tokenized_query = tokenize(query)
        raw_bm25_scores = bm25.get_scores(tokenized_query)
        
        # normalize
        max_bm25 = max(raw_bm25_scores) if len(raw_bm25_scores) > 0 else 0
        for idx, cid in enumerate(all_ids):
            if max_bm25 > 0:
                bm25_scores[cid] = float(raw_bm25_scores[idx]) / max_bm25
            else:
                bm25_scores[cid] = 0.0

    # hybrid merge
    for cid in all_ids:
        s_score = semantic_scores.get(cid, 0.0)
        b_score = bm25_scores.get(cid, 0.0)

        if (mode == RetrievalMode.HYBRID or mode == RetrievalMode.SEMANTIC) and s_score < 0.25:
            continue

        if mode == RetrievalMode.HYBRID:
            final_scores[cid] = (0.7 * s_score) + (0.3 * b_score)
        elif mode == RetrievalMode.SEMANTIC:
            final_scores[cid] = s_score
        else:
            final_scores[cid] = b_score

    sorted_candidates = sorted(final_scores.items(), key=lambda x: x[1], reverse=True)[:top_k]
    
    retrieved_chunks = []
    for cid, score in sorted_candidates:
        data = chunk_lookup[cid]
        metadata = data["metadata"] or {}
        
        raw_type = str(metadata.get("chunk_type", "plaintext"))
        try:
            enum_chunk_type = ChunkType(raw_type)
        except ValueError:
            enum_chunk_type = ChunkType.PLAINTEXT

        chunk = RetrievedChunkSchema(
            id=str(cid),
            content=str(data["content"]),
            file_path=str(metadata.get("file_path", "")),
            start_line=str(metadata.get("start_line", "0")),
            end_line=str(metadata.get("end_line", "0")),
            chunk_type=enum_chunk_type,
            score=score
        )
        retrieved_chunks.append(chunk)

    return retrieved_chunks