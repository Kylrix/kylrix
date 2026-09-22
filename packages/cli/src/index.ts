import { Command } from 'commander';
import { loginCommand, logoutCommand, pairCommand, whoamiCommand } from './commands/auth';
import {
  listWorkspacesCommand,
  getWorkspaceCommand,
  createWorkspaceCommand,
  deleteWorkspaceCommand,
} from './commands/workspaces';
import {
  listNotesCommand,
  getNoteCommand,
  createNoteCommand,
  updateNoteCommand,
  deleteNoteCommand,
} from './commands/notes';
import {
  listGoalsCommand,
  getGoalCommand,
  createGoalCommand,
  updateGoalCommand,
  deleteGoalCommand,
} from './commands/goals';
import { listEventsCommand, createEventCommand, deleteEventCommand } from './commands/events';
import { listFormsCommand, getFormCommand, createFormCommand, deleteFormCommand } from './commands/forms';
import { listFlowsCommand, getFlowCommand, createFlowCommand, deleteFlowCommand } from './commands/flows';
import { listChatsCommand, listChatMessagesCommand, sendChatMessageCommand } from './commands/chats';
import { listThreadsCommand, listThreadMessagesCommand, sendThreadMessageCommand } from './commands/threads';
import { listTagsCommand, createTagCommand, deleteTagCommand } from './commands/tags';
import { listTrashCommand, restoreTrashCommand, purgeTrashCommand } from './commands/trash';
import { runStdioMcpServer } from './mcp/stdio';

const program = new Command();

program
  .name('kylrix')
  .description('Official CLI & Model Context Protocol (MCP) bridge for Kylrix sovereign agentic workspaces')
  .version('1.0.0');

// Global flags
program
  .option('-u, --url <url>', 'Kylrix API base URL (default: https://www.kylrix.space)')
  .option('-t, --token <token>', 'Personal Access Token (PAT) or Agent Key')
  .option('-w, --workspace <id>', 'Active workspace ID filter')
  .option('--json', 'Output raw JSON for machine parsing');

// ── Auth Commands ──
program
  .command('login')
  .description('Authenticate with a Kylrix instance (device pairing, PAT, or password)')
  .action((cmdOpts, cmd) => loginCommand({ ...program.opts(), ...cmdOpts }));

program
  .command('pair')
  .description('Authenticate using RFC 8628 browser device pairing code')
  .action((cmdOpts) => pairCommand({ ...program.opts(), ...cmdOpts }));

program
  .command('whoami')
  .alias('me')
  .description('Display currently authenticated identity, scopes, and session status')
  .action((cmdOpts) => whoamiCommand({ ...program.opts(), ...cmdOpts }));

program
  .command('logout')
  .description('Log out and remove stored local authentication credentials')
  .action(() => logoutCommand());

// ── Workspaces ──
const workspaces = program.command('workspaces').alias('ws').description('Manage Kylrix workspaces');

workspaces
  .command('list')
  .description('List all accessible workspaces')
  .option('-l, --limit <number>', 'Number of records to return', '25')
  .action((cmdOpts) => listWorkspacesCommand({ ...program.opts(), ...cmdOpts }));

workspaces
  .command('get <id>')
  .description('Get workspace details by ID')
  .action((id, cmdOpts) => getWorkspaceCommand(id, { ...program.opts(), ...cmdOpts }));

workspaces
  .command('create <name>')
  .description('Create a new workspace')
  .option('-d, --description <text>', 'Workspace description')
  .option('--agentic', 'Flag workspace as agentic environment')
  .action((name, cmdOpts) => createWorkspaceCommand(name, { ...program.opts(), ...cmdOpts }));

workspaces
  .command('delete <id>')
  .description('Delete a workspace by ID')
  .action((id, cmdOpts) => deleteWorkspaceCommand(id, { ...program.opts(), ...cmdOpts }));

// ── Notes ──
const notes = program.command('notes').alias('n').description('Manage sovereign notes and ideas');

notes
  .command('list')
  .description('List notes in the active workspace or personal store')
  .option('-l, --limit <number>', 'Number of records', '25')
  .action((cmdOpts) => listNotesCommand({ ...program.opts(), ...cmdOpts }));

notes
  .command('get <id>')
  .description('Get full note content and metadata')
  .action((id, cmdOpts) => getNoteCommand(id, { ...program.opts(), ...cmdOpts }));

notes
  .command('create <title>')
  .description('Create a new note')
  .option('-c, --content <text>', 'Note body content')
  .option('--category <category>', 'Note category', 'general')
  .option('--tags <tags>', 'Comma-separated tag list')
  .action((title, cmdOpts) => createNoteCommand(title, { ...program.opts(), ...cmdOpts }));

notes
  .command('update <id>')
  .description('Update an existing note')
  .option('--title <title>', 'New note title')
  .option('-c, --content <text>', 'New content')
  .option('--category <category>', 'New category')
  .action((id, cmdOpts) => updateNoteCommand(id, { ...program.opts(), ...cmdOpts }));

notes
  .command('delete <id>')
  .description('Delete a note by ID')
  .action((id, cmdOpts) => deleteNoteCommand(id, { ...program.opts(), ...cmdOpts }));

// ── Goals ──
const goals = program.command('goals').alias('g').description('Track goals, objectives, and habits');

goals
  .command('list')
  .description('List goals')
  .option('-s, --status <status>', 'Filter by status (not_started, in_progress, completed, paused)')
  .option('-l, --limit <number>', 'Limit count', '25')
  .action((cmdOpts) => listGoalsCommand({ ...program.opts(), ...cmdOpts }));

goals
  .command('get <id>')
  .description('Get goal details')
  .action((id, cmdOpts) => getGoalCommand(id, { ...program.opts(), ...cmdOpts }));

goals
  .command('create <title>')
  .description('Create a new goal')
  .option('-d, --description <text>', 'Description')
  .option('--target <value>', 'Target numeric value', '100')
  .option('--unit <unit>', 'Unit (%, days, hours, etc.)', '%')
  .option('--status <status>', 'Status', 'not_started')
  .action((title, cmdOpts) => createGoalCommand(title, { ...program.opts(), ...cmdOpts }));

goals
  .command('update <id>')
  .description('Update goal status or numeric progress')
  .option('--title <title>', 'New goal title')
  .option('--status <status>', 'New status')
  .option('--progress <currentValue>', 'Current numeric progress')
  .action((id, cmdOpts) =>
    updateGoalCommand(id, { ...program.opts(), ...cmdOpts, currentValue: cmdOpts.progress })
  );

goals
  .command('delete <id>')
  .description('Delete a goal')
  .action((id, cmdOpts) => deleteGoalCommand(id, { ...program.opts(), ...cmdOpts }));

// ── Events ──
const events = program.command('events').description('Manage calendar events and schedules');

events
  .command('list')
  .description('List calendar events')
  .option('-l, --limit <number>', 'Limit count', '25')
  .action((cmdOpts) => listEventsCommand({ ...program.opts(), ...cmdOpts }));

events
  .command('create <title>')
  .description('Create a calendar event')
  .requiredOption('--start <time>', 'ISO start time (e.g. 2026-09-25T14:00:00Z)')
  .requiredOption('--end <time>', 'ISO end time')
  .option('-d, --description <text>', 'Event description')
  .action((title, cmdOpts) =>
    createEventCommand(title, {
      ...program.opts(),
      ...cmdOpts,
      startTime: cmdOpts.start,
      endTime: cmdOpts.end,
    })
  );

events
  .command('delete <id>')
  .description('Delete an event')
  .action((id, cmdOpts) => deleteEventCommand(id, { ...program.opts(), ...cmdOpts }));

// ── Forms ──
const forms = program.command('forms').description('Manage interactive forms');

forms
  .command('list')
  .description('List forms')
  .action((cmdOpts) => listFormsCommand({ ...program.opts(), ...cmdOpts }));

forms
  .command('get <id>')
  .description('Get form details and schema')
  .action((id, cmdOpts) => getFormCommand(id, { ...program.opts(), ...cmdOpts }));

forms
  .command('create <title>')
  .description('Create a form')
  .option('-d, --description <text>', 'Form description')
  .action((title, cmdOpts) => createFormCommand(title, { ...program.opts(), ...cmdOpts }));

forms
  .command('delete <id>')
  .description('Delete a form')
  .action((id, cmdOpts) => deleteFormCommand(id, { ...program.opts(), ...cmdOpts }));

// ── Flows ──
const flows = program.command('flows').description('Manage automations and workflow pipelines');

flows
  .command('list')
  .description('List workflow automations')
  .action((cmdOpts) => listFlowsCommand({ ...program.opts(), ...cmdOpts }));

flows
  .command('get <id>')
  .description('Get flow specification')
  .action((id, cmdOpts) => getFlowCommand(id, { ...program.opts(), ...cmdOpts }));

flows
  .command('create <title>')
  .description('Create a workflow automation')
  .option('-d, --description <text>', 'Workflow description')
  .action((title, cmdOpts) => createFlowCommand(title, { ...program.opts(), ...cmdOpts }));

flows
  .command('delete <id>')
  .description('Delete a workflow')
  .action((id, cmdOpts) => deleteFlowCommand(id, { ...program.opts(), ...cmdOpts }));

// ── Chats ──
const chats = program.command('chats').description('Connect discussions and messages');

chats
  .command('list')
  .description('List chat conversations')
  .action((cmdOpts) => listChatsCommand({ ...program.opts(), ...cmdOpts }));

chats
  .command('messages <conversationId>')
  .description('Read recent messages from a conversation')
  .action((conversationId, cmdOpts) =>
    listChatMessagesCommand(conversationId, { ...program.opts(), ...cmdOpts })
  );

chats
  .command('send <message>')
  .description('Send a chat message')
  .option('-c, --conversation <id>', 'Target conversation ID')
  .option('-p, --participant <userId>', 'Target participant user ID (for direct chat)')
  .action((message, cmdOpts) =>
    sendChatMessageCommand(message, {
      ...program.opts(),
      ...cmdOpts,
      conversationId: cmdOpts.conversation,
      participantId: cmdOpts.participant,
    })
  );

// ── Threads ──
const threads = program.command('threads').description('Unified comment and discussion threads');

threads
  .command('list')
  .description('List threads')
  .option('--parent-kind <kind>', 'Filter by parent resource kind (note, goal, workspace, etc.)')
  .option('--parent-id <id>', 'Filter by parent resource ID')
  .action((cmdOpts) => listThreadsCommand({ ...program.opts(), ...cmdOpts }));

threads
  .command('messages <threadId>')
  .description('Read messages in a thread')
  .action((threadId, cmdOpts) => listThreadMessagesCommand(threadId, { ...program.opts(), ...cmdOpts }));

threads
  .command('send <threadId> <message>')
  .description('Post a message into a thread')
  .action((threadId, message, cmdOpts) =>
    sendThreadMessageCommand(threadId, message, { ...program.opts(), ...cmdOpts })
  );

// ── Tags ──
const tags = program.command('tags').description('Organize resources with sovereign tags');

tags
  .command('list')
  .description('List tags')
  .action((cmdOpts) => listTagsCommand({ ...program.opts(), ...cmdOpts }));

tags
  .command('create <name>')
  .description('Create a tag')
  .option('--color <color>', 'Tag color hex or theme name')
  .action((name, cmdOpts) => createTagCommand(name, { ...program.opts(), ...cmdOpts }));

tags
  .command('delete <id>')
  .description('Delete a tag')
  .action((id, cmdOpts) => deleteTagCommand(id, { ...program.opts(), ...cmdOpts }));

// ── Trash ──
const trash = program.command('trash').description('Inspect and restore soft-deleted items');

trash
  .command('list')
  .description('List deleted items in trash')
  .action((cmdOpts) => listTrashCommand({ ...program.opts(), ...cmdOpts }));

trash
  .command('restore <kind> <id>')
  .description('Restore a soft-deleted item')
  .action((kind, id, cmdOpts) => restoreTrashCommand(kind, id, { ...program.opts(), ...cmdOpts }));

trash
  .command('purge <kind> <id>')
  .description('Permanently purge a deleted item')
  .action((kind, id, cmdOpts) => purgeTrashCommand(kind, id, { ...program.opts(), ...cmdOpts }));

// ── MCP Stdio Server Bridge ──
program
  .command('mcp')
  .description('Start the Model Context Protocol (MCP) server over stdio for AI clients (Claude, Cursor, Windsurf)')
  .action((cmdOpts) => runStdioMcpServer({ ...program.opts(), ...cmdOpts }));

program.parse(process.argv);
