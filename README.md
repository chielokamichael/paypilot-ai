# PayPilot AI — AI Freelance Quoting & PayPal Checkout Prototype

> **Project built for the PayPal AI Hackathon 2026**  
> *"Build What's Next with PayPal and AI"*

![License: MIT](https://img.shields.io/badge/License-MIT-emerald.svg)
![PayPal SDK](https://img.shields.io/badge/PayPal-JavaScript%20SDK%20v6%20(Sandbox)-003087.svg)
![AI Engine](https://img.shields.io/badge/AI-Google%20Gemini%201.5%20Flash-4285F4.svg)
![Database](https://img.shields.io/badge/Database-Firebase%20Firestore-FFCA28.svg)

---

## The Problem

Freelancers often need to turn an informal client brief into a clear, itemized quote, then keep the quote and payment-request workflow organized.

---

## The Solution: PayPilot AI

PayPilot AI is a prototype for AI-assisted quote creation and client-facing invoice workflows:

1. **AI-assisted quote drafting:** Convert a project brief into editable line items, milestones, assumptions, and exclusions using Gemini when configured, with a local fallback.
2. **Quote management:** Search, filter, sort, and track client quotes and related payment-request status.
3. **Client invoice flow:** Create a shareable client invoice view and print-friendly summary.
4. **Checkout prototype:** The current order creation and capture are simulated. No PayPal transaction is captured and no money is moved.

---

## 🛠️ Technical Architecture

```
[ Natural Language Client Brief ]
                │
                ▼
  [ Google Gemini 1.5 Flash API ]
   • JSON-formatted Draft Output
   • Line Items, Rates & Quantities
   • Phased Milestones & Due Dates
   • Scope Exclusions & Assumptions
                │
                ▼
    [ Freelancer Review ]
   • Editable AI-Generated Quote
   • Human Review of Scope and Price
                │
                ▼
 [ PayPal SDK v6 Checkout Interface ]
   • window.paypal.createInstance()
   • findEligibleMethods({ currency: 'USD' })
   • <paypal-button> & <paypal-pay-later-button>
                │
                ▼
  [ Sandbox Checkout Prototype ]
   • Simulated Order and Capture
   • Cloud Firestore Database Sync
   • Print-Friendly Demo Receipt
```

---

## ⚡ PayPal JavaScript SDK v6 Integration Highlights

The checkout prototype includes PayPal JavaScript SDK v6 client initialization and UI:

- **SDK initialization:** Creates a client instance using the sandbox SDK.
- **Eligibility check:** Queries available PayPal methods when supported by the loaded SDK.
- **Checkout UI:** Uses PayPal web components and session callbacks where available.
- **Important limitation:** `createV6Order` and `captureV6Order` currently return local simulated data. The prototype does not complete a PayPal order or route payouts.

---

## 📦 Getting Started (Local Setup)

### 1. Prerequisites
- Node.js 18+ (tested with Node 20 / 22)
- Modern web browser (Chrome, Edge, Firefox, Safari)

### 2. Clone and Install Dependencies
Clone the published repository, open its folder in a terminal, and run
`npm install`.

### 3. Environment Configuration
Create a `.env` file in the root directory (or use `.env.example`):
```env
# Google Gemini API Key (for live AI quote generation)
VITE_GEMINI_API_KEY=your_gemini_api_key_here

# PayPal Sandbox Client ID (from developer.paypal.com)
VITE_PAYPAL_CLIENT_ID=your_sandbox_client_id_here

# Firebase Configuration (Authentication & Firestore)
VITE_FIREBASE_API_KEY=your_firebase_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
```

> **Note:** If `VITE_GEMINI_API_KEY` is omitted, quote drafting uses the built-in local heuristic fallback.

> **Security:** `VITE_*` values are bundled into browser code. Use test credentials only for local demos; never put private production API keys or secrets in client-side environment variables.

### 4. Run Development Server
```bash
npm run dev
```
Open [http://localhost:5173](http://localhost:5173) in your browser.

### 5. Build for Production
```bash
npm run build
```

### Firestore Rules

The rules in [`firestore.rules`](./firestore.rules) preserve the existing
per-account protections and allow public invoice reads only. To apply them,
open **Firebase Console → Firestore Database → Rules**, add the
`/public_invoices/{invoiceId}` match inside the existing
`match /databases/{database}/documents` block (alongside `/users/{userId}`),
then publish. Do not put it inside the `/users/{userId}` match.

These production rules intentionally deny browser creation and updates of
public invoices. The current checkout capture is simulated, so allowing a
public browser to mark an invoice paid is not safe for a production project.
For cross-browser simulation during development, use a separate Firebase
sandbox project and the rules in [`firestore.sandbox.rules`](./firestore.sandbox.rules)
there only. Set the app's `VITE_FIREBASE_*` values to that sandbox project.
Those sandbox rules permit unauthenticated updates to the simulated checkout
fields; they must never be published to production. Real payment status needs
a trusted backend that verifies capture with PayPal before updating Firestore.

Quotes can be searched by client, email, project, or ID and sorted by date,
client, email, or total. A quote with any payment record is protected from
deletion so transaction history remains available. When a client completes a
sandbox checkout, the open payment-link screen updates from Firestore without
requiring a refresh.

---

## 🧪 Testing with PayPal Sandbox

To test end-to-end payment flows without spending real funds:
1. Log into the application and visit **Settings**.
2. Set a demo payout email for display (e.g. `freelancer@example.com`); it will not receive funds.
3. Click **Create Quote**, paste a sample brief (e.g. *"Build a React web application with PayPal integration"*), and click **Ask Gemini to draft quote**.
4. Review and edit the generated deliverables, milestones, assumptions, and exclusions before sharing.
5. Open the quote, choose **Request Payment**, then generate a sandbox checkout link.
6. Keep the freelancer page open in Chrome, open the link in Edge, and run the checkout simulation.
7. The simulated status should sync to the freelancer dashboard through Firestore and produce a clearly labeled demo receipt. No real payment is processed.

---

## 🔒 Security & Privacy

- **Checkout status:** The current browser flow generates simulated order and capture data. It does not create/capture a PayPal order or move money.
- **Firestore:** User data is protected by `/users/{uid}/` rules. Public invoice access is separate; keep browser writes disabled in production.
- **AI privacy:** Quote briefs are sent to Gemini when a key is configured. Do not include sensitive personal or payment information in test prompts.
- **Before production:** Implement PayPal order creation and capture on a trusted backend, verify captures with PayPal, and update Firestore only from that backend.

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).
