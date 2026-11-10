/**
 * PayPilot AI — Application Entry Point
 *
 * Responsibilities:
 *   1. Load the global stylesheet.
 *   2. Mount the navigation shell (sidebar + top nav).
 *   3. Register every page with the router.
 *   4. Start the router on the #page-content element.
 *   5. Wire up Firebase auth state listener.
 */

import './styles/main.css';

import router from './router.js';
import { mountNav } from './components/nav.js';
import { firebaseOnAuthStateChanged } from './firebase/init.js';
import { loadUserData, subscribeToFirestore } from './services/firebaseSync.js';
import { setState, getState } from './state/store.js';

// Pages
import * as overviewPage       from './pages/overview.js';
import * as quoteBuilderPage   from './pages/create-quote.js';
import * as quotesListPage     from './pages/quotes.js';
import * as quoteDetailPage    from './pages/quote-detail.js';
import * as paymentRequestPage from './pages/payment-request.js';
import * as checkoutPage       from './pages/checkout.js';
import * as paymentResultPage  from './pages/payment-result.js';
import * as paymentsListPage   from './pages/payments.js';
import * as settingsPage       from './pages/settings.js';
import * as loginPage          from './pages/login.js';

// ── Theme initialization ─────────────────────────────────────
const { theme } = getState();
if (theme === 'dark') {
  document.body.classList.add('theme-dark');
}

// ── Navigation shell ────────────────────────────────────────
mountNav();

// ── Routes ──────────────────────────────────────────────────
router.register('overview',     overviewPage);
router.register('create-quote', quoteBuilderPage);
router.register('edit-quote',   quoteBuilderPage);
router.register('quotes',       quotesListPage);
router.register('quote',        quoteDetailPage);
router.register('pay',          paymentRequestPage);
router.register('checkout',     checkoutPage);
router.register('payment',      paymentResultPage);
router.register('payments',     paymentsListPage);
router.register('settings',     settingsPage);
router.register('login',        loginPage);

// ── Start ───────────────────────────────────────────────────
router.init(document.getElementById('page-content'));

// ── Firebase auth state ─────────────────────────────────────
// Track whether we've already set up Firestore listeners for this session
let _firestoreListenerUid = null;

firebaseOnAuthStateChanged(user => {
  if (user) {
    setState({ authUser: user }, []);
    // Only set up listeners once per uid (avoid duplicates on hot-reload)
    if (_firestoreListenerUid !== user.uid) {
      loadUserData(user.uid);
      subscribeToFirestore(user.uid);
      _firestoreListenerUid = user.uid;
    }
    // Navigate away from login
    if (!location.hash || location.hash === '#login') {
      router.navigate('overview');
    }
  } else {
    _firestoreListenerUid = null;
    setState({ authUser: null }, []);

    // Only redirect to login if not already on a client-facing public route
    const rawHash = (window.location.hash || '').replace(/^#/, '').replace(/^route\//, '');
    const [routeName] = rawHash.split('?')[0].split('/');
    const isPublicRoute = ['checkout', 'payment', 'login'].includes(routeName);

    if (!isPublicRoute) {
      router.navigate('login');
    }
  }
});
