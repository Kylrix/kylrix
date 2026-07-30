'use client';

import React, { useState, useEffect } from 'react';
import { 
  Box, 
  Typography, 
  Button, 
  Paper, 
  Grid, 
  Chip, 
  IconButton, 
  Divider,
  Alert
} from '@/lib/openbricks/primitives';
import { 
  PlayArrow as PlayIcon, 
  RotateLeft as NegateIcon, 
  Visibility as PublicIcon, 
  VisibilityOff as PrivateIcon, 
  DeleteOutline as DeleteIcon, 
  Security as AnonIcon, 
  Circle as DotIcon,
  ToggleOn as DynamicIcon
} from '@/lib/openbricks/icons';
import { useLocalContext } from '@/lib/context-engine';
import { anonymizeWorkflow, negateWorkflow, WorkflowChain } from '@/lib/workflow-engine';
import { 
  saveWorkflowAction, 
  listWorkflowsAction, 
  deleteWorkflowAction 
} from '@/lib/actions/workflows';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';

export default function WorkflowsPage() {
  const router = useRouter();
  const { 
    isRecording, 
    startRecording, 
    stopRecording, 
    savedWorkflows, 
    updateWorkflow, 
    clearSavedWorkflows 
  } = useLocalContext();

  const [negationError, setNegationError] = useState<string | null>(null);

  // Sync workflows from Appwrite database on mount
  useEffect(() => {
    const syncDb = async () => {
      const res = await listWorkflowsAction();
      if (res.success && res.data) {
        res.data.forEach(wf => {
          updateWorkflow(wf.id, wf);
        });
      }
    };
    syncDb();
  }, [updateWorkflow]);

  const handleTogglePrivacy = async (id: string, wf: WorkflowChain) => {
    const updated = {
      ...wf,
      isPublic: !wf.isPublic
    };
    updateWorkflow(id, updated);
    await saveWorkflowAction(updated);
  };

  const handleAnonymize = async (id: string, wf: WorkflowChain) => {
    const anon = anonymizeWorkflow(wf);
    updateWorkflow(id, anon);
    await saveWorkflowAction(anon);
  };

  const handleNegate = async (id: string, wf: WorkflowChain) => {
    setNegationError(null);
    const res = negateWorkflow(wf);
    if (!res.success || !res.workflow) {
      setNegationError(res.error || 'Failed to invert workflow.');
      return;
    }
    updateWorkflow(res.workflow.id, res.workflow);
    await saveWorkflowAction(res.workflow);
  };

  const handleToggleStepDynamic = async (wfId: string, wf: WorkflowChain, stepIndex: number) => {
    const updatedSteps = [...wf.steps];
    updatedSteps[stepIndex] = {
      ...updatedSteps[stepIndex],
      isDynamic: !updatedSteps[stepIndex].isDynamic
    };
    const updated = {
      ...wf,
      steps: updatedSteps
    };
    updateWorkflow(wfId, updated);
    await saveWorkflowAction(updated);
  };

  const handleDeleteWorkflow = async (id: string) => {
    await deleteWorkflowAction(id);
    const nextSaved = { ...savedWorkflows };
    delete nextSaved[id];
    if (typeof window !== 'undefined') {
      localStorage.setItem('kylrix_saved_workflows', JSON.stringify(nextSaved));
    }
    window.location.reload();
  };

  const workflowsList = Object.values(savedWorkflows);

  return (
    <Box sx={{ p: 4, bgcolor: '#0A0908', minHeight: '90vh', color: 'white', fontFamily: 'Satoshi, sans-serif' }}>
      {/* Back Button */}
      <IconButton
        onClick={() => router.back()}
        sx={{
          mb: 3,
          bgcolor: '#161412',
          color: '#fff',
          border: '1px solid rgba(255,255,255,0.06)',
          '&:hover': { bgcolor: '#1C1A18' },
        }}
      >
        <ArrowLeft size={18} />
      </IconButton>

      {/* Header section */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
        <Box>
          <Typography variant="h4" fontWeight={900} sx={{ letterSpacing: '-0.02em', mb: 1, fontFamily: 'Clash Display, sans-serif' }}>
            Action Workflows
          </Typography>
          <Typography variant="body2" sx={{ color: '#8C8A84' }}>
            Record, negate, and share automated action chains to multiply productivity.
          </Typography>
        </Box>

        <Box sx={{ display: 'flex', gap: 2 }}>
          {isRecording ? (
            <Button
              variant="contained"
              onClick={() => {
                const name = prompt("Name your workflow:") || "Custom Flow";
                const desc = prompt("Workflow description:") || "Automated chain";
                stopRecording(name, desc, 'workspace');
              }}
              sx={{
                bgcolor: '#EF4444',
                color: 'white',
                fontWeight: 800,
                px: 3,
                borderRadius: '12px',
                '&:hover': { bgcolor: '#DC2626' }
              }}
            >
              Stop Recording
            </Button>
          ) : (
            <Button
              variant="contained"
              onClick={startRecording}
              sx={{
                bgcolor: '#6366F1',
                color: 'white',
                fontWeight: 800,
                px: 3,
                borderRadius: '12px',
                '&:hover': { bgcolor: '#4F46E5' }
              }}
            >
              Record New Flow
            </Button>
          )}

          {workflowsList.length > 0 && (
            <Button
              variant="outlined"
              onClick={clearSavedWorkflows}
              sx={{
                borderColor: 'rgba(255, 255, 255, 0.1)',
                color: '#EF4444',
                fontWeight: 800,
                borderRadius: '12px',
                '&:hover': { borderColor: '#EF4444', bgcolor: 'rgba(239, 68, 68, 0.05)' }
              }}
            >
              Clear All
            </Button>
          )}
        </Box>
      </Box>

      {negationError && (
        <Alert severity="error" sx={{ mb: 3, bgcolor: '#1E1010', color: '#F87171', border: '1px solid #7F1D1D', borderRadius: '12px' }} onClose={() => setNegationError(null)}>
          {negationError}
        </Alert>
      )}

      {workflowsList.length === 0 ? (
        <Paper
          elevation={0}
          sx={{
            p: 8,
            textAlign: 'center',
            bgcolor: '#141312',
            border: '1px solid #232220',
            borderRadius: '20px'
          }}
        >
          <Typography variant="h6" fontWeight={800} sx={{ mb: 1 }}>
            No workflows recorded yet
          </Typography>
          <Typography variant="body2" sx={{ color: '#8C8A84', mb: 3, maxWidth: 400, mx: 'auto' }}>
            Click &quot;Record New Flow&quot; above or open the bottom SpeedDial FAB menu to record a chain of actions.
          </Typography>
          <Button
            variant="contained"
            onClick={startRecording}
            sx={{ bgcolor: '#272624', border: '1px solid #363532', color: 'white', fontWeight: 800, borderRadius: '10px' }}
          >
            Record Action Chain
          </Button>
        </Paper>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          {workflowsList.map((wf) => (
            <Box key={wf.id}>
              <Paper
                elevation={0}
                sx={{
                  p: 3,
                  bgcolor: '#141312',
                  border: '1px solid #232220',
                  borderRadius: '20px',
                  position: 'relative'
                }}
              >
                {/* Upper bar */}
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                  <Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 0.5 }}>
                      <Typography variant="h6" fontWeight={900} sx={{ color: 'white' }}>
                        {wf.name}
                      </Typography>
                      <Chip 
                        label={wf.niche.toUpperCase()} 
                        size="small" 
                        sx={{ 
                          bgcolor: 'rgba(99, 102, 241, 0.1)', 
                          color: '#818CF8', 
                          fontWeight: 800,
                          fontSize: '10px',
                          border: '1px solid rgba(99, 102, 241, 0.2)'
                        }} 
                      />
                      {wf.isAnonymized && (
                        <Chip 
                          label="SECURELY ANONYMIZED" 
                          size="small" 
                          sx={{ bgcolor: 'rgba(16, 185, 129, 0.1)', color: '#34D399', fontWeight: 800, fontSize: '10px' }} 
                        />
                      )}
                    </Box>
                    <Typography variant="body2" sx={{ color: '#8C8A84' }}>
                      {wf.description}
                    </Typography>
                  </Box>

                  <Box sx={{ display: 'flex', gap: 1 }}>
                    <IconButton 
                      onClick={() => handleTogglePrivacy(wf.id, wf)}
                      title={wf.isPublic ? "Make Private" : "Make Public"}
                      sx={{ color: 'rgba(255, 255, 255, 0.4)', '&:hover': { color: 'white', bgcolor: 'rgba(255, 255, 255, 0.05)' } }}
                    >
                      {wf.isPublic ? <PublicIcon fontSize="small" /> : <PrivateIcon fontSize="small" />}
                    </IconButton>

                    {!wf.isAnonymized && (
                      <IconButton 
                        onClick={() => handleAnonymize(wf.id, wf)}
                        title="Securely Anonymize Metadata"
                        sx={{ color: 'rgba(255, 255, 255, 0.4)', '&:hover': { color: '#34D399', bgcolor: 'rgba(16, 185, 129, 0.05)' } }}
                      >
                        <AnonIcon fontSize="small" />
                      </IconButton>
                    )}

                    <IconButton 
                      onClick={() => handleNegate(wf.id, wf)}
                      title="Create Negation Inversion Flow"
                      sx={{ color: 'rgba(255, 255, 255, 0.4)', '&:hover': { color: '#818CF8', bgcolor: 'rgba(99, 102, 241, 0.05)' } }}
                    >
                      <NegateIcon fontSize="small" />
                    </IconButton>

                    <IconButton 
                      onClick={() => handleDeleteWorkflow(wf.id)}
                      title="Delete Workflow"
                      sx={{ color: 'rgba(255, 255, 255, 0.4)', '&:hover': { color: '#EF4444', bgcolor: 'rgba(239, 68, 68, 0.05)' } }}
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </Box>
                </Box>

                <Divider sx={{ my: 2, borderColor: 'rgba(255, 255, 255, 0.05)' }} />

                {/* Steps Trace Line */}
                <Typography variant="caption" fontWeight={800} sx={{ color: '#A2A09B', display: 'block', mb: 2, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Interaction Path ({wf.steps.length} Steps)
                </Typography>

                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                  {wf.steps.map((step, idx) => (
                    <Box key={idx} sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pl: 1 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        <DotIcon sx={{ fontSize: 8, color: step.importance === 'high' ? '#6366F1' : '#3E3A36' }} />
                        <Typography 
                          variant="caption" 
                          sx={{ 
                            fontFamily: 'monospace', 
                            color: step.importance === 'high' ? '#FFFFFF' : '#8C8A84',
                            fontWeight: step.importance === 'high' ? 800 : 500
                          }}
                        >
                          {step.actionId}
                        </Typography>
                        {step.isDynamic && (
                          <Chip 
                            label="DYNAMIC RESOLUTION" 
                            size="small" 
                            sx={{ height: 16, fontSize: '8px', bgcolor: 'rgba(245, 158, 11, 0.1)', color: '#FBBF24', fontWeight: 800 }} 
                          />
                        )}
                      </Box>

                      {step.importance === 'high' && (
                        <Button
                          size="small"
                          onClick={() => handleToggleStepDynamic(wf.id, wf, idx)}
                          startIcon={<DynamicIcon sx={{ fontSize: 12 }} />}
                          sx={{
                            color: step.isDynamic ? '#FBBF24' : 'rgba(255, 255, 255, 0.3)',
                            fontSize: '10px',
                            fontWeight: 700,
                            textTransform: 'none',
                            py: 0.2,
                            '&:hover': { bgcolor: 'rgba(255, 255, 255, 0.03)' }
                          }}
                        >
                          {step.isDynamic ? 'Make Static' : 'Make Dynamic'}
                        </Button>
                      )}
                    </Box>
                  ))}
                </Box>
              </Paper>
            </Box>
          ))}
        </Box>
      )}
    </Box>
  );
}
