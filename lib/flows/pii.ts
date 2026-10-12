import type { WorkflowChain, WorkflowStep } from '@/lib/workflow-engine';

export type FlowPiiHit = {
  field: string;
  hint: string;
};

const EMAIL_RE = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i;
const PHONE_RE = /(?:\+?\d[\d\s().-]{7,}\d)/;
const SSN_RE = /\b\d{3}-\d{2}-\d{4}\b/;
const IPV4_RE = /\b(?:\d{1,3}\.){3}\d{1,3}\b/;
const SECRETISH_RE =
  /\b(?:password|passwd|secret|api[_-]?key|token|bearer|ssn|credit[_\s-]?card)\b/i;
const LONG_DIGIT_RE = /\b\d{12,}\b/;
const NETWORK_RE = /\b(?:https?:\/\/|ftp:\/\/|wss?:\/\/|curl|fetch|axios|http\.get|http\.post|net\/http|socket)\b/i;
const DECEPTIVE_RE = /\b(?:verify account|claim reward|unauthorized access|urgent action|password reset|login prompt|update billing|phishing|malware|backdoor|exfiltrate)\b/i;

function scanText(field: string, text: string | null | undefined, hits: FlowPiiHit[]) {
  if (!text || !String(text).trim()) return;
  const value = String(text);
  if (EMAIL_RE.test(value)) hits.push({ field, hint: 'Email address' });
  if (PHONE_RE.test(value)) hits.push({ field, hint: 'Phone number' });
  if (SSN_RE.test(value)) hits.push({ field, hint: 'ID number' });
  if (IPV4_RE.test(value)) hits.push({ field, hint: 'IP address' });
  if (SECRETISH_RE.test(value)) hits.push({ field, hint: 'Secret-like wording' });
  if (LONG_DIGIT_RE.test(value)) hits.push({ field, hint: 'Long number sequence' });
  if (NETWORK_RE.test(value)) hits.push({ field, hint: 'External network request detected' });
  if (DECEPTIVE_RE.test(value)) hits.push({ field, hint: 'Deceptive or suspicious language' });
}

function scanSteps(steps: WorkflowStep[], hits: FlowPiiHit[]) {
  steps.forEach((step, i) => {
    scanText(`Step ${i + 1} action`, step.actionId, hits);
    if (step.metadata) {
      try {
        scanText(`Step ${i + 1} data`, JSON.stringify(step.metadata), hits);
      } catch {
        /* ignore */
      }
    }
  });
}

/** Heuristic PII scan before publishing a flow. */
export function detectFlowPii(wf: Pick<WorkflowChain, 'name' | 'description' | 'steps'>): {
  hasPii: boolean;
  hits: FlowPiiHit[];
} {
  const hits: FlowPiiHit[] = [];
  scanText('Name', wf.name, hits);
  scanText('Description', wf.description, hits);
  scanSteps(wf.steps || [], hits);

  const unique = hits.filter(
    (h, i, arr) => arr.findIndex((x) => x.field === h.field && x.hint === h.hint) === i
  );
  return { hasPii: unique.length > 0, hits: unique };
}
