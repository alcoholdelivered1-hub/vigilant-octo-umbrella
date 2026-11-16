import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { CheckCircle2, XCircle, BookOpen, Award, AlertTriangle, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';

const trainingContent = [
  {
    title: "Arkansas Alcohol Delivery Laws",
    content: "Under Arkansas Act 157 of 2025, deliver only in eligible wet territory in the retailer's county or an adjoining county. Check the official ABC wet/dry map, not just a mileage radius. Follow applicable legal sale and delivery hours; there is no universal delivery window. Drivers must be at least 21, hold a valid driver's license, have no felony conviction, and complete an ABC-approved training program annually. Carry current training proof and the completed ABC Third-party Delivery Server Awareness form while delivering."
  },
  {
    title: "Age Verification Requirements",
    content: "Verify valid government-issued ID and age 21+ at every delivery, even after checkout verification. Arkansas law permits the purchaser or an eligible adult in the household or place of employment to receive delivery. Alcohol Delivered currently uses the stricter purchaser-only handoff policy. The recipient must be present; never leave alcohol unattended. Check in-state and out-of-state IDs for expiration, alteration, authenticity and a matching photograph."
  },
  {
    title: "Refusal of Delivery",
    content: "Refuse delivery if ID is invalid, altered or missing, the recipient is under 21 or visibly intoxicated, or the address is dry, outside the permitted counties, or cannot be verified. Under Alcohol Delivered's purchaser-only policy, also refuse if the purchaser is not present. Record refusals in the app. A retailer's or checkout's ID check does not replace your in-person check."
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
    explanation: "Alcohol Delivered currently requires the purchaser to receive delivery. This is a stricter platform policy; Arkansas law also permits an eligible adult within the household or place of employment."
  },
];

export default function DriverTraining({ onComplete }) {
  const [phase, setPhase] = useState('training'); // 'training' | 'test' | 'results'
  const [page, setPage] = useState(0);
  const [answers, setAnswers] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);

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
      const user = await base44.auth.me();
      const drivers = await base44.entities.Driver.filter({ email: user.email });
      if (drivers.length > 0) {
        await base44.entities.Driver.update(drivers[0].id, {
          training_completed: true,
          training_completed_date: new Date().toISOString().split('T')[0],
        });
      }
      setSaving(false);
      toast.success('App lesson completed. Annual ABC-approved certification still requires administrator evidence review.');
      if (onComplete) onComplete();
    }
  };

  if (phase === 'training') {
    const section = trainingContent[page];
    return (
      <div className="space-y-6">
        <div className="bg-card rounded-2xl border p-6">
          <div className="flex items-center gap-2 mb-1 text-xs text-muted-foreground font-medium uppercase tracking-wide">
            <BookOpen className="w-4 h-4" />
            Section {page + 1} of {trainingContent.length}
          </div>
          <h2 className="font-display text-xl font-bold mb-4">{section.title}</h2>
          <div className="w-full bg-muted rounded-full h-1.5 mb-5">
            <div className="bg-primary h-1.5 rounded-full transition-all" style={{ width: `${((page + 1) / trainingContent.length) * 100}%` }} />
          </div>
          <p className="text-sm leading-relaxed text-foreground">{section.content}</p>
        </div>

        <div className="flex gap-3">
          {page > 0 && (
            <Button variant="outline" onClick={() => setPage(p => p - 1)} className="flex-1 h-11">Back</Button>
          )}
          {page < trainingContent.length - 1 ? (
            <Button onClick={() => setPage(p => p + 1)} className="flex-1 h-11">
              Next <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          ) : (
            <Button onClick={() => setPhase('test')} className="flex-1 h-11 bg-primary">
              Start Quiz <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          )}
        </div>
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
          {passed ? 'Your app lesson is recorded; it is not proof of ABC-approved annual certification. Ask an administrator to review your current certificate and Server Awareness form.' : 'You need 3/4 to pass. Please review and try again.'}
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