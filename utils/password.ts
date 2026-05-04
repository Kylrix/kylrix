export type PasswordStrength = "alphanumeric" | "strong";

const CHARSETS: Record<PasswordStrength, string> = {
  alphanumeric:
    "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789",
  strong:
    "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()-_=+[]{};:,.<>?",
};

export interface GeneratePasswordOptions {
  strength?: PasswordStrength;
  charset?: string;
}

/**
 * Generate a cryptographically strong random password.
 * @param length Password length (default: 16, min: 12, max: 128)
 * @param optionsOrCharset Options for password generation or a custom charset string.
 * @throws Error if Web Crypto API is not available
 */
export function generateRandomPassword(
  length = 16,
  optionsOrCharset: GeneratePasswordOptions | string = {}
): string {
  // Validate length
  if (length < 12) {
    throw new Error("Password length must be at least 12 characters");
  }
  if (length > 128) {
    throw new Error("Password length cannot exceed 128 characters");
  }

  let options: GeneratePasswordOptions;
  if (typeof optionsOrCharset === 'string') {
    options = { charset: optionsOrCharset };
  } else {
    options = optionsOrCharset;
  }

  const { strength = "strong", charset } = options;
  const chars = charset || CHARSETS[strength];
  
  // Check if Web Crypto API is available
  if (typeof window === "undefined" || !window.crypto || !window.crypto.getRandomValues) {
    throw new Error("Web Crypto API is not available. Secure password generation requires a modern browser.");
  }

  // Use cryptographically secure random values with rejection sampling to avoid modulo bias
  let password = "";
  const charCount = chars.length;
  // 2^32 is the number of possible values for a 32-bit unsigned integer
  const zone = Math.floor((2**32) / charCount) * charCount;

  while (password.length < length) {
    const array = new Uint32Array(1);
    window.crypto.getRandomValues(array);
    const randomNumber = array[0];

    if (randomNumber < zone) {
      password += chars[randomNumber % charCount];
    }
  }

  return password;
}
