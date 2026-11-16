import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { CheckCircle2, Circle, ShieldCheck, BookOpen, AlertTriangle, ClipboardList, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { format } from 'date-fns';

const CHECKLIST_ITEMS = [
  {
    id: 'training_complete',
    category: 'Training & Certification',
    icon: BookOpen,
    color: 'text-blue-600',
    bg: 'bg-blue-50',
    border: 'border-blue-200',
    label: 'Alcohol safety training completed',
    description: 'I have current annual certification from an ABC-approved training program and carry training proof plus my completed ABC Third-party Delivery Server Awareness form.',
    required: true,
  },
  {
    id: 'license_valid',
    category: 'Training & Certification',
    icon: ShieldCheck,
    color: 'text-blue-600',
    bg: 'bg-blue-50',
    border: 'border-blue-200',
    label: "Valid driver's license in possession",
    description: "My driver's license is valid, unexpired, and in my possession.",
    required: true,
  },
  {
    id: 'age_verify_protocol',
    category: 'Age Verification',
    icon: ShieldCheck,
    color: 'text-emerald-600',
    bg: 'bg-emerald-50',
    border: 'border-emerald-200',
    label: "I will verify every customer's ID (21+)",
    description: 'I confirm I will check a valid government-issued photo ID at every delivery, even if the customer appears older.',
    required: true,
  },
  {
    id: 'refuse_protocol',
    category: 'Age Verification',
    icon: AlertTriangle,
    color: 'text-emerald-600',
    bg: 'bg-emerald-50',
    border: 'border-emerald-200',
    label: 'I will refuse delivery if ID is invalid or customer is visibly intoxicated',
    description: 'I will refuse and document any delivery where ID cannot be verified or the customer appears intoxicated.',
    required: true,
  },
  {
    id: 'no_unattended',
    category: 'Age Verification',
    icon: AlertTriangle,
    color: 'text-emerald-600',
    bg: 'bg-emerald-50',
    border: 'border-emerald-200',
    label: 'No unattended deliveries — only deliver to the ordering person',
    description: 'I will not leave alcohol unattended at a door or hand it to anyone other than the customer who placed the order.',
    required: true,
  },
  {
    id: 'vehicle_check',
    category: 'Safety & Vehicle',
    icon: ShieldCheck,
    color: 'text-amber-600',
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    label: 'Vehicle is in safe operating condition',
    description: 'My vehicle is roadworthy (lights, brakes, tires, insurance all in order).',
    required: true,
  },
  {
    id: 'phone_charged',
    category: 'Safety & Vehicle',
    icon: ShieldCheck,
    color: 'text-amber-600',
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    label: 'Phone charged and app notifications enabled',
    description: 'My phone has sufficient charge and I will receive delivery alerts throughout my shift.',
    required: false,
  },
  {
    id: 'legal_zone',
    category: 'Legal Compliance',
    icon: BookOpen,
    color: 'text-purple-600',
    bg: 'bg-purple-50',
    border: 'border-purple-200',
    label: 'I will only deliver within approved wet county zones',
    description: 'I will verify the address against the official ABC wet/dry map and deliver only in eligible wet territory in the retailer county or an adjoining county, within our service area.',
    required: true,
  },
  {
    id: 'act157',
    category: 'Legal Compliance',
    icon: BookOpen,
    color: 'text-purple-600',
    bg: 'bg-purple-50',
    border: 'border-purple-200',
    label: 'I understand and will follow Arkansas ACT 157 delivery rules',
    description: 'I am aware of and will comply with all ACT 157 regulations governing third-party alcohol delivery in Arkansas.',
    required: true,
  },
];

const CATEGORIES = [...new Set(CHECKLIST_ITEMS.map(i => i.category))];

export default function ShiftChecklist({ userEmail, onComplete }) {
  const [checked, setChecked] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submittedAt, setSubmittedAt] = useState(null);

  const requiredItems = CHECKLIST_ITEMS.filter(i => i.required);
  const allRequiredChecked = requiredItems.every(i => checked[i.id]);
  const totalChecked = Object.values(checked).filter(Boolean).length;
  const progress = Math.round((totalChecked / CHECKLIST_ITEMS.length) * 100);

  const toggle = (id) => {
    setChecked(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const handleSubmit = async () => {
    if (!allRequiredChecked) {
      toast.error('Please complete all required items before starting your shift.');
      return;
    }
    setSubmitting(true);
    try {
      // Store the checklist completion as a driver entity note
      const drivers = await base44.entities.Driver.filter({ email: userEmail }, 'name', 1);
      if (drivers.length > 0) {
        const now = new Date().toISOString();
        await base44.entities.Driver.update(drivers[0].id, {
          description: `Shift checklist completed: ${format(new Date(), 'PPpp')} | Training: ✓ | Age verification: ✓ | Legal compliance: ✓`,
        });
      }
      const ts = new Date();
      setSubmittedAt(ts);
      setSubmitted(true);
      toast.success('Shift checklist recorded. Driver credentials and order eligibility must still pass.');
      if (onComplete) onComplete();
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="bg-emerald-50 border-2 border-emerald-300 rounded-2xl p-8 text-center space-y-4">
        <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto">
          <CheckCircle2 className="w-9 h-9 text-emerald-600" />
        </div>
        <div>
          <h2 className="font-display text-xl font-bold text-emerald-800">Shift Checklist Complete</h2>
          <p className="text-emerald-700 text-sm mt-1">Submitted at {submittedAt ? format(submittedAt, 'h:mm a, MMMM d') : ''}</p>
        </div>
        <p className="text-sm text-emerald-700">Your acknowledgments are recorded. This checklist does not grant ABC approval or replace verified credentials, annual certification, or legal delivery-area checks.</p>
        <Button onClick={() => { setSubmitted(false); setChecked({}); }} variant="outline" size="sm">
          Reset for Next Shift
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="bg-card border rounded-2xl p-5">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <ClipboardList className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h2 className="font-display text-lg font-bold">Pre-Shift Compliance Checklist</h2>
            <p className="text-xs text-muted-foreground">Required before starting each delivery shift</p>
          </div>
        </div>

        {/* Progress */}
        <div className="space-y-1">
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">{totalChecked} of {CHECKLIST_ITEMS.length} items</span>
            <span className="font-semibold text-primary">{progress}%</span>
          </div>
          <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-300 bg-primary"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </div>

      {/* Items grouped by category */}
      {CATEGORIES.map(category => {
        const items = CHECKLIST_ITEMS.filter(i => i.category === category);
        const Icon = items[0].icon;
        return (
          <div key={category} className="bg-card border rounded-2xl overflow-hidden">
            <div className={`px-4 py-3 border-b flex items-center gap-2 ${items[0].bg} ${items[0].border} border-b`}>
              <Icon className={`w-4 h-4 ${items[0].color}`} />
              <h3 className={`text-sm font-semibold ${items[0].color}`}>{category}</h3>
            </div>
            <div className="divide-y">
              {items.map(item => {
                const isChecked = !!checked[item.id];
                return (
                  <button
                    key={item.id}
                    onClick={() => toggle(item.id)}
                    className={`w-full text-left px-4 py-4 flex items-start gap-3 transition-colors ${isChecked ? 'bg-emerald-50/60' : 'hover:bg-muted/30'}`}
                  >
                    <div className="mt-0.5 flex-shrink-0">
                      {isChecked
                        ? <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                        : <Circle className="w-5 h-5 text-muted-foreground" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className={`text-sm font-medium ${isChecked ? 'text-emerald-800 line-through decoration-emerald-400' : ''}`}>
                          {item.label}
                        </p>
                        {item.required && (
                          <span className="text-xs bg-red-100 text-red-600 px-1.5 py-0.5 rounded font-medium">Required</span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">{item.description}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}

      {/* Missing required items warning */}
      {!allRequiredChecked && totalChecked > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-start gap-2 text-sm text-amber-800">
          <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>
            {requiredItems.filter(i => !checked[i.id]).length} required item(s) still unchecked. You must complete all required items to begin your shift.
          </span>
        </div>
      )}

      {/* Submit */}
      <Button
        onClick={handleSubmit}
        disabled={!allRequiredChecked || submitting}
        className="w-full h-12 text-base rounded-xl"
      >
        {submitting
          ? <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Submitting…</>
          : <><CheckCircle2 className="w-4 h-4 mr-2" /> Submit & Start Shift</>}
      </Button>

      <p className="text-xs text-center text-muted-foreground">
        By submitting, you confirm all items above are true and you will comply with Arkansas ABC regulations throughout your shift.
      </p>
    </div>
  );
}