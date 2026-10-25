// Paste your Firebase web-app settings here (Firebase console → Project
// settings → General → Your apps → Web app → "SDK setup and configuration").
// These values are NOT secrets — they identify your project and are meant to
// ship inside the website. What protects people's data is firestore.rules.
//
// Until you fill this in, the site still works — it just saves on each
// person's own device only, with no sign-in button.
export const firebaseConfig = {
  apiKey: "AIzaSyBgBQWRmJSl9YayOdtxoyx3f9UM7txnUZU",
  authDomain: "planmymeals-40842.firebaseapp.com",
  projectId: "planmymeals-40842",
  storageBucket: "planmymeals-40842.firebasestorage.app",
  messagingSenderId: "589214290661",
  appId: "1:589214290661:web:8b62e24f98851ccdca3a0c",
};

export const isFirebaseConfigured = !String(firebaseConfig.apiKey).startsWith("PASTE");

// The one Google account allowed to add, edit and remove recipes in the shared
// library. Put the same address in firestore.rules (see README). Everyone else
// can only read the library and copy recipes into their own list.
export const ADMIN_EMAIL = "xcherylsw@gmail.com";
