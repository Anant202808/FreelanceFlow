import { useAuth, useToast } from '../context';

export default function SettingsPage() {
  const { user, refreshUser } = useAuth();
  const { addToast } = useToast();


  const handleUpgrade = async () => {
    if (!user) return;
    try {
      const newPlan = user.plan === 'pro' ? 'free' : 'pro';
      // Call the plan update endpoint
      const token = localStorage.getItem('ff_token');
      const res = await fetch('http://localhost:5000/api/auth/plan', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ plan: newPlan }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      await refreshUser();
      addToast(newPlan === 'pro' ? 'Upgraded to Pro! 🎉' : 'Downgraded to Free plan');
    } catch (err: unknown) {
      addToast(err instanceof Error ? err.message : 'Failed to update plan', 'error');
    }
  };


  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="text-sm text-gray-500 mt-1">Manage your account and preferences</p>
      </div>

      {/* Profile */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Profile</h2>
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-indigo-100 flex items-center justify-center text-2xl font-bold text-indigo-600">
            {user?.email?.charAt(0).toUpperCase()}
          </div>
          <div>
            <p className="font-medium text-gray-900">{user?.email}</p>
            <p className="text-sm text-gray-500">Member since {user ? new Date(user.createdAt).toLocaleDateString() : ''}</p>
          </div>
        </div>
      </div>

      {/* Plan */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Plan</h2>
        <div className="flex flex-col sm:flex-row gap-4">
          <div className={`flex-1 rounded-xl border-2 p-5 ${user?.plan === 'free' ? 'border-indigo-500 bg-indigo-50/30' : 'border-gray-200'}`}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-gray-900">Free</h3>
              {user?.plan === 'free' && <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-1 rounded-full font-medium">Current</span>}
            </div>
            <p className="text-2xl font-bold text-gray-900 mb-3">$0<span className="text-sm font-normal text-gray-500">/mo</span></p>
            <ul className="space-y-2 text-sm text-gray-600 mb-4">
              <li className="flex items-center gap-2"><span className="text-emerald-500">✓</span> Up to 2 clients</li>
              <li className="flex items-center gap-2"><span className="text-emerald-500">✓</span> Unlimited projects</li>
              <li className="flex items-center gap-2"><span className="text-emerald-500">✓</span> Time tracking</li>
              <li className="flex items-center gap-2"><span className="text-gray-300">✕</span> <span className="text-gray-400">Invoicing</span></li>
              <li className="flex items-center gap-2"><span className="text-gray-300">✕</span> <span className="text-gray-400">PDF export</span></li>
            </ul>
            {user?.plan === 'pro' && (
              <button onClick={handleUpgrade} className="w-full border border-gray-300 text-gray-700 py-2 rounded-lg text-sm font-medium hover:bg-gray-50">
                Switch to Free
              </button>
            )}
          </div>

          <div className={`flex-1 rounded-xl border-2 p-5 ${user?.plan === 'pro' ? 'border-indigo-500 bg-indigo-50/30' : 'border-gray-200'}`}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-gray-900">Pro ⭐</h3>
              {user?.plan === 'pro' && <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-1 rounded-full font-medium">Current</span>}
            </div>
            <p className="text-2xl font-bold text-gray-900 mb-3">$9.99<span className="text-sm font-normal text-gray-500">/mo</span></p>
            <ul className="space-y-2 text-sm text-gray-600 mb-4">
              <li className="flex items-center gap-2"><span className="text-emerald-500">✓</span> Unlimited clients</li>
              <li className="flex items-center gap-2"><span className="text-emerald-500">✓</span> Unlimited projects</li>
              <li className="flex items-center gap-2"><span className="text-emerald-500">✓</span> Time tracking</li>
              <li className="flex items-center gap-2"><span className="text-emerald-500">✓</span> Professional invoicing</li>
              <li className="flex items-center gap-2"><span className="text-emerald-500">✓</span> PDF export</li>
            </ul>
            {user?.plan === 'free' && (
              <button onClick={handleUpgrade} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-2 rounded-lg text-sm font-medium transition-colors">
                Upgrade to Pro →
              </button>
            )}
          </div>
        </div>
      </div>

    </div>
  );
}
