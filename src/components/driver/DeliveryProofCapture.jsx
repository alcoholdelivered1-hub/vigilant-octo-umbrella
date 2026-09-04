import React, { useState, useRef, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Camera, Loader2, MapPin, CheckCircle2, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { useSignedImageUrl } from '@/hooks/useSignedImageUrl';

// Required final step before an order can be marked "delivered":
// captures a timestamped GPS pin of the drop-off location AND a photo of the
// delivered order at the door. Both are stored on the order for audit. The
// "Confirm" button stays disabled until both pieces of proof are present.
export default function DeliveryProofCapture({ order, onComplete, disabled }) {
  const [gps, setGps] = useState(null); // { latitude, longitude, accuracy, timestamp }
  const [gpsStatus, setGpsStatus] = useState('idle'); // idle | acquiring | ok | error
  const [photoUri, setPhotoUri] = useState(null);
  const { url: photoSignedUrl } = useSignedImageUrl(photoUri);
  const [uploading, setUploading] = useState(false);
  const cameraRef = useRef(null);

  const acquireGps = () => {
    setGpsStatus('acquiring');
    if (!('geolocation' in navigator)) {
      setGpsStatus('error');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGps({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          timestamp: new Date().toISOString(),
        });
        setGpsStatus('ok');
      },
      () => setGpsStatus('error'),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  };

  useEffect(() => {
    acquireGps();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handlePhoto = async (file) => {
    if (!file) return;
    setUploading(true);
    try {
      const res = await base44.integrations.Core.UploadPrivateFile({ file });
      setPhotoUri(res.file_uri);
      toast.success('Drop-off photo attached');
    } catch {
      toast.error('Failed to upload drop-off photo');
    } finally {
      setUploading(false);
    }
  };

  const ready = gpsStatus === 'ok' && !!gps && !!photoUri && !disabled;

  return (
    <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-4 space-y-3">
      <p className="text-xs font-semibold text-blue-800 uppercase tracking-wide flex items-center gap-1.5">
        <CheckCircle2 className="w-3.5 h-3.5" /> Step 2 — Capture Drop-off Proof
      </p>
      <p className="text-xs text-muted-foreground">
        A GPS pin and a photo of the delivered order at the drop-off location are both required to mark this order
        delivered. Both are timestamped and stored for audit.
      </p>

      {/* GPS pin */}
      <div className="flex items-center justify-between gap-2 bg-white rounded-lg border p-2.5">
        <div className="flex items-center gap-2 text-sm min-w-0">
          <MapPin className="w-4 h-4 text-blue-600 flex-shrink-0" />
          {gpsStatus === 'acquiring' && <span className="text-muted-foreground">Acquiring GPS…</span>}
          {gpsStatus === 'ok' && gps && (
            <span className="font-medium truncate">
              📍 {gps.latitude.toFixed(5)}, {gps.longitude.toFixed(5)}
              <span className="text-xs text-muted-foreground"> (±{Math.round(gps.accuracy)}m)</span>
            </span>
          )}
          {gpsStatus === 'error' && <span className="text-red-600">GPS unavailable — tap re-pin</span>}
          {gpsStatus === 'idle' && <span className="text-muted-foreground">Waiting…</span>}
        </div>
        {gpsStatus !== 'acquiring' && (
          <Button variant="outline" size="sm" onClick={acquireGps} disabled={disabled} className="flex-shrink-0">
            <RefreshCw className="w-3.5 h-3.5 mr-1" /> {gpsStatus === 'ok' ? 'Re-pin' : 'Get GPS'}
          </Button>
        )}
      </div>

      {/* Drop-off photo */}
      <div>
        <input
          ref={cameraRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => handlePhoto(e.target.files?.[0])}
        />
        <Button variant="outline" className="w-full" onClick={() => cameraRef.current?.click()} disabled={uploading || disabled}>
          {uploading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Camera className="w-4 h-4 mr-2" />}
          {uploading ? 'Uploading…' : photoUri ? 'Retake drop-off photo' : 'Take drop-off photo'}
        </Button>
        {photoUri && photoSignedUrl && (
          <img src={photoSignedUrl} alt="Drop-off proof" className="mt-2 w-full max-h-40 object-cover rounded-lg border" />
        )}
      </div>

      <Button
        className="w-full bg-emerald-600 hover:bg-emerald-700"
        disabled={!ready}
        onClick={() =>
          onComplete({
            latitude: gps.latitude,
            longitude: gps.longitude,
            photoUrl: photoUri,
            timestamp: gps.timestamp,
          })
        }
      >
        <CheckCircle2 className="w-4 h-4 mr-2" />
        {ready ? 'Confirm Drop-off & Mark Delivered' : 'GPS + photo required'}
      </Button>
      {!ready && (
        <p className="text-xs text-muted-foreground text-center">Both a GPS pin and a drop-off photo are required to complete delivery.</p>
      )}
    </div>
  );
}