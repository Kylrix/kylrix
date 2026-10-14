import * as secp256k1 from '@noble/secp256k1';
import { keccak_256 } from '@noble/hashes/sha3.js';
import { ecosystemSecurity } from '@/lib/ecosystem/security';
import { db } from '@/lib/db';
import * as schema from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export interface AgentCryptoIdentity {
  agentId: string;
  agentUserId: string;
  username: string;
  walletAddress: string;
  ownerId: string;
  framework: string;
}

export const AgentIdentityService = {
  async generateAgentKeys(agentId: string, ownerId: string): Promise<{
    walletAddress: string;
    encryptedKeyBlob?: string;
  }> {
    try {
      const rawEntropy = new Uint8Array(32);
      if (typeof window !== 'undefined' && window.crypto) {
        window.crypto.getRandomValues(rawEntropy);
      } else {
        const nodeCrypto = await import('crypto');
        nodeCrypto.randomFillSync(rawEntropy);
      }

      const secpPriv = rawEntropy;
      const secpPub = secp256k1.getPublicKey(secpPriv, false).slice(1);
      const evmHash = keccak_256(secpPub);
      const walletAddress = '0x' + bytesToHex(evmHash.slice(-20)).toLowerCase();

      let encryptedKeyBlob: string | undefined;
      try {
        if (ecosystemSecurity.status.isUnlocked) {
          const secretPayload = JSON.stringify({
            version: 'agent.identity.v1',
            agentId,
            ownerId,
            walletAddress,
            entropyHex: bytesToHex(rawEntropy),
          });
          encryptedKeyBlob = await ecosystemSecurity.encrypt(secretPayload);
        }
      } catch (encErr) {
        console.warn('[AgentIdentity] Could not seal agent secret under owner MEK:', encErr);
      }

      return {
        walletAddress,
        encryptedKeyBlob,
      };
    } catch (err) {
      console.error('[AgentIdentity] Key generation failed, generating fallback:', err);
      const fallbackHex = bytesToHex(new Uint8Array(20));
      return {
        walletAddress: `0x${fallbackHex}`,
      };
    }
  },

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

    const { walletAddress } = await this.generateAgentKeys(agentId, ownerId);

    const preferencesJson = JSON.stringify({
      isAgentic: true,
      ownerId,
      agentId,
      framework,
      role: role || name,
      goal: goal || '',
      walletAddress,
      updatedAt: new Date().toISOString(),
    });

    const profileData = {
      id: `p-${agentUserId}`,
      userId: agentUserId,
      username: cleanHandle,
      displayName: `${name.trim()} (Smart Agent)`,
      bio: goal?.trim() || role?.trim() || `Autonomous ${framework} smart partner`,
      walletAddress,
      avatar: avatar || null,
      status: 'active',
      preferences: preferencesJson,
      isPublic: true,
      isGuest: true,
      isAvatar: true,
      isContact: true,
      isOnlineVisible: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    try {
      const existing = await db
        .select()
        .from(schema.profiles)
        .where(eq(schema.profiles.userId, agentUserId))
        .limit(1);

      if (existing.length > 0) {
        await db
          .update(schema.profiles)
          .set(profileData)
          .where(eq(schema.profiles.id, existing[0].id));
        return profileData;
      } else {
        await db.insert(schema.profiles).values(profileData);
        return profileData;
      }
    } catch (err: any) {
      console.warn('[AgentIdentity] Failed to sync agent profile:', err?.message || err);
      return null;
    }
  },

  async getAgentProfile(agentId: string): Promise<any | null> {
    const agentUserId = agentId.startsWith('agent_') ? agentId : `agent_${agentId}`;
    try {
      const rows = await db
        .select()
        .from(schema.profiles)
        .where(eq(schema.profiles.userId, agentUserId))
        .limit(1);
      return rows[0] || null;
    } catch {
      return null;
    }
  },

  async getAgentMekHex(agentId: string): Promise<string | null> {
    const rawId = agentId.replace(/^agent_/, '');
    try {
      const profile = await this.getAgentProfile(rawId);
      if (profile?.preferences) {
        try {
          const pref = typeof profile.preferences === 'string' ? JSON.parse(profile.preferences) : profile.preferences;
          if (pref.mekHex) return String(pref.mekHex);
          if (pref.entropyHex) return String(pref.entropyHex);
        } catch {}
      }
      return null;
    } catch {
      return null;
    }
  },

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
