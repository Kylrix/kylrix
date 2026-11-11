import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

describe('GoalObjectRow Accessibility and Focus Visible Rings', () => {
  const filePath = path.resolve(process.cwd(), 'components/tasks/GoalObjectRow.tsx');
  const content = fs.readFileSync(filePath, 'utf-8');

  it('provides accessible focus visible ring and offset on completion checkbox button', () => {
    expect(content).toContain(
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A855F7] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0A0908]',
    );
    expect(content).toContain("aria-label={task.status === 'done' ? 'Mark incomplete' : 'Mark complete'}");
  });

  it('provides accessible focus visible ring and ARIA label on Sidekick launcher button', () => {
    expect(content).toContain('aria-label="Sidekick Assist"');
    expect(content).toContain('focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A855F7]');
  });
});
