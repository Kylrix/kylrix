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
      { id: `task:${baseId}`, label: 'Create Task', description: 'Convert the note into an actionable task.' },
      { id: `event:${baseId}`, label: 'Create Event', description: 'Turn the note into a scheduled event.' },
      { id: `followup:${baseId}`, label: 'Add Follow-up', description: 'Generate a follow-up action from this note.' },
    ];
  }

  if (sourceType === 'task' || sourceApp === 'flow') {
    return [
      { id: `note:${baseId}`, label: 'Attach Note', description: 'Link a source note to this task.' },
      { id: `event:${baseId}`, label: 'Calendar Event', description: 'Map this task onto a calendar surface.' },
    ];
  }

  return [
    { id: `note:${baseId}`, label: 'Attach Note', description: 'Expose a note-link action.' },
    { id: `event:${baseId}`, label: 'Create Event', description: 'Expose an event creation action.' },
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
