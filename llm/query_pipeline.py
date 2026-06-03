"""
Query Pipeline — Combined query rewriting and routing in a single LLM call.

Rewrites follow-up questions into standalone queries using chat history,
and classifies the query intent for retrieval routing.
"""
import json
from llm.groq_client import generate_response
from llm.prompts import REWRITE_AND_ROUTE_PROMPT


def rewrite_and_route(query: str, history: list) -> dict:
    """
    Single LLM call that rewrites the query (if follow-up) and classifies intent.

    Returns:
        {
            "rewritten_query": str,   # standalone version of the query
            "query_type": str         # "overview" | "architecture" | "implementation"
        }
    """
    # No history → skip rewrite, just route
    if not history:
        return _route_only(query)

    # Build the history context string
    history_text = ""
    for msg in history[-6:]:
        role = msg.get("role", "user")
        content = msg.get("content", "")
        # Truncate long messages to keep the prompt compact
        if len(content) > 300:
            content = content[:300] + "..."
        history_text += f"{role.upper()}: {content}\n"

    messages = [
        {
            "role": "system",
            "content": REWRITE_AND_ROUTE_PROMPT
        },
        {
            "role": "user",
            "content": f"CHAT HISTORY:\n{history_text}\nCURRENT QUESTION: {query}"
        }
    ]

    try:
        raw = generate_response(messages)
        print(f"[QueryPipeline] Raw response: {raw}")

        # Parse JSON from the response
        # Handle cases where the LLM wraps JSON in markdown code blocks
        cleaned = raw.strip()
        if cleaned.startswith("```"):
            # Remove ```json ... ``` wrapping
            lines = cleaned.split("\n")
            cleaned = "\n".join(lines[1:-1])

        result = json.loads(cleaned)

        rewritten = result.get("rewritten_query", query)
        query_type = result.get("query_type", "implementation")

        # Validate query_type
        if query_type not in ("overview", "architecture", "implementation", "casual"):
            query_type = "implementation"

        print(f"[QueryPipeline] Rewritten: '{query}' → '{rewritten}'")
        print(f"[QueryPipeline] Query type: {query_type}")

        return {
            "rewritten_query": rewritten,
            "query_type": query_type
        }

    except (json.JSONDecodeError, Exception) as e:
        print(f"[QueryPipeline] Error parsing response: {e}")
        # Fallback: return original query with default type
        return {
            "rewritten_query": query,
            "query_type": "implementation"
        }


def _route_only(query: str) -> dict:
    """
    When there's no history, just classify the query type.
    Uses simple keyword heuristics to avoid an LLM call.
    """
    q_lower = query.lower().strip()
    
    casual_keywords = ["hi", "hello", "hey", "thanks", "thank you", "great", "awesome", "ok", "okay"]
    if q_lower in casual_keywords or (len(q_lower.split()) < 3 and any(kw in q_lower for kw in casual_keywords)):
        print(f"[QueryPipeline] Keyword match → casual")
        return {"rewritten_query": query, "query_type": "casual"}

    overview_keywords = [
        "explain this project", "what does this repo",
        "what does this project", "overview", "summary",
        "what is this", "describe this", "tell me about this",
        "what does this codebase", "explain the project",
        "what does the project do", "what does this app",
    ]

    architecture_keywords = [
        "structure", "architecture", "organized",
        "how is the project", "folder structure",
        "how are the files", "components",
        "modules", "how is the code structured",
        "tech stack", "dependencies",
    ]

    for kw in overview_keywords:
        if kw in q_lower:
            print(f"[QueryPipeline] Keyword match → overview")
            return {"rewritten_query": query, "query_type": "overview"}

    for kw in architecture_keywords:
        if kw in q_lower:
            print(f"[QueryPipeline] Keyword match → architecture")
            return {"rewritten_query": query, "query_type": "architecture"}

    return {"rewritten_query": query, "query_type": "implementation"}
