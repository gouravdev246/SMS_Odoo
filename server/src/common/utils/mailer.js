import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import nodemailer from "nodemailer";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure environment variables are loaded regardless of import order
dotenv.config({ path: path.resolve(__dirname, "../../../../.env") });
dotenv.config({ path: path.resolve(__dirname, "../../../../../.env") });
dotenv.config({ path: path.resolve(__dirname, "../../../../../.env.local") });

/**
 * Cached nodemailer transporter instance.
 */
let cachedTransporter = null;

/**
 * Configure or retrieve Nodemailer transport.
 * Supports both EMAIL_USER/EMAIL_PASS and SMTP_USER/SMTP_PASS conventions.
 * Automatically cleans Gmail app passwords (stripping spaces).
 */
export const getTransporter = () => {
  if (cachedTransporter) {
    return cachedTransporter;
  }

  const user = (process.env.EMAIL_USER || process.env.SMTP_USER || "").trim();
  const rawPass = process.env.EMAIL_PASS || process.env.SMTP_PASS || "";
  const pass = rawPass.replace(/\s+/g, "").trim();

  if (!user || !pass) {
    return null;
  }

  const isGmail =
    user.toLowerCase().includes("@gmail.com") ||
    (process.env.SMTP_HOST || "").toLowerCase().includes("gmail");

  if (isGmail) {
    // Gmail dedicated service configuration
    cachedTransporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user,
        pass,
      },
    });
  } else {
    // Generic SMTP configuration
    const port = Number(process.env.SMTP_PORT || process.env.EMAIL_PORT) || 587;
    cachedTransporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || process.env.EMAIL_HOST || "smtp.gmail.com",
      port,
      secure: port === 465,
      auth: {
        user,
        pass,
      },
    });
  }

  return cachedTransporter;
};

// Store last sent OTP for development debugging/testing
export const devOtpStore = new Map();

/**
 * Generate a random 6-digit numeric OTP string.
 */
export const generateOtp = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

/**
 * Verify SMTP credentials and connectivity.
 */
export const verifySmtpConnection = async () => {
  const transporter = getTransporter();
  if (!transporter) {
    return {
      connected: false,
      message: "No SMTP credentials configured. Set EMAIL_USER/EMAIL_PASS or SMTP_USER/SMTP_PASS in .env",
    };
  }
  try {
    await transporter.verify();
    return { connected: true, message: "SMTP server connection verified successfully" };
  } catch (error) {
    return { connected: false, error: error.message };
  }
};

/**
 * Send an email with OTP or notification.
 */
export const sendEmail = async ({ to, subject, html, text }) => {
  const transporter = getTransporter();
  const emailUser = (process.env.EMAIL_USER || process.env.SMTP_USER || "").trim();
  const from = process.env.SMTP_FROM || process.env.EMAIL_FROM || (emailUser ? `"SMS Odoo" <${emailUser}>` : `"SMS Odoo" <no-reply@smsodoo.com>`);

  if (transporter) {
    try {
      const info = await transporter.sendMail({
        from,
        to,
        subject,
        text,
        html,
      });
      console.log(`[EMAIL SENT] Successfully sent email to ${to} (Message ID: ${info.messageId})`);
      return { success: true, messageId: info.messageId };
    } catch (error) {
      console.error(`[EMAIL ERROR] Failed to send email to ${to}:`, error.message);
      // Fallback to console output so development and testing continue smoothly
      console.log(`[EMAIL FALLBACK] To: ${to} | Subject: ${subject} | Content: ${text || html}`);
      return { success: false, fallback: true, error: error.message };
    }
  } else {
    // Development console logging when no credentials configured
    console.log(`\n======================================================`);
    console.log(`[DEV EMAIL SENDER]`);
    console.log(`To: ${to}`);
    console.log(`Subject: ${subject}`);
    console.log(`Body: ${text || html}`);
    console.log(`======================================================\n`);
    return { success: true, dev: true };
  }
};

/**
 * Helper to send OTP emails formatted cleanly.
 */
export const sendOtpEmail = async (email, otp, purpose = "Verification") => {
  devOtpStore.set(email.trim().toLowerCase(), otp);
  const subject = `Your ${purpose} OTP Code - SMS Odoo`;
  const text = `Your OTP for ${purpose} is: ${otp}. It is valid for 10 minutes.`;
  const html = `
    <div style="font-family: Arial, sans-serif; padding: 24px; color: #1e293b; max-width: 500px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px;">
      <h2 style="color: #0f172a; margin-top: 0;">Champions Club - ${purpose}</h2>
      <p style="font-size: 14px; color: #475569;">Hello,</p>
      <p style="font-size: 14px; color: #475569;">Please use the following One-Time Password (OTP) to complete your ${purpose.toLowerCase()}:</p>
      <div style="font-size: 32px; font-weight: bold; letter-spacing: 6px; color: #15803d; background: #f0fdf4; border: 1px dashed #86efac; border-radius: 8px; padding: 14px 20px; text-align: center; margin: 20px 0;">
        ${otp}
      </div>
      <p style="font-size: 13px; color: #64748b;">This OTP code is valid for <strong>10 minutes</strong>. Do not share this code with anyone.</p>
      <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
      <p style="font-size: 11px; color: #94a3b8; margin-bottom: 0;">If you did not request this verification code, please ignore this email or contact support.</p>
    </div>
  `;
  return sendEmail({ to: email, subject, text, html });
};
