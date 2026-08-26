import os
import json
from mcp.server.mcpserver import MCPServer
from appwrite.client import Client
from appwrite.services.databases import Databases
from appwrite.query import Query

server = MCPServer(name="kylrix-mcp", version="1.0.0")

def get_appwrite_db():
    client = Client()
    endpoint = os.environ.get('APPWRITE_FUNCTION_ENDPOINT', 'https://fra.cloud.appwrite.io/v1')
    project_id = os.environ.get('APPWRITE_FUNCTION_PROJECT_ID', '')
    api_key = os.environ.get('APPWRITE_FUNCTION_API_KEY', '')

    client.set_endpoint(endpoint)
    client.set_project(project_id)
    client.set_key(api_key)
    return Databases(client), 'passwordManagerDb'

@server.tool(description="List active Kylrix workspaces for the user or agent.")
def list_workspaces(limit: int = 25) -> str:
    try:
        databases, db_id = get_appwrite_db()
        result = databases.list_documents(
            database_id=db_id,
            collection_id="projects",
            queries=[Query.limit(min(100, max(1, limit)))]
        )
        workspaces = [
            {
                "id": r["$id"],
                "title": r.get("title") or r.get("name", "Untitled"),
                "summary": r.get("summary", ""),
                "isAgentic": bool(r.get("isAgentic")),
            }
            for r in result.get("documents", [])
        ]
        return json.dumps(workspaces, indent=2)
    except Exception as e:
        return f"Error listing workspaces: {str(e)}"

@server.tool(description="Create a new note/idea inside a Kylrix workspace.")
def create_note(title: str, content: str = "", workspace_id: str = "") -> str:
    try:
        databases, db_id = get_appwrite_db()
        note = databases.create_document(
            database_id=db_id,
            collection_id="67ff05f3002502ef239e", # NOTES table
            document_id="unique()",
            data={
                "title": title.strip(),
                "content": content,
                "format": "markdown",
                "isPublic": False,
            }
        )
        note_id = note.get("$id", "")

        if workspace_id and note_id:
            try:
                databases.create_document(
                    database_id=db_id,
                    collection_id="objects",
                    document_id="unique()",
                    data={
                        "parentId": workspace_id,
                        "parentKind": "workspace",
                        "childId": note_id,
                        "childKind": "note",
                        "metadata": json.dumps({"title": title})
                    }
                )
            except Exception:
                pass

        return f"Note '{title}' created successfully with ID {note_id}"
    except Exception as e:
        return f"Error creating note: {str(e)}"

@server.tool(description="List notes from Kylrix, optionally filtered by workspace.")
def list_notes(workspace_id: str = "", limit: int = 25) -> str:
    try:
        databases, db_id = get_appwrite_db()
        result = databases.list_documents(
            database_id=db_id,
            collection_id="67ff05f3002502ef239e",
            queries=[Query.limit(min(100, max(1, limit)))]
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
        return json.dumps(notes, indent=2)
    except Exception as e:
        return f"Error listing notes: {str(e)}"

@server.tool(description="Create a goal or task in Kylrix.")
def create_goal(title: str, description: str = "", status: str = "todo") -> str:
    try:
        databases, db_id = get_appwrite_db()
        goal = databases.create_document(
            database_id=db_id,
            collection_id="tasks",
            document_id="unique()",
            data={
                "title": title.strip(),
                "description": description,
                "status": status,
            }
        )
        return f"Goal '{title}' created successfully with ID {goal.get('$id')}"
    except Exception as e:
        return f"Error creating goal: {str(e)}"

@server.tool(description="List goals and tasks in Kylrix.")
def list_goals(limit: int = 25) -> str:
    try:
        databases, db_id = get_appwrite_db()
        result = databases.list_documents(
            database_id=db_id,
            collection_id="tasks",
            queries=[Query.limit(min(100, max(1, limit)))]
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
        return json.dumps(goals, indent=2)
    except Exception as e:
        return f"Error listing goals: {str(e)}"
