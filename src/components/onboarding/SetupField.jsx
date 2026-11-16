import React, { useId } from 'react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
export default function SetupField({ field, value, onChange, disabled }) {
  const id = useId();
  if (field.type === 'checkbox') return <label data-setup-field={field.key} htmlFor={id} className="flex min-h-11 items-center gap-3 text-sm"><input id={id} type="checkbox" className="h-5 w-5" checked={!!value} disabled={disabled} onChange={e => onChange(e.target.checked)} />{field.label}</label>;
  const Component = field.type === 'textarea' ? Textarea : Input;
  return <div data-setup-field={field.key} className={field.type === 'textarea' ? 'sm:col-span-2' : ''}><label htmlFor={id} className="mb-1 block text-sm font-medium">{field.label}{field.required ? ' *' : ' (optional)'}</label><Component id={id} type={field.type === 'textarea' ? undefined : field.type} step={field.type === 'number' ? 'any' : undefined} required={field.required} value={value ?? ''} maxLength={field.type === 'textarea' ? 1500 : 250} disabled={disabled} onChange={e => onChange(e.target.value)} className="min-h-11" /></div>;
}