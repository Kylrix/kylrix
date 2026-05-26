'use client';

import { ChatList } from '@/components/chat/ChatList';
import { useFAB } from '@/context/FABContext';
import { MessageSquare, Phone } from 'lucide-react';
import { Box, IconButton, Typography, Stack, Button } from '@mui/material';
import { useEffect, Suspense, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { ChatService } from '@/lib/services/chat';
import { useAuth } from '@/context/auth/AuthContext';
import { UsersService } from '@/lib/services/users';
import toast from 'react-hot-toast';
import { useSudo } from '@/context/SudoContext';
import { KeychainService } from '@/lib/appwrite/keychain';
import { ecosystemSecurity } from '@/lib/ecosystem/security';
import { ArrowLeft, ShieldCheck, Plus } from 'lucide-react';
import { useUnifiedDrawer } from '@/context/UnifiedDrawerContext';

function ChatHandler() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user } = useAuth();
  const { requestSudo } = useSudo();
  const userId = searchParams.get('userId');

  useEffect(() => {
    if (userId && user) {
      const initChat = async () => {
        try {
          await UsersService.ensureProfileForUser(user);
          const targetProfile = await UsersService.getProfileById(userId);
          if (!targetProfile) {
            toast.error("User profile not found.");
            router.replace('/connect/chats');
            return;
          }

          if (!targetProfile.publicKey) {
            toast.error(`${targetProfile.displayName || targetProfile.username} hasn't set up their account for secure chatting yet.`);
            router.replace('/connect/chats');
            return;
          }

          const actualTargetUserId = targetProfile.userId || userId;
          const existing = await ChatService.getConversations(user.$id);
          const found = existing.rows.find(
            (c: any) => c.type === 'direct' && c.participants.includes(actualTargetUserId)
          );

          if (found) {
            router.push(`/connect/chat/${found.$id}`);
            return;
          }

          if (ecosystemSecurity.status.isUnlocked) {
            try {
              await ecosystemSecurity.ensureE2EIdentity(user.$id);
              const newConv = await ChatService.createConversation([user.$id, actualTargetUserId], 'direct');
              router.push(`/connect/chat/${newConv.$id}`);
            } catch (err: any) {
              console.error("Failed to create chat:", err);
              toast.error(`Failed to create chat: ${err?.message || 'Unknown error'}`);
              router.replace('/connect/chats');
            }
          } else {
            const hasMaster = await KeychainService.hasMasterpass(user.$id);
            requestSudo({
              intent: hasMaster ? undefined : 'initialize',
              onSuccess: async () => {
                try {
                  await UsersService.ensureProfileForUser(user);
                  await ecosystemSecurity.ensureE2EIdentity(user.$id);
                  const newConv = await ChatService.createConversation([user.$id, actualTargetUserId], 'direct');
                  router.push(`/connect/chat/${newConv.$id}`);
                } catch (err: any) {
                  console.error("Failed to create chat:", err);
                  toast.error(`Failed to create chat: ${err?.message || 'Unknown error'}`);
                  router.replace('/connect/chats');
                }
              },
              onCancel: () => router.replace('/connect/chats')
            });
          }
        } catch (e) {
          console.error("Failed to auto-init chat", e);
          toast.error("Failed to initialize chat.");
          router.replace('/connect/chats');
        }
      };
      initChat();
    }
  }, [userId, user, router, requestSudo]);

  return null;
}

export default function Home() {
  const router = useRouter();
  const { requestSudo } = useSudo();
  const [isUnlocked, setIsUnlocked] = useState(ecosystemSecurity.status.isUnlocked);

  const { setConfiguration, resetConfiguration } = useFAB();
  const { open: openUnified } = useUnifiedDrawer();

  useEffect(() => {
    if (isUnlocked) {
      setConfiguration({
        isVisible: true,
        mainColor: '#F59E0B',
        actions: [
          { id: 'chat', label: 'NEW CHAT', icon: <MessageSquare size={20} />, onClick: () => openUnified('new-chat') },
          { id: 'channel', label: 'NEW CHANNEL', icon: <Plus size={20} />, onClick: () => openUnified('new-channel') },
          { id: 'huddle', label: 'START HUDDLE', icon: <Phone size={20} />, onClick: () => router.push('/connect/calls?start=1') }]
      });
    } else {
      setConfiguration({
        isVisible: true,
        mainColor: '#F59E0B',
        actions: [
          { id: 'huddle', label: 'NEW HUDDLE', icon: <Phone size={20} />, onClick: () => openUnified('new-chat') }
        ]
      });
    }
    return () => resetConfiguration();
  }, [isUnlocked, setConfiguration, resetConfiguration, router, openUnified]);

  useEffect(() => {
    const unsubscribe = ecosystemSecurity.onStatusChange((status) => {
      setIsUnlocked(status.isUnlocked);
    });
    return unsubscribe;
  }, []);

  // Removed aggressive auto-prompt to allow browsing public huddles frictionless
  useEffect(() => {
    // No automatic prompt on load
  }, []);

  return (
    <Box sx={{ 
      display: 'flex', 
      flexDirection: 'column', 
      minHeight: '100vh', 
      bgcolor: '#0A0908',
      position: 'relative',
      pointerEvents: 'auto',
      pt: { xs: 2, md: 4 }
    }}>
        <Suspense fallback={null}>
          <ChatHandler />
        </Suspense>
        
        <Box sx={{ px: { xs: 2, md: 6 } }}>
          <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 4 }}>
            <IconButton 
              onClick={() => router.back()} 
              sx={{ 
                color: '#fff', 
                bgcolor: '#161412',
                border: '1px solid #1C1A18',
                '&:hover': { bgcolor: '#1C1A18' }
              }}
            >
              <ArrowLeft size={20} />
            </IconButton>
            <Typography variant="h5" sx={{ fontWeight: 900, fontFamily: 'var(--font-clash)', color: '#fff' }}>
              Connect Chats
            </Typography>
          </Stack>

          <ChatList />
        </Box>
    </Box>
  );
}
