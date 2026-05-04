"use client";

import { Box, Container, Typography, IconButton, Stack, Link as MuiLink } from '@mui/material';
import Link from 'next/link';
import { GitHub, Twitter, LinkedIn, Facebook } from '@mui/icons-material';
import { motion } from 'framer-motion';

const footerLinks = {
  product: [
    { name: 'Features', href: '/#features' },
    { name: 'Pricing', href: '/pricing' },
    { name: 'Security', href: '/security' },
    { name: 'Enterprise', href: '/enterprise' },
  ],
  resources: [
    { name: 'Documentation', href: '/docs' },
    { name: 'API Reference', href: '/api' },
    { name: 'Status', href: '/status' },
  ],
  company: [
    { name: 'About Us', href: '/about' },
    { name: 'Careers', href: '/careers' },
    { name: 'Contact', href: '/contact' },
    { name: 'Privacy Policy', href: '/privacy' },
  ],
  download: [
    { name: 'iOS App', href: '#' },
    { name: 'Android App', href: '#' },
    { name: 'Desktop App', href: '#' },
    { name: 'Browser Extension', href: '#' },
  ],
};

export default function Footer() {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5, delay: 0.2 }}>
      <Box
        component="footer"
        sx={{
          bgcolor: 'rgba(10, 10, 10, 0.95)',
          backdropFilter: 'blur(25px) saturate(180%)',
          py: 8,
          borderTop: '1px solid rgba(255, 255, 255, 0.1)',
          position: 'relative',
          zIndex: 10,
        }}
      >
        <Container maxWidth="lg">
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: 'repeat(4, 1fr)' },
              gap: 6,
            }}
          >
            {Object.entries(footerLinks).map(([category, links]) => (
              <Box key={category}>
                <Typography
                  variant="subtitle1"
                  sx={{ 
                    fontWeight: 900, 
                    textTransform: 'uppercase',
                    letterSpacing: '0.1em',
                    fontFamily: '"Space Grotesk", sans-serif',
                    color: '#6366F1',
                    mb: 3
                  }}
                >
                  {category}
                </Typography>
                <Stack spacing={1.5}>
                  {links.map((link) => (
                    <MuiLink
                      key={link.name}
                      href={link.href}
                      component={Link}
                      sx={{
                        color: 'rgba(255, 255, 255, 0.6)',
                        textDecoration: 'none',
                        fontSize: '0.9rem',
                        transition: 'all 0.2s ease',
                        '&:hover': { 
                          color: '#6366F1',
                          transform: 'translateX(4px)'
                        },
                      }}
                    >
                      {link.name}
                    </MuiLink>
                  ))}
                </Stack>
              </Box>
            ))}
          </Box>

          <Box
            sx={{
              mt: 8,
              pt: 4,
              borderTop: '1px solid rgba(255, 255, 255, 0.05)',
              display: 'flex',
              flexDirection: { xs: 'column', sm: 'row' },
              gap: 3,
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <Typography 
              variant="body2" 
              sx={{ 
                color: 'rgba(255, 255, 255, 0.4)',
                fontFamily: 'var(--font-satoshi), sans-serif'
              }}
            >
              © {new Date().getFullYear()} WhisperNote. All rights reserved.
            </Typography>
            <Stack direction="row" spacing={1}>
              {[
                { icon: <GitHub />, label: 'GitHub' },
                { icon: <Twitter />, label: 'Twitter' },
                { icon: <LinkedIn />, label: 'LinkedIn' },
                { icon: <Facebook />, label: 'Facebook' }
              ].map((social, index) => (
                <IconButton 
                  key={index}
                  sx={{ 
                    color: 'rgba(255, 255, 255, 0.6)',
                    transition: 'all 0.2s ease',
                    '&:hover': { 
                      color: '#6366F1',
                      bgcolor: 'rgba(99, 102, 241, 0.1)',
                      transform: 'translateY(-2px)'
                    }
                  }}
                  size="small" 
                  component={motion.button} 
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.95 }}
                >
                  {social.icon}
                </IconButton>
              ))}
            </Stack>
          </Box>
        </Container>
      </Box>
    </motion.div>
  );
}
