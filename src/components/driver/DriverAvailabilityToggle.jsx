import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2, Radio, WifiOff, PauseCircle } from 'lucide-react';
import { toast } from 'sonner';

/**
 * DriverAvailabilityToggle
 * Finds the Driver record matching the current user's email,
 * then lets them toggle between "available" and "offline".
 * Also kicks off GPS broadcasting to the Driver entity when online.
 */
export default function DriverAvailabilityToggle({ userEmail }) {
  const queryClient = useQueryClient();
  const [gpsError, setGpsError] = useState(false);

  const { data: drivers = [], isLoading } = useQuery({
    queryKey: ['my-driver-record', userEmail],
    queryFn: () => base44.entities.Driver.filter({ email: userEmail }),
    enabled: !!userEmail,
  });

  const driver = drivers[0];
  const isOnline = driver?.status === 'available' || driver?.status === 'on_delivery';
  const isPaused = driver?.status === 'offline' && driver?._paused;

  const toggleMutation = useMutation({
    mutationFn: (newStatus) => base44.entities.Driver.update(driver.id, { status: newStatus }),
    onSuccess: (_, newStatus) => {
      queryClient.invalidateQueries({ queryKey: ['my-driver-record', userEmail] });
      if (newStatus === 'available') toast.success('✅ You are now Online & available for orders');
      else if (newStatus === 'offline') toast.success('🔴 You are now Offline');
    },
    onError: () => toast.error('Failed to update status'),
  });

  // GPS broadcast to Driver entity while online
  useEffect(() => {
    if (!driver?.id || !isOnline || !navigator.geolocation) return;

    setGpsError(false);

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        base44.entities.Driver.update(driver.id, {
          current_latitude: pos.coords.latitude,
          current_longitude: pos.coords.longitude,
        }).catch(() => {});
        setGpsError(false);
      },
      () => setGpsError(true),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [driver?.id, isOnline]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-4">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!driver) {
    return (
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
        No driver profile found for your account. Please <a href="/driver/signup" className="underline font-semibold">complete your driver signup</a> first.
      </div>
    );
  }

  const handleToggle = () => {
    if (toggleMutation.isPending) return;
    const next = isOnline ? 'offline' : 'available';
    toggleMutation.mutate(next);
  };

  const handlePause = () => {
    if (toggleMutation.isPending) return;
    toggleMutation.mutate('offline');
    toast.info('⏸️ Paused — you won\'t receive new orders');
  };

  const statusColor = isOnline
    ? 'border-emerald-400 bg-emerald-50'
    : driver?.status === 'offline'
    ? 'border-amber-300 bg-amber-50'
    : 'border-border bg-card';

  return (
    <div className={`rounded-2xl border-2 p-5 transition-all ${statusColor}`}>
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${isOnline ? 'bg-emerald-500' : driver?.status === 'offline' ? 'bg-amber-400' : 'bg-muted'}`}>
            {isOnline
              ? <Radio className="w-5 h-5 text-white animate-pulse" />
              : driver?.status === 'offline'
              ? <PauseCircle className="w-5 h-5 text-white" />
              : <WifiOff className="w-5 h-5 text-muted-foreground" />
            }
          </div>
          <div>
            <p className={`font-bold text-base ${isOnline ? 'text-emerald-800' : driver?.status === 'offline' ? 'text-amber-800' : 'text-foreground'}`}>
              {isOnline ? 'You are Online' : driver?.status === 'offline' ? 'Paused' : 'You are Offline'}
            </p>
            <p className="text-xs text-muted-foreground">
              {isOnline
                ? gpsError
                  ? '⚠️ GPS unavailable — allow location access'
                  : '📡 Broadcasting live location to dispatch'
                : driver?.status === 'offline'
                ? 'Not receiving new orders'
                : 'Toggle on to receive orders'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Pause button — only visible when online */}
          {isOnline && (
            <button
              onClick={handlePause}
              disabled={toggleMutation.isPending}
              title="Pause — stop receiving new orders temporarily"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-100 text-amber-700 border border-amber-300 text-xs font-semibold hover:bg-amber-200 transition-colors disabled:opacity-50"
            >
              <PauseCircle className="w-4 h-4" /> Pause
            </button>
          )}

          {/* Online/Offline toggle */}
          <button
            onClick={handleToggle}
            disabled={toggleMutation.isPending || driver?.status === 'suspended'}
            className={`relative w-14 h-7 rounded-full transition-colors ${
              isOnline ? 'bg-emerald-500' : 'bg-muted-foreground/30'
            } disabled:opacity-50`}
          >
            {toggleMutation.isPending
              ? <Loader2 className="w-4 h-4 animate-spin absolute top-1.5 left-1.5 text-white" />
              : <span className={`absolute top-1 w-5 h-5 bg-white rounded-full shadow transition-all ${isOnline ? 'left-8' : 'left-1'}`} />
            }
          </button>
        </div>
      </div>

      {driver?.status === 'suspended' && (
        <div className="mt-3 text-xs text-destructive font-medium">Your account is suspended. Contact support.</div>
      )}
    </div>
  );
}