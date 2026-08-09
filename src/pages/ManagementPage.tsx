import React, { useState } from 'react';
import {
  Settings,
  BellRing,
  ShieldCheck,
  CheckCircle2,
  FileSpreadsheet,
  ExternalLink,
  Link2,
  Mail,
  History,
  Trash2,
  Database,
  AlertTriangle,
  RefreshCw,
  Loader2,
  Calendar,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useGoogleSync } from '../context/GoogleSyncContext';
import { SGDatePicker } from '../components/SGDatePicker';
import { ConfirmModal } from '../components/ConfirmModal';
import { formatSGD, formatFriendlyDate } from '../utils/formatters';

export const ManagementPage: React.FC = () => {
  const {
    currentUser,
    simulatedDate,
    setSimulatedDate,
    settings,
    updateCashBuffer,
    updateGoogleSheetUrl,
    emailNoticeHistory,
    updateSettings,
    clearLocalPaymentQueue,
    addAuditLog,
  } = useApp();

  const {
    accessToken,
    spreadsheetId,
    syncedQueueRows,
    clearPaymentQueueInSheets,
    syncNow,
    dbConnectionState,
  } = useGoogleSync();

  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Clear Payment Queue modal state
  const [showClearModal, setShowClearModal] = useState(false);
  const [isClearing, setIsClearing] = useState(false);

  // Reminder days state
  const [reminderDays, setReminderDays] = useState<number>(settings.reminderDaysBeforeDue || 3);

  // Google Sheet URL state
  const [sheetUrlInput, setSheetUrlInput] = useState<string>(
    settings.googleSheetUrl || 'https://docs.google.com/spreadsheets/d/13mLCkvH-xVsQuBEdIdEMgfmOPoRqFxJQTqu-o4w9_Jk/edit?usp=sharing'
  );

  const handleSaveSheetUrl = (e: React.FormEvent) => {
    e.preventDefault();
    if (!sheetUrlInput.trim()) {
      alert('Please enter a valid Google Sheet URL.');
      return;
    }
    updateGoogleSheetUrl(sheetUrlInput.trim());
    setSuccessMsg('Successfully updated connected Google Sheet URL link!');
    setTimeout(() => setSuccessMsg(''), 4000);
  };

  const handleOpenClearModal = () => {
    if (!accessToken) {
      setErrorMsg('Google is not connected. Please click "Connect Google" in the header first.');
      setTimeout(() => setErrorMsg(''), 5000);
      return;
    }
    setShowClearModal(true);
  };

  const handleConfirmClearQueue = async () => {
    setIsClearing(true);
    setErrorMsg('');
    try {
      const { rowsRemoved } = await clearPaymentQueueInSheets();
      clearLocalPaymentQueue();
      setShowClearModal(false);
      setSuccessMsg(`PAYMENT_QUEUE worksheet cleared successfully! (${rowsRemoved} records removed. Row 1 headings preserved).`);
      setTimeout(() => setSuccessMsg(''), 6000);
    } catch (err: any) {
      console.error('Clear payment queue error:', err);
      setErrorMsg(`Failed to clear PAYMENT_QUEUE sheet: ${err?.message || 'Unknown error'}`);
      setShowClearModal(false);
    } finally {
      setIsClearing(false);
    }
  };

  return (
    <div className="space-y-6 pb-8">
      
      {/* Header */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-800 border border-slate-200 font-mono">
              System Management Workspace
            </span>
          </div>
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Settings className="w-5 h-5 text-slate-800" />
            <span>Management & System Settings</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Configure Google Sheet integration, cash buffers, payment reminder schedules, and user role permissions.
          </p>
        </div>
      </div>

      {successMsg && (
        <div className="p-4 bg-slate-100 border border-slate-300 text-slate-900 rounded-xl text-xs font-semibold flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5 text-slate-700 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="p-4 bg-slate-100 border border-slate-300 text-slate-900 rounded-xl text-xs font-semibold flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-slate-700 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* System Date & Calendar Control Section */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-2xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-slate-100 text-slate-800 rounded-lg">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-sm">System Date & Simulation Control</h3>
              <p className="text-xs text-slate-500">
                Configure the active system date used across due date calculations and payment reminders.
              </p>
            </div>
          </div>
          <span className="px-2.5 py-1 bg-slate-100 text-slate-800 border border-slate-200 text-[11px] font-bold rounded-full font-mono">
            {simulatedDate}
          </span>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700">
          <div>
            <label className="block font-bold text-slate-900 text-sm mb-0.5">
              Active System Date
            </label>
            <p className="text-slate-500 text-xs">
              Current operating date: <strong className="text-slate-900">{formatFriendlyDate(simulatedDate)}</strong>
            </p>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-slate-500 font-semibold text-xs hidden sm:inline">Select Date:</span>
            <SGDatePicker
              value={simulatedDate}
              onChange={(_, rawIso) => setSimulatedDate(rawIso)}
            />
          </div>
        </div>
      </div>

      {/* Database Maintenance & Clear Payment Queue Section */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-2xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-slate-100 text-slate-800 rounded-lg">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-sm">Database Maintenance</h3>
              <p className="text-xs text-slate-500">Perform maintenance operations on the connected live Google Sheets database.</p>
            </div>
          </div>
          <span className="px-2.5 py-1 bg-slate-100 text-slate-800 text-[11px] font-mono font-bold rounded-full border border-slate-200">
            Worksheet: PAYMENT_QUEUE
          </span>
        </div>

        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs text-slate-700 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h4 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <Trash2 className="w-4 h-4 text-slate-700" />
                <span>Clear Live Payment Queue</span>
              </h4>
              <p className="text-xs text-slate-500 mt-0.5">
                Clears data rows (Row 2 onward) in the <strong>PAYMENT_QUEUE</strong> worksheet while preserving Row 1 headings.
              </p>
            </div>

            <button
              onClick={handleOpenClearModal}
              disabled={isClearing}
              className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl shadow-2xs flex items-center gap-2 transition-colors shrink-0 cursor-pointer disabled:opacity-50"
            >
              {isClearing ? (
                <Loader2 className="w-4 h-4 animate-spin text-white" />
              ) : (
                <Trash2 className="w-4 h-4 text-white" />
              )}
              <span>Clear Payment Queue</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 text-[11px] border-t border-slate-200">
            <div>
              <span className="text-slate-500 block">Current Queue Rows:</span>
              <span className="font-mono font-bold text-slate-900">{syncedQueueRows.length} Row(s)</span>
            </div>
            <div>
              <span className="text-slate-500 block">Google Auth Status:</span>
              <span className="font-bold text-slate-900">
                {accessToken ? 'Connected' : 'Not Connected'}
              </span>
            </div>
            <div>
              <span className="text-slate-500 block">Database Access:</span>
              <span className="font-bold text-slate-900">{dbConnectionState}</span>
            </div>
          </div>
        </div>
      </div>
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-2xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-slate-100 text-slate-800 rounded-lg">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-sm">Live Google Sheet Connection</h3>
              <p className="text-xs text-slate-500">Paste or enter the live Google Sheet link receiving matched PO/GRN/Invoices.</p>
            </div>
          </div>
          <span className="px-2.5 py-1 bg-slate-100 text-slate-800 text-[11px] font-bold rounded-full border border-slate-200 self-start sm:self-auto">
            Connected Live
          </span>
        </div>

        <form onSubmit={handleSaveSheetUrl} className="space-y-3 text-xs text-slate-700">
          <div>
            <label className="block font-semibold mb-1 text-slate-700">
              Google Sheet URL / Link
            </label>
            <div className="relative rounded-lg shadow-2xs">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <Link2 className="w-4 h-4" />
              </div>
              <input
                type="text"
                value={sheetUrlInput}
                onChange={(e) => setSheetUrlInput(e.target.value)}
                placeholder="https://docs.google.com/spreadsheets/d/1A2b3C4d5E6f.../edit"
                className="w-full pl-9 pr-24 py-2 border border-slate-300 rounded-lg font-mono text-xs focus:ring-2 focus:ring-slate-900 text-slate-900"
                required
              />
              <a
                href={sheetUrlInput}
                target="_blank"
                rel="noopener noreferrer"
                className="absolute inset-y-1 right-1 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-[11px] rounded flex items-center gap-1 transition-colors"
              >
                <span>Open</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              Changes to this URL persist across sessions and sync operations.
            </p>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-lg shadow-2xs flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <FileSpreadsheet className="w-4 h-4 text-white" />
              <span>Connect & Save Google Sheet Link</span>
            </button>
          </div>
        </form>
      </div>

      {/* Main Controls */}
      <div className="grid grid-cols-1 gap-6">
        
        {/* Reminder Settings Box */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-2xs space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <div className="p-2 bg-slate-100 text-slate-800 rounded-lg">
              <BellRing className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-sm">Payment Reminder Schedule</h3>
              <p className="text-xs text-slate-500">System alert notification lead time before credit due dates.</p>
            </div>
          </div>

          <div className="space-y-4 text-xs text-slate-700">
            <div>
              <label className="block font-semibold mb-1">
                Reminder Lead Time (Days Before Due Date)
              </label>
              <select
                value={reminderDays}
                onChange={(e) => setReminderDays(Number(e.target.value))}
                className="w-full p-2 border border-slate-300 rounded-lg font-medium text-slate-800"
              >
                <option value={1}>1 Day Before Due Date</option>
                <option value={3}>3 Days Before Due Date (Default)</option>
                <option value={5}>5 Days Before Due Date</option>
                <option value={7}>7 Days Before Due Date</option>
              </select>
            </div>

            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
              <span className="font-semibold text-slate-800">Current Notification Rule:</span>
              <p className="text-slate-600">
                Invoices due within <strong>{reminderDays} days</strong> will display prominent badges on the Payment Queue.
              </p>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => {
                  updateSettings({ reminderDaysBeforeDue: reminderDays });
                  setSuccessMsg(`Payment reminder lead time saved: ${reminderDays} days!`);
                  setTimeout(() => setSuccessMsg(''), 4000);
                }}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl shadow-2xs cursor-pointer"
              >
                Save Reminder Rule
              </button>
            </div>
          </div>
        </div>

      </div>

      {/* User Roles & Permissions Matrix */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-2xs space-y-4">
        <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
          <ShieldCheck className="w-5 h-5 text-slate-700" />
          <h3 className="font-bold text-slate-900 text-sm">User Roles & System Permission Matrix</h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left border-collapse">
            <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200 uppercase text-[11px]">
              <tr>
                <th className="p-3">Function / Feature</th>
                <th className="p-3 text-center">Mdm Lim (Accounts)</th>
                <th className="p-3 text-center">Mr Boon (Manager)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              <tr>
                <td className="p-3 font-semibold text-slate-800">View Financial Dashboard & Sync Sheets</td>
                <td className="p-3 text-center text-slate-900 font-bold">Allowed</td>
                <td className="p-3 text-center text-slate-900 font-bold">Allowed</td>
              </tr>
              <tr>
                <td className="p-3 font-semibold text-slate-800">Schedule Payment Dates & Review Queue</td>
                <td className="p-3 text-center text-slate-900 font-bold">Allowed</td>
                <td className="p-3 text-center text-slate-900 font-bold">Allowed</td>
              </tr>
              <tr>
                <td className="p-3 font-semibold text-slate-800">Review Withheld Payments & Apply Actions</td>
                <td className="p-3 text-center text-slate-900 font-bold">Allowed</td>
                <td className="p-3 text-center text-slate-900 font-bold">Allowed</td>
              </tr>
              <tr>
                <td className="p-3 font-semibold text-slate-800">Action Anomalies (Credit Notes / Refunds)</td>
                <td className="p-3 text-center text-slate-900 font-bold">Allowed</td>
                <td className="p-3 text-center text-slate-900 font-bold">Allowed</td>
              </tr>
              <tr>
                <td className="p-3 font-semibold text-slate-800">Access Management & Google Sheet Settings</td>
                <td className="p-3 text-center text-slate-900 font-bold">Allowed</td>
                <td className="p-3 text-center text-slate-900 font-bold">Allowed</td>
              </tr>
              <tr className="bg-slate-50">
                <td className="p-3 font-bold text-slate-900">Change Cash Buffer Amount</td>
                <td className="p-3 text-center text-slate-800 font-bold">Requires Mr Boon ID + Pass</td>
                <td className="p-3 text-center text-slate-800 font-bold">Allowed (Mr Boon Password)</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Email Notice History Audit Log */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-2xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <Mail className="w-5 h-5 text-slate-700" />
            <div>
              <h3 className="font-bold text-slate-900 text-sm">Payment Delay Email Notice History</h3>
              <p className="text-xs text-slate-500">Record log of generated credit delay notification emails sent to suppliers.</p>
            </div>
          </div>
          <span className="px-2.5 py-1 bg-slate-100 text-slate-800 text-xs font-mono font-bold rounded-full border border-slate-200">
            {emailNoticeHistory.length} Sent Notices
          </span>
        </div>

        <div className="overflow-x-auto">
          {emailNoticeHistory.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-500 flex flex-col items-center gap-2">
              <History className="w-8 h-8 text-slate-300" />
              <p>No payment delay email notices generated yet.</p>
              <p className="text-[11px] text-slate-400">When payment dates exceed invoice due dates, generating an email notice logs a record here.</p>
            </div>
          ) : (
            <table className="w-full text-xs text-left border-collapse">
              <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200 uppercase text-[11px]">
                <tr>
                  <th className="p-3">Sent At (SGT)</th>
                  <th className="p-3">Supplier Name</th>
                  <th className="p-3">Invoice No & Amount</th>
                  <th className="p-3">Reason Selected</th>
                  <th className="p-3">Recipient Email</th>
                  <th className="p-3">Sent By</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {emailNoticeHistory.map((rec, idx) => (
                  <tr key={`${rec.id}-${idx}`} className="hover:bg-slate-50">
                    <td className="p-3 font-mono text-slate-500 whitespace-nowrap">{rec.sentAt}</td>
                    <td className="p-3 font-bold text-slate-900">{rec.supplierName}</td>
                    <td className="p-3 font-mono">
                      <span className="font-bold text-slate-900 block">{rec.invoiceNo}</span>
                      <span className="text-slate-500">{formatSGD(rec.amount)}</span>
                    </td>
                    <td className="p-3 text-slate-800">
                      <span className="px-2 py-0.5 bg-slate-100 text-slate-800 border border-slate-200 font-semibold rounded text-[11px]">
                        {rec.reasonSelected}
                      </span>
                    </td>
                    <td className="p-3 font-mono text-slate-800">{rec.toEmail}</td>
                    <td className="p-3 font-semibold text-slate-700">{rec.sentBy}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Clear Payment Queue Confirmation Modal */}
      <ConfirmModal
        isOpen={showClearModal}
        title="Confirm Clear Live Payment Queue Worksheet"
        message={
          <div className="space-y-3 text-xs text-slate-700">
            <p className="font-bold text-slate-900">
              Are you sure you want to clear the live PAYMENT_QUEUE worksheet?
            </p>
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-1 font-mono text-[11px]">
              <div className="flex justify-between">
                <span className="text-slate-500">Target Worksheet:</span>
                <span className="font-bold text-rose-700">PAYMENT_QUEUE</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Records Being Removed:</span>
                <span className="font-bold text-slate-900">{syncedQueueRows.length} Row(s) (Row 2 onward)</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Row 1 Headings:</span>
                <span className="font-bold text-emerald-700">Preserved Intact</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Other Worksheets:</span>
                <span className="font-bold text-emerald-700">INVOICES & MATCH_RESULTS Unaffected</span>
              </div>
            </div>
            <p className="text-[11px] text-slate-500">
              This operation clears all queued rows in Google Sheets. This action cannot be undone.
            </p>
          </div>
        }
        confirmText="Yes, Clear PAYMENT_QUEUE Sheet"
        cancelText="Cancel"
        confirmVariant="danger"
        onConfirm={handleConfirmClearQueue}
        onCancel={() => setShowClearModal(false)}
      />

    </div>
  );
};
