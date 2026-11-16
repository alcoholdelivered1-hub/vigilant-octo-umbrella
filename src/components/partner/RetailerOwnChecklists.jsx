import React from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import StoreOnboardingReadiness from '@/components/admin/StoreOnboardingReadiness';

export default function RetailerOwnChecklists({ query, user }) {
  return (
    <section className="space-y-4" aria-label="Your store onboarding checklists">
      <h2 className="text-lg font-semibold">Your onboarding checklist and progress</h2>
      <p className="text-sm text-muted-foreground">Only stores linked to your account are shown.</p>
      {query.isLoading ? <p role="status" className="flex items-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Loading your stores…</p> : query.isError ? <div role="alert" className="space-y-2"><p className="text-destructive">Could not load your stores.</p><Button variant="outline" onClick={() => query.refetch()}>Try again</Button></div> : !query.data?.length ? <p className="text-sm text-muted-foreground">No stores are linked to your account yet. Contact the administrator to get access.</p> : (
        <div className="grid gap-4 lg:grid-cols-2 items-start">{query.data.map(store => <StoreOnboardingReadiness key={store.id} storeId={store.id} name={store.name} viewerId={user?.id} />)}</div>
      )}
    </section>
  );
}