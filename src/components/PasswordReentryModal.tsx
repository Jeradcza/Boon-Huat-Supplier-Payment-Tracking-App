import React, { useState } from 'react';
import { Lock, KeyRound, X, AlertTriangle, User } from 'lucide-react';
import { useApp } from '../context/AppContext';

interface PasswordReentryModalProps {
  isOpen: boolean;
  actionTitle: string;
  onSuccess: () => void;
  onCancel: () => void;
}

export const PasswordReentryModal: React.FC<PasswordReentryModalProps> = ({
  isOpen,
  actionTitle,
  onSuccess,
  onCancel,
}) => {
  const { checkPasswordReentry } = useApp();
  const [userId, setUserId] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (checkPasswordReentry(userId, password)) {
      setError('');
      setPassword('');
      setUserId('');
      onSuccess();
    } else {
      setError('Invalid Manager ID or Password. Changing cash buffer requires Mr Boon credentials (ID: "mr boon", Password: "demo123").');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-md overflow-hidden">
        <div className="p-6">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-slate-100 text-slate-800 rounded-lg">
                <Lock className="w-5 h-5 text-slate-700" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-slate-900">
                  Manager Identity Re-authentication
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Action: <span className="font-medium text-slate-700">{actionTitle}</span>
                </p>
              </div>
            </div>
            <button
              onClick={onCancel}
              className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="mt-5 space-y-4">
            <div className="p-3 bg-slate-100 border border-slate-200 rounded-lg text-xs text-slate-800 flex items-start gap-2">
              <KeyRound className="w-4 h-4 text-slate-600 shrink-0 mt-0.5" />
              <div>
                <strong className="text-slate-900">Restricted Action: Changing Cash Buffer Amount</strong>
                <p className="mt-0.5 text-slate-600">
                  Please re-enter Mr Boon's Manager User ID and Password to authorize changing the cash buffer.
                </p>
                <div className="mt-1 font-mono text-[11px] text-slate-800">
                  Demo Manager ID: <strong>mr boon</strong> &bull; Password: <strong>demo123</strong>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Manager User ID / Username
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <User className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  value={userId}
                  onChange={(e) => {
                    setUserId(e.target.value);
                    setError('');
                  }}
                  placeholder="e.g. mr boon"
                  className="w-full pl-9 pr-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-slate-900 text-slate-900"
                  autoFocus
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Manager Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <KeyRound className="w-4 h-4" />
                </div>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setError('');
                  }}
                  placeholder="Enter manager password..."
                  className="w-full pl-9 pr-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-slate-900 text-slate-900"
                />
              </div>
            </div>

            {error && (
              <div className="p-2.5 bg-slate-100 border border-slate-300 rounded-lg text-xs text-slate-800 flex items-center gap-1.5 font-semibold">
                <AlertTriangle className="w-4 h-4 shrink-0 text-slate-700" />
                <span>{error}</span>
              </div>
            )}

            <div className="pt-2 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={onCancel}
                className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 cursor-pointer"
              >
                Cancel Reverts Changes
              </button>
              <button
                type="submit"
                className="px-4 py-2 text-sm font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-xl shadow-2xs cursor-pointer"
              >
                Verify ID & Proceed
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
