/* scripts.js - modular helpers for products, cart, auth, and checkout
   Backend endpoints are referenced but not implemented here:
   POST /api/send-key
   POST /api/redeem
   POST /api/signup
   POST /api/login
   POST /api/verify-email
   This frontend stores session token & cart in localStorage to persist across refreshes.
*/

const PRODUCTS = [
  { id: 'vortex-lite', title: 'Vortex Lite', price: 0, priceText: 'FREE', features: ['Basic FPS Boost'] },
  { id: 'vortex-basic', title: 'Vortex Basic', price: 5.99, priceText: '$5.99', features: ['FPS Boost','Reduced Input Delay','Better Frame Timing'] },
  { id: 'vortex-pro', title: 'Vortex Pro', price: 12.99, priceText: '$12.99', features: ['Maximum FPS','Registry Tweaks','Network Optimization','Input Delay Reduction','Memory Optimization'] },
  { id: 'vortex-elite', title: 'Vortex Elite', price: 24.99, priceText: '$24.99', features: ['Premium package'], premium:true }
];

const CART_KEY = 'vortex_cart_v1';
const SESSION_KEY = 'vortex_session_v1';
const GENERATED_LICENSE = 'vortex_generated_key';

function $(sel){return document.querySelector(sel)}
function $all(sel){return Array.from(document.querySelectorAll(sel))}

function loadCart(){
  try{ return JSON.parse(localStorage.getItem(CART_KEY)) || [] }catch(e){return []}
}
function saveCart(c){localStorage.setItem(CART_KEY,JSON.stringify(c));updateCartCount()}
function updateCartCount(){ const n = loadCart().reduce((s,i)=>s+i.qty,0); $all('#cart-count').forEach(el=>el.textContent = n)}

function addToCart(id,qty=1){
  const cart = loadCart();
  const idx = cart.findIndex(i=>i.id===id);
  if(idx>=0){cart[idx].qty += qty}else{ const p = PRODUCTS.find(x=>x.id===id); cart.push({id,qty,price:p.price || 0,title:p.title}) }
  saveCart(cart);
}

function removeFromCart(id){ const cart = loadCart().filter(i=>i.id!==id); saveCart(cart); renderCart(); }
function changeQty(id,qty){ const cart = loadCart(); const it = cart.find(i=>i.id===id); if(!it) return; it.qty = Math.max(0,qty); saveCart(cart); renderCart(); }

function renderProducts(containerId='product-catalog'){ const mount = document.getElementById(containerId); if(!mount) return; mount.innerHTML = ''; PRODUCTS.forEach(p=>{
  const card = document.createElement('div'); card.className='card product-card glass';
  card.innerHTML = `
	<div style="display:flex;justify-content:space-between;align-items:center">
	  <strong>${p.title}</strong>
	  <div class="price-badge">${p.priceText}</div>
	</div>
	<p class="muted">${p.premium? 'Premium package' : 'Optimized for gaming'}</p>
	<ul class="features">${p.features.map(f=>`<li>• ${f}</li>`).join('')}</ul>
	<div style="display:flex;gap:8px;margin-top:12px">
	  ${p.price===0? `<a class="btn btn-primary" href="something.html">Get Free</a>` : `<button class="btn btn-add" data-add="${p.id}">Add to Cart</button>`}
	</div>
  `;
  mount.appendChild(card);
});
  // bind add buttons
  mount.querySelectorAll('[data-add]').forEach(btn=>btn.addEventListener('click',e=>{ addToCart(btn.dataset.add); }));
}

function renderProductsPreview(){ const mount = document.getElementById('products-list'); if(!mount) return; mount.innerHTML = ''; PRODUCTS.slice(0,3).forEach(p=>{
  const el = document.createElement('div'); el.className='card glass'; el.innerHTML = `<strong>${p.title}</strong><div class="muted">${p.priceText}</div>`; mount.appendChild(el);
}); }

function renderCart(){ const root = document.getElementById('cart-root'); if(!root) return; const cart = loadCart(); if(cart.length===0){ root.innerHTML = '<div class="card glass"><p>Your cart is empty.</p><a href="products.html" class="btn">Browse Products</a></div>'; return }
  const list = document.createElement('div'); list.className='card glass';
  let total = 0;
  list.innerHTML = '<table style="width:100%"><thead><tr><th>Product</th><th>Qty</th><th>Price</th><th></th></tr></thead><tbody id="cart-items"></tbody></table>';
  cart.forEach(item=>{ total += (item.price||0)*item.qty });
  const footer = document.createElement('div'); footer.style.marginTop='12px'; footer.innerHTML = `<div style="display:flex;justify-content:space-between;align-items:center"><strong>Total</strong><strong>$${total.toFixed(2)}</strong></div><div style="margin-top:12px"><a href="checkout.html" class="btn btn-primary">Checkout</a></div>`;
  root.innerHTML=''; root.appendChild(list); root.appendChild(footer);
  const tbody = root.querySelector('#cart-items'); cart.forEach(item=>{
	const tr = document.createElement('tr'); tr.innerHTML = `<td>${item.title}</td><td><input type="number" min="0" value="${item.qty}" data-qty="${item.id}" style="width:64px" /></td><td>$${((item.price||0)*item.qty).toFixed(2)}</td><td><button class="btn" data-remove="${item.id}">Remove</button></td>`; tbody.appendChild(tr);
  });
  // bind listeners
  root.querySelectorAll('[data-remove]').forEach(b=>b.addEventListener('click',e=>{ removeFromCart(b.dataset.remove); }));
  root.querySelectorAll('input[data-qty]').forEach(inp=>inp.addEventListener('change',e=>{ changeQty(inp.dataset.qty, Number(inp.value)); }));
}

function generateLicense(){
  const seg = ()=>Math.random().toString(36).substring(2,7).toUpperCase();
  return `VRTX-${seg()}-${seg()}-${seg()}`;
}

async function confirmPurchase(){
  const cart = loadCart(); if(cart.length===0) return alert('Cart empty');
  const key = generateLicense(); localStorage.setItem(GENERATED_LICENSE,key);
  // Prepare payload for backend
  const payload = { items: cart, license: key, ts: Date.now() };
  // Attempt to POST to backend; backend may send key to Discord or store purchase
  try{
	await fetch('/api/send-key', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload) });
  }catch(e){
	console.warn('send-key failed (server may be absent)', e);
  }
  // clear local cart
  localStorage.removeItem(CART_KEY);
  updateCartCount();
  // redirect to confirmation page
  window.location.href = 'confirm.html';
}

async function redeemKeyFlow(key){
  const resultEl = $('#redeem-result'); if(!resultEl) return;
  resultEl.textContent = 'Verifying...';
  try{
	const res = await fetch('/api/redeem', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({key}) });
	if(!res.ok){ resultEl.textContent = 'Invalid Key'; return }
	const data = await res.json();
	if(data && data.download){ resultEl.innerHTML = `Valid! <a class="btn btn-primary" href="${data.download}">Download</a>` } else { resultEl.textContent = 'Valid key (no download provided by server).' }
  }catch(e){ resultEl.textContent = 'Server unreachable. The client posts to /api/redeem. Server should validate the key.' }
}

/* Authentication stubs: store token returned by backend in localStorage (do not store passwords). */
async function signup(email,password){ try{ const res = await fetch('/api/signup',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,password})}); const data = await res.json(); if(res.ok){ localStorage.setItem(SESSION_KEY, JSON.stringify({token: data.token || null, email})); return {ok:true} } return {ok:false, message: data.message || 'Signup failed'} }catch(e){return {ok:false,message:'Network error'} } }

async function login(email,password){ try{ const res = await fetch('/api/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,password})}); const data = await res.json(); if(res.ok){ localStorage.setItem(SESSION_KEY, JSON.stringify({token: data.token || null, email})); return {ok:true} } return {ok:false, message: data.message || 'Login failed'} }catch(e){return {ok:false,message:'Network error'}} }

function populateLicenseOnConfirm(){ const el = $('#license-key'); if(!el) return; const k = localStorage.getItem(GENERATED_LICENSE) || 'No key found'; el.textContent = k; }

function init(){
  updateCartCount();
  renderProducts('product-catalog');
  renderProductsPreview();
  renderCart();
  populateLicenseOnConfirm();

  // landing buttons
  const explore = $('#explore-btn'); if(explore){ explore.addEventListener('click',e=>{ document.getElementById('products-preview')?.scrollIntoView({behavior:'smooth'}) }) }
  const freeBtn = $('#free-btn'); if(freeBtn){ freeBtn.addEventListener('click',e=>{ window.location.href='something.html' }) }

  // checkout confirm
  const confirmBtn = $('#confirm-checkout'); if(confirmBtn){ confirmBtn.addEventListener('click',confirmPurchase) }

  // confirmation page uses generated key
  if(location.pathname.endsWith('confirm.html')){ populateLicenseOnConfirm(); }

  // redeem handler
  const redeemBtn = $('#redeem-btn'); if(redeemBtn){ redeemBtn.addEventListener('click',e=>{ const key = $('#redeem-key').value.trim(); if(!key) return $('#redeem-result').textContent='Enter a key'; redeemKeyFlow(key) }) }

  // login/signup binds
  const signupBtn = $('#signup-btn'); if(signupBtn){ signupBtn.addEventListener('click', async e=>{ const email = $('#signup-email').value; const pw = $('#signup-password').value; const r = await signup(email,pw); $('#signup-msg').textContent = r.ok? 'Check your email for verification (server required)' : r.message }) }
  const loginBtn = $('#login-btn'); if(loginBtn){ loginBtn.addEventListener('click', async e=>{ const email = $('#login-email').value; const pw = $('#login-password').value; const r = await login(email,pw); $('#login-msg').textContent = r.ok? 'Logged in' : r.message }) }

  // update navbar on scroll
  const navbar = $('#navbar'); if(navbar){ window.addEventListener('scroll',()=>{ if(window.scrollY>10) navbar.classList.add('solid'); else navbar.classList.remove('solid') }) }

  // Show license on confirmation page
  if(location.pathname.endsWith('confirm.html')){
	const key = localStorage.getItem(GENERATED_LICENSE);
	if(key){ $('#license-key').textContent = key }
  }

  // demo particle background
  initParticles();
}

/* Simple particle background (canvas) */
function initParticles(){
  const mount = document.getElementById('particles'); if(!mount) return;
  const canvas = document.createElement('canvas'); canvas.style.width='100%'; canvas.style.height='100%'; canvas.width = innerWidth; canvas.height = innerHeight; mount.appendChild(canvas);
  const ctx = canvas.getContext('2d'); const num = 40; const parts = [];
  for(let i=0;i<num;i++) parts.push({x:Math.random()*canvas.width,y:Math.random()*canvas.height,r:Math.random()*2+1,dx:(Math.random()-0.5)*0.5,dy:(Math.random()-0.5)*0.5,h:Math.random()*360});
  function frame(){ ctx.clearRect(0,0,canvas.width,canvas.height); parts.forEach(p=>{ p.x += p.dx; p.y += p.dy; if(p.x<0||p.x>canvas.width) p.dx*=-1; if(p.y<0||p.y>canvas.height) p.dy*=-1; ctx.beginPath(); const g = ctx.createRadialGradient(p.x,p.y,0,p.x,p.y,p.r*6); g.addColorStop(0, 'rgba(106,0,255,0.18)'); g.addColorStop(1, 'rgba(77,166,255,0)'); ctx.fillStyle = g; ctx.arc(p.x,p.y,p.r*6,0,Math.PI*2); ctx.fill(); }); requestAnimationFrame(frame); }
  frame(); window.addEventListener('resize',()=>{ canvas.width = innerWidth; canvas.height = innerHeight });
}

document.addEventListener('DOMContentLoaded', init);
