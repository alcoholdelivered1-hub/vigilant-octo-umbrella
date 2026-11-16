import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function AuthField({ label, id, ...props }) {
  return <div className="space-y-2"><Label htmlFor={id}>{label}</Label><Input id={id} required className="min-h-11" {...props} /></div>;
}