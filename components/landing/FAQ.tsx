"use client";

import { Box, Container, Typography, Stack, Accordion, AccordionSummary, AccordionDetails } from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";

const faqs = [
  {
    question: "Is Kylrix Vault really secure?",
    answer:
      "Yes, Kylrix Vault uses private encryption, meaning your data is encrypted before it leaves your device. We never have access to your master password or any of your stored credentials.",
  },
  {
    question: "What happens if I forget my master password?",
    answer:
      "For security reasons, we cannot recover your master password. However, Kylrix Vault offers emergency recovery options that you can set up in advance.",
  },
  {
    question: "Can I use Kylrix Vault on all my devices?",
    answer:
      "Yes, Kylrix Vault is available on Windows, macOS, Linux, iOS, and Android. Your data syncs automatically across all your devices.",
  },
  {
    question: "Is Kylrix Vault free to use?",
    answer:
      "Kylrix Vault offers a free tier with essential features. Premium plans with advanced features start at $2.99/month.",
  },
];

export default function FAQ() {
  return (
    <Box sx={{ py: 15 }}>
      <Container maxWidth="md">
        <Box sx={{ textAlign: 'center', mb: 8 }}>
          <Typography variant="h3" sx={{ fontWeight: 900, mb: 2, fontFamily: 'var(--font-space-grotesk)' }}>
            Frequently Asked Questions
          </Typography>
          <Typography variant="body1" sx={{ color: 'rgba(255, 255, 255, 0.5)' }}>
            Everything you need to know about Kylrix Vault
          </Typography>
        </Box>

        <Stack spacing={2}>
          {faqs.map((faq, i) => (
            <Accordion key={i} sx={{ 
              bgcolor: 'rgba(255, 255, 255, 0.02)', 
              backgroundImage: 'none',
              border: '1px solid rgba(255, 255, 255, 0.05)',
              borderRadius: '20px !important',
              '&::before': { display: 'none' },
              overflow: 'hidden'
            }}>
              <AccordionSummary expandIcon={<ExpandMoreIcon sx={{ color: "rgba(255, 255, 255, 0.3)" }} />}>
                <Typography sx={{ fontWeight: 700, py: 1 }}>{faq.question}</Typography>
              </AccordionSummary>
              <AccordionDetails sx={{ borderTop: '1px solid rgba(255, 255, 255, 0.05)', pt: 3 }}>
                <Typography sx={{ color: 'rgba(255, 255, 255, 0.5)', lineHeight: 1.7 }}>{faq.answer}</Typography>
              </AccordionDetails>
            </Accordion>
          ))}
        </Stack>
      </Container>
    </Box>
  );
}
