const express = require('express');
const auth = require('../middleware/auth');
const TimeLog = require('../models/TimeLog');
const Project = require('../models/Project');

const router = express.Router();

router.use(auth);

// GET /api/timelogs?projectId=xxx&isBilled=false
router.get('/', async (req, res) => {
  try {
    const filter = { userId: req.user.id };
    if (req.query.projectId) {
      filter.projectId = req.query.projectId;
    }
    if (req.query.isBilled !== undefined) {
      filter.isBilled = req.query.isBilled === 'true';
    }
    if (req.query.from || req.query.to) {
      filter.startTime = {};
      if (req.query.from) filter.startTime.$gte = new Date(req.query.from);
      if (req.query.to) filter.startTime.$lte = new Date(req.query.to);
    }

    const logs = await TimeLog.find(filter)
      .sort({ startTime: -1 })
      .populate('projectId', 'name');

    res.json({ success: true, data: logs });
  } catch (err) {
    console.error('Get timelogs error:', err);
    res.status(500).json({ success: false, error: 'Failed to fetch time logs' });
  }
});

// GET /api/timelogs/active — returns currently running timer
router.get('/active', async (req, res) => {
  try {
    const activeLog = await TimeLog.findOne({
      userId: req.user.id,
      endTime: null,
    }).populate('projectId', 'name');

    res.json({ success: true, data: activeLog || null });
  } catch (err) {
    console.error('Get active timer error:', err);
    res.status(500).json({ success: false, error: 'Failed to fetch active timer' });
  }
});

// POST /api/timelogs — manual entry
router.post('/', async (req, res) => {
  try {
    const { projectId, startTime, endTime, durationMinutes, hourlyRate, notes } = req.body;

    if (!projectId) {
      return res.status(400).json({ success: false, error: 'Project is required' });
    }

    // Verify project belongs to user
    const project = await Project.findOne({ _id: projectId, userId: req.user.id });
    if (!project) {
      return res.status(404).json({ success: false, error: 'Project not found' });
    }

    let calcDuration = Number(durationMinutes) || 0;
    let calcStart = startTime ? new Date(startTime) : new Date();
    let calcEnd = endTime ? new Date(endTime) : null;

    // If start and end provided, calculate duration
    if (calcStart && calcEnd) {
      calcDuration = Math.round((calcEnd.getTime() - calcStart.getTime()) / 60000);
    } else if (calcDuration > 0 && !calcEnd) {
      // If only duration provided, set end time
      calcEnd = new Date(calcStart.getTime() + calcDuration * 60000);
    }

    const log = await TimeLog.create({
      userId: req.user.id,
      projectId,
      startTime: calcStart,
      endTime: calcEnd,
      durationMinutes: Math.max(0, calcDuration),
      hourlyRate: Number(hourlyRate) || 0,
      notes: notes || '',
      isBilled: false,
    });

    res.status(201).json({ success: true, data: log });
  } catch (err) {
    console.error('Create timelog error:', err);
    res.status(500).json({ success: false, error: 'Failed to create time log' });
  }
});

// POST /api/timelogs/start — stopwatch start
router.post('/start', async (req, res) => {
  try {
    const { projectId } = req.body;

    if (!projectId) {
      return res.status(400).json({ success: false, error: 'Project is required' });
    }

    // Verify project belongs to user
    const project = await Project.findOne({ _id: projectId, userId: req.user.id });
    if (!project) {
      return res.status(404).json({ success: false, error: 'Project not found' });
    }

    // Check if there's already an active timer
    const existing = await TimeLog.findOne({ userId: req.user.id, endTime: null });
    if (existing) {
      return res.status(400).json({
        success: false,
        error: 'A timer is already running. Stop it first.',
      });
    }

    const log = await TimeLog.create({
      userId: req.user.id,
      projectId,
      startTime: new Date(),
      endTime: null,
      durationMinutes: 0,
      hourlyRate: project.budget > 0 ? 0 : 0, // Will use client rate or manual input
      notes: '',
      isBilled: false,
    });

    res.status(201).json({ success: true, data: log });
  } catch (err) {
    console.error('Start timer error:', err);
    res.status(500).json({ success: false, error: 'Failed to start timer' });
  }
});

// POST /api/timelogs/stop/:id — stopwatch stop
router.post('/stop/:id', async (req, res) => {
  try {
    const log = await TimeLog.findOne({ _id: req.params.id, userId: req.user.id });
    if (!log) {
      return res.status(404).json({ success: false, error: 'Time log not found' });
    }

    if (log.endTime) {
      return res.status(400).json({ success: false, error: 'Timer already stopped' });
    }

    const endTime = new Date();
    const durationMinutes = Math.round((endTime.getTime() - log.startTime.getTime()) / 60000);

    const { hourlyRate, notes } = req.body;

    log.endTime = endTime;
    log.durationMinutes = Math.max(1, durationMinutes); // At least 1 minute
    if (hourlyRate !== undefined) log.hourlyRate = Number(hourlyRate);
    if (notes !== undefined) log.notes = notes;
    await log.save();

    res.json({ success: true, data: log });
  } catch (err) {
    console.error('Stop timer error:', err);
    res.status(500).json({ success: false, error: 'Failed to stop timer' });
  }
});

// PUT /api/timelogs/:id
router.put('/:id', async (req, res) => {
  try {
    const { durationMinutes, hourlyRate, notes, isBilled } = req.body;

    const log = await TimeLog.findOneAndUpdate(
      { _id: req.params.id, userId: req.user.id },
      {
        ...(durationMinutes !== undefined && { durationMinutes: Number(durationMinutes) }),
        ...(hourlyRate !== undefined && { hourlyRate: Number(hourlyRate) }),
        ...(notes !== undefined && { notes }),
        ...(isBilled !== undefined && { isBilled }),
      },
      { new: true }
    );

    if (!log) {
      return res.status(404).json({ success: false, error: 'Time log not found' });
    }

    res.json({ success: true, data: log });
  } catch (err) {
    console.error('Update timelog error:', err);
    res.status(500).json({ success: false, error: 'Failed to update time log' });
  }
});

// DELETE /api/timelogs/:id
router.delete('/:id', async (req, res) => {
  try {
    const log = await TimeLog.findOneAndDelete({ _id: req.params.id, userId: req.user.id });
    if (!log) {
      return res.status(404).json({ success: false, error: 'Time log not found' });
    }

    res.json({ success: true, data: { message: 'Time log deleted' } });
  } catch (err) {
    console.error('Delete timelog error:', err);
    res.status(500).json({ success: false, error: 'Failed to delete time log' });
  }
});

module.exports = router;
