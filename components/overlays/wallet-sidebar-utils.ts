'use client';

export const shortenAddress = (address: string) => {
    if (!address) return '';
    if (address.length <= 12) return address;
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
};

export const KTS_STORAGE_KEY = 'kylrix_wallet_kts_mode_v1';

export function kylrixTicker(symbol?: string | null) {
    const s = String(symbol || '$KYLRIX').trim();
    return s.startsWith('$') ? s.slice(1) : s;
}

export const LEDGER_MICRO = 1_000_000n;

export function microToLedgerDisplay(microAbs: bigint): string {
    const intPart = microAbs / LEDGER_MICRO;
    const fracRaw = (microAbs % LEDGER_MICRO).toString().padStart(6, '0').replace(/0+$/, '');
    return fracRaw ? `${intPart}.${fracRaw}` : intPart.toString();
}

/** e.g. +0.65 or −12.5 (ASCII hyphen for deltas) */
export function formatLedgerDelta(deltaMicroRaw: unknown): string {
    let delta = 0n;
    try {
        delta = BigInt(String(deltaMicroRaw ?? '0'));
    } catch {
        return '0';
    }
    if (delta === 0n) return '0';
    const neg = delta < 0n;
    const abs = neg ? -delta : delta;
    const core = microToLedgerDisplay(abs);
    return neg ? `-${core}` : `+${core}`;
}

/** Signed running balance snapshot on the row (if present). */
export function formatLedgerBalanceAfter(raw: unknown): string | null {
    if (raw === null || raw === undefined || String(raw).trim() === '') return null;
    try {
        const v = BigInt(String(raw));
        const neg = v < 0n;
        const core = microToLedgerDisplay(neg ? -v : v);
        return neg ? `-${core}` : core;
    } catch {
        return null;
    }
}

export function parseLedgerMeta(row: Record<string, unknown>): Record<string, unknown> {
    const m = row.metadata;
    if (m != null && typeof m === 'object' && !Array.isArray(m)) return m as Record<string, unknown>;
    if (typeof m === 'string' && m.trim()) {
        try {
            const p = JSON.parse(m) as unknown;
            return typeof p === 'object' && p !== null && !Array.isArray(p) ? (p as Record<string, unknown>) : {};
        } catch {
            return {};
        }
    }
    return {};
}

export function describeLedgerRow(row: Record<string, unknown>): string {
    const eventType = String(row.eventType || '');
    const sourceType = String(row.sourceType || '');
    const meta = parseLedgerMeta(row);
    const activityType = String(meta.activityType || '');
    const reason = String(meta.reason || '').trim();

    if (eventType === 'mint_activity') {
        if (sourceType === 'moment_share_note' || activityType === 'share_public_note_moment') {
            return 'Mint · shared public note (moment)';
        }
        if (activityType) return `Mint · ${activityType.replace(/_/g, ' ')}`;
        if (sourceType) return `Mint · ${sourceType.replace(/_/g, ' ')}`;
        return 'Mint · activity reward';
    }
    if (eventType === 'transfer_out') return 'Transfer · sent';
    if (eventType === 'transfer_in') return 'Transfer · received';
    if (eventType === 'fine') return reason ? `Fine · ${reason}` : 'Fine · debited to root';
    if (eventType === 'recovery') return reason ? `Recovery · ${reason}` : 'Recovery · credit from root';
    if (eventType === 'claim_lock') return 'Claim · locked for withdrawal';
    if (eventType === 'claim_settled') return 'Claim · settled on-chain';
    if (eventType === 'burn') return 'Burn';
    if (eventType) return eventType.replace(/_/g, ' ');
    return 'Ledger entry';
}

export function formatLedgerWhen(row: Record<string, unknown>): string {
    const raw = row.createdAt ?? row.$createdAt;
    if (raw == null || raw === '') return '';
    try {
        return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(String(raw)));
    } catch {
        return String(raw);
    }
}

export function ledgerRowKey(row: Record<string, unknown>, index: number): string {
    const id = row.$id != null ? String(row.$id) : '';
    const tx = row.txId != null ? String(row.txId) : '';
    const idem = row.idempotencyKey != null ? String(row.idempotencyKey) : '';
    return id || `${tx}:${idem}:${index}`;
}


