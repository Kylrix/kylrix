import fs from 'node:fs';
import { execSync } from 'node:child_process';
import { createClient } from '@libsql/client';

// 1. Connect to Turso
const env = fs.readFileSync('.env.local', 'utf-8');
const tursoUrl = env.match(/TURSO_DATABASE_URL=(.+)/)?.[1]?.trim();
const tursoToken = env.match(/TURSO_AUTH_TOKEN=(.+)/)?.[1]?.trim();

if (!tursoUrl || !tursoToken) {
  console.error('Missing Turso credentials in .env.local');
  process.exit(1);
}

const turso = createClient({ url: tursoUrl, authToken: tursoToken });

function runCliJson(cmd) {
  const envPath = `${process.env.PATH || ''}:/home/user/.global_modules/bin`;
  const output = execSync(cmd, {
    encoding: 'utf-8',
    maxBuffer: 50 * 1024 * 1024,
    env: { ...process.env, PATH: envPath },
  });
  return JSON.parse(output);
}

async function main() {
  console.log('=== Starting Kylrix Appwrite -> Turso Reconciliation & Migration ===');

  // Verify Turso users
  const userCheck = await turso.execute('SELECT id FROM user');
  const knownUserIds = new Set(userCheck.rows.map((r) => r.id));
  console.log(`Loaded ${knownUserIds.size} users from Turso.`);

  // ----------------------------------------------------
  // STEP 1: Migrate Credentials -> vault_items
  // ----------------------------------------------------
  console.log('\n--- Step 1: Migrating Credentials -> vault_items ---');
  const credsData = runCliJson(
    'appwrite tablesdb list-rows --database-id passwordManagerDb --table-id credentials --limit 100 --raw --show-secrets'
  );
  const credsRows = credsData.rows || [];
  console.log(`Fetched ${credsRows.length} credentials from Appwrite.`);

  // Clear existing vault_items
  await turso.execute('DELETE FROM vault_items');
  console.log('Cleared existing vault_items in Turso.');

  let credsInserted = 0;
  for (const r of credsRows) {
    const ownerId = knownUserIds.has(r.userId) ? r.userId : '67ffb09c00197408cc0e';
    const metadataObj = {
      name: r.name || '',
      username: r.username || '',
      password: r.password || '',
      url: r.url || '',
      notes: r.notes || '',
      customFields: r.customFields || '',
      totpId: r.totpId || null,
      folderId: r.folderId || null,
      tags: r.tags || [],
      dek: r.dek || null,
      itemType: r.itemType || 'login',
      isFavorite: Boolean(r.isFavorite),
      isPinned: Boolean(r.isPinned),
      isPublic: Boolean(r.isPublic),
      isGuest: Boolean(r.isGuest),
      isShared: Boolean(r.isShared),
      isTrash: Boolean(r.isTrash || r.isDeleted),
      isWorkspace: Boolean(r.isWorkspace),
      isAgentic: Boolean(r.isAgentic),
      isEnv: Boolean(r.isEnv),
      cardNumber: r.cardNumber || null,
      cardholderName: r.cardholderName || null,
      cardExpiry: r.cardExpiry || null,
      cardCVV: r.cardCVV || null,
      cardPIN: r.cardPIN || null,
      cardType: r.cardType || null,
    };

    const title = r.name || 'Encrypted Secret';
    const encryptedData = r.password || r.customFields || r.username || '';
    const isTrashed = r.isTrash || r.isDeleted ? 1 : 0;
    const isWorkspace = r.isWorkspace ? 1 : 0;
    const createdAt = r.$createdAt || r.createdAt || new Date().toISOString();
    const updatedAt = r.$updatedAt || r.updatedAt || new Date().toISOString();

    await turso.execute({
      sql: `INSERT INTO vault_items (id, user_id, title, type, encrypted_data, iv, metadata, is_trashed, is_workspace, workspace_id, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        r.$id,
        ownerId,
        title,
        r.itemType || 'login',
        encryptedData,
        null,
        JSON.stringify(metadataObj),
        isTrashed,
        isWorkspace,
        null,
        createdAt,
        updatedAt,
      ],
    });
    credsInserted++;
  }
  console.log(`Successfully inserted ${credsInserted} vault_items into Turso.`);

  // ----------------------------------------------------
  // STEP 2: Migrate totpSecrets -> totp_secrets
  // ----------------------------------------------------
  console.log('\n--- Step 2: Migrating totpSecrets -> totp_secrets ---');
  const allTotpIds = [
    '692887f2003e3a4f87bd',
    '69374608000b35a63a67',
    '693ea9bf000c42b7c6ce',
    '69ad92cd000c4bf290c9',
    '6a590ea900093540e576',
    '6a59f7f4002067f9ddca',
    '6a624ae4003b56139c34',
    '6a7da6cc00260fca8cee',
    '6a905bd7001b9072580e',
    '6aaa5c7c0021ba9ef2e1',
    '6aace93300096df4de2e',
  ];

  await turso.execute('DELETE FROM totp_secrets');
  console.log('Cleared existing totp_secrets in Turso.');

  let totpInserted = 0;
  for (const id of allTotpIds) {
    try {
      const r = runCliJson(
        `appwrite tablesdb get-row --database-id passwordManagerDb --table-id totpSecrets --row-id ${id} --raw --show-secrets`
      );
      const ownerId = knownUserIds.has(r.userId) ? r.userId : '67ffb09c00197408cc0e';
      const metadataObj = {
        issuer: r.issuer || '',
        accountName: r.accountName || '',
        secretKey: r.secretKey || '',
        algorithm: r.algorithm || 'SHA1',
        digits: r.digits || 6,
        period: r.period || 30,
        url: r.url || null,
        folderId: r.folderId || null,
        tags: r.tags || [],
        dek: r.dek || null,
        isFavorite: Boolean(r.isFavorite),
        isPinned: Boolean(r.isPinned),
        isPublic: Boolean(r.isPublic),
        isGuest: Boolean(r.isGuest),
        isShared: Boolean(r.isShared),
        isTrash: Boolean(r.isTrash || r.isDeleted),
      };

      const account = r.accountName || r.issuer || 'totp';
      const encryptedSecret = r.secretKey || '';
      const createdAt = r.$createdAt || r.createdAt || new Date().toISOString();

      await turso.execute({
        sql: `INSERT INTO totp_secrets (id, user_id, account, encrypted_secret, metadata, created_at)
              VALUES (?, ?, ?, ?, ?, ?)`,
        args: [r.$id, ownerId, account, encryptedSecret, JSON.stringify(metadataObj), createdAt],
      });
      totpInserted++;
    } catch (err) {
      console.error(`Failed to migrate TOTP row ${id}:`, err.message);
    }
  }
  console.log(`Successfully inserted ${totpInserted} totp_secrets into Turso.`);

  // ----------------------------------------------------
  // STEP 3: Reconcile Workspaces & Workspace Members
  // ----------------------------------------------------
  console.log('\n--- Step 3: Reconciling Workspaces & Workspace Members ---');
  // Update owner_id = creator_id where owner_id is null
  await turso.execute('UPDATE workspaces SET owner_id = creator_id WHERE owner_id IS NULL');
  console.log('Aligned workspace owner_id = creator_id.');

  // Ensure workspace_members table exists
  await turso.execute(`
    CREATE TABLE IF NOT EXISTS workspace_members (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
      role TEXT NOT NULL DEFAULT 'member',
      created_at TEXT NOT NULL
    )
  `);

  // Clear workspace_members to avoid duplicate keys on re-run
  await turso.execute('DELETE FROM workspace_members');

  // Insert workspace creators as owners
  const wsList = await turso.execute('SELECT id, creator_id, created_at FROM workspaces');
  let membersCount = 0;
  for (const ws of wsList.rows) {
    if (knownUserIds.has(ws.creator_id)) {
      await turso.execute({
        sql: `INSERT OR REPLACE INTO workspace_members (id, workspace_id, user_id, role, created_at)
              VALUES (?, ?, ?, 'owner', ?)`,
        args: [`${ws.id}_${ws.creator_id}`, ws.id, ws.creator_id, ws.created_at || new Date().toISOString()],
      });
      membersCount++;
    }
  }
  console.log(`Inserted ${membersCount} workspace creator owners into workspace_members.`);

  // ----------------------------------------------------
  // STEP 4: Reconcile project_objects -> workspace_objects & Linkages
  // ----------------------------------------------------
  console.log('\n--- Step 4: Reconciling project_objects -> workspace_objects ---');
  let poOffset = 0;
  const poBatchSize = 100;
  let allProjectObjects = [];

  while (true) {
    try {
      const data = runCliJson(
        `appwrite tablesdb list-rows --database-id passwordManagerDb --table-id project_objects --limit ${poBatchSize} --offset ${poOffset} --raw`
      );
      const rows = data.rows || [];
      allProjectObjects.push(...rows);
      if (rows.length < poBatchSize) break;
      poOffset += rows.length;
    } catch {
      break;
    }
  }
  console.log(`Fetched ${allProjectObjects.length} project_objects from Appwrite.`);

  let objectJoinsInserted = 0;
  for (const po of allProjectObjects) {
    const wsId = po.projectId;
    const kind = po.entityKind;
    const entityId = po.entityId;

    // Check if collaborator -> add to workspace_members
    if (kind === 'collaborator' || kind === 'user') {
      if (knownUserIds.has(entityId)) {
        await turso.execute({
          sql: `INSERT OR REPLACE INTO workspace_members (id, workspace_id, user_id, role, created_at)
                VALUES (?, ?, ?, ?, ?)`,
          args: [`${wsId}_${entityId}`, wsId, entityId, po.role || 'member', po.createdAt || new Date().toISOString()],
        });
        membersCount++;
      }
    }

    // Insert into workspace_objects
    const poUserId = (po.userId && knownUserIds.has(po.userId)) ? po.userId : '67ffb09c00197408cc0e';
    try {
      await turso.execute({
        sql: `INSERT OR REPLACE INTO workspace_objects (id, workspace_id, entity_kind, entity_id, user_id, created_at, role, is_public, is_guest, is_general, updated_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, 0, 0, 0, ?)`,
        args: [
          po.$id,
          wsId,
          kind,
          entityId,
          poUserId,
          po.createdAt || new Date().toISOString(),
          po.role || 'member',
          po.updatedAt || new Date().toISOString(),
        ],
      });
      objectJoinsInserted++;
    } catch (e) {
      // Foreign key or duplicate
    }

    // Stamp child records with workspace_id and is_workspace = 1
    if (kind === 'note' || kind === 'idea') {
      await turso.execute({
        sql: 'UPDATE ideas SET workspace_id = ?, is_workspace = 1 WHERE id = ?',
        args: [wsId, entityId],
      });
    } else if (kind === 'task' || kind === 'goal') {
      await turso.execute({
        sql: 'UPDATE goals SET workspace_id = ? WHERE id = ?',
        args: [wsId, entityId],
      });
    } else if (kind === 'form') {
      await turso.execute({
        sql: 'UPDATE forms SET workspace_id = ?, is_workspace = 1 WHERE id = ?',
        args: [wsId, entityId],
      });
    } else if (kind === 'event') {
      await turso.execute({
        sql: 'UPDATE events SET workspace_id = ?, is_workspace = 1 WHERE id = ?',
        args: [wsId, entityId],
      });
    } else if (kind === 'credential' || kind === 'vault_item') {
      await turso.execute({
        sql: 'UPDATE vault_items SET workspace_id = ?, is_workspace = 1 WHERE id = ?',
        args: [wsId, entityId],
      });
    }
  }

  console.log(`Inserted ${objectJoinsInserted} workspace_objects into Turso.`);
  console.log(`Total workspace_members now: ${membersCount}.`);

  // ----------------------------------------------------
  // STEP 5: Verification of counts
  // ----------------------------------------------------
  console.log('\n--- Step 5: Final Turso Inventory Check ---');
  const vCnt = await turso.execute('SELECT COUNT(*) as c FROM vault_items');
  const tCnt = await turso.execute('SELECT COUNT(*) as c FROM totp_secrets');
  const tFilled = await turso.execute("SELECT COUNT(*) as c FROM totp_secrets WHERE encrypted_secret != ''");
  const mCnt = await turso.execute('SELECT COUNT(*) as c FROM workspace_members');
  const oCnt = await turso.execute('SELECT COUNT(*) as c FROM workspace_objects');
  const wsCnt = await turso.execute('SELECT COUNT(*) as c FROM workspaces');
  const ideasCnt = await turso.execute('SELECT COUNT(*) as c FROM ideas');
  const goalsCnt = await turso.execute('SELECT COUNT(*) as c FROM goals');
  const formsCnt = await turso.execute('SELECT COUNT(*) as c FROM forms');
  const eventsCnt = await turso.execute('SELECT COUNT(*) as c FROM events');

  console.log(`vault_items: ${vCnt.rows[0].c}`);
  console.log(`totp_secrets: ${tCnt.rows[0].c} (with valid encrypted secrets: ${tFilled.rows[0].c})`);
  console.log(`workspaces: ${wsCnt.rows[0].c}`);
  console.log(`workspace_members: ${mCnt.rows[0].c}`);
  console.log(`workspace_objects: ${oCnt.rows[0].c}`);
  console.log(`ideas (notes): ${ideasCnt.rows[0].c}`);
  console.log(`goals: ${goalsCnt.rows[0].c}`);
  console.log(`forms: ${formsCnt.rows[0].c}`);
  console.log(`events: ${eventsCnt.rows[0].c}`);

  console.log('\n=== Migration & Reconciliation Finished Successfully! ===');
}

main().catch((err) => {
  console.error('Fatal migration error:', err);
  process.exit(1);
});
