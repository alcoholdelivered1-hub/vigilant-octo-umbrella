import React from 'react';
import { ExternalLink } from 'lucide-react';

export default function GitHubPullRequests({ pullRequests }) {
  return (
    <section className="rounded-xl border bg-card p-4 space-y-4">
      <h2 className="font-semibold">Pull Requests</h2>
      <div className="divide-y">
        {pullRequests.length === 0 && <p className="py-6 text-sm text-muted-foreground">No pull requests found.</p>}
        {pullRequests.map((pull) => (
          <div key={pull.number} className="flex items-center gap-3 py-3">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">#{pull.number} {pull.title}</p>
              <p className="text-xs text-muted-foreground capitalize">{pull.draft ? 'Draft' : pull.state}</p>
            </div>
            <a href={pull.html_url} target="_blank" rel="noreferrer" aria-label={`Open pull request ${pull.number} on GitHub`}><ExternalLink className="h-4 w-4" /></a>
          </div>
        ))}
      </div>
    </section>
  );
}