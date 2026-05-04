import { generateRandomPassword, PasswordStrength } from "./password";

describe("generateRandomPassword", () => {
  it("should generate a password of the specified length", () => {
    const length = 20;
    const password = generateRandomPassword(length);
    expect(password.length).toBe(length);
  });

  it("should use the strong charset by default", () => {
    const password = generateRandomPassword();
    const strongCharset =
      "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()-_=+[]{};:,.<>?";
    for (const char of password) {
      expect(strongCharset).toContain(char);
    }
  });

  it("should use the alphanumeric charset when specified", () => {
    const password = generateRandomPassword(16, { strength: "alphanumeric" });
    const alphanumericCharset =
      "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    for (const char of password) {
      expect(alphanumericCharset).toContain(char);
    }
  });

  it("should use a custom charset when provided as an option", () => {
    const customCharset = "abc";
    const password = generateRandomPassword(16, { charset: customCharset });
    for (const char of password) {
      expect(customCharset).toContain(char);
    }
  });

  it("should maintain backward compatibility with a custom charset string", () => {
    const customCharset = "xyz";
    const password = generateRandomPassword(16, customCharset);
    for (const char of password) {
      expect(customCharset).toContain(char);
    }
  });

  it("should throw an error for lengths less than 12", () => {
    expect(() => generateRandomPassword(11)).toThrow(
      "Password length must be at least 12 characters"
    );
  });

  it("should throw an error for lengths greater than 128", () => {
    expect(() => generateRandomPassword(129)).toThrow(
      "Password length cannot exceed 128 characters"
    );
  });

  // Test to ensure there is no modulo bias.
  // This test is probabilistic and may not be 100% reliable,
  // but it can help detect major issues.
  it("should have a uniform distribution of characters", () => {
    const charset = "ab";
    const passwordLength = 128;
    const password = generateRandomPassword(passwordLength, { charset });

    const counts: { [key: string]: number } = {};
    for (const char of password) {
      counts[char] = (counts[char] || 0) + 1;
    }

    const expectedCount = passwordLength / charset.length;
    const tolerance = expectedCount * 0.2; // 20% tolerance

    for (const char of charset) {
      expect(counts[char]).toBeCloseTo(expectedCount, -1);
      expect(Math.abs(counts[char] - expectedCount)).toBeLessThan(tolerance);
    }
  });
});
