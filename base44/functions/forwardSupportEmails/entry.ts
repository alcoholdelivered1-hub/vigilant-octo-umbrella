import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

function buildRawEmail(to, subject, body) {
  const message = [
    `From: Alcohol Delivered Support <alcohol.delivered1@gmail.com>`,
    `To: ${to}`,
    `Subject: ${subject}`,
    `MIME-Version: 1.0`,
    `Content-Type: text/plain; charset=UTF-8`,
    ``,
    body,
  ].join('\r\n');
  return btoa(unescape(encodeURIComponent(message)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// Default recipients always get a copy
const DEFAULT_RECIPIENTS = [
  'alcohol.delivered1@gmail.com',
  
];

// Routing rules: if the email (subject + body) contains any keyword (case-insensitive),
// the listed extra recipients are also notified.
const ROUTING_RULES = [
  {
    name: 'Pine Bluff / Jefferson County',
    keywords: ['pine bluff', 'jefferson county', 'jefferson co', 'pine bluff store'],
    extra_recipients: [],
  },
  {
    name: 'Little Rock / Pulaski County',
    keywords: ['little rock', 'pulaski county', 'pulaski co'],
    extra_recipients: ['alcohol.delivered1@gmail.com'],
  },
  {
    name: 'Hot Springs / Garland County',
    keywords: ['hot springs', 'garland county', 'garland co'],
    extra_recipients: ['alcohol.delivered1@gmail.com'],
  },
  {
    name: 'Delivery Issue',
    keywords: ['delivery issue', 'late delivery', 'missing order', 'wrong order', 'delivery problem'],
    extra_recipients: ['alcohol.delivered1@gmail.com'],
  },
  {
    name: 'Compliance / Legal',
    keywords: ['compliance', 'license', 'violation', 'abc board', 'act 157', 'regulatory', 'legal'],
    extra_recipients: ['Drew.Cousins@dfa.arkansas.gov'],
  },
  {
    name: 'Driver Complaint',
    keywords: ['driver', 'delivery driver', 'driver complaint', 'driver behavior'],
    extra_recipients: ['alcohol.delivered1@gmail.com'],
  },
];

function resolveRecipients(subject, bodyText) {
  const haystack = `${subject} ${bodyText}`.toLowerCase();
  const recipients = new Set(DEFAULT_RECIPIENTS);

  const matchedRules = [];
  for (const rule of ROUTING_RULES) {
    const matched = rule.keywords.find(kw => haystack.includes(kw));
    if (matched) {
      matchedRules.push(rule.name);
      for (const r of rule.extra_recipients) recipients.add(r);
    }
  }

  return { recipients: [...recipients], matchedRules };
}

Deno.serve(async (req) => {
  try {
    const body = await req.json();
    const base44 = createClientFromRequest(req);

    const messageIds = body.data?.new_message_ids ?? [];
    if (messageIds.length === 0) {
      return Response.json({ skipped: true, reason: 'no new messages' });
    }

    const { accessToken } = await base44.asServiceRole.connectors.getConnection('gmail');
    const authHeader = { Authorization: `Bearer ${accessToken}` };

    let forwarded = 0;

    for (const messageId of messageIds) {
      const res = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}?format=full`,
        { headers: authHeader }
      );
      if (!res.ok) {
        console.error(`Failed to fetch message ${messageId}:`, await res.text());
        continue;
      }

      const message = await res.json();
      const headers = message.payload?.headers ?? [];

      const getHeader = (name) =>
        headers.find(h => h.name.toLowerCase() === name.toLowerCase())?.value ?? '';

      const fromHeader = getHeader('From');
      const subjectHeader = getHeader('Subject');
      const dateHeader = getHeader('Date');

      // Extract plain text body
      let bodyText = '';
      const parts = message.payload?.parts ?? [];
      const textPart = parts.find(p => p.mimeType === 'text/plain') ??
                       (message.payload?.mimeType === 'text/plain' ? message.payload : null);
      if (textPart?.body?.data) {
        bodyText = atob(textPart.body.data.replace(/-/g, '+').replace(/_/g, '/'));
      }

      // Determine recipients based on content
      const { recipients, matchedRules } = resolveRecipients(subjectHeader, bodyText);

      const routingNote = matchedRules.length > 0
        ? `Routing triggered by: ${matchedRules.join(', ')}`
        : 'No specific routing rules matched — sent to default team.';

      const emailBody = `---------- Forwarded Support Email ----------
From: ${fromHeader}
Date: ${dateHeader}
Subject: ${subjectHeader}

${bodyText || '(No plain text body — please check the original email)'}

---------- Routing Info ----------
${routingNote}
Sent to: ${recipients.join(', ')}
---------- End of Forwarded Message ----------
Forwarded by Alcohol Delivered support system.`;

      for (const recipient of recipients) {
        const rawEmail = buildRawEmail(recipient, `[Support FWD] ${subjectHeader}`, emailBody);
        const sendRes = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
          method: 'POST',
          headers: { ...authHeader, 'Content-Type': 'application/json' },
          body: JSON.stringify({ raw: rawEmail }),
        });
        if (!sendRes.ok) {
          const errText = await sendRes.text();
          console.error(`Failed to send to ${recipient}: ${errText}`);
        } else {
          console.log(`Forwarded "${subjectHeader}" to ${recipient} | Rules: ${matchedRules.join(', ') || 'default'}`);
        }
      }

      forwarded++;
    }

    return Response.json({ success: true, forwarded });
  } catch (error) {
    console.error('forwardSupportEmails error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});