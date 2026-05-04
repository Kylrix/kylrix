export interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  html: (data: EmailData) => string;
}

export interface EmailData {
  recipientName: string;
  logoColor: string;
  logoShape: 'Diamond' | 'Slanted Square';
  contentTitle: string;
  contentBody: string;
  ctaText?: string;
  ctaUrl?: string;
}

export const generateEmailHtml = (data: EmailData) => {
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body { margin: 0; padding: 0; font-family: 'Satoshi', 'Inter', -apple-system, sans-serif; background-color: #0A0908; color: #FFFFFF; }
        .container { max-width: 600px; margin: 40px auto; background-color: #161412; border: 1px solid rgba(255, 255, 255, 0.05); border-radius: 32px; overflow: hidden; }
        .header { padding: 40px; text-align: center; border-bottom: 1px solid rgba(255, 255, 255, 0.05); }
        .logo-container { margin-bottom: 24px; position: relative; width: 48px; height: 48px; margin: 0 auto 24px; }
        .logo-left { position: absolute; left: 0; top: 0; width: 24px; height: 48px; background-color: #6366F1; border-top-left-radius: 24px; border-bottom-left-radius: 24px; }
        .logo-right { position: absolute; right: 0; top: 0; width: 24px; height: 48px; background-color: ${data.logoColor}; border-top-right-radius: 24px; border-bottom-right-radius: 24px; }
        .logo-cutout { position: absolute; left: 50%; top: 50%; width: 16px; height: 16px; background-color: #161412; transform: translate(-50%, -50%) rotate(${data.logoShape === 'Diamond' ? '45deg' : '15deg'}); border-radius: 2px; }
        .content { padding: 40px; }
        .title { font-size: 28px; font-weight: 900; color: #FFFFFF; margin-bottom: 24px; font-family: 'Clash Display', sans-serif; }
        .body { font-size: 16px; line-height: 1.6; color: rgba(255, 255, 255, 0.6); margin-bottom: 32px; }
        .button { display: inline-block; padding: 16px 32px; background-color: #6366F1; color: #FFFFFF; text-decoration: none; border-radius: 16px; font-weight: 800; font-size: 14px; }
        .footer { padding: 40px; text-align: center; background-color: rgba(255, 255, 255, 0.02); border-top: 1px solid rgba(255, 255, 255, 0.05); }
        .footer-text { font-size: 12px; color: rgba(255, 255, 255, 0.2); }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div class="logo-container">
            <div class="logo-left"></div>
            <div class="logo-right"></div>
            <div class="logo-cutout"></div>
          </div>
        </div>
        <div class="content">
          <div class="title">${data.contentTitle}</div>
          <div class="body">Hello ${data.recipientName},<br><br>${data.contentBody}</div>
          ${data.ctaText && data.ctaUrl ? `
            <div style="text-align: center;">
              <a href="${data.ctaUrl}" class="button">${data.ctaText}</a>
            </div>
          ` : ''}
        </div>
        <div class="footer">
          <div class="footer-text">
            © ${new Date().getFullYear()} Kylrix Ecosystem. All rights reserved.<br>
            Secure state for the digital individual.
          </div>
        </div>
      </div>
    </body>
    </html>
  `;
};
