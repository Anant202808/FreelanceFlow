const express = require('express');
const auth = require('../middleware/auth');
const User = require('../models/User');
const Client = require('../models/Client');
const Project = require('../models/Project');
const Task = require('../models/Task');
const TimeLog = require('../models/TimeLog');
const Invoice = require('../models/Invoice');

const router = express.Router();

router.use(auth);

// POST /api/seed/demo — seeds sample data for current user
router.post('/demo', async (req, res) => {
  try {
    const userId = req.user.id;

    // Clear existing data for this user
    await Client.deleteMany({ userId });
    await Project.deleteMany({ userId });
    await Task.deleteMany({ userId });
    await TimeLog.deleteMany({ userId });
    await Invoice.deleteMany({ userId });

    // Upgrade to Pro so they can use all features
    await User.findByIdAndUpdate(userId, { plan: 'pro' });

    // ──────────── Clients ────────────
    const client1 = await Client.create({
      userId,
      name: 'Sarah Mitchell',
      email: 'sarah@acmedesign.com',
      company: 'Acme Design Studio',
      phone: '(555) 123-4567',
      hourlyRate: 95,
    });

    const client2 = await Client.create({
      userId,
      name: 'James Rodriguez',
      email: 'james@techvault.io',
      company: 'TechVault Inc.',
      phone: '(555) 987-6543',
      hourlyRate: 120,
    });

    // ──────────── Projects ────────────
    const project1 = await Project.create({
      userId,
      clientId: client1._id,
      name: 'Brand Redesign Website',
      status: 'active',
      budget: 8500,
      description: 'Complete website redesign with new brand identity, responsive layouts, and CMS integration.',
    });

    const project2 = await Project.create({
      userId,
      clientId: client2._id,
      name: 'Mobile App MVP',
      status: 'active',
      budget: 15000,
      description: 'React Native mobile app — user auth, dashboard, push notifications, payment integration.',
    });

    const project3 = await Project.create({
      userId,
      clientId: client1._id,
      name: 'SEO Audit & Optimization',
      status: 'completed',
      budget: 3000,
      description: 'Technical SEO audit, meta tag optimization, sitemap, and Core Web Vitals fixes.',
    });

    // ──────────── Tasks ────────────
    const now = new Date();
    const d = (daysFromNow) => {
      const date = new Date(now);
      date.setDate(date.getDate() + daysFromNow);
      return date;
    };

    const taskData = [
      { projectId: project1._id, title: 'Design homepage mockup', dueDate: d(2), status: 'done' },
      { projectId: project1._id, title: 'Build responsive navigation', dueDate: d(3), status: 'in-progress' },
      { projectId: project1._id, title: 'Implement CMS integration', dueDate: d(5), status: 'todo' },
      { projectId: project1._id, title: 'Create contact form', dueDate: d(6), status: 'todo' },
      { projectId: project2._id, title: 'Set up React Native project', dueDate: d(-2), status: 'done' },
      { projectId: project2._id, title: 'Build authentication flow', dueDate: d(1), status: 'done' },
      { projectId: project2._id, title: 'Create dashboard screens', dueDate: d(4), status: 'in-progress' },
      { projectId: project2._id, title: 'Integrate push notifications', dueDate: d(7), status: 'todo' },
      { projectId: project3._id, title: 'Run Lighthouse audit', dueDate: d(-10), status: 'done' },
      { projectId: project3._id, title: 'Fix meta tags', dueDate: d(-7), status: 'done' },
    ];

    await Task.insertMany(taskData.map((t) => ({ ...t, userId })));

    // ──────────── Time Logs ────────────
    const hoursAgo = (h) => new Date(now.getTime() - h * 3600000);
    const daysAgoAt = (days, hour) => {
      const date = new Date(now);
      date.setDate(date.getDate() - days);
      date.setHours(hour, 0, 0, 0);
      return date;
    };

    const timeLogData = [
      // Project 1 logs
      { projectId: project1._id, startTime: daysAgoAt(1, 9), durationMinutes: 120, hourlyRate: 95, notes: 'Homepage layout design', isBilled: false },
      { projectId: project1._id, startTime: daysAgoAt(1, 14), durationMinutes: 90, hourlyRate: 95, notes: 'Navigation component', isBilled: false },
      { projectId: project1._id, startTime: daysAgoAt(2, 10), durationMinutes: 180, hourlyRate: 95, notes: 'Responsive breakpoints', isBilled: false },
      { projectId: project1._id, startTime: daysAgoAt(3, 9), durationMinutes: 60, hourlyRate: 95, notes: 'Client feedback review', isBilled: false },
      { projectId: project1._id, startTime: daysAgoAt(5, 11), durationMinutes: 150, hourlyRate: 95, notes: 'Brand color system setup', isBilled: false },
      { projectId: project1._id, startTime: daysAgoAt(7, 9), durationMinutes: 240, hourlyRate: 95, notes: 'Initial wireframes', isBilled: true },
      { projectId: project1._id, startTime: daysAgoAt(8, 13), durationMinutes: 120, hourlyRate: 95, notes: 'Typography selection', isBilled: true },
      // Project 2 logs
      { projectId: project2._id, startTime: daysAgoAt(1, 10), durationMinutes: 180, hourlyRate: 120, notes: 'Auth screen UI', isBilled: false },
      { projectId: project2._id, startTime: daysAgoAt(2, 9), durationMinutes: 240, hourlyRate: 120, notes: 'API integration setup', isBilled: false },
      { projectId: project2._id, startTime: daysAgoAt(3, 14), durationMinutes: 90, hourlyRate: 120, notes: 'Navigation architecture', isBilled: false },
      { projectId: project2._id, startTime: daysAgoAt(4, 10), durationMinutes: 300, hourlyRate: 120, notes: 'Dashboard widgets', isBilled: false },
      { projectId: project2._id, startTime: daysAgoAt(5, 9), durationMinutes: 120, hourlyRate: 120, notes: 'State management setup', isBilled: false },
      { projectId: project2._id, startTime: daysAgoAt(6, 11), durationMinutes: 180, hourlyRate: 120, notes: 'Project scaffolding', isBilled: true },
      { projectId: project2._id, startTime: daysAgoAt(7, 9), durationMinutes: 60, hourlyRate: 120, notes: 'Dependency audit', isBilled: true },
      // Project 3 logs (completed — all billed)
      { projectId: project3._id, startTime: daysAgoAt(15, 9), durationMinutes: 180, hourlyRate: 95, notes: 'Lighthouse audit run', isBilled: true },
      { projectId: project3._id, startTime: daysAgoAt(14, 10), durationMinutes: 120, hourlyRate: 95, notes: 'Meta tags optimization', isBilled: true },
      { projectId: project3._id, startTime: daysAgoAt(13, 9), durationMinutes: 240, hourlyRate: 95, notes: 'Core Web Vitals fixes', isBilled: true },
      { projectId: project3._id, startTime: daysAgoAt(12, 14), durationMinutes: 90, hourlyRate: 95, notes: 'Sitemap generation', isBilled: true },
      { projectId: project3._id, startTime: daysAgoAt(11, 10), durationMinutes: 60, hourlyRate: 95, notes: 'Schema markup', isBilled: true },
      { projectId: project3._id, startTime: daysAgoAt(10, 9), durationMinutes: 120, hourlyRate: 95, notes: 'Final report and handoff', isBilled: true },
    ];

    const createdLogs = await TimeLog.insertMany(
      timeLogData.map((t) => ({
        ...t,
        userId,
        endTime: new Date(t.startTime.getTime() + t.durationMinutes * 60000),
      }))
    );

    // ──────────── Invoices ────────────
    // Invoice 1: project 3 (completed, paid)
    const proj3Logs = createdLogs.filter(
      (l) => l.projectId.toString() === project3._id.toString()
    );
    const inv1LineItems = proj3Logs.map((l) => ({
      timeLogId: l._id,
      description: `SEO Audit & Optimization — ${l.notes}`,
      hours: Math.round((l.durationMinutes / 60) * 100) / 100,
      rate: l.hourlyRate,
      amount: Math.round((l.durationMinutes / 60) * l.hourlyRate * 100) / 100,
    }));
    const inv1Total = Math.round(inv1LineItems.reduce((s, i) => s + i.amount, 0) * 100) / 100;

    await Invoice.create({
      userId,
      clientId: client1._id,
      status: 'paid',
      totalAmount: inv1Total,
      dateFrom: daysAgoAt(16, 0),
      dateTo: daysAgoAt(10, 23),
      lineItems: inv1LineItems,
    });

    // Invoice 2: older project 1 & 2 billed logs (sent, not paid)
    const billedP1Logs = createdLogs.filter(
      (l) => l.projectId.toString() === project1._id.toString() && l.isBilled
    );
    const billedP2Logs = createdLogs.filter(
      (l) => l.projectId.toString() === project2._id.toString() && l.isBilled
    );
    const inv2Logs = [...billedP1Logs, ...billedP2Logs];
    const inv2LineItems = inv2Logs.map((l) => ({
      timeLogId: l._id,
      description: `${l.projectId.toString() === project1._id.toString() ? 'Brand Redesign' : 'Mobile App'} — ${l.notes}`,
      hours: Math.round((l.durationMinutes / 60) * 100) / 100,
      rate: l.hourlyRate,
      amount: Math.round((l.durationMinutes / 60) * l.hourlyRate * 100) / 100,
    }));
    const inv2Total = Math.round(inv2LineItems.reduce((s, i) => s + i.amount, 0) * 100) / 100;

    await Invoice.create({
      userId,
      clientId: client2._id,
      status: 'sent',
      totalAmount: inv2Total,
      dateFrom: daysAgoAt(9, 0),
      dateTo: daysAgoAt(6, 23),
      lineItems: inv2LineItems,
    });

    res.json({
      success: true,
      data: {
        message: 'Sample data loaded successfully! Account upgraded to Pro.',
        counts: {
          clients: 2,
          projects: 3,
          tasks: 10,
          timeLogs: 20,
          invoices: 2,
        },
      },
    });
  } catch (err) {
    console.error('Seed error:', err);
    res.status(500).json({ success: false, error: 'Failed to seed sample data' });
  }
});

module.exports = router;
