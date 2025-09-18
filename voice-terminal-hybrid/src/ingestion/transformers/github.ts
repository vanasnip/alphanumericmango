/**
 * GitHub webhook transformer
 */

import { BaseTransformer } from './base.js';
import type { TransformerResult, RawNotificationPayload } from '../types/index.js';

export class GitHubTransformer extends BaseTransformer {
  name = 'github';
  priority = 90;

  detect(payload: any): boolean {
    // Check for GitHub webhook headers or payload structure
    if (payload.headers && payload.headers['x-github-event']) {
      return true;
    }

    // Check for GitHub payload structure
    if (payload.repository && payload.repository.full_name && payload.sender) {
      return true;
    }

    // Check for GitHub API response structure
    if (payload.html_url && payload.html_url.includes('github.com')) {
      return true;
    }

    return false;
  }

  transform(payload: any): TransformerResult {
    try {
      const event = this.get(payload, 'headers.x-github-event') || this.detectEventType(payload);
      const repo = this.get(payload, 'repository.full_name', 'Unknown Repository');
      const sender = this.get(payload, 'sender.login', 'Unknown User');

      let title: string;
      let content: string;
      let priority: 1 | 2 | 3 | 4 | 5 = 3;
      let actions: any[] = [];
      let tags: string[] = ['github'];

      switch (event) {
        case 'push':
          title = this.handlePushEvent(payload, repo, sender);
          content = this.getPushContent(payload);
          priority = 4;
          tags.push('push', 'commits');
          break;

        case 'pull_request':
          title = this.handlePullRequestEvent(payload, repo, sender);
          content = this.getPullRequestContent(payload);
          priority = 2;
          actions = this.getPullRequestActions(payload);
          tags.push('pull-request');
          break;

        case 'issues':
          title = this.handleIssuesEvent(payload, repo, sender);
          content = this.getIssuesContent(payload);
          priority = 3;
          actions = this.getIssuesActions(payload);
          tags.push('issues');
          break;

        case 'release':
          title = this.handleReleaseEvent(payload, repo, sender);
          content = this.getReleaseContent(payload);
          priority = 1;
          actions = this.getReleaseActions(payload);
          tags.push('release');
          break;

        case 'workflow_run':
          title = this.handleWorkflowEvent(payload, repo, sender);
          content = this.getWorkflowContent(payload);
          priority = this.getWorkflowPriority(payload);
          actions = this.getWorkflowActions(payload);
          tags.push('workflow', 'ci');
          break;

        default:
          title = `GitHub ${event} in ${repo}`;
          content = `Event triggered by ${sender}`;
          tags.push(event || 'unknown');
      }

      const result: RawNotificationPayload = {
        title,
        source: 'github',
        content,
        priority,
        tags,
        actions: actions.length > 0 ? actions : undefined,
        metadata: {
          event,
          repository: repo,
          sender,
          github_id: this.get(payload, 'id'),
          timestamp: this.get(payload, 'created_at') || this.get(payload, 'updated_at')
        },
        _original: payload
      };

      return this.success(result, 0.95);
    } catch (error) {
      return this.failure(`GitHub transformation failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private detectEventType(payload: any): string {
    if (payload.commits) return 'push';
    if (payload.pull_request) return 'pull_request';
    if (payload.issue) return 'issues';
    if (payload.release) return 'release';
    if (payload.workflow_run) return 'workflow_run';
    return 'unknown';
  }

  private handlePushEvent(payload: any, repo: string, sender: string): string {
    const ref = this.get(payload, 'ref', '').replace('refs/heads/', '');
    const commits = this.get(payload, 'commits', []);
    const commitCount = commits.length;

    if (commitCount === 1) {
      const commit = commits[0];
      const message = this.get(commit, 'message', '').split('\n')[0];
      return `New commit to ${ref} in ${repo}: ${message}`;
    }

    return `${commitCount} new commits pushed to ${ref} in ${repo} by ${sender}`;
  }

  private getPushContent(payload: any): string {
    const commits = this.get(payload, 'commits', []);
    if (commits.length === 0) return '';

    const commitList = commits
      .slice(0, 5) // Show max 5 commits
      .map((commit: any) => {
        const message = this.get(commit, 'message', '').split('\n')[0];
        const author = this.get(commit, 'author.name', 'Unknown');
        const sha = this.get(commit, 'id', '').slice(0, 7);
        return `• ${sha} ${message} (${author})`;
      })
      .join('\n');

    return commits.length > 5 
      ? `${commitList}\n... and ${commits.length - 5} more commits`
      : commitList;
  }

  private handlePullRequestEvent(payload: any, repo: string, sender: string): string {
    const action = this.get(payload, 'action', 'updated');
    const number = this.get(payload, 'pull_request.number', '');
    const title = this.get(payload, 'pull_request.title', 'Pull Request');

    return `Pull Request #${number} ${action} in ${repo}: ${title}`;
  }

  private getPullRequestContent(payload: any): string {
    const body = this.get(payload, 'pull_request.body', '');
    const additions = this.get(payload, 'pull_request.additions', 0);
    const deletions = this.get(payload, 'pull_request.deletions', 0);
    
    let content = body ? body.slice(0, 500) : '';
    if (body && body.length > 500) content += '...';
    
    if (additions || deletions) {
      content += `\n\nChanges: +${additions} -${deletions}`;
    }

    return content;
  }

  private getPullRequestActions(payload: any): any[] {
    const prUrl = this.get(payload, 'pull_request.html_url');
    if (!prUrl) return [];

    return [
      {
        id: 'view-pr',
        label: 'View Pull Request',
        type: 'url',
        url: prUrl,
        variant: 'primary'
      }
    ];
  }

  private handleIssuesEvent(payload: any, repo: string, sender: string): string {
    const action = this.get(payload, 'action', 'updated');
    const number = this.get(payload, 'issue.number', '');
    const title = this.get(payload, 'issue.title', 'Issue');

    return `Issue #${number} ${action} in ${repo}: ${title}`;
  }

  private getIssuesContent(payload: any): string {
    const body = this.get(payload, 'issue.body', '');
    const labels = this.get(payload, 'issue.labels', []);
    
    let content = body ? body.slice(0, 500) : '';
    if (body && body.length > 500) content += '...';
    
    if (labels.length > 0) {
      const labelNames = labels.map((label: any) => label.name).join(', ');
      content += `\n\nLabels: ${labelNames}`;
    }

    return content;
  }

  private getIssuesActions(payload: any): any[] {
    const issueUrl = this.get(payload, 'issue.html_url');
    if (!issueUrl) return [];

    return [
      {
        id: 'view-issue',
        label: 'View Issue',
        type: 'url',
        url: issueUrl,
        variant: 'primary'
      }
    ];
  }

  private handleReleaseEvent(payload: any, repo: string, sender: string): string {
    const action = this.get(payload, 'action', 'published');
    const tagName = this.get(payload, 'release.tag_name', '');
    const name = this.get(payload, 'release.name', tagName);

    return `Release ${name} ${action} in ${repo}`;
  }

  private getReleaseContent(payload: any): string {
    const body = this.get(payload, 'release.body', '');
    const tarballUrl = this.get(payload, 'release.tarball_url');
    
    let content = body ? body.slice(0, 500) : '';
    if (body && body.length > 500) content += '...';

    return content;
  }

  private getReleaseActions(payload: any): any[] {
    const releaseUrl = this.get(payload, 'release.html_url');
    if (!releaseUrl) return [];

    return [
      {
        id: 'view-release',
        label: 'View Release',
        type: 'url',
        url: releaseUrl,
        variant: 'primary'
      }
    ];
  }

  private handleWorkflowEvent(payload: any, repo: string, sender: string): string {
    const name = this.get(payload, 'workflow_run.name', 'Workflow');
    const status = this.get(payload, 'workflow_run.status', 'unknown');
    const conclusion = this.get(payload, 'workflow_run.conclusion', '');

    if (conclusion) {
      return `Workflow "${name}" ${conclusion} in ${repo}`;
    }
    return `Workflow "${name}" ${status} in ${repo}`;
  }

  private getWorkflowContent(payload: any): string {
    const event = this.get(payload, 'workflow_run.event', '');
    const branch = this.get(payload, 'workflow_run.head_branch', '');
    const sha = this.get(payload, 'workflow_run.head_sha', '').slice(0, 7);

    return `Event: ${event}\nBranch: ${branch}\nCommit: ${sha}`;
  }

  private getWorkflowPriority(payload: any): 1 | 2 | 3 | 4 | 5 {
    const conclusion = this.get(payload, 'workflow_run.conclusion', '');
    
    switch (conclusion) {
      case 'failure':
      case 'cancelled':
        return 1; // High priority for failures
      case 'success':
        return 4; // Low priority for success
      default:
        return 3; // Medium priority for running/queued
    }
  }

  private getWorkflowActions(payload: any): any[] {
    const workflowUrl = this.get(payload, 'workflow_run.html_url');
    if (!workflowUrl) return [];

    return [
      {
        id: 'view-workflow',
        label: 'View Workflow',
        type: 'url',
        url: workflowUrl,
        variant: 'primary'
      }
    ];
  }
}