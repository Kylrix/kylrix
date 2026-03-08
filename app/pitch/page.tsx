'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  Box, 
  Typography, 
  IconButton, 
  Container, 
  Stack, 
  useTheme, 
  alpha, 
  Button,
  Paper,
  Grid,
  useMediaQuery
} from '@mui/material';
import { 
  ChevronLeft, 
  ChevronRight, 
  Pause, 
  Play, 
  Shield, 
  Zap, 
  Network, 
  Brain, 
  Key,
  ArrowRight
} from 'lucide-react';
import { motion, AnimatePresence, useDragControls } from 'framer-motion';

// --- Types ---
interface SlideProps {
  id: number;
  title: string;
  subtitle: string;
  description: string;
  accent: string;
  content: React.ReactNode;
}

// --- Constants ---
const AUTO_PLAY_DURATION = 12000; // 12 seconds per slide for high information density

// --- Components ---

const ProgressBar = ({ progress, active, duration }: { progress: number, active: boolean, duration: number }) => {
  return (
    <Box sx={{ 
      height: 3, 
      flex: 1, 
      bgcolor: alpha('#fff', 0.1), 
      borderRadius: 1, 
      overflow: 'hidden',
      position: 'relative'
    }}>
      {active && (
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.1, ease: "linear" }}
          style={{ 
            height: '100%', 
            background: 'linear-gradient(90deg, #6366F1, #A855F7)',
            boxShadow: '0 0 10px rgba(99, 102, 241, 0.5)'
          }}
        />
      )}
    </Box>
  );
};

// --- Mock Live Components ---

const LiveVaultCard = () => (
  <Paper sx={{ 
    p: 3, 
    width: '100%', 
    maxWidth: 400, 
    background: 'rgba(255,255,255,0.03)', 
    border: '1px solid rgba(255,255,255,0.05)',
    position: 'relative',
    overflow: 'hidden'
  }}>
    <Box sx={{ position: 'absolute', top: -20, right: -20, width: 100, height: 100, bgcolor: alpha('#6366F1', 0.1), borderRadius: '50%', filter: 'blur(40px)' }} />
    <Stack spacing={2}>
      <Stack direction="row" spacing={1} alignItems="center">
        <Key size={18} color="#6366F1" />
        <Typography variant="caption" sx={{ fontFamily: 'var(--font-mono)', color: 'primary.main', fontWeight: 600 }}>KYLRIX_VAULT_v2</Typography>
      </Stack>
      <Box sx={{ height: 1, bgcolor: 'rgba(255,255,255,0.1)', width: '100%' }} />
      <Stack spacing={1}>
        <Typography variant="h6" sx={{ fontSize: '1.1rem' }}>Production Database Key</Typography>
        <Typography variant="body2" color="text.secondary">AES-256-GCM • Zero Knowledge</Typography>
      </Stack>
      <Box sx={{ p: 1.5, borderRadius: 1.5, bgcolor: 'rgba(0,0,0,0.3)', border: '1px dashed rgba(255,255,255,0.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="caption" sx={{ fontFamily: 'var(--font-mono)' }}>•••• •••• •••• ••••</Typography>
        <Button size="small" variant="text" sx={{ height: 24, fontSize: '0.65rem' }}>Reveal</Button>
      </Box>
    </Stack>
  </Paper>
);

const LiveFlowTask = () => (
  <Paper sx={{ 
    p: 3, 
    width: '100%', 
    maxWidth: 400, 
    background: 'rgba(255,255,255,0.03)', 
    border: '1px solid rgba(255,255,255,0.05)'
  }}>
    <Stack spacing={2}>
      <Stack direction="row" justifyContent="space-between">
        <Typography variant="caption" sx={{ p: '2px 8px', borderRadius: 4, bgcolor: alpha('#A855F7', 0.2), color: '#A855F7', fontWeight: 700 }}>URGENT</Typography>
        <Typography variant="caption" color="text.secondary">Due in 2h</Typography>
      </Stack>
      <Typography variant="h6" sx={{ fontSize: '1.2rem' }}>Finalize Q1 Architecture Review</Typography>
      <Stack direction="row" spacing={-1}>
        {[1,2,3].map(i => (
          <Box key={i} sx={{ width: 32, height: 32, borderRadius: '50%', border: '2px solid #000', bgcolor: `hsl(${i * 60}, 70%, 50%)` }} />
        ))}
        <Box sx={{ width: 32, height: 32, borderRadius: '50%', border: '2px solid #000', bgcolor: '#222', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem' }}>+5</Box>
      </Stack>
    </Stack>
  </Paper>
);

// --- Pitch Page ---

export default function PitchPage() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [progress, setProgress] = useState(0);
  const dragControls = useDragControls();

  const slides: SlideProps[] = [
    {
      id: 0,
      title: "The Universal Session",
      subtitle: "KYLRIX ACCOUNTS",
      accent: "#6366F1",
      description: "One identity, infinite possibilities. Kylrix Accounts serves as the root of trust for the entire ecosystem, enabling seamless, secure transitions between specialized apps without re-authentication.",
      content: (
        <Stack spacing={4} alignItems="center">
          <motion.div
            animate={{ 
              scale: [1, 1.05, 1],
              opacity: [0.8, 1, 0.8]
            }}
            transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
          >
            <Box sx={{ 
              width: 120, 
              height: 120, 
              borderRadius: '50%', 
              background: 'radial-gradient(circle, #6366F1 0%, transparent 70%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 0 60px rgba(99, 102, 241, 0.3)'
            }}>
              <Shield size={60} color="#fff" />
            </Box>
          </motion.div>
          <Stack spacing={1} textAlign="center">
             <Typography variant="h5" sx={{ fontWeight: 700, color: '#fff' }}>Root of Trust</Typography>
             <Typography variant="body2" color="text.secondary">Passkey-first authentication • Zero password legacy</Typography>
          </Stack>
        </Stack>
      )
    },
    {
      id: 1,
      title: "Zero-Knowledge State",
      subtitle: "KYLRIX VAULT",
      accent: "#10B981",
      description: "Security is not a feature, it's the foundation. The Vault ensures that your most sensitive credentials and keys are stored in an encrypted graph that only you can unlock.",
      content: <LiveVaultCard />
    },
    {
      id: 2,
      title: "Reactive Orchestration",
      subtitle: "KYLRIX FLOW",
      accent: "#A855F7",
      description: "Moving beyond lists to live systems. Kylrix Flow synchronizes your tasks, calendars, and work state across the ecosystem with millisecond latency.",
      content: <LiveFlowTask />
    },
    {
      id: 3,
      title: "The Pulse Architecture",
      subtitle: "KYLRIX CONNECT",
      accent: "#F59E0B",
      description: "Communication is the connective tissue of productivity. Connect uses P2P signaling and transient 'Pulse' events to keep teams in sync without data bloat.",
      content: (
        <Box sx={{ position: 'relative', height: 200, width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {[1, 2, 3].map((i) => (
            <motion.div
              key={i}
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: [0.5, 2], opacity: [0.5, 0] }}
              transition={{ duration: 2, repeat: Infinity, delay: i * 0.6 }}
              style={{
                position: 'absolute',
                width: 100,
                height: 100,
                borderRadius: '50%',
                border: '1px solid #F59E0B'
              }}
            />
          ))}
          <Network size={48} color="#F59E0B" />
        </Box>
      )
    },
    {
      id: 4,
      title: "Next-Gen Knowledge",
      subtitle: "KYLRIX NOTE",
      accent: "#EC4899",
      description: "Not just notes—intelligence. Kylrix Note leverages the entire ecosystem's graph to provide AI-enhanced context to your knowledge base.",
      content: (
        <Stack direction="row" spacing={2}>
           <Brain size={64} color="#EC4899" />
           <Stack spacing={1}>
              <Box sx={{ width: 140, height: 8, bgcolor: 'rgba(255,255,255,0.1)', borderRadius: 1 }} />
              <Box sx={{ width: 100, height: 8, bgcolor: 'rgba(255,255,255,0.1)', borderRadius: 1 }} />
              <Box sx={{ width: 120, height: 8, bgcolor: alpha('#EC4899', 0.3), borderRadius: 1 }} />
           </Stack>
        </Stack>
      )
    }
  ];

  const handleNext = useCallback(() => {
    setCurrentSlide((prev) => (prev + 1) % slides.length);
    setProgress(0);
  }, [slides.length]);

  const handlePrev = useCallback(() => {
    setCurrentSlide((prev) => (prev - 1 + slides.length) % slides.length);
    setProgress(0);
  }, [slides.length]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isPlaying) {
      interval = setInterval(() => {
        setProgress((prev) => {
          if (prev >= 100) {
            handleNext();
            return 0;
          }
          return prev + (100 / (AUTO_PLAY_DURATION / 100));
        });
      }, 100);
    }
    return () => clearInterval(interval);
  }, [isPlaying, handleNext]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') handleNext();
      if (e.key === 'ArrowLeft') handlePrev();
      if (e.key === ' ') setIsPlaying(!isPlaying);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleNext, handlePrev, isPlaying]);

  const activeSlide = slides[currentSlide];

  return (
    <Box sx={{ 
      height: '100vh', 
      width: '100vw', 
      bgcolor: '#000', 
      color: '#fff', 
      overflow: 'hidden',
      position: 'relative',
      display: 'flex',
      flexDirection: 'column'
    }}>
      {/* Background Ambience */}
      <AnimatePresence mode="wait">
        <motion.div
          key={currentSlide}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 2 }}
          style={{
            position: 'absolute',
            top: 0, left: 0, right: 0, bottom: 0,
            background: `radial-gradient(circle at 70% 30%, ${alpha(activeSlide.accent, 0.15)} 0%, transparent 70%)`,
            zIndex: 0
          }}
        />
      </AnimatePresence>

      {/* Top Progress Bar */}
      <Container maxWidth="xl" sx={{ mt: 4, zIndex: 10 }}>
        <Stack direction="row" spacing={1}>
          {slides.map((s, i) => (
            <ProgressBar 
              key={s.id} 
              progress={i === currentSlide ? progress : (i < currentSlide ? 100 : 0)} 
              active={i === currentSlide}
              duration={AUTO_PLAY_DURATION}
            />
          ))}
        </Stack>
      </Container>

      {/* Main Content */}
      <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', position: 'relative', zIndex: 5 }}>
        <Container maxWidth="xl">
          <Grid container spacing={8} alignItems="center">
            {/* Slide Text */}
            <Grid size={{ xs: 12, md: 7 }}>
              <AnimatePresence mode="wait">
                <motion.div
                  key={currentSlide}
                  initial={{ x: -20, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  exit={{ x: 20, opacity: 0 }}
                  transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                >
                  <Stack spacing={3}>
                    <Typography 
                      variant="subtitle2" 
                      sx={{ 
                        color: activeSlide.accent,
                        letterSpacing: '0.5em',
                        fontWeight: 900
                      }}
                    >
                      {activeSlide.subtitle}
                    </Typography>
                    <Typography 
                      variant="h1" 
                      sx={{ 
                        fontSize: { xs: '3rem', md: '5.5rem' },
                        lineHeight: 1,
                        textTransform: 'uppercase'
                      }}
                    >
                      {activeSlide.title.split(' ').map((word, i) => (
                        <span key={i} style={{ display: 'block' }}>{word}</span>
                      ))}
                    </Typography>
                    <Typography 
                      variant="body1" 
                      sx={{ 
                        maxWidth: 500, 
                        color: 'text.secondary',
                        fontSize: '1.25rem',
                        lineHeight: 1.6
                      }}
                    >
                      {activeSlide.description}
                    </Typography>
                    
                    <Box sx={{ pt: 4 }}>
                      <Button 
                        variant="contained" 
                        size="large"
                        endIcon={<ArrowRight />}
                        sx={{ 
                          bgcolor: activeSlide.accent, 
                          color: '#000',
                          '&:hover': {
                            bgcolor: activeSlide.accent,
                            filter: 'brightness(1.2)',
                            boxShadow: `0 0 30px ${alpha(activeSlide.accent, 0.4)}`
                          }
                        }}
                      >
                        Explore Ecosystem
                      </Button>
                    </Box>
                  </Stack>
                </motion.div>
              </AnimatePresence>
            </Grid>

            {/* Slide Visuals (Live Components) */}
            <Grid size={{ xs: 12, md: 5 }}>
              <AnimatePresence mode="wait">
                <motion.div
                  key={currentSlide}
                  initial={{ scale: 0.8, opacity: 0, rotateY: 20 }}
                  animate={{ scale: 1, opacity: 1, rotateY: 0 }}
                  exit={{ scale: 1.2, opacity: 0, rotateY: -20 }}
                  transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                  style={{ perspective: 1000 }}
                >
                  <Box sx={{ 
                    width: '100%', 
                    display: 'flex', 
                    justifyContent: 'center',
                    transform: 'translateZ(0)' // Safari fix
                  }}>
                    {activeSlide.content}
                  </Box>
                </motion.div>
              </AnimatePresence>
            </Grid>
          </Grid>
        </Container>
      </Box>

      {/* Navigation Controls */}
      <Box sx={{ p: 6, zIndex: 10 }}>
        <Container maxWidth="xl">
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Stack direction="row" spacing={2}>
              <IconButton 
                onClick={handlePrev} 
                sx={{ border: '1px solid rgba(255,255,255,0.1)', color: '#fff' }}
              >
                <ChevronLeft />
              </IconButton>
              <IconButton 
                onClick={handleNext} 
                sx={{ border: '1px solid rgba(255,255,255,0.1)', color: '#fff' }}
              >
                <ChevronRight />
              </IconButton>
            </Stack>

            <Stack direction="row" alignItems="center" spacing={4}>
              <Typography variant="caption" sx={{ fontFamily: 'var(--font-mono)', color: 'text.secondary', letterSpacing: 2 }}>
                {String(currentSlide + 1).padStart(2, '0')} / {String(slides.length).padStart(2, '0')}
              </Typography>
              <IconButton 
                onClick={() => setIsPlaying(!isPlaying)} 
                sx={{ color: '#fff' }}
              >
                {isPlaying ? <Pause size={20} /> : <Play size={20} />}
              </IconButton>
            </Stack>
          </Stack>
        </Container>
      </Box>

      {/* Swipe Overlay for Touch Devices */}
      <motion.div 
        drag="x"
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.2}
        onDragEnd={(_, info) => {
          if (info.offset.x > 100) handlePrev();
          else if (info.offset.x < -100) handleNext();
        }}
        style={{
          position: 'absolute',
          top: 0, left: 0, right: 0, bottom: 0,
          zIndex: 1,
          cursor: 'grab'
        }}
      />
    </Box>
  );
}
