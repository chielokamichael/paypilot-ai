// src/pages/payment-request.js
/**
 * PayPilot AI — Send Payment Request to Client
 *
 * Allows the freelancer to review payment request settings, verify
 * payout routing destination, and generate a client payment link.
 */

import { getQuoteById, getState, upsertPayment, upsertQuote, subscribe } from '../state/store.js';
import { formatCurrency, CURRENCIES } from '../utils/format.js';
import { createV6Order as createOrder } from '../services/paypal.v6.js';
import { toast } from '../components/toast.js';
import { savePublicInvoice, encodeInvoicePayload, subscribeToPublicInvoice } from '../services/firebaseSync.js';

let rootElem = null;
let quote = null;
let generatedOrderId = null;
let unsubscribePayments = null;
let unsubscribeInvoice = null;
let lastObservedPaymentStatus = null;

function refreshGeneratedPaymentStatus() {
  const statusEl = document.getElementById('payment-link-status');
  if (!statusEl || !generatedOrderId) return;
  const payment = getState().payments.find(item => item.id === generatedOrderId);
  if (!payment) return;

  const isPaid = payment.status === 'captured_simulation' || payment.status === 'captured';
  const title = statusEl.querySelector('[data-payment-link-title]');
  const detail = statusEl.querySelector('[data-payment-link-detail]');
  statusEl.classList.toggle('is-complete', isPaid);

  if (title) title.textContent = isPaid ? 'Checkout complete' : 'Waiting for client';
  if (detail) {
    detail.textContent = isPaid
      ? `Demo checkout only — no funds were transferred.${payment.payerEmail ? ` Client: ${payment.payerEmail}.` : ''}`
      : 'This page will update automatically when the client finishes checkout.';
  }

  if (isPaid && lastObservedPaymentStatus !== 'captured_simulation' && lastObservedPaymentStatus !== 'captured') {
    toast.success('The client checkout status has updated.');
  }
  lastObservedPaymentStatus = payment.status;
}

function loadQuote(id) {
  quote = getQuoteById(id);
  if (!quote) {
    location.hash = '#route/overview';
    return false;
  }
  return true;
}

function render() {
  const container = document.createElement('div');
  container.className = 'payment-request-page';

  const { clientName, clientEmail, projectTitle, description, lineItems } = quote;
  const { settings } = getState();
  const currency = settings.currency || 'USD';
  const subtotal = lineItems.reduce((s, li) => s + (li.quantity * li.rate), 0);
  const payoutEmail = settings.paypalPayoutEmail || settings.businessEmail || 'merchant@paypilot.ai';

  // Build the line‑item rows for display
  const rows = lineItems.map((li, i) => `
    <tr class="${i % 2 === 0 ? 'row-even' : 'row-odd'}">
      <td style="font-weight: 500;">${li.description}</td>
      <td class="num">${li.quantity}</td>
      <td class="num">${formatCurrency(li.rate, currency)}</td>
      <td class="num" style="font-family: var(--font-mono); font-weight: 600;">${formatCurrency(li.quantity * li.rate, currency)}</td>
    </tr>`).join('');

  // Currency selector
  const currencyOptions = CURRENCIES.map(c => `
    <option value="${c.code}" ${c.code === currency ? 'selected' : ''}>${c.label} (${c.code})</option>`).join('');

  container.innerHTML = `
    <!-- Top Nav Backlink -->
    <div style="margin-bottom: var(--space-4);">
      <a href="#route/quote/${quote.id}" class="btn btn-ghost btn-sm" style="display: inline-flex; align-items: center; gap: 6px; padding: 0;">
        &larr; Back to Quote #${quote.id}
      </a>
    </div>

    <header class="page-header" style="margin-bottom: var(--space-6);">
      <div>
        <p class="dashboard-kicker">INVOICE &amp; PAYMENT COLLECTION</p>
        <h1 class="page-header__title">Create a payment link</h1>
        <p class="page-header__sub">Create a shareable sandbox checkout link for Quote #${quote.id}. No real payment is processed and no funds are transferred.</p>
      </div>
    </header>

    <div class="payment-request-layout">
      
      <!-- Left: Invoice Summary -->
      <section class="section" style="background: var(--color-surface); border: 1px solid var(--color-border); border-radius: var(--radius-lg); padding: var(--space-6);">
        
        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: var(--space-5); padding-bottom: var(--space-4); border-bottom: 1px solid var(--color-border);">
          <div>
            <strong style="font-size: var(--text-base); color: var(--color-ink); display: block;">${projectTitle}</strong>
            <span style="font-size: var(--text-xs); color: var(--color-ink-3);">Quote #${quote.id} &bull; ${new Date().toLocaleDateString()}</span>
          </div>
          <span class="badge badge-neutral">Ready to Send</span>
        </div>

        <!-- Recipient & Payout Info -->
        <div class="payment-request-parties">
          <div>
            <span style="color: var(--color-ink-3); text-transform: uppercase; font-weight: 600; display: block; margin-bottom: 2px;">Client (Payer)</span>
            <strong style="color: var(--color-ink); font-size: var(--text-sm); display: block;">${clientName}</strong>
            <span style="color: var(--color-ink-2);">${clientEmail}</span>
          </div>
          <div>
            <span style="color: var(--color-ink-3); text-transform: uppercase; font-weight: 600; display: block; margin-bottom: 2px;">Configured payout email</span>
            <strong style="color: var(--color-ink); font-size: var(--text-sm); display: block;">Demo display only</strong>
            <span style="color: var(--color-accent); font-weight: 500;">${payoutEmail}</span>
            <small style="display: block; margin-top: 4px; color: var(--color-ink-3);">No funds are transferred in this demo.</small>
          </div>
        </div>

        <div class="table-scroll">
          <table class="quote-table">
            <thead>
              <tr>
                <th>Description</th>
                <th class="num">Qty</th>
                <th class="num">Rate</th>
                <th class="num">Amount</th>
              </tr>
            </thead>
            <tbody>
              ${rows}
              <tr class="summary-row" style="border-top: 2px solid var(--color-border-strong);">
                <td colspan="3" class="num"><strong style="font-size: var(--text-base);">Total Billing Amount</strong></td>
                <td class="num"><strong style="font-family: var(--font-mono); font-size: var(--text-lg); color: var(--color-accent);">${formatCurrency(subtotal, currency)}</strong></td>
              </tr>
            </tbody>
          </table>
        </div>

      </section>

      <!-- Right: Action Card -->
      <aside class="section" style="background: var(--color-surface); border: 1px solid var(--color-border); border-radius: var(--radius-lg); padding: var(--space-6);">
        
        <h3 style="font-size: var(--text-base); font-weight: var(--weight-bold); margin-bottom: var(--space-2); color: var(--color-ink);">Generate Payment Link</h3>
        <p style="font-size: var(--text-xs); color: var(--color-ink-2); margin-bottom: var(--space-5); line-height: 1.5;">
          Generate a sandbox checkout link to share with <strong>${clientName}</strong>. Checkout is simulated; your payout details are display-only.
        </p>

        <div class="field-group" style="margin-bottom: var(--space-5);">
          <label for="currency-select" class="field-label">Billing Currency</label>
          <select id="currency-select" class="field-input">${currencyOptions}</select>
        </div>

        <button id="btn-generate-link" class="btn btn-primary btn-block" type="button" style="display: flex; align-items: center; justify-content: center; gap: 8px;">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
          <span>Generate Sandbox Checkout Link &rarr;</span>
        </button>

        <!-- Result Card (shown after clicking) -->
        <div id="payment-link-result" style="display: none; margin-top: var(--space-6); padding-top: var(--space-5); border-top: 1px solid var(--color-border);">
          <div style="display: flex; align-items: center; gap: 8px; margin-bottom: var(--space-3); color: var(--color-accent);">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
            <strong style="font-size: var(--text-sm);">Link Ready for Client</strong>
          </div>

          <p style="font-size: var(--text-xs); color: var(--color-ink-2); margin-bottom: var(--space-3);">
            Share this link with <strong>${clientName}</strong> so they can review the invoice and try the sandbox checkout:
          </p>

          <div class="payment-link-copy">
            <input id="input-client-url" class="field-input" readonly style="font-size: 11px; font-family: var(--font-mono); background: var(--color-surface-alt);" />
            <button id="btn-copy-url" class="btn btn-secondary btn-sm" type="button" style="flex-shrink: 0;">Copy</button>
          </div>

          <div id="payment-link-status" class="payment-link-status" role="status" aria-live="polite">
            <span class="payment-link-status__mark" aria-hidden="true"></span>
            <span><strong data-payment-link-title>Waiting for client</strong><small data-payment-link-detail>This page will update automatically when the client finishes checkout.</small></span>
          </div>

          <div style="display: flex; flex-direction: column; gap: var(--space-2);">
            <a id="btn-email-client" href="#" class="btn btn-secondary btn-sm btn-block" style="display: flex; align-items: center; justify-content: center; gap: 6px;">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
              <span>Email Invoice to ${clientEmail}</span>
            </a>

            <button id="btn-preview-portal" class="btn btn-ghost btn-sm btn-block" type="button" style="font-size: var(--text-xs);">
              Preview Client Checkout Page &rarr;
            </button>
          </div>
        </div>

      </aside>

    </div>
  `;
  return container;
}

function bindEvents() {
  const currencyEl = document.getElementById('currency-select');
  const generateBtn = document.getElementById('btn-generate-link');
  const resultBox = document.getElementById('payment-link-result');
  const urlInput = document.getElementById('input-client-url');
  const copyBtn = document.getElementById('btn-copy-url');
  const emailBtn = document.getElementById('btn-email-client');
  const previewBtn = document.getElementById('btn-preview-portal');

  generateBtn?.addEventListener('click', async () => {
    generateBtn.disabled = true;
    generateBtn.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px;animation:spin 1s linear infinite"><circle cx="12" cy="12" r="10" stroke-opacity="0.25"/><path d="M12 2a10 10 0 0 1 10 10"/></svg>
      Preparing checkout link...
    `;

    const amount = quote.lineItems.reduce((s, li) => s + (li.quantity * li.rate), 0);
    const currency = currencyEl.value;

    // Create PayPal order
    let orderId;
    try {
      ({ orderId } = await createOrder({ amount, currency, quoteId: quote.id }));
    } catch (error) {
      console.error('Could not create checkout link:', error);
      toast.error('Could not create the payment link. Please try again.');
      generateBtn.disabled = false;
      generateBtn.innerHTML = 'Generate Sandbox Checkout Link &rarr;';
      return;
    }
    generatedOrderId = orderId;
    lastObservedPaymentStatus = null;

    const { settings, authUser } = getState();
    const merchantName = settings.businessName || 'Freelance Professional';
    const payoutEmail = settings.paypalPayoutEmail || settings.businessEmail || 'merchant@paypilot.ai';

    const invoicePayload = {
      orderId,
      quoteId: quote.id,
      amount,
      currency,
      status: 'awaiting_approval',
      clientName: quote.clientName,
      clientEmail: quote.clientEmail,
      projectTitle: quote.projectTitle,
      lineItems: quote.lineItems || [],
      milestones: quote.milestones || [],
      assumptions: quote.assumptions || [],
      exclusions: quote.exclusions || [],
      merchantName,
      payoutEmail,
      ownerUid: authUser?.uid || null,
      createdAt: new Date().toISOString(),
    };

    // Save the shared invoice before exposing a link that depends on Firestore.
    try {
      await savePublicInvoice(orderId, invoicePayload);
    } catch {
      toast.error('Could not save the invoice to Firestore. Check the Firebase rules and try again.');
      generateBtn.disabled = false;
      generateBtn.innerHTML = 'Generate Sandbox Checkout Link &rarr;';
      return;
    }

    const payment = {
      id: orderId,
      quoteId: quote.id,
      amount,
      currency,
      status: 'awaiting_approval',
      payerEmail: '',
      createdAt: new Date().toISOString(),
    };
    upsertPayment(payment);
    unsubscribeInvoice?.();
    unsubscribeInvoice = subscribeToPublicInvoice(orderId, invoice => {
      if (invoice.ownerUid !== getState().authUser?.uid) return;
      const currentPayment = getState().payments.find(item => item.id === orderId);
      if (!currentPayment || !invoice.status) return;

      upsertPayment({
        ...currentPayment,
        status: invoice.status,
        transactionId: invoice.transactionId,
        payerEmail: invoice.payerEmail,
        capturedAt: invoice.capturedAt,
      });

      if (invoice.status === 'captured_simulation' || invoice.status === 'captured') {
        const currentQuote = getQuoteById(quote.id);
        if (currentQuote && currentQuote.status !== 'paid') {
          upsertQuote({ ...currentQuote, status: 'paid', updatedAt: invoice.capturedAt || new Date().toISOString() });
        }
      }
    });

    upsertQuote({ ...quote, status: 'payment_link_created', updatedAt: new Date().toISOString() });

    // Generate universal cross-browser link with fallback payload
    const encoded = encodeInvoicePayload(invoicePayload);
    const clientUrl = `${window.location.origin}${window.location.pathname}#route/checkout/${orderId}?client=1&inv=${encoded}`;
    if (urlInput) urlInput.value = clientUrl;

    // Configure email link
    if (emailBtn) {
      const subject = encodeURIComponent(`Invoice & Payment Request for ${quote.projectTitle}`);
      const body = encodeURIComponent(
        `Hi ${quote.clientName},\n\nHere is your project quotation and sandbox checkout link for "${quote.projectTitle}".\n\nQuoted total: ${formatCurrency(amount, currency)}\n\nYou can review the deliverables and try the checkout demo here:\n${clientUrl}\n\nNote: this demo simulates checkout only. No real payment will be processed and no funds will be transferred.\n\nBest regards,\n${merchantName}`
      );
      emailBtn.href = `mailto:${quote.clientEmail}?subject=${subject}&body=${body}`;
    }

    if (resultBox) resultBox.style.display = 'block';
    refreshGeneratedPaymentStatus();
    toast.success(`Payment link created for ${quote.clientName}!`);

    generateBtn.disabled = false;
    generateBtn.innerHTML = `✓ Link Generated`;
  });

  copyBtn?.addEventListener('click', async () => {
    if (!urlInput?.value) return;
    try {
      await navigator.clipboard.writeText(urlInput.value);
      toast.success('Client payment link copied to clipboard!');
    } catch {
      urlInput.select();
      document.execCommand('copy');
      toast.success('Link copied!');
    }
  });

  previewBtn?.addEventListener('click', () => {
    const clientHash = urlInput?.value.split('#')[1];
    if (generatedOrderId && clientHash) location.hash = clientHash;
  });
}

export function mount(container, params = {}) {
  if (!params.id) {
    location.hash = '#route/overview';
    return;
  }
  if (!loadQuote(params.id)) return;
  rootElem = render();
  container.replaceChildren(rootElem);
  bindEvents();
  unsubscribePayments = subscribe('payments', refreshGeneratedPaymentStatus);
}

export function unmount() {
  if (rootElem && rootElem.parentNode) {
    rootElem.parentNode.removeChild(rootElem);
  }
  unsubscribePayments?.();
  unsubscribeInvoice?.();
  unsubscribePayments = null;
  unsubscribeInvoice = null;
  rootElem = null;
  generatedOrderId = null;
  lastObservedPaymentStatus = null;
}
