// src/pages/payment-result.js
/**
 * PayPilot AI — Payment Result & Itemized Simulation Receipt Page
 *
 * Displays the outcome of a PayPal JavaScript SDK v6 transaction.
 * Features itemized deliverables, printable tax-ready layout,
 * and zero unauthorized access routes for clients.
 */

import { getPaymentById, getQuoteById, getState, upsertPayment, upsertQuote } from '../state/store.js';
import { formatCurrency, paymentStatusBadge, paymentStatusLabel } from '../utils/format.js';
import { fetchPublicInvoice, decodeInvoicePayload } from '../services/firebaseSync.js';
import { downloadTransactionPdf } from '../services/pdfExport.js';
import { toast } from '../components/toast.js';

let rootElem = null;
let payment = null;
let quote = null;

async function loadPayment(id, params = {}) {
  // 1. Try local store
  payment = getPaymentById(id);
  if (payment) {
    quote = getQuoteById(payment.quoteId);
    if (quote) return true;
  }

  // 2. Try URL-encoded payload
  if (params.inv) {
    const decoded = decodeInvoicePayload(params.inv);
    if (decoded) {
      payment = {
        id,
        quoteId: decoded.quoteId || 'INV-001',
        amount: Number(decoded.amount) || 0,
        currency: decoded.currency || 'USD',
        status: decoded.status || 'captured_simulation',
        transactionId: decoded.transactionId || 'TXN-PAYPAL-' + id,
        payerEmail: decoded.payerEmail || decoded.clientEmail || '',
        capturedAt: decoded.capturedAt || new Date().toISOString(),
        sdkVersion: 'v6',
        merchantName: decoded.merchantName,
        payoutEmail: decoded.payoutEmail,
      };
      quote = {
        id: decoded.quoteId || 'INV-001',
        clientName: decoded.clientName,
        clientEmail: decoded.clientEmail,
        projectTitle: decoded.projectTitle,
        lineItems: decoded.lineItems || [],
        milestones: decoded.milestones || [],
      };
      upsertPayment(payment);
      upsertQuote(quote);
      return true;
    }
  }

  // 3. Try Firestore public invoice
  try {
    const remote = await fetchPublicInvoice(id);
    if (remote) {
      payment = {
        id,
        quoteId: remote.quoteId || 'INV-001',
        amount: Number(remote.amount) || 0,
        currency: remote.currency || 'USD',
        status: remote.status || 'captured_simulation',
        transactionId: remote.transactionId || 'TXN-PAYPAL-' + id,
        payerEmail: remote.payerEmail || remote.clientEmail || '',
        capturedAt: remote.capturedAt || new Date().toISOString(),
        sdkVersion: 'v6',
        merchantName: remote.merchantName,
        payoutEmail: remote.payoutEmail,
      };
      quote = {
        id: remote.quoteId || 'INV-001',
        clientName: remote.clientName,
        clientEmail: remote.clientEmail,
        projectTitle: remote.projectTitle,
        lineItems: remote.lineItems || [],
        milestones: remote.milestones || [],
      };
      upsertPayment(payment);
      upsertQuote(quote);
      return true;
    }
  } catch (err) {
    console.warn('Firestore fetchPublicInvoice error on receipt:', err);
  }

  return false;
}

function render() {
  const container = document.createElement('div');
  container.className = 'client-portal-wrap';

  const { amount, currency, status, transactionId, capturedAt, payerEmail, sdkVersion } = payment;
  const { authUser, settings } = getState();
  const badgeClass = paymentStatusBadge(status);
  const badgeLabel = paymentStatusLabel(status);

  const merchantName = payment.merchantName || settings.businessName || 'Freelance Professional';
  const payoutEmail = payment.payoutEmail || settings.paypalPayoutEmail || settings.businessEmail || 'merchant@paypilot.ai';

  // Render itemized deliverables in receipt
  const lineRows = (quote?.lineItems || []).map(li => `
    <div style="display: flex; justify-content: space-between; align-items: baseline; padding: 8px 0; border-bottom: 1px dashed var(--color-border); font-size: var(--text-xs);">
      <span style="color: var(--color-ink); font-weight: 500;">
        ${li.description}
        <small style="display: block; color: var(--color-ink-3); margin-top: 2px;">
          ${li.quantity} ${li.unit || 'units'} &times; ${formatCurrency(li.rate, currency)}
        </small>
      </span>
      <strong style="font-family: var(--font-mono); color: var(--color-ink);">${formatCurrency(li.quantity * li.rate, currency)}</strong>
    </div>
  `).join('');

  container.innerHTML = `
    ${authUser ? `
      <!-- Freelancer Preview Alert Bar -->
      <div style="background: linear-gradient(90deg, #063821 0%, #0B4A2E 100%); color: #E8F8F0; padding: 10px 24px; border-bottom: 1px solid rgba(8, 118, 71, 0.4); display: flex; align-items: center; justify-content: space-between; gap: 12px; font-size: var(--text-xs); flex-wrap: wrap;" data-print-hide>
        <div style="display: flex; align-items: center; gap: 8px;">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#25D366" stroke-width="2.5"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
          <span><strong>Freelancer Preview Mode:</strong> This is a simulated checkout receipt. No funds were transferred to your PayPal account (<strong>${payoutEmail}</strong>).</span>
        </div>
        <a href="#route/overview" class="btn btn-ghost btn-sm" style="font-size: 11px; color: #fff; padding: 3px 10px; background: rgba(255,255,255,0.15); border: 1px solid rgba(255,255,255,0.25);">
          &larr; Exit Preview to Dashboard
        </a>
      </div>
    ` : ''}

    <!-- Top Client Portal Header -->
    <header class="client-portal-topbar">
      <div class="client-portal-brand">
        <img src="/favicon.svg" class="client-portal-brand__mark" alt="" aria-hidden="true">
        <div>
          <strong style="color: var(--color-ink); font-size: var(--text-sm); display: block; line-height: 1.2;">PayPilot AI</strong>
          <span style="color: var(--color-ink-3); font-size: 11px;">Simulated Checkout</span>
        </div>
        <span class="client-portal-badge" style="margin-left: var(--space-2);">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
          Simulation only
        </span>
      </div>

      <div class="client-portal-actions">
        <button id="btn-print-receipt" class="btn btn-secondary btn-sm" type="button" style="display: inline-flex; align-items: center; gap: 6px;">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5M12 15V3"/></svg>
          Download Receipt PDF
        </button>
      </div>
    </header>

    <!-- Main Receipt Container -->
    <div class="client-portal-body" style="max-width: 760px;">
      
      <!-- Success Header -->
      <div style="text-align: center; margin-bottom: var(--space-6);">
        <div style="width: 52px; height: 52px; border-radius: 50%; background: var(--color-accent-light); color: var(--color-accent); display: grid; place-items: center; margin: 0 auto var(--space-3);">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
        </div>
        <h1 style="font-size: var(--text-xl); font-weight: var(--weight-bold); color: var(--color-ink); margin-bottom: var(--space-1);">Checkout Simulation Complete</h1>
        <p style="font-size: var(--text-xs); color: var(--color-ink-2); max-width: 500px; margin: 0 auto;">
          This is a demo receipt only. No real payment was authorized, captured, or transferred.
        </p>
      </div>

      <!-- Itemized Simulation Receipt Card -->
      <section class="section" style="background: var(--color-surface); border: 1px solid var(--color-border); border-radius: var(--radius-lg); overflow: hidden; box-shadow: var(--shadow-sm);">
        
        <div style="padding: var(--space-6); border-bottom: 1px solid var(--color-border); display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: var(--space-4);">
          <div>
            <span class="dashboard-kicker">SIMULATED CHECKOUT RECEIPT</span>
            <strong style="display: block; font-size: var(--text-base); color: var(--color-ink); font-family: var(--font-mono); margin-top: 2px;">
              ${transactionId || 'TXN-PAYPAL-' + payment.id}
            </strong>
            <span style="font-size: var(--text-xs); color: var(--color-ink-3);">
              Simulation Date: ${capturedAt ? new Date(capturedAt).toLocaleString() : new Date().toLocaleString()}
            </span>
          </div>

          <span class="badge ${badgeClass}" style="font-size: var(--text-xs); padding: 4px 12px;">
            ${badgeLabel}
          </span>
        </div>

        <div style="padding: var(--space-6);">
          
          <!-- Summary Parties Grid -->
          <div class="receipt-parties">
            <div style="background: var(--color-surface-alt); padding: var(--space-4); border-radius: var(--radius-md);">
              <span style="color: var(--color-ink-3); text-transform: uppercase; font-weight: 600; display: block; margin-bottom: 3px;">Client</span>
              <strong style="color: var(--color-ink); font-size: var(--text-sm); display: block;">${quote?.clientName || 'Valued Client'}</strong>
              <span style="color: var(--color-ink-2);">${payerEmail || quote?.clientEmail || 'Client account'}</span>
            </div>

            <div style="background: var(--color-surface-alt); padding: var(--space-4); border-radius: var(--radius-md);">
              <span style="color: var(--color-ink-3); text-transform: uppercase; font-weight: 600; display: block; margin-bottom: 3px;">Merchant (Freelancer)</span>
              <strong style="color: var(--color-ink); font-size: var(--text-sm); display: block;">${merchantName}</strong>
              <span style="color: var(--color-ink-2);">PayPal: ${payoutEmail}</span>
            </div>
          </div>

          <!-- Project Title & Scope Reference -->
          <div style="margin-bottom: var(--space-4); padding-bottom: var(--space-3); border-bottom: 1px solid var(--color-border);">
            <strong style="font-size: var(--text-sm); color: var(--color-ink); display: block;">${quote?.projectTitle || 'Project Deliverables'}</strong>
            <p style="font-size: var(--text-xs); color: var(--color-ink-2); margin-top: 2px;">Invoice #${payment.quoteId || 'INV-001'}</p>
          </div>

          <!-- Itemized Deliverables Table -->
          <div style="margin-bottom: var(--space-5);">
            <span style="font-size: var(--text-xs); text-transform: uppercase; font-weight: 600; color: var(--color-ink-3); display: block; margin-bottom: var(--space-2);">
              Quoted Deliverables &amp; Scope
            </span>
            <div style="margin-bottom: var(--space-3);">
              ${lineRows || '<p style="font-size: var(--text-xs); color: var(--color-ink-3);">All deliverables outlined in quotation scope.</p>'}
            </div>
          </div>

          <!-- Payment Security Details -->
          <div style="background: var(--color-surface-alt); padding: var(--space-3) var(--space-4); border-radius: var(--radius-md); margin-bottom: var(--space-5); font-size: 11px; color: var(--color-ink-3); display: flex; justify-content: space-between; align-items: center; flex-wrap: gap;">
            <span>Checkout Mode: <strong style="color: var(--color-ink); font-family: var(--font-mono);">${sdkVersion || 'Simulation'}</strong></span>
            <span style="color: var(--color-ink-3); font-weight: 600;">Demo only · No funds transferred</span>
          </div>

          <!-- Total Paid -->
          <div style="display: flex; justify-content: space-between; align-items: baseline; padding-top: var(--space-4); border-top: 2px solid var(--color-border-strong);">
            <div>
              <span style="font-size: var(--text-sm); font-weight: 600; color: var(--color-ink); display: block;">Simulated Amount</span>
              <small style="color: var(--color-ink-3); font-size: 11px;">Not a payment receipt; no funds transferred</small>
            </div>
            <strong style="font-family: var(--font-mono); font-size: 1.625rem; color: var(--color-accent);">${formatCurrency(amount, currency)}</strong>
          </div>

        </div>

        <div style="background: var(--color-surface-alt); padding: var(--space-3) var(--space-6); border-top: 1px solid var(--color-border); display: flex; justify-content: space-between; align-items: center; font-size: 11px; color: var(--color-ink-3);">
          <span>PayPal AI Hackathon 2026 Evaluation Sandbox</span>
          <span>Order Ref: ${payment.id}</span>
        </div>

      </section>

      <!-- Client Safe Actions (NO ADMIN WORKSPACE BUTTONS FOR CLIENTS!) -->
      <div style="display: flex; justify-content: center; gap: var(--space-3); margin-top: var(--space-6);" data-print-hide>
        <button id="btn-print-bottom" class="btn btn-primary btn-sm" type="button" style="display: inline-flex; align-items: center; gap: 6px;">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5M12 15V3"/></svg>
          Download Receipt PDF
        </button>

        ${authUser ? `
          <a href="#route/overview" class="btn btn-ghost btn-sm" style="font-size: var(--text-xs);">
            &larr; Exit Preview
          </a>
        ` : `
          <span style="font-size: var(--text-xs); color: var(--color-ink-3); display: flex; align-items: center;">
            ✓ You may safely close this window
          </span>
        `}
      </div>

    </div>
  `;
  return container;
}

function bindEvents() {
  const downloadReceipt = async event => {
    const button = event.currentTarget;
    const label = button.innerHTML;
    button.disabled = true;
    button.textContent = 'Preparing PDF...';
    try {
      const { settings } = getState();
      await downloadTransactionPdf({ type: 'receipt', payment, quote: quote || {}, settings });
      toast.success('Receipt PDF downloaded. Check your Downloads or Files app.');
    } catch (err) {
      console.error('Could not generate receipt PDF:', err);
      toast.error('Could not create the PDF. Try opening the app in Chrome or Safari.');
    } finally {
      button.innerHTML = label;
      button.disabled = false;
    }
  };
  document.getElementById('btn-print-receipt')?.addEventListener('click', downloadReceipt);
  document.getElementById('btn-print-bottom')?.addEventListener('click', downloadReceipt);
}

export async function mount(container, params = {}) {
  if (!params.id) {
    location.hash = '#route/overview';
    return;
  }

  // Standalone portal mode: hide sidebar & topnav
  document.getElementById('nav-sidebar')?.classList.add('portal-hidden');
  document.getElementById('topnav')?.classList.add('portal-hidden');
  document.querySelector('.main-content')?.classList.add('portal-fullscreen');
  container.classList.add('page-container--auth');

  const ok = await loadPayment(params.id, params);
  if (!ok) {
    container.innerHTML = `
      <div class="client-portal-wrap" style="align-items: center; justify-content: center; padding: 60px 20px;">
        <div style="background: var(--color-surface); border: 1px solid var(--color-border); border-radius: var(--radius-lg); padding: 40px; max-width: 480px; text-align: center;">
          <h2 style="font-size: var(--text-lg); color: var(--color-ink); margin-bottom: 8px;">Receipt Not Found</h2>
          <p style="font-size: var(--text-sm); color: var(--color-ink-2); line-height: 1.5;">Could not find transaction receipt details. Please contact your freelancer for assistance.</p>
        </div>
      </div>
    `;
    return;
  }

  rootElem = render();
  container.replaceChildren(rootElem);
  bindEvents();

  // Automatically download a PDF when a completed checkout explicitly requests one.
  if (params.autoprint === '1') {
    setTimeout(async () => {
      try {
        const { settings } = getState();
        await downloadTransactionPdf({ type: 'receipt', payment, quote: quote || {}, settings });
      } catch (err) {
        console.error('Could not automatically generate receipt PDF:', err);
        toast.error('Could not create the receipt PDF. Use the Download Receipt PDF button.');
      }
    }, 800);
  }
}

export function unmount() {
  document.getElementById('nav-sidebar')?.classList.remove('portal-hidden');
  document.getElementById('topnav')?.classList.remove('portal-hidden');
  document.querySelector('.main-content')?.classList.remove('portal-fullscreen');
  document.getElementById('page-content')?.classList.remove('page-container--auth');

  if (rootElem && rootElem.parentNode) {
    rootElem.parentNode.removeChild(rootElem);
  }
  rootElem = null;
}
