'use client';

import Link from "next/link";
import Button from "@mui/material/Button";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Container from "@mui/material/Container";

export default function NotFound() {
  return (
    <Box
      sx={{
        minHeight: '70vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        p: 3
      }}
    >
      <Container maxWidth="sm" sx={{ textAlign: 'center' }}>
        <Typography
          variant="h1"
          sx={{
            fontSize: { xs: '5rem', md: '8rem' },
            fontWeight: 900,
            mb: 2,
            background: 'linear-gradient(45deg, #00F0FF 30%, #7000FF 90%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            lineHeight: 1
          }}
        >
          404
        </Typography>
        <Typography variant="h4" sx={{ fontWeight: 700, mb: 3, color: 'white' }}>
          Lost in the flow?
        </Typography>
        <Typography variant="body1" sx={{ color: 'rgba(255, 255, 255, 0.6)', mb: 5 }}>
          The task or page you are looking for does not exist or has been moved to a different timeline.
        </Typography>
        <Link href="/" passHref style={{ textDecoration: 'none' }}>
          <Button
            variant="contained"
            size="large"
            sx={{
              borderRadius: '12px',
              px: 4,
              py: 1.5,
              fontWeight: 700,
              bgcolor: '#00F0FF',
              color: 'black',
              '&:hover': { bgcolor: '#00D1DA' }
            }}
          >
            Return Home
          </Button>
        </Link>
      </Container>
    </Box>
  );
}
