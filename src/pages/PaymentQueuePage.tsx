import React, { useState, useEffect } from 'react';
import {
  Search,
  Filter,
  Calendar,
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
  Lock,
  RefreshCw,
  Clock,
  ShieldAlert,
  ArrowUpDown,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useGoogleSync } from '../context/GoogleSyncContext';
import { GoogleSheetsSyncBanner } from '../components/GoogleSheetsSyncBanner';
import { ConfirmModal } from '../components/ConfirmModal';
import { SGDatePicker } from '../components/SGDatePicker';
import { EmailNoticeModal } from '../components/EmailNoticeModal';
import { PasswordReentryModal } from '../components/PasswordReentryModal';
import { ManagerReviewModal } from './ManagerReviewModal';
import { PaymentItem, EmailNotice, PaymentQueueRow } from '../types';
import { formatSGD, formatSGDate, toInputDateFormat, parseDate, isOverdue, getDaysOverdue, isDateAfter, extractDueDateFromSyncedStr, formatDueDateDisplay } from '../utils/formatters';

interface PaymentQueuePageProps {
  initialTab?: 'all' | 'overdue';
}

export const PaymentQueuePage: React.FC<PaymentQueuePageProps> = ({ initialTab = 'all' }) => {
  const {
    paymentItems,
    setPaymentDate,
    revertPaymentDate,
    completePayment,
    addEmailNoticeRecord,
    getSupplierByName,
    getSupplierById,
    addAuditLog,
    syncSheets,
    settings,
    simulatedDate,
    currentUser,
    setCurrentPage,
    highlightedItemId,
    setHighlightedItemId,
  } = useApp();

  // Scroll into view and flash highlight when navigating from Notification
  useEffect(() => {
    if (highlightedItemId) {
      setActiveTab('all');

      const scrollTimer = setTimeout(() => {
        const el = document.getElementById(`row-${highlightedItemId}`);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 150);

      const handleDismiss = () => {
        setHighlightedItemId(null);
      };

      const clickTimer = setTimeout(() => {
        window.addEventListener('click', handleDismiss, { once: true, capture: true });
      }, 200);

      return () => {
        clearTimeout(scrollTimer);
        clearTimeout(clickTimer);
        window.removeEventListener('click', handleDismiss, { capture: true });
      };
    }
  }, [highlightedItemId, setHighlightedItemId]);

  const {
    googleUser,
    syncStatus,
    syncedQueueRows,
    updatePaymentInSheets,
    syncNow,
  } = useGoogleSync();

  const isManager = currentUser?.role === 'manager';
  const isGoogleConnected = (syncStatus === 'Connected' || syncStatus === 'Up to Date' || syncStatus === 'Synchronising...') && syncedQueueRows.length > 0;

  // Active Tab State: 'all' | 'overdue'
  const [activeTab, setActiveTab] = useState<'all' | 'overdue'>(initialTab);

  // Search & Filter State
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<string>('');
  const [sortBy, setSortBy] = useState<'dueDate' | 'supplier' | 'amount'>('dueDate');

  // Selected date pickers per item row ID: { [itemId]: 'YYYY-MM-DD' }
  const [selectedDates, setSelectedDates] = useState<Record<string, string>>({});

  // Confirmation modal state
  const [confirmModalItem, setConfirmModalItem] = useState<{
    item: PaymentItem | PaymentQueueRow;
    rawInputDate: string;
    isSyncedRow?: boolean;
  } | null>(null);

  const [completeConfirmItem, setCompleteConfirmItem] = useState<{
    item: PaymentItem | PaymentQueueRow;
    isSyncedRow?: boolean;
  } | null>(null);

  // Email notice modal state & previous state for revert
  const [emailNoticeData, setEmailNoticeData] = useState<EmailNotice | null>(null);
  const [pendingScheduleItem, setPendingScheduleItem] = useState<{
    item: PaymentItem | PaymentQueueRow;
    isSyncedRow?: boolean;
    sgDate: string;
    rawInputDate: string;
  } | null>(null);
  const [previousItemState, setPreviousItemState] = useState<{ id: string; prevDate?: string; prevStatus: PaymentItem['status'] } | null>(null);

  // Manager Review Modal state for Mr Boon
  const [reviewItem, setReviewItem] = useState<PaymentItem | null>(null);

  // Password re-entry modal for Mdm Lim trying to access manager function or Mr Boon confirming
  const [passwordModalOpen, setPasswordModalOpen] = useState(false);
  const [passwordTargetItem, setPasswordTargetItem] = useState<PaymentItem | null>(null);

  // Total overdue counts (both un-scheduled and scheduled with past target date)
  const totalLocalOverdueCount = paymentItems.filter(
    (item) => item.status !== 'completed' && item.status !== 'paid' && isOverdue(item.paymentDate || item.dueDate, simulatedDate)
  ).length;

  const totalSyncedOverdueCount = syncedQueueRows.filter((row) => {
    const isPaid = row.status.toLowerCase().includes('paid') || row.status.toLowerCase().includes('completed');
    const dueDateStr = extractDueDateFromSyncedStr(row.creditTermsAndDueDate);
    const targetDateStr = row.paymentDate || dueDateStr;
    return !isPaid && isOverdue(targetDateStr, simulatedDate);
  }).length;

  const totalOverdueCount = isGoogleConnected ? totalSyncedOverdueCount : totalLocalOverdueCount;

  // Filter & sort local active items
  const activeLocalItems = paymentItems.filter((item) => item.status !== 'completed' && item.status !== 'paid');

  const filteredLocalItems = activeLocalItems
    .filter((item) => {
      const matchesSearch =
        item.invoiceNo.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.supplierName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.poNo.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.grnNo.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesStatus = statusFilter === 'all' || item.status === statusFilter;
      const matchesDate = !dateFilter || item.dueDate.includes(dateFilter) || (item.paymentDate && item.paymentDate.includes(dateFilter));

      const matchesTab =
        activeTab === 'all' ||
        (activeTab === 'overdue' && isOverdue(item.paymentDate || item.dueDate, simulatedDate));

      return matchesSearch && matchesStatus && matchesDate && matchesTab;
    })
    .sort((a, b) => {
      if (sortBy === 'supplier') return a.supplierName.localeCompare(b.supplierName);
      if (sortBy === 'amount') return b.amount - a.amount;
      const dateA = parseDate(a.dueDate)?.getTime() || 0;
      const dateB = parseDate(b.dueDate)?.getTime() || 0;
      return dateA - dateB;
    });

  // Filter & sort live Google Sheets synced payment queue
  const filteredSyncedRows = syncedQueueRows
    .filter((row) => {
      const isPaid = row.status.toLowerCase().includes('paid') || row.status.toLowerCase().includes('completed');
      if (isPaid) return false;

      const matchesSearch =
        row.supplierInvoiceInfo.toLowerCase().includes(searchTerm.toLowerCase()) ||
        row.threeWayMatchRef.toLowerCase().includes(searchTerm.toLowerCase()) ||
        row.invoiceId.toLowerCase().includes(searchTerm.toLowerCase()) ||
        row.matchId.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesStatus =
        statusFilter === 'all' ||
        row.status.toLowerCase().replace(/\s+/g, '_') === statusFilter.toLowerCase().replace(/\s+/g, '_');

      const matchesDate =
        !dateFilter ||
        row.creditTermsAndDueDate.includes(dateFilter) ||
        row.paymentDate.includes(dateFilter);

      const dueDateStr = extractDueDateFromSyncedStr(row.creditTermsAndDueDate);
      const targetDateStr = row.paymentDate || dueDateStr;

      const matchesTab =
        activeTab === 'all' ||
        (activeTab === 'overdue' && isOverdue(targetDateStr, simulatedDate));

      return matchesSearch && matchesStatus && matchesDate && matchesTab;
    })
    .sort((a, b) => {
      if (sortBy === 'supplier') return a.supplierInvoiceInfo.localeCompare(b.supplierInvoiceInfo);
      if (sortBy === 'amount') {
        const amtA = parseFloat(a.invoiceAmount.replace(/[^0-9.]/g, '')) || 0;
        const amtB = parseFloat(b.invoiceAmount.replace(/[^0-9.]/g, '')) || 0;
        return amtB - amtA;
      }
      return 0;
    });

  const handleInitiatePaymentDateForLocal = (item: PaymentItem) => {
    const fallback = item.paymentDate ? toInputDateFormat(item.paymentDate) : toInputDateFormat(simulatedDate);
    const inputDate = selectedDates[item.id] || fallback;
    setConfirmModalItem({ item, rawInputDate: inputDate, isSyncedRow: false });
  };

  const handleInitiatePaymentDateForSynced = (row: PaymentQueueRow) => {
    const fallback = row.paymentDate ? toInputDateFormat(row.paymentDate) : toInputDateFormat(simulatedDate);
    const inputDate = selectedDates[row.matchId] || fallback;
    setConfirmModalItem({ item: row, rawInputDate: inputDate, isSyncedRow: true });
  };

  const handleConfirmSetDate = async () => {
    if (!confirmModalItem) return;

    const { item, rawInputDate, isSyncedRow } = confirmModalItem;
    const sgDate = formatSGDate(rawInputDate);

    setConfirmModalItem(null);

    let dueDate = '';
    let supplierName = '';
    let invoiceNo = '';
    let amount = 0;
    let supplierId = '';

    if (isSyncedRow) {
      const syncedRow = item as PaymentQueueRow;
      dueDate = extractDueDateFromSyncedStr(syncedRow.creditTermsAndDueDate);
      const linesSup = syncedRow.supplierInvoiceInfo.split('\n');
      supplierName = linesSup[0] || 'Supplier';
      invoiceNo = linesSup[1] || syncedRow.invoiceId;
      amount = parseFloat(syncedRow.invoiceAmount.replace(/[^0-9.]/g, '')) || 0;
      supplierId = syncedRow.invoiceId;
    } else {
      const localItem = item as PaymentItem;
      dueDate = localItem.dueDate;
      supplierName = localItem.supplierName;
      invoiceNo = localItem.invoiceNo;
      amount = localItem.amount;
      supplierId = localItem.supplierId;
    }

    const sup = getSupplierByName(supplierName) || getSupplierById(supplierId);
    const supplierEmail = sup?.email || 'accounts@supplier.com.sg';

    // Check if selected payment date exceeds invoice Due Date
    const isExceeded = isDateAfter(sgDate, dueDate);

    if (isExceeded) {
      setPendingScheduleItem({ item, isSyncedRow, sgDate, rawInputDate });
      setEmailNoticeData({
        supplierId: sup?.id || 'SUP-001',
        supplierName: sup?.name || supplierName,
        toEmail: supplierEmail,
        invoiceNo: invoiceNo,
        amount: amount,
        originalDueDate: dueDate,
        proposedPaymentDate: sgDate,
        reason: 'Cash flow scheduling alignment',
        bodyText: '',
      });
      return;
    }

    // If payment date is on or before Due Date, commit immediately
    if (isSyncedRow) {
      const syncedRow = item as PaymentQueueRow;
      await updatePaymentInSheets(
        syncedRow.matchId,
        syncedRow.invoiceId,
        'Scheduled',
        sgDate,
        'Re-schedule'
      );
      addAuditLog(
        'payment_date',
        `Scheduled payment date ${sgDate} for Invoice ${invoiceNo} (${supplierName}) - Amount: S$${amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}.`,
        { invoiceNo, supplierName, paymentDate: sgDate, amount, dueDate, status: 'Scheduled' }
      );
    } else {
      const localItem = item as PaymentItem;
      setSelectedDates((prev) => ({ ...prev, [localItem.id]: rawInputDate }));
      setPaymentDate(localItem.id, sgDate);
    }
  };

  const handleConfirmPaymentCompletion = async () => {
    if (!completeConfirmItem) return;
    const { item, isSyncedRow } = completeConfirmItem;

    setCompleteConfirmItem(null);

    const todaySG = formatSGDate(new Date());

    if (isSyncedRow) {
      const syncedRow = item as PaymentQueueRow;
      const targetDate = syncedRow.paymentDate || todaySG;
      await updatePaymentInSheets(
        syncedRow.matchId,
        syncedRow.invoiceId,
        'Paid',
        targetDate,
        'Payment Completed'
      );

      const linesSup = syncedRow.supplierInvoiceInfo.split('\n');
      const invoiceNo = linesSup[1] || syncedRow.invoiceId;
      const matchingLocal = paymentItems.find(
        (p) => p.invoiceNo.toLowerCase() === invoiceNo.toLowerCase() || p.id === syncedRow.invoiceId
      );
      if (matchingLocal) {
        const res = completePayment(matchingLocal.id);
        if (res && !res.success) {
          alert(res.reason || 'Payment could not be completed due to an anomaly on hold.');
          return;
        }
      } else {
        addAuditLog(
          'payment_completed',
          `Payment Completed for synced Invoice ${invoiceNo} (${linesSup[0] || 'Supplier'}) - S$${syncedRow.invoiceAmount}. Moved to Payment Archives.`,
          { matchId: syncedRow.matchId, invoiceId: syncedRow.invoiceId }
        );
      }
    } else {
      const localItem = item as PaymentItem;
      const res = completePayment(localItem.id);
      if (res && !res.success) {
        alert(res.reason || 'Payment could not be completed due to an anomaly on hold.');
        return;
      }
    }
  };

  const handleCancelSetDate = () => {
    setConfirmModalItem(null);
  };

  const handleCancelEmailNotice = () => {
    if (previousItemState) {
      revertPaymentDate(previousItemState.id, previousItemState.prevDate, previousItemState.prevStatus);
      setPreviousItemState(null);
    }
    setEmailNoticeData(null);
  };

  const handleOpenManagerReview = (item: PaymentItem) => {
    setReviewItem(item);
  };

  return (
    <div className="space-y-6 pb-8">
      
      {/* Live Google Sheets Integration Banner */}
      <GoogleSheetsSyncBanner />

      {/* Page Header Bar */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <span>3-Way Matched Supplier Payment Queue</span>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-800 border border-slate-200 font-mono">
              {isGoogleConnected ? `${filteredSyncedRows.length} Live Synced Records` : `${filteredLocalItems.length} Records`}
            </span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            {isGoogleConnected
              ? 'Continuously receiving payment-ready invoices directly from live Google Sheet worksheet MATCH_RESULTS and synchronising PAYMENT_QUEUE in real time.'
              : 'Select an invoice to set planned payment dates. Connect your Google Sheet above for real-time live synchronization.'}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={syncNow}
            className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5 text-white" />
            <span>Sync Live Sheets</span>
          </button>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
        
        {/* Search Field */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search invoice #, PO #, GRN #, Match ID, or supplier name..."
            className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-slate-900 text-xs bg-white text-slate-900"
          />
        </div>

        {/* Filters */}
        <div className="flex items-center gap-3 flex-wrap">
          
          <div className="flex items-center gap-1.5">
            <Filter className="w-3.5 h-3.5 text-slate-500" />
            <span className="text-slate-500 font-medium">Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-2.5 py-1.5 border border-slate-300 rounded-lg bg-white font-medium text-xs focus:ring-2 focus:ring-slate-900 text-slate-800"
            >
              <option value="all">All Statuses</option>
              <option value="pending">Pending Payment</option>
              <option value="scheduled">Scheduled</option>
              <option value="on_hold">On Hold</option>
              <option value="flagged">Flagged Anomaly</option>
              <option value="withheld">Withheld</option>
            </select>
          </div>

          <div className="flex items-center gap-1.5">
            <ArrowUpDown className="w-3.5 h-3.5 text-slate-500" />
            <span className="text-slate-500 font-medium">Sort:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="px-2.5 py-1.5 border border-slate-300 rounded-lg bg-white font-medium text-xs focus:ring-2 focus:ring-slate-900 text-slate-800"
            >
              <option value="dueDate">Due Date</option>
              <option value="supplier">Supplier Name</option>
              <option value="amount">Invoice Amount</option>
            </select>
          </div>

        </div>
      </div>

      {/* Payment Queue Data Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left border-collapse">
            
            <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200 uppercase tracking-wider text-[11px]">
              <tr>
                <th className="p-3.5">Supplier / Invoice Info</th>
                <th className="p-3.5">3-Way Match Ref (PO / GRN)</th>
                <th className="p-3.5 text-right">Invoice Amount</th>
                <th className="p-3.5">DUE DATE</th>
                <th className="p-3.5">Status</th>
                <th className="p-3.5">Payment Date Scheduling</th>
                <th className="p-3.5 text-center">Actions</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-200">
              {/* LIVE GOOGLE SHEETS SYNCED ROWS */}
              {isGoogleConnected ? (
                filteredSyncedRows.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-slate-500 font-mono">
                      No matching records in live Google Sheet worksheet <code className="text-slate-800 font-bold">PAYMENT_QUEUE</code>.
                    </td>
                  </tr>
                ) : (
                  filteredSyncedRows.map((row) => {
                    const rowKeyId = row.matchId || row.invoiceId;
                    const isRowHighlighted =
                      Boolean(highlightedItemId) &&
                      (row.matchId === highlightedItemId ||
                        row.invoiceId === highlightedItemId ||
                        (rowKeyId && rowKeyId.toLowerCase() === highlightedItemId.toLowerCase()) ||
                        row.supplierInvoiceInfo.toLowerCase().includes(highlightedItemId.toLowerCase()));

                    return (
                      <tr
                        key={rowKeyId}
                        id={`row-${row.matchId || row.invoiceId}`}
                        onClick={() => isRowHighlighted && setHighlightedItemId(null)}
                        className={`transition-all duration-300 ${
                          isRowHighlighted
                            ? 'bg-slate-100 ring-2 ring-slate-400 shadow-md font-semibold'
                            : 'hover:bg-slate-50/80'
                        }`}
                      >
                        {/* Supplier & Invoice Info */}
                        <td className="p-3.5 font-mono whitespace-pre-line text-slate-900 leading-snug font-medium">
                          <div className="font-bold font-sans text-sm text-slate-900 mb-0.5">
                            {row.supplierInvoiceInfo.split('\n')[0]}
                          </div>
                          <div className="text-slate-600 font-semibold text-xs">
                            {row.supplierInvoiceInfo.split('\n')[1]}
                          </div>
                          <div className="text-[10px] text-slate-400">
                            {row.supplierInvoiceInfo.split('\n')[2]}
                          </div>
                        </td>

                        {/* 3-Way Match Ref */}
                        <td className="p-3.5 font-mono whitespace-pre-line text-slate-800 text-xs leading-snug">
                          {row.threeWayMatchRef}
                        </td>

                        {/* Invoice Amount */}
                        <td className="p-3.5 text-right font-mono font-bold text-slate-900 text-sm">
                          <div className={row.invoiceAmount.includes('Unavailable') || row.invoiceAmount.includes('Review') ? 'text-slate-700 text-xs font-semibold' : 'text-slate-900'}>
                            {row.invoiceAmount}
                          </div>
                          {row.diagnosticInfo && (
                            <div className="text-[10px] font-sans font-normal text-slate-400 mt-0.5" title={row.diagnosticInfo}>
                              {row.joinWarning ? (
                                <span className="text-slate-600 font-semibold">{row.joinWarning}</span>
                              ) : (
                                <span className="text-slate-400">Source: INVOICES.Invoice_Total</span>
                              )}
                            </div>
                          )}
                        </td>

                        {/* Due Date */}
                        <td className="p-3.5 font-mono text-slate-700 font-medium">
                          <div>{formatDueDateDisplay(row.creditTermsAndDueDate)}</div>
                        {(() => {
                          const syncedDueDate = extractDueDateFromSyncedStr(row.creditTermsAndDueDate);
                          const isPaidOrScheduled =
                            row.status.toLowerCase().includes('paid') ||
                            row.status.toLowerCase().includes('scheduled') ||
                            Boolean(row.paymentDate);
                          if (!isPaidOrScheduled && isOverdue(syncedDueDate, simulatedDate)) {
                            return (
                              <span className="inline-block px-2 py-0.5 mt-1 rounded bg-slate-100 text-slate-800 border border-slate-300 text-[10px] font-bold font-mono">
                                Overdue by {getDaysOverdue(syncedDueDate, simulatedDate)} days
                              </span>
                            );
                          }
                          return null;
                        })()}
                      </td>

                      {/* Status Tag */}
                      <td className="p-3.5">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border bg-slate-100 text-slate-800 border-slate-200">
                          <span className="w-2 h-2 rounded-full bg-slate-700"></span>
                          <span>{row.status}</span>
                        </span>
                      </td>

                      {/* Payment Date Scheduling */}
                      <td className="p-3.5">
                        {row.status === 'Scheduled' || row.paymentDate ? (
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="px-2.5 py-1.5 border border-slate-300 bg-slate-100 text-slate-900 rounded-lg text-xs font-mono font-bold">
                              {row.paymentDate}
                            </span>
                            <button
                              onClick={() => handleInitiatePaymentDateForSynced(row)}
                              className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs rounded-lg shadow-2xs whitespace-nowrap transition-colors flex items-center gap-1 cursor-pointer"
                            >
                              <Calendar className="w-3.5 h-3.5" />
                              <span>Re-schedule</span>
                            </button>
                            <button
                              onClick={() => setCompleteConfirmItem({ item: row, isSyncedRow: true })}
                              className="px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-800 border border-slate-300 font-semibold text-xs rounded-lg shadow-2xs whitespace-nowrap transition-colors flex items-center gap-1 cursor-pointer"
                              title="Mark payment as completed & move to Payment Archives"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5 text-slate-700" />
                              <span>Payment Completed</span>
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 flex-wrap">
                            <button
                              onClick={() => handleInitiatePaymentDateForSynced(row)}
                              className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs rounded-lg shadow-2xs whitespace-nowrap transition-colors flex items-center gap-1 cursor-pointer"
                            >
                              <Calendar className="w-3.5 h-3.5" />
                              <span>Schedule Payment Date</span>
                            </button>
                            <button
                              onClick={() => setCompleteConfirmItem({ item: row, isSyncedRow: true })}
                              className="px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-800 border border-slate-300 font-semibold text-xs rounded-lg shadow-2xs whitespace-nowrap transition-colors flex items-center gap-1 cursor-pointer"
                              title="Mark payment as completed & move to Payment Archives"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5 text-slate-700" />
                              <span>Payment Completed</span>
                            </button>
                          </div>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="p-3.5 text-center">
                        <span className="text-[10px] font-mono text-slate-800 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded font-medium">
                          Live Synced
                        </span>
                      </td>
                    </tr>
                  );
                })
              )
            ) : (
              /* LOCAL / FALLBACK QUEUE ROWS */
              filteredLocalItems.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-500">
                    No matching supplier invoice records found in payment queue.
                  </td>
                </tr>
              ) : (
                filteredLocalItems.map((item) => {
                  const isRowHighlighted =
                    Boolean(highlightedItemId) &&
                    (item.id === highlightedItemId ||
                      item.invoiceNo.toLowerCase().includes(highlightedItemId.toLowerCase()) ||
                      item.supplierName.toLowerCase().includes(highlightedItemId.toLowerCase()));

                  return (
                    <tr
                      key={item.id}
                      id={`row-${item.id}`}
                      onClick={() => isRowHighlighted && setHighlightedItemId(null)}
                      className={`transition-all duration-300 ${
                        isRowHighlighted
                          ? 'bg-slate-100 ring-2 ring-slate-400 shadow-md font-semibold'
                          : 'hover:bg-slate-50/80'
                      }`}
                    >
                      {/* Supplier & Invoice */}
                      <td className="p-3.5">
                        <p className="font-bold text-slate-900 text-sm">{item.supplierName}</p>
                        <p className="font-mono text-slate-600 font-semibold mt-0.5">
                          {item.invoiceNo}
                        </p>
                        <p className="text-[10px] text-slate-400">Inv Date: {item.invoiceDate}</p>
                      </td>

                      {/* PO & GRN 3-Way Match Ref */}
                      <td className="p-3.5 font-mono space-y-0.5">
                        <p className="text-slate-800">PO: <span className="font-semibold text-slate-900">{item.poNo}</span></p>
                        <p className="text-slate-800">GRN: <span className="font-semibold text-slate-900">{item.grnNo}</span></p>
                      </td>

                      {/* Amount */}
                      <td className="p-3.5 text-right font-mono font-bold text-slate-900 text-sm">
                        {formatSGD(item.amount)}
                      </td>

                      {/* Due Date */}
                      <td className="p-3.5">
                        <p className="font-mono text-slate-800 font-bold">
                          {item.dueDate ? `Due: ${item.dueDate}` : 'Due Date Unavailable'}
                        </p>
                        {isOverdue(item.dueDate, simulatedDate) && item.status !== 'scheduled' && item.status !== 'completed' && (
                          <span className="inline-block px-2 py-0.5 mt-1 rounded bg-slate-100 text-slate-800 border border-slate-300 text-[10px] font-bold font-mono">
                            Overdue by {getDaysOverdue(item.dueDate, simulatedDate)} days
                          </span>
                        )}
                      </td>

                      {/* Status Tag */}
                      <td className="p-3.5">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-slate-100 text-slate-800 border border-slate-200">
                          <span className="w-2 h-2 rounded-full bg-slate-700"></span>
                          <span>
                            {item.status === 'on_hold' || (item.anomaly && item.anomaly !== 'none')
                              ? 'On Hold – Anomaly Review'
                              : item.status === 'pending'
                              ? 'Pending Schedule'
                              : item.status === 'scheduled'
                              ? `Scheduled: ${item.paymentDate}`
                              : item.status === 'withheld'
                              ? 'Withheld (Buffer)'
                              : item.status}
                          </span>
                        </span>
                      </td>

                      {/* Payment Date Scheduling & Action */}
                      <td className="p-3.5">
                        {item.status === 'on_hold' || (item.anomaly && item.anomaly !== 'none') ? (
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-slate-700 font-semibold italic">
                              On Hold – Anomaly Review
                            </span>
                            <button
                              onClick={() => setCurrentPage('flagged-anomalies')}
                              className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs rounded-lg shadow-2xs transition-colors cursor-pointer whitespace-nowrap"
                            >
                              Review Anomaly
                            </button>
                          </div>
                        ) : item.status === 'scheduled' ? (
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="px-2.5 py-1.5 border border-slate-300 bg-slate-100 text-slate-900 rounded-lg text-xs font-mono font-bold">
                              {item.paymentDate}
                            </span>
                            <button
                              onClick={() => handleInitiatePaymentDateForLocal(item)}
                              className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs rounded-lg shadow-2xs whitespace-nowrap transition-colors flex items-center gap-1 cursor-pointer"
                            >
                              <Calendar className="w-3.5 h-3.5" />
                              <span>Re-schedule</span>
                            </button>
                            <button
                              onClick={() => setCompleteConfirmItem({ item, isSyncedRow: false })}
                              className="px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-800 border border-slate-300 font-semibold text-xs rounded-lg shadow-2xs whitespace-nowrap transition-colors flex items-center gap-1 cursor-pointer"
                              title="Mark payment as completed & move to Payment Archives"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5 text-slate-700" />
                              <span>Payment Completed</span>
                            </button>
                          </div>
                        ) : item.status === 'withheld' ? (
                          <p className="text-[11px] text-slate-600 font-medium italic">
                            Withheld due to cash buffer limit. Review required.
                          </p>
                        ) : (
                          <div className="flex items-center gap-2 flex-wrap">
                            <button
                              onClick={() => handleInitiatePaymentDateForLocal(item)}
                              className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs rounded-lg shadow-2xs whitespace-nowrap transition-colors flex items-center gap-1 cursor-pointer"
                            >
                              <Calendar className="w-3.5 h-3.5" />
                              <span>Schedule Payment Date</span>
                            </button>
                            <button
                              onClick={() => setCompleteConfirmItem({ item, isSyncedRow: false })}
                              className="px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-800 border border-slate-300 font-semibold text-xs rounded-lg shadow-2xs whitespace-nowrap transition-colors flex items-center gap-1 cursor-pointer"
                              title="Mark payment as completed & move to Payment Archives"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5 text-slate-700" />
                              <span>Payment Completed</span>
                            </button>
                          </div>
                        )}
                      </td>

                      {/* Action / Review Button */}
                      <td className="p-3.5 text-center">
                        {(item.status === 'on_hold' || (item.anomaly && item.anomaly !== 'none')) && (
                          <button
                            onClick={() => setCurrentPage('flagged-anomalies')}
                            className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs rounded-lg shadow-2xs transition-colors cursor-pointer"
                          >
                            Review Anomaly
                          </button>
                        )}

                        {(item.status === 'withheld' || item.status === 'on_hold') && (
                          <button
                            onClick={() => handleOpenManagerReview(item)}
                            className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs rounded-lg shadow-2xs flex items-center justify-center gap-1 mx-auto transition-colors cursor-pointer"
                          >
                            <Lock className="w-3.5 h-3.5" />
                            <span>Withheld Review</span>
                          </button>
                        )}

                        {item.status === 'scheduled' && (
                          <span className="text-xs text-slate-800 font-bold bg-slate-100 border border-slate-200 px-2 py-1 rounded">
                            Confirmed
                          </span>
                        )}

                        {item.status === 'pending' && (
                          <span className="text-[11px] text-slate-500 font-medium">
                            Ready to Schedule
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )
            )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Confirmation Modal */}
      {confirmModalItem && (() => {
        const dueDateStr = confirmModalItem.isSyncedRow
          ? extractDueDateFromSyncedStr((confirmModalItem.item as PaymentQueueRow).creditTermsAndDueDate)
          : (confirmModalItem.item as PaymentItem).dueDate;

        const sgFormattedDate = formatSGDate(confirmModalItem.rawInputDate);

        return (
          <ConfirmModal
            isOpen={true}
            title="Confirm Scheduled Payment Date"
            confirmText="Confirm Payment Date"
            cancelText="Cancel (Revert)"
            confirmVariant="primary"
            message={
              <div className="space-y-3">
                <p className="text-slate-700 font-medium text-xs">
                  Are you sure you want to set the scheduled payment date for this invoice?
                </p>

                <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2.5">
                  {/* Contractual Due Date */}
                  <div className="flex items-center justify-between p-2.5 bg-slate-100 border border-slate-200 rounded-lg">
                    <span className="text-xs font-semibold text-slate-800">
                      Invoice Contractual Due Date:
                    </span>
                    <span className="text-xs font-bold font-mono text-slate-900 bg-white px-2 py-0.5 rounded border border-slate-300">
                      {dueDateStr || 'N/A'}
                    </span>
                  </div>

                  {/* Scheduled Payment Date in DD/MM/YYYY */}
                  <div className="p-2.5 bg-slate-100 border border-slate-200 rounded-lg space-y-2 font-sans">
                    <label className="block text-slate-800 font-semibold text-xs">
                      Scheduled Payment Date (Edit to change):
                    </label>
                    <div className="flex items-center gap-2 flex-wrap">
                      <SGDatePicker
                        value={confirmModalItem.rawInputDate}
                        onChange={(sgFormattedDate, rawIso) =>
                          setConfirmModalItem({
                            ...confirmModalItem,
                            rawInputDate: rawIso,
                          })
                        }
                      />
                      <span className="text-xs font-bold text-slate-900 bg-white px-2.5 py-1.5 rounded-md font-mono border border-slate-300">
                        Confirmed Date: {sgFormattedDate} (DD/MM/YYYY)
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            }
            onConfirm={handleConfirmSetDate}
            onCancel={handleCancelSetDate}
          />
        );
      })()}

      {/* Confirm Payment Completion Modal */}
      {completeConfirmItem && (
        <ConfirmModal
          isOpen={true}
          title="Confirm Payment Settlement"
          confirmText="Mark Payment Completed"
          cancelText="Cancel"
          confirmVariant="primary"
          message={
            <div className="space-y-2">
              <p>
                Are you sure you want to mark this payment as <strong>Completed / Paid</strong>?
              </p>
              <p className="text-[11px] text-slate-500 italic">
                This update will immediately write back to your live Google Sheet and update the record status to Paid.
              </p>
            </div>
          }
          onConfirm={handleConfirmPaymentCompletion}
          onCancel={() => setCompleteConfirmItem(null)}
        />
      )}

      {/* Credit Limit Exceeded Email Notice Modal */}
      <EmailNoticeModal
        isOpen={emailNoticeData !== null}
        emailNotice={emailNoticeData}
        onSend={async (finalNotice) => {
          if (finalNotice) {
            addEmailNoticeRecord({
              supplierId: finalNotice.supplierId,
              supplierName: finalNotice.supplierName,
              invoiceNo: finalNotice.invoiceNo,
              amount: finalNotice.amount,
              originalDueDate: finalNotice.originalDueDate,
              proposedPaymentDate: finalNotice.proposedPaymentDate,
              reasonSelected: finalNotice.reason || 'Cash flow scheduling alignment',
              customNotes: finalNotice.customNotes || '',
              toEmail: finalNotice.toEmail,
              bodyText: finalNotice.bodyText,
              sentBy: currentUser?.name || 'Accounts Executive',
            });

            addAuditLog(
              'email_notice',
              `Delay Notice generated and sent to ${finalNotice.supplierName} (${finalNotice.toEmail}) for Invoice ${finalNotice.invoiceNo}. Reason: ${finalNotice.reason}. Proposed Payment Date: ${finalNotice.proposedPaymentDate} (exceeds due date ${finalNotice.originalDueDate}).`,
              {
                invoiceNo: finalNotice.invoiceNo,
                supplierName: finalNotice.supplierName,
                toEmail: finalNotice.toEmail,
                reason: finalNotice.reason,
                proposedPaymentDate: finalNotice.proposedPaymentDate,
                originalDueDate: finalNotice.originalDueDate,
              }
            );
          }

          if (pendingScheduleItem) {
            const { item, isSyncedRow, sgDate, rawInputDate } = pendingScheduleItem;
            if (isSyncedRow) {
              const syncedRow = item as PaymentQueueRow;
              const linesSup = syncedRow.supplierInvoiceInfo.split('\n');
              const supplierName = linesSup[0] || 'Supplier';
              const invoiceNo = linesSup[1] || syncedRow.invoiceId;
              const amount = parseFloat(syncedRow.invoiceAmount.replace(/[^0-9.]/g, '')) || 0;

              await updatePaymentInSheets(
                syncedRow.matchId,
                syncedRow.invoiceId,
                'Scheduled',
                sgDate,
                'Re-schedule'
              );
              addAuditLog(
                'payment_date',
                `Scheduled payment date ${sgDate} for Invoice ${invoiceNo} (${supplierName}) - Amount: S$${amount.toLocaleString(undefined, { minimumFractionDigits: 2 })} (Due date extended with Delay Notice).`,
                { invoiceNo, supplierName, paymentDate: sgDate, amount, status: 'Scheduled' }
              );
            } else {
              const localItem = item as PaymentItem;
              setSelectedDates((prev) => ({ ...prev, [localItem.id]: rawInputDate }));
              setPaymentDate(localItem.id, sgDate);
            }
            setPendingScheduleItem(null);
          }

          setEmailNoticeData(null);
        }}
        onCancel={handleCancelEmailNotice}
      />

      {/* Password Verification Modal for Mr Boon Manager Review */}
      <PasswordReentryModal
        isOpen={passwordModalOpen}
        actionTitle="Access Manager Review & 3-Way Match Inspection"
        onSuccess={() => {
          setPasswordModalOpen(false);
          setReviewItem(passwordTargetItem);
        }}
        onCancel={() => {
          setPasswordModalOpen(false);
          setPasswordTargetItem(null);
        }}
      />

      {/* Side-by-Side 3-Way Match Manager Review Modal */}
      <ManagerReviewModal
        isOpen={reviewItem !== null}
        item={reviewItem}
        onClose={() => setReviewItem(null)}
      />

    </div>
  );
};

