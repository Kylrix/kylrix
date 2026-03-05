'use client';

import React from 'react';
import { 
  Box, 
  Container, 
  Typography, 
  Stack, 
  Divider, 
  alpha,
  useTheme
} from '@mui/material';
import Navbar from '@/components/Navbar';
import DocsSidebar from '@/components/layout/DocsSidebar';
import { CodeBlock } from '@/components/ui/DocsUI';

export default function FlowPage() {
  const theme = useTheme();

  return (
    <Box component="main" sx={{ pt: { xs: 8, md: 10 } }}>
      <Navbar />
      <div className="bg-mesh" />
      
      <DocsSidebar />
      
      <Box sx={{ ml: { xs: 0, md: '300px' }, pt: { xs: 8, md: 12 }, pb: 20 }}>
        <Container maxWidth="lg">
          <Stack spacing={8} sx={{ px: { xs: 2, md: 8 } }}>
            <Box>
              <Typography variant="subtitle2" sx={{ color: '#6366F1', mb: 3, fontWeight: 900, letterSpacing: '0.3em' }}>CORE SYSTEMS</Typography>
              <Typography variant="h1" sx={{ mb: 4, fontWeight: 900, fontSize: { xs: '2.5rem', md: '4rem' } }}>Flow <br /> Orchestration.</Typography>
              <Typography variant="subtitle1" sx={{ maxWidth: 800, opacity: 0.6, fontSize: '1.25rem', lineHeight: 1.7 }}>
                The action engine of the Kylrix ecosystem, orchestrating tasks, calendars, and real-time work states.
              </Typography>
            </Box>

            <Divider sx={{ borderColor: alpha(theme.palette.text.primary, 0.05) }} />

            <Box>
              <Typography variant="h2" sx={{ mb: 4, fontWeight: 900 }}>The Pulse Mechanism</Typography>
              <Typography variant="body1" sx={{ opacity: 0.7, mb: 4, lineHeight: 1.8 }}>
                Flow leverages the <strong>Pulse</strong> system to broadcast live updates. Whether it's starting a focus session or updating a task's priority, the state change is broadcasted across all active apps.
              </Typography>
              
              <Box sx={{ p: 4, bgcolor: 'rgba(255,255,255,0.02)', borderRadius: 4, border: '1px solid rgba(255,255,255,0.05)', mb: 6 }}>
                <Typography variant="h6" sx={{ mb: 2, fontWeight: 700 }}>Reactive Tasks</Typography>
                <Typography variant="body2" sx={{ opacity: 0.6, lineHeight: 1.8 }}>
                  Unlike traditional task managers, Flow is reactive. Any client (Web, Mobile, CLI) can trigger a task update, and all other clients will receive the signal instantly without polling.
                </Typography>
              </Box>
            </Box>

            <Box>
              <Typography variant="h2" sx={{ mb: 4, fontWeight: 900 }}>SDK Implementation</Typography>
              <Typography variant="body1" sx={{ opacity: 0.7, mb: 4, lineHeight: 1.8 }}>
                High-level orchestration for tasks and focus sessions.
              </Typography>
              
              <CodeBlock 
                languages={{
                  typescript: `// TypeScript: Create a task and listen for updates
await sdk.flow.createTask(DB_ID, TABLE_ID, {
  title: "Build the mobile client",
  priority: "high"
});

sdk.flow.onTaskUpdate(DB_ID, PULSE_TABLE_ID, (task) => {
  console.log("Task updated via Pulse:", task);
});`,
                  dart: `// Dart / Flutter: Creating a reactive task
await sdk.flow.createTask(
  databaseId: DB_ID,
  tableId: TABLE_ID,
  title: "Build the mobile client",
  priority: "high"
);

sdk.flow.onTaskUpdate(
  databaseId: DB_ID,
  pulseTableId: PULSE_TABLE_ID
).listen((task) {
  print("Task update received: $task");
});`,
                  go: `// Go: Simple task creation
sdk.Flow.CreateTask(DB_ID, TABLE_ID, map[string]interface{}{
  "title": "Build the CLI",
  "priority": "high",
})`,
                  python: `# Python: Background task creation
sdk.flow.create_task(DB_ID, TABLE_ID, {
    "title": "Clean up logs",
    "priority": "low"
})`
                }}
              />
            </Box>
          </Stack>
        </Container>
      </Box>
    </Box>
  );
}
