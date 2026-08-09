import React, { useState } from 'react';
import { Building2, KeyRound, User, ArrowRight, Info, CheckCircle2 } from 'lucide-react';
import { useApp } from '../context/AppContext';

export const LoginPage: React.FC = () => {
  const { login } = useApp();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const res = login(username, password);
    if (!res.success) {
      setError(res.message || 'Login failed. Please check your credentials.');
    }
  };

  const fillQuickCredentials = (user: 'mdm lim' | 'mr boon') => {
    setUsername(user);
    setPassword('demo123');
    setError('');
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8 font-sans">
      
      {/* Brand Header */}
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <div className="inline-flex p-3 bg-slate-100 text-slate-800 rounded-2xl border border-slate-200 mb-4 shadow-2xs">
          <Building2 className="w-8 h-8 text-slate-800" />
        </div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
          Boon Huat Supplier Payment Tracking
        </h1>
        <p className="mt-1 text-xs text-slate-500 font-medium">
          Internal Role-Based Finance System (Singapore)
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-6 shadow-xs rounded-2xl border border-slate-200 sm:px-10">

          <form onSubmit={handleLoginSubmit} className="space-y-5">
            <div className="border-b border-slate-100 pb-3">
              <h2 className="text-base font-bold text-slate-900">Sign In to Your Account</h2>
              <p className="text-xs text-slate-500">Enter your credentials to access the supplier payment system.</p>
            </div>

            {error && (
              <div className="p-3 bg-slate-100 border border-slate-300 text-slate-800 text-xs rounded-xl font-medium">
                {error}
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                User ID / Username
              </label>
              <div className="relative rounded-xl shadow-2xs">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <User className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="e.g. mdm lim or mr boon"
                  className="block w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-slate-900 focus:border-slate-900 font-mono text-slate-900 placeholder:text-slate-400 bg-white"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Password
              </label>
              <div className="relative rounded-xl shadow-2xs">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <KeyRound className="w-4 h-4" />
                </div>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter password..."
                  className="block w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-slate-900 focus:border-slate-900 text-slate-900 placeholder:text-slate-400 bg-white"
                  required
                />
              </div>
            </div>

            {/* Quick Select Buttons */}
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
              <div className="text-[11px] font-bold text-slate-700 flex items-center justify-between">
                <span>Quick Demo Credentials:</span>
                <span className="font-mono text-[10px] text-slate-600 font-semibold">Password: demo123</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => fillQuickCredentials('mdm lim')}
                  className={`px-3 py-2 text-xs font-semibold rounded-lg border text-left transition-all cursor-pointer ${
                    username.toLowerCase() === 'mdm lim'
                      ? 'bg-slate-900 border-slate-900 text-white font-bold shadow-2xs'
                      : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span>Mdm Lim</span>
                    <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold ${username.toLowerCase() === 'mdm lim' ? 'bg-slate-800 text-slate-200' : 'bg-slate-100 text-slate-700'}`}>Accounts</span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => fillQuickCredentials('mr boon')}
                  className={`px-3 py-2 text-xs font-semibold rounded-lg border text-left transition-all cursor-pointer ${
                    username.toLowerCase() === 'mr boon'
                      ? 'bg-slate-900 border-slate-900 text-white font-bold shadow-2xs'
                      : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span>Mr Boon</span>
                    <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold ${username.toLowerCase() === 'mr boon' ? 'bg-slate-800 text-slate-200' : 'bg-slate-100 text-slate-700'}`}>Manager</span>
                  </div>
                </button>
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-2.5 px-4 bg-slate-900 hover:bg-slate-800 text-white font-bold text-sm rounded-xl shadow-2xs flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              <span>Sign In to App 3</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          {/* Role Boundary Summary Note */}
          <div className="mt-6 pt-4 border-t border-slate-100 text-[11px] text-slate-600 space-y-1">
            <div className="flex items-center gap-1.5 font-bold text-slate-800">
              <Info className="w-3.5 h-3.5 text-slate-600" />
              <span>Role Permissions Matrix:</span>
            </div>
            <p className="text-slate-600">• <strong>Mdm Lim & Mr Boon:</strong> Both have access to Payment Queue, Withheld Review, Anomalies, Management, & Settings.</p>
            <p className="text-slate-600">• <strong>Restricted Action:</strong> Changing Cash Buffer Amount is Mr Boon-only (requires ID + Password re-entry).</p>
          </div>

        </div>
      </div>
    </div>
  );
};
