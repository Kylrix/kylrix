/**
 * Type-level intelligence — one session per user × object type (no chat UI).
 * Distinct from Sidekick (per-object) and isMemory lifetime brain.
 */

export type TypeIntelKind = 'note' | 'goal' | 'event' | 'form' | 'project';

export type TypeIntelKindConfig = {
  kind: TypeIntelKind;
  /** agentic_sessions.targetType */
  targetType: `typeIntel_${TypeIntelKind}`;
  /** Short prefix for Appwrite row id (≤36 total with userId). */
  remotePrefix: string;
  /** Layman label for UI copy */
  label: string;
  /** Accent used on toggle / accept (OpenBricks object hues). */
  accent: string;
  /** LocalEngine list cache keys (tried in order). */
  listKeys: (userId: string) => string[];
  /** Pull a redacted training string from a cached row. */
  sampleFromRow: (row: any) => string;
  /** Object-type hints for cold start (optional secondary caches). */
  hintKeys?: (userId: string) => string[];
  hintFromRow?: (row: any) => string;
};

function titleContent(row: any): string {
  const title = String(row?.title || row?.name || row?.searchTitle || '').trim();
  const body = String(row?.content || row?.description || row?.summary || row?.caption || '').trim();
  if (title && body) return `${title} — ${body.slice(0, 400)}`;
  return title || body;
}

export const TYPE_INTEL_KINDS: Record<TypeIntelKind, TypeIntelKindConfig> = {
  note: {
    kind: 'note',
    targetType: 'typeIntel_note',
    remotePrefix: 'tin_note_',
    label: 'idea',
    accent: '#EC4899',
    listKeys: (uid) => [`f_notes_list_${uid}`, 'f_notes_list'],
    sampleFromRow: titleContent,
    hintKeys: (uid) => [`f_goals_list_${uid}`, 'f_goals_list'],
    hintFromRow: (r) => String(r?.title || r?.name || ''),
  },
  goal: {
    kind: 'goal',
    targetType: 'typeIntel_goal',
    remotePrefix: 'tin_goal_',
    label: 'goal',
    accent: '#A855F7',
    listKeys: (uid) => [`f_goals_list_${uid}`, 'f_goals_list'],
    sampleFromRow: titleContent,
    hintKeys: (uid) => [`f_notes_list_${uid}`, 'f_notes_list'],
    hintFromRow: (r) => String(r?.title || ''),
  },
  event: {
    kind: 'event',
    targetType: 'typeIntel_event',
    remotePrefix: 'tin_event_',
    label: 'event',
    accent: '#22C55E',
    listKeys: (uid) => [`f_events_list_${uid}`, 'f_events_list'],
    sampleFromRow: titleContent,
    hintKeys: (uid) => [`f_notes_list_${uid}`, 'f_notes_list'],
    hintFromRow: (r) => String(r?.title || ''),
  },
  form: {
    kind: 'form',
    targetType: 'typeIntel_form',
    remotePrefix: 'tin_form_',
    label: 'form',
    accent: '#6366F1',
    listKeys: (uid) => [`f_forms_list_${uid}`, 'f_forms_list', `f_forms_${uid}`],
    sampleFromRow: (row) => {
      const t = String(row?.title || '').trim();
      const d = String(row?.description || '').trim();
      return t && d ? `${t} — ${d.slice(0, 400)}` : t || d;
    },
  },
  project: {
    kind: 'project',
    targetType: 'typeIntel_project',
    remotePrefix: 'tin_proj_',
    label: 'workspace',
    accent: '#6366F1',
    listKeys: (uid) => [`f_projects_list_${uid}`, 'f_projects_list'],
    sampleFromRow: (row) => {
      const t = String(row?.title || row?.name || '').trim();
      const d = String(row?.summary || row?.description || '').trim();
      return t && d ? `${t} — ${d.slice(0, 400)}` : t || d;
    },
    hintKeys: (uid) => [`f_notes_list_${uid}`, 'f_notes_list'],
    hintFromRow: (r) => String(r?.title || ''),
  },
};

export function typeIntelPrefKey(kind: TypeIntelKind): string {
  return `f_type_intel_create_with_agent_${kind}`;
}

export function typeIntelVoicePrefix(kind: TypeIntelKind): string {
  return `TYPE_INTEL_SAMPLES_V1_${kind.toUpperCase()}:`;
}
