// src/services/firebaseSync.js
/**
 * PayPilot AI — Firebase sync helpers
 *
 * Provides functions to load user‑specific data from Firestore and to keep the
 * local store in sync with remote changes. All data is stored under
 *   users/{uid}/quotes
 *   users/{uid}/payments
 *   users/{uid}/settings
 */
import { db, collection, doc, setDoc, getDoc, getDocs, onSnapshot, deleteDoc } from '../firebase/init.js';
import { getState, setState } from '../state/store.js';

function readSettings(snap) {
  const settings = {};
  snap.forEach(document => {
    const data = document.data();
    settings[document.id] = Object.hasOwn(data, 'value') ? data.value : data;
  });
  return settings;
}

/** Load all user data (quotes, payments, settings) into the local store. */
export async function loadUserData(uid) {
  // Quotes
  const qSnap = await getDocs(collection(db, 'users', uid, 'quotes'));
  const quotes = qSnap.docs.map(d => d.data());
  // Payments
  const pSnap = await getDocs(collection(db, 'users', uid, 'payments'));
  const payments = pSnap.docs.map(d => d.data());
  // Settings (single document)
  const sSnap = await getDocs(collection(db, 'users', uid, 'settings'));
  const settings = readSettings(sSnap);

  setState({
    quotes,
    payments,
    settings: { ...getState().settings, ...settings },
  }, ['quotes', 'payments', 'settings']);
}

/** Subscribe to real‑time updates for the user's collections. */
export function subscribeToFirestore(uid) {
  const publicInvoiceListeners = new Map();

  // Quotes collection
  onSnapshot(collection(db, 'users', uid, 'quotes'), snap => {
    const quotes = snap.docs.map(d => d.data());
    setState({ quotes }, ['quotes']);
  }, err => {
    console.error('Firestore quote listener failed:', err);
  });
  // Payments collection
  onSnapshot(collection(db, 'users', uid, 'payments'), snap => {
    const payments = snap.docs.map(d => d.data());
    setState({ payments }, ['payments']);

    const pendingPayments = payments.filter(payment =>
      payment.status === 'awaiting_approval' || payment.status === 'approved'
    );
    const pendingIds = new Set(pendingPayments.map(payment => payment.id));

    for (const [paymentId, unsubscribe] of publicInvoiceListeners) {
      if (!pendingIds.has(paymentId)) {
        unsubscribe();
        publicInvoiceListeners.delete(paymentId);
      }
    }

    pendingPayments.forEach(payment => {
      if (publicInvoiceListeners.has(payment.id)) return;
      const unsubscribe = subscribeToPublicInvoice(payment.id, invoice => {
        if (invoice.status !== 'captured_simulation' && invoice.status !== 'captured') return;

        const latestPayment = getState().payments.find(item => item.id === payment.id) || payment;
        if (latestPayment.status === 'captured_simulation' || latestPayment.status === 'captured') return;

        const updatedPayment = {
          ...latestPayment,
          status: invoice.status,
          transactionId: invoice.transactionId,
          payerEmail: invoice.payerEmail,
          capturedAt: invoice.capturedAt,
        };
        const currentState = getState();
        setState({
          payments: currentState.payments.map(item => item.id === payment.id ? updatedPayment : item),
          quotes: currentState.quotes.map(quote =>
            quote.id === updatedPayment.quoteId
              ? { ...quote, status: 'paid', updatedAt: invoice.capturedAt || new Date().toISOString() }
              : quote
          ),
        }, ['payments', 'quotes']);
        savePayment(uid, updatedPayment).catch(err => console.warn('Firestore payment sync error:', err));

        const paidQuote = currentState.quotes.find(quote => quote.id === updatedPayment.quoteId);
        if (paidQuote) {
          saveQuote(uid, {
            ...paidQuote,
            status: 'paid',
            updatedAt: invoice.capturedAt || new Date().toISOString(),
          }).catch(err => console.warn('Firestore quote sync error:', err));
        }
      }, err => {
        console.error(`Public invoice listener failed for ${payment.id}:`, err);
      });
      publicInvoiceListeners.set(payment.id, unsubscribe);
    });
  }, err => {
    console.error('Firestore payment listener failed:', err);
  });
  // Settings collection – treat each doc as a key/value pair
  onSnapshot(collection(db, 'users', uid, 'settings'), snap => {
    setState({ settings: { ...getState().settings, ...readSettings(snap) } }, ['settings']);
  }, err => {
    console.error('Firestore settings listener failed:', err);
  });
}

/** Persist a single quote to Firestore. */
export async function saveQuote(uid, quote) {
  await setDoc(doc(db, 'users', uid, 'quotes', quote.id), quote);
}

/** Delete a quote from the signed-in user's collection. */
export async function deleteQuoteRecord(uid, quoteId) {
  const paymentSnapshot = await getDocs(collection(db, 'users', uid, 'payments'));
  const hasPaymentHistory = paymentSnapshot.docs.some(
    payment => payment.data().quoteId === quoteId
  );
  if (hasPaymentHistory) {
    throw new Error('Quotes with payment history cannot be deleted.');
  }
  await deleteDoc(doc(db, 'users', uid, 'quotes', quoteId));
}

/** Persist a single payment to Firestore. */
export async function savePayment(uid, payment) {
  await setDoc(doc(db, 'users', uid, 'payments', payment.id), payment);
}

/** Persist settings (key/value pairs) to Firestore. */
export async function saveSettings(uid, settings) {
  const promises = Object.entries(settings).map(([key, value]) =>
    setDoc(doc(db, 'users', uid, 'settings', key), { value })
  );
  await Promise.all(promises);
}

/**
 * Persist a public client invoice for external client access
 * (accessible by client in any browser without signing in).
 */
export async function savePublicInvoice(orderId, invoiceData) {
  try {
    await setDoc(doc(db, 'public_invoices', orderId), invoiceData);
  } catch (err) {
    console.error('Could not save public invoice to Firestore:', err);
    throw err;
  }
}

/**
 * Fetch a public client invoice by orderId from Firestore.
 */
export async function fetchPublicInvoice(orderId) {
  try {
    const snap = await getDoc(doc(db, 'public_invoices', orderId));
    if (snap.exists()) {
      return snap.data();
    }
  } catch (err) {
    console.warn('Could not fetch public invoice from Firestore:', err);
  }
  return null;
}

/**
 * Update payment capture status on public invoice.
 */
export async function updatePublicInvoiceStatus(orderId, updates) {
  try {
    await setDoc(doc(db, 'public_invoices', orderId), updates, { merge: true });
    return true;
  } catch (err) {
    console.warn('Could not update public invoice status:', err);
    return false;
  }
}

/**
 * Listen in real time to updates on a public invoice document.
 * Enables instant live transition when client pays from another browser (Edge, mobile, etc.).
 */
export function subscribeToPublicInvoice(orderId, callback) {
  try {
    return onSnapshot(doc(db, 'public_invoices', orderId), snap => {
      if (snap.exists()) {
        callback(snap.data());
      }
    }, err => {
      console.error(`Could not listen to public invoice ${orderId}:`, err);
    });
  } catch (err) {
    console.warn('Could not subscribe to public invoice:', err);
    return () => {};
  }
}

/**
 * Encode invoice data into a URL-safe compact string.
 */
export function encodeInvoicePayload(data) {
  try {
    const json = JSON.stringify(data);
    return encodeURIComponent(btoa(unescape(encodeURIComponent(json))));
  } catch {
    return '';
  }
}

/**
 * Decode URL-safe compact string into invoice data.
 */
export function decodeInvoicePayload(str) {
  if (!str) return null;
  try {
    const json = decodeURIComponent(escape(atob(decodeURIComponent(str))));
    return JSON.parse(json);
  } catch {
    return null;
  }
}
