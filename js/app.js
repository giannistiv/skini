/* ── State ─────────────────────────────────────────── */
const STATE_KEY = "skini_state";

function loadState() {
  try {
    return JSON.parse(localStorage.getItem(STATE_KEY)) || {};
  } catch {
    return {};
  }
}

function saveState(state) {
  localStorage.setItem(STATE_KEY, JSON.stringify(state));
}

let state = loadState();

function getPlayState(id) {
  return state[id] || { seen: false, watchlist: false, rating: 0 };
}

function setPlayState(id, patch) {
  state[id] = { ...getPlayState(id), ...patch };
  saveState(state);
}

/* ── Router ────────────────────────────────────────── */
function getPage() {
  const params = new URLSearchParams(window.location.search);
  return params.get("play") || null;
}

function navigate(playId) {
  const url = playId ? `?play=${playId}` : "./";
  history.pushState({}, "", url);
  render();
}

/* ── Helpers ───────────────────────────────────────── */
function esc(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const RATING_LABELS = ["", "Απαίσιο", "Μέτριο", "Καλό", "Πολύ καλό", "Εξαιρετικό"];

function renderStars(rating, interactive = false, playId = "") {
  const stars = [1, 2, 3, 4, 5]
    .map(
      (n) =>
        `<button class="star-btn ${n <= rating ? "filled" : ""}"
          data-n="${n}" data-play="${esc(playId)}"
          aria-label="${n} αστέρια">${n <= rating ? "★" : "☆"}</button>`
    )
    .join("");
  const label = `<div class="rating-label">${rating ? RATING_LABELS[rating] : "Βαθμολόγησε την παράσταση"}</div>`;
  return `<div class="stars-row" id="stars-${esc(playId)}">${stars}</div>${label}`;
}

/* ── Home Page ─────────────────────────────────────── */
function renderHome() {
  const cards = PLAYS.map((p) => {
    const ps = getPlayState(p.id);
    const genres = p.genre.map((g) => `<span class="genre-pill">${esc(g)}</span>`).join("");
    const userRating = ps.rating
      ? `<div class="user-rating-badge visible">★ ${ps.rating}</div>`
      : `<div class="user-rating-badge"></div>`;

    return `
      <article class="play-card fade-in" data-id="${esc(p.id)}">
        <div class="card-poster">
          <img src="${esc(p.image)}" alt="${esc(p.titleGr)}"
               onerror="this.src='${esc(p.imageFallback)}'">
          <div class="card-genre">${genres}</div>
          ${userRating}
        </div>
        <div class="card-body">
          <div class="card-title">${esc(p.titleGr)}</div>
          <div class="card-subtitle">${esc(p.titleEn)}</div>
          <div class="card-meta">
            <span>${esc(p.director)}</span>
            <span class="dot">·</span>
            <span>${esc(p.venue)}</span>
            <span class="dot">·</span>
            <span>${esc(p.season)}</span>
          </div>
          <div class="card-actions">
            <button class="btn seen ${ps.seen ? "active" : ""}"
              data-toggle="seen" data-play="${esc(p.id)}"
              title="Σημείωσε ως είδα">
              ${ps.seen ? "✓" : "+"} Είδα
            </button>
            <button class="btn watch ${ps.watchlist ? "active" : ""}"
              data-toggle="watch" data-play="${esc(p.id)}"
              title="Προσθήκη στη λίστα">
              ${ps.watchlist ? "★" : "☆"} Λίστα
            </button>
            <button class="btn btn-primary" data-nav="${esc(p.id)}">
              Λεπτομέρειες →
            </button>
          </div>
        </div>
      </article>`;
  }).join("");

  return `
    <div class="hero fade-in">
      <h1>Θέατρο <em>Αθήνας</em></h1>
      <p>Ανακάλυψε παραστάσεις, βαθμολόγησε και μοιράσου με φίλους.</p>
    </div>
    <div class="section-label">Παραστάσεις σεζόν 2025–26</div>
    <div class="plays-grid">${cards}</div>`;
}

/* ── Detail Page ───────────────────────────────────── */
function renderDetail(playId) {
  const p = PLAYS.find((x) => x.id === playId);
  if (!p) { navigate(null); return ""; }
  const ps = getPlayState(p.id);

  const genres = p.genre.map((g) => `<span class="badge">${esc(g)}</span>`).join("");
  const highlight = p.highlight ? `<span class="badge highlight">✦ ${esc(p.highlight)}</span>` : "";

  const castRows = p.cast
    .map(
      (c) => `<div class="cast-item">
        <span class="cast-name">${esc(c.name)}</span>
        ${c.role ? `<span class="cast-role">${esc(c.role)}</span>` : ""}
      </div>`
    )
    .join("");

  const crewRows = p.crew
    .map(
      (c) => `<div class="crew-item">
        <div class="crew-role">${esc(c.role)}</div>
        <div class="crew-name">${esc(c.name)}</div>
      </div>`
    )
    .join("");

  return `
    <button class="back-btn" id="back-btn">← Πίσω στις παραστάσεις</button>

    <div class="detail-hero">
      <div class="detail-backdrop" style="background-image:url('${esc(p.image)}')"></div>
      <div class="detail-content fade-in">
        <div class="detail-poster">
          <img src="${esc(p.image)}" alt="${esc(p.titleGr)}"
               onerror="this.src='${esc(p.imageFallback)}'">
        </div>
        <div class="detail-info">
          <div class="year-badge">${esc(p.season)} · ${esc(p.duration)}</div>
          <h1>${esc(p.titleGr)}</h1>
          <div class="title-en">${esc(p.titleEn)}</div>
          <div class="author-line">
            Βασισμένο στο έργο του <strong>${esc(p.author)}</strong> ·
            Σκηνοθεσία: <strong>${esc(p.director)}</strong>
          </div>
          <div class="detail-badges">${genres}${highlight}</div>
          <p class="detail-desc">${esc(p.description)}</p>
          <div class="detail-cta">
            <button class="btn seen ${ps.seen ? "active" : ""}"
              data-toggle="seen" data-play="${esc(p.id)}">
              ${ps.seen ? "✓ Το είδα" : "+ Σημείωσε ως είδα"}
            </button>
            <button class="btn watch ${ps.watchlist ? "active" : ""}"
              data-toggle="watch" data-play="${esc(p.id)}">
              ${ps.watchlist ? "★ Στη λίστα μου" : "☆ Πρόσθεσε στη λίστα"}
            </button>
            <a class="btn btn-primary" href="${esc(p.moreUrl)}" target="_blank" rel="noopener">
              Αγορά εισιτηρίων ↗
            </a>
          </div>
        </div>
      </div>
    </div>

    <div class="detail-body fade-in">
      <div>
        <div class="section-title">Θίασος</div>
        <div class="cast-list">${castRows}</div>

        <br>
        <div class="section-title">Συντελεστές</div>
        <div class="crew-list">${crewRows}</div>
      </div>

      <div>
        <div class="info-card">
          <h4>Χώρος</h4>
          <p>${esc(p.venue)}</p>
          <p class="address">${esc(p.venueAddress)}</p>
        </div>
        <div class="info-card">
          <h4>Πρόγραμμα</h4>
          <p>${esc(p.schedule)}</p>
        </div>

        <div class="rating-section">
          <h4 class="section-title">Βαθμολογία σου</h4>
          ${renderStars(ps.rating, true, p.id)}
        </div>
      </div>
    </div>`;
}

/* ── Render ────────────────────────────────────────── */
function render() {
  const root = document.getElementById("app");
  const playId = getPage();
  root.innerHTML = playId ? renderDetail(playId) : renderHome();
  attachEvents();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

/* ── Events ────────────────────────────────────────── */
function attachEvents() {
  const root = document.getElementById("app");

  /* card click → navigate (but not on button clicks) */
  root.querySelectorAll(".play-card").forEach((card) => {
    card.addEventListener("click", (e) => {
      if (e.target.closest("button")) return;
      navigate(card.dataset.id);
    });
  });

  /* navigate buttons */
  root.querySelectorAll("[data-nav]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      navigate(btn.dataset.nav);
    });
  });

  /* back button */
  const back = document.getElementById("back-btn");
  if (back) back.addEventListener("click", () => navigate(null));

  /* seen / watchlist toggles */
  root.querySelectorAll("[data-toggle]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const playId = btn.dataset.play;
      const type = btn.dataset.toggle;
      const ps = getPlayState(playId);
      if (type === "seen") setPlayState(playId, { seen: !ps.seen });
      if (type === "watch") setPlayState(playId, { watchlist: !ps.watchlist });
      render();
    });
  });

  /* star rating */
  root.querySelectorAll(".star-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const playId = btn.dataset.play;
      const n = parseInt(btn.dataset.n);
      const cur = getPlayState(playId).rating;
      setPlayState(playId, { rating: cur === n ? 0 : n });
      render();
    });

    btn.addEventListener("mouseenter", () => {
      const n = parseInt(btn.dataset.n);
      const row = btn.closest(".stars-row");
      row.querySelectorAll(".star-btn").forEach((s) => {
        const sn = parseInt(s.dataset.n);
        s.classList.toggle("filled", sn <= n);
        s.textContent = sn <= n ? "★" : "☆";
      });
    });

    btn.closest(".stars-row").addEventListener("mouseleave", () => {
      const playId = btn.dataset.play;
      const rating = getPlayState(playId).rating;
      btn.closest(".stars-row").querySelectorAll(".star-btn").forEach((s) => {
        const sn = parseInt(s.dataset.n);
        s.classList.toggle("filled", sn <= rating);
        s.textContent = sn <= rating ? "★" : "☆";
      });
    });
  });
}

/* ── Init ──────────────────────────────────────────── */
window.addEventListener("popstate", render);
document.addEventListener("DOMContentLoaded", render);
