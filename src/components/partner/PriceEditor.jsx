import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Loader2, Check, X, Edit2 } from 'lucide-react';

export default function PriceEditor({ product, storeId }) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState('');

  const mutation = useMutation({
    mutationFn: (price) => base44.entities.Product.update(product.id, { price: Number(price) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['store-products', storeId] });
      setEditing(false);
    },
  });

  const start = () => {
    setVal((product.price ?? 0).toFixed(2));
    setEditing(true);
  };

  if (editing) {
    return (
      <div className="flex items-center gap-1 justify-center">
        <div className="relative">
          <span className="absolute left-1.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">$</span>
          <input
            type="number"
            min="0"
            step="0.01"
            value={val}
            onChange={e => setVal(e.target.value)}
            className="w-20 border rounded-lg pl-4 pr-1 py-1 text-sm text-center focus:outline-none focus:ring-1 focus:ring-primary"
            autoFocus
            onKeyDown={e => {
              if (e.key === 'Enter' && val !== '') mutation.mutate(val);
              if (e.key === 'Escape') setEditing(false);
            }}
          />
        </div>
        <button
          onClick={() => val !== '' && mutation.mutate(val)}
          disabled={mutation.isPending || val === ''}
          className="p-1 rounded text-emerald-600 hover:bg-emerald-50"
        >
          {mutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
        </button>
        <button onClick={() => setEditing(false)} className="p-1 rounded text-red-400 hover:bg-red-50">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={start}
      className="flex items-center gap-1 text-sm font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-2.5 py-1 rounded-lg transition-colors group"
    >
      ${(product.price || 0).toFixed(2)}
      <Edit2 className="w-3 h-3 opacity-0 group-hover:opacity-60 transition-opacity" />
    </button>
  );
}