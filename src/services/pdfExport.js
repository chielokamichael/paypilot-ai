const COLORS = {
  accent: [8, 118, 71],
  ink: [28, 43, 34],
  muted: [100, 116, 105],
  border: [220, 230, 222],
  surface: [241, 248, 243],
  warning: [125, 76, 15],
  warningSurface: [255, 247, 226],
};

function printableText(value) {
  return String(value ?? '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\x20-\x7E]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function money(value, currency) {
  const amount = Number(value) || 0;
  const formatted = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
  return `${printableText(currency || 'USD')} ${formatted}`;
}

function dateLabel(value) {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) return 'Not specified';
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

function drawText(doc, value, x, y, options = {}) {
  const text = printableText(value);
  if (!text) return y;
  const { size = 10, color = COLORS.ink, bold = false, maxWidth } = options;
  doc.setFont('helvetica', bold ? 'bold' : 'normal');
  doc.setFontSize(size);
  doc.setTextColor(...color);
  const lines = maxWidth ? doc.splitTextToSize(text, maxWidth) : [text];
  doc.text(lines, x, y);
  return y + lines.length * (size + 3);
}

function drawRule(doc, y) {
  doc.setDrawColor(...COLORS.border);
  doc.setLineWidth(0.7);
  doc.line(44, y, 551, y);
}

function drawRunningHeader(doc, title, reference) {
  doc.setFillColor(...COLORS.accent);
  doc.roundedRect(44, 36, 27, 27, 6, 6, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(255, 255, 255);
  doc.text('P', 53, 54);
  doc.setTextColor(...COLORS.ink);
  doc.text('PAYPILOT AI', 80, 48);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...COLORS.muted);
  doc.text('FREELANCE QUOTES AND INVOICES', 80, 60);
  doc.setTextColor(...COLORS.accent);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text(title.toUpperCase(), 551, 48, { align: 'right' });
  doc.setTextColor(...COLORS.muted);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text(printableText(reference), 551, 61, { align: 'right' });
}

function drawTableHeader(doc, y) {
  doc.setFillColor(...COLORS.surface);
  doc.roundedRect(44, y, 507, 24, 4, 4, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...COLORS.muted);
  doc.text('DESCRIPTION', 54, y + 15);
  doc.text('QTY', 365, y + 15, { align: 'right' });
  doc.text('RATE', 450, y + 15, { align: 'right' });
  doc.text('AMOUNT', 541, y + 15, { align: 'right' });
  return y + 34;
}

function drawWrappedSection(doc, title, entries, y, documentTitle, reference) {
  if (!Array.isArray(entries) || !entries.length) return y;
  if (y > 740) {
    doc.addPage();
    y = 52;
  }
  y = drawText(doc, title.toUpperCase(), 44, y, { size: 8, color: COLORS.muted, bold: true }) + 5;
  for (const entry of entries) {
    const lines = doc.splitTextToSize(printableText(entry), 495);
    const height = lines.length * 14 + 5;
    if (y + height > 785) {
      doc.addPage();
      drawRunningHeader(doc, documentTitle, `Reference ${reference}`);
      y = 52;
    }
    y = drawText(doc, `- ${entry}`, 48, y, { size: 9, color: COLORS.ink, maxWidth: 495 }) + 5;
  }
  return y + 8;
}

export async function createTransactionPdf({ type = 'invoice', quote = {}, payment = null, settings = {} }) {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ unit: 'pt', format: 'a4', compress: true });
  const title = type === 'receipt' ? 'Demo Receipt' : type === 'quote' ? 'Project Quote' : 'Client Invoice';
  const reference = payment?.id || quote.id || 'Draft';
  const currency = payment?.currency || settings.currency || 'USD';
  const lineItems = Array.isArray(quote.lineItems) ? quote.lineItems : [];
  const total = payment?.amount ?? lineItems.reduce((sum, item) => {
    return sum + (Number(item.quantity) || 0) * (Number(item.rate) || 0);
  }, 0);
  const clientName = quote.clientName || 'Client';
  const clientEmail = quote.clientEmail || '';
  const merchantName = payment?.merchantName || settings.businessName || 'Freelance Professional';
  const merchantEmail = payment?.payoutEmail || settings.paypalPayoutEmail || settings.businessEmail || '';
  const quoteNumber = payment?.quoteId || quote.id || 'Draft';

  drawRunningHeader(doc, title, `Reference ${reference}`);
  drawText(doc, title, 44, 112, { size: 23, bold: true });
  drawText(doc, `Project: ${quote.projectTitle || 'Project deliverables'}`, 44, 136, { size: 11, color: COLORS.muted });
  drawText(doc, `Document ${quoteNumber}`, 44, 155, { size: 9, color: COLORS.muted });
  drawRule(doc, 174);

  doc.setFillColor(...COLORS.surface);
  doc.roundedRect(44, 190, 245, 76, 7, 7, 'F');
  doc.roundedRect(306, 190, 245, 76, 7, 7, 'F');
  drawText(doc, 'PREPARED FOR', 56, 209, { size: 8, color: COLORS.muted, bold: true });
  drawText(doc, clientName, 56, 229, { size: 11, bold: true, maxWidth: 220 });
  drawText(doc, clientEmail, 56, 249, { size: 9, color: COLORS.muted, maxWidth: 220 });
  drawText(doc, 'PREPARED BY', 318, 209, { size: 8, color: COLORS.muted, bold: true });
  drawText(doc, merchantName, 318, 229, { size: 11, bold: true, maxWidth: 220 });
  drawText(doc, merchantEmail, 318, 249, { size: 9, color: COLORS.muted, maxWidth: 220 });

  let y = drawText(doc, 'ITEMIZED SCOPE', 44, 293, { size: 8, color: COLORS.muted, bold: true }) + 8;
  y = drawTableHeader(doc, y);

  for (const item of lineItems) {
    const description = printableText(item.description || 'Deliverable');
    const qty = Number(item.quantity) || 0;
    const rate = Number(item.rate) || 0;
    const descriptionLines = doc.splitTextToSize(description, 285);
    const itemHeight = Math.max(34, descriptionLines.length * 12 + 19);
    if (y + itemHeight > 748) {
      doc.addPage();
      drawRunningHeader(doc, title, `Reference ${reference}`);
      y = drawText(doc, 'ITEMIZED SCOPE (CONTINUED)', 44, 96, { size: 8, color: COLORS.muted, bold: true }) + 8;
      y = drawTableHeader(doc, y);
    }

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...COLORS.ink);
    doc.text(descriptionLines, 54, y);
    doc.setFontSize(8);
    doc.setTextColor(...COLORS.muted);
    doc.text(`${qty} ${printableText(item.unit || 'units')} x ${money(rate, currency)}`, 54, y + descriptionLines.length * 12 + 1);
    doc.setTextColor(...COLORS.ink);
    doc.text(String(qty), 365, y, { align: 'right' });
    doc.text(money(rate, currency), 450, y, { align: 'right' });
    doc.setFont('helvetica', 'bold');
    doc.text(money(qty * rate, currency), 541, y, { align: 'right' });
    y += itemHeight;
    drawRule(doc, y - 5);
  }

  if (!lineItems.length) {
    y = drawText(doc, 'No line items were included in this document.', 54, y + 3, { size: 9, color: COLORS.muted }) + 10;
  }

  if (y + 90 > 785) {
    doc.addPage();
    drawRunningHeader(doc, title, `Reference ${reference}`);
    y = 90;
  }
  y += 14;
  drawText(doc, type === 'quote' ? 'TOTAL QUOTED' : type === 'receipt' ? 'SIMULATED AMOUNT' : 'TOTAL DUE', 342, y, {
    size: 9, color: COLORS.muted, bold: true,
  });
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(17);
  doc.setTextColor(...COLORS.accent);
  doc.text(money(total, currency), 541, y + 24, { align: 'right' });
  y += 53;

  if (type === 'receipt') {
    const receiptDetails = [
      `Status: ${payment?.status || 'Simulated'}`,
      `Transaction reference: ${payment?.transactionId || `TXN-PAYPAL-${reference}`}`,
      `Date: ${dateLabel(payment?.capturedAt)}`,
      payment?.payerEmail ? `Client: ${payment.payerEmail}` : '',
    ].filter(Boolean);
    y = drawWrappedSection(doc, 'Checkout details', receiptDetails, y, title, reference);
    if (y + 46 > 785) {
      doc.addPage();
      drawRunningHeader(doc, title, `Reference ${reference}`);
      y = 95;
    }
    doc.setFillColor(...COLORS.warningSurface);
    doc.roundedRect(44, y, 507, 48, 6, 6, 'F');
    drawText(doc, 'DEMO RECEIPT - NOT PROOF OF PAYMENT', 56, y + 18, { size: 9, color: COLORS.warning, bold: true });
    drawText(doc, 'Checkout is simulated. No real payment was processed or funds transferred.', 56, y + 34, {
      size: 8, color: COLORS.warning, maxWidth: 480,
    });
  } else {
    const milestones = Array.isArray(quote.milestones)
      ? quote.milestones.map(item => item.name || item.description).filter(Boolean)
      : [];
    y = drawWrappedSection(doc, 'Project milestones', milestones, y, title, reference);
    y = drawWrappedSection(doc, 'Assumptions', quote.assumptions, y, title, reference);
    y = drawWrappedSection(doc, 'Exclusions', quote.exclusions, y, title, reference);
    if (type === 'invoice') {
      if (y + 46 > 785) {
        doc.addPage();
        drawRunningHeader(doc, title, `Reference ${reference}`);
        y = 95;
      }
      doc.setFillColor(...COLORS.warningSurface);
      doc.roundedRect(44, y, 507, 48, 6, 6, 'F');
      drawText(doc, 'SIMULATED CHECKOUT - NO PAYMENT PROCESSED', 56, y + 18, {
        size: 9, color: COLORS.warning, bold: true,
      });
      drawText(doc, 'This demo invoice is not proof of payment. No real funds were transferred.', 56, y + 34, {
        size: 8, color: COLORS.warning, maxWidth: 480,
      });
    }
  }

  const pageCount = doc.getNumberOfPages();
  for (let page = 1; page <= pageCount; page += 1) {
    doc.setPage(page);
    drawRule(doc, 805);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...COLORS.muted);
    doc.text('Generated with PayPilot AI', 44, 821);
    doc.text(`Page ${page} of ${pageCount}`, 551, 821, { align: 'right' });
  }

  return doc;
}

export async function downloadTransactionPdf(options) {
  const doc = await createTransactionPdf(options);
  const reference = printableText(options?.payment?.id || options?.quote?.id || 'draft')
    .replace(/[^a-zA-Z0-9_-]/g, '-');
  const type = options?.type || 'invoice';
  doc.save(`paypilot-${type}-${reference}.pdf`);
}
