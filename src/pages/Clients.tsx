import { useState, useEffect, useCallback } from 'react';
import { useAuth, useToast } from '../context';
import * as store from '../store';
import type { Client } from '../types';

// ── Validation helpers ──────────────────────────────────────────
function validateEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function validatePhone(phone: string): boolean {
  // Allows: +91 9876543210 | (555) 123-4567 | 9876543210 | +1-800-555-0199
  return /^[+]?[\d\s\-().]{7,15}$/.test(phone);
}

interface FormErrors {
  name?: string;
  email?: string;
  phone?: string;
  hourlyRate?: string;
}

export default function ClientsPage() {
  const { user } = useAuth();
  const { addToast } = useToast();
  const [clients, setClients] = useState<Client[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Client | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', phone: '', company: '', hourlyRate: 100 });
  const [errors, setErrors] = useState<FormErrors>({});

  const reload = useCallback(async () => {
    try {
      const data = await store.getClients();
      setClients(data);
    } catch (err: unknown) {
      addToast(err instanceof Error ? err.message : 'Failed to load clients', 'error');
    }
  }, [addToast]);

  useEffect(() => { reload(); }, [reload]);

  const openAdd = () => {
    setEditing(null);
    setForm({ name: '', email: '', phone: '', company: '', hourlyRate: 100 });
    setErrors({});
    setShowModal(true);
  };

  const openEdit = (c: Client) => {
    setEditing(c);
    setForm({ name: c.name, email: c.email, phone: c.phone, company: c.company, hourlyRate: c.hourlyRate });
    setErrors({});
    setShowModal(true);
  };

  // ── Validate all fields, return true if valid ──────────────────
  const validate = (): boolean => {
    const newErrors: FormErrors = {};

    // Name — required
    if (!form.name.trim()) {
      newErrors.name = 'Client name is required';
    } else if (form.name.trim().length < 2) {
      newErrors.name = 'Name must be at least 2 characters';
    }

    // Email — optional but must be valid format if provided
    if (form.email.trim() && !validateEmail(form.email.trim())) {
      newErrors.email = 'Enter a valid email address (e.g. john@example.com)';
    }

    // Phone — optional but must be valid format if provided
    if (form.phone.trim() && !validatePhone(form.phone.trim())) {
      newErrors.phone = 'Enter a valid phone number (7–15 digits, e.g. +91 9876543210)';
    }

    // Hourly rate — must be a positive number
    if (form.hourlyRate < 0) {
      newErrors.hourlyRate = 'Hourly rate cannot be negative';
    } else if (form.hourlyRate > 100000) {
      newErrors.hourlyRate = 'Hourly rate seems too high';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;

    setSaving(true);
    try {
      if (editing) {
        await store.updateClient(editing._id, form);
        addToast('Client updated!');
      } else {
        await store.createClient(form);
        addToast('Client added!');
      }
      setShowModal(false);
      reload();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error';
      if (msg.includes('max 2') || msg.includes('Free plan')) {
        addToast('Free plan is limited to 2 clients. Upgrade to Pro!', 'error');
      } else {
        addToast(msg, 'error');
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this client and all related data?')) return;
    try {
      await store.deleteClient(id);
      addToast('Client deleted');
      reload();
    } catch (err: unknown) {
      addToast(err instanceof Error ? err.message : 'Delete failed', 'error');
    }
  };

  // Clear individual field error when user starts typing
  const updateField = (field: keyof typeof form, value: string | number) => {
    setForm({ ...form, [field]: value });
    if (errors[field as keyof FormErrors]) {
      setErrors({ ...errors, [field]: undefined });
    }
  };

  const atLimit = user?.plan === 'free' && clients.length >= 2;

  return (
    <div className="max-w-6xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Clients</h1>
          <p className="text-sm text-gray-500 mt-1">{clients.length} client{clients.length !== 1 ? 's' : ''}</p>
        </div>
        <button
          onClick={openAdd}
          className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          + Add Client
        </button>
      </div>

      {atLimit && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center gap-3">
          <span className="text-2xl">⭐</span>
          <div>
            <p className="font-medium text-amber-800">Free plan limit reached</p>
            <p className="text-sm text-amber-600">Upgrade to Pro for unlimited clients, invoicing, and more.</p>
          </div>
        </div>
      )}

      {clients.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <p className="text-4xl mb-3">👥</p>
          <p className="text-gray-500 font-medium">No clients yet</p>
          <p className="text-sm text-gray-400 mt-1">Add your first client to get started</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-5 py-3">Name</th>
                  <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-5 py-3">Company</th>
                  <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-5 py-3 hidden sm:table-cell">Email</th>
                  <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-5 py-3 hidden md:table-cell">Phone</th>
                  <th className="text-right text-xs font-semibold text-gray-500 uppercase tracking-wider px-5 py-3">Rate</th>
                  <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-5 py-3 hidden md:table-cell">Projects</th>
                  <th className="text-right text-xs font-semibold text-gray-500 uppercase tracking-wider px-5 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {clients.map(c => (
                  <tr key={c._id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 text-xs font-bold">
                          {c.name.charAt(0).toUpperCase()}
                        </div>
                        <span className="font-medium text-gray-900 text-sm">{c.name}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-sm text-gray-600">{c.company}</td>
                    <td className="px-5 py-3 text-sm text-gray-500 hidden sm:table-cell">{c.email}</td>
                    <td className="px-5 py-3 text-sm text-gray-500 hidden md:table-cell">{c.phone}</td>
                    <td className="px-5 py-3 text-sm text-gray-900 text-right font-medium">${c.hourlyRate}/hr</td>
                    <td className="px-5 py-3 text-sm text-gray-500 hidden md:table-cell">{c.projectCount ?? 0}</td>
                    <td className="px-5 py-3 text-right">
                      <button onClick={() => openEdit(c)} className="text-indigo-600 hover:text-indigo-800 text-sm font-medium mr-3">Edit</button>
                      <button onClick={() => handleDelete(c._id)} className="text-red-500 hover:text-red-700 text-sm font-medium">Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowModal(false)}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-gray-900 mb-4">{editing ? 'Edit Client' : 'Add Client'}</h2>
            <div className="space-y-3">

              {/* Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Name <span className="text-red-500">*</span>
                </label>
                <input
                  value={form.name}
                  onChange={e => updateField('name', e.target.value)}
                  placeholder="John Smith"
                  className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 ${errors.name ? 'border-red-400 bg-red-50' : 'border-gray-300'
                    }`}
                />
                {errors.name && <p className="text-red-500 text-xs mt-1">⚠ {errors.name}</p>}
              </div>

              {/* Email */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input
                  type="text"
                  value={form.email}
                  onChange={e => updateField('email', e.target.value)}
                  placeholder="john@example.com"
                  className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 ${errors.email ? 'border-red-400 bg-red-50' : 'border-gray-300'
                    }`}
                />
                {errors.email && <p className="text-red-500 text-xs mt-1">⚠ {errors.email}</p>}
              </div>

              {/* Company */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Company</label>
                <input
                  value={form.company}
                  onChange={e => updateField('company', e.target.value)}
                  placeholder="Acme Corp"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* Phone */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                <input
                  value={form.phone}
                  onChange={e => updateField('phone', e.target.value)}
                  placeholder="+91 9876543210"
                  className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 ${errors.phone ? 'border-red-400 bg-red-50' : 'border-gray-300'
                    }`}
                />
                {errors.phone && <p className="text-red-500 text-xs mt-1">⚠ {errors.phone}</p>}
              </div>

              {/* Hourly Rate */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Hourly Rate ($)</label>
                <input
                  type="number"
                  min="0"
                  value={form.hourlyRate}
                  onChange={e => updateField('hourlyRate', Number(e.target.value))}
                  placeholder="100"
                  className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 ${errors.hourlyRate ? 'border-red-400 bg-red-50' : 'border-gray-300'
                    }`}
                />
                {errors.hourlyRate && <p className="text-red-500 text-xs mt-1">⚠ {errors.hourlyRate}</p>}
              </div>

            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowModal(false)} className="flex-1 border border-gray-300 text-gray-700 py-2 rounded-lg text-sm font-medium hover:bg-gray-50">
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white py-2 rounded-lg text-sm font-medium"
              >
                {saving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}