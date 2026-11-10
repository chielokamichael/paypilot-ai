/**
 * PayPilot AI — Application State Store
 *
 * A simple pub/sub state store. All app data lives here.
 * Components subscribe to changes and re-render when relevant state changes.
 *
 * To use:
 *   import { getState, setState, subscribe } from './store.js';
 *
 *   const state = getState();
 *   setState({ activeSection: 'quotes' });
 *   subscribe('quotes', () => renderQuotesList());
 */

import { saveQuote, savePayment, saveSettings, deleteQuoteRecord } from '../services/firebaseSync.js';

// —— Default state shape ——
// Loaded from localStorage if available, then merged with defaults.
const DEFAULT_STATE = {
  // Which nav section is active (overview | create-quote | quotes | payments | settings)
  activeSection: 'overview',

  // The quote currently being built or edited (null when not editing)
  activeQuoteId: null,

  // All quotes (persisted to localStorage)
  quotes: [],

  // All payment records (persisted to localStorage)
  payments: [],

  // Business settings (persisted to localStorage)
  settings: {
    businessName:    'Your Business Name',
    businessEmail:   'hello@yourbusiness.com',
    businessAddress: '123 Main Street, Your City, ST 00000',
    businessPhone:   '',
    currency:        'USD',
    defaultHourlyRate: 100,
    taxRate:         0,
    quoteValidDays:  30,
    geminiApiKey:    '',
    paypalClientId:  '',
    paypalPayoutEmail: '',
  },

  // UI theme – "light" or "dark"
  theme: 'light',
  // Whether onboarding has been shown
  onboardingSeen: false,

  // Firebase auth user (null when not signed in)
  authUser: null,

};

// —— Keys we persist to localStorage ——
const PERSIST_KEYS = ['quotes', 'payments', 'settings', 'theme', 'onboardingSeen'];
const STORAGE_KEY  = 'paypilot_state';

// —— Internal state object ——
let _state = buildInitialState();

// —— Subscriber map: key → Set of callback functions ——
// key '*' means "subscribe to all changes"
const _subscribers = new Map();

/**
 * Build the initial state by merging persisted localStorage data
 * with the default state. This ensures new keys added to DEFAULT_STATE
 * are always present even if they weren't in the saved data.
 */
function buildInitialState() {
  const saved = loadFromStorage();
  // Deep merge: saved values override defaults
  return deepMerge(DEFAULT_STATE, saved);
}

/** Read saved state from localStorage. Returns {} if nothing is saved. */
function loadFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    // Only restore the keys we chose to persist
    const restored = {};
    PERSIST_KEYS.forEach(key => {
      if (parsed[key] !== undefined) restored[key] = parsed[key];
    });
    return restored;
  } catch (e) {
    console.warn('PayPilot: Could not load saved state', e);
    return {};
  }
}

/** Write the persistable slice of state to localStorage. */
function saveToStorage() {
  try {
    const toSave = {};
    PERSIST_KEYS.forEach(key => { toSave[key] = _state[key]; });
    localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
  } catch (e) {
    console.warn('PayPilot: Could not save state', e);
  }
}

/**
 * Simple deep merge. Arrays are NOT merged — the source array replaces the target.
 * Used only for initialisation; don't use for hot updates.
 */
function deepMerge(target, source) {
  const result = Object.assign({}, target);
  for (const key of Object.keys(source)) {
    const sv = source[key];
    const tv = target[key];
    if (sv && typeof sv === 'object' && !Array.isArray(sv) &&
        tv && typeof tv === 'object' && !Array.isArray(tv)) {
      result[key] = deepMerge(tv, sv);
    } else {
      result[key] = sv;
    }
  }
  return result;
}

// ——— Public API ———

/** Return a copy of the current state (callers cannot mutate internals). */
export function getState() {
  return _state;
}

/**
 * Merge a partial update into state, notify subscribers, then persist.
 * @param {Partial<typeof DEFAULT_STATE>} patch - keys to update
 * @param {string[]} [notifyKeys] - which subscriber keys to notify
 *   (defaults to all keys present in the patch)
 */
export function setState(patch, notifyKeys) {
  _state = Object.assign({}, _state, patch);
  saveToStorage();

  // Determine which channels to notify
  const channels = notifyKeys ?? Object.keys(patch);
  channels.forEach(key => {
    // Notify specific-key subscribers
    (_subscribers.get(key) ?? new Set()).forEach(cb => cb(_state));
  });
  // Always notify wildcard subscribers
  (_subscribers.get('*') ?? new Set()).forEach(cb => cb(_state));
}

/**
 * Subscribe to state changes.
 * @param {string} key - a state key, or '*' for all changes
 * @param {(state: object) => void} callback
 * @returns {() => void} unsubscribe function
 */
export function subscribe(key, callback) {
  if (!_subscribers.has(key)) _subscribers.set(key, new Set());
  _subscribers.get(key).add(callback);
  // Return an unsubscribe function
  return () => _subscribers.get(key)?.delete(callback);
}

// —— Convenience helpers ——

/** Generate a quote ID like Q-2024-001 */
export function generateQuoteId() {
  const year = new Date().getFullYear();
  const prefix = `Q-${year}-`;
  const highestSequence = _state.quotes.reduce((highest, quote) => {
    const match = String(quote.id || '').match(new RegExp(`^Q-${year}-(\\d+)$`));
    return match ? Math.max(highest, Number(match[1])) : highest;
  }, 0);

  let sequence = highestSequence + 1;
  let id = `${prefix}${String(sequence).padStart(3, '0')}`;
  while (_state.quotes.some(quote => quote.id === id)) {
    sequence += 1;
    id = `${prefix}${String(sequence).padStart(3, '0')}`;
  }
  return id;
}

/** Generate a payment ID like PAY-2024-001 */
export function generatePaymentId() {
  const year     = new Date().getFullYear();
  const payments = _state.payments;
  const next     = String(payments.length + 1).padStart(3, '0');
  return `PAY-${year}-${next}`;
}

/** Add or update a quote in the quotes array. */
export function upsertQuote(quote) {
  const quotes = _state.quotes.filter(q => q.id !== quote.id);
  setState({ quotes: [...quotes, quote] }, ['quotes']);
  if (_state.authUser?.uid) {
    saveQuote(_state.authUser.uid, quote).catch(err => console.warn('Firestore quote sync error:', err));
  }
}

/** Delete a quote only when it has no related payment history. */
export async function removeQuote(quoteId) {
  if (_state.payments.some(payment => payment.quoteId === quoteId)) {
    throw new Error('Quotes with payment history cannot be deleted.');
  }
  if (!_state.quotes.some(quote => quote.id === quoteId)) return;

  if (_state.authUser?.uid) {
    await deleteQuoteRecord(_state.authUser.uid, quoteId);
  }

  setState({ quotes: _state.quotes.filter(quote => quote.id !== quoteId) }, ['quotes']);
}

/** Add or update a payment record. */
export function upsertPayment(payment) {
  const payments = _state.payments.filter(p => p.id !== payment.id);
  setState({ payments: [...payments, payment] }, ['payments']);
  if (_state.authUser?.uid) {
    savePayment(_state.authUser.uid, payment).catch(err => console.warn('Firestore payment sync error:', err));
  }
}

/** Update settings and persist both locally and to Firestore. */
export async function updateSettings(settings) {
  setState({ settings: { ..._state.settings, ...settings } }, ['settings']);
  if (_state.authUser?.uid) {
    await saveSettings(_state.authUser.uid, _state.settings);
  }
}

/** Get a quote by id. Returns undefined if not found. */
export function getQuoteById(id) {
  return _state.quotes.find(q => q.id === id);
}

/** Get a payment by id. Returns undefined if not found. */
export function getPaymentById(id) {
  return _state.payments.find(p => p.id === id);
}

/** Get all payments for a quote. */
export function getPaymentsForQuote(quoteId) {
  return _state.payments.filter(p => p.quoteId === quoteId);
}
