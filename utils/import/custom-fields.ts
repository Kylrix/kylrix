import type { BitwardenCustomField } from "./bitwarden-types";
import { BITWARDEN_FIELD_TYPES } from "./bitwarden-types";

interface ProcessedCustomField {
  name: string;
  value: string;
  type: "text" | "hidden" | "boolean" | "linked";
  sensitive: boolean;
}

export interface CustomFieldsResult {
  fields: ProcessedCustomField[];
  serialized: string;
  hasSecureFields: boolean;
}

export function processCustomFields(
  fields: BitwardenCustomField[] | null,
): CustomFieldsResult {
  if (!fields || fields.length === 0) {
    return {
      fields: [],
      serialized: "",
      hasSecureFields: false,
    };
  }

  const processedFields: ProcessedCustomField[] = [];
  let hasSecureFields = false;

  fields.forEach((field) => {
    const processedField: ProcessedCustomField = {
      name: field.name,
      value: field.value,
      type: mapFieldType(field.type),
      sensitive: isSensitiveField(field),
    };

    if (processedField.sensitive) {
      hasSecureFields = true;
    }

    processedFields.push(processedField);
  });

  // Create a serialized version for storage
  const serialized = JSON.stringify(
    processedFields.map((field: any) => ({
      name: field.name,
      value: field.value,
      type: field.type,
      sensitive: field.sensitive,
    })),
  );

  return {
    fields: processedFields,
    serialized,
    hasSecureFields,
  };
}

function mapFieldType(
  bitwardenType: number,
): "text" | "hidden" | "boolean" | "linked" {
  switch (bitwardenType) {
    case BITWARDEN_FIELD_TYPES.TEXT:
      return "text";
    case BITWARDEN_FIELD_TYPES.HIDDEN:
      return "hidden";
    case BITWARDEN_FIELD_TYPES.BOOLEAN:
      return "boolean";
    case BITWARDEN_FIELD_TYPES.LINKED:
      return "linked";
    default:
      return "text";
  }
}

function isSensitiveField(field: BitwardenCustomField): boolean {
  // Consider hidden fields as sensitive
  if (field.type === BITWARDEN_FIELD_TYPES.HIDDEN) {
    return true;
  }

  // Check field name patterns that suggest sensitive data
  const sensitivePatterns = [
    /password/i,
    /secret/i,
    /key/i,
    /token/i,
    /pin/i,
    /code/i,
    /ssn/i,
    /security/i,
    /private/i,
    /confidential/i];

  return sensitivePatterns.some((pattern) => pattern.test(field.name));
}





// Common field name mappings for better organization

