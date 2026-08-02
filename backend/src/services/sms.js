import "dotenv/config";

const SMS_PROVIDER = process.env.SMS_PROVIDER || "arkesel";

const ARKESEL_API_KEY = process.env.ARKESEL_API_KEY;
const ARKESEL_SENDER_ID = process.env.ARKESEL_SENDER_ID || "Brigab";

const HUBTEL_CLIENT_ID = process.env.HUBTEL_CLIENT_ID;
const HUBTEL_CLIENT_SECRET = process.env.HUBTEL_CLIENT_SECRET;
const HUBTEL_SENDER_ID = process.env.HUBTEL_SENDER_ID || "Brigab";

function normalizePhone(toPhone) {
  return toPhone.startsWith("+") ? toPhone : `+233${toPhone.replace(/^0/, "")}`;
}

async function sendViaArkesel(toPhone, message) {
  let res;
  try {
    res = await fetch("https://sms.arkesel.com/api/v2/sms/send", {
      method: "POST",
      headers: { "api-key": ARKESEL_API_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({
        sender: ARKESEL_SENDER_ID,
        message,
        recipients: [normalizePhone(toPhone)],
      }),
    });
  } catch (err) {
    console.error("Arkesel network error:", err.message);
    throw new Error("Couldn't reach the SMS service right now.");
  }

  let data;
  try {
    data = await res.json();
  } catch {
    throw new Error("SMS service returned an unexpected response.");
  }

  if (data.status !== "success") {
    throw new Error(`SMS send failed: ${data.message || JSON.stringify(data)}`);
  }
  return data;
}

async function sendViaHubtel(toPhone, message) {
  const normalized = normalizePhone(toPhone);
  const auth = Buffer.from(`${HUBTEL_CLIENT_ID}:${HUBTEL_CLIENT_SECRET}`).toString("base64");
  const res = await fetch(
    `https://smsc.hubtel.com/v1/messages/send?clientid=${HUBTEL_CLIENT_ID}&clientsecret=${HUBTEL_CLIENT_SECRET}&from=${HUBTEL_SENDER_ID}&to=${encodeURIComponent(normalized)}&content=${encodeURIComponent(message)}`,
    { headers: { Authorization: `Basic ${auth}` } }
  );
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`SMS send failed: ${text}`);
  }
  return res.json();
}

/**
 * Sends an SMS via whichever provider is configured (SMS_PROVIDER env var,
 * defaults to Arkesel). Switching providers later — e.g. once Hubtel's
 * Sender ID clears — is a one-line .env change, not a code change.
 */
export async function sendSMS(toPhone, message) {
  const provider = SMS_PROVIDER.toLowerCase();

  if (provider === "arkesel" && !ARKESEL_API_KEY) {
    console.log(`[SMS - Arkesel not configured, logging only] to ${toPhone}: ${message}`);
    return { skipped: true };
  }
  if (provider === "hubtel" && !HUBTEL_CLIENT_ID) {
    console.log(`[SMS - Hubtel not configured, logging only] to ${toPhone}: ${message}`);
    return { skipped: true };
  }

  if (provider === "hubtel") return sendViaHubtel(toPhone, message);
  return sendViaArkesel(toPhone, message);
}

export const smsTemplates = {
  bookingReceipt: (name, ref, balance, dueDate) =>
    `Hi ${name}, your room is secured! Ref: ${ref}. Balance of GHS ${balance} is due by ${dueDate}. — Brigab Agency`,
  reminder2Weeks: (name, amount, dueDate) =>
    `Hi ${name}, a reminder: GHS ${amount} balance is due on ${dueDate} (2 weeks away). Pay anytime from your Brigab dashboard.`,
  reminder3Days: (name, amount, dueDate) =>
    `Hi ${name}, your GHS ${amount} balance is due in 3 days (${dueDate}). Pay now to keep your room. — Brigab`,
  reminderDeadline: (name, amount) =>
    `Hi ${name}, today is the deadline to pay your GHS ${amount} balance. After a short grace period, unpaid rooms are released. — Brigab`,
  graceWarning: (name, graceEnd) =>
    `Hi ${name}, your balance is overdue. You have until ${graceEnd} before your deposit is forfeited and the room is released. Please pay now.`,
  forfeited: (name) =>
    `Hi ${name}, your room reservation has been released after non-payment of balance. Your deposit is non-refundable per our policy. — Brigab`,
  waitlistClaim: (name, hostelName, roomCode) =>
    `Hi ${name}, a bed just opened up at ${hostelName} (room ${roomCode})! You have 24 hours to claim it on Brigab before it passes to the next student.`,
};
