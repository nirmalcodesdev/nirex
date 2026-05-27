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

interface PasswordSecurityEmailOptions {
  to: string;
  requestedAt?: Date | undefined;
  completedAt?: Date | undefined;
  ipAddress?: string | undefined;
  deviceInfo?: string | undefined;
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

function truncateForEmail(input: string | null | undefined, maxLength = 180): string {
  if (!input) return '';
  const normalized = input.replace(/\s+/g, ' ').trim();
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength - 1)}...`;
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

function formatDateTime(date: Date | null | undefined): string {
  if (!date) return 'N/A';
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    timeZoneName: 'short',
  }).format(date);
}

function requestMetadataBox(input: {
  eventTime?: Date | undefined;
  eventLabel: string;
  ipAddress?: string | undefined;
  deviceInfo?: string | undefined;
}): string {
  const ipAddress = escapeHtml(truncateForEmail(input.ipAddress, 64)) || 'Not available';
  const deviceInfo = escapeHtml(truncateForEmail(input.deviceInfo)) || 'Not available';

  return `
      <div class="info-box">
        <div class="info-row">
          <div class="info-label">${escapeHtml(input.eventLabel)}</div>
          <div class="info-value">${formatDateTime(input.eventTime)}</div>
        </div>
        <div class="info-row">
          <div class="info-label">IP Address</div>
          <div class="info-value">${ipAddress}</div>
        </div>
        <div class="info-row" style="margin-bottom: 0;">
          <div class="info-label">Device</div>
          <div class="info-value">${deviceInfo}</div>
        </div>
      </div>
  `;
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

  if (env.NODE_ENV !== 'production') {
    console.log('\nEMAIL VERIFICATION TOKEN (for testing):');
    console.log(`   Token: ${rawToken}`);
    console.log(`   URL: ${verifyUrl}`);
    console.log(`   Email would be sent to: ${to}\n`);
  }

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

export async function sendPasswordResetEmail(
  to: string,
  rawToken: string,
  input: Omit<PasswordSecurityEmailOptions, 'to'> = {},
): Promise<void> {
  const resetUrl = `${env.APP_URL}/auth/reset-password?token=${encodeURIComponent(rawToken)}`;

  if (env.NODE_ENV !== 'production') {
    console.log('\nPASSWORD RESET TOKEN (for testing):');
    console.log(`   Token: ${rawToken}`);
    console.log(`   URL: ${resetUrl}`);
    console.log(`   Email would be sent to: ${to}\n`);
  }

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
        ${requestMetadataBox({
        eventTime: input.requestedAt,
        eventLabel: 'Requested',
        ipAddress: input.ipAddress,
        deviceInfo: input.deviceInfo,
      })}
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

export async function sendPasswordResetSuccessEmail(
  input: PasswordSecurityEmailOptions,
): Promise<void> {
  await sendEmail({
    to: input.to,
    subject: 'Your password was changed',
    html: emailShell(`
      <h1>Password changed</h1>
      <p>Your Nirex account password was changed successfully. For your security, active sessions were terminated and you may need to sign in again.</p>
      ${requestMetadataBox({
      eventTime: input.completedAt,
      eventLabel: 'Changed',
      ipAddress: input.ipAddress,
      deviceInfo: input.deviceInfo,
    })}
      <p style="font-size: 14px; color: #64748b;">
        If you made this change, no further action is required. If you did not make this change, reset your password immediately and review your active devices.
      </p>
      <div style="text-align: center; margin-top: 24px;">
        <a href="${env.APP_URL}/auth/forgot-password" class="btn" style="background-color: #ef4444;">
          Secure My Account
        </a>
      </div>
    `, 'Your Nirex account password was changed.'),
  });
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

// ─────────────────────────────────────────────────────────────────────────────
// Security & account emails
// ─────────────────────────────────────────────────────────────────────────────

interface SecurityEventEmail {
  to: string;
  customerName?: string | null;
  ipAddress?: string | undefined;
  deviceInfo?: string | undefined;
  eventTime?: Date | undefined;
}

interface ApiKeyEventEmail extends SecurityEventEmail {
  keyName: string;
  keyPrefix?: string | null;
  scopes?: string[];
  expiresAt?: Date | null;
  reason?: string | null;
}

function securityActionButton(label: string, path = '/account/security'): string {
  return `
    <div style="text-align: center; margin-top: 24px;">
      <a href="${env.APP_URL}${path}" class="btn">
        ${escapeHtml(label)}
      </a>
    </div>
  `;
}

function securityFooterCopy(): string {
  return `<p style="font-size: 14px; color: #64748b;">If you did not perform this action, secure your account immediately by changing your password and reviewing active devices.</p>`;
}

export async function sendApiKeyCreatedEmail(input: ApiKeyEventEmail): Promise<void> {
  const name = escapeHtml(input.customerName) || 'there';
  const keyName = escapeHtml(input.keyName);
  const keyPrefix = escapeHtml(input.keyPrefix) || 'N/A';
  const scopesLabel = input.scopes && input.scopes.length
    ? escapeHtml(input.scopes.join(', '))
    : 'No scopes';
  const expiresAt = formatDate(input.expiresAt);

  await sendEmail({
    to: input.to,
    subject: `New API key created: ${input.keyName}`,
    html: emailShell(`
      <h1>API key created</h1>
      <p>Hi ${name},</p>
      <p>A new API key was created on your account. If this was you, no action is needed.</p>
      <div class="info-box">
        <div class="info-row">
          <div class="info-label">Name</div>
          <div class="info-value">${keyName}</div>
        </div>
        <div class="info-row">
          <div class="info-label">Key Prefix</div>
          <div class="info-value">${keyPrefix}…</div>
        </div>
        <div class="info-row">
          <div class="info-label">Scopes</div>
          <div class="info-value">${scopesLabel}</div>
        </div>
        <div class="info-row" style="margin-bottom: 0;">
          <div class="info-label">Expires</div>
          <div class="info-value">${expiresAt}</div>
        </div>
      </div>
      ${requestMetadataBox({
      eventTime: input.eventTime,
      eventLabel: 'Created',
      ipAddress: input.ipAddress,
      deviceInfo: input.deviceInfo,
    })}
      ${securityFooterCopy()}
      ${securityActionButton('Review API Keys', '/account/api-keys')}
    `, `A new API key "${input.keyName}" was created on your account.`),
  });
}

export async function sendApiKeyRevokedEmail(input: ApiKeyEventEmail): Promise<void> {
  const name = escapeHtml(input.customerName) || 'there';
  const keyName = escapeHtml(input.keyName);
  const keyPrefix = escapeHtml(input.keyPrefix) || 'N/A';
  const reason = escapeHtml(input.reason) || 'Revoked by user';

  await sendEmail({
    to: input.to,
    subject: `API key revoked: ${input.keyName}`,
    html: emailShell(`
      <h1>API key revoked</h1>
      <p>Hi ${name},</p>
      <p>An API key was revoked on your account and can no longer be used.</p>
      <div class="info-box">
        <div class="info-row">
          <div class="info-label">Name</div>
          <div class="info-value">${keyName}</div>
        </div>
        <div class="info-row">
          <div class="info-label">Key Prefix</div>
          <div class="info-value">${keyPrefix}…</div>
        </div>
        <div class="info-row" style="margin-bottom: 0;">
          <div class="info-label">Reason</div>
          <div class="info-value">${reason}</div>
        </div>
      </div>
      ${requestMetadataBox({
      eventTime: input.eventTime,
      eventLabel: 'Revoked',
      ipAddress: input.ipAddress,
      deviceInfo: input.deviceInfo,
    })}
      ${securityFooterCopy()}
      ${securityActionButton('Review API Keys', '/account/api-keys')}
    `, `API key "${input.keyName}" was revoked.`),
  });
}

export async function sendApiKeyRotatedEmail(input: ApiKeyEventEmail): Promise<void> {
  const name = escapeHtml(input.customerName) || 'there';
  const keyName = escapeHtml(input.keyName);
  const keyPrefix = escapeHtml(input.keyPrefix) || 'N/A';

  await sendEmail({
    to: input.to,
    subject: `API key rotated: ${input.keyName}`,
    html: emailShell(`
      <h1>API key rotated</h1>
      <p>Hi ${name},</p>
      <p>An API key on your account was rotated. The previous key has been revoked and a new key was issued. Update any integrations using the old key.</p>
      <div class="info-box">
        <div class="info-row">
          <div class="info-label">Name</div>
          <div class="info-value">${keyName}</div>
        </div>
        <div class="info-row" style="margin-bottom: 0;">
          <div class="info-label">New Key Prefix</div>
          <div class="info-value">${keyPrefix}…</div>
        </div>
      </div>
      ${requestMetadataBox({
      eventTime: input.eventTime,
      eventLabel: 'Rotated',
      ipAddress: input.ipAddress,
      deviceInfo: input.deviceInfo,
    })}
      ${securityFooterCopy()}
      ${securityActionButton('Review API Keys', '/account/api-keys')}
    `, `API key "${input.keyName}" was rotated.`),
  });
}

export async function sendTwoFactorEnabledEmail(input: SecurityEventEmail): Promise<void> {
  const name = escapeHtml(input.customerName) || 'there';
  await sendEmail({
    to: input.to,
    subject: 'Two-factor authentication enabled',
    html: emailShell(`
      <h1>Two-factor authentication is on</h1>
      <p>Hi ${name},</p>
      <p>Two-factor authentication was enabled for your account. From now on, sign-ins on new devices will require a verification code in addition to your password.</p>
      <p style="font-size: 14px; color: #64748b;">Make sure to store your backup codes in a safe place — you'll need them if you ever lose access to your authenticator app.</p>
      ${requestMetadataBox({
      eventTime: input.eventTime,
      eventLabel: 'Enabled',
      ipAddress: input.ipAddress,
      deviceInfo: input.deviceInfo,
    })}
      ${securityFooterCopy()}
      ${securityActionButton('Review Account Security')}
    `, 'Two-factor authentication was enabled on your account.'),
  });
}

export async function sendTwoFactorDisabledEmail(input: SecurityEventEmail): Promise<void> {
  const name = escapeHtml(input.customerName) || 'there';
  await sendEmail({
    to: input.to,
    subject: 'Two-factor authentication disabled',
    html: emailShell(`
      <h1>Two-factor authentication is off</h1>
      <p>Hi ${name},</p>
      <p>Two-factor authentication was disabled for your account. Your account is now protected only by your password.</p>
      <p style="font-size: 14px; color: #b91c1c;"><strong>If you did not make this change, your account may be compromised.</strong> Re-enable two-factor authentication and change your password immediately.</p>
      ${requestMetadataBox({
      eventTime: input.eventTime,
      eventLabel: 'Disabled',
      ipAddress: input.ipAddress,
      deviceInfo: input.deviceInfo,
    })}
      <div style="text-align: center; margin-top: 24px;">
        <a href="${env.APP_URL}/account/security" class="btn" style="background-color: #ef4444;">
          Secure My Account
        </a>
      </div>
    `, 'Two-factor authentication was disabled on your account.'),
  });
}

export async function sendPasswordChangedInSessionEmail(input: SecurityEventEmail): Promise<void> {
  const name = escapeHtml(input.customerName) || 'there';
  await sendEmail({
    to: input.to,
    subject: 'Your password was changed',
    html: emailShell(`
      <h1>Password changed</h1>
      <p>Hi ${name},</p>
      <p>Your account password was changed from within an active session. For your security, all other active sessions were signed out.</p>
      ${requestMetadataBox({
      eventTime: input.eventTime,
      eventLabel: 'Changed',
      ipAddress: input.ipAddress,
      deviceInfo: input.deviceInfo,
    })}
      <p style="font-size: 14px; color: #64748b;">If this wasn't you, reset your password immediately and review your active devices.</p>
      <div style="text-align: center; margin-top: 24px;">
        <a href="${env.APP_URL}/auth/forgot-password" class="btn" style="background-color: #ef4444;">
          Secure My Account
        </a>
      </div>
    `, 'Your Nirex account password was changed from a signed-in session.'),
  });
}

export async function sendSignedOutEverywhereEmail(input: SecurityEventEmail): Promise<void> {
  const name = escapeHtml(input.customerName) || 'there';
  await sendEmail({
    to: input.to,
    subject: 'You were signed out of all devices',
    html: emailShell(`
      <h1>All sessions terminated</h1>
      <p>Hi ${name},</p>
      <p>All active sessions on your account were signed out. You will need to sign in again on each device.</p>
      ${requestMetadataBox({
      eventTime: input.eventTime,
      eventLabel: 'Signed out',
      ipAddress: input.ipAddress,
      deviceInfo: input.deviceInfo,
    })}
      ${securityFooterCopy()}
      ${securityActionButton('Sign In', '/auth/signin')}
    `, 'All active sessions on your Nirex account were signed out.'),
  });
}

interface SessionRevokedEmail extends SecurityEventEmail {
  revokedDeviceInfo?: string | null;
  revokedIp?: string | null;
}

export async function sendSessionRevokedEmail(input: SessionRevokedEmail): Promise<void> {
  const name = escapeHtml(input.customerName) || 'there';
  const revokedDevice = escapeHtml(truncateForEmail(input.revokedDeviceInfo)) || 'Unknown device';
  const revokedIp = escapeHtml(truncateForEmail(input.revokedIp, 64)) || 'Unknown';
  await sendEmail({
    to: input.to,
    subject: 'A device was signed out of your account',
    html: emailShell(`
      <h1>Session ended</h1>
      <p>Hi ${name},</p>
      <p>A device was signed out of your account.</p>
      <div class="info-box">
        <div class="info-row">
          <div class="info-label">Device</div>
          <div class="info-value">${revokedDevice}</div>
        </div>
        <div class="info-row" style="margin-bottom: 0;">
          <div class="info-label">IP Address</div>
          <div class="info-value">${revokedIp}</div>
        </div>
      </div>
      ${requestMetadataBox({
      eventTime: input.eventTime,
      eventLabel: 'Terminated',
      ipAddress: input.ipAddress,
      deviceInfo: input.deviceInfo,
    })}
      ${securityFooterCopy()}
      ${securityActionButton('Review Devices', '/account/devices')}
    `, 'A signed-in device was removed from your Nirex account.'),
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Billing — additional lifecycle emails
// ─────────────────────────────────────────────────────────────────────────────

export async function sendBillingSubscriptionRestoredEmail(input: BillingEmailBase): Promise<void> {
  const name = escapeHtml(input.customerName) || 'there';
  const planName = escapeHtml(input.planName) || 'your subscription';
  await sendEmail({
    to: input.to,
    subject: `Subscription restored: ${planName}`,
    html: emailShell(`
      <h1>Subscription restored</h1>
      <p>Hi ${name},</p>
      <p>Good news — we successfully collected payment and your <strong>${planName}</strong> subscription is fully active again. Thanks for sticking with us.</p>
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
    `, `Your ${planName} subscription is active again.`),
  });
}

interface BillingCancelEmail extends BillingEmailBase {
  immediate: boolean;
  effectiveAt?: Date | null;
  reason?: string | null;
}

export async function sendBillingSubscriptionCanceledByUserEmail(
  input: BillingCancelEmail,
): Promise<void> {
  const name = escapeHtml(input.customerName) || 'there';
  const planName = escapeHtml(input.planName) || 'your subscription';
  const effectiveAt = formatDate(input.effectiveAt);
  const reason = escapeHtml(input.reason);

  const headline = input.immediate ? 'Subscription canceled' : 'Cancellation scheduled';
  const intro = input.immediate
    ? `Your <strong>${planName}</strong> subscription has been canceled and your access has ended.`
    : `Your <strong>${planName}</strong> subscription is set to end on <strong>${effectiveAt}</strong>. You'll keep full access until then.`;

  await sendEmail({
    to: input.to,
    subject: input.immediate
      ? `Subscription canceled: ${planName}`
      : `Cancellation scheduled: ${planName}`,
    html: emailShell(`
      <h1>${headline}</h1>
      <p>Hi ${name},</p>
      <p>${intro}</p>
      <div class="info-box">
        <div class="info-row">
          <div class="info-label">Plan</div>
          <div class="info-value">${planName}</div>
        </div>
        <div class="info-row" ${reason ? '' : 'style="margin-bottom: 0;"'}>
          <div class="info-label">Effective</div>
          <div class="info-value">${input.immediate ? 'Immediately' : effectiveAt}</div>
        </div>
        ${reason ? `
        <div class="info-row" style="margin-bottom: 0;">
          <div class="info-label">Reason</div>
          <div class="info-value">${reason}</div>
        </div>` : ''}
      </div>
      <p style="font-size: 14px; color: #64748b;">Changed your mind? You can ${input.immediate ? 'resubscribe' : 'reverse this cancellation'} anytime from your billing portal.</p>
      ${billingPortalLink(input.billingPortalUrl)}
    `, input.immediate
      ? `Your ${planName} subscription has been canceled.`
      : `Your ${planName} subscription will end on ${effectiveAt}.`),
  });
}

interface BillingAutoRenewalEmail extends BillingEmailBase {
  enabled: boolean;
  effectiveAt?: Date | null;
}

export async function sendBillingAutoRenewalChangedEmail(
  input: BillingAutoRenewalEmail,
): Promise<void> {
  const name = escapeHtml(input.customerName) || 'there';
  const planName = escapeHtml(input.planName) || 'your subscription';
  const effectiveAt = formatDate(input.effectiveAt);
  const headline = input.enabled ? 'Auto-renewal enabled' : 'Auto-renewal disabled';
  const intro = input.enabled
    ? `Your <strong>${planName}</strong> subscription will renew automatically at the end of the current billing period.`
    : `Your <strong>${planName}</strong> subscription will <strong>not</strong> renew. You'll keep access until <strong>${effectiveAt}</strong>.`;

  await sendEmail({
    to: input.to,
    subject: `Auto-renewal ${input.enabled ? 'enabled' : 'disabled'}: ${planName}`,
    html: emailShell(`
      <h1>${headline}</h1>
      <p>Hi ${name},</p>
      <p>${intro}</p>
      <div class="info-box">
        <div class="info-row">
          <div class="info-label">Plan</div>
          <div class="info-value">${planName}</div>
        </div>
        <div class="info-row" style="margin-bottom: 0;">
          <div class="info-label">Auto-renewal</div>
          <div class="info-value">
            <span class="badge ${input.enabled ? 'badge-success' : 'badge-warning'}">
              ${input.enabled ? 'On' : 'Off'}
            </span>
          </div>
        </div>
      </div>
      ${billingPortalLink(input.billingPortalUrl)}
    `, input.enabled
      ? `Auto-renewal is on for your ${planName} subscription.`
      : `Auto-renewal is off; your ${planName} subscription ends on ${effectiveAt}.`),
  });
}

export async function sendBillingSubscriptionPausedEmail(input: BillingEmailBase): Promise<void> {
  const name = escapeHtml(input.customerName) || 'there';
  const planName = escapeHtml(input.planName) || 'your subscription';
  await sendEmail({
    to: input.to,
    subject: `Subscription paused: ${planName}`,
    html: emailShell(`
      <h1>Subscription paused</h1>
      <p>Hi ${name},</p>
      <p>Your <strong>${planName}</strong> subscription has been paused. You won't be charged while it's paused, and you can resume anytime from your billing portal.</p>
      <div class="info-box">
        <div class="info-row">
          <div class="info-label">Plan</div>
          <div class="info-value">${planName}</div>
        </div>
        <div class="info-row" style="margin-bottom: 0;">
          <div class="info-label">Status</div>
          <div class="info-value"><span class="badge badge-warning">Paused</span></div>
        </div>
      </div>
      ${billingPortalLink(input.billingPortalUrl)}
    `, `Your ${planName} subscription is paused.`),
  });
}

export async function sendBillingSubscriptionResumedEmail(input: BillingEmailBase): Promise<void> {
  const name = escapeHtml(input.customerName) || 'there';
  const planName = escapeHtml(input.planName) || 'your subscription';
  await sendEmail({
    to: input.to,
    subject: `Subscription resumed: ${planName}`,
    html: emailShell(`
      <h1>Welcome back</h1>
      <p>Hi ${name},</p>
      <p>Your <strong>${planName}</strong> subscription is active again. Billing has resumed on your usual schedule.</p>
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
    `, `Your ${planName} subscription has resumed.`),
  });
}

export async function sendBillingCancellationReversedEmail(input: BillingEmailBase): Promise<void> {
  const name = escapeHtml(input.customerName) || 'there';
  const planName = escapeHtml(input.planName) || 'your subscription';
  await sendEmail({
    to: input.to,
    subject: `Cancellation reversed: ${planName}`,
    html: emailShell(`
      <h1>Cancellation reversed</h1>
      <p>Hi ${name},</p>
      <p>Your <strong>${planName}</strong> subscription will continue to renew automatically. Glad to have you staying with us.</p>
      <div class="info-box">
        <div class="info-row">
          <div class="info-label">Plan</div>
          <div class="info-value">${planName}</div>
        </div>
        <div class="info-row" style="margin-bottom: 0;">
          <div class="info-label">Auto-renewal</div>
          <div class="info-value"><span class="badge badge-success">On</span></div>
        </div>
      </div>
      ${billingPortalLink(input.billingPortalUrl)}
    `, `Your ${planName} subscription will continue.`),
  });
}

interface BillingDunningEmail extends BillingEmailBase {
  day: number;
  finalCancel: boolean;
}

export async function sendBillingDunningEmail(input: BillingDunningEmail): Promise<void> {
  const name = escapeHtml(input.customerName) || 'there';
  const planName = escapeHtml(input.planName) || 'your subscription';
  const isFinal = input.finalCancel;
  const headline = isFinal
    ? 'Subscription canceled'
    : input.day >= 14
      ? 'Final notice: payment required'
      : 'Payment retry required';
  const intro = isFinal
    ? `After ${input.day} days of failed payment attempts, your <strong>${planName}</strong> subscription has been canceled.`
    : input.day >= 14
      ? `We still haven't been able to collect payment for <strong>${planName}</strong>. Without action, your subscription will be canceled in the next few days.`
      : `We tried to charge for <strong>${planName}</strong> but the payment didn't go through. Please update your billing details to avoid interruption.`;
  const badge = isFinal ? 'badge-error' : input.day >= 14 ? 'badge-error' : 'badge-warning';
  const statusLabel = isFinal ? 'Canceled' : 'Payment overdue';

  await sendEmail({
    to: input.to,
    subject: isFinal
      ? `Subscription canceled: ${planName}`
      : `Action required: payment failed for ${planName}`,
    html: emailShell(`
      <h1>${headline}</h1>
      <p>Hi ${name},</p>
      <p>${intro}</p>
      <div class="info-box">
        <div class="info-row">
          <div class="info-label">Plan</div>
          <div class="info-value">${planName}</div>
        </div>
        <div class="info-row">
          <div class="info-label">Status</div>
          <div class="info-value"><span class="badge ${badge}">${statusLabel}</span></div>
        </div>
        <div class="info-row" style="margin-bottom: 0;">
          <div class="info-label">Day</div>
          <div class="info-value">${input.day} of 21</div>
        </div>
      </div>
      ${billingPortalLink(input.billingPortalUrl)}
    `, isFinal
      ? `Your ${planName} subscription has been canceled after repeated failed payments.`
      : `Action required: please update your payment method for ${planName}.`),
  });
}

interface BillingTopUpEmail extends BillingEmailBase {
  amountMinor: number;
  currency: string;
}

export async function sendBillingTopUpCompletedEmail(input: BillingTopUpEmail): Promise<void> {
  const name = escapeHtml(input.customerName) || 'there';
  const packName = escapeHtml(input.planName) || 'Top-up';
  const amount = formatMoney(input.amountMinor, input.currency);

  await sendEmail({
    to: input.to,
    subject: `Top-up added: ${amount}`,
    html: emailShell(`
      <h1>Top-up added</h1>
      <p>Hi ${name},</p>
      <p>Your payment of <strong>${amount}</strong> was successful. The balance has been added to your account and is ready to use immediately.</p>
      <div class="info-box">
        <div class="info-row">
          <div class="info-label">Pack</div>
          <div class="info-value">${packName}</div>
        </div>
        <div class="info-row">
          <div class="info-label">Amount</div>
          <div class="info-value">${amount}</div>
        </div>
        <div class="info-row" style="margin-bottom: 0;">
          <div class="info-label">Status</div>
          <div class="info-value"><span class="badge badge-success">Credited</span></div>
        </div>
      </div>
      <p style="font-size: 14px; color: #64748b;">Top-up balance never expires.</p>
      ${billingPortalLink(input.billingPortalUrl)}
    `, `${amount} has been added to your balance.`),
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Usage / quota threshold emails
// ─────────────────────────────────────────────────────────────────────────────

interface UsageThresholdEmail {
  to: string;
  customerName?: string | null;
  planName?: string | null;
  thresholdPercent: number;
  usedCredits: number;
  includedCredits: number;
  periodEnd?: Date | null;
}

export async function sendUsageThresholdEmail(input: UsageThresholdEmail): Promise<void> {
  const name = escapeHtml(input.customerName) || 'there';
  const planName = escapeHtml(input.planName) || 'your plan';
  const thresholdLabel = `${Math.round(input.thresholdPercent * 100)}%`;
  const exhausted = input.thresholdPercent >= 1;
  const headline = exhausted
    ? 'You\'ve used all your balance'
    : `You\'ve used ${thresholdLabel} of your balance`;
  const intro = exhausted
    ? `You\'ve hit the balance limit on <strong>${planName}</strong> for the current period. New requests will be blocked until your balance resets or you upgrade.`
    : `Heads-up — you\'ve used ${thresholdLabel} of the balance included with <strong>${planName}</strong> for the current period.`;
  const periodEnd = formatDate(input.periodEnd);

  await sendEmail({
    to: input.to,
    subject: exhausted
      ? 'Balance limit reached'
      : `You\'ve used ${thresholdLabel} of your balance`,
    html: emailShell(`
      <h1>${headline}</h1>
      <p>Hi ${name},</p>
      <p>${intro}</p>
      <div class="info-box">
        <div class="info-row">
          <div class="info-label">Plan</div>
          <div class="info-value">${planName}</div>
        </div>
        <div class="info-row">
          <div class="info-label">Used</div>
          <div class="info-value">$${(input.usedCredits / 100).toFixed(2)} / $${(input.includedCredits / 100).toFixed(2)}</div>
        </div>
        <div class="info-row" style="margin-bottom: 0;">
          <div class="info-label">Resets</div>
          <div class="info-value">${periodEnd}</div>
        </div>
      </div>
      <p style="font-size: 14px; color: #64748b;">Need more headroom? Upgrade your plan from the billing portal.</p>
      <div style="text-align: center; margin-top: 24px;">
        <a href="${env.APP_URL}/billing" class="btn" style="${exhausted ? 'background-color: #ef4444;' : ''}">
          ${exhausted ? 'Upgrade Plan' : 'View Billing'}
        </a>
      </div>
    `, exhausted
      ? `You\'ve used all the balance on ${planName} for this period.`
      : `You\'ve used ${thresholdLabel} of your balance on ${planName}.`),
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Renewal reminder emails
// ─────────────────────────────────────────────────────────────────────────────

interface RenewalReminderEmail extends BillingEmailBase {
  renewalDate: Date;
  amountCents: number;
  currency: string;
  daysUntilRenewal: number;
}

export async function sendBillingRenewalReminderEmail(input: RenewalReminderEmail): Promise<void> {
  const name = escapeHtml(input.customerName) || 'there';
  const planName = escapeHtml(input.planName) || 'your subscription';
  const renewalDate = formatDate(input.renewalDate);
  const amount = formatMoney(input.amountCents, input.currency);
  const daysLabel = input.daysUntilRenewal === 1 ? 'tomorrow' : `in ${input.daysUntilRenewal} days`;

  await sendEmail({
    to: input.to,
    subject: `Your ${planName} subscription renews ${daysLabel}`,
    html: emailShell(`
      <h1>Subscription renewal reminder</h1>
      <p>Hi ${name},</p>
      <p>This is a friendly reminder that your <strong>${planName}</strong> subscription will automatically renew ${daysLabel}.</p>
      <div class="info-box">
        <div class="info-row">
          <div class="info-label">Plan</div>
          <div class="info-value">${planName}</div>
        </div>
        <div class="info-row">
          <div class="info-label">Renewal date</div>
          <div class="info-value">${renewalDate}</div>
        </div>
        <div class="info-row" style="margin-bottom: 0;">
          <div class="info-label">Amount</div>
          <div class="info-value">${amount}</div>
        </div>
      </div>
      <p style="font-size: 14px; color: #64748b;">If you'd like to make changes to your subscription, you can do so from your billing portal before the renewal date.</p>
      ${billingPortalLink(input.billingPortalUrl)}
    `, `Your ${planName} subscription renews on ${renewalDate} for ${amount}.`),
  });
}
