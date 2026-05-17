'use client';

import { UserSearch } from '@/components/search/UserSearch';
import { ChatList } from '@/components/chat/ChatList';
import { Box, Button, Stack, Typography, useMediaQuery, useTheme } from '@mui/material';
import { useEffect, Suspense, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { ChatService } from '@/lib/services/chat';
import { useAuth } from '@/context/auth/AuthContext';
import { UsersService } from '@/lib/services/users';
import toast from 'react-hot-toast';
import { useSudo } from '@/context/SudoContext';
import { KeychainService } from '@/lib/appwrite/keychain';
import { ecosystemSecurity } from '@/lib/ecosystem/security';

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
            router.replace('/chats');
            return;
          }

          if (!targetProfile.publicKey) {
            toast.error(`${targetProfile.displayName || targetProfile.username} hasn't set up their account for secure chatting yet.`);
            router.replace('/chats');
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
              router.replace('/chats');
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
                  router.replace('/chats');
                }
              },
              onCancel: () => router.replace('/chats')
            });
          }
        } catch (e) {
          console.error("Failed to auto-init chat", e);
          toast.error("Failed to initialize chat.");
          router.replace('/chats');
        }
      };
      initChat();
    }
  }, [userId, user, router, requestSudo]);

  return null;
}

export default function Home() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'), { noSsr: true });
  const { requestSudo } = useSudo();
  const [isUnlocked, setIsUnlocked] = useState(ecosystemSecurity.status.isUnlocked);

  useEffect(() => {
    const unsubscribe = ecosystemSecurity.onStatusChange((status) => {
      setIsUnlocked(status.isUnlocked);
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!isUnlocked) {
      requestSudo({ onSuccess: () => setIsUnlocked(true) });
    }
  }, [isUnlocked, requestSudo]);

  return (
    <Box sx={{ position: 'relative', height: '100%', pointerEvents: 'auto' }}>
        <Suspense fallback={null}>
          <ChatHandler />
        </Suspense>
        
        {isUnlocked ? (
          <Box sx={{ display: 'flex', height: '100%' }}>
            {isMobile ? (
                <Box sx={{ width: '100%', display: 'flex', flexDirection: 'column' }}>
                    <ChatList />
                </Box>
            ) : (
                <Box sx={{ flex: 1, p: 3 }}>
                  <Typography variant="h5" fontWeight="bold" mb={3}>Find People</Typography>
                  <UserSearch />
                </Box>
            )}
          </Box>
        ) : (
          <Box sx={{ minHeight: '70vh', display: 'grid', placeItems: 'center', px: 3 }}>
            <Stack spacing={2} alignItems="center" sx={{ maxWidth: 420, textAlign: 'center' }}>
              <Typography variant="h4" fontWeight={900}>Vault Locked</Typography>
              <Typography sx={{ opacity: 0.7 }}>
                Unlock the Vault before chats, identities, or self-chat can initialize.
              </Typography>
              <Button variant="contained" onClick={() => requestSudo({ onSuccess: () => setIsUnlocked(true) })}>
                Unlock Vault
              </Button>
            </Stack>
          </Box>
        )}
    </Box>
  );
}
