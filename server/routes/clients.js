const express = require('express');
const auth = require('../middleware/auth');
const Client = require('../models/Client');
const Project = require('../models/Project');
const Task = require('../models/Task');
const TimeLog = require('../models/TimeLog');
const Invoice = require('../models/Invoice');

const router = express.Router();

// All routes require authentication
router.use(auth);

// GET /api/clients
router.get('/', async (req, res) => {
  try {
    const clients = await Client.find({ userId: req.user.id }).sort({ createdAt: -1 });

    // Attach project count for each client
    const clientsWithCounts = await Promise.all(
      clients.map(async (client) => {
        const projectCount = await Project.countDocuments({ userId: req.user.id, clientId: client._id });
        return { ...client.toObject(), projectCount };
      })
    );

    res.json({ success: true, data: clientsWithCounts });
  } catch (err) {
    console.error('Get clients error:', err);
    res.status(500).json({ success: false, error: 'Failed to fetch clients' });
  }
});

// POST /api/clients — Free plan: max 2 clients
router.post('/', async (req, res) => {
  try {
    // Enforce free plan limit
    if (req.user.plan === 'free') {
      const count = await Client.countDocuments({ userId: req.user.id });
      if (count >= 2) {
        return res.status(403).json({
          success: false,
          error: 'Free plan allows max 2 clients. Upgrade to Pro for unlimited clients.',
        });
      }
    }

    const { name, email, company, phone, hourlyRate } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, error: 'Client name is required' });
    }

    const client = await Client.create({
      userId: req.user.id,
      name: name.trim(),
      email: email || '',
      company: company || '',
      phone: phone || '',
      hourlyRate: Number(hourlyRate) || 0,
    });

    res.status(201).json({ success: true, data: client });
  } catch (err) {
    console.error('Create client error:', err);
    res.status(500).json({ success: false, error: 'Failed to create client' });
  }
});

// GET /api/clients/:id
router.get('/:id', async (req, res) => {
  try {
    const client = await Client.findOne({ _id: req.params.id, userId: req.user.id });
    if (!client) {
      return res.status(404).json({ success: false, error: 'Client not found' });
    }

    const projectCount = await Project.countDocuments({ userId: req.user.id, clientId: client._id });

    res.json({ success: true, data: { ...client.toObject(), projectCount } });
  } catch (err) {
    console.error('Get client error:', err);
    res.status(500).json({ success: false, error: 'Failed to fetch client' });
  }
});

// PUT /api/clients/:id
router.put('/:id', async (req, res) => {
  try {
    const { name, email, company, phone, hourlyRate } = req.body;

    const client = await Client.findOneAndUpdate(
      { _id: req.params.id, userId: req.user.id },
      {
        ...(name !== undefined && { name: name.trim() }),
        ...(email !== undefined && { email }),
        ...(company !== undefined && { company }),
        ...(phone !== undefined && { phone }),
        ...(hourlyRate !== undefined && { hourlyRate: Number(hourlyRate) }),
      },
      { new: true }
    );

    if (!client) {
      return res.status(404).json({ success: false, error: 'Client not found' });
    }

    res.json({ success: true, data: client });
  } catch (err) {
    console.error('Update client error:', err);
    res.status(500).json({ success: false, error: 'Failed to update client' });
  }
});

// DELETE /api/clients/:id — cascades to projects, tasks, timelogs, invoices
router.delete('/:id', async (req, res) => {
  try {
    const client = await Client.findOne({ _id: req.params.id, userId: req.user.id });
    if (!client) {
      return res.status(404).json({ success: false, error: 'Client not found' });
    }

    // Find all projects for this client
    const projectIds = await Project.find({ userId: req.user.id, clientId: client._id }).distinct('_id');

    // Cascade delete
    await Task.deleteMany({ userId: req.user.id, projectId: { $in: projectIds } });
    await TimeLog.deleteMany({ userId: req.user.id, projectId: { $in: projectIds } });
    await Invoice.deleteMany({ userId: req.user.id, clientId: client._id });
    await Project.deleteMany({ userId: req.user.id, clientId: client._id });
    await Client.deleteOne({ _id: client._id, userId: req.user.id });

    res.json({ success: true, data: { message: 'Client and all related data deleted' } });
  } catch (err) {
    console.error('Delete client error:', err);
    res.status(500).json({ success: false, error: 'Failed to delete client' });
  }
});

module.exports = router;
