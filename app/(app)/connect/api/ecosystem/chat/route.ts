import { NextResponse } from 'next/server';
import { ChatService } from '@/lib/services/chat';
import { resolveCurrentUser } from '@/lib/appwrite/client';

/**
 * External API for triggering chat messages from other apps.
 * Used for "shared call URIs", "attaching conversation to flow app", etc.
 */
export async function POST(req: Request) {
    try {
        const user = await resolveCurrentUser(req);
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const body = await req.json();
        const { conversationId, content, type, attachments, appId: _appId } = body;

        if (!conversationId || !content) {
            return NextResponse.json({ error: 'Missing conversationId or content' }, { status: 400 });
        }

        // System or standard message
        const message = await ChatService.sendMessage(
            conversationId, 
            user.$id, 
            content, 
            type || 'text', 
            attachments || [],
            undefined,
            undefined,
            { cookie: req.headers.get('cookie') || undefined }
        );

        // Optional: Tag with appId in metadata if we had a metadata column in Messages
        // For now, it's just a rich communication system power-up.

        return NextResponse.json({ success: true, messageId: message.$id });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Internal Server Error";
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

/**
 * External API to list conversations for cross-app selection.
 */
export async function GET(req: Request) {
    try {
        const user = await resolveCurrentUser(req);
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const result = await ChatService.getConversations(user.$id);
        return NextResponse.json({ conversations: result.rows });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Internal Server Error";
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
