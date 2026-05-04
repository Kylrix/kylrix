import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { getEmailTemplateMeta } from './email-template-catalog';

export type EmailRenderVars = Record<string, string | number | boolean | null | undefined>;

const EMAILS_DIR = path.join(process.cwd(), 'emails');

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function applyVariables(template: string, vars: EmailRenderVars = {}): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_match, key: string) => {
    const value = vars[key];
    if (value === null || value === undefined) return '';
    return escapeHtml(String(value));
  });
}

export async function renderEmailTemplate(
  templateId: string,
  vars: EmailRenderVars = {},
): Promise<{ subject: string; html: string }> {
  const meta = getEmailTemplateMeta(templateId);

  if (!meta) {
    throw new Error(`Unknown email template: ${templateId}`);
  }

  const filePath = path.join(EMAILS_DIR, meta.filename);
  const raw = await readFile(filePath, 'utf8');

  return {
    subject: meta.subject,
    html: applyVariables(raw, vars),
  };
}

export function renderEmailPreview(templateId: string, vars: EmailRenderVars = {}): Promise<{ subject: string; html: string }> {
  return renderEmailTemplate(templateId, vars);
}
