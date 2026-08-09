import React from 'react';
import {
  Clock,
  AlertOctagon,
  ArrowUpRight,
  CheckCircle2,
  Calendar,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useGoogleSync } from '../context/GoogleSyncContext';
import { formatSGD, parseDate, extractDueDateFromSyncedStr } from '../utils/formatters';

interface NormalizedQueueItem {
  id: string;
  invoiceNo: string;
  supplierName: string;
  amount: number;
  dueDate: string;
  paymentDate: string;
  status: 'pending' | 'scheduled' | 'flagged' | 'completed';
  poNo: string;
}

export const DashboardPage: React.FC = () => {
  const {
    setCurrentPage,
    paymentItems,
    simulatedDate,
  } = useApp();

  const {
    syncStatus,
    syncedQueueRows,
  } = useGoogleSync();

  const isGoogleConnected =
    (syncStatus === 'Connected' || syncStatus === 'Up to Date' || syncStatus === 'Synchronising...') &&
    syncedQueueRows.length > 0;

  // Build unified normalized active payment queue list
  const normalizedQueueItems: NormalizedQueueItem[] = React.useMemo(() => {
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

          if (s.includes('scheduled') || (paymentDate !== '' && paymentDate !== '-')) {
            status = 'scheduled';
          } else if (s.includes('flag') || s.includes('anomaly') || s.includes('hold')) {
            status = 'flagged';
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

  // Filter queue items by status
  const pendingItems = normalizedQueueItems.filter((p) => p.status === 'pending');
  const scheduledItems = normalizedQueueItems.filter((p) => p.status === 'scheduled');
  const flaggedItems = normalizedQueueItems.filter((p) => p.status === 'flagged');

  // Computed totals
  const pendingTotalAmount = pendingItems.reduce((sum, item) => sum + item.amount, 0);
  const scheduledTotalAmount = scheduledItems.reduce((sum, item) => sum + item.amount, 0);
  const flaggedTotalAmount = flaggedItems.reduce((sum, item) => sum + item.amount, 0);

  // Upcoming Payments (Next 3 Days) calculation
  const simDateObj = parseDate(simulatedDate) || new Date();
  const today = new Date(simDateObj.getFullYear(), simDateObj.getMonth(), simDateObj.getDate(), 0, 0, 0, 0);
  const max3Days = new Date(simDateObj.getFullYear(), simDateObj.getMonth(), simDateObj.getDate() + 3, 23, 59, 59, 999);

  const upcoming3DaysItems = normalizedQueueItems
    .filter((item) => {
      const targetDateStr = item.paymentDate || item.dueDate;
      if (!targetDateStr) return false;
      const d = parseDate(targetDateStr);
      if (!d) return false;
      d.setHours(0, 0, 0, 0);
      return d.getTime() >= today.getTime() && d.getTime() <= max3Days.getTime();
    })
    .sort((a, b) => {
      const dateA = parseDate(a.paymentDate || a.dueDate)?.getTime() || 0;
      const dateB = parseDate(b.paymentDate || b.dueDate)?.getTime() || 0;
      return dateA - dateB;
    });

  const upcoming3DaysTotal = upcoming3DaysItems.reduce((sum, item) => sum + item.amount, 0);

  return (
    <div className="space-y-6 pb-8">
      
      {/* Dashboard Header */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-800 border border-slate-200">
              Payment Control Dashboard
            </span>
            <span className="text-xs text-slate-400 font-mono">Real-Time Queue Metrics</span>
          </div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">
            Supplier Payment Schedule Overview
          </h1>
          <p className="text-xs text-slate-500 mt-1 max-w-2xl leading-relaxed">
            Monitor upcoming payment dates, pending invoice queues, confirmed scheduled payments, and flagged anomalies.
          </p>
        </div>
      </div>

      {/* 4 Core Summary Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        
        {/* Upcoming Payments (Next 3 Days) */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-slate-600 text-xs font-semibold mb-2">
              <span className="flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-slate-700" />
                Upcoming Payments (3 Days)
              </span>
              <span className="text-[10px] bg-slate-100 text-slate-800 px-2 py-0.5 rounded border border-slate-200 font-bold">
                {upcoming3DaysItems.length} Due Soon
              </span>
            </div>
            <div className="text-2xl font-bold font-mono tracking-tight text-slate-900 mt-1">
              {formatSGD(upcoming3DaysTotal)}
            </div>
            <p className="text-xs text-slate-500 mt-2">
              Payments due or scheduled within the next 3 days.
            </p>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
            <button
              onClick={() => setCurrentPage('payment-queue')}
              className="text-slate-900 hover:underline font-bold flex items-center gap-1 cursor-pointer"
            >
              <span>View Queue</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Pending Payments Queue */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-slate-600 text-xs font-semibold mb-2">
              <span className="flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-slate-700" />
                Pending Payments Queue
              </span>
              <span className="text-[10px] bg-slate-100 text-slate-800 px-2 py-0.5 rounded border border-slate-200 font-bold">
                {pendingItems.length} Invoices
              </span>
            </div>
            <div className="text-2xl font-bold font-mono tracking-tight text-slate-900 mt-1">
              {formatSGD(pendingTotalAmount)}
            </div>
            <p className="text-xs text-slate-500 mt-2">
              Matched invoices awaiting payment date assignment.
            </p>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
            <button
              onClick={() => setCurrentPage('payment-queue')}
              className="text-slate-900 hover:underline font-bold flex items-center gap-1 cursor-pointer"
            >
              <span>Schedule Pending Queue</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Scheduled Payments */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-slate-600 text-xs font-semibold mb-2">
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-slate-700" />
                Scheduled Payments
              </span>
              <span className="text-[10px] bg-slate-100 text-slate-800 px-2 py-0.5 rounded border border-slate-200 font-bold">
                {scheduledItems.length} Confirmed
              </span>
            </div>
            <div className="text-2xl font-bold font-mono tracking-tight text-slate-900 mt-1">
              {formatSGD(scheduledTotalAmount)}
            </div>
            <p className="text-xs text-slate-500 mt-2">
              Payment dates confirmed and ready for release.
            </p>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
            <button
              onClick={() => setCurrentPage('audit-trail')}
              className="text-slate-900 hover:underline font-bold flex items-center gap-1 cursor-pointer"
            >
              <span>View Audit Schedule</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Flagged Anomalies */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-slate-600 text-xs font-semibold mb-2">
              <span className="flex items-center gap-1.5">
                <AlertOctagon className="w-4 h-4 text-slate-700" />
                Flagged Anomalies
              </span>
              <span className="text-[10px] bg-slate-100 text-slate-800 px-2 py-0.5 rounded border border-slate-200 font-bold">
                {flaggedItems.length} Flagged
              </span>
            </div>
            <div className="text-2xl font-bold font-mono tracking-tight text-slate-900 mt-1">
              {formatSGD(flaggedTotalAmount)}
            </div>
            <p className="text-xs text-slate-500 mt-2">
              Discrepancies awaiting credit note or refund recovery requests.
            </p>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
            <button
              onClick={() => setCurrentPage('flagged-anomalies')}
              className="text-slate-900 hover:underline font-bold flex items-center gap-1 cursor-pointer"
            >
              <span>Review Anomalies</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

      </div>

      {/* Upcoming Payments (Next 3 Days) Detailed List */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-2xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-slate-700" />
            <h3 className="text-base font-bold text-slate-900">
              Upcoming Payments (Next 3 Days)
            </h3>
            <span className="px-2 py-0.5 bg-slate-100 text-slate-800 font-mono text-xs font-bold rounded border border-slate-200">
              {upcoming3DaysItems.length} items
            </span>
          </div>
          <button
            onClick={() => setCurrentPage('payment-queue')}
            className="text-xs font-semibold text-slate-900 hover:underline cursor-pointer"
          >
            Go to Payment Queue →
          </button>
        </div>

        {upcoming3DaysItems.length === 0 ? (
          <div className="p-8 text-center text-slate-500 text-xs">
            <CheckCircle2 className="w-8 h-8 text-slate-400 mx-auto mb-2" />
            <p className="font-semibold text-slate-800">No Payments Due in the Next 3 Days</p>
            <p className="text-slate-400 mt-0.5">All scheduled payments are well beyond the 3-day horizon.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-500 font-semibold uppercase text-[10px] tracking-wider border-b border-slate-200">
                  <th className="p-3">Invoice & Ref</th>
                  <th className="p-3">Supplier Name</th>
                  <th className="p-3 text-right">Amount (SGD)</th>
                  <th className="p-3">Due / Scheduled Date</th>
                  <th className="p-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-sans text-slate-700">
                {upcoming3DaysItems.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="p-3 font-mono font-bold text-slate-900">
                      {item.invoiceNo}
                      <span className="text-[10px] font-normal text-slate-400 block font-mono">PO: {item.poNo}</span>
                    </td>
                    <td className="p-3 font-bold text-slate-800">{item.supplierName}</td>
                    <td className="p-3 text-right font-mono font-bold text-slate-900 text-sm">
                      {formatSGD(item.amount)}
                    </td>
                    <td className="p-3 font-mono font-bold text-slate-900 bg-slate-50">
                      {item.paymentDate || item.dueDate}
                    </td>
                    <td className="p-3">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-slate-100 text-slate-800 border border-slate-200">
                        {item.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  );
};
