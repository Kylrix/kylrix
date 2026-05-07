import { NextRequest, NextResponse } from 'next/server';
import { verifyUser } from '@/lib/api/permission-updater';
import { getAdminStats, requireAdmin } from '@/lib/services/internal/admin';

export async function GET(req: NextRequest) {
  try {
    const user = await verifyUser(req);
    requireAdmin(user);
    return NextResponse.json(await getAdminStats());

  } catch (error: any) {
    if (String(error?.message || '').includes('Forbidden')) {
      return NextResponse.json({ error: 'Forbidden: admin privileges required' }, { status: 403 });
    }
    console.error('[Admin Stats API] Error:', error.message || error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch stats' },
      { status: 500 }
    );
  }
}
