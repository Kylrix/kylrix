export type SecondaryObjectKind = 'file' | 'image' | 'link' | 'voice' | 'task' | 'form' | 'vault' | 'note' | 'session';

export interface SecondaryObjectPayload {
  objectId?: string;
  childId: string;
  childKind: SecondaryObjectKind;
  bucketId?: string;
  href?: string;
  label?: string;
  line?: number;
  appTheme?: 'idea' | 'vault' | 'flow' | 'connect' | 'default';
  metadata?: Record<string, unknown>;
}

export interface ParsedObjectBlock {
  raw: string;
  start: number;
  end: number;
  line: number;
  payload: SecondaryObjectPayload;
}

const OBJECT_BLOCK_REGEX = /\[\[kylrix-object:(\{.*?\})\]\]/g;

export function serializeObjectBlock(payload: SecondaryObjectPayload): string {
  return `[[kylrix-object:${JSON.stringify(payload)}]]`;
}

export function parseObjectBlocks(content: string): ParsedObjectBlock[] {
  if (!content) return [];
  const rows: ParsedObjectBlock[] = [];
  for (const match of content.matchAll(OBJECT_BLOCK_REGEX)) {
    const raw = match[0];
    const json = match[1];
    const start = match.index ?? 0;
    try {
      const payload = JSON.parse(json) as SecondaryObjectPayload;
      const before = content.slice(0, start);
      rows.push({
        raw,
        start,
        end: start + raw.length,
        line: before.split('\n').length,
        payload,
      });
    } catch {
      // Skip malformed blocks to avoid breaking rendering.
    }
  }
  return rows;
}

export function buildObjectRelationKey(childId: string, childKind: string): string {
  return `${childKind}:${childId}`;
}

export function getObjectBlockRelationKeys(content: string): Set<string> {
  const keys = new Set<string>();
  for (const block of parseObjectBlocks(content)) {
    if (!block.payload.childId || !block.payload.childKind) continue;
    keys.add(buildObjectRelationKey(block.payload.childId, block.payload.childKind));
  }
  return keys;
}

export function getRemovedObjectBlocks(previousContent: string, nextContent: string): ParsedObjectBlock[] {
  const nextKeys = getObjectBlockRelationKeys(nextContent);
  return parseObjectBlocks(previousContent).filter(
    (block) => !nextKeys.has(buildObjectRelationKey(block.payload.childId, block.payload.childKind))
  );
}

export function applyMarkdownWrap(
  source: string,
  start: number,
  end: number,
  left: string,
  right = left
): { next: string; cursorStart: number; cursorEnd: number } {
  const selected = source.slice(start, end);
  const wrapped = `${left}${selected}${right}`;
  const next = source.slice(0, start) + wrapped + source.slice(end);
  return {
    next,
    cursorStart: start + left.length,
    cursorEnd: start + left.length + selected.length,
  };
}

