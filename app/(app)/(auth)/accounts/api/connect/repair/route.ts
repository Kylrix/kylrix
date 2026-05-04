import { NextRequest, NextResponse } from "next/server";
import { Query } from "node-appwrite";
import { createAdminClient } from "@/lib/appwrite-admin";
import { APPWRITE_CONFIG } from "@/lib/appwrite/config";
import { getCorsHeaders, verifyUser } from "@/lib/api/permission-updater";

type RepairBody = {
  userId?: string;
  conversationId?: string;
};

function isAdminUser(user: any) {
  return Array.isArray(user?.labels) && user.labels.includes("admin");
}

function parseMetadata(value: unknown): Record<string, unknown> {
  if (!value) return {};
  if (typeof value === "object") return value as Record<string, unknown>;
  if (typeof value !== "string") return {};
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

function serializeMetadata(value: Record<string, unknown>) {
  return JSON.stringify(value);
}

async function fetchProfile(databases: ReturnType<typeof createAdminClient>["databases"], userId: string) {
  const result = await databases.listDocuments(APPWRITE_CONFIG.DATABASES.CHAT, APPWRITE_CONFIG.TABLES.CHAT.PROFILES, [
    Query.equal("userId", userId),
    Query.limit(2),
  ]);

  return result.documents[0] || null;
}

async function fetchIdentityRows(databases: ReturnType<typeof createAdminClient>["databases"], userId: string) {
  const result = await databases.listDocuments(
    APPWRITE_CONFIG.DATABASES.PASSWORD_MANAGER,
    APPWRITE_CONFIG.TABLES.PASSWORD_MANAGER.IDENTITIES,
    [
      Query.equal("userId", userId),
      Query.equal("identityType", "e2e_connect"),
      Query.limit(100),
    ],
  );

  return result.documents;
}

async function fetchConversation(databases: ReturnType<typeof createAdminClient>["databases"], conversationId: string) {
  return await databases.getDocument(
    APPWRITE_CONFIG.DATABASES.CHAT,
    APPWRITE_CONFIG.TABLES.CHAT.CONVERSATIONS,
    conversationId,
  );
}

async function fetchKeyMappings(databases: ReturnType<typeof createAdminClient>["databases"], userId: string) {
  const result = await databases.listDocuments(
    APPWRITE_CONFIG.DATABASES.PASSWORD_MANAGER,
    APPWRITE_CONFIG.TABLES.PASSWORD_MANAGER.KEY_MAPPING,
    [
      Query.equal("grantee", userId),
      Query.limit(1000),
    ],
  );

  return result.documents;
}

async function fetchEpochIds(databases: ReturnType<typeof createAdminClient>["databases"], conversationId: string) {
  const result = await databases.listDocuments(
    APPWRITE_CONFIG.DATABASES.CHAT,
    APPWRITE_CONFIG.TABLES.CHAT.EPOCHS,
    [
      Query.equal("resourceId", conversationId),
      Query.limit(100),
    ],
  );

  return result.documents.map((row) => row.$id);
}

export async function OPTIONS(req: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": req.headers.get("origin") || "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Access-Control-Allow-Credentials": "true",
    },
  });
}

export async function POST(req: NextRequest) {
  const corsHeaders = getCorsHeaders(req);

  try {
    const requester = await verifyUser(req);
    if (!requester) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: corsHeaders });
    }

    const body = (await req.json()) as RepairBody;
    const targetUserId = String(body.userId || requester.$id || "").trim();
    const conversationId = String(body.conversationId || "").trim();

    if (!targetUserId) {
      return NextResponse.json({ error: "userId is required" }, { status: 400, headers: corsHeaders });
    }

    if (requester.$id !== targetUserId && !isAdminUser(requester)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403, headers: corsHeaders });
    }

    const { databases } = createAdminClient();
    const report: Record<string, unknown> = {
      userId: targetUserId,
      conversationId: conversationId || null,
      identity: { repaired: false, deleted: 0 },
      mappings: { repaired: 0, deleted: 0 },
    };

    const profile = await fetchProfile(databases, targetUserId);
    const identityRows = await fetchIdentityRows(databases, targetUserId);
    const canonicalIdentity =
      identityRows.find((row: any) => row?.publicKey && row?.publicKey === profile?.publicKey) ||
      identityRows.find((row: any) => row?.publicKey) ||
      identityRows[0] ||
      null;

    if (canonicalIdentity) {
      const duplicateRows = identityRows.filter((row: any) => row.$id !== canonicalIdentity.$id);
      for (const duplicate of duplicateRows) {
        await databases.deleteDocument(
          APPWRITE_CONFIG.DATABASES.PASSWORD_MANAGER,
          APPWRITE_CONFIG.TABLES.PASSWORD_MANAGER.IDENTITIES,
          duplicate.$id,
        );
      }
      report.identity = {
        repaired: true,
        deleted: duplicateRows.length,
        canonicalId: canonicalIdentity.$id,
      };

      if (profile && profile.publicKey !== canonicalIdentity.publicKey) {
        await databases.updateDocument(
          APPWRITE_CONFIG.DATABASES.CHAT,
          APPWRITE_CONFIG.TABLES.CHAT.PROFILES,
          profile.$id,
          {
            publicKey: canonicalIdentity.publicKey || null,
          },
        );
        (report.identity as Record<string, unknown>).profilePublicKeyUpdated = true;
      }
    }

    if (conversationId) {
      const conversation = await fetchConversation(databases, conversationId);
      const participants = Array.isArray(conversation?.participants)
        ? Array.from(new Set(conversation.participants.filter((participant: unknown): participant is string => typeof participant === "string" && participant.trim().length > 0)))
        : [];

      if (participants.length > 0 && !participants.includes(targetUserId) && !isAdminUser(requester)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403, headers: corsHeaders });
      }

      const epochIds = await fetchEpochIds(databases, conversationId);
      const keyMappings = await fetchKeyMappings(databases, targetUserId);
      const relevantMappings = keyMappings.filter((row: any) => {
        if (row.resourceType === "chat" && row.resourceId === conversationId) return true;
        if (row.resourceType === "epoch" && epochIds.includes(row.resourceId)) return true;
        return false;
      });

      const grouped = new Map<string, any[]>();
      for (const row of relevantMappings) {
        const key = `${row.resourceType}:${row.resourceId}:${row.grantee}`;
        const current = grouped.get(key) || [];
        current.push(row);
        grouped.set(key, current);
      }

      let repairedRows = 0;
      let deletedRows = 0;

      for (const rows of grouped.values()) {
        rows.sort((left, right) => {
          const leftMeta = parseMetadata(left.metadata);
          const rightMeta = parseMetadata(right.metadata);
          const leftScore = (leftMeta.senderPublicKey ? 2 : 0) + (leftMeta.wrappedByPublicKey ? 1 : 0);
          const rightScore = (rightMeta.senderPublicKey ? 2 : 0) + (rightMeta.wrappedByPublicKey ? 1 : 0);
          if (rightScore !== leftScore) return rightScore - leftScore;
          return new Date(right.$createdAt || right.createdAt || 0).getTime() - new Date(left.$createdAt || left.createdAt || 0).getTime();
        });

        const canonical = rows[0];
        const metadata = parseMetadata(canonical.metadata);
        if (metadata.wrappedBy && !metadata.wrappedByPublicKey) {
          try {
            const wrappedByProfile = await fetchProfile(databases, String(metadata.wrappedBy));
            if (wrappedByProfile?.publicKey) {
              metadata.wrappedByPublicKey = wrappedByProfile.publicKey;
            }
          } catch {
            // best effort only
          }
        }

        if (Object.keys(metadata).length > 0) {
          await databases.updateDocument(
            APPWRITE_CONFIG.DATABASES.PASSWORD_MANAGER,
            APPWRITE_CONFIG.TABLES.PASSWORD_MANAGER.KEY_MAPPING,
            canonical.$id,
            { metadata: serializeMetadata(metadata) },
          );
          repairedRows += 1;
        }

        for (const duplicate of rows.slice(1)) {
          await databases.deleteDocument(
            APPWRITE_CONFIG.DATABASES.PASSWORD_MANAGER,
            APPWRITE_CONFIG.TABLES.PASSWORD_MANAGER.KEY_MAPPING,
            duplicate.$id,
          );
          deletedRows += 1;
        }
      }

      report.mappings = {
        repaired: repairedRows,
        deleted: deletedRows,
        considered: relevantMappings.length,
      };
    }

    return NextResponse.json(report, { headers: corsHeaders });
  } catch (error: any) {
    console.error("[Connect Repair API] Error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to repair Connect encryption state" },
      { status: 500, headers: corsHeaders },
    );
  }
}
