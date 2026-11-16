import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { CheckCircle2, Loader2, XCircle } from 'lucide-react';

const safeParse = value => {
  if (value === null || value === undefined) return null;
  if (typeof value === 'object') return value;
  try { return JSON.parse(value); } catch { return value; }
};

const isRunning = status => ['pending', 'running', 'in_progress'].includes(status);

function FunctionDisplay({ toolCall }) {
  const [expanded, setExpanded] = useState(false);
  const projection = toolCall.display_projection;
  const hideDetails = projection?.hide_details && projection?.details_redacted;
  const parsedResults = safeParse(toolCall.results);
  const failed = ['failed', 'error'].includes(toolCall.status)
    || /error|failed/i.test(String(toolCall.results || ''))
    || parsedResults?.success === false;
  const running = isRunning(toolCall.status);
  const statusText = failed
    ? (projection?.error_label || 'Failed')
    : running
      ? (projection?.active_label || 'Running…')
      : (projection?.label || 'Done');
  const StatusIcon = failed ? XCircle : running ? Loader2 : CheckCircle2;

  return (
    <div className="mt-1.5 text-xs text-muted-foreground">
      <button
        type="button"
        onClick={() => !hideDetails && setExpanded(value => !value)}
        className="flex min-h-6 items-center gap-1.5"
      >
        <StatusIcon className={`h-3.5 w-3.5 ${running ? 'animate-spin' : failed ? 'text-destructive' : 'text-emerald-600'}`} />
        <span className="font-medium">{toolCall.name}</span>
        <span>· {statusText}</span>
      </button>
      {expanded && !hideDetails && (
        <div className="mt-1 space-y-2 rounded-lg bg-background p-2">
          <div>
            <p className="mb-0.5 font-semibold">Parameters</p>
            <pre className="max-h-32 overflow-y-auto whitespace-pre-wrap break-all text-[11px]">{JSON.stringify(safeParse(toolCall.arguments_string), null, 2)}</pre>
          </div>
          <div>
            <p className="mb-0.5 font-semibold">Result</p>
            <pre className="max-h-40 overflow-y-auto whitespace-pre-wrap break-all text-[11px]">{JSON.stringify(parsedResults, null, 2)}</pre>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AssistantMessageBubble({ message }) {
  const isUser = message.role === 'user';
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm ${isUser ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
        {message.content ? (
          isUser
            ? <p className="whitespace-pre-wrap">{message.content}</p>
            : <div className="space-y-2 [&_li]:ml-4 [&_p]:leading-relaxed"><ReactMarkdown>{message.content}</ReactMarkdown></div>
        ) : null}
        {message.tool_calls?.map((toolCall, idx) => <FunctionDisplay key={idx} toolCall={toolCall} />)}
      </div>
    </div>
  );
}