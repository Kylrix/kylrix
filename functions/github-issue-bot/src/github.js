import { Octokit } from '@octokit/rest';
import { verify } from '@octokit/webhooks-methods';

class GithubService {
  constructor() {
    this.octokit = new Octokit({
      auth: process.env.GITHUB_TOKEN,
    });
  }

  /**
   * Verify HMAC-SHA256 GitHub Webhook Signature
   * @param {*} req
   * @param {string|Buffer} rawBody
   * @returns {Promise<boolean>}
   */
  async verifyWebhook(req, rawBody) {
    const signature = req.headers['x-hub-signature-256'];
    const secret = process.env.GITHUB_WEBHOOK_SECRET;

    if (!secret) return true; // If secret not configured, bypass
    if (!signature) return false;

    try {
      return await verify(secret, rawBody || req.bodyBinary || '', signature);
    } catch {
      return false;
    }
  }

  /**
   * Check if event is an issue event
   */
  isIssueEvent(req, bodyJson) {
    const event = req.headers['x-github-event'];
    return (event === 'issues' || event === 'issue_comment') && !!bodyJson?.issue;
  }

  /**
   * Check if event is a pull request event
   */
  isPullRequestEvent(req, bodyJson) {
    const event = req.headers['x-github-event'];
    return (event === 'pull_request' || event === 'pull_request_review') && !!bodyJson?.pull_request;
  }

  /**
   * Post a formatted markdown comment on an issue or pull request
   * @param {any} repository
   * @param {number} issueNumber
   * @param {string} comment
   */
  async postComment(repository, issueNumber, comment) {
    const owner = repository.owner?.login || repository.owner?.name;
    const repo = repository.name;
    return await this.octokit.issues.createComment({
      owner,
      repo,
      issue_number: issueNumber,
      body: comment,
    });
  }

  /**
   * Add labels to an issue or pull request
   * @param {any} repository
   * @param {number} issueNumber
   * @param {string[]} labels
   */
  async addLabels(repository, issueNumber, labels) {
    if (!labels || labels.length === 0) return;
    const owner = repository.owner?.login || repository.owner?.name;
    const repo = repository.name;
    return await this.octokit.issues.addLabels({
      owner,
      repo,
      issue_number: issueNumber,
      labels,
    });
  }
}

export default GithubService;
