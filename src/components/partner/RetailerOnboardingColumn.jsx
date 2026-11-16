import React from 'react';
import { Droppable, Draggable } from '@hello-pangea/dnd';
import { GripVertical } from 'lucide-react';

export default function RetailerOnboardingColumn({ phase, stores, saving }) {
  return (
    <section className="w-60 shrink-0 rounded-xl border bg-muted/40" aria-label={phase.label}>
      <h3 className="flex items-center justify-between gap-2 p-3 text-sm font-semibold">{phase.label}<span className="rounded-full bg-card px-2 py-0.5 text-muted-foreground">{stores.length}</span></h3>
      <Droppable droppableId={phase.id} isDropDisabled={saving || phase.id === 'live'}>
        {(provided, snapshot) => (
          <div ref={provided.innerRef} {...provided.droppableProps} className={`min-h-44 space-y-3 rounded-b-xl p-3 pt-0 ${snapshot.isDraggingOver ? 'bg-primary/10' : ''}`}>
            {stores.map((store, index) => (
              <Draggable key={store.id} draggableId={store.id} index={index} isDragDisabled={saving || phase.id === 'live'}>
                {(dragProvided, dragSnapshot) => (
                  <article ref={dragProvided.innerRef} {...dragProvided.draggableProps} {...dragProvided.dragHandleProps} className={`rounded-lg border bg-card p-3 text-card-foreground shadow-sm ${dragSnapshot.isDragging ? 'ring-2 ring-primary' : ''}`}>
                    <div className="flex items-start gap-2"><GripVertical aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" /><h4 className="break-words text-sm font-semibold">{store.name}</h4></div>
                    <p className="mt-2 text-xs text-muted-foreground">{store.city || 'City not recorded'}</p>
                    {phase.id === 'live' && <p className="mt-2 text-xs text-muted-foreground">Launch-managed status</p>}
                  </article>
                )}
              </Draggable>
            ))}
            {provided.placeholder}
            {!stores.length && <p className="py-5 text-center text-xs text-muted-foreground">{phase.id === 'live' ? 'No live stores' : 'Drop stores here'}</p>}
          </div>
        )}
      </Droppable>
    </section>
  );
}