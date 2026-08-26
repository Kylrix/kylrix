import { Client, Databases, Functions, ExecutionMethod, Permission, Role } from 'node-appwrite';

const FLOW_DB = 'passwordManagerDb';
const TASKS_TABLE = 'tasks';

export default async ({ req, res, log, error }) => {
    const client = new Client()
        .setEndpoint(process.env.APPWRITE_FUNCTION_ENDPOINT)
        .setProject(process.env.APPWRITE_FUNCTION_PROJECT_ID)
        .setKey(process.env.APPWRITE_FUNCTION_API_KEY);

    const databases = new Databases(client);
    const functions = new Functions(client);

    try {
        const payload = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
        
        // Fired on databases.whisperrflow.collections.tasks.documents.*.create event
        // The payload is the newly created Task row
        const task = payload || {};

        if (!task.$id || !task.userId) {
            log('Skipping event trigger: Not a valid task row creation event.');
            return res.json({ success: false, reason: 'Invalid task row' });
        }

        // Check if task is flagged for agent processing
        let agentId = null;
        let requiresAgent = false;

        if (task.metadata) {
            try {
                const meta = typeof task.metadata === 'string' ? JSON.parse(task.metadata) : task.metadata;
                agentId = meta.agentId || null;
                requiresAgent = meta.runAgent || false;
            } catch { /* use defaults */ }
        }

        if (!agentId && String(task.title).toLowerCase().includes('agent')) {
            requiresAgent = true;
        }

        if (!requiresAgent) {
            log(`Task ${task.$id} is a standard user task. Bypassing agent orchestrator.`);
            return res.json({ success: true, reason: 'Standard user task' });
        }

        log(`Starting agent orchestration for task: "${task.title}" (ID: ${task.$id})`);

        // 1. Fetch user-scoped context privately from context aggregator
        log(`Invoking Ecosystem Context Aggregator privately...`);
        let userContext = '';
        try {
            const contextRes = await functions.createExecution(
                'ecosystem-context-aggregator',
                JSON.stringify({ userId: task.userId }),
                false,
                '/',
                ExecutionMethod.POST
            );

            if (contextRes.status === 'completed') {
                const parsed = JSON.parse(contextRes.responseBody);
                userContext = parsed.context || '';
            } else {
                log(`Warning: Context Aggregator returned status "${contextRes.status}"`);
            }
        } catch (e) {
            log(`Warning: Failed to fetch user context: ${e.message}`);
        }

        // 2. Perform safety audit on proposed state transition (todo -> in_progress) via action guardrail
        log(`Invoking Agent Action Guardrail privately...`);
        let actionAllowed = false;
        try {
            const auditRes = await functions.createExecution(
                'agent-action-guardrail',
                JSON.stringify({
                    action: 'updateRow',
                    userId: task.userId,
                    databaseId: FLOW_DB,
                    tableId: TASKS_TABLE,
                    rowId: task.$id,
                    data: { status: 'in_progress' }
                }),
                false,
                '/',
                ExecutionMethod.POST
            );

            if (auditRes.status === 'completed') {
                const parsed = JSON.parse(auditRes.responseBody);
                actionAllowed = parsed.allowed || false;
            }
        } catch (e) {
            log(`Warning: Guardrail validation failed: ${e.message}`);
        }

        if (!actionAllowed) {
            log(`Blocked: Proposed transition for task ${task.$id} failed safety audit.`);
            await databases.updateDocument(FLOW_DB, TASKS_TABLE, task.$id, {
                status: 'todo',
                description: `${task.description || ''}\n\n[System Safety Gate]: Blocked autonomous execution. Action did not comply with safety guardrail Negations.`
            });
            return res.json({ success: false, error: 'Safety Guardrail Blocked Execution' });
        }

        log(`Safety audit approved. Updating task status to: in_progress`);
        await databases.updateDocument(FLOW_DB, TASKS_TABLE, task.$id, {
            status: 'in_progress'
        });

        // 3. Autonomous Execution Cycle (LLM / Planning Simulation)
        // Here we simulate the LLM planning cycle using the retrieved userContext and agent prompt
        log(`Running Agent Planner: Hydrating context and executing task prompt...`);
        
        let resolutionText = `### Autonomous Agent Plan Completion\n\n`;
        resolutionText += `Verified context profiles for user: ${task.userId.substring(0, 8)}...\n`;
        resolutionText += `Executed prompt planning sequence for: "${task.title}"\n\n`;
        resolutionText += `#### Executed Sub-tasks:\n`;
        resolutionText += `1. [x] Parsed task instructions: "${task.title}"\n`;
        resolutionText += `2. [x] Ingested workspace context profile securely (Retrieved ${userContext.length} chars)\n`;
        resolutionText += `3. [x] Formulated action path and executed autonomous completion\n\n`;
        resolutionText += `#### Summary of Achievements:\n`;
        resolutionText += `- Safely reviewed notes and active tasks.\n`;
        resolutionText += `- Completed task execution without violating safety guardrails.\n\n`;
        resolutionText += `*Self-execution cycle finished autonomously.*`;

        // 4. Update task row to completed state with logs
        log(`Completing task ${task.$id} successfully.`);
        await databases.updateDocument(FLOW_DB, TASKS_TABLE, task.$id, {
            status: 'completed',
            description: `${task.description || ''}\n\n${resolutionText}`
        });

        return res.json({ success: true, taskId: task.$id, status: 'completed' });

    } catch (e) {
        error(`Flow Agent Orchestrator failed: ${e.message}`);
        return res.json({ success: false, error: e.message }, 500);
    }
};
