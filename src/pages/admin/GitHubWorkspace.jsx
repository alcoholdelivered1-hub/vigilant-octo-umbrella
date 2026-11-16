import React, { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Github, Loader2, RefreshCw } from 'lucide-react';
import GitHubRepoSelect from '@/components/admin/github/GitHubRepoSelect';
import GitHubIssues from '@/components/admin/github/GitHubIssues';
import GitHubPullRequests from '@/components/admin/github/GitHubPullRequests';

export default function GitHubWorkspace() {
  const [repositories, setRepositories] = useState([]);
  const [repository, setRepository] = useState('');
  const [issues, setIssues] = useState([]);
  const [pullRequests, setPullRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const invoke = async (payload) => (await base44.functions.invoke('adminGitHub', payload)).data;
  const loadRepository = async (name) => {
    setBusy(true); setError('');
    try { const data = await invoke({ action: 'getRepository', repository: name }); setIssues(data.issues); setPullRequests(data.pullRequests); }
    catch (err) { setError(err.response?.data?.error || err.message); }
    finally { setBusy(false); }
  };
  useEffect(() => {
    invoke({ action: 'listRepositories' }).then((data) => setRepositories(data.repositories)).catch((err) => setError(err.response?.data?.error || err.message)).finally(() => setLoading(false));
  }, []);
  const selectRepository = (name) => { setRepository(name); loadRepository(name); };
  const createIssue = async (title) => { setBusy(true); try { const data = await invoke({ action: 'createIssue', repository, title }); setIssues((current) => [data.issue, ...current]); } finally { setBusy(false); } };
  const toggleIssue = async (issue) => { setBusy(true); try { const data = await invoke({ action: 'setIssueState', repository, issueNumber: issue.number, state: issue.state === 'open' ? 'closed' : 'open' }); setIssues((current) => current.map((item) => item.number === issue.number ? data.issue : item)); } finally { setBusy(false); } };

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-8 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4"><div><h1 className="font-display text-2xl font-bold flex items-center gap-2"><Github className="h-6 w-6" /> GitHub Workspace</h1><p className="text-sm text-muted-foreground mt-1">Admin-only repository, issue, and pull request management.</p></div>{repository && <Button variant="outline" onClick={() => loadRepository(repository)} disabled={busy}><RefreshCw className="h-4 w-4" /> Refresh</Button>}</div>
      <GitHubRepoSelect repositories={repositories} value={repository} onChange={selectRepository} loading={loading} />
      {error && <p className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
      {(loading || busy) && <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Syncing GitHub…</div>}
      {repository && <div className="grid gap-6 lg:grid-cols-2"><GitHubIssues issues={issues} onCreate={createIssue} onToggle={toggleIssue} busy={busy} /><GitHubPullRequests pullRequests={pullRequests} /></div>}
    </div>
  );
}