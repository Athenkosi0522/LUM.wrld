/* =============================================================
   MAGIC LINK CHECKOUT — ADD TO index.html
   =============================================================
   1. Add CSS inside your <style> tag
   2. Add HTML modal before </body>
   3. Replace the checkoutBtn event listener with the new one
   4. Add the auth JS block before </script>
   ============================================================= */


/* ── 1. CSS — paste inside <style> ── */
const AUTH_CSS = `
/* AUTH MODAL */
.auth-modal-bg{position:fixed;inset:0;background:rgba(0,0,0,.88);z-index:970;opacity:0;pointer-events:none;transition:opacity .3s;display:flex;align-items:center;justify-content:center;padding:1rem}
.auth-modal-bg.open{opacity:1;pointer-events:all}
.auth-modal{background:var(--near-black);border:1px solid var(--border);max-width:420px;width:100%;position:relative;overflow:hidden}
.auth-modal::before{content:'';position:absolute;top:0;left:0;right:0;height:2px;background:var(--green-bright)}
.auth-modal-head{display:flex;align-items:center;justify-content:space-between;padding:1.3rem 1.5rem;border-bottom:1px solid var(--border)}
.auth-modal-title{font-family:var(--font-d);font-size:1.3rem;letter-spacing:.08em;text-transform:uppercase}
.auth-modal-close{font-size:1.2rem;color:var(--muted);cursor:pointer;transition:color var(--trans)}
.auth-modal-close:hover{color:var(--green-bright)}
.auth-modal-body{padding:1.5rem;display:flex;flex-direction:column;gap:1rem}
.auth-step{display:none}
.auth-step.active{display:flex;flex-direction:column;gap:1rem}
.auth-note{font-size:.8rem;color:var(--muted);line-height:1.7}
.auth-submit-btn{width:100%;font-family:var(--font-c);font-weight:800;font-size:.82rem;letter-spacing:.2em;text-transform:uppercase;background:var(--green-bright);color:var(--black);padding:1rem;border:none;cursor:pointer;transition:box-shadow var(--trans)}
.auth-submit-btn:hover{box-shadow:var(--green-glow)}
.auth-submit-btn:disabled{opacity:.5;cursor:default}

/* ACCOUNT CHIP in nav */
.account-chip{font-family:var(--font-c);font-weight:700;font-size:.72rem;letter-spacing:.15em;text-transform:uppercase;color:var(--muted);padding:.4rem .9rem;border:1px solid var(--border);transition:all .2s;cursor:pointer}
.account-chip:hover{border-color:var(--green-bright);color:var(--green-bright)}
.account-chip.logged-in{border-color:rgba(76,206,76,.4);color:var(--green-bright);background:var(--green-dim)}
`;


/* ── 2. HTML MODAL — paste before </body> ── */
const AUTH_MODAL_HTML = `
<div class="auth-modal-bg" id="authModalBg">
  <div class="auth-modal">
    <div class="auth-modal-head">
      <div class="auth-modal-title" id="authModalTitle">Checkout</div>
      <button class="auth-modal-close" onclick="closeAuthModal()">✕</button>
    </div>
    <div class="auth-modal-body">

      <!-- STEP 1: Enter email -->
      <div class="auth-step active" id="authStep1">
        <p class="auth-note">Enter your email to continue. We'll send you a secure login link — no password needed.</p>
        <div class="form-group" style="display:flex;flex-direction:column;gap:.45rem">
          <label class="form-label" style="font-family:var(--font-c);font-weight:700;font-size:.7rem;letter-spacing:.2em;text-transform:uppercase;color:var(--muted)">Your Name</label>
          <input type="text" class="form-input" id="authName" placeholder="Sipho Nkosi" style="background:var(--black);border:1px solid var(--border);color:var(--white);font-size:.9rem;padding:.85rem 1.1rem;outline:none;width:100%"/>
        </div>
        <div class="form-group" style="display:flex;flex-direction:column;gap:.45rem">
          <label class="form-label" style="font-family:var(--font-c);font-weight:700;font-size:.7rem;letter-spacing:.2em;text-transform:uppercase;color:var(--muted)">Email Address</label>
          <input type="email" class="form-input" id="authEmail" placeholder="you@email.com" style="background:var(--black);border:1px solid var(--border);color:var(--white);font-size:.9rem;padding:.85rem 1.1rem;outline:none;width:100%"/>
        </div>
        <button class="auth-submit-btn" id="authSendBtn" onclick="sendMagicLink()">Send Login Link →</button>
        <p class="auth-note" style="text-align:center;font-size:.72rem">Already have a link? Check your email 📧</p>
      </div>

      <!-- STEP 2: Check email -->
      <div class="auth-step" id="authStep2">
        <div style="text-align:center;padding:1rem 0">
          <div style="font-size:2.5rem;margin-bottom:.8rem">📧</div>
          <div style="font-family:var(--font-d);font-size:1.3rem;letter-spacing:.06em;text-transform:uppercase;margin-bottom:.5rem">Check Your Email</div>
          <p class="auth-note" style="text-align:center">We sent a login link to <strong id="authEmailSent" style="color:var(--green-bright)"></strong>.<br/>Click the link to continue checkout. It expires in 15 minutes.</p>
        </div>
        <button class="auth-submit-btn" style="background:var(--card);color:var(--muted);border:1px solid var(--border)" onclick="authGoBack()">← Use a different email</button>
      </div>

      <!-- STEP 3: Logged in, continue to payment -->
      <div class="auth-step" id="authStep3">
        <div style="background:var(--green-dim);border:1px solid rgba(76,206,76,.3);padding:1rem;display:flex;align-items:center;gap:.8rem">
          <span style="font-size:1.3rem">✅</span>
          <div>
            <div style="font-family:var(--font-c);font-weight:700;font-size:.8rem;letter-spacing:.1em;text-transform:uppercase;color:var(--green-bright)">Logged In</div>
            <div style="font-size:.8rem;color:var(--muted)" id="authLoggedInAs">—</div>
          </div>
        </div>
        <p class="auth-note">Ready to checkout. Your order will be saved to your account.</p>
        <button class="auth-submit-btn" onclick="proceedToPayment()">Continue to Payment →</button>
        <button style="width:100%;font-family:var(--font-c);font-size:.72rem;letter-spacing:.15em;text-transform:uppercase;color:var(--muted);padding:.6rem;background:none;border:none;cursor:pointer" onclick="logoutCustomer()">Not you? Log out</button>
      </div>

    </div>
  </div>
</div>
`;


/* ── 3. REPLACE the checkoutBtn event listener with: ── */
document.getElementById('checkoutBtn').addEventListener('click', () => {
  if (cart.length === 0) return;
  openAuthModal();
});


/* ── 4. AUTH JS — paste before </script> ── */

// ─── SESSION MANAGEMENT ───
let currentCustomer = null;

function getSession() {
  try {
    return {
      session_token: localStorage.getItem('lw_session_token'),
      customer_id: localStorage.getItem('lw_customer_id')
    };
  } catch { return {}; }
}

function saveSession(sessionToken, customerId, name) {
  localStorage.setItem('lw_session_token', sessionToken);
  localStorage.setItem('lw_customer_id', customerId);
  localStorage.setItem('lw_customer_name', name);
}

function clearSession() {
  localStorage.removeItem('lw_session_token');
  localStorage.removeItem('lw_customer_id');
  localStorage.removeItem('lw_customer_name');
  currentCustomer = null;
  updateAccountChip();
}

function updateAccountChip() {
  const chip = document.getElementById('accountChip');
  if (!chip) return;
  const name = localStorage.getItem('lw_customer_name');
  if (name) {
    chip.textContent = name.split(' ')[0];
    chip.classList.add('logged-in');
  } else {
    chip.textContent = 'Login';
    chip.classList.remove('logged-in');
  }
}

// Validate session on page load
async function validateSession() {
  const { session_token, customer_id } = getSession();
  if (!session_token || !customer_id) return;

  try {
    const res = await fetch('/api/auth/validate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_token, customer_id })
    });
    const data = await res.json();
    if (data.success) {
      currentCustomer = data.customer;
      updateAccountChip();
    } else {
      clearSession();
    }
  } catch {
    // API offline — keep session locally
  }
}

// ─── AUTH MODAL ───
function openAuthModal() {
  const { session_token, customer_id } = getSession();
  if (session_token && customer_id && currentCustomer) {
    // Already logged in — go straight to step 3
    showAuthStep(3);
    document.getElementById('authLoggedInAs').textContent = currentCustomer.email;
  } else {
    showAuthStep(1);
  }
  document.getElementById('authModalBg').classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeAuthModal() {
  document.getElementById('authModalBg').classList.remove('open');
  document.body.style.overflow = '';
}

function showAuthStep(step) {
  document.querySelectorAll('.auth-step').forEach(s => s.classList.remove('active'));
  document.getElementById(`authStep${step}`).classList.add('active');
  const titles = { 1: 'Checkout', 2: 'Check Your Email', 3: 'Ready to Pay' };
  document.getElementById('authModalTitle').textContent = titles[step];
}

function authGoBack() {
  showAuthStep(1);
}

async function sendMagicLink() {
  const name = document.getElementById('authName').value.trim();
  const email = document.getElementById('authEmail').value.trim();
  const btn = document.getElementById('authSendBtn');

  if (!name) { showToast('Enter your name'); return; }
  if (!email || !email.includes('@')) { showToast('Enter a valid email'); return; }

  btn.disabled = true;
  btn.textContent = 'Sending...';

  try {
    const res = await fetch('/api/auth/magic-link', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email })
    });
    const data = await res.json();
    if (data.success) {
      document.getElementById('authEmailSent').textContent = email;
      showAuthStep(2);
    } else {
      showToast(data.error || 'Failed to send link');
      btn.disabled = false;
      btn.textContent = 'Send Login Link →';
    }
  } catch {
    showToast('Something went wrong — try again');
    btn.disabled = false;
    btn.textContent = 'Send Login Link →';
  }
}

async function proceedToPayment() {
  if (cart.length === 0) { closeAuthModal(); return; }

  const { session_token, customer_id } = getSession();
  const total = cart.reduce((s, x) => s + x.price * x.qty, 0);

  try {
    // Create order first
    const orderRes = await fetch('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customer: {
          name: currentCustomer.name,
          email: currentCustomer.email,
          phone: currentCustomer.phone || '',
          customer_id: customer_id
        },
        items: cart.map(item => ({
          product_id: item.id,
          size: item.size,
          quantity: item.qty
        }))
      })
    });

    const orderData = await orderRes.json();
    if (!orderData.success) {
      showToast(orderData.error || 'Failed to create order ❌');
      return;
    }

   // Get Yoco payment data
const payRes = await fetch('/api/payments/initiate', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ order_id: orderData.order_id })
});

const payData = await payRes.json();
if (!payData.success) {
  showToast('Payment setup failed ❌');
  return;
}

 // Redirect to Yoco hosted checkout
closeAuthModal();
window.location.href = payData.redirect_url;

  } catch {
    showToast('Something went wrong — try again ❌');
  }
}

async function logoutCustomer() {
  const { customer_id } = getSession();
  try {
    await fetch('/api/auth/logout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ customer_id })
    });
  } catch {}
  clearSession();
  closeAuthModal();
  showToast('Logged out ✅');
}

// Handle auth redirect from magic link verification
function handleAuthRedirect() {
  const params = new URLSearchParams(window.location.search);
  const auth = params.get('auth');
  const session = params.get('session');
  const customerId = params.get('customer_id');
  const name = params.get('name');

  if (auth === 'success' && session && customerId) {
    saveSession(session, customerId, decodeURIComponent(name || ''));
    currentCustomer = { id: customerId, name: decodeURIComponent(name || ''), email: '' };
    updateAccountChip();
    // Clean URL
    window.history.replaceState({}, '', window.location.pathname);
    showToast(`Welcome back, ${decodeURIComponent(name || '').split(' ')[0]}! 🔥`);
    // If they had cart items, open checkout automatically
    if (cart.length > 0) {
      setTimeout(() => openAuthModal(), 800);
    }
  } else if (auth === 'expired') {
    showToast('Login link expired — request a new one');
    window.history.replaceState({}, '', window.location.pathname);
  } else if (auth === 'invalid') {
    showToast('Invalid login link — try again');
    window.history.replaceState({}, '', window.location.pathname);
  }
}

// ─── INIT ───
validateSession();
handleAuthRedirect();

// Close auth modal on background click
document.getElementById('authModalBg')?.addEventListener('click', e => {
  if (e.target === document.getElementById('authModalBg')) closeAuthModal();
});
