import { Client, Databases, ID } from 'node-appwrite';
import GithubService from './github.js';
import { throwIfMissing } from './utils.js';

/**
 * Kylrix GitHub Bot Appwrite Function
 * 
 * Features:
 * 1. Automatic issue welcome & triage with quick links to docs, discussions & guidelines.
 * 2. Automatic task/goal mirroring into Appwrite database `passwordManagerDb` table `tasks` for repo maintainers.
 * 3. PR triage & greeting acknowledging community pull requests.
 * 4. Slash commands in comments: `/triage`, `/kylrix`, `/agent` to trigger bot actions.
 */

export default async ({ req, res, log, error }) => {
  throwIfMissing(process.env, ['GITHUB_TOKEN']);

  // Extract raw body and parsed bodyJson
  const rawBody = typeof req.body === 'string' ? req.body : JSON.stringify(req.body || {});
  let bodyJson = req.bodyJson;
  if (!bodyJson) {
    try {
      bodyJson = typeof req.body === 'object' && req.body !== null ? req.body : JSON.parse(rawBody || '{}');
    } catch {
      bodyJson = {};
    }
  }

  const github = new GithubService();

  // 1. Webhook Signature Verification
  const isVerified = await github.verifyWebhook(req, rawBody);
  if (!isVerified) {
    error('[Kylrix GitHub Bot] Invalid webhook signature');
    return res.json({ ok: false, error: 'Invalid signature' }, 401);
  }

  const event = req.headers['x-github-event'] || 'unknown';
  const action = bodyJson.action || '';
  const repository = bodyJson.repository || { name: 'kylrix', owner: { login: 'Kylrix' } };

  log(`[Kylrix GitHub Bot] Processing GitHub event: ${event}.${action} for repository ${repository.full_name || repository.name}`);

  // 2. Ping Event (Initial GitHub Webhook Setup handshake)
  if (event === 'ping') {
    log('[Kylrix GitHub Bot] Ping received successfully from GitHub');
    return res.json({
      ok: true,
      message: 'Kylrix GitHub Bot active & responsive',
      zen: bodyJson.zen,
      hookId: bodyJson.hook_id,
    });
  }

  // 3. Issue Events
  if (event === 'issues') {
    const issue = bodyJson.issue;
    if (!issue) return res.json({ ok: true, message: 'No issue payload' });

    // Handle Issue Opened
    if (action === 'opened') {
      const author = issue.user?.login || 'contributor';
      const isMaintainer = ['OWNER', 'MEMBER', 'COLLABORATOR'].includes(issue.author_association);
      const isBug = /bug|error|crash|broken|fail/i.test(`${issue.title} ${issue.body}`);
      const isFeature = /feature|feat|request|enhancement|idea/i.test(`${issue.title} ${issue.body}`);

      // Auto-labeling
      const labelsToApply = ['community'];
      if (isBug) labelsToApply.push('bug');
      else if (isFeature) labelsToApply.push('enhancement');

      try {
        await github.addLabels(repository, issue.number, labelsToApply);
      } catch (labelErr) {
        log(`[Kylrix GitHub Bot] Labeling error: ${labelErr.message}`);
      }

      // Mirror Issue as a Goal/Task in Appwrite DB if Appwrite environment keys exist
      if (process.env.APPWRITE_FUNCTION_PROJECT_ID && process.env.APPWRITE_FUNCTION_API_KEY) {
        try {
          const client = new Client()
            .setEndpoint(process.env.APPWRITE_FUNCTION_ENDPOINT || 'https://fra.cloud.appwrite.io/v1')
            .setProject(process.env.APPWRITE_FUNCTION_PROJECT_ID)
            .setKey(process.env.APPWRITE_FUNCTION_API_KEY);

          const databases = new Databases(client);
          const DB_ID = process.env.DATABASE_ID || 'passwordManagerDb';

          await databases.createRow(
            DB_ID,
            'tasks',
            ID.unique(),
            {
              title: `[GH #${issue.number}] ${issue.title.slice(0, 200)}`,
              description: `GitHub Issue #${issue.number} by @${author}:\n\n${(issue.body || '').slice(0, 1000)}\n\nURL: ${issue.html_url}`,
              status: 'todo',
              priority: isBug ? 'high' : 'medium',
              isAgentic: true,
              isTrash: false,
              userId: 'github-bot',
            }
          );
          log(`[Kylrix GitHub Bot] Successfully synced issue #${issue.number} into Kylrix tasks`);
        } catch (dbErr) {
          log(`[Kylrix GitHub Bot] Optional task mirror skipped or errored: ${dbErr.message}`);
        }
      }

      // Post warm, helpful welcome comment
      const welcomeComment = `### 👋 Welcome to Kylrix, @${author}!

Thank you for reporting this ${isBug ? 'issue' : isFeature ? 'enhancement proposal' : 'topic'} to the Kylrix repository.

- **Status**: Triage queue opened (tagged \`${labelsToApply.join(', ')}\`)
- **Ecosystem**: Visit [www.kylrix.space](https://www.kylrix.space) to test live builds
- **Autonomous Agent**: Type \`/triage\` or \`/agent\` in a comment to request an autonomous workspace pass

Our maintainers and automated agents will inspect this shortly!`;

      await github.postComment(repository, issue.number, welcomeComment);
      return res.json({ ok: true, action: 'commented_and_labeled', issue: issue.number });
    }

    return res.json({ ok: true, message: `Ignored issue action: ${action}` });
  }

  // 4. Pull Request Events
  if (event === 'pull_request') {
    const pr = bodyJson.pull_request;
    if (!pr) return res.json({ ok: true, message: 'No PR payload' });

    if (action === 'opened') {
      const author = pr.user?.login || 'contributor';
      const prComment = `### 🚀 Pull Request Received!

Thank you @${author} for contributing code to **Kylrix**!

- **Target Branch**: \`${pr.base?.ref || 'master'}\`
- **Head Branch**: \`${pr.head?.ref}\`
- **Review**: The team will review your pull request against our OpenBricks standards and operational guardrails.

*Run \`pnpm lint\` locally to verify no ESLint warnings before review.*`;

      await github.postComment(repository, pr.number, prComment);
      return res.json({ ok: true, action: 'commented_pr', pr: pr.number });
    }

    return res.json({ ok: true, message: `Ignored PR action: ${action}` });
  }

  // 5. Issue Comments (Slash Commands)
  if (event === 'issue_comment' && action === 'created') {
    const comment = bodyJson.comment;
    const issue = bodyJson.issue;
    if (comment && issue && comment.user?.type !== 'Bot') {
      const commentText = (comment.body || '').trim();
      if (commentText.startsWith('/triage') || commentText.startsWith('/agent')) {
        const reply = `🤖 **Kylrix Agent Dispatch**\n\nCommand acknowledged: \`${commentText}\` by @${comment.user.login}. Context enqueued for evaluation.`;
        await github.postComment(repository, issue.number, reply);
        return res.json({ ok: true, action: 'command_handled', command: commentText });
      }
    }
  }

  log(`[Kylrix GitHub Bot] Event ${event} acknowledged without comment`);
  return res.json({ ok: true, event });
};
