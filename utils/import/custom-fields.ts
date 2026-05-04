import type { BitwardenCustomField } from "./bitwarden-types";
import { BITWARDEN_FIELD_TYPES } from "./bitwarden-types";

export interface ProcessedCustomField {
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
    processedFields.map((field) => ({
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
    /confidential/i,
  ];

  return sensitivePatterns.some((pattern) => pattern.test(field.name));
}

export function extractFieldValue(
  fields: ProcessedCustomField[],
  fieldName: string,
): string | null {
  const field = fields.find(
    (f) => f.name.toLowerCase() === fieldName.toLowerCase(),
  );
  return field ? field.value : null;
}

export function getFieldsByType(
  fields: ProcessedCustomField[],
  type: "text" | "hidden" | "boolean" | "linked",
): ProcessedCustomField[] {
  return fields.filter((field) => field.type === type);
}

export function getSensitiveFields(
  fields: ProcessedCustomField[],
): ProcessedCustomField[] {
  return fields.filter((field) => field.sensitive);
}

export function getNonSensitiveFields(
  fields: ProcessedCustomField[],
): ProcessedCustomField[] {
  return fields.filter((field) => !field.sensitive);
}

// Common field name mappings for better organization
export const COMMON_FIELD_MAPPINGS = {
  // Security-related
  "Security Question": "security_question",
  "Security Answer": "security_answer",
  "Recovery Code": "recovery_code",
  "Backup Code": "backup_code",

  // Personal info
  "Phone Number": "phone",
  Mobile: "phone",
  Email: "email",
  Address: "address",

  // Financial
  "Account Number": "account_number",
  "Routing Number": "routing_number",
  "Card Number": "card_number",
  CVV: "cvv",
  Expiry: "expiry",

  // Common variations
  URL: "url",
  Website: "url",
  Server: "server",
  Host: "host",
} as const;

export function normalizeFieldName(name: string): string {
  // Check if it matches a common mapping
  const mapping =
    COMMON_FIELD_MAPPINGS[name as keyof typeof COMMON_FIELD_MAPPINGS];
  if (mapping) {
    return mapping;
  }

  // Otherwise, normalize the name
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");
}
