/* ── Firebase Config ──────────────────────────────── */
const firebaseConfig = {
  apiKey: "AIzaSyAKIzjXAwtBZ9AJW5MFXDNsM6uoEmXO0cY",
  authDomain: "aulaia-a1302.firebaseapp.com",
  projectId: "aulaia-a1302",
  storageBucket: "aulaia-a1302.firebasestorage.app",
  messagingSenderId: "494620413039",
  appId: "1:494620413039:web:69ecbf07720e9d42d6919a",
};

const firebaseReady = !!firebaseConfig.apiKey;
let db = null;
let auth = null;
let currentAuthUser = null;

if (firebaseReady) {
  firebase.initializeApp(firebaseConfig);
  db = firebase.firestore();
  auth = firebase.auth();
  auth.languageCode = "el";

  auth.onAuthStateChanged((user) => {
    currentAuthUser = user;
    if (typeof updateNavAuth === "function") updateNavAuth();
    if (typeof currentTab !== "undefined" && currentTab === "feed" && typeof loadFeed === "function") {
      loadFeed();
    }
  });
}

/* ── Auth helpers ─────────────────────────────────── */
function isLoggedIn() {
  return !!currentAuthUser;
}

function getUser() {
  return currentAuthUser ? currentAuthUser.displayName : null;
}

function getUserUid() {
  return currentAuthUser ? currentAuthUser.uid : null;
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

function validateUsername(u) {
  if (!u || u.length < 3 || u.length > 20)
    return "Το username πρέπει να είναι 3–20 χαρακτήρες";
  if (!/^[a-zA-Z][a-zA-Z0-9_]*$/.test(u))
    return "Μόνο λατινικοί χαρακτήρες, αριθμοί και _ (ξεκινά με γράμμα)";
  return null;
}

function validatePassword(p) {
  if (!p || p.length < 8)
    return "Ο κωδικός πρέπει να είναι τουλάχιστον 8 χαρακτήρες";
  return null;
}

async function authSignUp(displayName, username, password) {
  const uerr = validateUsername(username);
  if (uerr) throw new Error(uerr);

  const perr = validatePassword(password);
  if (perr) throw new Error(perr);

  const uname = username.toLowerCase();
  const name = displayName && displayName.trim().length >= 2 ? displayName.trim() : uname;

  const taken = await db.collection("usernames").doc(uname).get();
  if (taken.exists) throw new Error("Αυτό το username είναι ήδη κατειλημμένο");

  const email = uname + "@aulaia.app";
  const cred = await auth.createUserWithEmailAndPassword(email, password);
  await cred.user.updateProfile({ displayName: name });

  const batch = db.batch();
  batch.set(db.collection("users").doc(cred.user.uid), {
    username: uname,
    displayName: name,
    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
  });
  batch.set(db.collection("usernames").doc(uname), {
    uid: cred.user.uid,
  });
  await batch.commit();

  localStorage.removeItem("aulaia_user");
  return cred.user;
}

async function authLogIn(username, password) {
  if (!username || !username.trim()) throw new Error("Συμπλήρωσε το username");
  if (!password) throw new Error("Συμπλήρωσε τον κωδικό");

  const email = username.toLowerCase().trim() + "@aulaia.app";
  try {
    const cred = await auth.signInWithEmailAndPassword(email, password);
    localStorage.removeItem("aulaia_user");
    return cred.user;
  } catch (e) {
    if (
      e.code === "auth/user-not-found" ||
      e.code === "auth/wrong-password" ||
      e.code === "auth/invalid-credential"
    )
      throw new Error("Λάθος username ή κωδικός");
    if (e.code === "auth/too-many-requests")
      throw new Error("Πολλές προσπάθειες. Δοκίμασε ξανά σε λίγο");
    throw e;
  }
}

async function authGoogle() {
  const provider = new firebase.auth.GoogleAuthProvider();
  const result = await auth.signInWithPopup(provider);
  const user = result.user;

  const profileRef = db.collection("users").doc(user.uid);
  const profileSnap = await profileRef.get();
  if (!profileSnap.exists) {
    await profileRef.set({
      displayName: user.displayName || "Google User",
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    });
  }

  localStorage.removeItem("aulaia_user");
  return user;
}

async function authLogOut() {
  await auth.signOut();
}

/* ── Firestore: Reviews ──────────────────────────── */
async function dbSaveReview(playId, data) {
  if (!firebaseReady || !isLoggedIn()) return;
  const uid = getUserUid();

  const existing = await db
    .collection("reviews")
    .where("playId", "==", playId)
    .where("uid", "==", uid)
    .get();

  const doc = {
    playId,
    uid,
    userName: getUser(),
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
  if (!firebaseReady || !isLoggedIn()) return null;
  const uid = getUserUid();

  const ref = db.collection("reviews").doc(reviewId);
  const doc = await ref.get();
  if (!doc.exists) return null;

  const likedBy = doc.data().likedBy || [];
  const alreadyLiked = likedBy.includes(uid);

  if (alreadyLiked) {
    await ref.update({
      likedBy: firebase.firestore.FieldValue.arrayRemove(uid),
      likes: firebase.firestore.FieldValue.increment(-1),
    });
  } else {
    await ref.update({
      likedBy: firebase.firestore.FieldValue.arrayUnion(uid),
      likes: firebase.firestore.FieldValue.increment(1),
    });
  }
  return !alreadyLiked;
}

async function dbToggleFavorite(playId) {
  if (!firebaseReady || !isLoggedIn()) return null;
  const uid = getUserUid();
  const ref = db.collection("users").doc(uid);
  const doc = await ref.get();
  const favorites = doc.exists ? (doc.data().favorites || []) : [];

  if (favorites.includes(playId)) {
    await ref.update({ favorites: firebase.firestore.FieldValue.arrayRemove(playId) });
    return false;
  } else {
    if (favorites.length >= 5) throw new Error("Μέχρι 5 αγαπημένες παραστάσεις");
    await ref.update({ favorites: firebase.firestore.FieldValue.arrayUnion(playId) });
    return true;
  }
}

async function dbToggleWatchlist(playId) {
  if (!firebaseReady || !isLoggedIn()) return;
  const uid = getUserUid();
  const ref = db.collection("users").doc(uid);
  const doc = await ref.get();
  const watchlist = doc.exists ? (doc.data().watchlist || []) : [];

  if (watchlist.includes(playId)) {
    await ref.update({ watchlist: firebase.firestore.FieldValue.arrayRemove(playId) });
    return false;
  } else {
    await ref.update({ watchlist: firebase.firestore.FieldValue.arrayUnion(playId) });
    return true;
  }
}

async function dbGetUserProfile(uid) {
  if (!firebaseReady) return null;
  const userDoc = await db.collection("users").doc(uid).get();
  const snap = await db.collection("reviews").where("uid", "==", uid).get();
  return {
    user: userDoc.exists ? userDoc.data() : null,
    reviews: snap.docs.map((d) => ({ id: d.id, ...d.data() })),
  };
}

/* ── Firestore: Following ──────────────────────────── */
async function dbToggleFollow(targetUid) {
  if (!firebaseReady || !isLoggedIn()) return null;
  const uid = getUserUid();
  if (uid === targetUid) return null;

  const ref = db.collection("users").doc(uid);
  const doc = await ref.get();
  const following = doc.exists ? (doc.data().following || []) : [];

  if (following.includes(targetUid)) {
    await ref.update({ following: firebase.firestore.FieldValue.arrayRemove(targetUid) });
    return false;
  } else {
    await ref.update({ following: firebase.firestore.FieldValue.arrayUnion(targetUid) });
    return true;
  }
}

async function dbGetFollowing() {
  if (!firebaseReady || !isLoggedIn()) return [];
  const uid = getUserUid();
  const doc = await db.collection("users").doc(uid).get();
  return doc.exists ? (doc.data().following || []) : [];
}

async function dbGetFollowingReviews(followingUids) {
  if (!firebaseReady || !followingUids.length) return [];
  // Firestore "in" queries limited to 30 items
  const chunks = [];
  for (let i = 0; i < followingUids.length; i += 30) {
    chunks.push(followingUids.slice(i, i + 30));
  }
  let all = [];
  for (const chunk of chunks) {
    const snap = await db.collection("reviews")
      .where("uid", "in", chunk)
      .orderBy("createdAt", "desc")
      .limit(50)
      .get();
    all = all.concat(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  }
  all.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
  return all.slice(0, 50);
}

async function dbIsFollowing(targetUid) {
  if (!firebaseReady || !isLoggedIn()) return false;
  const following = await dbGetFollowing();
  return following.includes(targetUid);
}

async function dbCheckMutualFollow(targetUid) {
  if (!firebaseReady || !isLoggedIn()) return { iFollow: false, theyFollow: false };
  const uid = getUserUid();
  const [myDoc, theirDoc] = await Promise.all([
    db.collection("users").doc(uid).get(),
    db.collection("users").doc(targetUid).get(),
  ]);
  const myFollowing = myDoc.exists ? (myDoc.data().following || []) : [];
  const theirFollowing = theirDoc.exists ? (theirDoc.data().following || []) : [];
  return {
    iFollow: myFollowing.includes(targetUid),
    theyFollow: theirFollowing.includes(uid),
  };
}

/* ── Firestore: Comments ───────────────────────────── */
async function dbAddComment(reviewId, text) {
  if (!firebaseReady || !isLoggedIn()) return null;
  const ref = await db
    .collection("reviews").doc(reviewId)
    .collection("comments")
    .add({
      uid: getUserUid(),
      userName: getUser(),
      userInitials: getUserInitials(),
      text: text,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    });
  return ref.id;
}

async function dbGetComments(reviewId) {
  if (!firebaseReady) return [];
  const snap = await db
    .collection("reviews").doc(reviewId)
    .collection("comments")
    .orderBy("createdAt", "asc")
    .get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

async function dbDeleteComment(reviewId, commentId) {
  if (!firebaseReady || !isLoggedIn()) return;
  await db
    .collection("reviews").doc(reviewId)
    .collection("comments").doc(commentId)
    .delete();
}

/* ── One-time cleanup: delete seeded bot reviews ──── */
async function dbPurgeBotReviews() {
  if (!firebaseReady) return;
  if (localStorage.getItem("aulaia_purged")) return;
  try {
    const snap = await db.collection("reviews").get();
    const botDocs = snap.docs.filter((d) => !d.data().uid);
    if (botDocs.length === 0) {
      localStorage.setItem("aulaia_purged", "1");
      return;
    }
    const batch = db.batch();
    botDocs.forEach((d) => batch.delete(d.ref));
    await batch.commit();
    console.log("Purged " + botDocs.length + " bot reviews");
    localStorage.setItem("aulaia_purged", "1");
  } catch (e) {
    console.error("Purge bot reviews error:", e);
  }
}

