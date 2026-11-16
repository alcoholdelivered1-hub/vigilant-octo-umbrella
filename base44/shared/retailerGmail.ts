export const BUSINESS_EMAIL = 'alcohol.delivered1@gmail.com';
export const contactsFor = store => [...new Set([store.email, ...(store.contact_emails || [])].filter(v => typeof v === 'string').map(v => v.trim().toLowerCase()).filter(v => v !== BUSINESS_EMAIL && v.length <= 254 && /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9.-]+\.[a-z]{2,}$/i.test(v)))].slice(0, 15);
export const header = (message, name) => message.payload?.headers?.find(h => h.name.toLowerCase() === name.toLowerCase())?.value || '';
export const addresses = value => (value.match(/[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9.-]+\.[a-z]{2,}/gi) || []).map(v => v.toLowerCase());
export async function gmailConnection(base44) {
  const { accessToken } = await base44.asServiceRole.connectors.getConnection('gmail');
  const api = async (path, options = {}) => {
    const response = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/${path}`, { ...options, headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' } });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error?.message || 'Gmail request failed.');
    return data;
  };
  const profile = await api('profile');
  if (profile.emailAddress?.toLowerCase() !== BUSINESS_EMAIL) throw new Error(`Connect ${BUSINESS_EMAIL} to use the business inbox.`);
  return api;
}
export function belongsToStore(thread, contacts) {
  return (thread.messages || []).some(m => [header(m, 'From'), header(m, 'To'), header(m, 'Cc')].some(value => addresses(value).some(email => contacts.includes(email))));
}
function decode(value) { return new TextDecoder().decode(Uint8Array.from(atob(value.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0))); }
function parts(payload, mime) {
  if (payload.mimeType === mime && payload.body?.data) return [decode(payload.body.data)];
  return (payload.parts || []).flatMap(part => parts(part, mime));
}
export function readableMessage(message) {
  const plain = parts(message.payload || {}, 'text/plain').join('\n');
  const html = parts(message.payload || {}, 'text/html').join('\n');
  const text = plain || html.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, '').replace(/<\s*(br|\/p|\/div|\/tr)\b[^>]*>/gi, '\n').replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
  return { id: message.id, from: header(message, 'From'), to: header(message, 'To'), subject: header(message, 'Subject'), date: header(message, 'Date'), text: text.slice(0, 60000) || message.snippet || '', incoming: !addresses(header(message, 'From')).includes(BUSINESS_EMAIL) };
}