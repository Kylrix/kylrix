import { describe, it, expect } from 'vitest';
import { unwrapThreadJsonContent } from './thread-json';

describe('unwrapThreadJsonContent', () => {
  it('returns plain text unchanged', () => {
    expect(unwrapThreadJsonContent('Hello world')).toBe('Hello world');
    expect(unwrapThreadJsonContent('Simple message')).toBe('Simple message');
  });

  it('unwraps JSON thread wrappers with text property', () => {
    const json = JSON.stringify({
      text: 'Hello from thread',
      type: 'text',
      sendToGeneral: true,
    });
    expect(unwrapThreadJsonContent(json)).toBe('Hello from thread');
  });

  it('unwraps JSON thread wrappers with content property', () => {
    const json = JSON.stringify({
      content: 'Message inside content field',
      type: 'text',
    });
    expect(unwrapThreadJsonContent(json)).toBe('Message inside content field');
  });

  it('unwraps JSON thread wrappers with message or body property', () => {
    expect(unwrapThreadJsonContent(JSON.stringify({ message: 'Msg text' }))).toBe('Msg text');
    expect(unwrapThreadJsonContent(JSON.stringify({ body: 'Body text' }))).toBe('Body text');
  });

  it('handles double-nested JSON thread wrappers', () => {
    const inner = JSON.stringify({ text: 'Nested message' });
    const outer = JSON.stringify({ text: inner });
    expect(unwrapThreadJsonContent(outer)).toBe('Nested message');
  });

  it('preserves encrypted ciphertext payloads without unwrapping', () => {
    const encIv = JSON.stringify({ iv: 'abc123', ct: 'xyz789' });
    const encData = JSON.stringify({ data: 'encrypted_data' });
    const encCt = JSON.stringify({ ct: 'ciphertext_content' });
    const encCiphertext = JSON.stringify({ ciphertext: 'secret' });
    const encMarker = '[DECRYPTION_FAILED]';

    expect(unwrapThreadJsonContent(encIv)).toBe(encIv);
    expect(unwrapThreadJsonContent(encData)).toBe(encData);
    expect(unwrapThreadJsonContent(encCt)).toBe(encCt);
    expect(unwrapThreadJsonContent(encCiphertext)).toBe(encCiphertext);
    expect(unwrapThreadJsonContent(encMarker)).toBe(encMarker);
  });

  it('handles empty or non-string inputs safely', () => {
    expect(unwrapThreadJsonContent(null)).toBe('');
    expect(unwrapThreadJsonContent(undefined)).toBe('');
    expect(unwrapThreadJsonContent('')).toBe('');
    expect(unwrapThreadJsonContent(123)).toBe('123');
  });

  it('returns original JSON string if no recognized text fields exist', () => {
    const json = JSON.stringify({ foo: 'bar', baz: 123 });
    expect(unwrapThreadJsonContent(json)).toBe(json);
  });
});
