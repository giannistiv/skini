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

function getUserPage() {
  const params = new URLSearchParams(window.location.search);
  return params.get("user") || null;
}

function navigate(playId) {
  const url = playId ? `?play=${playId}` : "./";
  history.pushState({}, "", url);
  render();
}

function navigateToUser(uid) {
  if (!uid || uid === "system") return;
  history.pushState({}, "", `?user=${uid}`);
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
let userFavoritesCache = [];

async function loadUserFavorites() {
  if (!firebaseReady || !isLoggedIn()) { userFavoritesCache = []; return; }
  try {
    const doc = await db.collection("users").doc(getUserUid()).get();
    userFavoritesCache = doc.exists ? (doc.data().favorites || []) : [];
  } catch (e) { userFavoritesCache = []; }
  document.querySelectorAll(".fav-star-btn").forEach((btn) => {
    btn.classList.toggle("active", userFavoritesCache.includes(btn.dataset.favPlay));
  });
}

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
            <button class="fav-star-btn" data-fav-play="${esc(p.id)}" title="Αγαπημένη">★</button>
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
  const uid = getUserUid();

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
    const isLiked = uid && likedBy.includes(uid);
    const likeCount = r.likes || 0;

    return `
      <article class="feed-card fade-in">
        <div class="feed-header">
          <div class="feed-user-link" data-user-uid="${esc(r.uid || "")}">
            <div class="feed-avatar">${esc(r.userInitials || "??")}</div>
            <div class="feed-user-info">
              <span class="feed-username">${esc(r.userName)}</span>
              <span class="feed-date">${esc(dateStr)}</span>
            </div>
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
  updateTabs();
  attachEvents();
}

/* ── Profile Page ─────────────────────────────────── */
function renderProfile() {
  if (!isLoggedIn()) return '<div class="tab-placeholder"><p>Συνδέσου για να δεις το προφίλ σου.</p></div>';

  const user = currentAuthUser;
  const photoUrl = user.photoURL;
  const avatarHtml = photoUrl
    ? `<img class="profile-photo" src="${esc(photoUrl)}" alt="">`
    : `<div class="profile-avatar">${esc(getUserInitials())}</div>`;

  return `
    <div class="profile-page fade-in">
      <div class="profile-header">
        <div class="profile-photo-wrap" id="profile-photo-wrap">
          ${avatarHtml}
          <div class="profile-photo-edit">Αλλαγή</div>
        </div>
        <div class="profile-details">
          <h2 class="profile-display-name">${esc(user.displayName || "")}</h2>
          <p class="profile-email">${esc(user.email || "")}</p>
        </div>
      </div>

      <div class="profile-form">
        <div class="modal-section">
          <label class="modal-label" for="profile-name">Εμφανιζόμενο όνομα</label>
          <input type="text" id="profile-name" class="modal-input" value="${esc(user.displayName || "")}" maxlength="30">
        </div>
        <div class="modal-section">
          <label class="modal-label" for="profile-photo-url">URL φωτογραφίας</label>
          <input type="url" id="profile-photo-url" class="modal-input" value="${esc(user.photoURL || "")}" placeholder="https://...">
        </div>
        <div class="profile-error" id="profile-error"></div>
        <div class="profile-success" id="profile-success"></div>
        <div class="profile-actions">
          <button class="btn btn-primary" id="profile-save">Αποθήκευση αλλαγών</button>
        </div>
      </div>

      <div class="profile-section">
        <div class="section-title">Οι κριτικές μου</div>
        <div id="profile-reviews" class="profile-reviews">Φόρτωση…</div>
      </div>
    </div>`;
}

async function loadProfileReviews() {
  if (!firebaseReady || !isLoggedIn()) return;
  const uid = getUserUid();
  const container = document.getElementById("profile-reviews");
  if (!container) return;

  try {
    const snap = await db.collection("reviews")
      .where("uid", "==", uid)
      .get();

    if (snap.empty) {
      container.innerHTML = '<p class="profile-no-reviews">Δεν έχεις γράψει κριτικές ακόμα.</p>';
      return;
    }

    const docs = snap.docs.sort((a, b) => {
      const ta = a.data().createdAt?.seconds || 0;
      const tb = b.data().createdAt?.seconds || 0;
      return tb - ta;
    });

    container.innerHTML = docs.map((doc) => {
      const r = doc.data();
      const play = PLAYS.find((p) => p.id === r.playId);
      if (!play) return "";
      const rating = r.rating || 0;
      const stars = "★".repeat(rating) + "☆".repeat(5 - rating);
      const recHtml = r.recommendation ? recBadge(r.recommendation) : "";
      const reviewText = r.review || "";

      return `
        <div class="profile-review-card" data-id="${esc(play.id)}">
          <img class="profile-review-img" src="${esc(play.image)}" alt="${esc(play.titleGr)}"
               onerror="this.src='${esc(play.imageFallback || "")}'">
          <div class="profile-review-info">
            <div class="profile-review-title">${esc(play.titleGr)}</div>
            <div class="feed-rating">${'<span class="feed-stars">' + stars + '</span>'} ${recHtml}</div>
            ${reviewText ? `<p class="profile-review-text">${esc(reviewText)}</p>` : ""}
          </div>
        </div>`;
    }).join("");

    container.querySelectorAll(".profile-review-card").forEach((card) => {
      card.addEventListener("click", () => navigate(card.dataset.id));
    });
  } catch (e) {
    container.innerHTML = '<p class="profile-no-reviews">Σφάλμα φόρτωσης.</p>';
  }
}

/* ── Public User Profile ──────────────────────────── */
const MONTH_NAMES = [
  "Ιανουάριος","Φεβρουάριος","Μάρτιος","Απρίλιος","Μάιος","Ιούνιος",
  "Ιούλιος","Αύγουστος","Σεπτέμβριος","Οκτώβριος","Νοέμβριος","Δεκέμβριος"
];
const DAY_LABELS = ["Δε","Τρ","Τε","Πε","Πα","Σα","Κυ"];
let calViewMonth = new Date().getMonth();
let calViewYear = new Date().getFullYear();
let calReviewsCache = [];

function buildTop4HTML(favorites) {
  if (!favorites || !favorites.length) return "";

  const cards = favorites.map((playId) => {
    const play = PLAYS.find((p) => p.id === playId);
    if (!play) return "";
    return `
      <div class="top4-card" data-id="${esc(play.id)}">
        <img src="${esc(play.image)}" alt="${esc(play.titleGr)}"
             onerror="this.src='${esc(play.imageFallback || "")}'">
      </div>`;
  }).join("");

  return `
    <div class="profile-section">
      <div class="section-title">Αγαπημένες παραστάσεις</div>
      <div class="top4-grid">${cards}</div>
    </div>`;
}

function buildWatchlistHTML(watchlist) {
  if (!watchlist || !watchlist.length) return "";

  const cards = watchlist.map((playId) => {
    const play = PLAYS.find((p) => p.id === playId);
    if (!play) return "";
    return `
      <div class="watchlist-card" data-id="${esc(play.id)}">
        <img src="${esc(play.image)}" alt="${esc(play.titleGr)}"
             onerror="this.src='${esc(play.imageFallback || "")}'">
      </div>`;
  }).join("");

  return `
    <div class="profile-section">
      <div class="section-title">Θέλω να δω</div>
      <div class="watchlist-grid">${cards}</div>
    </div>`;
}

function buildSingleMonthHTML(year, month, dateMap) {
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  let startDay = (new Date(year, month, 1).getDay() + 6) % 7;

  let cells = "";
  DAY_LABELS.forEach((d) => (cells += `<div class="cal-day-label">${d}</div>`));
  for (let i = 0; i < startDay; i++) cells += `<div class="cal-day empty"></div>`;

  for (let d = 1; d <= daysInMonth; d++) {
    const ds = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    const review = dateMap[ds];
    if (review) {
      const play = PLAYS.find((p) => p.id === review.playId);
      if (play) {
        cells += `
          <div class="cal-day has-play" data-id="${esc(play.id)}" title="${esc(play.titleGr)}">
            <img src="${esc(play.image)}" alt="" class="cal-thumb"
                 onerror="this.src='${esc(play.imageFallback || "")}'">
            <span class="cal-rating">${"★".repeat(review.rating || 0)}</span>
          </div>`;
      } else {
        cells += `<div class="cal-day"><span class="cal-num">${d}</span></div>`;
      }
    } else {
      cells += `<div class="cal-day"><span class="cal-num">${d}</span></div>`;
    }
  }

  return `
    <div class="cal-nav">
      <button class="cal-arrow" id="cal-prev">‹</button>
      <span class="cal-nav-label">${MONTH_NAMES[month]} ${year}</span>
      <button class="cal-arrow" id="cal-next">›</button>
    </div>
    <div class="cal-month">
      <div class="cal-grid">${cells}</div>
    </div>`;
}

function buildCalendarHTML(reviews) {
  calReviewsCache = reviews;
  const dateMap = {};
  reviews.forEach((r) => { if (r.dateSeen) dateMap[r.dateSeen] = r; });
  return `<div id="cal-container">${buildSingleMonthHTML(calViewYear, calViewMonth, dateMap)}</div>`;
}

function rerenderCalendar() {
  const container = document.getElementById("cal-container");
  if (!container) return;
  const dateMap = {};
  calReviewsCache.forEach((r) => { if (r.dateSeen) dateMap[r.dateSeen] = r; });
  container.innerHTML = buildSingleMonthHTML(calViewYear, calViewMonth, dateMap);
  attachCalendarEvents();
}

function attachCalendarEvents() {
  const prev = document.getElementById("cal-prev");
  const next = document.getElementById("cal-next");
  if (prev) prev.addEventListener("click", () => {
    calViewMonth--;
    if (calViewMonth < 0) { calViewMonth = 11; calViewYear--; }
    rerenderCalendar();
  });
  if (next) next.addEventListener("click", () => {
    calViewMonth++;
    if (calViewMonth > 11) { calViewMonth = 0; calViewYear++; }
    rerenderCalendar();
  });
  document.querySelectorAll("#cal-container .cal-day.has-play").forEach((el) => {
    el.addEventListener("click", () => navigate(el.dataset.id));
  });
}

async function loadPublicProfile(uid) {
  const root = document.getElementById("app");
  root.innerHTML = '<div class="feed-loading">Φόρτωση προφίλ…</div>';

  try {
    const data = await dbGetUserProfile(uid);
    if (!data || !data.user) {
      root.innerHTML = '<div class="tab-placeholder"><p>Ο χρήστης δεν βρέθηκε.</p></div>';
      return;
    }

    const { user, reviews } = data;
    const initials = (user.displayName || "?")
      .split(/\s+/).map((w) => w[0]).join("").toUpperCase().slice(0, 2);
    const photoUrl = user.photoURL;
    const avatarHtml = photoUrl
      ? `<img class="profile-photo" src="${esc(photoUrl)}" alt="">`
      : `<div class="profile-avatar">${esc(initials)}</div>`;

    const isOwnProfile = isLoggedIn() && getUserUid() === uid;
    const totalRated = reviews.filter((r) => r.rating > 0).length;
    const avgRating = totalRated
      ? (reviews.reduce((s, r) => s + (r.rating || 0), 0) / totalRated).toFixed(1)
      : "—";

    const reviewCards = reviews
      .filter((r) => r.review)
      .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0))
      .map((r) => {
        const play = PLAYS.find((p) => p.id === r.playId);
        if (!play) return "";
        const stars = "★".repeat(r.rating || 0) + "☆".repeat(5 - (r.rating || 0));
        const recHtml = r.recommendation ? recBadge(r.recommendation) : "";
        return `
          <div class="profile-review-card" data-id="${esc(play.id)}">
            <img class="profile-review-img" src="${esc(play.image)}" alt="${esc(play.titleGr)}"
                 onerror="this.src='${esc(play.imageFallback || "")}'">
            <div class="profile-review-info">
              <div class="profile-review-title">${esc(play.titleGr)}</div>
              <div class="feed-rating"><span class="feed-stars">${stars}</span> ${recHtml}</div>
              <p class="profile-review-text">${esc(r.review)}</p>
            </div>
          </div>`;
      }).join("");

    root.innerHTML = `
      <div class="profile-page fade-in">
        <button class="back-btn" id="back-btn">← Πίσω</button>

        <div class="profile-header">
          <div class="profile-photo-wrap">${avatarHtml}</div>
          <div class="profile-details">
            <h2 class="profile-display-name">${esc(user.displayName || "Χρήστης")}</h2>
            <div class="profile-stats-row">
              <span>${reviews.length} κριτικές</span>
              <span>Μ.Ο. ★ ${avgRating}</span>
            </div>
            ${isOwnProfile ? '<button class="btn" id="edit-profile-btn">Επεξεργασία προφίλ</button>' : ""}
          </div>
        </div>

        ${buildTop4HTML(user.favorites)}

        <div class="profile-section">
          <div class="section-title">Ημερολόγιο</div>
          ${buildCalendarHTML(reviews)}
        </div>

        ${buildWatchlistHTML(user.watchlist)}

        ${reviewCards ? `
        <div class="profile-section">
          <div class="section-title">Κριτικές</div>
          <div class="profile-reviews">${reviewCards}</div>
        </div>` : ""}
      </div>`;

    // Attach click events
    root.querySelector("#back-btn").addEventListener("click", () => {
      history.back();
    });
    const editBtn = root.querySelector("#edit-profile-btn");
    if (editBtn) {
      editBtn.addEventListener("click", () => {
        currentTab = "profile";
        history.pushState({}, "", "./");
        render();
      });
    }
    root.querySelectorAll("[data-id]").forEach((el) => {
      el.addEventListener("click", () => navigate(el.dataset.id));
    });
    attachCalendarEvents();
    updateTabs();
  } catch (e) {
    console.error("Profile load error:", e);
    root.innerHTML = '<div class="tab-placeholder"><p>Σφάλμα φόρτωσης προφίλ.</p></div>';
  }
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
        <label class="modal-label">Ημερομηνία που είδα</label>
        <div class="datepicker-wrap" id="datepicker-wrap">
          <button type="button" class="datepicker-display" id="datepicker-display">${ps.dateSeen || today}</button>
          <input type="hidden" id="modal-date" value="${esc(ps.dateSeen || today)}">
        </div>
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

  // Date picker
  (function initDatePicker() {
    const wrap = overlay.querySelector("#datepicker-wrap");
    const display = overlay.querySelector("#datepicker-display");
    const hiddenInput = overlay.querySelector("#modal-date");
    let pickerOpen = false;
    let dpMonth, dpYear;

    const selected = hiddenInput.value || today;
    const parts = selected.split("-");
    dpYear = parseInt(parts[0]);
    dpMonth = parseInt(parts[1]) - 1;

    function renderPicker() {
      let popup = wrap.querySelector(".datepicker-popup");
      if (!popup) {
        popup = document.createElement("div");
        popup.className = "datepicker-popup";
        wrap.appendChild(popup);
      }

      const daysInMonth = new Date(dpYear, dpMonth + 1, 0).getDate();
      let startDay = (new Date(dpYear, dpMonth, 1).getDay() + 6) % 7;
      let cells = "";
      DAY_LABELS.forEach((d) => (cells += `<div class="cal-day-label">${d}</div>`));
      for (let i = 0; i < startDay; i++) cells += `<div class="cal-day empty"></div>`;

      const todayParts = today.split("-");
      const todayStr = today;
      const selectedVal = hiddenInput.value;

      for (let d = 1; d <= daysInMonth; d++) {
        const ds = `${dpYear}-${String(dpMonth + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
        const isFuture = ds > todayStr;
        const isSelected = ds === selectedVal;
        const cls = `cal-day${isSelected ? " selected" : ""}${isFuture ? " empty" : ""}`;
        cells += `<div class="${cls}" data-date="${ds}"><span class="cal-num">${d}</span></div>`;
      }

      popup.innerHTML = `
        <div class="cal-nav">
          <button type="button" class="cal-arrow dp-prev">‹</button>
          <span class="cal-nav-label">${MONTH_NAMES[dpMonth]} ${dpYear}</span>
          <button type="button" class="cal-arrow dp-next">›</button>
        </div>
        <div class="cal-grid">${cells}</div>`;

      popup.querySelector(".dp-prev").addEventListener("click", (e) => {
        e.stopPropagation();
        dpMonth--;
        if (dpMonth < 0) { dpMonth = 11; dpYear--; }
        renderPicker();
      });
      popup.querySelector(".dp-next").addEventListener("click", (e) => {
        e.stopPropagation();
        dpMonth++;
        if (dpMonth > 11) { dpMonth = 0; dpYear++; }
        renderPicker();
      });
      popup.querySelectorAll(".cal-day:not(.empty)").forEach((el) => {
        el.addEventListener("click", (e) => {
          e.stopPropagation();
          const val = el.dataset.date;
          if (!val) return;
          hiddenInput.value = val;
          display.textContent = val;
          closePicker();
        });
      });
    }

    function closePicker() {
      const popup = wrap.querySelector(".datepicker-popup");
      if (popup) popup.remove();
      pickerOpen = false;
    }

    display.addEventListener("click", (e) => {
      e.stopPropagation();
      if (pickerOpen) { closePicker(); } else { pickerOpen = true; renderPicker(); }
    });

    overlay.addEventListener("click", (e) => {
      if (pickerOpen && !wrap.contains(e.target)) closePicker();
    });
  })();

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
      if (!isLoggedIn()) {
        close();
        showAuthModal("login");
        return;
      }
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

  const userUid = getUserPage();
  if (userUid) {
    loadPublicProfile(userUid);
    return;
  } else if (playId) {
    root.innerHTML = renderDetail(playId);
    loadUserFavorites();
  } else if (currentTab === "feed") {
    loadFeed();
    return;
  } else if (currentTab === "plays") {
    root.innerHTML = renderHome();
  } else if (currentTab === "profile") {
    root.innerHTML = renderProfile();
    loadProfileReviews();
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

  /* feed user links → user profile */
  root.querySelectorAll(".feed-user-link").forEach((el) => {
    el.addEventListener("click", () => navigateToUser(el.dataset.userUid));
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

      if (!isLoggedIn()) {
        showAuthModal("login");
        return;
      }

      if (firebaseReady) {
        const nowLiked = await dbToggleLike(reviewId);
        if (nowLiked !== null) {
          const countEl = btn.querySelector(".like-count");
          let count = parseInt(countEl.textContent) || 0;
          count += nowLiked ? 1 : -1;
          countEl.textContent = count;
          btn.classList.toggle("liked", nowLiked);
          btn.firstChild.textContent = nowLiked ? "♥ " : "♡ ";
        }
      }
    });
  });

  /* back button */
  const back = document.getElementById("back-btn");
  if (back) back.addEventListener("click", () => navigate(null));

  /* profile save */
  const profileSave = document.getElementById("profile-save");
  if (profileSave) {
    profileSave.addEventListener("click", async () => {
      const nameInput = document.getElementById("profile-name");
      const photoInput = document.getElementById("profile-photo-url");
      const errorEl = document.getElementById("profile-error");
      const successEl = document.getElementById("profile-success");
      errorEl.textContent = "";
      errorEl.style.display = "none";
      successEl.style.display = "none";
      profileSave.disabled = true;
      profileSave.textContent = "Αποθήκευση…";

      try {
        const newName = nameInput.value.trim();
        const newPhoto = photoInput.value.trim();
        if (!newName) throw new Error("Το όνομα δεν μπορεί να είναι κενό");

        await currentAuthUser.updateProfile({
          displayName: newName,
          photoURL: newPhoto || "",
        });
        await db.collection("users").doc(currentAuthUser.uid).update({
          displayName: newName,
          photoURL: newPhoto || null,
        });

        successEl.textContent = "Οι αλλαγές αποθηκεύτηκαν!";
        successEl.style.display = "block";
        updateNavAuth();
        render();
      } catch (e) {
        errorEl.textContent = e.message;
        errorEl.style.display = "block";
      }
      profileSave.disabled = false;
      profileSave.textContent = "Αποθήκευση αλλαγών";
    });
  }

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
    btn.addEventListener("click", async (e) => {
      e.stopPropagation();
      const playId = btn.dataset.play;
      const type = btn.dataset.toggle;
      const ps = getPlayState(playId);
      if (type === "seen") setPlayState(playId, { seen: !ps.seen });
      if (type === "watch") {
        setPlayState(playId, { watchlist: !ps.watchlist });
        if (firebaseReady && isLoggedIn()) {
          try { await dbToggleWatchlist(playId); } catch(e) { console.error(e); }
        }
      }
      render();
    });
  });

  /* favorite star toggle */
  root.querySelectorAll(".fav-star-btn").forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      e.stopPropagation();
      if (!isLoggedIn()) { showAuthModal("login"); return; }
      const playId = btn.dataset.favPlay;
      try {
        const isFav = await dbToggleFavorite(playId);
        btn.classList.toggle("active", isFav);
      } catch (err) {
        alert(err.message);
      }
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

/* ── Auth UI ──────────────────────────────────────── */
function updateNavAuth() {
  const container = document.getElementById("nav-auth");
  if (!container) return;

  if (isLoggedIn()) {
    const photoUrl = currentAuthUser.photoURL;
    const avatarHtml = photoUrl
      ? `<img class="nav-user-photo" src="${esc(photoUrl)}" alt="">`
      : `<div class="nav-user-avatar">${esc(getUserInitials())}</div>`;
    container.innerHTML = `
      <div class="nav-user">
        <div class="nav-user-link" id="nav-profile">
          ${avatarHtml}
          <span class="nav-user-name">${esc(getUser())}</span>
        </div>
        <button class="nav-logout-btn" id="nav-logout">Έξοδος</button>
      </div>`;
    container.querySelector("#nav-profile").addEventListener("click", () => {
      navigateToUser(getUserUid());
    });
    container.querySelector("#nav-logout").addEventListener("click", async () => {
      await authLogOut();
      currentTab = "feed";
      render();
    });
  } else {
    container.innerHTML = `
      <button class="nav-login-btn" id="nav-login">Σύνδεση</button>
      <button class="nav-signup-btn" id="nav-signup">Εγγραφή</button>`;
    container.querySelector("#nav-login").addEventListener("click", () => showAuthModal("login"));
    container.querySelector("#nav-signup").addEventListener("click", () => showAuthModal("signup"));
  }
}

function showAuthModal(mode) {
  const isLogin = mode === "login";

  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.innerHTML = `
    <div class="modal-card" style="max-width:400px">
      <button class="modal-close" aria-label="Κλείσιμο">&times;</button>
      <div class="modal-title">${isLogin ? "Σύνδεση" : "Δημιουργία λογαριασμού"}</div>
      <div class="modal-subtitle">${isLogin ? "Καλώς ήρθες πίσω!" : "Γίνε μέλος του Aulaia"}</div>
      <div class="auth-error" id="auth-error"></div>
      ${!isLogin ? `
      <div class="modal-section">
        <label class="modal-label" for="auth-display">Εμφανιζόμενο όνομα</label>
        <input type="text" id="auth-display" class="modal-input" placeholder="π.χ. Μαρία Κ." maxlength="30" autocomplete="name">
      </div>` : ""}
      <div class="modal-section">
        <label class="modal-label" for="auth-username">Username</label>
        <input type="text" id="auth-username" class="modal-input" placeholder="π.χ. maria_k" maxlength="20" autocomplete="username">
      </div>
      <div class="modal-section">
        <label class="modal-label" for="auth-password">Κωδικός</label>
        <input type="password" id="auth-password" class="modal-input" placeholder="Τουλάχιστον 8 χαρακτήρες" autocomplete="${isLogin ? "current-password" : "new-password"}">
      </div>
      ${!isLogin ? `
      <div class="modal-section">
        <label class="modal-label" for="auth-password2">Επιβεβαίωση κωδικού</label>
        <input type="password" id="auth-password2" class="modal-input" placeholder="Ξαναγράψε τον κωδικό" autocomplete="new-password">
      </div>` : ""}
      <div class="modal-actions" style="flex-direction:column;gap:.6rem">
        <button class="btn btn-primary" id="auth-submit" style="width:100%;justify-content:center">${isLogin ? "Σύνδεση" : "Εγγραφή"}</button>
        <div class="auth-divider"><span>ή</span></div>
        <button class="btn auth-google-btn" id="auth-google" style="width:100%;justify-content:center">
          <svg width="18" height="18" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59a14.5 14.5 0 0 1 0-9.18l-7.98-6.19a24.01 24.01 0 0 0 0 21.56l7.98-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>
          Συνέχεια με Google
        </button>
        <button class="auth-switch" id="auth-switch">
          ${isLogin ? "Δεν έχεις λογαριασμό; <strong>Εγγραφή</strong>" : "Έχεις ήδη λογαριασμό; <strong>Σύνδεση</strong>"}
        </button>
      </div>
    </div>`;

  document.body.appendChild(overlay);
  requestAnimationFrame(() => overlay.classList.add("open"));

  const errorEl = overlay.querySelector("#auth-error");

  function close() {
    overlay.classList.remove("open");
    setTimeout(() => overlay.remove(), 200);
  }

  function showError(msg) {
    errorEl.textContent = msg;
    errorEl.style.display = "block";
  }

  overlay.addEventListener("click", (e) => { if (e.target === overlay) close(); });
  overlay.querySelector(".modal-close").addEventListener("click", close);
  document.addEventListener("keydown", function onKey(e) {
    if (e.key === "Escape") { close(); document.removeEventListener("keydown", onKey); }
  });

  overlay.querySelector("#auth-switch").addEventListener("click", () => {
    close();
    showAuthModal(isLogin ? "signup" : "login");
  });

  overlay.querySelector("#auth-google").addEventListener("click", async () => {
    errorEl.style.display = "none";
    try {
      await authGoogle();
      close();
      render();
    } catch (e) {
      if (e.code !== "auth/popup-closed-by-user") {
        showError(e.message);
      }
    }
  });

  overlay.querySelector("#auth-submit").addEventListener("click", async () => {
    const submitBtn = overlay.querySelector("#auth-submit");
    const username = overlay.querySelector("#auth-username").value.trim();
    const password = overlay.querySelector("#auth-password").value;

    errorEl.style.display = "none";
    submitBtn.disabled = true;
    submitBtn.textContent = "Περίμενε…";

    try {
      if (isLogin) {
        await authLogIn(username, password);
      } else {
        const display = overlay.querySelector("#auth-display").value.trim();
        const password2 = overlay.querySelector("#auth-password2").value;
        if (password !== password2) throw new Error("Οι κωδικοί δεν ταιριάζουν");
        await authSignUp(display, username, password);
      }
      close();
      render();
    } catch (e) {
      showError(e.message);
      submitBtn.disabled = false;
      submitBtn.textContent = isLogin ? "Σύνδεση" : "Εγγραφή";
    }
  });

  // Enter key submits
  overlay.querySelectorAll(".modal-input").forEach((input) => {
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") overlay.querySelector("#auth-submit").click();
    });
  });

  // Focus first input
  const firstInput = overlay.querySelector("#auth-display") || overlay.querySelector("#auth-username");
  setTimeout(() => firstInput.focus(), 100);
}

/* ── Init ──────────────────────────────────────────── */
window.addEventListener("popstate", render);
document.addEventListener("DOMContentLoaded", () => {
  render();
  updateNavAuth();
});
