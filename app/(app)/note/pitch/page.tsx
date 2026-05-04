'use client';

import { useState, useEffect, useCallback } from 'react';
import { Box, Typography, Stack, IconButton, Container } from '@mui/material';
import { 
  ArrowBackIosNew as ArrowLeftIcon, 
  ArrowForwardIos as ArrowRightIcon 
} from '@mui/icons-material';

const slides = [
  {
    id: 1,
    title: "Kylrix Note",
    subtitle: "AI × Secure Intelligence",
    content: (
      <Stack spacing={6} alignItems="center">
        <Box 
          sx={{ 
            width: 160, 
            height: 160, 
            mx: 'auto', 
            background: 'linear-gradient(135deg, #6366F1 0%, #00D1FF 100%)',
            borderRadius: '50%', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            fontSize: '5rem',
            boxShadow: '0 20px 40px rgba(99, 102, 241, 0.3)',
            animation: 'pulse 2s infinite ease-in-out',
            '@keyframes pulse': {
              '0%': { transform: 'scale(1)', boxShadow: '0 20px 40px rgba(99, 102, 241, 0.3)' },
              '50%': { transform: 'scale(1.05)', boxShadow: '0 25px 50px rgba(99, 102, 241, 0.5)' },
              '100%': { transform: 'scale(1)', boxShadow: '0 20px 40px rgba(99, 102, 241, 0.3)' }
            }
          }}
        >
          🧠
        </Box>
        
        <Box 
          sx={{ 
            display: 'grid', 
            gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)' }, 
            gap: 3, 
            maxWidth: 896, 
            width: '100%',
            mx: 'auto' 
          }}
        >
          {[
            { val: '73%', label: 'Want AI Notes', colors: ['#6366F1', '#00D1FF'] },
            { val: '$4.5M', label: 'Breach Cost', colors: ['#00D1FF', '#A855F7'] },
            { val: '0', label: 'AI+Security', colors: ['#A855F7', '#EC4899'] }
          ].map((stat, i) => (
            <Box 
              key={i}
              sx={{ 
                textAlign: 'center', 
                p: 3, 
                bgcolor: 'rgba(255, 255, 255, 0.05)', 
                backdropFilter: 'blur(10px)', 
                borderRadius: '24px', 
                border: '1px solid rgba(255, 255, 255, 0.1)' 
              }}
            >
              <Typography 
                variant="h3" 
                sx={{ 
                  fontWeight: 900, 
                  fontFamily: 'var(--font-space-grotesk)',
                  background: `linear-gradient(90deg, ${stat.colors[0]}, ${stat.colors[1]})`,
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent'
                }}
              >
                {stat.val}
              </Typography>
              <Typography variant="h6" sx={{ opacity: 0.8, fontWeight: 600 }}>
                {stat.label}
              </Typography>
            </Box>
          ))}
        </Box>
        
        <Typography 
          variant="h4" 
          sx={{ 
            fontWeight: 300, 
            opacity: 0.9, 
            maxWidth: 672, 
            mx: 'auto',
            textAlign: 'center'
          }}
        >
          The first <Box component="span" sx={{ fontWeight: 900, background: 'linear-gradient(90deg, #6366F1, #A855F7)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>AI-powered notes</Box> platform
        </Typography>
      </Stack>
    )
  },
  {
    id: 2,
    title: "The Problem",
    subtitle: "Security vs Intelligence",
    content: (
      <Box 
        sx={{ 
          display: 'grid', 
          gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, 
          gap: 8, 
          alignItems: 'center', 
          maxWidth: 1152, 
          mx: 'auto' 
        }}
      >
        <Stack spacing={4}>
          <Box 
            sx={{ 
              bgcolor: 'rgba(239, 68, 68, 0.1)', 
              border: '1px solid rgba(239, 68, 68, 0.2)', 
              borderRadius: '32px', 
              p: 4, 
              backdropFilter: 'blur(10px)' 
            }}
          >
            <Typography variant="h2" sx={{ mb: 2 }}>⚠️</Typography>
            <Typography variant="h5" sx={{ fontWeight: 900, mb: 2, fontFamily: 'var(--font-space-grotesk)' }}>Traditional Notes</Typography>
            <Stack spacing={1}>
              <Typography variant="h6" sx={{ opacity: 0.9 }}>• Data breaches</Typography>
              <Typography variant="h6" sx={{ opacity: 0.9 }}>• No AI enhancement</Typography>
              <Typography variant="h6" sx={{ opacity: 0.9 }}>• Centralized control</Typography>
            </Stack>
          </Box>
          
          <Box 
            sx={{ 
              bgcolor: 'rgba(234, 179, 8, 0.1)', 
              border: '1px solid rgba(234, 179, 8, 0.2)', 
              borderRadius: '32px', 
              p: 4, 
              backdropFilter: 'blur(10px)' 
            }}
          >
            <Typography variant="h2" sx={{ mb: 2 }}>🤖</Typography>
            <Typography variant="h5" sx={{ fontWeight: 900, mb: 2, fontFamily: 'var(--font-space-grotesk)' }}>AI Tools</Typography>
            <Stack spacing={1}>
              <Typography variant="h6" sx={{ opacity: 0.9 }}>• Privacy concerns</Typography>
              <Typography variant="h6" sx={{ opacity: 0.9 }}>• Data mining</Typography>
              <Typography variant="h6" sx={{ opacity: 0.9 }}>• Limited features</Typography>
            </Stack>
          </Box>
        </Stack>
        
        <Box sx={{ textAlign: 'center' }}>
          <Typography variant="h1" sx={{ mb: 4, animation: 'pulse 2s infinite' }}>💔</Typography>
          <Typography variant="h4" sx={{ fontWeight: 900, mb: 3, fontFamily: 'var(--font-space-grotesk)' }}>Choose One:</Typography>
          <Stack spacing={1.5}>
            <Typography variant="h5" sx={{ opacity: 0.8 }}>🛡️ Security</Typography>
            <Typography variant="h3" sx={{ fontWeight: 900, color: '#6366F1' }}>OR</Typography>
            <Typography variant="h5" sx={{ opacity: 0.8 }}>🧠 Intelligence</Typography>
          </Stack>
        </Box>
      </Box>
    )
  },
  {
    id: 3,
    title: "Our Solution",
    subtitle: "Best of Both Worlds",
    content: (
      <Stack spacing={8} alignItems="center">
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', position: 'relative' }}>
          <Box 
            sx={{ 
              width: 192, 
              height: 192, 
              borderRadius: '50%', 
              background: 'linear-gradient(135deg, #6366F1 0%, #00D1FF 100%)', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center', 
              boxShadow: '0 20px 40px rgba(99, 102, 241, 0.4)',
              zIndex: 2
            }}
          >
            <Box sx={{ textAlign: 'center', color: 'black' }}>
              <Typography variant="h3" sx={{ mb: 1 }}>🧠</Typography>
              <Typography variant="h6" sx={{ fontWeight: 900 }}>AI Layer</Typography>
            </Box>
          </Box>
          
          <Box 
            sx={{ 
              position: 'absolute', 
              width: 96, 
              height: 4, 
              background: 'linear-gradient(90deg, #6366F1, #A855F7)', 
              animation: 'pulse 1.5s infinite',
              zIndex: 1
            }} 
          />
          
          <Box 
            sx={{ 
              width: 192, 
              height: 192, 
              borderRadius: '50%', 
              background: 'linear-gradient(135deg, #A855F7 0%, #EC4899 100%)', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center', 
              ml: 12, 
              boxShadow: '0 20px 40px rgba(168, 85, 247, 0.4)',
              zIndex: 2
            }}
          >
            <Box sx={{ textAlign: 'center', color: 'white' }}>
              <Typography variant="h3" sx={{ mb: 1 }}>🔗</Typography>
              <Typography variant="h6" sx={{ fontWeight: 900 }}>Security</Typography>
            </Box>
          </Box>
        </Box>
        
        <Box sx={{ textAlign: 'center' }}>
          <Typography 
            variant="h3" 
            sx={{ 
              fontWeight: 900, 
              mb: 3, 
              fontFamily: 'var(--font-space-grotesk)',
              background: 'linear-gradient(90deg, #6366F1, #A855F7)', 
              WebkitBackgroundClip: 'text', 
              WebkitTextFillColor: 'transparent' 
            }}
          >
            = Secure Intelligence
          </Typography>
          <Typography variant="h5" sx={{ opacity: 0.9, maxWidth: 672, mx: 'auto', fontWeight: 500 }}>
            AI enhances your thoughts while powerful encryption protects them
          </Typography>
        </Box>
      </Stack>
    )
  },
  {
    id: 4,
    title: "Core Features",
    subtitle: "Advanced Technology",
    content: (
      <Box 
        sx={{ 
          display: 'grid', 
          gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, 
          gap: 4, 
          maxWidth: 960, 
          mx: 'auto' 
        }}
      >
        {[
          { icon: '🤖', title: 'Multi-AI Engine', desc: 'GPT-4.1, Gemini, auto-failover', colors: ['rgba(99, 102, 241, 0.1)', 'rgba(0, 209, 255, 0.1)'] },
          { icon: '🔐', title: 'End-to-End Encryption', desc: 'Military-grade security', colors: ['rgba(168, 85, 247, 0.1)', 'rgba(236, 72, 153, 0.1)'] },
          { icon: '⚡', title: 'Smart Automation', desc: 'Auto-tagging, enhancement', colors: ['rgba(59, 130, 246, 0.1)', 'rgba(168, 85, 247, 0.1)'] },
          { icon: '🌍', title: 'Universal Access', desc: 'Web, mobile, desktop', colors: ['rgba(236, 72, 153, 0.1)', 'rgba(239, 68, 68, 0.1)'] }
        ].map((feature, i) => (
          <Box 
            key={i}
            sx={{ 
              background: `linear-gradient(135deg, ${feature.colors[0]}, ${feature.colors[1]})`, 
              backdropFilter: 'blur(10px)', 
              border: '1px solid rgba(255, 255, 255, 0.1)', 
              borderRadius: '32px', 
              p: 4, 
              transition: 'all 0.5s ease',
              '&:hover': { transform: 'scale(1.05)', borderColor: '#6366F1' }
            }}
          >
            <Typography variant="h2" sx={{ mb: 2 }}>{feature.icon}</Typography>
            <Typography variant="h5" sx={{ fontWeight: 900, mb: 1.5, fontFamily: 'var(--font-space-grotesk)' }}>{feature.title}</Typography>
            <Typography variant="h6" sx={{ opacity: 0.9, fontWeight: 500 }}>{feature.desc}</Typography>
          </Box>
        ))}
      </Box>
    )
  },
  {
    id: 5,
    title: "Market Opportunity",
    subtitle: "$135B+ TAM",
    content: (
      <Stack spacing={6} alignItems="center">
        <Box 
          sx={{ 
            display: 'grid', 
            gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)' }, 
            gap: 4, 
            maxWidth: 1024, 
            width: '100%',
            mx: 'auto' 
          }}
        >
          {[
            { val: '$45B', label: 'Note-taking', colors: ['#6366F1', '#00D1FF'] },
            { val: '$67B', label: 'AI Software', colors: ['#00D1FF', '#A855F7'] },
            { val: '$23B', label: 'Security', colors: ['#A855F7', '#EC4899'] }
          ].map((market, i) => (
            <Box 
              key={i}
              sx={{ 
                textAlign: 'center', 
                p: 4, 
                bgcolor: 'rgba(255, 255, 255, 0.05)', 
                backdropFilter: 'blur(10px)', 
                borderRadius: '32px', 
                border: '1px solid rgba(255, 255, 255, 0.1)' 
              }}
            >
              <Typography 
                variant="h2" 
                sx={{ 
                  fontWeight: 900, 
                  fontFamily: 'var(--font-space-grotesk)',
                  background: `linear-gradient(90deg, ${market.colors[0]}, ${market.colors[1]})`,
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent'
                }}
              >
                {market.val}
              </Typography>
              <Typography variant="h5" sx={{ opacity: 0.8, mt: 1, fontWeight: 700 }}>
                {market.label}
              </Typography>
            </Box>
          ))}
        </Box>
        
        <Box 
          sx={{ 
            display: 'grid', 
            gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, 
            gap: 4, 
            maxWidth: 896, 
            width: '100%',
            mx: 'auto' 
          }}
        >
          <Box 
            sx={{ 
              background: 'linear-gradient(135deg, rgba(34, 197, 94, 0.1), rgba(16, 185, 129, 0.1))', 
              backdropFilter: 'blur(10px)', 
              border: '1px solid rgba(255, 255, 255, 0.1)', 
              borderRadius: '32px', 
              p: 3 
            }}
          >
            <Typography variant="h4" sx={{ mb: 1.5 }}>🎯</Typography>
            <Typography variant="h6" sx={{ fontWeight: 900, mb: 1, fontFamily: 'var(--font-space-grotesk)' }}>First Mover</Typography>
            <Typography variant="body1" sx={{ opacity: 0.9, fontWeight: 500 }}>No AI+Security notes exist</Typography>
          </Box>
          
          <Box 
            sx={{ 
              background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.1), rgba(6, 182, 212, 0.1))', 
              backdropFilter: 'blur(10px)', 
              border: '1px solid rgba(255, 255, 255, 0.1)', 
              borderRadius: '32px', 
              p: 3 
            }}
          >
            <Typography variant="h4" sx={{ mb: 1.5 }}>💰</Typography>
            <Typography variant="h6" sx={{ fontWeight: 900, mb: 1, fontFamily: 'var(--font-space-grotesk)' }}>Revenue Model</Typography>
            <Typography variant="body1" sx={{ opacity: 0.9, fontWeight: 500 }}>Freemium + Enterprise</Typography>
          </Box>
        </Box>
      </Stack>
    )
  },
  {
    id: 6,
    title: "Traction",
    subtitle: "Building Momentum",
    content: (
      <Box 
        sx={{ 
          display: 'grid', 
          gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)' }, 
          gap: 4, 
          maxWidth: 1024, 
          mx: 'auto' 
        }}
      >
        {[
          { icon: '🚀', title: 'Live', desc: 'Product deployed', colors: ['rgba(34, 197, 94, 0.1)', 'rgba(16, 185, 129, 0.1)'], text: '#4ade80' },
          { icon: '👥', title: 'Users', desc: 'Growing community', colors: ['rgba(59, 130, 246, 0.1)', 'rgba(6, 182, 212, 0.1)'], text: '#60a5fa' },
          { icon: '🏆', title: 'Awards', desc: 'Tech recognition', colors: ['rgba(168, 85, 247, 0.1)', 'rgba(236, 72, 153, 0.1)'], text: '#c084fc' }
        ].map((item, i) => (
          <Box 
            key={i}
            sx={{ 
              textAlign: 'center', 
              p: 4, 
              background: `linear-gradient(135deg, ${item.colors[0]}, ${item.colors[1]})`, 
              backdropFilter: 'blur(10px)', 
              border: '1px solid rgba(255, 255, 255, 0.1)', 
              borderRadius: '32px' 
            }}
          >
            <Typography variant="h2" sx={{ mb: 2 }}>{item.icon}</Typography>
            <Typography 
              variant="h3" 
              sx={{ 
                fontWeight: 900, 
                mb: 1, 
                fontFamily: 'var(--font-space-grotesk)',
                color: item.text
              }}
            >
              {item.title}
            </Typography>
            <Typography variant="h6" sx={{ opacity: 0.9, fontWeight: 600 }}>{item.desc}</Typography>
          </Box>
        ))}
      </Box>
    )
  },
  {
    id: 7,
    title: "Join Us",
    subtitle: "Shape the Future",
    content: (
      <Stack spacing={6} alignItems="center">
        <Box 
          sx={{ 
            width: 128, 
            height: 128, 
            mx: 'auto', 
            background: 'linear-gradient(135deg, #6366F1 0%, #A855F7 100%)',
            borderRadius: '50%', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            fontSize: '4rem',
            boxShadow: '0 20px 40px rgba(99, 102, 241, 0.3)',
            animation: 'pulse 2s infinite ease-in-out'
          }}
        >
          🚀
        </Box>
        
        <Box 
          sx={{ 
            display: 'grid', 
            gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)' }, 
            gap: 3, 
            maxWidth: 896, 
            width: '100%',
            mx: 'auto' 
          }}
        >
          {[
            { icon: '💰', title: 'Investors', desc: '$2M seed', colors: ['rgba(34, 197, 94, 0.1)', 'rgba(16, 185, 129, 0.1)'] },
            { icon: '🤝', title: 'Partners', desc: 'Strategic alliances', colors: ['rgba(59, 130, 246, 0.1)', 'rgba(6, 182, 212, 0.1)'] },
            { icon: '⭐', title: 'Talent', desc: 'Join our team', colors: ['rgba(168, 85, 247, 0.1)', 'rgba(236, 72, 153, 0.1)'] }
          ].map((item, i) => (
            <Box 
              key={i}
              sx={{ 
                textAlign: 'center', 
                p: 3, 
                background: `linear-gradient(135deg, ${item.colors[0]}, ${item.colors[1]})`, 
                backdropFilter: 'blur(10px)', 
                border: '1px solid rgba(255, 255, 255, 0.1)', 
                borderRadius: '32px' 
              }}
            >
              <Typography variant="h4" sx={{ mb: 1.5 }}>{item.icon}</Typography>
              <Typography variant="h6" sx={{ fontWeight: 900, mb: 0.5, fontFamily: 'var(--font-space-grotesk)' }}>{item.title}</Typography>
              <Typography variant="body1" sx={{ opacity: 0.9, fontWeight: 500 }}>{item.desc}</Typography>
            </Box>
          ))}
        </Box>
        
        <Stack direction="row" spacing={3}>
          <Box 
            component="a" 
            href="https://kylrix.space" 
            sx={{ 
              display: 'inline-block', 
              background: 'linear-gradient(90deg, #6366F1, #A855F7)', 
              color: 'black', 
              px: 5, 
              py: 2, 
              borderRadius: '50px', 
              fontSize: '1.25rem', 
              fontWeight: 900, 
              textDecoration: 'none',
              transition: 'all 0.3s', 
              '&:hover': { transform: 'scale(1.1)', boxShadow: '0 10px 30px rgba(99, 102, 241, 0.4)' } 
            }}
          >
            Try Now →
          </Box>
          <Box 
            component="a" 
            href="mailto:team@kylrix.space" 
            sx={{ 
              display: 'inline-block', 
              bgcolor: 'rgba(255, 255, 255, 0.05)', 
              backdropFilter: 'blur(10px)', 
              border: '1px solid rgba(255, 255, 255, 0.2)', 
              color: 'white', 
              px: 5, 
              py: 2, 
              borderRadius: '50px', 
              fontSize: '1.25rem', 
              fontWeight: 900, 
              textDecoration: 'none',
              transition: 'all 0.3s', 
              '&:hover': { transform: 'scale(1.1)', bgcolor: 'rgba(255, 255, 255, 0.1)' } 
            }}
          >
            Contact Us
          </Box>
        </Stack>
        
        <Typography 
          variant="h5" 
          sx={{ 
            fontWeight: 300, 
            opacity: 0.9, 
            maxWidth: 672, 
            mx: 'auto',
            textAlign: 'center'
          }}
        >
          The future of knowledge is <Box component="span" sx={{ fontWeight: 900, background: 'linear-gradient(90deg, #6366F1, #A855F7)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>secure, intelligent, and yours</Box>
        </Typography>
      </Stack>
    )
  }
];

export default function PitchPage() {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);

  const goToSlide = useCallback((index: number) => {
    if (index >= 0 && index < slides.length && !isTransitioning) {
      setIsTransitioning(true);
      setTimeout(() => {
        setCurrentSlide(index);
        setIsTransitioning(false);
      }, 150);
    }
  }, [isTransitioning]);

  const nextSlide = useCallback(() => {
    if (currentSlide < slides.length - 1) {
      goToSlide(currentSlide + 1);
    }
  }, [currentSlide, goToSlide]);

  const prevSlide = useCallback(() => {
    if (currentSlide > 0) {
      goToSlide(currentSlide - 1);
    }
  }, [currentSlide, goToSlide]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown' || e.key === ' ') {
        e.preventDefault();
        nextSlide();
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault();
        prevSlide();
      } else if (e.key >= '1' && e.key <= '7') {
        e.preventDefault();
        goToSlide(parseInt(e.key) - 1);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [currentSlide, nextSlide, prevSlide, goToSlide]);

  const currentSlideData = slides[currentSlide];

  return (
    <Box 
      sx={{ 
        height: '100vh', 
        bgcolor: '#0a0a0a', 
        color: 'white', 
        overflow: 'hidden', 
        position: 'relative',
        background: 'radial-gradient(circle at 50% 50%, #1a1a1a 0%, #0a0a0a 100%)'
      }}
    >
      {/* Enhanced Background Effects */}
      <Box 
        sx={{
          position: 'absolute',
          inset: 0,
          opacity: 0.4,
          pointerEvents: 'none',
          background: `
            radial-gradient(circle at 20% 80%, rgba(99, 102, 241, 0.15) 0%, transparent 50%),
            radial-gradient(circle at 80% 20%, rgba(168, 85, 247, 0.15) 0%, transparent 50%),
            radial-gradient(circle at 40% 40%, rgba(236, 72, 153, 0.1) 0%, transparent 50%)
          `
        }}
      />
      
      {/* Animated Grid Background */}
      <Box 
        sx={{
          position: 'absolute',
          inset: 0,
          backgroundImage: 'linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px)',
          backgroundSize: '50px 50px',
          pointerEvents: 'none'
        }}
      />
      
      {/* Main Content */}
      <Box 
        sx={{
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          p: 4,
          zIndex: 10,
          position: 'relative',
          transition: 'all 0.3s ease',
          opacity: isTransitioning ? 0 : 1,
          transform: isTransitioning ? 'scale(0.95)' : 'scale(1)'
        }}
      >
        <Container maxWidth="xl">
          <Box sx={{ textAlign: 'center' }}>
            <Typography 
              variant="h1" 
              sx={{ 
                fontSize: { xs: '3.5rem', md: '6rem' }, 
                fontWeight: 900, 
                mb: 2, 
                fontFamily: 'var(--font-space-grotesk)',
                background: 'linear-gradient(90deg, #fff, #6366F1, #A855F7)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                letterSpacing: '-0.02em'
              }}
            >
              {currentSlideData.title}
            </Typography>
            <Typography 
              variant="h4" 
              sx={{ 
                opacity: 0.8, 
                mb: 8, 
                fontWeight: 300, 
                letterSpacing: '0.1em',
                textTransform: 'uppercase'
              }}
            >
              {currentSlideData.subtitle}
            </Typography>
            {currentSlideData.content}
          </Box>
        </Container>
      </Box>
      
      {/* Navigation Arrows */}
      <IconButton
        onClick={prevSlide}
        disabled={currentSlide === 0}
        sx={{
          position: 'absolute',
          left: 32,
          top: '50%',
          transform: 'translateY(-50%)',
          width: 64,
          height: 64,
          bgcolor: 'rgba(255, 255, 255, 0.05)',
          backdropFilter: 'blur(20px)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          color: 'white',
          zIndex: 20,
          '&:hover': { bgcolor: 'rgba(255, 255, 255, 0.1)', transform: 'translateY(-50%) scale(1.1)' },
          '&.Mui-disabled': { opacity: 0.2 }
        }}
      >
        <ArrowLeftIcon />
      </IconButton>
      
      <IconButton
        onClick={nextSlide}
        disabled={currentSlide === slides.length - 1}
        sx={{
          position: 'absolute',
          right: 32,
          top: '50%',
          transform: 'translateY(-50%)',
          width: 64,
          height: 64,
          bgcolor: 'rgba(255, 255, 255, 0.05)',
          backdropFilter: 'blur(20px)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          color: 'white',
          zIndex: 20,
          '&:hover': { bgcolor: 'rgba(255, 255, 255, 0.1)', transform: 'translateY(-50%) scale(1.1)' },
          '&.Mui-disabled': { opacity: 0.2 }
        }}
      >
        <ArrowRightIcon />
      </IconButton>
      
      {/* Slide Indicators */}
      <Stack 
        direction="row" 
        spacing={1.5} 
        sx={{ 
          position: 'absolute', 
          bottom: 32, 
          left: '50%', 
          transform: 'translateX(-50%)', 
          zIndex: 20 
        }}
      >
        {slides.map((_, index) => (
          <Box
            key={index}
            component="button"
            onClick={() => goToSlide(index)}
            sx={{
              width: 12,
              height: 12,
              borderRadius: '50%',
              border: 'none',
              cursor: 'pointer',
              transition: 'all 0.3s',
              bgcolor: currentSlide === index ? 'white' : 'rgba(255, 255, 255, 0.3)',
              transform: currentSlide === index ? 'scale(1.3)' : 'scale(1)',
              '&:hover': { bgcolor: 'rgba(255, 255, 255, 0.6)' }
            }}
          />
        ))}
      </Stack>
      
      {/* Slide Counter */}
      <Box 
        sx={{ 
          position: 'absolute', 
          top: 32, 
          right: 32, 
          bgcolor: 'rgba(255, 255, 255, 0.05)', 
          backdropFilter: 'blur(20px)', 
          border: '1px solid rgba(255, 255, 255, 0.1)', 
          borderRadius: '50px', 
          px: 3, 
          py: 1, 
          zIndex: 20 
        }}
      >
        <Typography variant="h6" sx={{ fontWeight: 800, fontFamily: 'monospace' }}>
          {currentSlide + 1} / {slides.length}
        </Typography>
      </Box>
      
      {/* Instructions */}
      <Typography 
        variant="caption" 
        sx={{ 
          position: 'absolute', 
          bottom: 32, 
          right: 32, 
          opacity: 0.5, 
          zIndex: 20,
          fontWeight: 700,
          letterSpacing: '0.1em'
        }}
      >
        USE ARROWS OR 1-7 KEYS
      </Typography>
    </Box>
  );
}