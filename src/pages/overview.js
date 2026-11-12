import { getState, subscribe } from '../state/store.js';
import { formatCurrency, formatDate, paymentStatusLabel, quoteStatusBadge, quoteStatusLabel } from '../utils/format.js';

let rootElem = null;
let unsubscribeStore = null;

function quoteTotal(quote) {
  return (quote.lineItems ?? []).reduce((total, item) => total + item.quantity * item.rate, 0);
}

const ICONS = {
  trend: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M7 17 17 7M7 7h10v10"/></svg>',
  quote: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M8 13h8M8 17h6"/></svg>',
  approved: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12 4 4L19 6"/></svg>',
  pending: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
  payment: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20M6 15h4"/></svg>',
  add: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
  settings: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19 13.5v-3l-2-.7-.5-1.2 1-1.9-2.1-2.1-1.9 1-1.2-.5L11.5 3h-3l-.7 2-1.2.5-1.9-1-2.1 2.1 1 1.9-.5 1.2-2 .7v3l2 .7.5 1.2-1 1.9 2.1 2.1 1.9-1 1.2.5.7 2h3l.7-2 1.2-.5 1.9 1 2.1-2.1-1-1.9.5-1.2z"/></svg>',
};

function render() {
  const { quotes, payments, settings } = getState();
  const currency = settings.currency || 'USD';
  const collectedPayments = payments.filter(payment => payment.status === 'captured_simulation');
  const pendingPayments = payments.filter(payment => payment.status === 'awaiting_approval' || payment.status === 'approved');
  const collected = collectedPayments.reduce((total, payment) => total + payment.amount, 0);
  const pending = pendingPayments.reduce((total, payment) => total + payment.amount, 0);
  const draftCount = quotes.filter(quote => quote.status === 'draft').length;
  const activity = [
    ...payments.map(payment => ({
      kind: 'payment',
      title: paymentStatusLabel(payment.status),
      detail: `Quote #${payment.quoteId}`,
      amount: payment.amount,
      date: payment.capturedAt || payment.createdAt,
      status: payment.status,
      href: `#route/payment/${payment.id}`,
    })),
    ...quotes.map(quote => ({
      kind: 'quote',
      title: `${quoteStatusLabel(quote.status)} quote`,
      detail: `${quote.clientName || 'New client'} · ${quote.projectTitle || 'Untitled project'}`,
      amount: quoteTotal(quote),
      date: quote.updatedAt || quote.createdAt,
      status: quote.status,
      href: `#route/quote/${quote.id}`,
    })),
  ].sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0)).slice(0, 5);

  const page = document.createElement('div');
  page.className = 'overview-page';
  page.innerHTML = `
    <header class="dashboard-header">
      <div>
        <p class="dashboard-kicker">YOUR BUSINESS, AT A GLANCE</p>
        <h1>Welcome back, ${settings.businessName || 'there'}</h1>
        <p class="dashboard-header__sub">Track quotes, payments, and what needs your attention.</p>
      </div>
      <a class="btn btn-primary" href="#create-quote">Create a quote</a>
    </header>

    <section class="dashboard-overview" aria-label="Financial overview">
      <article class="balance-card">
        <div class="balance-card__top">
          <div>
            <p class="balance-card__eyebrow">SIMULATED REVENUE</p>
            <h2>Simulation total</h2>
          </div>
          <span class="balance-card__mark" aria-hidden="true">${ICONS.trend}</span>
        </div>
        <p class="balance-card__amount">${formatCurrency(collected, currency)}</p>
        <div class="balance-card__bottom">
          <span>${collectedPayments.length} simulated ${collectedPayments.length === 1 ? 'checkout' : 'checkouts'}</span>
          <a href="#payments">View payments <span aria-hidden="true">→</span></a>
        </div>
      </article>

      <div class="overview-stats">
        <a class="overview-stat" href="#quotes">
          <span class="overview-stat__icon overview-stat__icon--green" aria-hidden="true">${ICONS.quote}</span>
          <span class="overview-stat__label">Total quotes</span>
          <strong>${quotes.length}</strong>
          <small>${draftCount} draft${draftCount === 1 ? '' : 's'} in progress</small>
        </a>
        <a class="overview-stat" href="#quotes">
          <span class="overview-stat__icon overview-stat__icon--gold" aria-hidden="true">${ICONS.approved}</span>
          <span class="overview-stat__label">Ready for payment link</span>
          <strong>${quotes.filter(quote => quote.status === 'approved').length}</strong>
          <small>Reviewed quotes; create a link when ready</small>
        </a>
        <a class="overview-stat" href="#payments">
          <span class="overview-stat__icon overview-stat__icon--blue" aria-hidden="true">${ICONS.pending}</span>
          <span class="overview-stat__label">Awaiting client checkout</span>
          <strong>${formatCurrency(pending, currency)}</strong>
          <small>${pendingPayments.length} open sandbox checkout${pendingPayments.length === 1 ? '' : 's'}</small>
        </a>
        <a class="overview-stat" href="#payments">
          <span class="overview-stat__icon overview-stat__icon--coral" aria-hidden="true">${ICONS.payment}</span>
          <span class="overview-stat__label">Payments</span>
          <strong>${payments.length}</strong>
          <small>All transactions</small>
        </a>
      </div>
    </section>

    <section class="dashboard-lower">
      <div class="activity-panel">
        <div class="panel-heading">
          <div><p class="dashboard-kicker">LATEST UPDATES</p><h2>Recent activity</h2></div>
          <a class="text-link" href="#payments">See all</a>
        </div>
        ${activity.length ? `
          <div class="activity-list">
            ${activity.map(item => `
              <a class="activity-row" href="${item.href}">
                <span class="activity-row__icon ${item.kind === 'payment' ? 'activity-row__icon--payment' : 'activity-row__icon--quote'}" aria-hidden="true">${item.kind === 'payment' ? ICONS.trend : ICONS.quote}</span>
                <span class="activity-row__body"><strong>${item.title}</strong><small>${item.detail}</small></span>
                <span class="activity-row__amount"><strong>${formatCurrency(item.amount, currency)}</strong><small>${formatDate(item.date)}</small></span>
              </a>`).join('')}
          </div>` : `
          <div class="activity-empty">
            <span class="activity-empty__mark" aria-hidden="true">＋</span>
            <h3>Your next win starts here</h3>
            <p>Create a quote, send it to a client, and track payment in one place.</p>
            <a class="btn btn-secondary btn-sm" href="#create-quote">Create your first quote</a>
          </div>`}
      </div>

      <aside class="quick-panel">
        <p class="dashboard-kicker">MOVE THINGS FORWARD</p>
        <h2>Quick actions</h2>
        <a class="quick-action" href="#create-quote"><span aria-hidden="true">${ICONS.add}</span><span><strong>Create a quote</strong><small>Turn a project brief into a proposal</small></span><b aria-hidden="true">→</b></a>
        <a class="quick-action" href="#quotes"><span aria-hidden="true">${ICONS.quote}</span><span><strong>Review quotes</strong><small>Check drafts and approvals</small></span><b aria-hidden="true">→</b></a>
        <a class="quick-action" href="#settings"><span aria-hidden="true">${ICONS.settings}</span><span><strong>Business settings</strong><small>Keep your details up to date</small></span><b aria-hidden="true">→</b></a>
      </aside>
    </section>
  `;
  return page;
}

export function mount(container) {
  rootElem = render();
  container.replaceChildren(rootElem);
  unsubscribeStore = subscribe('*', () => {
    const updatedPage = render();
    rootElem?.replaceWith(updatedPage);
    rootElem = updatedPage;
  });
}

export function unmount() {
  unsubscribeStore?.();
  unsubscribeStore = null;
  rootElem?.remove();
  rootElem = null;
}