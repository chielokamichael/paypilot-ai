/**
 * PayPilot AI — Mock PayPal Sandbox Service
 *
 * Simulates a PayPal order create + capture flow.
 * In production, replace these functions with real PayPal SDK calls
 * via your secure backend (never from the browser with live credentials).
 *
 * IMPORTANT: All outputs of this module are clearly labelled as SIMULATED.
 * No real payment is processed. No real PayPal API is called.
 */

/** Delay for simulating network latency */
const MOCK_DELAY_MS = 2000;

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Simulate creating a PayPal order.
 * In production this calls POST /api/paypal/orders on your backend.
 *
 * @param {object} params
 * @param {number} params.amount   - Total amount
 * @param {string} params.currency - Currency code (e.g. 'USD')
 * @param {string} params.quoteId  - Associated quote ID
 * @returns {Promise<{orderId: string}>}
 */
export async function createOrder({ amount, currency, quoteId }) {
  await delay(MOCK_DELAY_MS);
  // Return a fake order ID
  const orderId = 'SANDBOX-' + Math.random().toString(36).slice(2, 10).toUpperCase();
  return { orderId, sandbox: true };
}

/**
 * Simulate capturing a PayPal order (i.e., completing the payment).
 * In production this calls POST /api/paypal/orders/:id/capture on your backend.
 *
 * @param {object} params
 * @param {string} params.orderId  - The order ID from createOrder
 * @param {string} params.payerEmail - Simulated payer email
 * @returns {Promise<TransactionResult>}
 */
export async function captureOrder({ orderId, payerEmail }) {
  await delay(MOCK_DELAY_MS);

  // 90% chance of success in the simulation
  const succeeded = Math.random() > 0.10;

  if (!succeeded) {
    return {
      success: false,
      sandbox: true,
      status:  'FAILED',
      error:   'Simulated payment failure. In a real scenario this could be a declined card or insufficient funds.',
      transactionId: null,
    };
  }

  const transactionId = 'SIM-TXN-' + Math.random().toString(36).slice(2, 10).toUpperCase();

  return {
    success:       true,
    sandbox:       true,
    status:        'COMPLETED',
    transactionId,
    orderId,
    payerEmail,
    capturedAt:    new Date().toISOString(),
    message:       'Simulated payment captured successfully. This is a sandbox transaction — no real funds were transferred.',
  };
}
