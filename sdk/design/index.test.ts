import { describe, expect, it } from 'vitest';
import { FAB_LAYOUT, KYLRIX_APP_TONES, KYLRIX_COLORS, TOPBAR_LAYOUT } from './index';

describe('design primitives', () => {
  it('exposes the expected brand colors', () => {
    expect(KYLRIX_COLORS.ecosystemPrimary).toBe('#6366F1');
    expect(KYLRIX_COLORS.background).toBe('#0A0908');
  });

  it('maps app tones correctly', () => {
    expect(KYLRIX_APP_TONES.note.secondary).toBe('#EC4899');
    expect(KYLRIX_APP_TONES.connect.secondary).toBe('#F59E0B');
  });

  it('keeps layout constants stable', () => {
    expect(TOPBAR_LAYOUT.height).toBe(88);
    expect(FAB_LAYOUT.size).toBe(56);
  });
});
