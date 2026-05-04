export const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_CLOUDFLARE_TURNSTILE_KEY || '';
const TURNSTILE_SECRET_KEY = process.env.CLOUDFLARE_TURNSTILE_SECRET || '';

export interface TurnstileVerifyResponse {
  success: boolean;
  challenge_ts?: string;
  hostname?: string;
  error_codes?: string[];
  score?: number;
  score_reason?: string[];
}

export async function verifyTurnstileToken(token: string): Promise<TurnstileVerifyResponse> {
  if (!TURNSTILE_SECRET_KEY) {
    console.error('Turnstile secret key not configured');
    return { success: false, error_codes: ['MISSING_SECRET'] };
  }

  try {
    const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        secret: TURNSTILE_SECRET_KEY,
        response: token,
      }),
    });

    if (!response.ok) {
      return { success: false, error_codes: ['VERIFY_FAILED'] };
    }

    return await response.json();
  } catch (error: any) {
    console.error('Turnstile verification error:', error);
    return { success: false, error_codes: ['NETWORK_ERROR'] };
  }
}
