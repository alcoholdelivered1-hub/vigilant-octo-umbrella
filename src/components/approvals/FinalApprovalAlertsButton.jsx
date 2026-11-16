import React from 'react';
import { Link } from 'react-router-dom';
import { Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import useFinalApprovalQueue from '@/components/approvals/useFinalApprovalQueue';
export default function FinalApprovalAlertsButton() {
  const queue = useFinalApprovalQueue();
  return <Button asChild variant="outline" size="sm" className={queue.unseen.length ? 'retailer-reply-attention' : ''}><Link to="/admin/final-approvals" aria-label={queue.error ? 'Final approvals: updates unavailable' : `${queue.unseen.length} new retailer changes`}><Bell aria-hidden="true" /><span className="hidden sm:inline">Approvals</span><span>{queue.error ? '!' : queue.unseen.length}</span></Link></Button>;
}