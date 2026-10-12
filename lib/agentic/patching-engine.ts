/**
 * Intelligent Object Patching Engine for Kylrix
 * Enables surgical, non-destructive updates to Notes, Forms, Goals, and structural objects.
 */

export interface TextPatch {
  /** Text snippet before the target range (can include '...' or '…') */
  before?: string;
  /** Text snippet after the target range (can include '...' or '…') */
  after?: string;
  /** Optional exact target segment to replace between before and after */
  target?: string;
  /** The replacement text to insert */
  replacement: string;
}

export interface FormField {
  id: string;
  label: string;
  type: string;
  required?: boolean;
  options?: string[];
  logic?: any;
  [key: string]: any;
}

export interface FormFieldPatch {
  action: 'add' | 'update' | 'remove' | 'reorder';
  fieldId?: string;
  field?: Partial<FormField>;
  afterFieldId?: string;
  order?: string[];
}

/** Clean ellipsis markers from before/after anchors */
function cleanAnchor(anchor?: string): string {
  if (!anchor) return '';
  return anchor
    .replace(/^(\.\.\.|…)\s*/, '')
    .replace(/\s*(\.\.\.|…)$/, '');
}

/**
 * Apply surgical text/markdown patches to a document string using before/after context anchors.
 */
export function applyTextPatch(
  originalText: string,
  patches: TextPatch[]
): { success: boolean; text: string; appliedCount: number; errors: string[] } {
  if (!Array.isArray(patches) || patches.length === 0) {
    return { success: true, text: originalText, appliedCount: 0, errors: [] };
  }

  let currentText = originalText;
  let appliedCount = 0;
  const errors: string[] = [];

  for (let i = 0; i < patches.length; i++) {
    const patch = patches[i];
    const beforeAnchor = cleanAnchor(patch.before);
    const afterAnchor = cleanAnchor(patch.after);
    const replacement = patch.replacement ?? '';

    // Case 1: Append to end of document (no before or explicit append indicator, no after)
    if (!beforeAnchor && !afterAnchor && !patch.target) {
      currentText = currentText ? `${currentText}\n${replacement}` : replacement;
      appliedCount++;
      continue;
    }

    // Case 2: Exact target replacement without context anchors
    if (!beforeAnchor && !afterAnchor && patch.target) {
      if (currentText.includes(patch.target)) {
        currentText = currentText.replace(patch.target, replacement);
        appliedCount++;
      } else {
        errors.push(`Patch ${i + 1}: Exact target text not found.`);
      }
      continue;
    }

    // Case 3: Both before and after anchors provided
    if (beforeAnchor && afterAnchor) {
      const beforeIndices: number[] = [];
      let pos = currentText.indexOf(beforeAnchor);
      while (pos !== -1) {
        beforeIndices.push(pos);
        pos = currentText.indexOf(beforeAnchor, pos + 1);
      }

      if (beforeIndices.length === 0) {
        // Try fallback: ignore spaces/case or match partial
        const flexBefore = beforeAnchor.trim();
        const flexIdx = currentText.toLowerCase().indexOf(flexBefore.toLowerCase());
        if (flexIdx !== -1) {
          beforeIndices.push(flexIdx);
        }
      }

      if (beforeIndices.length === 0) {
        errors.push(`Patch ${i + 1}: 'before' anchor ("${beforeAnchor.slice(0, 30)}") not found.`);
        continue;
      }

      // Find the best match where afterAnchor occurs following beforeAnchor
      let bestMatch: { start: number; end: number } | null = null;

      for (const bIdx of beforeIndices) {
        const contentStart = bIdx + beforeAnchor.length;
        const aIdx = currentText.indexOf(afterAnchor, contentStart);
        if (aIdx !== -1) {
          // Found match
          bestMatch = { start: contentStart, end: aIdx };
          break;
        }
      }

      if (bestMatch) {
        currentText =
          currentText.slice(0, bestMatch.start) +
          replacement +
          currentText.slice(bestMatch.end);
        appliedCount++;
      } else {
        errors.push(`Patch ${i + 1}: 'after' anchor ("${afterAnchor.slice(0, 30)}") not found following 'before' anchor.`);
      }
      continue;
    }

    // Case 4: Only 'before' anchor provided (replace after beforeAnchor or append after beforeAnchor)
    if (beforeAnchor && !afterAnchor) {
      const bIdx = currentText.indexOf(beforeAnchor);
      if (bIdx !== -1) {
        const contentStart = bIdx + beforeAnchor.length;
        if (patch.target && currentText.slice(contentStart).includes(patch.target)) {
          const tIdx = currentText.indexOf(patch.target, contentStart);
          currentText =
            currentText.slice(0, tIdx) +
            replacement +
            currentText.slice(tIdx + patch.target.length);
        } else {
          // Replace to end or insert right after beforeAnchor
          currentText = currentText.slice(0, contentStart) + replacement;
        }
        appliedCount++;
      } else {
        errors.push(`Patch ${i + 1}: 'before' anchor ("${beforeAnchor.slice(0, 30)}") not found.`);
      }
      continue;
    }

    // Case 5: Only 'after' anchor provided
    if (!beforeAnchor && afterAnchor) {
      const aIdx = currentText.indexOf(afterAnchor);
      if (aIdx !== -1) {
        if (patch.target && currentText.slice(0, aIdx).lastIndexOf(patch.target) !== -1) {
          const tIdx = currentText.slice(0, aIdx).lastIndexOf(patch.target);
          currentText =
            currentText.slice(0, tIdx) +
            replacement +
            currentText.slice(tIdx + patch.target.length);
        } else {
          // Replace document up to afterAnchor with replacement
          currentText = replacement + currentText.slice(aIdx);
        }
        appliedCount++;
      } else {
        errors.push(`Patch ${i + 1}: 'after' anchor ("${afterAnchor.slice(0, 30)}") not found.`);
      }
      continue;
    }
  }

  return {
    success: errors.length === 0,
    text: currentText,
    appliedCount,
    errors,
  };
}

/**
 * Apply structural patches to a Form schema (array of ordered field objects).
 */
export function applyFormPatch(
  rawSchema: FormField[] | string,
  patches: FormFieldPatch[]
): { success: boolean; fields: FormField[]; schemaJson: string; appliedCount: number; errors: string[] } {
  let fields: FormField[] = [];
  try {
    fields = typeof rawSchema === 'string' ? JSON.parse(rawSchema || '[]') : [...rawSchema];
  } catch {
    fields = [];
  }

  if (!Array.isArray(patches) || patches.length === 0) {
    return { success: true, fields, schemaJson: JSON.stringify(fields), appliedCount: 0, errors: [] };
  }

  let appliedCount = 0;
  const errors: string[] = [];

  for (let i = 0; i < patches.length; i++) {
    const patch = patches[i];

    if (patch.action === 'add') {
      const newField: FormField = {
        id: patch.field?.id || `field_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        label: patch.field?.label || 'New Question',
        type: patch.field?.type || 'text',
        required: Boolean(patch.field?.required),
        options: patch.field?.options || (['select', 'radio', 'checkbox'].includes(patch.field?.type || '') ? ['Option 1'] : undefined),
        ...patch.field,
      };

      if (patch.afterFieldId) {
        const targetIdx = fields.findIndex((f) => f.id === patch.afterFieldId);
        if (targetIdx !== -1) {
          fields.splice(targetIdx + 1, 0, newField);
        } else {
          fields.push(newField);
        }
      } else {
        fields.push(newField);
      }
      appliedCount++;
      continue;
    }

    if (patch.action === 'update' && patch.fieldId) {
      const targetIdx = fields.findIndex((f) => f.id === patch.fieldId);
      if (targetIdx !== -1) {
        fields[targetIdx] = { ...fields[targetIdx], ...(patch.field || {}) };
        appliedCount++;
      } else {
        errors.push(`FormPatch ${i + 1}: Field ID '${patch.fieldId}' not found.`);
      }
      continue;
    }

    if (patch.action === 'remove' && patch.fieldId) {
      const targetIdx = fields.findIndex((f) => f.id === patch.fieldId);
      if (targetIdx !== -1) {
        fields.splice(targetIdx, 1);
        appliedCount++;
      } else {
        errors.push(`FormPatch ${i + 1}: Field ID '${patch.fieldId}' not found.`);
      }
      continue;
    }

    if (patch.action === 'reorder' && Array.isArray(patch.order)) {
      const map = new Map(fields.map((f) => [f.id, f]));
      const nextFields: FormField[] = [];
      for (const id of patch.order) {
        const f = map.get(id);
        if (f) {
          nextFields.push(f);
          map.delete(id);
        }
      }
      // append remaining fields not specified in order
      for (const f of map.values()) {
        nextFields.push(f);
      }
      fields = nextFields;
      appliedCount++;
      continue;
    }
  }

  return {
    success: errors.length === 0,
    fields,
    schemaJson: JSON.stringify(fields),
    appliedCount,
    errors,
  };
}

/**
 * Apply structural field patches to arbitrary objects (Goal, Event, Project, Task, etc.).
 */
export function applyStructuralPatch<T extends Record<string, any>>(
  targetObject: T,
  patch: Partial<T>
): T {
  if (!patch || typeof patch !== 'object') return targetObject;

  const result = { ...targetObject };
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) continue;
    if (
      typeof value === 'object' &&
      value !== null &&
      !Array.isArray(value) &&
      typeof result[key] === 'object' &&
      result[key] !== null
    ) {
      result[key as keyof T] = { ...result[key], ...value };
    } else {
      result[key as keyof T] = value;
    }
  }
  return result;
}
