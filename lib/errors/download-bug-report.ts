'use client';

export function downloadBugReportMarkdown(details: {
  message?: string;
  stack?: string;
  digest?: string;
  timestamp?: string;
}) {
  const ts = details.timestamp || new Date().toISOString();
  const digestStr = details.digest || 'live-error';
  const content = [
    `# Bug Report: ${digestStr}`,
    ``,
    `**Timestamp:** ${ts}`,
    `**Digest ID:** \`${digestStr}\``,
    ``,
    `## Error Message`,
    `\`\`\``,
    details.message || 'No error message provided.',
    `\`\`\``,
    ``,
    details.stack ? `## Stack Trace\n\`\`\`\n${details.stack}\n\`\`\`` : '',
  ].filter(Boolean).join('\n');

  const blob = new Blob([content], { type: 'text/markdown;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `bug_report_${digestStr.replace(/[^a-zA-Z0-9_-]/g, '_')}.md`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
