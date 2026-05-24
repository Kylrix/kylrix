'use client';

import React, { useState } from 'react';
import { Box, Container, Typography, Paper, Stack, Divider, IconButton } from '@mui/material';
import { ChevronRight, ChevronDown, Folder, FileCode, ArrowUpRight } from 'lucide-react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import Logo from '@/components/common/Logo';

interface TreeNode {
  name: string;
  route: string;
  isFolder: boolean;
  hasPage: boolean;
  children: TreeNode[];
}

interface FileNodeProps {
  node: TreeNode;
  depth: number;
}

function FileNode({ node, depth }: FileNodeProps) {
  const [isOpen, setIsOpen] = useState(true);
  const hasChildren = node.children && node.children.length > 0;

  const toggleOpen = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsOpen(!isOpen);
  };

  return (
    <Box sx={{ ml: depth > 0 ? 3 : 0 }}>
      {/* Node Row */}
      <Box 
        sx={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: 1.5, 
          py: 1.5, 
          px: 2,
          borderRadius: '12px',
          bgcolor: '#131110',
          border: '1px solid #23211F',
          boxShadow: '2px 2px 0px #000000',
          mb: 1.5,
          cursor: 'default',
          transition: 'all 0.2s ease',
          '&:hover': {
            borderColor: '#6366F1',
            transform: 'translateX(2px)'
          }
        }}
      >
        {/* Toggle Arrow */}
        {hasChildren ? (
          <IconButton 
            size="small" 
            onClick={toggleOpen}
            sx={{ 
              color: 'rgba(255,255,255,0.4)', 
              p: 0.25,
              '&:hover': { color: '#FFFFFF', bgcolor: 'rgba(255,255,255,0.05)' }
            }}
          >
            {isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          </IconButton>
        ) : (
          <Box sx={{ width: 22 }} />
        )}

        {/* Node Icon */}
        <Box sx={{ color: hasChildren ? '#EC4899' : '#6366F1', display: 'flex', alignItems: 'center' }}>
          {hasChildren ? <Folder size={18} strokeWidth={2} /> : <FileCode size={18} strokeWidth={2} />}
        </Box>

        {/* Node Name */}
        <Typography 
          sx={{ 
            fontFamily: 'var(--font-space-grotesk)', 
            fontWeight: 700, 
            fontSize: '1rem',
            color: '#FFFFFF',
            flexGrow: 1
          }}
        >
          {node.name}
        </Typography>

        {/* Navigate Button */}
        {node.hasPage && (
          <Link href={node.route} passHref>
            <Box
              component="span"
              sx={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 0.75,
                px: 2,
                py: 0.5,
                borderRadius: '8px',
                bgcolor: '#0B0A09',
                border: '1px solid #23211F',
                color: '#6366F1',
                fontSize: '0.8rem',
                fontFamily: 'var(--font-mono)',
                fontWeight: 700,
                textTransform: 'uppercase',
                textDecoration: 'none',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                '&:hover': {
                  bgcolor: '#6366F1',
                  color: '#FFFFFF',
                  borderColor: '#000000',
                  transform: 'translate(-1px, -1px)',
                  boxShadow: '2px 2px 0px #000000'
                },
                '&:active': {
                  transform: 'translate(1px, 1px)',
                  boxShadow: '0px 0px 0px #000000'
                }
              }}
            >
              Launch <ArrowUpRight size={14} />
            </Box>
          </Link>
        )}
      </Box>

      {/* Children Nodes (Collapsible) */}
      <AnimatePresence initial={false}>
        {isOpen && hasChildren && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
            style={{ overflow: 'hidden' }}
          >
            {node.children.map((child, idx) => (
              <FileNode key={idx} node={child} depth={depth + 1} />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </Box>
  );
}

export default function KitchenPortalClient({ tree }: { tree: TreeNode[] }) {
  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#000000', color: '#FFFFFF', py: 8, px: { xs: 2, md: 4 } }}>
      <Container maxWidth="md">
        <Stack spacing={6}>
          {/* Brand Header */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 3 }}>
            <Logo app="root" size={56} variant="icon" />
            <Box>
              <Typography variant="h3" sx={{ fontWeight: 900, fontFamily: 'var(--font-outfit)', letterSpacing: '-0.04em' }}>
                THE KITCHEN
              </Typography>
              <Typography sx={{ opacity: 0.5, fontSize: '1rem', fontFamily: 'var(--font-satoshi)', mt: 0.5 }}>
                Dynamic Openbricks 2.0 Route gateway. Scan, select, and launch.
              </Typography>
            </Box>
          </Box>

          <Divider sx={{ borderColor: '#23211F' }} />

          {/* Directory Explorer Panel */}
          <Paper 
            sx={{ 
              p: 4, 
              bgcolor: '#0B0A09', 
              borderRadius: '24px', 
              border: '1px solid #23211F', 
              boxShadow: '4px 4px 0px #000000' 
            }}
          >
            <Typography variant="overline" sx={{ color: '#9B9691', fontFamily: 'var(--font-mono)', fontWeight: 800, mb: 3, display: 'block', letterSpacing: '0.05em' }}>
              Dynamic Route Explorer
            </Typography>

            <Stack spacing={1}>
              {tree.length > 0 ? (
                tree.map((node, idx) => (
                  <FileNode key={idx} node={node} depth={0} />
                ))
              ) : (
                <Typography sx={{ color: 'rgba(255,255,255,0.3)', fontFamily: 'var(--font-mono)', fontSize: '0.9rem', py: 4, textAlign: 'center' }}>
                  NO R&D ROUTES DISCOVERED IN /app/kitchen
                </Typography>
              )}
            </Stack>
          </Paper>

          {/* Solid Footing */}
          <Box sx={{ textAlign: 'center', opacity: 0.2, fontFamily: 'var(--font-mono)', fontSize: '0.75rem' }}>
            AUTONOMOUS DIRECTORY COMPILER • VER V2.0
          </Box>
        </Stack>
      </Container>
    </Box>
  );
}
