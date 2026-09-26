import { Command } from 'commander';
import { loginCommand, logoutCommand, pairCommand, whoamiCommand } from './commands/auth';
import {
  listAccountsCommand,
  switchAccountCommand,
  currentAccountCommand,
  removeAccountCommand,
} from './commands/accounts';
import {
  listServersCommand,
  switchServerCommand,
  currentServerCommand,
  addServerCommand,
  removeServerCommand,
} from './commands/server';
import {
  listWorkspacesCommand,
  getWorkspaceCommand,
  createWorkspaceCommand,
  deleteWorkspaceCommand,
  switchWorkspaceCommand,
  currentWorkspaceCommand,
  clearWorkspaceCommand,
} from './commands/workspaces';
import {
  listIdeasCommand,
  getIdeaCommand,
  createIdeaCommand,
  updateIdeaCommand,
  deleteIdeaCommand,
  listArticlesCommand,
} from './commands/ideas';
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
import {
  unlockVaultCommand,
  lockVaultCommand,
  statusVaultCommand,
  listVaultCommand,
  getVaultCommand,
  createVaultCommand,
  deleteVaultCommand,
} from './commands/vault';
import {
  listTotpCommand,
  getTotpCodeCommand,
  createTotpCommand,
  deleteTotpCommand,
} from './commands/totp';
import {
  listAgentSessionsCommand,
  getAgentSessionCommand,
  startAgentSessionCommand,
  deleteAgentSessionCommand,
} from './commands/agents';
import { searchCommand } from './commands/search';
import { shareCommand } from './commands/share';
import {
  billingStatusCommand,
  listBillingCoinsCommand,
  checkoutBillingCommand,
  claimCouponCommand,
} from './commands/billing';
import { adminStatusCommand } from './commands/admin';
import { listTagsCommand, createTagCommand, deleteTagCommand } from './commands/tags';
import { listTrashCommand, restoreTrashCommand, purgeTrashCommand } from './commands/trash';
import { updateCommand } from './commands/update';
import { syncCommand } from './commands/sync';
import { runStdioMcpServer } from './mcp/stdio';
import { CURRENT_VERSION, scheduleBackgroundUpdateCheck } from './updater';

// Run non-blocking background update check
scheduleBackgroundUpdateCheck();

const program = new Command();

program
  .name('kylrix')
  .description('Official CLI, Model Context Protocol (MCP) bridge, and sovereign client for Kylrix')
  .version(CURRENT_VERSION);

// Global flags
program
  .option('-u, --url <url>', 'Kylrix API base URL (default: https://www.kylrix.space)')
  .option('-t, --token <token>', 'Personal Access Token (PAT) or Agent Key')
  .option('-w, --workspace <id>', 'Active workspace ID filter')
  .option('--json', 'Output raw JSON for machine parsing');

// ── 1. Authentication ──
program
  .command('login')
  .description('1-Click Web Login / Device Pairing (opens browser and pairs automatically)')
  .option('-u, --url <url>', 'Custom backend base URL (e.g. http://localhost:3005 or https://my-selfhost.example.com)')
  .option('-t, --token <token>', 'Personal Access Token (PAT) or Agent Key')
  .action((cmdOpts) => loginCommand({ ...program.opts(), ...cmdOpts }));

program
  .command('pair')
  .description('Authenticate using RFC 8628 browser device pairing code')
  .option('-u, --url <url>', 'Custom backend base URL')
  .action((cmdOpts) => pairCommand({ ...program.opts(), ...cmdOpts }));

program
  .command('whoami')
  .alias('me')
  .description('Display currently authenticated identity, scopes, and session status')
  .action((cmdOpts) => whoamiCommand({ ...program.opts(), ...cmdOpts }));

program
  .command('logout')
  .description('Log out and remove stored local authentication credentials')
  .option('--all', 'Log out all accounts on the current server base URI')
  .option('--purge', 'Purge all server base URIs, account profiles, and local sessions')
  .option('-u, --url <url>', 'Target server base URL')
  .action((cmdOpts) => logoutCommand({ ...program.opts(), ...cmdOpts }));

// ── Multi-Account Profiles & Switching ──
const accounts = program
  .command('accounts')
  .alias('account')
  .description('Manage multi-account profiles and switch active identities under base URI silos');

accounts
  .command('list')
  .alias('ls')
  .description('List all accounts under the current base URI partition')
  .option('--all', 'List accounts across all configured server base URIs')
  .action((cmdOpts) => listAccountsCommand({ ...program.opts(), ...cmdOpts }));

accounts
  .command('switch <idOrEmail>')
  .alias('use')
  .description('Switch active account profile for the current base URI')
  .action((idOrEmail, cmdOpts) => switchAccountCommand(idOrEmail, { ...program.opts(), ...cmdOpts }));

accounts
  .command('current')
  .description('Show currently active account on the active base URI')
  .action((cmdOpts) => currentAccountCommand({ ...program.opts(), ...cmdOpts }));

accounts
  .command('remove <idOrEmail>')
  .alias('rm')
  .description('Remove an account profile from local config')
  .action((idOrEmail, cmdOpts) => removeAccountCommand(idOrEmail, { ...program.opts(), ...cmdOpts }));

// ── Server Base URIs & Silo Partitions ──
const server = program
  .command('server')
  .alias('servers')
  .description('Manage backend base URIs, partitions, and self-hosted instances');

server
  .command('list')
  .alias('ls')
  .description('List configured server base URIs and partitions')
  .action((cmdOpts) => listServersCommand({ ...program.opts(), ...cmdOpts }));

server
  .command('switch <url>')
  .alias('use')
  .description('Switch active server base URI')
  .action((url, cmdOpts) => switchServerCommand(url, { ...program.opts(), ...cmdOpts }));

server
  .command('current')
  .description('Show currently active server base URI and partition')
  .action((cmdOpts) => currentServerCommand({ ...program.opts(), ...cmdOpts }));

server
  .command('add <url>')
  .description('Register a server base URI')
  .action((url, cmdOpts) => addServerCommand(url));

server
  .command('remove <url>')
  .alias('rm')
  .description('Remove a server base URI and its accounts')
  .action((url, cmdOpts) => removeServerCommand(url));

// ── 2. Workspaces ──
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

workspaces
  .command('switch <id>')
  .alias('use')
  .description('Set the default active workspace for all subsequent CLI commands')
  .action((id, cmdOpts) => switchWorkspaceCommand(id, { ...program.opts(), ...cmdOpts }));

workspaces
  .command('current')
  .description('Show the currently active workspace')
  .action((cmdOpts) => currentWorkspaceCommand(cmdOpts));

workspaces
  .command('clear')
  .alias('unuse')
  .description('Reset active workspace back to Personal Virtual Workspace')
  .action((cmdOpts) => clearWorkspaceCommand(cmdOpts));

// ── 3. Ideas (aliased to notes) ──
const ideas = program.command('ideas').alias('idea').alias('notes').alias('n').description('Manage sovereign ideas and notes');

ideas
  .command('list')
  .description('List ideas in active workspace or personal store')
  .option('-l, --limit <number>', 'Number of records', '25')
  .action((cmdOpts) => listIdeasCommand({ ...program.opts(), ...cmdOpts }));

ideas
  .command('get <id>')
  .description('Get full idea content and metadata')
  .action((id, cmdOpts) => getIdeaCommand(id, { ...program.opts(), ...cmdOpts }));

ideas
  .command('create <title>')
  .description('Create a new idea')
  .option('-c, --content <text>', 'Idea body content')
  .option('--category <category>', 'Idea category', 'general')
  .option('--tags <tags>', 'Comma-separated tag list')
  .action((title, cmdOpts) => createIdeaCommand(title, { ...program.opts(), ...cmdOpts }));

ideas
  .command('update <id>')
  .description('Update an existing idea')
  .option('--title <title>', 'New idea title')
  .option('-c, --content <text>', 'New content')
  .option('--category <category>', 'New category')
  .action((id, cmdOpts) => updateIdeaCommand(id, { ...program.opts(), ...cmdOpts }));

ideas
  .command('delete <id>')
  .description('Delete an idea by ID')
  .action((id, cmdOpts) => deleteIdeaCommand(id, { ...program.opts(), ...cmdOpts }));

ideas
  .command('articles')
  .description('List long-form articles')
  .action((cmdOpts) => listArticlesCommand({ ...program.opts(), ...cmdOpts }));

// ── 4. Goals ──
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

// ── 5. Vault & Secrets (Bitwarden-style Security) ──
const vault = program.command('vault').alias('secrets').description('Secure encrypted credentials and project envs');

vault
  .command('unlock')
  .description('Unlock vault Master Encryption Key (MEK) for temporary session')
  .option('-p, --password <password>', 'Master Password')
  .option('--expiry <minutes>', 'Session expiry in minutes', '60')
  .action((cmdOpts) => unlockVaultCommand({ ...program.opts(), ...cmdOpts }));

vault
  .command('lock')
  .description('Lock vault and immediately purge in-memory / session encryption keys')
  .action((cmdOpts) => lockVaultCommand({ ...program.opts(), ...cmdOpts }));

vault
  .command('status')
  .description('Check whether the vault is locked or unlocked')
  .action((cmdOpts) => statusVaultCommand({ ...program.opts(), ...cmdOpts }));

vault
  .command('list')
  .description('List credentials and project environment variables')
  .option('--decrypt', 'Decrypt items using unlocked vault session')
  .action((cmdOpts) => listVaultCommand({ ...program.opts(), ...cmdOpts }));

vault
  .command('get <id>')
  .description('Get a secret or environment variable set')
  .option('--decrypt', 'Decrypt payload')
  .option('--format <format>', 'Output format (json, env)')
  .option('--pure', 'Output pure dotenv plaintext without headers')
  .action((id, cmdOpts) => getVaultCommand(id, { ...program.opts(), ...cmdOpts }));

vault
  .command('create <name>')
  .description('Create an encrypted secret or project .env')
  .option('-u, --username <username>', 'Username / login identifier')
  .option('-p, --password <password>', 'Password or secret token')
  .option('--service-url <url>', 'Service URL')
  .option('--env-file <filepath>', 'Import environment variables directly from a file')
  .option('--is-env', 'Mark as project environment variables set')
  .option('--notes <notes>', 'Secret notes')
  .action((name, cmdOpts) => createVaultCommand(name, { ...program.opts(), ...cmdOpts }));

vault
  .command('delete <id>')
  .description('Delete a secret by ID')
  .action((id, cmdOpts) => deleteVaultCommand(id, { ...program.opts(), ...cmdOpts }));

// ── 6. TOTP 2FA Authenticator ──
const totp = program.command('totp').alias('2fa').description('Sovereign 2FA TOTP Authenticator');

totp
  .command('list')
  .description('List 2FA TOTP accounts and live verification codes')
  .action((cmdOpts) => listTotpCommand({ ...program.opts(), ...cmdOpts }));

totp
  .command('code <id>')
  .description('Generate the current 6-digit 2FA code for an account')
  .option('--pure', 'Output raw 6-digit number only (for pipes/scripts)')
  .action((id, cmdOpts) => getTotpCodeCommand(id, { ...program.opts(), ...cmdOpts }));

totp
  .command('create <name>')
  .description('Add a new TOTP 2FA secret key')
  .requiredOption('-s, --secret <secret>', 'Base32 TOTP secret seed')
  .option('--issuer <issuer>', 'Service issuer (e.g. GitHub, Google)')
  .option('--account <account>', 'Account email or username')
  .action((name, cmdOpts) => createTotpCommand(name, { ...program.opts(), ...cmdOpts }));

totp
  .command('delete <id>')
  .description('Delete a TOTP seed')
  .action((id, cmdOpts) => deleteTotpCommand(id, { ...program.opts(), ...cmdOpts }));

// ── 7. Agentic Sessions ──
const agents = program.command('agents').alias('agent').description('Autonomous AI agents and execution sessions');

agents
  .command('list')
  .alias('sessions')
  .description('List agent execution sessions')
  .option('--harness <runner>', 'Filter by harness type')
  .action((cmdOpts) => listAgentSessionsCommand({ ...program.opts(), ...cmdOpts }));

agents
  .command('get <id>')
  .description('Get agent session execution logs and status')
  .action((id, cmdOpts) => getAgentSessionCommand(id, { ...program.opts(), ...cmdOpts }));

agents
  .command('start <title>')
  .description('Start a new autonomous agent session')
  .option('-p, --prompt <prompt>', 'Initial task prompt')
  .option('--harness <harness>', 'Harness runner', 'gemini')
  .action((title, cmdOpts) => startAgentSessionCommand(title, { ...program.opts(), ...cmdOpts }));

agents
  .command('delete <id>')
  .description('Delete an agent session')
  .action((id, cmdOpts) => deleteAgentSessionCommand(id, { ...program.opts(), ...cmdOpts }));

// ── 8. Global Search ──
program
  .command('search <query>')
  .alias('s')
  .description('Unified search across ideas, goals, events, forms, flows, and secrets')
  .action((query, cmdOpts) => searchCommand(query, { ...program.opts(), ...cmdOpts }));

// ── 9. Share Links ──
program
  .command('share <kind> <id>')
  .description('Generate a share link for a resource (idea, goal, vault, form, flow)')
  .action((kind, id, cmdOpts) => shareCommand(kind, id, { ...program.opts(), ...cmdOpts }));

// ── 10. Events ──
const events = program.command('events').description('Manage calendar events and schedules');

events
  .command('list')
  .description('List calendar events')
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

// ── 11. Forms ──
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

// ── 12. Flows ──
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

// ── 13. Chats & Hangouts ──
const chats = program.command('hangouts').alias('chats').description('Discussions and real-time hangouts');

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
  .description('Send a message')
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

// ── 14. Threads ──
const threads = program.command('threads').description('Unified comment and discussion threads');

threads
  .command('list')
  .description('List threads')
  .option('--parent-kind <kind>', 'Filter by parent resource kind (idea, goal, workspace, etc.)')
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

// ── 15. Billing & Settings ──
const billing = program.command('billing').description('Manage subscription, Pro upgrades, and crypto checkout');

billing
  .command('status')
  .description('View account subscription status, tier, and token balance')
  .action((cmdOpts) => billingStatusCommand({ ...program.opts(), ...cmdOpts }));

billing
  .command('coins')
  .description('List supported cryptocurrency payment tickers')
  .action((cmdOpts) => listBillingCoinsCommand({ ...program.opts(), ...cmdOpts }));

billing
  .command('checkout <planId>')
  .description('Create an upgrade checkout session or direct on-chain crypto payment address')
  .option('-m, --months <count>', 'Number of months to purchase', '1')
  .option('--ticker <coin>', 'Direct crypto coin ticker (e.g. polygon/usdt, btc, solana/usdt)')
  .option('--coupon <couponId>', 'Discount coupon code')
  .action((planId, cmdOpts) => checkoutBillingCommand(planId, { ...program.opts(), ...cmdOpts }));

billing
  .command('coupon <couponId>')
  .description('Redeem a gift or promotional discount coupon')
  .action((couponId, cmdOpts) => claimCouponCommand(couponId, { ...program.opts(), ...cmdOpts }));

program
  .command('settings')
  .description('Inspect account settings and configuration')
  .action((cmdOpts) => whoamiCommand({ ...program.opts(), ...cmdOpts }));

// ── 16. Admin & Health Check ──
program
  .command('admin')
  .description('Verify server status, admin entitlements, and Edge Shield health')
  .action((cmdOpts) => adminStatusCommand({ ...program.opts(), ...cmdOpts }));

// ── 17. Tags & Trash ──
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

// ── 18. Sync Local to Cloud ──
program
  .command('sync')
  .description('Synchronize sovereign local-first ideas and goals to your Kylrix cloud workspace')
  .action((cmdOpts) => syncCommand({ ...program.opts(), ...cmdOpts }));

// ── 19. Self-Update / Upgrade ──
program
  .command('update')
  .alias('upgrade')
  .description('Check for updates and automatically upgrade the CLI to the latest version')
  .option('--force', 'Force re-installation even if already on latest version')
  .action((cmdOpts) => updateCommand({ ...program.opts(), ...cmdOpts }));

// ── 20. MCP Stdio Server Bridge ──
program
  .command('mcp')
  .description('Start the Model Context Protocol (MCP) server over stdio for AI clients (Claude, Cursor, Windsurf)')
  .action((cmdOpts) => runStdioMcpServer({ ...program.opts(), ...cmdOpts }));

program.parse(process.argv);
