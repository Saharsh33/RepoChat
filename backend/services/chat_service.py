from retrieval.vector_store import retrieve
from llm.groq_client import generate_response
from llm.prompts import SYSTEM_PROMPT

MAX_CONTEXT_CHARS = 12000

def trim_chunks(chunks):
    total = 0
    final = []

    for chunk in chunks:

        if total + len(chunk.content) > MAX_CONTEXT_CHARS:
            break

        final.append(chunk)
        total += len(chunk.content)

    return final


def build_context(chunks):

    context_parts = []

    for chunk in chunks:

        context_parts.append(
            f"""
FILE: {chunk.file_path}
LINES: {chunk.start_line}-{chunk.end_line}

{chunk.content}
"""
        )

    return "\n\n".join(context_parts)


def chat_with_repo(repo_id, query, history=None):
    print("Starting retrieval...")

    chunks = retrieve(
        query=query,
        repo_id=repo_id,
        top_k=10
    )
    print(f"Retrieved {len(chunks)} chunks")
    chunks = trim_chunks(chunks)
    print("Building context...")
    context = build_context(chunks)
    print("Calling LLM...")
    messages = [
        {
            "role": "system",
            "content": SYSTEM_PROMPT
        }
    ]

    if history:
        messages.extend(history[-6:])

    messages.append({
        "role": "user",
        "content": f"""
Question:
{query}

Context:
{context}
"""
    })

    answer = generate_response(messages)
    print("LLM response received")
    return {
        "answer": answer,
        "sources": [
            {
                "file": c.file_path,
                "start": c.start_line,
                "end": c.end_line
            }
            for c in chunks
        ]
    }