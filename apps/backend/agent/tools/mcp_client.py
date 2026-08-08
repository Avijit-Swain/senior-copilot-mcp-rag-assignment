from __future__ import annotations

import asyncio
import json
import os
import sys
from pathlib import Path
from typing import Any

from mcp.client.session import ClientSession
from mcp.client.stdio import StdioServerParameters, stdio_client

ROOT = Path(__file__).resolve().parents[4]
MCP_PACKAGE = ROOT / "mcp-servers" / "alarm-management"


class AlarmMcpToolClient:
    """Small stdio MCP client for the candidate alarm-management server."""

    def __init__(self) -> None:
        self.command = os.getenv("MCP_SERVER_COMMAND", str(ROOT / ".venv" / "bin" / "python"))
        self.args = os.getenv("MCP_SERVER_ARGS", "-m alarm_mcp.server").split()
        self.env = {
            **os.environ,
            "PYTHONPATH": f"{MCP_PACKAGE}:{ROOT}:{os.environ.get('PYTHONPATH', '')}",
            "ALARM_API_BASE_URL": os.getenv("ALARM_API_BASE_URL", "http://127.0.0.1:8000"),
            "ALARM_API_TOKEN": os.getenv("ALARM_API_TOKEN", "demo-token"),
        }

    async def _call(self, name: str, args: dict[str, Any] | None = None) -> dict[str, Any]:
        params = StdioServerParameters(command=self.command, args=self.args, env=self.env)
        async with stdio_client(params) as (read, write):
            async with ClientSession(read, write) as session:
                await session.initialize()
                result = await session.call_tool(name, {"args": args or {}})
                if getattr(result, "is_error", False):
                    return {"ok": False, "error": {"code": "mcp_tool_error", "message": str(result)}}
                content = getattr(result, "content", []) or []
                if not content:
                    return {"ok": True, "data": None}
                text = getattr(content[0], "text", "")
                try:
                    return json.loads(text)
                except json.JSONDecodeError:
                    return {"ok": True, "data": text}

    async def _discover(self) -> list[dict[str, Any]]:
        params = StdioServerParameters(command=self.command, args=self.args, env=self.env)
        async with stdio_client(params) as (read, write):
            async with ClientSession(read, write) as session:
                await session.initialize()
                result = await session.list_tools()
                return [
                    {
                        "name": tool.name,
                        "description": tool.description,
                        "input_schema": getattr(tool, "input_schema", getattr(tool, "inputSchema", None)),
                    }
                    for tool in result.tools
                ]

    def call_tool(self, name: str, args: dict[str, Any] | None = None) -> dict[str, Any]:
        return asyncio.run(self._call(name, args))

    def discover_tools(self) -> list[dict[str, Any]]:
        return asyncio.run(self._discover())
