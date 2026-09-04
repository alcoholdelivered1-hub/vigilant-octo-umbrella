import React from "react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import StatusBadge from "./StatusBadge";

const DOT = {
  pass: "bg-emerald-500",
  warning: "bg-amber-500",
  fail: "bg-red-500",
};

export default function IntegrationCard({ title, status, fields, icon: Icon, children }) {
  return (
    <Card className="p-5 flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          {Icon ? <Icon className="w-4 h-4 text-muted-foreground" /> : null}
          <h3 className="font-semibold text-sm">{title}</h3>
        </div>
        <StatusBadge status={status} />
      </div>
      <div className="space-y-2.5">
        {fields.map((f) => (
          <div key={f.label} className="flex items-start justify-between gap-3 text-sm">
            <span className="text-muted-foreground shrink-0">{f.label}</span>
            <span className="font-medium text-right flex items-center gap-1.5 justify-end">
              <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", DOT[f.state] || "bg-slate-300")} />
              <span className="truncate">{f.value}</span>
            </span>
          </div>
        ))}
      </div>
      {children}
    </Card>
  );
}