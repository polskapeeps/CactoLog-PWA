# CactoLog - Plant Care Tracker PWA

CactoLog is a mobile-first Progressive Web App for managing plant care. It combines an offline-first IndexedDB cache with Firebase authentication, Firestore sync, and Storage-backed photo uploads so your plants stay organised across every device.

## Features
- Touch-friendly interface with bottom navigation, photo cards, and full-screen dialogs
- Email/password and Google authentication via Firebase Auth
- Real-time Firestore sync with an offline queue that replays when connectivity returns
- Photo uploads with in-browser compression plus generated thumbnails stored in Firebase Storage
- Smart filtering, urgency-based sorting, and quick actions such as “water now”
- JSON backup and restore for portable exports

## Quick Start
### Prerequisites
- Node.js 18 or newer
- A Firebase project with Auth, Firestore, and Storage enabled

### 1. Install dependencies
```bash
npm install
```

### 2. Configure Firebase credentials
Create a `.env` file based on `.env.example` and fill in your Firebase web app settings:

```
cp .env.example .env
# edit .env to add your Firebase keys
```

At build time Vite injects these `VITE_FIREBASE_*` variables and `js/firebase.js` picks them up automatically. As an alternative you can copy `firebase.config.example.js` to `js/firebase.config.js`; the app will fall back to that module (or a `globalThis.__FIREBASE_CONFIG__` global) when the environment variables are missing.

### 3. Run the development server
```bash
npm run dev
```

Vite serves the app at `http://localhost:3000` with hot module reloading. The bare HTML file no longer works standalone because Firebase is imported via ESM packages that are resolved by Vite.

### 4. Build for production
```bash
npm run build
npm run preview
```

The production build is emitted to `dist/`. `npm run preview` serves that output locally so you can verify the service worker and caching behaviour before deploying.

## Additional Notes
- Copy `js/firebase.config.js` to `.gitignore` (already done) so your secrets never enter version control.
- The service worker caches key assets for offline usage; bump `CACHE_NAME` in `sw.js` whenever you ship noteworthy static changes.
- Browser notifications are optional. Users can enable them from Settings and the app will request permission before scheduling reminders.

Happy plant tracking!
