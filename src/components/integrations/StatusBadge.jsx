import React from "react";
import { cn } from "@/lib/utils";

const MAP = {
  pass: { label: "PASS", cls: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  warning: { label: "WARNING", cls: "bg-amber-100 text-amber-700 border-amber-200" },
  fail: { label: "FAIL", cls: "bg-red-100 text-red-700 border-red-200" },
};

export default function StatusBadge({ status }) {
  const m = MAP[status] || MAP.warning;
  return (
    <span className={cn("text-[10px] font-bold tracking-wide px-2 py-0.5 rounded-full border", m.cls)}>
      {m.label}
    </span>
  );
}