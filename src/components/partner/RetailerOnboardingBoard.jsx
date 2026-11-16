import React from 'react';
import { DragDropContext } from '@hello-pangea/dnd';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import RetailerOnboardingColumn from '@/components/partner/RetailerOnboardingColumn';
import useRetailerOnboardingBoard from '@/components/partner/useRetailerOnboardingBoard';
import RetailerProgressSummary from '@/components/partner/RetailerProgressSummary';
import RetailerOwnChecklists from '@/components/partner/RetailerOwnChecklists';

const phases = [
  { id: 'pending', label: 'Pending' },
  { id: 'invited', label: 'Invited' },
  { id: 'contract_sent', label: 'Agreement Sent' },
  { id: 'contract_signed', label: 'Agreement Signed' },
  { id: 'inventory_added', label: 'Inventory Added' },
  { id: 'live', label: 'Live' },
];

export default function RetailerOnboardingBoard({ user }) {
  const { query, move } = useRetailerOnboardingBoard(user);
  const stores = query.data || [];
  const onDragEnd = ({ draggableId, destination, source }) => {
    if (!destination || move.isPending || destination.droppableId === source.droppableId || destination.droppableId === 'live' || source.droppableId === 'live') return;
    if (!phases.some(phase => phase.id === destination.droppableId) || !stores.some(store => store.id === draggableId)) return;
    move.mutate({ id: draggableId, status: destination.droppableId });
  };
  if (user?.role !== 'admin') return <RetailerOwnChecklists query={query} user={user} />;
  return (
    <section className="min-w-0 space-y-4" aria-labelledby="retailer-board-heading" aria-busy={move.isPending}>
      {user?.role === 'admin' && !query.isLoading && !query.isError && <RetailerProgressSummary stores={stores} />}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="retailer-board-heading" className="text-lg font-semibold">Retailer Onboarding</h2>
        <span role="status" className="text-sm text-muted-foreground">{move.isPending ? 'Saving phase…' : `${stores.length} stores`}</span>
      </div>
      <p className="text-sm text-muted-foreground">Drag stores between their existing onboarding phases. Live is managed by launch checks, not by dragging. For keyboard moves, focus a card, press Space, use the arrow keys, then press Space to drop.</p>
      {move.isError && <p role="alert" className="text-sm text-destructive">The phase could not be saved; the store was moved back. {move.error?.message}</p>}
      {query.isLoading ? <p className="flex items-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Loading onboarding stores…</p> : query.isError ? <div role="alert"><p className="mb-2 text-destructive">Could not load onboarding stores.</p><Button variant="outline" onClick={() => query.refetch()}>Try again</Button></div> : stores.length === 0 ? <p className="text-sm text-muted-foreground">No stores are linked to this account yet.</p> : (
        <DragDropContext onDragEnd={onDragEnd}>
          <div className="flex gap-4 overflow-x-auto pb-4">
            {phases.map(phase => <RetailerOnboardingColumn key={phase.id} phase={phase} saving={move.isPending} stores={stores.filter(store => (store.onboarding_status || 'invited') === phase.id)} />)}
          </div>
        </DragDropContext>
      )}
    </section>
  );
}