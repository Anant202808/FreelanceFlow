const express = require('express');
const auth = require('../middleware/auth');
const Project = require('../models/Project');
const Task = require('../models/Task');
const TimeLog = require('../models/TimeLog');
const Invoice = require('../models/Invoice');

const router = express.Router();

router.use(auth);

// GET /api/dashboard/stats
router.get('/stats', async (req, res) => {
  try {
    const userId = req.user.id;

    // 1. Active projects count
    const activeProjects = await Project.countDocuments({ userId, status: 'active' });

    // 2. Pending invoices total (draft + sent)
    const pendingInvoices = await Invoice.find({
      userId,
      status: { $in: ['draft', 'sent'] },
    });
    const pendingInvoicesTotal = Math.round(
      pendingInvoices.reduce((sum, inv) => sum + (inv.totalAmount || 0), 0) * 100
    ) / 100;

    // 3. Hours this month
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    const monthLogs = await TimeLog.find({
      userId,
      startTime: { $gte: startOfMonth, $lte: endOfMonth },
      endTime: { $ne: null },
    });
    const hoursThisMonth = Math.round(
      monthLogs.reduce((sum, l) => sum + (l.durationMinutes || 0) / 60, 0) * 100
    ) / 100;

    // 4. Upcoming deadlines (tasks due in next 7 days)
    const in7Days = new Date();
    in7Days.setDate(in7Days.getDate() + 7);

    const upcomingTasks = await Task.find({
      userId,
      status: { $ne: 'done' },
      dueDate: { $gte: now, $lte: in7Days },
    })
      .sort({ dueDate: 1 })
      .limit(10)
      .populate('projectId', 'name');

    const upcomingDeadlines = upcomingTasks.map((t) => ({
      id: t._id,
      title: t.title,
      dueDate: t.dueDate,
      projectName: t.projectId?.name || 'Unknown',
      status: t.status,
    }));

    // 5. Monthly revenue (last 12 months) — from paid invoices
    const monthlyRevenue = [];
    for (let i = 11; i >= 0; i--) {
      const mStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const mEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59);

      const monthInvoices = await Invoice.find({
        userId,
        status: 'paid',
        createdAt: { $gte: mStart, $lte: mEnd },
      });

      const total = monthInvoices.reduce((sum, inv) => sum + (inv.totalAmount || 0), 0);

      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      monthlyRevenue.push({
        month: monthNames[mStart.getMonth()],
        year: mStart.getFullYear(),
        revenue: Math.round(total * 100) / 100,
      });
    }

    // 6. Invoice breakdown by status
    const draftCount = await Invoice.countDocuments({ userId, status: 'draft' });
    const sentCount = await Invoice.countDocuments({ userId, status: 'sent' });
    const paidCount = await Invoice.countDocuments({ userId, status: 'paid' });

    const draftTotal = (await Invoice.find({ userId, status: 'draft' }))
      .reduce((s, i) => s + (i.totalAmount || 0), 0);
    const sentTotal = (await Invoice.find({ userId, status: 'sent' }))
      .reduce((s, i) => s + (i.totalAmount || 0), 0);
    const paidTotal = (await Invoice.find({ userId, status: 'paid' }))
      .reduce((s, i) => s + (i.totalAmount || 0), 0);

    const invoiceBreakdown = [
      { status: 'draft', count: draftCount, total: Math.round(draftTotal * 100) / 100 },
      { status: 'sent', count: sentCount, total: Math.round(sentTotal * 100) / 100 },
      { status: 'paid', count: paidCount, total: Math.round(paidTotal * 100) / 100 },
    ];

    res.json({
      success: true,
      data: {
        activeProjects,
        pendingInvoicesTotal,
        hoursThisMonth,
        upcomingDeadlines,
        monthlyRevenue,
        invoiceBreakdown,
      },
    });
  } catch (err) {
    console.error('Dashboard stats error:', err);
    res.status(500).json({ success: false, error: 'Failed to fetch dashboard stats' });
  }
});

module.exports = router;
