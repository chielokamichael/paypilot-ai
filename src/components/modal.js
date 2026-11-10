/**
 * PayPilot AI — Modal Component
 *
 * A reusable confirmation / alert modal.
 *
 * Usage:
 *   import { showModal, confirmModal } from './modal.js';
 *
 *   // Simple confirm
 *   const confirmed = await confirmModal({
 *     title: 'Delete line item',
 *     body:  'This cannot be undone.',
 *     confirmLabel: 'Delete',
 *     confirmClass: 'btn-danger',
 *   });
 */

const CLOSE_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
</svg>`;

/**
 * Show a custom modal.
 * @param {object} options
 * @param {string} options.title
 * @param {string} options.body  - HTML string for the body
 * @param {Array<{label, className, value}>} options.actions - button definitions
 * @returns {Promise<string>} the `value` of the button clicked, or 'close'
 */
export function showModal({ title, body, actions = [] }) {
  return new Promise(resolve => {
    const backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop';

    backdrop.innerHTML = `
      <div class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">
        <div class="modal__header">
          <h2 class="modal__title" id="modal-title">${title}</h2>
          <button class="btn-ghost modal__close" aria-label="Close modal" data-action="close">
            ${CLOSE_ICON}
          </button>
        </div>
        <div class="modal__body">${body}</div>
        ${actions.length ? `
          <div class="modal__footer">
            ${actions.map(a =>
              `<button class="btn ${a.className || 'btn-secondary'}" data-action="${a.value}">${a.label}</button>`
            ).join('')}
          </div>
        ` : ''}
      </div>
    `;

    document.body.appendChild(backdrop);

    // Trap focus inside modal
    const firstFocusable = backdrop.querySelector('button');
    firstFocusable?.focus();

    function close(value) {
      backdrop.remove();
      resolve(value);
    }

    // Button clicks
    backdrop.addEventListener('click', e => {
      const action = e.target.closest('[data-action]')?.dataset.action;
      if (action) close(action);
    });

    // Backdrop click closes
    backdrop.addEventListener('click', e => {
      if (e.target === backdrop) close('close');
    });

    // Escape key
    const onKeydown = e => {
      if (e.key === 'Escape') { document.removeEventListener('keydown', onKeydown); close('close'); }
    };
    document.addEventListener('keydown', onKeydown);
  });
}

/**
 * Convenience wrapper for a two-button confirm/cancel modal.
 * @returns {Promise<boolean>} true if confirmed, false otherwise
 */
export async function confirmModal({
  title,
  body,
  confirmLabel = 'Confirm',
  cancelLabel  = 'Cancel',
  confirmClass = 'btn-primary',
}) {
  const result = await showModal({
    title,
    body,
    actions: [
      { label: cancelLabel,  className: 'btn-secondary', value: 'cancel'  },
      { label: confirmLabel, className: confirmClass,    value: 'confirm' },
    ],
  });
  return result === 'confirm';
}
