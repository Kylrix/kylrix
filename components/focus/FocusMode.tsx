'use client';

import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Button,
  CircularProgress,
  IconButton,
  Paper,
  Stack,
  Dialog,
  DialogTitle,
  DialogContent,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  ListItemIcon,
  useTheme,
  Chip,
  alpha,
} from '@mui/material';
import {
  PlayArrow,
  Pause,
  Stop,
  Fullscreen,
  FullscreenExit,
  CheckCircle,
  RadioButtonUnchecked,
  AutoFixHigh as AutoFixHighIcon,
} from '@mui/icons-material';
import { useTask } from '@/context/TaskContext';
import { Task } from '@/types';
import { focusSessions } from '@/lib/kylrixflow';
import { useAI } from '@/hooks/useAI';
import { tablesDB } from '@/lib/appwrite/client';

export default function FocusMode() {
  const theme = useTheme();
  const { tasks, updateTask, userId } = useTask();
  const [isActive, setIsActive] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [timeLeft, setTimeLeft] = useState(25 * 60); // 25 minutes default
  const [initialTime, setInitialTime] = useState(25 * 60);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [isTaskDialogOpen, setIsTaskDialogOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // AI Integration
  const { generate } = useAI();
  const [isRefining, setIsRefining] = useState(false);

  const handleRefineGoal = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!selectedTask) return;
    setIsRefining(true);
    try {
        const duration = Math.floor(initialTime / 60);
        const prompt = `Refine the goal '${selectedTask.title}' into a specific, measurable objective for a ${duration}-minute session. Return ONLY the refined goal string.`;
        const result = await generate(prompt);
        const refinedTitle = result.trim();
        updateTask(selectedTask.id, { title: refinedTitle });
    } catch (error: unknown) {
        console.error("Failed to refine goal", error);
    } finally {
        setIsRefining(false);
    }
  };

  // Removed Origin specific useEffects, moved to component


  useEffect(() => {
    let interval: NodeJS.Timeout;

    if (isActive && !isPaused && timeLeft > 0) {
      interval = setInterval(() => {
        setTimeLeft((prev) => prev - 1);
      }, 1000);
    } else if (timeLeft === 0) {
      setIsActive(false);
      // Save completed session
         if (selectedTask) {
         const duration = Math.floor(initialTime / 60);
         focusSessions.create({
             startTime: new Date(Date.now() - initialTime * 1000).toISOString(),
             endTime: new Date().toISOString(),
             duration: duration,
             taskId: selectedTask.id,
             status: 'completed',
               userId: userId || 'guest',
         }).catch(console.error);
      }
    }

    return () => clearInterval(interval);
  }, [isActive, isPaused, timeLeft, selectedTask, initialTime, userId]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const toggleTimer = async () => {
    if (!isActive) {
      setIsActive(true);
      setIsPaused(false);
      // Bridge: Update presence in Connect
      if (userId) {
        tablesDB.updateRow({
          databaseId: 'chat',
          tableId: 'users',
          rowId: userId,
          data: {
            presence: 'busy',
            statusMessage: 'In Focus Mode (Kylrix Flow)'
          }
        }).catch(() => { /* Connect might not be initialized for this user */ });
      }
    } else {
      setIsPaused(!isPaused);
      if (userId) {
        tablesDB.updateRow({
          databaseId: 'chat',
          tableId: 'users',
          rowId: userId,
          data: {
            presence: isPaused ? 'busy' : 'online',
            statusMessage: isPaused ? 'In Focus Mode (Kylrix Flow)' : ''
          }
        }).catch(() => {});
      }
    }
  };

  const stopTimer = async () => {
    if (isActive && selectedTask) {
        // ... (existing save interrupted logic)
    }
    // Bridge: Restore presence in Connect
    if (userId) {
      tablesDB.updateRow({
        databaseId: 'chat',
        tableId: 'users',
        rowId: userId,
        data: {
          presence: 'online',
          statusMessage: ''
        }
      }).catch(() => {});
    }
    setIsActive(false);
    setIsPaused(false);
    setTimeLeft(initialTime);
  };

  const handleTaskSelect = (task: Task) => {
    setSelectedTask(task);
    setIsTaskDialogOpen(false);
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
      setIsFullscreen(true);
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
        setIsFullscreen(false);
      }
    }
  };

  const progress = ((initialTime - timeLeft) / initialTime) * 100;

  // Preset durations
  const presets = [
    { label: '15m', value: 15 * 60 },
    { label: '25m', value: 25 * 60 },
    { label: '45m', value: 45 * 60 },
    { label: '60m', value: 60 * 60 },
  ];

  return (
    <Box
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        p: 3,
        position: 'relative',
        background: isActive && !isPaused 
          ? `radial-gradient(circle at center, #10B98108 0%, transparent 70%)`
          : 'transparent',
        transition: 'background 0.5s ease',
      }}
    >
      <Box sx={{ position: 'absolute', top: 16, right: 16, display: 'flex', gap: 1 }}>
        <IconButton 
          onClick={toggleFullscreen}
          sx={{ 
            bgcolor: theme.palette.action.hover,
            '&:hover': { bgcolor: theme.palette.action.selected },
          }}
        >
          {isFullscreen ? <FullscreenExit /> : <Fullscreen />}
        </IconButton>
      </Box>

      <Box sx={{ mb: 4, textAlign: 'center' }}>
        <Typography variant="h4" gutterBottom fontWeight="bold">
          Focus Mode
        </Typography>
        <Typography variant="body1" color="text.secondary">
          {isActive ? (isPaused ? 'Take a breath...' : 'Deep work in progress') : 'Ready to focus?'}
        </Typography>
      </Box>

      {/* Timer Circle */}
      <Box sx={{ position: 'relative', display: 'inline-flex', mb: 4 }}>
        {/* Outer glow when active */}
        {isActive && !isPaused && (
          <Box
            sx={{
              position: 'absolute',
              inset: -20,
              borderRadius: '50%',
              background: `radial-gradient(circle, #10B98120 0%, transparent 70%)`,
              animation: 'pulse 3s ease-in-out infinite',
            }}
          />
        )}
        <CircularProgress
          variant="determinate"
          value={100}
          size={280}
          thickness={3}
          sx={{ color: theme.palette.divider }}
        />
        <CircularProgress
          variant="determinate"
          value={progress}
          size={280}
          thickness={3}
          sx={{
            color: isActive && !isPaused ? '#10B981' : theme.palette.grey[400],
            position: 'absolute',
            left: 0,
            strokeLinecap: 'round',
            transition: 'color 0.3s ease',
            filter: isActive && !isPaused ? `drop-shadow(0 0 8px #10B98160)` : 'none',
          }}
        />
        <Box
          sx={{
            top: 0,
            left: 0,
            bottom: 0,
            right: 0,
            position: 'absolute',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexDirection: 'column',
          }}
        >
          <Typography 
            variant="h1" 
            component="div" 
            fontWeight="700" 
            sx={{ 
              fontSize: { xs: '3.5rem', sm: '4.5rem' },
              fontVariantNumeric: 'tabular-nums',
              letterSpacing: '-0.02em',
            }}
          >
            {formatTime(timeLeft)}
          </Typography>
          <Chip
            label={isActive ? (isPaused ? 'PAUSED' : 'FOCUSING') : 'READY'}
            size="small"
            sx={{ 
              mt: 1,
              fontWeight: 600,
              letterSpacing: '0.05em',
              bgcolor: isActive && !isPaused ? alpha('#10B981', 0.1) : 'default',
              color: isActive && !isPaused ? '#10B981' : 'inherit',
              border: isActive && !isPaused ? `1px solid ${alpha('#10B981', 0.2)}` : 'none',
            }}
          />
        </Box>
      </Box>

      {/* Duration Presets - only show when not active */}
      {!isActive && (
        <Stack direction="row" spacing={1} sx={{ mb: 4 }}>
          {presets.map((preset) => (
            <Button
              key={preset.label}
              variant={initialTime === preset.value ? 'contained' : 'outlined'}
              size="small"
              onClick={() => {
                setInitialTime(preset.value);
                setTimeLeft(preset.value);
              }}
              sx={{ 
                minWidth: 56,
                borderRadius: 2,
              }}
            >
              {preset.label}
            </Button>
          ))}
        </Stack>
      )}

      {/* Selected Task */}
      <Box sx={{ mb: 4, width: '100%', maxWidth: 500 }}>
        {selectedTask ? (
          <Paper
            elevation={0}
            sx={{
              p: 2,
              border: `1px solid ${theme.palette.divider}`,
              borderRadius: 2,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              cursor: 'pointer',
            }}
            onClick={() => setIsTaskDialogOpen(true)}
          >
            <Box>
              <Typography variant="caption" color="text.secondary" display="block" gutterBottom>
                WORKING ON
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Typography variant="h6">{selectedTask.title}</Typography>
                  <IconButton size="small" onClick={handleRefineGoal} disabled={isRefining} title="Refine goal with AI">
                      {isRefining ? <CircularProgress size={16} /> : <AutoFixHighIcon fontSize="small" />}
                  </IconButton>
              </Box>
            </Box>
            <IconButton
              color={selectedTask.status === 'done' ? 'success' : 'default'}
              onClick={(e) => {
                e.stopPropagation();
                updateTask(selectedTask.id, {
                  status: selectedTask.status === 'done' ? 'todo' : 'done',
                });
              }}
            >
              {selectedTask.status === 'done' ? <CheckCircle /> : <RadioButtonUnchecked />}
            </IconButton>
          </Paper>
        ) : (
          <Button
            variant="outlined"
            fullWidth
            size="large"
            onClick={() => setIsTaskDialogOpen(true)}
            sx={{ borderStyle: 'dashed', height: 80 }}
          >
            Select a task to focus on
          </Button>
        )}
      </Box>

      {/* Controls */}
      <Stack direction="row" spacing={2}>
        <Button
          variant="contained"
          color="primary"
          size="large"
          startIcon={isActive && !isPaused ? <Pause /> : <PlayArrow />}
          onClick={toggleTimer}
          sx={{ px: 4, py: 1.5, borderRadius: 50, fontSize: '1.2rem' }}
        >
          {isActive && !isPaused ? 'Pause' : isActive ? 'Resume' : 'Start Focus'}
        </Button>
        {isActive && (
          <Button
            variant="outlined"
            color="error"
            size="large"
            startIcon={<Stop />}
            onClick={stopTimer}
            sx={{ px: 4, py: 1.5, borderRadius: 50 }}
          >
            Stop
          </Button>
        )}
      </Stack>

      {/* Task Selection Dialog */}
      <Dialog
        open={isTaskDialogOpen}
        onClose={() => setIsTaskDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Select a Task</DialogTitle>
        <DialogContent>
          <List>
            {tasks
              .filter((t) => t.status !== 'done')
              .map((task) => (
                <ListItem key={task.id} disablePadding>
                  <ListItemButton
                    onClick={() => handleTaskSelect(task)}
                    selected={selectedTask?.id === task.id}
                  >
                    <ListItemIcon>
                      <RadioButtonUnchecked />
                    </ListItemIcon>
                    <ListItemText
                      primary={task.title}
                      secondary={task.description}
                      primaryTypographyProps={{
                        variant: 'body1',
                        fontWeight: selectedTask?.id === task.id ? 'bold' : 'normal',
                      }}
                    />
                    {task.priority === 'high' && (
                      <Chip label="High" color="error" size="small" sx={{ ml: 1 }} />
                    )}
                  </ListItemButton>
                </ListItem>
              ))}
          </List>
        </DialogContent>
      </Dialog>
    </Box>
  );
}
