"use client";

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Drawer, Box, Typography, TextField, Button, CircularProgress, useTheme, useMediaQuery } from '@mui/material';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import SendIcon from '@mui/icons-material/Send';
import { useAI } from '@/context/AIContext';
import { toast } from 'react-hot-toast';

export function AIModal({ onClose }: { onClose: () => void }) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const { sendCommand, isLoading, openGlobalCreateModal } = useAI();
  const [prompt, setPrompt] = useState("");
  const [response, setResponse] = useState<string | null>(null);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim()) return;

    setResponse(null);
    try {
      const result = await sendCommand(prompt);
      
      if (result.action === "UNKNOWN") {
        setResponse(result.response || "I'm not sure how to help with that.");
      } else {
        handleAction(result);
        setPrompt(""); // clear input on success
      }
    } catch {
      setResponse("Sorry, I couldn't process that request.");
    }
  };

  const handleAction = (cmd: { action: string; data?: unknown }) => {
    const data = cmd.data as { target?: string; name?: string; url?: string } | undefined;
    switch (cmd.action) {
      case "NAVIGATE":
        if (data?.target) {
            const target = data.target.toLowerCase();
            const validPaths = ["/vault", "/vault/settings", "/vault/import", "/vault/totp", "/vault/sharing", "/vault/credentials/new"];
            const finalPath = validPaths.find(p => p.includes(target)) || "/vault";
            router.push(finalPath);
            onClose();
            toast.success(`Navigating to ${target}...`);
        }
        break;

      case "CREATE_CREDENTIAL":
        try {
            openGlobalCreateModal({ name: data?.name, url: data?.url });
            onClose();
            toast.success("Opening new credential form...");
        } catch {
            const params = new URLSearchParams();
            if (data?.name) params.set("name", data.name);
            if (data?.url) params.set("url", data.url);
            router.push(`/credentials/new?${params.toString()}`);
            onClose();
        }
        break;
        
      case "GENERATE_PASSWORD":
        setResponse("I can't generate the password directly, but I've opened the generator for you.");
        break;
    }
  };

  return (
    <Drawer 
      anchor={isMobile ? 'bottom' : 'right'}
      open={true} 
      onClose={onClose}
      PaperProps={{
        sx: {
          width: isMobile ? '100%' : 'min(100vw, 500px)',
          maxWidth: '100%',
          height: isMobile ? 'auto' : '100%',
          maxHeight: isMobile ? '92dvh' : '100%',
          borderRadius: isMobile ? '24px 24px 0 0' : '0',
          bgcolor: 'rgba(10, 10, 10, 0.8)',
          backdropFilter: 'blur(20px) saturate(180%)',
          border: '1px solid',
          borderColor: 'rgba(255, 255, 255, 0.08)',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
          backgroundImage: 'none',
          display: 'flex',
          flexDirection: 'column',
        }
      }}
    >
      <Box sx={{ p: 4, display: 'flex', flexDirection: 'column', gap: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
           <AutoAwesomeIcon sx={{ fontSize: 24, color: '#00F0FF' }} />
           <Typography variant="h6" sx={{ fontWeight: 800, fontFamily: 'var(--font-space-grotesk)' }}>
             AI Commander
           </Typography>
        </Box>

        <Box sx={{ 
          p: 2.5, 
          borderRadius: '16px', 
          bgcolor: 'rgba(0, 240, 255, 0.03)', 
          border: '1px solid',
          borderColor: 'rgba(0, 240, 255, 0.1)'
        }}>
          <Typography variant="body2" sx={{ fontWeight: 700, color: '#00F0FF', mb: 1 }}>
            How can I help?
          </Typography>
          <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', lineHeight: 1.6 }}>
            Try natural commands like:
            <br/>
            • &quot;Add a login for Netflix&quot;
            <br/>
            • &quot;Go to my Settings&quot;
            <br/>
            • &quot;Organize my vault&quot;
          </Typography>
        </Box>

        {response && (
          <Box sx={{ 
            p: 2, 
            borderRadius: '12px', 
            bgcolor: 'rgba(255, 255, 255, 0.03)', 
            border: '1px solid',
            borderColor: 'rgba(255, 255, 255, 0.08)',
            animation: 'fadeIn 0.3s ease-out'
          }}>
            <Typography variant="body2" sx={{ color: 'text.primary', whiteSpace: 'pre-wrap' }}>
              {response}
            </Typography>
          </Box>
        )}

        <Box component="form" onSubmit={handleSubmit} sx={{ display: 'flex', gap: 1.5, pt: 1 }}>
          <TextField
            fullWidth
            size="small"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Type your command..."
            disabled={isLoading}
            autoFocus
            sx={{
              '& .MuiOutlinedInput-root': {
                borderRadius: '12px',
                bgcolor: 'rgba(255, 255, 255, 0.02)',
                '& fieldset': { borderColor: 'rgba(255, 255, 255, 0.1)' },
                '&:hover fieldset': { borderColor: 'rgba(255, 255, 255, 0.2)' },
                '&.Mui-focused fieldset': { borderColor: 'primary.main' }
              }
            }}
          />
          <Button 
            type="submit" 
            variant="contained" 
            disabled={isLoading || !prompt.trim()}
            sx={{ 
              minWidth: 48, 
              width: 48, 
              height: 40, 
              borderRadius: '12px',
              p: 0
            }}
          >
            {isLoading ? (
              <CircularProgress size={20} sx={{ color: 'background.default' }} />
            ) : (
              <SendIcon sx={{ fontSize: 18 }} />
            )}
          </Button>
        </Box>
      </Box>
    </Drawer>
  );
}
