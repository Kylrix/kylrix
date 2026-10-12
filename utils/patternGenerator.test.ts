import { describe, it, expect } from 'vitest';
import { generateEventPattern } from './patternGenerator';

describe('patternGenerator', () => {
  it('generates deterministic gradient patterns for a seed string', () => {
    const pattern1 = generateEventPattern('event-123');
    const pattern2 = generateEventPattern('event-123');
    expect(pattern1).toBe(pattern2);
    expect(pattern1).toContain('gradient');
  });

  it('generates different patterns for different seed strings', () => {
    const patternA = generateEventPattern('seed-A');
    const patternB = generateEventPattern('seed-B');
    expect(patternA).toBeDefined();
    expect(patternB).toBeDefined();
  });
});
