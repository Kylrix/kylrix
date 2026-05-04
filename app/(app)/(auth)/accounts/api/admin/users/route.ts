import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/appwrite-admin';
import { Query } from 'node-appwrite';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const search = (searchParams.get('search') || '').trim().toLowerCase();
    const verifiedOnly = searchParams.get('verified') === 'true';
    const limit = Math.min(Math.max(Number(searchParams.get('limit') || 100), 1), 100);
    const cursorAfter = searchParams.get('cursorAfter')?.trim() || null;
    
    const { users } = createAdminClient();
    
    const queries = [
      Query.limit(limit),
      Query.orderDesc('$createdAt'),
      ...(cursorAfter ? [Query.cursorAfter(cursorAfter)] : []),
    ];

    const response = await users.list(queries);
    const filteredUsers = search
      ? response.users.filter((user) => {
          const haystack = [
            user.$id,
            user.name || '',
            user.email || '',
          ]
            .join(' ')
            .toLowerCase();
          return haystack.includes(search);
        })
      : response.users;
    const visibleUsers = verifiedOnly
      ? filteredUsers.filter((user) => user.emailVerification)
      : filteredUsers;
    const nextCursor = response.users.length > 0 ? response.users[response.users.length - 1].$id : null;
    const hasMore = response.users.length === limit;

    console.log('[Admin Users API] Fetched users count:', visibleUsers.length);

    return NextResponse.json({
      users: visibleUsers.map(user => ({
        id: user.$id,
        name: user.name || 'Anonymous',
        email: user.email,
        status: user.status ? 'active' : 'inactive',
        role: user.labels.includes('admin') ? 'admin' : 'user',
        joinDate: new Date(user.$createdAt).toLocaleDateString('en-US', {
          month: 'short',
          day: '2-digit',
          year: 'numeric'
        }),
        emailVerification: user.emailVerification,
        labels: user.labels
      })),
      total: visibleUsers.length,
      rawTotal: response.total,
      nextCursor,
      hasMore,
    });
  } catch (error: any) {
    console.error('[Admin Users API] Error:', error.message || error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch users' },
      { status: 500 }
    );
  }
}
