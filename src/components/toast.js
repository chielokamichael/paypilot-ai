/**
 * PayPilot AI — Toast Notification Component
 *
 * Shows brief, non-blocking feedback messages.
 *
 * Usage:
 *   import { toast } from './toast.js';
 *   toast.success('Quote saved.');
 *   toast.error('Please fill in all required fields.');
 *   toast.info('Generating AI draft…');
 */

// Get or create the container element
function getContainer() {
  let el = document.getElementById('toast-container');
  if (!el) {
    el = document.createElement('div');
    el.id = 'toast-container';
    document.body.appendChild(el);
  }
  return el;
}

/**
 * Show a toast.
 * @param {string} message - The text to display
 * @param {'default'|'success'|'error'|'warning'} type - Visual variant
 * @param {number} duration - Milliseconds before auto-dismiss (0 = never)
 */
function show(message, type = 'default', duration = 4000) {
  const container = getContainer();

  // Icon per type
  const icons = {
    default: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`,
    success: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>`,
    error:   `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`,
    warning: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
  };

  const el = document.createElement('div');
  el.className = `toast toast--${type}`;
  el.innerHTML = `${icons[type] ?? icons.default}<span>${message}</span>`;

  container.appendChild(el);

  // Auto-dismiss
  if (duration > 0) {
    setTimeout(() => dismiss(el), duration);
  }

  return el;
}

function dismiss(el) {
  if (!el || !el.parentNode) return;
  el.classList.add('is-leaving');
  el.addEventListener('animationend', () => el.remove(), { once: true });
  // Fallback removal
  setTimeout(() => el.remove(), 500);
}

export const toast = {
  success: (msg, duration) => show(msg, 'success', duration),
  error:   (msg, duration) => show(msg, 'error',   duration),
  warning: (msg, duration) => show(msg, 'warning', duration),
  info:    (msg, duration) => show(msg, 'default', duration),
};
