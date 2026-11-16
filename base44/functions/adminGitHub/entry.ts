import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

export default async function(req) {
  try {
    if (req.method !== 'POST') return Response.json({ error: 'Method not allowed' }, { status: 405 });
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

    const { accessToken } = await base44.asServiceRole.connectors.getConnection('github');
    const body = await req.json();
    const headers = {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'Alcohol-Delivered-Admin',
      'Content-Type': 'application/json',
    };
    const github = async (path, options = {}) => {
      const response = await fetch(`https://api.github.com${path}`, { ...options, headers });
      const text = await response.text();
      let data;
      try { data = JSON.parse(text); } catch { data = null; }
      if (!response.ok) throw new Error(data?.message || text.trim() || 'GitHub request failed');
      if (!data) throw new Error('GitHub returned an unreadable response');
      return data;
    };

    if (body.action === 'listRepositories') {
      const repositories = await github('/user/repos?sort=updated&per_page=100&affiliation=owner,collaborator,organization_member');
      return Response.json({ repositories: repositories.map((repo) => ({ id: repo.id, full_name: repo.full_name, private: repo.private, updated_at: repo.updated_at })) });
    }
    if (!body.repository) return Response.json({ error: 'Repository is required' }, { status: 400 });
    if (body.action === 'getRepository') {
      const [issues, pullRequests] = await Promise.all([
        github(`/repos/${body.repository}/issues?state=all&per_page=100&sort=updated`),
        github(`/repos/${body.repository}/pulls?state=all&per_page=100&sort=updated`),
      ]);
      return Response.json({
        issues: issues.filter((issue) => !issue.pull_request).map((issue) => ({ number: issue.number, title: issue.title, state: issue.state, html_url: issue.html_url, updated_at: issue.updated_at })),
        pullRequests: pullRequests.map((pull) => ({ number: pull.number, title: pull.title, state: pull.state, draft: pull.draft, html_url: pull.html_url, updated_at: pull.updated_at })),
      });
    }
    if (body.action === 'createIssue') {
      const issue = await github(`/repos/${body.repository}/issues`, { method: 'POST', body: JSON.stringify({ title: body.title, body: body.description || '' }) });
      return Response.json({ issue: { number: issue.number, title: issue.title, state: issue.state, html_url: issue.html_url, updated_at: issue.updated_at } });
    }
    if (body.action === 'setIssueState') {
      const issue = await github(`/repos/${body.repository}/issues/${body.issueNumber}`, { method: 'PATCH', body: JSON.stringify({ state: body.state }) });
      return Response.json({ issue: { number: issue.number, title: issue.title, state: issue.state, html_url: issue.html_url, updated_at: issue.updated_at } });
    }
    return Response.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    console.error('Admin GitHub error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
}