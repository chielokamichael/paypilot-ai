// src/pages/create-quote.js
/**
 * PayPilot AI — Create Quote Page
 *
 * This module renders the quote builder workspace. It is used for both
 * creating a new quote (route "create-quote") and editing an existing one
 * (route "edit-quote/:id").
 *
 * Exported API:
 *   mount(container: HTMLElement, params: { id?: string })
 *   unmount()
 */

import { getState, upsertQuote, generateQuoteId } from '../state/store.js';
import { generateQuoteDraft } from '../services/ai.service.js';
import { formatCurrency } from '../utils/format.js';

let rootElem = null;
let currentQuote = null;

function initNewQuote() {
  const id = generateQuoteId();
  currentQuote = {
    id,
    clientName: '',
    clientEmail: '',
    projectTitle: '',
    description: '',
    lineItems: [],
    milestones: [],
    assumptions: [],
    exclusions: [],
    status: 'draft', // draft | reviewed | approved
    createdAt: new Date().toISOString(),
  };
}

function loadExistingQuote(id) {
  const { quotes } = getState();
  currentQuote = quotes.find(q => q.id === id);
  if (!currentQuote) {
    // fallback to new quote if not found
    initNewQuote();
  }
}

function render() {
  const container = document.createElement('div');
  container.className = 'create-quote-page';
  container.innerHTML = `
    <header class="page-header">
      <div>
        <p class="dashboard-kicker">QUOTE WORKFLOW</p>
        <h1 class="page-header__title">Create a quote</h1>
        <p class="page-header__sub">Describe the work, shape the estimate, and send a clear proposal.</p>
      </div>
    </header>
  `;

  const layout = document.createElement('div');
  layout.className = 'quote-layout';

  // ---- Main column ----------------------------------------------------
  const main = document.createElement('div');
  main.className = 'quote-layout__main';
  main.innerHTML = `
    <section class="section" id="section-client">
      <div class="section__header"><h2 class="section__title">Client &amp; Project Information</h2></div>
      <div class="section__content">
        <div class="field-group">
          <label for="client-name" class="field-label">Client Name <span style="color: var(--color-danger);">*</span></label>
          <input id="client-name" type="text" class="field-input" placeholder="e.g. Acme Corporation or Sarah Jenkins" value="${currentQuote.clientName}" required />
          <span class="field-error-msg" id="err-client-name"></span>
        </div>
        <div class="field-group">
          <label for="client-email" class="field-label">Client Email <span style="color: var(--color-danger);">*</span></label>
          <input id="client-email" type="email" class="field-input" placeholder="client@company.com" value="${currentQuote.clientEmail}" required />
          <span class="field-error-msg" id="err-client-email"></span>
        </div>
        <div class="field-group">
          <label for="project-title" class="field-label">Project Title <span style="color: var(--color-danger);">*</span></label>
          <input id="project-title" type="text" class="field-input" placeholder="e.g. Brand Identity &amp; E-Commerce Platform" value="${currentQuote.projectTitle}" required />
          <span class="field-error-msg" id="err-project-title"></span>
        </div>
        <div class="field-group">
          <label for="project-desc" class="field-label">Project Scope / Brief <span style="color: var(--color-danger);">*</span></label>
          <textarea id="project-desc" class="field-input" rows="4" placeholder="Describe the requested work in detail so Gemini AI can draft accurate line items and rates..." required>${currentQuote.description}</textarea>
          <span class="field-error-msg" id="err-project-desc"></span>
        </div>
        <button id="btn-generate" class="btn btn-primary" type="button">
          <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 4v16m8-8H4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
          Generate with AI
        </button>
      </div>
    </section>

    <section class="section" id="section-lineitems">
      <div class="section__header">
        <h2 class="section__title">Line items</h2>
        <button id="btn-add-item" class="btn btn-ghost btn-sm" type="button">
          <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 5v14m7-7H5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
          Add item
        </button>
      </div>
      <div class="section__content" id="lineitems-container"></div>
    </section>
  `;

  // ---- Aside (summary) -----------------------------------------------
  const aside = document.createElement('div');
  aside.className = 'quote-layout__aside';
  aside.innerHTML = `
    <aside class="summary-panel">
      <div class="summary-panel__header">Quote summary</div>
      <div class="summary-panel__body" id="summary-body">
        <p class="num" id="summary-subtotal">Subtotal: —</p>
        <p class="num" id="summary-total">Total: —</p>
      </div>
      <div class="summary-panel__footer">
        <button id="btn-save" class="btn btn-success btn-sm" type="button">Save draft</button>
        <button id="btn-submit" class="btn btn-primary btn-sm" type="button" disabled>Continue to review</button>
        <p id="quote-feedback" class="field__hint" role="status" aria-live="polite"></p>
      </div>
    </aside>
  `;

  layout.appendChild(main);
  layout.appendChild(aside);
  container.appendChild(layout);

  return container;
}

function renderLineItems() {
  const container = document.getElementById('lineitems-container');
  container.innerHTML = '';
  currentQuote.lineItems.forEach((item, idx) => {
    const row = document.createElement('div');
    row.className = 'line-item';
    row.innerHTML = `
      <input data-idx="${idx}" data-field="description" class="field-input" aria-label="Item ${idx + 1} description" placeholder="Description" value="${item.description}" />
      <input data-idx="${idx}" data-field="quantity" type="number" min="0" class="field-input" aria-label="Item ${idx + 1} quantity" placeholder="Qty" value="${item.quantity}" />
      <input data-idx="${idx}" data-field="rate" type="number" step="0.01" min="0" class="field-input" aria-label="Item ${idx + 1} rate" placeholder="Rate" value="${item.rate}" />
      <button data-idx="${idx}" class="btn btn-ghost btn-sm" type="button" title="Remove item" aria-label="Remove item ${idx + 1}"><svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M6 18L18 6M6 6l12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
    `;
    container.appendChild(row);
  });
}

function updateSummary() {
  const subtotal = currentQuote.lineItems.reduce((sum, li) => sum + (li.quantity * li.rate), 0);
  document.getElementById('summary-subtotal').textContent = `Subtotal: ${formatCurrency(subtotal)}`;
  document.getElementById('summary-total').textContent = `Total: ${formatCurrency(subtotal)}`; // No tax/fees for demo
  const submitBtn = document.getElementById('btn-submit');
  submitBtn.disabled = currentQuote.lineItems.length === 0;
}

function bindEvents() {
  // client fields
  const clientNameEl = document.getElementById('client-name');
  const clientEmailEl = document.getElementById('client-email');
  const projectTitleEl = document.getElementById('project-title');
  const projectDescEl = document.getElementById('project-desc');
  [clientNameEl, clientEmailEl, projectTitleEl, projectDescEl].forEach(el => {
    el.addEventListener('input', e => {
      const prop = {
        'client-name': 'clientName',
        'client-email': 'clientEmail',
        'project-title': 'projectTitle',
        'project-desc': 'description'
      }[e.target.id];
      currentQuote[prop] = e.target.value;

      // Clear field error state when user types
      e.target.classList.remove('is-error');
      const errEl = document.getElementById(`err-${e.target.id}`);
      if (errEl) errEl.textContent = '';
      const feedback = document.getElementById('quote-feedback');
      if (feedback && feedback.classList.contains('field-error-msg')) feedback.textContent = '';
    });
  });

  // generate draft
  const generateBtn = document.getElementById('btn-generate');
  generateBtn?.addEventListener('click', async () => {
    if (!currentQuote.description.trim()) {
      const feedback = document.getElementById('quote-feedback');
      if (feedback) feedback.textContent = 'Please enter a project scope/brief first.';
      projectDescEl?.classList.add('is-error');
      const errDesc = document.getElementById('err-project-desc');
      if (errDesc) errDesc.textContent = 'Project scope is required for Gemini AI to draft line items.';
      projectDescEl?.focus();
      return;
    }

    const origContent = generateBtn.innerHTML;
    generateBtn.disabled = true;
    generateBtn.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px;animation:spin 1s linear infinite"><circle cx="12" cy="12" r="10" stroke-opacity="0.25"/><path d="M12 2a10 10 0 0 1 10 10"/></svg>
      Analyzing with Gemini...
    `;

    try {
      const draft = await generateQuoteDraft({
        projectTitle: currentQuote.projectTitle,
        description: currentQuote.description,
        currency: getState().settings.currency,
      });

      // Populate line items from draft
      currentQuote.lineItems = (draft.lineItems || []).map(li => ({
        description: li.description,
        quantity: Number(li.quantity) || 1,
        rate: Number(li.rate ?? li.unitRate) || 0,
      }));

      currentQuote.milestones = draft.milestones || [];
      currentQuote.assumptions = draft.assumptions || [];
      currentQuote.exclusions = draft.exclusions || [];

      renderLineItems();
      updateSummary();

      const feedback = document.getElementById('quote-feedback');
      if (feedback) {
        feedback.textContent = draft.source === 'gemini-1.5-flash'
          ? 'Quote drafted with live Gemini AI.'
          : 'Quote drafted with smart local engine.';
      }
    } catch (err) {
      console.error('Draft generation error:', err);
      const feedback = document.getElementById('quote-feedback');
      if (feedback) feedback.textContent = 'Could not generate draft. Please try again.';
    } finally {
      generateBtn.disabled = false;
      generateBtn.innerHTML = origContent;
    }
  });

  // add item
  document.getElementById('btn-add-item').addEventListener('click', () => {
    currentQuote.lineItems.push({ description: '', quantity: 1, rate: 0 });
    renderLineItems();
    updateSummary();
  });

  // delegate row events (change & delete)
  document.getElementById('lineitems-container').addEventListener('input', e => {
    if (e.target.dataset.idx === undefined) return;
    const idx = Number(e.target.dataset.idx);
    const field = e.target.dataset.field;
    currentQuote.lineItems[idx][field] = e.target.type === 'number' ? Number(e.target.value) : e.target.value;
    updateSummary();
  });

  document.getElementById('lineitems-container').addEventListener('click', e => {
    if (e.target.closest('button') && e.target.closest('button').dataset.idx !== undefined) {
      const idx = Number(e.target.closest('button').dataset.idx);
      currentQuote.lineItems.splice(idx, 1);
      renderLineItems();
      updateSummary();
    }
  });

  // save draft
  document.getElementById('btn-save').addEventListener('click', () => {
    upsertQuote(currentQuote);
    const feedback = document.getElementById('quote-feedback');
    if (feedback) feedback.textContent = 'Draft saved on this device.';
  });

  // submit for review – validate all required fields first
  document.getElementById('btn-submit').addEventListener('click', () => {
    let isValid = true;
    let firstInvalid = null;

    // Reset previous errors
    [clientNameEl, clientEmailEl, projectTitleEl, projectDescEl].forEach(el => el?.classList.remove('is-error'));
    ['err-client-name', 'err-client-email', 'err-project-title', 'err-project-desc'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.textContent = '';
    });

    // 1. Client name
    if (!currentQuote.clientName.trim()) {
      isValid = false;
      clientNameEl?.classList.add('is-error');
      document.getElementById('err-client-name').textContent = 'Client name is required.';
      if (!firstInvalid) firstInvalid = clientNameEl;
    }

    // 2. Client email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!currentQuote.clientEmail.trim() || !emailRegex.test(currentQuote.clientEmail.trim())) {
      isValid = false;
      clientEmailEl?.classList.add('is-error');
      document.getElementById('err-client-email').textContent = 'A valid client email address is required.';
      if (!firstInvalid) firstInvalid = clientEmailEl;
    }

    // 3. Project title
    if (!currentQuote.projectTitle.trim()) {
      isValid = false;
      projectTitleEl?.classList.add('is-error');
      document.getElementById('err-project-title').textContent = 'Project title is required.';
      if (!firstInvalid) firstInvalid = projectTitleEl;
    }

    // 4. Project description
    if (!currentQuote.description.trim()) {
      isValid = false;
      projectDescEl?.classList.add('is-error');
      document.getElementById('err-project-desc').textContent = 'Project description/scope is required.';
      if (!firstInvalid) firstInvalid = projectDescEl;
    }

    // 5. Line items
    const hasValidLineItem = currentQuote.lineItems.some(
      li => li.description && li.description.trim() !== '' && Number(li.quantity) > 0 && Number(li.rate) > 0
    );
    if (!hasValidLineItem) {
      isValid = false;
      const feedback = document.getElementById('quote-feedback');
      if (feedback) feedback.textContent = 'Please add at least one line item with description, quantity, and rate.';
      if (!firstInvalid) firstInvalid = document.getElementById('btn-add-item');
    }

    if (!isValid) {
      const feedback = document.getElementById('quote-feedback');
      if (feedback && hasValidLineItem) {
        feedback.textContent = 'Please complete all required fields above.';
      }
      firstInvalid?.focus();
      return;
    }

    // All valid! Save and proceed
    currentQuote.updatedAt = new Date().toISOString();
    upsertQuote(currentQuote);
    location.hash = `#route/quote/${currentQuote.id}`;
  });
}

export function mount(container, params = {}) {
  // If an id is supplied, edit that quote; otherwise start new
  if (params.id) {
    loadExistingQuote(params.id);
  } else {
    initNewQuote();
  }
  rootElem = render();
  container.replaceChildren(rootElem);
  renderLineItems();
  updateSummary();
  bindEvents();
}

export function unmount() {
  if (rootElem && rootElem.parentNode) {
    rootElem.parentNode.removeChild(rootElem);
  }
  rootElem = null;
}
