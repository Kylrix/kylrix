import { NextRequest, NextResponse } from 'next/server';
import { Query } from 'node-appwrite';
import { createAdminClient } from '@/lib/appwrite-admin';
import { APPWRITE_CONFIG } from '@/lib/appwrite/config';
import { getCorsHeaders } from '@/lib/api/permission-updater';

const CHAT_DB_ID = APPWRITE_CONFIG.DATABASES.CHAT;
const PROFILES_TABLE_ID = APPWRITE_CONFIG.TABLES.CHAT.PROFILES;
const KYLRIX_REFERRAL_BASE = 'https://www.kylrix.space/referral';

function normalizeUsername(input: string | null | undefined) {
  if (!input) return null;
  const cleaned = input
    .toString()
    .trim()
    .replace(/^@+/, '')
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '');
  return cleaned || null;
}

function buildReferralPageUrl(username: string) {
  return `${KYLRIX_REFERRAL_BASE}/${encodeURIComponent(username)}`;
}

export async function GET(req: NextRequest, props: { params: Promise<{ username: string }> }) {
  const params = await props.params;
  const corsHeaders = getCorsHeaders(req);

  try {
    const username = normalizeUsername(params.username);
    if (!username) {
      return NextResponse.json({ error: 'Invalid username' }, { status: 400, headers: corsHeaders });
    }

    const { databases } = createAdminClient();
    const result = await databases.listDocuments(CHAT_DB_ID, PROFILES_TABLE_ID, [
      Query.equal('username', username),
      Query.limit(1),
    ]);

    const profile = result.documents[0] || null;
    if (!profile || !profile.username) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404, headers: corsHeaders });
    }

    return NextResponse.json(
      {
        success: true,
        username: profile.username,
        displayName: profile.displayName || profile.username,
        avatar: profile.avatar || null,
        userId: profile.userId || profile.$id,
        referralLink: buildReferralPageUrl(profile.username),
      },
      {
        headers: {
          ...corsHeaders,
          'Cache-Control': 'no-store',
        },
      },
    );
  } catch (error: any) {
    const message = error?.message || 'Failed to resolve referral profile';
    console.error('[Referrals API] GET /[username] error:', error);
    return NextResponse.json({ error: message }, { status: 500, headers: corsHeaders });
  }
}
