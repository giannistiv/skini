/* ── State ─────────────────────────────────────────── */
const STATE_KEY = "aulaia_state";

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

/* ── Filters state ────────────────────────────────── */
let currentTab = "feed";
let searchQuery = "";
let filterGenre = "";
let filterVenue = "";

/* ── Example feed reviews (fallback when Firebase not configured) */
const EXAMPLE_REVIEWS = [
  {
    id: "ex1", playId: "i-diki", userName: "Μαρία Κ.", userInitials: "ΜΚ",
    rating: 5, recommendation: "recommend",
    review: "Ανατριχιαστική ερμηνεία! Ο Λαζόπουλος σε ρόλο που δεν τον έχεις ξαναδεί. Η σκηνοθεσία του Μαρκουλάκη κρατάει την ένταση σε όλη τη διάρκεια. Πρέπει να το δείτε.",
    dateSeen: "2025-04-18", likes: 12, likedBy: [],
  },
  {
    id: "ex2", playId: "macbeth", userName: "Γιάννης Τ.", userInitials: "ΓΤ",
    rating: 4, recommendation: "recommend",
    review: "Πολύ δυνατή παραγωγή. Η μετάφραση λειτουργεί εξαιρετικά και οι ερμηνείες είναι σε πολύ υψηλό επίπεδο. Μόνο η διάρκεια κουράζει λίγο στο δεύτερο μέρος.",
    dateSeen: "2025-04-10", likes: 8, likedBy: [],
  },
  {
    id: "ex3", playId: "antigoni", userName: "Ελένη Π.", userInitials: "ΕΠ",
    rating: 3, recommendation: "meh",
    review: "Καλή προσπάθεια αλλά δεν με συγκίνησε ιδιαίτερα. Η σκηνογραφία ήταν εντυπωσιακή, ωστόσο η σκηνοθετική προσέγγιση δεν με έπεισε πλήρως.",
    dateSeen: "2025-03-28", likes: 4, likedBy: [],
  },
  {
    id: "ex4", playId: "bussinokipos", userName: "Δημήτρης Α.", userInitials: "ΔΑ",
    rating: 5, recommendation: "recommend",
    review: "Τσέχοφ στα καλύτερά του. Σπάνια βλέπεις τόσο ομοιόμορφο σύνολο ηθοποιών στην ελληνική σκηνή. Η τελευταία πράξη σε αφήνει με κόμπο στο στομάχι.",
    dateSeen: "2025-04-22", likes: 15, likedBy: [],
  },
];

let cachedFeedReviews = null;

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

function navigateHome() {
  history.pushState({}, "", "./");
  currentTab = "feed";
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

function getAllGenres() {
  const set = new Set();
  PLAYS.forEach((p) => (p.genre || []).forEach((g) => set.add(g)));
  return [...set].sort();
}

function getAllVenues() {
  const set = new Set();
  PLAYS.forEach((p) => { if (p.venue) set.add(p.venue); });
  return [...set].sort();
}

function filterPlays() {
  let list = PLAYS;
  if (searchQuery) {
    const q = searchQuery.toLowerCase();
    list = list.filter((p) =>
      p.titleGr.toLowerCase().includes(q) ||
      (p.titleEn && p.titleEn.toLowerCase().includes(q)) ||
      (p.director && p.director.toLowerCase().includes(q)) ||
      (p.author && p.author.toLowerCase().includes(q)) ||
      (p.venue && p.venue.toLowerCase().includes(q)) ||
      (p.cast || []).some((c) => c.name.toLowerCase().includes(q))
    );
  }
  if (filterGenre) {
    list = list.filter((p) => (p.genre || []).includes(filterGenre));
  }
  if (filterVenue) {
    list = list.filter((p) => p.venue === filterVenue);
  }
  return list;
}

/* ── Home Page ─────────────────────────────────────── */
function renderHome() {
  const genres = getAllGenres();
  const venues = getAllVenues();

  const genreOpts = genres.map((g) =>
    `<option value="${esc(g)}" ${filterGenre === g ? "selected" : ""}>${esc(g)}</option>`
  ).join("");

  const venueOpts = venues.map((v) =>
    `<option value="${esc(v)}" ${filterVenue === v ? "selected" : ""}>${esc(v)}</option>`
  ).join("");

  const plays = filterPlays();

  const cards = plays.map((p) => {
    const ps = getPlayState(p.id);
    const ratingOverlay = ps.rating
      ? `<div class="poster-rating">★ ${ps.rating}</div>`
      : "";
    const recOverlay = ps.recommendation
      ? `<div class="poster-rec rec-${ps.recommendation}">${recIcon(ps.recommendation, 14)}</div>`
      : "";

    return `
      <article class="poster-card fade-in" data-id="${esc(p.id)}">
        <div class="poster-img">
          <img src="${esc(p.image)}" alt="${esc(p.titleGr)}"
               loading="lazy"
               onerror="this.src='${esc(p.imageFallback || "")}'">
          ${ratingOverlay}
          ${recOverlay}
        </div>
        <div class="poster-title">${esc(p.titleGr)}</div>
      </article>`;
  }).join("");

  const noResults = plays.length === 0
    ? `<div class="no-results">Δεν βρέθηκαν παραστάσεις.</div>`
    : "";

  return `
    <div class="toolbar">
      <div class="search-wrap">
        <svg class="search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>
        <input type="text" id="search-input" class="search-input"
          placeholder="Αναζήτηση παράστασης, σκηνοθέτη, ηθοποιού…"
          value="${esc(searchQuery)}">
        ${searchQuery ? '<button class="search-clear" id="search-clear">&times;</button>' : ""}
      </div>
      <div class="filters">
        <select id="filter-genre" class="filter-select">
          <option value="">Όλα τα είδη</option>
          ${genreOpts}
        </select>
        <select id="filter-venue" class="filter-select">
          <option value="">Όλοι οι χώροι</option>
          ${venueOpts}
        </select>
        <span class="result-count">${plays.length} παραστάσεις</span>
      </div>
    </div>
    <div class="poster-grid">${cards}</div>
    ${noResults}`;
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
    ? `<span class="strip-date">Είδα: ${esc(ps.dateSeen)}</span>` : "";
  const reviewSnippet = ps.review
    ? `<div class="strip-review">"${esc(ps.review.length > 80 ? ps.review.slice(0, 80) + "…" : ps.review)}"</div>` : "";

  return `
    <div class="rating-strip fade-in" data-open-review="${esc(play.id)}">
      <div class="strip-stars-row">${stars}</div>
      <div class="strip-label">${label}</div>
      <div class="strip-extras">${recHtml}${dateHtml}</div>
      ${reviewSnippet}
      <div class="strip-hint">Πάτησε για κριτική</div>
    </div>`;
}

/* ── Detail Page ───────────────────────────────────── */
function renderDetail(playId) {
  const p = PLAYS.find((x) => x.id === playId);
  if (!p) { navigate(null); return ""; }
  const ps = getPlayState(p.id);

  const genres = (p.genre || []).map((g) => `<span class="badge">${esc(g)}</span>`).join("");
  const highlight = p.highlight ? `<span class="badge highlight">✦ ${esc(p.highlight)}</span>` : "";

  const castRows = (p.cast || [])
    .map((c) => `<div class="cast-item">
        <span class="cast-name">${esc(c.name)}</span>
        ${c.role ? `<span class="cast-role">${esc(c.role)}</span>` : ""}
      </div>`)
    .join("");

  const crewRows = (p.crew || [])
    .map((c) => `<div class="crew-item">
        <div class="crew-role">${esc(c.role)}</div>
        <div class="crew-name">${esc(c.name)}</div>
      </div>`)
    .join("");

  const authorLine = p.author
    ? `Βασισμένο στο έργο του <strong>${esc(p.author)}</strong> · ` : "";

  return `
    <button class="back-btn" id="back-btn">← Πίσω στις παραστάσεις</button>

    <div class="detail-hero">
      <div class="detail-backdrop" style="background-image:url('${esc(p.image)}')"></div>
      <div class="detail-content fade-in">
        <div class="detail-poster">
          <img src="${esc(p.image)}" alt="${esc(p.titleGr)}"
               onerror="this.src='${esc(p.imageFallback || "")}'">
        </div>
        <div class="detail-info">
          <div class="year-badge">${esc(p.season || "")} ${p.duration ? "· " + esc(p.duration) : ""}</div>
          <h1>${esc(p.titleGr)}</h1>
          ${p.titleEn ? `<div class="title-en">${esc(p.titleEn)}</div>` : ""}
          <div class="author-line">
            ${authorLine}
            ${p.director ? `Σκηνοθεσία: <strong>${esc(p.director)}</strong>` : ""}
          </div>
          <div class="detail-badges">${genres}${highlight}</div>
          ${p.description ? `<p class="detail-desc">${esc(p.description)}</p>` : ""}
          <div class="detail-cta">
            <button class="btn seen ${ps.seen ? "active" : ""}"
              data-toggle="seen" data-play="${esc(p.id)}">
              ${ps.seen ? "✓ Το είδα" : "+ Σημείωσε ως είδα"}
            </button>
            <button class="btn watch ${ps.watchlist ? "active" : ""}"
              data-toggle="watch" data-play="${esc(p.id)}">
              ${ps.watchlist ? "★ Στη λίστα μου" : "☆ Πρόσθεσε στη λίστα"}
            </button>
            ${p.moreUrl ? `<a class="btn btn-primary" href="${esc(p.moreUrl)}" target="_blank" rel="noopener">Εισιτήρια ↗</a>` : ""}
          </div>
        </div>
      </div>
    </div>

    ${renderRatingStrip(p, ps)}

    <div class="detail-body fade-in">
      <div>
        ${castRows ? `<div class="section-title">Θίασος</div><div class="cast-list">${castRows}</div><br>` : ""}
        ${crewRows ? `<div class="section-title">Συντελεστές</div><div class="crew-list">${crewRows}</div>` : ""}
      </div>
      <div>
        ${p.venue ? `<div class="info-card"><h4>Χώρος</h4><p>${esc(p.venue)}</p>${p.venueAddress ? `<p class="address">${esc(p.venueAddress)}</p>` : ""}</div>` : ""}
        ${p.schedule ? `<div class="info-card"><h4>Πρόγραμμα</h4><p>${esc(p.schedule)}</p></div>` : ""}
      </div>
    </div>`;
}

/* ── Feed Tab (social timeline) ───────────────────── */
function buildFeedHTML(reviews) {
  const currentUser = getUser();

  const cards = reviews.map((r) => {
    const play = PLAYS.find((p) => p.id === r.playId);
    if (!play) return "";

    const rating = r.rating || 0;
    const stars = "★".repeat(rating) + "☆".repeat(5 - rating);
    const recHtml = r.recommendation ? recBadge(r.recommendation) : "";

    let dateStr = "";
    if (r.dateSeen) {
      const dateObj = new Date(r.dateSeen);
      dateStr = dateObj.toLocaleDateString("el-GR", { day: "numeric", month: "short", year: "numeric" });
    }

    const reviewText = r.review || "";
    const needsClamp = reviewText.length > 120;
    const likedBy = r.likedBy || [];
    const isLiked = currentUser && likedBy.includes(currentUser);
    const likeCount = r.likes || 0;

    return `
      <article class="feed-card fade-in">
        <div class="feed-header">
          <div class="feed-avatar">${esc(r.userInitials || "??")}</div>
          <div class="feed-user-info">
            <span class="feed-username">${esc(r.userName)}</span>
            <span class="feed-date">${esc(dateStr)}</span>
          </div>
        </div>
        <div class="feed-body">
          <div class="feed-play" data-id="${esc(play.id)}">
            <img class="feed-play-img" src="${esc(play.image)}" alt="${esc(play.titleGr)}"
                 onerror="this.src='${esc(play.imageFallback || "")}'">
            <div class="feed-play-info">
              <div class="feed-play-title">${esc(play.titleGr)}</div>
              <div class="feed-play-meta">${play.director ? esc(play.director) : ""} ${play.venue ? "· " + esc(play.venue) : ""}</div>
              <div class="feed-rating">
                <span class="feed-stars">${stars}</span>
                ${recHtml}
              </div>
            </div>
          </div>
          ${reviewText ? `<p class="feed-review-text${needsClamp ? " clamped" : ""}">${esc(reviewText)}</p>` : ""}
          ${needsClamp ? '<button class="feed-read-more">Περισσότερα…</button>' : ""}
        </div>
        <div class="feed-footer">
          <button class="feed-like-btn${isLiked ? " liked" : ""}" data-review-id="${esc(r.id)}">
            ${isLiked ? "♥" : "♡"} <span class="like-count">${likeCount}</span>
          </button>
        </div>
      </article>`;
  }).join("");

  const trending = PLAYS.slice(0, 5).map((p, i) =>
    `<div class="trending-item" data-id="${esc(p.id)}">
      <span class="trending-rank">${i + 1}</span>
      <span class="trending-name">${esc(p.titleGr)}</span>
      <span class="trending-genre">${esc((p.genre || [])[0] || "")}</span>
    </div>`
  ).join("");

  const totalReviews = reviews.length;
  const avgRating = totalReviews
    ? (reviews.reduce((s, r) => s + (r.rating || 0), 0) / totalReviews).toFixed(1)
    : "—";

  return `
    <div class="feed-layout">
      <div class="feed-sidebar">
        <div class="feed-sidebar-card">
          <h3>Trending</h3>
          ${trending}
        </div>
      </div>
      <div class="feed-timeline">
        ${cards || '<div class="no-results">Κανένα review ακόμα. Γίνε ο πρώτος!</div>'}
      </div>
      <div class="feed-sidebar">
        <div class="feed-sidebar-card">
          <h3>Στατιστικά</h3>
          <div class="stat-row"><span class="stat-label">Παραστάσεις</span><span class="stat-value">${PLAYS.length}</span></div>
          <div class="stat-row"><span class="stat-label">Κριτικές</span><span class="stat-value">${totalReviews}</span></div>
          <div class="stat-row"><span class="stat-label">Μέση βαθμολογία</span><span class="stat-value">★ ${avgRating}</span></div>
        </div>
      </div>
    </div>`;
}

async function loadFeed() {
  const root = document.getElementById("app");

  if (firebaseReady) {
    root.innerHTML = '<div class="feed-loading">Φόρτωση κριτικών…</div>';
    try {
      await dbSeedExamples(EXAMPLE_REVIEWS);
      cachedFeedReviews = await dbGetFeedReviews();
    } catch (e) {
      console.error("Feed load error:", e);
      cachedFeedReviews = EXAMPLE_REVIEWS;
    }
  } else {
    cachedFeedReviews = EXAMPLE_REVIEWS;
  }

  root.innerHTML = buildFeedHTML(cachedFeedReviews);
  attachEvents();
}

/* ── Placeholder tabs ─────────────────────────────── */
function renderPlaceholderTab(name) {
  return `<div class="tab-placeholder"><p>${esc(name)} — Σύντομα διαθέσιμο</p></div>`;
}

/* ── Review Modal ─────────────────────────────────── */
function openReviewModal(playId) {
  const p = PLAYS.find((x) => x.id === playId);
  if (!p) return;
  const ps = getPlayState(playId);

  const stars = [1, 2, 3, 4, 5]
    .map((n) =>
      `<button class="modal-star ${n <= ps.rating ? "filled" : ""}"
        data-n="${n}" aria-label="${n} αστέρια">${n <= ps.rating ? "★" : "☆"}</button>`)
    .join("");

  const today = new Date().toISOString().split("T")[0];

  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.innerHTML = `
    <div class="modal-card">
      <button class="modal-close" id="modal-close" aria-label="Κλείσιμο">&times;</button>
      <div class="modal-title">${esc(p.titleGr)}</div>
      <div class="modal-subtitle">${esc(p.titleEn || "")}</div>
      <div class="modal-section">
        <label class="modal-label">Βαθμολογία</label>
        <div class="modal-stars">${stars}</div>
        <div class="modal-rating-text" id="modal-rating-text">${ps.rating ? RATING_LABELS[ps.rating] : ""}</div>
      </div>
      <div class="modal-section">
        <label class="modal-label">Θα τo συνιστούσες;</label>
        <div class="rec-buttons">
          <button class="rec-btn rec-recommend ${ps.recommendation === "recommend" ? "active" : ""}" data-rec="recommend" title="Ναι">${recIcon("recommend", 22)}</button>
          <button class="rec-btn rec-meh ${ps.recommendation === "meh" ? "active" : ""}" data-rec="meh" title="Μπα">${recIcon("meh", 22)}</button>
          <button class="rec-btn rec-not ${ps.recommendation === "not" ? "active" : ""}" data-rec="not" title="Όχι">${recIcon("not", 22)}</button>
        </div>
      </div>
      <div class="modal-section">
        <label class="modal-label" for="modal-date">Ημερομηνία που είδα</label>
        <input type="date" id="modal-date" class="modal-input" value="${esc(ps.dateSeen || today)}" max="${today}">
      </div>
      <div class="modal-section">
        <label class="modal-label" for="modal-review">Κριτική</label>
        <textarea id="modal-review" class="modal-textarea" rows="4" placeholder="Γράψε τις εντυπώσεις σου…">${esc(ps.review || "")}</textarea>
      </div>
      <div class="modal-actions">
        <button class="btn" id="modal-cancel">Ακύρωση</button>
        <button class="btn btn-primary" id="modal-save">Αποθήκευση</button>
      </div>
    </div>`;

  document.body.appendChild(overlay);
  requestAnimationFrame(() => overlay.classList.add("open"));

  let tempRating = ps.rating;
  let tempRec = ps.recommendation;

  function close() {
    overlay.classList.remove("open");
    setTimeout(() => overlay.remove(), 200);
  }

  overlay.addEventListener("click", (e) => { if (e.target === overlay) close(); });
  overlay.querySelector("#modal-close").addEventListener("click", close);
  overlay.querySelector("#modal-cancel").addEventListener("click", close);
  document.addEventListener("keydown", function onKey(e) {
    if (e.key === "Escape") { close(); document.removeEventListener("keydown", onKey); }
  });

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

  overlay.querySelectorAll(".rec-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const val = btn.dataset.rec;
      tempRec = tempRec === val ? null : val;
      overlay.querySelectorAll(".rec-btn").forEach((b) => b.classList.remove("active"));
      if (tempRec) btn.classList.add("active");
    });
  });

  overlay.querySelector("#modal-save").addEventListener("click", async () => {
    const dateSeen = overlay.querySelector("#modal-date").value;
    const review = overlay.querySelector("#modal-review").value.trim();
    setPlayState(playId, {
      rating: tempRating, recommendation: tempRec, dateSeen, review,
      seen: tempRating > 0 || review || dateSeen ? true : getPlayState(playId).seen,
    });

    if (firebaseReady && (tempRating > 0 || review)) {
      await ensureUser();
      dbSaveReview(playId, {
        rating: tempRating, recommendation: tempRec, dateSeen, review,
      });
    }

    close();
    render();
  });
}

/* ── Render ────────────────────────────────────────── */
function render() {
  const root = document.getElementById("app");
  const playId = getPage();

  if (playId) {
    root.innerHTML = renderDetail(playId);
  } else if (currentTab === "feed") {
    loadFeed();
    return;
  } else if (currentTab === "plays") {
    root.innerHTML = renderHome();
  } else if (currentTab === "friends") {
    root.innerHTML = renderPlaceholderTab("Φίλοι");
  } else if (currentTab === "lists") {
    root.innerHTML = renderPlaceholderTab("Λίστες");
  }

  updateTabs();
  attachEvents();

  if (playId) window.scrollTo({ top: 0, behavior: "smooth" });
}

function updateTabs() {
  document.querySelectorAll(".nav-tab").forEach((tab) => {
    tab.classList.toggle("active", tab.dataset.tab === currentTab && !getPage());
  });
}

/* ── Events ────────────────────────────────────────── */
function attachEvents() {
  const root = document.getElementById("app");

  /* tabs */
  document.querySelectorAll(".nav-tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      currentTab = tab.dataset.tab;
      history.pushState({}, "", "./");
      render();
    });
  });

  /* poster cards → navigate */
  root.querySelectorAll(".poster-card").forEach((card) => {
    card.addEventListener("click", () => navigate(card.dataset.id));
  });

  /* feed play cards → navigate */
  root.querySelectorAll(".feed-play").forEach((el) => {
    el.addEventListener("click", () => navigate(el.dataset.id));
  });

  /* feed trending items → navigate */
  root.querySelectorAll(".trending-item").forEach((el) => {
    el.addEventListener("click", () => navigate(el.dataset.id));
  });

  /* feed read-more toggle */
  root.querySelectorAll(".feed-read-more").forEach((btn) => {
    btn.addEventListener("click", () => {
      const text = btn.previousElementSibling;
      const expanded = !text.classList.contains("clamped");
      text.classList.toggle("clamped", expanded);
      btn.textContent = expanded ? "Περισσότερα…" : "Λιγότερα";
    });
  });

  /* feed like buttons */
  root.querySelectorAll(".feed-like-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const reviewId = btn.dataset.reviewId;
      if (!reviewId) return;

      if (firebaseReady) {
        await ensureUser();
        const nowLiked = await dbToggleLike(reviewId);
        if (nowLiked !== null) {
          const countEl = btn.querySelector(".like-count");
          let count = parseInt(countEl.textContent) || 0;
          count += nowLiked ? 1 : -1;
          countEl.textContent = count;
          btn.classList.toggle("liked", nowLiked);
          btn.firstChild.textContent = nowLiked ? "♥ " : "♡ ";
        }
      } else {
        const countEl = btn.querySelector(".like-count");
        let count = parseInt(countEl.textContent) || 0;
        const isLiked = btn.classList.toggle("liked");
        count += isLiked ? 1 : -1;
        countEl.textContent = count;
        btn.firstChild.textContent = isLiked ? "♥ " : "♡ ";
      }
    });
  });

  /* back button */
  const back = document.getElementById("back-btn");
  if (back) back.addEventListener("click", () => navigate(null));

  /* search */
  const searchInput = document.getElementById("search-input");
  if (searchInput) {
    searchInput.addEventListener("input", (e) => {
      searchQuery = e.target.value;
      renderGrid();
    });
    const clearBtn = document.getElementById("search-clear");
    if (clearBtn) clearBtn.addEventListener("click", () => {
      searchQuery = "";
      renderGrid();
    });
  }

  /* filters */
  const genreSelect = document.getElementById("filter-genre");
  if (genreSelect) genreSelect.addEventListener("change", (e) => {
    filterGenre = e.target.value;
    renderGrid();
  });
  const venueSelect = document.getElementById("filter-venue");
  if (venueSelect) venueSelect.addEventListener("change", (e) => {
    filterVenue = e.target.value;
    renderGrid();
  });

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

  /* rating strip → open modal */
  root.querySelectorAll("[data-open-review]").forEach((strip) => {
    strip.addEventListener("click", () => openReviewModal(strip.dataset.openReview));
  });

  /* strip stars */
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

/* ── Fast grid-only re-render (for search/filter) ── */
function renderGrid() {
  const plays = filterPlays();
  const grid = document.querySelector(".poster-grid");
  const count = document.querySelector(".result-count");
  const noRes = document.querySelector(".no-results");

  if (grid) {
    grid.innerHTML = plays.map((p) => {
      const ps = getPlayState(p.id);
      const ratingOverlay = ps.rating ? `<div class="poster-rating">★ ${ps.rating}</div>` : "";
      const recOverlay = ps.recommendation
        ? `<div class="poster-rec rec-${ps.recommendation}">${recIcon(ps.recommendation, 14)}</div>` : "";
      return `
        <article class="poster-card fade-in" data-id="${esc(p.id)}">
          <div class="poster-img">
            <img src="${esc(p.image)}" alt="${esc(p.titleGr)}" loading="lazy"
                 onerror="this.src='${esc(p.imageFallback || "")}'">
            ${ratingOverlay}
            ${recOverlay}
          </div>
          <div class="poster-title">${esc(p.titleGr)}</div>
        </article>`;
    }).join("");

    grid.querySelectorAll(".poster-card").forEach((card) => {
      card.addEventListener("click", () => navigate(card.dataset.id));
    });
  }

  if (count) count.textContent = `${plays.length} παραστάσεις`;

  if (noRes) noRes.remove();
  if (plays.length === 0 && grid) {
    grid.insertAdjacentHTML("afterend", '<div class="no-results">Δεν βρέθηκαν παραστάσεις.</div>');
  }

  // Update search input UI
  const input = document.getElementById("search-input");
  if (input && input.value !== searchQuery) input.value = searchQuery;
  const wrap = document.querySelector(".search-wrap");
  if (wrap) {
    let clearBtn = wrap.querySelector(".search-clear");
    if (searchQuery && !clearBtn) {
      wrap.insertAdjacentHTML("beforeend", '<button class="search-clear" id="search-clear">&times;</button>');
      wrap.querySelector(".search-clear").addEventListener("click", () => { searchQuery = ""; renderGrid(); });
    } else if (!searchQuery && clearBtn) {
      clearBtn.remove();
    }
  }
}

/* ── Init ──────────────────────────────────────────── */
window.addEventListener("popstate", render);
document.addEventListener("DOMContentLoaded", render);
