import { Client, Databases, Messaging, Permission, Role, ID, Users } from 'node-appwrite';

const LANDING_URL = 'https://kylrix.space';

function buildWelcomeEmailHtml(recipientName, ctaUrl) {
    const safeRecipientName = recipientName || 'there';
    const safeCtaUrl = ctaUrl || LANDING_URL;

    return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Welcome to Kylrix</title>
    <style>
      body {
        margin: 0;
        padding: 0;
        background: #0a0908;
        color: #f7f4ee;
        font-family: Arial, Helvetica, sans-serif;
        line-height: 1.55;
      }
      .wrap {
        width: 100%;
        background: #0a0908;
        padding: 40px 16px;
      }
      .card {
        max-width: 680px;
        margin: 0 auto;
        background: #161412;
        border: 1px solid rgba(255, 255, 255, 0.08);
        border-radius: 28px;
        overflow: hidden;
        box-shadow: 0 24px 80px rgba(0, 0, 0, 0.45);
      }
      .hero {
        padding: 36px 40px 30px;
        background:
          linear-gradient(180deg, rgba(99, 102, 241, 0.24), rgba(99, 102, 241, 0.06) 56%, rgba(10, 9, 8, 0) 100%),
          radial-gradient(circle at top right, rgba(236, 72, 153, 0.14), transparent 30%),
          radial-gradient(circle at left center, rgba(16, 185, 129, 0.1), transparent 24%);
        border-bottom: 1px solid rgba(255, 255, 255, 0.06);
      }
      .brand {
        display: flex;
        align-items: center;
        gap: 16px;
        margin-bottom: 22px;
      }
      .logo {
        width: 72px;
        height: 72px;
        flex: 0 0 auto;
      }
      .brand-copy {
        display: flex;
        flex-direction: column;
        gap: 6px;
      }
      .eyebrow {
        font-size: 12px;
        letter-spacing: 0.16em;
        text-transform: uppercase;
        color: #c4b5fd;
        font-weight: 700;
      }
      .brand-name {
        font-size: 18px;
        color: #ffffff;
        font-weight: 800;
      }
      h1 {
        margin: 0 0 12px;
        font-size: 34px;
        line-height: 1.08;
        color: #ffffff;
        letter-spacing: -0.03em;
      }
      p {
        margin: 0 0 14px;
        color: rgba(255, 255, 255, 0.78);
        font-size: 15px;
      }
      .body {
        padding: 32px 40px 40px;
      }
      .intro {
        max-width: 560px;
        margin-bottom: 20px;
      }
      .section {
        margin: 0 0 22px;
      }
      .section h2 {
        margin: 0 0 12px;
        font-size: 18px;
        color: #ffffff;
        letter-spacing: -0.01em;
      }
      .cards {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 12px;
        margin-top: 12px;
      }
      .mini-card {
        padding: 16px;
        border-radius: 18px;
        background: rgba(255, 255, 255, 0.03);
        border: 1px solid rgba(255, 255, 255, 0.06);
      }
      .mini-card .tag {
        display: inline-block;
        margin-bottom: 10px;
        font-size: 11px;
        letter-spacing: 0.14em;
        text-transform: uppercase;
        font-weight: 800;
      }
      .mini-card h3 {
        margin: 0 0 8px;
        font-size: 16px;
        color: #ffffff;
      }
      .mini-card p {
        margin: 0;
        font-size: 14px;
        color: rgba(255, 255, 255, 0.72);
      }
      .primary {
        display: inline-block;
        margin-right: 10px;
        margin-top: 4px;
        padding: 14px 22px;
        border-radius: 14px;
        background: #6366f1;
        color: #ffffff !important;
        text-decoration: none;
        font-weight: 800;
        box-shadow: 0 10px 24px rgba(99, 102, 241, 0.24);
      }
      .secondary {
        display: inline-block;
        margin-top: 4px;
        padding: 14px 22px;
        border-radius: 14px;
        background: rgba(255, 255, 255, 0.04);
        border: 1px solid rgba(255, 255, 255, 0.08);
        color: #f7f4ee !important;
        text-decoration: none;
        font-weight: 800;
      }
      .secondary-note {
        background: rgba(236, 72, 153, 0.12);
        border-color: rgba(236, 72, 153, 0.26);
        color: #f9a8d4 !important;
        box-shadow: 0 10px 24px rgba(236, 72, 153, 0.12);
      }
      .secondary-vault {
        background: rgba(16, 185, 129, 0.12);
        border-color: rgba(16, 185, 129, 0.26);
        color: #6ee7b7 !important;
        box-shadow: 0 10px 24px rgba(16, 185, 129, 0.12);
      }
      .stack {
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
      }
      .rule {
        height: 1px;
        background: rgba(255, 255, 255, 0.06);
        margin: 24px 0;
      }
      .footer {
        padding: 0 40px 36px;
        color: rgba(255, 255, 255, 0.48);
        font-size: 13px;
      }
      .mini-logo-row {
        display: flex;
        align-items: center;
        gap: 10px;
        margin-bottom: 12px;
      }
      .badge {
        display: inline-block;
        padding: 8px 12px;
        border-radius: 999px;
        background: rgba(99, 102, 241, 0.12);
        color: #c7d2fe;
        font-size: 12px;
        font-weight: 700;
      }
      .mono {
        font-family: "Courier New", Courier, monospace;
        color: #c4b5fd;
      }
      .logo-large {
        width: 28px;
        height: 28px;
      }
      @media (max-width: 640px) {
        .hero,
        .body,
        .footer {
          padding-left: 22px;
          padding-right: 22px;
        }
        h1 {
          font-size: 28px;
        }
        .cards {
          grid-template-columns: 1fr;
        }
        .brand {
          align-items: flex-start;
        }
      }
    </style>
  </head>
  <body>
    <div class="wrap">
      <div class="card">
        <div class="hero">
          <div class="brand">
            <svg class="logo" viewBox="0 0 100 100" role="img" aria-label="Kylrix logo">
              <polygon points="50,10 15,30 15,70 50,90" fill="#6366F1"></polygon>
              <polygon points="50,10 85,30 85,70 50,90" fill="#FFFFFF"></polygon>
              <polygon points="50,38 62,50 50,62 38,50" fill="#0A0908"></polygon>
            </svg>
            <div class="brand-copy">
              <div class="eyebrow">Kylrix Accounts</div>
              <div class="brand-name">Root identity, branded and ready.</div>
            </div>
          </div>
          <div class="badge">👋 Welcome to the ecosystem</div>
          <h1>Your account is live, ${safeRecipientName}.</h1>
          <div class="intro">
            <p>
              You now have one identity across Kylrix. No clutter, no duplicate state, just a secure entry point into the ecosystem.
            </p>
          </div>
        </div>

        <div class="body">
          <div class="section">
            <h2>🚀 Start here</h2>
            <div class="cards">
              <div class="mini-card">
                <div class="tag" style="color:#c7d2fe;">Accounts</div>
                <h3>One session, everywhere</h3>
                <p>Sign in once and move across Kylrix without rebuilding your identity.</p>
              </div>
              <div class="mini-card">
                <div class="tag" style="color:#6ee7b7;">Security</div>
                <h3>Lock it down</h3>
                <p>Enable passkeys, 2FA, and recovery tools before you store anything important.</p>
              </div>
              <div class="mini-card">
                <div class="tag" style="color:#f9a8d4;">Privacy</div>
                <h3>Built for control</h3>
                <p>Your data stays anchored to the right app instead of being copied around.</p>
              </div>
            </div>
          </div>

          <div class="section">
            <h2>🧭 What to explore next</h2>
            <div class="stack">
              <a class="primary" href="${safeCtaUrl}">Open Accounts</a>
              <a class="secondary secondary-note" href="https://note.kylrix.space">Create notes</a>
              <a class="secondary secondary-vault" href="https://vault.kylrix.space">Go to Vault</a>
            </div>
          </div>

          <div class="section">
            <h2>✨ The suite at a glance</h2>
            <div class="cards">
              <div class="mini-card">
                <div class="mini-logo-row">
                  <svg class="logo-large" viewBox="0 0 100 100" role="img" aria-label="Accounts">
                    <polygon points="50,10 15,30 15,70 50,90" fill="#6366F1"></polygon>
                    <polygon points="50,10 85,30 85,70 50,90" fill="#FFFFFF"></polygon>
                    <polygon points="50,38 62,50 50,62 38,50" fill="#0A0908"></polygon>
                  </svg>
                  <div class="tag" style="color:#c7d2fe;">Accounts</div>
                </div>
                <p>Root of trust for sessions, sign-in, and identity.</p>
              </div>
              <div class="mini-card">
                <div class="mini-logo-row">
                  <svg class="logo-large" viewBox="0 0 100 100" role="img" aria-label="Vault">
                    <polygon points="50,10 15,30 15,70 50,90" fill="#6366F1"></polygon>
                    <polygon points="50,10 85,30 85,70 50,90" fill="#10B981"></polygon>
                    <rect x="38" y="38" width="24" height="24" fill="#0A0908" transform="rotate(45 50 50)"></rect>
                  </svg>
                  <div class="tag" style="color:#6ee7b7;">Vault</div>
                </div>
                <p>Secure storage for the most sensitive parts of your digital life.</p>
              </div>
              <div class="mini-card">
                <div class="mini-logo-row">
                  <svg class="logo-large" viewBox="0 0 100 100" role="img" aria-label="Note">
                    <polygon points="50,10 15,30 15,70 50,90" fill="#6366F1"></polygon>
                    <polygon points="50,10 85,30 85,70 50,90" fill="#EC4899"></polygon>
                    <rect x="38" y="38" width="24" height="24" fill="#0A0908" transform="rotate(45 50 50)"></rect>
                  </svg>
                  <div class="tag" style="color:#f9a8d4;">Note</div>
                </div>
                <p>Organize knowledge and ideas without losing your privacy model.</p>
              </div>
            </div>
          </div>

          <div class="section">
            <h2>📝 Quick note</h2>
            <p>
              If you did not create this account, you can safely ignore this email.
              Otherwise, welcome aboard the <span class="mono">Kylrix</span> network.
            </p>
          </div>

          <div class="rule"></div>

          <div class="section">
            <p>
              Need to come back later? Your account is ready whenever you are.
            </p>
          </div>
        </div>

        <div class="footer">
          <p>Thanks for joining Kylrix. We’re glad to have you here.</p>
        </div>
      </div>
    </div>
  </body>
</html>`;
}

/**
 * Sync User Profile Function
 * Trigger: users.*.create
 * Role: Admin (requires Server API Key)
 */
export default async ({ req, res, log, error }) => {
    const client = new Client()
        .setEndpoint(process.env.APPWRITE_FUNCTION_ENDPOINT)
        .setProject(process.env.APPWRITE_FUNCTION_PROJECT_ID)
        .setKey(process.env.APPWRITE_FUNCTION_API_KEY);

    const databases = new Databases(client);
    const messaging = new Messaging(client);
    const users = new Users(client);

    const DB_ID = process.env.DATABASE_ID_CHAT || 'chat';
    const COLLECTION_ID = process.env.COLLECTION_ID_USERS || 'users';

    const user = req.body;

    if (!user?.$id) {
        log('No user data found in the event payload. Checking if this is a manual trigger...');
        // Fallback for manual trigger if user is passed in payload
        if (req.payload) {
            try {
                const manualData = JSON.parse(req.payload);
                if (manualData.$id) {
                    log(`Using manual payload for user: ${manualData.$id}`);
                    Object.assign(user, manualData);
                }
            } catch (e) {
                error('Failed to parse manual payload');
            }
        }
    }

    if (!user?.$id) {
        log('No valid user ID found.');
        return res.json({ success: false, message: 'No user data' });
    }

    try {
        log(`Syncing profile for user: ${user.$id} (${user.email || 'no-email'})`);

        let freshUser = user;
        try {
            freshUser = await users.get(user.$id);
        } catch (_e) {
            log(`Falling back to trigger payload for ${user.$id}`);
        }

        const prefs = freshUser.prefs || user.prefs || {};
        const welcomeSent = Boolean(prefs.welcomeEmailSent || prefs.welcome_sent_at);

        // Create a searchable profile in the Global Directory
        const usernameBase = freshUser.name || freshUser.email?.split('@')[0] || `user_${user.$id.slice(0, 8)}`;
        const username = usernameBase.toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 50);

        const profileData = {
            username: username,
            displayName: freshUser.name || username,
            avatar: null,
            bio: "Member of the Kylrix Ecosystem",
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        try {
            await databases.createDocument(
                DB_ID,
                COLLECTION_ID,
                user.$id, // Document ID matches Auth User ID for 1:1 mapping
                profileData,
                [
                    Permission.read(Role.any()), // Critical for discovery
                    Permission.update(Role.user(user.$id)),
                    Permission.delete(Role.user(user.$id))
                ]
            );
            log(`Successfully created global profile for ${user.$id}`);
        } catch (profileErr) {
            if (profileErr.code === 409) {
                log('Profile already exists, skipping creation.');
            } else {
                throw profileErr;
            }
        }

        if (freshUser.email && !welcomeSent) {
            try {
                const recipientName = freshUser.name || freshUser.email.split('@')[0];
                const info = await messaging.createEmail({
                    messageId: ID.unique(),
                    subject: '👋 Welcome to the Future of Privacy',
                    content: buildWelcomeEmailHtml(recipientName, LANDING_URL),
                    users: [freshUser.$id],
                    html: true,
                });

                log(`Queued welcome email for ${freshUser.email} (${info.$id})`);
                try {
                    await users.updatePrefs(freshUser.$id, {
                        ...prefs,
                        welcomeEmailSent: true,
                        welcomeEmailSentAt: new Date().toISOString(),
                    });
                } catch (prefsErr) {
                    error(`Failed to mark welcome email as sent for ${freshUser.$id}: ${prefsErr.message}`);
                }
            } catch (emailErr) {
                error(`Welcome email failed for ${freshUser.email || freshUser.$id}: ${emailErr.message}`);
            }
        } else {
            log(`Skipping welcome email for ${freshUser.$id} because it was already sent or no email address was provided.`);
        }

        return res.json({ success: true, profile: profileData });

    } catch (err) {
        error(`Failed to sync profile: ${err.message}`);
        return res.json({ success: false, error: err.message }, 500);
    }
};
