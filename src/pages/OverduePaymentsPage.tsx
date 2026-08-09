import React, { useState, useEffect } from 'react';
import {
  Search,
  Filter,
  Calendar,
  AlertCircle,
  Clock,
  ArrowUpDown,
  Mail,
  CheckCircle2,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useGoogleSync } from '../context/GoogleSyncContext';
import { GoogleSheetsSyncBanner } from '../components/GoogleSheetsSyncBanner';
import { ConfirmModal } from '../components/ConfirmModal';
import { SGDatePicker } from '../components/SGDatePicker';
import { EmailNoticeModal } from '../components/EmailNoticeModal';
import { PaymentItem, EmailNotice, PaymentQueueRow } from '../types';
import {
  formatSGD,
  formatSGDate,
  toInputDateFormat,
  checkIsCreditTermOverdue,
  calculateCreditTermDueDate,
  getDaysOverdue,
  extractDueDateFromSyncedStr,
  formatDueDateDisplay,
} from '../utils/formatters';

export const OverduePaymentsPage: React.FC = () => {
  const {
    paymentItems,
    setPaymentDate,
    addEmailNoticeRecord,
    getSupplierByName,
    getSupplierById,
    addAuditLog,
    settings,
    simulatedDate,
    currentUser,
    highlightedItemId,
    setHighlightedItemId,
  } = useApp();

  const {
    syncedQueueRows,
    syncStatus,
    updatePaymentInSheets,
    invoicesRows,
  } = useGoogleSync();

  const isGoogleConnected = syncStatus === 'Connected' || syncStatus === 'Up to Date' || syncStatus === 'Waiting for Changes';

  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'dueDate' | 'supplier' | 'amount'>('dueDate');
  const [selectedDates, setSelectedDates] = useState<Record<string, string>>({});

  // Confirmation modal state
  const [confirmModalItem, setConfirmModalItem] = useState<{
    item: PaymentItem | PaymentQueueRow;
    rawInputDate: string;
    isSyncedRow: boolean;
  } | null>(null);

  // Email notice modal state
  const [emailModalNotice, setEmailModalNotice] = useState<EmailNotice | null>(null);

  const getCreditTermsDaysForSupplier = (supplierName: string): number => {
    const sup = getSupplierByName(supplierName);
    return sup?.creditTermsDays || 30;
  };

  // Filter local items for Overdue page
  const overdueLocalItems = paymentItems.filter((item) => {
    if (item.status === 'completed') return false;

    const supplier = getSupplierById(item.supplierId) || getSupplierByName(item.supplierName);
    const creditTerms = supplier?.creditTermsDays || item.creditTermsDays || 30;
    const isOverdueItem = checkIsCreditTermOverdue(item.invoiceDate, creditTerms, item.dueDate, simulatedDate);

    if (!isOverdueItem) return false;

    const matchesSearch =
      item.invoiceNo.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.supplierName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.poNo.toLowerCase().includes(searchTerm.toLowerCase());

    return matchesSearch;
  }).sort((a, b) => {
    if (sortBy === 'supplier') return a.supplierName.localeCompare(b.supplierName);
    if (sortBy === 'amount') return b.amount - a.amount;
    const dateA = calculateCreditTermDueDate(a.invoiceDate, a.creditTermsDays, a.dueDate);
    const dateB = calculateCreditTermDueDate(b.invoiceDate, b.creditTermsDays, b.dueDate);
    return dateA.localeCompare(dateB);
  });

  // Filter Google Sheets synced rows for Overdue page
  const overdueSyncedRows = syncedQueueRows.filter((row) => {
    const statusLower = (row.status || '').toLowerCase();
    if (statusLower.includes('paid') || statusLower.includes('completed')) return false;

    const lines = row.supplierInvoiceInfo.split('\n');
    const supName = lines[0] || '';
    const invoiceNo = lines[1] || row.invoiceId;

    const cleanInvNo = invoiceNo.replace(/^Invoice\s*/i, '').trim();
    const matchedInvoice = invoicesRows.find(
      (inv) =>
        (inv.invoiceId && row.invoiceId && inv.invoiceId.toLowerCase() === row.invoiceId.toLowerCase()) ||
        (inv.invoiceNumber && cleanInvNo && inv.invoiceNumber.toLowerCase() === cleanInvNo.toLowerCase())
    );

    const creditTerms = getCreditTermsDaysForSupplier(supName);
    const invoiceDate = matchedInvoice?.invoiceDate || '';
    const authoritativeDueDate = matchedInvoice?.dueDate || extractDueDateFromSyncedStr(row.creditTermsAndDueDate);

    const isOverdueRow = checkIsCreditTermOverdue(invoiceDate, creditTerms, authoritativeDueDate, simulatedDate);
    if (!isOverdueRow) return false;

    const matchesSearch =
      row.supplierInvoiceInfo.toLowerCase().includes(searchTerm.toLowerCase()) ||
      row.threeWayMatchRef.toLowerCase().includes(searchTerm.toLowerCase()) ||
      row.invoiceId.toLowerCase().includes(searchTerm.toLowerCase());

    return matchesSearch;
  }).sort((a, b) => {
    if (sortBy === 'supplier') return a.supplierInvoiceInfo.localeCompare(b.supplierInvoiceInfo);
    if (sortBy === 'amount') {
      const amtA = parseFloat(a.invoiceAmount.replace(/[^0-9.]/g, '')) || 0;
      const amtB = parseFloat(b.invoiceAmount.replace(/[^0-9.]/g, '')) || 0;
      return amtB - amtA;
    }
    return 0;
  });

  const totalOverdueCount = isGoogleConnected ? overdueSyncedRows.length : overdueLocalItems.length;

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

    if (isSyncedRow) {
      const syncedRow = item as PaymentQueueRow;
      dueDate = extractDueDateFromSyncedStr(syncedRow.creditTermsAndDueDate);
      const linesSup = syncedRow.supplierInvoiceInfo.split('\n');
      supplierName = linesSup[0] || 'Supplier';
      invoiceNo = linesSup[1] || syncedRow.invoiceId;
      amount = parseFloat(syncedRow.invoiceAmount.replace(/[^0-9.]/g, '')) || 0;

      await updatePaymentInSheets(
        syncedRow.matchId,
        syncedRow.invoiceId,
        'Scheduled',
        sgDate,
        'Schedule Payment Date'
      );
    } else {
      const localItem = item as PaymentItem;
      dueDate = localItem.dueDate;
      supplierName = localItem.supplierName;
      invoiceNo = localItem.invoiceNo;
      amount = localItem.amount;

      const result = setPaymentDate(localItem.id, sgDate);
      if (result.emailNotice) {
        setEmailModalNotice(result.emailNotice);
      }
    }

    addAuditLog(
      'payment_schedule',
      `Scheduled overdue payment for invoice ${invoiceNo} (${supplierName}) to ${sgDate}. Due Date was ${dueDate}.`,
      { invoiceNo, supplierName, scheduledDate: sgDate, originalDueDate: dueDate }
    );
  };

  return (
    <div className="space-y-6 pb-8">
      
      {/* Live Google Sheets Integration Banner */}
      <GoogleSheetsSyncBanner />

      {/* Overdue Payments Header Banner */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 flex items-start gap-4 text-slate-900 shadow-2xs">
        <AlertCircle className="w-6 h-6 text-slate-700 shrink-0 mt-0.5" />
        <div>
          <div className="flex items-center gap-2">
            <h2 className="font-bold text-lg text-slate-900">Overdue Payments Directory</h2>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-slate-100 text-slate-800 border border-slate-200">
              {totalOverdueCount} Overdue
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1 leading-relaxed max-w-3xl">
            The invoices listed below have passed their invoice due date. Schedule a payment date immediately or send an email notice to notify the supplier.
          </p>
        </div>
      </div>

      {/* Search and Filters Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex flex-col md:flex-row items-center justify-between gap-4 text-xs">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search overdue invoices, suppliers..."
            className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-xl bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900 font-medium text-slate-900"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          <div className="flex items-center gap-1.5">
            <ArrowUpDown className="w-3.5 h-3.5 text-slate-500" />
            <span className="text-slate-500 font-medium">Sort By:</span>
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

      {/* Overdue Payments Data Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left border-collapse">
            <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200 uppercase tracking-wider text-[11px]">
              <tr>
                <th className="p-3.5">Supplier / Invoice Info</th>
                <th className="p-3.5">3-Way Match Ref (PO / GRN)</th>
                <th className="p-3.5 text-right">Invoice Amount</th>
                <th className="p-3.5">DUE DATE</th>
                <th className="p-3.5">Overdue Status</th>
                <th className="p-3.5">Payment Date Scheduling</th>
                <th className="p-3.5 text-center">Actions</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-200">
              {isGoogleConnected ? (
                overdueSyncedRows.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-slate-500 font-mono">
                      No overdue payments found matching filter criteria in live Google Sheet.
                    </td>
                  </tr>
                ) : (
                  overdueSyncedRows.map((row) => {
                    const rowKeyId = row.matchId || row.invoiceId;
                    const dueDateStr = extractDueDateFromSyncedStr(row.creditTermsAndDueDate);
                    const daysOverdue = getDaysOverdue(dueDateStr, simulatedDate);

                    return (
                      <tr
                        key={rowKeyId}
                        id={`row-${rowKeyId}`}
                        className="hover:bg-slate-50/80 transition-colors"
                      >
                        <td className="p-3.5 font-mono whitespace-pre-line text-slate-900 font-medium">
                          <div className="font-bold font-sans text-sm text-slate-900 mb-0.5">
                            {row.supplierInvoiceInfo.split('\n')[0]}
                          </div>
                          <div className="text-slate-600 font-semibold text-xs">
                            {row.supplierInvoiceInfo.split('\n').slice(1).join('\n')}
                          </div>
                        </td>

                        <td className="p-3.5 font-mono text-slate-700 whitespace-pre-line">
                          {row.threeWayMatchRef}
                        </td>

                        <td className="p-3.5 text-right font-mono font-bold text-sm text-slate-900">
                          {row.invoiceAmount}
                        </td>

                        <td className="p-3.5 font-mono font-medium">
                          <div className="font-semibold text-slate-900">{formatDueDateDisplay(row.creditTermsAndDueDate)}</div>
                          {daysOverdue > 0 && (
                            <span className="text-[10px] font-bold text-slate-600 block mt-0.5">
                              {daysOverdue} days past due date
                            </span>
                          )}
                        </td>

                        <td className="p-3.5">
                          <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-slate-100 text-slate-800 border border-slate-200 inline-flex items-center gap-1">
                            <AlertCircle className="w-3 h-3 text-slate-700" />
                            Overdue
                          </span>
                        </td>

                        <td className="p-3.5">
                          <div className="flex items-center gap-2">
                            <SGDatePicker
                              value={selectedDates[row.matchId] || toInputDateFormat(simulatedDate)}
                              onChange={(val) => setSelectedDates((prev) => ({ ...prev, [row.matchId]: val }))}
                              className="w-36 text-xs"
                            />
                            <button
                              onClick={() => handleInitiatePaymentDateForSynced(row)}
                              className="px-2.5 py-1.5 text-xs font-semibold bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
                            >
                              Schedule
                            </button>
                          </div>
                        </td>

                        <td className="p-3.5 text-center">
                          <button
                            onClick={() => handleInitiatePaymentDateForSynced(row)}
                            className="px-2 py-1 text-[11px] font-semibold text-slate-800 bg-white hover:bg-slate-50 rounded border border-slate-300 cursor-pointer"
                          >
                            Resolve Overdue
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )
              ) : overdueLocalItems.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-500 font-mono">
                    No overdue payments currently pending in local state.
                  </td>
                </tr>
              ) : (
                overdueLocalItems.map((item) => {
                  const creditTermDueDate = calculateCreditTermDueDate(item.invoiceDate, item.creditTermsDays, item.dueDate);
                  const daysOverdue = getDaysOverdue(creditTermDueDate, simulatedDate);

                  return (
                    <tr key={item.id} id={`row-${item.id}`} className="hover:bg-slate-50/80 transition-colors">
                      <td className="p-3.5">
                        <div className="font-bold text-slate-900">{item.supplierName}</div>
                        <div className="text-xs font-mono text-slate-500">Inv: {item.invoiceNo}</div>
                      </td>

                      <td className="p-3.5 font-mono text-slate-600">
                        <div>PO: {item.poNo}</div>
                        <div>GRN: {item.grnNo}</div>
                      </td>

                      <td className="p-3.5 text-right font-mono font-bold text-sm text-slate-900">
                        {formatSGD(item.amount)}
                      </td>

                      <td className="p-3.5 font-mono">
                        <div className="font-semibold text-slate-900 font-bold">
                          {creditTermDueDate ? `Due: ${creditTermDueDate}` : 'Due Date Unavailable'}
                        </div>
                        {daysOverdue > 0 && (
                          <span className="text-[10px] font-bold text-slate-600 block mt-0.5">
                            {daysOverdue} days past due
                          </span>
                        )}
                      </td>

                      <td className="p-3.5">
                        <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-slate-100 text-slate-800 border border-slate-200 inline-flex items-center gap-1">
                          <AlertCircle className="w-3 h-3 text-slate-700" />
                          Overdue
                        </span>
                      </td>

                      <td className="p-3.5">
                        <div className="flex items-center gap-2">
                          <SGDatePicker
                            value={selectedDates[item.id] || toInputDateFormat(simulatedDate)}
                            onChange={(val) => setSelectedDates((prev) => ({ ...prev, [item.id]: val }))}
                            className="w-36 text-xs"
                          />
                          <button
                            onClick={() => handleInitiatePaymentDateForLocal(item)}
                            className="px-2.5 py-1.5 text-xs font-semibold bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
                          >
                            Schedule
                          </button>
                        </div>
                      </td>

                      <td className="p-3.5 text-center">
                        <button
                          onClick={() => handleInitiatePaymentDateForLocal(item)}
                          className="px-2 py-1 text-[11px] font-semibold text-slate-800 bg-white hover:bg-slate-50 rounded border border-slate-300 cursor-pointer"
                        >
                          Resolve Overdue
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Confirmation Modal */}
      <ConfirmModal
        isOpen={Boolean(confirmModalItem)}
        title="Schedule Payment Date"
        message={
          confirmModalItem ? (
            <span>
              Are you sure you want to schedule payment date to{' '}
              <strong>{formatSGDate(confirmModalItem.rawInputDate)}</strong> for overdue invoice?
            </span>
          ) : ''
        }
        confirmText="Schedule Payment"
        cancelText="Cancel"
        confirmVariant="primary"
        onConfirm={handleConfirmSetDate}
        onCancel={() => setConfirmModalItem(null)}
      />

      {/* Email Notice Modal */}
      {emailModalNotice && (
        <EmailNoticeModal
          isOpen={Boolean(emailModalNotice)}
          notice={emailModalNotice}
          onSend={(record) => {
            addEmailNoticeRecord(record);
            setEmailModalNotice(null);
          }}
          onClose={() => setEmailModalNotice(null)}
        />
      )}
    </div>
  );
};
