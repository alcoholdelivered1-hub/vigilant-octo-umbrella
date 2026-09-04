import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { CheckCircle2, XCircle, ChevronRight, ChevronLeft, Award, ShieldCheck, AlertTriangle, BookOpen, Download, Loader2, Share2, ExternalLink } from 'lucide-react';
import TrainingVideoPlayer from '@/components/training/TrainingVideoPlayer';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

const MODULES = [
  {
    id: 'laws',
    title: 'Arkansas Alcohol Laws — Your Role as a Driver',
    icon: '⚖️',
    content: [
      {
        heading: 'Your Legal Responsibilities',
        body: 'As a delivery driver, YOU are the final checkpoint. You must be 21+, hold a valid driver\'s license, and have no felony convictions. You are personally responsible for verifying age and refusing illegal deliveries.',
      },
      {
        heading: 'Legal Delivery Hours',
        body: 'You may only deliver alcohol between 7:00 AM and 2:00 AM. Never deliver outside these hours, even if the app allows it. Wet/dry county restrictions apply — check the app for zone status before every delivery.',
      },
      {
        heading: 'Wet vs. Dry Counties',
        body: 'You may only deliver in wet counties — within the same county as the retailer, or an adjoining wet county. The app verifies the zone, but you must confirm the destination address makes sense. If something looks wrong, contact dispatch.',
      },
      {
        heading: 'Unattended Deliveries Are Illegal',
        body: 'Under ACT 157, you may NEVER leave alcohol unattended at a door, porch, or mailbox. You must hand the order directly to a verified 21+ recipient. No exceptions — even if the customer asks you to.',
      },
    ],
    quiz: [
      {
        question: 'As a driver, what must you do before handing over alcohol?',
        options: ['Leave it at the door', 'Verify the recipient\'s ID and age', 'Call the customer', 'Just check the address'],
        correct: 1,
      },
      {
        question: 'Until what time can you legally deliver alcohol?',
        options: ['10:00 PM', '12:00 AM', '2:00 AM', '4:00 AM'],
        correct: 2,
      },
      {
        question: 'Can you leave alcohol unattended if the customer asks?',
        options: ['Yes, with a note', 'Yes, if they paid extra', 'No, never', 'Only for small orders'],
        correct: 2,
      },
    ],
  },
  {
    id: 'refusal',
    title: 'Refusing Delivery — Intoxicated Customers',
    icon: '🧠',
    content: [
      {
        heading: 'When to Refuse Delivery',
        body: 'You MUST refuse delivery if the recipient: (1) is visibly intoxicated, (2) cannot produce valid ID, (3) appears to be under 21, or (4) is not the purchaser or a 21+ household member. Refusal is your legal duty, not a choice.',
      },
      {
        heading: 'Spotting Intoxication',
        body: 'Look for: slurred speech, stumbling or unsteady gait, glassy or bloodshot eyes, aggressive behavior, alcohol on the breath. If in doubt, refuse. You will not be penalized for a good-faith refusal.',
      },
      {
        heading: 'How to Refuse Professionally',
        body: 'Stay calm and polite. Say: "I\'m sorry, I cannot complete this delivery." Do not argue. Log the refusal in the app with the reason. Return the order to the store. Contact dispatch if the customer becomes hostile.',
      },
      {
        heading: 'Handling Difficult Situations',
        body: 'If a customer becomes aggressive, do not engage. Return to your vehicle, lock the doors, and call dispatch or 911 if you feel unsafe. Never argue or physically intervene. Your safety comes first.',
      },
    ],
    quiz: [
      {
        question: 'If a customer appears intoxicated, what should you do?',
        options: ['Deliver anyway', 'Deliver but warn them', 'Refuse the delivery', 'Charge extra'],
        correct: 2,
      },
      {
        question: 'Will you be penalized for a good-faith refusal?',
        options: ['Yes', 'No', 'Only after 3 refusals', 'Only on weekends'],
        correct: 1,
      },
      {
        question: 'If a customer becomes hostile, what is your first step?',
        options: ['Argue back', 'Call dispatch or 911 from your vehicle', 'Deliver to avoid conflict', 'Physically restrain them'],
        correct: 1,
      },
    ],
  },
  {
    id: 'id_verification',
    title: 'ID Verification at the Door',
    icon: '🪪',
    content: [
      {
        heading: 'Your ID Check Procedure',
        body: 'Before handing over the order: (1) Ask for ID, (2) Check it is government-issued and unexpired, (3) Verify the photo matches the person, (4) Confirm the date of birth shows 21+, (5) Check for vertical (under 21) IDs. If any step fails, refuse.',
      },
      {
        heading: 'Accepted Forms of ID',
        body: 'Accept: Arkansas Driver\'s License, State-issued ID card, US Passport or Passport Card, US Military ID. Do NOT accept: school IDs, expired IDs, vertical/minor IDs, or photocopies/photos on a phone.',
      },
      {
        heading: 'Spotting Fake IDs',
        body: 'Check for: misspelled words, uneven lamination, missing holograms, altered dates, or IDs that feel flimsy. Compare the photo carefully. If you suspect a fake ID, refuse the delivery and log it. You are not required to confiscate the ID.',
      },
      {
        heading: 'Who Can Receive the Order',
        body: 'You may deliver to: (1) the person who placed the order (if 21+), or (2) another person at the same household or workplace who is 21+. You must verify their ID regardless. Never deliver to a minor or someone who cannot prove their age.',
      },
    ],
    quiz: [
      {
        question: 'Which ID should you NOT accept?',
        options: ['AR Driver\'s License', 'US Passport', 'School ID', 'US Military ID'],
        correct: 2,
      },
      {
        question: 'What does a vertical driver\'s license typically indicate?',
        options: ['Over 21', 'Under 21', 'Commercial driver', 'Temporary visitor'],
        correct: 1,
      },
      {
        question: 'If you suspect a fake ID, what should you do?',
        options: ['Deliver anyway', 'Confiscate the ID', 'Refuse and log it', 'Call the police immediately'],
        correct: 2,
      },
    ],
  },
  {
    id: 'act157',
    title: 'ACT 157 — Your Legal Requirements',
    icon: '📜',
    content: [
      {
        heading: 'Your Personal Eligibility',
        body: 'Under ACT 157 §3-4-1101(d), you MUST be: (1) 21 years or older, (2) hold a valid driver\'s license, and (3) have NO felony convictions — ever, with no exceptions. Falsifying this is a criminal offense.',
      },
      {
        heading: 'Where You Can Deliver',
        body: 'You may deliver within the county where the retailer is located (if wet), or an adjoining wet county. Deliveries to dry counties are strictly prohibited. The app blocks illegal zones, but you must use judgment if the destination seems wrong.',
      },
      {
        heading: 'Securing the Order in Transit',
        body: 'Keep all alcohol in sealed packaging from the retailer. Store it in your trunk or behind the last row of seats — never in the driver area. No open containers in your vehicle at any time, ever.',
      },
      {
        heading: 'Your Personal Liability',
        body: 'As the driver, YOU are responsible for delivery compliance. If you deliver to a minor or an intoxicated person, YOU face fines, criminal charges, and loss of your job. The retailer is NOT liable for your violations. Take every delivery seriously.',
      },
    ],
    quiz: [
      {
        question: 'Under ACT 157, can a driver with a 10-year-old felony conviction deliver alcohol?',
        options: ['Yes, it was long ago', 'No — no felony convictions, ever', 'Yes, with a waiver', 'Only non-violent felonies'],
        correct: 1,
      },
      {
        question: 'Where should alcohol be stored in your vehicle?',
        options: ['In the passenger seat', 'In your lap', 'Trunk or behind last row of seats', 'In the cupholder'],
        correct: 2,
      },
      {
        question: 'Who is personally liable if you deliver to a minor?',
        options: ['The retailer', 'The customer', 'You, the driver', 'The app company'],
        correct: 2,
      },
    ],
  },
  {
    id: 'minors',
    title: 'Refusing Service & Handling Minors',
    icon: '🤝',
    content: [
      {
        heading: 'Never Deliver to a Minor',
        body: 'Delivering alcohol to someone under 21 is "furnishing alcohol to a minor" — a serious criminal offense in Arkansas. Even if an adult at the door says "it\'s for my kid," refuse. No exceptions, no excuses.',
      },
      {
        heading: 'Third-Party Purchases',
        body: 'If someone other than the purchaser tries to receive the order, they must still be 21+ and present valid ID. If a minor answers the door, do not hand over the order. Ask for the person who placed the order or another 21+ adult.',
      },
      {
        heading: 'Documenting Refusals',
        body: 'Every refusal must be logged in the app with: the reason (intoxicated, minor, no ID, wrong person), the time, and the address. This protects you legally and provides an audit trail for ABC compliance.',
      },
      {
        heading: 'Returning Undelivered Orders',
        body: 'If you refuse a delivery, return the sealed order to the retailer. Do not consume, keep, or resell any undelivered alcohol. Log the return in the app. You will still be paid for the attempted delivery.',
      },
    ],
    quiz: [
      {
        question: 'If an adult says the alcohol is for their underage child, what do you do?',
        options: ['Deliver it', 'Refuse', 'Deliver and log it', 'Charge double'],
        correct: 1,
      },
      {
        question: 'What must you do after every refused delivery?',
        options: ['Nothing', 'Log it in the app with the reason', 'Call the police', 'Throw away the order'],
        correct: 1,
      },
      {
        question: 'What should you do with an undelivered alcohol order?',
        options: ['Keep it', 'Consume it', 'Return it sealed to the retailer', 'Resell it'],
        correct: 2,
      },
    ],
  },
];

function QuizQuestion({ question, options, correct, onAnswer, answered }) {
  const [selected, setSelected] = useState(null);

  const handleSelect = (idx) => {
    if (answered !== null) return;
    setSelected(idx);
    onAnswer(idx === correct);
  };

  return (
    <div className="space-y-3">
      <p className="font-semibold text-sm">{question}</p>
      <div className="space-y-2">
        {options.map((opt, idx) => {
          let style = 'border-border bg-card hover:bg-muted cursor-pointer';
          if (selected !== null) {
            if (idx === correct) style = 'border-emerald-400 bg-emerald-50 text-emerald-800';
            else if (idx === selected && idx !== correct) style = 'border-red-400 bg-red-50 text-red-800';
            else style = 'border-border bg-card opacity-50';
          }
          return (
            <button
              key={idx}
              onClick={() => handleSelect(idx)}
              className={cn('w-full text-left px-4 py-3 rounded-xl border-2 text-sm transition-all flex items-center justify-between', style)}
            >
              <span>{opt}</span>
              {selected !== null && idx === correct && <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />}
              {selected !== null && idx === selected && idx !== correct && <XCircle className="w-4 h-4 text-red-500 flex-shrink-0" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ModuleView({ module, onComplete }) {
  const [phase, setPhase] = useState('learn'); // 'learn' | 'quiz'
  const [contentPage, setContentPage] = useState(0);
  const [quizAnswers, setQuizAnswers] = useState(Array(module.quiz.length).fill(null));
  const [quizDone, setQuizDone] = useState(false);

  const totalContent = module.content.length;
  const allAnswered = quizAnswers.every(a => a !== null);
  const score = quizAnswers.filter(a => a === true).length;
  const passed = score >= Math.ceil(module.quiz.length * 0.67);

  const handleQuizAnswer = (qIdx, correct) => {
    const updated = [...quizAnswers];
    updated[qIdx] = correct;
    setQuizAnswers(updated);
    if (updated.every(a => a !== null)) setQuizDone(true);
  };

  const handleRetry = () => {
    setQuizAnswers(Array(module.quiz.length).fill(null));
    setQuizDone(false);
  };

  return (
    <div className="space-y-6">
      {/* Phase toggle */}
      <div className="flex gap-2 bg-muted p-1 rounded-xl">
        <button
          onClick={() => setPhase('learn')}
          className={cn('flex-1 py-2 rounded-lg text-sm font-medium transition-all', phase === 'learn' ? 'bg-card shadow text-foreground' : 'text-muted-foreground')}
        >
          📖 Learn
        </button>
        <button
          onClick={() => setPhase('quiz')}
          className={cn('flex-1 py-2 rounded-lg text-sm font-medium transition-all', phase === 'quiz' ? 'bg-card shadow text-foreground' : 'text-muted-foreground')}
        >
          ✏️ Quiz
        </button>
      </div>

      {phase === 'learn' && (
        <div className="space-y-4">
          <TrainingVideoPlayer moduleId={module.id} title={module.title} />
          <div className="bg-card border rounded-2xl p-6 space-y-3 min-h-[220px]">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              {contentPage + 1} of {totalContent}
            </p>
            <h3 className="font-display text-lg font-bold">{module.content[contentPage].heading}</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">{module.content[contentPage].body}</p>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setContentPage(p => p - 1)} disabled={contentPage === 0} className="flex-1">
              <ChevronLeft className="w-4 h-4 mr-1" /> Previous
            </Button>
            {contentPage < totalContent - 1 ? (
              <Button onClick={() => setContentPage(p => p + 1)} className="flex-1">
                Next <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            ) : (
              <Button onClick={() => setPhase('quiz')} className="flex-1 bg-emerald-600 hover:bg-emerald-700">
                Take Quiz <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            )}
          </div>
        </div>
      )}

      {phase === 'quiz' && (
        <div className="space-y-5">
          {module.quiz.map((q, idx) => (
            <QuizQuestion
              key={idx}
              question={q.question}
              options={q.options}
              correct={q.correct}
              answered={quizAnswers[idx]}
              onAnswer={(correct) => handleQuizAnswer(idx, correct)}
            />
          ))}

          {quizDone && (
            <div className={cn('rounded-2xl p-5 text-center space-y-3 border-2', passed ? 'bg-emerald-50 border-emerald-300' : 'bg-red-50 border-red-300')}>
              <p className="text-2xl">{passed ? '🎉' : '❌'}</p>
              <p className={cn('font-bold text-lg', passed ? 'text-emerald-800' : 'text-red-800')}>
                {passed ? 'Module Passed!' : 'Not quite — try again'}
              </p>
              <p className={cn('text-sm', passed ? 'text-emerald-700' : 'text-red-700')}>
                Score: {score}/{module.quiz.length}
              </p>
              {passed ? (
                <Button onClick={onComplete} className="bg-emerald-600 hover:bg-emerald-700 w-full">
                  <CheckCircle2 className="w-4 h-4 mr-2" /> Complete Module
                </Button>
              ) : (
                <Button variant="outline" onClick={handleRetry} className="w-full">Retry Quiz</Button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function AlcoholSafetyTraining() {
  const [activeModule, setActiveModule] = useState(null);
  const [completed, setCompleted] = useState(() => {
    try { return JSON.parse(localStorage.getItem('ast_completed') || '[]'); } catch { return []; }
  });
  const [generatingPptx, setGeneratingPptx] = useState(false);

  const { data: user } = useQuery({ queryKey: ['me'], queryFn: () => base44.auth.me() });

  const handleDownloadPptx = async () => {
    setGeneratingPptx(true);
    toast('Generating PowerPoint...', { description: 'This may take a few seconds.' });
    const res = await base44.functions.invoke('generateTrainingPPTX', {});
    setGeneratingPptx(false);
    if (res.data?.download_url) {
      window.open(res.data.download_url, '_blank');
      toast.success('PowerPoint downloaded!');
    } else {
      toast.error(res.data?.error || 'Failed to generate PowerPoint');
    }
  };

  const handleComplete = async (moduleId) => {
    const updated = [...new Set([...completed, moduleId])];
    setCompleted(updated);
    localStorage.setItem('ast_completed', JSON.stringify(updated));
    setActiveModule(null);
    toast.success('Module completed!');

    if (updated.length === MODULES.length && user) {
      try {
        await base44.auth.updateMe({ safety_training_completed: true, safety_training_date: new Date().toISOString() });
        toast.success('🎓 Safety Training Certified!', { description: 'Your certification has been saved to your account.' });
      } catch {}
    }
  };

  const allDone = completed.length === MODULES.length;
  const progress = Math.round((completed.length / MODULES.length) * 100);

  if (activeModule) {
    const mod = MODULES.find(m => m.id === activeModule);
    return (
      <div className="max-w-2xl mx-auto px-4 py-8">
        <button onClick={() => setActiveModule(null)} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6">
          <ChevronLeft className="w-4 h-4" /> Back to Training
        </button>
        <div className="flex items-center gap-3 mb-6">
          <span className="text-3xl">{mod.icon}</span>
          <div>
            <h1 className="font-display text-2xl font-bold">{mod.title}</h1>
            <p className="text-sm text-muted-foreground">Module {MODULES.findIndex(m => m.id === activeModule) + 1} of {MODULES.length}</p>
          </div>
        </div>
        <ModuleView module={mod} onComplete={() => handleComplete(activeModule)} />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div className="text-center space-y-2">
        <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
          <ShieldCheck className="w-8 h-8 text-primary" />
        </div>
        <h1 className="font-display text-3xl font-bold">Driver ACT 157 Certification</h1>
        <p className="text-muted-foreground text-sm max-w-sm mx-auto">
          Complete all modules to earn your Driver ACT 157 Certification — required before accepting your first delivery.
        </p>
        <div className="pt-1 flex flex-wrap gap-2 justify-center">
          <Button variant="outline" size="sm" onClick={handleDownloadPptx} disabled={generatingPptx} className="gap-2 rounded-xl">
            {generatingPptx ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            {generatingPptx ? 'Generating...' : 'Download PowerPoint (ABC)'}
          </Button>
          <Link to="/driver-training-overview" target="_blank">
            <Button variant="outline" size="sm" className="gap-2 rounded-xl">
              <Share2 className="w-4 h-4" /> Shareable / Printable Overview
            </Button>
          </Link>
        </div>
      </div>

      {/* Progress */}
      <div className="bg-card border rounded-2xl p-5 space-y-3">
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium">{completed.length} of {MODULES.length} modules complete</span>
          <span className="font-bold text-primary">{progress}%</span>
        </div>
        <div className="w-full h-2.5 bg-muted rounded-full overflow-hidden">
          <div className="h-full bg-primary rounded-full transition-all duration-500" style={{ width: `${progress}%` }} />
        </div>
        {allDone && (
          <div className="flex items-center gap-2 text-emerald-700 text-sm font-semibold">
            <Award className="w-4 h-4" /> Certified — all modules complete!
          </div>
        )}
      </div>

      {/* Certificate banner */}
      {allDone && (
        <div className="bg-gradient-to-br from-primary to-primary/80 rounded-2xl p-6 text-primary-foreground text-center space-y-2">
          <p className="text-3xl">🏆</p>
          <p className="font-display text-xl font-bold">Driver ACT 157 Certified</p>
          <p className="text-sm opacity-80">Issued by Alcohol Delivered · {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>
          <p className="text-xs opacity-60 mt-2">{user?.full_name || user?.email}</p>
        </div>
      )}

      {/* Modules */}
      <div className="space-y-3">
        {MODULES.map((mod, i) => {
          const done = completed.includes(mod.id);
          return (
            <button
              key={mod.id}
              onClick={() => setActiveModule(mod.id)}
              className={cn(
                'w-full text-left bg-card border rounded-2xl p-5 hover:shadow-md transition-all flex items-center gap-4',
                done ? 'border-emerald-200 bg-emerald-50/30' : 'border-border'
              )}
            >
              <span className="text-3xl flex-shrink-0">{mod.icon}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-semibold text-sm">{mod.title}</p>
                  {done && <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {mod.content.length} lessons · {mod.quiz.length} quiz questions
                </p>
              </div>
              <div className={cn(
                'w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold',
                done ? 'bg-emerald-100 text-emerald-700' : 'bg-muted text-muted-foreground'
              )}>
                {done ? '✓' : i + 1}
              </div>
            </button>
          );
        })}
      </div>

      {/* Legal note */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3 text-sm text-amber-800">
        <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
        <div>
          <p className="font-semibold">Required under Arkansas ACT 157 (2025)</p>
          <p className="text-xs text-amber-700 mt-1">ACT 157 (A.C.A. §3-4-1106) requires all third-party delivery permit holders to maintain an ABC-approved training program covering: identifying underage/intoxicated persons, valid ID recognition, and wet/dry territory rules.</p>
        </div>
      </div>
    </div>
  );
}