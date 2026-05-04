/**
 * Comprehensive input validation and sanitization
 * Prevents XSS, injection attacks, and data corruption
 */

/**
 * Email validation using RFC 5322 compliant regex
 */
export function validateEmail(email: string): { valid: boolean; error?: string } {
  if (!email || typeof email !== 'string') {
    return { valid: false, error: 'Email is required' };
  }

  const trimmed = email.trim();
  
  if (trimmed.length === 0) {
    return { valid: false, error: 'Email cannot be empty' };
  }

  if (trimmed.length > 254) {
    return { valid: false, error: 'Email is too long (max 254 characters)' };
  }

  // RFC 5322 compliant email regex
  const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

  if (!emailRegex.test(trimmed)) {
    return { valid: false, error: 'Invalid email format' };
  }

  return { valid: true };
}

/**
 * Password strength validation
 */
export function validatePassword(password: string): { valid: boolean; error?: string; strength?: 'weak' | 'medium' | 'strong' } {
  if (!password || typeof password !== 'string') {
    return { valid: false, error: 'Password is required' };
  }

  if (password.length < 12) {
    return { valid: false, error: 'Password must be at least 12 characters long' };
  }

  if (password.length > 128) {
    return { valid: false, error: 'Password is too long (max 128 characters)' };
  }

  // Check for complexity
  const hasUpperCase = /[A-Z]/.test(password);
  const hasLowerCase = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSpecial = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password);

  const complexityCount = [hasUpperCase, hasLowerCase, hasNumber, hasSpecial].filter(Boolean).length;

  if (complexityCount < 3) {
    return { 
      valid: false, 
      error: 'Password must contain at least 3 of: uppercase, lowercase, numbers, special characters',
      strength: 'weak'
    };
  }

  // Determine strength
  let strength: 'weak' | 'medium' | 'strong' = 'medium';
  if (password.length >= 16 && complexityCount === 4) {
    strength = 'strong';
  } else if (password.length < 14 || complexityCount < 4) {
    strength = 'medium';
  }

  return { valid: true, strength };
}

/**
 * Sanitize string input to prevent XSS
 */
export function sanitizeString(input: string, maxLength: number = 1000): string {
  if (!input || typeof input !== 'string') {
    return '';
  }

  // Remove any HTML tags
  let sanitized = input.replace(/<[^>]*>/g, '');
  
  // Remove potential script injection patterns
  sanitized = sanitized.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
  sanitized = sanitized.replace(/javascript:/gi, '');
  sanitized = sanitized.replace(/on\w+\s*=/gi, '');
  
  // Limit length
  if (sanitized.length > maxLength) {
    sanitized = sanitized.substring(0, maxLength);
  }

  return sanitized.trim();
}

/**
 * Validate and sanitize credential name
 */
export function validateCredentialName(name: string): { valid: boolean; error?: string; sanitized?: string } {
  if (!name || typeof name !== 'string') {
    return { valid: false, error: 'Name is required' };
  }

  const sanitized = sanitizeString(name, 100);

  if (sanitized.length === 0) {
    return { valid: false, error: 'Name cannot be empty' };
  }

  if (sanitized.length < 1) {
    return { valid: false, error: 'Name must be at least 1 character' };
  }

  return { valid: true, sanitized };
}

/**
 * Validate and sanitize URL
 */
export function validateUrl(url: string): { valid: boolean; error?: string; sanitized?: string } {
  if (!url || typeof url !== 'string') {
    return { valid: false, error: 'URL is required' };
  }

  const trimmed = url.trim();

  if (trimmed.length === 0) {
    return { valid: false, error: 'URL cannot be empty' };
  }

  if (trimmed.length > 2048) {
    return { valid: false, error: 'URL is too long (max 2048 characters)' };
  }

  try {
    // Validate URL format
    const urlObj = new URL(trimmed);
    
    // Only allow http and https protocols
    if (!['http:', 'https:'].includes(urlObj.protocol)) {
      return { valid: false, error: 'URL must use http or https protocol' };
    }

    // Prevent javascript: and data: URLs
    if (urlObj.protocol === 'javascript:' || urlObj.protocol === 'data:') {
      return { valid: false, error: 'Invalid URL protocol' };
    }

    return { valid: true, sanitized: urlObj.toString() };
  } catch {
    return { valid: false, error: 'Invalid URL format' };
  }
}

/**
 * Validate notes/description field
 */
export function validateNotes(notes: string): { valid: boolean; error?: string; sanitized?: string } {
  if (!notes || typeof notes !== 'string') {
    return { valid: true, sanitized: '' }; // Notes are optional
  }

  const sanitized = sanitizeString(notes, 10000);

  if (sanitized.length > 10000) {
    return { valid: false, error: 'Notes are too long (max 10000 characters)' };
  }

  return { valid: true, sanitized };
}

/**
 * Validate username field
 */
export function validateUsername(username: string): { valid: boolean; error?: string; sanitized?: string } {
  if (!username || typeof username !== 'string') {
    return { valid: false, error: 'Username is required' };
  }

  const sanitized = sanitizeString(username, 255);

  if (sanitized.length === 0) {
    return { valid: false, error: 'Username cannot be empty' };
  }

  if (sanitized.length > 255) {
    return { valid: false, error: 'Username is too long (max 255 characters)' };
  }

  return { valid: true, sanitized };
}

/**
 * Validate folder name
 */
export function validateFolderName(name: string): { valid: boolean; error?: string; sanitized?: string } {
  if (!name || typeof name !== 'string') {
    return { valid: false, error: 'Folder name is required' };
  }

  const sanitized = sanitizeString(name, 100);

  if (sanitized.length === 0) {
    return { valid: false, error: 'Folder name cannot be empty' };
  }

  if (sanitized.length > 100) {
    return { valid: false, error: 'Folder name is too long (max 100 characters)' };
  }

  // Prevent path traversal attempts
  if (sanitized.includes('..') || sanitized.includes('/') || sanitized.includes('\\')) {
    return { valid: false, error: 'Folder name contains invalid characters' };
  }

  return { valid: true, sanitized };
}

/**
 * Validate TOTP issuer
 */
export function validateTotpIssuer(issuer: string): { valid: boolean; error?: string; sanitized?: string } {
  if (!issuer || typeof issuer !== 'string') {
    return { valid: false, error: 'Issuer is required' };
  }

  const sanitized = sanitizeString(issuer, 100);

  if (sanitized.length === 0) {
    return { valid: false, error: 'Issuer cannot be empty' };
  }

  return { valid: true, sanitized };
}

/**
 * Validate TOTP account name
 */
export function validateTotpAccountName(accountName: string): { valid: boolean; error?: string; sanitized?: string } {
  if (!accountName || typeof accountName !== 'string') {
    return { valid: false, error: 'Account name is required' };
  }

  const sanitized = sanitizeString(accountName, 100);

  if (sanitized.length === 0) {
    return { valid: false, error: 'Account name cannot be empty' };
  }

  return { valid: true, sanitized };
}

/**
 * Validate and sanitize generic string input
 */
export function validateString(
  value: string,
  fieldName: string,
  options: {
    required?: boolean;
    minLength?: number;
    maxLength?: number;
    pattern?: RegExp;
  } = {}
): { valid: boolean; error?: string; sanitized?: string } {
  const { required = false, minLength = 0, maxLength = 1000, pattern } = options;

  if (!value || typeof value !== 'string') {
    if (required) {
      return { valid: false, error: `${fieldName} is required` };
    }
    return { valid: true, sanitized: '' };
  }

  const sanitized = sanitizeString(value, maxLength);

  if (required && sanitized.length === 0) {
    return { valid: false, error: `${fieldName} cannot be empty` };
  }

  if (sanitized.length < minLength) {
    return { valid: false, error: `${fieldName} must be at least ${minLength} characters` };
  }

  if (sanitized.length > maxLength) {
    return { valid: false, error: `${fieldName} is too long (max ${maxLength} characters)` };
  }

  if (pattern && !pattern.test(sanitized)) {
    return { valid: false, error: `${fieldName} format is invalid` };
  }

  return { valid: true, sanitized };
}

/**
 * Validate OTP code
 */
export function validateOtpCode(code: string): { valid: boolean; error?: string } {
  if (!code || typeof code !== 'string') {
    return { valid: false, error: 'OTP code is required' };
  }

  const trimmed = code.trim();

  // OTP codes are typically 6 digits
  if (!/^\d{6}$/.test(trimmed)) {
    return { valid: false, error: 'OTP code must be 6 digits' };
  }

  return { valid: true };
}

/**
 * Prevent common security vulnerabilities in custom fields
 */
export function validateCustomFields(customFields: string): { valid: boolean; error?: string; sanitized?: string } {
  if (!customFields || typeof customFields !== 'string') {
    return { valid: true, sanitized: '' };
  }

  try {
    // Parse JSON to validate structure
    const parsed = JSON.parse(customFields);

    // Ensure it's an object or array
    if (typeof parsed !== 'object') {
      return { valid: false, error: 'Custom fields must be valid JSON' };
    }

    // Sanitize each value in the custom fields
    const sanitized = JSON.stringify(parsed);

    if (sanitized.length > 50000) {
      return { valid: false, error: 'Custom fields are too large (max 50KB)' };
    }

    return { valid: true, sanitized };
  } catch {
    return { valid: false, error: 'Custom fields must be valid JSON' };
  }
}
