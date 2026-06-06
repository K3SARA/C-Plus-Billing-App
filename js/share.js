if (!window.Money) {
  window.Money = (() => {
    const toCents = (value) => {
      const n = Number(value);
      if (!Number.isFinite(n)) return 0;
      return Math.round((n + Number.EPSILON) * 100);
    };
    const fromCents = (cents) => {
      const n = Number(cents);
      if (!Number.isFinite(n)) return 0;
      return n / 100;
    };
    const round = (value) => fromCents(toCents(value));
    const add = (...values) => fromCents(values.reduce((sum, value) => sum + toCents(value), 0));
    const subtract = (left, right) => fromCents(toCents(left) - toCents(right));
    const multiply = (moneyValue, quantity) => round((Number(moneyValue) || 0) * (Number(quantity) || 0));
    const clampZero = (value) => fromCents(Math.max(0, toCents(value)));
    const isPositive = (value) => toCents(value) > 0;
    const isGreaterThan = (left, right) => toCents(left) > toCents(right);
    return { toCents, fromCents, round, add, subtract, multiply, clampZero, isPositive, isGreaterThan };
  })();
}

class ShareManager {
  constructor() {
    this.currentBill = null;
    this.businessName = 'C Plus Tech Pvt Ltd';
    this.businessAddress = 'Ja-ela';
    this.businessPhone = '+94 75 340 6070';
    this.businessRegNo = '14/2453';
  }

  formatCurrency(value) {
    const n = Money.round(value);
    return n.toLocaleString();
  }

  formatReceiptDate(date) {
    const d = date instanceof Date ? date : new Date(date);
    if (Number.isNaN(d.getTime())) return '';
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}/${month}/${day}`;
  }

  escapeHtml(value) {
    return String(value || '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }

  getBillNote(bill) {
    return String(bill?.billNote || bill?.note || '').trim();
  }

  formatMultilineHtml(value) {
    return this.escapeHtml(value).replace(/\r?\n/g, '<br>');
  }

  isIOS() {
    const ua = navigator.userAgent || '';
    const isAppleMobile = /iPad|iPhone|iPod/.test(ua);
    const isIPadOS = navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
    return isAppleMobile || isIPadOS;
  }

  getReceiptStoreKey() {
    return `receipt-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }

  serializeForInlineScript(value) {
    return JSON.stringify(value)
      .replace(/</g, '\\u003c')
      .replace(/>/g, '\\u003e')
      .replace(/&/g, '\\u0026')
      .replace(/\u2028/g, '\\u2028')
      .replace(/\u2029/g, '\\u2029');
  }

  getPaymentMethod(bill) {
    return String(bill?.paymentMethod || (bill?.markAsCredit ? 'credit' : '')).trim().toLowerCase();
  }

  isChequeBill(bill) {
    return this.getPaymentMethod(bill) === 'cheque'
      || Boolean(bill?.chequeDate || bill?.chequeNumber || bill?.chequeBank);
  }

  getChequeAmount(bill) {
    if (!this.isChequeBill(bill)) return 0;
    const explicit = Money.clampZero(bill?.chequeAmount || 0);
    if (Money.isPositive(explicit)) return explicit;
    const received = Money.clampZero(bill?.receivedAmount || 0);
    if (Money.isPositive(received)) return received;
    return Money.clampZero(bill?.total || 0);
  }

  getPayments(bill) {
    if (Array.isArray(bill?.payments) && bill.payments.length) {
      return bill.payments.map((payment, index) => ({
        id: payment.id || `payment-${index + 1}`,
        method: String(payment.method || 'cash').toLowerCase(),
        amount: Money.clampZero(payment.chequeAmount || payment.amount),
        chequeAmount: Money.clampZero(payment.chequeAmount || payment.amount),
        chequeDate: payment.chequeDate || '',
        chequeNumber: payment.chequeNumber || '',
        chequeBank: payment.chequeBank || '',
        chequeStatus: payment.chequeStatus || ''
      }));
    }
    const method = this.getPaymentMethod(bill) || 'cash';
    return [{
      id: 'legacy-payment-1',
      method,
      amount: method === 'cheque' ? this.getChequeAmount(bill) : Money.clampZero(bill?.receivedAmount || 0),
      chequeAmount: method === 'cheque' ? this.getChequeAmount(bill) : 0,
      chequeDate: bill?.chequeDate || '',
      chequeNumber: bill?.chequeNumber || '',
      chequeBank: bill?.chequeBank || '',
      chequeStatus: bill?.chequeStatus || ''
    }];
  }

  methodLabel(method) {
    const labels = { cash: 'Cash', card: 'Card', bank: 'Bank Transfer', cheque: 'Cheque', credit: 'Credit', multiple: 'Multiple' };
    return labels[String(method || '').toLowerCase()] || String(method || 'Payment');
  }

  formatA4Money(value) {
    return `RS.${this.formatCurrency(value)}`;
  }

  getA4PrintStyles() {
    return `
  @import url('https://fonts.googleapis.com/css2?family=Open+Sans:wght@400;500;600;700;800&display=swap');
  @page { size: A4; margin: 0; }
  * { box-sizing: border-box; }
  html, body { margin: 0; min-height: 100%; }
  body {
    background: #edf2f7;
    color: #181818;
    font-family: "Open Sans", Arial, sans-serif;
    font-size: 14px;
    line-height: 1.45;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .screen-actions {
    position: sticky;
    top: 0;
    z-index: 30;
    display: flex;
    gap: 8px;
    padding: 10px;
    background: #fff;
    border-bottom: 1px solid #d7d7d7;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  }
  .screen-actions button {
    border: 1px solid #111;
    border-radius: 8px;
    background: #fff;
    color: #111;
    padding: 8px 12px;
    font: inherit;
    font-size: 13px;
    font-weight: 800;
    cursor: pointer;
  }
  .screen-actions .back-btn {
    background: #2d4059;
    color: #fff;
  }
  .invoice-page {
    position: relative;
    width: 210mm;
    min-height: 297mm;
    margin: 0 auto;
    padding: 27mm 20mm 36mm;
    overflow: hidden;
    background: #fff;
    box-shadow: 0 18px 55px rgba(16, 24, 40, 0.16);
  }
  .invoice-top-accent {
    position: absolute;
    top: 0;
    left: 0;
    width: 150mm;
    height: 16mm;
    border-bottom-right-radius: 20mm;
    background: linear-gradient(90deg, #2d4059 0 72%, #31b9c5 72% 84%, #1978b8 84% 92%, #ef4b9b 92% 97%, #ffd21e 97% 100%);
  }
  .invoice-bottom-accent {
    position: absolute;
    left: 0;
    bottom: 0;
    width: 184mm;
    height: 14mm;
    background: linear-gradient(90deg, #2d4059 0 48%, #31b9c5 48% 68%, #1978b8 68% 84%, #ef4b9b 84% 94%, #ffd21e 94% 100%);
  }
  .invoice-corner-soft,
  .invoice-corner-fill {
    position: absolute;
    right: 14mm;
    bottom: 10mm;
    border-radius: 12mm;
  }
  .invoice-corner-soft {
    width: 26mm;
    height: 26mm;
    background: #e8eef5;
  }
  .invoice-corner-fill {
    right: 18mm;
    bottom: 14mm;
    width: 18mm;
    height: 18mm;
    background: #31b9c5;
    border-radius: 7mm;
  }
  .invoice-dots {
    position: absolute;
    top: 15mm;
    right: 12mm;
    width: 43mm;
    height: 38mm;
    background-image: radial-gradient(circle, #2d4059 0 1.7mm, transparent 1.8mm);
    background-size: 8mm 8mm;
    opacity: 0.96;
  }
  .invoice-soft-square {
    position: absolute;
    top: 15mm;
    right: 14mm;
    width: 29mm;
    height: 25mm;
    border-radius: 8mm;
    background: #edf8fb;
  }
  .invoice-content {
    position: relative;
    z-index: 2;
  }
  .invoice-title {
    margin: 0 0 17mm;
    color: #2d4059;
    font-size: 44px;
    font-weight: 400;
    letter-spacing: 0.08em;
    line-height: 1;
    text-transform: uppercase;
  }
  .brand-row {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 12mm;
  }
  .brand-logo {
    display: block;
    width: 18mm;
    height: 18mm;
    border: 1px solid rgba(45, 64, 89, 0.18);
    border-radius: 4mm;
    background: #2d4059;
    object-fit: cover;
  }
  .brand-name {
    color: #2d4059;
    font-size: 24px;
    font-weight: 800;
    line-height: 1.1;
  }
  .brand-sub {
    margin-top: 2px;
    color: #555;
    font-size: 12px;
    font-weight: 700;
  }
  .invoice-party-grid {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 58mm;
    gap: 16mm;
    margin-bottom: 14mm;
  }
  .section-label,
  .method-title {
    margin: 0 0 5mm;
    color: #2d4059;
    font-size: 16px;
    font-weight: 800;
    letter-spacing: 0.03em;
  }
  .customer-name {
    margin: 0 0 4mm;
    color: #2d4059;
    font-size: 18px;
    font-weight: 800;
  }
  .customer-lines,
  .payment-lines,
  .invoice-footer {
    color: #111;
    font-size: 14px;
    line-height: 1.65;
  }
  .meta-table {
    width: 100%;
    border-collapse: collapse;
    color: #2d4059;
    font-size: 17px;
  }
  .meta-table th {
    width: 29mm;
    padding: 0 0 5mm;
    text-align: left;
    font-weight: 800;
    letter-spacing: 0.03em;
  }
  .meta-table td {
    padding: 0 0 5mm;
    text-align: right;
    font-weight: 400;
  }
  .invoice-table {
    width: 100%;
    border-collapse: collapse;
    margin-bottom: 10mm;
    color: #111827;
    font-size: 14px;
  }
  .invoice-table th,
  .invoice-table td {
    border-top: 1.5px solid #2d4059;
    padding: 5mm 4mm;
    vertical-align: top;
  }
  .invoice-table th {
    font-size: 15px;
    font-weight: 800;
    text-align: left;
  }
  .invoice-table tbody tr:last-child td {
    border-bottom: 1.5px solid #2d4059;
  }
  .invoice-table .qty,
  .invoice-table .num {
    text-align: center;
    white-space: nowrap;
  }
  .invoice-table .num {
    text-align: right;
  }
  .invoice-note {
    margin: -2mm 0 10mm;
    padding: 5mm 6mm;
    border-left: 2mm solid #31b9c5;
    background: #edf8fb;
    color: #111;
  }
  .invoice-note .section-label {
    margin-bottom: 2mm;
    font-size: 13px;
  }
  .invoice-note-text {
    font-size: 13px;
    line-height: 1.6;
    overflow-wrap: anywhere;
  }
  .waybill-info-grid {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    gap: 12mm;
    margin-bottom: 12mm;
  }
  .waybill-box {
    min-height: 38mm;
    padding: 5mm 6mm;
    border: 1.5px solid #2d4059;
    color: #111;
  }
  .waybill-box-title {
    margin: 0 0 4mm;
    color: #2d4059;
    font-size: 14px;
    font-weight: 800;
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }
  .waybill-detail-row {
    display: grid;
    grid-template-columns: 34mm minmax(0, 1fr);
    gap: 4mm;
    padding: 1.5mm 0;
    font-size: 13px;
    line-height: 1.45;
  }
  .waybill-detail-row strong {
    font-weight: 800;
  }
  .waybill-signature-grid {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    gap: 18mm;
    align-items: end;
    margin-top: 20mm;
  }
  .waybill-signature-line {
    border-top: 1.5px solid #2d4059;
    padding-top: 4mm;
    text-align: center;
    font-size: 14px;
    letter-spacing: 0.02em;
  }
  .payment-summary-grid {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 60mm;
    gap: 16mm;
    align-items: start;
    margin-bottom: 10mm;
  }
  .payment-method {
    padding-top: 3mm;
  }
  .payment-line {
    display: grid;
    grid-template-columns: 34mm minmax(0, 1fr);
    gap: 6mm;
    padding: 1.5mm 0;
  }
  .payment-line strong {
    font-weight: 800;
  }
  .totals .row {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 8mm;
    align-items: baseline;
    padding: 2.6mm 0;
    color: #2d4059;
    font-size: 14px;
  }
  .totals .row span:last-child,
  .totals .row strong:last-child {
    text-align: right;
    white-space: nowrap;
  }
  .totals .row.total {
    border-top: 1.5px solid #2d4059;
    font-size: 22px;
    font-weight: 800;
  }
  .totals .payment-heading {
    padding-top: 2mm;
    font-weight: 800;
  }
  .payment-block {
    padding: 1mm 0;
  }
  .detail-row {
    padding: 1.2mm 0 1.2mm 6mm !important;
    color: #333;
    font-size: 12px !important;
  }
  .invoice-closing {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 66mm;
    gap: 18mm;
    align-items: end;
    margin-top: 11mm;
  }
  .thanks {
    color: #2d4059;
    font-size: 19px;
    font-weight: 400;
  }
  .signature-line {
    border-top: 1.5px solid #2d4059;
    padding-top: 4mm;
    text-align: center;
    font-size: 14px;
    letter-spacing: 0.02em;
  }
  .invoice-footer {
    position: absolute;
    z-index: 2;
    left: 20mm;
    right: 46mm;
    bottom: 18mm;
    display: flex;
    gap: 18mm;
    align-items: center;
    color: #111;
  }
  .footer-item {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    min-width: 0;
  }
  .footer-icon {
    display: inline-grid;
    place-items: center;
    width: 8mm;
    height: 8mm;
    border: 1.5px solid #31b9c5;
    border-radius: 50%;
    color: #31b9c5;
    font-size: 13px;
    line-height: 1;
  }
  .invoice-page.invoice-compact {
    padding: 20mm 16mm 26mm;
  }
  .invoice-compact .invoice-top-accent {
    height: 12mm;
  }
  .invoice-compact .invoice-bottom-accent {
    height: 10mm;
  }
  .invoice-compact .invoice-corner-soft {
    width: 20mm;
    height: 20mm;
    bottom: 8mm;
  }
  .invoice-compact .invoice-corner-fill {
    width: 13mm;
    height: 13mm;
    right: 18mm;
    bottom: 12mm;
  }
  .invoice-compact .invoice-dots {
    top: 12mm;
    right: 10mm;
    width: 34mm;
    height: 28mm;
    background-size: 6mm 6mm;
  }
  .invoice-compact .invoice-soft-square {
    top: 12mm;
    right: 13mm;
    width: 23mm;
    height: 19mm;
  }
  .invoice-compact .invoice-title {
    margin-bottom: 8mm;
    font-size: 34px;
  }
  .invoice-compact .brand-row {
    margin-bottom: 7mm;
  }
  .invoice-compact .brand-logo {
    width: 14mm;
    height: 14mm;
    border-radius: 3mm;
  }
  .invoice-compact .brand-name {
    font-size: 20px;
  }
  .invoice-compact .brand-sub {
    font-size: 11px;
  }
  .invoice-compact .invoice-party-grid {
    grid-template-columns: minmax(0, 1fr) 52mm;
    gap: 10mm;
    margin-bottom: 7mm;
  }
  .invoice-compact .section-label,
  .invoice-compact .method-title {
    margin-bottom: 2mm;
    font-size: 13px;
  }
  .invoice-compact .customer-name {
    margin-bottom: 1mm;
    font-size: 15px;
  }
  .invoice-compact .customer-lines,
  .invoice-compact .payment-lines,
  .invoice-compact .invoice-footer {
    font-size: 11.5px;
    line-height: 1.35;
  }
  .invoice-compact .meta-table {
    font-size: 13px;
  }
  .invoice-compact .meta-table th,
  .invoice-compact .meta-table td {
    padding-bottom: 2mm;
  }
  .invoice-compact .invoice-table {
    margin-bottom: 5mm;
    font-size: 11.5px;
    line-height: 1.25;
  }
  .invoice-compact .invoice-table th,
  .invoice-compact .invoice-table td {
    padding: 1.6mm 2.2mm;
  }
  .invoice-compact .invoice-table th {
    font-size: 12px;
  }
  .invoice-compact .invoice-note {
    margin: -1mm 0 5mm;
    padding: 3mm 4mm;
  }
  .invoice-compact .invoice-note .section-label {
    margin-bottom: 1mm;
    font-size: 11.5px;
  }
  .invoice-compact .invoice-note-text {
    font-size: 11px;
    line-height: 1.35;
  }
  .invoice-compact .payment-summary-grid {
    grid-template-columns: minmax(0, 1fr) 54mm;
    gap: 10mm;
    margin-bottom: 5mm;
  }
  .invoice-compact .payment-method {
    padding-top: 1mm;
  }
  .invoice-compact .payment-line {
    grid-template-columns: 26mm minmax(0, 1fr);
    gap: 4mm;
    padding: 0.8mm 0;
  }
  .invoice-compact .totals .row {
    gap: 4mm;
    padding: 1.2mm 0;
    font-size: 11.5px;
  }
  .invoice-compact .totals .row.total {
    font-size: 16px;
  }
  .invoice-compact .detail-row {
    padding: 0.6mm 0 0.6mm 4mm !important;
    font-size: 10.5px !important;
  }
  .invoice-compact .invoice-closing {
    gap: 10mm;
    margin-top: 4mm;
  }
  .invoice-compact .thanks {
    font-size: 15px;
  }
  .invoice-compact .signature-line {
    padding-top: 2.5mm;
    font-size: 11.5px;
  }
  .invoice-compact .invoice-footer {
    left: 16mm;
    right: 38mm;
    bottom: 12mm;
    gap: 12mm;
  }
  .invoice-compact .footer-icon {
    width: 6mm;
    height: 6mm;
    font-size: 10px;
  }
  @media screen {
    body { padding: 18px; }
  }
  @media (max-width: 820px) {
    body { padding: 0; background: #fff; }
    .invoice-page {
      width: 100%;
      min-height: 100vh;
      padding: 88px 18px 120px;
      box-shadow: none;
    }
    .invoice-title {
      margin-bottom: 36px;
      font-size: 42px;
    }
    .brand-row,
    .invoice-party-grid,
    .waybill-info-grid,
    .waybill-signature-grid,
    .payment-summary-grid,
    .invoice-closing {
      grid-template-columns: 1fr;
      gap: 24px;
    }
    .brand-row {
      display: flex;
      margin-bottom: 28px;
    }
    .invoice-party-grid {
      margin-bottom: 28px;
    }
    .invoice-table {
      font-size: 12px;
    }
    .invoice-table th,
    .invoice-table td {
      padding: 12px 8px;
    }
    .invoice-footer {
      left: 18px;
      right: 18px;
      bottom: 62px;
      flex-direction: column;
      align-items: flex-start;
      gap: 8px;
    }
  }
  @media print {
    html, body {
      width: 210mm;
      min-height: 297mm;
      padding: 0 !important;
      background: #fff !important;
      overflow: visible !important;
    }
    .screen-actions { display: none !important; }
    .invoice-page {
      width: 210mm !important;
      min-height: 297mm !important;
      margin: 0 !important;
      box-shadow: none !important;
      break-after: page;
      page-break-after: always;
    }
    .invoice-page:last-child {
      break-after: auto;
      page-break-after: auto;
    }
  }`;
  }

  getPrintBackScript(appUrl = '') {
    const safeAppUrl = this.escapeHtml(appUrl || window.location.href);
    return `
  <script>
    function backToApp() {
      try { window.close(); } catch (e) {}
      setTimeout(function () {
        if (window.opener && !window.opener.closed) {
          try { window.opener.focus(); } catch (e) {}
        }
        if (!window.closed && '${safeAppUrl}') {
          window.location.href = '${safeAppUrl}';
        }
      }, 120);
    }
  <\/script>`;
  }

  formatBillText() {
    const b = this.currentBill;
    if (!b) return '';

    let text = `*${this.businessName}*\n`;
    text += `${this.businessAddress}\n`;
    text += `${this.businessPhone}\n`;
    text += `Reg No: ${this.businessRegNo}\n`;
    text += `\n`;
    text += `Bill No: ${b.billNumber || b.id || '-'}\n`;
    text += `Date: ${b.date || new Date(b.timestamp).toLocaleDateString()}\n`;
    text += `Customer: ${b.customerName}\n`;
    if (b.customerPhone) text += `Phone: ${b.customerPhone}\n`;
    if (b.customerAddress) text += `Address: ${b.customerAddress}\n`;
    const billNote = this.getBillNote(b);
    if (billNote) text += `Note: ${billNote}\n`;
    text += `--------------------\n`;
    b.items.forEach((i) => {
      const unit = i.unit ? ` ${i.unit}` : '';
      text += `${i.name} x${i.qty}${unit} @ LKR ${i.price}\n`;
      text += `  = LKR ${this.formatCurrency(Money.multiply(i.price, i.qty))}\n`;
    });
    const total = Money.round(b.total);
    const received = Money.round(b.receivedAmount || 0);
    const balance = typeof b.balanceAmount === 'number' ? Money.clampZero(b.balanceAmount) : Money.clampZero(Money.subtract(total, received));
    const billStatus = b.billStatus || 'active';
    const paymentMethod = this.getPaymentMethod(b);
    const change = Money.clampZero(b.changeAmount || Money.subtract(received, total));
    const paymentStatus = billStatus === 'active'
      ? (Money.isPositive(balance) ? 'due' : 'paid')
      : (b.paymentStatus || billStatus);
    text += `--------------------\n`;
    text += `*Total: LKR ${this.formatCurrency(b.total)}*\n`;
    text += `Received: LKR ${this.formatCurrency(received)}\n`;
    text += `Balance: LKR ${this.formatCurrency(balance)}\n`;
    if (Money.isPositive(change)) text += `Change: LKR ${this.formatCurrency(change)}\n`;
    const payments = this.getPayments(b).filter((payment) => Number(payment.amount) > 0);
    if (payments.length > 1 || paymentMethod === 'multiple') {
      text += `Payment Methods:\n`;
      let chequeIndex = 0;
      payments.forEach((payment) => {
        const label = payment.method === 'cheque' ? `Cheque ${++chequeIndex}` : this.methodLabel(payment.method);
        text += `${label}: LKR ${this.formatCurrency(payment.amount)}\n`;
        if (payment.method === 'cheque') {
          text += `  Date: ${payment.chequeDate || '-'}\n`;
          text += `  No: ${payment.chequeNumber || '-'}\n`;
          text += `  Bank: ${payment.chequeBank || '-'}\n`;
        }
      });
    } else if (paymentMethod) {
      text += `Method: ${this.methodLabel(paymentMethod)}\n`;
      if (this.isChequeBill(b)) {
        text += `Cheque Amount: LKR ${this.formatCurrency(this.getChequeAmount(b))}\n`;
        text += `Cheque Date: ${b.chequeDate || '-'}\n`;
        text += `Cheque No: ${b.chequeNumber || '-'}\n`;
        text += `Bank: ${b.chequeBank || '-'}\n`;
      }
    }
    text += `Status: ${paymentStatus}\n`;
    if (billStatus !== 'active') text += `Bill: ${billStatus}\n`;
    text += `\nThank you for your business!\n`;
    text += `C Plus Tech Billing`;
    return text;
  }

  buildPrintHtml(bill, options = {}) {
    const b = bill;
    const dateObj = b.timestamp ? new Date(b.timestamp) : new Date();
    const dateStr = this.formatReceiptDate(dateObj);
    const displayDate = dateObj.toLocaleDateString();
    const invoiceNo = this.escapeHtml(b.billNumber || b.id || dateObj.getTime());
    const customer = this.escapeHtml(b.customerName || 'Walk-in Customer');
    const phone = this.escapeHtml(b.customerPhone || '');
    const address = this.escapeHtml(b.customerAddress || '');
    const billNote = this.getBillNote(b);
    const billNoteHtml = billNote
      ? `
      <section class="invoice-note">
        <h2 class="section-label">Bill Note</h2>
        <div class="invoice-note-text">${this.formatMultilineHtml(billNote)}</div>
      </section>`
      : '';
    const itemCount = (b.items || []).length;
    const densityClass = itemCount >= 8 ? ' invoice-compact' : '';

    const itemsRows = (b.items || []).map((item) => {
      const name = this.escapeHtml(item.name);
      const qty = Number(item.qty) || 0;
      const unit = item.unit ? ` ${this.escapeHtml(item.unit)}` : ' pcs';
      const price = Number(item.price) || 0;
      const amount = Money.multiply(price, qty);
      return `
        <tr class="item-row">
          <td>${name}</td>
          <td class="qty">${this.escapeHtml(qty.toLocaleString(undefined, { maximumFractionDigits: 2 }))}${unit}</td>
          <td class="num">${this.formatA4Money(price)}</td>
          <td class="num">${this.formatA4Money(amount)}</td>
        </tr>`;
    }).join('');

    const subTotal = Money.round(b.total);
    const received = Money.round(b.receivedAmount || 0);
    const balance = typeof b.balanceAmount === 'number' ? Money.clampZero(b.balanceAmount) : Money.clampZero(Money.subtract(subTotal, received));
    const change = Money.clampZero(b.changeAmount || Money.subtract(received, subTotal));
    const billStatus = b.billStatus || 'active';
    const paymentMethod = this.getPaymentMethod(b);
    const paymentStatus = billStatus === 'active'
      ? (Money.isPositive(balance) ? 'due' : 'paid')
      : (b.paymentStatus || billStatus);
    const payments = this.getPayments(b).filter((payment) => Number(payment.amount) > 0);
    const hasChequePayment = this.isChequeBill(b) || payments.some((payment) => payment.method === 'cheque');
    const paymentLabel = paymentMethod ? this.methodLabel(paymentMethod) : '-';
    const paymentRows = payments.length > 1 || paymentMethod === 'multiple'
      ? `
      <div class="row payment-heading"><span>Payment Methods</span><span></span></div>
      ${(() => {
        let chequeIndex = 0;
        return payments.map((payment) => {
          const label = payment.method === 'cheque' ? `Cheque ${++chequeIndex}` : this.methodLabel(payment.method);
          return `
          <div class="payment-block">
          <div class="row"><span>${this.escapeHtml(label)}</span><span>${this.formatA4Money(payment.amount)}</span></div>
          ${payment.method === 'cheque' ? `
            <div class="row detail-row small"><span>Chq Date</span><span>${this.escapeHtml(payment.chequeDate || '-')}</span></div>
            <div class="row detail-row small"><span>Chq No</span><span>${this.escapeHtml(payment.chequeNumber || '-')}</span></div>
            <div class="row detail-row small"><span>Bank</span><span>${this.escapeHtml(payment.chequeBank || '-')}</span></div>` : ''}
          </div>
        `;
        }).join('');
      })()}`
      : '';
    const chequeAmount = this.getChequeAmount(b);
    const chequeRows = !paymentRows && this.isChequeBill(b)
      ? `
      <div class="payment-block">
      <div class="row"><span>Cheque Amount</span><span>${this.formatA4Money(chequeAmount)}</span></div>
      <div class="row detail-row small"><span>Cheque Date</span><span>${this.escapeHtml(b.chequeDate || '-')}</span></div>
      <div class="row detail-row small"><span>Cheque No</span><span>${this.escapeHtml(b.chequeNumber || '-')}</span></div>
      <div class="row detail-row small"><span>Bank</span><span>${this.escapeHtml(b.chequeBank || '-')}</span></div>
      </div>`
      : '';
    const showToolbar = Boolean(options.showToolbar);
    const appUrl = options.appUrl || window.location.href;
    const appUrlPayload = this.serializeForInlineScript(appUrl);
    const billPayload = this.serializeForInlineScript(b);
    const customerLines = [
      phone ? `<div>${phone}</div>` : '',
      address ? `<div>${address}</div>` : ''
    ].filter(Boolean).join('') || '<div>No address provided</div>';
    const paymentMethodLines = paymentRows
      ? '<div>Split tender used.</div>'
      : `<div class="payment-line"><strong>Method</strong><span>${this.escapeHtml(paymentLabel)}</span></div>`;

    return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Invoice</title>
<style>${this.getA4PrintStyles()}</style>
</head>
<body class="print-mode">
  ${showToolbar ? `<div class="screen-actions">
    <button onclick="window.print()">Print</button>
    <button onclick="editBillInApp()">Edit Bill</button>
    <button class="back-btn" onclick="backToApp()">Back to App</button>
  </div>` : ''}
  <main class="invoice-page receipt${densityClass}">
    <div class="invoice-top-accent"></div>
    <div class="invoice-dots"></div>
    <div class="invoice-soft-square"></div>
    <div class="invoice-bottom-accent"></div>
    <div class="invoice-corner-soft"></div>
    <div class="invoice-corner-fill"></div>

    <div class="invoice-content">
      <h1 class="invoice-title">Invoice</h1>

      <div class="brand-row">
        <img class="brand-logo" src="./icons/logo.png?v=130" alt="C Plus Technologies Logo">
        <div>
          <div class="brand-name">C Plus</div>
          <div class="brand-sub">${this.escapeHtml(this.businessName)}</div>
        </div>
      </div>

      <section class="invoice-party-grid">
        <div>
          <h2 class="section-label">Invoice to:</h2>
          <p class="customer-name">${customer}</p>
          <div class="customer-lines">${customerLines}</div>
        </div>
        <table class="meta-table">
          <tr><th>Invoice#</th><td>${invoiceNo}</td></tr>
          <tr><th>Date</th><td>${this.escapeHtml(displayDate)}</td></tr>
        </table>
      </section>

      <table class="invoice-table">
        <thead>
          <tr>
            <th>Item</th>
            <th class="qty">Quantity</th>
            <th class="num">Unit Price</th>
            <th class="num">Total</th>
          </tr>
        </thead>
        <tbody>
          ${itemsRows || '<tr><td colspan="4">No items</td></tr>'}
        </tbody>
      </table>

      ${billNoteHtml}

      <section class="payment-summary-grid">
        <div class="payment-method">
          <h2 class="method-title">PAYMENT METHOD</h2>
          <div class="payment-lines">
            ${paymentMethodLines}
            ${hasChequePayment ? '<div>Cheque details are listed in the summary.</div>' : ''}
            <div>${this.escapeHtml(this.businessName)}</div>
          </div>
        </div>
        <div class="totals">
          <div class="row"><span>Subtotal</span><span>${this.formatA4Money(subTotal)}</span></div>
          <div class="row"><span>Tax (0%)</span><span>${this.formatA4Money(0)}</span></div>
          <div class="row total"><strong>Total</strong><strong>${this.formatA4Money(subTotal)}</strong></div>
          ${hasChequePayment ? '' : `<div class="row"><span>Received</span><span>${this.formatA4Money(received)}</span></div>`}
          <div class="row"><span>Balance</span><span>${this.formatA4Money(balance)}</span></div>
          ${Money.isPositive(change) ? `<div class="row"><span>Change</span><span>${this.formatA4Money(change)}</span></div>` : ''}
          ${paymentRows}
          ${hasChequePayment ? '' : `<div class="row"><span>Payment Status</span><span>${this.escapeHtml(paymentStatus)}</span></div>`}
          ${billStatus !== 'active' ? `<div class="row"><span>Bill Status</span><span>${this.escapeHtml(billStatus)}</span></div>` : ''}
          ${chequeRows}
        </div>
      </section>

      <section class="invoice-closing">
        <div class="thanks">Thank you for your business!</div>
        <div class="signature-line">Authorized Signed</div>
      </section>
    </div>

    <footer class="invoice-footer">
      <div class="footer-item"><span class="footer-icon">T</span><span>${this.escapeHtml(this.businessPhone)}</span></div>
      <div class="footer-item"><span class="footer-icon">A</span><span>${this.escapeHtml(this.businessAddress)}</span></div>
    </footer>
  </main>
  <script>
    const BILL_DATA = ${billPayload};
    const APP_URL = ${appUrlPayload};

    function editBillInApp() {
      let opened = false;
      try {
        if (window.opener && !window.opener.closed && window.opener.billing && typeof window.opener.billing.setEditMode === 'function') {
          window.opener.billing.setEditMode(BILL_DATA);
          if (window.opener.app && typeof window.opener.app.closeModal === 'function') {
            window.opener.app.closeModal('share-modal');
          }
          try { window.opener.focus(); } catch (e) {}
          opened = true;
        }
      } catch (e) {}

      if (!opened) {
        window.location.href = APP_URL;
        return;
      }

      setTimeout(function () {
        try { window.close(); } catch (e) {}
      }, 120);
    }

    function backToApp() {
      try { window.close(); } catch (e) {}
      setTimeout(function () {
        if (window.opener && !window.opener.closed) {
          try { window.opener.focus(); } catch (e) {}
        }
        if (!window.closed) {
          window.location.href = APP_URL;
        }
      }, 120);
    }
  </script>
</body>
</html>`;
  }

  printReceipt() {
    const b = this.currentBill;
    if (!b) {
      alert('No bill selected to print.');
      return;
    }

    // Purge all previous receipt keys to prevent localStorage from filling up.
    Object.keys(localStorage)
      .filter((k) => k.startsWith('receipt-'))
      .forEach((k) => localStorage.removeItem(k));

    const receiptKey = this.getReceiptStoreKey();
    try {
      localStorage.setItem(receiptKey, JSON.stringify({
        bill: b,
        appUrl: window.location.href
      }));
    } catch (err) {
      alert('Unable to prepare receipt. Please free browser storage and try again.');
      return;
    }

    const printWindow = window.open(`receipt-print.html?receipt=${encodeURIComponent(receiptKey)}`, '_blank');
    if (!printWindow) {
      alert('Popup blocked. Please allow popups to print.');
    }
  }

  getTodayInputDate() {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  formatInputDate(value) {
    const raw = String(value || '').trim();
    if (!raw) return new Date().toLocaleDateString();
    const parts = raw.split('-').map((part) => Number(part));
    if (parts.length !== 3 || parts.some((part) => !Number.isFinite(part))) return raw;
    return new Date(parts[0], parts[1] - 1, parts[2]).toLocaleDateString();
  }

  openWaybillModal() {
    if (!this.currentBill) {
      alert('No bill selected to create a waybill.');
      return;
    }

    const dateInput = document.getElementById('waybill-delivery-date');
    if (dateInput && !dateInput.value) dateInput.value = this.getTodayInputDate();

    window.app?.closeModal('share-modal');
    window.app?.openModal('waybill-modal');
  }

  getWaybillDetailsFromModal() {
    const deliveryDateInput = document.getElementById('waybill-delivery-date');
    return {
      deliveryDate: deliveryDateInput?.value || this.getTodayInputDate(),
      vehicleNumber: (document.getElementById('waybill-vehicle')?.value || '').trim(),
      driverName: (document.getElementById('waybill-driver-name')?.value || '').trim(),
      driverPhone: (document.getElementById('waybill-driver-phone')?.value || '').trim()
    };
  }

  printWaybillFromModal() {
    this.printWaybill(this.getWaybillDetailsFromModal());
    window.app?.closeModal('waybill-modal');
  }

  buildWaybillHtml(bill, details = {}) {
    const b = bill || {};
    const dateObj = b.timestamp ? new Date(b.timestamp) : new Date();
    const invoiceNo = this.escapeHtml(b.billNumber || b.id || dateObj.getTime());
    const customer = this.escapeHtml(b.customerName || 'Walk-in Customer');
    const phone = this.escapeHtml(b.customerPhone || '');
    const address = this.escapeHtml(b.customerAddress || '');
    const deliveryDate = this.escapeHtml(this.formatInputDate(details.deliveryDate));
    const vehicleNumber = this.escapeHtml(details.vehicleNumber || '-');
    const driverName = this.escapeHtml(details.driverName || '-');
    const driverPhone = this.escapeHtml(details.driverPhone || '-');
    const customerLines = [
      address ? `<div>${address}</div>` : '<div>No address provided</div>',
      phone ? `<div>${phone}</div>` : ''
    ].filter(Boolean).join('');
    const itemsRows = (b.items || []).map((item, index) => {
      const qty = Number(item.qty) || 0;
      const unit = item.unit ? ` ${this.escapeHtml(item.unit)}` : ' pcs';
      return `
        <tr>
          <td>${index + 1}. ${this.escapeHtml(item.name || '')}</td>
          <td class="qty">${this.escapeHtml(qty.toLocaleString(undefined, { maximumFractionDigits: 2 }))}${unit}</td>
        </tr>`;
    }).join('');

    return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Waybill</title>
<style>${this.getA4PrintStyles()}</style>
</head>
<body>
  <div class="screen-actions">
    <button onclick="window.print()">Print</button>
    <button class="back-btn" onclick="backToApp()">Back to App</button>
  </div>
  <main class="invoice-page waybill-page">
    <div class="invoice-top-accent"></div>
    <div class="invoice-dots"></div>
    <div class="invoice-soft-square"></div>
    <div class="invoice-bottom-accent"></div>
    <div class="invoice-corner-soft"></div>
    <div class="invoice-corner-fill"></div>

    <div class="invoice-content">
      <h1 class="invoice-title">Waybill</h1>
      <div class="brand-row">
        <img class="brand-logo" src="./icons/logo.png?v=130" alt="C Plus Technologies Logo">
        <div>
          <div class="brand-name">C Plus</div>
          <div class="brand-sub">${this.escapeHtml(this.businessName)}</div>
        </div>
      </div>

      <section class="invoice-party-grid">
        <div>
          <h2 class="section-label">Deliver to:</h2>
          <p class="customer-name">${customer}</p>
          <div class="customer-lines">${customerLines}</div>
        </div>
        <table class="meta-table">
          <tr><th>Invoice#</th><td>${invoiceNo}</td></tr>
          <tr><th>Delivery</th><td>${deliveryDate}</td></tr>
        </table>
      </section>

      <section class="waybill-info-grid">
        <div class="waybill-box">
          <h2 class="waybill-box-title">Vehicle Details</h2>
          <div class="waybill-detail-row"><strong>Vehicle</strong><span>${vehicleNumber}</span></div>
        </div>
        <div class="waybill-box">
          <h2 class="waybill-box-title">Driver Details</h2>
          <div class="waybill-detail-row"><strong>Name</strong><span>${driverName}</span></div>
          <div class="waybill-detail-row"><strong>Phone</strong><span>${driverPhone}</span></div>
        </div>
      </section>

      <table class="invoice-table">
        <thead>
          <tr>
            <th>Item</th>
            <th class="qty">Quantity</th>
          </tr>
        </thead>
        <tbody>
          ${itemsRows || '<tr><td colspan="2">No items</td></tr>'}
        </tbody>
      </table>

      <section class="waybill-signature-grid">
        <div class="waybill-signature-line">Receiver Signature</div>
        <div class="waybill-signature-line">Receiver Name / Date</div>
      </section>
    </div>

    <footer class="invoice-footer">
      <div class="footer-item"><span class="footer-icon">T</span><span>${this.escapeHtml(this.businessPhone)}</span></div>
      <div class="footer-item"><span class="footer-icon">A</span><span>${this.escapeHtml(this.businessAddress)}</span></div>
    </footer>
  </main>
  <script>
    function backToApp() {
      try { window.close(); } catch (e) {}
      setTimeout(function () {
        if (window.opener && !window.opener.closed) {
          try { window.opener.focus(); } catch (e) {}
        }
      }, 120);
    }
  <\/script>
</body>
</html>`;
  }

  printWaybill(details = {}) {
    const b = this.currentBill;
    if (!b) {
      alert('No bill selected to create a waybill.');
      return;
    }

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Popup blocked. Please allow popups to print.');
      return;
    }

    printWindow.document.open();
    printWindow.document.write(this.buildWaybillHtml(b, details));
    printWindow.document.close();
  }

  buildCollectingOrderPrintHtml(order) {
    const o = order || {};
    const dateObj = o.timestamp ? new Date(o.timestamp) : new Date();
    const dateStr = dateObj.toLocaleDateString();
    const orderNo = this.escapeHtml(o.orderNumber || o.id || dateObj.getTime());
    const customer = this.escapeHtml(o.customerName || 'Walk-in Customer');
    const phone = this.escapeHtml(o.customerPhone || '');
    const address = this.escapeHtml(o.customerAddress || '');
    const itemsRows = (o.items || []).map((item) => `
      <tr>
        <td>${this.escapeHtml(item.name || '')}</td>
        <td class="qty">${this.escapeHtml(this.formatQtyLine(item.qty, item.unit))}</td>
        <td class="num">-</td>
        <td class="num">-</td>
      </tr>
    `).join('');
    const customerLines = [
      phone ? `<div>${phone}</div>` : '',
      address ? `<div>${address}</div>` : ''
    ].filter(Boolean).join('') || '<div>No address provided</div>';

    return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Collecting Order</title>
<style>${this.getA4PrintStyles()}</style>
</head>
<body>
  <div class="screen-actions">
    <button onclick="window.print()">Print</button>
    <button class="back-btn" onclick="backToApp()">Back to App</button>
  </div>
  <script>
    function backToApp() {
      try { window.close(); } catch (e) {}
      setTimeout(function () {
        if (window.opener && !window.opener.closed) {
          try { window.opener.focus(); } catch (e) {}
        }
      }, 120);
    }
  <\/script>
  <main class="invoice-page receipt">
    <div class="invoice-top-accent"></div>
    <div class="invoice-dots"></div>
    <div class="invoice-soft-square"></div>
    <div class="invoice-bottom-accent"></div>
    <div class="invoice-corner-soft"></div>
    <div class="invoice-corner-fill"></div>

    <div class="invoice-content">
      <h1 class="invoice-title">Order</h1>
      <div class="brand-row">
        <img class="brand-logo" src="./icons/logo.png?v=130" alt="C Plus Technologies Logo">
        <div>
          <div class="brand-name">C Plus</div>
          <div class="brand-sub">${this.escapeHtml(this.businessName)}</div>
        </div>
      </div>

      <section class="invoice-party-grid">
        <div>
          <h2 class="section-label">Collecting Order</h2>
          <p class="customer-name">${customer}</p>
          <div class="customer-lines">${customerLines}</div>
        </div>
        <table class="meta-table">
          <tr><th>Order#</th><td>${orderNo}</td></tr>
          <tr><th>Date</th><td>${this.escapeHtml(dateStr)}</td></tr>
        </table>
      </section>

      <table class="invoice-table">
        <thead>
          <tr>
            <th>Item</th>
            <th class="qty">Quantity</th>
            <th class="num">Unit Price</th>
            <th class="num">Total</th>
          </tr>
        </thead>
        <tbody>
          ${itemsRows || '<tr><td colspan="4">No items</td></tr>'}
        </tbody>
      </table>

      <section class="invoice-closing">
        <div class="thanks">Prepared for collection.</div>
        <div class="signature-line">Authorized Signed</div>
      </section>
    </div>

    <footer class="invoice-footer">
      <div class="footer-item"><span class="footer-icon">T</span><span>${this.escapeHtml(this.businessPhone)}</span></div>
      <div class="footer-item"><span class="footer-icon">A</span><span>${this.escapeHtml(this.businessAddress)}</span></div>
    </footer>
  </main>
</body>
</html>`;
  }

  formatQtyLine(qty, unit) {
    const quantity = Number(qty) || 0;
    return `${quantity.toLocaleString(undefined, { maximumFractionDigits: 2 })}${unit ? ` ${String(unit).trim()}` : ''}`;
  }

  printCollectingOrder(order, printWindow = null) {
    if (!order) {
      alert('No collecting order selected to print.');
      return;
    }

    const targetWindow = printWindow || window.open('', '_blank');
    if (!targetWindow) {
      alert('Popup blocked. Please allow popups to print.');
      return;
    }
    targetWindow.document.open();
    targetWindow.document.write(this.buildCollectingOrderPrintHtml(order));
    targetWindow.document.close();
  }

  viaWhatsApp() {
    const text = encodeURIComponent(this.formatBillText());
    if (this.currentBill && this.currentBill.customerPhone) {
      let phone = this.currentBill.customerPhone.replace(/[^0-9]/g, '');
      if (phone.startsWith('0')) phone = '94' + phone.substring(1);
      window.open(`https://wa.me/${phone}?text=${text}`, '_blank');
    } else {
      window.open(`https://wa.me/?text=${text}`, '_blank');
    }
  }

  viaSMS() {
    const text = encodeURIComponent(this.formatBillText());
    const phone = this.currentBill?.customerPhone || '';
    // Use a hidden anchor click so the browser hands the sms: URI to
    // the OS without navigating the current tab away from the app.
    const a = document.createElement('a');
    a.href = `sms:${phone}?body=${text}`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  async copyText() {
    const text = this.formatBillText();
    try {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(text);
        alert('Bill text copied to clipboard!');
      } else {
        alert('Clipboard API not available');
      }
    } catch (e) {
      alert('Failed to copy');
    }
  }
}

window.share = new ShareManager();
