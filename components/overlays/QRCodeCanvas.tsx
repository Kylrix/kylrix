'use client';

import React, { useEffect, useRef } from 'react';
import QRCode from 'qrcode';

export function QRCodeCanvas({
    value,
    size = 180,
    className = ''
}: {
    value: string;
    size?: number;
    className?: string;
}) {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas || !value) return;

        QRCode.toCanvas(canvas, value, {
            width: size,
            margin: 2,
            color: {
                dark: '#000000',
                light: '#FFFFFF'
            },
            errorCorrectionLevel: 'M'
        }, (err) => {
            if (err) console.error('[QRCodeCanvas] Failed to render QR code', err);
        });
    }, [value, size]);

    return (
        <canvas
            ref={canvasRef}
            width={size}
            height={size}
            className={`rounded-xl shadow-md ${className}`}
            style={{ width: size, height: size, display: 'block' }}
        />
    );
}
