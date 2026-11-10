import { getState, removeQuote, subscribe } from '../state/store.js';
import { formatCurrency, formatDate, quoteStatusBadge, quoteStatusLabel } from '../utils/format.js';
import { confirmModal } from '../components/modal.js';
import { toast } from '../components/toast.js';

let rootElem = null;
let unsubscribeQuotes = null;
let unsubscribePayments = null;
let searchValue = '';
let statusValue = 'all';
let sortValue = 'newest';

function totalFor(quote) {
  return (quote.lineItems ?? []).reduce((total, item) => total + item.quantity * item.rate, 0);
}

function quoteDate(quote, payments) {
  const paymentDate = payments
    .filter(payment => payment.quoteId === quote.id)
    .map(payment => payment.capturedAt || payment.createdAt)
    .filter(Boolean)
    .sort((a, b) => new Date(b) - new Date(a))[0];
  return quote.updatedAt || quote.createdAt || paymentDate || '';
}

function renderRows() {
  const { quotes, payments, settings } = getState();
  const currency = settings.currency || 'USD';
  const query = searchValue.trim().toLowerCase();
  const filtered = quotes.filter(quote => {
    const matchesText = !query || [
      quote.id,
      quote.projectTitle,
      quote.clientName,
      quote.clientEmail,
    ].some(value => String(value || '').toLowerCase().includes(query));
    const matchesStatus = statusValue === 'all' || quote.status === statusValue;
    return matchesText && matchesStatus;
  });

  filtered.sort((a, b) => {
    if (sortValue === 'client') return (a.clientName || '').localeCompare(b.clientName || '');
    if (sortValue === 'email') return (a.clientEmail || '').localeCompare(b.clientEmail || '');
    if (sortValue === 'amount') return totalFor(b) - totalFor(a);
    const dateA = Date.parse(quoteDate(a, payments)) || 0;
    const dateB = Date.parse(quoteDate(b, payments)) || 0;
    return sortValue === 'oldest' ? dateA - dateB : dateB - dateA;
  });

  const tbody = rootElem?.querySelector('[data-quotes-body]');
  const count = rootElem?.querySelector('[data-quotes-count]');
  if (!tbody || !count) return;

  count.textContent = `${filtered.length} of ${quotes.length} ${quotes.length === 1 ? 'quote' : 'quotes'}`;
  if (!filtered.length) {
    tbody.innerHTML = `<tr><td colspan="6"><div class="empty-state"><p class="empty-state__title">${quotes.length ? 'No matching quotes' : 'No quotes yet'}</p><p class="empty-state__text">${quotes.length ? 'Try another search or status filter.' : 'Create your first quote to get started.'}</p></div></td></tr>`;
    return;
  }

  tbody.innerHTML = filtered.map(quote => {
    const hasPayments = payments.some(payment => payment.quoteId === quote.id);
    const created = quoteDate(quote, payments);
    return `
      <tr>
        <td><a href="#route/quote/${quote.id}">#${quote.id}</a><br>${quote.projectTitle || 'Untitled project'}</td>
        <td>${quote.clientName || 'No client'}${quote.clientEmail ? `<br><a href="mailto:${quote.clientEmail}">${quote.clientEmail}</a>` : ''}</td>
        <td>${created ? formatDate(created) : '—'}</td>
        <td><span class="badge ${quoteStatusBadge(quote.status)}">${quoteStatusLabel(quote.status)}</span></td>
        <td class="num">${formatCurrency(totalFor(quote), currency)}</td>
        <td class="quotes-row-actions">
          <a class="btn btn-secondary btn-sm" href="#route/quote/${quote.id}">Open</a>
          <button class="btn btn-danger btn-sm" type="button" data-delete-quote="${quote.id}" ${hasPayments ? 'disabled title="This quote has payment history and is protected."' : ''} aria-label="Delete quote ${quote.id}">Delete</button>
        </td>
      </tr>`;
  }).join('');
}

function render() {
  const page = document.createElement('div');
  page.className = 'quotes-page';
  page.innerHTML = `
    <section class="section">
      <div class="section__header"><div><p class="dashboard-kicker">CLIENT WORKSPACE</p><h1 class="section__title">Quotes</h1></div><a class="btn btn-primary btn-sm" href="#create-quote">Create quote</a></div>
      <div class="section__content">
        <div class="quotes-toolbar">
          <label class="field quotes-search"><span class="field__label">Search quotes</span><input id="quotes-search" class="input" type="search" value="${searchValue}" placeholder="Client, email, project or quote ID" /></label>
          <label class="field"><span class="field__label">Status</span><select id="quotes-status" class="select">
            <option value="all" ${statusValue === 'all' ? 'selected' : ''}>All statuses</option>
            <option value="draft" ${statusValue === 'draft' ? 'selected' : ''}>Draft</option>
            <option value="approved" ${statusValue === 'approved' ? 'selected' : ''}>Awaiting payment</option>
            <option value="sent" ${statusValue === 'sent' ? 'selected' : ''}>Sent</option>
            <option value="paid" ${statusValue === 'paid' ? 'selected' : ''}>Paid</option>
            <option value="expired" ${statusValue === 'expired' ? 'selected' : ''}>Expired</option>
          </select></label>
          <label class="field"><span class="field__label">Sort by</span><select id="quotes-sort" class="select">
            <option value="newest" ${sortValue === 'newest' ? 'selected' : ''}>Recently updated</option>
            <option value="oldest" ${sortValue === 'oldest' ? 'selected' : ''}>Least recently updated</option>
            <option value="client" ${sortValue === 'client' ? 'selected' : ''}>Client name</option>
            <option value="email" ${sortValue === 'email' ? 'selected' : ''}>Client email</option>
            <option value="amount" ${sortValue === 'amount' ? 'selected' : ''}>Quote total</option>
          </select></label>
          <span class="quotes-count" data-quotes-count aria-live="polite"></span>
        </div>
        <div class="table-scroll"><table class="quote-table">
            <thead><tr><th>Quote / project</th><th>Client / email</th><th>Last updated</th><th>Status</th><th class="num">Total</th><th>Actions</th></tr></thead>
            <tbody data-quotes-body></tbody>
          </table></div>
      </div>
    </section>
  `;
  return page;
}

function bindEvents() {
  const search = rootElem.querySelector('#quotes-search');
  const status = rootElem.querySelector('#quotes-status');
  const sort = rootElem.querySelector('#quotes-sort');
  search?.addEventListener('input', () => {
    searchValue = search.value;
    renderRows();
  });
  status?.addEventListener('change', () => {
    statusValue = status.value;
    renderRows();
  });
  sort?.addEventListener('change', () => {
    sortValue = sort.value;
    renderRows();
  });
  rootElem.querySelector('[data-quotes-body]')?.addEventListener('click', async event => {
    const button = event.target.closest('[data-delete-quote]');
    if (!button) return;
    const quoteId = button.dataset.deleteQuote;
    const { payments } = getState();
    if (payments.some(payment => payment.quoteId === quoteId)) {
      toast.warning('This quote has payment history and cannot be deleted.');
      return;
    }
    const confirmed = await confirmModal({
      title: 'Delete this quote?',
      body: '<p>This permanently removes the quote. This action cannot be undone.</p>',
      confirmLabel: 'Delete quote',
      confirmClass: 'btn-danger',
    });
    if (!confirmed) return;
    button.disabled = true;
    try {
      await removeQuote(quoteId);
      toast.success('Quote deleted.');
    } catch (error) {
      console.error('Could not delete quote:', error);
      toast.error(error.message || 'Could not delete the quote. Please try again.');
      button.disabled = false;
    }
  });
}

export function mount(container) {
  searchValue = '';
  statusValue = 'all';
  sortValue = 'newest';
  rootElem = render();
  container.replaceChildren(rootElem);
  bindEvents();
  renderRows();
  unsubscribeQuotes = subscribe('quotes', renderRows);
  unsubscribePayments = subscribe('payments', renderRows);
}

export function unmount() {
  unsubscribeQuotes?.();
  unsubscribePayments?.();
  unsubscribeQuotes = null;
  unsubscribePayments = null;
  rootElem?.remove();
  rootElem = null;
}