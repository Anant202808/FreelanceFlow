const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

/**
 * Generate a professional invoice PDF
 *
 * @param {Object} data - Invoice data
 * @param {string} data.invoiceId - Invoice ID
 * @param {string} data.clientName - Client name
 * @param {string} data.clientCompany - Client company
 * @param {string} data.clientEmail - Client email
 * @param {string} data.clientPhone - Client phone
 * @param {Date} data.dateFrom - Invoice period start
 * @param {Date} data.dateTo - Invoice period end
 * @param {Array} data.lineItems - Line items [{description, hours, rate, amount}]
 * @param {number} data.totalAmount - Total amount
 * @param {Date} data.createdAt - Invoice creation date
 * @param {string} outputPath - Absolute path for the output PDF file
 */
async function generateInvoicePDF(data, outputPath) {
  // Ensure output directory exists
  const dir = path.dirname(outputPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'A4',
        margins: { top: 50, bottom: 50, left: 50, right: 50 },
      });

      const writeStream = fs.createWriteStream(outputPath);
      doc.pipe(writeStream);

      const pageWidth = doc.page.width - 100; // 50px margin each side
      const formatDate = (d) => {
        if (!d) return '—';
        const date = new Date(d);
        return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
      };
      const formatCurrency = (n) => `$${(n || 0).toFixed(2)}`;

      // ════════════════ HEADER ════════════════
      // Brand bar
      doc.rect(0, 0, doc.page.width, 8).fill('#4F46E5');

      // Company name
      doc.fontSize(28).fillColor('#1E1B4B').font('Helvetica-Bold')
        .text('FreelanceFlow', 50, 30);

      doc.fontSize(9).fillColor('#6B7280').font('Helvetica')
        .text('Professional Services', 50, 62);

      // INVOICE label (right side)
      doc.fontSize(36).fillColor('#E0E7FF').font('Helvetica-Bold')
        .text('INVOICE', 350, 28, { width: pageWidth - 300, align: 'right' });

      // ════════════════ INVOICE META ════════════════
      const metaY = 95;
      doc.moveTo(50, metaY).lineTo(50 + pageWidth, metaY).lineWidth(1).strokeColor('#E5E7EB').stroke();

      doc.fontSize(9).fillColor('#6B7280').font('Helvetica')
        .text('Invoice Number', 50, metaY + 12)
        .text('Invoice Date', 200, metaY + 12)
        .text('Period', 350, metaY + 12);

      const shortId = data.invoiceId.slice(-8).toUpperCase();

      doc.fontSize(11).fillColor('#111827').font('Helvetica-Bold')
        .text(`INV-${shortId}`, 50, metaY + 26)
        .text(formatDate(data.createdAt), 200, metaY + 26)
        .text(`${formatDate(data.dateFrom)} — ${formatDate(data.dateTo)}`, 350, metaY + 26);

      // ════════════════ BILL TO ════════════════
      const billY = metaY + 65;
      doc.moveTo(50, billY).lineTo(50 + pageWidth, billY).lineWidth(1).strokeColor('#E5E7EB').stroke();

      // Bill To box
      doc.rect(50, billY + 10, 240, 80).lineWidth(1).strokeColor('#E5E7EB').stroke();

      doc.fontSize(8).fillColor('#4F46E5').font('Helvetica-Bold')
        .text('BILL TO', 60, billY + 18);

      doc.fontSize(12).fillColor('#111827').font('Helvetica-Bold')
        .text(data.clientName || 'Client', 60, billY + 32);

      doc.fontSize(9).fillColor('#6B7280').font('Helvetica');
      let billTextY = billY + 48;
      if (data.clientCompany) {
        doc.text(data.clientCompany, 60, billTextY);
        billTextY += 13;
      }
      if (data.clientEmail) {
        doc.text(data.clientEmail, 60, billTextY);
        billTextY += 13;
      }
      if (data.clientPhone) {
        doc.text(data.clientPhone, 60, billTextY);
      }

      // ════════════════ LINE ITEMS TABLE ════════════════
      const tableY = billY + 110;

      // Table header
      doc.rect(50, tableY, pageWidth, 28).fill('#4F46E5');

      doc.fontSize(9).fillColor('#FFFFFF').font('Helvetica-Bold');
      doc.text('#', 58, tableY + 9, { width: 25 });
      doc.text('Description', 85, tableY + 9, { width: 220 });
      doc.text('Hours', 310, tableY + 9, { width: 60, align: 'right' });
      doc.text('Rate', 375, tableY + 9, { width: 70, align: 'right' });
      doc.text('Amount', 450, tableY + 9, { width: 90, align: 'right' });

      // Table rows
      let rowY = tableY + 28;
      const lineItems = data.lineItems || [];

      lineItems.forEach((item, index) => {
        const isEven = index % 2 === 0;
        const rowHeight = 24;

        if (isEven) {
          doc.rect(50, rowY, pageWidth, rowHeight).fill('#F9FAFB');
        }

        doc.fontSize(9).fillColor('#374151').font('Helvetica');
        doc.text(`${index + 1}`, 58, rowY + 7, { width: 25 });

        // Truncate description if too long
        const desc = (item.description || 'Time entry').substring(0, 45);
        doc.text(desc, 85, rowY + 7, { width: 220 });
        doc.text((item.hours || 0).toFixed(2), 310, rowY + 7, { width: 60, align: 'right' });
        doc.text(formatCurrency(item.rate || 0), 375, rowY + 7, { width: 70, align: 'right' });
        doc.font('Helvetica-Bold')
          .text(formatCurrency(item.amount || 0), 450, rowY + 7, { width: 90, align: 'right' });

        rowY += rowHeight;

        // Page break if needed
        if (rowY > doc.page.height - 150) {
          doc.addPage();
          rowY = 50;
        }
      });

      // Bottom line of table
      doc.moveTo(50, rowY).lineTo(50 + pageWidth, rowY).lineWidth(1).strokeColor('#E5E7EB').stroke();

      // ════════════════ TOTALS ════════════════
      const totalsY = rowY + 15;
      const totalsX = 375;

      // Subtotal
      const totalHours = lineItems.reduce((s, i) => s + (i.hours || 0), 0);
      doc.fontSize(9).fillColor('#6B7280').font('Helvetica')
        .text('Subtotal:', totalsX, totalsY, { width: 70, align: 'right' });
      doc.fontSize(9).fillColor('#111827').font('Helvetica-Bold')
        .text(formatCurrency(data.totalAmount), 450, totalsY, { width: 90, align: 'right' });

      // Total hours
      doc.fontSize(9).fillColor('#6B7280').font('Helvetica')
        .text('Total Hours:', totalsX, totalsY + 18, { width: 70, align: 'right' });
      doc.fontSize(9).fillColor('#111827').font('Helvetica')
        .text(totalHours.toFixed(2), 450, totalsY + 18, { width: 90, align: 'right' });

      // Grand total
      const grandTotalY = totalsY + 42;
      doc.rect(totalsX - 5, grandTotalY - 4, 170, 28).fill('#4F46E5');
      doc.fontSize(11).fillColor('#FFFFFF').font('Helvetica-Bold')
        .text('TOTAL DUE:', totalsX, grandTotalY + 3, { width: 70, align: 'right' });
      doc.fontSize(14).fillColor('#FFFFFF').font('Helvetica-Bold')
        .text(formatCurrency(data.totalAmount), 450, grandTotalY + 1, { width: 90, align: 'right' });

      // ════════════════ FOOTER ════════════════
      const footerY = doc.page.height - 80;
      doc.moveTo(50, footerY).lineTo(50 + pageWidth, footerY).lineWidth(0.5).strokeColor('#E5E7EB').stroke();

      doc.fontSize(8).fillColor('#9CA3AF').font('Helvetica')
        .text('Thank you for your business!', 50, footerY + 10)
        .text('Payment is due within 30 days of invoice date.', 50, footerY + 22)
        .text(`Generated by FreelanceFlow • ${formatDate(new Date())}`, 50, footerY + 34, {
          width: pageWidth,
          align: 'right',
        });

      // Finalize
      doc.end();

      writeStream.on('finish', resolve);
      writeStream.on('error', reject);
    } catch (err) {
      reject(err);
    }
  });
}

module.exports = { generateInvoicePDF };
