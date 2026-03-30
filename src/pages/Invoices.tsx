import { useState, useEffect, useCallback } from 'react';
import { useAuth, useToast } from '../context';
import * as store from '../store';
import type { Invoice, Client, InvoiceLineItem } from '../types';

function StatusBadge({ status }: { status: Invoice['status'] }) {
  const styles = {
    draft: 'bg-gray-100 text-gray-600',
    sent: 'bg-blue-100 text-blue-700',
    paid: 'bg-emerald-100 text-emerald-700',
  };
  return (
    <span className={`text-xs font-medium px-2 py-1 rounded-full ${styles[status]}`}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

function InvoiceWizard({ clients, onClose, onCreated }: {
  clients: Client[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const { addToast } = useToast();
  const [step, setStep] = useState(1);
  const [clientId, setClientId] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [preview, setPreview] = useState<{ lineItems: InvoiceLineItem[]; totalAmount: number; logCount: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);

  const handlePreview = async () => {
    if (!clientId || !dateFrom || !dateTo) { addToast('Fill in all fields', 'error'); return; }
    setLoading(true);
    try {
      const data = await store.previewInvoice(clientId, dateFrom, dateTo);
      setPreview(data);
      setStep(3);
    } catch (err: unknown) {
      addToast(err instanceof Error ? err.message : 'No unbilled logs found', 'error');
    } finally { setLoading(false); }
  };

  const handleCreate = async () => {
    setCreating(true);
    try {
      await store.createInvoice({ clientId, dateFrom, dateTo });
      addToast('Invoice created! 🎉', 'success');
      onCreated();
      onClose();
    } catch (err: unknown) {
      addToast(err instanceof Error ? err.message : 'Failed to create invoice', 'error');
    } finally { setCreating(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-2 mb-6">
          {[1, 2, 3, 4].map(s => (
            <div key={s} className="flex items-center gap-2 flex-1">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${step >= s ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-400'}`}>{s}</div>
              {s < 4 && <div className={`h-px flex-1 ${step > s ? 'bg-indigo-300' : 'bg-gray-200'}`} />}
            </div>
          ))}
        </div>

        {step === 1 && (
          <div>
            <h2 className="text-lg font-bold text-gray-900 mb-1">Select Client</h2>
            <p className="text-sm text-gray-500 mb-4">Who are you invoicing?</p>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {clients.map(c => (
                <button key={c._id || c.id} onClick={() => setClientId(c._id || c.id)}
                  className={`w-full text-left p-4 rounded-xl border-2 transition-all ${clientId === (c._id || c.id) ? 'border-indigo-500 bg-indigo-50' : 'border-gray-200 hover:border-gray-300'}`}>
                  <p className="font-medium text-gray-900">{c.name}</p>
                  <p className="text-sm text-gray-500">{c.company} • ${c.hourlyRate}/hr</p>
                </button>
              ))}
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={onClose} className="flex-1 border border-gray-300 text-gray-700 py-2 rounded-lg text-sm font-medium">Cancel</button>
              <button onClick={() => setStep(2)} disabled={!clientId} className="flex-1 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white py-2 rounded-lg text-sm font-medium">Next →</button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div>
            <h2 className="text-lg font-bold text-gray-900 mb-1">Date Range</h2>
            <p className="text-sm text-gray-500 mb-4">Unbilled logs in this range will be included</p>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">From</label>
                <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">To</label>
                <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setStep(1)} className="flex-1 border border-gray-300 text-gray-700 py-2 rounded-lg text-sm font-medium">← Back</button>
              <button onClick={handlePreview} disabled={!dateFrom || !dateTo || loading} className="flex-1 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white py-2 rounded-lg text-sm font-medium">
                {loading ? 'Loading...' : 'Preview →'}
              </button>
            </div>
          </div>
        )}

        {step === 3 && preview && (
          <div>
            <h2 className="text-lg font-bold text-gray-900 mb-1">Preview</h2>
            <p className="text-sm text-gray-500 mb-4">{preview.logCount} time log{preview.logCount !== 1 ? 's' : ''} found</p>
            <div className="bg-gray-50 rounded-xl p-4 max-h-48 overflow-y-auto mb-4">
              <table className="w-full text-sm">
                <thead><tr className="text-xs text-gray-500 border-b border-gray-200"><th className="text-left pb-2">Description</th><th className="text-right pb-2">Hours</th><th className="text-right pb-2">Amount</th></tr></thead>
                <tbody>
                  {preview.lineItems.map((item, i) => (
                    <tr key={i} className="border-b border-gray-100 last:border-0">
                      <td className="py-2 text-gray-700 text-xs truncate max-w-[180px]">{item.description}</td>
                      <td className="py-2 text-right text-gray-600">{item.hours}h</td>
                      <td className="py-2 text-right font-medium">${item.amount.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex justify-between items-center p-3 bg-indigo-50 rounded-xl mb-4">
              <span className="font-semibold text-gray-900">Total</span>
              <span className="text-xl font-bold text-indigo-600">${preview.totalAmount.toFixed(2)}</span>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setStep(2)} className="flex-1 border border-gray-300 text-gray-700 py-2 rounded-lg text-sm font-medium">← Back</button>
              <button onClick={() => setStep(4)} className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white py-2 rounded-lg text-sm font-medium">Confirm →</button>
            </div>
          </div>
        )}

        {step === 4 && preview && (
          <div className="text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center text-3xl mx-auto mb-4">✓</div>
            <h2 className="text-lg font-bold text-gray-900 mb-2">Ready to Create</h2>
            <p className="text-sm text-gray-500 mb-2">Total: <span className="text-indigo-600 font-bold text-lg">${preview.totalAmount.toFixed(2)}</span></p>
            <p className="text-xs text-gray-400 mb-6">Time logs will be marked as billed after PDF generation.</p>
            <div className="flex gap-3">
              <button onClick={() => setStep(3)} className="flex-1 border border-gray-300 text-gray-700 py-2 rounded-lg text-sm font-medium">← Back</button>
              <button onClick={handleCreate} disabled={creating} className="flex-1 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white py-2 rounded-lg text-sm font-medium">
                {creating ? 'Creating...' : 'Create Invoice 🎉'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function InvoicesPage() {
  const { user } = useAuth();
  const { addToast } = useToast();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [showWizard, setShowWizard] = useState(false);
  const [generatingId, setGeneratingId] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      const [inv, cli] = await Promise.all([store.getInvoices(), store.getClients()]);
      setInvoices(inv);
      setClients(cli);
    } catch (err: unknown) {
      addToast(err instanceof Error ? err.message : 'Failed to load', 'error');
    }
  }, [addToast]);

  useEffect(() => { reload(); }, [reload]);

  const handleGeneratePDF = async (id: string) => {
    setGeneratingId(id);
    try {
      const result = await store.generateInvoicePDF(id);
      addToast('PDF generated! Opening download...', 'success');
      window.open(`http://localhost:5000${result.pdfUrl}`, '_blank');
      reload();
    } catch (err: unknown) {
      addToast(err instanceof Error ? err.message : 'PDF generation failed (Pro plan required)', 'error');
    } finally { setGeneratingId(null); }
  };

  const handleMarkPaid = async (id: string) => {
    try {
      await store.markInvoicePaid(id);
      addToast('Marked as paid ✓');
      reload();
    } catch (err: unknown) {
      addToast(err instanceof Error ? err.message : 'Failed', 'error');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this invoice? Time logs will be un-billed.')) return;
    try {
      await store.deleteInvoice(id);
      addToast('Invoice deleted');
      reload();
    } catch (err: unknown) {
      addToast(err instanceof Error ? err.message : 'Delete failed', 'error');
    }
  };

  const isPro = user?.plan === 'pro';

  return (
    <div className="max-w-6xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Invoices</h1>
          <p className="text-sm text-gray-500 mt-1">{invoices.length} invoice{invoices.length !== 1 ? 's' : ''}</p>
        </div>
        {isPro ? (
          <button onClick={() => setShowWizard(true)} className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium">
            + Create Invoice
          </button>
        ) : (
          <button onClick={() => addToast('Upgrade to Pro in Settings to create invoices', 'info')} className="bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 rounded-lg text-sm font-medium">
            ⭐ Upgrade to Pro
          </button>
        )}
      </div>

      {!isPro && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center gap-3">
          <span className="text-2xl">⭐</span>
          <div>
            <p className="font-medium text-amber-800">Invoicing requires Pro plan</p>
            <p className="text-sm text-amber-600">Upgrade to Pro to create invoices and generate PDF receipts.</p>
          </div>
        </div>
      )}

      {invoices.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <p className="text-4xl mb-3">📄</p>
          <p className="text-gray-500 font-medium">No invoices yet</p>
          <p className="text-sm text-gray-400 mt-1">{isPro ? 'Create your first invoice' : 'Upgrade to Pro to start invoicing'}</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left text-xs font-semibold text-gray-500 uppercase px-5 py-3">Invoice</th>
                  <th className="text-left text-xs font-semibold text-gray-500 uppercase px-5 py-3">Client</th>
                  <th className="text-left text-xs font-semibold text-gray-500 uppercase px-5 py-3 hidden sm:table-cell">Period</th>
                  <th className="text-right text-xs font-semibold text-gray-500 uppercase px-5 py-3">Amount</th>
                  <th className="text-center text-xs font-semibold text-gray-500 uppercase px-5 py-3">Status</th>
                  <th className="text-right text-xs font-semibold text-gray-500 uppercase px-5 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {invoices.map(inv => {
                  const id = inv._id || inv.id || '';
                  return (
                    <tr key={id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-5 py-3">
                        <p className="text-sm font-mono text-gray-700">INV-{id.slice(-8).toUpperCase()}</p>
                        <p className="text-xs text-gray-400">{new Date(inv.createdAt).toLocaleDateString()}</p>
                      </td>
                      <td className="px-5 py-3">
                        <p className="text-sm font-medium text-gray-900">{inv.clientName || 'Unknown'}</p>
                        <p className="text-xs text-gray-400">{inv.clientCompany}</p>
                      </td>
                      <td className="px-5 py-3 text-sm text-gray-500 hidden sm:table-cell">
                        {new Date(inv.dateFrom).toLocaleDateString()} — {new Date(inv.dateTo).toLocaleDateString()}
                      </td>
                      <td className="px-5 py-3 text-right font-bold text-gray-900 text-sm">${inv.totalAmount.toFixed(2)}</td>
                      <td className="px-5 py-3 text-center"><StatusBadge status={inv.status} /></td>
                      <td className="px-5 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {inv.pdfUrl ? (
                            <a href={`http://localhost:5000${inv.pdfUrl}`} target="_blank" rel="noreferrer" className="text-indigo-600 hover:text-indigo-800 text-xs font-medium">📥 PDF</a>
                          ) : (
                            <button onClick={() => handleGeneratePDF(id)} disabled={generatingId === id} className="text-indigo-600 hover:text-indigo-800 disabled:opacity-50 text-xs font-medium">
                              {generatingId === id ? '...' : '📄 PDF'}
                            </button>
                          )}
                          {inv.status !== 'paid' && (
                            <button onClick={() => handleMarkPaid(id)} className="text-emerald-600 hover:text-emerald-800 text-xs font-medium">✓ Paid</button>
                          )}
                          <button onClick={() => handleDelete(id)} className="text-red-400 hover:text-red-600 text-xs font-medium">Delete</button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showWizard && <InvoiceWizard clients={clients} onClose={() => setShowWizard(false)} onCreated={reload} />}
    </div>
  );
}
