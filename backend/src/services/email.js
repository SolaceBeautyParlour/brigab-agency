import "dotenv/config";

// Switched from nodemailer/SMTP to Brevo's HTTP API. This isn't a style
// preference — Render's free web services block outbound traffic on SMTP
// ports 25, 465, and 587 entirely (confirmed via Render's own changelog,
// September 2025). No SMTP credentials, correct or not, will ever get
// through on the free tier. Brevo sends over plain HTTPS instead, which is
// never blocked, and its free tier (300 emails/day) needs no domain of your
// own — without one, it just sends via a shared @brevosend.com address
// instead of your own domain, which is a cosmetic tradeoff, not a blocker.
const BREVO_API_KEY = process.env.BREVO_API_KEY;
const FROM_EMAIL = process.env.EMAIL_FROM || "no-reply@brigab.agency";
const FROM_NAME = "Brigab Agency";

async function sendViaBrevo({ to, subject, html }) {
  let res;
  try {
    res = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        accept: "application/json",
        "api-key": BREVO_API_KEY,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        sender: { name: FROM_NAME, email: FROM_EMAIL },
        to: [{ email: to }],
        subject,
        htmlContent: html,
      }),
    });
  } catch (err) {
    console.error("Brevo network error:", err.message);
    throw new Error("Couldn't reach the email service right now.");
  }

  let data;
  try {
    data = await res.json();
  } catch {
    throw new Error("Email service returned an unexpected response.");
  }

  if (!res.ok) {
    throw new Error(`Email send failed: ${data.message || JSON.stringify(data)}`);
  }
  return data;
}

export async function sendReceiptEmail({ to, name, hostelName, roomCode, deposit, serviceFee, balance, dueDate, reference }) {
  const html = `
    <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
      <h2 style="color:#16213A;">Room secured — ${hostelName}</h2>
      <p>Hi ${name}, here's your receipt.</p>
      <table style="width:100%; border-collapse: collapse; font-size: 14px;">
        <tr><td style="padding:6px 0; color:#666;">Room</td><td style="text-align:right;">${roomCode}</td></tr>
        <tr><td style="padding:6px 0; color:#666;">Deposit paid</td><td style="text-align:right;">GHS ${deposit}</td></tr>
        <tr><td style="padding:6px 0; color:#666;">Service fee (non-refundable)</td><td style="text-align:right;">GHS ${serviceFee}</td></tr>
        <tr><td style="padding:6px 0; color:#666;">Balance remaining</td><td style="text-align:right;">GHS ${balance}</td></tr>
        <tr><td style="padding:6px 0; color:#666;">Balance due date</td><td style="text-align:right;">${dueDate}</td></tr>
        <tr><td style="padding:6px 0; color:#666;">Reference</td><td style="text-align:right;">${reference}</td></tr>
      </table>
      <p style="color:#888; font-size:12px; margin-top:24px;">
        If the balance isn't paid by the due date, a grace period applies before the deposit is forfeited and the room is released. Manage your booking anytime from your Brigab dashboard.
      </p>
    </div>
  `;

  if (!BREVO_API_KEY) {
    console.log(`[Email - not configured, logging only] to ${to}: receipt for ${reference}`);
    return { skipped: true };
  }

  return sendViaBrevo({ to, subject: `Your room at ${hostelName} is secured`, html });
}

export async function sendManagerBookingEmail({ to, managerName, studentName, studentPhone, hostelName, roomCode, depositAmount, balanceAmount }) {
  const html = `
    <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
      <h2 style="color:#16213A;">New booking at ${hostelName}</h2>
      <p>Hi ${managerName}, a student just secured room ${roomCode}.</p>
      <table style="width:100%; border-collapse: collapse; font-size: 14px;">
        <tr><td style="padding:6px 0; color:#666;">Student</td><td style="text-align:right;">${studentName}</td></tr>
        <tr><td style="padding:6px 0; color:#666;">Phone</td><td style="text-align:right;">${studentPhone}</td></tr>
        <tr><td style="padding:6px 0; color:#666;">Deposit received</td><td style="text-align:right;">GHS ${depositAmount}</td></tr>
        <tr><td style="padding:6px 0; color:#666;">Balance remaining</td><td style="text-align:right;">GHS ${balanceAmount}</td></tr>
      </table>
      <p style="color:#888; font-size:12px; margin-top:24px;">
        The deposit has settled directly to your connected bank account via Paystack. Check your Brigab manager dashboard for the full booking list.
      </p>
    </div>
  `;

  if (!BREVO_API_KEY) {
    console.log(`[Email - not configured, logging only] to ${to}: new booking notification for room ${roomCode}`);
    return { skipped: true };
  }

  return sendViaBrevo({ to, subject: `New booking: room ${roomCode} at ${hostelName}`, html });
}
