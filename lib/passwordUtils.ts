import * as crypto from 'crypto';

export interface PasswordStrength {
  score: number; // 0-4 (very weak to very strong)
  feedback: string[];
  isValid: boolean;
  requirements: {
    length: boolean;
    uppercase: boolean;
    lowercase: boolean;
    number: boolean;
    special: boolean;
  };
}

// Generate a secure random integer between 0 (inclusive) and max (exclusive)
function secureRandomInt(max: number): number {
  // crypto.randomInt is available in Node 14+, but for compatibility, use a fallback.
  if (typeof crypto.randomInt === 'function') {
    return crypto.randomInt(0, max);
  }
  // Fallback:
  if (max <= 0) throw new RangeError('max must be positive');
  const byteSize = Math.ceil(Math.log2(max) / 8);
  let rand: number;
  do {
    rand = parseInt(crypto.randomBytes(byteSize).toString('hex'), 16);
  } while (rand >= max);
  return rand;
}

export interface PasswordRequirements {
  minLength: number;
  requireUppercase: boolean;
  requireLowercase: boolean;
  requireNumber: boolean;
  requireSpecial: boolean;
}

const DEFAULT_REQUIREMENTS: PasswordRequirements = {
  minLength: 8,
  requireUppercase: true,
  requireLowercase: true,
  requireNumber: true,
  requireSpecial: false, // Optional for better UX
};

export function validatePasswordStrength(
  password: string,
  requirements: PasswordRequirements = DEFAULT_REQUIREMENTS
): PasswordStrength {
  const requirementsMet = {
    length: password.length >= requirements.minLength,
    uppercase: requirements.requireUppercase ? /[A-Z]/.test(password) : true,
    lowercase: requirements.requireLowercase ? /[a-z]/.test(password) : true,
    number: requirements.requireNumber ? /\d/.test(password) : true,
    special: requirements.requireSpecial ? /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password) : true,
  };

  const metCount = Object.values(requirementsMet).filter(Boolean).length;
  const totalRequirements = Object.keys(requirementsMet).length;

  // Calculate score based on requirements met and additional factors
  let score = metCount;
  if (password.length >= 12) score += 0.5; // Bonus for longer passwords
  if (/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) score += 0.5; // Bonus for special chars

  score = Math.min(4, Math.max(0, score));

  const feedback: string[] = [];

  if (!requirementsMet.length) {
    feedback.push(`Password must be at least ${requirements.minLength} characters long`);
  }
  if (!requirementsMet.uppercase) {
    feedback.push('Password must contain at least one uppercase letter');
  }
  if (!requirementsMet.lowercase) {
    feedback.push('Password must contain at least one lowercase letter');
  }
  if (!requirementsMet.number) {
    feedback.push('Password must contain at least one number');
  }
  if (requirements.requireSpecial && !requirementsMet.special) {
    feedback.push('Password must contain at least one special character');
  }

  // Additional feedback for better passwords
  if (score >= 3 && password.length < 12) {
    feedback.push('Consider using a longer password for better security');
  }

  return {
    score: Math.floor(score),
    feedback,
    isValid: metCount === totalRequirements,
    requirements: requirementsMet,
  };
}

export function getPasswordStrengthLabel(score: number): string {
  switch (score) {
    case 0: return 'Very Weak';
    case 1: return 'Weak';
    case 2: return 'Fair';
    case 3: return 'Good';
    case 4: return 'Strong';
    default: return 'Unknown';
  }
}

export function getPasswordStrengthColor(score: number): string {
  switch (score) {
    case 0: return 'text-red-500';
    case 1: return 'text-orange-500';
    case 2: return 'text-slate-400';
    case 3: return 'text-teal-400';
    case 4: return 'text-teal-500';
    default: return 'text-slate-500';
  }
}

export function generateSecurePassword(): string {
  const lowercase = 'abcdefghijklmnopqrstuvwxyz';
  const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const numbers = '0123456789';
  const symbols = '!@#$%^&*';

  let password = '';

  // Ensure at least one of each required type
  password += lowercase[secureRandomInt(lowercase.length)];
  password += uppercase[secureRandomInt(uppercase.length)];
  password += numbers[secureRandomInt(numbers.length)];
  password += symbols[secureRandomInt(symbols.length)];

  // Fill the rest randomly
  const allChars = lowercase + uppercase + numbers + symbols;
  for (let i = password.length; i < 12; i++) {
    password += allChars[secureRandomInt(allChars.length)];
  }

  // Securely shuffle the password
  return secureShuffle(password.split('')).join('');
}

// Fisher-Yates shuffle using secure random numbers
function secureShuffle<T>(array: T[]): T[] {
  for (let i = array.length - 1; i > 0; i--) {
    const j = secureRandomInt(i + 1);
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}