'use client';

import React from 'react';

export function PinnedNetworkIconSolana({ size = 20, className }: { size?: number; className?: string }) {
    return (
        <svg
            width={size}
            height={size}
            viewBox="0 0 397 311"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className={className}
            style={{ display: 'block', width: size, height: size }}
        >
            <path
                d="M64.6 237.9c2.4-2.4 5.7-3.8 9.2-3.8h317.4c5.8 0 8.7 7 4.6 11.1l-62.7 62.7c-2.4 2.4-5.7 3.8-9.2 3.8H6.5c-5.8 0-8.7-7-4.6-11.1l62.7-62.7z"
                fill="url(#solana-grad-1)"
            />
            <path
                d="M64.6 3.8C67 1.4 70.3 0 73.8 0h317.4c5.8 0 8.7 7 4.6 11.1l-62.7 62.7c-2.4 2.4-5.7 3.8-9.2 3.8H6.5C0.7 77.6-2.2 70.6 1.9 66.5L64.6 3.8z"
                fill="url(#solana-grad-2)"
            />
            <path
                d="M333.1 120.1c-2.4-2.4-5.7-3.8-9.2-3.8H6.5c-5.8 0-8.7 7-4.6 11.1l62.7 62.7c2.4 2.4 5.7 3.8 9.2 3.8h317.4c5.8 0 8.7-7 4.6-11.1l-62.7-62.7z"
                fill="url(#solana-grad-3)"
            />
            <defs>
                <linearGradient id="solana-grad-1" x1="392.1" y1="311.6" x2="16.9" y2="234.1" gradientUnits="userSpaceOnUse">
                    <stop stopColor="#00FFA3" />
                    <stop offset="1" stopColor="#DC1FFF" />
                </linearGradient>
                <linearGradient id="solana-grad-2" x1="392.1" y1="77.6" x2="16.9" y2="0.1" gradientUnits="userSpaceOnUse">
                    <stop stopColor="#00FFA3" />
                    <stop offset="1" stopColor="#DC1FFF" />
                </linearGradient>
                <linearGradient id="solana-grad-3" x1="5.6" y1="193.9" x2="380.8" y2="116.4" gradientUnits="userSpaceOnUse">
                    <stop stopColor="#00FFA3" />
                    <stop offset="1" stopColor="#DC1FFF" />
                </linearGradient>
            </defs>
        </svg>
    );
}
