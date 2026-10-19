# Sales desk (UI for the payouts API)
    npm install
    BACKEND_URL=http://localhost:8080 npm start     # UI on http://localhost:3000
The Node server serves the UI and forwards `/api/*` to the backend, so no CORS setup is needed.
Screens: Overview (landing), Client (dropdown: Client / Service / POC; names link to Sales filtered), Sales (add, edit, filter, pagination, Excel import). Login / Sign up in front.
Settings to match your backend are at the top of `public/app.js` (`AUTH`, `UPLOAD_FIELD`).
