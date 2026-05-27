"""
RepoChat — API Key Authentication

Simple API key guard. The expected key is read from the
REPOCHAT_API_KEY environment variable.

- If REPOCHAT_API_KEY is NOT set, auth is disabled (open access).
- If REPOCHAT_API_KEY IS set, every request must include:
      Header:  X-API-Key: <key>

Usage in routes:
    from backend.services.auth_service import require_api_key

    @router.get("/protected")
    def protected(api_key: str = Depends(require_api_key)):
        ...
"""

import os
from fastapi import Depends, HTTPException, Security
from fastapi.security import APIKeyHeader

API_KEY_HEADER = APIKeyHeader(name="X-API-Key", auto_error=False)

EXPECTED_KEY = os.getenv("REPOCHAT_API_KEY")


async def require_api_key(
    api_key: str | None = Security(API_KEY_HEADER),
):
    """
    FastAPI dependency.
    If REPOCHAT_API_KEY env var is blank/missing → allow all requests.
    Otherwise, validate the incoming X-API-Key header.
    """
    # Auth disabled when no key is configured
    if not EXPECTED_KEY:
        return None

    if not api_key:
        raise HTTPException(
            status_code=401,
            detail="Missing API key. Pass it via the X-API-Key header.",
        )

    if api_key != EXPECTED_KEY:
        raise HTTPException(
            status_code=403,
            detail="Invalid API key.",
        )

    return api_key
