# 🌵 CactoLog - Quick Start Guide

Get your Firebase-powered plant tracker up and running in 5 minutes!

## 📦 What You Need

- Node.js 18+ installed
- A Google account (for Firebase - free tier is plenty!)
- 5 minutes of your time ☕

---

## 🚀 Step 1: Install Dependencies

```bash
npm install
```

This installs Firebase SDK, image compression library, and build tools.

---

## 🔥 Step 2: Set Up Firebase (2 minutes)

### Create Project
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click **"Add Project"**
3. Name it (e.g., "CactoLog")
4. Click **"Create Project"** (disable Analytics if you want)

### Enable Services
In Firebase Console:

1. **Authentication** → Get Started → Enable "Email/Password"
2. **Firestore Database** → Create Database → Production mode
3. **Storage** → Get Started → Production mode

### Update Security Rules

**Firestore Rules:**
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId}/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

**Storage Rules:**
```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /users/{userId}/{allPaths=**} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

### Get Your Config

1. Project Settings (⚙️) → Your apps → Web app (</> icon)
2. Register app (name it "CactoLog Web")
3. Copy the config object

---

## ⚙️ Step 3: Configure App

### Option A: Using js/firebase.js (Simple)

Open `js/firebase.js` and replace lines 8-14 with your config:

```javascript
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  projectId: "YOUR_PROJECT",
  storageBucket: "YOUR_PROJECT.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};
```

### Option B: Using .env (Better for Git)

1. Copy `.env.example` to `.env`
2. Fill in your Firebase values:

```env
VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
```

---

## ▶️ Step 4: Run the App

```bash
npm run dev
```

Opens at http://localhost:3000 🎉

Or simply open `index.html` in your browser (some features need a local server though).

---

## ✅ Test It Out

1. **Sign Up** - Create an account with your email
2. **Add a Plant** - Tap the **+** button, add a photo and details
3. **View Plant** - Tap the card to see details
4. **Water Plant** - Tap "Water Now" button
5. **Check Sync** - Open app on another device/browser (same email) - should see same plants!

---

## 🐛 Common Issues

### "Permission denied" error
- Check Firestore/Storage rules are published
- Make sure you're signed in

### Photos not uploading
- Check Storage rules
- Verify internet connection
- Check browser console for errors

### Service worker not updating
- Hard refresh (Ctrl/Cmd + Shift + R)
- DevTools → Application → Unregister service worker

---

## 📚 Next Steps

- **Read [SETUP.md](SETUP.md)** - Detailed setup guide
- **Read [README.md](README.md)** - Full documentation
- **Deploy to Firebase Hosting** - `firebase deploy`

---

## 🎯 Quick Commands

```bash
npm run dev      # Development server
npm run build    # Build for production
npm run preview  # Preview production build
npm run lint     # Check code quality
```

---

## 🆘 Need Help?

1. Check browser console for errors
2. Verify all Firebase services are enabled
3. See [SETUP.md](SETUP.md) for troubleshooting
4. Check [Firebase Community](https://firebase.google.com/community)

---

**That's it! You're ready to track your plants! 🌵🌿**

Your plant data will sync across all your devices automatically. Install it to your home screen for a native app experience!
