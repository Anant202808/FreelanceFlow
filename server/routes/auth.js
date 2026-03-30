const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const auth = require('../middleware/auth');
const Client = require('../models/Client');
const Project = require('../models/Project');
const Task = require('../models/Task');
const TimeLog = require('../models/TimeLog');
const Invoice = require('../models/Invoice');

const router = express.Router();

const signToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '7d' });
};

// POST /api/auth/register
router.post('/register', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, error: 'Email and password are required' });
    }

    if (password.length < 6) {
      return res.status(400).json({ success: false, error: 'Password must be at least 6 characters' });
    }

    const existing = await User.findOne({ email: email.toLowerCase().trim() });
    if (existing) {
      return res.status(409).json({ success: false, error: 'Email already registered' });
    }

    const salt = await bcrypt.genSalt(12);
    const passwordHash = await bcrypt.hash(password, salt);

    const user = await User.create({
      email: email.toLowerCase().trim(),
      passwordHash,
      plan: 'free',
    });

    const token = signToken(user._id);

    res.status(201).json({
      success: true,
      data: {
        token,
        user: {
          id: user._id,
          email: user.email,
          plan: user.plan,
          createdAt: user.createdAt,
        },
      },
    });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ success: false, error: 'Registration failed' });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, error: 'Email and password are required' });
    }

    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user) {
      return res.status(401).json({ success: false, error: 'Invalid email or password' });
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return res.status(401).json({ success: false, error: 'Invalid email or password' });
    }

    const token = signToken(user._id);

    res.json({
      success: true,
      data: {
        token,
        user: {
          id: user._id,
          email: user.email,
          plan: user.plan,
          createdAt: user.createdAt,
        },
      },
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ success: false, error: 'Login failed' });
  }
});

// GET /api/auth/me
router.get('/me', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-passwordHash');
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    res.json({
      success: true,
      data: {
        id: user._id,
        email: user.email,
        plan: user.plan,
        createdAt: user.createdAt,
      },
    });
  } catch (err) {
    console.error('Get me error:', err);
    res.status(500).json({ success: false, error: 'Failed to fetch user' });
  }
});

// PUT /api/auth/plan — upgrade or downgrade plan
router.put('/plan', auth, async (req, res) => {
  try {
    const { plan } = req.body;
    if (!['free', 'pro'].includes(plan)) {
      return res.status(400).json({ success: false, error: 'Plan must be "free" or "pro"' });
    }

    const user = await User.findByIdAndUpdate(
      req.user.id,
      { plan },
      { new: true }
    ).select('-passwordHash');

    res.json({
      success: true,
      data: {
        id: user._id,
        email: user.email,
        plan: user.plan,
        createdAt: user.createdAt,
      },
    });
  } catch (err) {
    console.error('Update plan error:', err);
    res.status(500).json({ success: false, error: 'Failed to update plan' });
  }
});

module.exports = router;

// POST /api/auth/demo-login — creates or resets the shared demo Pro account
router.post('/demo-login', async (req, res) => {

  const DEMO_EMAIL = 'demo@freelanceflow.app';
  const DEMO_PASSWORD = 'demo1234';

  try {
    // Find or create the demo user
    let user = await User.findOne({ email: DEMO_EMAIL });
    if (!user) {
      const salt = await bcrypt.genSalt(12);
      const passwordHash = await bcrypt.hash(DEMO_PASSWORD, salt);
      user = await User.create({ email: DEMO_EMAIL, passwordHash, plan: 'pro' });
    } else {
      // Always reset to pro
      await User.findByIdAndUpdate(user._id, { plan: 'pro' });
    }

    const userId = user._id;

    // Seed demo data (clear then re-create)
    await Client.deleteMany({ userId });
    await Project.deleteMany({ userId });
    await Task.deleteMany({ userId });
    await TimeLog.deleteMany({ userId });
    await Invoice.deleteMany({ userId });

    const client1 = await Client.create({ userId, name: 'Sarah Mitchell', email: 'sarah@acmedesign.com', company: 'Acme Design Studio', phone: '(555) 123-4567', hourlyRate: 95 });
    const client2 = await Client.create({ userId, name: 'James Rodriguez', email: 'james@techvault.io', company: 'TechVault Inc.', phone: '(555) 987-6543', hourlyRate: 120 });

    const project1 = await Project.create({ userId, clientId: client1._id, name: 'Brand Redesign Website', status: 'active', budget: 8500, description: 'Complete website redesign with new brand identity, responsive layouts, and CMS integration.' });
    const project2 = await Project.create({ userId, clientId: client2._id, name: 'Mobile App MVP', status: 'active', budget: 15000, description: 'React Native mobile app — user auth, dashboard, push notifications, payment integration.' });
    const project3 = await Project.create({ userId, clientId: client1._id, name: 'SEO Audit & Optimization', status: 'completed', budget: 3000, description: 'Technical SEO audit, meta tag optimization, sitemap, and Core Web Vitals fixes.' });

    const now = new Date();
    const d = (days) => { const dt = new Date(now); dt.setDate(dt.getDate() + days); return dt; };
    const daysAgoAt = (days, hour) => { const dt = new Date(now); dt.setDate(dt.getDate() - days); dt.setHours(hour, 0, 0, 0); return dt; };

    await Task.insertMany([
      { userId, projectId: project1._id, title: 'Design homepage mockup', dueDate: d(2), status: 'done' },
      { userId, projectId: project1._id, title: 'Build responsive navigation', dueDate: d(3), status: 'in-progress' },
      { userId, projectId: project1._id, title: 'Implement CMS integration', dueDate: d(5), status: 'todo' },
      { userId, projectId: project2._id, title: 'Set up React Native project', dueDate: d(-2), status: 'done' },
      { userId, projectId: project2._id, title: 'Build authentication flow', dueDate: d(1), status: 'done' },
      { userId, projectId: project2._id, title: 'Create dashboard screens', dueDate: d(4), status: 'in-progress' },
      { userId, projectId: project3._id, title: 'Run Lighthouse audit', dueDate: d(-10), status: 'done' },
      { userId, projectId: project3._id, title: 'Fix meta tags', dueDate: d(-7), status: 'done' },
    ]);

    const timeLogData = [
      { projectId: project1._id, startTime: daysAgoAt(1, 9), durationMinutes: 120, hourlyRate: 95, notes: 'Homepage layout design', isBilled: false },
      { projectId: project1._id, startTime: daysAgoAt(2, 10), durationMinutes: 180, hourlyRate: 95, notes: 'Responsive breakpoints', isBilled: false },
      { projectId: project1._id, startTime: daysAgoAt(7, 9), durationMinutes: 240, hourlyRate: 95, notes: 'Initial wireframes', isBilled: true },
      { projectId: project2._id, startTime: daysAgoAt(1, 10), durationMinutes: 180, hourlyRate: 120, notes: 'Auth screen UI', isBilled: false },
      { projectId: project2._id, startTime: daysAgoAt(2, 9), durationMinutes: 240, hourlyRate: 120, notes: 'API integration setup', isBilled: false },
      { projectId: project2._id, startTime: daysAgoAt(6, 11), durationMinutes: 180, hourlyRate: 120, notes: 'Project scaffolding', isBilled: true },
      { projectId: project3._id, startTime: daysAgoAt(15, 9), durationMinutes: 180, hourlyRate: 95, notes: 'Lighthouse audit run', isBilled: true },
      { projectId: project3._id, startTime: daysAgoAt(14, 10), durationMinutes: 120, hourlyRate: 95, notes: 'Meta tags optimization', isBilled: true },
      { projectId: project3._id, startTime: daysAgoAt(13, 9), durationMinutes: 240, hourlyRate: 95, notes: 'Core Web Vitals fixes', isBilled: true },
    ];
    const createdLogs = await TimeLog.insertMany(timeLogData.map(t => ({ ...t, userId, endTime: new Date(t.startTime.getTime() + t.durationMinutes * 60000) })));

    const proj3Logs = createdLogs.filter(l => l.projectId.toString() === project3._id.toString());
    const inv1Items = proj3Logs.map(l => ({ timeLogId: l._id, description: `SEO Audit — ${l.notes}`, hours: +(l.durationMinutes / 60).toFixed(2), rate: l.hourlyRate, amount: +((l.durationMinutes / 60) * l.hourlyRate).toFixed(2) }));
    await Invoice.create({ userId, clientId: client1._id, status: 'paid', totalAmount: inv1Items.reduce((s, i) => s + i.amount, 0), dateFrom: daysAgoAt(16, 0), dateTo: daysAgoAt(10, 23), lineItems: inv1Items });

    const billedLogs = createdLogs.filter(l => l.isBilled && l.projectId.toString() !== project3._id.toString());
    const inv2Items = billedLogs.map(l => ({ timeLogId: l._id, description: `${l.projectId.toString() === project1._id.toString() ? 'Brand Redesign' : 'Mobile App'} — ${l.notes}`, hours: +(l.durationMinutes / 60).toFixed(2), rate: l.hourlyRate, amount: +((l.durationMinutes / 60) * l.hourlyRate).toFixed(2) }));
    await Invoice.create({ userId, clientId: client2._id, status: 'sent', totalAmount: inv2Items.reduce((s, i) => s + i.amount, 0), dateFrom: daysAgoAt(9, 0), dateTo: daysAgoAt(6, 23), lineItems: inv2Items });

    const token = signToken(user._id);
    res.json({
      success: true,
      data: {
        token,
        user: { id: user._id, email: user.email, plan: 'pro', createdAt: user.createdAt },
      },
    });
  } catch (err) {
    console.error('Demo login error:', err);
    res.status(500).json({ success: false, error: 'Failed to load demo account' });
  }
});
