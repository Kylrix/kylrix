import { describe, it, expect } from 'vitest';
import { applyTextPatch, applyFormPatch, applyStructuralPatch } from './patching-engine';

describe('Intelligent Object Patching Engine', () => {
  describe('applyTextPatch', () => {
    it('should append text when no anchors are provided', () => {
      const doc = 'Hello world';
      const result = applyTextPatch(doc, [
        { replacement: 'This is a new line.' },
      ]);
      expect(result.success).toBe(true);
      expect(result.text).toBe('Hello world\nThis is a new line.');
    });

    it('should surgically patch text between before and after anchors', () => {
      const doc = 'The quick brown fox jumps over the lazy dog.';
      const result = applyTextPatch(doc, [
        {
          before: 'quick brown ',
          after: ' jumps over',
          replacement: 'cat',
        },
      ]);
      expect(result.success).toBe(true);
      expect(result.text).toBe('The quick brown cat jumps over the lazy dog.');
    });

    it('should clean ellipsis markers in before and after anchors', () => {
      const doc = 'Heading 1\nSome initial content here.\nHeading 2';
      const result = applyTextPatch(doc, [
        {
          before: '...initial content...',
          after: '...Heading 2',
          replacement: ' updated content.\n',
        },
      ]);
      expect(result.success).toBe(true);
      expect(result.text).toBe('Heading 1\nSome initial content updated content.\nHeading 2');
    });

    it('should replace exact target text when provided', () => {
      const doc = 'Status: DRAFT and active';
      const result = applyTextPatch(doc, [
        {
          target: 'DRAFT',
          replacement: 'PUBLISHED',
        },
      ]);
      expect(result.success).toBe(true);
      expect(result.text).toBe('Status: PUBLISHED and active');
    });

    it('should handle missing anchors gracefully and report errors', () => {
      const doc = 'Simple document';
      const result = applyTextPatch(doc, [
        {
          before: 'nonexistent anchor',
          after: 'something',
          replacement: 'replacement',
        },
      ]);
      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.text).toBe('Simple document');
    });
  });

  describe('applyFormPatch', () => {
    const initialSchema = [
      { id: 'field_1', label: 'First Name', type: 'text', required: true },
      { id: 'field_2', label: 'Email', type: 'email', required: true },
    ];

    it('should add a new field to form schema', () => {
      const result = applyFormPatch(initialSchema, [
        {
          action: 'add',
          field: { id: 'field_3', label: 'Phone', type: 'text' },
        },
      ]);
      expect(result.success).toBe(true);
      expect(result.fields.length).toBe(3);
      expect(result.fields[2].label).toBe('Phone');
    });

    it('should update an existing field in form schema', () => {
      const result = applyFormPatch(initialSchema, [
        {
          action: 'update',
          fieldId: 'field_1',
          field: { label: 'Full Legal Name' },
        },
      ]);
      expect(result.success).toBe(true);
      expect(result.fields[0].label).toBe('Full Legal Name');
    });

    it('should remove a field from form schema', () => {
      const result = applyFormPatch(initialSchema, [
        {
          action: 'remove',
          fieldId: 'field_2',
        },
      ]);
      expect(result.success).toBe(true);
      expect(result.fields.length).toBe(1);
      expect(result.fields[0].id).toBe('field_1');
    });

    it('should reorder fields in form schema', () => {
      const result = applyFormPatch(initialSchema, [
        {
          action: 'reorder',
          order: ['field_2', 'field_1'],
        },
      ]);
      expect(result.success).toBe(true);
      expect(result.fields[0].id).toBe('field_2');
      expect(result.fields[1].id).toBe('field_1');
    });
  });

  describe('applyStructuralPatch', () => {
    it('should perform shallow/deep structural property merging', () => {
      const goal = { id: 'goal_1', title: 'Old Title', status: 'pending', meta: { priority: 'low' } };
      const patched = applyStructuralPatch(goal, { title: 'New Title', meta: { priority: 'high' } });
      expect(patched.title).toBe('New Title');
      expect(patched.status).toBe('pending');
      expect(patched.meta.priority).toBe('high');
    });
  });
});
