import { NextResponse } from 'next/server';
import { ID, Query } from 'node-appwrite';
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

function validateEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

export async function POST(request: Request) {
  try {
    const { users, messaging } = createAdminClient();

    const body = (await request.json()) as SendEmailBody;
    const templateId = body.templateId?.trim();
    const recipientIds = (body.recipientIds || []).filter(Boolean);
    const recipientEmails = (body.recipientEmails || []).filter(Boolean);

    if (!templateId && !body.html) {
      return NextResponse.json({ error: 'Provide either a templateId or custom html.' }, { status: 400 });
    }

    if (recipientIds.length === 0 && recipientEmails.length === 0) {
      return NextResponse.json({ error: 'Select at least one recipient.' }, { status: 400 });
    }

    const resolvedRecipients: Array<{ name: string; email: string }> = [];

    if (recipientIds.length > 0) {
      const fetched = await Promise.all(
        recipientIds.map(async (id) => {
          const user = await users.get(id);
          if (!validateEmail(user.email || '')) {
            return { invalid: `No valid email found for user ${id}` };
          }
          if (!user.emailVerification) {
            return { invalid: `Email is not verified for user ${user.email || id}` };
          }
          return {
            name: user.name || user.email || 'User',
            email: user.email || '',
          };
        }),
      );
      const invalidRecipient = fetched.find((entry) => 'invalid' in entry);
      if (invalidRecipient && 'invalid' in invalidRecipient) {
        return NextResponse.json({ error: invalidRecipient.invalid }, { status: 400 });
      }
      resolvedRecipients.push(...(fetched.filter((entry): entry is { name: string; email: string } => 'email' in entry && typeof entry.email === 'string' && validateEmail(entry.email)) as { name: string; email: string }[]));
    }

    if (recipientEmails.length > 0) {
      for (const email of recipientEmails) {
        if (!validateEmail(email)) {
          return NextResponse.json({ error: `Invalid recipient email: ${email}` }, { status: 400 });
        }
        const userList = await users.list([
          Query.equal('email', email.trim()),
        ]);
        const targetUser = userList.users[0];

        if (!targetUser) {
          return NextResponse.json({ error: `No Appwrite user found for ${email}` }, { status: 400 });
        }

        if (!targetUser.emailVerification) {
          return NextResponse.json({ error: `Email is not verified: ${email}` }, { status: 400 });
        }

        resolvedRecipients.push({ name: targetUser.name || email.split('@')[0], email });
      }
    }

    if (resolvedRecipients.length === 0) {
      return NextResponse.json({ error: 'No valid recipients could be resolved.' }, { status: 400 });
    }

    const fallbackTemplate = templateId ? getEmailTemplateMeta(templateId) : null;
    const subjectFallback = body.subject || fallbackTemplate?.subject || 'Kylrix Update';
    const sendResults = [];

    for (const recipient of resolvedRecipients) {
      const rendered = templateId
        ? await renderEmailTemplate(templateId, {
            recipientName: recipient.name,
            ctaUrl: body.ctaUrl || 'https://kylrix.space',
          })
        : {
            subject: subjectFallback,
            html: body.html || '',
          };

      const subject = body.subject || rendered.subject;
      const html = body.html || rendered.html;

      const userList = await users.list([
        Query.equal('email', recipient.email.trim()),
      ]);
      const targetUser = userList.users[0];

      if (!targetUser) {
        throw new Error(`No Appwrite user found for ${recipient.email}`);
      }

      if (!targetUser.emailVerification) {
        throw new Error(`Email is not verified: ${recipient.email}`);
      }

      const info = await messaging.createEmail({
        messageId: ID.unique(),
        subject,
        content: html,
        users: [targetUser.$id],
        html: true,
      });

      sendResults.push({
        email: recipient.email,
        messageId: info.$id,
        status: info.status,
      });
    }

    return NextResponse.json({
      ok: true,
      sent: sendResults.length,
      results: sendResults,
    });
  } catch (error: any) {
    console.error('[Admin Email Send] Error:', error?.message || error);
    return NextResponse.json(
      { error: error?.message || 'Failed to send email' },
      { status: 500 },
    );
  }
}
