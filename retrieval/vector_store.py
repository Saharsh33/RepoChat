import chromadb
import os
import re

from typing import List, Dict
from rank_bm25 import BM25Okapi

from retrieval.schema import (
    ChunkSchema,
    ChunkType,
    RetrievedChunkSchema,
    RetrievalMode
)

from worker.embeddings.embedder import get_model


VECTOR_DB_PATH = "/app/vector_db"


def get_collection(repo_id: str):
    print("giving collection name: ", f"repo_{repo_id}")
    client = chromadb.PersistentClient(
        path=VECTOR_DB_PATH
    )

    return client.get_or_create_collection(
        name=f"repo_{repo_id}"
    )


def store_chunks(
    chunks: List[ChunkSchema],
    embeddings,
    repo_id: str
):

    collection = get_collection(repo_id)

    ids = []
    documents = []
    metadatas = []

    for chunk in chunks:

        ids.append(chunk.id)

        documents.append(chunk.content)

        metadatas.append(
            chunk.to_metadata()
        )

    batch_size = 500

    for i in range(0, len(ids), batch_size):

        print(f"Storing batch {i}")

        collection.add(
            ids=ids[i:i+batch_size],
            embeddings=embeddings[i:i+batch_size].tolist(),
            documents=documents[i:i+batch_size],
            metadatas=metadatas[i:i+batch_size],
        )
    print("Chunks stored successfully")

    count = collection.count()

    print(f"Collection count after insert: {count}")

    print("Finished storing in ChromaDB")


def tokenize(text: str) -> List[str]:
    return re.findall(r'\w+', text.lower())


def retrieve(
    query: str,
    repo_id: str,
    top_k: int = 10,
    mode: RetrievalMode = RetrievalMode.HYBRID
) -> List[RetrievedChunkSchema]:

    collection = get_collection(repo_id)
    print(f"Using collection: repo_{repo_id}")

    count = collection.count()

    print(f"Collection contains {count} chunks")

    all_stored = collection.get(
        include=["documents", "metadatas"]
    )

    all_ids = all_stored.get("ids")
    all_docs = all_stored.get("documents")
    all_metadatas = all_stored.get("metadatas")

    if not all_ids or not all_docs:
        return []

    chunk_lookup = {}

    for idx, cid in enumerate(all_ids):

        chunk_lookup[cid] = {
            "content": all_docs[idx],
            "metadata": all_metadatas[idx]
        }

    final_scores: Dict[str, float] = {}

    semantic_scores: Dict[str, float] = {}

    if mode in [
        RetrievalMode.SEMANTIC,
        RetrievalMode.HYBRID
    ]:

        model = get_model()

        query_embedding = model.encode([query])

        sem_results = collection.query(
            query_embeddings=query_embedding.tolist(),
            n_results=top_k,
            include=["distances"]
        )

        sem_ids = sem_results.get("ids")
        sem_dists = sem_results.get("distances")

        if sem_ids and sem_dists:

            print("Distances:", sem_dists[0])

            for i in range(len(sem_ids[0])):

                distance = float(sem_dists[0][i])

                # convert distance -> similarity
                similarity = 1 / (1 + distance)

                semantic_scores[
                    sem_ids[0][i]
                ] = similarity

            print("Semantic scores:", semantic_scores)

    bm25_scores: Dict[str, float] = {}

    if mode in [
        RetrievalMode.KEYWORD,
        RetrievalMode.HYBRID
    ]:

        tokenized_corpus = [
            tokenize(doc)
            for doc in all_docs
        ]

        bm25 = BM25Okapi(tokenized_corpus)

        tokenized_query = tokenize(query)

        raw_scores = bm25.get_scores(
            tokenized_query
        )

        max_score = max(raw_scores) if len(raw_scores) > 0 else 0

        for idx, cid in enumerate(all_ids):

            bm25_scores[cid] = (
                float(raw_scores[idx]) / max_score
                if max_score > 0 else 0.0
            )

    for cid in all_ids:

        s_score = semantic_scores.get(cid, 0.0)
        b_score = bm25_scores.get(cid, 0.0)

        # if (
        #     mode in [
        #         RetrievalMode.SEMANTIC,
        #         RetrievalMode.HYBRID
        #     ]
        #     and s_score < 0.25
        # ):
        #     continue

        if mode == RetrievalMode.HYBRID:

            final_scores[cid] = (
                0.7 * s_score +
                0.3 * b_score
            )

        elif mode == RetrievalMode.SEMANTIC:

            final_scores[cid] = s_score

        else:

            final_scores[cid] = b_score

    sorted_candidates = sorted(
        final_scores.items(),
        key=lambda x: x[1],
        reverse=True
    )[:top_k]

    retrieved_chunks = []

    for cid, score in sorted_candidates:

        data = chunk_lookup[cid]

        metadata = data["metadata"] or {}

        try:
            enum_chunk_type = ChunkType(
                metadata.get(
                    "chunk_type",
                    "plaintext"
                )
            )

        except ValueError:

            enum_chunk_type = ChunkType.PLAINTEXT

        retrieved_chunks.append(
            RetrievedChunkSchema(
                id=str(cid),
                content=str(data["content"]),
                file_path=str(
                    metadata.get(
                        "file_path",
                        ""
                    )
                ),
                chunk_type=enum_chunk_type,
                signature=str(
                    metadata.get(
                        "signature", 
                        ""
                    )
                ),
                start_line=str(
                    metadata.get(
                        "start_line",
                        "0"
                    )
                ),
                end_line=str(
                    metadata.get(
                        "end_line",
                        "0"
                    )
                ),
                score=score
            )
        )

    return retrieved_chunks