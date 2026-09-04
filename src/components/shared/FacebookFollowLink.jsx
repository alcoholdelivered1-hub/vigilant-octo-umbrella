import React from 'react';
import { Facebook } from 'lucide-react';

const FACEBOOK_URL = 'https://www.facebook.com/share/1BJerzd5hY/?mibextid=wwXIfr';

export default function FacebookFollowLink({ variant = 'banner' }) {
  if (variant === 'compact') {
    return (
      <a
        href={FACEBOOK_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#1877F2] hover:underline"
      >
        <Facebook className="w-3.5 h-3.5" /> Follow us on Facebook
      </a>
    );
  }

  return (
    <a
      href={FACEBOOK_URL}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-3 bg-[#1877F2] hover:bg-[#166FE5] text-white rounded-xl p-3.5 transition-colors group"
    >
      <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0">
        <Facebook className="w-5 h-5" />
      </div>
      <div className="flex-1">
        <p className="text-sm font-bold">Follow us on Facebook</p>
        <p className="text-xs text-white/80">Get launch updates, promos & exclusive deals</p>
      </div>
      <span className="text-xs font-semibold bg-white/20 group-hover:bg-white/30 px-3 py-1.5 rounded-lg transition-colors">
        Follow →
      </span>
    </a>
  );
}