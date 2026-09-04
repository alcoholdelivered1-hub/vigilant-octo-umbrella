import React, { useState } from 'react';
import { CheckCircle2, XCircle, ChevronRight, BookOpen, ShieldCheck, AlertTriangle, Gavel } from 'lucide-react';
import { Button } from '@/components/ui/button';
import TrainingVideoPlayer from '@/components/training/TrainingVideoPlayer';

const MODULES = [
  {
    id: 'laws',
    icon: Gavel,
    title: 'Arkansas Alcohol Delivery Laws',
    content: [
      'You must hold a valid Arkansas driver\'s license and be at least 21 years old.',
      'Alcohol may only be delivered in wet counties or wet areas within Jefferson County, AR.',
      'Deliveries are only permitted during legal alcohol sale hours (typically 7:00 AM – 2:00 AM).',
      'You are NOT the seller — the licensed retailer remains the legal seller of all alcohol.',
      'You are responsible for compliance during the delivery portion of every transaction.',
      'Violating Arkansas ABC regulations can result in fines, criminal charges, and loss of your driving privileges.',
    ],
  },
  {
    id: 'id_checks',
    icon: ShieldCheck,
    title: 'ID Verification Requirements',
    content: [
      'You MUST verify a government-issued photo ID for every delivery recipient.',
      'Accepted IDs: Driver\'s License, Passport, State ID, Military ID.',
      'The recipient must be 21 years of age or older — check the date of birth on the ID.',
      'If the ID is expired, do NOT complete the delivery.',
      'Watch for signs of a fake ID: holograms, font inconsistencies, blurry photos.',
      'Never deliver to someone who cannot or refuses to present a valid ID.',
    ],
  },
  {
    id: 'intoxication',
    icon: AlertTriangle,
    title: 'Recognizing Intoxication & Refusal Policy',
    content: [
      'You must REFUSE delivery if the recipient appears visibly intoxicated.',
      'Signs of intoxication: slurred speech, loss of balance, bloodshot eyes, strong odor of alcohol.',
      'Never deliver to a person who cannot safely receive the package.',
      'If refused, mark the order as "refused" in the app and record the reason.',
      'You will NOT be penalized for refusing a delivery — refusals protect you and the company.',
      'Contact dispatch immediately after any refusal for documentation.',
    ],
  },
];

const QUIZ = [
  {
    q: 'What is the minimum age to be an alcohol delivery driver in Arkansas?',
    options: ['18', '19', '21', '25'],
    answer: 2,
  },
  {
    q: 'Which of the following is NOT an accepted form of ID for age verification?',
    options: ['Driver\'s License', 'Passport', 'Student ID', 'Military ID'],
    answer: 2,
  },
  {
    q: 'What should you do if a customer appears visibly intoxicated?',
    options: [
      'Deliver anyway since they already paid',
      'Ask a neighbor to accept the delivery',
      'Refuse the delivery and report it in the app',
      'Leave the order at the door',
    ],
    answer: 2,
  },
  {
    q: 'Who is the legal seller of alcohol in a delivery transaction?',
    options: ['The delivery driver', 'The customer', 'Alcohol Delivered (the platform)', 'The licensed retailer'],
    answer: 3,
  },
  {
    q: 'Can you deliver alcohol to a wet county adjacent to Jefferson County?',
    options: ['Yes, if the order was placed there', 'No, only within Jefferson County', 'Yes, within the same county or adjacent wet county', 'Only with admin approval'],
    answer: 2,
  },
];

export default function TrainingModule({ onComplete }) {
  const [phase, setPhase] = useState('modules'); // 'modules' | 'quiz' | 'results'
  const [moduleIndex, setModuleIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [quizIndex, setQuizIndex] = useState(0);
  const [submitted, setSubmitted] = useState(false);

  const mod = MODULES[moduleIndex];
  const ModIcon = mod?.icon;

  const handleAnswer = (idx) => {
    if (answers[quizIndex] !== undefined) return;
    setAnswers(prev => ({ ...prev, [quizIndex]: idx }));
  };

  const nextQuestion = () => {
    if (quizIndex < QUIZ.length - 1) {
      setQuizIndex(q => q + 1);
    } else {
      setSubmitted(true);
      setPhase('results');
    }
  };

  const score = QUIZ.filter((q, i) => answers[i] === q.answer).length;
  const passed = score === QUIZ.length;

  if (phase === 'results') {
    return (
      <div className="space-y-5 text-center">
        <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mx-auto ${passed ? 'bg-emerald-100' : 'bg-red-100'}`}>
          {passed ? <CheckCircle2 className="w-8 h-8 text-emerald-600" /> : <XCircle className="w-8 h-8 text-red-600" />}
        </div>
        <div>
          <h3 className="font-display text-xl font-bold">{passed ? 'Training Passed!' : 'Training Not Passed'}</h3>
          <p className="text-muted-foreground mt-1 text-sm">
            You scored <strong>{score}/{QUIZ.length}</strong>. {passed ? 'You may proceed with your application.' : 'A 100% pass rate is required. Please review the training materials and retake the quiz.'}
          </p>
        </div>
        {!passed && (
          <Button variant="outline" onClick={() => { setPhase('modules'); setModuleIndex(0); setAnswers({}); setQuizIndex(0); setSubmitted(false); }}>
            Retake Training
          </Button>
        )}
        {passed && (
          <Button onClick={onComplete} className="w-full rounded-xl h-11">
            <CheckCircle2 className="w-4 h-4 mr-2" /> Complete Training & Continue
          </Button>
        )}
      </div>
    );
  }

  if (phase === 'quiz') {
    const q = QUIZ[quizIndex];
    const selected = answers[quizIndex];
    return (
      <div className="space-y-5">
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>Question {quizIndex + 1} of {QUIZ.length}</span>
          <div className="flex gap-1">
            {QUIZ.map((_, i) => (
              <div key={i} className={`w-2 h-2 rounded-full ${i < quizIndex ? 'bg-primary' : i === quizIndex ? 'bg-secondary' : 'bg-muted'}`} />
            ))}
          </div>
        </div>
        <p className="font-semibold text-base leading-relaxed">{q.q}</p>
        <div className="space-y-2">
          {q.options.map((opt, i) => {
            const isSelected = selected === i;
            const isCorrect = i === q.answer;
            let cls = 'border rounded-xl px-4 py-3 text-sm cursor-pointer transition-all text-left w-full ';
            if (selected !== undefined) {
              if (isCorrect) cls += 'bg-emerald-50 border-emerald-400 text-emerald-800 font-medium';
              else if (isSelected) cls += 'bg-red-50 border-red-400 text-red-800';
              else cls += 'border-border text-muted-foreground';
            } else {
              cls += 'hover:border-primary/50 hover:bg-muted/50 border-border';
            }
            return (
              <button key={i} className={cls} onClick={() => handleAnswer(i)}>
                {opt}
              </button>
            );
          })}
        </div>
        {selected !== undefined && (
          <Button onClick={nextQuestion} className="w-full rounded-xl h-11">
            {quizIndex < QUIZ.length - 1 ? 'Next Question' : 'See Results'}
            <ChevronRight className="w-4 h-4 ml-1" />
          </Button>
        )}
      </div>
    );
  }

  // Module reading phase
  return (
    <div className="space-y-5">
      {/* Module tabs */}
      <div className="flex gap-1 bg-muted p-1 rounded-xl">
        {MODULES.map((m, i) => (
          <button key={m.id} onClick={() => setModuleIndex(i)}
            className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-medium transition-all ${moduleIndex === i ? 'bg-card shadow text-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
            {m.title.split(' ').slice(0, 2).join(' ')}
          </button>
        ))}
      </div>

      {/* Module video */}
      <TrainingVideoPlayer moduleId={mod.id} title={mod.title} />

      {/* Module content */}
      <div className="bg-muted/30 rounded-2xl p-5 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <ModIcon className="w-5 h-5 text-primary" />
          </div>
          <h3 className="font-semibold">{mod.title}</h3>
        </div>
        <ul className="space-y-3">
          {mod.content.map((item, i) => (
            <li key={i} className="flex items-start gap-3 text-sm leading-relaxed">
              <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0 mt-0.5" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="flex gap-3">
        {moduleIndex > 0 && (
          <Button variant="outline" onClick={() => setModuleIndex(i => i - 1)} className="flex-1 rounded-xl">Back</Button>
        )}
        {moduleIndex < MODULES.length - 1 ? (
          <Button onClick={() => setModuleIndex(i => i + 1)} className="flex-1 rounded-xl">
            Next Module <ChevronRight className="w-4 h-4 ml-1" />
          </Button>
        ) : (
          <Button onClick={() => setPhase('quiz')} className="flex-1 rounded-xl h-11">
            <BookOpen className="w-4 h-4 mr-2" /> Take Knowledge Quiz
          </Button>
        )}
      </div>
    </div>
  );
}