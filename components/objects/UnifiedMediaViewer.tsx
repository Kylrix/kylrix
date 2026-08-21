'use client';

import React, { useState } from 'react';
import { X, Download, ZoomIn, ZoomOut, RotateCw, ExternalLink } from 'lucide-react';
import { StorageService } from '@/lib/services/storage';

export interface UnifiedMediaViewerProps {
  src: string;
  type?: 'image' | 'video' | 'audio' | 'pdf' | 'file';
  title?: string;
  fileId?: string;
  bucketId?: string;
  onClose: () => void;
}

export function UnifiedMediaViewer({
  src,
  type = 'image',
  title = 'Media Viewer',
  fileId,
  bucketId,
  onClose,
}: UnifiedMediaViewerProps) {
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);

  const handleZoomIn = () => setZoom((z) => Math.min(3, z + 0.25));
  const handleZoomOut = () => setZoom((z) => Math.max(0.5, z - 0.25));
  const handleRotate = () => setRotation((r) => (r + 90) % 360);

  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = src;
    link.download = title || 'download';
    link.target = '_blank';
    link.rel = 'noreferrer';
    link.click();
  };

  return (
    <div className="fixed inset-0 z-[100000] flex flex-col bg-black/95 backdrop-blur-xl animate-in fade-in duration-200 select-none">
      {/* Top Header Bar */}
      <div className="flex items-center justify-between px-4 py-3 bg-[#0A0908]/80 border-b border-white/10 shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <span className="px-2 py-0.5 rounded-lg text-[10px] font-mono font-bold uppercase tracking-wider bg-white/10 text-white/70">
            {type}
          </span>
          <h3 className="text-sm font-bold text-white font-satoshi truncate max-w-md">
            {title}
          </h3>
        </div>

        <div className="flex items-center gap-1.5">
          {type === 'image' && (
            <>
              <button
                type="button"
                onClick={handleZoomIn}
                className="w-8 h-8 rounded-xl bg-white/5 hover:bg-white/10 text-white/70 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
                title="Zoom in"
              >
                <ZoomIn size={16} />
              </button>
              <button
                type="button"
                onClick={handleZoomOut}
                className="w-8 h-8 rounded-xl bg-white/5 hover:bg-white/10 text-white/70 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
                title="Zoom out"
              >
                <ZoomOut size={16} />
              </button>
              <button
                type="button"
                onClick={handleRotate}
                className="w-8 h-8 rounded-xl bg-white/5 hover:bg-white/10 text-white/70 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
                title="Rotate"
              >
                <RotateCw size={16} />
              </button>
            </>
          )}

          <button
            type="button"
            onClick={handleDownload}
            className="w-8 h-8 rounded-xl bg-white/5 hover:bg-white/10 text-white/70 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
            title="Download / Open direct"
          >
            <Download size={16} />
          </button>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors shrink-0 cursor-pointer ml-2"
            title="Close viewer"
          >
            <X size={18} />
          </button>
        </div>
      </div>

      {/* Main Stage */}
      <div
        className="flex-1 overflow-auto flex items-center justify-center p-4 md:p-8"
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        {type === 'image' && (
          <img
            src={src}
            alt={title}
            style={{
              transform: `scale(${zoom}) rotate(${rotation}deg)`,
              transition: 'transform 0.2s ease',
            }}
            className="max-w-full max-h-[85vh] object-contain rounded-2xl shadow-2xl"
          />
        )}

        {type === 'video' && (
          <video
            src={src}
            controls
            autoPlay
            playsInline
            className="max-w-full max-h-[85vh] rounded-2xl shadow-2xl bg-black"
          />
        )}

        {type === 'audio' && (
          <div className="w-full max-w-md p-6 rounded-3xl bg-[#161412] border border-white/10 shadow-2xl space-y-4">
            <h4 className="text-sm font-bold text-white font-satoshi">{title}</h4>
            <audio src={src} controls autoPlay className="w-full h-10 accent-[#6366F1]" />
          </div>
        )}

        {type === 'pdf' && (
          <iframe
            src={src}
            title={title}
            className="w-full h-[85vh] rounded-2xl border border-white/10 shadow-2xl bg-white"
          />
        )}

        {type === 'file' && (
          <div className="p-8 rounded-3xl bg-[#161412] border border-white/10 shadow-2xl text-center space-y-4">
            <p className="text-sm text-white/80 font-bold">{title}</p>
            <a
              href={src}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#6366F1] text-white font-bold text-xs"
            >
              <span>Download File</span>
              <ExternalLink size={14} />
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
