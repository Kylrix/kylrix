export type AgenticZone =
  | 'note'
  | 'flow'
  | 'vault'
  | 'connect'
  | 'projects'
  | 'accounts'
  | 'settings'
  | 'agents'
  | 'workspace';

export type QuickActionKind = 'prompt' | 'instant' | 'navigate';

export interface AgenticPageContext {
  zone: AgenticZone;
  route: string;
  resourceId?: string;
  title: string;
  subtitle: string;
  placeholder: string;
  accentApp: string;
  systemHint: string;
}

export interface QuickWorkflowAction {
  id: string;
  label: string;
  description: string;
  icon: string;
  kind: QuickActionKind;
  prompt?: string;
  href?: string;
  autoRun?: boolean;
}

const ZONE_META: Record<
  AgenticZone,
  Pick<AgenticPageContext, 'title' | 'subtitle' | 'placeholder' | 'accentApp' | 'systemHint'>
> = {
  note: {
    title: 'Ideas',
    subtitle: 'Capture, refine, and turn notes into action.',
    placeholder: 'Compose, rewrite, or ask anything about your notes…',
    accentApp: 'note',
    systemHint: 'User is in Ideas (notes). Help compose notes, summarize, tag, and convert ideas into tasks.',
  },
  flow: {
    title: 'Flow',
    subtitle: 'Plan tasks, goals, and what happens next.',
    placeholder: 'Schedule work, prioritize, or break down a goal…',
    accentApp: 'flow',
    systemHint: 'User is in Flow (tasks, goals, calendar). Help schedule tasks, prioritize, and plan execution.',
  },
  vault: {
    title: 'Vault',
    subtitle: 'Keep logins safe and easy to manage.',
    placeholder: 'Audit secrets, generate passwords, or organize labels…',
    accentApp: 'vault',
    systemHint: 'User is in Vault. Help with password hygiene, new secrets, and secure organization.',
  },
  connect: {
    title: 'Connect',
    subtitle: 'Messages, calls, and team coordination.',
    placeholder: 'Draft a message, plan a follow-up, or summarize a thread…',
    accentApp: 'connect',
    systemHint: 'User is in Connect. Help draft messages, plan follow-ups, and coordinate people.',
  },
  projects: {
    title: 'Projects',
    subtitle: 'Ship work with linked notes, tasks, and people.',
    placeholder: 'Research scope, draft updates, or plan next milestones…',
    accentApp: 'root',
    systemHint: 'User is in Projects. Help with scope research, status, collaborators, and delivery planning.',
  },
  accounts: {
    title: 'Accounts',
    subtitle: 'Profile, billing, and identity settings.',
    placeholder: 'Ask about your plan, profile, or account setup…',
    accentApp: 'accounts',
    systemHint: 'User is in Accounts. Help with profile, billing, and identity.',
  },
  settings: {
    title: 'Settings',
    subtitle: 'Tune alerts, security, and workspace preferences.',
    placeholder: 'Configure notifications, security, or preferences…',
    accentApp: 'accounts',
    systemHint: 'User is in Settings. Help with configuration and security preferences.',
  },
  agents: {
    title: 'Smart System',
    subtitle: 'Run agents and automate recurring work.',
    placeholder: 'Design automations or describe what the system should handle…',
    accentApp: 'root',
    systemHint: 'User is managing agents. Help design goals, routines, and automations.',
  },
  workspace: {
    title: 'Workspace',
    subtitle: 'Your full Kylrix environment at a glance.',
    placeholder: 'Ask anything across notes, flow, vault, and projects…',
    accentApp: 'root',
    systemHint: 'User is in the general workspace. Help across notes, tasks, vault, and projects.',
  },
};

function resolveZone(pathname: string): AgenticZone {
  if (pathname.startsWith('/app')) return 'note';
  if (pathname.startsWith('/flow')) return 'flow';
  if (pathname.startsWith('/vault')) return 'vault';
  if (pathname.startsWith('/connect')) return 'connect';
  if (pathname.startsWith('/projects')) return 'projects';
  if (pathname.startsWith('/accounts')) return 'accounts';
  if (pathname.startsWith('/settings/agents') || pathname.startsWith('/agents')) return 'agents';
  if (pathname.startsWith('/settings')) return 'settings';
  if (pathname.startsWith('/tags')) return 'workspace';
  return 'workspace';
}

function extractResourceId(pathname: string, zone: AgenticZone): string | undefined {
  const segments = pathname.split('/').filter(Boolean);
  if (zone === 'projects' && segments[0] === 'projects' && segments[1]) return segments[1];
  if (zone === 'note' && segments[0] === 'app' && segments[1] && !['shared', 'landing', 'admin'].includes(segments[1])) {
    return segments[1];
  }
  if (zone === 'connect' && segments[0] === 'connect' && segments[1]) return segments[1];
  if (zone === 'flow' && segments[0] === 'flow' && segments[1]) return segments[1];
  return undefined;
}

export function resolveAgenticPageContext(pathname: string): AgenticPageContext {
  const route = pathname || '/';
  const zone = resolveZone(route);
  const meta = ZONE_META[zone];
  const resourceId = extractResourceId(route, zone);

  let title = meta.title;
  let subtitle = meta.subtitle;
  let systemHint = meta.systemHint;

  if (zone === 'projects' && resourceId) {
    title = 'Project room';
    subtitle = 'Scope, people, and linked work in one place.';
    systemHint = `User is viewing project ${resourceId}. Help research scope, status, collaborators, and milestones.`;
  }

  if (zone === 'note' && resourceId) {
    title = 'Note editor';
    subtitle = 'Polish this note or branch it into tasks.';
    systemHint = `User is editing note ${resourceId}. Help compose, rewrite, summarize, and extract tasks.`;
  }

  if (zone === 'flow' && route.includes('/goals')) {
    title = 'Goals';
    subtitle = 'Break goals into scheduled work.';
    systemHint = 'User is in Flow goals. Help define outcomes and schedule supporting tasks.';
  }

  if (zone === 'flow' && route.includes('/events')) {
    title = 'Events';
    subtitle = 'Plan moments and follow-ups.';
    systemHint = 'User is in Flow events. Help schedule events and related tasks.';
  }

  return {
    zone,
    route,
    resourceId,
    title,
    subtitle,
    placeholder: meta.placeholder,
    accentApp: meta.accentApp,
    systemHint,
  };
}

export function getQuickWorkflows(context: AgenticPageContext): QuickWorkflowAction[] {
  const { zone, resourceId } = context;

  switch (zone) {
    case 'note':
      return [
        {
          id: 'note-compose',
          label: 'Compose a note',
          description: 'Start a fresh idea with structure',
          icon: 'file-plus',
          kind: 'prompt',
          prompt: 'Help me compose a new note. Ask one clarifying question, then draft a clear title and body with sections.',
        },
        {
          id: 'note-rewrite',
          label: 'Polish this note',
          description: 'Tighten tone and clarity',
          icon: 'pen-line',
          kind: 'prompt',
          prompt: resourceId
            ? `Rewrite note ${resourceId} for clarity. Keep the meaning, improve flow, and suggest a stronger title.`
            : 'Rewrite my latest note for clarity. Keep the meaning and suggest a stronger title.',
        },
        {
          id: 'note-summarize',
          label: 'Summarize',
          description: 'Key points in bullets',
          icon: 'sparkles',
          kind: 'instant',
          prompt: resourceId
            ? `Summarize note ${resourceId} into 5 bullets with next actions.`
            : 'Summarize my pinned notes into 5 bullets with next actions.',
          autoRun: true,
        },
        {
          id: 'note-tasks',
          label: 'Extract tasks',
          description: 'Turn ideas into Flow work',
          icon: 'list-todo',
          kind: 'instant',
          prompt: resourceId
            ? `From note ${resourceId}, extract a prioritized task list with due hints.`
            : 'From my latest notes, extract a prioritized task list with due hints.',
          autoRun: true,
        },
        {
          id: 'note-tags',
          label: 'Suggest tags',
          description: 'Organize and find faster',
          icon: 'tags',
          kind: 'instant',
          prompt: 'Suggest 5 practical tags for my recent notes and explain when to use each.',
          autoRun: true,
        },
        {
          id: 'note-shared',
          label: 'Shared notes',
          description: 'Open collaboration hub',
          icon: 'share-2',
          kind: 'navigate',
          href: '/app/shared',
        },
      ];

    case 'flow':
      return [
        {
          id: 'flow-schedule',
          label: 'Schedule a task',
          description: 'Pick time and priority',
          icon: 'calendar-plus',
          kind: 'prompt',
          prompt: 'Help me schedule a new task with title, priority, due date, and a realistic time block this week.',
        },
        {
          id: 'flow-week',
          label: 'Plan my week',
          description: 'Map priorities by day',
          icon: 'calendar-range',
          kind: 'instant',
          prompt: 'Build a 5-day plan from my open tasks: top 3 priorities per day with time blocks.',
          autoRun: true,
        },
        {
          id: 'flow-overdue',
          label: 'Triage overdue',
          description: 'Rescue or reschedule',
          icon: 'alarm-clock',
          kind: 'instant',
          prompt: 'Review overdue tasks, rank by impact, and suggest reschedule or delegation options.',
          autoRun: true,
        },
        {
          id: 'flow-goal',
          label: 'Break down a goal',
          description: 'Milestones and tasks',
          icon: 'target',
          kind: 'prompt',
          prompt: 'Help me break a goal into milestones, weekly targets, and the first 3 tasks to start today.',
        },
        {
          id: 'flow-focus',
          label: 'Today focus',
          description: 'Next 3 moves',
          icon: 'zap',
          kind: 'instant',
          prompt: 'Pick the 3 highest-leverage tasks I should finish today and explain why.',
          autoRun: true,
        },
        {
          id: 'flow-goals',
          label: 'Open goals',
          description: 'Review outcomes',
          icon: 'flag',
          kind: 'navigate',
          href: '/flow/goals',
        },
        {
          id: 'flow-events',
          label: 'Plan an event',
          description: 'Moments and RSVPs',
          icon: 'calendar',
          kind: 'navigate',
          href: '/flow/events',
        },
      ];

    case 'vault':
      return [
        {
          id: 'vault-add',
          label: 'Add a login',
          description: 'Open new secret form',
          icon: 'key-round',
          kind: 'navigate',
          href: '/vault/credentials/new',
        },
        {
          id: 'vault-password',
          label: 'Generate password',
          description: 'Strong random secret',
          icon: 'sparkles',
          kind: 'instant',
          prompt: 'Generate a 20-character password with symbols and a memorable passphrase alternative.',
          autoRun: true,
        },
        {
          id: 'vault-audit',
          label: 'Security check',
          description: 'Spot weak patterns',
          icon: 'shield-check',
          kind: 'instant',
          prompt: 'Give a vault hygiene checklist: reused passwords, stale entries, and rotation priorities.',
          autoRun: true,
        },
        {
          id: 'vault-organize',
          label: 'Organize labels',
          description: 'Group similar logins',
          icon: 'tags',
          kind: 'instant',
          prompt: 'Suggest a simple label system for my vault entries by app type and risk level.',
          autoRun: true,
        },
        {
          id: 'vault-totp',
          label: 'TOTP help',
          description: 'Codes and rotation',
          icon: 'smartphone',
          kind: 'prompt',
          prompt: 'Explain how to safely store and rotate TOTP codes in my vault.',
        },
        {
          id: 'vault-open',
          label: 'Open Vault',
          description: 'Browse all secrets',
          icon: 'lock',
          kind: 'navigate',
          href: '/vault',
        },
      ];

    case 'connect':
      return [
        {
          id: 'connect-compose',
          label: 'Compose message',
          description: 'Draft a clear reply',
          icon: 'message-square',
          kind: 'prompt',
          prompt: resourceId
            ? `Draft a concise reply for chat ${resourceId}. Ask what tone I want, then write the message.`
            : 'Draft a concise, friendly message. Ask what context I need, then write the reply.',
        },
        {
          id: 'connect-followup',
          label: 'Follow-up plan',
          description: 'Owners and deadlines',
          icon: 'users',
          kind: 'instant',
          prompt: 'Create a follow-up plan from recent conversations with owners and deadlines.',
          autoRun: true,
        },
        {
          id: 'connect-summarize',
          label: 'Thread summary',
          description: 'Catch up fast',
          icon: 'sparkles',
          kind: 'instant',
          prompt: resourceId
            ? `Summarize chat ${resourceId}: decisions, blockers, and open questions.`
            : 'Summarize the latest chat activity into decisions, blockers, and open questions.',
          autoRun: true,
        },
        {
          id: 'connect-meeting',
          label: 'Meeting notes',
          description: 'Turn chat into actions',
          icon: 'pen-line',
          kind: 'prompt',
          prompt: 'Turn this conversation into meeting notes with decisions, owners, and next tasks.',
        },
        {
          id: 'connect-huddle',
          label: 'Start huddle',
          description: 'Live call room',
          icon: 'video',
          kind: 'navigate',
          href: '/connect/calls',
        },
        {
          id: 'connect-chats',
          label: 'Open chats',
          description: 'Continue conversations',
          icon: 'messages',
          kind: 'navigate',
          href: '/connect/chats',
        },
      ];

    case 'projects':
      return [
        {
          id: 'project-scope',
          label: 'Research scope',
          description: 'Define boundaries and risks',
          icon: 'search',
          kind: 'prompt',
          prompt: resourceId
            ? `Research and outline the scope for project ${resourceId}: goals, deliverables, risks, and open questions.`
            : 'Research and outline scope for my most active project: goals, deliverables, risks, and open questions.',
        },
        {
          id: 'project-milestones',
          label: 'Plan milestones',
          description: 'Sequence delivery',
          icon: 'milestone',
          kind: 'instant',
          prompt: resourceId
            ? `Propose 4–6 milestones for project ${resourceId} with owners and target dates.`
            : 'Propose milestones for my top active project with owners and target dates.',
          autoRun: true,
        },
        {
          id: 'project-status',
          label: 'Status snapshot',
          description: 'Where things stand',
          icon: 'bar-chart-3',
          kind: 'instant',
          prompt: resourceId
            ? `Summarize project ${resourceId}: progress, risks, blockers, and next 3 actions.`
            : 'Summarize my active projects with progress, risks, and next actions.',
          autoRun: true,
        },
        {
          id: 'project-update',
          label: 'Draft update',
          description: 'Share with collaborators',
          icon: 'send',
          kind: 'instant',
          prompt: resourceId
            ? `Write a short project update for ${resourceId} suitable for collaborators.`
            : 'Write a short project update suitable for collaborators.',
          autoRun: true,
        },
        {
          id: 'project-link',
          label: 'Link work',
          description: 'Notes, tasks, secrets',
          icon: 'link-2',
          kind: 'navigate',
          href: resourceId ? `/projects/${resourceId}` : '/projects',
        },
        {
          id: 'project-new',
          label: 'New project',
          description: 'Start a workspace',
          icon: 'folder-kanban',
          kind: 'navigate',
          href: '/projects',
        },
      ];

    case 'settings':
      return [
        {
          id: 'settings-security',
          label: 'Security review',
          description: 'Passkeys and vault',
          icon: 'shield',
          kind: 'instant',
          prompt: 'Give a short security checklist: passkeys, vault lock, and alert settings.',
          autoRun: true,
        },
        {
          id: 'settings-telegram',
          label: 'Telegram alerts',
          description: 'Notification rules',
          icon: 'bell',
          kind: 'navigate',
          href: '/settings',
        },
        {
          id: 'settings-agents',
          label: 'Smart system',
          description: 'Agents and automations',
          icon: 'bot',
          kind: 'navigate',
          href: '/settings/agents',
        },
        {
          id: 'settings-profile',
          label: 'Profile tips',
          description: 'Public identity polish',
          icon: 'user',
          kind: 'instant',
          prompt: 'Suggest improvements for my profile display name, bio, and discoverability.',
          autoRun: true,
        },
      ];

    case 'agents':
      return [
        {
          id: 'agents-goal',
          label: 'Design agent',
          description: 'Mission and triggers',
          icon: 'compass',
          kind: 'prompt',
          prompt: 'Help me design an agent: goal, trigger, inputs, and success criteria for:',
        },
        {
          id: 'agents-routine',
          label: 'Morning routine',
          description: 'Daily triage automation',
          icon: 'sunrise',
          kind: 'instant',
          prompt: 'Propose a morning triage agent routine across notes, tasks, and inbox follow-ups.',
          autoRun: true,
        },
        {
          id: 'agents-audit',
          label: 'Audit agents',
          description: 'What is running now',
          icon: 'bot',
          kind: 'instant',
          prompt: 'List what my agents should monitor and suggest one new automation I am missing.',
          autoRun: true,
        },
        {
          id: 'agents-open',
          label: 'Agent settings',
          description: 'Full configuration',
          icon: 'settings',
          kind: 'navigate',
          href: '/settings/agents',
        },
      ];

    case 'accounts':
      return [
        {
          id: 'accounts-plan',
          label: 'Plan overview',
          description: 'What Pro unlocks',
          icon: 'credit-card',
          kind: 'instant',
          prompt: 'Explain what changes when I upgrade to Pro for smart system features.',
          autoRun: true,
        },
        {
          id: 'accounts-profile',
          label: 'Profile tips',
          description: 'Polish public identity',
          icon: 'user',
          kind: 'instant',
          prompt: 'Suggest improvements for my public profile and display name.',
          autoRun: true,
        },
        {
          id: 'accounts-billing',
          label: 'Billing help',
          description: 'Subscription questions',
          icon: 'wallet',
          kind: 'prompt',
          prompt: 'Answer questions about my Kylrix plan, billing cycle, and upgrade options.',
        },
      ];

    default:
      return [
        {
          id: 'ws-compose-note',
          label: 'Compose a note',
          description: 'Start in Ideas',
          icon: 'file-plus',
          kind: 'prompt',
          prompt: 'Help me compose a new note with a title, outline, and first draft.',
        },
        {
          id: 'ws-schedule-task',
          label: 'Schedule a task',
          description: 'Add to Flow',
          icon: 'calendar-plus',
          kind: 'prompt',
          prompt: 'Help me schedule a task with priority, due date, and time block.',
        },
        {
          id: 'ws-brief',
          label: 'Morning brief',
          description: 'Cross-app snapshot',
          icon: 'sunrise',
          kind: 'instant',
          prompt: 'Give a morning brief across notes, tasks, vault alerts, and projects.',
          autoRun: true,
        },
        {
          id: 'ws-notes',
          label: 'Ideas',
          description: 'Notes workspace',
          icon: 'lightbulb',
          kind: 'navigate',
          href: '/app',
        },
        {
          id: 'ws-flow',
          label: 'Flow',
          description: 'Tasks and goals',
          icon: 'workflow',
          kind: 'navigate',
          href: '/flow',
        },
        {
          id: 'ws-vault',
          label: 'Vault',
          description: 'Secure storage',
          icon: 'lock',
          kind: 'navigate',
          href: '/vault',
        },
        {
          id: 'ws-projects',
          label: 'Projects',
          description: 'Delivery rooms',
          icon: 'folder-kanban',
          kind: 'navigate',
          href: '/projects',
        },
      ];
  }
}

export function buildInstantPrompt(userPrompt: string, context: AgenticPageContext): string {
  const lines = [
    `Page: ${context.title} (${context.zone})`,
    `Route: ${context.route}`,
    context.resourceId ? `Resource: ${context.resourceId}` : null,
    `Context: ${context.systemHint}`,
    '',
    `User request: ${userPrompt.trim()}`,
  ].filter(Boolean);

  return lines.join('\n');
}
