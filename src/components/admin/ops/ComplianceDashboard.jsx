import React from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, XCircle, FileText, Users, ShieldAlert, ScrollText } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

function Row({ item, icon: Icon }) {
  return (
    <div className="flex items-start gap-3 py-3 border-b last:border-0">
      {item.ok ? <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" /> : <XCircle className="h-5 w-5 text-red-500 shrink-0" />}
      <div>
        <div className="flex items-center gap-2 text-sm font-medium"><Icon className="h-4 w-4 text-muted-foreground" /> {item.label || ''}</div>
        <div className={cn('text-xs', item.ok ? 'text-emerald-600' : 'text-red-600')}>{item.detail}</div>
      </div>
    </div>
  );
}

export default function ComplianceDashboard({ compliance }) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2 text-base"><ShieldAlert className="h-4 w-4" /> Arkansas ABC Compliance</CardTitle></CardHeader>
        <CardContent>
          <Row icon={ShieldAlert} item={{ ok: compliance.abc.ok, detail: compliance.abc.detail }} />
          <Row icon={FileText} item={{ ok: compliance.permits.ok, label: 'Retail Permits', detail: compliance.permits.detail }} />
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Users className="h-4 w-4" /> Driver Requirements</CardTitle></CardHeader>
        <CardContent>
          <Row icon={Users} item={{ ok: compliance.driver_requirements.ok, detail: compliance.driver_requirements.detail }} />
          <Row icon={FileText} item={{ ok: compliance.age_verification.ok, label: 'Age Verification', detail: compliance.age_verification.detail }} />
        </CardContent>
      </Card>
      <Card className="md:col-span-2">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base"><ScrollText className="h-4 w-4" /> Audit Logs</CardTitle>
          <Link to="/admin/compliance-incidents" className="text-xs text-primary hover:underline">View incidents →</Link>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">{compliance.audit.detail}</p>
        </CardContent>
      </Card>
    </div>
  );
}