const ICONS = {
  sprout: "M12 21v-7|M12 14C12 10.7 9.8 9 6 9c0 3.3 2.2 5 6 5z|M12 14c0-3.3 2.2-5 6-5 0 3.3-2.2 5-6 5z",
  home: "M4 11.5 12 4l8 7.5|M6.5 10v9.5h11V10",
  seed: "M12 3.5c3.8 3.2 6 6.2 6 9.2a6 6 0 0 1-12 0c0-3 2.2-6 6-9.2z|M12 11v8",
  flower: "M12 9.6a2.4 2.4 0 1 0 0 4.8 2.4 2.4 0 0 0 0-4.8z|M12 9.6V5.5|M12 14.4v4.1|M9.6 12H5.5|M14.4 12h4.1|m10.3 10.3-2.9-2.9|m13.7 13.7 2.9 2.9|m13.7 10.3 2.9-2.9|m10.3 13.7-2.9 2.9",
  leaf: "M20 4C11 4 5 9 5 16c0 2 .8 4 .8 4S11 19 14.5 15.5C18 12 20 8 20 4z|M5.8 19.2C8 13 12 9.4 16.5 7.5",
  basket: "M5 10h14l-1.6 8.5a1.5 1.5 0 0 1-1.5 1.5H8.1a1.5 1.5 0 0 1-1.5-1.5z|M8.5 10a3.5 3.5 0 0 1 7 0",
  gift: "M4 9.5h16v10.5H4z|M4 13.5h16|M12 9.5V20|M12 9.5C10.5 9.5 8 9 8 7a2 2 0 0 1 4-.7A2 2 0 0 1 16 7c0 2-2.5 2.5-4 2.5z",
  moon: "M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z",
  sun: "M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z|M12 3v2|M12 19v2|M3 12h2|M19 12h2|M5.6 5.6 7 7|M17 17l1.4 1.4|M18.4 5.6 17 7|M7 17l-1.4 1.4",
  flame: "M12 3.5c.6 3 4.5 5.2 4.5 9a4.5 4.5 0 0 1-9 0c0-2.4 1.3-3.9 2.6-5.3.7-.7 1.5-2 1.9-3.7z",
  envelope: "M3.5 6h17v12h-17z|m4.5 7.5 7.5 5.5 7.5-5.5",
  waves: "M3 9c2.6-2.2 5.2-2.2 7.8 0s5.2 2.2 7.8 0|M3 15c2.6-2.2 5.2-2.2 7.8 0s5.2 2.2 7.8 0",
  droplet: "M12 3.5c3.4 3.9 5.5 6.6 5.5 9.4a5.5 5.5 0 0 1-11 0c0-2.8 2.1-5.5 5.5-9.4z",
  plus: "M12 5v14|M5 12h14",
  close: "M6 6l12 12|M18 6 6 18",
  sparkle: "M12 3.5 14 9.5l6 2.5-6 2.5-2 6-2-6-4-2.5 6-2.5z",
  heart: "M12 20C7.2 16.2 4.5 13.4 4.5 10.3A4 4 0 0 1 12 7.6a4 4 0 0 1 7.5 2.7c0 3.1-2.7 5.9-7.5 9.7z",
  play: "M8 5.5 18.5 12 8 18.5z",
  pause: "M7 5.5h3.4v13H7z|M13.6 5.5H17v13h-3.6z",
};
const FILLED_ICONS = new Set(["play", "pause"]);

function icon(name) {
  const paths = (ICONS[name] ?? ICONS.leaf).split("|").map((d) => `<path d="${d}"/>`).join("");
  return FILLED_ICONS.has(name)
    ? `<svg class="icon" viewBox="0 0 24 24" fill="currentColor" stroke="none">${paths}</svg>`
    : `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${paths}</svg>`;
}

const CATEGORIES = {
  gratitude: { label: "Gratitude", icon: "sun", glow: "#ffb86b" },
  memory: { label: "Memory", icon: "moon", glow: "#8fb6ff" },
  hope: { label: "Hope", icon: "flower", glow: "#ff9ec4" },
  anger: { label: "Anger", icon: "flame", glow: "#ff6b6b" },
  letter: { label: "Letter", icon: "envelope", glow: "#c9a6ff" },
  feeling: { label: "Feeling", icon: "waves", glow: "#6fe3d4" },
};
const CAT_KEYS = Object.keys(CATEGORIES);
const STAGE_LABEL = { seed: "Seed", sprout: "Sprouting", flower: "Growing", fruit: "Ready to harvest", withered: "Withered" };

const GARDEN_VIEWS = {
  garden: {
    title: "Your Garden",
    sub: "A collection of thoughts, feelings and dreams.",
    active: "garden",
    keep: () => true,
    empty: "Your garden is quiet.",
  },
  seeds: {
    title: "Seeds",
    sub: "The things you've just begun.",
    active: "seeds",
    keep: (p) => p.stage === "seed" || p.stage === "sprout",
    empty: "No seeds yet. Plant something and watch it begin.",
  },
  growing: {
    title: "Growing",
    sub: "Things taking root, slowly becoming.",
    active: "growing",
    keep: (p) => p.stage === "flower",
    empty: "Nothing is growing right now. Tender words need tending.",
  },
};

const app = document.getElementById("app");
const toastEl = document.getElementById("toast");
let audioOn = false;
let toastTimer;

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const fmtDate = (ms) => new Date(ms).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
const catOf = (p) => CATEGORIES[p.category] ?? CATEGORIES.feeling;
const img = (src, iconName, cls = "") => `<img class="${cls}" src="${src}" alt="" data-icon="${iconName}">`;

async function api(path, { body } = {}) {
  const res = await fetch(path, body ? { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) } : {});
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || res.statusText);
  return data;
}

function toast(message) {
  toastEl.textContent = message;
  toastEl.hidden = false;
  requestAnimationFrame(() => toastEl.classList.add("show"));
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toastEl.classList.remove("show");
    setTimeout(() => { toastEl.hidden = true; }, 300);
  }, 2600);
}

function fireflies(count = 16) {
  let out = "";
  for (let i = 0; i < count; i++) {
    const x = Math.random() * 100;
    const y = 38 + Math.random() * 58;
    const dur = 6 + Math.random() * 9;
    const size = 2 + Math.random() * 3;
    const delay = -(Math.random() * 12);
    out += `<span class="firefly" style="left:${x.toFixed(1)}%;top:${y.toFixed(1)}%;--dur:${dur.toFixed(1)}s;--size:${size.toFixed(1)}px;animation-delay:${delay.toFixed(1)}s"></span>`;
  }
  return `<div class="fireflies" aria-hidden="true">${out}</div>`;
}

function updateAudioBtn() {
  document.querySelectorAll(".player-btn").forEach((b) => { b.innerHTML = icon(audioOn ? "pause" : "play"); });
}

function startAudio(notify = false) {
  const a = document.getElementById("ambient");
  if (!a) return;
  a.volume = 0;
  a.play().then(() => {
    if (audioOn) return;
    audioOn = true;
    updateAudioBtn();
    const fade = setInterval(() => {
      a.volume = Math.min(0.55, a.volume + 0.04);
      if (a.volume >= 0.55) clearInterval(fade);
    }, 130);
  }).catch(() => {
    if (notify) toast("No music yet — add public/assets/music.mp3");
  });
}

function toggleAudio() {
  const a = document.getElementById("ambient");
  if (a.paused) startAudio(true);
  else { a.pause(); audioOn = false; updateAudioBtn(); }
}

function plantInner(p) {
  return img(`assets/plants/${p.category}.png`, catOf(p).icon);
}

function gardenPlant(p) {
  const c = catOf(p);
  return `<button class="plant stage-${p.stage}" data-action="open-plant" data-id="${p.id}"
    data-search="${esc(`${p.title ?? ""} ${p.body}`.toLowerCase())}"
    style="left:${(p.x * 100).toFixed(2)}%;top:${(p.y * 100).toFixed(2)}%;--seed:${p.seed};--glow:${c.glow}"
    title="${esc(p.title || "Untitled")}">${plantInner(p)}</button>`;
}

function navLink(route, label, iconName, active) {
  const on = active === route ? "on" : "";
  return `<a class="${on}" href="#/${route}">${icon(iconName)} ${label}</a>`;
}

function shell({ active = "", title = "", sub = "", actions = "", body = "" }) {
  return `
  <div class="shell">
    <aside class="sidebar">
      <a class="brand" href="#/">${icon("sprout")} <span>Solace</span></a>
      <nav>
        ${navLink("", "Home", "home", active)}
        ${navLink("garden", "Garden", "sprout", active)}
        ${navLink("seeds", "Seeds", "seed", active)}
        ${navLink("growing", "Growing", "flower", active)}
        ${navLink("release", "Let go", "leaf", active)}
        ${navLink("harvest", "Harvest", "basket", active)}
        ${navLink("gifts", "Gifts", "gift", active)}
      </nav>
      <div class="player">
        <div class="player-info"><b>a gentle place</b><span>for ambient</span></div>
        <button class="player-btn" data-action="toggle-audio" title="Music on / off">${icon("play")}</button>
      </div>
    </aside>
    <main class="main">
      ${title ? `<div class="topbar"><div><h1>${title}</h1>${sub ? `<p class="sub">${sub}</p>` : ""}</div><div class="actions">${actions}</div></div>` : ""}
      ${body}
    </main>
  </div>`;
}

function welcomeModal() {
  if (sessionStorage.getItem("solace.seen")) return "";
  sessionStorage.setItem("solace.seen", "1");
  const card = (iconName, label, sub, href) =>
    `<a class="action-card" href="${href}"><span class="ac-icon">${icon(iconName)}</span><b>${label}</b><small>${sub}</small></a>`;
  return `
  <div class="modal-backdrop" data-action="close-modal">
    <div class="modal card">
      <button class="modal-x" data-action="close-modal">${icon("close")}</button>
      <h2>What would you like to do?</h2>
      <p class="sub">Every feeling has a place to grow.</p>
      <div class="action-grid">
        ${card("sprout", "Plant Something", "Write something you want to nurture.", "#/plant")}
        ${card("leaf", "Let Something Go", "Write it down and throw it away.", "#/release")}
        ${card("flower", "Tend Your Garden", "Return to things you've written before.", "#/garden")}
        ${card("basket", "Harvest Something", "Turn something you've grown into something you can give.", "#/harvest")}
        ${card("gift", "Give Something", "Send a piece of your garden to someone.", "#/harvest")}
      </div>
    </div>
  </div>`;
}

function viewLanding() {
  return `
  <div class="landing scene">
    ${fireflies(18)}
    <header class="landing-brand">${icon("sprout")} <span>Solace</span></header>
    <nav class="landing-nav">
      <a href="#/garden">Garden</a>
      <a href="#/seeds">Seeds</a>
      <a href="#/growing">Growing</a>
      <a href="#/harvest">Harvest</a>
      <a href="#/gifts">Gifts</a>
    </nav>
    <div class="landing-hero">
      <h1>Solace</h1>
      <p class="lede">Some things need somewhere to go.</p>
      <p class="sub">A quiet place to plant your thoughts, tend what matters, and give what you've grown.</p>
      <button class="btn btn-primary" data-action="enter">Enter Your Garden →</button>
    </div>
  </div>`;
}

async function viewGarden(mode = "garden") {
  const view = GARDEN_VIEWS[mode] ?? GARDEN_VIEWS.garden;
  const plants = (await api("/api/plants")).filter(view.keep);
  const groups = {};
  for (const p of plants) (groups[p.category] ??= []).push(p);
  const badges = Object.entries(groups).map(([cat, list]) => {
    const c = CATEGORIES[cat] ?? CATEGORIES.feeling;
    const cx = list.reduce((s, p) => s + p.x, 0) / list.length;
    const cy = list.reduce((s, p) => s + p.y, 0) / list.length;
    return `<span class="zone-badge" style="left:${(cx * 100).toFixed(1)}%;top:${(cy * 100 - 7).toFixed(1)}%">${c.label}<b>${list.length}</b></span>`;
  }).join("");
  const canvas = plants.length
    ? `${badges}${plants.map(gardenPlant).join("")}`
    : `<div class="empty-state"><p>${view.empty}</p><a class="btn btn-primary" href="#/plant">${icon("sprout")} Plant something</a></div>`;
  return shell({
    active: view.active,
    title: view.title,
    sub: view.sub,
    actions: `<input class="search" id="garden-search" type="search" placeholder="Search your garden…">
      <a class="btn btn-primary" href="#/plant">${icon("plus")} Plant</a>`,
    body: `<div class="garden-canvas scene garden">${fireflies()}${canvas}</div>`,
  }) + welcomeModal();
}

function viewPlantForm(mode) {
  const isRelease = mode === "release";
  const form = isRelease
    ? `<form data-form="release">
        <textarea name="body" rows="8" autofocus placeholder="What do you want to release?"></textarea>
        <button class="btn btn-ghost">${icon("leaf")} Release it</button>
      </form>`
    : `<form data-form="plant">
        <textarea name="body" rows="8" autofocus placeholder="What would you like to plant today?"></textarea>
        <input name="title" placeholder="Add a title (optional)">
        <div class="cat-grid">
          ${CAT_KEYS.map((k, i) => `<button type="button" class="cat-chip${i === 0 ? " on" : ""}" data-action="pick-category" data-cat="${k}">${icon(CATEGORIES[k].icon)} ${CATEGORIES[k].label}</button>`).join("")}
        </div>
        <input type="hidden" name="category" value="gratitude">
        <button class="btn btn-primary">${icon("sprout")} Plant</button>
      </form>`;
  return shell({
    active: isRelease ? "release" : "garden",
    body: `
    <div class="form-screen${isRelease ? " scene rain" : ""}">
      <div class="form-card card">
        <h1>${isRelease ? "Let Something Go" : "Plant Something"}</h1>
        <p class="sub">${isRelease ? "Say what you need to say. No one has to read it." : "Write what's in your heart. Let it take root."}</p>
        ${form}
      </div>
      <div class="art form-art">${img(`assets/plants/${isRelease ? "anger" : "gratitude"}.png`, isRelease ? "leaf" : "sun")}</div>
    </div>`,
  });
}

async function viewDetail(id) {
  const p = await api(`/api/plants/${id}`);
  const c = catOf(p);
  const last = p.events[p.events.length - 1]?.at ?? p.createdAt;
  const log = [...p.events].reverse().map((ev) => `<li><span>${fmtDate(ev.at)}</span><span>${esc(ev.note || "Tended it again")}</span></li>`).join("");
  return shell({
    active: "garden",
    body: `
    <div class="topbar">
      <div><a class="back" href="#/garden">← Back</a></div>
      <div class="actions"><a class="btn btn-ghost" href="#/harvest">${icon("basket")} Harvest</a></div>
    </div>
    <div class="detail">
      <div class="card detail-card">
        <h1>${esc(p.title || "Untitled")}</h1>
        <span class="chip">${icon(c.icon)} ${STAGE_LABEL[p.stage]} · ${c.label}</span>
        <p class="meta">${icon("sprout")} Planted on ${fmtDate(p.createdAt)} · ${icon("droplet")} Last tended ${fmtDate(last)}</p>
        <blockquote>${esc(p.body)}</blockquote>
        <div class="log card">
          <h3>Growth Log</h3>
          <ul>${log}</ul>
        </div>
      </div>
      <aside class="detail-art">
        <div class="art big stage-${p.stage} ${p.stage === "withered" ? "wilted" : ""}" style="--glow:${c.glow}">${plantInner(p)}</div>
        <button class="btn btn-primary" data-action="tend-toggle">${icon("droplet")} Add More</button>
        <form class="tend-form" data-form="tend" data-id="${p.id}" hidden>
          <textarea name="note" rows="3" placeholder="What changed since last time?"></textarea>
          <button class="btn btn-primary">Tend it</button>
        </form>
      </aside>
    </div>`,
  });
}

async function viewHarvest() {
  const plants = (await api("/api/plants")).filter((p) => p.stage === "fruit" && !p.gift);
  const cards = plants.map((p) => {
    const c = catOf(p);
    const preview = p.body.length > 150 ? `${esc(p.body).slice(0, 150)}…` : esc(p.body);
    return `
    <article class="card harvest-card" data-id="${p.id}">
      <div class="arch"><div class="art harvest-art stage-${p.stage}" style="--glow:${c.glow}">${plantInner(p)}</div></div>
      <span class="chip">${icon(c.icon)} ${c.label}</span>
      <h3>${esc(p.title || "Untitled")}</h3>
      <p class="preview">${preview}</p>
      <div class="row">
        <button class="btn btn-primary" data-action="give-open">${icon("gift")} Give This</button>
        <button class="btn btn-ghost" data-action="keep">${icon("heart")} Keep It</button>
      </div>
      <form data-form="give" data-id="${p.id}" hidden>
        <input name="to" placeholder="Who is it for?">
        <input name="note" placeholder="Add a note (optional)">
        <button class="btn btn-primary">Create the gift</button>
      </form>
    </article>`;
  }).join("");
  return shell({
    active: "harvest",
    title: "Harvest",
    sub: "Something you've grown is ready to be shared.",
    body: plants.length
      ? `<div class="grid">${cards}</div>`
      : `<div class="grid"><p class="sub">Nothing is ready yet. Keep tending — fruit comes with time.</p></div>`,
  });
}

async function viewGifts() {
  const gifts = (await api("/api/plants")).filter((p) => p.gift);
  const cards = gifts.map((p) => {
    const c = catOf(p);
    const url = `${location.origin}${location.pathname}#/gift/${p.gift.token}`;
    return `
    <article class="card">
      <span class="chip">${icon(c.icon)} For ${esc(p.gift.to)}</span>
      <h3 style="margin-top:10px">${esc(p.title || "Untitled")}</h3>
      <p class="preview">Given ${fmtDate(p.gift.givenAt)}</p>
      <input class="copy-input" readonly value="${url}">
      <div class="row">
        <button class="btn btn-primary" data-action="copy" data-url="${url}">Copy link</button>
        <a class="btn btn-ghost" href="#/gift/${p.gift.token}">Open gift</a>
      </div>
    </article>`;
  }).join("");
  return shell({
    active: "gifts",
    title: "Gifts",
    sub: "Pieces of your garden you've given away.",
    body: gifts.length
      ? `<div class="grid">${cards}</div>`
      : `<div class="grid"><p class="sub">Nothing given yet. When something is ready, you'll know.</p></div>`,
  });
}

async function viewGift(token) {
  let g;
  try {
    g = await api(`/api/gifts/${token}`);
  } catch {
    return `
    <div class="gift-screen scene">
      <div class="gift-card card">
        <h1>This gift has drifted away.</h1>
        <p class="sub">The link may be mistyped, or the garden has moved on.</p>
        <a class="btn btn-primary" href="#/">Open Solace</a>
      </div>
    </div>`;
  }
  const c = CATEGORIES[g.category] ?? CATEGORIES.feeling;
  return `
  <div class="gift-screen scene">
    <div class="gift-card card">
      <div class="dome"><div class="art gift-art" style="--glow:${c.glow}">${img(`assets/plants/${g.category}.png`, c.icon)}</div></div>
      <h1>Someone grew this for you.</h1>
      <p class="sub">A little piece of their heart, just for you.</p>
      <div class="gift-body">
        <span class="chip">For: ${esc(g.to)}</span>
        ${g.title ? `<h2>${esc(g.title)}</h2>` : ""}
        <blockquote>${esc(g.body)}</blockquote>
        ${g.note ? `<p class="gift-note">${esc(g.note)}</p>` : ""}
        <p class="from">${icon("sparkle")} From: Someone who cares</p>
      </div>
      <a class="btn btn-primary" href="#/garden">Open Your Garden →</a>
    </div>
  </div>`;
}

function petals() {
  const overlay = document.createElement("div");
  overlay.className = "release-overlay";
  for (let i = 0; i < 14; i++) {
    const petal = document.createElement("span");
    petal.className = "petal";
    const size = 8 + Math.random() * 10;
    petal.style.left = `${Math.random() * 100}%`;
    petal.style.animationDelay = `${Math.random() * 0.6}s`;
    petal.style.width = `${size.toFixed(1)}px`;
    petal.style.height = `${(size * 1.3).toFixed(1)}px`;
    petal.style.background = Math.random() > 0.5 ? "#ffd9a8" : "#f4b8c8";
    overlay.appendChild(petal);
  }
  document.body.appendChild(overlay);
  setTimeout(() => overlay.remove(), 3200);
}

async function handlePlant(form, release) {
  const data = new FormData(form);
  const body = String(data.get("body") ?? "").trim();
  if (!body) return toast("Write something first.");
  const plant = await api("/api/plants", {
    body: {
      body,
      title: data.get("title") ?? "",
      category: data.get("category") ?? "feeling",
      release,
    },
  });
  if (release) {
    petals();
    setTimeout(() => {
      location.hash = "#/garden";
      toast("It's released. You can let it rest now.");
    }, 1500);
  } else {
    location.hash = `#/plants/${plant.id}`;
    toast("Planted. Take care of it.");
  }
}

async function handleTend(form) {
  const note = String(new FormData(form).get("note") ?? "").trim();
  await api(`/api/plants/${form.dataset.id}/tend`, { body: { note } });
  await route();
  const art = document.querySelector(".detail-art .art");
  if (art) {
    art.classList.add("grew");
    setTimeout(() => art.classList.remove("grew"), 950);
  }
  toast("It grew a little.");
}

async function handleGive(form) {
  const data = new FormData(form);
  const plant = await api(`/api/plants/${form.dataset.id}/give`, {
    body: { to: data.get("to"), note: data.get("note") },
  });
  const url = `${location.origin}${location.pathname}#/gift/${plant.gift.token}`;
  const card = form.closest(".harvest-card");
  form.remove();
  card.querySelector(".row").outerHTML = `
    <div class="gift-done">
      <p>Your gift is ready.</p>
      <input class="copy-input" readonly value="${url}">
      <button class="btn btn-primary" data-action="copy" data-url="${url}">Copy link</button>
    </div>`;
  card.querySelector(".preview").textContent = `Gift for ${plant.gift.to}.`;
  toast("Gift wrapped.");
}

async function route() {
  const hash = location.hash.replace(/^#\/?/, "");
  const [name, param] = hash.split("/");
  let html;
  try {
    if (name === "") html = viewLanding();
    else if (name === "garden") html = await viewGarden("garden");
    else if (name === "seeds") html = await viewGarden("seeds");
    else if (name === "growing") html = await viewGarden("growing");
    else if (name === "plant") html = viewPlantForm("plant");
    else if (name === "release") html = viewPlantForm("release");
    else if (name === "plants" && param) html = await viewDetail(param);
    else if (name === "harvest") html = await viewHarvest();
    else if (name === "gifts") html = await viewGifts();
    else if (name === "gift" && param) html = await viewGift(param);
    else html = viewLanding();
  } catch (err) {
    console.error(err);
    html = `
    <div class="landing scene">
      <div class="landing-hero">
        <h1>Solace</h1>
        <p class="sub">Something went wrong loading this page. ${esc(err.message)}</p>
        <a class="btn btn-primary" href="#/garden">Back to the garden</a>
      </div>
    </div>`;
  }
  app.innerHTML = html;
  updateAudioBtn();
  document.querySelector("textarea[autofocus]")?.focus();
}

document.addEventListener("click", (e) => {
  const el = e.target.closest("[data-action]");
  if (!el) return;
  const action = el.dataset.action;

  if (action === "close-modal") {
    if (el.classList.contains("modal-backdrop") && e.target !== el) return;
    el.closest(".modal-backdrop")?.remove();
  } else if (action === "enter") {
    startAudio();
    location.hash = "#/garden";
  } else if (action === "toggle-audio") {
    toggleAudio();
  } else if (action === "open-plant") {
    location.hash = `#/plants/${el.dataset.id}`;
  } else if (action === "pick-category") {
    const grid = el.closest(".cat-grid");
    grid.querySelectorAll(".cat-chip").forEach((b) => b.classList.toggle("on", b === el));
    grid.nextElementSibling.value = el.dataset.cat;
  } else if (action === "tend-toggle") {
    const form = el.closest(".detail-art").querySelector(".tend-form");
    form.hidden = !form.hidden;
    if (!form.hidden) form.querySelector("textarea").focus();
  } else if (action === "give-open") {
    const form = el.closest(".harvest-card").querySelector("form");
    form.hidden = !form.hidden;
    if (!form.hidden) form.querySelector("input").focus();
  } else if (action === "keep") {
    el.closest(".harvest-card")?.remove();
    toast("It stays with you.");
  } else if (action === "copy") {
    const url = el.dataset.url;
    navigator.clipboard?.writeText(url).then(() => toast("Link copied.")).catch(() => toast("Copy it from the box above."));
  }
});

document.addEventListener("input", (e) => {
  if (e.target.id !== "garden-search") return;
  const q = e.target.value.trim().toLowerCase();
  document.querySelectorAll(".garden-canvas .plant").forEach((el) => {
    el.style.display = !q || el.dataset.search.includes(q) ? "" : "none";
  });
  document.querySelectorAll(".zone-badge").forEach((b) => { b.style.display = q ? "none" : ""; });
});

document.addEventListener("submit", async (e) => {
  const form = e.target.closest("form[data-form]");
  if (!form) return;
  e.preventDefault();
  const kind = form.dataset.form;
  try {
    if (kind === "plant") await handlePlant(form, false);
    else if (kind === "release") await handlePlant(form, true);
    else if (kind === "tend") await handleTend(form);
    else if (kind === "give") await handleGive(form);
  } catch (err) {
    toast(err.message || "Something went wrong.");
  }
});

document.addEventListener("error", (e) => {
  const el = e.target;
  if (el instanceof HTMLImageElement && el.dataset.icon) {
    const span = document.createElement("span");
    span.className = "icon-fallback";
    span.innerHTML = icon(el.dataset.icon);
    el.replaceWith(span);
  }
}, true);

window.addEventListener("hashchange", route);
route();
