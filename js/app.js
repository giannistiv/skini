/* ── State ─────────────────────────────────────────── */
const STATE_KEY = "skini_state";

function loadState() {
  try {
    return JSON.parse(localStorage.getItem(STATE_KEY)) || {};
  } catch {
    return {};
  }
}

function saveState(s) {
  localStorage.setItem(STATE_KEY, JSON.stringify(s));
}

let state = loadState();

function getPlayState(id) {
  return state[id] || { seen: false, watchlist: false, rating: 0, review: "", dateSeen: "", recommendation: null };
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

const REC_LABELS = {
  recommend: "Το συνιστώ",
  meh: "Έτσι κι έτσι",
  not: "Δεν το συνιστώ",
};

function recIcon(type, size) {
  const s = size || 20;
  if (type === "recommend")
    return `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M7 10v12"/><path d="M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2a3.13 3.13 0 0 1 3 3.88Z"/></svg>`;
  if (type === "not")
    return `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M17 14V2"/><path d="M9 18.12 10 14H4.17a2 2 0 0 1-1.92-2.56l2.33-8A2 2 0 0 1 6.5 2H20a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-2.76a2 2 0 0 0-1.79 1.11L12 22a3.13 3.13 0 0 1-3-3.88Z"/></svg>`;
  if (type === "meh")
    return `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><line x1="5" y1="12" x2="19" y2="12"/></svg>`;
  return "";
}

function recBadge(rec) {
  if (!rec) return "";
  const cls = `rec-badge rec-${rec}`;
  return `<span class="${cls}">${recIcon(rec, 14)} ${esc(REC_LABELS[rec])}</span>`;
}

/* ── Home Page ─────────────────────────────────────── */
function renderHome() {
  const cards = PLAYS.map((p) => {
    const ps = getPlayState(p.id);
    const genres = p.genre.map((g) => `<span class="genre-pill">${esc(g)}</span>`).join("");

    const ratingOverlay = ps.rating
      ? `<div class="user-rating-badge visible">★ ${ps.rating}/5</div>`
      : `<div class="user-rating-badge"></div>`;

    const recHtml = ps.recommendation
      ? `<div class="card-rec">${recBadge(ps.recommendation)}</div>`
      : "";

    return `
      <article class="play-card fade-in" data-id="${esc(p.id)}">
        <div class="card-poster">
          <img src="${esc(p.image)}" alt="${esc(p.titleGr)}"
               onerror="this.src='${esc(p.imageFallback)}'">
          <div class="card-genre">${genres}</div>
          ${ratingOverlay}
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
          ${recHtml}
          <div class="card-actions">
            <button class="btn seen ${ps.seen ? "active" : ""}"
              data-toggle="seen" data-play="${esc(p.id)}">
              ${ps.seen ? "✓" : "+"} Είδα
            </button>
            <button class="btn watch ${ps.watchlist ? "active" : ""}"
              data-toggle="watch" data-play="${esc(p.id)}">
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

/* ── Central Rating Strip ─────────────────────────── */
function renderRatingStrip(play, ps) {
  const stars = [1, 2, 3, 4, 5]
    .map(
      (n) =>
        `<button class="strip-star ${n <= ps.rating ? "filled" : ""}"
          data-n="${n}" data-play="${esc(play.id)}"
          aria-label="${n} αστέρια">${n <= ps.rating ? "★" : "☆"}</button>`
    )
    .join("");

  const label = ps.rating ? RATING_LABELS[ps.rating] : "Πάτησε για βαθμολογία & κριτική";

  const recHtml = ps.recommendation ? recBadge(ps.recommendation) : "";

  const dateHtml = ps.dateSeen
    ? `<span class="strip-date">Είδα: ${esc(ps.dateSeen)}</span>`
    : "";

  const reviewSnippet = ps.review
    ? `<div class="strip-review">"${esc(ps.review.length > 80 ? ps.review.slice(0, 80) + "…" : ps.review)}"</div>`
    : "";

  return `
    <div class="rating-strip fade-in" data-open-review="${esc(play.id)}">
      <div class="strip-stars-row">${stars}</div>
      <div class="strip-label">${label}</div>
      <div class="strip-extras">
        ${recHtml}${dateHtml}
      </div>
      ${reviewSnippet}
      <div class="strip-hint">Πάτησε για κριτική</div>
    </div>`;
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

    ${renderRatingStrip(p, ps)}

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
      </div>
    </div>`;
}

/* ── Review Modal ─────────────────────────────────── */
function openReviewModal(playId) {
  const p = PLAYS.find((x) => x.id === playId);
  if (!p) return;
  const ps = getPlayState(playId);

  const stars = [1, 2, 3, 4, 5]
    .map(
      (n) =>
        `<button class="modal-star ${n <= ps.rating ? "filled" : ""}"
          data-n="${n}" aria-label="${n} αστέρια">${n <= ps.rating ? "★" : "☆"}</button>`
    )
    .join("");

  const today = new Date().toISOString().split("T")[0];

  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.innerHTML = `
    <div class="modal-card">
      <button class="modal-close" id="modal-close" aria-label="Κλείσιμο">&times;</button>
      <div class="modal-title">${esc(p.titleGr)}</div>
      <div class="modal-subtitle">${esc(p.titleEn)}</div>

      <div class="modal-section">
        <label class="modal-label">Βαθμολογία</label>
        <div class="modal-stars">${stars}</div>
        <div class="modal-rating-text" id="modal-rating-text">
          ${ps.rating ? RATING_LABELS[ps.rating] : ""}
        </div>
      </div>

      <div class="modal-section">
        <label class="modal-label">Θα τo συνιστούσες;</label>
        <div class="rec-buttons">
          <button class="rec-btn rec-recommend ${ps.recommendation === "recommend" ? "active" : ""}"
            data-rec="recommend" title="Ναι">
            ${recIcon("recommend", 22)}
          </button>
          <button class="rec-btn rec-meh ${ps.recommendation === "meh" ? "active" : ""}"
            data-rec="meh" title="Μπα">
            ${recIcon("meh", 22)}
          </button>
          <button class="rec-btn rec-not ${ps.recommendation === "not" ? "active" : ""}"
            data-rec="not" title="Όχι">
            ${recIcon("not", 22)}
          </button>
        </div>
      </div>

      <div class="modal-section">
        <label class="modal-label" for="modal-date">Ημερομηνία που είδα</label>
        <input type="date" id="modal-date" class="modal-input" value="${esc(ps.dateSeen || today)}" max="${today}">
      </div>

      <div class="modal-section">
        <label class="modal-label" for="modal-review">Κριτική</label>
        <textarea id="modal-review" class="modal-textarea" rows="4"
          placeholder="Γράψε τις εντυπώσεις σου…">${esc(ps.review || "")}</textarea>
      </div>

      <div class="modal-actions">
        <button class="btn" id="modal-cancel">Ακύρωση</button>
        <button class="btn btn-primary" id="modal-save">Αποθήκευση</button>
      </div>
    </div>`;

  document.body.appendChild(overlay);
  requestAnimationFrame(() => overlay.classList.add("open"));

  /* ── modal state ── */
  let tempRating = ps.rating;
  let tempRec = ps.recommendation;

  /* close */
  function close() {
    overlay.classList.remove("open");
    setTimeout(() => overlay.remove(), 200);
  }

  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) close();
  });
  overlay.querySelector("#modal-close").addEventListener("click", close);
  overlay.querySelector("#modal-cancel").addEventListener("click", close);

  document.addEventListener("keydown", function onKey(e) {
    if (e.key === "Escape") { close(); document.removeEventListener("keydown", onKey); }
  });

  /* stars */
  overlay.querySelectorAll(".modal-star").forEach((btn) => {
    btn.addEventListener("click", () => {
      const n = parseInt(btn.dataset.n);
      tempRating = tempRating === n ? 0 : n;
      overlay.querySelectorAll(".modal-star").forEach((s) => {
        const sn = parseInt(s.dataset.n);
        s.classList.toggle("filled", sn <= tempRating);
        s.textContent = sn <= tempRating ? "★" : "☆";
      });
      overlay.querySelector("#modal-rating-text").textContent = tempRating ? RATING_LABELS[tempRating] : "";
    });

    btn.addEventListener("mouseenter", () => {
      const n = parseInt(btn.dataset.n);
      overlay.querySelectorAll(".modal-star").forEach((s) => {
        const sn = parseInt(s.dataset.n);
        s.classList.toggle("filled", sn <= n);
        s.textContent = sn <= n ? "★" : "☆";
      });
      overlay.querySelector("#modal-rating-text").textContent = RATING_LABELS[n];
    });
  });

  overlay.querySelector(".modal-stars").addEventListener("mouseleave", () => {
    overlay.querySelectorAll(".modal-star").forEach((s) => {
      const sn = parseInt(s.dataset.n);
      s.classList.toggle("filled", sn <= tempRating);
      s.textContent = sn <= tempRating ? "★" : "☆";
    });
    overlay.querySelector("#modal-rating-text").textContent = tempRating ? RATING_LABELS[tempRating] : "";
  });

  /* recommendation */
  overlay.querySelectorAll(".rec-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const val = btn.dataset.rec;
      tempRec = tempRec === val ? null : val;
      overlay.querySelectorAll(".rec-btn").forEach((b) => b.classList.remove("active"));
      if (tempRec) btn.classList.add("active");
    });
  });

  /* save */
  overlay.querySelector("#modal-save").addEventListener("click", () => {
    const dateSeen = overlay.querySelector("#modal-date").value;
    const review = overlay.querySelector("#modal-review").value.trim();
    setPlayState(playId, {
      rating: tempRating,
      recommendation: tempRec,
      dateSeen,
      review,
      seen: tempRating > 0 || review || dateSeen ? true : getPlayState(playId).seen,
    });
    close();
    render();
  });
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

  root.querySelectorAll(".play-card").forEach((card) => {
    card.addEventListener("click", (e) => {
      if (e.target.closest("button")) return;
      navigate(card.dataset.id);
    });
  });

  root.querySelectorAll("[data-nav]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      navigate(btn.dataset.nav);
    });
  });

  const back = document.getElementById("back-btn");
  if (back) back.addEventListener("click", () => navigate(null));

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

  /* rating strip → open modal */
  root.querySelectorAll("[data-open-review]").forEach((strip) => {
    strip.addEventListener("click", () => {
      openReviewModal(strip.dataset.openReview);
    });
  });

  /* strip stars: direct rating shortcut (also opens modal) */
  root.querySelectorAll(".strip-star").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const playId = btn.dataset.play;
      const n = parseInt(btn.dataset.n);
      const cur = getPlayState(playId).rating;
      setPlayState(playId, { rating: cur === n ? 0 : n });
      openReviewModal(playId);
    });

    btn.addEventListener("mouseenter", (e) => {
      e.stopPropagation();
      const n = parseInt(btn.dataset.n);
      const row = btn.closest(".strip-stars-row");
      row.querySelectorAll(".strip-star").forEach((s) => {
        const sn = parseInt(s.dataset.n);
        s.classList.toggle("filled", sn <= n);
        s.textContent = sn <= n ? "★" : "☆";
      });
    });
  });

  root.querySelectorAll(".strip-stars-row").forEach((row) => {
    row.addEventListener("mouseleave", () => {
      const playId = row.querySelector(".strip-star").dataset.play;
      const rating = getPlayState(playId).rating;
      row.querySelectorAll(".strip-star").forEach((s) => {
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
