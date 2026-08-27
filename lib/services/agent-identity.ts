import * as secp256k1 from '@noble/secp256k1';
import { bech32 } from '@scure/base';
import { keccak_256 } from '@noble/hashes/sha3.js';
import { tablesDB } from '@/lib/appwrite/client';
import { APPWRITE_CONFIG } from '@/lib/appwrite/config';
import { Permission, Role, Query } from 'appwrite';
import { ecosystemSecurity } from '@/lib/ecosystem/security';

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export interface AgentCryptoIdentity {
  agentId: string;
  agentUserId: string; // e.g. "agent_65..."
  username: string; // e.g. "ag_kylie"
  walletAddress: string; // e.g. "0x..."
  nostrNpub: string; // e.g. "npub1..."
  nostrPubkeyHex: string;
  ownerId: string;
  framework: string;
}

export const AgentIdentityService = {
  /**
   * Derives or mints deterministic cryptographic keys for an agent:
   * 1. EVM Wallet Address (secp256k1 + keccak256)
   * 2. Nostr Keypair (npub / nsec)
   * 3. Autonomous MEK wrapper for owner inspection
   */
  async generateAgentKeys(agentId: string, ownerId: string): Promise<{
    walletAddress: string;
    nostrNpub: string;
    nostrPubkeyHex: string;
    encryptedKeyBlob?: string;
  }> {
    try {
      // 1. Generate 32 bytes of secure entropy for this agent
      const rawEntropy = new Uint8Array(32);
      if (typeof window !== 'undefined' && window.crypto) {
        window.crypto.getRandomValues(rawEntropy);
      } else {
        const nodeCrypto = await import('crypto');
        nodeCrypto.randomFillSync(rawEntropy);
      }

      // 2. Derive EVM Wallet Address
      const secpPriv = rawEntropy;
      const secpPub = secp256k1.getPublicKey(secpPriv, false).slice(1);
      const evmHash = keccak_256(secpPub);
      const walletAddress = '0x' + bytesToHex(evmHash.slice(-20)).toLowerCase();

      // 3. Derive Nostr Identity (npub)
      const nostrPubRaw = secp256k1.getPublicKey(secpPriv, true).slice(1); // 32 bytes x-only
      const nostrPubkeyHex = bytesToHex(nostrPubRaw);
      const nostrWords = bech32.toWords(nostrPubRaw);
      const nostrNpub = bech32.encode('npub', nostrWords);

      // 4. Encrypt keys with owner MEK if available
      let encryptedKeyBlob: string | undefined;
      try {
        if (ecosystemSecurity.status.isUnlocked) {
          const secretPayload = JSON.stringify({
            version: 'agent.identity.v1',
            agentId,
            ownerId,
            walletAddress,
            nostrNpub,
            nostrPubkeyHex,
            entropyHex: bytesToHex(rawEntropy),
          });
          encryptedKeyBlob = await ecosystemSecurity.encrypt(secretPayload);
        }
      } catch (encErr) {
        console.warn('[AgentIdentity] Could not seal agent secret under owner MEK:', encErr);
      }

      return {
        walletAddress,
        nostrNpub,
        nostrPubkeyHex,
        encryptedKeyBlob,
      };
    } catch (err) {
      console.error('[AgentIdentity] Key generation failed, generating fallback:', err);
      const fallbackHex = bytesToHex(new Uint8Array(20));
      return {
        walletAddress: `0x${fallbackHex}`,
        nostrNpub: `npub1${fallbackHex}`,
        nostrPubkeyHex: fallbackHex,
      };
    }
  },

  /**
   * Creates or updates the agent's profile in the ecosystem `profiles` table.
   * Agent user IDs are distinctly prefixed with `agent_${agentId}`.
   */
  async syncAgentProfile(params: {
    agentId: string;
    ownerId: string;
    name: string;
    role?: string;
    goal?: string;
    framework?: string;
    avatar?: string;
  }): Promise<any> {
    const { agentId, ownerId, name, role, goal, framework = 'kylrix', avatar } = params;
    const agentUserId = `agent_${agentId}`;
    const cleanHandle = `ag_${name.trim().toLowerCase().replace(/[^a-z0-9_]/g, '') || agentId.slice(0, 8)}`;

    const { walletAddress, nostrNpub, nostrPubkeyHex } = await this.generateAgentKeys(agentId, ownerId);

    const preferencesJson = JSON.stringify({
      isAgentic: true,
      ownerId,
      agentId,
      framework,
      role: role || name,
      goal: goal || '',
      nostrNpub,
      walletAddress,
      updatedAt: new Date().toISOString(),
    });

    const profileData = {
      userId: agentUserId,
      username: cleanHandle,
      displayName: `${name.trim()} (Smart Agent)`,
      bio: goal?.trim() || role?.trim() || `Autonomous ${framework} smart partner`,
      walletAddress,
      publicKey: nostrNpub || nostrPubkeyHex,
      avatar: avatar || null,
      status: 'active',
      preferences: preferencesJson,
      isPublic: true,
      isGuest: true,
      isAvatar: true,
      isContact: true,
      isOnlineVisible: true,
    };

    try {
      // Check if profile exists by userId
      const existing = await tablesDB.listRows<any>(
        APPWRITE_CONFIG.DATABASES.CHAT,
        APPWRITE_CONFIG.TABLES.CHAT.PROFILES,
        [Query.equal('userId', agentUserId), Query.limit(1)]
      );

      if (existing.rows && existing.rows.length > 0) {
        const rowId = existing.rows[0].$id;
        return await tablesDB.updateRow(
          APPWRITE_CONFIG.DATABASES.CHAT,
          APPWRITE_CONFIG.TABLES.CHAT.PROFILES,
          rowId,
          profileData
        );
      } else {
        return await tablesDB.createRow(
          APPWRITE_CONFIG.DATABASES.CHAT,
          APPWRITE_CONFIG.TABLES.CHAT.PROFILES,
          agentUserId,
          profileData,
          [Permission.read(Role.any()), Permission.update(Role.user(ownerId))]
        );
      }
    } catch (err: any) {
      console.warn('[AgentIdentity] Failed to sync agent profile to tablesDB:', err?.message || err);
      return null;
    }
  },

  /**
   * Retrieves an agentic profile by agent ID or prefixed agent user ID.
   */
  async getAgentProfile(agentId: string): Promise<any | null> {
    const agentUserId = agentId.startsWith('agent_') ? agentId : `agent_${agentId}`;
    try {
      const res = await tablesDB.listRows<any>(
        APPWRITE_CONFIG.DATABASES.CHAT,
        APPWRITE_CONFIG.TABLES.CHAT.PROFILES,
        [Query.equal('userId', agentUserId), Query.limit(1)]
      );
      return res.rows?.[0] || null;
    } catch {
      return null;
    }
  },

  /**
   * Resolves the agent's MEK in hex format.
   * If stored in agent's config/identity directly or encrypted under owner MEK,
   * it retrieves and unwraps it seamlessly.
   */
  async getAgentMekHex(agentId: string): Promise<string | null> {
    const rawId = agentId.replace(/^agent_/, '');
    try {
      // 1. Try fetching from agents table directly
      const agentRes = await tablesDB.getRow<any>(
        APPWRITE_CONFIG.DATABASES.FLOW,
        APPWRITE_CONFIG.TABLES.FLOW.AGENTS,
        rawId
      ).catch(() => null);

      if (agentRes?.config) {
        try {
          const parsed = JSON.parse(agentRes.config);
          if (parsed.mekHex) return String(parsed.mekHex);
          if (parsed.entropyHex) return String(parsed.entropyHex);
        } catch {}
      }

      // 1b. Try querying agents table by workspaceId
      try {
        const agentByWs = await tablesDB.listRows<any>(
          APPWRITE_CONFIG.DATABASES.FLOW,
          APPWRITE_CONFIG.TABLES.FLOW.AGENTS,
          [Query.equal('workspaceId', rawId), Query.limit(1)]
        );
        if (agentByWs.rows && agentByWs.rows.length > 0 && agentByWs.rows[0].config) {
          const parsed = JSON.parse(agentByWs.rows[0].config);
          if (parsed.mekHex) return String(parsed.mekHex);
          if (parsed.entropyHex) return String(parsed.entropyHex);
        }
      } catch {}

      // 1c. Try querying projects table to find linked agentId
      try {
        const projectRow = await tablesDB.getRow<any>(
          APPWRITE_CONFIG.DATABASES.FLOW,
          (APPWRITE_CONFIG.TABLES as any).PROJECTS || 'projects',
          rawId
        ).catch(() => null);

        if (projectRow) {
          let nestedAgentId = projectRow.agentId;
          if (!nestedAgentId && projectRow.metadata) {
            try {
              const meta = typeof projectRow.metadata === 'string' ? JSON.parse(projectRow.metadata) : projectRow.metadata;
              if (meta.agentId) nestedAgentId = meta.agentId;
            } catch {}
          }
          if (nestedAgentId) {
            const nestedMek = await this.getAgentMekHex(String(nestedAgentId));
            if (nestedMek) return nestedMek;
          }
        }
      } catch {}

      // 2. Try fetching from profiles table
      const profile = await this.getAgentProfile(rawId);
      if (profile?.preferences) {
        try {
          const pref = typeof profile.preferences === 'string' ? JSON.parse(profile.preferences) : profile.preferences;
          if (pref.mekHex) return String(pref.mekHex);
          if (pref.entropyHex) return String(pref.entropyHex);
          if (pref.encryptedKeyBlob && ecosystemSecurity.status.isUnlocked) {
            const decryptedJson = await ecosystemSecurity.decrypt(pref.encryptedKeyBlob);
            const decrypted = JSON.parse(decryptedJson);
            if (decrypted.mekHex) return String(decrypted.mekHex);
            if (decrypted.entropyHex) return String(decrypted.entropyHex);
          }
        } catch {}
      }

      return null;
    } catch {
      return null;
    }
  },

  /**
   * Imports and returns the Agent's MEK as a WebCrypto CryptoKey.
   */
  async getAgentCryptoKey(agentId: string): Promise<CryptoKey | null> {
    const hex = await this.getAgentMekHex(agentId);
    if (!hex || hex.length < 32) return null;
    try {
      const { importMekCryptoKey, parseMekToBytes } = await import('@/lib/api/vault-crypto');
      return await importMekCryptoKey(parseMekToBytes(hex));
    } catch {
      return null;
    }
  },
};
