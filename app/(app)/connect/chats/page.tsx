'use client';

import { UserSearch } from '@/components/search/UserSearch';
import { ChatList } from '@/components/chat/ChatList';
import { Box, Button, Stack, Typography, useMediaQuery, useTheme, Container, Paper, Grid } from '@mui/material';
import { useEffect, Suspense, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { ChatService } from '@/lib/services/chat';
import { useAuth } from '@/context/auth/AuthContext';
import { UsersService } from '@/lib/services/users';
import toast from 'react-hot-toast';
import { useSudo } from '@/context/SudoContext';
import { KeychainService } from '@/lib/appwrite/keychain';
import { ecosystemSecurity } from '@/lib/ecosystem/security';
import { MessageSquare, ShieldCheck, Search } from 'lucide-react';

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <Typography 
      variant="overline" 
      sx={{ 
        display: 'block',
        fontWeight: 900, 
        color: '#F59E0B', 
        mb: 2, 
        letterSpacing: '0.12em',
        fontFamily: 'var(--font-mono)',
        fontSize: '0.7rem'
      }}
    >
      {children}
    </Typography>
  );
}

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
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'), { noSsr: true });
  const { requestSudo } = useSudo();
  const [isUnlocked, setIsUnlocked] = useState(ecosystemSecurity.status.isUnlocked);
  const [localSearch, setLocalSearch] = useState('');

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
    <Box sx={{ 
      display: 'flex', 
      flexDirection: 'column', 
      minHeight: '100vh', 
      bgcolor: '#0A0908',
      position: 'relative',
      pointerEvents: 'auto'
    }}>
        <Suspense fallback={null}>
          <ChatHandler />
        </Suspense>
        
        {isUnlocked ? (
          <>
            {/* Header Section */}
            <Box sx={{ 
              px: { xs: 2, md: 6 }, 
              py: { xs: 4, md: 5 }, 
              display: 'flex', 
              flexDirection: { xs: 'column', md: 'row' },
              alignItems: { xs: 'stretch', md: 'flex-end' },
              justifyContent: 'space-between',
              gap: 4,
              mb: 4,
              borderBottom: '1px solid #1C1A18'
            }}>
              <Box>
                <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 1 }}>
                    <Box sx={{ p: 1, borderRadius: '12px', bgcolor: '#161412', color: '#F59E0B', border: '1px solid #1C1A18' }}>
                        <MessageSquare size={20} />
                    </Box>
                    <Typography variant="h4" sx={{ fontWeight: 900, fontFamily: 'var(--font-clash)', letterSpacing: '-0.03em', color: '#fff' }}>
                        Messages
                    </Typography>
                </Stack>
                <Typography variant="body2" sx={{ color: '#9B9691', fontWeight: 500, fontSize: '1rem' }}>
                  Secure decentralized communication across the ecosystem
                </Typography>
              </Box>

              {!isMobile && (
                <Stack direction="row" spacing={2} sx={{ width: { xs: '100%', md: 400 } }}>
                    <Box sx={{ 
                      flex: 1,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1.5,
                      bgcolor: '#161412',
                      borderRadius: '16px',
                      px: 2.5,
                      py: 1.5,
                      border: '1px solid #34322F',
                      '&:focus-within': { borderColor: '#F59E0B' }
                    }}>
                      <Search size={18} color="#9B9691" />
                      <input 
                        placeholder="Find people or groups..."
                        value={localSearch}
                        onChange={(e) => setLocalSearch(e.target.value)}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: 'white',
                          fontSize: '0.95rem',
                          outline: 'none',
                          width: '100%',
                          fontFamily: 'var(--font-satoshi)'
                        }}
                      />
                    </Box>
                </Stack>
              )}
            </Box>

            {/* Main Content Area */}
            <Container maxWidth="xl" sx={{ px: { xs: 2, md: 6 } }}>
              <Grid container spacing={6}>
                <Grid item xs={12} lg={8}>
                    <SectionTitle>Conversation History</SectionTitle>
                    <Paper elevation={0} sx={{ 
                      borderRadius: '32px', 
                      bgcolor: '#161412', 
                      border: '1px solid #1C1A18',
                      overflow: 'hidden',
                      minHeight: 500
                    }}>
                        <ChatList externalQuery={localSearch} />
                    </Paper>
                </Grid>

                {!isMobile && (
                  <Grid item lg={4}>
                      <Stack spacing={4}>
                          <Box>
                            <SectionTitle>Ecosystem Directory</SectionTitle>
                            <Paper elevation={0} sx={{ p: 4, borderRadius: '32px', bgcolor: '#161412', border: '1px solid #1C1A18', backgroundImage: 'none' }}>
                                <Typography sx={{ fontWeight: 900, mb: 3, fontSize: '1.1rem', fontFamily: 'var(--font-clash)' }}>Find People</Typography>
                                <UserSearch />
                            </Paper>
                          </Box>

                          <Paper elevation={0} sx={{ p: 4, borderRadius: '32px', bgcolor: '#0A0908', border: '1px solid #1C1A18', backgroundImage: 'none' }}>
                              <Typography variant="h6" sx={{ fontWeight: 900, mb: 1.5, fontFamily: 'var(--font-clash)', color: '#F59E0B' }}>Privacy First</Typography>
                              <Typography variant="body2" sx={{ color: '#9B9691', lineHeight: 1.6, fontWeight: 500 }}>
                                  Your messages are secured with your master password. Only you and your recipients can read them.
                              </Typography>
                          </Paper>
                      </Stack>
                  </Grid>
                )}
              </Grid>
            </Container>
          </>
        ) : (
          <Box sx={{ minHeight: '80vh', display: 'grid', placeItems: 'center', px: 3 }}>
            <Stack spacing={3} alignItems="center" sx={{ maxWidth: 420, textAlign: 'center' }}>
                <Box sx={{ p: 2, borderRadius: '24px', bgcolor: '#161412', color: '#F59E0B', border: '1px solid #1C1A18', mb: 1 }}>
                    <ShieldCheck size={48} strokeWidth={1.5} />
                </Box>
              <Typography variant="h4" sx={{ fontWeight: 900, fontFamily: 'var(--font-clash)' }}>Vault Secured</Typography>
              <Typography sx={{ color: '#9B9691', fontWeight: 500, lineHeight: 1.6 }}>
                Unlock your decentralized node to initialize secure communication channels and identity resolution.
              </Typography>
              <Button 
                variant="contained" 
                onClick={() => requestSudo({ onSuccess: () => setIsUnlocked(true) })}
                sx={{ 
                  borderRadius: '16px', 
                  px: 4, 
                  py: 1.8, 
                  fontWeight: 900,
                  bgcolor: '#F59E0B',
                  color: '#000',
                  textTransform: 'none',
                  fontSize: '1rem',
                  boxShadow: '0 12px 24px rgba(245, 158, 11, 0.15)',
                  '&:hover': { bgcolor: '#eab308', transform: 'translateY(-2px)' },
                  transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
                }}
              >
                Unlock Node
              </Button>
            </Stack>
          </Box>
        )}
    </Box>
  );
}
