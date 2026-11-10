// src/pages/login.js
/**
 * PayPilot AI — Auth Page (Login / Sign Up / Forgot Password)
 *
 * Full-screen branded auth experience. Hides the sidebar and topnav.
 * Supports email+password sign-in, sign-up, Google OAuth, and password reset.
 */

import {
  firebaseSignIn,
  firebaseSignUp,
  firebaseGoogleSignIn,
  firebaseSendPasswordReset,
  firebaseUpdateProfile,
} from '../firebase/init.js';
import { showModal } from '../components/modal.js';

let rootElem = null;

// ── Friendly error messages ─────────────────────────────────
const ERROR_MAP = {
  'auth/invalid-email':           'Please enter a valid email address.',
  'auth/user-disabled':           'This account has been disabled. Contact support.',
  'auth/user-not-found':          'No account found with that email.',
  'auth/wrong-password':          'Incorrect password. Try again or reset it.',
  'auth/invalid-credential':      'Invalid email or password. Please try again.',
  'auth/email-already-in-use':    'An account with that email already exists. Try signing in.',
  'auth/weak-password':           'Password must be at least 6 characters.',
  'auth/too-many-requests':       'Too many attempts. Please wait a moment and try again.',
  'auth/popup-closed-by-user':    'The sign-in popup was closed. Try again when ready.',
  'auth/network-request-failed':  'Network error. Check your connection and try again.',
};

function friendlyError(error) {
  const code = error?.code || '';
  return ERROR_MAP[code] || error?.message || 'Something went wrong. Please try again.';
}

// ── Google icon SVG ─────────────────────────────────────────
const GOOGLE_ICON = `<svg width="18" height="18" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#34A853" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#FBBC05" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>`;

// ── Render ──────────────────────────────────────────────────
function render() {
  const el = document.createElement('div');
  el.className = 'auth-page';
  el.innerHTML = `
    <!-- Left: branding panel -->
    <div class="auth-page__brand">
      <div class="auth-brand__inner">
        <div class="auth-brand__logo">
          <span class="auth-brand__mark">
            <img src="/favicon.svg" alt="" aria-hidden="true">
          </span>
          <span class="auth-brand__name">PayPilot AI</span>
        </div>
        <h1 class="auth-brand__headline">Turn client requests into<br/>professional quotations.</h1>
        <p class="auth-brand__sub">AI-assisted quotes, structured deliverables, and seamless PayPal payment requests — built for independent professionals.</p>
        <ul class="auth-brand__features">
          <li><strong>AI-powered drafts</strong> — describe the work, get a structured quote</li>
          <li><strong>Editable line items</strong> — full control over pricing and deliverables</li>
          <li><strong>PayPal integration</strong> — send payment requests with one click</li>
        </ul>
      </div>
    </div>

    <!-- Right: auth forms -->
    <div class="auth-page__form">
      <div class="auth-form__inner">

        <!-- Tab switcher -->
        <div class="auth-tabs" role="tablist">
          <button class="auth-tab is-active" data-tab="signin" role="tab" aria-selected="true">Sign In</button>
          <button class="auth-tab" data-tab="signup" role="tab" aria-selected="false">Create Account</button>
        </div>

        <!-- SIGN-IN PANEL -->
        <div class="auth-panel" id="panel-signin">
          <p class="auth-panel__sub">Welcome back. Sign in to your workspace.</p>

          <button class="auth-google-btn" id="btn-google-signin" type="button">
            ${GOOGLE_ICON}
            Continue with Google
          </button>

          <div class="auth-divider"><span>or sign in with email</span></div>

          <div class="field-group">
            <label for="signin-email" class="field-label">Email address</label>
            <input id="signin-email" type="email" class="field-input" autocomplete="email" required />
          </div>
          <div class="field-group">
            <label for="signin-pass" class="field-label">Password</label>
            <input id="signin-pass" type="password" class="field-input" autocomplete="current-password" required />
          </div>

          <div class="auth-row">
            <button id="btn-signin" class="btn btn-primary auth-submit" type="button">Sign In</button>
            <button id="btn-forgot" class="btn-text" type="button">Forgot password?</button>
          </div>

          <p class="auth-feedback" id="signin-feedback" role="status" aria-live="polite"></p>
        </div>

        <!-- SIGN-UP PANEL -->
        <div class="auth-panel is-hidden" id="panel-signup">
          <p class="auth-panel__sub">Create your PayPilot workspace.</p>

          <button class="auth-google-btn" id="btn-google-signup" type="button">
            ${GOOGLE_ICON}
            Continue with Google
          </button>

          <div class="auth-divider"><span>or create account with email</span></div>

          <div class="field-group">
            <label for="signup-name" class="field-label">Full name</label>
            <input id="signup-name" type="text" class="field-input" autocomplete="name" />
          </div>
          <div class="field-group">
            <label for="signup-email" class="field-label">Email address</label>
            <input id="signup-email" type="email" class="field-input" autocomplete="email" required />
          </div>
          <div class="field-group">
            <label for="signup-pass" class="field-label">Password</label>
            <input id="signup-pass" type="password" class="field-input" autocomplete="new-password" required />
            <span class="field__hint">At least 6 characters</span>
          </div>

          <button id="btn-signup" class="btn btn-primary auth-submit" type="button">Create Account</button>

          <p class="auth-feedback" id="signup-feedback" role="status" aria-live="polite"></p>
        </div>

        <!-- FORGOT PASSWORD PANEL -->
        <div class="auth-panel is-hidden" id="panel-forgot">
          <p class="auth-panel__sub">Enter your email and we'll send a reset link.</p>

          <div class="field-group">
            <label for="forgot-email" class="field-label">Email address</label>
            <input id="forgot-email" type="email" class="field-input" autocomplete="email" required />
          </div>

          <button id="btn-reset" class="btn btn-primary auth-submit" type="button">Send Reset Link</button>
          <button id="btn-back-to-signin" class="btn-text" type="button">&larr; Back to sign in</button>

          <p class="auth-feedback" id="forgot-feedback" role="status" aria-live="polite"></p>
        </div>

      </div>
    </div>
  `;
  return el;
}

// ── Helpers ─────────────────────────────────────────────────
function showPanel(name) {
  document.querySelectorAll('.auth-panel').forEach(p => p.classList.add('is-hidden'));
  document.getElementById(`panel-${name}`)?.classList.remove('is-hidden');

  document.querySelectorAll('.auth-tab').forEach(t => {
    const isActive = t.dataset.tab === name;
    t.classList.toggle('is-active', isActive);
    t.setAttribute('aria-selected', isActive ? 'true' : 'false');
  });
}

function setFeedback(id, msg, isError = true) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = msg;
  el.className = `auth-feedback ${isError ? 'auth-feedback--error' : 'auth-feedback--success'}`;
}

function clearFeedback() {
  document.querySelectorAll('.auth-feedback').forEach(el => {
    el.textContent = '';
    el.className = 'auth-feedback';
  });
}

function setLoading(btnId, loading) {
  const btn = document.getElementById(btnId);
  if (!btn) return;
  btn.disabled = loading;
  if (loading) btn.dataset.originalText = btn.textContent;
  btn.textContent = loading ? 'Please wait…' : (btn.dataset.originalText || btn.textContent);
}

// ── Bind events ─────────────────────────────────────────────
function bindEvents() {
  // Tab switching
  document.querySelectorAll('.auth-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      clearFeedback();
      showPanel(tab.dataset.tab);
    });
  });

  // Forgot password link
  document.getElementById('btn-forgot')?.addEventListener('click', () => {
    clearFeedback();
    showPanel('forgot');
  });

  // Back to sign-in from forgot
  document.getElementById('btn-back-to-signin')?.addEventListener('click', () => {
    clearFeedback();
    showPanel('signin');
  });

  // ── Email sign-in ──
  document.getElementById('btn-signin')?.addEventListener('click', async () => {
    clearFeedback();
    const email = document.getElementById('signin-email')?.value.trim();
    const pass  = document.getElementById('signin-pass')?.value;

    if (!email || !pass) {
      setFeedback('signin-feedback', 'Please fill in both email and password.');
      return;
    }

    setLoading('btn-signin', true);
    try {
      await firebaseSignIn(email, pass);
      // Auth listener handles navigation
    } catch (e) {
      setFeedback('signin-feedback', friendlyError(e));
    } finally {
      setLoading('btn-signin', false);
    }
  });

  // ── Email sign-up ──
  document.getElementById('btn-signup')?.addEventListener('click', async () => {
    clearFeedback();
    const name  = document.getElementById('signup-name')?.value.trim();
    const email = document.getElementById('signup-email')?.value.trim();
    const pass  = document.getElementById('signup-pass')?.value;

    if (!email || !pass) {
      setFeedback('signup-feedback', 'Email and password are required.');
      return;
    }

    setLoading('btn-signup', true);
    try {
      const cred = await firebaseSignUp(email, pass);
      if (name) await firebaseUpdateProfile(name);
      // Auth listener handles navigation
    } catch (e) {
      setFeedback('signup-feedback', friendlyError(e));
    } finally {
      setLoading('btn-signup', false);
    }
  });

  // ── Google sign-in (both tabs use the same flow) ──
  const handleGoogle = async (feedbackId) => {
    clearFeedback();
    try {
      await firebaseGoogleSignIn();
    } catch (e) {
      if (e?.code !== 'auth/popup-closed-by-user') {
        setFeedback(feedbackId, friendlyError(e));
      }
    }
  };

  document.getElementById('btn-google-signin')?.addEventListener('click', () => handleGoogle('signin-feedback'));
  document.getElementById('btn-google-signup')?.addEventListener('click', () => handleGoogle('signup-feedback'));

  // ── Password reset ──
  document.getElementById('btn-reset')?.addEventListener('click', async () => {
    clearFeedback();
    const email = document.getElementById('forgot-email')?.value.trim();
    if (!email) {
      setFeedback('forgot-feedback', 'Please enter your email address.');
      return;
    }

    setLoading('btn-reset', true);
    try {
      await firebaseSendPasswordReset(email);
      setFeedback('forgot-feedback', 'Reset link sent! Check your inbox.', false);
    } catch (e) {
      setFeedback('forgot-feedback', friendlyError(e));
    } finally {
      setLoading('btn-reset', false);
    }
  });

  // ── Enter-key submission ──
  document.getElementById('signin-pass')?.addEventListener('keydown', e => {
    if (e.key === 'Enter') document.getElementById('btn-signin')?.click();
  });
  document.getElementById('signup-pass')?.addEventListener('keydown', e => {
    if (e.key === 'Enter') document.getElementById('btn-signup')?.click();
  });
  document.getElementById('forgot-email')?.addEventListener('keydown', e => {
    if (e.key === 'Enter') document.getElementById('btn-reset')?.click();
  });
}

// ── Lifecycle ───────────────────────────────────────────────
export function mount(container, _params = {}) {
  // Hide sidebar + topnav on the auth page
  document.getElementById('nav-sidebar')?.classList.add('auth-hidden');
  document.getElementById('topnav')?.classList.add('auth-hidden');
  document.querySelector('.main-content')?.classList.add('auth-fullscreen');
  container.classList.add('page-container--auth');

  rootElem = render();
  container.replaceChildren(rootElem);
  bindEvents();
}

export function unmount() {
  // Restore sidebar + topnav when leaving the auth page
  document.getElementById('nav-sidebar')?.classList.remove('auth-hidden');
  document.getElementById('topnav')?.classList.remove('auth-hidden');
  document.querySelector('.main-content')?.classList.remove('auth-fullscreen');
  document.getElementById('page-content')?.classList.remove('page-container--auth');

  if (rootElem?.parentNode) rootElem.parentNode.removeChild(rootElem);
  rootElem = null;
}
