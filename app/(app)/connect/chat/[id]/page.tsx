'use client';

import { ConnectAppShell } from '@/components/layout/ConnectAppShell';
import { ChatWindow } from '@/components/chat/ChatWindow';
import { useParams } from 'next/navigation';

export default function ChatPage() {
    const params = useParams();
    const conversationId = params.id as string;

    return (
        <ConnectAppShell>
            <ChatWindow conversationId={conversationId} />
        </ConnectAppShell>
    );
}
