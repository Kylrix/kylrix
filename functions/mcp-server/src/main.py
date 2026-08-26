import os
import json
import traceback
from app import server

def main(context):
    req = context.req
    res = context.res
    log = context.log
    err = context.error

    try:
        # Check optional Bearer Auth
        auth_mode = os.environ.get('MCP_AUTH_MODE', 'none').lower()
        auth_token = os.environ.get('MCP_AUTH_TOKEN', '')

        if auth_mode == 'bearer' and auth_token:
            auth_header = req.headers.get('authorization', '')
            expected = f"Bearer {auth_token}"
            if auth_header != expected:
                log("[Kylrix MCP] Unauthorized request attempt")
                return res.json({"error": "Unauthorized"}, 401)

        # Parse request body
        body_data = {}
        if isinstance(req.body, dict):
            body_data = req.body
        elif isinstance(req.body, str) and req.body:
            try:
                body_data = json.loads(req.body)
            except Exception:
                body_data = {}

        method = body_data.get('method') or req.query.get('method') or ''
        params = body_data.get('params') or {}

        log(f"[Kylrix MCP] Dispatching method: {method}")

        # 1. Initialize Handshake (2025-06-18 & 2026-07-28 stateless compatibility)
        if method == "initialize":
            return res.json({
                "protocolVersion": "2026-07-28",
                "capabilities": {
                    "tools": {"listChanged": False}
                },
                "serverInfo": {
                    "name": os.environ.get('MCP_SERVER_NAME', 'kylrix-mcp'),
                    "version": "1.0.0"
                }
            })

        # 2. List Tools
        if method == "tools/list":
            tools_list = []
            for tool_name, tool_obj in server._tool_manager._tools.items():
                tools_list.append({
                    "name": tool_name,
                    "description": tool_obj.description or "",
                    "inputSchema": getattr(tool_obj, "input_schema", {"type": "object", "properties": {}})
                })
            return res.json({"tools": tools_list})

        # 3. Call Tool
        if method == "tools/call":
            tool_name = params.get("name")
            args = params.get("arguments", {})

            if tool_name not in server._tool_manager._tools:
                return res.json({
                    "isError": True,
                    "content": [{"type": "text", "text": f"Tool '{tool_name}' not found on server."}]
                }, 404)

            tool_obj = server._tool_manager._tools[tool_name]
            result = tool_obj.fn(**args)
            return res.json({
                "content": [{"type": "text", "text": str(result)}]
            })

        # Fallback info
        return res.json({
            "name": os.environ.get('MCP_SERVER_NAME', 'kylrix-mcp'),
            "version": "1.0.0",
            "status": "ready",
            "description": "Kylrix Model Context Protocol (MCP) server for Claude Code, Cursor, and autonomous agents",
            "transport": "streamable-http",
            "protocolVersion": "2026-07-28"
        })

    except Exception as e:
        stack = traceback.format_exc()
        err(f"[Kylrix MCP Error] {str(e)}\n{stack}")
        return res.json({
            "isError": True,
            "error": str(e),
            "content": [{"type": "text", "text": f"Server execution error: {str(e)}"}]
        }, 500)
