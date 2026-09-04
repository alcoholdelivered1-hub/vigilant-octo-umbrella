import React from 'react';
import { Link } from 'react-router-dom';

export default function PublicLanding() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-10 sm:px-6 lg:px-8">
        <section className="overflow-hidden rounded-3xl bg-gradient-to-br from-primary via-blue-700 to-indigo-800 text-white shadow-2xl">
          <div className="px-6 py-12 sm:px-10 lg:px-14">
            <div className="inline-flex items-center rounded-full border border-white/20 bg-white/10 px-3 py-1 text-sm font-medium text-blue-50">
              Soft opening • Beverage King rollout
            </div>
            <h1 className="mt-5 text-4xl font-bold tracking-tight sm:text-5xl">
              Alcohol Delivered is live for merchant onboarding and order handoff.
            </h1>
            <p className="mt-4 max-w-3xl text-lg text-blue-50/90">
              We are opening with a reliable public experience for partners, merchants, and support during the launch window.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <a href="mailto:madhouserecords@yahoo.com" className="rounded-full bg-white px-5 py-3 font-semibold text-primary shadow hover:bg-slate-100">
                Contact support
              </a>
              <Link to="/privacy" className="rounded-full border border-white/30 bg-white/10 px-5 py-3 font-semibold text-white hover:bg-white/20">
                Read privacy policy
              </Link>
            </div>
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-semibold text-slate-900">What is available</h2>
            <p className="mt-3 text-sm leading-7 text-slate-600">
              Paid order handoff, merchant onboarding support, and public launch information are being handled through the current soft-opening workflow.
            </p>
            <ul className="mt-4 list-disc space-y-2 pl-5 text-sm text-slate-600">
              <li>Public landing information for partners and merchants</li>
              <li>Support and compliance links for launch readiness</li>
              <li>Order handoff workflow for the Beverage King rollout</li>
            </ul>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-semibold text-slate-900">Need help?</h2>
            <p className="mt-3 text-sm leading-7 text-slate-600">
              Use the support contact below for onboarding questions, handoff issues, or launch assistance.
            </p>
            <div className="mt-4 rounded-2xl bg-slate-50 p-4 text-sm text-slate-700">
              <strong>Email:</strong> <a className="text-primary" href="mailto:madhouserecords@yahoo.com">madhouserecords@yahoo.com</a>
            </div>
            <div className="mt-4 flex flex-wrap gap-3">
              <Link to="/terms" className="text-sm font-semibold text-primary">Terms of service</Link>
              <Link to="/privacy" className="text-sm font-semibold text-primary">Privacy policy</Link>
              <Link to="/support" className="text-sm font-semibold text-primary">Support</Link>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
