import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { CheckCircle2, XCircle, BookOpen, Award, AlertTriangle, ChevronRight, RefreshCw, Loader2, Share2, Eye } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

const trainingContent = [
  {
    title: "Arkansas Alcohol Delivery Laws",
    content: "In Arkansas, alcohol may only be delivered in wet counties. Jefferson County is a wet county. Deliveries are only permitted during legal hours (typically 7:00 AM – 2:00 AM). Drivers must be at least 21 years of age and have completed mandatory ABC training."
  },
  {
    title: "Age Verification Requirements",
    content: "You MUST verify the customer's government-issued ID at every delivery — even if you've delivered to them before. The customer must be 21 or older. Acceptable IDs: Driver's License, Passport, State ID, Military ID. Expired IDs are NOT acceptable. You must verify the person receiving the order is the person who placed it."
  },
  {
    title: "Refusal of Delivery",
    content: "You are REQUIRED to refuse delivery if: (1) The customer cannot produce a valid ID, (2) The customer appears visibly intoxicated, (3) The customer is under 21, (4) Someone other than the order-placer attempts to receive the order, (5) The delivery location is in a dry area. Record all refusals in the app immediately."
  },
  {
    title: "Driver Responsibilities & Penalties",
    content: "Delivering alcohol to a minor is a criminal offense in Arkansas. You could face fines, loss of license, and criminal charges. Never leave alcohol unattended. Never deliver to a clearly intoxicated person. Violations will result in immediate suspension from the platform and may be reported to the Arkansas ABC."
  },
];

const questions = [
  {
    question: "What is the minimum legal age to receive an alcohol delivery in Arkansas?",
    options: ["18 years old", "19 years old", "21 years old", "25 years old"],
    correct: 2,
    explanation: "Arkansas law requires the recipient to be at least 21 years of age."
  },
  {
    question: "Which of the following IDs is NOT acceptable for age verification?",
    options: ["Valid Driver's License", "Passport", "Expired State ID", "Military ID"],
    correct: 2,
    explanation: "Expired IDs are never acceptable. The ID must be current and valid."
  },
  {
    question: "When should you REFUSE an alcohol delivery?",
    options: [
      "Only if the customer has no ID at all",
      "If the customer appears visibly intoxicated, has no valid ID, or is under 21",
      "Only if you personally think the customer is too young",
      "Never — the store already verified their ID"
    ],
    correct: 1,
    explanation: "You must refuse delivery if the customer is visibly intoxicated, cannot produce a valid ID, or is under 21 — regardless of checkout verification."
  },
  {
    question: "What should you do if a different person (not the order placer) tries to receive the delivery?",
    options: [
      "Deliver it anyway if they show a valid ID",
      "Call the store to ask permission",
      "Refuse the delivery and record the refusal reason in the app",
      "Leave the order at the door"
    ],
    correct: 2,
    explanation: "Alcohol must be delivered only to the person who placed the order. Refuse and record the reason if someone else answers."
  },
];

export default function DriverTraining({ userEmail, onComplete }) {
  const queryClient = useQueryClient();
  const [phase, setPhase] = useState('training'); // 'training' | 'test' | 'results'
  const [page, setPage] = useState(0);
  const [answers, setAnswers] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [retaking, setRetaking] = useState(false);
  const [certLoading, setCertLoading] = useState(false);

  const { data: driver } = useQuery({
    queryKey: ['driver-training-profile', userEmail],
    queryFn: () => base44.entities.Driver.filter({ email: userEmail }, 'name', 1),
    enabled: !!userEmail,
  });

  const alreadyCompleted = driver?.[0]?.training_completed && !retaking;
  const completedDate = driver?.[0]?.training_completed_date;

  const handleViewCertificate = async () => {
    setCertLoading(true);
    // Open the window synchronously so the browser treats it as a user gesture
    // (calling window.open AFTER an async call gets blocked by popup blockers).
    const win = window.open('', '_blank');
    try {
      const result = await base44.functions.invoke('generateTrainingCertificate', {});
      const url = result?.data?.download_url || result?.download_url;
      if (!url) {
        win?.close();
        toast.error('Could not generate certificate. Please try again.');
        return;
      }
      if (win && !win.closed) {
        win.location.href = url;
      } else {
        // Popup was blocked — fall back to navigating this tab
        window.location.href = url;
      }
    } catch (err) {
      win?.close();
      toast.error('Failed to generate certificate.');
    } finally {
      setCertLoading(false);
    }
  };

  const handleShareCertificate = async () => {
    setCertLoading(true);
    const win = window.open('', '_blank');
    try {
      const result = await base44.functions.invoke('generateTrainingCertificate', {});
      const url = result?.data?.download_url || result?.download_url;
      if (!url) {
        win?.close();
        toast.error('Could not generate certificate for sharing.');
        return;
      }
      // Try the native share sheet if available
      if (navigator.share) {
        try {
          await navigator.share({
            title: 'My ACT 157 Training Certificate',
            text: 'My Alcohol Delivery Driver Training Certificate — Alcohol Delivered, LLC',
            url,
          });
        } catch {
          // User cancelled or share failed — show the certificate instead
          if (win && !win.closed) {
            win.location.href = url;
          } else {
            window.location.href = url;
          }
        }
      } else if (win && !win.closed) {
        win.location.href = url;
      } else {
        window.location.href = url;
      }
      // Also copy the link so they can paste it anywhere
      try {
        await navigator.clipboard.writeText(url);
        toast.success('Certificate link copied!');
      } catch {}
    } catch (err) {
      win?.close();
      toast.error('Failed to share certificate.');
    } finally {
      setCertLoading(false);
    }
  };

  const handleAnswer = (qIdx, aIdx) => {
    if (submitted) return;
    setAnswers(prev => ({ ...prev, [qIdx]: aIdx }));
  };

  const score = questions.filter((q, i) => answers[i] === q.correct).length;
  const passed = score >= 3;

  const handleSubmitTest = async () => {
    if (Object.keys(answers).length < questions.length) {
      toast.error('Please answer all questions before submitting');
      return;
    }
    setSubmitted(true);
    setPhase('results');

    if (passed) {
      setSaving(true);
      const drivers = await base44.entities.Driver.filter({ email: userEmail });
      if (drivers.length > 0) {
        await base44.entities.Driver.update(drivers[0].id, {
          training_completed: true,
          training_completed_date: new Date().toISOString().split('T')[0],
        });
        queryClient.invalidateQueries({ queryKey: ['driver-training-profile', userEmail] });
      }
      setSaving(false);
      toast.success('Training completed! Certification recorded.');
      if (onComplete) onComplete();
    }
  };

  if (alreadyCompleted) {
    return (
      <div className="space-y-6">
        <div className="bg-emerald-50 border-2 border-emerald-300 rounded-2xl p-8 text-center space-y-4">
          <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto">
            <Award className="w-9 h-9 text-emerald-600" />
          </div>
          <div>
            <h2 className="font-display text-xl font-bold text-emerald-800">Training Completed</h2>
            {completedDate && (
              <p className="text-emerald-700 text-sm mt-1">
                Completed on {format(new Date(completedDate), 'MMMM d, yyyy')}
              </p>
            )}
          </div>
          <p className="text-sm text-emerald-700">
            Your alcohol safety certification is on file. You're cleared to deliver.
          </p>
        </div>

        {/* Certificate access — view on device or share with retailer */}
        <div className="bg-card border rounded-2xl p-5 space-y-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-primary">
            <Award className="w-4 h-4" /> Your Training Certificate
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Show this to any retailer to prove you're ACT 157 certified. Opens right on your phone — no printer needed.
          </p>
          <div className="flex flex-col sm:flex-row gap-2">
            <Button
              onClick={handleViewCertificate}
              disabled={certLoading}
              className="flex-1 h-11"
            >
              {certLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Eye className="w-4 h-4 mr-2" />}
              {certLoading ? 'Generating...' : 'View Certificate'}
            </Button>
            <Button
              variant="outline"
              onClick={handleShareCertificate}
              disabled={certLoading}
              className="flex-1 h-11"
            >
              <Share2 className="w-4 h-4 mr-2" /> Share / Save
            </Button>
          </div>
        </div>

        <div className="flex gap-3">
          {onComplete && (
            <Button onClick={onComplete} className="flex-1 h-11">
              <CheckCircle2 className="w-4 h-4 mr-2" /> Back to Deliveries
            </Button>
          )}
          <Button
            variant="outline"
            onClick={() => { setRetaking(true); setPhase('training'); setPage(0); setAnswers({}); setSubmitted(false); }}
            className="h-11"
          >
            <RefreshCw className="w-4 h-4 mr-2" /> Retake Training
          </Button>
        </div>
      </div>
    );
  }

  if (phase === 'training') {
    return (
      <div className="space-y-6">
        <div className="bg-card rounded-2xl border p-6">
          <div className="flex items-center gap-2 mb-3 text-xs text-muted-foreground font-medium uppercase tracking-wide">
            <BookOpen className="w-4 h-4" />
            Training Modules
          </div>
          <h2 className="font-display text-xl font-bold mb-4">Alcohol Delivery Safety Training</h2>
          <p className="text-sm text-muted-foreground">Review all {trainingContent.length} sections below, then take the quiz to complete your certification.</p>
        </div>

        {trainingContent.map((section, i) => (
          <div key={i} className="bg-card rounded-2xl border p-6">
            <div className="flex items-center gap-2 mb-2 text-xs text-primary font-semibold uppercase tracking-wide">
              <span className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-xs">{i + 1}</span>
              {section.title}
            </div>
            <p className="text-sm leading-relaxed text-foreground">{section.content}</p>
          </div>
        ))}

        <Button onClick={() => setPhase('test')} className="w-full h-12">
          Start Quiz <ChevronRight className="w-4 h-4 ml-1" />
        </Button>
      </div>
    );
  }

  if (phase === 'test') {
    return (
      <div className="space-y-6">
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-center gap-2 text-sm text-amber-800">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>Answer all 4 questions. You need at least 3 correct to pass.</span>
        </div>

        {questions.map((q, qi) => (
          <div key={qi} className="bg-card rounded-2xl border p-5">
            <p className="font-semibold text-sm mb-4">Q{qi + 1}. {q.question}</p>
            <div className="space-y-2">
              {q.options.map((opt, oi) => (
                <button
                  key={oi}
                  onClick={() => handleAnswer(qi, oi)}
                  className={`w-full text-left text-sm px-4 py-3 rounded-xl border transition-all ${
                    answers[qi] === oi
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-background border-border hover:border-primary/40'
                  }`}
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>
        ))}

        <Button onClick={handleSubmitTest} className="w-full h-12">Submit Answers</Button>
      </div>
    );
  }

  // Results
  return (
    <div className="space-y-6">
      <div className={`rounded-2xl border p-6 text-center ${passed ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'}`}>
        {passed ? (
          <Award className="w-12 h-12 text-emerald-600 mx-auto mb-3" />
        ) : (
          <XCircle className="w-12 h-12 text-red-500 mx-auto mb-3" />
        )}
        <h2 className={`font-display text-2xl font-bold mb-1 ${passed ? 'text-emerald-800' : 'text-red-800'}`}>
          {passed ? 'You Passed!' : 'Not Quite'}
        </h2>
        <p className={`text-sm ${passed ? 'text-emerald-700' : 'text-red-700'}`}>
          You scored {score} out of {questions.length}.{' '}
          {passed ? 'Your certification has been recorded.' : 'You need 3/4 to pass. Please review and try again.'}
        </p>
      </div>

      {questions.map((q, qi) => {
        const userAnswer = answers[qi];
        const isCorrect = userAnswer === q.correct;
        return (
          <div key={qi} className={`rounded-2xl border p-4 ${isCorrect ? 'border-emerald-200 bg-emerald-50/50' : 'border-red-200 bg-red-50/50'}`}>
            <div className="flex items-start gap-2 mb-2">
              {isCorrect ? <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" /> : <XCircle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />}
              <p className="text-sm font-semibold">{q.question}</p>
            </div>
            {!isCorrect && (
              <div className="ml-6 text-xs space-y-1">
                <p className="text-red-700">Your answer: {q.options[userAnswer]}</p>
                <p className="text-emerald-700 font-medium">Correct: {q.options[q.correct]}</p>
                <p className="text-muted-foreground mt-1">{q.explanation}</p>
              </div>
            )}
            {isCorrect && <p className="ml-6 text-xs text-emerald-700">{q.explanation}</p>}
          </div>
        );
      })}

      {!passed && (
        <Button onClick={() => { setPhase('training'); setPage(0); setAnswers({}); setSubmitted(false); }} className="w-full h-12">
          Review Training & Retry
        </Button>
      )}
    </div>
  );
}