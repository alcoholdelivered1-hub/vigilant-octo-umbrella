// Shared email MIME utilities used by Gmail-sending backend functions.

export function toBase64Url(str) {
  const encoder = new TextEncoder();
  const bytes = encoder.encode(str);
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function encodeSubject(subject) {
  const encoder = new TextEncoder();
  const bytes = encoder.encode(subject);
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return `=?UTF-8?B?${btoa(binary)}?=`;
}

export function buildMimeMessage({ to, from, subject, htmlBody }) {
  const mime = [
    `From: Alcohol Delivered by SipSwift <${from}>`,
    `To: ${to}`,
    `Subject: ${encodeSubject(subject)}`,
    `MIME-Version: 1.0`,
    `Content-Type: text/html; charset=UTF-8`,
    `Content-Transfer-Encoding: quoted-printable`,
    ``,
    htmlBody,
  ].join('\r\n');
  return toBase64Url(mime);
}

export async function getGmailSender(base44) {
  const { accessToken } = await base44.asServiceRole.connectors.getConnection('gmail');
  const profileRes = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/profile', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const profile = await profileRes.json();
  const senderEmail = profile.emailAddress;
  if (!senderEmail) throw new Error('Could not resolve Gmail sender address');
  return { accessToken, senderEmail };
}

export async function sendGmail(accessToken, to, senderEmail, subject, htmlBody) {
  const raw = buildMimeMessage({ to, from: senderEmail, subject, htmlBody });
  const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ raw }),
  });
  return res;
}