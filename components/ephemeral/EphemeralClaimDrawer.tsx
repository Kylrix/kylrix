'use client';

import React, { useCallback, useState } from 'react';
import {
  Box,
  Button,
  CircularProgress,
  Drawer,
  IconButton,
  Stack,
  TextField,
  Typography,
  alpha,
} from '@mui/material';
import { ID, Permission, Role } from 'appwrite';
import { X } from 'lucide-react';
import toast from 'react-hot-toast';

import { useAuth } from '@/context/auth/AuthContext';
import { useProUpgrade } from '@/context/ProUpgradeContext';
import { databases, storage } from '@/lib/appwrite/client';
import { APPWRITE_CONFIG } from '@/lib/appwrite/config';
import { createNote } from '@/lib/appwrite/note';
import { addAttachmentToNote } from '@/lib/appwrite/note';
import { createCredential, createTotpSecret } from '@/lib/appwrite/vault';
import type { SendKind } from '@/lib/send/types';
import type { SendPasswordPayload, SendTaskPayload, SendTotpPayload, SendFilePayload } from '@/lib/send/types';
import { stashEphemeralClaimResume, type ClaimStashKind } from '@/lib/ephemeral/claim-session';
import { consumeEphemeralRemote } from '@/lib/ephemeral/consume-client';
import { decryptGhostBinaryFromBytes, decryptGhostData } from '@/lib/encryption/ghost-crypto';
import { MasterPassCrypto } from '@/lib/masterpass-crypto';
import { parseSendGhostMetadata, isSendObjectMeta } from '@/lib/send/metadata';
import { sharedNotePublicUrl } from '@/lib/send/shared-note-api';
import { hasPaidKylrixPlan } from '@/lib/utils';

const BG = '#161412';
const RIM = '1px solid rgba(255, 255, 255, 0.05)';
const PRIMARY = '#6366F1';

export interface EphemeralClaimTarget {
  noteId: string;
  decryptionKey?: string;
  claimSecret?: string;
  /** When known (Send sparks); ghost notes omit. */
  sendKind?: SendKind | null;
  stashKind: ClaimStashKind;
  /** Full send URL — used when decryption key is only in the link path. */
  sendUrl?: string;
}

function parseKeyFromSendUrl(url: string): string | null {
  try {
    const u = new URL(url);
    const parts = u.pathname.split('/').filter(Boolean);
    const i = parts.indexOf('send');
    if (i < 0 || parts.length < i + 3) return null;
    return parts[i + 2] || null;
  } catch {
    return null;
  }
}

interface Props {
  open: boolean;
  onClose: () => void;
  target: EphemeralClaimTarget | null;
  onConsumed: (noteId: string) => void;
}

export function EphemeralClaimDrawer({ open, onClose, target, onConsumed }: Props) {
  const { user, openIDMWindow } = useAuth();
  const { openProUpgrade } = useProUpgrade();
  const [masterPass, setMasterPass] = useState('');
  const [busy, setBusy] = useState(false);

  const resetLocal = useCallback(() => {
    setMasterPass('');
    setBusy(false);
  }, []);

  const handleClose = useCallback(() => {
    resetLocal();
    onClose();
  }, [onClose, resetLocal]);

  const runClaim = useCallback(async () => {
    if (!target?.noteId || !target.claimSecret) {
      toast.error('This link is too old to claim remotely — proof keys were not saved on this device.');
      return;
    }

    const key =
      target.decryptionKey?.trim() ||
      (target.sendUrl ? parseKeyFromSendUrl(target.sendUrl) : null)?.trim() ||
      '';
    if (!key) {
      toast.error('Open the full Send URL on this device first so we have the decryption key.');
      return;
    }

    if (!user?.$id) {
      const origin = typeof window !== 'undefined' ? window.location.origin : '';
      const path = typeof window !== 'undefined' ? `${window.location.pathname}?claimOpen=1` : '/send?claimOpen=1';
      stashEphemeralClaimResume(target.noteId, target.stashKind);
      openIDMWindow(`${origin}${path}`);
      toast.success('Sign in to finish importing.');
      handleClose();
      return;
    }

    setBusy(true);
    try {
      const res = await fetch(sharedNotePublicUrl(target.noteId), { cache: 'no-store' });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'Could not load ephemeral object.');
      }
      const note = await res.json();
      const meta = parseSendGhostMetadata(note.metadata);

      let kind: SendKind | 'note' = 'note';
      if (isSendObjectMeta(meta)) {
        kind = meta.send_object.kind;
      }

      const plainTitle = await decryptGhostData(String(note.title || ''), key);
      const plainContent = await decryptGhostData(String(note.content || ''), key);

      const mpc = MasterPassCrypto.getInstance();

      const ensureVault = async () => {
        if (mpc.isVaultUnlocked()) return true;
        if (!masterPass.trim()) {
          toast.error('Enter your master password to import into Vault.');
          return false;
        }
        const ok = await mpc.unlock(masterPass.trim(), user.$id);
        if (!ok) {
          toast.error('Master password did not unlock the vault.');
          return false;
        }
        return true;
      };

      if (kind === 'password' || kind === 'totp') {
        if (!(await ensureVault())) return;
      }

      if (kind === 'file') {
        if (!hasPaidKylrixPlan(user)) {
          openProUpgrade('Claim Send files');
          toast.error('Kylrix Pro is required to claim files.');
          return;
        }
        let manifest: SendFilePayload;
        try {
          manifest = JSON.parse(plainContent) as SendFilePayload;
        } catch {
          throw new Error('Invalid file payload.');
        }
        const bucketId = meta.send_object?.bucketId || manifest.bucketId;
        const fileId = meta.send_object?.fileId || manifest.fileId;
        if (!bucketId || !fileId) throw new Error('Missing file reference.');

        const downloadUrl = storage.getFileDownload(bucketId, fileId);
        const fileRes = await fetch(downloadUrl);
        if (!fileRes.ok) throw new Error('Could not download ciphertext.');
        const encBuf = await fileRes.arrayBuffer();
        const plainBuf = decryptGhostBinaryFromBytes(encBuf, key);
        const mime = manifest.mimeType || 'application/octet-stream';
        const blob = new Blob([plainBuf], { type: mime });
        const file = new File([blob], manifest.originalName || plainTitle || 'file', { type: mime });

        const owned = await createNote({
          title: plainTitle || manifest.originalName || 'Imported file',
          content: '_Imported from Send — see attachments._',
          isPublic: false,
        });
        await addAttachmentToNote(owned.$id, file);
        await consumeEphemeralRemote(target.noteId, target.claimSecret);
        onConsumed(target.noteId);
        toast.success('File saved to a new private note with attachment.');
        handleClose();
        return;
      }

      if (kind === 'note') {
        await createNote({
          title: plainTitle || 'Imported note',
          content: plainContent,
          isPublic: true,
          metadata: JSON.stringify({
            importedFrom: 'kylrix_ephemeral_claim',
            ephemeralNoteId: target.noteId,
          }),
        });
      } else if (kind === 'task') {
        let payload: SendTaskPayload;
        try {
          payload = JSON.parse(plainContent) as SendTaskPayload;
        } catch {
          throw new Error('Invalid task payload.');
        }
        const now = new Date().toISOString();
        await databases.createDocument(
          APPWRITE_CONFIG.DATABASES.FLOW,
          APPWRITE_CONFIG.TABLES.FLOW.TASKS,
          ID.unique(),
          {
            title: payload.title,
            description: payload.detail || '',
            status: 'todo',
            priority: 'medium',
            dueDate: payload.dueAt || null,
            recurrenceRule: null,
            tags: [],
            assigneeIds: [],
            attachmentIds: [],
            eventId: null,
            userId: user.$id,
            parentId: null,
            createdAt: now,
            updatedAt: now,
          },
          [
            Permission.read(Role.user(user.$id)),
            Permission.update(Role.user(user.$id)),
            Permission.delete(Role.user(user.$id)),
          ],
        );
      } else if (kind === 'password') {
        let payload: SendPasswordPayload;
        try {
          payload = JSON.parse(plainContent) as SendPasswordPayload;
        } catch {
          throw new Error('Invalid credential payload.');
        }
        let totpId: string | null = null;
        if (payload.totpSecret?.trim()) {
          const secretKey = payload.totpSecret.replace(/\s+/g, '').toUpperCase();
          const totpDoc = await createTotpSecret({
            userId: user.$id,
            issuer: payload.username?.trim() || 'Imported',
            accountName: payload.username?.trim() || 'Account',
            secretKey,
            algorithm: 'SHA1',
            digits: 6,
            period: 30,
          });
          totpId = totpDoc.$id;
        }
        await createCredential({
          userId: user.$id,
          itemType: 'login',
          name: payload.username?.trim() || 'Imported login',
          username: payload.username?.trim() || null,
          password: payload.password,
          url: null,
          totpId,
        });
      } else if (kind === 'totp') {
        let payload: SendTotpPayload;
        try {
          payload = JSON.parse(plainContent) as SendTotpPayload;
        } catch {
          throw new Error('Invalid authenticator payload.');
        }
        const secretKey = payload.secret.replace(/\s+/g, '').toUpperCase();
        await createTotpSecret({
          userId: user.$id,
          issuer: payload.issuer?.trim() || 'Imported',
          accountName: payload.account?.trim() || payload.issuer?.trim() || 'Authenticator',
          secretKey,
          algorithm: 'SHA1',
          digits: 6,
          period: 30,
        });
      }

      await consumeEphemeralRemote(target.noteId, target.claimSecret);
      onConsumed(target.noteId);
      toast.success('Imported — ephemeral link is gone.');
      handleClose();
    } catch (e: unknown) {
      const code = (e as Error & { code?: string })?.code;
      if (code === 'PRO_REQUIRED') {
        openProUpgrade('Claim Send files');
      }
      toast.error(e instanceof Error ? e.message : 'Claim failed.');
    } finally {
      setBusy(false);
    }
  }, [
    target,
    user,
    masterPass,
    openIDMWindow,
    handleClose,
    onConsumed,
    openProUpgrade,
  ]);

  const showMasterPassField = Boolean(user?.$id && !MasterPassCrypto.getInstance().isVaultUnlocked());

  const headline = target?.stashKind === 'send' ? 'Claim this Send' : 'Claim this Ghost spark';

  return (
    <Drawer
      anchor="bottom"
      open={open && Boolean(target)}
      onClose={handleClose}
      PaperProps={{
        sx: {
          bgcolor: BG,
          borderTopLeftRadius: 20,
          borderTopRightRadius: 20,
          border: RIM,
          borderBottom: 'none',
          maxHeight: '92vh',
          boxShadow: '0 -24px 64px rgba(0,0,0,0.65)',
        },
      }}
    >
      <Box sx={{ px: 2.5, pt: 2, pb: 3 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="flex-start" sx={{ mb: 2 }}>
          <Box>
            <Typography sx={{ fontFamily: 'var(--font-clash)', fontWeight: 700, fontSize: '1.25rem', color: '#fff' }}>
              {headline}
            </Typography>
            <Typography variant="body2" sx={{ color: alpha('#fff', 0.55), mt: 0.75, lineHeight: 1.5 }}>
              Save this into your Kylrix account as a real Note, Vault item, or Flow task. The expiring link is removed after a successful import.
            </Typography>
          </Box>
          <IconButton onClick={handleClose} size="small" sx={{ color: alpha('#fff', 0.45) }}>
            <X size={18} />
          </IconButton>
        </Stack>

        {showMasterPassField && (
          <TextField
            fullWidth
            type="password"
            label="Master password (Vault)"
            value={masterPass}
            onChange={(e) => setMasterPass(e.target.value)}
            sx={{
              mb: 2,
              '& .MuiOutlinedInput-root': { bgcolor: alpha('#fff', 0.03), borderRadius: 2 },
              '& .MuiInputLabel-root': { color: alpha('#fff', 0.55) },
              '& .MuiOutlinedInput-notchedOutline': { borderColor: alpha('#fff', 0.12) },
              '& .MuiInputBase-input': { color: '#fff' },
            }}
          />
        )}

        <Button
          fullWidth
          variant="contained"
          disabled={busy}
          onClick={() => void runClaim()}
          sx={{
            py: 1.5,
            borderRadius: 2,
            textTransform: 'none',
            fontWeight: 700,
            bgcolor: PRIMARY,
            '&:hover': { bgcolor: '#5558E8' },
          }}
        >
          {busy ? <CircularProgress size={22} color="inherit" /> : user?.$id ? 'Import & burn link' : 'Sign in to import'}
        </Button>
      </Box>
    </Drawer>
  );
}
