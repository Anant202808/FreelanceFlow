const express = require('express');
const path = require('path');
const auth = require('../middleware/auth');
const Invoice = require('../models/Invoice');
const Client = require('../models/Client');
const TimeLog = require('../models/TimeLog');
const Project = require('../models/Project');
const User = require('../models/User');                          // ← ADDED
const { generateInvoicePDF } = require('../utils/pdfGenerator');

const router = express.Router();

router.use(auth);

// GET /api/invoices
router.get('/', async (req, res) => {
  try {
    const filter = { userId: req.user.id };
    if (req.query.status) {
      filter.status = req.query.status;
    }
    if (req.query.clientId) {
      filter.clientId = req.query.clientId;
    }

    const invoices = await Invoice.find(filter)
      .sort({ createdAt: -1 })
      .populate('clientId', 'name company email');

    const enriched = invoices.map((inv) => ({
      ...inv.toObject(),
      clientName: inv.clientId?.name || 'Unknown',
      clientCompany: inv.clientId?.company || '',
      clientEmail: inv.clientId?.email || '',
    }));

    res.json({ success: true, data: enriched });
  } catch (err) {
    console.error('Get invoices error:', err);
    res.status(500).json({ success: false, error: 'Failed to fetch invoices' });
  }
});

// GET /api/invoices/preview — preview unbilled logs before creating invoice
router.get('/preview', async (req, res) => {
  try {
    // Always fetch fresh plan from DB — never trust cached token value
    const freshUser = await User.findById(req.user.id).select('plan');
    if (!freshUser || freshUser.plan === 'free') {
      return res.status(403).json({
        success: false,
        error: 'Invoice preview requires Pro plan.',
      });
    }

    const { clientId, dateFrom, dateTo } = req.query;

    if (!clientId || !dateFrom || !dateTo) {
      return res.status(400).json({ success: false, error: 'clientId, dateFrom, dateTo are required' });
    }

    const clientProjectIds = await Project.find({ userId: req.user.id, clientId })
      .distinct('_id');

    const unbilledLogs = await TimeLog.find({
      userId: req.user.id,
      projectId: { $in: clientProjectIds },
      isBilled: false,
      startTime: { $gte: new Date(dateFrom), $lte: new Date(dateTo) },
      endTime: { $ne: null },
    }).populate('projectId', 'name');

    const lineItems = unbilledLogs.map((log) => {
      const hours = Math.round((log.durationMinutes / 60) * 100) / 100;
      const rate = log.hourlyRate || 0;
      const amount = Math.round(hours * rate * 100) / 100;
      return {
        timeLogId: log._id,
        description: `${log.projectId?.name || 'Project'} — ${log.notes || 'Time entry'}`,
        hours,
        rate,
        amount,
      };
    });

    const totalAmount = Math.round(lineItems.reduce((sum, item) => sum + item.amount, 0) * 100) / 100;

    res.json({ success: true, data: { lineItems, totalAmount, logCount: unbilledLogs.length } });
  } catch (err) {
    console.error('Preview invoice error:', err);
    res.status(500).json({ success: false, error: 'Failed to preview invoice' });
  }
});

// POST /api/invoices — Pro plan only
router.post('/', async (req, res) => {
  try {
    // Always fetch fresh plan from DB — never trust cached token value
    const freshUser = await User.findById(req.user.id).select('plan');
    if (!freshUser || freshUser.plan === 'free') {
      return res.status(403).json({
        success: false,
        error: 'Invoice creation requires Pro plan. Upgrade to Pro.',
      });
    }

    const { clientId, dateFrom, dateTo } = req.body;

    if (!clientId || !dateFrom || !dateTo) {
      return res.status(400).json({ success: false, error: 'clientId, dateFrom, and dateTo are required' });
    }

    // Verify client belongs to user
    const client = await Client.findOne({ _id: clientId, userId: req.user.id });
    if (!client) {
      return res.status(404).json({ success: false, error: 'Client not found' });
    }

    // Get all projects for this client
    const clientProjectIds = await Project.find({ userId: req.user.id, clientId })
      .distinct('_id');

    // Find unbilled time logs in date range for this client's projects
    const unbilledLogs = await TimeLog.find({
      userId: req.user.id,
      projectId: { $in: clientProjectIds },
      isBilled: false,
      startTime: { $gte: new Date(dateFrom), $lte: new Date(dateTo) },
      endTime: { $ne: null },
    }).populate('projectId', 'name');

    if (unbilledLogs.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No unbilled time logs found for this client in the selected date range',
      });
    }

    // Build line items
    const lineItems = unbilledLogs.map((log) => {
      const hours = Math.round((log.durationMinutes / 60) * 100) / 100;
      const rate = log.hourlyRate || 0;
      const amount = Math.round(hours * rate * 100) / 100;
      return {
        timeLogId: log._id,
        description: `${log.projectId?.name || 'Project'} — ${log.notes || 'Time entry'}`,
        hours,
        rate,
        amount,
      };
    });

    const totalAmount = Math.round(lineItems.reduce((sum, item) => sum + item.amount, 0) * 100) / 100;

    const invoice = await Invoice.create({
      userId: req.user.id,
      clientId,
      status: 'draft',
      totalAmount,
      dateFrom: new Date(dateFrom),
      dateTo: new Date(dateTo),
      lineItems,
    });

    res.status(201).json({ success: true, data: invoice });
  } catch (err) {
    console.error('Create invoice error:', err);
    res.status(500).json({ success: false, error: 'Failed to create invoice' });
  }
});

// GET /api/invoices/:id
router.get('/:id', async (req, res) => {
  try {
    const invoice = await Invoice.findOne({ _id: req.params.id, userId: req.user.id })
      .populate('clientId', 'name company email phone');

    if (!invoice) {
      return res.status(404).json({ success: false, error: 'Invoice not found' });
    }

    res.json({
      success: true,
      data: {
        ...invoice.toObject(),
        clientName: invoice.clientId?.name || 'Unknown',
        clientCompany: invoice.clientId?.company || '',
        clientEmail: invoice.clientId?.email || '',
      },
    });
  } catch (err) {
    console.error('Get invoice error:', err);
    res.status(500).json({ success: false, error: 'Failed to fetch invoice' });
  }
});

// PUT /api/invoices/:id/mark-paid
router.put('/:id/mark-paid', async (req, res) => {
  try {
    const invoice = await Invoice.findOneAndUpdate(
      { _id: req.params.id, userId: req.user.id },
      { status: 'paid' },
      { new: true }
    );

    if (!invoice) {
      return res.status(404).json({ success: false, error: 'Invoice not found' });
    }

    res.json({ success: true, data: invoice });
  } catch (err) {
    console.error('Mark paid error:', err);
    res.status(500).json({ success: false, error: 'Failed to mark invoice as paid' });
  }
});

// POST /api/invoices/:id/generate-pdf — Pro plan only
router.post('/:id/generate-pdf', async (req, res) => {
  try {
    // Always fetch fresh plan from DB — never trust cached token value
    const freshUser = await User.findById(req.user.id).select('plan');
    if (!freshUser || freshUser.plan === 'free') {
      return res.status(403).json({
        success: false,
        error: 'PDF generation requires Pro plan. Upgrade to Pro.',
      });
    }

    const invoice = await Invoice.findOne({ _id: req.params.id, userId: req.user.id })
      .populate('clientId', 'name company email phone');

    if (!invoice) {
      return res.status(404).json({ success: false, error: 'Invoice not found' });
    }

    // Generate PDF
    const pdfFilename = `invoice-${invoice._id}.pdf`;
    const pdfDir = path.join(__dirname, '..', 'generated-invoices');
    const pdfPath = path.join(pdfDir, pdfFilename);

    await generateInvoicePDF({
      invoiceId: invoice._id.toString(),
      clientName: invoice.clientId?.name || 'Unknown',
      clientCompany: invoice.clientId?.company || '',
      clientEmail: invoice.clientId?.email || '',
      clientPhone: invoice.clientId?.phone || '',
      dateFrom: invoice.dateFrom,
      dateTo: invoice.dateTo,
      lineItems: invoice.lineItems,
      totalAmount: invoice.totalAmount,
      createdAt: invoice.createdAt,
    }, pdfPath);

    // Mark all included time logs as billed
    const timeLogIds = invoice.lineItems
      .map((item) => item.timeLogId)
      .filter(Boolean);

    if (timeLogIds.length > 0) {
      await TimeLog.updateMany(
        { _id: { $in: timeLogIds }, userId: req.user.id },
        { isBilled: true }
      );
    }

    // Update invoice with PDF URL and set status to sent
    const pdfUrl = `/invoices/${pdfFilename}`;
    invoice.pdfUrl = pdfUrl;
    if (invoice.status === 'draft') {
      invoice.status = 'sent';
    }
    await invoice.save();

    res.json({ success: true, data: { pdfUrl, invoice } });
  } catch (err) {
    console.error('Generate PDF error:', err);
    res.status(500).json({ success: false, error: 'Failed to generate PDF' });
  }
});

// DELETE /api/invoices/:id
router.delete('/:id', async (req, res) => {
  try {
    const invoice = await Invoice.findOne({ _id: req.params.id, userId: req.user.id });
    if (!invoice) {
      return res.status(404).json({ success: false, error: 'Invoice not found' });
    }

    // Un-bill the time logs that were on this invoice
    const timeLogIds = invoice.lineItems
      .map((item) => item.timeLogId)
      .filter(Boolean);

    if (timeLogIds.length > 0) {
      await TimeLog.updateMany(
        { _id: { $in: timeLogIds }, userId: req.user.id },
        { isBilled: false }
      );
    }

    await Invoice.deleteOne({ _id: invoice._id });

    res.json({ success: true, data: { message: 'Invoice deleted, time logs un-billed' } });
  } catch (err) {
    console.error('Delete invoice error:', err);
    res.status(500).json({ success: false, error: 'Failed to delete invoice' });
  }
});

module.exports = router;