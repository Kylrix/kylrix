'use client';

import { useMemo, useState } from 'react';
import {
  Box,
  Collapse,
  Drawer,
  IconButton,
  InputAdornment,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  Paper,
  Stack,
  TextField,
  Typography,
  alpha,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { ChevronDown, ChevronRight, Menu as MenuIcon, Search, X } from 'lucide-react';
import NextLink from 'next/link';
import { usePathname } from 'next/navigation';
import { DOCS_CATEGORIES, getDocsArticleBySlug, searchDocsArticles } from '@/components/docs/catalog';

const getDocsSlugFromPathname = (pathname: string) => {
  if (!pathname.startsWith('/docs')) return '';
  const slug = pathname.replace('/docs', '').replace(/^\/+/, '');
  return slug;
};

const SidebarContent = ({ onClose }: { onClose?: () => void }) => {
  const pathname = usePathname();
  const [query, setQuery] = useState('');
  const [expandedCategories, setExpandedCategories] = useState<string[]>(DOCS_CATEGORIES.map((category) => category.id));
  const currentSlug = getDocsSlugFromPathname(pathname);
  const resolvedCurrentSlug = getDocsArticleBySlug(currentSlug)?.slug || currentSlug;
  const filteredArticles = useMemo(() => searchDocsArticles(query), [query]);

  const toggleCategory = (categoryId: string) => {
    setExpandedCategories((prev) => (prev.includes(categoryId) ? prev.filter((id) => id !== categoryId) : [...prev, categoryId]));
  };

  const articleHref = (slug: string) => `/docs/${slug}`;
  const isSelected = (slug: string) => resolvedCurrentSlug === slug;

  const groupedArticles = useMemo(() => {
    const groups = DOCS_CATEGORIES.map((category) => ({
      category,
      articles: filteredArticles.filter((article) => article.category === category.id),
    })).filter((group) => group.articles.length > 0);
    return groups;
  }, [filteredArticles]);

  return (
    <Stack spacing={3} sx={{ px: { xs: 2, md: 3 }, py: { xs: 2, md: 3 } }}>
      <Box>
        <Typography variant="overline" sx={{ color: '#6366F1', fontWeight: 900, letterSpacing: '0.3em' }}>
          DOCS
        </Typography>
        <Typography variant="h6" sx={{ mt: 0.5, fontWeight: 900, letterSpacing: '-0.03em' }}>
          Search the ecosystem
        </Typography>
      </Box>

      <TextField
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search docs"
        fullWidth
        size="small"
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <Search size={16} />
            </InputAdornment>
          ),
        }}
      />

      <Stack spacing={2}>
        {groupedArticles.length > 0 ? groupedArticles.map(({ category, articles }) => {
          const Icon = category.icon;
          const expanded = expandedCategories.includes(category.id) || query.trim().length > 0;
          return (
            <Paper key={category.id} sx={{ p: 1.5, bgcolor: alpha('#fff', 0.02), border: '1px solid rgba(255,255,255,0.06)' }}>
              <ListItemButton
                onClick={() => toggleCategory(category.id)}
                sx={{
                  borderRadius: 2,
                  mb: 1,
                  px: 1.5,
                  py: 1,
                  bgcolor: alpha(category.accent, 0.06),
                }}
              >
                <Box sx={{ color: category.accent, display: 'flex', mr: 1.25 }}>
                  <Icon size={18} />
                </Box>
                <ListItemText
                  primary={category.title}
                  secondary={query.trim().length > 0 ? `${articles.length} matches` : category.summary}
                  primaryTypographyProps={{ sx: { fontWeight: 800 } }}
                  secondaryTypographyProps={{ sx: { color: 'rgba(255,255,255,0.5)', fontSize: '0.78rem', lineHeight: 1.5 } }}
                />
                {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
              </ListItemButton>

              <Collapse in={expanded} timeout="auto" unmountOnExit>
                <List disablePadding sx={{ pl: 0.5 }}>
                  {articles.map((article) => (
                    <ListItem key={article.slug} disablePadding sx={{ mb: 0.5 }}>
                      <ListItemButton
                        component={NextLink}
                        href={articleHref(article.slug)}
                        onClick={onClose}
                        selected={isSelected(article.slug)}
                        sx={{
                          borderRadius: 2,
                          px: 1.5,
                          py: 1,
                          '&.Mui-selected': {
                            bgcolor: alpha(category.accent, 0.13),
                            color: category.accent,
                          },
                          '&:hover': {
                            bgcolor: alpha(category.accent, 0.08),
                          },
                        }}
                      >
                        <ListItemText
                          primary={article.title}
                          secondary={article.summary}
                          primaryTypographyProps={{ sx: { fontWeight: 700, fontSize: '0.92rem' } }}
                          secondaryTypographyProps={{ sx: { color: 'rgba(255,255,255,0.48)', fontSize: '0.76rem', lineHeight: 1.4 } }}
                        />
                      </ListItemButton>
                    </ListItem>
                  ))}
                </List>
              </Collapse>
            </Paper>
          );
        }) : (
          <Paper sx={{ p: 2.5, bgcolor: alpha('#fff', 0.02), border: '1px solid rgba(255,255,255,0.06)' }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 800, mb: 0.5 }}>
              No matching docs
            </Typography>
            <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.5)', lineHeight: 1.7 }}>
              Try a different keyword or clear the search field to browse every category.
            </Typography>
          </Paper>
        )}
      </Stack>

      {query.trim() ? (
        <Box sx={{ px: 1 }}>
          <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.45)', letterSpacing: '0.18em' }}>
            {filteredArticles.length} result{filteredArticles.length === 1 ? '' : 's'}
          </Typography>
        </Box>
      ) : null}
    </Stack>
  );
};

export default function DocsSidebar() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [mobileOpen, setMobileOpen] = useState(false);

  if (isMobile) {
    return (
      <>
        <Box sx={{ position: 'fixed', bottom: 24, right: 24, zIndex: 1100 }}>
          <IconButton
            onClick={() => setMobileOpen(true)}
            sx={{
              bgcolor: '#6366F1',
              color: 'white',
              width: 56,
              height: 56,
              boxShadow: '0 12px 32px rgba(99, 102, 241, 0.35)',
              '&:hover': { bgcolor: '#4F46E5' },
            }}
          >
            <MenuIcon size={24} />
          </IconButton>
        </Box>
        <Drawer
          anchor="left"
          open={mobileOpen}
          onClose={() => setMobileOpen(false)}
          PaperProps={{
            sx: {
              width: '88%',
              maxWidth: 360,
              bgcolor: theme.palette.mode === 'dark' ? 'rgba(10, 9, 8, 0.98)' : 'rgba(253, 252, 251, 0.98)',
              backdropFilter: 'blur(22px)',
              backgroundImage: 'none',
            },
          }}
        >
          <Box sx={{ p: 2, display: 'flex', justifyContent: 'flex-end' }}>
            <IconButton onClick={() => setMobileOpen(false)}>
              <X size={22} />
            </IconButton>
          </Box>
          <SidebarContent onClose={() => setMobileOpen(false)} />
        </Drawer>
      </>
    );
  }

  return (
    <Box
      sx={{
        width: 320,
        pt: 12,
        pb: 10,
        position: 'fixed',
        height: '100vh',
        overflowY: 'auto',
        borderRight: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
        display: { xs: 'none', md: 'block' },
        bgcolor: alpha('#0A0908', 0.55),
        backdropFilter: 'blur(18px)',
        scrollbarWidth: 'none',
        '&::-webkit-scrollbar': { display: 'none' },
      }}
    >
      <SidebarContent />
    </Box>
  );
}
