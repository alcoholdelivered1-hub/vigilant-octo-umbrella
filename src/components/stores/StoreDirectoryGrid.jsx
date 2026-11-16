import React from 'react';
import StoreCard from '@/components/stores/StoreCard';

const beverageKingId = '6a32d14d09b760f592dbf19e';
const woodlandsId = '6abbd1a16dc8d922f3b73caf';

export default function StoreDirectoryGrid({ stores }) {
  const woodlands = stores.find(store => store.id === woodlandsId);
  const showPair = Boolean(woodlands && stores.some(store => store.id === beverageKingId));

  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
      {stores.map(store => {
        if (showPair && store.id === woodlandsId) return null;
        if (showPair && store.id === beverageKingId) {
          return (
            <div key={store.id} className="grid gap-6 sm:col-span-2 sm:grid-cols-2">
              <StoreCard store={store} />
              <StoreCard store={woodlands} />
            </div>
          );
        }
        return <StoreCard key={store.id} store={store} />;
      })}
    </div>
  );
}