// === CONFIG ===
// 1) Pune aici URL si ANON KEY din Supabase Project Settings -> API
const SUPABASE_URL = "https://srmmunvmideqkoetpbxn.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_GMJ9xeRsshUf1kROx6IFCg_xq6KW_tX";

// 2) Endpoint-ul Edge Function (îl creezi la pasul 6)
const ORDER_ENDPOINT = `${SUPABASE_URL}/functions/v1/create-order`;

const tg = window.Telegram?.WebApp;
if (tg) {
  tg.ready();
  tg.expand();
}
// === Telegram theme sync (dark / light) ===
if (tg) {
  const applyTheme = () => {
    document.documentElement.dataset.theme =
      tg.colorScheme === "dark" ? "dark" : "light";
  };

  applyTheme();
  tg.onEvent("themeChanged", applyTheme);
}

const state = {
  city: null,
  products: [],
  cart: new Map(), // productId -> qty
};

const el = (id) => document.getElementById(id);

const tabs = {
  menu: el("tab-menu"),
  cart: el("tab-cart"),
  profile: el("tab-profile"),
};

function setTab(name) {
  Object.values(tabs).forEach(t => t.classList.remove("active"));
  tabs[name].classList.add("active");

  document.querySelectorAll(".navbtn").forEach(b => b.classList.remove("active"));
  document.querySelector(`.navbtn[data-tab="${name}"]`).classList.add("active");
}

document.querySelectorAll(".navbtn").forEach(btn => {
  btn.addEventListener("click", () => setTab(btn.dataset.tab));
});

function fmt(n) {
  return new Intl.NumberFormat("ro-RO").format(n) + " MDL";
}

function getCartItems() {
  const items = [];
  for (const [id, qty] of state.cart.entries()) {
    const p = state.products.find(x => x.id === id);
    if (p) items.push({ product: p, qty });
  }
  return items;
}

function calcTotal() {
  return getCartItems().reduce((s, it) => s + it.product.price * it.qty, 0);
}

// === Cities modal (simplu) ===
const cities = ["Chișinău", "Bălți", "Tiraspol"];
el("cityBtn").addEventListener("click", () => {
  el("cityModal").classList.remove("hidden");
});
el("closeCity").addEventListener("click", () => el("cityModal").classList.add("hidden"));

function renderCities() {
  const list = el("cityList");
  list.innerHTML = "";
  cities.forEach(c => {
    const b = document.createElement("button");
    b.className = "city";
    b.type = "button";
    b.textContent = c;
    b.onclick = () => {
      state.city = c;
      el("cityLabel").textContent = `oraș: ${c}`;
      el("cityModal").classList.add("hidden");
    };
    list.appendChild(b);
  });
}
renderCities();

// === Products ===
async function fetchProducts() {
  // Supabase REST: /rest/v1/products?select=...
  const url = `${SUPABASE_URL}/rest/v1/products?select=id,name,price,stock,image_url,is_active&is_active=eq.true&order=created_at.desc`;
  const res = await fetch(url, {
    headers: {
      apikey: SUPABASE_ANON_KEY,
      authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    },
  });
  if (!res.ok) throw new Error("Nu pot încărca produsele");
  const data = await res.json();
  state.products = data;
  renderProducts();
}

function renderProducts() {
  const grid = el("productsGrid");
  grid.innerHTML = "";

  state.products.forEach(p => {
    const card = document.createElement("div");
    card.className = "card";

    const img = document.createElement("div");
    img.className = "img";
    if (p.image_url) {
      const im = document.createElement("img");
      im.src = p.image_url;
      im.alt = p.name;
      im.style.width = "100%";
      im.style.height = "100%";
      im.style.objectFit = "cover";
      img.innerHTML = "";
      img.appendChild(im);
    } else {
      img.textContent = "poză";
    }

    const body = document.createElement("div");
    body.className = "body";

    const title = document.createElement("div");
    title.className = "title";
    title.textContent = p.name;

    const meta = document.createElement("div");
    meta.className = "meta";
    meta.innerHTML = `<span>${fmt(p.price)}</span><span>stoc: ${p.stock ?? 0}</span>`;

    const actions = document.createElement("div");
    actions.className = "actions";

    const add = document.createElement("button");
    add.className = "btn";
    add.textContent = "adauga";
    add.disabled = (p.stock ?? 0) <= 0;
    add.onclick = () => {
      const cur = state.cart.get(p.id) || 0;
      if (cur + 1 > (p.stock ?? 0)) return;
      state.cart.set(p.id, cur + 1);
      renderCart();
      if (tg) tg.HapticFeedback?.impactOccurred("light");
    };

    actions.appendChild(add);

    body.appendChild(title);
    body.appendChild(meta);
    body.appendChild(actions);

    card.appendChild(img);
    card.appendChild(body);

    grid.appendChild(card);
  });
}

// === Cart ===
function renderCart() {
  const list = el("cartList");
  list.innerHTML = "";

  const items = getCartItems();
  if (items.length === 0) {
    list.innerHTML = `<div class="box"><div class="muted">coșul e gol</div></div>`;
  } else {
    items.forEach(({ product, qty }) => {
      const row = document.createElement("div");
      row.className = "item";

      const top = document.createElement("div");
      top.className = "item-top";
      top.innerHTML = `<div><div class="title">${product.name}</div><div class="muted">${fmt(product.price)}</div></div>
                       <div><strong>${fmt(product.price * qty)}</strong></div>`;

      const qtyRow = document.createElement("div");
      qtyRow.className = "item-qty";

      const minus = document.createElement("button");
      minus.className = "btn";
      minus.textContent = "−";
      minus.style.maxWidth = "70px";
      minus.onclick = () => {
        const cur = state.cart.get(product.id) || 0;
        const next = Math.max(0, cur - 1);
        if (next === 0) state.cart.delete(product.id);
        else state.cart.set(product.id, next);
        renderCart();
      };

      const q = document.createElement("div");
      q.style.minWidth = "30px";
      q.style.textAlign = "center";
      q.textContent = String(qty);

      const plus = document.createElement("button");
      plus.className = "btn";
      plus.textContent = "+";
      plus.style.maxWidth = "70px";
      plus.onclick = () => {
        const cur = state.cart.get(product.id) || 0;
        if (cur + 1 > (product.stock ?? 0)) return;
        state.cart.set(product.id, cur + 1);
        renderCart();
      };

      qtyRow.append(minus, q, plus);

      row.append(top, qtyRow);
      list.appendChild(row);
    });
  }

  el("totalAmount").textContent = fmt(calcTotal());
}

// === Profile info (Telegram) ===
function renderProfile() {
  const u = tg?.initDataUnsafe?.user;
  el("profileInfo").textContent = u
    ? `${u.first_name || ""} ${u.last_name || ""} (@${u.username || "—"}) | id: ${u.id}`
    : "deschide din Telegram ca să văd profilul";
}

// === Checkout ===
el("checkoutBtn").addEventListener("click", async () => {
  el("checkoutHint").textContent = "";

  if (!state.city) {
    el("checkoutHint").textContent = "alege orașul";
    return;
  }
  const items = getCartItems();
  if (items.length === 0) {
    el("checkoutHint").textContent = "coșul e gol";
    return;
  }

  const payload = {
    city: state.city,
    customer: {
      name: el("name").value.trim(),
      phone: el("phone").value.trim(),
      address: el("address").value.trim(),
      comment: el("comment").value.trim(),
    },
    items: items.map(({ product, qty }) => ({
      product_id: product.id,
      qty,
    })),
    telegram: {
      initData: tg?.initData || null,
      user: tg?.initDataUnsafe?.user || null,
    },
  };

  try {
    el("checkoutBtn").disabled = true;
    el("checkoutHint").textContent = "trimit comanda...";

    const res = await fetch(ORDER_ENDPOINT, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        // IMPORTANT: anon key e ok pentru a chema Edge Function; validarea reală o faci în funcție
        "authorization": `Bearer ${SUPABASE_ANON_KEY}`,
        "apikey": SUPABASE_ANON_KEY,
      },
      body: JSON.stringify(payload),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data?.error || "eroare la creare comanda");

    el("checkoutHint").textContent = `gata. comanda #${data.order_id}`;
    state.cart.clear();
    renderCart();
    await fetchProducts(); // refresh stoc
    if (tg) tg.HapticFeedback?.notificationOccurred("success");
  } catch (e) {
    el("checkoutHint").textContent = String(e.message || e);
    if (tg) tg.HapticFeedback?.notificationOccurred("error");
  } finally {
    el("checkoutBtn").disabled = false;
  }
});

renderCart();
renderProfile();
fetchProducts().catch(err => {
  el("productsGrid").innerHTML = `<div class="box"><div class="muted">${err.message}</div></div>`;
});
