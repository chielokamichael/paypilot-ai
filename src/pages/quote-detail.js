// src/pages/quote-detail.js
/**
 * PayPilot AI — Quote Review & Scope Audit Page
 *
 * Displays full quotation details, AI Scope Guard verification,
 * milestones, deliverable line items, and payment actions.
 */

import { getState, upsertQuote, upsertPayment, subscribe } from '../state/store.js';
import { formatCurrency, quoteStatusBadge, quoteStatusLabel } from '../utils/format.js';
import { toast } from '../components/toast.js';
import { createV6Order } from '../services/paypal.v6.js';
import { savePublicInvoice, encodeInvoicePayload } from '../services/firebaseSync.js';
import { downloadTransactionPdf } from '../services/pdfExport.js';

let rootElem = null;
let currentQuote = null;
let unsubscribeQuotes = null;

function loadQuote(id) {
  const { quotes } = getState();
  currentQuote = quotes.find(q => q.id === id);
  if (!currentQuote) {
    location.hash = '#route/overview';
    return false;
  }
  return true;
}

function render() {
  const container = document.createElement('div');
  container.className = 'quote-detail-page';

  const { clientName, clientEmail, projectTitle, description, lineItems, status, milestones, assumptions, exclusions } = currentQuote;
  const { settings } = getState();
  const currency = settings.currency || 'USD';

  const lineRows = (lineItems || []).map((li, i) => `
    <tr class="${i % 2 === 0 ? 'row-even' : 'row-odd'}">
      <td style="font-weight: 500;">
        ${li.description}
        <small style="display: block; color: var(--color-ink-3); font-size: 11px;">${li.quantity} ${li.unit || 'units'} &times; ${formatCurrency(li.rate, currency)}</small>
      </td>
      <td class="num">${li.quantity}</td>
      <td class="num">${formatCurrency(li.rate, currency)}</td>
      <td class="num" style="font-family: var(--font-mono); font-weight: 600;">${formatCurrency(li.quantity * li.rate, currency)}</td>
    </tr>`).join('');

  const subtotal = (lineItems || []).reduce((s, li) => s + (li.quantity * li.rate), 0);

  // Milestone list
  const milestoneList = (milestones && milestones.length > 0)
    ? milestones.map((m, idx) => `
        <div style="display: flex; align-items: flex-start; gap: 8px; margin-bottom: 6px;">
          <span style="display: inline-block; width: 18px; height: 18px; border-radius: 50%; background: var(--color-accent-light); color: var(--color-accent); font-size: 11px; font-weight: 700; text-align: center; line-height: 18px; flex-shrink: 0;">${idx + 1}</span>
          <span style="font-size: var(--text-xs); color: var(--color-ink);">${m.name || m.description}</span>
        </div>
      `).join('')
    : `
      <div style="display: flex; align-items: flex-start; gap: 8px; margin-bottom: 6px;">
        <span style="display: inline-block; width: 18px; height: 18px; border-radius: 50%; background: var(--color-accent-light); color: var(--color-accent); font-size: 11px; font-weight: 700; text-align: center; line-height: 18px; flex-shrink: 0;">1</span>
        <span style="font-size: var(--text-xs); color: var(--color-ink);">Scope Initiation &amp; Core Deliverables Execution</span>
      </div>
      <div style="display: flex; align-items: flex-start; gap: 8px;">
        <span style="display: inline-block; width: 18px; height: 18px; border-radius: 50%; background: var(--color-accent-light); color: var(--color-accent); font-size: 11px; font-weight: 700; text-align: center; line-height: 18px; flex-shrink: 0;">2</span>
        <span style="font-size: var(--text-xs); color: var(--color-ink);">Final Acceptance &amp; Production Handover</span>
      </div>
    `;

  const exclusionText = (exclusions && exclusions.length > 0)
    ? exclusions.join(' • ')
    : 'Third-party infrastructure fees, ongoing hosting, and additional scope revisions outside agreed deliverables.';

  container.innerHTML = `
    <!-- Top backlink and status -->
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--space-5);" data-print-hide>
      <a href="#route/quotes" class="btn btn-ghost btn-sm" style="display: inline-flex; align-items: center; gap: 6px; padding-left: 0;">
        &larr; All Quotes
      </a>
      <div style="display: flex; gap: var(--space-3);">
        <button id="btn-print" class="btn btn-secondary btn-sm" type="button" style="display: inline-flex; align-items: center; gap: 6px;">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5M12 15V3"/></svg>
          Download PDF
        </button>
        ${status !== 'paid' ? `<button id="btn-copy-link" class="btn btn-secondary btn-sm" type="button" style="display: inline-flex; align-items: center; gap: 6px;">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
          Copy Client Checkout Link
        </button>` : ''}
      </div>
    </div>

    <!-- AI Scope Guard Card -->
    <div class="ai-scope-card">
      <div class="ai-scope-card__header">
        <div style="display: flex; align-items: center; gap: 8px;">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--color-accent)" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
          <strong style="color: var(--color-ink); font-size: var(--text-sm);">Scope review</strong>
        </div>
        <span class="ai-scope-badge">Review before sharing</span>
      </div>
      <p style="font-size: var(--text-xs); color: var(--color-ink-2); margin-bottom: var(--space-3); line-height: 1.5;">
        AI-generated quote details are a draft, not a verification or guarantee. Review the milestones, deliverables, and exclusions with your client.
      </p>
      <div class="ai-scope-grid">
        <div class="ai-scope-item">
          <strong>Project Milestones</strong>
          ${milestoneList}
        </div>
        <div class="ai-scope-item">
          <strong>Scope Limits &amp; Exclusions</strong>
          <p style="margin: 0; line-height: 1.4; color: var(--color-ink-2);">${exclusionText}</p>
        </div>
      </div>
    </div>

    <!-- Quote Document Card -->
    <section class="section">
      <div class="section__header" style="display: flex; justify-content: space-between; align-items: center; padding-bottom: var(--space-3); border-bottom: 1px solid var(--color-border);">
        <div>
          <span class="dashboard-kicker">PROJECT QUOTATION</span>
          <h2 class="section__title" style="margin: 0; font-size: var(--text-lg);">Quote #${currentQuote.id}</h2>
        </div>
        <span class="badge ${quoteStatusBadge(status)}">${quoteStatusLabel(status)}</span>
      </div>

      <div class="section__content" style="background: var(--color-surface); padding: var(--space-6); border: 1px solid var(--color-border); border-radius: 0 0 var(--radius-lg) var(--radius-lg);">
        
        <div class="quote-parties">
          <div>
            <span style="color: var(--color-ink-3); text-transform: uppercase; font-weight: 600; display: block; margin-bottom: 2px;">Client</span>
            <strong style="color: var(--color-ink); font-size: var(--text-sm); display: block;">${clientName}</strong>
            <span style="color: var(--color-ink-2);">${clientEmail}</span>
          </div>
          <div>
            <span style="color: var(--color-ink-3); text-transform: uppercase; font-weight: 600; display: block; margin-bottom: 2px;">Project</span>
            <strong style="color: var(--color-ink); font-size: var(--text-sm); display: block;">${projectTitle}</strong>
            <span style="color: var(--color-ink-2);">${description || ''}</span>
          </div>
        </div>

        <div class="table-scroll" style="margin-bottom: var(--space-4);">
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
              ${lineRows}
              <tr class="summary-row" style="border-top: 2px solid var(--color-border-strong);">
                <td colspan="3" class="num"><strong style="font-size: var(--text-base);">Total Balance Due</strong></td>
                <td class="num"><strong style="font-family: var(--font-mono); font-size: var(--text-lg); color: var(--color-accent);">${formatCurrency(subtotal, currency)}</strong></td>
              </tr>
            </tbody>
          </table>
        </div>

        ${status !== 'paid' ? `<div class="actions" style="margin-top: var(--space-6); display: flex; gap: var(--space-3);" data-print-hide>
          <button id="btn-approve" class="btn btn-secondary btn-sm" ${status === 'approved' ? 'disabled' : ''}>
            ${status === 'approved' ? '✓ Quote Approved' : 'Approve Quote'}
          </button>
          <button id="btn-pay" class="btn btn-primary btn-sm">
            Request Payment from ${clientName} &rarr;
          </button>
        </div>` : '<p class="badge badge-success" style="margin-top: var(--space-6);">Demo checkout complete · no funds transferred</p>'}

      </div>
    </section>
  `;
  return container;
}

function bindEvents() {
  document.getElementById('btn-print')?.addEventListener('click', async event => {
    const button = event.currentTarget;
    const label = button.innerHTML;
    button.disabled = true;
    button.textContent = 'Preparing PDF...';
    try {
      const { settings } = getState();
      await downloadTransactionPdf({ type: 'quote', quote: currentQuote, settings });
      toast.success('Quote PDF downloaded. Check your Downloads or Files app.');
    } catch (err) {
      console.error('Could not generate quote PDF:', err);
      toast.error('Could not create the PDF. Try opening the app in Chrome or Safari.');
    } finally {
      button.innerHTML = label;
      button.disabled = false;
    }
  });

  document.getElementById('btn-copy-link')?.addEventListener('click', async () => {
    const { settings } = getState();
    const currency = settings.currency || 'USD';
    const amount = currentQuote.lineItems.reduce((s, li) => s + (li.quantity * li.rate), 0);
    const merchantName = settings.businessName || 'Freelance Professional';
    const payoutEmail = settings.paypalPayoutEmail || settings.businessEmail || 'merchant@paypilot.ai';

    // Create PayPal order placeholder if not already created
    const { orderId } = await createV6Order({ amount, currency, quoteId: currentQuote.id });

    const invoicePayload = {
      orderId,
      quoteId: currentQuote.id,
      amount,
      currency,
      status: 'awaiting_approval',
      clientName: currentQuote.clientName,
      clientEmail: currentQuote.clientEmail,
      projectTitle: currentQuote.projectTitle,
      lineItems: currentQuote.lineItems || [],
      milestones: currentQuote.milestones || [],
      assumptions: currentQuote.assumptions || [],
      exclusions: currentQuote.exclusions || [],
      merchantName,
      payoutEmail,
      createdAt: new Date().toISOString(),
    };

    try {
      await savePublicInvoice(orderId, invoicePayload);
    } catch {
      toast.error('Could not save the invoice to Firestore. Check the Firebase rules and try again.');
      return;
    }

    const payment = {
      id: orderId,
      quoteId: currentQuote.id,
      amount,
      currency,
      status: 'awaiting_approval',
      payerEmail: '',
      createdAt: new Date().toISOString(),
    };
    upsertPayment(payment);

    const encoded = encodeInvoicePayload(invoicePayload);
    const clientUrl = `${window.location.origin}${window.location.pathname}#route/checkout/${orderId}?inv=${encoded}`;
    try {
      await navigator.clipboard.writeText(clientUrl);
      toast.success('Universal client checkout link copied to clipboard!');
    } catch {
      prompt('Copy this client payment link:', clientUrl);
    }
  });

  document.getElementById('btn-approve')?.addEventListener('click', () => {
    currentQuote.status = 'approved';
    currentQuote.updatedAt = new Date().toISOString();
    upsertQuote(currentQuote);
    toast.success('Quote approved.');
    const approveBtn = document.getElementById('btn-approve');
    if (approveBtn) {
      approveBtn.disabled = true;
      approveBtn.textContent = '✓ Quote Approved';
    }
  });

  document.getElementById('btn-pay')?.addEventListener('click', () => {
    location.hash = `#route/pay/${currentQuote.id}`;
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
  unsubscribeQuotes = subscribe('quotes', state => {
    const updatedQuote = state.quotes.find(quote => quote.id === params.id);
    if (!updatedQuote || updatedQuote === currentQuote) return;
    currentQuote = updatedQuote;
    const updatedPage = render();
    rootElem?.replaceWith(updatedPage);
    rootElem = updatedPage;
    bindEvents();
  });
}

export function unmount() {
  unsubscribeQuotes?.();
  unsubscribeQuotes = null;
  if (rootElem && rootElem.parentNode) {
    rootElem.parentNode.removeChild(rootElem);
  }
  rootElem = null;
}
