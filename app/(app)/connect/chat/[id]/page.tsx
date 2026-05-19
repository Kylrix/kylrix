'use client';

import { ChatWindow } from '@/components/chat/ChatWindow';
import ChatComposerFab from '@/components/chat/ChatComposerFab';
import { useParams } from 'next/navigation';
import { Box } from '@mui/material';

export default function ChatPage() {
    const params = useParams();
    const conversationId = params.id as string;

    return (
        <Box sx={{ pointerEvents: 'auto', height: '100%' }}>
            <ChatWindow conversationId={conversationId} />
            <ChatComposerFab />
        </Box>
    );
}
