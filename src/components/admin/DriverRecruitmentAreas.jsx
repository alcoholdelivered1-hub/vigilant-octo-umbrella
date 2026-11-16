import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

export default function DriverRecruitmentAreas({ stores }) {
  const cities = [...new Set(stores.map(s => s.city.trim().toLowerCase()))].sort();
  const copy = async city => {
    const label = city.replace(/\b\w/g, c => c.toUpperCase());
    const url = `https://alcohol-delivered.biz/driver/signup?city=${encodeURIComponent(label)}`;
    const text = `Alcohol Delivered is recruiting delivery drivers in ${label}, Arkansas. Apply to support local licensed retailers. Applicants must be 21+, have a valid driver's license, an insured reliable vehicle, complete required training, and pass a real verified background check. Deliveries begin only after driver approval and retailer readiness. Apply: ${url}\nQuestions? Contact John Bess at 870-718-1521.`;
    try { await navigator.clipboard.writeText(text); toast.success(`${label} recruitment post copied`); }
    catch { toast.error('Unable to copy. Please allow clipboard access.'); }
  };
  return <section className="space-y-3">
    <h3 className="font-semibold">Recruit drivers by service area</h3>
    <p className="text-sm text-muted-foreground">Ready-to-share posts and application links; no ads or external posts have been published.</p>
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{cities.map(city => <div key={city} className="rounded-xl border p-4 space-y-3 bg-card">
      <h4 className="font-semibold capitalize">{city}</h4>
      <p className="text-sm text-muted-foreground">{stores.filter(s => s.city.trim().toLowerCase() === city).length} live active retailers</p>
      <div className="flex flex-wrap gap-2"><Button size="sm" variant="outline" onClick={() => copy(city)}>Copy recruitment post</Button>
        <Button size="sm" asChild><Link to={`/driver/signup?city=${encodeURIComponent(city.replace(/\b\w/g, c => c.toUpperCase()))}`}>Application link</Link></Button></div>
    </div>)}</div>
  </section>;
}