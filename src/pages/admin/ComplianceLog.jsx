import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, ShieldCheck, IdCard, Ban, MapPin, ScanLine, Clock, CheckCircle2, XCircle } from 'lucide-react';
import { format } from 'date-fns';

const TABS = [
  { id: 'id', label: 'ID Verifications', icon: ScanLine },
  { id: 'refusals', label: 'Refusal Logs', icon: Ban },
  { id: 'geo', label: 'Geo-Fence Confirmations', icon: MapPin },
];

const REFUSAL_CONFIG = {
  id_verification_failed: { label: 'ID Verification Failed', color: 'text-red-700', bg: 'bg-red-50' },
  intoxication_refused: { label: 'Intoxication Refused', color: 'text-orange-700', bg: 'bg-orange-50' },
  minor_attempt: { label: 'Possible Minor', color: 'text-purple-700', bg: 'bg-purple-50' },
  other_refusal: { label: 'Delivery Refused', color: 'text-amber-700', bg: 'bg-amber-50' },
};

export default function ComplianceLog() {
  const [tab, setTab] = useState('id');

  const { data: verifications = [], isLoading: idLoading } = useQuery({
    queryKey: ['compliance-id-verifications'],
    queryFn: () => base44.entities.IDVerification.list('-created_date', 200),
  });

  const { data: incidents = [], isLoading: incLoading } = useQuery({
    queryKey: ['compliance-refusal-log'],
    queryFn: () => base44.entities.ComplianceIncident.filter({ incident_type: { $in: ['id_verification_failed', 'intoxication_refused', 'minor_attempt', 'other_refusal'] } }, '-incident_date', 200),
  });

  const { data: orders = [], isLoading: ordLoading } = useQuery({
    queryKey: ['compliance-geo-orders'],
    queryFn: () => base44.entities.Order.filter({ status: { $in: ['in_transit', 'delivered'] } }, '-created_date', 200),
  });

  const stats = {
    idTotal: verifications.length,
    idVerified: verifications.filter(v => v.is_verified).length,
    refusals: incidents.length,
    geoConfirmed: orders.filter(o => o.delivery_confirmed_at).length,
    geoFlagged: orders.filter(o => o.is_in_legal_zone === false).length,
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">
      <div>
        <Link to="/admin" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-3">
          <ArrowLeft className="w-4 h-4" /> Back to Admin
        </Link>
        <h1 className="font-display text-3xl font-bold flex items-center gap-2">
          <ShieldCheck className="w-7 h-7 text-primary" /> Compliance Audit Log
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Complete audit trail of ID verification records, delivery refusals, and geo-fence delivery confirmations.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-card border rounded-2xl p-4">
          <p className="text-2xl font-bold">{stats.idTotal}</p>
          <p className="text-xs text-muted-foreground mt-1">ID Checks</p>
        </div>
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4">
          <p className="text-2xl font-bold text-emerald-700">{stats.idVerified}</p>
          <p className="text-xs text-emerald-700 mt-1">Verified</p>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4">
          <p className="text-2xl font-bold text-red-700">{stats.refusals}</p>
          <p className="text-xs text-red-700 mt-1">Refusals</p>
        </div>
        <div className="bg-card border rounded-2xl p-4">
          <p className="text-2xl font-bold">{stats.geoConfirmed}</p>
          <p className="text-xs text-muted-foreground mt-1">Geo Confirmed</p>
        </div>
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
          <p className="text-2xl font-bold text-amber-700">{stats.geoFlagged}</p>
          <p className="text-xs text-amber-700 mt-1">Out-of-Zone</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b">
        {TABS.map(t => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
                tab === t.id ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              <Icon className="w-4 h-4" /> {t.label}
            </button>
          );
        })}
      </div>

      {/* ID Verifications */}
      {tab === 'id' && (
        idLoading ? (
          <div className="space-y-3">{Array(4).fill(0).map((_, i) => <Skeleton key={i} className="h-24 w-full rounded-2xl" />)}</div>
        ) : verifications.length === 0 ? (
          <div className="text-center py-16 bg-card border rounded-2xl">
            <ScanLine className="w-12 h-12 text-muted-foreground/30 mx-auto" />
            <p className="text-muted-foreground mt-4">No ID verification records</p>
          </div>
        ) : (
          <div className="space-y-3">
            {verifications.map(v => (
              <div key={v.id} className="bg-card border rounded-2xl p-4 flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-medium">{v.customer_name || v.customer_email}</p>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${v.verification_type === 'checkout' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}>
                      {v.verification_type}
                    </span>
                    {v.is_verified ? (
                      <span className="flex items-center gap-1 text-xs text-emerald-600 font-medium"><CheckCircle2 className="w-3.5 h-3.5" /> Verified</span>
                    ) : (
                      <span className="flex items-center gap-1 text-xs text-red-600 font-medium"><XCircle className="w-3.5 h-3.5" /> Not Verified</span>
                    )}
                  </div>
                  <div className="grid sm:grid-cols-2 gap-1 mt-2 text-sm text-muted-foreground">
                    <p className="flex items-center gap-1.5"><IdCard className="w-3.5 h-3.5" /> {v.id_type?.replace(/_/g, ' ') || 'Unknown ID'}</p>
                    {v.date_of_birth && <p>DOB: {format(new Date(v.date_of_birth), 'MMM d, yyyy')}</p>}
                    {v.verified_by && <p>By: {v.verified_by}</p>}
                    {v.order_id && <p className="font-mono text-xs">Order: {v.order_id}</p>}
                    {v.verification_latitude && <p className="text-xs">GPS: {v.verification_latitude?.toFixed(4)}, {v.verification_longitude?.toFixed(4)}</p>}
                  </div>
                  {v.notes && <p className="text-xs text-muted-foreground mt-2 bg-muted/40 rounded p-2">{v.notes}</p>}
                </div>
                <span className="text-xs text-muted-foreground shrink-0">{v.created_date ? format(new Date(v.created_date), 'MMM d, h:mm a') : ''}</span>
              </div>
            ))}
          </div>
        )
      )}

      {/* Refusals */}
      {tab === 'refusals' && (
        incLoading ? (
          <div className="space-y-3">{Array(4).fill(0).map((_, i) => <Skeleton key={i} className="h-24 w-full rounded-2xl" />)}</div>
        ) : incidents.length === 0 ? (
          <div className="text-center py-16 bg-card border rounded-2xl">
            <Ban className="w-12 h-12 text-muted-foreground/30 mx-auto" />
            <p className="text-muted-foreground mt-4">No refusal logs recorded</p>
          </div>
        ) : (
          <div className="space-y-3">
            {incidents.map(inc => {
              const cfg = REFUSAL_CONFIG[inc.incident_type] || REFUSAL_CONFIG.other_refusal;
              return (
                <div key={inc.id} className="bg-card border rounded-2xl p-4">
                  <div className="flex items-center justify-between gap-3 mb-2">
                    <span className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${cfg.bg} ${cfg.color}`}>{cfg.label}</span>
                    <span className="text-xs text-muted-foreground">{inc.incident_date ? format(new Date(inc.incident_date), 'MMM d, h:mm a') : ''}</span>
                  </div>
                  <p className="font-medium text-sm">{inc.reason}</p>
                  <div className="grid sm:grid-cols-2 gap-1 mt-2 text-xs text-muted-foreground">
                    <p>Order: {inc.order_number || inc.order_id}</p>
                    <p>Customer: {inc.customer_name || inc.customer_email}</p>
                    <p>Store: {inc.store_name}</p>
                    <p>Driver: {inc.driver_name || inc.driver_email}</p>
                  </div>
                  {inc.delivery_address && <p className="flex items-center gap-1.5 text-xs text-muted-foreground mt-2"><MapPin className="w-3 h-3" /> {inc.delivery_address}</p>}
                  {inc.is_resolved && <p className="text-xs text-emerald-700 mt-2">✓ Resolved{inc.resolution_notes ? ` — ${inc.resolution_notes}` : ''}</p>}
                </div>
              );
            })}
          </div>
        )
      )}

      {/* Geo-fence confirmations */}
      {tab === 'geo' && (
        ordLoading ? (
          <div className="space-y-3">{Array(4).fill(0).map((_, i) => <Skeleton key={i} className="h-24 w-full rounded-2xl" />)}</div>
        ) : orders.length === 0 ? (
          <div className="text-center py-16 bg-card border rounded-2xl">
            <MapPin className="w-12 h-12 text-muted-foreground/30 mx-auto" />
            <p className="text-muted-foreground mt-4">No delivery confirmations yet</p>
          </div>
        ) : (
          <div className="space-y-3">
            {orders.map(o => (
              <div key={o.id} className="bg-card border rounded-2xl p-4">
                <div className="flex items-center justify-between gap-3 mb-2">
                  <div>
                    <p className="font-medium">{o.order_number || o.id}</p>
                    <p className="text-xs text-muted-foreground">{o.store_name} · {o.customer_name}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {o.is_in_legal_zone === false && (
                      <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-700">Out of Zone</span>
                    )}
                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${o.status === 'delivered' ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'}`}>{o.status.replace(/_/g, ' ')}</span>
                  </div>
                </div>
                <div className="grid sm:grid-cols-2 gap-2 text-xs text-muted-foreground">
                  <p className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" /> Pickup: {o.pickup_confirmed_at ? format(new Date(o.pickup_confirmed_at), 'MMM d, h:mm a') : '—'}</p>
                  <p className="flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5" /> Delivered: {o.delivery_confirmed_at ? format(new Date(o.delivery_confirmed_at), 'MMM d, h:mm a') : '—'}</p>
                  <p className="flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5" /> {o.delivery_address}</p>
                  {o.driver_name && <p>Driver: {o.driver_name}</p>}
                </div>
                {o.delivery_latitude && (
                  <p className="text-xs text-muted-foreground mt-2 font-mono">
                    Drop GPS: {o.delivery_latitude?.toFixed(5)}, {o.delivery_longitude?.toFixed(5)}
                    {o.order_latitude && ` · Placed from: ${o.order_latitude?.toFixed(5)}, ${o.order_longitude?.toFixed(5)}`}
                  </p>
                )}
              </div>
            ))}
          </div>
        )
      )}
    </div>
  );
}