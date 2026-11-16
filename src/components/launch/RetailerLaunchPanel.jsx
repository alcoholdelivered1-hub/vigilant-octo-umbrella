import React from 'react';
import { Link } from 'react-router-dom';
import FirstRetailerLaunchChecklist from '@/components/admin/FirstRetailerLaunchChecklist';
import StoreOnboardingReadiness from '@/components/admin/StoreOnboardingReadiness';
import AdminLaunchReview from '@/components/launch/AdminLaunchReview';
export default function RetailerLaunchPanel({ stores, store, refreshVersion }) {
  return <section className="space-y-6">
    {store && <AdminLaunchReview key={store.id} store={store} refreshVersion={refreshVersion} />}
    <FirstRetailerLaunchChecklist stores={stores} refreshVersion={refreshVersion} />
    <details className="rounded-xl border bg-card p-5"><summary className="cursor-pointer font-semibold">View all {stores.length} retailer checklists</summary><div className="grid lg:grid-cols-2 gap-6 items-start mt-5">{stores.map(s => <StoreOnboardingReadiness key={s.id} storeId={s.id} name={s.name} refreshVersion={refreshVersion} />)}</div></details>
    <section className="rounded-xl border bg-card p-5 space-y-3"><h2 className="font-semibold">Review submissions and corrections</h2><p className="text-sm text-muted-foreground">Each retailer keeps separate business details, private evidence, agreements and launch approval. Resolve its blockers before activation.</p><div className="grid gap-2 sm:grid-cols-2">{stores.map(s => <Link key={s.id} className="rounded-md border p-3 text-sm text-primary underline" to={`/onboarding?store_id=${encodeURIComponent(s.id)}`}>Review {s.name}</Link>)}</div></section>
  </section>;
}