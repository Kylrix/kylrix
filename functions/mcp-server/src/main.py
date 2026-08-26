import os
import json
import traceback
from appwrite.client import Client
from appwrite.services.databases import Databases
from appwrite.query import Query

def main(context):
    req = context.req
    res = context.res
    log = context.log
    err = context.error

    try:
        # Initialize Appwrite client
        client = Client()
        endpoint = os.environ.get('APPWRITE_FUNCTION_ENDPOINT', 'https://fra.cloud.appwrite.io/v1')
        project_id = os.environ.get('APPWRITE_FUNCTION_PROJECT_ID', '')
        api_key = os.environ.get('APPWRITE_FUNCTION_API_KEY', '')

        client.set_endpoint(endpoint)
        client.set_project(project_id)
        client.set_key(api_key)

        databases = Databases(client)
        db_id = 'passwordManagerDb'

        # Parse request body
        body_data = {}
        if isinstance(req.body, dict):
            body_data = req.body
        elif isinstance(req.body, str) and req.body:
            try:
                body_data = json.loads(req.body)
            except Exception:
                body_data = {}

        method = body_data.get('method') or req.query.get('method')
        params = body_data.get('params') or {}

        log(f"[Kylrix MCP] Received method: {method}")

        # Tool discovery
        if method == "tools/list":
            return res.json({
                "tools": [
                    {
                        "name": "list_workspaces",
                        "description": "List all active Kylrix workspaces for the user or agent.",
                        "inputSchema": {
                            "type": "object",
                            "properties": {
                                "limit": {"type": "integer", "description": "Max workspaces to return", "default": 25}
                            }
                        }
                    },
                    {
                        "name": "create_note",
                        "description": "Create a new note/idea inside a Kylrix workspace.",
                        "inputSchema": {
                            "type": "object",
                            "properties": {
                                "title": {"type": "string", "description": "Title of the note"},
                                "content": {"type": "string", "description": "Markdown body content of the note"},
                                "workspaceId": {"type": "string", "description": "Workspace ID to link the note to"}
                            },
                            "required": ["title"]
                        }
                    },
                    {
                        "name": "list_notes",
                        "description": "List notes, optionally filtered by workspace ID.",
                        "inputSchema": {
                            "type": "object",
                            "properties": {
                                "workspaceId": {"type": "string", "description": "Optional workspace ID filter"},
                                "limit": {"type": "integer", "description": "Max notes to return", "default": 25}
                            }
                        }
                    },
                    {
                        "name": "create_goal",
                        "description": "Create a goal/task in Kylrix.",
                        "inputSchema": {
                            "type": "object",
                            "properties": {
                                "title": {"type": "string", "description": "Title of the goal"},
                                "description": {"type": "string", "description": "Details of the goal"},
                                "status": {"type": "string", "enum": ["todo", "in_progress", "done"], "default": "todo"}
                            },
                            "required": ["title"]
                        }
                    },
                    {
                        "name": "list_goals",
                        "description": "List goals and task statuses in Kylrix.",
                        "inputSchema": {
                            "type": "object",
                            "properties": {
                                "limit": {"type": "integer", "description": "Max goals to return", "default": 25}
                            }
                        }
                    }
                ]
            })

        # Tool invocation
        if method == "tools/call":
            tool_name = params.get("name")
            args = params.get("arguments", {})

            if tool_name == "list_workspaces":
                limit = int(args.get("limit", 25))
                result = databases.list_documents(
                    database_id=db_id,
                    collection_id="projects",
                    queries=[Query.limit(limit)]
                )
                rows = [
                    {
                        "id": r["$id"],
                        "title": r.get("title") or r.get("name", "Untitled"),
                        "summary": r.get("summary", ""),
                        "isAgentic": bool(r.get("isAgentic")),
                    }
                    for r in result.get("documents", [])
                ]
                return res.json({
                    "content": [{"type": "text", "text": json.dumps(rows, indent=2)}]
                })

            if tool_name == "create_note":
                title = args.get("title", "Untitled").strip()
                content = args.get("content", "")
                ws_id = args.get("workspaceId", "")
                note_row = databases.create_document(
                    database_id=db_id,
                    collection_id="67ff05f3002502ef239e",
                    document_id="unique()",
                    data={
                        "title": title,
                        "content": content,
                        "format": "markdown",
                        "isPublic": False,
                    }
                )
                created_id = note_row.get("$id", "")

                if ws_id and created_id:
                    try:
                        databases.create_document(
                            database_id=db_id,
                            collection_id="objects",
                            document_id="unique()",
                            data={
                                "parentId": ws_id,
                                "parentKind": "workspace",
                                "childId": created_id,
                                "childKind": "note",
                                "metadata": json.dumps({"title": title})
                            }
                        )
                    except Exception:
                        pass

                return res.json({
                    "content": [{"type": "text", "text": f"Note '{title}' created successfully (ID: {created_id})."}]
                })

            if tool_name == "list_notes":
                limit = int(args.get("limit", 25))
                result = databases.list_documents(
                    database_id=db_id,
                    collection_id="67ff05f3002502ef239e",
                    queries=[Query.limit(limit)]
                )
                notes = [
                    {
                        "id": r["$id"],
                        "title": r.get("title", "Untitled"),
                        "content": r.get("content", "")[:200],
                        "updatedAt": r.get("$updatedAt")
                    }
                    for r in result.get("documents", [])
                ]
                return res.json({
                    "content": [{"type": "text", "text": json.dumps(notes, indent=2)}]
                })

            if tool_name == "create_goal":
                title = args.get("title", "").strip()
                desc = args.get("description", "")
                status = args.get("status", "todo")
                goal_row = databases.create_document(
                    database_id=db_id,
                    collection_id="tasks",
                    document_id="unique()",
                    data={
                        "title": title,
                        "description": desc,
                        "status": status,
                    }
                )
                return res.json({
                    "content": [{"type": "text", "text": f"Goal '{title}' created successfully (ID: {goal_row.get('$id')})."}]
                })

            if tool_name == "list_goals":
                limit = int(args.get("limit", 25))
                result = databases.list_documents(
                    database_id=db_id,
                    collection_id="tasks",
                    queries=[Query.limit(limit)]
                )
                goals = [
                    {
                        "id": r["$id"],
                        "title": r.get("title", "Untitled"),
                        "status": r.get("status", "todo"),
                        "description": r.get("description", ""),
                    }
                    for r in result.get("documents", [])
                ]
                return res.json({
                    "content": [{"type": "text", "text": json.dumps(goals, indent=2)}]
                })

        return res.json({
            "name": "Kylrix MCP Server",
            "version": "1.0.0",
            "status": "ready",
            "description": "Model Context Protocol server for Kylrix workspaces, notes, and autonomous agents"
        })
    except Exception as e:
        stack = traceback.format_exc()
        err(f"[Kylrix MCP Exception] {str(e)}\n{stack}")
        return res.json({
            "isError": True,
            "error": str(e),
            "content": [{"type": "text", "text": f"Error: {str(e)}"}]
        }, 500)
