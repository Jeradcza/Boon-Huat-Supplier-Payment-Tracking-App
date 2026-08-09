import React, { useState } from 'react';
import {
  FileSpreadsheet,
  RefreshCw,
  ExternalLink,
  CheckCircle2,
  Database,
  Table,
  Trash2,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useGoogleSync } from '../context/GoogleSyncContext';
import { GoogleSheetsSyncBanner } from '../components/GoogleSheetsSyncBanner';
import { ConfirmModal } from '../components/ConfirmModal';
import { formatSGD } from '../utils/formatters';

export const GoogleSheetsSimulatorPage: React.FC = () => {
  const {
    currentUser,
    clearLocalPaymentQueue,
    addAuditLog,
  } = useApp();

  const {
    syncStatus,
    matchResultsRows,
    syncedQueueRows,
    syncNow,
    clearPaymentQueueInSheets,
  } = useGoogleSync();

  const [activeTab, setActiveTab] = useState<'MATCH_RESULTS' | 'PAYMENT_QUEUE'>('MATCH_RESULTS');
  const [showClearConfirmModal, setShowClearConfirmModal] = useState(false);
  const [clearSuccessMsg, setClearSuccessMsg] = useState('');

  const canClearQueue =
    currentUser?.role === 'manager' ||
    currentUser?.username === 'mr boon' ||
    currentUser?.name === 'Mr Boon';

  const handleConfirmClearQueue = async () => {
    setShowClearConfirmModal(false);
    try {
      await clearPaymentQueueInSheets();
      clearLocalPaymentQueue();
      addAuditLog('sheets_sync', `${currentUser?.name || 'Administrator'} cleared PAYMENT_QUEUE data rows.`);
      setClearSuccessMsg('Payment Queue cleared successfully.');
      setTimeout(() => setClearSuccessMsg(''), 5000);
    } catch (err: any) {
      alert(`Failed to clear PAYMENT_QUEUE: ${err.message || 'Unknown error'}`);
    }
  };

  return (
    <div className="space-y-6 pb-8">
      
      {/* Live Google Sheets Integration Banner */}
      <GoogleSheetsSyncBanner />

      {clearSuccessMsg && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-emerald-800 text-xs font-bold flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            <span>{clearSuccessMsg}</span>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-100 text-emerald-800 border border-emerald-200">
              Live Google Sheets Database Connection
            </span>
          </div>
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
            <span>Google Sheets Live Database Worksheets</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Synchronising payment-ready 3-way match invoices from worksheet <code className="font-bold text-slate-700">MATCH_RESULTS</code> to <code className="font-bold text-slate-700">PAYMENT_QUEUE</code> in real time.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {canClearQueue && (
            <button
              onClick={() => setShowClearConfirmModal(true)}
              className="px-3.5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
              title="Clear all data rows in PAYMENT_QUEUE while preserving header row"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear Payment Queue</span>
            </button>
          )}

          <button
            onClick={syncNow}
            className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Sync Sheets Queue</span>
          </button>
        </div>
      </div>

      {/* Tabs Navigation Bar (Dynamic Google Sheet Tabs) */}
      <div className="bg-white p-2 rounded-2xl border border-slate-200 text-xs flex items-center gap-2 overflow-x-auto text-slate-700 shadow-2xs">
        <span className="text-slate-500 px-2 font-mono text-[11px] shrink-0 flex items-center gap-1 font-bold">
          <Database className="w-3.5 h-3.5 text-emerald-600" />
          Live Worksheets:
        </span>

        {[
          { id: 'MATCH_RESULTS', label: 'MATCH_RESULTS (Read-Only)', count: matchResultsRows.length },
          { id: 'PAYMENT_QUEUE', label: 'PAYMENT_QUEUE (Live Synced)', count: syncedQueueRows.length },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`px-3.5 py-2 rounded-xl font-mono text-xs font-bold transition-all flex items-center gap-2 shrink-0 cursor-pointer ${
              activeTab === tab.id
                ? 'bg-emerald-600 text-white shadow-2xs'
                : 'bg-slate-50 border border-slate-200 hover:bg-slate-100 text-slate-700'
            }`}
          >
            <span>{tab.label}</span>
            <span className={`px-1.5 py-0.2 rounded text-[10px] ${
              activeTab === tab.id ? 'bg-emerald-800 text-emerald-100' : 'bg-slate-800 text-slate-400'
            }`}>
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {/* Sheet Data View */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="p-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-xs text-slate-600 font-mono">
          <span>Active Worksheet: <strong className="text-slate-900">{activeTab}</strong></span>
          <span>Live Sync Status: <strong className="text-emerald-700">{syncStatus}</strong></span>
        </div>

        <div className="overflow-x-auto">
          {activeTab === 'MATCH_RESULTS' && (
            <table className="w-full text-xs text-left font-mono border-collapse">
              <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                <tr>
                  <th className="p-2.5">Match_ID</th>
                  <th className="p-2.5">Invoice_Number</th>
                  <th className="p-2.5">PO_Number</th>
                  <th className="p-2.5">GRN_Numbers</th>
                  <th className="p-2.5">Supplier_Name</th>
                  <th className="p-2.5 text-right">Total_Result</th>
                  <th className="p-2.5">Overall_Match_Status</th>
                  <th className="p-2.5">Ready_For_App_3</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {matchResultsRows.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-slate-500 font-sans">
                      No records found in live MATCH_RESULTS worksheet.
                    </td>
                  </tr>
                ) : (
                  matchResultsRows.map((m, idx) => (
                    <tr key={m.matchId || idx} className="hover:bg-slate-50">
                      <td className="p-2.5 text-slate-500">{m.matchId}</td>
                      <td className="p-2.5 font-bold text-slate-900">{m.invoiceNumber}</td>
                      <td className="p-2.5">{m.poNumber}</td>
                      <td className="p-2.5">{m.grnNumbers}</td>
                      <td className="p-2.5 font-sans">{m.supplierName}</td>
                      <td className="p-2.5 text-right font-bold">{m.totalResult}</td>
                      <td className="p-2.5 font-semibold text-slate-800">{m.overallMatchStatus}</td>
                      <td className="p-2.5">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          m.readyForApp3.toUpperCase() === 'TRUE' || m.readyForApp3.toUpperCase() === 'YES'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-rose-100 text-rose-800'
                        }`}>
                          {m.readyForApp3}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}

          {activeTab === 'PAYMENT_QUEUE' && (
            <div>
              {canClearQueue && syncedQueueRows.length > 0 && (
                <div className="p-3 bg-amber-50/70 border-b border-amber-200 flex items-center justify-between text-xs text-amber-900 font-sans">
                  <span>
                    Administrator Option: Clear all <strong>{syncedQueueRows.length}</strong> records from <code className="font-mono font-bold">PAYMENT_QUEUE</code> worksheet.
                  </span>
                  <button
                    onClick={() => setShowClearConfirmModal(true)}
                    className="px-3 py-1 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-lg text-xs flex items-center gap-1 shadow-xs cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Clear Payment Queue</span>
                  </button>
                </div>
              )}

              <table className="w-full text-xs text-left font-mono border-collapse">
                <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                  <tr>
                    <th className="p-2.5">Match ID</th>
                    <th className="p-2.5">Invoice ID</th>
                    <th className="p-2.5">Supplier / Invoice Info</th>
                    <th className="p-2.5">3-Way Match Ref</th>
                    <th className="p-2.5 text-right">Invoice Amount</th>
                    <th className="p-2.5">Status</th>
                    <th className="p-2.5">Payment Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {syncedQueueRows.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-slate-500 font-sans">
                        No records found in live PAYMENT_QUEUE worksheet.
                      </td>
                    </tr>
                  ) : (
                    syncedQueueRows.map((q, idx) => (
                      <tr key={q.matchId || idx} className="hover:bg-slate-50">
                        <td className="p-2.5 text-slate-500">{q.matchId}</td>
                        <td className="p-2.5 font-bold text-slate-900">{q.invoiceId}</td>
                        <td className="p-2.5 whitespace-pre-line font-sans">{q.supplierInvoiceInfo}</td>
                        <td className="p-2.5 whitespace-pre-line">{q.threeWayMatchRef}</td>
                        <td className="p-2.5 text-right font-bold">{q.invoiceAmount}</td>
                        <td className="p-2.5 font-bold text-emerald-800 uppercase">{q.status}</td>
                        <td className="p-2.5 font-bold text-slate-900">{q.paymentDate || '—'}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Confirmation Modal */}
      {showClearConfirmModal && (
        <ConfirmModal
          isOpen={true}
          title="Clear Payment Queue"
          message={
            <div className="space-y-2 text-xs">
              <p className="font-semibold text-slate-900">
                Are you sure you want to clear every payment queue record?
              </p>
              <p className="text-slate-600">
                This action will delete every data row inside <code className="font-mono text-rose-700 font-bold">PAYMENT_QUEUE</code> worksheet.
              </p>
              <ul className="list-disc pl-4 text-slate-500 space-y-1">
                <li>Row 1 headers will be strictly preserved.</li>
                <li>Worksheet will NOT be deleted.</li>
                <li>Other worksheets like <code className="font-mono">MATCH_RESULTS</code> will NOT be affected.</li>
              </ul>
            </div>
          }
          confirmText="Clear Queue"
          cancelText="Cancel"
          confirmVariant="danger"
          onConfirm={handleConfirmClearQueue}
          onCancel={() => setShowClearConfirmModal(false)}
        />
      )}

    </div>
  );
};

