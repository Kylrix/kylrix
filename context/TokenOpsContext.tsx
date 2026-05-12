"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import {
  Box,
  Button,
  Drawer,
  IconButton,
  List,
  ListItemButton,
  ListItemText,
  Paper,
  Stack,
  TextField,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import { X } from "lucide-react";
import { useSudo } from "@/context/SudoContext";
import { UsersService } from "@/lib/services/users";
import { createKylrixTokenOperationsClient } from "@/lib/sdk/token";

type TokenActionKind = "mint" | "send" | "request" | "fine";
type TokenActionStatus = "success" | "failed" | "pending";

type TokenEventPayload = {
  kind: TokenActionKind;
  status: TokenActionStatus;
  title: string;
  message: string;
  amount?: string | null;
  symbol?: string;
};

type TokenSearchMode = "send" | "request";

type PendingTransfer = {
  id: string;
  fromUserId: string;
  toUserId: string;
  amountMicro: string;
  dueAt: number;
  source: string;
};

type TokenUser = {
  id: string;
  username: string;
  displayName: string;
};

interface TokenOpsContextType {
  notifyTokenEvent: (event: TokenEventPayload) => void;
  openTokenUserSearch: (input: {
    mode: TokenSearchMode;
    fromUserId: string;
    source?: string;
    preselectedUser?: TokenUser | null;
    prefilledAmount?: string;
  }) => void;
}

const TokenOpsContext = createContext<TokenOpsContextType | undefined>(undefined);
const STORAGE_KEY = "kylrix_pending_transfers_v1";
const MODERATION_THRESHOLD = 25000;

function nowMs() {
  return Date.now();
}

function loadPendingTransfers(): PendingTransfer[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as PendingTransfer[]) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function savePendingTransfers(rows: PendingTransfer[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(rows));
}

export function TokenOpsProvider({ children }: { children: React.ReactNode }) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const { promptSudo } = useSudo();
  /**
   * Defer client creation until it's actually needed. A user opening the app on a non-token
   * surface should not pay for SDK construction or its module-init side effects.
   */
  const tokenClientRef = React.useRef<ReturnType<typeof createKylrixTokenOperationsClient> | null>(null);
  const getTokenClient = useCallback(() => {
    if (!tokenClientRef.current) {
      tokenClientRef.current = createKylrixTokenOperationsClient();
    }
    return tokenClientRef.current;
  }, []);

  const [eventOpen, setEventOpen] = useState(false);
  const [eventPayload, setEventPayload] = useState<TokenEventPayload | null>(null);

  const [searchOpen, setSearchOpen] = useState(false);
  const [searchMode, setSearchMode] = useState<TokenSearchMode>("send");
  const [fromUserId, setFromUserId] = useState("");
  const [source, setSource] = useState("wallet");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<TokenUser[]>([]);
  const [selectedUser, setSelectedUser] = useState<TokenUser | null>(null);
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [pendingTransfers, setPendingTransfers] = useState<PendingTransfer[]>([]);

  const notifyTokenEvent = useCallback((payload: TokenEventPayload) => {
    setEventPayload(payload);
    setEventOpen(true);
  }, []);

  const openTokenUserSearch = useCallback((input: {
    mode: TokenSearchMode;
    fromUserId: string;
    source?: string;
    preselectedUser?: TokenUser | null;
    prefilledAmount?: string;
  }) => {
    setSearchMode(input.mode);
    setFromUserId(input.fromUserId);
    setSource(input.source || "wallet");
    setSelectedUser(input.preselectedUser || null);
    setQuery("");
    setResults([]);
    setAmount(String(input.prefilledAmount || ""));
    setSearchOpen(true);
  }, []);

  const closeSearch = useCallback(() => {
    setSearchOpen(false);
    setQuery("");
    setResults([]);
    setSelectedUser(null);
    setAmount("");
    setBusy(false);
  }, []);

  useEffect(() => {
    setPendingTransfers(loadPendingTransfers());
  }, []);

  useEffect(() => {
    savePendingTransfers(pendingTransfers);
  }, [pendingTransfers]);

  useEffect(() => {
    /**
     * Idle pages have no pending transfers to settle. Skip the global 10s polling cost
     * (re-parsing localStorage, scheduling timers) until there's actually work queued.
     */
    if (pendingTransfers.length === 0) return;
    const timer = window.setInterval(async () => {
      const due = loadPendingTransfers().filter((row) => row.dueAt <= nowMs());
      if (!due.length) return;
      let working = loadPendingTransfers();
      for (const item of due) {
        try {
          const result = await getTokenClient().transfer({
            fromUserId: item.fromUserId,
            toUserId: item.toUserId,
            amountMicro: item.amountMicro,
            idempotencyKey: `transfer:recovery:${item.id}`,
            sourceType: "token_transfer_recovery_window",
            sourceId: item.source,
            metadata: { recoveryWindowMs: 300000, pendingId: item.id },
          });
          notifyTokenEvent({
            kind: "send",
            status: result?.accepted ? "success" : "failed",
            title: result?.accepted ? "Token Sent" : "Token Send Failed",
            message: result?.accepted
              ? `Transfer settled after 5-minute recovery window.`
              : `Transfer rejected: ${String(result?.reason || "unknown")}.`,
            amount: result?.amount || null,
            symbol: result?.symbol || "$KYLRIX",
          });
        } catch (error: any) {
          notifyTokenEvent({
            kind: "send",
            status: "failed",
            title: "Token Send Failed",
            message: String(error?.message || "Transfer settlement failed."),
          });
        } finally {
          working = working.filter((row) => row.id !== item.id);
        }
      }
      savePendingTransfers(working);
      setPendingTransfers(working);
    }, 10000);
    return () => window.clearInterval(timer);
  }, [notifyTokenEvent, getTokenClient, pendingTransfers.length]);

  useEffect(() => {
    const handler = (event: Event) => {
      const custom = event as CustomEvent<TokenEventPayload>;
      if (!custom?.detail) return;
      notifyTokenEvent(custom.detail);
    };
    window.addEventListener("kylrix:token-event", handler as EventListener);
    return () => window.removeEventListener("kylrix:token-event", handler as EventListener);
  }, [notifyTokenEvent]);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      return;
    }
    const timer = window.setTimeout(async () => {
      try {
        const users = await UsersService.searchUsers(q);
        const mapped: TokenUser[] = (users || [])
          .map((row: any) => ({
            id: String(row.userId || row.$id || ""),
            username: String(row.username || ""),
            displayName: String(row.displayName || row.username || "Unknown"),
          }))
          .filter((row: TokenUser) => Boolean(row.id && row.username) && row.id !== fromUserId)
          .slice(0, 20);
        setResults(mapped);
      } catch {
        setResults([]);
      }
    }, 250);
    return () => window.clearTimeout(timer);
  }, [fromUserId, query]);

  const handleUndo = useCallback(() => {
    if (!pendingTransfers.length) {
      setEventOpen(false);
      return;
    }
    const last = pendingTransfers[pendingTransfers.length - 1];
    const next = pendingTransfers.filter((row) => row.id !== last.id);
    setPendingTransfers(next);
    notifyTokenEvent({
      kind: "send",
      status: "success",
      title: "Transfer Recovered",
      message: "Pending transfer canceled before settlement.",
    });
  }, [notifyTokenEvent, pendingTransfers]);

  const submit = useCallback(async () => {
    if (!selectedUser?.id) return;
    if (!fromUserId) return;
    setBusy(true);
    try {
      if (searchMode === "request") {
        notifyTokenEvent({
          kind: "request",
          status: "pending",
          title: "Token Request Created",
          message: `Request sent to @${selectedUser.username} for ${amount || "an unspecified amount"} $KYLRIX. Ask them to confirm in chat.`,
          amount: amount || null,
          symbol: "$KYLRIX",
        });
        closeSearch();
        return;
      }

      const amountNum = Number(amount);
      if (!Number.isFinite(amountNum) || amountNum <= 0) {
        throw new Error("Enter a valid amount.");
      }
      
      // Confirmation required before instant transfer
      const unlocked = await promptSudo("unlock", true);
      if (!unlocked) {
        throw new Error("MasterPass confirmation is required.");
      }

      const amountMicro = String(Math.floor(amountNum * 1_000_000));
      const idempotencyKey = `transfer:instant:${nowMs()}_${Math.random().toString(36).slice(2, 10)}`;

      // Execute transfer instantly via Server Action
      const result = await getTokenClient().transfer({
        fromUserId,
        toUserId: selectedUser.id,
        amountMicro,
        idempotencyKey,
        sourceType: "token_transfer_instant",
        sourceId: source,
        metadata: { instant: true },
      });

      if (!result?.accepted) {
        throw new Error(result?.reason || "Transfer rejected by ledger.");
      }

      notifyTokenEvent({
        kind: "send",
        status: "success",
        title: "Token Sent Instantly",
        message: `Successfully sent ${amountNum} $KYLRIX to @${selectedUser.username}.`,
        amount: amountNum.toString(),
        symbol: "$KYLRIX",
      });

      // Email notifications are triggered server-side by the InternalKylrixTokenService
      
      closeSearch();
    } catch (error: any) {
      notifyTokenEvent({
        kind: searchMode,
        status: "failed",
        title: searchMode === "send" ? "Token Send Failed" : "Token Request Failed",
        message: String(error?.message || "Operation failed."),
      });
    } finally {
      setBusy(false);
    }
  }, [amount, closeSearch, fromUserId, getTokenClient, notifyTokenEvent, promptSudo, searchMode, selectedUser, source]);

  const value = useMemo<TokenOpsContextType>(
    () => ({ notifyTokenEvent, openTokenUserSearch }),
    [notifyTokenEvent, openTokenUserSearch],
  );

  return (
    <TokenOpsContext.Provider value={value}>
      {children}

      <Drawer
        anchor={isMobile ? "bottom" : "right"}
        open={eventOpen}
        onClose={() => setEventOpen(false)}
        PaperProps={{
          sx: isMobile
            ? { borderRadius: "24px 24px 0 0", bgcolor: "#161412", borderTop: "1px solid #34322F", p: 2.5 }
            : { width: 420, bgcolor: "#161412", borderLeft: "1px solid #34322F", top: "88px", height: "calc(100dvh - 88px)", p: 2.5 },
        }}
      >
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
          <Typography sx={{ color: "white", fontWeight: 800 }}>{eventPayload?.title || "Token Update"}</Typography>
          <IconButton onClick={() => setEventOpen(false)} sx={{ color: "#9B9691" }}>
            <X size={16} />
          </IconButton>
        </Stack>
        <Typography sx={{ color: "#C7C2BC", fontSize: "0.92rem", mb: 1.5 }}>{eventPayload?.message}</Typography>
        {eventPayload?.amount ? (
          <Typography sx={{ color: "#6366F1", fontWeight: 900 }}>
            {eventPayload.amount} {eventPayload.symbol || "$KYLRIX"}
          </Typography>
        ) : null}
        {eventPayload?.status === "pending" ? (
          <Button onClick={handleUndo} variant="outlined" sx={{ mt: 2, borderColor: "#34322F", color: "white" }}>
            Recover / Undo Latest Pending Transfer
          </Button>
        ) : null}
      </Drawer>

      <Drawer
        anchor={isMobile ? "bottom" : "right"}
        open={searchOpen}
        onClose={closeSearch}
        PaperProps={{
          sx: isMobile
            ? { borderRadius: "24px 24px 0 0", bgcolor: "#161412", borderTop: "1px solid #34322F", p: 2.5, minHeight: "62dvh" }
            : { width: 460, bgcolor: "#161412", borderLeft: "1px solid #34322F", top: "88px", height: "calc(100dvh - 88px)", p: 2.5 },
        }}
      >
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
          <Typography sx={{ color: "white", fontWeight: 800 }}>
            {searchMode === "send" ? "Send $KYLRIX" : "Request $KYLRIX"}
          </Typography>
          <IconButton onClick={closeSearch} sx={{ color: "#9B9691" }}>
            <X size={16} />
          </IconButton>
        </Stack>

        {!selectedUser ? (
          <>
            <TextField
              fullWidth
              autoFocus
              placeholder="Search @username"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              size="small"
              sx={{ mb: 2 }}
            />
            <Paper sx={{ bgcolor: "#1C1A18", border: "1px solid #34322F", borderRadius: "14px", mb: 2 }}>
              <List dense>
                {results.map((item) => (
                  <ListItemButton key={item.id} onClick={() => setSelectedUser(item)}>
                    <ListItemText
                      primary={item.displayName}
                      secondary={`@${item.username}`}
                      primaryTypographyProps={{ color: "white", fontWeight: 700 }}
                      secondaryTypographyProps={{ color: "#9B9691" }}
                    />
                  </ListItemButton>
                ))}
                {!results.length && query.length >= 2 ? (
                  <Box sx={{ p: 2 }}>
                    <Typography sx={{ color: "#9B9691", fontSize: "0.85rem" }}>No users found.</Typography>
                  </Box>
                ) : null}
                {!results.length && query.length < 2 ? (
                  <Box sx={{ p: 2 }}>
                    <Typography sx={{ color: "#9B9691", fontSize: "0.85rem" }}>Search users to continue.</Typography>
                  </Box>
                ) : null}
              </List>
            </Paper>
          </>
        ) : (
          <Paper sx={{ p: 2, mb: 3, borderRadius: '16px', bgcolor: 'rgba(99, 102, 241, 0.08)', border: '1px solid rgba(99, 102, 241, 0.2)' }}>
             <Stack direction="row" justifyContent="space-between" alignItems="center">
                <Box>
                  <Typography sx={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', mb: 0.5 }}>Recipient</Typography>
                  <Typography sx={{ color: 'white', fontWeight: 800 }}>{selectedUser.displayName}</Typography>
                  <Typography sx={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.85rem' }}>@{selectedUser.username}</Typography>
                </Box>
                <Button size="small" onClick={() => setSelectedUser(null)} sx={{ color: '#6366F1', textTransform: 'none', fontWeight: 800 }}>Change</Button>
             </Stack>
          </Paper>
        )}

        <TextField
          fullWidth
          label="Amount ($KYLRIX)"
          placeholder="0.00"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          size="small"
          autoFocus={!!selectedUser}
          sx={{ mb: 3 }}
        />
        <Button
          disabled={!selectedUser || busy || !amount || Number(amount) <= 0}
          onClick={submit}
          variant="contained"
          sx={{ bgcolor: "#6366F1", color: "black", fontWeight: 900, borderRadius: "14px", py: 1.5, textTransform: 'none' }}
        >
          {busy ? "Processing..." : searchMode === "send" ? "Confirm & Queue Transfer" : "Create Request"}
        </Button>
      </Drawer>
    </TokenOpsContext.Provider>
  );
}

export function useTokenOps() {
  const ctx = useContext(TokenOpsContext);
  if (!ctx) throw new Error("useTokenOps must be used within TokenOpsProvider");
  return ctx;
}

