// Sends e-mails with nodemailer.
// If SMTP_HOST is empty (development), the e-mail is only printed in the console.
import nodemailer from "nodemailer";

const transporter = process.env.SMTP_HOST
  ? nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT) || 587,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    })
  : null;

export async function sendEmail(to, subject, text) {
  if (!transporter) {
    console.log(`\n📧 E-mail to: ${to}\nSubject: ${subject}\n${text}\n`);
    return;
  }

  // A failed e-mail must never break the main action (booking, adding a doctor...)
  try {
    await transporter.sendMail({ from: process.env.SMTP_FROM, to, subject, text });
  } catch (err) {
    console.error("E-mail could not be sent:", err.message);
  }
}
