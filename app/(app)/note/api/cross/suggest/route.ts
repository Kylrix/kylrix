import { NextRequest, NextResponse } from 'next/server';

type Suggestion = {
  id: string;
  label: string;
  description: string;
};

function buildSuggestions(sourceApp: string, sourceType: string, sourceId: string | null): Suggestion[] {
  const baseId = sourceId || 'unknown';

  if (sourceApp === 'note' || sourceType === 'note') {
    return [
      { id: `task:${baseId}`, label: 'Create Task', description: 'Turn this note into a Flow task.' },
      { id: `share:${baseId}`, label: 'Share in Connect', description: 'Send a compact note preview to a DM.' },
      { id: `secret:${baseId}`, label: 'Link Secret', description: 'Attach a Vault credential or TOTP item.' },
      { id: `event:${baseId}`, label: 'Create Event', description: 'Promote this note into a calendar event.' },
    ];
  }

  if (sourceApp === 'flow' || sourceType === 'task') {
    return [
      { id: `note:${baseId}`, label: 'Attach Note', description: 'Link a supporting note to this task.' },
      { id: `event:${baseId}`, label: 'Create Event', description: 'Schedule this work as a calendar event.' },
      { id: `share:${baseId}`, label: 'Share Update', description: 'Push a compact progress update into Connect.' },
    ];
  }

  if (sourceApp === 'connect' || sourceType === 'message') {
    return [
      { id: `note:${baseId}`, label: 'Attach Note', description: 'Surface the referenced note inside chat.' },
      { id: `task:${baseId}`, label: 'Create Task', description: 'Turn this conversation into a Flow task.' },
      { id: `secret:${baseId}`, label: 'Attach Secret', description: 'Link a Vault credential for context.' },
    ];
  }

  if (sourceApp === 'vault' || sourceType === 'secret') {
    return [
      { id: `note:${baseId}`, label: 'Link Note', description: 'Attach a note to keep context with the secret.' },
      { id: `task:${baseId}`, label: 'Create Task', description: 'Use this credential context to create a task.' },
      { id: `share:${baseId}`, label: 'Share Securely', description: 'Send a safe preview into Connect.' },
    ];
  }

  return [
    { id: `note:${baseId}`, label: 'Attach Note', description: 'Expose a note surface action.' },
    { id: `task:${baseId}`, label: 'Create Task', description: 'Expose a task surface action.' },
  ];
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const sourceApp = url.searchParams.get('sourceApp') || '';
  const sourceType = url.searchParams.get('sourceType') || '';
  const sourceId = url.searchParams.get('sourceId');

  return NextResponse.json({
    sourceApp,
    sourceType,
    sourceId,
    suggestions: buildSuggestions(sourceApp, sourceType, sourceId),
  });
}
