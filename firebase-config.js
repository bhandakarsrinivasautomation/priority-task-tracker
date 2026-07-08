// Firebase configuration (compat SDK)
const firebaseConfig = {
  apiKey: "AIzaSyBse6BoJ6qHpOmsd827LFqR0Dx7PuU3JJI",
  authDomain: "prooritybasedtasktracker.firebaseapp.com",
  projectId: "prooritybasedtasktracker",
  storageBucket: "prooritybasedtasktracker.firebasestorage.app",
  messagingSenderId: "104376874284",
  appId: "1:104376874284:web:7021dbf4ac4dda14fe2889"
};

firebase.initializeApp(firebaseConfig);

const auth = firebase.auth();
const db = firebase.firestore();

// Superadmin email — has visibility into all users' tasks and can change priority
const SUPERADMIN_EMAIL = "bhandakarsrinivas.automation@gmail.com";
