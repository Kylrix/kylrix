"use client";

import { Box, Container, Typography, Grid, Paper, Stack } from "@mui/material";
import StarIcon from "@mui/icons-material/Star";

const VAULT_PRIMARY = "#10B981";

const testimonials = [
  {
    quote:
      "Kylrix Vault app has completely transformed how I manage my online security. I finally feel safe online.",
    name: "Sarah Johnson",
    role: "Software Developer",
    stars: 5,
  },
  {
    quote:
      "The best password manager I've used. Simple, secure, and works everywhere I need it to.",
    name: "Michael Chen",
    role: "Security Consultant",
    stars: 5,
  },
  {
    quote:
      "I was hesitant to use a password manager, but Kylrix Vault made it so easy. Now I can't imagine life without it.",
    name: "Elena Rodriguez",
    role: "Digital Marketer",
    stars: 5,
  },
];

export default function Testimonials() {
  return (
    <Box sx={{ py: 15, bgcolor: 'rgba(255, 255, 255, 0.01)' }}>
      <Container maxWidth="lg">
        <Box sx={{ textAlign: 'center', mb: 10 }}>
          <Typography variant="h3" sx={{ fontWeight: 900, mb: 2, fontFamily: 'var(--font-space-grotesk)' }}>
            Trusted by Thousands
          </Typography>
          <Typography variant="h6" sx={{ color: 'rgba(255, 255, 255, 0.5)' }}>
            See what our users have to say about Kylrix Vault.
          </Typography>
        </Box>

        <Grid container spacing={4}>
          {testimonials.map((t, i) => (
            <Grid size={{ xs: 12, md: 4 }} key={i}>
              <Paper sx={{ 
                p: 5, 
                height: '100%', 
                borderRadius: '28px', 
                bgcolor: 'rgba(10, 10, 10, 0.5)', 
                border: '1px solid rgba(255, 255, 255, 0.05)',
                backgroundImage: 'none',
                position: 'relative'
              }}>
                <Stack direction="row" spacing={0.5} sx={{ mb: 3 }}>
                  {[...Array(t.stars)].map((_, j) => (
                    <StarIcon key={j} sx={{ fontSize: 18, color: VAULT_PRIMARY }} />
                  ))}
                </Stack>
                <Typography variant="body1" sx={{ fontStyle: 'italic', mb: 4, color: 'rgba(255, 255, 255, 0.8)', lineHeight: 1.7 }}>
                  &quot;{t.quote}&quot;
                </Typography>
                <Box>
                  <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>{t.name}</Typography>
                  <Typography variant="caption" sx={{ color: 'rgba(255, 255, 255, 0.4)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{t.role}</Typography>
                </Box>
              </Paper>
            </Grid>
          ))}
        </Grid>
      </Container>
    </Box>
  );
}
