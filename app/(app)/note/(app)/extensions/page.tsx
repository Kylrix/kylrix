'use client';

import { useState, useEffect, useCallback } from 'react';
import { 
  Box, 
  Typography, 
  Stack, 
  Button, 
  TextField, 
  Tabs, 
  Tab, 
  Grid, 
  CircularProgress, 
  Container,
  Card,
  CardContent,
  Chip,
  alpha,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions
} from '@mui/material';
import { 
  Add as AddIcon, 
  Search as SearchIcon, 
  Extension as ExtensionIcon,
  Person as PersonIcon,
  Download as DownloadIcon
} from '@mui/icons-material';
import { Extensions } from '@/types/appwrite';
import { listExtensions, createExtension, updateExtension, getCurrentUser } from '@/lib/appwrite';

interface ExtensionTemplate {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: string;
  hooks: string[];
  settings: Record<string, unknown>;
  code: string;
}

const extensionTemplates: ExtensionTemplate[] = [
  {
    id: 'note-revisor',
    name: 'AI Note Revisor',
    description: 'Automatically revise and improve notes using AI when they are created',
    icon: '🧠',
    category: 'AI Enhancement',
    hooks: ['onCreate'],
    settings: {
      aiProvider: 'gemini',
      revisionPrompt: 'Improve this note by fixing grammar, enhancing clarity, and organizing content better:',
      autoApply: true
    },
    code: `// AI Note Revisor Extension
export default {
  name: 'AI Note Revisor',
  version: '1.0.0',
  hooks: {
    onCreate: async (note, settings) => {
      if (!settings.autoApply) return note;
      
      const prompt = \`\${settings.revisionPrompt}\\n\\n\${note.content}\`;
      const revisedContent = await callAI(prompt, settings.aiProvider);
      
      return {
        ...note,
        content: revisedContent,
        metadata: JSON.stringify({
          ...JSON.parse(note.metadata || '{}'),
          revisedBy: 'AI Note Revisor',
          originalContent: note.content
        })
      };
    }
  }
};`
  },
  {
    id: 'auto-tagger',
    name: 'Smart Auto-Tagger',
    description: 'Automatically extract and add relevant tags to notes based on content',
    icon: '⚡',
    category: 'Organization',
    hooks: ['onCreate', 'onUpdate'],
    settings: {
      maxTags: 5,
      minConfidence: 0.7,
      customKeywords: []
    },
    code: `// Smart Auto-Tagger Extension
export default {
  name: 'Smart Auto-Tagger',
  version: '1.0.0',
  hooks: {
    onCreate: async (note, settings) => {
      const extractedTags = await extractTags(note.content, settings);
      return {
        ...note,
        tags: [...(note.tags || []), ...extractedTags]
      };
    }
  }
};`
  },
  {
    id: 'security-scanner',
    name: 'Security Scanner',
    description: 'Scan notes for sensitive information and apply additional encryption',
    icon: '🛡️',
    category: 'Security',
    hooks: ['onCreate', 'onUpdate'],
    settings: {
      sensitivePatterns: ['ssn', 'credit-card', 'api-key'],
      autoEncrypt: true,
      alertUser: true
    },
    code: `// Security Scanner Extension
export default {
  name: 'Security Scanner',
  version: '1.0.0',
  hooks: {
    onCreate: async (note, settings) => {
      const sensitiveData = scanForSensitiveData(note.content, settings.sensitivePatterns);
      
      if (sensitiveData.length > 0) {
        if (settings.alertUser) {
          showSecurityAlert(sensitiveData);
        }
        
        if (settings.autoEncrypt) {
          const encryptedContent = await encryptSensitiveData(note.content, sensitiveData);
          return {
            ...note,
            content: encryptedContent
          };
        }
      }
      
      return note;
    }
  }
};`
  }
];

export default function ExtensionsPage() {
  const [extensions, setExtensions] = useState<Extensions[]>([]);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<ExtensionTemplate | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState(0);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<{ $id?: string } | null>(null);

  const loadUser = useCallback(async () => {
    try {
      const currentUser = await getCurrentUser();
      setUser(currentUser);
    } catch (error: any) {
      console.error('Failed to load user:', error);
    }
  }, []);

  const loadExtensions = useCallback(async () => {
    try {
      setLoading(true);
      const result = await listExtensions();
      setExtensions(result.documents as unknown as Extensions[]);
    } catch (error: any) {
      console.error('Failed to load extensions:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadExtensions();
    loadUser();
  }, [loadExtensions, loadUser]);

  const handleCreateExtension = async (extensionData: Partial<Extensions>) => {
    try {
      await createExtension({
        ...extensionData,
        authorId: user?.$id,
        enabled: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
      await loadExtensions();
      setIsCreateModalOpen(false);
      setSelectedTemplate(null);
    } catch (error: any) {
      console.error('Failed to create extension:', error);
    }
  };

  const handleToggleExtension = async (extension: Extensions) => {
    try {
      await updateExtension(extension.$id!, {
        enabled: !extension.enabled
      });
      await loadExtensions();
    } catch (error: any) {
      console.error('Failed to toggle extension:', error);
    }
  };

  const filteredExtensions = extensions.filter(ext =>
    ext.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    ext.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const installedExtensions = extensions.filter(ext => ext.enabled);

  const tabs = [
    { label: 'Marketplace', count: extensions.length },
    { label: 'Installed', count: installedExtensions.length },
    { label: 'Templates', count: extensionTemplates.length }
  ];

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#0A0908', color: 'white', p: { xs: 2, md: 6 } }}>
      <Container maxWidth="xl">
        {/* Header */}
        <Stack 
          direction={{ xs: 'column', md: 'row' }} 
          justifyContent="space-between" 
          alignItems={{ xs: 'flex-start', md: 'center' }} 
          spacing={3} 
          sx={{ mb: 6 }}
        >
          <Box>
            <Typography 
              variant="h1" 
              sx={{ 
                fontWeight: 900, 
                fontFamily: 'var(--font-clash)',
                background: 'linear-gradient(to bottom, #FFF 0%, rgba(255,255,255,0.7) 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                fontSize: { xs: '2.5rem', md: '4rem' },
                letterSpacing: '-0.02em',
                mb: 1
              }}
            >
              Extensions
            </Typography>
            <Typography variant="h6" sx={{ color: 'rgba(255, 255, 255, 0.4)', fontWeight: 500, fontFamily: 'var(--font-satoshi)' }}>
              Extend Kylrix Note with powerful plugins and automations
            </Typography>
          </Box>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setIsCreateModalOpen(true)}
            sx={{
              bgcolor: '#6366F1',
              color: 'black',
              fontWeight: 900,
              px: 4,
              py: 1.5,
              borderRadius: '12px',
              boxShadow: '0 8px 24px rgba(99, 102, 241, 0.2)',
              '&:hover': { bgcolor: alpha('#6366F1', 0.8), transform: 'translateY(-2px)' }
            }}
          >
            Create Extension
          </Button>
        </Stack>

        {/* Tabs & Search */}
        <Stack spacing={4} sx={{ mb: 6 }}>
          <Tabs 
            value={activeTab} 
            onChange={(_, v) => setActiveTab(v)}
            sx={{
              '& .MuiTabs-indicator': { bgcolor: '#6366F1', height: 3, borderRadius: '3px 3px 0 0' },
              '& .MuiTab-root': { 
                color: 'rgba(255, 255, 255, 0.3)',
                fontWeight: 800,
                fontSize: '0.85rem',
                fontFamily: 'var(--font-mono)',
                textTransform: 'uppercase',
                letterSpacing: '0.1em',
                '&.Mui-selected': { color: 'white' }
              }
            }}
          >
            {tabs.map((tab, i) => (
              <Tab key={i} label={`${tab.label} (${tab.count})`} />
            ))}
          </Tabs>

          <TextField
            fullWidth
            placeholder="Search extensions..."
            value={searchQuery}
            onChange={ (e) => setSearchQuery(e.target.value)}
            variant="standard"
            InputProps={{
              disableUnderline: true,
              startAdornment: <SearchIcon sx={{ mr: 2, opacity: 0.3 }} />,
              sx: {
                bgcolor: '#161412',
                borderRadius: '16px',
                color: 'white',
                p: 2,
                fontFamily: 'var(--font-satoshi)',
                fontWeight: 600,
                border: '1px solid rgba(255, 255, 255, 0.05)',
                '&:hover': { borderColor: 'rgba(255, 255, 255, 0.1)' },
                '&.Mui-focused': { borderColor: '#6366F1', boxShadow: '0 0 10px rgba(99, 102, 241, 0.1)' }
              }
            }}
            sx={{ maxWidth: 500 }}
          />
        </Stack>

        {/* Content */}
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 12 }}>
            <CircularProgress sx={{ color: '#6366F1' }} />
          </Box>
        ) : (
          <Grid container spacing={4}>
            {activeTab === 0 && filteredExtensions.map((extension) => (
              <Grid size={{ xs: 12, md: 6, lg: 4 }} key={extension.$id}>
                <ExtensionCard
                  extension={extension}
                  onToggle={handleToggleExtension}
                  isOwner={extension.authorId === user?.$id}
                />
              </Grid>
            ))}

            {activeTab === 1 && installedExtensions.map((extension) => (
              <Grid size={{ xs: 12, md: 6, lg: 4 }} key={extension.$id}>
                <ExtensionCard
                  extension={extension}
                  onToggle={handleToggleExtension}
                  isOwner={extension.authorId === user?.$id}
                />
              </Grid>
            ))}

            {activeTab === 2 && extensionTemplates
              .filter(template =>
                template.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                template.description.toLowerCase().includes(searchQuery.toLowerCase())
              )
              .map((template) => (
                <Grid size={{ xs: 12, md: 6, lg: 4 }} key={template.id}>
                  <TemplateCard
                    template={template}
                    onUse={() => {
                      setSelectedTemplate(template);
                      setIsCreateModalOpen(true);
                    }}
                  />
                </Grid>
              ))}
          </Grid>
        )}

        {/* Empty State */}
        {!loading && (
          (activeTab === 0 && filteredExtensions.length === 0) ||
          (activeTab === 1 && installedExtensions.length === 0) ||
          (activeTab === 2 && extensionTemplates.length === 0)
        ) && (
          <Box sx={{ textAlign: 'center', py: 12 }}>
            <Box sx={{ 
              width: 140, 
              height: 140, 
              bgcolor: '#161412', 
              borderRadius: '48px', 
              mx: 'auto', 
              mb: 4, 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              fontSize: '4rem',
              border: '1px solid rgba(255, 255, 255, 0.05)',
              boxShadow: '0 20px 40px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.05)'
            }}>📦</Box>
            <Typography variant="h4" sx={{ fontWeight: 900, mb: 1, fontFamily: 'var(--font-clash)' }}>
              {activeTab === 0 && 'No extensions found'}
              {activeTab === 1 && 'No extensions installed'}
              {activeTab === 2 && 'No templates available'}
            </Typography>
            <Typography sx={{ color: 'rgba(255, 255, 255, 0.4)', mb: 4, fontFamily: 'var(--font-satoshi)', fontWeight: 500 }}>
              {activeTab === 0 && 'Try adjusting your search or create a new extension'}
              {activeTab === 1 && 'Browse the marketplace to install extensions'}
              {activeTab === 2 && 'Check back later for new templates'}
            </Typography>
          </Box>
        )}
      </Container>

      {/* Create Extension Modal */}
      <CreateExtensionModal
        isOpen={isCreateModalOpen}
        onClose={() => {
          setIsCreateModalOpen(false);
          setSelectedTemplate(null);
        }}
        onSubmit={handleCreateExtension}
        template={selectedTemplate}
      />
    </Box>
  );
}

function ExtensionCard({ extension, onToggle, isOwner }: {
  extension: Extensions;
  onToggle: (extension: Extensions) => void;
  isOwner: boolean;
}) {
  return (
    <Card 
      sx={{ 
        bgcolor: '#161412', 
        border: '1px solid rgba(255, 255, 255, 0.05)',
        borderRadius: '32px',
        height: '100%',
        backgroundImage: 'none',
        boxShadow: '0 20px 40px -15px rgba(0,0,0,0.8), inset 0 1px 1px rgba(255,255,255,0.05), inset 0 -1px 0 rgba(0,0,0,0.5)',
        transition: 'all 0.5s cubic-bezier(0.16, 1, 0.3, 1)',
        '&:hover': { 
          transform: 'translateY(-8px) scale(1.01)', 
          borderColor: alpha('#6366F1', 0.4),
          boxShadow: `0 40px 80px -20px rgba(0,0,0,0.9), 0 0 20px ${alpha('#6366F1', 0.15)}, inset 0 1px 1px ${alpha('#FFFFFF', 0.1)}`
        }
      }}
    >
      <CardContent sx={{ p: 4 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="flex-start" sx={{ mb: 3 }}>
          <Stack direction="row" spacing={2} alignItems="center">
            <Box 
              sx={{ 
                width: 54, 
                height: 54, 
                borderRadius: '16px', 
                bgcolor: alpha('#6366F1', 0.1),
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#6366F1',
                border: '1px solid rgba(99, 102, 241, 0.2)'
              }}
            >
              <ExtensionIcon sx={{ fontSize: 24 }} />
            </Box>
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 900, fontFamily: 'var(--font-clash)', letterSpacing: '0.01em' }}>
                {extension.name}
              </Typography>
              <Typography variant="caption" sx={{ color: 'rgba(255, 255, 255, 0.3)', fontWeight: 800, fontFamily: 'var(--font-mono)', textTransform: 'uppercase' }}>
                v{extension.version}
              </Typography>
            </Box>
          </Stack>
          {isOwner && (
            <Chip 
              label="Owner" 
              size="small" 
              sx={{ 
                bgcolor: '#1C1A18', 
                color: '#6366F1', 
                fontWeight: 900,
                fontSize: '0.65rem',
                fontFamily: 'var(--font-mono)',
                textTransform: 'uppercase',
                border: '1px solid rgba(99, 102, 241, 0.1)'
              }} 
            />
          )}
        </Stack>

        <Typography 
          variant="body2" 
          sx={{ 
            color: 'rgba(255, 255, 255, 0.5)', 
            fontFamily: 'var(--font-satoshi)',
            lineHeight: 1.6,
            mb: 4, 
            minHeight: 60,
            display: '-webkit-box',
            WebkitLineClamp: 3,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden'
          }}
        >
          {extension.description}
        </Typography>

        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Stack direction="row" spacing={1} alignItems="center" sx={{ color: 'rgba(255, 255, 255, 0.2)' }}>
            <PersonIcon sx={{ fontSize: 16 }} />
            <Typography variant="caption" sx={{ fontWeight: 700, fontFamily: 'var(--font-satoshi)' }}>Author</Typography>
          </Stack>
          <Button
            onClick={() => onToggle(extension)}
            variant="contained"
            size="small"
            sx={{
              bgcolor: extension.enabled ? alpha('#ff4444', 0.05) : '#1C1A18',
              color: extension.enabled ? '#ff4444' : 'white',
              fontWeight: 900,
              borderRadius: '12px',
              border: '1px solid',
              borderColor: extension.enabled ? alpha('#ff4444', 0.1) : 'rgba(255, 255, 255, 0.05)',
              px: 3,
              '&:hover': { 
                bgcolor: extension.enabled ? alpha('#ff4444', 0.1) : '#252220',
                borderColor: extension.enabled ? alpha('#ff4444', 0.3) : 'rgba(255, 255, 255, 0.1)'
              }
            }}
          >
            {extension.enabled ? 'Disable' : 'Enable'}
          </Button>
        </Stack>
      </CardContent>
    </Card>
  );
}

function TemplateCard({ template, onUse }: {
  template: ExtensionTemplate;
  onUse: () => void;
}) {
  return (
    <Card 
      sx={{ 
        bgcolor: '#161412', 
        border: '1px solid rgba(255, 255, 255, 0.05)',
        borderRadius: '32px',
        height: '100%',
        backgroundImage: 'none',
        boxShadow: '0 20px 40px -15px rgba(0,0,0,0.8), inset 0 1px 1px rgba(255,255,255,0.05), inset 0 -1px 0 rgba(0,0,0,0.5)',
        transition: 'all 0.5s cubic-bezier(0.16, 1, 0.3, 1)',
        '&:hover': { 
          transform: 'translateY(-8px) scale(1.01)', 
          borderColor: alpha('#A855F7', 0.4),
          boxShadow: `0 40px 80px -20px rgba(0,0,0,0.9), 0 0 20px ${alpha('#A855F7', 0.15)}, inset 0 1px 1px ${alpha('#FFFFFF', 0.1)}`
        }
      }}
    >
      <CardContent sx={{ p: 4 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="flex-start" sx={{ mb: 3 }}>
          <Stack direction="row" spacing={2} alignItems="center">
            <Box 
              sx={{ 
                width: 54, 
                height: 54, 
                borderRadius: '16px', 
                bgcolor: alpha('#A855F7', 0.1),
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.5rem',
                border: '1px solid rgba(168, 85, 247, 0.2)'
              }}
            >
              {template.icon}
            </Box>
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 900, fontFamily: 'var(--font-clash)', letterSpacing: '0.01em' }}>
                {template.name}
              </Typography>
              <Typography variant="caption" sx={{ color: 'rgba(255, 255, 255, 0.3)', fontWeight: 800, fontFamily: 'var(--font-mono)', textTransform: 'uppercase' }}>
                {template.category}
              </Typography>
            </Box>
          </Stack>
          <Chip 
            label="Template" 
            size="small" 
            sx={{ 
              bgcolor: '#1C1A18', 
              color: '#4ade80', 
              fontWeight: 900,
              fontSize: '0.65rem',
              fontFamily: 'var(--font-mono)',
              textTransform: 'uppercase',
              border: '1px solid rgba(74, 222, 128, 0.1)'
            }} 
          />
        </Stack>

        <Typography 
          variant="body2" 
          sx={{ 
            color: 'rgba(255, 255, 255, 0.5)', 
            fontFamily: 'var(--font-satoshi)',
            lineHeight: 1.6,
            mb: 3, 
            minHeight: 60,
            display: '-webkit-box',
            WebkitLineClamp: 3,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden'
          }}
        >
          {template.description}
        </Typography>

        <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ mb: 4 }}>
          {template.hooks.map((hook) => (
            <Chip 
              key={hook} 
              label={hook} 
              size="small" 
              sx={{ 
                bgcolor: 'rgba(255, 255, 255, 0.03)', 
                color: 'white', 
                fontSize: '0.65rem',
                fontWeight: 800,
                fontFamily: 'var(--font-mono)',
                textTransform: 'uppercase',
                border: '1px solid rgba(255, 255, 255, 0.05)'
              }} 
            />
          ))}
        </Stack>

        <Button 
          fullWidth 
          onClick={onUse} 
          variant="outlined"
          startIcon={<DownloadIcon />}
          sx={{
            borderColor: 'rgba(255, 255, 255, 0.05)',
            bgcolor: '#1C1A18',
            color: 'white',
            fontWeight: 900,
            borderRadius: '14px',
            py: 1.5,
            '&:hover': { 
              borderColor: '#6366F1',
              bgcolor: alpha('#6366F1', 0.05)
            }
          }}
        >
          Use Template
        </Button>
      </CardContent>
    </Card>
  );
}

function CreateExtensionModal({ isOpen, onClose, onSubmit, template }: {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: Partial<Extensions>) => void;
  template?: ExtensionTemplate | null;
}) {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    version: '1.0.0',
    settings: '{}',
    enabled: false
  });

  useEffect(() => {
    if (template) {
      setFormData({
        name: template.name,
        description: template.description,
        version: '1.0.0',
        settings: JSON.stringify(template.settings, null, 2),
        enabled: false
      });
    } else {
      setFormData({
        name: '',
        description: '',
        version: '1.0.0',
        settings: '{}',
        enabled: false
      });
    }
  }, [template]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <Dialog 
      open={isOpen} 
      onClose={onClose}
      fullWidth
      maxWidth="sm"
      PaperProps={{
        sx: {
          bgcolor: '#161412',
          backgroundImage: 'none',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          boxShadow: '0 40px 80px -20px rgba(0,0,0,0.9), inset 0 1px 1px rgba(255,255,255,0.05)',
          borderRadius: '32px',
          color: 'white',
          p: 1
        }
      }}
    >
      <DialogTitle sx={{ fontWeight: 900, fontFamily: 'var(--font-clash)', fontSize: '1.75rem', letterSpacing: '-0.02em', pt: 3 }}>
        Create Extension
      </DialogTitle>
      <DialogContent sx={{ pb: 0 }}>
        <Stack spacing={4} sx={{ mt: 2 }}>
          <Box>
            <Typography variant="caption" sx={{ fontWeight: 800, color: 'rgba(255, 255, 255, 0.3)', mb: 1.5, display: 'block', textTransform: 'uppercase', letterSpacing: '0.1em', fontFamily: 'var(--font-mono)' }}>
              Extension Name
            </Typography>
            <TextField
              fullWidth
              required
              value={formData.name}
              onChange={ (e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="My Awesome Extension"
              variant="standard"
              InputProps={{
                disableUnderline: true,
                sx: {
                  bgcolor: '#1C1A18',
                  borderRadius: '16px',
                  color: 'white',
                  p: 2,
                  fontFamily: 'var(--font-satoshi)',
                  fontWeight: 600,
                  border: '1px solid rgba(255, 255, 255, 0.05)',
                  '&:hover': { borderColor: 'rgba(255, 255, 255, 0.1)' },
                  '&.Mui-focused': { borderColor: '#6366F1', boxShadow: '0 0 10px rgba(99, 102, 241, 0.1)' }
                }
              }}
            />
          </Box>

          <Box>
            <Typography variant="caption" sx={{ fontWeight: 800, color: 'rgba(255, 255, 255, 0.3)', mb: 1.5, display: 'block', textTransform: 'uppercase', letterSpacing: '0.1em', fontFamily: 'var(--font-mono)' }}>
              Description
            </Typography>
            <TextField
              fullWidth
              required
              multiline
              rows={3}
              value={formData.description}
              onChange={ (e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Describe what your extension does..."
              variant="standard"
              InputProps={{
                disableUnderline: true,
                sx: {
                  bgcolor: '#1C1A18',
                  borderRadius: '16px',
                  color: 'white',
                  p: 2,
                  fontFamily: 'var(--font-satoshi)',
                  fontWeight: 500,
                  border: '1px solid rgba(255, 255, 255, 0.05)',
                  '&:hover': { borderColor: 'rgba(255, 255, 255, 0.1)' },
                  '&.Mui-focused': { borderColor: '#6366F1', boxShadow: '0 0 10px rgba(99, 102, 241, 0.1)' }
                }
              }}
            />
          </Box>

          <Box>
            <Typography variant="caption" sx={{ fontWeight: 800, color: 'rgba(255, 255, 255, 0.3)', mb: 1.5, display: 'block', textTransform: 'uppercase', letterSpacing: '0.1em', fontFamily: 'var(--font-mono)' }}>
              Version
            </Typography>
            <TextField
              fullWidth
              required
              value={formData.version}
              onChange={ (e) => setFormData({ ...formData, version: e.target.value })}
              placeholder="1.0.0"
              variant="standard"
              InputProps={{
                disableUnderline: true,
                sx: {
                  bgcolor: '#1C1A18',
                  borderRadius: '16px',
                  color: 'white',
                  p: 2,
                  fontFamily: 'var(--font-mono)',
                  fontWeight: 600,
                  border: '1px solid rgba(255, 255, 255, 0.05)',
                  '&:hover': { borderColor: 'rgba(255, 255, 255, 0.1)' },
                  '&.Mui-focused': { borderColor: '#6366F1', boxShadow: '0 0 10px rgba(99, 102, 241, 0.1)' }
                }
              }}
            />
          </Box>

          <Box>
            <Typography variant="caption" sx={{ fontWeight: 800, color: 'rgba(255, 255, 255, 0.3)', mb: 1.5, display: 'block', textTransform: 'uppercase', letterSpacing: '0.1em', fontFamily: 'var(--font-mono)' }}>
              Settings (JSON)
            </Typography>
            <TextField
              fullWidth
              multiline
              rows={6}
              value={formData.settings}
              onChange={ (e) => setFormData({ ...formData, settings: e.target.value })}
              placeholder='{"setting1": "value1"}'
              variant="standard"
              InputProps={{
                disableUnderline: true,
                sx: {
                  bgcolor: '#1C1A18',
                  borderRadius: '16px',
                  color: 'white',
                  p: 2,
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.85rem',
                  border: '1px solid rgba(255, 255, 255, 0.05)',
                  '&:hover': { borderColor: 'rgba(255, 255, 255, 0.1)' },
                  '&.Mui-focused': { borderColor: '#6366F1', boxShadow: '0 0 10px rgba(99, 102, 241, 0.1)' }
                }
              }}
            />
          </Box>
        </Stack>
      </DialogContent>
      <DialogActions sx={{ p: 4, pt: 2 }}>
        <Button 
          onClick={onClose} 
          sx={{ color: 'rgba(255, 255, 255, 0.4)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', mr: 2 }}
        >
          Cancel
        </Button>
        <Button 
          onClick={handleSubmit}
          variant="contained"
          sx={{
            bgcolor: '#6366F1',
            color: 'black',
            fontWeight: 900,
            px: 5,
            py: 1.5,
            borderRadius: '14px',
            boxShadow: '0 8px 24px rgba(99, 102, 241, 0.2)',
            '&:hover': { bgcolor: alpha('#6366F1', 0.8), transform: 'translateY(-2px)' }
          }}
        >
          Create Extension
        </Button>
      </DialogActions>
    </Dialog>
  );
}