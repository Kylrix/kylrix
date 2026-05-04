import { NextResponse } from 'next/server';
import type { AppActivity } from '@/lib/services/activity';
import { ActivityService } from '@/lib/services/activity';
import { resolveCurrentUser } from '@/lib/appwrite/client';

export async function POST(req: Request) {
    try {
        const user = await resolveCurrentUser(req);
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const body = await req.json();
        const activity: AppActivity = {
            userId: user.$id,
            appId: body.appId,
            action: body.action,
            metadata: body.metadata,
            timestamp: new Date().toISOString()
        };

        await ActivityService.logActivity(activity);

        // Analyze synergy immediately for proactive response
        // In a production app, this would be a background job
        const synergies = await ActivityService.analyzeSynergy(user.$id);

        return NextResponse.json({ success: true, synergies });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Internal Server Error";
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
