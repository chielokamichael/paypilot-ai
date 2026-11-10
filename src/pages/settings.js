// src/pages/settings.js
/**
 * PayPilot AI — Settings Page
 *
 * Configures business settings (rates, currency, default terms)
 * and account management (signed-in user info, sign out, delete account).
 */

import { getState, updateSettings } from '../state/store.js';
import { CURRENCIES } from '../utils/format.js';
import { firebaseSignOut, firebaseDeleteUser } from '../firebase/init.js';
import { showModal, confirmModal } from '../components/modal.js';

let rootElem = null;

function render() {
  const { settings, authUser } = getState();
  const currencyOptions = CURRENCIES.map(currency => `
    <option value="${currency.code}" ${settings.currency === currency.code ? 'selected' : ''}>${currency.label} (${currency.code})</option>
  `).join('');

  const providerId = authUser?.providerData?.[0]?.providerId || 'password';
  const providerLabel = providerId.includes('google') ? 'Google Account' : 'Email / Password';

  const page = document.createElement('div');
  page.className = 'settings-page';
  page.innerHTML = `
    <header class="page-header" style="margin-bottom: var(--space-6);">
      <div>
        <p class="dashboard-kicker">CONFIGURATION &amp; INVOICING</p>
        <h1 class="page-header__title">Settings</h1>
        <p class="page-header__sub">Configure your business details, sandbox invoice display, and quoting defaults.</p>
      </div>
    </header>

    <form id="settings-form" style="display: flex; flex-direction: column; gap: var(--space-6);">

      <!-- Account Card -->
      <section class="section" id="account-section">
        <div class="section__header">
          <h2 class="section__title">Account &amp; Security</h2>
        </div>
        <div class="section__content">
          <div class="settings-account-card">
            <div class="settings-account-info">
              <div class="settings-avatar">
                ${(authUser?.displayName || authUser?.email || 'U')[0].toUpperCase()}
              </div>
              <div>
                <strong class="settings-account-name">${authUser?.displayName || 'Freelance Professional'}</strong>
                <p class="settings-account-email">${authUser?.email || 'Not signed in'}</p>
                <span class="badge badge-subtle">${providerLabel}</span>
              </div>
            </div>
            <div class="settings-account-actions">
              <button class="btn btn-secondary btn-sm" id="btn-settings-signout" type="button">
                Sign Out
              </button>
              <button class="btn btn-danger btn-sm" id="btn-settings-delete" type="button">
                Delete Account
              </button>
            </div>
          </div>
        </div>
      </section>

      <!-- Sandbox checkout display settings -->
      <section class="section" id="paypal-section">
        <div class="section__header" style="display: flex; justify-content: space-between; align-items: center;">
          <h2 class="section__title">Payment Demo Settings</h2>
          <span class="badge badge-neutral">Sandbox only</span>
        </div>
        <div class="section__content">
          <p style="color: var(--color-ink-2); font-size: var(--text-xs); margin-bottom: var(--space-4); line-height: 1.5;">
            The current checkout is a simulation. This email is displayed in demo invoices only; no funds are routed or deposited.
          </p>

          <div class="field-group">
            <label class="field-label" for="paypal-payout-email">
              Demo payout email address <span style="color: var(--color-danger);">*</span>
            </label>
            <input 
              class="field-input" 
              id="paypal-payout-email" 
              name="paypalPayoutEmail" 
              type="email" 
              placeholder="e.g. yourname@gmail.com" 
              value="${settings.paypalPayoutEmail || settings.businessEmail || ''}"
              required
            >
            <span class="field__hint">
              Enter an email to display in the sandbox invoice. It is not used to transfer payments.
            </span>
          </div>
        </div>
      </section>

      <!-- AI Quotation Engine (Cleaned up, no developer raw keys needed) -->
      <section class="section" id="ai-section">
        <div class="section__header" style="display: flex; justify-content: space-between; align-items: center;">
          <h2 class="section__title">AI Quotation Engine</h2>
          <span class="badge badge-success">Google Gemini 1.5 Flash Active</span>
        </div>
        <div class="section__content">
          <div style="background: var(--color-surface-alt); padding: var(--space-4); border-radius: var(--radius-md); font-size: var(--text-xs); color: var(--color-ink-2); line-height: 1.5;">
            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px; color: var(--color-ink); font-weight: 600;">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--color-accent)" stroke-width="2.5"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
              <span>Autonomous Brief Parsing &amp; Scope Guard</span>
            </div>
            <p style="margin: 0 0 6px 0;">
              Google Gemini 1.5 Flash automatically converts ambiguous client project briefs into structured line items, deliverable quantities, hourly rates, and milestone timelines.
            </p>
            <p style="margin: 0; color: var(--color-ink-3);">
              The AI Scope Guard actively audits quotes to establish clear deliverables and scope boundaries, preventing payment disputes and unpaid revisions.
            </p>
          </div>
        </div>
      </section>

      <!-- Business Profile & Invoicing Defaults -->
      <section class="section">
        <div class="section__header">
          <h2 class="section__title">Business Profile &amp; Invoice Defaults</h2>
        </div>
        <div class="section__content">
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-4);">
            <div class="field-group">
              <label class="field-label" for="business-name">Business / Freelancer Name</label>
              <input class="field-input" id="business-name" name="businessName" value="${settings.businessName || ''}" required>
            </div>
            <div class="field-group">
              <label class="field-label" for="business-email">Contact Email</label>
              <input class="field-input" id="business-email" name="businessEmail" type="email" value="${settings.businessEmail || ''}" required>
            </div>
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-4);">
            <div class="field-group">
              <label class="field-label" for="business-phone">Business Phone</label>
              <input class="field-input" id="business-phone" name="businessPhone" type="tel" value="${settings.businessPhone || ''}">
            </div>
            <div class="field-group">
              <label class="field-label" for="currency">Default Billing Currency</label>
              <select class="field-input" id="currency" name="currency">${currencyOptions}</select>
            </div>
          </div>

          <div class="field-group">
            <label class="field-label" for="business-address">Business Address</label>
            <input class="field-input" id="business-address" name="businessAddress" value="${settings.businessAddress || ''}">
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: var(--space-4);">
            <div class="field-group">
              <label class="field-label" for="hourly-rate">Default Rate (${settings.currency || 'USD'}/hr)</label>
              <input class="field-input" id="hourly-rate" name="defaultHourlyRate" type="number" min="0" step="0.01" value="${settings.defaultHourlyRate ?? 100}">
            </div>
            <div class="field-group">
              <label class="field-label" for="tax-rate">Default Tax Rate (%)</label>
              <input class="field-input" id="tax-rate" name="taxRate" type="number" min="0" step="0.01" value="${(settings.taxRate ?? 0) * 100}">
            </div>
            <div class="field-group">
              <label class="field-label" for="valid-days">Quote Validity (Days)</label>
              <input class="field-input" id="valid-days" name="quoteValidDays" type="number" min="1" step="1" value="${settings.quoteValidDays ?? 30}">
            </div>
          </div>

          <div class="actions" style="display: flex; align-items: center; gap: 1rem; margin-top: var(--space-6);">
            <button class="btn btn-primary" type="submit">Save Changes</button>
            <span id="settings-saved" role="status" aria-live="polite" style="color: var(--color-success); font-size: var(--text-sm); font-weight: var(--weight-medium);"></span>
          </div>
        </div>
      </section>

    </form>
  `;
  return page;
}

function bindEvents() {
  // Save settings form
  rootElem.querySelector('#settings-form')?.addEventListener('submit', async event => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const statusEl = rootElem.querySelector('#settings-saved');
    const submitButton = event.currentTarget.querySelector('[type="submit"]');
    if (submitButton) submitButton.disabled = true;

    try {
      await updateSettings({
        businessName: formData.get('businessName')?.trim() || '',
        businessEmail: formData.get('businessEmail')?.trim() || '',
        businessAddress: formData.get('businessAddress')?.trim() || '',
        businessPhone: formData.get('businessPhone')?.trim() || '',
        currency: formData.get('currency'),
        defaultHourlyRate: Number(formData.get('defaultHourlyRate')),
        taxRate: Number(formData.get('taxRate')) / 100,
        quoteValidDays: Number(formData.get('quoteValidDays')),
        geminiApiKey: formData.get('geminiApiKey')?.trim() || getState().settings.geminiApiKey || '',
        paypalClientId: formData.get('paypalClientId')?.trim() || getState().settings.paypalClientId || '',
        paypalPayoutEmail: formData.get('paypalPayoutEmail')?.trim() || '',
      });

      if (statusEl) {
        statusEl.style.color = 'var(--color-success)';
        statusEl.textContent = 'Settings saved successfully';
        setTimeout(() => { if (statusEl) statusEl.textContent = ''; }, 3000);
      }
    } catch (err) {
      console.error('Settings save failed:', err);
      if (statusEl) {
        statusEl.style.color = 'var(--color-danger)';
        statusEl.textContent = 'Saved on this device, but cloud sync failed. Please try again.';
      }
    } finally {
      if (submitButton) submitButton.disabled = false;
    }
  });

  // Sign out button
  rootElem.querySelector('#btn-settings-signout')?.addEventListener('click', async () => {
    try {
      await firebaseSignOut();
    } catch (err) {
      showModal({
        title: 'Error',
        body: `<p>${err.message}</p>`,
        actions: [{ label: 'Ok', value: 'close', className: 'btn-primary' }],
      });
    }
  });

  // Delete account button
  rootElem.querySelector('#btn-settings-delete')?.addEventListener('click', async () => {
    const confirmed = await confirmModal({
      title: 'Delete Account',
      body: 'Are you sure you want to permanently delete your account? This action cannot be undone.',
      confirmLabel: 'Delete Forever',
      confirmClass: 'btn-danger',
    });

    if (!confirmed) return;

    try {
      await firebaseDeleteUser();
      await showModal({
        title: 'Account Deleted',
        body: '<p>Your account has been deleted.</p>',
        actions: [{ label: 'Ok', value: 'close', className: 'btn-primary' }],
      });
      location.reload();
    } catch (err) {
      showModal({
        title: 'Delete Failed',
        body: `<p>${err.message}</p><p style="margin-top:8px; font-size: 13px; color: var(--color-ink-3);">If you signed in long ago, please sign out and sign in again before deleting your account for security.</p>`,
        actions: [{ label: 'Ok', value: 'close', className: 'btn-primary' }],
      });
    }
  });
}

export function mount(container) {
  rootElem = render();
  container.replaceChildren(rootElem);
  bindEvents();
}

export function unmount() {
  rootElem?.remove();
  rootElem = null;
}
