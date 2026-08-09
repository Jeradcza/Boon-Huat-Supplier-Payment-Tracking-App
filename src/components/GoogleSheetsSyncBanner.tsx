import React, { useState } from 'react';
import {
  FileSpreadsheet,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Link2,
  ExternalLink,
  LogOut,
  Database,
  Sparkles,
} from 'lucide-react';
import { useGoogleSync } from '../context/GoogleSyncContext';
import { useApp } from '../context/AppContext';
import { GoogleSignInButton } from './GoogleSignInButton';

export const GoogleSheetsSyncBanner: React.FC = () => {
  const { settings, updateGoogleSheetUrl } = useApp();
  const {
    googleUser,
    isAuthLoading,
    authError,
    syncStatus,
    spreadsheetId,
    spreadsheetUrl,
    spreadsheetTitle,
    lastSyncedAt,
    paymentQueueCount,
    paymentReadyCount,
    errorMessage,
    loginWithGoogle,
    logoutGoogle,
    connectSpreadsheet,
    syncNow,
  } = useGoogleSync();

  const [inputUrl, setInputUrl] = useState<string>(spreadsheetUrl || settings.googleSheetUrl || spreadsheetId || '');

  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputUrl.trim()) return;
    updateGoogleSheetUrl(inputUrl.trim());
    await connectSpreadsheet(inputUrl);
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden mb-6">
      {/* Top Banner Bar */}
      <div className="p-4 sm:p-5 bg-slate-50 border-b border-slate-200 text-slate-900 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="p-2.5 bg-slate-100 text-slate-800 rounded-xl border border-slate-200 shrink-0">
            <FileSpreadsheet className="w-6 h-6 text-slate-700" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap mb-1">
              {/* Connection Status Badge */}
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold tracking-wide uppercase flex items-center gap-1.5 border bg-slate-100 text-slate-800 border-slate-200">
                {syncStatus === 'Up to Date' || syncStatus === 'Connected' ? (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5 text-slate-700" />
                    <span>✓ Connected to Google Sheets</span>
                  </>
                ) : syncStatus === 'Synchronising...' ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 text-slate-700 animate-spin" />
                    <span>Synchronising...</span>
                  </>
                ) : syncStatus === 'Error' ? (
                  <>
                    <AlertCircle className="w-3.5 h-3.5 text-slate-700" />
                    <span>Sync Error</span>
                  </>
                ) : (
                  <>
                    <Database className="w-3.5 h-3.5 text-slate-500" />
                    <span>Disconnected</span>
                  </>
                )}
              </span>

              {/* Status Indicator Pill */}
              <span className="text-[11px] font-mono text-slate-600 bg-white px-2.5 py-0.5 rounded-md border border-slate-200 shadow-2xs">
                Status: <strong className="text-slate-900">{syncStatus}</strong>
              </span>
            </div>

            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <span>{spreadsheetTitle || 'Live Google Sheets Database'}</span>
              {googleUser && (
                <span className="text-xs font-semibold text-slate-600 font-mono">
                  ({googleUser.email})
                </span>
              )}
            </h3>

            {/* Synchronisation Indicators Summary */}
            <div className="flex items-center gap-4 text-xs font-mono text-slate-700 mt-2 flex-wrap">
              <span>
                Last Synchronised:{' '}
                <strong className="text-slate-900 font-bold">{lastSyncedAt || 'Not yet'}</strong>
              </span>
              <span className="text-slate-300">•</span>
              <span>
                Payment Records: <strong className="text-slate-900 font-bold">{paymentQueueCount}</strong>
              </span>
              <span className="text-slate-300">•</span>
              <span>
                Payment-Ready Invoices (<code className="text-slate-800 bg-slate-100 px-1 py-0.5 rounded border border-slate-200 font-bold">MATCH_RESULTS</code>):{' '}
                <strong className="text-slate-900 font-bold">{paymentReadyCount}</strong>
              </span>
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 flex-wrap shrink-0">
          {!googleUser ? (
            <GoogleSignInButton onClick={loginWithGoogle} isLoading={isAuthLoading} />
          ) : (
            <>
              <button
                onClick={syncNow}
                disabled={syncStatus === 'Synchronising...'}
                className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl shadow-2xs transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <RefreshCw
                  className={`w-3.5 h-3.5 ${syncStatus === 'Synchronising...' ? 'animate-spin' : ''}`}
                />
                <span>Sync Now</span>
              </button>

              <button
                onClick={logoutGoogle}
                className="px-3 py-2 bg-white hover:bg-slate-100 text-slate-700 text-xs font-bold rounded-xl border border-slate-200 transition-colors flex items-center gap-1 cursor-pointer shadow-2xs"
                title="Disconnect Google account"
              >
                <LogOut className="w-3.5 h-3.5 text-slate-500" />
                <span>Sign Out</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Spreadsheet Link Input & Error Messages */}
      <div className="p-4 bg-white border-t border-slate-200">
        <form onSubmit={handleConnect} className="flex flex-col sm:flex-row items-center gap-2">
          <div className="relative flex-1 w-full">
            <Link2 className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={inputUrl}
              onChange={(e) => setInputUrl(e.target.value)}
              placeholder="Enter Google Spreadsheet ID or URL (e.g. 1A2b3C4d5E6f7G8h9I0j)..."
              className="w-full pl-9 pr-3 py-2 text-xs border border-slate-300 rounded-xl font-mono focus:ring-2 focus:ring-slate-900 text-slate-900 bg-white"
            />
          </div>

          <button
            type="submit"
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl shadow-2xs shrink-0 cursor-pointer"
          >
            Connect Spreadsheet
          </button>

          {spreadsheetId && (
            <a
              href={spreadsheetUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 font-semibold text-xs rounded-xl flex items-center gap-1 transition-colors shrink-0"
            >
              <span>Open in Google Sheets</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          )}
        </form>

        {/* Error / Alert Messages */}
        {(authError || errorMessage) && (
          <div className="mt-3 p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">Sync Error / Permission Warning:</p>
              <p className="mt-0.5 font-mono text-[11px]">{authError || errorMessage}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
