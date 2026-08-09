import React from 'react';
import {
  LayoutDashboard,
  CreditCard,
  Archive,
  AlertOctagon,
  FileCheck,
  History,
  Users,
  Settings,
  RefreshCw,
  Lock,
  ArrowRight,
  TrendingUp,
  FileSpreadsheet,
  CheckCircle2,
  Clock,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useGoogleSync } from '../context/GoogleSyncContext';
import { formatSGD, formatFriendlyDate, extractDueDateFromSyncedStr } from '../utils/formatters';

export const HomePage: React.FC = () => {
  const {
    currentUser,
    setCurrentPage,
    paymentItems,
    suppliers,
    creditNotes,
    syncSheets,
    settings,
    simulatedDate,
  } = useApp();

  const { syncStatus, syncedQueueRows } = useGoogleSync();

  const activeSuppliers = suppliers.filter((s) => !s.isRemoved);
  const isManager = currentUser?.role === 'manager';

  const isGoogleConnected =
    (syncStatus === 'Connected' || syncStatus === 'Up to Date' || syncStatus === 'Synchronising...') &&
    syncedQueueRows.length > 0;

  // Normalized active payment queue items directly from Google Sync or App Context
  const normalizedQueueItems = React.useMemo(() => {
    if (isGoogleConnected) {
      return syncedQueueRows
        .filter((row) => {
          const s = row.status.toLowerCase();
          return !s.includes('paid') && !s.includes('completed') && !s.includes('archived');
        })
        .map((row) => {
          const lines = row.supplierInvoiceInfo.split('\n');
          const supplierName = lines[0] || 'Supplier';
          let invoiceNo = lines[1] ? lines[1].replace(/^Invoice\s*/i, '').trim() : '';
          if (!invoiceNo) invoiceNo = row.invoiceId || 'N/A';

          const refLines = row.threeWayMatchRef.split('\n');
          const poNo = refLines[0] ? refLines[0].replace(/^PO:\s*/i, '').trim() : '';

          const amount = parseFloat(row.invoiceAmount.replace(/[^0-9.]/g, '')) || 0;
          const dueDate = extractDueDateFromSyncedStr(row.creditTermsAndDueDate);
          const paymentDate = row.paymentDate ? row.paymentDate.trim() : '';

          const s = row.status.toLowerCase();
          let status: 'pending' | 'scheduled' | 'flagged' | 'completed' = 'pending';

          if (s.includes('flag') || s.includes('anomaly') || s.includes('hold')) {
            status = 'flagged';
          } else if (s.includes('scheduled') || (paymentDate !== '' && paymentDate !== '-')) {
            status = 'scheduled';
          }

          return {
            id: row.matchId || row.invoiceId,
            invoiceNo,
            supplierName,
            amount,
            dueDate,
            paymentDate,
            status,
            poNo,
          };
        });
    } else {
      return paymentItems
        .filter((p) => p.status !== 'completed' && p.status !== 'paid' && p.status !== 'archived')
        .map((p) => ({
          id: p.id,
          invoiceNo: p.invoiceNo,
          supplierName: p.supplierName,
          amount: p.amount,
          dueDate: p.dueDate,
          paymentDate: p.paymentDate || '',
          status: (p.status === 'completed' || p.status === 'paid')
            ? ('completed' as const)
            : p.status === 'scheduled'
            ? ('scheduled' as const)
            : (p.status === 'flagged' || (p.anomaly && p.anomaly !== 'none'))
            ? ('flagged' as const)
            : ('pending' as const),
          poNo: p.poNo,
        }));
    }
  }, [isGoogleConnected, syncedQueueRows, paymentItems]);

  // Stats computation
  const pendingQueue = normalizedQueueItems.filter((p) => p.status === 'pending');
  const scheduledQueue = normalizedQueueItems.filter((p) => p.status === 'scheduled');
  const flaggedQueue = normalizedQueueItems.filter((p) => p.status === 'flagged');

  const pendingAmount = pendingQueue.reduce((acc, curr) => acc + curr.amount, 0);
  const scheduledAmount = scheduledQueue.reduce((acc, curr) => acc + curr.amount, 0);

  const archivedCount = isGoogleConnected
    ? syncedQueueRows.filter((row) => {
        const s = row.status.toLowerCase();
        return s.includes('paid') || s.includes('completed') || s.includes('archived');
      }).length
    : paymentItems.filter((p) => p.status === 'completed' || p.status === 'paid' || p.status === 'archived').length;

  // Time greeting helper
  const hour = new Date().getHours();
  const timeOfDay = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  const formattedToday = formatFriendlyDate(simulatedDate);

  return (
    <div className="space-y-6 pb-8">
      
      {/* Welcome Banner */}
      <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-2xs flex flex-col md:flex-row md:items-center md:justify-between gap-6">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-800 border border-slate-200">
              Active Session: {currentUser?.role === 'manager' ? 'Mr Boon (Owner/Manager)' : 'Mdm Lim (Accounts Executive)'}
            </span>
            <span className="text-xs text-slate-400 font-mono">Singapore GMT+8</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            {timeOfDay}, {currentUser?.name}
          </h1>
          <p className="text-xs text-slate-500 mt-1 max-w-2xl leading-relaxed">
            Welcome to the Supplier Payments Tracking launchpad. Here is an at-a-glance summary of current payment queues and financial tasks requiring attention.
          </p>
        </div>

        {/* Quick Sync Action */}
        <div className="shrink-0 flex flex-col items-end gap-2">
          <button
            onClick={syncSheets}
            className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs rounded-lg shadow-2xs flex items-center gap-2 transition-all cursor-pointer"
          >
            <RefreshCw className="w-4 h-4 text-white" />
            <span>Sync Sheets Now</span>
          </button>
          <span className="text-[10px] text-slate-400 font-mono">
            Last synced: {settings.lastSyncedAt}
          </span>
        </div>
      </div>

      {/* At-A-Glance Quick Numbers Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-slate-600 text-xs font-semibold mb-1">
            <span>Pending Invoices</span>
            <Clock className="w-4 h-4 text-slate-600" />
          </div>
          <p className="text-xl font-bold text-slate-900 font-mono">
            {pendingQueue.length} <span className="text-xs text-slate-500 font-normal">{pendingQueue.length === 1 ? 'item' : 'items'}</span>
          </p>
          <p className="text-xs text-slate-600 font-medium mt-1">
            Total {formatSGD(pendingAmount)}
          </p>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-slate-600 text-xs font-semibold mb-1">
            <span>Flagged Anomalies</span>
            <AlertOctagon className="w-4 h-4 text-slate-600" />
          </div>
          <p className="text-xl font-bold text-slate-900 font-mono">
            {flaggedQueue.length} <span className="text-xs text-slate-500 font-normal">{flaggedQueue.length === 1 ? 'item' : 'items'}</span>
          </p>
          <p className="text-xs text-slate-600 font-medium mt-1">
            {flaggedQueue.length > 0 ? `${flaggedQueue.length} anomalies awaiting action` : 'Zero anomalies pending'}
          </p>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-slate-600 text-xs font-semibold mb-1">
            <span>Scheduled Payments</span>
            <CheckCircle2 className="w-4 h-4 text-slate-600" />
          </div>
          <p className="text-xl font-bold text-slate-900 font-mono">
            {scheduledQueue.length} <span className="text-xs text-slate-500 font-normal">{scheduledQueue.length === 1 ? 'item' : 'items'}</span>
          </p>
          <p className="text-xs text-slate-600 font-medium mt-1">
            {scheduledAmount > 0 ? `Total ${formatSGD(scheduledAmount)}` : 'Dates confirmed & logged'}
          </p>
        </div>

      </div>

      {/* Main Section Navigation Launchpad Tiles */}
      <div>
        <h2 className="text-base font-bold text-slate-900 mb-3 flex items-center gap-2">
          <span>Main Navigation Launchpad</span>
          <span className="text-xs font-normal text-slate-500">(Click any card to jump directly to section)</span>
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          
          {/* Dashboard Tile */}
          <div
            onClick={() => setCurrentPage('dashboard')}
            className="group bg-white p-5 rounded-2xl border border-slate-200 hover:border-slate-400 shadow-2xs hover:shadow-xs cursor-pointer transition-all flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="p-3 bg-slate-100 text-slate-800 rounded-xl group-hover:bg-slate-900 group-hover:text-white transition-colors">
                  <LayoutDashboard className="w-6 h-6" />
                </div>
                <span className="text-xs text-slate-400 group-hover:text-slate-900 transition-colors">
                  View Metrics
                </span>
              </div>
              <h3 className="font-bold text-slate-900 text-base">
                Dashboard
              </h3>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                View upcoming payments due in the next 3 days, scheduled payments and flagged anomalies.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-600">
              <span className="font-medium">Overview & Upcoming Schedule</span>
              <ArrowRight className="w-4 h-4 text-slate-400 group-hover:translate-x-1 transition-transform" />
            </div>
          </div>

          {/* Payment Queue Tile */}
          <div
            onClick={() => setCurrentPage('payment-queue')}
            className="group bg-white p-5 rounded-2xl border border-slate-200 hover:border-slate-400 shadow-2xs hover:shadow-xs cursor-pointer transition-all flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="p-3 bg-slate-100 text-slate-800 rounded-xl group-hover:bg-slate-900 group-hover:text-white transition-colors">
                  <CreditCard className="w-6 h-6" />
                </div>
                {pendingQueue.length > 0 && (
                  <span className="px-2.5 py-1 bg-slate-100 text-slate-800 font-bold border border-slate-200 rounded-full text-xs">
                    {pendingQueue.length} pending
                  </span>
                )}
              </div>
              <h3 className="font-bold text-slate-900 text-base">
                Payment Queue
              </h3>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                Review matched invoices from App 2 and schedule planned payment dates.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-600">
              <span className="font-medium">{pendingQueue.length} payments awaiting schedule</span>
              <ArrowRight className="w-4 h-4 text-slate-400 group-hover:translate-x-1 transition-transform" />
            </div>
          </div>

          {/* Payment Archives Tile */}
          <div
            onClick={() => setCurrentPage('payment-archives')}
            className="group bg-white p-5 rounded-2xl border border-slate-200 hover:border-slate-400 shadow-2xs hover:shadow-xs cursor-pointer transition-all flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="p-3 bg-slate-100 text-slate-800 rounded-xl group-hover:bg-slate-900 group-hover:text-white transition-colors">
                  <Archive className="w-6 h-6" />
                </div>
                <span className="px-2.5 py-1 bg-slate-100 text-slate-800 font-bold border border-slate-200 rounded-full text-xs">
                  {archivedCount} archived
                </span>
              </div>
              <h3 className="font-bold text-slate-900 text-base">
                Payment Archives
              </h3>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                View completed payments, voucher references, and historical settlement logs.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-600">
              <span className="font-medium">View Completed Ledger</span>
              <ArrowRight className="w-4 h-4 text-slate-400 group-hover:translate-x-1 transition-transform" />
            </div>
          </div>

          {/* Flagged / Anomalies Tile */}
          <div
            onClick={() => setCurrentPage('flagged-anomalies')}
            className="group bg-white p-5 rounded-2xl border border-slate-200 hover:border-slate-400 shadow-2xs hover:shadow-xs cursor-pointer transition-all flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="p-3 bg-slate-100 text-slate-800 rounded-xl group-hover:bg-slate-900 group-hover:text-white transition-colors">
                  <AlertOctagon className="w-6 h-6" />
                </div>
                {flaggedQueue.length > 0 && (
                  <span className="px-2.5 py-1 bg-slate-100 text-slate-900 font-bold border border-slate-200 rounded-full text-xs">
                    {flaggedQueue.length} flagged
                  </span>
                )}
              </div>
              <h3 className="font-bold text-slate-900 text-base">
                Flagged / Anomalies
              </h3>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                Review duplicate, incorrect amount, or overpaid items & submit requests for credit notes/refunds.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-600">
              <span className="font-semibold text-slate-800">{flaggedQueue.length} anomalies awaiting action</span>
              <ArrowRight className="w-4 h-4 text-slate-400 group-hover:translate-x-1 transition-transform" />
            </div>
          </div>

          {/* Credit Notes & Refund Requests Tile */}
          <div
            onClick={() => setCurrentPage('credit-notes')}
            className="group bg-white p-5 rounded-2xl border border-slate-200 hover:border-slate-400 shadow-2xs hover:shadow-xs cursor-pointer transition-all flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="p-3 bg-slate-100 text-slate-800 rounded-xl group-hover:bg-slate-900 group-hover:text-white transition-colors">
                  <FileCheck className="w-6 h-6" />
                </div>
                <span className="text-xs text-slate-400 font-mono">
                  {creditNotes.length} requests
                </span>
              </div>
              <h3 className="font-bold text-slate-900 text-base">
                Credit Notes & Refund Requests
              </h3>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                View, print, and track credit note and refund recovery requests and approval statuses.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-600">
              <span className="font-medium">{creditNotes.length} recovery documents</span>
              <ArrowRight className="w-4 h-4 text-slate-400 group-hover:translate-x-1 transition-transform" />
            </div>
          </div>

          {/* Audit Trail Tile */}
          <div
            onClick={() => setCurrentPage('audit-trail')}
            className="group bg-white p-5 rounded-2xl border border-slate-200 hover:border-slate-400 shadow-2xs hover:shadow-xs cursor-pointer transition-all flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="p-3 bg-slate-100 text-slate-800 rounded-xl group-hover:bg-slate-900 group-hover:text-white transition-colors">
                  <History className="w-6 h-6" />
                </div>
                <span className="text-xs text-slate-400">Full Audit Log</span>
              </div>
              <h3 className="font-bold text-slate-900 text-base">
                Audit Trail
              </h3>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                View, filter, and export full activity, payment decisions, and system logs.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-600">
              <span className="font-medium">Export to Excel / CSV</span>
              <ArrowRight className="w-4 h-4 text-slate-400 group-hover:translate-x-1 transition-transform" />
            </div>
          </div>

          {/* Supplier Information Tile */}
          <div
            onClick={() => setCurrentPage('supplier-info')}
            className="group bg-white p-5 rounded-2xl border border-slate-200 hover:border-slate-400 shadow-2xs hover:shadow-xs cursor-pointer transition-all flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="p-3 bg-slate-100 text-slate-800 rounded-xl group-hover:bg-slate-900 group-hover:text-white transition-colors">
                  <Users className="w-6 h-6" />
                </div>
                <span className="text-xs text-slate-400">Directory</span>
              </div>
              <h3 className="font-bold text-slate-900 text-base">
                Supplier Information
              </h3>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                Single source of truth for supplier contacts, emails, and bank accounts.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-600">
              <span className="font-medium">{activeSuppliers.length} Active Supplier{activeSuppliers.length === 1 ? '' : 's'}</span>
              <ArrowRight className="w-4 h-4 text-slate-400 group-hover:translate-x-1 transition-transform" />
            </div>
          </div>

          {/* Management Tile */}
          <div
            onClick={() => setCurrentPage('management')}
            className="group bg-white p-5 rounded-2xl border border-slate-200 hover:border-slate-400 shadow-2xs hover:shadow-xs cursor-pointer transition-all flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="p-3 bg-slate-100 text-slate-800 rounded-xl group-hover:bg-slate-900 group-hover:text-white transition-colors">
                  <Settings className="w-6 h-6" />
                </div>
                <span className="px-2.5 py-1 bg-slate-100 text-slate-800 font-bold border border-slate-200 rounded-full text-xs">
                  System Settings
                </span>
              </div>
              <h3 className="font-bold text-slate-900 text-base">
                Management & Settings
              </h3>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                Configure Google Sheet live connection link, cash buffer limit, payment reminder lead times, and system rules.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-600">
              <span className="font-medium text-slate-700">Configure System Settings</span>
              <ArrowRight className="w-4 h-4 text-slate-400 group-hover:translate-x-1 transition-transform" />
            </div>
          </div>

          {/* Google Sheets Data Tabs Tile */}
          <div
            onClick={() => setCurrentPage('sheets-tab')}
            className="group bg-white p-5 rounded-2xl border border-slate-200 hover:border-slate-400 shadow-2xs hover:shadow-xs cursor-pointer transition-all flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="p-3 bg-slate-100 text-slate-800 rounded-xl group-hover:bg-slate-900 group-hover:text-white transition-colors">
                  <FileSpreadsheet className="w-6 h-6" />
                </div>
                <span className="text-xs text-slate-600 font-mono font-medium">Live Connected</span>
              </div>
              <h3 className="font-bold text-slate-900 text-base">
                Google Sheet Data Tabs
              </h3>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                Inspect live database tabs (PaymentQueue, Suppliers, AuditTrail, CreditNotesRefunds, Settings).
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-600">
              <span className="font-medium">Inspect Connected Sheet DB</span>
              <ArrowRight className="w-4 h-4 text-slate-400 group-hover:translate-x-1 transition-transform" />
            </div>
          </div>

        </div>
      </div>

    </div>
  );
};
