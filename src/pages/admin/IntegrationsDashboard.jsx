import React, { useState, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  RefreshCw, CreditCard, Store, Bell, ShoppingCart, Car, Building2,
  Undo2, ShieldCheck, AlertTriangle, XCircle, CheckCircle2, Activity,
} from "lucide-react";
import IntegrationCard from "@/components/integrations/IntegrationCard";
import StatusBadge from "@/components/integrations/StatusBadge";
import { cn } from "@/lib/utils";

const SECTIONS = [
  { key: "stripe", icon: CreditCard },
  { key: "clover", icon: Store },
  { key: "fcm", icon: Bell },
  { key: "checkout", icon: ShoppingCart },
  { key: "drivers", icon: Car },
  { key: "retailers", icon: Building2 },
  { key: "refunds", icon: Undo2 },
  { key: "security", icon: ShieldCheck },
];

const OVERALL = {
  ready: { emoji: "🟢", title: "READY FOR LIVE ORDERS", cls: "bg-emerald-50 border-emerald-200 text-emerald-800", Icon: CheckCircle2 },
  ready_with_warnings: { emoji: "🟡", title: "READY WITH WARNINGS", cls: "bg-amber-50 border-amber-200 text-amber-800", Icon: AlertTriangle },
  not_ready: { emoji: "🔴", title: "NOT READY", cls: "bg-red-50 border-red-200 text-red-800", Icon: XCircle },
};

export default function IntegrationsDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [seconds, setSeconds] = useState(60);

  const fetchStatus = useCallback(async () => {
    try {
      setError(null);
      const res = await base44.functions.invoke("getIntegrationsStatus", {});
      setData(res.data);
    } catch (e) {
      setError(e?.message || "Failed to load status");
    } finally {
      setLoading(false);
      setSeconds(60);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(() => {
      setSeconds((s) => {
        if (s <= 1) {
          fetchStatus();
          return 60;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [fetchStatus]);

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin" />
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 px-6 text-center">
        <XCircle className="w-10 h-10 text-red-500" />
        <p className="text-sm text-muted-foreground max-w-sm">{error}</p>
        <Button onClick={fetchStatus} size="sm">Retry</Button>
      </div>
    );
  }

  const overall = OVERALL[data?.overall_status] || OVERALL.not_ready;

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-bold flex items-center gap-2">
            <Activity className="w-5 h-5" /> Production Integrations Dashboard
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            Read-only monitoring · refreshes every 60s · last update {data ? new Date(data.generated_at).toLocaleTimeString() : "—"}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground">Next refresh in {seconds}s</span>
          <Button variant="outline" size="sm" onClick={fetchStatus}>
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </Button>
        </div>
      </div>

      {/* Launch Readiness banner */}
      <div className={cn("rounded-xl border p-5 flex items-center gap-4", overall.cls)}>
        <overall.Icon className="w-8 h-8 shrink-0" />
        <div>
          <div className="text-lg font-bold">{overall.emoji} {overall.title}</div>
          <p className="text-sm opacity-80">
            {data?.overall_status === "ready" && "All critical integrations are healthy."}
            {data?.overall_status === "ready_with_warnings" && "Some integrations need attention but orders can flow."}
            {data?.overall_status === "not_ready" && `${data?.blockers?.length || 0} blocker(s) must be resolved before going live.`}
          </p>
        </div>
      </div>

      {/* Blockers */}
      {data?.blockers?.length > 0 && (
        <Card className="p-5">
          <h2 className="font-semibold text-sm mb-3 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-500" /> Blockers & Required Steps
          </h2>
          <div className="space-y-3">
            {data.blockers.map((b, i) => (
              <div key={i} className="flex flex-col sm:flex-row gap-1 sm:gap-3 text-sm border-l-2 border-amber-300 pl-3 py-1">
                <div className="flex-1">
                  <span className="font-medium">{b.section}</span>
                  <span className="text-muted-foreground"> — {b.issue}</span>
                </div>
                <div className="text-xs text-muted-foreground sm:text-right sm:max-w-xs">
                  <span className="font-semibold text-foreground">Fix:</span> {b.steps}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Integration cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {SECTIONS.map(({ key, icon }) => {
          const section = data?.[key];
          if (!section) return null;
          return (
            <IntegrationCard
              key={key}
              title={section.title}
              status={section.status}
              fields={section.fields}
              icon={icon}
            >
              {key === "clover" && section.merchants?.length > 0 && (
                <div className="mt-4 pt-3 border-t space-y-2">
                  {section.merchants.map((m, i) => (
                    <div key={i} className="text-xs bg-muted/40 rounded-lg p-2.5 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold truncate">{m.store_name}</span>
                        <StatusBadge status={m.connection_status === "connected" ? "pass" : m.connection_status === "not_configured" ? "warning" : "fail"} />
                      </div>
                      <div className="text-muted-foreground grid grid-cols-2 gap-x-2 gap-y-0.5">
                        <span>Merchant ID:</span><span className="font-mono truncate">{m.merchant_id}</span>
                        <span>Environment:</span><span>{m.environment}</span>
                        <span>OAuth:</span><span>{m.oauth_configured ? "Yes" : "No"}</span>
                        <span>Inventory read:</span><span>{m.inventory_read ? "Yes" : "No"}</span>
                        <span>Orders access:</span><span>{m.orders_access ? "Yes" : "No"}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </IntegrationCard>
          );
        })}
      </div>

      {error && (
        <p className="text-xs text-amber-600 text-center">Last refresh failed ({error}) — showing previous data.</p>
      )}
    </div>
  );
}