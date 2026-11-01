import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

describe('EventList Accessibility and Empty State', () => {
  const filePath = path.resolve(process.cwd(), 'components/events/EventList.tsx');
  const content = fs.readFileSync(filePath, 'utf-8');

  it('renders role="tablist" and aria-label on filter tabs', () => {
    expect(content).toContain('role="tablist"');
    expect(content).toContain('aria-label="Filter events"');
    expect(content).toContain('role="tab"');
    expect(content).toContain('aria-selected={isActive}');
  });

  it('includes focus-visible accessibility styling on interactive buttons', () => {
    expect(content).toContain('focus-visible:ring-2 focus-visible:ring-[#6366F1]');
  });

  it('includes a helpful empty state with Schedule an Event call-to-action', () => {
    expect(content).toContain('visibleEventsAll.length === 0');
    expect(content).toContain('Schedule an Event');
    expect(content).toContain('No upcoming events');
    expect(content).toContain('No past events');
  });
});
