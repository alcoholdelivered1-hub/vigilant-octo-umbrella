import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import TrainingModule from '@/components/driver/TrainingModule';
import {
  User, Upload, Car, BookOpen, CheckCircle2, ArrowLeft, ArrowRight,
  Loader2, ShieldCheck, FileText
} from 'lucide-react';
import { toast } from 'sonner';

const STEPS = [
  { n: 1, label: 'Personal Info', icon: User },
  { n: 2, label: 'Documents', icon: FileText },
  { n: 3, label: 'Vehicle', icon: Car },
  { n: 4, label: 'ABC Training', icon: BookOpen },
  { n: 5, label: 'Review', icon: ShieldCheck },
];

function ProgressBar({ step }) {
  return (
    <div className="flex items-center gap-0 w-full mb-8">
      {STEPS.map((s, i) => {
        const Icon = s.icon;
        const done = s.n < step;
        const active = s.n === step;
        return (
          <React.Fragment key={s.n}>
            {i > 0 && <div className={`flex-1 h-0.5 ${done ? 'bg-primary' : 'bg-muted'}`} />}
            <div className="flex flex-col items-center flex-shrink-0">
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center border-2 transition-all ${
                done ? 'bg-primary border-primary' : active ? 'border-primary bg-primary/10' : 'border-border bg-muted'
              }`}>
                {done ? <CheckCircle2 className="w-4 h-4 text-white" /> : <Icon className={`w-4 h-4 ${active ? 'text-primary' : 'text-muted-foreground'}`} />}
              </div>
              <p className={`text-[9px] mt-1 text-center hidden sm:block ${active ? 'text-primary font-semibold' : done ? 'text-primary' : 'text-muted-foreground'}`}>{s.label}</p>
            </div>
          </React.Fragment>
        );
      })}
    </div>
  );
}

function FileUploadField({ label, hint, value, onChange, accept = 'image/*,application/pdf' }) {
  const [fileName, setFileName] = useState('');
  const [uploading, setUploading] = useState(false);

  const handleFile = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    setFileName(file.name);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    onChange(file_url);
    setUploading(false);
    toast.success(`${label} uploaded!`);
  };

  const inputId = label.replace(/\s+/g, '-').toLowerCase();

  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <div
        className={`border-2 border-dashed rounded-xl p-5 text-center cursor-pointer transition-colors ${
          value ? 'border-emerald-400 bg-emerald-50' : 'border-border hover:border-primary/40 hover:bg-muted/30'
        }`}
        onClick={() => document.getElementById(inputId).click()}
      >
        {uploading ? (
          <Loader2 className="w-6 h-6 animate-spin text-primary mx-auto mb-1" />
        ) : value ? (
          <CheckCircle2 className="w-6 h-6 text-emerald-500 mx-auto mb-1" />
        ) : (
          <Upload className="w-6 h-6 text-muted-foreground mx-auto mb-1" />
        )}
        <p className={`text-sm font-medium ${value ? 'text-emerald-700' : 'text-muted-foreground'}`}>
          {value ? (fileName || 'File uploaded ✓') : `Click to upload ${label}`}
        </p>
        {hint && !value && <p className="text-xs text-muted-foreground mt-0.5">{hint}</p>}
      </div>
      <input id={inputId} type="file" accept={accept} className="hidden" onChange={handleFile} />
    </div>
  );
}

export default function DriverSignup() {
  const navigate = useNavigate();
  const { user, isAuthenticated, isLoadingAuth } = useAuth();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [trainingComplete, setTrainingComplete] = useState(false);
  const [checkingExisting, setCheckingExisting] = useState(
    localStorage.getItem('driver_signup_complete') !== 'true'
  );

  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    date_of_birth: '',
    license_number: '',
    license_image_url: '',
    insurance_url: '',
    vehicle_info: '',
    vehicle_year: '',
    vehicle_make: '',
    vehicle_model: '',
    vehicle_color: '',
    vehicle_plate: '',
  });

  // Pre-fill from the authenticated user and redirect existing drivers
  // to the portal so they never see the signup form again.
  useEffect(() => {
    // localStorage says signup is done — redirect immediately
    if (localStorage.getItem('driver_signup_complete') === 'true') {
      navigate('/driver', { replace: true });
      return;
    }
    if (isLoadingAuth) return;
    if (!isAuthenticated || !user) {
      setCheckingExisting(false);
      return;
    }
    // Pre-fill name + email from the auth account so they always match
    setForm(prev => ({
      ...prev,
      name: prev.name || user.full_name || '',
      email: prev.email || user.email || '',
    }));
    // If a Driver record already exists for this email, go straight to the portal
    base44.entities.Driver.filter({ email: user.email })
      .then((drivers) => {
        if (drivers.length > 0) {
          navigate('/driver', { replace: true });
        } else {
          setCheckingExisting(false);
        }
      })
      .catch(() => setCheckingExisting(false));
  }, [isAuthenticated, user, isLoadingAuth, navigate]);

  const update = (field, val) => setForm(prev => ({ ...prev, [field]: val }));

  if (checkingExisting) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
      </div>
    );
  }

  const calcAge = (dob) => {
    const birth = new Date(dob);
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
    return age;
  };

  const validate = () => {
    if (step === 1) {
      if (!form.name || !form.email || !form.phone || !form.date_of_birth) { toast.error('Please fill in all fields'); return false; }
      if (!/\S+@\S+\.\S+/.test(form.email)) { toast.error('Invalid email address'); return false; }
      if (calcAge(form.date_of_birth) < 21) { toast.error('You must be 21+ to be a delivery driver'); return false; }
    }
    if (step === 2) {
      if (!form.license_number) { toast.error('Please enter your license number'); return false; }
      if (!form.license_image_url) { toast.error('Please upload your driver\'s license'); return false; }
      if (!form.insurance_url) { toast.error('Please upload proof of insurance'); return false; }
    }
    if (step === 3) {
      if (!form.vehicle_make || !form.vehicle_model || !form.vehicle_year || !form.vehicle_plate) {
        toast.error('Please fill in all vehicle details'); return false;
      }
    }
    if (step === 4) {
      if (!trainingComplete) { toast.error('Please complete the ABC training module'); return false; }
    }
    return true;
  };

  const next = () => { if (validate()) setStep(s => s + 1); };
  const back = () => setStep(s => s - 1);

  const submit = async () => {
    setLoading(true);
    // Guard against duplicates: if a Driver record already exists for this
    // email, go to the portal instead of creating another record.
    try {
      const existing = await base44.entities.Driver.filter({ email: form.email });
      if (existing.length > 0) {
        setLoading(false);
        toast.success('You already have a driver account! Taking you to the portal...');
        navigate('/driver');
        return;
      }
    } catch {
      // non-fatal — proceed to create
    }
    const vehicleInfo = `${form.vehicle_year} ${form.vehicle_make} ${form.vehicle_model} — ${form.vehicle_color} — Plate: ${form.vehicle_plate}`;
    await base44.entities.Driver.create({
      name: form.name,
      email: form.email,
      phone: form.phone,
      date_of_birth: form.date_of_birth,
      license_number: form.license_number,
      vehicle_info: vehicleInfo,
      training_completed: true,
      training_completed_date: new Date().toISOString().split('T')[0],
      status: 'offline',
      is_active: false, // pending admin approval
      total_deliveries: 0,
    });
    setLoading(false);
    localStorage.setItem('driver_signup_complete', 'true');
    toast.success('Application submitted! Taking you to the Driver Portal...');
    // Go directly to the portal — the availability toggle is there
    navigate('/driver');
  };

  // Success screen
  if (step === 6) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-primary/5 via-background to-secondary/5">
        <div className="max-w-md w-full text-center space-y-5">
          <div className="w-20 h-20 rounded-2xl bg-emerald-100 flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-10 h-10 text-emerald-600" />
          </div>
          <h1 className="font-display text-2xl font-bold">Application Submitted!</h1>
          <p className="text-muted-foreground leading-relaxed">
            Thank you, <strong>{form.name}</strong>! Your driver application has been received. Our team will review your documents and activate your account within 1–2 business days.
          </p>
          <div className="bg-card border rounded-2xl p-5 text-left space-y-2 text-sm">
            <p className="font-semibold">What happens next?</p>
            {['Admin reviews your documents and training results', 'You\'ll receive an email when your account is activated', 'Download the app and log in to start accepting deliveries'].map((item, i) => (
              <div key={i} className="flex items-start gap-2 text-muted-foreground">
                <span className="w-5 h-5 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">{i + 1}</span>
                <span>{item}</span>
              </div>
            ))}
          </div>
          <Link to="/driver"><Button variant="outline" className="w-full rounded-xl">Go to Driver Portal</Button></Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-secondary/5 py-10 px-4">
      <div className="max-w-lg mx-auto">
        {/* Header */}
        <div className="text-center mb-6">
          <Link to="/driver" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-4">
            <ArrowLeft className="w-4 h-4" /> Back to Driver Portal
          </Link>
          <h1 className="font-display text-3xl font-bold">Become a Driver</h1>
          <p className="text-muted-foreground mt-1">Apply to deliver for Alcohol Delivered — Serving All of Central Arkansas</p>
          <div className="mt-4 grid grid-cols-2 gap-2 text-left">
            {[
              { icon: '💰', title: 'Keep 100% of Tips', desc: 'Every tip is yours' },
              { icon: '🛣️', title: '$1/Mile Bonus', desc: 'On deliveries over 7 miles' },
              { icon: '📅', title: 'Set Your Own Hours', desc: 'Drive whenever you want' },
              { icon: '🎓', title: 'Free ABC Certification', desc: 'Career-building credential' },
              { icon: '⚡', title: 'Priority Dispatch', desc: 'Top-rated drivers get first picks' },
              { icon: '💸', title: 'Weekly Payouts', desc: 'Fast Stripe transfers' },
            ].map((perk) => (
              <div key={perk.title} className="bg-card border rounded-lg p-2.5 flex items-start gap-2">
                <span className="text-lg leading-none">{perk.icon}</span>
                <div>
                  <p className="text-xs font-bold">{perk.title}</p>
                  <p className="text-[10px] text-muted-foreground leading-tight">{perk.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <ProgressBar step={step} />

        <div className="bg-card rounded-2xl border shadow-sm p-6 space-y-5">

          {/* Step 1: Personal Info */}
          {step === 1 && (
            <>
              <div className="text-center mb-1">
                <h2 className="font-display text-xl font-bold">Personal Information</h2>
                <p className="text-sm text-muted-foreground mt-0.5">Must be 21+ to qualify</p>
              </div>
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label>Full Name *</Label>
                  <Input value={form.name} onChange={e => update('name', e.target.value)} placeholder="Jane Smith" />
                </div>
                <div className="space-y-1.5">
                  <Label>Email Address *</Label>
                  <Input
                    type="email"
                    value={form.email}
                    onChange={e => update('email', e.target.value)}
                    placeholder="jane@example.com"
                    readOnly={!!user?.email}
                    disabled={!!user?.email}
                  />
                  {user?.email && (
                    <p className="text-xs text-muted-foreground">Locked to your account email</p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label>Phone Number *</Label>
                  <Input type="tel" value={form.phone} onChange={e => update('phone', e.target.value)} placeholder="(870) 555-0123" />
                </div>
                <div className="space-y-1.5">
                  <Label>Date of Birth * <span className="text-muted-foreground text-xs">(Must be 21+)</span></Label>
                  <Input type="date" value={form.date_of_birth} onChange={e => update('date_of_birth', e.target.value)} max={new Date().toISOString().split('T')[0]} />
                  {form.date_of_birth && calcAge(form.date_of_birth) >= 21 && (
                    <p className="text-xs text-emerald-600 flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> Age verified</p>
                  )}
                  {form.date_of_birth && calcAge(form.date_of_birth) < 21 && (
                    <p className="text-xs text-destructive">You must be 21 or older.</p>
                  )}
                </div>
              </div>
            </>
          )}

          {/* Step 2: Documents */}
          {step === 2 && (
            <>
              <div className="text-center mb-1">
                <h2 className="font-display text-xl font-bold">Upload Documents</h2>
                <p className="text-sm text-muted-foreground mt-0.5">Required for Arkansas ABC compliance</p>
              </div>
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label>Driver's License Number *</Label>
                  <Input value={form.license_number} onChange={e => update('license_number', e.target.value)} placeholder="AR-12345678" />
                </div>
                <FileUploadField
                  label="Driver's License (front)"
                  hint="Upload a clear photo of the front of your license"
                  value={form.license_image_url}
                  onChange={url => update('license_image_url', url)}
                />
                <FileUploadField
                  label="Proof of Insurance"
                  hint="Current auto insurance card or declaration page"
                  value={form.insurance_url}
                  onChange={url => update('insurance_url', url)}
                />
              </div>
            </>
          )}

          {/* Step 3: Vehicle */}
          {step === 3 && (
            <>
              <div className="text-center mb-1">
                <h2 className="font-display text-xl font-bold">Vehicle Information</h2>
                <p className="text-sm text-muted-foreground mt-0.5">The vehicle you'll use for deliveries</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Year *</Label>
                  <Input value={form.vehicle_year} onChange={e => update('vehicle_year', e.target.value)} placeholder="2019" maxLength={4} />
                </div>
                <div className="space-y-1.5">
                  <Label>Make *</Label>
                  <Input value={form.vehicle_make} onChange={e => update('vehicle_make', e.target.value)} placeholder="Toyota" />
                </div>
                <div className="space-y-1.5">
                  <Label>Model *</Label>
                  <Input value={form.vehicle_model} onChange={e => update('vehicle_model', e.target.value)} placeholder="Camry" />
                </div>
                <div className="space-y-1.5">
                  <Label>Color</Label>
                  <Input value={form.vehicle_color} onChange={e => update('vehicle_color', e.target.value)} placeholder="Silver" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>License Plate *</Label>
                <Input value={form.vehicle_plate} onChange={e => update('vehicle_plate', e.target.value.toUpperCase())} placeholder="ABC 1234" />
              </div>
            </>
          )}

          {/* Step 4: Training */}
          {step === 4 && (
            <>
              <div className="text-center mb-1">
                <h2 className="font-display text-xl font-bold">ABC Training Module</h2>
                <p className="text-sm text-muted-foreground mt-0.5">Required by Arkansas ABC — must pass with 4/5</p>
              </div>
              {trainingComplete ? (
                <div className="text-center py-6 space-y-3">
                  <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto" />
                  <p className="font-semibold text-emerald-700">Training Completed!</p>
                  <p className="text-sm text-muted-foreground">You passed the ABC knowledge quiz. Click Continue to proceed.</p>
                </div>
              ) : (
                <TrainingModule onComplete={() => setTrainingComplete(true)} />
              )}
            </>
          )}

          {/* Step 5: Review */}
          {step === 5 && (
            <>
              <div className="text-center mb-1">
                <h2 className="font-display text-xl font-bold">Review & Submit</h2>
                <p className="text-sm text-muted-foreground mt-0.5">Confirm your application details</p>
              </div>
              <div className="space-y-3">
                {[
                  { label: 'Name', value: form.name },
                  { label: 'Email', value: form.email },
                  { label: 'Phone', value: form.phone },
                  { label: 'Date of Birth', value: form.date_of_birth },
                  { label: 'License #', value: form.license_number },
                  { label: 'Vehicle', value: `${form.vehicle_year} ${form.vehicle_make} ${form.vehicle_model}` },
                  { label: 'Plate', value: form.vehicle_plate },
                ].map(({ label, value }) => (
                  <div key={label} className="flex justify-between text-sm border-b pb-2">
                    <span className="text-muted-foreground">{label}</span>
                    <span className="font-medium">{value || '—'}</span>
                  </div>
                ))}
                <div className="flex justify-between text-sm pb-2">
                  <span className="text-muted-foreground">Driver's License</span>
                  <span className="text-emerald-600 font-medium flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5" /> Uploaded</span>
                </div>
                <div className="flex justify-between text-sm pb-2">
                  <span className="text-muted-foreground">Proof of Insurance</span>
                  <span className="text-emerald-600 font-medium flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5" /> Uploaded</span>
                </div>
                <div className="flex justify-between text-sm pb-2">
                  <span className="text-muted-foreground">ABC Training</span>
                  <span className="text-emerald-600 font-medium flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5" /> Passed</span>
                </div>
              </div>
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-800 leading-relaxed">
                By submitting, you confirm that all information is accurate, that you have no felony convictions (required under Arkansas ACT 157 §3-4-1101), and that you agree to comply with all Arkansas ABC alcohol delivery regulations. Your account will be reviewed and activated by our team before you can begin deliveries.
              </div>
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-xs text-blue-800 space-y-1">
                <p className="font-semibold">ACT 157 Driver Requirements</p>
                <ul className="space-y-0.5 list-disc list-inside text-blue-700">
                  <li>Must be 21+ with a valid driver's license</li>
                  <li>No felony convictions (any time)</li>
                  <li>Must complete ABC-approved delivery training</li>
                  <li>May only deliver in wet areas within the retailer's county or an adjoining wet county</li>
                  <li>Must verify ID of all recipients 21+ before handing over orders</li>
                </ul>
              </div>
            </>
          )}

          {/* Navigation */}
          {step <= 5 && (
            <div className="flex gap-3 pt-2">
              {step > 1 && (
                <Button variant="outline" onClick={back} className="flex-1 rounded-xl">
                  <ArrowLeft className="w-4 h-4 mr-1" /> Back
                </Button>
              )}
              {step < 5 ? (
                <Button onClick={next} className="flex-1 rounded-xl h-11"
                  disabled={step === 4 && !trainingComplete}>
                  Continue <ArrowRight className="w-4 h-4 ml-1" />
                </Button>
              ) : (
                <Button onClick={submit} disabled={loading} className="flex-1 rounded-xl h-11">
                  {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <ShieldCheck className="w-4 h-4 mr-2" />}
                  Submit Application
                </Button>
              )}
            </div>
          )}
        </div>

        <p className="text-center text-xs text-muted-foreground mt-4">
          Step {step} of 5 · Already a driver?{' '}
          <Link to="/driver" className="text-primary hover:underline">Go to Driver Portal</Link>
        </p>
      </div>
    </div>
  );
}