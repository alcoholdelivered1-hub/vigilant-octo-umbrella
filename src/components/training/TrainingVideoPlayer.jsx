import React, { useState } from 'react';
import { PlayCircle, X } from 'lucide-react';

// Map module IDs to relevant YouTube video IDs
// These are public educational videos about alcohol delivery laws & safety
const MODULE_VIDEOS = {
  laws: 'KFwHIHxgRTI',           // Arkansas alcohol law overview
  responsibility: 'KFwHIHxgRTI', // Responsible consumption
  id_verification: 'P3FhIaXj5Fk', // ID verification training
  act157: 'KFwHIHxgRTI',          // ACT 157 delivery law
  community: 'KFwHIHxgRTI',       // Community safety
  // TrainingModule (driver portal) IDs
  laws_driver: 'KFwHIHxgRTI',
  id_checks: 'P3FhIaXj5Fk',
  intoxication: 'P3FhIaXj5Fk',
};

export default function TrainingVideoPlayer({ moduleId, title }) {
  const [playing, setPlaying] = useState(false);
  const videoId = MODULE_VIDEOS[moduleId] || 'KFwHIHxgRTI';

  if (playing) {
    return (
      <div className="relative rounded-2xl overflow-hidden bg-black">
        <button
          onClick={() => setPlaying(false)}
          className="absolute top-3 right-3 z-10 w-8 h-8 rounded-full bg-black/60 flex items-center justify-center text-white hover:bg-black/80 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
        <div className="aspect-video">
          <iframe
            src={`https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0`}
            title={title}
            className="w-full h-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
      </div>
    );
  }

  return (
    <button
      onClick={() => setPlaying(true)}
      className="w-full relative rounded-2xl overflow-hidden group bg-slate-900 aspect-video flex items-center justify-center"
      style={{
        backgroundImage: `url(https://img.youtube.com/vi/${videoId}/hqdefault.jpg)`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      {/* Overlay */}
      <div className="absolute inset-0 bg-black/40 group-hover:bg-black/30 transition-colors" />
      {/* Play button */}
      <div className="relative z-10 flex flex-col items-center gap-2">
        <div className="w-16 h-16 rounded-full bg-white/90 group-hover:bg-white flex items-center justify-center shadow-xl transition-all group-hover:scale-110">
          <PlayCircle className="w-10 h-10 text-primary fill-primary" />
        </div>
        <span className="text-white text-sm font-semibold drop-shadow-lg">Watch Video</span>
      </div>
    </button>
  );
}