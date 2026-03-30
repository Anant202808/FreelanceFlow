const express = require('express');
const auth = require('../middleware/auth');
const Project = require('../models/Project');
const Client = require('../models/Client');
const Task = require('../models/Task');
const TimeLog = require('../models/TimeLog');

const router = express.Router();

router.use(auth);

// Helper: compute burn rate for a project
async function computeBurnRate(projectId, userId, budget) {
  const logs = await TimeLog.find({ userId, projectId });
  const totalCost = logs.reduce((sum, log) => {
    const hours = (log.durationMinutes || 0) / 60;
    return sum + hours * (log.hourlyRate || 0);
  }, 0);
  const burnRate = budget > 0 ? (totalCost / budget) * 100 : 0;
  return { totalCost: Math.round(totalCost * 100) / 100, burnRate: Math.round(burnRate * 100) / 100 };
}

// GET /api/projects
router.get('/', async (req, res) => {
  try {
    const filter = { userId: req.user.id };
    if (req.query.status) {
      filter.status = req.query.status;
    }
    if (req.query.clientId) {
      filter.clientId = req.query.clientId;
    }

    const projects = await Project.find(filter).sort({ createdAt: -1 }).populate('clientId', 'name company');

    const enriched = await Promise.all(
      projects.map(async (p) => {
        const taskCount = await Task.countDocuments({ userId: req.user.id, projectId: p._id });
        const doneTaskCount = await Task.countDocuments({ userId: req.user.id, projectId: p._id, status: 'done' });
        const { totalCost, burnRate } = await computeBurnRate(p._id, req.user.id, p.budget);
        return {
          ...p.toObject(),
          clientName: p.clientId?.name || 'Unknown',
          clientCompany: p.clientId?.company || '',
          taskCount,
          doneTaskCount,
          totalCost,
          burnRate,
        };
      })
    );

    res.json({ success: true, data: enriched });
  } catch (err) {
    console.error('Get projects error:', err);
    res.status(500).json({ success: false, error: 'Failed to fetch projects' });
  }
});

// POST /api/projects
router.post('/', async (req, res) => {
  try {
    const { clientId, name, status, budget, description } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, error: 'Project name is required' });
    }
    if (!clientId) {
      return res.status(400).json({ success: false, error: 'Client is required' });
    }

    // Verify client belongs to user
    const client = await Client.findOne({ _id: clientId, userId: req.user.id });
    if (!client) {
      return res.status(404).json({ success: false, error: 'Client not found' });
    }

    const project = await Project.create({
      userId: req.user.id,
      clientId,
      name: name.trim(),
      status: status || 'active',
      budget: Number(budget) || 0,
      description: description || '',
    });

    res.status(201).json({ success: true, data: project });
  } catch (err) {
    console.error('Create project error:', err);
    res.status(500).json({ success: false, error: 'Failed to create project' });
  }
});

// GET /api/projects/:id
router.get('/:id', async (req, res) => {
  try {
    const project = await Project.findOne({ _id: req.params.id, userId: req.user.id })
      .populate('clientId', 'name company email phone hourlyRate');

    if (!project) {
      return res.status(404).json({ success: false, error: 'Project not found' });
    }

    const taskCount = await Task.countDocuments({ userId: req.user.id, projectId: project._id });
    const doneTaskCount = await Task.countDocuments({ userId: req.user.id, projectId: project._id, status: 'done' });
    const { totalCost, burnRate } = await computeBurnRate(project._id, req.user.id, project.budget);

    res.json({
      success: true,
      data: {
        ...project.toObject(),
        clientName: project.clientId?.name || 'Unknown',
        taskCount,
        doneTaskCount,
        totalCost,
        burnRate,
      },
    });
  } catch (err) {
    console.error('Get project error:', err);
    res.status(500).json({ success: false, error: 'Failed to fetch project' });
  }
});

// PUT /api/projects/:id
router.put('/:id', async (req, res) => {
  try {
    const { name, status, budget, description, clientId } = req.body;

    // If clientId is being changed, verify the new client belongs to user
    if (clientId) {
      const client = await Client.findOne({ _id: clientId, userId: req.user.id });
      if (!client) {
        return res.status(404).json({ success: false, error: 'Client not found' });
      }
    }

    const project = await Project.findOneAndUpdate(
      { _id: req.params.id, userId: req.user.id },
      {
        ...(name !== undefined && { name: name.trim() }),
        ...(status !== undefined && { status }),
        ...(budget !== undefined && { budget: Number(budget) }),
        ...(description !== undefined && { description }),
        ...(clientId !== undefined && { clientId }),
      },
      { new: true }
    );

    if (!project) {
      return res.status(404).json({ success: false, error: 'Project not found' });
    }

    res.json({ success: true, data: project });
  } catch (err) {
    console.error('Update project error:', err);
    res.status(500).json({ success: false, error: 'Failed to update project' });
  }
});

// DELETE /api/projects/:id — cascades to tasks and timelogs
router.delete('/:id', async (req, res) => {
  try {
    const project = await Project.findOne({ _id: req.params.id, userId: req.user.id });
    if (!project) {
      return res.status(404).json({ success: false, error: 'Project not found' });
    }

    await Task.deleteMany({ userId: req.user.id, projectId: project._id });
    await TimeLog.deleteMany({ userId: req.user.id, projectId: project._id });
    await Project.deleteOne({ _id: project._id });

    res.json({ success: true, data: { message: 'Project and related data deleted' } });
  } catch (err) {
    console.error('Delete project error:', err);
    res.status(500).json({ success: false, error: 'Failed to delete project' });
  }
});

// GET /api/projects/:id/burn-rate
router.get('/:id/burn-rate', async (req, res) => {
  try {
    const project = await Project.findOne({ _id: req.params.id, userId: req.user.id });
    if (!project) {
      return res.status(404).json({ success: false, error: 'Project not found' });
    }

    const { totalCost, burnRate } = await computeBurnRate(project._id, req.user.id, project.budget);

    const logs = await TimeLog.find({ userId: req.user.id, projectId: project._id });
    const totalHours = logs.reduce((sum, l) => sum + (l.durationMinutes || 0) / 60, 0);

    res.json({
      success: true,
      data: {
        budget: project.budget,
        totalCost,
        totalHours: Math.round(totalHours * 100) / 100,
        burnRate,
      },
    });
  } catch (err) {
    console.error('Burn rate error:', err);
    res.status(500).json({ success: false, error: 'Failed to calculate burn rate' });
  }
});

module.exports = router;
