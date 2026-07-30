'use client';

import Image from 'next/image';

const SOLANA_SYMBOL_SRC = '/brands/solana-symbol.svg';

export function PinnedNetworkIconSolana({ size }: { size: number }) {
    return (
        <Image
            src={SOLANA_SYMBOL_SRC}
            alt=""
            width={size}
            height={size}
            unoptimized
            style={{ display: 'block', width: size, height: size }}
        />
    );
}
