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
      { id: `secret:${baseId}`, label: 'Link Credential', description: 'Attach a password entry to this note context.' },
      { id: `totp:${baseId}`, label: 'Link TOTP', description: 'Attach a one-time password surface to the note.' },
      { id: `share:${baseId}`, label: 'Share Securely', description: 'Send the note into Connect with a safe preview.' },
    ];
  }

  if (sourceType === 'secret' || sourceType === 'totp' || sourceApp === 'vault') {
    return [
      { id: `note:${baseId}`, label: 'Attach Note', description: 'Keep the related note alongside the secret.' },
      { id: `task:${baseId}`, label: 'Create Task', description: 'Turn this secret context into a Flow follow-up.' },
    ];
  }

  return [
    { id: `note:${baseId}`, label: 'Attach Note', description: 'Expose a note-linking action.' },
    { id: `secret:${baseId}`, label: 'Link Secret', description: 'Expose a vault-linking action.' },
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
