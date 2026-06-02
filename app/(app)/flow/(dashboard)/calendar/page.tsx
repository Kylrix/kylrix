import CalendarView from '@/components/calendar/CalendarView';
import { Suspense } from 'react';
import { Box, CircularProgress } from '@/lib/mui-tailwind/material';

export default function CalendarPage() {
  return (
    <Suspense
      fallback={
        <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <CircularProgress />
        </Box>
      }
    >
      <CalendarView />
    </Suspense>
  );
}
