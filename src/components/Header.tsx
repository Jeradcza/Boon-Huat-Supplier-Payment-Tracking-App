import React, { useState, useMemo } from 'react';
import {
  LogOut,
  RefreshCw,
  Bell,
  CheckCircle,
  CheckCircle2,
  Database,
  Link2,
  XCircle,
  Loader2,
  AlertTriangle,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useGoogleSync } from '../context/GoogleSyncContext';
import { formatFriendlyDate, parseDate, formatSGD, extractDueDateFromSyncedStr } from '../utils/formatters';

export const Header: React.FC = () => {
  const {
    currentUser,
    logout,
    simulatedDate,
    settings,
    currentPage,
    setCurrentPage,
    paymentItems,
    setHighlightedItemId,
  } = useApp();

  const {
    googleUser,
    loginWithGoogle,
    logoutGoogle,
    syncNow,
    syncedQueueRows,
    syncStatus,
    dbConnectionState,
    isAuthLoading,
  } = useGoogleSync();

  const isGoogleConnected = Boolean(googleUser);

  const [showNotifications, setShowNotifications] = useState(false);

  const reminderDays = settings.reminderDaysBeforeDue || 3;

  // Real-time calculation of Payment Reminders
  const reminders = useMemo(() => {
    const itemsToEvaluate: Array<{
      id: string;
      supplierName: string;
      invoiceNo: string;
      poNo: string;
      amountStr: string;
      targetDateStr: string;
      isScheduled: boolean;
      isCompletedOrPaid: boolean;
    }> = [];

    if (syncedQueueRows.length > 0) {
      syncedQueueRows.forEach((row) => {
        const isCompletedOrPaid =
          row.status.toLowerCase().includes('paid') ||
          row.status.toLowerCase().includes('completed');
        const dueDateStr = extractDueDateFromSyncedStr(row.creditTermsAndDueDate);
        const isScheduled = Boolean(row.paymentDate) || row.status.toLowerCase().includes('scheduled');
        const targetDateStr = row.paymentDate || dueDateStr;

        const linesSup = row.supplierInvoiceInfo.split('\n');
        const linesRef = row.threeWayMatchRef.split('\n');
        itemsToEvaluate.push({
          id: row.matchId || row.invoiceId,
          supplierName: linesSup[0] || 'Supplier',
          invoiceNo: linesSup[1] || row.invoiceId,
          poNo: linesRef[0] || '',
          amountStr: row.invoiceAmount,
          targetDateStr,
          isScheduled,
          isCompletedOrPaid,
        });
      });
    } else {
      paymentItems.forEach((item) => {
        const isCompletedOrPaid =
          item.status === 'completed' ||
          item.status === 'paid';
        const isScheduled = item.status === 'scheduled' || Boolean(item.paymentDate);
        const targetDateStr = item.paymentDate || item.dueDate;

        itemsToEvaluate.push({
          id: item.id,
          supplierName: item.supplierName,
          invoiceNo: item.invoiceNo,
          poNo: item.poNo,
          amountStr: formatSGD(item.amount),
          targetDateStr,
          isScheduled,
          isCompletedOrPaid,
        });
      });
    }

    const simDate = parseDate(simulatedDate) || new Date();
    simDate.setHours(0, 0, 0, 0);

    return itemsToEvaluate.filter((item) => {
      if (item.isCompletedOrPaid) return false;
      if (!item.targetDateStr) return false;

      const targetDate = parseDate(item.targetDateStr);
      if (!targetDate || isNaN(targetDate.getTime())) return false;
      targetDate.setHours(0, 0, 0, 0);

      const diffMs = targetDate.getTime() - simDate.getTime();
      const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

      return diffDays <= reminderDays;
    });
  }, [syncedQueueRows, paymentItems, simulatedDate, reminderDays]);

  const getPageTitle = () => {
    switch (currentPage) {
      case 'home':
        return `Good ${new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 18 ? 'afternoon' : 'evening'}, ${currentUser?.name || 'User'}`;
      case 'dashboard':
        return 'Financial Health Dashboard';
      case 'payment-queue':
        return 'Matched Invoices Payment Queue';
      case 'overdue-payments':
        return 'Overdue Payments';
      case 'flagged-anomalies':
        return 'Flagged Anomalies & Recovery Actions';
      case 'credit-notes':
        return 'Credit Notes & Refund Requests';
      case 'audit-trail':
        return 'Activity & Payment Audit Trail';
      case 'supplier-info':
        return 'Supplier Information Directory';
      case 'management':
        return 'Management & Settings';
      case 'sheets-tab':
        return 'Google Sheet Connected Data Tabs';
      default:
        return 'Boon Huat Supplier Payment Tracking';
    }
  };

  // Helper for Database Connection Status Badge styling
  const getDbStatusBadge = () => {
    switch (dbConnectionState) {
      case 'Live Database Connected — Editor Access':
        return (
          <span className="px-2.5 py-1 bg-slate-100 text-slate-800 border border-slate-200 text-[11px] font-medium rounded-full flex items-center gap-1.5 shadow-2xs">
            <span className="w-2 h-2 rounded-full bg-slate-800"></span>
            <span>Live Database Connected — Editor Access</span>
          </span>
        );
      case 'Live Database Connected — Read Only':
        return (
          <span className="px-2.5 py-1 bg-slate-100 text-slate-800 border border-slate-200 text-[11px] font-medium rounded-full flex items-center gap-1.5 shadow-2xs">
            <span className="w-2 h-2 rounded-full bg-slate-500"></span>
            <span>Live Database Connected — Read Only</span>
          </span>
        );
      case 'Connecting to Database':
        return (
          <span className="px-2.5 py-1 bg-slate-100 text-slate-800 border border-slate-200 text-[11px] font-medium rounded-full flex items-center gap-1.5 shadow-2xs animate-pulse">
            <Loader2 className="w-3.5 h-3.5 text-slate-600 animate-spin" />
            <span>Connecting to Database...</span>
          </span>
        );
      case 'Google Connected — Database Not Checked':
        return (
          <span className="px-2.5 py-1 bg-slate-100 text-slate-800 border border-slate-200 text-[11px] font-medium rounded-full flex items-center gap-1.5 shadow-2xs">
            <AlertTriangle className="w-3.5 h-3.5 text-slate-600" />
            <span>Google Connected — Database Not Checked</span>
          </span>
        );
      case 'Spreadsheet Not Found':
      case 'Access Denied':
      case 'Database Connection Failed':
        return (
          <span className="px-2.5 py-1 bg-slate-100 text-slate-800 border border-slate-200 text-[11px] font-medium rounded-full flex items-center gap-1.5 shadow-2xs">
            <XCircle className="w-3.5 h-3.5 text-slate-600" />
            <span>{dbConnectionState}</span>
          </span>
        );
      case 'Google Not Connected':
      default:
        return (
          <span className="px-2.5 py-1 bg-slate-100 text-slate-600 border border-slate-200 text-[11px] font-medium rounded-full flex items-center gap-1.5">
            <Database className="w-3.5 h-3.5 text-slate-400" />
            <span>Google Not Connected</span>
          </span>
        );
    }
  };

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-20 px-8 h-20 flex items-center justify-between shadow-2xs">
      
      {/* Title & Greeting & DB Connection Badge */}
      <div className="flex items-center gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            {getPageTitle()}
          </h2>
          <p className="text-xs text-slate-500 font-medium mt-0.5">
            {formatFriendlyDate(simulatedDate)} &bull; Boon Huat Supplier Payment Tracking
          </p>
        </div>

        {/* Database Connection Status Badge */}
        <div className="hidden lg:block ml-2">
          {getDbStatusBadge()}
        </div>
      </div>

      {/* Right Action Controls */}
      <div className="flex items-center gap-3">
        
        {/* Notification Centre Bell */}
        <div className="relative">
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            className="p-2 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 transition-colors relative cursor-pointer"
            title="Payment Reminders Notification Centre"
          >
            <Bell className="w-5 h-5 text-slate-700" />
            {reminders.length > 0 && (
              <span className="absolute -top-1 -right-1 bg-slate-900 text-white font-mono text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center border-2 border-white">
                {reminders.length}
              </span>
            )}
          </button>

          {showNotifications && (
            <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-2xl shadow-xl border border-slate-200 z-50 p-4 animate-in fade-in duration-150">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-3">
                <div className="flex items-center gap-2">
                  <Bell className="w-4 h-4 text-slate-700" />
                  <h4 className="font-bold text-xs text-slate-900">Payment Reminders ({settings.reminderDaysBeforeDue || 3} Days Lead)</h4>
                </div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-100 text-slate-800 font-bold border border-slate-200">
                  {reminders.length} Reminders
                </span>
              </div>

              {reminders.length === 0 ? (
                <div className="py-6 text-center text-xs text-slate-500 flex flex-col items-center gap-2">
                  <CheckCircle className="w-6 h-6 text-slate-400" />
                  <p>No upcoming payment reminders due within {settings.reminderDaysBeforeDue || 3} days.</p>
                </div>
              ) : (
                <div className="max-h-72 overflow-y-auto space-y-2 divide-y divide-slate-100 pr-1">
                  {reminders.map((rem) => {
                    const targetDate = parseDate(rem.targetDateStr);
                    const curr = parseDate(simulatedDate) || new Date();
                    if (targetDate) targetDate.setHours(0, 0, 0, 0);
                    if (curr) curr.setHours(0, 0, 0, 0);

                    const diffMs = targetDate && curr ? targetDate.getTime() - curr.getTime() : 0;
                    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

                    return (
                      <div key={rem.id} className="pt-2 text-xs flex items-start justify-between gap-2">
                        <div>
                          <span className="font-bold text-slate-900 block">{rem.supplierName}</span>
                          <span className="text-[11px] text-slate-500 font-mono">INV: {rem.invoiceNo} {rem.poNo ? `• PO: ${rem.poNo}` : ''}</span>
                          <span className="text-[11px] font-bold text-slate-800 block mt-0.5">{rem.amountStr}</span>
                        </div>
                        <div className="text-right shrink-0">
                          <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-mono font-bold ${diffDays < 0 ? 'bg-slate-100 text-slate-900 border border-slate-300' : 'bg-slate-100 text-slate-800 border border-slate-200'}`}>
                            {diffDays < 0 ? `Overdue ${Math.abs(diffDays)}d` : diffDays === 0 ? 'Due Today' : `Due in ${diffDays}d`}
                          </span>
                          <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                            {rem.isScheduled ? 'Scheduled:' : 'Due:'} {rem.targetDateStr}
                          </div>
                          <button
                            onClick={() => {
                              setHighlightedItemId(rem.id || rem.invoiceNo);
                              setCurrentPage('payment-queue');
                              setShowNotifications(false);
                            }}
                            className="text-[10px] font-bold text-slate-900 hover:underline block mt-0.5 cursor-pointer ml-auto"
                          >
                            View in Queue &rarr;
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Connect Google / Account display */}
        {!isGoogleConnected ? (
          <button
            onClick={loginWithGoogle}
            disabled={isAuthLoading}
            className="flex items-center gap-2 px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold transition-colors shadow-2xs cursor-pointer disabled:opacity-50"
            title="Authenticate official Google account"
          >
            {isAuthLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Link2 className="w-4 h-4 text-white" />
            )}
            <span>Connect Google</span>
          </button>
        ) : (
          <div className="flex items-center gap-1.5 bg-slate-100 border border-slate-200 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-800">
            <span className="w-2 h-2 rounded-full bg-slate-800"></span>
            <span className="font-mono text-[11px] truncate max-w-[140px]" title={googleUser?.email || ''}>
              {googleUser?.email || 'Google Connected'}
            </span>
            <button
              onClick={logoutGoogle}
              className="ml-1 text-[10px] text-slate-500 hover:text-slate-900 underline font-normal cursor-pointer"
              title="Disconnect or switch Google account"
            >
              Disconnect
            </button>
          </div>
        )}

        {/* Refresh Live Database Button */}
        <button
          onClick={() => syncNow()}
          disabled={!isGoogleConnected || syncStatus === 'Synchronising...'}
          title={`Last synced: ${settings.lastSyncedAt}`}
          className="flex items-center gap-1.5 px-3 py-2 border border-slate-300 bg-white rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors shadow-2xs cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <RefreshCw className={`w-3.5 h-3.5 text-slate-700 ${syncStatus === 'Synchronising...' ? 'animate-spin' : ''}`} />
          <span className="hidden md:inline">Refresh Live Database</span>
        </button>

        <div className="h-6 w-px bg-slate-200"></div>

        {/* User Account Info & Switch Account */}
        <div className="flex items-center gap-2 bg-slate-100 pl-3 pr-1 py-1 rounded-lg border border-slate-200 text-xs">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-slate-800"></span>
            <span className="font-bold text-slate-900 text-[11px]">{currentUser?.name}</span>
            <span className="text-[10px] text-slate-500 font-medium">({currentUser?.role === 'manager' ? 'Manager' : 'Accounts'})</span>
          </div>
          <button
            onClick={logout}
            className="px-2.5 py-1 bg-white hover:bg-slate-50 text-slate-700 font-bold rounded-md text-[11px] shadow-2xs transition-colors border border-slate-300 flex items-center gap-1 cursor-pointer"
            title="Log out to switch user account"
          >
            <span>Switch Account</span>
          </button>
        </div>

        {/* Sign Out Icon */}
        <button
          onClick={logout}
          className="p-2 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
          title="Sign out"
        >
          <LogOut className="w-5 h-5" />
        </button>

      </div>
    </header>
  );
};
