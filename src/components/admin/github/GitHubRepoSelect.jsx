import React from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Lock, BookOpen } from 'lucide-react';

export default function GitHubRepoSelect({ repositories, value, onChange, loading }) {
  return (
    <Select value={value} onValueChange={onChange} disabled={loading}>
      <SelectTrigger className="w-full md:w-96">
        <SelectValue placeholder={loading ? 'Loading repositories…' : 'Select a repository'} />
      </SelectTrigger>
      <SelectContent>
        {repositories.map((repo) => (
          <SelectItem key={repo.id} value={repo.full_name}>
            <span className="flex items-center gap-2">
              {repo.private ? <Lock className="h-3.5 w-3.5" /> : <BookOpen className="h-3.5 w-3.5" />}
              {repo.full_name}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}