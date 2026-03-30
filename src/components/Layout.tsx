import { useState, useEffect, useCallback } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth, useToast } from '../context';
import * as store from '../store';
import type { Project } from '../types';

/* Helper for populated projectId */
const getProjectId = (p: string | { _id: string }) =>
  typeof p === 'string' ? p : p._id;

/* ─────────────────────────────────────────────
   Persistent Stopwatch (Backend = Source of Truth)
───────────────────────────────────────────── */
function Timer() {
  const { addToast } = useToast();

  const [active, setActive] = useState(false);
  const [activeLogId, setActiveLogId] = useState<string | null>(null);
  const [startTime, setStartTime] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [projectId, setProjectId] = useState('');
  const [projects, setProjects] = useState<Project[]>([]);
  const [stopping, setStopping] = useState(false);

  /* Stop-notes modal state */
  const [showStopModal, setShowStopModal] = useState(false);
  const [stopNotes, setStopNotes] = useState('');

  /* Load active projects */
  useEffect(() => {
    store.getProjects({ status: 'active' })
      .then(setProjects)
      .catch(() => { });
  }, []);

  /* Sync active timer from backend */
  useEffect(() => {
    const sync = async () => {
      try {
        const log = await store.getActiveTimer();
        if (!log) {
          setActive(false);
          setActiveLogId(null);
          setStartTime(null);
          setElapsed(0);
          return;
        }

        setActive(true);
        setActiveLogId(log._id);
        setStartTime(new Date(log.startTime).getTime());
        setProjectId(getProjectId(log.projectId));
      } catch {
        // ignore
      }
    };

    sync();
  }, []);

  /* Tick */
  useEffect(() => {
    if (!active || !startTime) return;

    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);

    return () => clearInterval(interval);
  }, [active, startTime]);

  const formatTime = (sec: number) => {
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    return `${h.toString().padStart(2, '0')}:${m
      .toString()
      .padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  /* START TIMER */
  const handleStart = useCallback(async () => {
    if (!projectId) {
      addToast('Please select a project first', 'error');
      return;
    }

    try {
      const log = await store.startTimer(projectId);

      setActive(true);
      setActiveLogId(log._id);
      setStartTime(new Date(log.startTime).getTime());
      setElapsed(0);

      addToast('Timer started', 'info');
    } catch (err: unknown) {
      addToast(err instanceof Error ? err.message : 'Failed to start timer', 'error');
    }
  }, [projectId, addToast]);

  /* CONFIRM STOP (opens modal) */
  const confirmStop = () => {
    setShowStopModal(true);
  };

  /* STOP TIMER (with notes) */
  const handleStop = async () => {
    setStopping(true);
    try {
      const log = await store.getActiveTimer();
      if (!log) {
        addToast('No active timer found', 'error');
        setActive(false);
        setShowStopModal(false);
        return;
      }

      await store.stopTimer(log._id, {
        notes: stopNotes,
      });

      const duration = formatTime(
        Math.floor((Date.now() - new Date(log.startTime).getTime()) / 1000)
      );

      setActive(false);
      setActiveLogId(null);
      setStartTime(null);
      setElapsed(0);
      setStopNotes('');
      setShowStopModal(false);

      addToast(`Time logged: ${duration}`, 'success');
    } catch (err: unknown) {
      addToast(err instanceof Error ? err.message : 'Failed to stop timer', 'error');
    } finally {
      setStopping(false);
    }
  };

  return (
    <>
      <div className="flex items-center gap-2">
        <select
          value={projectId}
          onChange={e => setProjectId(e.target.value)}
          disabled={active}
          className="text-sm border border-gray-200 rounded-lg px-2 py-1.5 bg-white"
        >
          <option value="">Project...</option>
          {projects.map(p => (
            <option key={p._id} value={p._id}>
              {p.name}
            </option>
          ))}
        </select>

        {active && (
          <span className="font-mono text-indigo-600 font-bold bg-indigo-50 px-2 py-1 rounded">
            {formatTime(elapsed)}
          </span>
        )}

        {!active ? (
          <button
            onClick={handleStart}
            className="bg-emerald-500 hover:bg-emerald-600 text-white px-3 py-1.5 rounded-lg text-sm"
          >
            ▶ Start
          </button>
        ) : (
          <button
            onClick={confirmStop}
            className="bg-red-500 hover:bg-red-600 text-white px-3 py-1.5 rounded-lg text-sm"
          >
            ⏹ Stop
          </button>
        )}
      </div>

      {/* STOP NOTES MODAL */}
      {showStopModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center">
          <div className="bg-white rounded-xl w-full max-w-md p-5">
            <h3 className="text-lg font-semibold mb-2">What did you work on?</h3>

            <textarea
              value={stopNotes}
              onChange={e => setStopNotes(e.target.value)}
              rows={4}
              placeholder="Describe the work done…"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500"
            />

            <div className="flex justify-end gap-2 mt-4">
              <button
                onClick={() => setShowStopModal(false)}
                className="px-3 py-1.5 text-sm rounded-lg border"
                disabled={stopping}
              >
                Cancel
              </button>
              <button
                onClick={handleStop}
                disabled={stopping}
                className="px-3 py-1.5 text-sm rounded-lg bg-indigo-600 text-white disabled:opacity-60"
              >
                {stopping ? 'Saving…' : 'Save & Stop'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/* ───────────────────────────────────────────── */

const navLinks = [
  { path: '/', label: 'Dashboard', icon: '📊' },
  { path: '/clients', label: 'Clients', icon: '👥' },
  { path: '/projects', label: 'Projects', icon: '📁' },
  { path: '/time-tracker', label: 'Time Tracker', icon: '⏱️' },
  { path: '/invoices', label: 'Invoices', icon: '📄' },
  { path: '/settings', label: 'Settings', icon: '⚙️' },
];

export default function Layout() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const isActive = (path: string) =>
    path === '/' ? location.pathname === '/' : location.pathname.startsWith(path);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      <aside className="hidden lg:block w-64 bg-slate-900 text-white">
        <nav className="p-4">
          {navLinks.map(link => (
            <Link
              key={link.path}
              to={link.path}
              className={`block px-3 py-2 rounded-lg ${isActive(link.path)
                ? 'bg-indigo-500/20 text-indigo-300'
                : 'text-slate-400 hover:bg-slate-800'
                }`}
            >
              {link.icon} {link.label}
            </Link>
          ))}
        </nav>

        <div className="p-4 border-t border-slate-700">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-full bg-indigo-500 flex items-center justify-center text-xs font-bold">
              {user?.email?.charAt(0).toUpperCase()}
            </div>

            <div className="flex-1 min-w-0">
              <p className="text-xs text-slate-300 truncate">
                {user?.email}
              </p>

              <span
                className={`inline-block mt-1 text-[10px] px-2 py-0.5 rounded-full font-medium
          ${user?.plan === 'pro'
                    ? 'bg-amber-500/20 text-amber-300'
                    : 'bg-slate-700 text-slate-400'
                  }`}
              >
                {user?.plan === 'pro' ? '⭐ PRO' : 'FREE'}
              </span>
            </div>
          </div>

          <button
            onClick={handleLogout}
            className="text-xs text-red-400 hover:text-red-300 transition-colors"
          >
            Sign out →
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col">
        <header className="bg-white border-b px-4 py-3 flex justify-end">
          <Timer />
        </header>

        <main className="flex-1 overflow-y-auto p-4">
          <Outlet />
        </main>
      </div>
    </div>
  );
}