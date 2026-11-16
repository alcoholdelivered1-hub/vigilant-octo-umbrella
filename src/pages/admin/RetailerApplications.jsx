import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { ShieldCheck, CheckCircle2, MessageSquareWarning, Loader2, MapPin, Mail } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { useAuth } from '@/lib/AuthContext';

const STATUS_LABELS = {
  candidate: 'Candidate',
  details_pending: 'Details Pending',
  owner_authorization_pending: 'Owner Authorization Pending',
  integration_pending: 'Integration Pending',
  test_pending: 'Test Pending',
  ready: 'Ready',
};

function ApplicationRow({ application, onApprove, onRequestChanges }) {
  const [expanded, setExpanded] = useState(false);
  const [note, setNote] = useState(application.notes || '');

  return (
    <div className="bg-card border rounded-xl p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-sm truncate">{application.name}</h3>
            <Badge variant="outline" className="text-xs">
              {STATUS_LABELS[application.status] || application.status}
            </Badge>
          </div>
          <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
            <ShieldCheck className="w-3 h-3 text-emerald-500 shrink-0" />
            <span className="truncate">{application.license_number || 'No license on file'}</span>
          </div>
          {(application.city || application.county) && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
              <MapPin className="w-3 h-3 shrink-0" />
              <span className="truncate">{application.city}{application.city && application.county ? ', ' : ''}{application.county}</span>
            </div>
          )}
          {application.contact_email && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
              <Mail className="w-3 h-3 shrink-0" />
              <span className="truncate">{application.contact_email}</span>
            </div>
          )}
        </div>
        <button
          onClick={() => setExpanded(e => !e)}
          className="text-xs font-medium text-primary hover:underline shrink-0"
        >
          {expanded ? 'Hide' : 'Review'}
        </button>
      </div>

      {expanded && (
        <div className="mt-4 pt-4 border-t space-y-3">
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <p className="text-muted-foreground">Contact</p>
              <p className="font-medium">{application.contact_name || '—'}</p>
            </div>
            <div>
              <p className="text-muted-foreground">POS Provider</p>
              <p className="font-medium">{application.pos_provider || '—'}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Address</p>
              <p className="font-medium">{application.address || '—'}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Submitted</p>
              <p className="font-medium">
                {application.created_date ? format(new Date(application.created_date), 'MMM d, yyyy') : '—'}
              </p>
            </div>
          </div>

          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1">Review note</p>
            <Textarea
              className="text-xs min-h-[60px] resize-none"
              placeholder="Add a note for the retailer..."
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              onClick={() => onApprove(application, note)}
              disabled={application.status === 'ready'}
            >
              <CheckCircle2 className="w-4 h-4" />
              Approve
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => onRequestChanges(application, note)}
              disabled={application.status === 'details_pending' && !note}
            >
              <MessageSquareWarning className="w-4 h-4" />
              Request Changes
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function RetailerApplications() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const { data: applications = [], isLoading, isError, refetch } = useQuery({
    queryKey: ['retailer-onboarding-applications'],
    enabled: user?.role === 'admin',
    queryFn: async () => {
      const records = [];
      let cursor = null;
      do {
        const page = await base44.entities.RetailerOnboarding.filter(
          { status: { $ne: 'ready' } },
          { sort: '-created_date', limit: 100, cursor }
        );
        records.push(...page.items);
        cursor = page.has_more ? page.next_cursor : null;
      } while (cursor);
      return records;
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.RetailerOnboarding.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['retailer-onboarding-applications'] });
    },
  });

  const handleApprove = async (application, note) => {
    try {
      await updateMutation.mutateAsync({
        id: application.id,
        data: {
          status: 'ready',
          notes: note || undefined,
          last_reviewed_by: user?.email,
          last_reviewed_at: new Date().toISOString(),
        },
      });
      toast.success(`${application.name} approved.`);
    } catch (e) {
      toast.error(e?.message || 'Could not approve application.');
    }
  };

  const handleRequestChanges = async (application, note) => {
    if (!note?.trim()) {
      toast.error('Add a note explaining what needs to change.');
      return;
    }
    try {
      await updateMutation.mutateAsync({
        id: application.id,
        data: {
          status: 'details_pending',
          notes: note,
          last_reviewed_by: user?.email,
          last_reviewed_at: new Date().toISOString(),
        },
      });
      toast.success(`Changes requested for ${application.name}.`);
    } catch (e) {
      toast.error(e?.message || 'Could not update application.');
    }
  };

  if (user?.role !== 'admin') {
    return <p className="p-8 text-muted-foreground">Sign in as an administrator to review retailer applications.</p>;
  }

  return (
    <div className="max-w-screen-2xl mx-auto px-4 py-8">
      <header className="mb-6">
        <h1 className="font-display text-3xl font-bold">Retailer Applications</h1>
        <p className="text-muted-foreground mt-1">
          Review pending onboarding applications and approve or request changes.
        </p>
      </header>

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : isError ? (
        <div role="alert" className="text-center py-16">
          <p className="text-destructive mb-3">Could not load applications.</p>
          <Button variant="outline" onClick={() => refetch()}>Try again</Button>
        </div>
      ) : applications.length === 0 ? (
        <div className="border-2 border-dashed border-border rounded-xl py-16 text-center">
          <CheckCircle2 className="w-8 h-8 mx-auto text-emerald-500 mb-2" />
          <p className="text-sm text-muted-foreground">No pending applications. Everything is reviewed.</p>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {applications.map(app => (
            <ApplicationRow
              key={app.id}
              application={app}
              onApprove={handleApprove}
              onRequestChanges={handleRequestChanges}
            />
          ))}
        </div>
      )}
    </div>
  );
}