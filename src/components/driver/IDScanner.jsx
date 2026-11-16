import React, { useState, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import {
  Camera, X, CheckCircle2, Upload, Loader2,
  ShieldCheck, ShieldX, User, Calendar, CreditCard, RefreshCw
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

// Confidence badge styles
const CONFIDENCE_STYLE = {
  high: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  medium: 'bg-amber-100 text-amber-800 border-amber-200',
  low: 'bg-red-100 text-red-800 border-red-200',
};

function ExtractedField({ icon: Icon, label, value, highlight }) {
  return (
    <div className={cn('flex items-center gap-2 p-2 rounded-lg text-sm', highlight ? 'bg-emerald-50' : 'bg-muted/50')}>
      <Icon className={cn('w-4 h-4 flex-shrink-0', highlight ? 'text-emerald-600' : 'text-muted-foreground')} />
      <span className="text-muted-foreground text-xs w-20 flex-shrink-0">{label}</span>
      <span className="font-semibold truncate">{value || '—'}</span>
    </div>
  );
}

export default function IDScanner({ orderId, orderCustomerName, onVerified, onBlocked }) {
  const [phase, setPhase] = useState('idle'); // idle | camera | preview | processing | result
  const [capturedBlob, setCapturedBlob] = useState(null);
  const [capturedUrl, setCapturedUrl] = useState(null); // local preview URL
  const [uploadedFileUri, setUploadedFileUri] = useState(null);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const fileInputRef = useRef(null);
  const streamRef = useRef(null);

  // --- Camera helpers ---
  const startCamera = async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }
      });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
      setPhase('camera');
    } catch {
      toast.error('Could not access camera. Please check permissions or upload a photo instead.');
    }
  };

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
  };

  const capturePhoto = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    canvas.getContext('2d').drawImage(video, 0, 0);
    stopCamera();
    canvas.toBlob(blob => {
      const previewUrl = URL.createObjectURL(blob);
      setCapturedBlob(blob);
      setCapturedUrl(previewUrl);
      setPhase('preview');
    }, 'image/jpeg', 0.92);
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const previewUrl = URL.createObjectURL(file);
    setCapturedBlob(file);
    setCapturedUrl(previewUrl);
    setPhase('preview');
  };

  const handleCancel = () => {
    stopCamera();
    setCapturedBlob(null);
    setCapturedUrl(null);
    setUploadedFileUri(null);
    setResult(null);
    setError(null);
    setPhase('idle');
  };

  // --- Upload + OCR verify ---
  const runVerification = async () => {
    if (!capturedBlob) return;
    setPhase('processing');
    setError(null);

    // 1. Upload image
    let fileUri;
    try {
      const { file_uri } = await base44.integrations.Core.UploadPrivateFile({ file: capturedBlob });
      fileUri = file_uri;
      setUploadedFileUri(fileUri);
    } catch {
      setError('Failed to upload ID image. Please try again.');
      setPhase('preview');
      return;
    }

    // 2. OCR + cross-reference via backend
    try {
      const res = await base44.functions.invoke('verifyCustomerID', {
        id_image_file_uri: fileUri,
        order_id: orderId,
      });
      const data = res.data;
      setResult(data);
      setPhase('result');

      if (data.verified) {
        toast.success('ID verified — age confirmed 21+');
      } else {
        toast.error(data.block_reason || 'ID verification failed');
      }
    } catch {
      setError('Verification service error. Retry the scan or refuse delivery.');
      setPhase('result');
      setResult({ verified: false, block_reason: 'Service error — manual review required.', extracted: null });
    }
  };

  const handleConfirmVerified = () => {
    onVerified({ id_image_file_uri: uploadedFileUri, verified_at_delivery: true, extracted: result?.extracted });
  };

  const handleRefuseDelivery = () => {
    onBlocked?.(result?.block_reason);
  };

  // ---- Render phases ----

  if (phase === 'idle') {
    return (
      <div className="space-y-2">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
          <CreditCard className="w-3.5 h-3.5" /> Step 1 — Scan Customer ID
        </p>
        <Button onClick={startCamera} className="w-full" size="sm">
          <Camera className="w-4 h-4 mr-2" /> Open Camera to Scan ID
        </Button>
        <button
          onClick={() => fileInputRef.current?.click()}
          className="w-full flex items-center justify-center gap-2 px-4 py-2 border rounded-lg text-sm hover:bg-muted transition-colors"
        >
          <Upload className="w-4 h-4" /> Upload ID Photo
        </button>
        <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />
      </div>
    );
  }

  if (phase === 'camera') {
    return (
      <div className="space-y-3">
        <div className="relative bg-black rounded-xl overflow-hidden" style={{ aspectRatio: '16/9' }}>
          <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
          {/* ID guide overlay */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="border-2 border-white/70 rounded-lg w-4/5 h-3/5 flex items-center justify-center">
              <span className="text-white/70 text-xs bg-black/40 px-2 py-1 rounded">Align ID within frame</span>
            </div>
          </div>
        </div>
        <canvas ref={canvasRef} className="hidden" />
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleCancel} className="flex-1" size="sm">
            <X className="w-4 h-4 mr-1" /> Cancel
          </Button>
          <Button onClick={capturePhoto} className="flex-1" size="sm">
            <Camera className="w-4 h-4 mr-1" /> Capture
          </Button>
        </div>
      </div>
    );
  }

  if (phase === 'preview') {
    return (
      <div className="space-y-3">
        <p className="text-xs font-semibold text-muted-foreground">Review photo before submitting:</p>
        <div className="rounded-xl overflow-hidden border bg-black">
          <img src={capturedUrl} alt="Captured ID" className="w-full object-contain max-h-48" />
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleCancel} className="flex-1" size="sm">
            <RefreshCw className="w-4 h-4 mr-1" /> Retake
          </Button>
          <Button onClick={runVerification} className="flex-1" size="sm">
            <ShieldCheck className="w-4 h-4 mr-1" /> Verify ID
          </Button>
        </div>
        {error && <p className="text-xs text-red-600 text-center">{error}</p>}
      </div>
    );
  }

  if (phase === 'processing') {
    return (
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-6 flex flex-col items-center gap-3 text-center">
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
        <p className="font-semibold text-blue-800">Verifying ID…</p>
        <p className="text-xs text-blue-600">Reading name, date of birth, and cross-referencing order details</p>
      </div>
    );
  }

  if (phase === 'result' && result) {
    const { verified, block_reason, extracted, name_match, name_match_detail, order_customer_name } = result;

    return (
      <div className="space-y-4">
        {/* Result banner */}
        <div className={cn(
          'rounded-xl p-4 border-2 flex items-start gap-3',
          verified ? 'bg-emerald-50 border-emerald-300' : 'bg-red-50 border-red-300'
        )}>
          {verified
            ? <ShieldCheck className="w-6 h-6 text-emerald-600 flex-shrink-0 mt-0.5" />
            : <ShieldX className="w-6 h-6 text-red-600 flex-shrink-0 mt-0.5" />}
          <div>
            <p className={cn('font-bold text-sm', verified ? 'text-emerald-800' : 'text-red-800')}>
              {verified ? 'ID Verified ✓' : 'Verification Failed'}
            </p>
            {block_reason && <p className="text-xs mt-1 text-red-700">{block_reason}</p>}
          </div>
        </div>

        {/* Extracted data */}
        {extracted && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Extracted from ID</p>
              {extracted.confidence && (
                <span className={cn('text-xs px-2 py-0.5 rounded-full border font-medium capitalize', CONFIDENCE_STYLE[extracted.confidence] || CONFIDENCE_STYLE.medium)}>
                  {extracted.confidence} confidence
                </span>
              )}
            </div>
            <div className="space-y-1.5">
              <ExtractedField icon={User} label="Name" value={extracted.full_name}
                highlight={name_match === true} />
              <ExtractedField icon={Calendar} label="Date of Birth" value={extracted.date_of_birth} />
              <ExtractedField icon={Calendar} label="Age" value={extracted.age != null ? `${extracted.age} years old${extracted.is_21_or_older ? ' ✓' : ' ✗ UNDERAGE'}` : null}
                highlight={extracted.is_21_or_older === true} />
              <ExtractedField icon={CreditCard} label="ID Type" value={extracted.id_type?.replace('_', ' ')} />
              <ExtractedField icon={CreditCard} label="Expires" value={extracted.expiration_date} />
            </div>
          </div>
        )}

        {/* Name cross-reference */}
        {order_customer_name && (
          <div className={cn('rounded-lg border p-3 text-sm flex items-start gap-2',
            name_match === true ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : name_match === false ? 'bg-red-50 border-red-200 text-red-800'
                : 'bg-muted border-border')}>
            <User className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-xs">Order name: {order_customer_name}</p>
              {name_match_detail && <p className="text-xs mt-0.5 opacity-80">{name_match_detail}</p>}
            </div>
          </div>
        )}

        {/* ID preview thumbnail */}
        {capturedUrl && (
          <div className="rounded-lg overflow-hidden border">
            <img src={capturedUrl} alt="Captured ID" className="w-full object-contain max-h-32" />
          </div>
        )}

        {/* Action buttons */}
        <div className="space-y-2">
          {verified ? (
            <Button onClick={handleConfirmVerified} className="w-full bg-emerald-600 hover:bg-emerald-700">
              <CheckCircle2 className="w-4 h-4 mr-2" /> Confirm & Proceed to Deliver
            </Button>
          ) : (
            <>
              <Button variant="destructive" onClick={handleRefuseDelivery} className="w-full">
                Refuse Delivery — ID Fail
              </Button>
              <p className="text-xs text-red-700">Do not hand over alcohol if verification fails. Rescan or refuse delivery.</p>
            </>
          )}
          <button onClick={handleCancel} className="w-full text-xs text-muted-foreground hover:text-foreground py-1">
            ↩ Rescan ID
          </button>
        </div>
      </div>
    );
  }

  return null;
}