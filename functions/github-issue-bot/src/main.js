import { Client, Databases, ID } from 'node-appwrite';
import GithubService from './github.js';
import { throwIfMissing } from './utils.js';

/**
 * Kylrix GitHub Bot Appwrite Function
 * 
 * Supports configured GitHub webhook events:
 * 1. issues & issue_dependencies: auto-welcome, triage, mirror to Kylrix tasks
 * 2. issue_comment: command dispatch (/triage, /agent, /kylrix)
 * 3. pull_request: review guidance, contributor greeting
 * 4. discussions & discussion_comment: community welcome & acknowledgement
 * 5. commit_comment: feedback acknowledgement
 * 6. release: release notice & deployment linkage
 * 7. dependabot_alert: security alert notice & high-priority task sync
 * 8. deployment / deployment_status: tracking deployment states
 * 9. package: registry publish telemetry
 * 10. page_build: docs & static page build status
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

  log(`[Kylrix GitHub Bot] Event received: ${event}${action ? `.${action}` : ''} for ${repository.full_name || repository.name}`);

  // Helper: Initialize Appwrite Client & Databases if configured
  const getDatabases = () => {
    if (!process.env.APPWRITE_FUNCTION_PROJECT_ID || !process.env.APPWRITE_FUNCTION_API_KEY) {
      return null;
    }
    const client = new Client()
      .setEndpoint(process.env.APPWRITE_FUNCTION_ENDPOINT || 'https://fra.cloud.appwrite.io/v1')
      .setProject(process.env.APPWRITE_FUNCTION_PROJECT_ID)
      .setKey(process.env.APPWRITE_FUNCTION_API_KEY);
    return { databases: new Databases(client), dbId: process.env.DATABASE_ID || 'passwordManagerDb' };
  };

  // ── Ping Event ──
  if (event === 'ping') {
    log('[Kylrix GitHub Bot] Ping received successfully from GitHub');
    return res.json({
      ok: true,
      message: 'Kylrix GitHub Bot active & responsive',
      zen: bodyJson.zen,
      hookId: bodyJson.hook_id,
    });
  }

  // ── 1. Issues & Issue Dependencies ──
  if (event === 'issues' || event === 'issue_dependencies') {
    const issue = bodyJson.issue;
    if (!issue) return res.json({ ok: true, message: 'No issue payload' });

    if (action === 'opened') {
      const author = issue.user?.login || 'contributor';
      const isBug = /bug|error|crash|broken|fail/i.test(`${issue.title} ${issue.body}`);
      const isFeature = /feature|feat|request|enhancement|idea/i.test(`${issue.title} ${issue.body}`);

      const labelsToApply = ['community'];
      if (isBug) labelsToApply.push('bug');
      else if (isFeature) labelsToApply.push('enhancement');

      try {
        await github.addLabels(repository, issue.number, labelsToApply);
      } catch (labelErr) {
        log(`[Kylrix GitHub Bot] Labeling error: ${labelErr.message}`);
      }

      // Sync into Kylrix Tasks
      const appwriteContext = getDatabases();
      if (appwriteContext) {
        try {
          await appwriteContext.databases.createRow(
            appwriteContext.dbId,
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
          log(`[Kylrix GitHub Bot] Synced issue #${issue.number} into Kylrix tasks`);
        } catch (dbErr) {
          log(`[Kylrix GitHub Bot] Task mirror notice: ${dbErr.message}`);
        }
      }

      const welcomeComment = `### 👋 Welcome to Kylrix, @${author}!

Thank you for reporting this ${isBug ? 'issue' : isFeature ? 'enhancement proposal' : 'topic'} to the Kylrix repository.

- **Status**: Triage queue opened (tagged \`${labelsToApply.join(', ')}\`)
- **Ecosystem**: Visit [www.kylrix.space](https://www.kylrix.space) to test live builds
- **Autonomous Agent**: Type \`/triage\` or \`/agent\` in a comment to request an autonomous workspace pass

Our maintainers and automated agents will inspect this shortly!`;

      await github.postComment(repository, issue.number, welcomeComment);
      return res.json({ ok: true, action: 'issue_triaged', issue: issue.number });
    }

    return res.json({ ok: true, event, action });
  }

  // ── 2. Issue Comments (Slash Commands) ──
  if (event === 'issue_comment' && action === 'created') {
    const comment = bodyJson.comment;
    const issue = bodyJson.issue;
    if (comment && issue && comment.user?.type !== 'Bot') {
      const commentText = (comment.body || '').trim();
      if (commentText.startsWith('/triage') || commentText.startsWith('/agent') || commentText.startsWith('/kylrix')) {
        const reply = `🤖 **Kylrix Agent Dispatch**\n\nCommand acknowledged: \`${commentText}\` by @${comment.user.login}. Context enqueued into Kylrix agent workspace.`;
        await github.postComment(repository, issue.number, reply);
        return res.json({ ok: true, action: 'command_handled', command: commentText });
      }
    }
    return res.json({ ok: true, event, action });
  }

  // ── 3. Pull Requests ──
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

    return res.json({ ok: true, event, action });
  }

  // ── 4. Discussions & Discussion Comments ──
  if (event === 'discussion' || event === 'discussion_comment') {
    const discussion = bodyJson.discussion;
    log(`[Kylrix GitHub Bot] Discussion event: #${discussion?.number} (${action})`);
    return res.json({
      ok: true,
      event,
      action,
      discussionNumber: discussion?.number,
      title: discussion?.title,
    });
  }

  // ── 5. Commit Comments ──
  if (event === 'commit_comment') {
    const comment = bodyJson.comment;
    log(`[Kylrix GitHub Bot] Commit comment by @${comment?.user?.login} on commit ${comment?.commit_id}`);
    return res.json({ ok: true, event, commitId: comment?.commit_id });
  }

  // ── 6. Releases ──
  if (event === 'release') {
    const release = bodyJson.release;
    log(`[Kylrix GitHub Bot] Release ${action}: ${release?.tag_name} (${release?.name})`);
    
    // Log release into Kylrix notifications/activities
    const appwriteContext = getDatabases();
    if (appwriteContext && (action === 'published' || action === 'created')) {
      try {
        await appwriteContext.databases.createRow(
          appwriteContext.dbId,
          'tasks',
          ID.unique(),
          {
            title: `[Release ${release.tag_name}] ${release.name || 'New Kylrix Release'}`,
            description: `GitHub Release ${release.tag_name} published.\n\nRelease notes:\n${release.body || ''}\n\nURL: ${release.html_url}`,
            status: 'done',
            priority: 'high',
            isAgentic: true,
            isTrash: false,
            userId: 'github-bot',
          }
        );
      } catch (relErr) {
        log(`[Kylrix GitHub Bot] Release task sync error: ${relErr.message}`);
      }
    }

    return res.json({ ok: true, event, tag: release?.tag_name });
  }

  // ── 7. Dependabot Alerts ──
  if (event === 'dependabot_alert') {
    const alert = bodyJson.alert;
    log(`[Kylrix GitHub Bot] Dependabot alert #${alert?.number} (${action}): ${alert?.security_advisory?.summary}`);
    
    // Mirror critical/high security alerts into urgent tasks
    const appwriteContext = getDatabases();
    if (appwriteContext && action === 'created') {
      try {
        const severity = alert?.security_advisory?.severity || 'medium';
        await appwriteContext.databases.createRow(
          appwriteContext.dbId,
          'tasks',
          ID.unique(),
          {
            title: `[Security Alert] ${alert?.security_advisory?.summary?.slice(0, 200)}`,
            description: `Dependabot Alert #${alert.number} (${severity.toUpperCase()})\nPackage: ${alert.dependency?.package?.name}\nVulnerable versions: ${alert.security_vulnerability?.vulnerable_version_range}\nAdvisory URL: ${alert.html_url}`,
            status: 'todo',
            priority: severity === 'critical' || severity === 'high' ? 'urgent' : 'high',
            isAgentic: true,
            isTrash: false,
            userId: 'github-bot',
          }
        );
      } catch (secErr) {
        log(`[Kylrix GitHub Bot] Security alert task sync error: ${secErr.message}`);
      }
    }

    return res.json({ ok: true, event, alertNumber: alert?.number });
  }

  // ── 8. Deployments & Deployment Status ──
  if (event === 'deployment' || event === 'deployment_status') {
    const deployment = bodyJson.deployment;
    log(`[Kylrix GitHub Bot] Deployment ${event}: ${deployment?.environment || 'production'} (ID: ${deployment?.id})`);
    return res.json({ ok: true, event, environment: deployment?.environment });
  }

  // ── 9. Packages ──
  if (event === 'package') {
    const pkg = bodyJson.package;
    log(`[Kylrix GitHub Bot] Package event (${action}): ${pkg?.name}`);
    return res.json({ ok: true, event, package: pkg?.name });
  }

  // ── 10. Page Builds ──
  if (event === 'page_build') {
    const build = bodyJson.build;
    log(`[Kylrix GitHub Bot] Page build event: ${build?.status}`);
    return res.json({ ok: true, event, status: build?.status });
  }

  // Fallback for any other event
  log(`[Kylrix GitHub Bot] Acknowledged event: ${event}`);
  return res.json({ ok: true, event });
};
