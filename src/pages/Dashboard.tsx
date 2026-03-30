import { useState, useEffect } from 'react';
import type { PieLabelRenderProps } from 'recharts';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import * as store from '../store';
import type { DashboardStats } from '../types';

const COLORS = ['#10b981', '#6366f1', '#94a3b8'];

function Skeleton() {
  return <div className="animate-pulse bg-gray-200 rounded-lg h-32" />;
}

/* ---------- PIE LABEL (NO OVERLAP) ---------- */
const renderInvoiceLabel = (props: PieLabelRenderProps) => {
  const { name, value, percent } = props;

  if (
    typeof value !== 'number' ||
    typeof percent !== 'number' ||
    value === 0 ||
    percent < 0.06
  ) {
    return null;
  }

  return `${name}: $${value.toLocaleString()}`;
};

export default function Dashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);

  useEffect(() => {
    store.getDashboardStats().then(setStats).catch(console.error);
  }, []);

  if (!stats) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Skeleton />
          <Skeleton />
          <Skeleton />
        </div>
      </div>
    );
  }

  /* ---------- SAFE DATA ---------- */
  const invoicePieData = (stats.invoiceBreakdown ?? [])
    .filter(b => b.total > 0)
    .map(b => ({
      name: b.status,
      value: b.total,
    }));

  const hasRevenue = stats.monthlyRevenue.some(m => m.revenue > 0);
  const hasInvoices = invoicePieData.length > 0;

  const allPaid =
    hasInvoices &&
    invoicePieData.every(b => b.name === 'paid');

  return (
    <div className="space-y-6 max-w-7xl">
      {/* HEADER */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-sm text-gray-500 mt-1">
          Welcome back! Here's your freelance business overview.
        </p>
      </div>

      {/* STATS */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-sm text-gray-500 font-medium">Active Projects</p>
          <p className="text-3xl font-bold text-gray-900 mt-1">
            {stats.activeProjects}
          </p>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-sm text-gray-500 font-medium">Pending Invoices</p>
          <p className="text-3xl font-bold text-gray-900 mt-1">
            ${stats.pendingInvoicesTotal.toLocaleString()}
          </p>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-sm text-gray-500 font-medium">Hours This Month</p>
          <p className="text-3xl font-bold text-gray-900 mt-1">
            {Math.round(stats.hoursThisMonth * 10) / 10}
          </p>
        </div>
      </div>

      {/* CHARTS */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* MONTHLY REVENUE */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="text-base font-semibold text-gray-900 mb-4">
            Monthly Revenue
          </h2>

          {hasRevenue ? (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={stats.monthlyRevenue}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                <YAxis tickFormatter={v => `$${v}`} />
                <Tooltip
                  formatter={(v?: number | string) =>
                    `$${Number(v ?? 0).toLocaleString()}`
                  }
                />
                <Bar
                  dataKey="revenue"
                  fill="#6366f1"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[250px] flex items-center justify-center text-gray-400 text-sm">
              No revenue yet
            </div>
          )}
        </div>

        {/* INVOICE BREAKDOWN */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="text-base font-semibold text-gray-900 mb-4">
            Invoice Breakdown
          </h2>

          {hasInvoices ? (
            <>
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie
                    data={invoicePieData}
                    cx="50%"
                    cy="55%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={3}
                    dataKey="value"
                    label={renderInvoiceLabel}
                    labelLine={false}
                  >
                    {invoicePieData.map((_, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={COLORS[index % COLORS.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(v?: number | string) =>
                      `$${Number(v ?? 0).toLocaleString()}`
                    }
                  />
                </PieChart>
              </ResponsiveContainer>

              {allPaid && (
                <p className="text-xs text-emerald-600 text-center mt-2">
                  ✔ All invoices paid
                </p>
              )}
            </>
          ) : (
            <div className="h-[250px] flex items-center justify-center text-gray-400 text-sm">
              No invoices yet
            </div>
          )}
        </div>
      </div>

      {/* UPCOMING DEADLINES */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h2 className="text-base font-semibold text-gray-900 mb-4">
          Upcoming Deadlines (Next 7 Days)
        </h2>

        {stats.upcomingDeadlines.length > 0 ? (
          <div className="space-y-3">
            {stats.upcomingDeadlines.map(task => {
              const daysUntil = Math.ceil(
                (new Date(task.dueDate).getTime() - Date.now()) / 86400000
              );

              const badgeClass =
                daysUntil <= 0
                  ? 'bg-red-100 text-red-700'
                  : daysUntil === 1
                    ? 'bg-amber-100 text-amber-700'
                    : daysUntil <= 3
                      ? 'bg-yellow-100 text-yellow-800'
                      : 'bg-indigo-100 text-indigo-700';

              return (
                <div
                  key={task.id}
                  className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-lg"
                >
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {task.title}
                    </p>
                    <p className="text-xs text-gray-500">
                      {task.projectName}
                    </p>
                  </div>
                  <span
                    className={`text-xs font-medium px-2 py-1 rounded-full ${badgeClass}`}
                  >
                    {daysUntil <= 0
                      ? 'Today'
                      : daysUntil === 1
                        ? 'Tomorrow'
                        : `${daysUntil} days`}
                  </span>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-sm text-gray-400 text-center py-6">
            🎉 No upcoming deadlines this week!
          </p>
        )}
      </div>
    </div>
  );
}