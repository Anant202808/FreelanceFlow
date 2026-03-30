import { useState, useEffect, useCallback } from 'react';
import { useToast } from '../context';
import * as store from '../store';
import type { TimeLog, Project, Client } from '../types';

export default function TimeTrackerPage() {
  const { addToast } = useToast();
  const [logs, setLogs] = useState<TimeLog[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    projectId: '', date: new Date().toISOString().split('T')[0],
    hours: 1, minutes: 0, notes: '', hourlyRate: 100,
  });

  const reload = useCallback(async () => {
    try {
      const [l, p, c] = await Promise.all([
        store.getTimeLogs(),
        store.getProjects(),
        store.getClients(),
      ]);
      setLogs(l);
      setProjects(p);
      setClients(c);
    } catch (err: unknown) {
      addToast(err instanceof Error ? err.message : 'Failed to load', 'error');
    }
  }, [addToast]);

  useEffect(() => { reload(); }, [reload]);

  const handleProjectChange = (projectId: string) => {
    const proj = projects.find(p => p._id === projectId);
    const client = proj ? clients.find(c => c._id === proj.clientId) : null;
    setForm({ ...form, projectId, hourlyRate: client?.hourlyRate || form.hourlyRate });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.projectId) { addToast('Please select a project', 'error'); return; }
    const totalMinutes = form.hours * 60 + form.minutes;
    if (totalMinutes <= 0) { addToast('Duration must be greater than 0', 'error'); return; }
    setSubmitting(true);
    try {
      const startTime = new Date(form.date);
      const endTime = new Date(startTime.getTime() + totalMinutes * 60000);
      await store.createTimeLog({
        projectId: form.projectId,
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
        durationMinutes: totalMinutes,
        hourlyRate: form.hourlyRate,
        notes: form.notes,
        isBilled: false,
      });
      addToast('Time logged successfully!');
      setForm({ ...form, notes: '', hours: 1, minutes: 0 });
      reload();
    } catch (err: unknown) {
      addToast(err instanceof Error ? err.message : 'Failed to log time', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await store.deleteTimeLog(id);
      addToast('Time log deleted');
      reload();
    } catch (err: unknown) {
      addToast(err instanceof Error ? err.message : 'Delete failed', 'error');
    }
  };

  const getProjectName = (pId: string | { _id: string; name: string }) => {
    if (typeof pId === 'object') return pId.name;
    return projects.find(p => p._id === pId)?.name || 'Unknown';
  };
  const totalHours = logs.reduce((s, l) => s + l.durationMinutes / 60, 0);
  const totalEarnings = logs.reduce((s, l) => s + (l.durationMinutes / 60) * l.hourlyRate, 0);

  return (
    <div className="max-w-6xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Time Tracker</h1>
        <p className="text-sm text-gray-500 mt-1">Log time manually or use the stopwatch in the header</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-sm text-gray-500">Total Hours</p>
          <p className="text-2xl font-bold text-gray-900">{Math.round(totalHours * 10) / 10}h</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-sm text-gray-500">Total Earnings</p>
          <p className="text-2xl font-bold text-gray-900">${Math.round(totalEarnings).toLocaleString()}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-sm text-gray-500">Entries</p>
          <p className="text-2xl font-bold text-gray-900">{logs.length}</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h2 className="text-base font-semibold text-gray-900 mb-4">Manual Time Entry</h2>
        <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 items-end">
          <div className="lg:col-span-1">
            <label className="block text-xs font-medium text-gray-600 mb-1">Project *</label>
            <select value={form.projectId} onChange={e => handleProjectChange(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
              <option value="">Select...</option>
              {projects.map(p => <option key={p._id} value={p._id}>{p.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Date</label>
            <input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Hours / Min</label>
            <div className="flex gap-1">
              <input type="number" min="0" max="24" value={form.hours} onChange={e => setForm({ ...form, hours: Number(e.target.value) })} className="w-1/2 border border-gray-300 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" placeholder="h" />
              <input type="number" min="0" max="59" value={form.minutes} onChange={e => setForm({ ...form, minutes: Number(e.target.value) })} className="w-1/2 border border-gray-300 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" placeholder="m" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Rate ($/hr)</label>
            <input type="number" value={form.hourlyRate} onChange={e => setForm({ ...form, hourlyRate: Number(e.target.value) })} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Notes</label>
            <input value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" placeholder="What did you work on?" />
          </div>
          <div>
            <button type="submit" disabled={submitting} className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white py-2 rounded-lg text-sm font-medium transition-colors">
              {submitting ? 'Logging...' : 'Log Time'}
            </button>
          </div>
        </form>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-200">
          <h2 className="text-base font-semibold text-gray-900">Recent Time Logs</h2>
        </div>
        {logs.length === 0 ? (
          <div className="p-8 text-center text-gray-400 text-sm">
            <p className="text-3xl mb-2">⏱️</p>
            <p>No time logs yet. Start the timer or add a manual entry above.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left text-xs font-semibold text-gray-500 uppercase px-5 py-3">Date</th>
                  <th className="text-left text-xs font-semibold text-gray-500 uppercase px-5 py-3">Project</th>
                  <th className="text-left text-xs font-semibold text-gray-500 uppercase px-5 py-3">Duration</th>
                  <th className="text-left text-xs font-semibold text-gray-500 uppercase px-5 py-3 hidden sm:table-cell">Notes</th>
                  <th className="text-right text-xs font-semibold text-gray-500 uppercase px-5 py-3">Amount</th>
                  <th className="text-right text-xs font-semibold text-gray-500 uppercase px-5 py-3">Status</th>
                  <th className="w-10"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {logs.slice(0, 50).map(l => (
                  <tr key={l._id} className="hover:bg-gray-50 group">
                    <td className="px-5 py-3 text-sm text-gray-900">{new Date(l.startTime).toLocaleDateString()}</td>
                    <td className="px-5 py-3 text-sm text-gray-700">{getProjectName(l.projectId)}</td>
                    <td className="px-5 py-3 text-sm text-gray-600 font-mono">{Math.floor(l.durationMinutes / 60)}h {l.durationMinutes % 60}m</td>
                    <td className="px-5 py-3 text-sm text-gray-500 hidden sm:table-cell truncate max-w-[200px]">{l.notes}</td>
                    <td className="px-5 py-3 text-sm text-gray-900 text-right font-medium">${Math.round(l.durationMinutes / 60 * l.hourlyRate)}</td>
                    <td className="px-5 py-3 text-right">
                      <span className={`text-xs font-medium px-2 py-1 rounded-full ${l.isBilled ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-600'}`}>
                        {l.isBilled ? 'Billed' : 'Unbilled'}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-right">
                      {!l.isBilled && (
                        <button onClick={() => handleDelete(l._id)} className="text-xs text-red-500 hover:text-red-700 opacity-0 group-hover:opacity-100 transition-opacity">✕</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
