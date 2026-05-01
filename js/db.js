/* ── Firebase Config ──────────────────────────────── */
// FILL IN your Firebase project config from console.firebase.google.com
const firebaseConfig = {
  apiKey: "AIzaSyAKIzjXAwtBZ9AJW5MFXDNsM6uoEmXO0cY",
  authDomain: "aulaia-a1302.firebaseapp.com",
  databaseURL: "https://aulaia-a1302-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "aulaia-a1302",
  storageBucket: "aulaia-a1302.firebasestorage.app",
  messagingSenderId: "494620413039",
  appId: "1:494620413039:web:69ecbf07720e9d42d6919a",
};

const firebaseReady = !!firebaseConfig.apiKey;
let db = null;

if (firebaseReady) {
  firebase.initializeApp(firebaseConfig);
  db = firebase.firestore();
}

/* ── User identity (localStorage-based) ──────────── */
function getUser() {
  return localStorage.getItem("aulaia_user") || null;
}

function getUserInitials() {
  const name = getUser();
  if (!name) return "??";
  return name
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function promptUserName() {
  return new Promise((resolve) => {
    const overlay = document.createElement("div");
    overlay.className = "modal-overlay";
    overlay.innerHTML = `
      <div class="modal-card" style="max-width:380px">
        <div class="modal-title">Καλώς ήρθες!</div>
        <div class="modal-subtitle">Πώς θέλεις να σε λένε;</div>
        <div class="modal-section">
          <input type="text" id="username-input" class="modal-input"
            placeholder="π.χ. Μαρία Κ." maxlength="30" autofocus>
        </div>
        <div class="modal-actions">
          <button class="btn btn-primary" id="username-save">Πάμε!</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add("open"));

    function save() {
      const val = overlay.querySelector("#username-input").value.trim();
      if (!val) return;
      localStorage.setItem("aulaia_user", val);
      overlay.classList.remove("open");
      setTimeout(() => overlay.remove(), 200);
      resolve(val);
    }

    overlay.querySelector("#username-save").addEventListener("click", save);
    overlay.querySelector("#username-input").addEventListener("keydown", (e) => {
      if (e.key === "Enter") save();
    });
  });
}

async function ensureUser() {
  if (getUser()) return getUser();
  return promptUserName();
}

/* ── Firestore: Reviews ──────────────────────────── */
async function dbSaveReview(playId, data) {
  if (!firebaseReady) return;
  const userName = getUser();
  if (!userName) return;

  const existing = await db
    .collection("reviews")
    .where("playId", "==", playId)
    .where("userName", "==", userName)
    .get();

  const doc = {
    playId,
    userName,
    userInitials: getUserInitials(),
    rating: data.rating || 0,
    recommendation: data.recommendation || null,
    review: data.review || "",
    dateSeen: data.dateSeen || "",
    updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
  };

  if (!existing.empty) {
    await existing.docs[0].ref.update(doc);
  } else {
    doc.createdAt = firebase.firestore.FieldValue.serverTimestamp();
    doc.likedBy = [];
    doc.likes = 0;
    await db.collection("reviews").add(doc);
  }
}

async function dbGetFeedReviews() {
  if (!firebaseReady) return null;
  const snap = await db
    .collection("reviews")
    .orderBy("createdAt", "desc")
    .limit(50)
    .get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

async function dbToggleLike(reviewId) {
  if (!firebaseReady) return null;
  const userName = getUser();
  if (!userName) return null;

  const ref = db.collection("reviews").doc(reviewId);
  const doc = await ref.get();
  if (!doc.exists) return null;

  const data = doc.data();
  const likedBy = data.likedBy || [];
  const alreadyLiked = likedBy.includes(userName);

  if (alreadyLiked) {
    await ref.update({
      likedBy: firebase.firestore.FieldValue.arrayRemove(userName),
      likes: firebase.firestore.FieldValue.increment(-1),
    });
  } else {
    await ref.update({
      likedBy: firebase.firestore.FieldValue.arrayUnion(userName),
      likes: firebase.firestore.FieldValue.increment(1),
    });
  }

  return !alreadyLiked;
}

async function dbSeedExamples(examples) {
  if (!firebaseReady) return;
  if (localStorage.getItem("aulaia_seeded")) return;
  const snap = await db.collection("reviews").limit(1).get();
  if (!snap.empty) { localStorage.setItem("aulaia_seeded", "1"); return; }

  const batch = db.batch();
  examples.forEach((r) => {
    const ref = db.collection("reviews").doc();
    batch.set(ref, {
      playId: r.playId,
      userName: r.userName,
      userInitials: r.userInitials,
      rating: r.rating,
      recommendation: r.recommendation,
      review: r.review,
      dateSeen: r.dateSeen,
      likedBy: [],
      likes: 0,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    });
  });
  await batch.commit();
  localStorage.setItem("aulaia_seeded", "1");
}
