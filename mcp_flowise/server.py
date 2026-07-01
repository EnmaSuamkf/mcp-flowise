"""mcp-flowise — expose a local Flowise instance's chatflows as MCP tools.

Talks to Flowise over its REST API and exposes, by default (simple mode):

    * list_chatflows()                          discover deployed chatflows
    * create_prediction(chatflow_id, question)  run any chatflow

If FLOWISE_DYNAMIC=true, instead/also registers one tool per chatflow at
startup (e.g. ``flowise_support_bot(question)``).

Transport is stdio (FastMCP default), so it plugs straight into free-code's
``mcp.json`` as a ``command`` server.

Configuration (environment variables):
    FLOWISE_API_ENDPOINT            base URL (default http://localhost:3000)
    FLOWISE_API_KEY                 bearer token (empty if auth disabled)
    FLOWISE_DYNAMIC                 "true" to register one tool per chatflow
    FLOWISE_WHITELIST_ID            comma-separated chatflow ids to include
    FLOWISE_BLACKLIST_ID            comma-separated chatflow ids to exclude
    FLOWISE_WHITELIST_NAME_REGEX    only chatflows whose name matches
    FLOWISE_BLACKLIST_NAME_REGEX    drop chatflows whose name matches
    LOG_LEVEL                       logging level (default INFO)
"""

from __future__ import annotations

import json
import logging
import os
import re
import sys
from typing import Any, Callable

import httpx
from mcp.server.fastmcp import FastMCP

logging.basicConfig(level=os.getenv("LOG_LEVEL", "INFO"), stream=sys.stderr)
logger = logging.getLogger("mcp-flowise")

FLOWISE_API_ENDPOINT = os.getenv("FLOWISE_API_ENDPOINT", "http://localhost:3000").rstrip("/")
FLOWISE_API_KEY = os.getenv("FLOWISE_API_KEY", "")
FLOWISE_DYNAMIC = os.getenv("FLOWISE_DYNAMIC", "false").lower() in ("1", "true", "yes")

WHITELIST_IDS = {s.strip() for s in os.getenv("FLOWISE_WHITELIST_ID", "").split(",") if s.strip()}
BLACKLIST_IDS = {s.strip() for s in os.getenv("FLOWISE_BLACKLIST_ID", "").split(",") if s.strip()}
WHITELIST_NAME_RE = os.getenv("FLOWISE_WHITELIST_NAME_REGEX", "")
BLACKLIST_NAME_RE = os.getenv("FLOWISE_BLACKLIST_NAME_REGEX", "")

mcp = FastMCP("mcp-flowise")


def _headers() -> dict[str, str]:
    headers = {"Content-Type": "application/json"}
    if FLOWISE_API_KEY:
        headers["Authorization"] = f"Bearer {FLOWISE_API_KEY}"
    return headers


def _client() -> httpx.Client:
    return httpx.Client(base_url=FLOWISE_API_ENDPOINT, headers=_headers(), timeout=120.0)


def _allowed(chatflow: dict[str, Any]) -> bool:
    """Apply whitelist/blacklist filters to a single chatflow."""
    cid = str(chatflow.get("id", ""))
    name = str(chatflow.get("name", ""))
    if WHITELIST_IDS and cid not in WHITELIST_IDS:
        return False
    if cid in BLACKLIST_IDS:
        return False
    if WHITELIST_NAME_RE and not re.search(WHITELIST_NAME_RE, name):
        return False
    if BLACKLIST_NAME_RE and re.search(BLACKLIST_NAME_RE, name):
        return False
    return True


def _fetch_chatflows() -> list[dict[str, Any]]:
    with _client() as client:
        resp = client.get("/api/v1/chatflows")
        resp.raise_for_status()
        data = resp.json()
    if not isinstance(data, list):
        return []
    return [cf for cf in data if _allowed(cf)]


def _predict(chatflow_id: str, question: str) -> str:
    with _client() as client:
        resp = client.post(f"/api/v1/prediction/{chatflow_id}", json={"question": question})
        resp.raise_for_status()
        try:
            return json.dumps(resp.json(), ensure_ascii=False)
        except ValueError:
            return resp.text


@mcp.tool()
def list_chatflows() -> str:
    """List the Flowise chatflows available on the configured instance.

    Returns a JSON array of ``{"id", "name"}`` objects for each chatflow that
    passes the configured whitelist/blacklist filters.
    """
    try:
        flows = _fetch_chatflows()
    except httpx.HTTPError as exc:
        return f"Error contacting Flowise at {FLOWISE_API_ENDPOINT}: {exc}"
    return json.dumps(
        [{"id": cf.get("id"), "name": cf.get("name")} for cf in flows],
        ensure_ascii=False,
    )


@mcp.tool()
def create_prediction(chatflow_id: str, question: str) -> str:
    """Run a Flowise chatflow and return its response.

    Args:
        chatflow_id: Id of the chatflow to run (see ``list_chatflows``).
        question: User input / prompt to send to the chatflow.
    """
    try:
        return _predict(chatflow_id, question)
    except httpx.HTTPError as exc:
        return f"Error calling chatflow {chatflow_id}: {exc}"


def _normalize(name: str) -> str:
    slug = re.sub(r"[^a-zA-Z0-9]+", "_", name).strip("_").lower()
    return f"flowise_{slug or 'chatflow'}"


def _make_runner(chatflow_id: str, label: str) -> Callable[[str], str]:
    def run(question: str) -> str:
        try:
            return _predict(chatflow_id, question)
        except httpx.HTTPError as exc:
            return f"Error calling chatflow {chatflow_id}: {exc}"

    run.__name__ = _normalize(label)
    run.__doc__ = f"Run the '{label}' Flowise chatflow. Args: question (str)."
    return run


def _register_dynamic_tools() -> None:
    """Register one tool per chatflow (FLOWISE_DYNAMIC mode)."""
    try:
        flows = _fetch_chatflows()
    except httpx.HTTPError as exc:
        logger.error("Dynamic mode: failed to fetch chatflows: %s", exc)
        return

    seen: set[str] = set()
    for chatflow in flows:
        cid = chatflow.get("id")
        if not cid:
            continue
        label = str(chatflow.get("name", cid))
        tool_name = _normalize(label)
        if tool_name in seen:
            tool_name = f"{tool_name}_{str(cid)[:6]}"
        seen.add(tool_name)
        runner = _make_runner(str(cid), label)
        mcp.tool(name=tool_name)(runner)
        logger.info("Registered dynamic tool %s -> %s", tool_name, cid)


def main() -> None:
    logger.info(
        "Starting mcp-flowise (endpoint=%s, dynamic=%s)",
        FLOWISE_API_ENDPOINT,
        FLOWISE_DYNAMIC,
    )
    if FLOWISE_DYNAMIC:
        _register_dynamic_tools()
    mcp.run()


if __name__ == "__main__":
    main()
