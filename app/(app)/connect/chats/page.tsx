'use client';

import { AppShell } from '@/components/layout/AppShell';
import { UserSearch } from '@/components/search/UserSearch';
import { ChatList } from '@/components/chat/ChatList';
import ChatQuickActionsFab from '@/components/chat/ChatQuickActionsFab';
import { Box, Button, Stack, Typography, useMediaQuery, useTheme } from '@mui/material';
import { useEffect, Suspense, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { ChatService } from '@/lib/services/chat';
import { useAuth } from '@/lib/auth';
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
  const [checkedSudoOnMount, setCheckedSudoOnMount] = useState(false);

  useEffect(() => {
    if (userId && user) {
      const initChat = async () => {
        try {
          await UsersService.ensureProfileForUser(user);

          // Fetch target profile to check for publicKey
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
          if (!actualTargetUserId) {
            toast.error("User ID missing from profile.");
            router.replace('/chats');
            return;
          }

          const existing = await ChatService.getConversations(user.$id);
          const found = existing.rows.find(
            (c: any) => c.type === 'direct' && c.participants.includes(actualTargetUserId)
          );

          if (found) {
            router.push(`/chat/${found.$id}`);
            return;
          }

          // Ensure Sudo is unlocked before creating (needed for E2E keys)
          // Additionally: if the vault is locked and there is no masterpass yet,
          // requestSudo should open in 'initialize' intent so the modal redirects
          // to the vault setup flow.
          if (ecosystemSecurity.status.isUnlocked) {
            try {
              await ecosystemSecurity.ensureE2EIdentity(user.$id);
              const newConv = await ChatService.createConversation([user.$id, actualTargetUserId], 'direct');
              router.push(`/chat/${newConv.$id}`);
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
                  router.push(`/chat/${newConv.$id}`);
                } catch (err: any) {
                  console.error("Failed to create chat:", err);
                  toast.error(`Failed to create chat: ${err?.message || 'Unknown error'}`);
                  router.replace('/chats');
                }
              },
              onCancel: () => {
                router.replace('/chats');
              }
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

  // Page-mount Sudo enforcement: when navigating to /chats (no specific userId),
  // ensure the vault state is enforced:
  // - if unlocked => no modal
  // - if locked and masterpass exists => show SudoModal for verification
  // - if locked and no masterpass => show SudoModal with intent 'initialize' so it redirects to setup
  useEffect(() => {
    const runCheck = async () => {
      if (!user?.$id || checkedSudoOnMount) return;

      // If already unlocked, nothing to do
      if (ecosystemSecurity.status.isUnlocked) {
        void UsersService.ensureProfileForUser(user).catch((error) => {
          console.warn('[Chats] Background profile bootstrap failed:', error);
        });
        setCheckedSudoOnMount(true);
        return;
      }

      try {
        const hasMaster = await KeychainService.hasMasterpass(user.$id);
        requestSudo({
          intent: hasMaster ? undefined : 'initialize',
          onSuccess: () => {
            void UsersService.ensureProfileForUser(user).catch((error) => {
              console.warn('[Chats] Background profile bootstrap failed:', error);
            });
            setCheckedSudoOnMount(true);
          },
          onCancel: () => {
            // If the user cancels verification/setup, send them to the home page
            setCheckedSudoOnMount(true);
            router.replace('/');
          }
        });
      } catch (e) {
        console.error('Failed to check masterpass on mount', e);
        setCheckedSudoOnMount(true);
      }
    };

    runCheck();
  }, [user?.$id, user, checkedSudoOnMount, requestSudo, router]);

  return (
    null
  );
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

  return (
        <AppShell>
        <Suspense fallback={null}>
          <ChatHandler />
        </Suspense>
        <Box sx={{ position: 'relative', height: '100%' }}>
        {isUnlocked ? (
          <Box
            sx={{
              display: 'flex',
              height: '100%',
            }}
          >
            {isMobile && (
                <Box sx={{
                    width: '100%',
                    borderRight: 0,
                    display: 'flex',
                    flexDirection: 'column'
                }}>
                    <ChatList />
                </Box>
            )}
            {!isMobile && (
                <Box sx={{ flex: 1, p: 3 }}>
                  <Typography variant="h5" fontWeight="bold" mb={3}>Find People</Typography>
                  <UserSearch />
                </Box>
            )}
          </Box>
        ) : (
          <Box
            sx={{
              minHeight: '70vh',
              display: 'grid',
              placeItems: 'center',
              px: 3,
            }}
          >
            <Stack spacing={2} alignItems="center" sx={{ maxWidth: 420, textAlign: 'center' }}>
              <Typography variant="h4" fontWeight={900}>Vault Locked</Typography>
              <Typography sx={{ opacity: 0.7 }}>
                Unlock the Vault before chats, identities, or self-chat can initialize.
              </Typography>
              <Button variant="contained" onClick={() => requestSudo({ onSuccess: () => undefined })}>
                Unlock Vault
              </Button>
            </Stack>
          </Box>
        )}
        {!isUnlocked && (
          <Box
            aria-hidden
            sx={{
              position: 'absolute',
              inset: 0,
              zIndex: 1,
              pointerEvents: 'none',
              bgcolor: 'rgba(10, 9, 8, 0.28)',
              backdropFilter: 'blur(14px)',
            }}
          />
        )}
        <ChatQuickActionsFab hidden={!isUnlocked} />
      </Box>
    </AppShell>
  );
}
