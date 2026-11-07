const formData = require('form-data');
const Mailgun = require('mailgun.js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '..', 'config', '.env') });

function getMailgunClient() {
  if (!process.env.MAILGUN_API_KEY || !process.env.MAILGUN_DOMAIN) {
    throw new Error('Mailgun is not configured. Set MAILGUN_API_KEY and MAILGUN_DOMAIN.');
  }

  const mailgun = new Mailgun(formData);
  const clientOptions = { username: 'api', key: process.env.MAILGUN_API_KEY };
  if (process.env.MAILGUN_API_BASE_URL) clientOptions.url = process.env.MAILGUN_API_BASE_URL;

  return {
    mg: mailgun.client(clientOptions),
    domain: process.env.MAILGUN_DOMAIN,
    fromAddress: process.env.MAILGUN_FROM || `Moss & Marine <postmaster@${process.env.MAILGUN_DOMAIN}>`
  };
}

function emailShell(content) {
  return `<!doctype html>
<html>
  <body style="margin:0;background:#f4f8f8;font-family:Arial,sans-serif;color:#243638;">
    <div style="max-width:620px;margin:0 auto;padding:32px 18px;">
      <div style="background:#ffffff;border-radius:16px;padding:32px;border:1px solid #dde8e8;">
        <div style="font-size:22px;font-weight:700;color:#006d77;margin-bottom:24px;">Moss &amp; Marine</div>
        ${content}
        <p style="margin:28px 0 0;color:#718184;font-size:13px;">Moss &amp; Marine · Aquarium storefront portfolio project</p>
      </div>
    </div>
  </body>
</html>`;
}

async function sendWelcomeEmail(userEmail, firstName, lastName) {
  const { mg, domain, fromAddress } = getMailgunClient();
  const name = `${firstName} ${lastName}`.trim();
  const text = `Hi ${firstName},\n\nWelcome to Moss & Marine. Your customer account is ready.\n\nYou can now browse products, add items to your cart, and review your order history after checkout.\n\nThanks for joining us, ${name}.\n\nMoss & Marine`;
  const html = emailShell(`
    <h1 style="font-size:26px;margin:0 0 12px;">Welcome, ${firstName}!</h1>
    <p style="line-height:1.6;margin:0 0 16px;">Your Moss &amp; Marine customer account is ready.</p>
    <p style="line-height:1.6;margin:0;">You can now browse products, add items to your cart, and review your order history after checkout.</p>
  `);

  return mg.messages.create(domain, {
    from: fromAddress,
    to: userEmail,
    subject: 'Welcome to Moss & Marine',
    text,
    html
  });
}

async function sendOrderConfirmationEmail(order) {
  const { mg, domain, fromAddress } = getMailgunClient();
  const itemLines = order.items.map(item =>
    `${item.title}${item.sku ? ` (${item.sku})` : ''} x${item.quantity} — $${item.lineTotal.toFixed(2)}`
  ).join('\n');
  const itemRows = order.items.map(item => `
    <tr>
      <td style="padding:10px 0;border-bottom:1px solid #e7eeee;">${item.title}<br><span style="font-size:12px;color:#7a898b;">${item.sku || ''}</span></td>
      <td style="padding:10px 0;border-bottom:1px solid #e7eeee;text-align:center;">${item.quantity}</td>
      <td style="padding:10px 0;border-bottom:1px solid #e7eeee;text-align:right;">$${item.lineTotal.toFixed(2)}</td>
    </tr>`).join('');

  const text = `Hi ${order.customer.firstName},\n\nThanks for your order. We received it successfully.\n\nOrder: ${order.orderNumber}\n\n${itemLines}\n\nItems: ${order.totalQuantity}\nTotal: $${order.total.toFixed(2)}\n\nThis portfolio demo does not process a real payment or shipment.\n\nMoss & Marine`;
  const html = emailShell(`
    <h1 style="font-size:26px;margin:0 0 8px;">Order confirmed</h1>
    <p style="margin:0 0 22px;line-height:1.6;">Thanks, ${order.customer.firstName}. We received order <strong>${order.orderNumber}</strong>.</p>
    <table style="width:100%;border-collapse:collapse;font-size:14px;">
      <thead><tr><th style="text-align:left;padding-bottom:8px;">Item</th><th style="text-align:center;padding-bottom:8px;">Qty</th><th style="text-align:right;padding-bottom:8px;">Total</th></tr></thead>
      <tbody>${itemRows}</tbody>
    </table>
    <p style="font-size:18px;font-weight:700;text-align:right;margin:20px 0 0;">Total: $${order.total.toFixed(2)}</p>
    <p style="margin:24px 0 0;padding:12px 14px;background:#f4f8f8;border-radius:10px;color:#607174;font-size:13px;">Portfolio demo: no real payment or shipment is processed.</p>
  `);

  return mg.messages.create(domain, {
    from: fromAddress,
    to: order.customer.email,
    subject: `Order confirmation — ${order.orderNumber}`,
    text,
    html
  });
}






/**
 * Optional admin notifications for monitoring demo-site activity.
 * Disabled automatically when ADMIN_NOTIFICATION_EMAIL is not configured.
 */

function getAdminNotificationEmail() {
  const address = (process.env.ADMIN_NOTIFICATION_EMAIL || '').trim();
  if (!address) return null;

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address)) {
    throw new Error('ADMIN_NOTIFICATION_EMAIL is not a valid email address.');
  }

  return address;
}

async function sendAdminNotification(subject, text) {
  const recipient = getAdminNotificationEmail();
  if (!recipient) return null;

  const { mg, domain, fromAddress } = getMailgunClient();

  return mg.messages.create(domain, {
    from: fromAddress,
    to: recipient,
    subject,
    text
  });
}

async function sendNewSignupNotification() {
  const text = [
    'A new user signed up on Moss & Marine.',
    '',
    `Time: ${new Date().toISOString()}`,
    '',
    'This is an automated portfolio-site notification.'
  ].join('\n');

  return sendAdminNotification('Moss & Marine — New signup', text);
}

async function sendNewOrderNotification(order) {
  const text = [
    'A new demo order was placed on Moss & Marine.',
    '',
    `Order: ${order.orderNumber}`,
    `Items: ${order.totalQuantity}`,
    `Total: $${Number(order.total).toFixed(2)} CAD`,
    `Time: ${new Date(order.createdAt || Date.now()).toISOString()}`,
    '',
    'Demo only — no real payment or shipment is processed.'
  ].join('\n');

  return sendAdminNotification(
    `Moss & Marine — New demo order ${order.orderNumber}`,
    text
  );
}

module.exports = {
  sendWelcomeEmail,
  sendOrderConfirmationEmail,
  sendNewSignupNotification,
  sendNewOrderNotification
};
