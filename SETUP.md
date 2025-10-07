# CactoLog Setup Guide

This guide walks through configuring Firebase, supplying credentials, and running the CactoLog PWA locally or in production.

## 1. Prerequisites
- Node.js 18+ and npm
- A Google account for Firebase
- Modern Chromium, Firefox, or Safari for testing

## 2. Install project dependencies
```bash
npm install
```

## 3. Create and configure a Firebase project
1. Open [Firebase Console](https://console.firebase.google.com/) and create a new project (e.g. “CactoLog”).
2. Enable **Authentication** with the Email/Password provider. Optionally enable Google sign-in.
3. Set up **Firestore** in production mode. Replace the default rules with:
   ```
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /users/{userId}/{document=**} {
         allow read, write: if request.auth != null && request.auth.uid == userId;
       }
     }
   }
   ```
4. Enable **Storage** in the same region and apply rules that scope access to the authenticated user:
   ```
   rules_version = '2';
   service firebase.storage {
     match /b/{bucket}/o {
       match /users/{userId}/{allPaths=**} {
         allow read, write: if request.auth != null && request.auth.uid == userId;
       }
     }
   }
   ```
5. In **Project Settings → General**, register a new Web app and copy the config object that contains `apiKey`, `authDomain`, etc.

## 4. Provide credentials to the app
Copy `.env.example` to `.env` and paste the values collected above:
```
cp .env.example .env
# edit .env
```
Each environment variable is prefixed with `VITE_` so Vite exposes it to the frontend bundle. As a fallback, you can copy `firebase.config.example.js` to `js/firebase.config.js`; the app checks for environment variables first and then for that local module or a `globalThis.__FIREBASE_CONFIG__` object.

## 5. Development workflow
- `npm run dev` — start the Vite dev server on `http://localhost:3000` with hot reload.
- `npm run lint` — run ESLint on source and test files.

Because Firebase packages are imported via bare module specifiers, opening `index.html` directly in the browser will not work; always use `npm run dev` for local development.

## 6. Production build and preview
```
npm run build
npm run preview
```
The build step emits assets to `dist/`. The preview command serves that output with the same HTTP semantics you will have in production, which is important for testing the service worker cache.

## 7. Deployment notes
- Upload the contents of `dist/` to your hosting provider (Firebase Hosting, Netlify, Vercel, etc.).
- Ensure responses set `Cache-Control` headers appropriate for a PWA. Static assets can be cached aggressively; `index.html` should remain un-cached or have a short TTL.
- Update the `CACHE_NAME` in `sw.js` whenever you need clients to pull a fresh copy of cached resources.

## 8. Troubleshooting
- **Auth errors**: verify the credentials in `.env` match the Firebase project and that the requested providers are enabled.
- **Offline queue not syncing**: check the browser console for messages from `sync.js`. The queue persists in `localStorage`; clearing app storage can reset it during debugging.
- **Images not uploading**: confirm Firebase Storage rules and bucket region. The app compresses images client-side; oversized originals should still succeed after compression.

Feel free to adapt these steps for your deployment provider of choice. Once configured, the app syncs automatically across devices, even when users bounce between offline and online states.
