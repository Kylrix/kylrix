'use client';

import { Avatar, Badge, Box, Typography, alpha } from '@mui/material';
import { AnimatePresence, motion } from 'framer-motion';
import { Lock, MessageCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';

export interface ChatIslandNotification {
  id: string;
  senderName: string;
  content: string;
  avatar?: string;
  isEncrypted: boolean;
}

interface ChatIslandPresenceProps {
  notification: ChatIslandNotification | null;
  onDismiss: () => void;
}

/**
 * The animated dynamic-island notification surface. Lives in its own chunk because
 * framer-motion is ~50KB+ gzipped and pulling it into the always-mounted
 * ChatNotificationProvider would tax every authenticated page even when no
 * notification is ever shown.
 *
 * Mount this only when there is an active notification (or has ever been one in the
 * session) so the lazy chunk is fetched on first chat event, not on initial paint.
 */
export default function ChatIslandPresence({ notification, onDismiss }: ChatIslandPresenceProps) {
  const router = useRouter();

  return (
    <AnimatePresence>
      {notification && (
        <Box
          sx={{
            position: 'fixed',
            top: 20,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 9999,
            pointerEvents: 'none',
          }}
        >
          <motion.div
            initial={{ opacity: 0, y: -100, scale: 0.8 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -100, scale: 0.8 }}
            transition={{ type: 'spring', damping: 18, stiffness: 150 }}
          >
            <Box
              sx={{
                minWidth: 200,
                maxWidth: 400,
                bgcolor: 'rgba(10, 10, 10, 0.9)',
                backdropFilter: 'blur(20px) saturate(180%)',
                borderRadius: '30px',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                boxShadow: '0 20px 40px rgba(0,0,0,0.6), 0 0 20px rgba(99, 102, 241, 0.2)',
                p: 1,
                px: 2,
                display: 'flex',
                alignItems: 'center',
                gap: 1.5,
                pointerEvents: 'auto',
                cursor: 'pointer',
              }}
              onClick={() => {
                router.push(`/connect/chat/${notification.id}`);
                onDismiss();
              }}
            >
              <Badge
                overlap="circular"
                anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                badgeContent={
                  notification.isEncrypted ? (
                    <Box
                      sx={{
                        bgcolor: '#6366F1',
                        borderRadius: '50%',
                        p: 0.2,
                        display: 'flex',
                        border: '1px solid #000',
                      }}
                    >
                      <Lock size={8} color="white" />
                    </Box>
                  ) : null
                }
              >
                <Avatar
                  src={notification.avatar}
                  sx={{
                    width: 32,
                    height: 32,
                    bgcolor: alpha('#6366F1', 0.2),
                    color: '#6366F1',
                    fontWeight: 800,
                    fontSize: '0.8rem',
                  }}
                >
                  {notification.senderName[0]}
                </Avatar>
              </Badge>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography
                  variant="caption"
                  sx={{
                    fontWeight: 900,
                    color: '#6366F1',
                    display: 'block',
                    lineHeight: 1,
                    mb: 0.5,
                    textTransform: 'uppercase',
                    letterSpacing: 0.5,
                  }}
                >
                  {notification.senderName}
                </Typography>
                <Typography
                  variant="body2"
                  noWrap
                  sx={{
                    color: 'white',
                    fontWeight: 600,
                    fontSize: '0.85rem',
                    opacity: 0.9,
                  }}
                >
                  {notification.content}
                </Typography>
              </Box>
              <Box
                sx={{
                  bgcolor: alpha('#6366F1', 0.1),
                  p: 0.8,
                  borderRadius: '50%',
                  display: 'flex',
                }}
              >
                <MessageCircle size={16} color="#6366F1" />
              </Box>
            </Box>
          </motion.div>
        </Box>
      )}
    </AnimatePresence>
  );
}
