const mongoose = require('mongoose');

const lineItemSchema = new mongoose.Schema({
  timeLogId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'TimeLog',
  },
  description: {
    type: String,
    default: '',
  },
  hours: {
    type: Number,
    default: 0,
  },
  rate: {
    type: Number,
    default: 0,
  },
  amount: {
    type: Number,
    default: 0,
  },
}, { _id: false });

const invoiceSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  clientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Client',
    required: true,
    index: true,
  },
  status: {
    type: String,
    enum: ['draft', 'sent', 'paid'],
    default: 'draft',
  },
  totalAmount: {
    type: Number,
    default: 0,
    min: 0,
  },
  dateFrom: {
    type: Date,
    required: true,
  },
  dateTo: {
    type: Date,
    required: true,
  },
  lineItems: {
    type: [lineItemSchema],
    default: [],
  },
  pdfUrl: {
    type: String,
    default: null,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

invoiceSchema.index({ userId: 1, status: 1 });
invoiceSchema.index({ userId: 1, clientId: 1 });

module.exports = mongoose.model('Invoice', invoiceSchema);