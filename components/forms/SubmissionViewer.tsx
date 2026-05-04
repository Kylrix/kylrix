'use client';

import React, { useEffect, useState } from 'react';
import {
  Box,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  CircularProgress,
  IconButton,
  Tooltip,
  Chip,
  alpha,
  Button,
  Stack
} from '@mui/material';
import { 
  TableRows as CSVIcon,
  DataObject as JSONIcon,
  MarkEmailRead as ReadIcon,
  MarkEmailUnread as UnreadIcon,
  Flag as FlagIcon,
  FlagOutlined as UnflaggedIcon
} from '@mui/icons-material';
import { FormsService } from '@/lib/services/forms';
import { FormSubmissions } from '@/generated/appwrite/types';
import ResponseDetailSidebar from './ResponseDetailSidebar';

const SubmissionViewerTable = ({ submissions, headers, schemaMap, parsePayload, renderValue, onToggleRead, onToggleFlag, onRowClick }: any) => (
    <TableContainer component={Paper} sx={{ bgcolor: 'transparent', backgroundImage: 'none', border: '1px solid rgba(255, 255, 255, 0.05)', borderRadius: '24px', overflow: 'hidden' }}>
      <Table size="medium">
        <TableHead>
          <TableRow sx={{ bgcolor: 'rgba(255, 255, 255, 0.02)' }}>
            <TableCell sx={{ width: 50, borderBottom: '1px solid rgba(255,255,255,0.05)' }}></TableCell>
            <TableCell sx={{ fontWeight: 900, color: 'text.secondary', py: 3, borderBottom: '1px solid rgba(255,255,255,0.05)', fontSize: '0.7rem', letterSpacing: '0.1em' }}>TIMESTAMP</TableCell>
            <TableCell sx={{ fontWeight: 900, color: 'text.secondary', borderBottom: '1px solid rgba(255,255,255,0.05)', fontSize: '0.7rem', letterSpacing: '0.1em' }}>SUBMITTER</TableCell>
            {headers.map((h: string) => (
              <TableCell key={h} sx={{ fontWeight: 900, color: 'text.secondary', textTransform: 'uppercase', borderBottom: '1px solid rgba(255,255,255,0.05)', fontSize: '0.7rem', letterSpacing: '0.1em' }}>{schemaMap?.[h] || h}</TableCell>
            ))}
            <TableCell sx={{ width: 100, borderBottom: '1px solid rgba(255,255,255,0.05)' }}></TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {submissions.map((sub: any) => {
            const data = parsePayload(sub.payload);
            const isRead = (sub as any).read || false;
            const isFlagged = (sub as any).flagged || false;

            return (
              <TableRow 
                key={sub.$id} 
                onClick={() => onRowClick(sub)}
                sx={{ 
                  '&:hover': { bgcolor: 'rgba(255, 255, 255, 0.02)', cursor: 'pointer' }, 
                  transition: 'background-color 0.2s', 
                  opacity: isRead ? 0.7 : 1 
                }}
              >
                <TableCell sx={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                    {!isRead && <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: 'var(--color-primary)', boxShadow: `0 0 10px ${alpha('#6366F1', 0.5)}` }} />}
                </TableCell>
                <TableCell sx={{ color: 'text.secondary', fontSize: '0.8rem', fontWeight: 600, borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                  {new Date(sub.$createdAt).toLocaleString()}
                </TableCell>
                <TableCell sx={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                    <Chip 
                        label={sub.submitterName || 'Anonymous'} 
                        size="small" 
                        sx={{ 
                            fontSize: '10px', 
                            fontWeight: 800, 
                            bgcolor: sub.submitterName && sub.submitterName !== 'Anonymous' ? alpha('#6366F1', 0.1) : 'transparent',
                            color: sub.submitterName && sub.submitterName !== 'Anonymous' ? 'var(--color-primary)' : 'text.disabled',
                            border: sub.submitterName && sub.submitterName !== 'Anonymous' ? 'none' : '1px solid rgba(255,255,255,0.05)'
                        }} 
                    />
                </TableCell>
                {headers.map((h: string) => (
                  <TableCell key={h} sx={{ color: '#F2F2F2', fontWeight: 700, borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                    {renderValue(data[h])}
                  </TableCell>
                ))}
                <TableCell sx={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }} onClick={(e) => e.stopPropagation()}>
                    <Stack direction="row" spacing={1}>
                        <Tooltip title={isRead ? "Mark as unread" : "Mark as read"}>
                            <IconButton size="small" onClick={() => onToggleRead(sub.$id, !isRead)} sx={{ color: isRead ? 'rgba(255,255,255,0.2)' : 'var(--color-primary)' }}>
                                {isRead ? <UnreadIcon fontSize="inherit" /> : <ReadIcon fontSize="inherit" />}
                            </IconButton>
                        </Tooltip>
                        <Tooltip title={isFlagged ? "Remove flag" : "Flag submission"}>
                            <IconButton size="small" onClick={() => onToggleFlag(sub.$id, !isFlagged)} sx={{ color: isFlagged ? '#FFB020' : 'rgba(255,255,255,0.1)' }}>
                                {isFlagged ? <FlagIcon fontSize="inherit" /> : <UnflaggedIcon fontSize="inherit" />}
                            </IconButton>
                        </Tooltip>
                    </Stack>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </TableContainer>
);

export default function SubmissionViewer({ formId, formSchema }: { formId: string, formSchema?: string }) {
  const [submissions, setSubmissions] = useState<FormSubmissions[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSubmission, setSelectedSubmission] = useState<FormSubmissions | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Map of field IDs to labels
  const schemaMap = React.useMemo(() => {
    if (!formSchema) return {};
    try {
        const schema = JSON.parse(formSchema);
        return schema.reduce((acc: any, field: any) => {
            acc[field.id] = field.label || field.id;
            return acc;
        }, {});
    } catch (_e) {
        return {};
    }
  }, [formSchema]);

  const fetchSubmissions = async () => {
    try {
      const res = await FormsService.listSubmissions(formId);
      // Filter out drafts (work-in-progress)
      const nonDrafts = res.rows.filter(s => {
        try {
          const meta = JSON.parse(s.metadata || '{}');
          return !meta.isDraft;
        } catch (_e) {
          return true;
        }
      });
      setSubmissions(nonDrafts);
    } catch (_e) {
      console.error('Failed to fetch submissions', _e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSubmissions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formId]);

  const handleToggleRead = async (id: string, read: boolean) => {
    try {
      await FormsService.updateSubmission(id, { read } as any);
      setSubmissions(prev => prev.map(s => s.$id === id ? { ...s, read } : s));
    } catch (_e) {
        console.error("Failed to update read status", _e);
    }
  };

  const handleToggleFlag = async (id: string, flagged: boolean) => {
    try {
      await FormsService.updateSubmission(id, { flagged } as any);
      setSubmissions(prev => prev.map(s => s.$id === id ? { ...s, flagged } : s));
    } catch (_e) {
        console.error("Failed to update flagged status", _e);
    }
  };

  const handleRowClick = (sub: FormSubmissions) => {
    setSelectedSubmission(sub);
    setSidebarOpen(true);
    if (!(sub as any).read) {
        handleToggleRead(sub.$id, true);
    }
  };

  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', py: 10 }}><CircularProgress size={24} /></Box>;

  if (submissions.length === 0) {
    return (
      <Box sx={{ textAlign: 'center', py: 10, opacity: 0.5 }}>
        <Typography variant="body1" sx={{ fontWeight: 700 }}>No telemetry received.</Typography>
      </Box>
    );
  }

  const parsePayload = (payload: string) => {
    try {
      return JSON.parse(payload);
    } catch (_e) {
      return { data: payload };
    }
  };

  const firstPayload = parsePayload(submissions[0].payload);
  const headers = Object.keys(firstPayload);

  const renderValue = (val: any) => {
    if (Array.isArray(val)) {
        return (
            <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                {val.map((v, i) => (
                    <Chip key={i} label={v} size="small" sx={{ fontSize: '10px', fontWeight: 800, bgcolor: alpha('#6366F1', 0.1), color: 'var(--color-primary)' }} />
                ))}
            </Box>
        );
    }
    return String(val || '-');
  };

  const exportData = (format: 'csv' | 'json') => {
    if (submissions.length === 0) return;

    const exportableRows = submissions.map(sub => {
        const payloadData = parsePayload(sub.payload);
        return {
            timestamp: sub.$createdAt,
            submitter: (sub as any).submitterName || 'Anonymous',
            ...payloadData
        };
    });

    let blob: Blob;
    let filename: string;

    if (format === 'json') {
        blob = new Blob([JSON.stringify(exportableRows, null, 2)], { type: 'application/json' });
        filename = `form_${formId}_submissions_${new Date().toISOString()}.json`;
    } else {
        const headersArr = ['timestamp', 'submitter', ...headers];
        const csvContent = [
            headersArr.join(','),
            ...exportableRows.map(row => 
                headersArr.map(h => {
                    const val = (row as any)[h];
                    const stringVal = Array.isArray(val) ? val.join('; ') : String(val || '');
                    return `"${stringVal.replace(/"/g, '""')}"`;
                }).join(',')
            )
        ].join('\n');
        blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        filename = `form_${formId}_submissions_${new Date().toISOString()}.csv`;
    }

    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <Box>
        <Box sx={{ mb: 3, display: 'flex', justifyContent: 'flex-end', gap: 2 }}>
            <Button 
                size="small" 
                startIcon={<CSVIcon />} 
                onClick={() => exportData('csv')}
                sx={{ borderRadius: '12px', fontWeight: 800, bgcolor: 'rgba(255,255,255,0.03)', color: 'text.secondary', '&:hover': { bgcolor: 'rgba(255,255,255,0.08)' } }}
            >
                Export CSV
            </Button>
            <Button 
                size="small" 
                startIcon={<JSONIcon />} 
                onClick={() => exportData('json')}
                sx={{ borderRadius: '12px', fontWeight: 800, bgcolor: 'rgba(255,255,255,0.03)', color: 'text.secondary', '&:hover': { bgcolor: 'rgba(255,255,255,0.08)' } }}
            >
                Export JSON
            </Button>
        </Box>
        <SubmissionViewerTable 
            submissions={submissions} 
            headers={headers} 
            schemaMap={schemaMap}
            parsePayload={parsePayload} 
            renderValue={renderValue} 
            onToggleRead={handleToggleRead}
            onToggleFlag={handleToggleFlag}
            onRowClick={handleRowClick}
        />
        <ResponseDetailSidebar 
            open={sidebarOpen} 
            onClose={() => setSidebarOpen(false)} 
            submission={selectedSubmission} 
            schemaMap={schemaMap}
        />
    </Box>
  );
}
