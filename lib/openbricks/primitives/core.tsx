'use client';
import React from 'react';
import { createPortal } from 'react-dom';
import { Close as CloseIcon } from './icons';

export const alpha = (color: string, value: number) => {
  const a = Math.max(0, Math.min(1, Number.isFinite(value) ? value : 1));
  const input = (color || '').trim();
  if (!input) return `rgba(255,255,255,${a})`;

  if (input.startsWith('#')) {
    const hex = input.slice(1);
    const normalized = hex.length === 3
      ? hex.split('').map((char) => char + char).join('')
      : hex.length === 6
        ? hex
        : null;
    if (!normalized) return input;
    const r = parseInt(normalized.slice(0, 2), 16);
    const g = parseInt(normalized.slice(2, 4), 16);
    const b = parseInt(normalized.slice(4, 6), 16);
    return `rgba(${r},${g},${b},${a})`;
  }

  const rgbMatch = input.match(/^rgba?\(([^)]+)\)$/i);
  if (rgbMatch) {
    const parts = rgbMatch[1].split(',').map((part) => part.trim());
    if (parts.length >= 3) {
      const r = Number(parts[0]);
      const g = Number(parts[1]);
      const b = Number(parts[2]);
      if ([r, g, b].every((part) => Number.isFinite(part))) {
        return `rgba(${r},${g},${b},${a})`;
      }
    }
  }

  return input;
};
export const useTheme = () => ({
  palette: {
    mode: 'dark',
    primary: { main: '#6366F1', dark: '#4F46E5' },
    secondary: { main: '#EC4899', dark: '#DB2777' },
    background: { default: '#000000', paper: '#161514' },
    text: { primary: '#F8FAFC', secondary: '#9B9691' },
    divider: 'rgba(255, 255, 255, 0.05)'},
  breakpoints: {
    down: (key: string) => {
      const map: Record<string, number> = { sm: 640, md: 768, lg: 1024, xl: 1280 };
      return `(max-width: ${map[key] ?? 768}px)`;
    },
    up: (key: string) => {
      const map: Record<string, number> = { sm: 640, md: 768, lg: 1024, xl: 1280 };
      return `(min-width: ${map[key] ?? 768}px)`;
    },
    between: (start: string, end: string) => {
      const map: Record<string, number> = { sm: 640, md: 768, lg: 1024, xl: 1280 };
      return `(min-width: ${map[start] ?? 768}px) and (max-width: ${map[end] ?? 1280}px)`;
    }},
  spacing: (...values: number[]) => values.map((value) => `${value * 8}px`).join(' ')});
export const useMediaQuery = (query: string, _options?: { noSsr?: boolean }) => {
  if (typeof window === 'undefined') return false;
  return window.matchMedia(query).matches;
};

const breakpointsPx: Record<string, number> = { xs: 0, sm: 640, md: 768, lg: 1024, xl: 1280 };

export const pickResponsiveValue = (value: any) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return value;
  if (typeof window === 'undefined') return value.md ?? value.sm ?? value.xs ?? Object.values(value)[0];
  const width = window.innerWidth;
  let picked: any = value.xs ?? Object.values(value)[0];
  for (const [bp, min] of Object.entries(breakpointsPx)) {
    if (width >= min && value[bp] !== undefined) picked = value[bp];
  }
  return picked;
};

export const normalizeStyleValue = (key: string, value: any) => {
  if (value === undefined || value === null) return value;
  const resolved = pickResponsiveValue(value);
  if (typeof resolved === 'number') {
    // Unitless numeric styles (MUI ratios / weights) — never append px.
    if (/lineHeight/i.test(key) || key === 'opacity' || key === 'zIndex' || key === 'fontWeight' || key === 'flex') {
      return resolved;
    }
    if (/(padding|margin|gap)/i.test(key)) {
      return `${resolved * 8}px`;
    }
    // Scale numeric border radius values by standard 4px MUI shape.borderRadius base unit.
    if (/Radius$/i.test(key)) {
      if (resolved > 50) return `${resolved}px`;
      return `${resolved * 4}px`;
    }
    // Match dimensional keys exactly; avoid substring hits like lineHeight → "height".
    if (
      /^(width|height|minWidth|minHeight|maxWidth|maxHeight|top|left|right|bottom|fontSize)$/i.test(key) ||
      /(Width|Height|Top|Left|Right|Bottom)$/i.test(key)
    ) {
      return `${resolved}px`;
    }
  }
  return resolved;
};

const sxKeyMap: Record<string, string> = {
  bgcolor: 'backgroundColor',
  px: 'paddingInline',
  py: 'paddingBlock',
  pt: 'paddingTop',
  pb: 'paddingBottom',
  pl: 'paddingLeft',
  pr: 'paddingRight',
  mx: 'marginInline',
  my: 'marginBlock',
  mt: 'marginTop',
  mb: 'marginBottom',
  ml: 'marginLeft',
  mr: 'marginRight'};

export const splitSx = (sx: any) => {
  const root: any = {};
  const nested: Record<string, any> = {};
  if (!sx || typeof sx !== 'object') return { root: sx, nested };
  for (const key in sx) {
    if (key.startsWith('&')) {
      nested[key] = sx[key];
      continue;
    }
    if (key.startsWith('@')) continue;
    const mappedKey = sxKeyMap[key] || key;
    root[mappedKey] = normalizeStyleValue(mappedKey, sx[key]);
  }
  return { root, nested };
};

const THEME_FOR_SX = {
  palette: {
    mode: 'dark',
    primary: { main: '#6366F1', dark: '#4F46E5' },
    secondary: { main: '#EC4899', dark: '#DB2777' },
    background: { default: '#000000', paper: '#161514' },
    text: { primary: '#F8FAFC', secondary: '#9B9691' },
    divider: 'rgba(255, 255, 255, 0.05)'}};

export const resolvePaletteToken = (value: any): any => {
  if (typeof value === 'function') {
    try {
      return resolvePaletteToken(value(THEME_FOR_SX));
    } catch {
      return value;
    }
  }
  if (typeof value !== 'string') return value;
  const [group, key] = value.split('.');
  const paletteGroup = (THEME_FOR_SX.palette as any)[group];
  if (paletteGroup && key && paletteGroup[key] !== undefined) return paletteGroup[key];
  return value;
};

export const cleanSx = (sx: any) => {
  const { root } = splitSx(sx);
  if (!root || typeof root !== 'object') return root;
  const resolved: Record<string, any> = {};
  for (const key in root) {
    const val = root[key];
    if (key === 'color' || key === 'backgroundColor' || key === 'borderColor' || key === 'bgcolor' || key === 'background') {
      const mappedKey = (key === 'bgcolor' || key === 'background') ? 'backgroundColor' : key;
      resolved[mappedKey] = resolvePaletteToken(val);
      continue;
    }
    resolved[key] = val;
  }
  return resolved;
};

export const isRenderableComponentType = (value: any) => {
  if (!value) return false;
  if (typeof value === 'function') return true;
  if (typeof value === 'object' && value.$$typeof) return true;
  return false;
};

// 1. Box Component
