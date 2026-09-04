import { secrets } from "base44:runtime";

export interface SmsResult {
  success: boolean;
  messageSid?: string;
  error?: string;
  status?: number;
}

/**
 * Send an SMS via Twilio's REST API (web-standard fetch, no SDK dependency).
 * Credentials come from app secrets: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN,
 * TWILIO_FROM_NUMBER.
 */
export async function sendSms(to: string, body: string): Promise<SmsResult> {
  const accountSid = secrets.get("TWILIO_ACCOUNT_SID");
  const authToken = secrets.get("TWILIO_AUTH_TOKEN");
  const fromNumber = secrets.get("TWILIO_FROM_NUMBER");

  if (!accountSid || !authToken || !fromNumber) {
    return { success: false, error: "Twilio credentials not configured. Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_FROM_NUMBER in app settings." };
  }

  const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
  const form = new URLSearchParams();
  form.set("To", to);
  form.set("From", fromNumber);
  form.set("Body", body);

  try {
    const resp = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Basic ${btoa(`${accountSid}:${authToken}`)}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: form.toString(),
    });
    const data = await resp.json();
    if (!resp.ok) {
      return { success: false, status: resp.status, error: data?.message || `Twilio error ${resp.status}` };
    }
    return { success: true, messageSid: data.sid, status: resp.status };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

/**
 * Normalize a raw phone string to E.164 (+1XXXXXXXXXX for US 10/11-digit).
 * Returns null if the number can't be normalized to a valid length.
 */
export function normalizePhone(raw: string): string | null {
  if (!raw) return null;
  const digits = raw.replace(/[^0-9]/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  if (digits.length > 11) return `+${digits}`;
  return null;
}