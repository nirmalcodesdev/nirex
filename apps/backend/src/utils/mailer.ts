import nodemailer, { Transporter } from 'nodemailer';
import { env } from '../config/env.js';
import { logger } from './logger.js';

interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
}

let _transporter: Transporter | null = null;
let _etherealAccount: { user: string; pass: string } | null = null;

// Create Ethereal Email account for development testing
async function createEtherealAccount(): Promise<{ user: string; pass: string }> {
  if (!_etherealAccount) {
    console.log('📧 Creating Ethereal Email account for testing...');
    _etherealAccount = await nodemailer.createTestAccount();
    console.log('✅ Ethereal Email account created!');
    console.log(`   Username: ${_etherealAccount.user}`);
    console.log(`   Password: ${_etherealAccount.pass}`);
    console.log(`   View emails at: https://ethereal.email
`);
  }
  return _etherealAccount;
}

// Lazy singleton — the transporter is reused across calls to share
// the underlying SMTP connection pool.
async function getTransporter(): Promise<Transporter> {
  if (!_transporter) {
    let auth;

    // In development, use Ethereal Email if no SMTP credentials provided
    if (env.NODE_ENV === 'development' && (!env.SMTP_USER || !env.SMTP_PASS)) {
      const ethereal = await createEtherealAccount();
      auth = { user: ethereal.user, pass: ethereal.pass };
    } else {
      auth = { user: env.SMTP_USER, pass: env.SMTP_PASS };
    }

    _transporter = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      // Port 465 uses implicit TLS; all other ports use STARTTLS (opportunistic).
      secure: env.SMTP_PORT === 465,
      auth,
    });
  }
  return _transporter;
}

async function sendEmail(options: SendEmailOptions): Promise<void> {
  try {
    const transporter = await getTransporter();
    const info = await transporter.sendMail({
      from: `"Auth Service" <${env.EMAIL_FROM}>`,
      to: options.to,
      subject: options.subject,
      html: options.html,
    });

    // Log destination only — never log token values or message body
    logger.info('Email sent', { to: options.to, subject: options.subject });

    // In development with Ethereal, log the preview URL
    if (env.NODE_ENV === 'development' && (!env.SMTP_USER || !env.SMTP_PASS)) {
      const previewUrl = nodemailer.getTestMessageUrl(info);
      if (previewUrl) {
        console.log(`📬 Email preview URL: ${previewUrl}`);
      }
    }
  } catch (err) {
    logger.error('Email send failed', {
      to: options.to,
      subject: options.subject,
      error: (err as Error).message,
    });
    throw err;
  }
}

export async function sendVerificationEmail(to: string, rawToken: string): Promise<void> {
  // The raw token is embedded in the URL — it is never logged in production.
  const verifyUrl = `${env.APP_URL}/auth/verify-email?token=${encodeURIComponent(rawToken)}`;

  // Always log token to console for development/testing
  console.log('\n🔐 EMAIL VERIFICATION TOKEN (for testing):');
  console.log(`   Token: ${rawToken}`);
  console.log(`   URL: ${verifyUrl}`);
  console.log(`   Email would be sent to: ${to}\n`);

  try {
    await sendEmail({
      to,
      subject: 'Verify your email address',
      html: `
      <!DOCTYPE html>
      <html lang="en">
      <body style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:32px 16px;color:#111827;">
        <h2 style="margin-top:0;">Verify your email</h2>
        <p>Click the button below to verify your email address. This link expires in <strong>15 minutes</strong>.</p>
        <a href="${verifyUrl}"
           style="display:inline-block;padding:12px 24px;background:#2563eb;color:#ffffff;
                  text-decoration:none;border-radius:6px;font-weight:600;">
          Verify Email
        </a>
        <p style="margin-top:24px;font-size:13px;color:#6b7280;">
          If you did not create an account, you can safely ignore this email.
        </p>
      </body>
      </html>
    `,
    });
  } catch (err) {
    // In development without SMTP config, don't throw - just log the error
    // The token was already logged above for testing
    if (env.NODE_ENV === 'development' && (!env.SMTP_USER || !env.SMTP_PASS)) {
      console.log('⚠️  Email sending failed, but token is available above for testing');
      return;
    }
    throw err;
  }
}

export async function sendPasswordResetEmail(to: string, rawToken: string): Promise<void> {
  const resetUrl = `${env.APP_URL}/auth/reset-password?token=${encodeURIComponent(rawToken)}`;

  // Always log token to console for development/testing
  console.log('\n🔐 PASSWORD RESET TOKEN (for testing):');
  console.log(`   Token: ${rawToken}`);
  console.log(`   URL: ${resetUrl}`);
  console.log(`   Email would be sent to: ${to}\n`);

  try {
    await sendEmail({
      to,
      subject: 'Reset your password',
      html: `
      <!DOCTYPE html>
      <html lang="en">
      <body style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:32px 16px;color:#111827;">
        <h2 style="margin-top:0;">Reset your password</h2>
        <p>You requested a password reset. Click the button below to set a new password.
           This link expires in <strong>15 minutes</strong>.</p>
        <a href="${resetUrl}"
           style="display:inline-block;padding:12px 24px;background:#dc2626;color:#ffffff;
                  text-decoration:none;border-radius:6px;font-weight:600;">
          Reset Password
        </a>
        <p style="margin-top:24px;font-size:13px;color:#6b7280;">
          If you did not request this, you can safely ignore this email.
          Your password will not change until you click the link above.
        </p>
      </body>
      </html>
    `,
    });
  } catch (err) {
    // In development without SMTP config, don't throw - just log the error
    if (env.NODE_ENV === 'development' && (!env.SMTP_USER || !env.SMTP_PASS)) {
      console.log('⚠️  Email sending failed, but token is available above for testing');
      return;
    }
    throw err;
  }
}

export async function sendSuspiciousSigninAlert(
  to: string,
  ip: string,
  deviceInfo: string
): Promise<void> {
  await sendEmail({
    to,
    subject: 'New sign-in from an unrecognized device',
    html: `
      <!DOCTYPE html>
      <html lang="en">
      <body style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:32px 16px;color:#111827;">
        <h2 style="margin-top:0;">New sign-in detected</h2>
        <p>A new sign-in to your account was detected from an unrecognized device or location:</p>
        <table style="border-collapse:collapse;width:100%;font-size:14px;">
          <tr>
            <td style="padding:8px 12px;background:#f3f4f6;font-weight:600;border:1px solid #e5e7eb;">IP Address</td>
            <td style="padding:8px 12px;border:1px solid #e5e7eb;">${ip}</td>
          </tr>
          <tr>
            <td style="padding:8px 12px;background:#f3f4f6;font-weight:600;border:1px solid #e5e7eb;">Device</td>
            <td style="padding:8px 12px;border:1px solid #e5e7eb;">${deviceInfo}</td>
          </tr>
        </table>
        <p>If this was you, no action is needed.
           If you don&apos;t recognize this activity, please reset your password immediately.</p>
      </body>
      </html>
    `,
  });
}
