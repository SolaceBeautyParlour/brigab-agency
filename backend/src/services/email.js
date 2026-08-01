import nodemailer from "nodemailer";
import "dotenv/config";

const transporter = process.env.SMTP_HOST
  ? nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    })
  : null;

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

  if (!transporter) {
    console.log(`[Email - not configured, logging only] to ${to}: receipt for ${reference}`);
    return { skipped: true };
  }

  return transporter.sendMail({
    from: `"Brigab Agency" <${process.env.SMTP_FROM || process.env.SMTP_USER}>`,
    to,
    subject: `Your room at ${hostelName} is secured`,
    html,
  });
}
