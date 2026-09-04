import React from 'react';
import { Truck, MapPin, BookOpen, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function DriverWelcome({ user, onStart }) {
  return (
    <div className="space-y-6">
      {/* Hero */}
      <div className="bg-gradient-to-br from-primary to-primary/80 rounded-2xl p-6 text-primary-foreground text-center">
        <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center mx-auto mb-4">
          <Truck className="w-8 h-8 text-white" />
        </div>
        <h2 className="font-display text-2xl font-bold">Welcome back{user?.full_name ? `, ${user.full_name.split(' ')[0]}` : ''}!</h2>
        <p className="text-primary-foreground/80 mt-1 text-sm">Ready to make deliveries today?</p>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-card rounded-xl border p-4 text-center">
          <p className="text-2xl font-bold text-secondary">$3</p>
          <p className="text-xs text-muted-foreground">Per Delivery</p>
        </div>
        <div className="bg-card rounded-xl border p-4 text-center">
          <Star className="w-5 h-5 text-secondary mx-auto mb-1" fill="currentColor" />
          <p className="text-xs text-muted-foreground">Keep 100%<br/>of Tips</p>
        </div>
        <div className="bg-card rounded-xl border p-4 text-center">
          <MapPin className="w-5 h-5 text-primary mx-auto mb-1" />
          <p className="text-xs text-muted-foreground">Pine Bluff<br/>AR Area</p>
        </div>
      </div>

      {/* Reminders */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-2">
        <p className="text-sm font-semibold text-amber-800">Before you start:</p>
        <ul className="text-xs text-amber-700 space-y-1.5 list-disc list-inside">
          <li>Complete driver training & certification if not done</li>
          <li>Verify your ID and vehicle info is up to date</li>
          <li>Always verify customer ID at delivery (21+)</li>
          <li>Do NOT deliver to visibly intoxicated customers</li>
        </ul>
      </div>

      {/* CTA */}
      <div className="flex gap-3">
        <Button onClick={() => onStart('available')} className="flex-1 h-12 text-base rounded-xl">
          <Truck className="w-5 h-5 mr-2" /> Find Available Orders
        </Button>
        <Button variant="outline" onClick={() => onStart('training')} className="h-12 rounded-xl px-4">
          <BookOpen className="w-5 h-5" />
        </Button>
      </div>
    </div>
  );
}