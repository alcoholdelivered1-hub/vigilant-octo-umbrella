import React from 'react';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { navigationActive } from './workspaceNavigation';

// One workspace destination, rendered the same way in the website header,
// the mobile menu panels and the admin tools list.
export default function WorkspaceLink({ link, pathname, onNavigate, compact = false }) {
  const active = navigationActive(pathname, link);
  const className = compact
    ? cn('flex min-h-11 items-center gap-2 rounded-lg px-3 py-2 text-sm', active ? 'bg-muted font-semibold text-foreground' : 'text-muted-foreground hover:bg-muted')
    : cn('flex min-h-11 items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium', active ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted');

  if (link.external) {
    return <a href={link.href} target="_blank" rel="noopener noreferrer" onClick={onNavigate} className={className}><link.icon className="h-4 w-4 shrink-0" />{link.label}</a>;
  }

  return (
    <Link to={link.to || link.path} onClick={onNavigate} aria-current={active ? 'page' : undefined} className={className}>
      <link.icon className="h-4 w-4 shrink-0" />{link.label}
    </Link>
  );
}