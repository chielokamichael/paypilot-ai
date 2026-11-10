import { getState, subscribe } from '../state/store.js';
import { formatCurrency, formatDate, paymentStatusBadge, paymentStatusLabel } from '../utils/format.js';

let rootElem = null;
let unsubscribeStore = null;

function render() {
  const { payments, quotes } = getState();
  const page = document.createElement('div');
  page.className = 'payments-page';
  page.innerHTML = `
    <section class="section">
      <div class="section__header"><h2 class="section__title">Payments</h2></div>
      <div class="section__content">
        ${payments.length ? `
          <div class="table-scroll"><table class="quote-table">
            <thead><tr><th>Payment</th><th>Client / project</th><th>Status</th><th>Date</th><th class="num">Amount</th><th></th></tr></thead>
            <tbody>${[...payments].reverse().map(payment => {
              const quote = quotes.find(item => item.id === payment.quoteId);
              const target = payment.status === 'awaiting_approval' ? `checkout/${payment.id}` : `payment/${payment.id}`;
              return `
                <tr>
                  <td>${payment.id}</td>
                  <td>${quote?.clientName || 'Unknown client'}<br>${quote?.projectTitle || `Quote #${payment.quoteId}`}</td>
                  <td><span class="badge ${paymentStatusBadge(payment.status)}">${paymentStatusLabel(payment.status)}</span></td>
                  <td>${formatDate(payment.capturedAt || payment.createdAt)}</td>
                  <td class="num">${formatCurrency(payment.amount, payment.currency)}</td>
                  <td><a class="btn btn-secondary btn-sm" href="#route/${target}">Open</a></td>
                </tr>`;
            }).join('')}</tbody>
          </table></div>` : '<div class="empty-state"><p class="empty-state__title">No payments yet</p><p class="empty-state__text">Payment requests and transactions will appear here.</p></div>'}
      </div>
    </section>
  `;
  return page;
}

export function mount(container) {
  rootElem = render();
  container.replaceChildren(rootElem);
  unsubscribeStore = subscribe('payments', () => {
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