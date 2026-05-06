import { createRequire } from 'module';
import nodemailer, { Transporter } from 'nodemailer';
import { env } from '../config/env.js';
import { logger } from './logger.js';
import { AppError } from '../types/index.js';

const require = createRequire(import.meta.url);
const nirexLogo = require.resolve('@nirex/assets/images/nirex.svg');


interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
}

interface BillingEmailBase {
  to: string;
  customerName?: string | null;
  planName?: string | null;
  billingPortalUrl?: string | null;
}

interface BillingPaymentEmail extends BillingEmailBase {
  amountCents: number;
  currency: string;
  invoiceNumber?: string | null;
  invoicePdfUrl?: string | null;
  hostedInvoiceUrl?: string | null;
  paidAt?: Date | null;
  dueDate?: Date | null;
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
      // Gmail requires TLS for port 587 (STARTTLS)
      tls: env.SMTP_PORT === 587 ? { rejectUnauthorized: false } : undefined,
      auth,
    });

    // Verify the transporter configuration
    try {
      await _transporter.verify();
      console.log('✅ SMTP configuration verified successfully');
    } catch (verifyErr) {
      console.error('❌ SMTP verification failed:', (verifyErr as Error).message);
      console.error('   Host:', env.SMTP_HOST, 'Port:', env.SMTP_PORT);
      // Don't throw here - let it fail on actual send so we can see the error
    }
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
      attachments: [
        {
          filename: 'logo.svg',
          path: nirexLogo,
          cid: 'nirex-logo',
          contentDisposition: 'inline'
        }
      ]
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

function escapeHtml(input: string | null | undefined): string {
  if (!input) return '';
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatMoney(amountCents: number, currency: string): string {
  const safeCurrency = (currency || 'usd').toUpperCase();
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: safeCurrency,
  }).format(amountCents / 100);
}

function formatDate(date: Date | null | undefined): string {
  if (!date) return 'N/A';
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
  }).format(date);
}

function emailShell(content: string, previewText?: string): string {
  const primaryColor = '#0f172a'; // nirex-accent / slate-900
  const accentColor = '#3b82f6';  // blue-500

  return `
<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" lang="en">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="x-apple-disable-message-reformatting" />
  <title>Nirex</title>
  <style type="text/css">
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
    body { 
      margin: 0; 
      padding: 0; 
      width: 100% !important; 
      -webkit-text-size-adjust: 100%; 
      -ms-text-size-adjust: 100%; 
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background-color: #f8fafc;
      color: #1e293b;
    }
    img { border: 0; height: auto; line-height: 100%; outline: none; text-decoration: none; }
    table { border-collapse: collapse !important; }
    .content-table { max-width: 600px; width: 100%; margin: 0 auto; background-color: #ffffff; }
    .container { padding: 40px 32px; }
    .header { padding-bottom: 32px; text-align: left; }
    .footer { padding: 32px; text-align: center; font-size: 13px; color: #64748b; background-color: #f8fafc; }
    .btn { 
      display: inline-block; 
      padding: 12px 24px; 
      background-color: ${primaryColor}; 
      color: #ffffff !important; 
      text-decoration: none; 
      border-radius: 8px; 
      font-weight: 600; 
      font-size: 15px;
      margin-top: 16px;
    }
    .badge {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 4px;
      font-size: 12px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.025em;
    }
    .badge-success { background-color: #dcfce7; color: #15803d; }
    .badge-warning { background-color: #fef9c3; color: #854d0e; }
    .badge-error { background-color: #fee2e2; color: #b91c1c; }
    h1 { font-size: 24px; font-weight: 700; color: #0f172a; margin: 0 0 16px 0; }
    p { font-size: 16px; line-height: 1.6; margin: 0 0 16px 0; color: #475569; }
    .divider { height: 1px; background-color: #e2e8f0; margin: 24px 0; }
    .info-box { background-color: #f1f5f9; border-radius: 12px; padding: 20px; margin-bottom: 24px; }
    .info-row { display: table; width: 100%; margin-bottom: 8px; }
    .info-label { display: table-cell; font-size: 13px; font-weight: 600; color: #64748b; width: 40%; }
    .info-value { display: table-cell; font-size: 14px; font-weight: 500; color: #1e293b; text-align: right; }
  </style>
</head>
<body>
  <div style="display: none; max-height: 0px; overflow: hidden;">${previewText || ''}</div>
  <table border="0" cellpadding="0" cellspacing="0" width="100%">
    <tr>
      <td align="center" style="padding: 24px 0;">
        <table border="0" cellpadding="0" cellspacing="0" class="content-table" style="border: 1px solid #e2e8f0; border-radius: 16px; overflow: hidden;">
          <tr>
            <td class="container">
              <div class="header">
                <img src="cid:nirex-logo" alt="Nirex" width="40" height="40" style="display: block;" />
              </div>
              ${content}
              <div class="divider"></div>
              <p style="font-size: 14px; margin-bottom: 0;">
                Best regards,<br />
                <strong>The Nirex Team</strong>
              </p>
            </td>
          </tr>
          <tr>
            <td class="footer">
              <p style="margin-bottom: 8px;">&copy; ${new Date().getFullYear()} Nirex. All rights reserved.</p>
              <p style="margin-bottom: 0;">
                You received this email because it's essential to your account usage.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;
}

function billingPortalLink(url: string | null | undefined): string {
  if (!url) return '';
  const safeUrl = escapeHtml(url);
  return `
    <div style="text-align: center; margin-top: 24px;">
      <a href="${safeUrl}" class="btn">
        Manage Subscription
      </a>
    </div>
  `;
}

export async function sendBillingCheckoutCompletedEmail(
  input: BillingEmailBase,
): Promise<void> {
  const name = escapeHtml(input.customerName) || 'there';
  const planName = escapeHtml(input.planName) || 'your new plan';
  await sendEmail({
    to: input.to,
    subject: `Subscription activated: ${planName}`,
    html: emailShell(`
      <h1>Subscription confirmed</h1>
      <p>Hi ${name},</p>
      <p>Your checkout completed successfully and <strong>${planName}</strong> is now active on your account. You now have full access to all features included in this plan.</p>
      <div class="info-box">
        <div class="info-row">
          <div class="info-label">Plan</div>
          <div class="info-value">${planName}</div>
        </div>
        <div class="info-row" style="margin-bottom: 0;">
          <div class="info-label">Status</div>
          <div class="info-value"><span class="badge badge-success">Active</span></div>
        </div>
      </div>
      ${billingPortalLink(input.billingPortalUrl)}
    `, `Your ${planName} subscription is now active.`),
  });
}

export async function sendBillingPaymentSucceededEmail(
  input: BillingPaymentEmail,
): Promise<void> {
  const name = escapeHtml(input.customerName) || 'there';
  const planName = escapeHtml(input.planName) || 'your current plan';
  const invoiceNumber = escapeHtml(input.invoiceNumber) || 'N/A';
  const amount = formatMoney(input.amountCents, input.currency);
  const paidAt = formatDate(input.paidAt);
  const hostedInvoiceUrl = input.hostedInvoiceUrl ? escapeHtml(input.hostedInvoiceUrl) : '';
  const invoicePdfUrl = input.invoicePdfUrl ? escapeHtml(input.invoicePdfUrl) : '';

  await sendEmail({
    to: input.to,
    subject: `Payment received: ${amount}`,
    html: emailShell(`
      <h1>Payment received</h1>
      <p>Hi ${name},</p>
      <p>Thank you for your payment. We have successfully processed the charge for your <strong>${planName}</strong> subscription.</p>
      
      <div class="info-box">
        <div class="info-row">
          <div class="info-label">Amount Paid</div>
          <div class="info-value">${amount}</div>
        </div>
        <div class="info-row">
          <div class="info-label">Invoice Number</div>
          <div class="info-value">${invoiceNumber}</div>
        </div>
        <div class="info-row" style="margin-bottom: 0;">
          <div class="info-label">Date</div>
          <div class="info-value">${paidAt}</div>
        </div>
      </div>

      <div style="margin-top: 24px; font-size: 14px;">
        ${hostedInvoiceUrl ? `<a href="${hostedInvoiceUrl}" style="color: #3b82f6; text-decoration: none; margin-right: 16px;">View Online Invoice</a>` : ''}
        ${invoicePdfUrl ? `<a href="${invoicePdfUrl}" style="color: #3b82f6; text-decoration: none;">Download PDF Receipt</a>` : ''}
      </div>

      ${billingPortalLink(input.billingPortalUrl)}
    `, `We received your payment of ${amount} for ${planName}.`),
  });
}

export async function sendBillingPaymentFailedEmail(
  input: BillingPaymentEmail,
): Promise<void> {
  const name = escapeHtml(input.customerName) || 'there';
  const planName = escapeHtml(input.planName) || 'your current plan';
  const invoiceNumber = escapeHtml(input.invoiceNumber) || 'N/A';
  const amount = formatMoney(input.amountCents, input.currency);
  const dueDate = formatDate(input.dueDate);
  const hostedInvoiceUrl = input.hostedInvoiceUrl ? escapeHtml(input.hostedInvoiceUrl) : '';

  await sendEmail({
    to: input.to,
    subject: `Payment failed: ${amount}`,
    html: emailShell(`
      <h1>Payment failed</h1>
      <p>Hi ${name},</p>
      <p>We were unable to process your payment for <strong>${planName}</strong>. To ensure your service remains uninterrupted, please update your payment information.</p>
      
      <div class="info-box">
        <div class="info-row">
          <div class="info-label">Amount Due</div>
          <div class="info-value" style="color: #b91c1c;">${amount}</div>
        </div>
        <div class="info-row">
          <div class="info-label">Invoice</div>
          <div class="info-value">${invoiceNumber}</div>
        </div>
        <div class="info-row" style="margin-bottom: 0;">
          <div class="info-label">Due Date</div>
          <div class="info-value">${dueDate}</div>
        </div>
      </div>

      <p style="font-size: 14px; color: #64748b;">We will attempt to retry the payment automatically over the next few days.</p>

      ${hostedInvoiceUrl ? `<p style="margin-top:14px;"><a href="${hostedInvoiceUrl}" style="color: #3b82f6; text-decoration: none;">View invoice details</a></p>` : ''}
      
      ${billingPortalLink(input.billingPortalUrl)}
    `, `Action required: Payment of ${amount} for ${planName} failed.`),
  });
}

export async function sendBillingSubscriptionStateEmail(
  input: BillingEmailBase & {
    statusLabel: string;
    detail: string;
  },
): Promise<void> {
  const name = escapeHtml(input.customerName) || 'there';
  const planName = escapeHtml(input.planName) || 'your subscription';
  const statusLabel = escapeHtml(input.statusLabel);
  const detail = escapeHtml(input.detail);

  let badgeClass = 'badge-warning';
  if (statusLabel.toLowerCase() === 'active') badgeClass = 'badge-success';
  if (statusLabel.toLowerCase() === 'canceled' || statusLabel.toLowerCase() === 'incomplete_expired') badgeClass = 'badge-error';

  await sendEmail({
    to: input.to,
    subject: `Subscription update: ${statusLabel}`,
    html: emailShell(`
      <h1>Subscription update</h1>
      <p>Hi ${name},</p>
      <p>There has been a change to your <strong>${planName}</strong> subscription status.</p>
      
      <div class="info-box">
        <div class="info-row">
          <div class="info-label">Plan</div>
          <div class="info-value">${planName}</div>
        </div>
        <div class="info-row" style="margin-bottom: 0;">
          <div class="info-label">New Status</div>
          <div class="info-value"><span class="badge ${badgeClass}">${statusLabel}</span></div>
        </div>
      </div>

      <p>${detail}</p>
      
      ${billingPortalLink(input.billingPortalUrl)}
    `, `Your ${planName} subscription status has been updated to ${statusLabel}.`),
  });
}

export async function sendVerificationEmail(to: string, rawToken: string): Promise<void> {
  const verifyUrl = `${env.APP_URL}/auth/verify-email?token=${encodeURIComponent(rawToken)}`;

  console.log('\n🔐 EMAIL VERIFICATION TOKEN (for testing):');
  console.log(`   Token: ${rawToken}`);
  console.log(`   URL: ${verifyUrl}`);
  console.log(`   Email would be sent to: ${to}\n`);

  try {
    await sendEmail({
      to,
      subject: 'Verify your email address',
      html: emailShell(`
        <h1>Verify your email</h1>
        <p>Welcome to Nirex! To get started, please confirm your email address by clicking the button below.</p>
        <div style="text-align: center; margin: 32px 0;">
          <a href="${verifyUrl}" class="btn">
            Verify Email Address
          </a>
        </div>
        <p style="font-size: 14px; color: #64748b;">
          This link will expire in <strong>15 minutes</strong> for security reasons. 
          If you did not create an account with us, you can safely ignore this email.
        </p>
      `, "Verify your email address to get started with Nirex."),
    });
  } catch (err) {
    const errorMessage = (err as Error).message;
    logger.error('Auth email send failed', {
      to: to,
      error: errorMessage,
      smtpHost: env.SMTP_HOST,
      smtpPort: env.SMTP_PORT,
    });

    if (env.NODE_ENV === 'development' && (!env.SMTP_USER || !env.SMTP_PASS)) {
      console.log('⚠️  Email sending failed, but token is available above for testing');
      console.log('   Error:', errorMessage);
      return;
    }

    throw new AppError(
      `Failed to send verification email: ${errorMessage}`,
      500,
      'EMAIL_SEND_FAILED'
    );
  }
}

export async function sendPasswordResetEmail(to: string, rawToken: string): Promise<void> {
  const resetUrl = `${env.APP_URL}/auth/reset-password?token=${encodeURIComponent(rawToken)}`;

  console.log('\n🔐 PASSWORD RESET TOKEN (for testing):');
  console.log(`   Token: ${rawToken}`);
  console.log(`   URL: ${resetUrl}`);
  console.log(`   Email would be sent to: ${to}\n`);

  try {
    await sendEmail({
      to,
      subject: 'Reset your password',
      html: emailShell(`
        <h1>Reset your password</h1>
        <p>We received a request to reset your password. Click the button below to choose a new one.</p>
        <div style="text-align: center; margin: 32px 0;">
          <a href="${resetUrl}" class="btn" style="background-color: #ef4444;">
            Reset Password
          </a>
        </div>
        <p style="font-size: 14px; color: #64748b;">
          This link will expire in <strong>15 minutes</strong>. If you did not request a password reset, 
          your password will remain unchanged and you can safely ignore this email.
        </p>
      `, "Reset your Nirex account password."),
    });
  } catch (err) {
    const errorMessage = (err as Error).message;
    if (env.NODE_ENV === 'development' && (!env.SMTP_USER || !env.SMTP_PASS)) {
      console.log('⚠️  Email sending failed, but token is available above for testing');
      console.log('   Error:', errorMessage);
      return;
    }

    throw new AppError(
      `Failed to send password reset email: ${errorMessage}`,
      500,
      'EMAIL_SEND_FAILED'
    );
  }
}

export async function sendSuspiciousSigninAlert(
  to: string,
  ip: string,
  deviceInfo: string
): Promise<void> {
  await sendEmail({
    to,
    subject: 'New sign-in to your account',
    html: emailShell(`
      <h1>New sign-in detected</h1>
      <p>A new sign-in was detected for your account from an unrecognized device or location.</p>
      
      <div class="info-box">
        <div class="info-row">
          <div class="info-label">IP Address</div>
          <div class="info-value">${ip}</div>
        </div>
        <div class="info-row" style="margin-bottom: 0;">
          <div class="info-label">Device</div>
          <div class="info-value">${deviceInfo}</div>
        </div>
      </div>

      <p style="font-size: 14px;">If this was you, you can safely ignore this message. However, if you do not recognize this activity, we strongly recommend that you reset your password immediately to secure your account.</p>
      <div style="text-align: center; margin-top: 24px;">
        <a href="${env.APP_URL}/auth/signin" class="btn">
          Review Account Activity
        </a>
      </div>
    `, "We detected a new sign-in to your account from a new device."),
  });
}
