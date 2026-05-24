'use client';

import React, { useState, useEffect } from 'react';
import { Box, Container, Typography, Grid, Paper, Stack, InputBase, Button, Avatar, IconButton } from '@mui/material';
import { ArrowLeft, Home, Send, CheckCircle2, Circle, UploadCloud, Play, RotateCcw } from 'lucide-react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface Message {
  id: string;
  user: string;
  handle: string;
  text: string;
  time: string;
}

interface Task {
  id: number;
  text: string;
  completed: boolean;
}

export default function HighContrastPage() {
  const router = useRouter();

  // 1. Chat Flow State
  const [messages, setMessages] = useState<Message[]>([
    { id: '1', user: 'auracrab', handle: '@auracrab-purple-48', text: 'Just updated note tagging to polymorphic pivots! The sweep protection is fully wired.', time: '10:42 PM' },
    { id: '2', user: 'nathfavour', handle: '@nathfavour', text: 'Outstanding. Let’s play with the high-contrast obsidian details. Make borders deep grey.', time: '10:44 PM' }
  ]);
  const [chatInput, setChatInput] = useState('');

  const handleSendMessage = () => {
    if (!chatInput.trim()) return;
    const newMsg: Message = {
      id: Date.now().toString(),
      user: 'nathfavour',
      handle: '@nathfavour',
      text: chatInput,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
    setMessages([...messages, newMsg]);
    setChatInput('');
  };

  // 2. Task Flow State
  const [tasks, setTasks] = useState<Task[]>([
    { id: 1, text: 'Define Openbricks 2.0 design framework specs', completed: true },
    { id: 2, text: 'Deploy polymorphic Appwrite pivots for tags', completed: true },
    { id: 3, text: 'Test recursive /kitchen directory route scanner', completed: false },
    { id: 4, text: 'Refactor high-contrast button offsets and border radii', completed: false }
  ]);

  const toggleTask = (id: number) => {
    setTasks(tasks.map(t => t.id === id ? { ...t, completed: !t.completed } : t));
  };

  // 3. Upload Flow State
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  const startUpload = () => {
    if (uploading) return;
    setUploading(true);
    setProgress(0);
  };

  useEffect(() => {
    if (!uploading) return;
    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          setUploading(false);
          clearInterval(interval);
          return 100;
        }
        return prev + 10;
      });
    }, 150);
    return () => clearInterval(interval);
  }, [uploading]);

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#000000', color: '#FFFFFF', py: 8, px: { xs: 2, md: 4 } }}>
      <Container maxWidth="xl">
        <Stack spacing={6}>
          
          {/* Navigation Bar */}
          <Stack direction="row" spacing={2}>
            <Button 
              onClick={() => router.back()}
              startIcon={<ArrowLeft size={16} />}
              sx={{ 
                fontFamily: 'var(--font-space-grotesk)', 
                fontWeight: 900, 
                color: '#9B9691', 
                bgcolor: '#0B0A09', 
                border: '2px solid #23211F', 
                borderRadius: '8px',
                px: 3,
                textTransform: 'none',
                boxShadow: '3px 3px 0px #000000',
                transition: 'all 0.15s ease',
                '&:hover': {
                  bgcolor: '#131110',
                  color: '#FFFFFF',
                  borderColor: '#23211F',
                  transform: 'translate(-1px, -1px)',
                  boxShadow: '4px 4px 0px #000000'
                },
                '&:active': {
                  transform: 'translate(1px, 1px)',
                  boxShadow: '2px 2px 0px #000000'
                }
              }}
            >
              Back
            </Button>
            <Link href="/kitchen" passHref legacyBehavior>
              <Button 
                component="a"
                startIcon={<Home size={16} />}
                sx={{ 
                  fontFamily: 'var(--font-space-grotesk)', 
                  fontWeight: 900, 
                  color: '#6366F1', 
                  bgcolor: '#0B0A09', 
                  border: '2px solid #3D3AA9', 
                  borderRadius: '8px',
                  px: 3,
                  textTransform: 'none',
                  boxShadow: '3px 3px 0px #000000',
                  transition: 'all 0.15s ease',
                  '&:hover': {
                    bgcolor: '#131110',
                    color: '#818CF8',
                    borderColor: '#4F46E5',
                    transform: 'translate(-1px, -1px)',
                    boxShadow: '4px 4px 0px #000000'
                  },
                  '&:active': {
                    transform: 'translate(1px, 1px)',
                    boxShadow: '2px 2px 0px #000000'
                  }
                }}
              >
                Kitchen Home
              </Button>
            </Link>
          </Stack>
          
          {/* Header */}
          <Box sx={{ borderBottom: '2px solid #23211F', pb: 3 }}>
            <Typography variant="overline" sx={{ color: '#6366F1', fontWeight: 900, letterSpacing: '0.2em', fontFamily: 'var(--font-mono)' }}>
              EXPERIMENTAL PORTAL
            </Typography>
            <Typography variant="h2" sx={{ fontWeight: 900, fontFamily: 'var(--font-outfit)', letterSpacing: '-0.04em', mt: 1, mb: 1 }}>
              High Contrast Sandbox
            </Typography>
            <Typography sx={{ opacity: 0.5, fontSize: '1rem', fontFamily: 'var(--font-satoshi)' }}>
              Zero paragraphs. Pure interactive component flows testing obsidian bevel depth, solid check states, and progressive uploads.
            </Typography>
          </Box>

          {/* Interactive Flow Grid */}
          <Grid container spacing={4}>
            
            {/* Flow 1: Ephemeral Chat/Huddle Flow */}
            <Grid size={{ xs: 12, md: 6 }}>
              <Paper sx={{ 
                p: 4, 
                bgcolor: '#000000', 
                borderRadius: '12px', 
                border: '2px solid #9B9691', 
                boxShadow: '1px 1px 0px #23211F, 2px 2px 0px #1E1B19, 3px 3px 0px #161412, 4px 4px 0px #0A0908, 5px 5px 0px #000000'
              }}>
                <Typography sx={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', fontWeight: 900, color: '#6366F1', mb: 3 }}>
                  FLOW_01 // REAL-TIME HUddLE THREAD
                </Typography>

                {/* Message Box */}
                <Stack spacing={2.5} sx={{ maxHeight: '280px', overflowY: 'auto', pr: 1, mb: 3, minHeight: '200px' }}>
                  {messages.map((msg) => (
                    <Box key={msg.id} sx={{ display: 'flex', gap: 2, alignItems: 'flex-start' }}>
                      <Avatar sx={{ bgcolor: '#131110', border: '1px solid #23211F', width: 36, height: 36, fontSize: '0.9rem', fontWeight: 900, fontFamily: 'var(--font-outfit)', color: '#6366F1' }}>
                        {msg.user[0].toUpperCase()}
                      </Avatar>
                      <Box sx={{ flexGrow: 1 }}>
                        <Stack direction="row" spacing={1} alignItems="center">
                          <Typography sx={{ fontFamily: 'var(--font-space-grotesk)', fontWeight: 700, fontSize: '0.9rem' }}>
                            {msg.user}
                          </Typography>
                          <Typography sx={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: '#9B9691' }}>
                            {msg.handle}
                          </Typography>
                          <Box sx={{ flexGrow: 1 }} />
                          <Typography sx={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: 'rgba(255,255,255,0.3)' }}>
                            {msg.time}
                          </Typography>
                        </Stack>
                        <Box sx={{ mt: 0.75, p: 1.5, bgcolor: '#131110', border: '1px solid #23211F', borderRadius: '8px', color: '#FFFFFF', fontFamily: 'var(--font-satoshi)', fontSize: '0.9rem', lineHeight: 1.4 }}>
                          {msg.text}
                        </Box>
                      </Box>
                    </Box>
                  ))}
                </Stack>

                {/* Input Well */}
                <Box sx={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  bgcolor: '#000000', 
                  border: '2px solid #4A4744', 
                  borderRadius: '8px',
                  p: 1,
                  '&:focus-within': { borderColor: '#6366F1' }
                }}>
                  <InputBase 
                    fullWidth
                    placeholder="Contribute to huddle..."
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleSendMessage(); }}
                    sx={{ color: '#FFFFFF', fontFamily: 'var(--font-space-grotesk)', fontSize: '1rem', pl: 1 }}
                  />
                  <IconButton onClick={handleSendMessage} sx={{ color: '#6366F1', p: 1 }}>
                    <Send size={18} />
                  </IconButton>
                </Box>
              </Paper>
            </Grid>

            {/* Flow 2: Dynamic Task checklist Toggle */}
            <Grid size={{ xs: 12, md: 6 }}>
              <Paper sx={{ 
                p: 4, 
                bgcolor: '#000000', 
                borderRadius: '12px', 
                border: '2px solid #9B9691', 
                boxShadow: '1px 1px 0px #23211F, 2px 2px 0px #1E1B19, 3px 3px 0px #161412, 4px 4px 0px #0A0908, 5px 5px 0px #000000'
              }}>
                <Typography sx={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', fontWeight: 900, color: '#EC4899', mb: 3 }}>
                  FLOW_02 // STate CONTROLS & CHECKLIST
                </Typography>

                <Stack spacing={2} sx={{ minHeight: '260px' }}>
                  {tasks.map((task) => (
                    <Box 
                      key={task.id} 
                      onClick={() => toggleTask(task.id)}
                      sx={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: 2, 
                        p: 2, 
                        bgcolor: task.completed ? '#0B0A09' : '#131110', 
                        border: task.completed ? '1px solid #23211F' : '1px solid #4A4744', 
                        borderRadius: '8px',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                        '&:hover': {
                          borderColor: task.completed ? '#23211F' : '#EC4899',
                          transform: 'translateX(2px)'
                        }
                      }}
                    >
                      <Box sx={{ color: task.completed ? '#10B981' : '#9B9691', display: 'flex', alignItems: 'center' }}>
                        {task.completed ? <CheckCircle2 size={20} /> : <Circle size={20} />}
                      </Box>
                      <Typography sx={{ 
                        fontFamily: 'var(--font-space-grotesk)', 
                        fontWeight: 700, 
                        fontSize: '0.95rem',
                        color: task.completed ? '#9B9691' : '#FFFFFF',
                        textDecoration: task.completed ? 'line-through' : 'none'
                      }}>
                        {task.text}
                      </Typography>
                    </Box>
                  ))}
                </Stack>
              </Paper>
            </Grid>

            {/* Flow 3: Progress upload Flow */}
            <Grid size={{ xs: 12 }}>
              <Paper sx={{ 
                p: 4, 
                bgcolor: '#000000', 
                borderRadius: '12px', 
                border: '2px solid #9B9691', 
                boxShadow: '1px 1px 0px #23211F, 2px 2px 0px #1E1B19, 3px 3px 0px #161412, 4px 4px 0px #0A0908, 5px 5px 0px #000000'
              }}>
                <Typography sx={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', fontWeight: 900, color: '#10B981', mb: 3 }}>
                  FLOW_03 // TACTILE PROGRESSIVE FILE STORAGE
                </Typography>

                <Stack direction={{ xs: 'column', md: 'row' }} spacing={4} alignItems="center">
                  
                  {/* Drop zone block */}
                  <Box sx={{ 
                    width: { xs: '100%', md: '280px' },
                    p: 4, 
                    bgcolor: '#131110', 
                    border: '2px dashed #4A4744', 
                    borderRadius: '8px', 
                    textAlign: 'center',
                    cursor: 'pointer',
                    '&:hover': { borderColor: '#10B981' }
                  }}>
                    <UploadCloud size={32} color="#9B9691" style={{ margin: '0 auto 12px' }} />
                    <Typography sx={{ fontFamily: 'var(--font-space-grotesk)', fontWeight: 700, fontSize: '0.9rem' }}>
                      Drag files or Click
                    </Typography>
                    <Typography sx={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: '#9B9691', mt: 0.5 }}>
                      MAX LIMIT: 10MB SOLID
                    </Typography>
                  </Box>

                  {/* Stepped progress details */}
                  <Box sx={{ flexGrow: 1, width: '100%' }}>
                    <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 2 }}>
                      <Button 
                        onClick={startUpload}
                        disabled={uploading}
                        startIcon={<Play size={14} />}
                        sx={{ 
                          bgcolor: '#10B981', 
                          color: '#000000', 
                          fontWeight: 900, 
                          fontFamily: 'var(--font-space-grotesk)',
                          borderRadius: '8px',
                          px: 3,
                          textTransform: 'none',
                          boxShadow: '2px 2px 0px #000000',
                          '&:hover': {
                            bgcolor: '#34D399',
                            transform: 'translate(-1px, -1px)',
                            boxShadow: '3px 3px 0px #000000'
                          },
                          '&:disabled': {
                            bgcolor: '#065F46',
                            color: 'rgba(0,0,0,0.5)',
                            boxShadow: 'none',
                            transform: 'none'
                          }
                        }}
                      >
                        {uploading ? 'Storing...' : 'Simulate Store'}
                      </Button>
                      <IconButton onClick={() => setProgress(0)} sx={{ color: '#9B9691', border: '1px solid #23211F', bgcolor: '#131110', borderRadius: '8px', p: 1 }}>
                        <RotateCcw size={16} />
                      </IconButton>
                      <Box sx={{ flexGrow: 1 }} />
                      <Typography sx={{ fontFamily: 'var(--font-mono)', fontSize: '0.85rem', fontWeight: 800 }}>
                        {progress}% COMPLETED
                      </Typography>
                    </Stack>

                    {/* Tactile segment loader bar */}
                    <Box sx={{ bgcolor: '#131110', border: '1px solid #23211F', height: '24px', borderRadius: '6px', overflow: 'hidden', p: '2px', display: 'flex', gap: '2px' }}>
                      {Array.from({ length: 10 }).map((_, idx) => {
                        const val = (idx + 1) * 10;
                        const filled = progress >= val;
                        return (
                          <Box 
                            key={idx} 
                            sx={{ 
                              flexGrow: 1, 
                              height: '100%', 
                              bgcolor: filled ? '#10B981' : '#0B0A09', 
                              border: filled ? '1px solid #000000' : 'none',
                              transition: 'background-color 0.15s ease'
                            }} 
                          />
                        );
                      })}
                    </Box>
                  </Box>

                </Stack>
              </Paper>
            </Grid>

          </Grid>

          {/* Solid Footing */}
          <Box sx={{ textAlign: 'center', py: 3, opacity: 0.4, fontFamily: 'var(--font-mono)', fontSize: '0.75rem', borderTop: '2px solid #23211F' }}>
            OPENBRICKS 2.0 • INTERACTIVE HUddLE & CONTROLS SANDBOX • VER 2.0
          </Box>

        </Stack>
      </Container>
    </Box>
  );
}
