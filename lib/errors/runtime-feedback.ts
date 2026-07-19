'use client';

import { FormsService } from '@/lib/services/forms';

const FEATURE_REQUEST_FORM_ID = '6a2a653f002b0f296958';
const SESSION_DEDUPE_PREFIX = 'kylrix:auto-error-feedback:';

type RuntimeErrorBoundary = 'route' | 'global';

interface RuntimeErrorFeedbackInput {
  boundary: RuntimeErrorBoundary;
  error: Error & { digest?: string };
}

interface FormSchemaField {
  id: string;
  label?: string;
  type?: string;
  required?: boolean;
  options?: string[];
}

function parseSchema(schemaRaw: string | null | undefined): FormSchemaField[] {
  if (!schemaRaw) return [];
  try {
    const parsed = JSON.parse(schemaRaw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item): item is Record<string, unknown> => typeof item === 'object' && item !== null)
      .map((item) => ({
        id: String(item.id ?? ''),
        label: typeof item.label === 'string' ? item.label : '',
        type: typeof item.type === 'string' ? item.type : 'text',
        required: Boolean(item.required),
        options: Array.isArray(item.options) ? item.options.map(String) : [],
      }))
      .filter((field) => field.id.length > 0);
  } catch (err) {
    console.error('[RuntimeFeedback] Failed to parse form schema.', err);
    return [];
  }
}

function pickOption(options: string[] | undefined, priorities: string[]): string {
  const list = options ?? [];
  const lowered = list.map((opt) => ({ raw: opt, lower: opt.toLowerCase() }));
  for (const keyword of priorities) {
    const match = lowered.find((opt) => opt.lower.includes(keyword));
    if (match) return match.raw;
  }
  return list[0] ?? '';
}

function truncate(input: string, max = 2000): string {
  if (input.length <= max) return input;
  return `${input.slice(0, max - 3)}...`;
}

function buildPayload(schema: FormSchemaField[], input: RuntimeErrorFeedbackInput): Record<string, unknown> {
  const nowIso = new Date().toISOString();
  const href = typeof window !== 'undefined' ? window.location.href : '';
  const path = typeof window !== 'undefined' ? window.location.pathname : '';
  const ua = typeof window !== 'undefined' ? window.navigator.userAgent : '';
  const digest = input.error.digest || '';
  const message = input.error.message || 'Unknown application error';
  const stack = typeof input.error.stack === 'string' ? input.error.stack : '';

  const summary = truncate(`${input.boundary.toUpperCase()} error: ${message}`, 180);
  const details = truncate(
    [
      `Boundary: ${input.boundary}`,
      `Time: ${nowIso}`,
      `Page: ${href || path || 'unknown'}`,
      digest ? `Digest: ${digest}` : null,
      `Message: ${message}`,
      stack ? `Stack:\n${stack}` : null,
      ua ? `User Agent: ${ua}` : null,
    ]
      .filter(Boolean)
      .join('\n\n'),
    6000
  );
  const steps = truncate(`1. Open ${href || path || '/'}\n2. Continue normal usage\n3. App shows a crash drawer`, 1000);

  const payload: Record<string, unknown> = {};

  for (const field of schema) {
    const key = `${field.id} ${field.label ?? ''}`.toLowerCase();
    const fieldType = (field.type ?? 'text').toLowerCase();

    if (key.includes('type') || key.includes('category')) {
      payload[field.id] = pickOption(field.options, ['bug', 'error', 'crash', 'issue']);
      continue;
    }
    if (key.includes('priority') || key.includes('severity')) {
      payload[field.id] = pickOption(field.options, ['critical', 'high', 'urgent', 'p1', 'major']);
      continue;
    }
    if (key.includes('title') || key.includes('summary') || key.includes('subject') || key.includes('headline')) {
      payload[field.id] = summary;
      continue;
    }
    if (key.includes('description') || key.includes('detail') || key.includes('message') || key.includes('what happened')) {
      payload[field.id] = details;
      continue;
    }
    if (key.includes('step') || key.includes('repro')) {
      payload[field.id] = steps;
      continue;
    }
    if (key.includes('url') || key.includes('page') || key.includes('path')) {
      payload[field.id] = href || path || 'unknown';
      continue;
    }
    if (key.includes('browser') || key.includes('device') || key.includes('platform')) {
      payload[field.id] = truncate(ua || 'unknown', 500);
      continue;
    }
    if (key.includes('digest') || key.includes('error id')) {
      payload[field.id] = digest || 'none';
      continue;
    }
    if (key.includes('email') && fieldType === 'email') {
      payload[field.id] = 'noreply@kylrix.space';
      continue;
    }

    if (!field.required) continue;

    if (fieldType === 'checkbox') {
      payload[field.id] = [];
      continue;
    }
    if (fieldType === 'select' || fieldType === 'radio') {
      payload[field.id] = pickOption(field.options, ['bug', 'error', 'issue']);
      continue;
    }
    if (fieldType === 'number') {
      payload[field.id] = '1';
      continue;
    }
    if (fieldType === 'email') {
      payload[field.id] = 'noreply@kylrix.space';
      continue;
    }
    if (fieldType === 'file') {
      // Required files cannot be auto-attached in crash boundaries.
      payload[field.id] = '';
      continue;
    }

    payload[field.id] = details;
  }

  return payload;
}

export async function submitRuntimeErrorFeedback(input: RuntimeErrorFeedbackInput): Promise<void> {
  if (typeof window === 'undefined') return;

  const fingerprintBase = `${input.boundary}|${input.error.digest ?? ''}|${input.error.message ?? ''}|${window.location.pathname}`;
  const dedupeKey = `${SESSION_DEDUPE_PREFIX}${fingerprintBase}`;

  if (sessionStorage.getItem(dedupeKey) === 'submitted') return;
  sessionStorage.setItem(dedupeKey, 'pending');

  try {
    const form = await FormsService.getForm(FEATURE_REQUEST_FORM_ID);
    const schema = parseSchema(form?.schema);
    const payload = buildPayload(schema, input);
    await FormsService.submitForm(FEATURE_REQUEST_FORM_ID, JSON.stringify(payload));
    sessionStorage.setItem(dedupeKey, 'submitted');
  } catch (err) {
    sessionStorage.removeItem(dedupeKey);
    console.error('[RuntimeFeedback] Failed to submit automatic error feedback.', err);
  }
}

