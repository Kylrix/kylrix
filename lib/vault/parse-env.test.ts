import { describe, it, expect } from 'vitest';
import { extractRecoveryCodes } from './parse-env';

describe('extractRecoveryCodes', () => {
  it('returns empty array for empty or non-string inputs', () => {
    expect(extractRecoveryCodes('')).toEqual([]);
    expect(extractRecoveryCodes(null)).toEqual([]);
    expect(extractRecoveryCodes(undefined)).toEqual([]);
  });

  it('extracts single recovery code in abcd-efgh format', () => {
    expect(extractRecoveryCodes('abcd-efgh')).toEqual(['abcd-efgh']);
    expect(extractRecoveryCodes('1234-5678')).toEqual(['1234-5678']);
    expect(extractRecoveryCodes('ABCD-EFGH-IJKL')).toEqual(['ABCD-EFGH-IJKL']);
  });

  it('extracts multiple recovery codes separated by spaces, newlines, or commas', () => {
    const inputSpace = 'abcd-efgh ijkl-mnop qrst-uvwx';
    expect(extractRecoveryCodes(inputSpace)).toEqual(['abcd-efgh', 'ijkl-mnop', 'qrst-uvwx']);

    const inputNewline = 'abcd-efgh\nijkl-mnop\nqrst-uvwx';
    expect(extractRecoveryCodes(inputNewline)).toEqual(['abcd-efgh', 'ijkl-mnop', 'qrst-uvwx']);

    const inputComma = 'abcd-efgh, ijkl-mnop, qrst-uvwx';
    expect(extractRecoveryCodes(inputComma)).toEqual(['abcd-efgh', 'ijkl-mnop', 'qrst-uvwx']);

    const inputNumbered = '1. abcd-efgh\n2. ijkl-mnop\n3) qrst-uvwx';
    expect(extractRecoveryCodes(inputNumbered)).toEqual(['abcd-efgh', 'ijkl-mnop', 'qrst-uvwx']);
  });

  it('returns empty array when input contains non-recovery-code tokens', () => {
    expect(extractRecoveryCodes('hello world')).toEqual([]);
    expect(extractRecoveryCodes('abcd-efgh regular_text')).toEqual([]);
    expect(extractRecoveryCodes('DATABASE_URL=postgres://localhost')).toEqual([]);
  });
});
