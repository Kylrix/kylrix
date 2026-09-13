import { describe, it, expect } from 'vitest';

describe('Form Assist & Schema Utilities', () => {
  it('parses form assist generated JSON response correctly', () => {
    const rawJsonResponse = `\`\`\`json
{
  "title": "Developer Feedback Form",
  "description": "Gather feedback from open source contributors",
  "fields": [
    { "id": "f1", "label": "Developer Name", "type": "text", "required": true },
    { "id": "f2", "label": "Email Address", "type": "email", "required": true },
    { "id": "f3", "label": "Satisfaction Rating", "type": "radio", "required": true, "options": ["High", "Medium", "Low"] }
  ]
}
\`\`\``;

    const cleaned = rawJsonResponse.replace(/```json/g, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(cleaned);

    expect(parsed.title).toBe('Developer Feedback Form');
    expect(parsed.description).toBe('Gather feedback from open source contributors');
    expect(parsed.fields).toHaveLength(3);
    expect(parsed.fields[0].type).toBe('text');
    expect(parsed.fields[2].options).toEqual(['High', 'Medium', 'Low']);
  });

  it('validates logic branching dependencies when reordering fields', () => {
    const fields = [
      { id: 'f1', label: 'Preferred Contact Method', type: 'radio', options: ['Email', 'Phone'] },
      { id: 'f2', label: 'Phone Number', type: 'text', logic: { enabled: true, showIfFieldId: 'f1', showIfValue: 'Phone' } },
    ];

    // Helper to validate field logic dependencies
    const validateFieldsLogic = (currentFields: typeof fields) => {
      return currentFields.map((field, idx) => {
        if (field.logic?.enabled && field.logic.showIfFieldId) {
          const parentIdx = currentFields.findIndex((f) => f.id === field.logic.showIfFieldId);
          if (parentIdx === -1 || parentIdx >= idx) {
            return {
              ...field,
              logic: {
                ...field.logic,
                enabled: false,
                showIfFieldId: '',
                showIfValue: '',
              },
            };
          }
        }
        return field;
      });
    };

    // Before reorder: f1 is index 0, f2 is index 1. Logic remains valid.
    const validatedBefore = validateFieldsLogic(fields);
    expect(validatedBefore[1].logic.enabled).toBe(true);

    // After reorder: f2 moved above f1. Parent f1 is now at index 1, which is >= f2 index 0. Logic should be disabled.
    const reordered = [fields[1], fields[0]];
    const validatedAfter = validateFieldsLogic(reordered);
    expect(validatedAfter[0].logic.enabled).toBe(false);
  });
});
