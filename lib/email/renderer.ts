import { KYLRIX_AUTH_URI } from '@/lib/appwrite/config';

export type UnorganicEmailSource = 'flow' | 'connect' | 'note' | 'vault' | 'accounts';

export type UnorganicEmailEventType =
  | 'group_member_added'
  | 'task_assigned'
  | 'note_collaborator_added'
  | 'form_response_submitted'
  | 'event_registered'
  | 'password_shared'
  | 'message_streak'
  | 'call_started'
  | 'token_transfer_received'
  | 'project_invited'
  | 'subscription_expiry_reminder'
  | 'feature_announcement'
  | 'coupon_issued'
  | 'passkey_added'
  | 'masterpass_login_enabled'
  | 'masterpass_login_disabled';

export type EventCopy = {
  subject: string;
  title: string;
  body: string;
  ctaText: string;
  ctaUrl: string;
};

export type SourceTheme = {
  color: string;
  shape: 'Diamond' | 'Slanted Square';
  label: string;
};

export const SOURCE_THEMES: Record<UnorganicEmailSource, SourceTheme> = {
  accounts: { color: '#6366F1', shape: 'Diamond', label: 'Accounts' },
  flow: { color: '#A855F7', shape: 'Slanted Square', label: 'Flow' },
  connect: { color: '#F59E0B', shape: 'Slanted Square', label: 'Connect' },
  note: { color: '#EC4899', shape: 'Slanted Square', label: 'Note' },
  vault: { color: '#10B981', shape: 'Slanted Square', label: 'Vault' },
};

export const SOURCE_PRIORITY: Record<UnorganicEmailSource, number> = {
  flow: 50,
  connect: 40,
  note: 30,
  vault: 20,
  accounts: 10,
};

export const EVENT_PRIORITY: Record<UnorganicEmailEventType, number> = {
  task_assigned: 50,
  call_started: 45,
  token_transfer_received: 44,
  form_response_submitted: 42,
  password_shared: 38,
  note_collaborator_added: 32,
  event_registered: 28,
  group_member_added: 20,
  message_streak: 16,
  project_invited: 50,
  subscription_expiry_reminder: 95,
  feature_announcement: 70,
  coupon_issued: 80,
  passkey_added: 36,
  masterpass_login_enabled: 34,
  masterpass_login_disabled: 34,
};

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function redactSensitiveEnvContent(text: string): string {
  if (!text || typeof text !== 'string') return '';
  return text
    // Redact private keys (-----BEGIN ... PRIVATE KEY-----)
    .replace(/-----BEGIN[A-Z\s]+PRIVATE KEY-----[\s\S]*?-----END[A-Z\s]+PRIVATE KEY-----/gi, '[REDACTED_PRIVATE_KEY]')
    // Redact DB connection strings / URIs containing credentials
    .replace(/\b(?:postgres|postgresql|mongodb|mongodb\+srv|mysql|redis):\/\/[^\s"']+/gi, '[REDACTED_URI]')
    // Redact JWT tokens (eyJ...)
    .replace(/\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g, '[REDACTED_TOKEN]')
    // Redact API key / Secret patterns (sk-..., sk_..., ghp_..., np_..., xoxb-..., etc.)
    .replace(/\b(?:sk|ghp|gho|ghu|ghs|ghr|np|xoxb|xoxp|xapp|live|test)[_-][a-zA-Z0-9_]{16,}\b/gi, '[REDACTED_SECRET]')
    // Redact KEY=VALUE env assignments (including optional export keyword and quotes)
    .replace(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/gm, (_match, key) => {
      return `${key}=[REDACTED_ENV]`;
    });
}

function pickText(...values: Array<string | null | undefined>): string {
  for (const value of values) {
    const text = typeof value === 'string' ? value.trim() : '';
    if (text) return text;
  }
  return '';
}

export function resolveEventCopy(input: {
  eventType: UnorganicEmailEventType;
  sourceApp?: UnorganicEmailSource | null;
  actorName?: string | null;
  actorId?: string | null;
  resourceTitle?: string | null;
  resourceType?: string | null;
  rightsLabel?: string | null;
  ctaUrl?: string | null;
  ctaText?: string | null;
  metadata?: Record<string, unknown> | null;
}): EventCopy {
  const actorName = pickText(input.actorName, 'Someone') || 'Someone';
  const resourceTitle = pickText(input.resourceTitle, input.resourceType, 'this item');
  const rightsLabel = pickText(input.rightsLabel);
  const ctaUrl = pickText(input.ctaUrl, KYLRIX_AUTH_URI);
  const ctaText = pickText(input.ctaText, 'Open Kylrix');

  switch (input.eventType) {
    case 'project_invited':
      return {
        subject: `Invitation to join project: ${resourceTitle}`,
        title: 'Project Invitation',
        body: `${actorName} has invited you to collaborate on the project "${resourceTitle}"${rightsLabel ? ` with ${rightsLabel} permissions` : ''}.`.trim(),
        ctaText,
        ctaUrl,
      };
    case 'task_assigned':
      return {
        subject: `New task assignment: ${resourceTitle}`,
        title: 'Task assignment',
        body: `${actorName} assigned you to ${resourceTitle}.${rightsLabel ? ` You have ${rightsLabel}.` : ''}`.trim(),
        ctaText,
        ctaUrl,
      };
    case 'note_collaborator_added':
      return {
        subject: `Added to ${resourceTitle}`,
        title: 'Note collaboration',
        body: `${actorName} added you as a collaborator to ${resourceTitle}${rightsLabel ? ` with ${rightsLabel}` : ''}.`.trim(),
        ctaText,
        ctaUrl,
      };
    case 'group_member_added':
      return {
        subject: `Added to ${resourceTitle}`,
        title: 'Group access',
        body: `${actorName} added you to ${resourceTitle}.`.trim(),
        ctaText,
        ctaUrl,
      };
    case 'form_response_submitted':
      return {
        subject: `New response on ${resourceTitle}`,
        title: 'Form response',
        body: `${actorName} submitted a new response to ${resourceTitle}.`.trim(),
        ctaText: pickText(input.ctaText, 'View submission detail'),
        ctaUrl,
      };
    case 'event_registered':
      return {
        subject: `${actorName} registered for ${resourceTitle}`,
        title: 'Event registration',
        body: `${actorName} registered for ${resourceTitle}.`.trim(),
        ctaText,
        ctaUrl,
      };
    case 'password_shared':
      return {
        subject: `A secret was shared with you`,
        title: 'Vault share',
        body: `${actorName} shared a password or TOTP with you${resourceTitle ? `: ${resourceTitle}` : ''}.`.trim(),
        ctaText,
        ctaUrl,
      };
    case 'token_transfer_received':
      return {
        subject: `You received ${resourceTitle || 'a KYLRIX transfer'}`,
        title: 'KYLRIX transfer received',
        body: `${actorName} sent ${resourceTitle || 'KYLRIX tokens'} to your wallet.`.trim(),
        ctaText,
        ctaUrl,
      };
    case 'message_streak':
      return {
        subject: `You have unread messages from ${actorName}`,
        title: 'Message reminder',
        body: `${actorName} has sent you multiple messages without a reply. It may be time to respond.`.trim(),
        ctaText,
        ctaUrl,
      };
    case 'call_started':
      return {
        subject: `${actorName} started a call`,
        title: 'Incoming call',
        body: `${actorName} started a call and is waiting for you to join.`.trim(),
        ctaText,
        ctaUrl,
      };
    case 'subscription_expiry_reminder':
      return {
        subject: `Your Kylrix Pro subscription expires in 2 days`,
        title: 'Subscription Expiry Reminder',
        body: `Your paid Kylrix Pro subscription is expiring in 2 days. To avoid being downgraded back to the free plan, please fund your in-app wallet or renew your subscription ahead of expiry.`.trim(),
        ctaText: 'Renew Subscription',
        ctaUrl: `${KYLRIX_AUTH_URI}/accounts/settings/profile`,
      };
    case 'passkey_added':
      return {
        subject: `Passkey added: ${resourceTitle}`,
        title: 'New passkey',
        body: `Passkey "${resourceTitle}" was added to your account. If you did not do this, review your security settings right away.`.trim(),
        ctaText: pickText(input.ctaText, 'Review security settings'),
        ctaUrl: pickText(input.ctaUrl, `${KYLRIX_AUTH_URI}/settings`),
      };
    case 'masterpass_login_enabled':
      return {
        subject: 'MasterPass sign-in enabled',
        title: 'Sign-in method updated',
        body: 'MasterPass for account login has been enabled on your account.',
        ctaText: pickText(input.ctaText, 'Review security settings'),
        ctaUrl: pickText(input.ctaUrl, `${KYLRIX_AUTH_URI}/settings`),
      };
    case 'masterpass_login_disabled':
      return {
        subject: 'MasterPass sign-in disabled',
        title: 'Sign-in method updated',
        body: 'MasterPass for account login has been disabled on your account.',
        ctaText: pickText(input.ctaText, 'Review security settings'),
        ctaUrl: pickText(input.ctaUrl, `${KYLRIX_AUTH_URI}/settings`),
      };
    case 'feature_announcement':
    case 'coupon_issued': {
      const isCoupon = input.eventType === 'coupon_issued' || Boolean(input.metadata?.couponId);
      if (isCoupon) {
        const discount = input.metadata?.discountPercent || 'a special';
        return {
          subject: pickText(input.metadata?.subject as string, 'You received a Kylrix Coupon!'),
          title: 'Special Offer',
          body: `You received a coupon for ${discount}% off Kylrix Pro. Claim it now to upgrade your workspace.`.trim(),
          ctaText: 'Claim Coupon',
          ctaUrl: pickText(input.metadata?.couponUrl as string, ctaUrl),
        };
      }
      return {
        subject: pickText(input.metadata?.subject as string, `New feature: ${resourceTitle}`),
        title: 'Feature Update',
        body: `${actorName} announced a new feature: ${resourceTitle}.`.trim(),
        ctaText,
        ctaUrl,
      };
    }
    default:
      return {
        subject: `Update from ${resourceTitle}`,
        title: 'Kylrix update',
        body: `${actorName} triggered a notification for ${resourceTitle}.`.trim(),
        ctaText,
        ctaUrl,
      };
  }
}

export function buildEmailHtml(params: {
  recipientName: string;
  sourceApp: UnorganicEmailSource;
  eventType: UnorganicEmailEventType;
  title: string;
  body: string;
  ctaText: string;
  ctaUrl: string;
  metadata?: Record<string, unknown> | null;
}): string {
  const theme = SOURCE_THEMES[params.sourceApp];
  const year = new Date().getFullYear();
  const chatBubblesHtml = params.metadata?.chatMessages && Array.isArray(params.metadata.chatMessages)
    ? `<div style="margin: 20px 0; padding: 16px; background: rgba(0,0,0,0.4); border-radius: 16px; border: 1px solid rgba(255,255,255,0.06);">
        <div style="font-size: 11px; text-transform: uppercase; letter-spacing: .08em; color: rgba(255,255,255,0.4); margin-bottom: 12px; font-weight: 800;">Recent messages</div>
        ${params.metadata.chatMessages.map((msg: any) => {
          const rawContent = String(msg.content || '');
          const redactedContent = redactSensitiveEnvContent(rawContent);
          return `
          <div style="margin-bottom: 10px; display: flex; flex-direction: column;">
            <div style="align-self: flex-start; max-width: 85%; background: rgba(245, 158, 11, 0.12); border: 1px solid rgba(245, 158, 11, 0.25); color: #fff; padding: 10px 14px; border-radius: 14px 14px 14px 4px; font-size: 14px; line-height: 1.4;">
              ${escapeHtml(redactedContent)}
            </div>
          </div>
        `;
        }).join('')}
       </div>`
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { margin: 0; padding: 0; background: #0A0908; color: #fff; font-family: Arial, sans-serif; }
    .wrap { max-width: 640px; margin: 0 auto; padding: 32px 16px; }
    .card { background: #161412; border: 1px solid rgba(255,255,255,0.06); border-radius: 28px; overflow: hidden; }
    .top { padding: 28px 28px 18px; border-bottom: 1px solid rgba(255,255,255,0.06); }
    .badge { display:inline-block; padding: 8px 12px; border-radius: 999px; background: rgba(255,255,255,0.04); color: rgba(255,255,255,0.72); font-size: 12px; letter-spacing: .08em; text-transform: uppercase; }
    .logo { margin-top: 18px; width: 44px; height: 44px; display: flex; align-items: center; justify-content: center; }
    .content { padding: 28px; }
    .title { font-size: 26px; line-height: 1.1; font-weight: 900; margin: 0 0 16px; }
    .body { font-size: 16px; line-height: 1.6; color: rgba(255,255,255,0.72); margin: 0 0 24px; }
    .button { display:inline-block; padding: 14px 22px; background: ${theme.color}; color: #000; text-decoration:none; border-radius: 14px; font-weight: 900; }
    .footer { padding: 0 28px 28px; color: rgba(255,255,255,0.25); font-size: 12px; }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="card">
      <div class="top">
        <div class="badge">${escapeHtml(theme.label)} update</div>
        <div class="logo">
          <svg viewBox="0 0 100 100" width="44" height="44" fill="none" xmlns="http://www.w3.org/2000/svg" style="filter: drop-shadow(0 2px 4px rgba(0,0,0,0.3))">
            <line x1="15" y1="30" x2="50" y2="10" stroke="#EC4899" stroke-width="3.5" stroke-linecap="round" />
            <line x1="50" y1="10" x2="85" y2="30" stroke="#10B981" stroke-width="3.5" stroke-linecap="round" />
            <line x1="85" y1="30" x2="85" y2="70" stroke="#EC4899" stroke-width="3.5" stroke-linecap="round" />
            <line x1="85" y1="70" x2="50" y2="90" stroke="#A855F7" stroke-width="3.5" stroke-linecap="round" />
            <line x1="50" y1="90" x2="15" y2="70" stroke="#EC4899" stroke-width="3.5" stroke-linecap="round" />
            <line x1="15" y1="70" x2="15" y2="30" stroke="#F59E0B" stroke-width="3.5" stroke-linecap="round" />
            <line x1="50" y1="50" x2="15" y2="30" stroke="#A855F7" stroke-width="3.5" stroke-linecap="round" />
            <line x1="50" y1="50" x2="85" y2="30" stroke="#F59E0B" stroke-width="3.5" stroke-linecap="round" />
            <line x1="50" y1="50" x2="50" y2="90" stroke="#10B981" stroke-width="3.5" stroke-linecap="round" />
            <circle cx="50" cy="10" r="4" fill="${theme.color}" stroke="#0A0908" stroke-width="1.5" />
            <circle cx="15" cy="30" r="4" fill="${theme.color}" stroke="#0A0908" stroke-width="1.5" />
            <circle cx="85" cy="30" r="4" fill="${theme.color}" stroke="#0A0908" stroke-width="1.5" />
            <circle cx="15" cy="70" r="4" fill="${theme.color}" stroke="#0A0908" stroke-width="1.5" />
            <circle cx="50" cy="90" r="4" fill="${theme.color}" stroke="#0A0908" stroke-width="1.5" />
            <circle cx="85" cy="70" r="4" fill="${theme.color}" stroke="#0A0908" stroke-width="1.5" />
            <circle cx="50" cy="50" r="5.5" fill="${theme.color}" stroke="#0A0908" stroke-width="2" />
          </svg>
        </div>
      </div>
      <div class="content">
        <h1 class="title">${escapeHtml(params.title)}</h1>
        <p class="body">Hello ${escapeHtml(params.recipientName)},<br><br>${escapeHtml(params.body)}</p>
        ${chatBubblesHtml}
        <a class="button" href="${escapeHtml(params.ctaUrl)}">${escapeHtml(params.ctaText)}</a>
      </div>
      <div class="footer">© ${year} Kylrix. Event: ${escapeHtml(params.eventType)}</div>
    </div>
  </div>
</body>
</html>`;
}
