import { NextRequest, NextResponse } from 'next/server';
import { verifyUser } from '@/lib/api/permission-updater';
import { listAdminUsers, requireAdmin } from '@/lib/services/internal/admin';

export async function GET(request: NextRequest) {
  try {
    const user = await verifyUser(request);
    const { searchParams } = new URL(request.url);
    requireAdmin(user);
    const data = await listAdminUsers({
      search: searchParams.get('search') || '',
      verifiedOnly: searchParams.get('verified') === 'true',
      limit: Number(searchParams.get('limit') || 100),
      cursorAfter: searchParams.get('cursorAfter')?.trim() || null,
    });
    return NextResponse.json(data);
  } catch (error: any) {
    if (String(error?.message || '').includes('Forbidden')) {
      return NextResponse.json({ error: 'Forbidden: admin privileges required' }, { status: 403 });
    }
    console.error('[Admin Users API] Error:', error.message || error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch users' },
      { status: 500 }
    );
  }
}
