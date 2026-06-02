'use client';

import React, { useState } from 'react';
import { Box, Container, Typography, Grid, Paper, Stack, Button, IconButton, TextField } from '@/lib/mui-tailwind/material';
import { ArrowLeft, Home, Play, Pause, Copy, Check, Sparkles, ShieldAlert, Cpu } from 'lucide-react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface KylrixIconVariation {
  id: string;
  name: string;
  category: 'Loading' | 'Security' | 'Connection' | 'Classic';
  description: string;
  svgCode: string;
  render: (color: string, animate: boolean) => React.ReactNode;
}

export default function KylrixIconsPage() {
  const router = useRouter();

  const [selectedId, setSelectedId] = useState<string>('boot');
  const [isAnimated, setIsAnimated] = useState<boolean>(true);
  const [activeColor, setActiveColor] = useState<string>('#6366F1'); // Indigo accent
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const variationsDeck: KylrixIconVariation[] = [
    {
      id: 'classic',
      name: 'Kylrix Classic Carved',
      category: 'Classic',
      description: 'The pristine skeuomorphic carved emblem. Incorporates a 3px solid contour split line, custom diamond cutout, and high-contrast volcanic slate outlines.',
      svgCode: `<svg width="100" height="100" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
  <!-- Outer Solid Black Contour -->
  <polygon points="50,9 14,29 14,71 50,91 86,71 86,29" fill="none" stroke="#000000" stroke-width="3.5" stroke-linejoin="round" />
  <!-- Volcanic Slate Hairline -->
  <polygon points="50,9 14,29 14,71 50,91 86,71 86,29" fill="none" stroke="#23211F" stroke-width="2" stroke-linejoin="round" />
  
  <!-- Left Hemisphere -->
  <polygon points="50,10 15,30 15,70 50,90" fill="#131110" />
  <!-- Right Hemisphere -->
  <polygon points="50,10 85,30 85,70 50,90" fill="#0B0A09" />
  
  <!-- Outer Specular Reflection Highlight -->
  <polyline points="15,30 50,10 85,30" fill="none" stroke="#ACCENTS" stroke-width="1.5" opacity="0.6" />

  <!-- Center Seam Split -->
  <line x1="50" y1="10" x2="50" y2="90" stroke="#000000" stroke-width="3" />
  <line x1="50" y1="10" x2="50" y2="90" stroke="#23211F" stroke-width="1" />

  <!-- Carved Cutout Diamond Recess -->
  <polygon points="51,40 63,52 51,64 39,52" fill="#000000" />
  <polygon points="50,38 62,50 50,62 38,50" fill="#FFFFFF" stroke="#000000" stroke-width="2" />
</svg>`,
      render: (color, animate) => (
        <svg width="110" height="110" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
          {/* Hard 3D recess shadow */}
          <polygon points="52,11 16,31 16,73 52,93 88,73 88,31" fill="#000000" />
          {/* Outer Black Contour */}
          <polygon points="50,9 14,29 14,71 50,91 86,71 86,29" fill="none" stroke="#000000" strokeWidth="4" strokeLinejoin="round" />
          {/* Volcanic Slate Hairline */}
          <polygon points="50,9 14,29 14,71 50,91 86,71 86,29" fill="none" stroke="#23211F" strokeWidth="2.5" strokeLinejoin="round" />
          
          {/* Left Hemisphere */}
          <polygon points="50,10 15,30 15,70 50,90" fill="#131110" />
          {/* Right Hemisphere */}
          <polygon points="50,10 85,30 85,70 50,90" fill="#0B0A09" />
          
          {/* Specular Highlight */}
          <polyline 
            points="15,30 50,10 85,30" 
            fill="none" 
            stroke={color} 
            strokeWidth={1.5} 
            opacity={0.7} 
            style={{
              animation: animate ? 'glow 2.5s infinite alternate ease-in-out' : 'none'
            }}
          />

          {/* Center Seam Split */}
          <line x1="50" y1="10" x2="50" y2="90" stroke="#000000" strokeWidth="3" />
          <line x1="50" y1="10" x2="50" y2="90" stroke="#23211F" strokeWidth="1" />

          {/* Carved Cutout Diamond Recess */}
          <polygon points="51,40 63,52 51,64 39,52" fill="#000000" />
          <polygon points="50,38 62,50 50,62 38,50" fill="#FFFFFF" stroke="#000000" strokeWidth="2.2" />
          <style>{`
            @keyframes glow {
              0% { opacity: 0.2; }
              100% { opacity: 1; }
            }
          `}</style>
        </svg>
      )
    },
    {
      id: 'boot',
      name: 'Kylrix Sync & Boot Loader',
      category: 'Loading',
      description: 'An active vector animation executing infinite line-drawing tracing around the Hexagon boundaries to represent workspace boot configurations.',
      svgCode: `<svg width="100" height="100" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
  <!-- Solid Hemispheres with subtle scale pulsations -->
  <g style="animation: pulse 2s infinite ease-in-out; transform-origin: 50px 50px;">
    <polygon points="50,10 15,30 15,70 50,90" fill="#131110" />
    <polygon points="50,10 85,30 85,70 50,90" fill="#0B0A09" />
  </g>

  <!-- Tracing Sync Line (Outer Border) -->
  <polygon points="50,9 14,29 14,71 50,91 86,71 86,29" fill="none" stroke="#ACCENTS" stroke-width="2.5" stroke-dasharray="280" stroke-dashoffset="0" style="animation: trace 3s infinite linear; stroke-linejoin: round;" />

  <!-- Center seam split -->
  <line x1="50" y1="10" x2="50" y2="90" stroke="#23211F" stroke-width="2.5" />
  
  <!-- Pulsing Diamond Cutout -->
  <polygon points="50,38 62,50 50,62 38,50" fill="#ACCENTS" stroke="#000000" stroke-width="2" style="animation: pulse 1s infinite alternate ease-in-out; transform-origin: 50px 50px;" />

  <style>
    @keyframes trace {
      0% { stroke-dashoffset: 280; }
      100% { stroke-dashoffset: 0; }
    }
    @keyframes pulse {
      0% { transform: scale(0.95); opacity: 0.8; }
      100% { transform: scale(1.02); opacity: 1; }
    }
  </style>
</svg>`,
      render: (color, animate) => (
        <svg width="110" height="110" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
          {/* Inner Hemispheres */}
          <g style={{
            animation: animate ? 'pulse 2s infinite ease-in-out' : 'none',
            transformOrigin: '50px 50px'
          }}>
            <polygon points="50,10 15,30 15,70 50,90" fill="#131110" />
            <polygon points="50,10 85,30 85,70 50,90" fill="#0B0A09" />
          </g>

          {/* Background Border Hairline */}
          <polygon points="50,9 14,29 14,71 50,91 86,71 86,29" fill="none" stroke="#23211F" strokeWidth="2.5" strokeLinejoin="round" />

          {/* Tracing Sync Line */}
          <polygon 
            points="50,9 14,29 14,71 50,91 86,71 86,29" 
            fill="none" 
            stroke={color} 
            strokeWidth={3} 
            strokeLinejoin="round"
            strokeDasharray="180 180"
            style={{
              animation: animate ? 'trace 2.8s infinite linear' : 'none',
              transformOrigin: '50px 50px'
            }} 
          />

          {/* Center seam */}
          <line x1="50" y1="10" x2="50" y2="90" stroke="#000000" strokeWidth="3" />
          <line x1="50" y1="10" x2="50" y2="90" stroke="#23211F" strokeWidth="1" />

          {/* Pulsing diamond cutout */}
          <polygon 
            points="50,38 62,50 50,62 38,50" 
            fill={color} 
            stroke="#000000" 
            strokeWidth={2.2} 
            style={{
              animation: animate ? 'pulse-fast 1.2s infinite alternate ease-in-out' : 'none',
              transformOrigin: '50px 50px'
            }}
          />
          <style>{`
            @keyframes trace {
              0% { stroke-dashoffset: 360; }
              100% { stroke-dashoffset: 0; }
            }
            @keyframes pulse {
              0% { transform: scale(0.96); }
              50% { transform: scale(1.01); }
              100% { transform: scale(0.96); }
            }
            @keyframes pulse-fast {
              0% { opacity: 0.4; transform: scale(0.9); }
              100% { opacity: 1; transform: scale(1.08); }
            }
          `}</style>
        </svg>
      )
    },
    {
      id: 'shield',
      name: 'Kylrix Shielded Vault Node',
      category: 'Security',
      description: 'The Hexagon logo nested securely inside a thick Obsidian Shield, protecting local database credentials with E2E encryption.',
      svgCode: `<svg width="100" height="100" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
  <!-- Outer Shield Boundary -->
  <path d="M50 6C68 6 83 12 83 32C83 60 68 78 50 88C32 78 17 60 17 32C17 12 32 6 50 6Z" fill="#000000" stroke="#23211F" stroke-width="2.5" />
  
  <!-- Shrunk Hexagon Core -->
  <g transform="translate(18, 18) scale(0.64)">
    <polygon points="50,10 15,30 15,70 50,90" fill="#131110" />
    <polygon points="50,10 85,30 85,70 50,90" fill="#0B0A09" />
    <polygon points="50,9 14,29 14,71 50,91 86,71 86,29" fill="none" stroke="#23211F" stroke-width="2" />
    <line x1="50" y1="10" x2="50" y2="90" stroke="#000000" stroke-width="3" />
    <polygon points="50,38 62,50 50,62 38,50" fill="#ACCENTS" stroke="#000000" stroke-width="1.8" />
  </g>

  <!-- Glowing Laser Scanning bar -->
  <line x1="22" y1="36" x2="78" y2="36" stroke="#ACCENTS" stroke-width="2" style="animation: shield-scan 2.8s infinite ease-in-out;" />

  <style>
    @keyframes shield-scan {
      0%, 100% { transform: translateY(0); opacity: 0.3; }
      50% { transform: translateY(32px); opacity: 1; }
    }
  </style>
</svg>`,
      render: (color, animate) => (
        <svg width="110" height="110" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
          {/* Outer Shield Boundary */}
          <path d="M50 6C68 6 83 12 83 32C83 60 68 78 50 88C32 78 17 60 17 32C17 12 32 6 50 6Z" fill="#0B0A09" stroke="#23211F" strokeWidth={3} />
          
          {/* Shrunk Hexagon Core */}
          <g transform="translate(18, 18) scale(0.64)">
            <polygon points="50,10 15,30 15,70 50,90" fill="#131110" />
            <polygon points="50,10 85,30 85,70 50,90" fill="#000000" />
            <polygon points="50,9 14,29 14,71 50,91 86,71 86,29" fill="none" stroke="#23211F" strokeWidth={2.5} />
            <line x1="50" y1="10" x2="50" y2="90" stroke="#000000" strokeWidth="3.5" />
            <polygon points="50,38 62,50 50,62 38,50" fill={color} stroke="#000000" strokeWidth={2.2} />
          </g>

          {/* Glowing Laser Scanning bar */}
          <line 
            x1="24" 
            y1="34" 
            x2="76" 
            y2="34" 
            stroke={color} 
            strokeWidth={2} 
            style={{ 
              animation: animate ? 'shield-scan 3s infinite ease-in-out' : 'none' 
            }} 
          />
          <style>{`
            @keyframes shield-scan {
              0%, 100% { transform: translateY(0); opacity: 0.2; }
              50% { transform: translateY(32px); opacity: 1; }
            }
          `}</style>
        </svg>
      )
    },
    {
      id: 'connect',
      name: 'Kylrix Connected Peer Nodes',
      category: 'Connection',
      description: 'Two hexagonal workspace nodes communicating via live sharing pipelines. Renders flowing data packets moving between peer-to-peer portals.',
      svgCode: `<svg width="100" height="100" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
  <!-- P2P Connected network pipe -->
  <line x1="28" y1="35" x2="72" y2="65" stroke="#23211F" stroke-width="2" />
  <line x1="28" y1="35" x2="72" y2="65" stroke="#ACCENTS" stroke-width="2" stroke-dasharray="4, 12" style="animation: connect-flow 2s infinite linear;" />

  <!-- Node 1 (Source - Top Left) -->
  <g transform="translate(10, 15) scale(0.38)">
    <polygon points="50,10 15,30 15,70 50,90" fill="#131110" />
    <polygon points="50,10 85,30 85,70 50,90" fill="#0B0A09" />
    <polygon points="50,9 14,29 14,71 50,91 86,71 86,29" fill="none" stroke="#23211F" stroke-width="2" />
    <polygon points="50,38 62,50 50,62 38,50" fill="#ACCENTS" stroke="#000000" stroke-width="2" />
  </g>

  <!-- Node 2 (Destination - Bottom Right) -->
  <g transform="translate(52, 45) scale(0.38)">
    <polygon points="50,10 15,30 15,70 50,90" fill="#131110" />
    <polygon points="50,10 85,30 85,70 50,90" fill="#0B0A09" />
    <polygon points="50,9 14,29 14,71 50,91 86,71 86,29" fill="none" stroke="#23211F" stroke-width="2" />
    <polygon points="50,38 62,50 50,62 38,50" fill="#ACCENTS" stroke="#000000" stroke-width="2" />
  </g>

  <style>
    @keyframes connect-flow {
      0% { stroke-dashoffset: 16; }
      100% { stroke-dashoffset: 0; }
    }
  </style>
</svg>`,
      render: (color, animate) => (
        <svg width="110" height="110" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
          {/* Background solid link pipeline */}
          <line x1="28" y1="35" x2="72" y2="65" stroke="#23211F" strokeWidth={3} />
          {/* Glowing active packet flow */}
          <line 
            x1="28" 
            y1="35" 
            x2="72" 
            y2="65" 
            stroke={color} 
            strokeWidth={3} 
            strokeDasharray="6, 14" 
            style={{
              animation: animate ? 'connect-flow 2.2s infinite linear' : 'none'
            }} 
          />

          {/* Node 1 (Source - Top Left) */}
          <g transform="translate(10, 15) scale(0.38)">
            <polygon points="50,10 15,30 15,70 50,90" fill="#131110" />
            <polygon points="50,10 85,30 85,70 50,90" fill="#0B0A09" />
            <polygon points="50,9 14,29 14,71 50,91 86,71 86,29" fill="none" stroke="#23211F" strokeWidth={2.5} />
            <polygon points="50,38 62,50 50,62 38,50" fill={color} stroke="#000000" strokeWidth={2} />
          </g>

          {/* Node 2 (Destination - Bottom Right) */}
          <g transform="translate(52, 45) scale(0.38)">
            <polygon points="50,10 15,30 15,70 50,90" fill="#131110" />
            <polygon points="50,10 85,30 85,70 50,90" fill="#0B0A09" />
            <polygon points="50,9 14,29 14,71 50,91 86,71 86,29" fill="none" stroke="#23211F" strokeWidth={2.5} />
            <polygon points="50,38 62,50 50,62 38,50" fill={color} stroke="#000000" strokeWidth={2} />
          </g>
          <style>{`
            @keyframes connect-flow {
              0% { stroke-dashoffset: 20; }
              100% { stroke-dashoffset: 0; }
            }
          `}</style>
        </svg>
      )
    },
    {
      id: 'agentic',
      name: 'Agentic hemisphere Loop',
      category: 'Loading',
      description: 'Continuous separation and fusion cycle of left and right hemispheres. Designed specifically to visualize real-time reasoning and background agentic operations.',
      svgCode: `<svg width="100" height="100" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
  <!-- Left half group -->
  <g style="animation: sepLeft 2s infinite ease-in-out;">
    <polygon points="50,10 15,30 15,70 50,90" fill="#131110" />
    <polyline points="50,10 15,30 15,70 50,90" fill="none" stroke="#23211F" stroke-width="2" />
  </g>
  <!-- Right half group -->
  <g style="animation: sepRight 2s infinite ease-in-out;">
    <polygon points="50,10 85,30 85,70 50,90" fill="#0B0A09" />
    <polyline points="50,10 85,30 85,70 50,90" fill="none" stroke="#ACCENTS" stroke-width="2" />
    <polygon points="50,38 62,50 50,62 38,50" fill="#FFFFFF" stroke="#000000" stroke-width="1.8" />
  </g>
  <!-- Center split lines -->
  <line x1="50" y1="10" x2="50" y2="90" stroke="#000000" stroke-width="3" />
  <line x1="50" y1="10" x2="50" y2="90" stroke="#23211F" stroke-width="1" />
  <style>
    @keyframes sepLeft {
      0%, 100% { transform: translateX(0); }
      50% { transform: translateX(-15px); }
    }
    @keyframes sepRight {
      0%, 100% { transform: translateX(0); }
      50% { transform: translateX(15px); }
    }
  </style>
</svg>`,
      render: (color, animate) => (
        <svg width="110" height="110" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
          <g style={{ animation: animate ? 'sepLeft 2.2s infinite ease-in-out' : 'none' }}>
            <polygon points="50,10 15,30 15,70 50,90" fill="#131110" />
            <polyline points="50,10 15,30 15,70 50,90" fill="none" stroke="#23211F" strokeWidth={2.5} />
          </g>
          <g style={{ animation: animate ? 'sepRight 2.2s infinite ease-in-out' : 'none' }}>
            <polygon points="50,10 85,30 85,70 50,90" fill="#0B0A09" />
            <polyline points="50,10 85,30 85,70 50,90" fill="none" stroke={color} strokeWidth={2.5} />
            <polygon points="50,38 62,50 50,62 38,50" fill="#FFFFFF" stroke="#000000" strokeWidth={2.2} />
          </g>
          <line x1="50" y1="10" x2="50" y2="90" stroke="#000000" strokeWidth="3" />
          <line x1="50" y1="10" x2="50" y2="90" stroke="#23211F" strokeWidth="1" />
          <style>{`
            @keyframes sepLeft {
              0%, 100% { transform: translateX(0); }
              50% { transform: translateX(-16px); }
            }
            @keyframes sepRight {
              0%, 100% { transform: translateX(0); }
              50% { transform: translateX(16px); }
            }
          `}</style>
        </svg>
      )
    },
    {
      id: 'brush',
      name: 'Shear Slide brush',
      category: 'Loading',
      description: 'Skeuomorphic shear slide movement. The hexagon hemispheres slide along opposing vertical vectors to simulate active loading states with tactile physical friction.',
      svgCode: `<svg width="100" height="100" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
  <g style="animation: brushL 2.5s infinite ease-in-out;">
    <polygon points="50,10 15,30 15,70 50,90" fill="#131110" />
    <polyline points="50,10 15,30 15,70 50,90" fill="none" stroke="#23211F" stroke-width="2" />
  </g>
  <g style="animation: brushR 2.5s infinite ease-in-out;">
    <polygon points="50,10 85,30 85,70 50,90" fill="#0B0A09" />
    <polyline points="50,10 85,30 85,70 50,90" fill="none" stroke="#ACCENTS" stroke-width="2" />
    <polygon points="50,38 62,50 50,62 38,50" fill="#FFFFFF" stroke="#000000" stroke-width="1.8" />
  </g>
  <style>
    @keyframes brushL {
      0%, 100% { transform: translateY(0); }
      50% { transform: translateY(-12px); }
    }
    @keyframes brushR {
      0%, 100% { transform: translateY(0); }
      50% { transform: translateY(12px); }
    }
  </style>
</svg>`,
      render: (color, animate) => (
        <svg width="110" height="110" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
          <g style={{ animation: animate ? 'brushL 2.4s infinite ease-in-out' : 'none' }}>
            <polygon points="50,10 15,30 15,70 50,90" fill="#131110" />
            <polyline points="50,10 15,30 15,70 50,90" fill="none" stroke="#23211F" strokeWidth={2.5} />
          </g>
          <g style={{ animation: animate ? 'brushR 2.4s infinite ease-in-out' : 'none' }}>
            <polygon points="50,10 85,30 85,70 50,90" fill="#0B0A09" />
            <polyline points="50,10 85,30 85,70 50,90" fill="none" stroke={color} strokeWidth={2.5} />
            <polygon points="50,38 62,50 50,62 38,50" fill="#FFFFFF" stroke="#000000" strokeWidth={2.2} />
          </g>
          <style>{`
            @keyframes brushL {
              0%, 100% { transform: translateY(0); }
              50% { transform: translateY(-12px); }
            }
            @keyframes brushR {
              0%, 100% { transform: translateY(0); }
              50% { transform: translateY(12px); }
            }
          `}</style>
        </svg>
      )
    },
    {
      id: 'spinner',
      name: '3D Y-Axis Axis Spinner',
      category: 'Classic',
      description: 'A premium 3D axis spin rotation. Turns the entire hexagonal structure around its vertical axis perpendicular to the screen.',
      svgCode: `<svg width="100" height="100" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" style="perspective: 500px;">
  <g style="animation: spinY 5s infinite linear; transform-origin: 50px 50px; transform-style: preserve-3d;">
    <polygon points="50,10 15,30 15,70 50,90" fill="#131110" />
    <polygon points="50,10 85,30 85,70 50,90" fill="#0B0A09" />
    <polygon points="50,9 14,29 14,71 50,91 86,71 86,29" fill="none" stroke="#23211F" stroke-width="2" />
    <line x1="50" y1="10" x2="50" y2="90" stroke="#000000" stroke-width="3" />
    <polygon points="50,38 62,50 50,62 38,50" fill="#ACCENTS" stroke="#000000" stroke-width="1.8" />
  </g>
  <style>
    @keyframes spinY {
      0% { transform: rotateY(0deg); }
      100% { transform: rotateY(360deg); }
    }
  </style>
</svg>`,
      render: (color, animate) => (
        <svg width="110" height="110" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ perspective: '600px' }}>
          <g style={{ 
            animation: animate ? 'spinY 4.5s infinite linear' : 'none', 
            transformOrigin: '50px 50px',
            transformStyle: 'preserve-3d'
          }}>
            <polygon points="50,10 15,30 15,70 50,90" fill="#131110" />
            <polygon points="50,10 85,30 85,70 50,90" fill="#000000" />
            <polygon points="50,9 14,29 14,71 50,91 86,71 86,29" fill="none" stroke="#23211F" strokeWidth={2.5} strokeLinejoin="round" />
            <line x1="50" y1="10" x2="50" y2="90" stroke="#000000" strokeWidth="3" />
            <line x1="50" y1="10" x2="50" y2="90" stroke="#23211F" strokeWidth="1" />
            <polygon points="50,38 62,50 50,62 38,50" fill={color} stroke="#000000" strokeWidth={2.2} />
          </g>
          <style>{`
            @keyframes spinY {
              0% { transform: rotateY(0deg); }
              100% { transform: rotateY(360deg); }
            }
          `}</style>
        </svg>
      )
    },
    {
      id: 'resonance',
      name: 'Resonance Center Pulse Wave',
      category: 'Connection',
      description: 'A central signal broadcaster. Concentric hexagonal outline waves emerge and ripple outwards from the core diamond seam.',
      svgCode: `<svg width="100" height="100" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
  <polygon points="50,9 14,29 14,71 50,91 86,71 86,29" fill="none" stroke="#ACCENTS" stroke-width="2" style="animation: ripple 2s infinite ease-out; transform-origin: 50px 50px;" />
  <polygon points="50,9 14,29 14,71 50,91 86,71 86,29" fill="none" stroke="#ACCENTS" stroke-width="1.5" style="animation: ripple 2s infinite ease-out; animation-delay: 0.9s; transform-origin: 50px 50px;" />
  
  <polygon points="50,10 15,30 15,70 50,90" fill="#131110" />
  <polygon points="50,10 85,30 85,70 50,90" fill="#0B0A09" />
  <polygon points="50,9 14,29 14,71 50,91 86,71 86,29" fill="none" stroke="#23211F" stroke-width="2" />
  <polygon points="50,38 62,50 50,62 38,50" fill="#ACCENTS" stroke="#000000" stroke-width="1.8" />
  
  <style>
    @keyframes ripple {
      0% { transform: scale(0.7); opacity: 1; }
      100% { transform: scale(1.35); opacity: 0; }
    }
  </style>
</svg>`,
      render: (color, animate) => (
        <svg width="110" height="110" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
          {animate && (
            <>
              <polygon 
                points="50,9 14,29 14,71 50,91 86,71 86,29" 
                fill="none" 
                stroke={color} 
                strokeWidth={2} 
                style={{ animation: 'ripple 2s infinite ease-out', transformOrigin: '50px 50px' }} 
              />
              <polygon 
                points="50,9 14,29 14,71 50,91 86,71 86,29" 
                fill="none" 
                stroke={color} 
                strokeWidth={1.5} 
                style={{ animation: 'ripple 2s infinite ease-out', animationDelay: '0.9s', transformOrigin: '50px 50px' }} 
              />
            </>
          )}
          <polygon points="50,10 15,30 15,70 50,90" fill="#131110" />
          <polygon points="50,10 85,30 85,70 50,90" fill="#000000" />
          <polygon points="50,9 14,29 14,71 50,91 86,71 86,29" fill="none" stroke="#23211F" strokeWidth={2.5} strokeLinejoin="round" />
          <line x1="50" y1="10" x2="50" y2="90" stroke="#000000" strokeWidth="3" />
          <line x1="50" y1="10" x2="50" y2="90" stroke="#23211F" strokeWidth="1" />
          <polygon points="50,38 62,50 50,62 38,50" fill={color} stroke="#000000" strokeWidth={2.2} />
          <style>{`
            @keyframes ripple {
              0% { transform: scale(0.7); opacity: 1; }
              100% { transform: scale(1.35); opacity: 0; }
            }
          `}</style>
        </svg>
      )
    },
    {
      id: 'tumbler',
      name: '3D Perpendicular Tumbler',
      category: 'Security',
      description: '3D independent perpendicular flips. The hemispheres separate horizontally and tumble around their independent 3D vertical axes to simulate physical engine cycles.',
      svgCode: `<svg width="100" height="100" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" style="perspective: 600px;">
  <!-- Left Hemisphere group -->
  <g style="animation: tumbleL 3s infinite ease-in-out; transform-origin: 32px 50px; transform-style: preserve-3d;">
    <polygon points="50,10 15,30 15,70 50,90" fill="#131110" />
    <polyline points="50,10 15,30 15,70 50,90" fill="none" stroke="#23211F" stroke-width="2" />
  </g>
  <!-- Right Hemisphere group -->
  <g style="animation: tumbleR 3s infinite ease-in-out; transform-origin: 68px 50px; transform-style: preserve-3d;">
    <polygon points="50,10 85,30 85,70 50,90" fill="#0B0A09" />
    <polyline points="50,10 85,30 85,70 50,90" fill="none" stroke="#ACCENTS" stroke-width="2" />
    <polygon points="50,38 62,50 50,62 38,50" fill="#FFFFFF" stroke="#000000" stroke-width="1.8" />
  </g>
  <style>
    @keyframes tumbleL {
      0%, 100% { transform: translateX(-6px) rotateY(0deg); }
      50% { transform: translateX(-6px) rotateY(180deg); }
    }
    @keyframes tumbleR {
      0%, 100% { transform: translateX(6px) rotateY(0deg); }
      50% { transform: translateX(6px) rotateY(-180deg); }
    }
  </style>
</svg>`,
      render: (color, animate) => (
        <svg width="110" height="110" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ perspective: '600px' }}>
          <g style={{ 
            animation: animate ? 'tumbleL 2.8s infinite ease-in-out' : 'none', 
            transformOrigin: '32px 50px',
            transformStyle: 'preserve-3d'
          }}>
            <polygon points="50,10 15,30 15,70 50,90" fill="#131110" />
            <polyline points="50,10 15,30 15,70 50,90" fill="none" stroke="#23211F" strokeWidth={2.5} />
          </g>
          <g style={{ 
            animation: animate ? 'tumbleR 2.8s infinite ease-in-out' : 'none', 
            transformOrigin: '68px 50px',
            transformStyle: 'preserve-3d'
          }}>
            <polygon points="50,10 85,30 85,70 50,90" fill="#0B0A09" />
            <polyline points="50,10 85,30 85,70 50,90" fill="none" stroke={color} strokeWidth={2.5} />
            <polygon points="50,38 62,50 50,62 38,50" fill="#FFFFFF" stroke="#000000" strokeWidth={2.2} />
          </g>
          <style>{`
            @keyframes tumbleL {
              0%, 100% { transform: translateX(-6px) rotateY(0deg); }
              50% { transform: translateX(-6px) rotateY(180deg); }
            }
            @keyframes tumbleR {
              0%, 100% { transform: translateX(6px) rotateY(0deg); }
              50% { transform: translateX(6px) rotateY(-180deg); }
            }
          `}</style>
        </svg>
      )
    }
  ];

  // Active Selected Detail
  const activeCustomIcon = variationsDeck.find(v => v.id === selectedId) || variationsDeck[0];

  // Compile code payload for copying
  const currentSvgCode = activeCustomIcon.svgCode
    .replace(/#ACCENTS/g, activeColor);

  const handleCopyCode = () => {
    navigator.clipboard.writeText(currentSvgCode);
    setCopiedId(activeCustomIcon.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#000000', color: '#FFFFFF', py: 8, px: { xs: 2, md: 4 } }}>
      <Container maxWidth="xl">
        <Stack spacing={6}>
          
          {/* Navigation Stack */}
          <Stack direction="row" spacing={2}>
            <Button 
              onClick={() => router.back()}
              startIcon={<ArrowLeft size={16} />}
              sx={{ 
                fontFamily: 'var(--font-space-grotesk)', 
                fontWeight: 900, 
                color: '#9B9691', 
                bgcolor: '#0B0A09', 
                border: '2px solid #23211F', 
                borderRadius: '8px',
                px: 3,
                textTransform: 'none',
                boxShadow: '3px 3px 0px #000000',
                transition: 'all 0.15s ease',
                '&:hover': {
                  bgcolor: '#131110',
                  color: '#FFFFFF',
                  borderColor: '#23211F',
                  transform: 'translate(-1px, -1px)',
                  boxShadow: '4px 4px 0px #000000'
                },
                '&:active': {
                  transform: 'translate(1px, 1px)',
                  boxShadow: '2px 2px 0px #000000'
                }
              }}
            >
              Back
            </Button>
            <Link href="/kitchen" passHref legacyBehavior>
              <Button 
                component="a"
                startIcon={<Home size={16} />}
                sx={{ 
                  fontFamily: 'var(--font-space-grotesk)', 
                  fontWeight: 900, 
                  color: '#6366F1', 
                  bgcolor: '#0B0A09', 
                  border: '2px solid #3D3AA9', 
                  borderRadius: '8px',
                  px: 3,
                  textTransform: 'none',
                  boxShadow: '3px 3px 0px #000000',
                  transition: 'all 0.15s ease',
                  '&:hover': {
                    bgcolor: '#131110',
                    color: '#818CF8',
                    borderColor: '#4F46E5',
                    transform: 'translate(-1px, -1px)',
                    boxShadow: '4px 4px 0px #000000'
                  },
                  '&:active': {
                    transform: 'translate(1px, 1px)',
                    boxShadow: '2px 2px 0px #000000'
                  }
                }}
              >
                Kitchen Home
              </Button>
            </Link>
          </Stack>

          {/* Header */}
          <Box sx={{ borderBottom: '2px solid #23211F', pb: 3 }}>
            <Typography variant="overline" sx={{ color: '#6366F1', fontWeight: 900, letterSpacing: '0.2em', fontFamily: 'var(--font-mono)' }}>
              EXPERIMENTAL PORTAL // KYLRIX BRAND VARIANTS
            </Typography>
            <Typography variant="h2" sx={{ fontWeight: 900, fontFamily: 'var(--font-outfit)', letterSpacing: '-0.04em', mt: 1, mb: 1 }}>
              Kylrix Logo Variations
            </Typography>
            <Typography sx={{ opacity: 0.5, fontSize: '1rem', fontFamily: 'var(--font-satoshi)' }}>
              Creative skeuomorphic adaptations of the hexagonal Kylrix brand mark, tailored specifically for sync actions, security sweeps, and portal sharing.
            </Typography>
          </Box>

          <Grid container spacing={4}>
            
            {/* Left Column: Interactive 2x2 Custom Icon Deck */}
            <Grid size={{ xs: 12, md: 7 }}>
              <Grid container spacing={3}>
                {variationsDeck.map((icon) => {
                  const isSelected = selectedId === icon.id;
                  return (
                    <Grid key={icon.id} size={{ xs: 12, sm: 6 }}>
                      <Paper sx={{ 
                        p: 4, 
                        bgcolor: '#0B0A09', 
                        borderRadius: '24px', 
                        border: isSelected ? `2px solid ${activeColor}` : '2px solid #23211F',
                        boxShadow: isSelected ? '4px 4px 0px #000000' : '2px 2px 0px #000000',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                        '&:hover': {
                          transform: 'translateY(-2px)',
                          boxShadow: '4px 4px 0px #000000'
                        }
                      }}
                      onClick={() => setSelectedId(icon.id)}
                      >
                        {/* Title and Category indicator */}
                        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
                          <Typography sx={{ fontFamily: 'var(--font-outfit)', fontWeight: 900, fontSize: '1.1rem' }}>
                            {icon.name}
                          </Typography>
                          <Box sx={{ 
                            px: 1.5, 
                            py: 0.5, 
                            bgcolor: '#131110', 
                            border: '1px solid #23211F', 
                            borderRadius: '6px' 
                          }}>
                            <Typography sx={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', fontWeight: 900, color: '#9B9691' }}>
                              {icon.category.toUpperCase()}
                            </Typography>
                          </Box>
                        </Stack>

                        {/* Rendering Well */}
                        <Box sx={{ 
                          display: 'flex', 
                          justifyContent: 'center', 
                          alignItems: 'center', 
                          py: 5, 
                          bgcolor: '#000000', 
                          borderRadius: '16px',
                          border: '1px solid #23211F',
                          mb: 3
                        }}>
                          {icon.render(activeColor, isAnimated)}
                        </Box>

                        <Typography sx={{ fontFamily: 'var(--font-satoshi)', fontSize: '0.85rem', opacity: 0.6 }}>
                          {icon.description}
                        </Typography>
                      </Paper>
                    </Grid>
                  );
                })}
              </Grid>
            </Grid>

            {/* Right Column: Code Inspector Well & Controls */}
            <Grid size={{ xs: 12, md: 5 }}>
              <Paper sx={{ 
                p: 4, 
                bgcolor: '#0B0A09', 
                borderRadius: '24px', 
                border: '2px solid #23211F',
                boxShadow: '4px 4px 0px #000000',
                display: 'flex',
                flexDirection: 'column',
                gap: 4
              }}>
                <Typography sx={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', fontWeight: 900, color: '#6366F1' }}>
                  SVG_INSPECTOR // KYLRIX BRAND SCHEMATICS
                </Typography>

                {/* Controls */}
                <Stack direction="row" spacing={2}>
                  <Button
                    onClick={() => setIsAnimated(!isAnimated)}
                    startIcon={isAnimated ? <Pause size={14} /> : <Play size={14} />}
                    sx={{
                      flexGrow: 1,
                      py: 1,
                      fontFamily: 'var(--font-mono)',
                      fontSize: '0.7rem',
                      bgcolor: isAnimated ? '#131110' : '#000000',
                      color: isAnimated ? '#FFFFFF' : '#9B9691',
                      border: '1px solid #23211F',
                      borderRadius: '8px',
                      textTransform: 'none',
                      '&:hover': { bgcolor: '#131110' }
                    }}
                  >
                    {isAnimated ? 'Pause Physics' : 'Animate Physics'}
                  </Button>

                  {/* Color Preset Selectors */}
                  <Stack direction="row" spacing={0.5} alignItems="center">
                    {[
                      { color: '#6366F1', name: 'Indigo' },
                      { color: '#10B981', name: 'Emerald' },
                      { color: '#EC4899', name: 'Pink' },
                      { color: '#F59E0B', name: 'Amber' }
                    ].map((item) => (
                      <IconButton
                        key={item.name}
                        onClick={() => setActiveColor(item.color)}
                        sx={{
                          width: 24,
                          height: 24,
                          bgcolor: item.color,
                          border: activeColor === item.color ? '2px solid #FFFFFF' : 'none',
                          '&:hover': { opacity: 0.8 }
                        }}
                      />
                    ))}
                  </Stack>
                </Stack>

                {/* Path Inspector Code Box */}
                <Box>
                  <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.5 }}>
                    <Typography sx={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', fontWeight: 800, color: '#9B9691' }}>
                      SOURCE SVG BLUEPRINT
                    </Typography>
                    
                    <Button
                      onClick={handleCopyCode}
                      size="small"
                      startIcon={copiedId === activeCustomIcon.id ? <Check size={12} /> : <Copy size={12} />}
                      sx={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: '0.65rem',
                        textTransform: 'none',
                        color: copiedId === activeCustomIcon.id ? '#10B981' : '#6366F1'
                      }}
                    >
                      {copiedId === activeCustomIcon.id ? 'Copied!' : 'Copy Code'}
                    </Button>
                  </Stack>

                  <TextField
                    multiline
                    fullWidth
                    rows={12}
                    value={currentSvgCode}
                    InputProps={{
                      readOnly: true,
                      style: {
                        color: '#10B981',
                        fontFamily: 'var(--font-mono)',
                        fontSize: '0.75rem',
                        backgroundColor: '#000000',
                        border: '1px solid #23211F',
                        borderRadius: '8px',
                        padding: '16px'
                      }
                    }}
                    sx={{
                      '& .MuiOutlinedInput-root': {
                        '& fieldset': { border: 'none' }
                      }
                    }}
                  />
                </Box>

                {/* Layout Context */}
                <Box sx={{ p: 2.5, bgcolor: '#131110', border: '1px solid #23211F', borderRadius: '12px' }}>
                  <Typography sx={{ fontFamily: 'var(--font-outfit)', fontWeight: 900, fontSize: '0.85rem', mb: 0.5 }}>
                    Kylrix Branding Adaptation:
                  </Typography>
                  <Typography sx={{ fontFamily: 'var(--font-satoshi)', fontSize: '0.75rem', opacity: 0.5, lineHeight: 1.4 }}>
                    By isolating the mathematical points of the canonical hexagon (`50,10 15,30 15,70 50,90 85,70 85,30`), we can dynamically morph the logo to express different active system states natively inside workspace consoles without introducing brand drift.
                  </Typography>
                </Box>
              </Paper>
            </Grid>

          </Grid>

          {/* Solid Footing */}
          <Box sx={{ textAlign: 'center', py: 3, opacity: 0.4, fontFamily: 'var(--font-mono)', fontSize: '0.75rem', borderTop: '2px solid #23211F' }}>
            KYLRIX BRAND SYSTEM • LOW-LEVEL SVG BRAND VARIATIONS • VER 2.0
          </Box>

        </Stack>
      </Container>
    </Box>
  );
}
