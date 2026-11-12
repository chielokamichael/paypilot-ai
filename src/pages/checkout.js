// src/pages/checkout.js
/**
 * PayPilot AI — PayPal Checkout (JavaScript SDK v6)
 *
 * Implements PayPal's latest v6 Web SDK integration:
 * - Initializes SDK instance via window.paypal.createInstance()
 * - Verifies eligibility for PayPal & Pay Later
 * - Renders <paypal-button> and <paypal-pay-later-button>
 * - Establishes One-Time Payment Session with onApprove / onCancel / onError
 * - Captures transaction and syncs to Firestore & state
 */

import { getState, upsertPayment, upsertQuote, getQuoteById, subscribe } from '../state/store.js';
import {
  initPayPalV6Instance,
  checkV6Eligibility,
  createV6Order,
  captureV6Order,
  getPayPalClientId,
  isPayPalSdkLoaded,
} from '../services/paypal.v6.js';
import { formatCurrency, paymentStatusLabel, paymentStatusBadge } from '../utils/format.js';
import { toast } from '../components/toast.js';
import { fetchPublicInvoice, updatePublicInvoiceStatus, decodeInvoicePayload, encodeInvoicePayload, subscribeToPublicInvoice } from '../services/firebaseSync.js';
import { downloadTransactionPdf } from '../services/pdfExport.js';

let rootElem = null;
let payment = null;
let quote = null;
let sdkInstance = null;
let currentParams = {};
let unsubscribeInvoice = null;
let unsubscribeStore = null;

function isFreelancerPreview() {
  return Boolean(getState().authUser) && currentParams.client !== '1';
}

async function loadPayment(orderId, params = {}) {
  // The public invoice is authoritative; link payloads and local storage can be stale.
  try {
    const remote = await fetchPublicInvoice(orderId);
    if (remote) {
      payment = {
        id: orderId,
        quoteId: remote.quoteId || 'INV-001',
        amount: Number(remote.amount) || 0,
        currency: remote.currency || 'USD',
        status: remote.status || 'awaiting_approval',
        payerEmail: remote.payerEmail || '',
        createdAt: remote.createdAt || new Date().toISOString(),
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
        assumptions: remote.assumptions || [],
        exclusions: remote.exclusions || [],
      };
      upsertPayment(payment);
      upsertQuote(quote);
      return true;
    }
  } catch (err) {
    console.warn('Firestore fetchPublicInvoice error:', err);
  }

  // Fall back to the local store if the public invoice is unavailable.
  const { payments } = getState();
  payment = payments.find(p => p.id === orderId);
  if (payment) {
    quote = getQuoteById(payment.quoteId);
    if (quote) return true;
  }

  // URL payload is the final fallback for a fresh browser without Firestore access.
  if (params.inv) {
    const decoded = decodeInvoicePayload(params.inv);
    if (decoded) {
      payment = {
        id: orderId,
        quoteId: decoded.quoteId || 'INV-001',
        amount: Number(decoded.amount) || 0,
        currency: decoded.currency || 'USD',
        status: decoded.status || 'awaiting_approval',
        payerEmail: decoded.payerEmail || '',
        createdAt: decoded.createdAt || new Date().toISOString(),
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
        assumptions: decoded.assumptions || [],
        exclusions: decoded.exclusions || [],
      };
      upsertPayment(payment);
      upsertQuote(quote);
      return true;
    }
  }

  return false;
}

function render() {
  const container = document.createElement('div');
  container.className = 'client-portal-wrap';

  const { amount, currency, status } = payment;
  const { clientName, clientEmail, projectTitle, lineItems, milestones, exclusions, assumptions } = quote || {};
  const { settings, authUser } = getState();
  const freelancerPreview = isFreelancerPreview();

  const merchantName = settings.businessName || 'Freelance Professional';
  const payoutEmail = settings.paypalPayoutEmail || settings.businessEmail || 'merchant@paypilot.ai';

  // Render line items summary rows
  const lineRows = (lineItems || []).map(li => `
    <div style="display: flex; justify-content: space-between; align-items: baseline; padding: 10px 0; border-bottom: 1px dashed var(--color-border); font-size: var(--text-sm);">
      <span style="color: var(--color-ink); font-weight: 500;">
        ${li.description}
        <small style="display: block; color: var(--color-ink-3); font-size: var(--text-xs); margin-top: 2px;">
          ${li.quantity} ${li.unit || 'units'} &times; ${formatCurrency(li.rate, currency)}
        </small>
      </span>
      <strong style="font-family: var(--font-mono); font-size: var(--text-sm);">${formatCurrency(li.quantity * li.rate, currency)}</strong>
    </div>
  `).join('');

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
        <span style="font-size: var(--text-xs); color: var(--color-ink);">Final Review, Quality Assurance &amp; Handover</span>
      </div>
    `;

  // Exclusions list
  const exclusionText = (exclusions && exclusions.length > 0)
    ? exclusions.join(' • ')
    : 'Third-party licensing fees, ongoing server hosting costs, and out-of-scope revisions billed separately.';

  container.innerHTML = `
    ${freelancerPreview ? `
      <!-- Freelancer Preview Alert Bar -->
      <div style="background: linear-gradient(90deg, #063821 0%, #0B4A2E 100%); color: #E8F8F0; padding: 10px 24px; border-bottom: 1px solid rgba(8, 118, 71, 0.4); display: flex; align-items: center; justify-content: space-between; gap: 12px; font-size: var(--text-xs); flex-wrap: wrap;" data-print-hide>
        <div style="display: flex; align-items: center; gap: 8px;">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#25D366" stroke-width="2.5"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
          <span><strong>Freelancer Preview:</strong> This is the client's sandbox checkout view. It does not process payments or transfer funds.</span>
        </div>
        <div style="display: flex; align-items: center; gap: 10px;">
          <button id="btn-copy-preview-link" class="btn btn-secondary btn-sm" type="button" style="font-size: 11px; padding: 3px 10px; background: rgba(255,255,255,0.15); color: #fff; border: 1px solid rgba(255,255,255,0.25);">
            📋 Copy Link for Client
          </button>
          <a href="#route/quotes" class="btn btn-ghost btn-sm" style="font-size: 11px; color: #fff; padding: 3px 8px;">
            &larr; Return to Workspace
          </a>
        </div>
      </div>
    ` : ''}

    <!-- Top Client Portal Header -->
    <header class="client-portal-topbar">
      <div class="client-portal-brand">
        <img src="/favicon.svg" class="client-portal-brand__mark" alt="" aria-hidden="true">
        <div>
          <strong style="color: var(--color-ink); font-size: var(--text-sm); display: block; line-height: 1.2;">PayPilot AI</strong>
          <span style="color: var(--color-ink-3); font-size: 11px;">Client Payment Portal</span>
        </div>
        <span class="client-portal-badge" style="margin-left: var(--space-2);">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
          Sandbox demo
        </span>
      </div>

      <div class="client-portal-actions">
        <button id="btn-print-invoice" class="btn btn-secondary btn-sm" type="button" style="display: inline-flex; align-items: center; gap: 6px;">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5M12 15V3"/></svg>
          Download PDF
        </button>

        ${freelancerPreview ? `
          <a href="#route/overview" class="btn btn-ghost btn-sm" style="display: inline-flex; align-items: center; gap: 4px; font-size: var(--text-xs);">
            &larr; Freelancer Workspace
          </a>
        ` : ''}
      </div>
    </header>

    <!-- Main Client Portal Body -->
    <div class="client-portal-body">
      
      <div class="checkout-layout">
        
        <!-- Left Column: Scope, AI Audit & Invoice Details -->
        <div class="checkout-details">
          
          <!-- AI Scope Guard Card -->
          <div class="ai-scope-card">
            <div class="ai-scope-card__header">
              <div style="display: flex; align-items: center; gap: 8px;">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--color-accent)" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                <strong style="color: var(--color-ink); font-size: var(--text-sm);">Project scope</strong>
              </div>
              <span class="ai-scope-badge">Freelancer-provided quote</span>
            </div>
            
            <p style="font-size: var(--text-xs); color: var(--color-ink-2); margin-bottom: var(--space-3); line-height: 1.5;">
              Review the proposed deliverables, milestones, and exclusions with the freelancer before proceeding.
            </p>

            <div class="ai-scope-grid">
              <div class="ai-scope-item">
                <strong>Project Milestones</strong>
                ${milestoneList}
              </div>
              <div class="ai-scope-item">
                <strong>Scope Boundaries &amp; Terms</strong>
                <p style="margin: 0; line-height: 1.4; color: var(--color-ink-2);">${exclusionText}</p>
              </div>
            </div>
          </div>

          <!-- Quotation Summary Card -->
          <section class="section" style="margin-bottom: var(--space-6);">
            <div class="section__header" style="padding-bottom: var(--space-3); border-bottom: 1px solid var(--color-border); display: flex; justify-content: space-between; align-items: center;">
              <div>
                <span class="dashboard-kicker">STATEMENT OF WORK &amp; INVOICE</span>
                <h2 class="section__title" style="margin: 0; font-size: var(--text-lg);">Invoice #${payment.quoteId}</h2>
              </div>
              <span class="badge ${paymentStatusBadge(status)}" data-payment-status>${paymentStatusLabel(status)}</span>
            </div>

            <div class="section__content" style="background: var(--color-surface); padding: var(--space-6); border: 1px solid var(--color-border); border-radius: 0 0 var(--radius-lg) var(--radius-lg);">
              
              <div style="margin-bottom: var(--space-4);">
                <strong style="font-size: var(--text-base); color: var(--color-ink); display: block;">${projectTitle || 'Project Deliverables'}</strong>
              </div>

              <div class="checkout-demo-notice" role="note">
                <strong>Sandbox demo</strong>
                <span>Checkout is simulated. No real payment is processed and no funds are transferred.</span>
              </div>

              <!-- Parties Details Grid -->
              <div class="checkout-parties">
                <div>
                  <span style="color: var(--color-ink-3); text-transform: uppercase; font-weight: 600; display: block; margin-bottom: 3px;">Billed To (Client)</span>
                  <strong style="color: var(--color-ink); font-size: var(--text-sm); display: block;">${clientName || 'Valued Client'}</strong>
                  <span style="color: var(--color-ink-2); display: block;">${clientEmail || ''}</span>
                </div>
                <div>
                  <span style="color: var(--color-ink-3); text-transform: uppercase; font-weight: 600; display: block; margin-bottom: 3px;">Payee / Merchant</span>
                  <strong style="color: var(--color-ink); font-size: var(--text-sm); display: block;">${merchantName}</strong>
                  <span style="color: var(--color-ink-2); display: block;">PayPal: ${payoutEmail}</span>
                </div>
              </div>

              <!-- Deliverables Breakdown -->
              <div>
                <span style="font-size: var(--text-xs); text-transform: uppercase; font-weight: 600; color: var(--color-ink-3); display: block; margin-bottom: var(--space-2);">Deliverables &amp; Line Items</span>
                <div style="margin-bottom: var(--space-4);">
                  ${lineRows || '<p style="font-size: var(--text-sm); color: var(--color-ink-3);">No line items specified.</p>'}
                </div>

                <!-- Total Row -->
                <div style="display: flex; justify-content: space-between; align-items: baseline; padding-top: var(--space-4); border-top: 2px solid var(--color-border-strong);">
                  <div>
                    <span style="font-size: var(--text-base); font-weight: 600; color: var(--color-ink); display: block;">Total Balance Due</span>
                    <small style="color: var(--color-ink-3); font-size: var(--text-xs);">Includes all agreed milestone deliverables</small>
                  </div>
                  <strong style="font-family: var(--font-mono); font-size: 1.625rem; color: var(--color-accent);">${formatCurrency(amount, currency)}</strong>
                </div>
              </div>

            </div>
          </section>

          <!-- Sandbox disclosure -->
          <div style="padding: var(--space-5); background: var(--color-surface); border: 1px solid var(--color-border); border-radius: var(--radius-lg); font-size: var(--text-xs); color: var(--color-ink-2);">
            <div style="display: flex; align-items: center; gap: var(--space-3); margin-bottom: var(--space-3);">
              <div style="width: 32px; height: 32px; border-radius: 50%; background: var(--color-accent-light); color: var(--color-accent); display: grid; place-items: center; flex-shrink: 0;">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
              </div>
              <div>
                <strong style="color: var(--color-ink); font-size: var(--text-sm);">Sandbox checkout demo</strong>
                <p style="margin: 0; color: var(--color-ink-3);">This interface demonstrates the checkout flow only. It is not a payment request to a live processor.</p>
              </div>
            </div>
            <ul style="margin: 0; padding-left: var(--space-5); display: flex; flex-direction: column; gap: 4px; color: var(--color-ink-3);">
              <li>The configured payout email (<strong>${payoutEmail}</strong>) is for display only.</li>
              <li>No real payment is authorized, captured, or transferred.</li>
              <li>The receipt generated by this demo is not proof of payment.</li>
            </ul>
          </div>

        </div>

        <!-- Right Column: Client checkout or freelancer preview -->
        <div class="checkout-actions-panel">
          ${freelancerPreview ? `
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: var(--space-2);">
              <h3 style="font-size: var(--text-base); font-weight: var(--weight-bold); margin: 0; color: var(--color-ink);">Client checkout preview</h3>
              <span style="font-family: var(--font-mono); font-size: var(--text-sm); font-weight: 700; color: var(--color-accent);">${formatCurrency(amount, currency)}</span>
            </div>
            <p style="font-size: var(--text-xs); color: var(--color-ink-3); margin: 0;">Payment is disabled in freelancer preview. Use “Copy Link for Client” to open the payable checkout.</p>
          ` : `
          <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: var(--space-2);">
            <h3 style="font-size: var(--text-base); font-weight: var(--weight-bold); margin: 0; color: var(--color-ink);">Try the sandbox checkout</h3>
            <span style="font-family: var(--font-mono); font-size: var(--text-sm); font-weight: 700; color: var(--color-accent);">${formatCurrency(amount, currency)}</span>
          </div>
          <p style="font-size: var(--text-xs); color: var(--color-ink-3); margin-bottom: var(--space-5);">Use the demo controls to preview the client flow. No real charge will be made.</p>

          <!-- PayPal v6 Custom Web Components Container -->
          <div id="paypal-v6-container" style="display: flex; flex-direction: column; gap: var(--space-3); min-height: 100px;">
            <!-- Standard PayPal Button -->
            <paypal-button id="v6-paypal-btn" style="cursor: pointer; display: block;"></paypal-button>
            
            <!-- Pay Later Financing Button -->
            <paypal-pay-later-button id="v6-paylater-btn" style="cursor: pointer; display: block;"></paypal-pay-later-button>
          </div>

          <!-- Divider -->
          <div class="auth-divider" style="margin: var(--space-4) 0;"><span>OR TRY CARD DEMO</span></div>

          <!-- Direct Card Payment / Instant Capture Option -->
          <button id="btn-quick-capture" class="btn btn-secondary btn-block" type="button" style="display: flex; align-items: center; justify-content: center; gap: 8px;">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>
            <span>Run card checkout demo</span>
          </button>

          <!-- Progress status indicator during capture -->
          <div id="checkout-status" style="margin-top: var(--space-4); font-size: var(--text-xs); color: var(--color-ink-2); text-align: center; min-height: 20px;" role="status" aria-live="polite"></div>

          <div style="margin-top: var(--space-5); padding-top: var(--space-4); border-top: 1px solid var(--color-border); font-size: 11px; color: var(--color-ink-3); text-align: center; line-height: 1.4;">
            <p style="margin: 0 0 6px 0;">Sandbox environment · Simulated checkout</p>
            <p style="margin: 0;">This demo does not collect payment details or move money.</p>
          </div>
          `}
        </div>

      </div>

    </div>
  `;
  return container;
}

function renderAlreadyPaid() {
  const container = document.createElement('div');
  container.className = 'client-portal-wrap';
  const { amount, currency, transactionId, quoteId } = payment;

  container.innerHTML = `
    <!-- Top Bar -->
    <header class="client-portal-topbar">
      <div class="client-portal-brand">
        <img src="/favicon.svg" class="client-portal-brand__mark" alt="" aria-hidden="true">
        <div>
          <strong style="color: var(--color-ink); font-size: var(--text-sm); display: block; line-height: 1.2;">PayPilot AI</strong>
          <span style="color: var(--color-ink-3); font-size: 11px;">Invoice Settlement</span>
        </div>
      </div>
      <div class="client-portal-actions">
        <a href="#route/payment/${payment.id}${currentParams.inv ? '?inv=' + currentParams.inv : ''}" class="btn btn-secondary btn-sm" style="display: inline-flex; align-items: center; gap: 6px;">
          View Receipt
        </a>
      </div>
    </header>

    <div class="client-portal-body" style="display: flex; align-items: center; justify-content: center; min-height: 70vh;">
      <div style="background: var(--color-surface); border: 1px solid var(--color-border); border-radius: var(--radius-lg); padding: var(--space-8); max-width: 540px; width: 100%; text-align: center; box-shadow: var(--shadow-sm);">
        <div style="width: 60px; height: 60px; border-radius: 50%; background: var(--color-accent-light); color: var(--color-accent); display: grid; place-items: center; margin: 0 auto var(--space-4);">
          <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
        </div>
        
        <span class="badge badge-success" style="font-size: 11px; padding: 3px 10px; margin-bottom: var(--space-3); display: inline-block;">Simulation Complete</span>
        <h2 style="font-size: var(--text-xl); font-weight: var(--weight-bold); color: var(--color-ink); margin-bottom: var(--space-2);">Payment Link Closed</h2>
        <p style="font-size: var(--text-xs); color: var(--color-ink-2); line-height: 1.5; margin-bottom: var(--space-6);">
          The checkout simulation for invoice #${quoteId || payment.id} (${formatCurrency(amount, currency)}) is complete. No real payment was processed.
        </p>

        <div style="background: var(--color-surface-alt); padding: var(--space-4); border-radius: var(--radius-md); font-size: var(--text-xs); margin-bottom: var(--space-6); text-align: left;">
          <div style="display: flex; justify-content: space-between; padding: 4px 0; border-bottom: 1px dashed var(--color-border);">
            <span style="color: var(--color-ink-3);">Transaction Ref:</span>
            <strong style="color: var(--color-ink); font-family: var(--font-mono);">${transactionId || 'TXN-PAYPAL-' + payment.id}</strong>
          </div>
          <div style="display: flex; justify-content: space-between; padding: 4px 0;">
            <span style="color: var(--color-ink-3);">Checkout Status:</span>
            <span style="color: var(--color-accent); font-weight: 600;">Simulation only</span>
          </div>
        </div>

        <div style="display: flex; justify-content: center; gap: var(--space-3);">
          <a href="#route/payment/${payment.id}${currentParams.inv ? '?inv=' + currentParams.inv : ''}" class="btn btn-primary btn-sm" style="display: inline-flex; align-items: center; gap: 6px;">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5M12 15V3"/></svg>
            View Simulation Receipt
          </a>
        </div>
      </div>
    </div>
  `;
  return container;
}

async function setupPayPalV6Buttons() {
  const statusEl = document.getElementById('checkout-status');
  const paypalBtn = document.getElementById('v6-paypal-btn');
  const payLaterBtn = document.getElementById('v6-paylater-btn');

  // Fallback visual template if custom elements aren't rendered yet
  if (paypalBtn && !paypalBtn.shadowRoot && !paypalBtn.innerHTML) {
    paypalBtn.innerHTML = `
      <div style="display: flex; align-items: center; justify-content: center; gap: 8px; width: 100%; height: 44px; background: #FFC439; border-radius: 4px; font-weight: 700; color: #111; font-size: 14px; user-select: none;">
        <svg width="60" height="18" viewBox="0 0 101 32" fill="#003087"><path d="M12.22 3.86h-7.6A1.66 1.66 0 0 0 3 5.48L.04 24.32a.93.93 0 0 0 .92 1.07h4.08a.93.93 0 0 0 .92-.78l1-6.38a1.66 1.66 0 0 1 1.64-1.39h2.38c4.95 0 7.84-2.4 8.59-7.14.34-2.1.04-3.73-.89-4.83a6.83 6.83 0 0 0-5.46-1z"/></svg>
        <span>Checkout</span>
      </div>
    `;
  }

  if (payLaterBtn && !payLaterBtn.shadowRoot && !payLaterBtn.innerHTML) {
    payLaterBtn.innerHTML = `
      <div style="display: flex; align-items: center; justify-content: center; gap: 8px; width: 100%; height: 44px; background: #0070BA; border-radius: 4px; font-weight: 600; color: #fff; font-size: 14px; user-select: none;">
        <span>Pay in 4 with PayPal</span>
      </div>
    `;
  }

  // Shared completion handler
  const handlePaymentSuccess = async (orderId, payerEmail) => {
    const defaultPayer = quote?.clientEmail || 'client@company.com';
    if (statusEl) statusEl.textContent = 'Running checkout simulation...';

    const result = await captureV6Order({ orderId, payerEmail: payerEmail || defaultPayer });

    const updatedPayment = {
      ...payment,
      status: 'captured_simulation',
      transactionId: result.transactionId,
      payerEmail: result.payerEmail,
      capturedAt: result.capturedAt,
      sdkVersion: 'v6',
    };

    // Update Firestore public invoice status for real-time cross-browser sync
    const synced = await updatePublicInvoiceStatus(payment.id, {
      status: 'captured_simulation',
      transactionId: result.transactionId,
      payerEmail: result.payerEmail,
      capturedAt: result.capturedAt,
    });

    if (!synced) {
      if (statusEl) {
        statusEl.textContent = 'Could not sync this simulated checkout. No real payment was processed; check the Firebase rules.';
      }
      return;
    }

    upsertPayment(updatedPayment);

    // Keep the freelancer's quote state consistent with the captured payment.
    if (quote) {
      upsertQuote({ ...quote, status: 'paid', updatedAt: result.capturedAt });
    }

    if (statusEl) {
      statusEl.textContent = 'Simulated checkout complete. No real payment was processed. Redirecting to receipt...';
    }
    const nextHash = currentParams.inv
      ? `#route/payment/${payment.id}?autoprint=1&inv=${currentParams.inv}`
      : `#route/payment/${payment.id}?autoprint=1`;
    setTimeout(() => {
      location.hash = nextHash;
    }, 600);
  };

  // Attempt live PayPal v6 instance
  try {
    sdkInstance = await initPayPalV6Instance({ currency: payment.currency || 'USD' });

    if (sdkInstance) {
      const eligibility = await checkV6Eligibility(sdkInstance, payment.currency);
      console.info('PayPal v6 Eligibility:', eligibility);

      const sessionOptions = {
        async onApprove(data) {
          await handlePaymentSuccess(data.orderId || payment.id, quote?.clientEmail);
        },
        onCancel(data) {
          if (statusEl) statusEl.textContent = 'Payment cancelled.';
        },
        onError(error) {
          console.error('PayPal v6 payment error:', error);
          if (statusEl) statusEl.textContent = 'Payment error. Try card payment below.';
        },
      };

      if (sdkInstance.createPayPalOneTimePaymentSession) {
        const session = sdkInstance.createPayPalOneTimePaymentSession(sessionOptions);

        paypalBtn?.addEventListener('click', async () => {
          if (statusEl) statusEl.textContent = 'Connecting to PayPal...';
          try {
            await session.start(
              { presentationMode: 'auto' },
              createV6Order({ amount: payment.amount, currency: payment.currency, quoteId: payment.quoteId })
            );
          } catch (err) {
            console.warn('Session start fallback triggered:', err);
            await handlePaymentSuccess(payment.id, quote?.clientEmail);
          }
        });

        payLaterBtn?.addEventListener('click', async () => {
          if (statusEl) statusEl.textContent = 'Connecting to PayPal Pay Later...';
          try {
            await session.start(
              { presentationMode: 'auto' },
              createV6Order({ amount: payment.amount, currency: payment.currency, quoteId: payment.quoteId })
            );
          } catch (err) {
            await handlePaymentSuccess(payment.id, quote?.clientEmail);
          }
        });
        return;
      }
    }
  } catch (err) {
    console.warn('SDK v6 instance initialization skipped or failed:', err);
  }

  // Graceful interactive fallback: click buttons to complete simulation
  paypalBtn?.addEventListener('click', async () => {
    await handlePaymentSuccess(payment.id, quote?.clientEmail);
  });

  payLaterBtn?.addEventListener('click', async () => {
    await handlePaymentSuccess(payment.id, quote?.clientEmail);
  });
}

function bindEvents() {
  // Copy Link for Client (preview banner)
  document.getElementById('btn-copy-preview-link')?.addEventListener('click', async () => {
    const { settings } = getState();
    const clientPayload = {
      orderId: payment.id,
      quoteId: payment.quoteId,
      amount: payment.amount,
      currency: payment.currency,
      status: payment.status,
      clientName: quote?.clientName,
      clientEmail: quote?.clientEmail,
      projectTitle: quote?.projectTitle,
      lineItems: quote?.lineItems || [],
      milestones: quote?.milestones || [],
      assumptions: quote?.assumptions || [],
      exclusions: quote?.exclusions || [],
      merchantName: settings.businessName || 'Freelance Professional',
      payoutEmail: settings.paypalPayoutEmail || settings.businessEmail || 'merchant@paypilot.ai',
      createdAt: payment.createdAt || new Date().toISOString(),
    };
    const encodedInvoice = encodeInvoicePayload(clientPayload);
    const url = `${window.location.origin}${window.location.pathname}#route/checkout/${payment.id}?client=1&inv=${encodedInvoice}`;
    try {
      await navigator.clipboard.writeText(url);
      toast.success('Client checkout link copied to clipboard!');
    } catch {
      prompt('Copy this client payment link:', url);
    }
  });

  // Generate the PDF directly so mobile browsers without print support can save it.
  document.getElementById('btn-print-invoice')?.addEventListener('click', async event => {
    const button = event.currentTarget;
    const label = button.innerHTML;
    button.disabled = true;
    button.textContent = 'Preparing PDF...';
    try {
      const { settings } = getState();
      await downloadTransactionPdf({ type: 'invoice', payment, quote: quote || {}, settings });
      toast.success('Invoice PDF downloaded. Check your Downloads or Files app.');
    } catch (err) {
      console.error('Could not generate invoice PDF:', err);
      toast.error('Could not create the PDF. Try opening the app in Chrome or Safari.');
    } finally {
      button.innerHTML = label;
      button.disabled = false;
    }
  });

  // Card Payment button
  document.getElementById('btn-quick-capture')?.addEventListener('click', async () => {
    const statusEl = document.getElementById('checkout-status');
    if (statusEl) statusEl.textContent = 'Running card checkout simulation...';

    const defaultPayer = quote?.clientEmail || 'client@company.com';
    const result = await captureV6Order({ orderId: payment.id, payerEmail: defaultPayer });

    const updated = {
      ...payment,
      status: 'captured_simulation',
      transactionId: result.transactionId,
      payerEmail: result.payerEmail,
      capturedAt: result.capturedAt,
      sdkVersion: 'v6-card-checkout',
    };

    // Update Firestore public invoice
    const synced = await updatePublicInvoiceStatus(payment.id, {
      status: 'captured_simulation',
      transactionId: result.transactionId,
      payerEmail: result.payerEmail,
      capturedAt: result.capturedAt,
    });

    if (!synced) {
      if (statusEl) {
        statusEl.textContent = 'Could not sync this simulated checkout. No real payment was processed; check the Firebase rules.';
      }
      return;
    }

    upsertPayment(updated);

    if (quote) {
      upsertQuote({ ...quote, status: 'paid', updatedAt: result.capturedAt });
    }

    const nextHash = currentParams.inv
      ? `#route/payment/${payment.id}?autoprint=1&inv=${currentParams.inv}`
      : `#route/payment/${payment.id}?autoprint=1`;
    setTimeout(() => {
      location.hash = nextHash;
    }, 600);
  });
}

function applyPaymentUpdate(updates) {
  const nextPayment = { ...payment, ...updates };
  const changed = ['status', 'transactionId', 'payerEmail', 'capturedAt']
    .some(key => nextPayment[key] !== payment[key]);
  if (!changed) return;

  const wasPaid = payment.status === 'captured_simulation' || payment.status === 'captured';
  payment = nextPayment;
  upsertPayment(payment);

  const isPaid = payment.status === 'captured_simulation' || payment.status === 'captured';
  if (isPaid && !wasPaid) {
    const host = rootElem?.parentNode;
    const paidView = renderAlreadyPaid();
    host?.replaceChildren(paidView);
    rootElem = paidView;
    return;
  }

  const statusBadge = rootElem?.querySelector('[data-payment-status]');
  if (statusBadge) {
    statusBadge.className = `badge ${paymentStatusBadge(payment.status)}`;
    statusBadge.textContent = paymentStatusLabel(payment.status);
  }
}

export async function mount(container, params = {}) {
  currentParams = params;
  if (!params.id) {
    location.hash = '#route/overview';
    return;
  }

  // Standalone client portal mode: hide sidebar & topnav
  document.getElementById('nav-sidebar')?.classList.add('portal-hidden');
  document.getElementById('topnav')?.classList.add('portal-hidden');
  document.querySelector('.main-content')?.classList.add('portal-fullscreen');
  container.classList.add('page-container--auth');

  // Loading indicator while resolving order data
  container.innerHTML = `
    <div style="min-height: 80vh; display: grid; place-items: center; color: var(--color-ink-2);">
      <div style="text-align: center;">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:28px;height:28px;margin: 0 auto 12px;animation:spin 1s linear infinite"><circle cx="12" cy="12" r="10" stroke-opacity="0.25"/><path d="M12 2a10 10 0 0 1 10 10"/></svg>
        <p style="font-size: var(--text-sm);">Loading invoice details...</p>
      </div>
    </div>
  `;

  const ok = await loadPayment(params.id, params);
  if (!ok) {
    container.innerHTML = `
      <div class="client-portal-wrap" style="align-items: center; justify-content: center; padding: 60px 20px;">
        <div style="background: var(--color-surface); border: 1px solid var(--color-border); border-radius: var(--radius-lg); padding: 40px; max-width: 480px; text-align: center;">
          <h2 style="font-size: var(--text-lg); color: var(--color-ink); margin-bottom: 8px;">Invoice Not Found</h2>
          <p style="font-size: var(--text-sm); color: var(--color-ink-2); line-height: 1.5;">This invoice link may be invalid or expired. Please contact your freelancer for an updated payment link.</p>
        </div>
      </div>
    `;
    return;
  }

  // Check if invoice has already been settled / paid (invalidate link for double payments)
  if (payment.status === 'captured_simulation' || payment.status === 'captured') {
    rootElem = renderAlreadyPaid();
    container.replaceChildren(rootElem);
    return;
  }

  rootElem = render();
  container.replaceChildren(rootElem);
  if (!isFreelancerPreview()) setupPayPalV6Buttons();
  bindEvents();

  unsubscribeInvoice = subscribeToPublicInvoice(payment.id, invoice => {
    if (!invoice.status) return;
    applyPaymentUpdate({
      status: invoice.status,
      transactionId: invoice.transactionId,
      payerEmail: invoice.payerEmail,
      capturedAt: invoice.capturedAt,
    });
  });
  unsubscribeStore = subscribe('payments', state => {
    const updatedPayment = state.payments.find(item => item.id === payment.id);
    if (updatedPayment) applyPaymentUpdate(updatedPayment);
  });
}

export function unmount() {
  // Restore sidebar & topnav when exiting checkout
  document.getElementById('nav-sidebar')?.classList.remove('portal-hidden');
  document.getElementById('topnav')?.classList.remove('portal-hidden');
  document.querySelector('.main-content')?.classList.remove('portal-fullscreen');
  document.getElementById('page-content')?.classList.remove('page-container--auth');

  unsubscribeInvoice?.();
  unsubscribeStore?.();
  unsubscribeInvoice = null;
  unsubscribeStore = null;

  if (rootElem?.parentNode) {
    rootElem.parentNode.removeChild(rootElem);
  }
  rootElem = null;
  sdkInstance = null;
}
