import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ExternalLink } from 'lucide-react';

export default function GitHubIssues({ issues, onCreate, onToggle, busy }) {
  const [title, setTitle] = useState('');
  const submit = async (event) => {
    event.preventDefault();
    if (!title.trim()) return;
    await onCreate(title.trim());
    setTitle('');
  };
  return (
    <section className="rounded-xl border bg-card p-4 space-y-4">
      <h2 className="font-semibold">Issues</h2>
      <form onSubmit={submit} className="flex gap-2">
        <Input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="New issue title" aria-label="New issue title" />
        <Button type="submit" disabled={busy || !title.trim()}>Create</Button>
      </form>
      <div className="divide-y">
        {issues.length === 0 && <p className="py-6 text-sm text-muted-foreground">No issues found.</p>}
        {issues.map((issue) => (
          <div key={issue.number} className="flex items-center gap-3 py-3">
            <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">#{issue.number} {issue.title}</p><p className="text-xs text-muted-foreground capitalize">{issue.state}</p></div>
            <Button variant="outline" size="sm" disabled={busy} onClick={() => onToggle(issue)}>{issue.state === 'open' ? 'Close' : 'Reopen'}</Button>
            <a href={issue.html_url} target="_blank" rel="noreferrer" aria-label={`Open issue ${issue.number} on GitHub`}><ExternalLink className="h-4 w-4" /></a>
          </div>
        ))}
      </div>
    </section>
  );
}