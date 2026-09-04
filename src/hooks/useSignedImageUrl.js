import { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';

// Mints a short-lived signed URL for a privately-stored file (file_uri) so it
// can be rendered in an <img> without ever exposing a public, permanent URL.
// Identity documents, refused-ID photos, and drop-off proof photos use this.
// Returns { url, loading }; url is null until the signed URL is ready.
export function useSignedImageUrl(fileUri, expiresInSeconds = 300) {
  const [url, setUrl] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!fileUri) {
      setUrl(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    base44.integrations.Core.CreateFileSignedUrl({ file_uri: fileUri, expires_in: expiresInSeconds })
      .then((res) => {
        if (!cancelled) setUrl(res?.signed_url || null);
      })
      .catch(() => {
        if (!cancelled) setUrl(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [fileUri, expiresInSeconds]);

  return { url, loading };
}