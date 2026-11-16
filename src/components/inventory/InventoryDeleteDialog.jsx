import React from 'react';
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogAction, AlertDialogCancel } from '@/components/ui/alert-dialog';

export default function InventoryDeleteDialog({ product, busy, error, onConfirm, onClose }) {
  return <AlertDialog open onOpenChange={open => { if (!open && !busy) onClose(); }}>
    <AlertDialogContent className="w-[calc(100%_-_2rem)] rounded-xl">
      <AlertDialogHeader><AlertDialogTitle>Remove product?</AlertDialogTitle><AlertDialogDescription>Remove {product.name} from this store’s app inventory? This cannot be undone and does not change past orders.</AlertDialogDescription></AlertDialogHeader>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <AlertDialogFooter><AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel><AlertDialogAction disabled={busy} className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={event => { event.preventDefault(); onConfirm(); }}>{busy ? 'Removing…' : 'Remove product'}</AlertDialogAction></AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>;
}