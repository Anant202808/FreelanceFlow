// ─────────────────────────────────────────────────────────────
// store.ts — All API calls to the real Express backend
// Base URL: http://localhost:5000
// ─────────────────────────────────────────────────────────────

const BASE_URL = (import.meta as { env?: { VITE_API_URL?: string } }).env?.VITE_API_URL || 'http://localhost:5000';

// ── Token helpers ──────────────────────────────────────────────
export function getToken(): string | null {
  return localStorage.getItem('ff_token');
}

function setToken(token: string): void {
  localStorage.setItem('ff_token', token);
}

export function clearToken(): void {
  localStorage.removeItem('ff_token');
}

// ── Base fetch wrapper ─────────────────────────────────────────
async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${BASE_URL}${path}`, { ...options, headers });
  const json = await res.json();

  if (!res.ok || !json.success) {
    throw new Error(json.error || 'Request failed');
  }

  return json.data as T;
}

// ===================== AUTH =====================

export interface AuthUser {
  id: string;
  email: string;
  plan: 'free' | 'pro';
  createdAt: string;
}

export interface AuthResult {
  token: string;
  user: AuthUser;
}

export async function register(email: string, password: string): Promise<AuthResult> {
  const data = await api<AuthResult>('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  setToken(data.token);
  return data;
}

export async function login(email: string, password: string): Promise<AuthResult> {
  const data = await api<AuthResult>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  setToken(data.token);
  return data;
}

export async function demoLogin(): Promise<AuthResult> {
  const data = await api<AuthResult>('/api/auth/demo-login', { method: 'POST' });
  setToken(data.token);
  return data;
}

export async function logout(): Promise<void> {
  clearToken();
}

export async function getMe(): Promise<AuthUser | null> {
  const token = getToken();
  if (!token) return null;
  try {
    return await api<AuthUser>('/api/auth/me');
  } catch {
    clearToken();
    return null;
  }
}

export async function upgradePlan(plan: 'free' | 'pro'): Promise<AuthUser> {
  return api<AuthUser>('/api/auth/plan', {
    method: 'PUT',
    body: JSON.stringify({ plan }),
  });
}

// ===================== CLIENTS =====================

export interface Client {
  _id: string;
  userId: string;
  name: string;
  email: string;
  phone: string;
  company: string;
  hourlyRate: number;
  projectCount?: number;
  createdAt: string;
}

export async function getClients(): Promise<Client[]> {
  return api<Client[]>('/api/clients');
}

export async function getClient(id: string): Promise<Client> {
  return api<Client>(`/api/clients/${id}`);
}

export async function createClient(data: Partial<Client>): Promise<Client> {
  return api<Client>('/api/clients', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateClient(id: string, data: Partial<Client>): Promise<Client> {
  return api<Client>(`/api/clients/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function deleteClient(id: string): Promise<void> {
  await api<void>(`/api/clients/${id}`, { method: 'DELETE' });
}

// ===================== PROJECTS =====================

export interface Project {
  _id: string;
  userId: string;
  clientId: string;
  clientName?: string;
  clientCompany?: string;
  name: string;
  status: 'active' | 'completed' | 'on-hold';
  budget: number;
  description: string;
  taskCount?: number;
  doneTaskCount?: number;
  totalCost?: number;
  burnRate?: number;
  createdAt: string;
}

export async function getProjects(filters?: { status?: string; clientId?: string }): Promise<Project[]> {
  const params = new URLSearchParams();
  if (filters?.status) params.set('status', filters.status);
  if (filters?.clientId) params.set('clientId', filters.clientId);
  const qs = params.toString();
  return api<Project[]>(`/api/projects${qs ? '?' + qs : ''}`);
}

export async function getProject(id: string): Promise<Project> {
  return api<Project>(`/api/projects/${id}`);
}

export async function createProject(data: Partial<Project>): Promise<Project> {
  return api<Project>('/api/projects', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateProject(id: string, data: Partial<Project>): Promise<Project> {
  return api<Project>(`/api/projects/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function deleteProject(id: string): Promise<void> {
  await api<void>(`/api/projects/${id}`, { method: 'DELETE' });
}

export async function getProjectBurnRate(id: string): Promise<{
  budget: number; totalCost: number; totalHours: number; burnRate: number;
}> {
  return api(`/api/projects/${id}/burn-rate`);
}

// ===================== TASKS =====================

export interface Task {
  _id: string;
  userId: string;
  projectId: string;
  title: string;
  dueDate: string;
  status: 'todo' | 'in-progress' | 'done';
  createdAt: string;
}

export async function getTasks(projectId?: string): Promise<Task[]> {
  const qs = projectId ? `?projectId=${projectId}` : '';
  return api<Task[]>(`/api/tasks${qs}`);
}

export async function createTask(data: Partial<Task>): Promise<Task> {
  return api<Task>('/api/tasks', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateTask(id: string, data: Partial<Task>): Promise<Task> {
  return api<Task>(`/api/tasks/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function deleteTask(id: string): Promise<void> {
  await api<void>(`/api/tasks/${id}`, { method: 'DELETE' });
}

// ===================== TIME LOGS =====================

export interface TimeLog {
  _id: string;
  userId: string;
  projectId: string | { _id: string; name: string };
  startTime: string;
  endTime: string | null;
  durationMinutes: number;
  hourlyRate: number;
  notes: string;
  isBilled: boolean;
  createdAt: string;
}

export async function getTimeLogs(filters?: {
  projectId?: string;
  isBilled?: boolean;
  from?: string;
  to?: string;
}): Promise<TimeLog[]> {
  const params = new URLSearchParams();
  if (filters?.projectId) params.set('projectId', filters.projectId);
  if (filters?.isBilled !== undefined) params.set('isBilled', String(filters.isBilled));
  if (filters?.from) params.set('from', filters.from);
  if (filters?.to) params.set('to', filters.to);
  const qs = params.toString();
  return api<TimeLog[]>(`/api/timelogs${qs ? '?' + qs : ''}`);
}

export async function getActiveTimer(): Promise<TimeLog | null> {
  return api<TimeLog | null>('/api/timelogs/active');
}

export async function createTimeLog(data: Partial<TimeLog>): Promise<TimeLog> {
  return api<TimeLog>('/api/timelogs', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function startTimer(projectId: string): Promise<TimeLog> {
  return api<TimeLog>('/api/timelogs/start', {
    method: 'POST',
    body: JSON.stringify({ projectId }),
  });
}

export async function stopTimer(id: string, data?: { hourlyRate?: number; notes?: string }): Promise<TimeLog> {
  return api<TimeLog>(`/api/timelogs/stop/${id}`, {
    method: 'POST',
    body: JSON.stringify(data || {}),
  });
}

export async function updateTimeLog(id: string, data: Partial<TimeLog>): Promise<TimeLog> {
  return api<TimeLog>(`/api/timelogs/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function deleteTimeLog(id: string): Promise<void> {
  await api<void>(`/api/timelogs/${id}`, { method: 'DELETE' });
}

// ===================== INVOICES =====================

export interface InvoiceLineItem {
  timeLogId: string;
  description: string;
  hours: number;
  rate: number;
  amount: number;
}

export interface Invoice {
  _id: string;
  userId: string;
  clientId: string;
  clientName?: string;
  clientCompany?: string;
  clientEmail?: string;
  status: 'draft' | 'sent' | 'paid';
  totalAmount: number;
  dateFrom: string;
  dateTo: string;
  lineItems: InvoiceLineItem[];
  pdfUrl: string | null;
  createdAt: string;
}

export interface InvoicePreview {
  lineItems: InvoiceLineItem[];
  totalAmount: number;
  logCount: number;
}

export async function getInvoices(filters?: { status?: string; clientId?: string }): Promise<Invoice[]> {
  const params = new URLSearchParams();
  if (filters?.status) params.set('status', filters.status);
  if (filters?.clientId) params.set('clientId', filters.clientId);
  const qs = params.toString();
  return api<Invoice[]>(`/api/invoices${qs ? '?' + qs : ''}`);
}

export async function getInvoice(id: string): Promise<Invoice> {
  return api<Invoice>(`/api/invoices/${id}`);
}

export async function previewInvoice(clientId: string, dateFrom: string, dateTo: string): Promise<InvoicePreview> {
  return api<InvoicePreview>(
    `/api/invoices/preview?clientId=${clientId}&dateFrom=${dateFrom}&dateTo=${dateTo}`
  );
}

export async function createInvoice(data: { clientId: string; dateFrom: string; dateTo: string }): Promise<Invoice> {
  return api<Invoice>('/api/invoices', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function generateInvoicePDF(id: string): Promise<{ pdfUrl: string; invoice: Invoice }> {
  return api(`/api/invoices/${id}/generate-pdf`, { method: 'POST' });
}

export async function markInvoicePaid(id: string): Promise<Invoice> {
  return api<Invoice>(`/api/invoices/${id}/mark-paid`, { method: 'PUT' });
}

export async function deleteInvoice(id: string): Promise<void> {
  await api<void>(`/api/invoices/${id}`, { method: 'DELETE' });
}

// ===================== DASHBOARD =====================

export interface DashboardStats {
  activeProjects: number;
  pendingInvoicesTotal: number;
  hoursThisMonth: number;
  upcomingDeadlines: {
    id: string;
    title: string;
    dueDate: string;
    projectName: string;
    status: string;
  }[];
  monthlyRevenue: { month: string; year: number; revenue: number }[];
  invoiceBreakdown: { status: string; count: number; total: number }[];
}

export async function getDashboardStats(): Promise<DashboardStats> {
  return api<DashboardStats>('/api/dashboard/stats');
}

// ===================== SEED =====================

export async function seedDemoData(): Promise<{ message: string; counts: Record<string, number> }> {
  return api('/api/seed/demo', { method: 'POST' });
}
