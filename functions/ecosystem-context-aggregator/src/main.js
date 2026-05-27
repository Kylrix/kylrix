import { Client, Databases, Query } from 'node-appwrite';

const NOTE_DB = '67ff05a9000296822396';
const NOTES_TABLE = '67ff05f3002502ef239e';
const FLOW_DB = 'whisperrflow';
const TASKS_TABLE = 'tasks';

export default async ({ req, res, log, error }) => {
    const client = new Client()
        .setEndpoint(process.env.APPWRITE_FUNCTION_ENDPOINT)
        .setProject(process.env.APPWRITE_FUNCTION_PROJECT_ID)
        .setKey(process.env.APPWRITE_FUNCTION_API_KEY);

    const databases = new Databases(client);

    try {
        const payload = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
        const { userId } = payload || {};

        if (!userId) {
            return res.json({ success: false, error: 'Missing required field: userId' }, 400);
        }

        log(`Compiling ecosystem context for user: ${userId}`);

        let contextMarkdown = `# USER WORKSPACE CONTEXT PROFILE\n\n`;

        // 1. Fetch recent notes
        try {
            const notesRes = await databases.listDocuments(NOTE_DB, NOTES_TABLE, [
                Query.equal('userId', userId),
                Query.notEqual('status', 'archived'),
                Query.orderDesc('$updatedAt'),
                Query.limit(5)
            ]);

            contextMarkdown += `## RECENT USER NOTES\n`;
            if (notesRes.documents.length === 0) {
                contextMarkdown += `*No recent active notes found in user's workspace.*\n\n`;
            } else {
                for (const note of notesRes.documents) {
                    contextMarkdown += `### Note: ${note.title || 'Untitled'}\n`;
                    contextMarkdown += `- **Status**: ${note.status}\n`;
                    contextMarkdown += `- **Last Modified**: ${note.$updatedAt}\n`;
                    if (note.content) {
                        const preview = note.content.length > 300 ? `${note.content.substring(0, 300)}...` : note.content;
                        contextMarkdown += `- **Content Preview**:\n\`\`\`markdown\n${preview}\n\`\`\`\n\n`;
                    } else {
                        contextMarkdown += `- *No content in note.*\n\n`;
                    }
                }
            }
        } catch (e) {
            log(`Warning: Failed to fetch notes for context: ${e.message}`);
            contextMarkdown += `## RECENT USER NOTES\n*Error: Could not retrieve notes.*\n\n`;
        }

        // 2. Fetch active tasks
        try {
            const tasksRes = await databases.listDocuments(FLOW_DB, TASKS_TABLE, [
                Query.equal('userId', userId),
                Query.notEqual('status', 'completed'),
                Query.orderDesc('$updatedAt'),
                Query.limit(5)
            ]);

            contextMarkdown += `## ACTIVE WORKSPACE TASKS\n`;
            if (tasksRes.documents.length === 0) {
                contextMarkdown += `*No active tasks found in user's workspace.*\n\n`;
            } else {
                for (const task of tasksRes.documents) {
                    contextMarkdown += `- **Task**: ${task.title}\n`;
                    contextMarkdown += `  - **Status**: ${task.status}\n`;
                    contextMarkdown += `  - **Priority**: ${task.priority}\n`;
                    if (task.description) {
                        contextMarkdown += `  - **Description**: ${task.description.trim()}\n`;
                    }
                    if (task.dueDate) {
                        contextMarkdown += `  - **Due Date**: ${task.dueDate}\n`;
                    }
                }
                contextMarkdown += `\n`;
            }
        } catch (e) {
            log(`Warning: Failed to fetch tasks for context: ${e.message}`);
            contextMarkdown += `## ACTIVE WORKSPACE TASKS\n*Error: Could not retrieve tasks.*\n\n`;
        }

        log(`Ecosystem context successfully compiled (Length: ${contextMarkdown.length} characters)`);
        return res.json({ success: true, context: contextMarkdown });

    } catch (e) {
        error(`Ecosystem Context Aggregator failed: ${e.message}`);
        return res.json({ success: false, error: e.message }, 500);
    }
};
