import nodemailer from 'nodemailer';
import {
  CORS_ORIGINS,
  SMTP_FROM,
  SMTP_HOST,
  SMTP_PASS,
  SMTP_PORT,
  SMTP_SECURE,
  SMTP_USER,
} from '../config/env.js';

let transporter;

const getTransporter = () => {
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS || !SMTP_FROM) {
    throw new Error('Email verification delivery is not configured.');
  }

  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_SECURE,
      auth: { user: SMTP_USER, pass: SMTP_PASS },
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 15000,
      tls: { minVersion: 'TLSv1.2', rejectUnauthorized: true },
    });
  }

  return transporter;
};

const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
}[character]));

export const sendVerificationEmail = async ({ to, name, token }) => {
  const frontendOrigin = CORS_ORIGINS[0] || 'http://localhost:5173';
  const verificationUrl = new URL('/verify-email', frontendOrigin);
  verificationUrl.searchParams.set('email', to);
  verificationUrl.searchParams.set('token', token);

  const safeName = escapeHtml(name);
  const safeUrl = escapeHtml(verificationUrl.toString());

  await getTransporter().sendMail({
    from: SMTP_FROM,
    to,
    subject: 'Verify your Geeta University Discussion account',
    text: `Hello ${name},\n\nVerify your university email using this one-time link (expires in 1 hour):\n${verificationUrl}\n\nIf you did not create this account, you can ignore this email.`,
    html: `<p>Hello ${safeName},</p><p>Verify your university email using the link below. It expires in 1 hour and can only be used once.</p><p><a href="${safeUrl}">Verify university email</a></p><p>If you did not create this account, you can ignore this email.</p>`,
  });
};
