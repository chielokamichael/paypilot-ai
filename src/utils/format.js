/**
 * PayPilot AI — Formatting Utilities
 *
 * Pure functions for formatting numbers, currencies, and dates.
 * No side effects.
 */

/**
 * Format a number as currency.
 * @param {number} amount
 * @param {string} currency - ISO 4217 code (e.g. 'USD', 'GBP')
 * @returns {string} e.g. '$1,250.00'
 */
export function formatCurrency(amount, currency = 'USD') {
  try {
    return new Intl.NumberFormat('en-US', {
      style:    'currency',
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    // Fallback if currency code is invalid
    return `${currency} ${Number(amount).toFixed(2)}`;
  }
}

/**
 * Format a number with thousand separators.
 * @param {number} n
 * @returns {string} e.g. '1,250.00'
 */
export function formatNumber(n, decimals = 2) {
  return Number(n).toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/**
 * Format an ISO date string as a readable date.
 * @param {string} isoString - e.g. '2024-01-15' or full ISO
 * @returns {string} e.g. '15 Jan 2024'
 */
export function formatDate(isoString) {
  if (!isoString) return '—';
  const d = new Date(isoString);
  if (isNaN(d.getTime())) return isoString;
  return d.toLocaleDateString('en-GB', {
    day:   'numeric',
    month: 'short',
    year:  'numeric',
  });
}

/**
 * Format a date as a short relative string.
 * @param {string} isoString
 * @returns {string} e.g. '3 days ago', 'Today'
 */
export function formatRelativeDate(isoString) {
  if (!isoString) return '';
  const date = new Date(isoString);
  const now  = new Date();
  const diffMs = now - date;
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0)  return 'Today';
  if (diffDays === 1)  return 'Yesterday';
  if (diffDays < 7)   return `${diffDays} days ago`;
  if (diffDays < 30)  return `${Math.floor(diffDays / 7)} week${diffDays >= 14 ? 's' : ''} ago`;
  return formatDate(isoString);
}

/**
 * Return today's date as YYYY-MM-DD string.
 */
export function today() {
  return new Date().toISOString().split('T')[0];
}

/**
 * Add `days` to a date and return as YYYY-MM-DD.
 * @param {string} dateStr - YYYY-MM-DD
 * @param {number} days
 */
export function addDays(dateStr, days) {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

/**
 * Generate a short unique ID for new items.
 */
export function uid() {
  return Math.random().toString(36).slice(2, 9);
}

/**
 * Map a quote status to a badge CSS class.
 */
export function quoteStatusBadge(status) {
  const map = {
    draft:    'badge-draft',
    approved: 'badge-approved',
    payment_link_created: 'badge-accent',
    sent:     'badge-accent',
    expired:  'badge-danger',
  };
  return map[status] ?? 'badge-neutral';
}

/**
 * Map a payment status to a badge CSS class.
 */
export function paymentStatusBadge(status) {
  const map = {
    awaiting_approval:    'badge-warning',
    approved:             'badge-warning',
    captured_simulation:  'badge-approved',
    cancelled:            'badge-draft',
    failed:               'badge-danger',
  };
  return map[status] ?? 'badge-neutral';
}

/**
 * Human-readable label for a payment status.
 */
export function paymentStatusLabel(status) {
  const map = {
    awaiting_approval:   'Awaiting client checkout',
    approved:            'Awaiting client checkout',
    captured_simulation: 'Checkout Simulated',
    cancelled:           'Cancelled',
    failed:              'Failed',
  };
  return map[status] ?? status;
}

/**
 * Human-readable label for a quote status.
 */
export function quoteStatusLabel(status) {
  const map = {
    draft:    'Draft',
    approved: 'Ready for payment link',
    payment_link_created: 'Payment link created',
    sent:     'Sent to Client',
    paid:     'Paid (simulation)',
    expired:  'Expired',
  };
  return map[status] ?? status;
}

/**
 * Calculate quote totals from line items.
 * @param {Array} lineItems
 * @param {number} taxRate - as a decimal (0.1 = 10%)
 * @returns {{ subtotal, taxAmount, total }}
 */
export function calcTotals(lineItems, taxRate = 0) {
  const subtotal  = lineItems.reduce((sum, li) => sum + (li.total ?? 0), 0);
  const taxAmount = subtotal * taxRate;
  const total     = subtotal + taxAmount;
  return {
    subtotal:  Math.round(subtotal  * 100) / 100,
    taxAmount: Math.round(taxAmount * 100) / 100,
    total:     Math.round(total     * 100) / 100,
  };
}

/**
 * Recalculate milestone payment amounts based on total and fractions.
 * Adjusts the last milestone to absorb any rounding difference.
 */
export function applyMilestoneAmounts(milestones, total) {
  if (!milestones || milestones.length === 0) return milestones;

  let remaining = total;
  return milestones.map((m, i) => {
    if (i === milestones.length - 1) {
      // Last milestone gets whatever is left (handles rounding)
      return { ...m, paymentAmount: Math.round(remaining * 100) / 100 };
    }
    const frac   = m._paymentFraction ?? (1 / milestones.length);
    const amount = Math.round(total * frac * 100) / 100;
    remaining   -= amount;
    return { ...m, paymentAmount: amount };
  });
}

/**
 * List of supported currencies.
 */
export const CURRENCIES = [
  { code: 'USD', label: 'US Dollar', symbol: '$' },
  { code: 'EUR', label: 'Euro',      symbol: '€' },
  { code: 'GBP', label: 'British Pound', symbol: '£' },
  { code: 'CAD', label: 'Canadian Dollar', symbol: 'CA$' },
  { code: 'AUD', label: 'Australian Dollar', symbol: 'A$' },
  { code: 'JPY', label: 'Japanese Yen', symbol: '¥' },
  { code: 'CHF', label: 'Swiss Franc', symbol: 'CHF' },
  { code: 'NZD', label: 'New Zealand Dollar', symbol: 'NZ$' },
  { code: 'SGD', label: 'Singapore Dollar', symbol: 'S$' },
  { code: 'HKD', label: 'Hong Kong Dollar', symbol: 'HK$' },
];
