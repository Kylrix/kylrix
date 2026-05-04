export type EmailTemplateId =
  | 'welcome'
  | 'ecosystem-update'
  | 'security-alert'
  | 'maintenance'
  | 'subscription-update'
  | 'gift-coupon';

export type EmailTemplateMeta = {
  id: EmailTemplateId;
  name: string;
  subject: string;
  filename: string;
};

export const EMAIL_TEMPLATES: EmailTemplateMeta[] = [
  {
    id: 'welcome',
    name: 'Welcome to Kylrix',
    subject: '👋 Welcome to the Future of Privacy',
    filename: 'Welcome_to_Kylrix.html',
  },
  {
    id: 'ecosystem-update',
    name: 'Ecosystem Update',
    subject: 'Kylrix Ecosystem: New Features & Updates',
    filename: 'Kylrix_Ecosystem_Update.html',
  },
  {
    id: 'security-alert',
    name: 'Security Alert',
    subject: 'Important Security Update for Your Account',
    filename: 'Security_Alert.html',
  },
  {
    id: 'maintenance',
    name: 'Scheduled Maintenance',
    subject: 'Kylrix Ecosystem: Brief Maintenance Period',
    filename: 'Scheduled_Maintenance.html',
  },
  {
    id: 'subscription-update',
    name: 'Subscription Update',
    subject: 'Your Kylrix subscription is active',
    filename: 'Subscription_Update.html',
  },
  {
    id: 'gift-coupon',
    name: 'Gift Coupon',
    subject: 'A Kylrix gift is waiting for you',
    filename: 'Gift_Coupon.html',
  },
];

export function getEmailTemplateMeta(templateId: string): EmailTemplateMeta | null {
  return EMAIL_TEMPLATES.find((template) => template.id === templateId) ?? null;
}
