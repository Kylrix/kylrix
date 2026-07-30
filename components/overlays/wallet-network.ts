import type { SupportedWalletChain } from '@/lib/services/wallets';

export function getNetworkLogo(chain: SupportedWalletChain) {
        const logoMap: Record<SupportedWalletChain, string> = {
            'sol': '◎', // Solana symbol
            'btc': '₿', // Bitcoin symbol
            'eth': 'Ξ', // Ethereum symbol
            'usdc': 'USDC',
            'base': 'B',
            'polygon': '⬟', // Polygon symbol
            'sui': 'S',
            'arbitrum': 'ARB'};
        return logoMap[chain] || '?';
}

export function getNetworkColor(chain: SupportedWalletChain) {
        const colorMap: Record<SupportedWalletChain, string> = {
            'sol': '#14F195',
            'btc': '#F7931A',
            'eth': '#627EEA',
            'usdc': '#2775CA',
            'base': '#0052FF',
            'polygon': '#8247E5',
            'sui': '#6FB3D2',
            'arbitrum': '#28A0F0'};
        return colorMap[chain] || '#666';
}
