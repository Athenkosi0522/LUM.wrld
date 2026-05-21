const { Resend } = require('resend');
const resend = new Resend(process.env.RESEND_API_KEY);

const brand = `<div style="font-size:26px;font-weight:bold;letter-spacing:4px;color:#f2f2f2">LUM<span style="color:#4cce4c">.</span>WRLD</div><div style="font-size:11px;letter-spacing:3px;text-transform:uppercase;color:#5a5a5a;margin-bottom:24px">Light Up My Wrld</div>`;

async function sendOrderConfirmation(order) {
  const itemsHtml = order.items.map(i => `<tr><td style="padding:8px 0;border-bottom:1px solid #1c1c1c;color:#f2f2f2">${i.product_name||i.name}</td><td style="padding:8px 0;border-bottom:1px solid #1c1c1c;color:#5a5a5a">${i.size}</td><td style="padding:8px 0;border-bottom:1px solid #1c1c1c;text-align:center;color:#f2f2f2">${i.quantity}</td><td style="padding:8px 0;border-bottom:1px solid #1c1c1c;text-align:right;color:#4cce4c">R ${(i.subtotal||0).toLocaleString()}</td></tr>`).join('');
  const html = `<!DOCTYPE html><html><body style="background:#050505;color:#f2f2f2;font-family:Arial,sans-serif;margin:0;padding:0"><div style="max-width:560px;margin:0 auto;padding:40px 24px">${brand}<div style="background:#111;border:1px solid #1c1c1c;padding:24px;margin-bottom:24px"><div style="color:#4cce4c;font-size:11px;letter-spacing:3px;text-transform:uppercase;margin-bottom:8px">Order Confirmed 🔥</div><div style="font-size:22px;font-weight:bold">Thanks, ${order.customer_name.split(' ')[0]}!</div><div style="color:#5a5a5a;font-size:13px">Order #${order.id.slice(0,8).toUpperCase()}</div></div><table style="width:100%;border-collapse:collapse;margin-bottom:24px"><thead><tr style="color:#5a5a5a;font-size:11px;letter-spacing:2px;text-transform:uppercase"><th style="text-align:left;padding-bottom:8px">Item</th><th style="text-align:left;padding-bottom:8px">Size</th><th style="text-align:center;padding-bottom:8px">Qty</th><th style="text-align:right;padding-bottom:8px">Price</th></tr></thead><tbody>${itemsHtml}</tbody></table><div style="display:flex;justify-content:space-between;padding:16px 0;border-top:1px solid #4cce4c"><span style="color:#5a5a5a;font-size:13px;letter-spacing:2px;text-transform:uppercase">Total</span><span style="font-size:22px;font-weight:bold;color:#4cce4c">R ${order.total_amount.toLocaleString()}</span></div><div style="background:#111;border:1px solid #1c1c1c;padding:16px;margin-top:24px;font-size:13px;color:#5a5a5a;line-height:1.8">Questions? WhatsApp us at <a href="https://wa.me/27634805441" style="color:#4cce4c">063 480 5441</a></div><div style="margin-top:32px;font-size:11px;color:#5a5a5a;text-align:center">© 2025 lum.wrld — Gqeberha 🇿🇦</div></div></body></html>`;
  try {
    await resend.emails.send({ from: process.env.EMAIL_FROM, to: order.customer_email, subject: `Order confirmed 🔥 — lum.wrld #${order.id.slice(0,8).toUpperCase()}`, html });
    console.log(`Order email sent → ${order.customer_email}`);
  } catch (err) { console.error('Order email failed:', err.message); }
}

async function sendPreorderConfirmation(preorder) {
  const html = `<!DOCTYPE html><html><body style="background:#050505;color:#f2f2f2;font-family:Arial,sans-serif;margin:0;padding:0"><div style="max-width:560px;margin:0 auto;padding:40px 24px">${brand}<div style="background:#111;border:1px solid #1c1c1c;padding:24px;margin-bottom:24px"><div style="color:#f5c518;font-size:11px;letter-spacing:3px;text-transform:uppercase;margin-bottom:8px">Pre-Order Registered ⏳</div><div style="font-size:22px;font-weight:bold">You're on the list, ${preorder.customer_name.split(' ')[0]}!</div></div><div style="background:#111;border:1px solid #1c1c1c;padding:20px;margin-bottom:16px"><div style="font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#5a5a5a;margin-bottom:8px">Pre-ordered Item</div><div style="font-size:16px;font-weight:bold;text-transform:uppercase;color:#f2f2f2">${preorder.product_name}</div><div style="color:#5a5a5a;font-size:13px;margin-top:4px">Size: ${preorder.size} · R ${preorder.product_price?.toLocaleString()}</div></div><div style="background:#111;border:1px solid #1c1c1c;padding:16px;font-size:13px;color:#5a5a5a;line-height:1.8">We'll email you the moment this drops back in stock. 🔥<br/><br/>WhatsApp <a href="https://wa.me/27634805441" style="color:#4cce4c">063 480 5441</a></div><div style="margin-top:32px;font-size:11px;color:#5a5a5a;text-align:center">© 2025 lum.wrld — Gqeberha 🇿🇦</div></div></body></html>`;
  try {
    await resend.emails.send({ from: process.env.EMAIL_FROM, to: preorder.customer_email, subject: `You're on the list 🔥 — ${preorder.product_name} | lum.wrld`, html });
    console.log(`Preorder email sent → ${preorder.customer_email}`);
  } catch (err) { console.error('Preorder email failed:', err.message); }
}

async function sendRestockNotification(preorder, product) {
  const html = `<!DOCTYPE html><html><body style="background:#050505;color:#f2f2f2;font-family:Arial,sans-serif;margin:0;padding:0"><div style="max-width:560px;margin:0 auto;padding:40px 24px">${brand}<div style="background:#111;border:2px solid #4cce4c;padding:24px;margin-bottom:24px"><div style="color:#4cce4c;font-size:11px;letter-spacing:3px;text-transform:uppercase;margin-bottom:8px">Back in Stock 🔥</div><div style="font-size:22px;font-weight:bold">${preorder.customer_name.split(' ')[0]}, it's here!</div></div><div style="background:#111;border:1px solid #1c1c1c;padding:20px;margin-bottom:16px"><div style="font-size:16px;font-weight:bold;text-transform:uppercase;color:#f2f2f2">${product.name}</div><div style="color:#4cce4c;font-size:20px;font-weight:bold;margin-top:4px">R ${product.price?.toLocaleString()}</div><div style="color:#5a5a5a;font-size:13px;margin-top:4px">Size: ${preorder.size}</div></div><div style="text-align:center;margin:24px 0"><a href="${process.env.APP_URL||'https://lumw.store'}#shop" style="background:#4cce4c;color:#050505;font-weight:bold;font-size:13px;letter-spacing:3px;text-transform:uppercase;padding:14px 32px;text-decoration:none;display:inline-block">Shop Now →</a></div><div style="background:#111;border:1px solid #1c1c1c;padding:16px;font-size:13px;color:#5a5a5a;line-height:1.8">Grab it before it sells out again!<br/><br/>WhatsApp <a href="https://wa.me/27634805441" style="color:#4cce4c">063 480 5441</a></div><div style="margin-top:32px;font-size:11px;color:#5a5a5a;text-align:center">© 2025 lum.wrld — Gqeberha 🇿🇦</div></div></body></html>`;
  try {
    await resend.emails.send({ from: process.env.EMAIL_FROM, to: preorder.customer_email, subject: `🔥 Back in stock — ${product.name} | lum.wrld`, html });
    console.log(`Restock email sent → ${preorder.customer_email}`);
  } catch (err) { console.error('Restock email failed:', err.message); }
}

async function sendMagicLink(customer, magicUrl) {
  const html = `<!DOCTYPE html><html><body style="background:#050505;color:#f2f2f2;font-family:Arial,sans-serif;margin:0;padding:0">
  <div style="max-width:480px;margin:0 auto;padding:40px 24px">
    ${brand}
    <div style="background:#111;border:1px solid #1c1c1c;padding:24px;margin-bottom:24px;position:relative;overflow:hidden">
      <div style="position:absolute;top:0;left:0;right:0;height:2px;background:#4cce4c"></div>
      <div style="color:#4cce4c;font-size:11px;letter-spacing:3px;text-transform:uppercase;margin-bottom:8px">Your Login Link 🔗</div>
      <div style="font-size:20px;font-weight:bold;margin-bottom:4px">Hey ${customer.name.split(' ')[0]}!</div>
      <div style="color:#5a5a5a;font-size:13px;line-height:1.7">Click the button below to log in and continue your checkout. This link expires in 15 minutes.</div>
    </div>
    <div style="text-align:center;margin:32px 0">
      <a href="${magicUrl}" style="background:#4cce4c;color:#050505;font-weight:bold;font-size:13px;letter-spacing:3px;text-transform:uppercase;padding:16px 40px;text-decoration:none;display:inline-block">Login to lum.wrld →</a>
    </div>
    <div style="background:#111;border:1px solid #1c1c1c;padding:16px;font-size:12px;color:#5a5a5a;line-height:1.8">
      If you didn't request this, ignore this email — nothing will happen.<br/>
      This link expires in <strong style="color:#f2f2f2">15 minutes</strong> and can only be used once.
    </div>
    <div style="margin-top:32px;font-size:11px;color:#5a5a5a;text-align:center">© 2025 lum.wrld — Gqeberha 🇿🇦</div>
  </div>
  </body></html>`;
  try {
    await resend.emails.send({
      from: process.env.EMAIL_FROM,
      to: customer.email,
      subject: `Your lum.wrld login link 🔗`,
      html
    });
    console.log(`Magic link sent → ${customer.email}`);
  } catch (err) { console.error('Magic link email failed:', err.message); }
}

module.exports = { sendOrderConfirmation, sendPreorderConfirmation, sendRestockNotification, sendMagicLink };
