/*
  ============================================================
  PREORDER SYSTEM — ADD TO index.html
  ============================================================
  1. Add the CSS below inside your <style> tag
  2. Add the HTML modal below before </body>
  3. Replace your renderProducts() and openModal() functions
     with the updated versions below
  ============================================================
*/

/* ── 1. CSS — add inside <style> ── */
const PREORDER_CSS = `
/* PREORDER BUTTON */
.prod-preorder{position:absolute;bottom:0;left:0;right:0;background:#f5c518;color:#050505;font-family:var(--font-c);font-weight:800;font-size:.73rem;letter-spacing:.2em;text-transform:uppercase;text-align:center;padding:.75rem;transform:translateY(100%);transition:transform .3s ease;z-index:2}
.prod-card:hover .prod-preorder{transform:translateY(0)}
.badge-out{background:var(--red)!important;color:#fff!important}

/* PREORDER MODAL */
.preorder-modal-bg{position:fixed;inset:0;background:rgba(0,0,0,.85);z-index:970;opacity:0;pointer-events:none;transition:opacity .3s;display:flex;align-items:center;justify-content:center;padding:1rem}
.preorder-modal-bg.open{opacity:1;pointer-events:all}
.preorder-modal{background:var(--near-black);border:1px solid var(--border);max-width:440px;width:100%;position:relative;overflow:hidden}
.preorder-modal::before{content:'';position:absolute;top:0;left:0;right:0;height:2px;background:#f5c518}
.preorder-modal-head{display:flex;align-items:center;justify-content:space-between;padding:1.3rem 1.5rem;border-bottom:1px solid var(--border)}
.preorder-modal-title{font-family:var(--font-d);font-size:1.3rem;letter-spacing:.08em;text-transform:uppercase}
.preorder-modal-close{font-size:1.2rem;color:var(--muted);transition:color var(--trans);cursor:pointer}
.preorder-modal-close:hover{color:var(--green-bright)}
.preorder-modal-body{padding:1.5rem;display:flex;flex-direction:column;gap:1rem}
.preorder-product-info{background:var(--card);padding:1rem;border-left:2px solid #f5c518}
.preorder-product-name{font-family:var(--font-c);font-weight:700;font-size:.95rem;letter-spacing:.06em;text-transform:uppercase}
.preorder-product-sub{font-size:.78rem;color:var(--muted);margin-top:.2rem}
.preorder-note{font-size:.8rem;color:var(--muted);line-height:1.7;background:var(--card);padding:.9rem;border:1px solid var(--border)}
.preorder-submit-btn{width:100%;font-family:var(--font-c);font-weight:800;font-size:.82rem;letter-spacing:.2em;text-transform:uppercase;background:#f5c518;color:#050505;padding:1rem;border:none;cursor:pointer;transition:filter .2s}
.preorder-submit-btn:hover{filter:brightness(1.1)}
.preorder-submit-btn:disabled{opacity:.5;cursor:default}
`;

/* ── 2. HTML MODAL — add before </body> ── */
const PREORDER_MODAL_HTML = `
<div class="preorder-modal-bg" id="preorderModalBg">
  <div class="preorder-modal">
    <div class="preorder-modal-head">
      <div class="preorder-modal-title">⏳ Pre-Order</div>
      <button class="preorder-modal-close" onclick="closePreorderModal()">✕</button>
    </div>
    <div class="preorder-modal-body">
      <div class="preorder-product-info">
        <div class="preorder-product-name" id="preorderProductName">Product Name</div>
        <div class="preorder-product-sub" id="preorderProductSub">Out of stock — join the waitlist</div>
      </div>
      <p class="preorder-note">
        This item is currently out of stock. Enter your details below and we'll email you the moment it's back — you'll be first in line. 🔥
      </p>
      <div class="form-group" style="display:flex;flex-direction:column;gap:.45rem">
        <label class="form-label" style="font-family:var(--font-c);font-weight:700;font-size:.7rem;letter-spacing:.2em;text-transform:uppercase;color:var(--muted)">Your Name</label>
        <input type="text" class="form-input" id="preorderName" placeholder="Sipho Nkosi" style="background:var(--black);border:1px solid var(--border);color:var(--white);font-size:.9rem;padding:.85rem 1.1rem;outline:none;width:100%;transition:border-color .25s"/>
      </div>
      <div class="form-group" style="display:flex;flex-direction:column;gap:.45rem">
        <label class="form-label" style="font-family:var(--font-c);font-weight:700;font-size:.7rem;letter-spacing:.2em;text-transform:uppercase;color:var(--muted)">Email Address</label>
        <input type="email" class="form-input" id="preorderEmail" placeholder="you@email.com" style="background:var(--black);border:1px solid var(--border);color:var(--white);font-size:.9rem;padding:.85rem 1.1rem;outline:none;width:100%;transition:border-color .25s"/>
      </div>
      <div class="size-grid" id="preorderSizeGrid" style="display:flex;gap:.5rem;flex-wrap:wrap"></div>
      <button class="preorder-submit-btn" id="preorderSubmitBtn" onclick="submitPreorder()">Notify Me When Back →</button>
    </div>
  </div>
</div>
`;

/* ── 3. UPDATED JS — replace existing renderProducts + openModal ── */

// Track current preorder product
let currentPreorderProduct = null;
let selectedPreorderSize = null;

// Updated renderProducts — checks stock and shows preorder button
function renderProducts(filter = "all") {
  const grid = document.getElementById("productsGrid");

  // Fetch from API (replace hardcoded PRODUCTS array)
  fetch(`/api/products${filter !== 'all' ? `?category=${filter}` : ''}`)
    .then(r => r.json())
    .then(({ products }) => {
      grid.innerHTML = products.map(p => {
        const outOfStock = p.stock === 0;
        return `
          <div class="prod-card reveal" onclick="openModal('${p.id}')">
            <div class="prod-img-wrap">
              ${p.tag ? `<span class="prod-badge ${outOfStock ? 'badge-out' : ''}">${outOfStock ? 'OUT OF STOCK' : p.tag}</span>` : ''}
              ${outOfStock ? '' : '<span class="prod-badge" style="display:none"></span>'}
              <img src="${p.image_url}" alt="${p.name}" loading="lazy"/>
              ${outOfStock
                ? `<button class="prod-preorder" onclick="event.stopPropagation();openPreorderModal('${p.id}')">⏳ Pre-Order</button>`
                : `<button class="prod-quick" onclick="event.stopPropagation();addToCart('${p.id}','M')">+ Add to Bag</button>`
              }
            </div>
            <div class="prod-info">
              <div class="prod-name">${p.name}</div>
              <div class="prod-sub">${p.description || ''}</div>
              <div class="prod-pricing">
                <span class="prod-price">R ${p.price.toLocaleString()}</span>
                ${outOfStock ? '<span style="font-size:.72rem;color:var(--red);font-family:var(--font-c);letter-spacing:.1em;text-transform:uppercase;margin-left:.5rem">Out of Stock</span>' : ''}
              </div>
            </div>
          </div>
        `;
      }).join('');
      observeReveal();
    })
    .catch(() => {
      // Fallback to hardcoded if API fails
      grid.innerHTML = '<div style="color:var(--muted);padding:2rem;text-align:center;font-family:var(--font-c);letter-spacing:.1em">Failed to load products</div>';
    });
}

// Open preorder modal for out-of-stock product
function openPreorderModal(productId) {
  fetch(`/api/products/${productId}`)
    .then(r => r.json())
    .then(({ product }) => {
      currentPreorderProduct = product;
      selectedPreorderSize = product.sizes?.[0] || null;
      document.getElementById('preorderProductName').textContent = product.name;
      document.getElementById('preorderProductSub').textContent = `R ${product.price.toLocaleString()} — Out of stock`;
      document.getElementById('preorderName').value = '';
      document.getElementById('preorderEmail').value = '';

      // Size selection
      const sizeGrid = document.getElementById('preorderSizeGrid');
      if (product.sizes?.length > 1) {
        sizeGrid.style.display = 'flex';
        sizeGrid.innerHTML = product.sizes.map((s, i) =>
          `<button class="size-btn${i === 0 ? ' active' : ''}" onclick="selectPreorderSize(this)">${s}</button>`
        ).join('');
      } else {
        sizeGrid.style.display = 'none';
      }

      document.getElementById('preorderModalBg').classList.add('open');
      document.body.style.overflow = 'hidden';
    });
}

function closePreorderModal() {
  document.getElementById('preorderModalBg').classList.remove('open');
  document.body.style.overflow = '';
  currentPreorderProduct = null;
}

function selectPreorderSize(btn) {
  document.querySelectorAll('#preorderSizeGrid .size-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  selectedPreorderSize = btn.textContent;
}

async function submitPreorder() {
  const name = document.getElementById('preorderName').value.trim();
  const email = document.getElementById('preorderEmail').value.trim();
  const btn = document.getElementById('preorderSubmitBtn');

  if (!name || !email) { showToast('Please enter your name and email'); return; }
  if (!email.includes('@')) { showToast('Enter a valid email address'); return; }
  if (!currentPreorderProduct) return;

  btn.disabled = true;
  btn.textContent = 'Registering...';

  try {
    const res = await fetch('/api/preorders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        product_id: currentPreorderProduct.id,
        customer_name: name,
        customer_email: email,
        size: selectedPreorderSize || 'N/A'
      })
    });

    const data = await res.json();
    if (data.success) {
      closePreorderModal();
      showToast(`You're on the waitlist for ${currentPreorderProduct.name} 🔥`);
    } else if (res.status === 409) {
      showToast('You already pre-ordered this item');
      closePreorderModal();
    } else {
      showToast('Something went wrong. Try again.');
      btn.disabled = false;
      btn.textContent = 'Notify Me When Back →';
    }
  } catch {
    showToast('Something went wrong. Try again.');
    btn.disabled = false;
    btn.textContent = 'Notify Me When Back →';
  }
}

// Close preorder modal on background click
document.getElementById('preorderModalBg')?.addEventListener('click', e => {
  if (e.target === document.getElementById('preorderModalBg')) closePreorderModal();
});
