'use client';

import React, { useState, useEffect, useRef } from 'react';
import { 
  Dialog, 
  DialogContent, 
  Box, 
  Typography, 
  TextField, 
  IconButton, 
  CircularProgress,
  alpha,
  Paper,
  Slide,
  type SlideProps
} from '@mui/material';
import { 
  AutoAwesome as WandIcon, 
  Close as CloseIcon,
  Send as SendIcon,
  SmartToy as RobotIcon,
  Person as PersonIcon
} from '@mui/icons-material';
import { useAI, AIChatMessage } from '@/hooks/useAI';
import { motion, AnimatePresence } from 'framer-motion';

const Transition = React.forwardRef(function Transition(
  props: SlideProps & {
    children: React.ReactElement<any, any>;
  },
  ref: React.Ref<unknown>,
) {
  return <Slide direction="up" ref={ref} {...props} />;
});

interface AICommandModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AICommandModal: React.FC<AICommandModalProps> = ({ isOpen, onClose }) => {
  const [prompt, setPrompt] = useState('');
  const [history, setHistory] = useState<AIChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { generate } = useAI();
  const chatEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [history]);

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!prompt.trim() || isLoading) return;

    const userMessage: AIChatMessage = { role: 'user', content: prompt };
    setHistory(prev => [...prev, userMessage]);
    setPrompt('');
    setIsLoading(true);

    try {
      const result = await generate(prompt, { 
        history: history,
        systemInstruction: "You are Kylrixbot. Act as a high-end, intelligent note-taking companion. Be concise, insightful, and respect the user's privacy. When helping move from thought to note, offer structure. Always maintain the 'Quiet Power' persona."
      });
      
      const assistantMessage: AIChatMessage = { role: 'assistant', content: result };
      setHistory(prev => [...prev, assistantMessage]);
    } catch (error: any) {
      console.error('AI Error:', error);
      setHistory(prev => [...prev, { role: 'assistant', content: 'Forgive me, my cognitive link was interrupted. Please try again.' }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog 
      open={isOpen} 
      onClose={onClose}
      maxWidth="md"
      fullWidth
      TransitionComponent={Transition}
      PaperProps={{
        sx: {
          bgcolor: 'rgba(10, 10, 10, 0.98)',
          backdropFilter: 'blur(25px) saturate(180%)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: '32px',
          backgroundImage: 'none',
          boxShadow: '0 24px 64px rgba(0,0,0,0.8)',
          overflow: 'hidden',
          maxHeight: '85vh'
        }
      }}
    >
      <DialogContent sx={{ p: 0, display: 'flex', flexDirection: 'column', height: '100%' }}>
        {/* Header */}
        <Box sx={{ 
          p: 3, 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between',
          borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
          bgcolor: 'rgba(255, 255, 255, 0.02)'
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <WandIcon sx={{ color: '#F59E0B', fontSize: 24 }} />
            <Typography variant="h6" sx={{ fontWeight: 800, letterSpacing: '-0.02em', color: 'white' }}>
              Cognitive Link
            </Typography>
          </Box>
          <IconButton onClick={onClose} sx={{ color: 'rgba(255, 255, 255, 0.4)' }}>
            <CloseIcon />
          </IconButton>
        </Box>

        {/* Chat Area */}
        <Box sx={{ 
          flexGrow: 1, 
          overflowY: 'auto', 
          p: 3, 
          display: 'flex', 
          flexDirection: 'column', 
          gap: 2,
          minHeight: '400px'
        }}>
          {history.length === 0 && (
            <Box sx={{ 
              display: 'flex', 
              flexDirection: 'column', 
              alignItems: 'center', 
              justifyContent: 'center', 
              height: '100%', 
              opacity: 0.5,
              mt: 4
            }}>
              <RobotIcon sx={{ fontSize: 64, mb: 2, color: 'rgba(255, 255, 255, 0.1)' }} />
              <Typography variant="body2" align="center" sx={{ maxWidth: '300px' }}>
                Enter the cognitive flow. Ask me to structure your thoughts, summarize notes, or brainstorm.
              </Typography>
            </Box>
          )}

          <AnimatePresence>
            {history.map((msg, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                style={{
                  display: 'flex',
                  justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
                  width: '100%'
                }}
              >
                <Box sx={{ 
                  display: 'flex', 
                  flexDirection: msg.role === 'user' ? 'row-reverse' : 'row',
                  gap: 1.5,
                  maxWidth: '85%'
                }}>
                  <Avatar 
                    sx={{ 
                      width: 32, 
                      height: 32, 
                      bgcolor: msg.role === 'user' ? 'rgba(255, 255, 255, 0.05)' : alpha('#F59E0B', 0.1),
                      border: '1px solid',
                      borderColor: msg.role === 'user' ? 'rgba(255, 255, 255, 0.1)' : alpha('#F59E0B', 0.2)
                    }}
                  >
                    {msg.role === 'user' ? <PersonIcon sx={{ fontSize: 18 }} /> : <WandIcon sx={{ fontSize: 18, color: '#F59E0B' }} />}
                  </Avatar>
                  <Paper sx={{ 
                    p: 2, 
                    borderRadius: msg.role === 'user' ? '20px 2px 20px 20px' : '2px 20px 20px 20px',
                    bgcolor: msg.role === 'user' ? 'rgba(255, 255, 255, 0.03)' : 'rgba(245, 158, 11, 0.02)',
                    border: '1px solid',
                    borderColor: msg.role === 'user' ? 'rgba(255, 255, 255, 0.05)' : alpha('#F59E0B', 0.1),
                    backgroundImage: 'none'
                  }}>
                    <Typography variant="body2" sx={{ lineHeight: 1.6, color: 'rgba(255, 255, 255, 0.9)' }}>
                      {msg.content}
                    </Typography>
                  </Paper>
                </Box>
              </motion.div>
            ))}
          </AnimatePresence>
          {isLoading && (
            <Box sx={{ display: 'flex', gap: 1.5 }}>
              <Avatar 
                sx={{ 
                  width: 32, 
                  height: 32, 
                  bgcolor: alpha('#F59E0B', 0.1),
                  border: '1px solid',
                  borderColor: alpha('#F59E0B', 0.2)
                }}
              >
                <CircularProgress size={16} sx={{ color: '#F59E0B' }} />
              </Avatar>
              <Paper sx={{ 
                px: 2, 
                py: 1.5, 
                borderRadius: '2px 20px 20px 20px',
                bgcolor: 'rgba(245, 158, 11, 0.02)',
                border: '1px solid',
                borderColor: alpha('#F59E0B', 0.1),
                backgroundImage: 'none'
              }}>
                 <Box sx={{ display: 'flex', gap: 0.5 }}>
                    {[0, 1, 2].map((i) => (
                      <motion.div
                        key={i}
                        animate={{ opacity: [0.3, 1, 0.3] }}
                        transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.2 }}
                        style={{ width: 4, height: 4, borderRadius: '50%', backgroundColor: '#F59E0B' }}
                      />
                    ))}
                 </Box>
              </Paper>
            </Box>
          )}
          <div ref={chatEndRef} />
        </Box>

        {/* Input Area */}
        <Box sx={{ p: 3, borderTop: '1px solid rgba(255, 255, 255, 0.05)' }}>
          <form onSubmit={handleSubmit}>
            <TextField 
              fullWidth
              multiline
              maxRows={4}
              placeholder="Structure my thoughts about the project..."
              value={prompt}
              onChange={ (e) => setPrompt(e.target.value)}
              onKeyDown={ (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit();
                }
              }}
              sx={{
                '& .MuiOutlinedInput-root': {
                  bgcolor: 'rgba(255, 255, 255, 0.02)',
                  borderRadius: '16px',
                  color: 'white',
                  pr: 1,
                  '& fieldset': { borderColor: 'rgba(255, 255, 255, 0.1)' },
                  '&:hover fieldset': { borderColor: 'rgba(255, 255, 255, 0.2)' },
                  '&.Mui-focused fieldset': { borderColor: '#F59E0B' }
                }
              }}
              InputProps={{
                endAdornment: (
                  <IconButton 
                    disabled={!prompt.trim() || isLoading}
                    type="submit"
                    sx={{ 
                      color: '#F59E0B',
                      '&.Mui-disabled': { color: 'rgba(255, 255, 255, 0.1)' }
                    }}
                  >
                    <SendIcon />
                  </IconButton>
                )
              }}
            />
          </form>
          <Typography variant="caption" sx={{ display: 'block', mt: 1.5, color: 'rgba(255, 255, 255, 0.3)', textAlign: 'center' }}>
            Powered by KylrixAI • Results may vary based on context
          </Typography>
        </Box>
      </DialogContent>
    </Dialog>
  );
};

const Avatar = ({ sx, children }: { sx?: any, children?: React.ReactNode }) => (
  <Box sx={{ 
    display: 'flex', 
    alignItems: 'center', 
    justifyContent: 'center', 
    borderRadius: '12px',
    flexShrink: 0,
    ...sx 
  }}>
    {children}
  </Box>
);
