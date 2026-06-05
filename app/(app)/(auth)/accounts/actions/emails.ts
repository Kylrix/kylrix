'use server';

import { ID, Query } from 'node-appwrite';
import { getActor } from '@/lib/actions/secure-ops';
import { requireAdmin } from '@/lib/services/internal/admin';
import { createAdminClient } from '@/lib/appwrite-admin';
import { getEmailTemplateMeta } from '@/lib/email-template-catalog';
import { renderEmailTemplate } from '@/lib/email-renderer';

type SendEmailBody = {
  templateId?: string;
  subject?: string;
  html?: string;
  recipientIds?: string[];
  recipientEmails?: string[];
  ctaUrl?: string;
};

const validateEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());

export async function sendAdminEmailsAction(body: SendEmailBody, jwt?: string) {
  const actor = await getActor(jwt);
  if (!actor) {
    throw new Error('Unauthorized');
  }
  requireAdmin(actor);

  const { users, messaging } = createAdminClient(actor.email);
  const templateId = body.templateId?.trim();
  const recipientIds = (body.recipientIds || []).filter(Boolean);
  const recipientEmails = (body.recipientEmails || []).filter(Boolean);
  if (!templateId && !body.html) throw new Error('Provide either a templateId or custom html.');
  if (recipientIds.length === 0 && recipientEmails.length === 0) throw new Error('Select at least one recipient.');

  const resolvedRecipients: Array<{ name: string; email: string }> = [];
  if (recipientIds.length > 0) {
    const fetched = await Promise.all(recipientIds.map(async (id) => {
      const user = await users.get(id);
      if (!validateEmail(user.email || '')) return { invalid: `No valid email found for user ${id}` };
      if (!user.emailVerification) return { invalid: `Email is not verified for user ${user.email || id}` };
      return { name: user.name || user.email || 'User', email: user.email || '' };
    }));
    const invalidRecipient = fetched.find((entry) => 'invalid' in entry) as { invalid: string } | undefined;
    if (invalidRecipient?.invalid) throw new Error(invalidRecipient.invalid);
    resolvedRecipients.push(...(fetched.filter((entry): entry is { name: string; email: string } => 'email' in entry) as Array<{ name: string; email: string }>));
  }

  if (recipientEmails.length > 0) {
    for (const email of recipientEmails) {
      if (!validateEmail(email)) throw new Error(`Invalid recipient email: ${email}`);
      const userList = await users.list([Query.equal('email', email.trim())]);
      const targetUser = userList.users[0];
      if (!targetUser) throw new Error(`No Appwrite user found for ${email}`);
      if (!targetUser.emailVerification) throw new Error(`Email is not verified: ${email}`);
      resolvedRecipients.push({ name: targetUser.name || email.split('@')[0], email });
    }
  }
  if (resolvedRecipients.length === 0) throw new Error('No valid recipients could be resolved.');

  const fallbackTemplate = templateId ? getEmailTemplateMeta(templateId) : null;
  const subjectFallback = body.subject || fallbackTemplate?.subject || 'Kylrix Update';
  const sendResults = [];
  for (const recipient of resolvedRecipients) {
    const rendered = templateId
      ? await renderEmailTemplate(templateId, { recipientName: recipient.name, ctaUrl: body.ctaUrl || 'https://kylrix.space' })
      : { subject: subjectFallback, html: body.html || '' };
    const subject = body.subject || rendered.subject;
    const html = body.html || rendered.html;
    const userList = await users.list([Query.equal('email', recipient.email.trim())]);
    const targetUser = userList.users[0];
    if (!targetUser) throw new Error(`No Appwrite user found for ${recipient.email}`);
    const info = await messaging.createEmail({
      messageId: ID.unique(),
      subject,
      content: html,
      users: [targetUser.$id],
      html: true,
    });
    sendResults.push({ email: recipient.email, messageId: info.$id, status: info.status });
  }
  return { ok: true, sent: sendResults.length, results: sendResults };
}
