import { useState, useEffect, useCallback } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { useToast } from '../context';
import * as store from '../store';
import type { Project, Client, Task, TimeLog } from '../types';

function BurnBar({ rate }: { rate: number }) {
  const color = rate < 50 ? 'bg-emerald-500' : rate < 80 ? 'bg-amber-500' : 'bg-red-500';
  return (
    <div className="w-full bg-gray-200 rounded-full h-2.5">
      <div className={`${color} h-2.5 rounded-full transition-all duration-500`} style={{ width: `${Math.min(rate, 100)}%` }} />
    </div>
  );
}

function StatusBadge({ status, editable = false }: { status: Project['status']; editable?: boolean }) {
  const styles = {
    active: 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200',
    completed: 'bg-gray-100 text-gray-600 hover:bg-gray-200',
    'on-hold': 'bg-amber-100 text-amber-700 hover:bg-amber-200',
  };
  const label = status === 'on-hold' ? 'On Hold' : status.charAt(0).toUpperCase() + status.slice(1);
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-semibold px-3 py-1 rounded-full transition-colors ${styles[status]} ${editable ? 'cursor-pointer' : ''}`}>
      {status === 'active' && '🟢'}
      {status === 'completed' && '✅'}
      {status === 'on-hold' && '⏸'}
      {label}
      {editable && <span className="text-[10px] opacity-70">▾</span>}
    </span>
  );
}

// ── Budget validation ──────────────────────────────────────────
function validateBudget(value: number): string | undefined {
  if (value === null || value === undefined || String(value).trim() === '') return 'Budget is required';
  if (!Number.isFinite(value)) return 'Budget must be a valid number';
  if (value < 0) return 'Budget cannot be negative';
  if (!Number.isInteger(value)) return 'Budget must be a whole number (no decimals)';
  if (value > 10_000_000) return 'Budget cannot exceed $10,000,000';
  return undefined;
}

// ===================== PROJECT LIST =====================

export function ProjectsListPage() {
  const { addToast } = useToast();
  const [projects, setProjects] = useState<Project[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [filter, setFilter] = useState<string>('all');
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: '', clientId: '', status: 'active' as Project['status'], budget: '' as string | number, description: '' });
  const [errors, setErrors] = useState<{ name?: string; clientId?: string; budget?: string }>({});

  const reload = useCallback(async () => {
    try {
      const [p, c] = await Promise.all([store.getProjects(), store.getClients()]);
      setProjects(p);
      setClients(c);
    } catch (err: unknown) {
      addToast(err instanceof Error ? err.message : 'Failed to load', 'error');
    }
  }, [addToast]);

  useEffect(() => { reload(); }, [reload]);

  const filtered = filter === 'all' ? projects : projects.filter(p => p.status === filter);

  const openModal = () => {
    setForm({ name: '', clientId: '', status: 'active', budget: '', description: '' });
    setErrors({});
    setShowModal(true);
  };

  const validate = (): boolean => {
    const newErrors: typeof errors = {};
    if (!form.name.trim()) newErrors.name = 'Project name is required';
    else if (form.name.trim().length < 2) newErrors.name = 'Name must be at least 2 characters';
    if (!form.clientId) newErrors.clientId = 'Please select a client';
    const budgetNum = Number(form.budget);
    const budgetErr = validateBudget(budgetNum);
    if (form.budget === '' || form.budget === null) {
      newErrors.budget = 'Budget is required';
    } else if (budgetErr) {
      newErrors.budget = budgetErr;
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      await store.createProject({ ...form, budget: Number(form.budget) });
      addToast('Project created!');
      setShowModal(false);
      reload();
    } catch (err: unknown) {
      addToast(err instanceof Error ? err.message : 'Failed to create project', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this project and all its tasks/time logs?')) return;
    try {
      await store.deleteProject(id);
      addToast('Project deleted');
      reload();
    } catch (err: unknown) {
      addToast(err instanceof Error ? err.message : 'Delete failed', 'error');
    }
  };

  // Handle budget input — only allow digits
  const handleBudgetChange = (raw: string) => {
    // Strip anything that's not a digit
    const cleaned = raw.replace(/[^0-9]/g, '');
    setForm(f => ({ ...f, budget: cleaned }));
    if (errors.budget) setErrors(e => ({ ...e, budget: undefined }));
  };

  return (
    <div className="max-w-6xl space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Projects</h1>
          <p className="text-sm text-gray-500 mt-1">{projects.length} project{projects.length !== 1 ? 's' : ''}</p>
        </div>
        <div className="flex gap-3">
          <select value={filter} onChange={e => setFilter(e.target.value)} className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="completed">Completed</option>
            <option value="on-hold">On Hold</option>
          </select>
          <button onClick={openModal} className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
            + New Project
          </button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <p className="text-4xl mb-3">📁</p>
          <p className="text-gray-500 font-medium">No projects found</p>
          <p className="text-sm text-gray-400 mt-1">{filter !== 'all' ? 'Try a different filter' : 'Create your first project'}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map(p => {
            const client = clients.find(c => c._id === p.clientId);
            const burnRate = p.burnRate ?? 0;
            return (
              <div key={p._id} className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md transition-shadow group">
                <div className="flex items-start justify-between mb-3">
                  <Link to={`/projects/${p._id}`} className="text-base font-semibold text-gray-900 hover:text-indigo-600 transition-colors">
                    {p.name}
                  </Link>
                  <StatusBadge status={p.status} />
                </div>
                <p className="text-sm text-gray-500 mb-3">{p.clientName || client?.company || client?.name || 'No client'}</p>
                <div className="space-y-2 mb-4">
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>Burn Rate</span>
                    <span className="font-medium">{Math.round(burnRate)}%</span>
                  </div>
                  <BurnBar rate={burnRate} />
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>Budget: ${p.budget.toLocaleString()}</span>
                    <span>{p.taskCount ?? 0} task{(p.taskCount ?? 0) !== 1 ? 's' : ''}</span>
                  </div>
                </div>
                <div className="flex gap-2 pt-3 border-t border-gray-100">
                  <Link to={`/projects/${p._id}`} className="text-xs text-indigo-600 hover:text-indigo-800 font-medium">View Details →</Link>
                  <span className="flex-1" />
                  <button onClick={() => handleDelete(p._id)} className="text-xs text-red-500 hover:text-red-700 opacity-0 group-hover:opacity-100 transition-opacity">Delete</button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowModal(false)}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-gray-900 mb-4">New Project</h2>
            <div className="space-y-3">

              {/* Project Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Project Name <span className="text-red-500">*</span></label>
                <input
                  value={form.name}
                  onChange={e => { setForm({ ...form, name: e.target.value }); if (errors.name) setErrors(er => ({ ...er, name: undefined })); }}
                  placeholder="e.g. Website Redesign"
                  className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 ${errors.name ? 'border-red-400 bg-red-50' : 'border-gray-300'}`}
                />
                {errors.name && <p className="text-red-500 text-xs mt-1">⚠ {errors.name}</p>}
              </div>

              {/* Client */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Client <span className="text-red-500">*</span></label>
                <select
                  value={form.clientId}
                  onChange={e => { setForm({ ...form, clientId: e.target.value }); if (errors.clientId) setErrors(er => ({ ...er, clientId: undefined })); }}
                  className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 ${errors.clientId ? 'border-red-400 bg-red-50' : 'border-gray-300'}`}
                >
                  <option value="">Select client</option>
                  {clients.map(c => <option key={c._id} value={c._id}>{c.name}{c.company ? ` (${c.company})` : ''}</option>)}
                </select>
                {errors.clientId && <p className="text-red-500 text-xs mt-1">⚠ {errors.clientId}</p>}
              </div>

              {/* Status */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value as Project['status'] })} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                  <option value="active">Active</option>
                  <option value="on-hold">On Hold</option>
                  <option value="completed">Completed</option>
                </select>
              </div>

              {/* Budget */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Budget ($) <span className="text-red-500">*</span>
                  <span className="text-gray-400 font-normal ml-1 text-xs">(whole numbers only)</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={form.budget}
                    onChange={e => handleBudgetChange(e.target.value)}
                    placeholder="5000"
                    className={`w-full border rounded-lg pl-7 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 ${errors.budget ? 'border-red-400 bg-red-50' : 'border-gray-300'}`}
                  />
                </div>
                {errors.budget && <p className="text-red-500 text-xs mt-1">⚠ {errors.budget}</p>}
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  rows={2}
                  value={form.description}
                  onChange={e => setForm({ ...form, description: e.target.value })}
                  placeholder="Brief project description..."
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowModal(false)} className="flex-1 border border-gray-300 text-gray-700 py-2 rounded-lg text-sm font-medium hover:bg-gray-50">Cancel</button>
              <button onClick={handleSave} disabled={saving} className="flex-1 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white py-2 rounded-lg text-sm font-medium">
                {saving ? 'Creating...' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ===================== PROJECT DETAIL =====================

export function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { addToast } = useToast();
  const navigate = useNavigate();
  const [project, setProject] = useState<Project | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [timeLogs, setTimeLogs] = useState<TimeLog[]>([]);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [taskForm, setTaskForm] = useState({ title: '', dueDate: '', status: 'todo' as Task['status'] });
  const [taskError, setTaskError] = useState('');
  const [editingStatus, setEditingStatus] = useState(false);
  const [newStatus, setNewStatus] = useState<Project['status']>('active');

  const reload = useCallback(async () => {
    if (!id) return;
    try {
      const [p, t, l] = await Promise.all([
        store.getProject(id),
        store.getTasks(id),
        store.getTimeLogs({ projectId: id }),
      ]);
      setProject(p);
      setNewStatus(p.status);
      setTasks(t);
      setTimeLogs(l);
    } catch {
      navigate('/projects');
    }
  }, [id, navigate]);

  useEffect(() => { reload(); }, [reload]);

  if (!project) return <div className="animate-pulse p-8 text-gray-400">Loading...</div>;

  const addTask = async () => {
    if (!id) return;
    if (!taskForm.title.trim()) { setTaskError('Task title is required'); return; }
    if (taskForm.title.trim().length < 2) { setTaskError('Title must be at least 2 characters'); return; }

    // Validate due date is not in the past
    if (taskForm.dueDate) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (new Date(taskForm.dueDate) < today) {
        setTaskError('Due date cannot be in the past');
        return;
      }
    }

    setTaskError('');
    try {
      await store.createTask({ projectId: id, ...taskForm });
      addToast('Task added!');
      setShowTaskModal(false);
      setTaskForm({ title: '', dueDate: '', status: 'todo' });
      reload();
    } catch (err: unknown) {
      addToast(err instanceof Error ? err.message : 'Failed to add task', 'error');
    }
  };

  const moveTask = async (taskId: string, status: Task['status']) => {
    try {
      await store.updateTask(taskId, { status });
      reload();
    } catch { }
  };

  const deleteTask = async (taskId: string) => {
    try {
      await store.deleteTask(taskId);
      addToast('Task deleted');
      reload();
    } catch (err: unknown) {
      addToast(err instanceof Error ? err.message : 'Delete failed', 'error');
    }
  };

  const updateStatus = async () => {
    if (!id) return;
    try {
      await store.updateProject(id, { status: newStatus });
      addToast('Status updated');
      setEditingStatus(false);
      reload();
    } catch (err: unknown) {
      addToast(err instanceof Error ? err.message : 'Update failed', 'error');
    }
  };

  const burnRate = project.burnRate ?? 0;
  const totalLogged = timeLogs.reduce((s, l) => s + l.durationMinutes / 60, 0);
  const totalBilled = project.totalCost ?? timeLogs.reduce((s, l) => s + (l.durationMinutes / 60) * l.hourlyRate, 0);

  const columns: { key: Task['status']; label: string; color: string }[] = [
    { key: 'todo', label: 'To Do', color: 'border-gray-300' },
    { key: 'in-progress', label: 'In Progress', color: 'border-blue-400' },
    { key: 'done', label: 'Done', color: 'border-emerald-400' },
  ];

  return (
    <div className="max-w-6xl space-y-6">
      <div>
        <button onClick={() => navigate('/projects')} className="text-sm text-gray-500 hover:text-gray-700 mb-3 flex items-center gap-1">← Back to Projects</button>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-gray-900">{project.name}</h1>
              {editingStatus ? (
                <div className="flex items-center gap-2">
                  <select value={newStatus} onChange={e => setNewStatus(e.target.value as Project['status'])} className="text-xs border rounded px-2 py-1">
                    <option value="active">Active</option>
                    <option value="on-hold">On Hold</option>
                    <option value="completed">Completed</option>
                  </select>
                  <button onClick={updateStatus} className="text-xs text-indigo-600 font-medium">Save</button>
                  <button onClick={() => setEditingStatus(false)} className="text-xs text-gray-400">Cancel</button>
                </div>
              ) : (
                <button onClick={() => setEditingStatus(true)}>
                  <StatusBadge status={project.status} editable />
                </button>
              )}
            </div>
            <p className="text-sm text-gray-500 mt-1">{project.clientName || 'No client'} • Budget: ${project.budget.toLocaleString()}</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm font-medium text-gray-700">Burn Rate</span>
          <span className={`text-sm font-bold ${burnRate < 50 ? 'text-emerald-600' : burnRate < 80 ? 'text-amber-600' : 'text-red-600'}`}>
            {Math.round(burnRate)}%
          </span>
        </div>
        <BurnBar rate={burnRate} />
        <div className="flex justify-between text-xs text-gray-500 mt-2">
          <span>{Math.round(totalLogged * 10) / 10} hours logged</span>
          <span>${Math.round(totalBilled).toLocaleString()} / ${project.budget.toLocaleString()}</span>
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Tasks ({tasks.length})</h2>
          <button onClick={() => { setTaskForm({ title: '', dueDate: '', status: 'todo' }); setTaskError(''); setShowTaskModal(true); }} className="bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-lg text-sm font-medium transition-colors">+ Add Task</button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {columns.map(col => {
            const colTasks = tasks.filter(t => t.status === col.key);
            return (
              <div key={col.key} className={`bg-gray-50 rounded-xl p-3 border-t-2 ${col.color}`}>
                <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center justify-between">
                  {col.label}
                  <span className="bg-gray-200 text-gray-600 text-xs rounded-full px-2 py-0.5">{colTasks.length}</span>
                </h3>
                <div className="space-y-2 min-h-[80px]">
                  {colTasks.map(t => (
                    <div key={t._id} className="bg-white rounded-lg p-3 border border-gray-200 shadow-sm group">
                      <p className="text-sm font-medium text-gray-900 mb-1">{t.title}</p>
                      {t.dueDate && <p className="text-xs text-gray-400 mb-2">Due: {new Date(t.dueDate).toLocaleDateString()}</p>}
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        {col.key !== 'todo' && <button onClick={() => moveTask(t._id, col.key === 'done' ? 'in-progress' : 'todo')} className="text-[10px] bg-gray-100 hover:bg-gray-200 px-1.5 py-0.5 rounded">← Back</button>}
                        {col.key !== 'done' && <button onClick={() => moveTask(t._id, col.key === 'todo' ? 'in-progress' : 'done')} className="text-[10px] bg-indigo-100 hover:bg-indigo-200 text-indigo-700 px-1.5 py-0.5 rounded">Next →</button>}
                        <button onClick={() => deleteTask(t._id)} className="text-[10px] bg-red-100 hover:bg-red-200 text-red-600 px-1.5 py-0.5 rounded ml-auto">✕</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Time Logs ({timeLogs.length})</h2>
        {timeLogs.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
            <p className="text-gray-400 text-sm">No time logs yet. Use the timer or go to Time Tracker to log time.</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="text-left text-xs font-semibold text-gray-500 uppercase px-5 py-3">Date</th>
                    <th className="text-left text-xs font-semibold text-gray-500 uppercase px-5 py-3">Duration</th>
                    <th className="text-left text-xs font-semibold text-gray-500 uppercase px-5 py-3 hidden sm:table-cell">Notes</th>
                    <th className="text-right text-xs font-semibold text-gray-500 uppercase px-5 py-3">Amount</th>
                    <th className="text-right text-xs font-semibold text-gray-500 uppercase px-5 py-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {timeLogs.slice(0, 20).map(l => (
                    <tr key={l._id} className="hover:bg-gray-50">
                      <td className="px-5 py-3 text-sm text-gray-900">{new Date(l.startTime).toLocaleDateString()}</td>
                      <td className="px-5 py-3 text-sm text-gray-600">{Math.round(l.durationMinutes / 60 * 10) / 10}h</td>
                      <td className="px-5 py-3 text-sm text-gray-500 hidden sm:table-cell truncate max-w-[200px]">{l.notes}</td>
                      <td className="px-5 py-3 text-sm text-gray-900 text-right font-medium">${Math.round(l.durationMinutes / 60 * l.hourlyRate)}</td>
                      <td className="px-5 py-3 text-right">
                        <span className={`text-xs font-medium px-2 py-1 rounded-full ${l.isBilled ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-600'}`}>
                          {l.isBilled ? 'Billed' : 'Unbilled'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {showTaskModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowTaskModal(false)}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-gray-900 mb-4">Add Task</h2>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Title <span className="text-red-500">*</span></label>
                <input
                  value={taskForm.title}
                  onChange={e => { setTaskForm({ ...taskForm, title: e.target.value }); setTaskError(''); }}
                  placeholder="Task title"
                  className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 ${taskError && !taskForm.title ? 'border-red-400 bg-red-50' : 'border-gray-300'}`}
                />
                {taskError && <p className="text-red-500 text-xs mt-1">⚠ {taskError}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Due Date</label>
                <input
                  type="date"
                  min={new Date().toISOString().split('T')[0]}
                  value={taskForm.dueDate}
                  onChange={e => { setTaskForm({ ...taskForm, dueDate: e.target.value }); setTaskError(''); }}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                <select value={taskForm.status} onChange={e => setTaskForm({ ...taskForm, status: e.target.value as Task['status'] })} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                  <option value="todo">To Do</option>
                  <option value="in-progress">In Progress</option>
                  <option value="done">Done</option>
                </select>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowTaskModal(false)} className="flex-1 border border-gray-300 text-gray-700 py-2 rounded-lg text-sm font-medium hover:bg-gray-50">Cancel</button>
              <button onClick={addTask} className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white py-2 rounded-lg text-sm font-medium">Add Task</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}