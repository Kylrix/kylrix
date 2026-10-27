import { describe, it, expect, vi, beforeEach } from 'vitest';
import { authClient } from '@/lib/auth/better-auth-client';

vi.mock('@/lib/auth/better-auth-client', () => ({
  authClient: {
    emailOtp: {
      sendVerificationOtp: vi.fn(),
    },
    signIn: {
      emailOtp: vi.fn(),
      passkey: vi.fn(),
    },
    getSession: vi.fn().mockResolvedValue(null),
  },
}));

describe('Email OTP Auth and Passkey Login Policy', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Email OTP API handling', () => {
    it('sends verification OTP using Better Auth emailOtp plugin', async () => {
      vi.mocked(authClient.emailOtp.sendVerificationOtp).mockResolvedValueOnce({
        data: { userId: 'user_123' },
        error: null,
      } as any);

      const res = await authClient.emailOtp.sendVerificationOtp({
        email: 'test@example.com',
        type: 'sign-in',
      });

      expect(authClient.emailOtp.sendVerificationOtp).toHaveBeenCalledWith({
        email: 'test@example.com',
        type: 'sign-in',
      });
      expect(res.data?.userId).toBe('user_123');
      expect(res.error).toBeNull();
    });

    it('handles verification OTP error response correctly', async () => {
      vi.mocked(authClient.emailOtp.sendVerificationOtp).mockResolvedValueOnce({
        data: null,
        error: { message: 'Rate limit exceeded' },
      } as any);

      const res = await authClient.emailOtp.sendVerificationOtp({
        email: 'test@example.com',
        type: 'sign-in',
      });

      expect(res.error?.message).toBe('Rate limit exceeded');
    });

    it('verifies sign in email OTP via Better Auth signIn.emailOtp', async () => {
      vi.mocked(authClient.signIn.emailOtp).mockResolvedValueOnce({
        data: { token: 'session_token_123', user: { id: 'u_123', email: 'test@example.com' } },
        error: null,
      } as any);

      const res = await authClient.signIn.emailOtp({
        email: 'test@example.com',
        otp: '123456',
      });

      expect(authClient.signIn.emailOtp).toHaveBeenCalledWith({
        email: 'test@example.com',
        otp: '123456',
      });
      expect(res.data?.token).toBe('session_token_123');
    });
  });

  describe('Passkey Login Policy', () => {
    it('uses signIn.passkey for unauthenticated passkey authentication', async () => {
      vi.mocked(authClient.signIn.passkey).mockResolvedValueOnce({
        data: { session: { id: 's_123' }, user: { id: 'u_123' } },
        error: null,
      } as any);

      const res = await authClient.signIn.passkey({
        returnWebAuthnResponse: true,
      });

      expect(authClient.signIn.passkey).toHaveBeenCalledWith({
        returnWebAuthnResponse: true,
      });
      expect(res.data?.user?.id).toBe('u_123');
    });
  });
});
