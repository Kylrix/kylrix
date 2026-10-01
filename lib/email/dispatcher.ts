/**
 * Kylrix Modular Transactional Email Dispatcher
 *
 * Supports Maileroo as the primary zero-cost engine, with modular
 * fallback to Resend or local development logging.
 */

export interface SendEmailOptions {
  to: string;
  subject: string;
  text?: string;
  html?: string;
  from?: string;
}

export async function sendTransactionalEmail({
  to,
  subject,
  text,
  html,
  from = process.env.EMAIL_FROM || 'Kylrix Security <auth@kylrix.space>',
}: SendEmailOptions): Promise<{ success: boolean; error?: string }> {
  const mailerooApiKey = process.env.MAILEROO_API_KEY;
  const resendApiKey = process.env.RESEND_API_KEY;

  // 1. Maileroo Engine (Primary)
  if (mailerooApiKey) {
    try {
      const response = await fetch('https://smtp.maileroo.com/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': mailerooApiKey,
        },
        body: JSON.stringify({
          api_key: mailerooApiKey,
          from,
          to,
          subject,
          plain: text || '',
          html: html || `<p>${text || ''}</p>`,
        }),
      });

      if (!response.ok) {
        const errText = await response.text();
        console.warn('[Maileroo] API dispatch response:', response.status, errText);
      }
      return { success: true };
    } catch (err: any) {
      console.error('[Maileroo] Error sending email:', err);
      return { success: false, error: err.message };
    }
  }

  // 2. Resend Engine (Modular secondary option)
  if (resendApiKey) {
    try {
      const { Resend } = await import('resend');
      const resend = new Resend(resendApiKey);
      await resend.emails.send({
        from,
        to,
        subject,
        text: text || '',
        html: html || undefined,
      });
      return { success: true };
    } catch (err: any) {
      console.error('[Resend] Error sending email:', err);
      return { success: false, error: err.message };
    }
  }

  // 3. Local Development Fallback
  console.log(`[Email Dispatcher (Dev)] To: ${to} | Subject: ${subject}\nContent: ${text || html}`);
  return { success: true };
}
