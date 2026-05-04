import Link from "next/link";
import { Button, Box, Typography, Container } from "@mui/material";

export default function NotFound() {
  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        bgcolor: 'background.default',
        p: 3
      }}
    >
      <Container maxWidth="sm" sx={{ textAlign: 'center' }}>
        <Typography
          variant="h1"
          sx={{
            mb: 2,
            fontFamily: 'var(--font-mono)',
            textTransform: 'uppercase',
            letterSpacing: 'tight',
            color: 'primary.main'
          }}
        >
          Page Not Found
        </Typography>
        <Typography
          variant="body1"
          sx={{
            color: 'text.secondary',
            mb: 4,
            fontWeight: 500
          }}
        >
          The page you are looking for does not exist within the Kylrix Vault.
        </Typography>
        <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center' }}>
          <Button
            component={Link}
            href="/"
            variant="outlined"
            sx={{ borderColor: 'divider' }}
          >
            Home
          </Button>
          <Button
            component={Link}
            href="/dashboard"
            variant="contained"
          >
            Go to Dashboard
          </Button>
        </Box>
      </Container>
    </Box>
  );
}
