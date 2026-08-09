import React, { useState } from 'react';
import {
  AlertOctagon,
  FileCheck,
  RefreshCw,
  Search,
  CheckCircle,
  AlertTriangle,
  ArrowRight,
  ShieldAlert,
  XCircle,
  HelpCircle,
  Check,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { ConfirmModal } from '../components/ConfirmModal';
import { PaymentItem } from '../types';
import { formatSGD, parseDate } from '../utils/formatters';

export const FlaggedAnomaliesPage: React.FC = () => {
  const {
    paymentItems,
    actionAnomaly,
    resolveAnomaly,
    setCurrentPage,
    currentUser,
  } = useApp();

  const [searchTerm, setSearchTerm] = useState('');

  // Modal recovery action state for Credit Note / Refund Request
  const [selectedItem, setSelectedItem] = useState<PaymentItem | null>(null);
  const [actionType, setActionType] = useState<'credit_note' | 'refund_request' | null>(null);
  const [reasonText, setReasonText] = useState<string>('');

  // Modal state for Pre-Payment Anomaly Resolution
  const [resolutionItem, setResolutionItem] = useState<PaymentItem | null>(null);
  const [resolutionType, setResolutionType] = useState<'adjust_amount' | 'cancel_duplicate' | 'approve_override'>('adjust_amount');
  const [overrideNotes, setOverrideNotes] = useState<string>('');

  // Filter for PAYMENT-STAGE anomalies only
  const flaggedItems = paymentItems
    .filter(
      (p) => p.anomaly && p.anomaly !== 'none'
    )
    .sort((a, b) => {
      const dateA = parseDate(a.invoiceDate) || parseDate(a.dueDate);
      const dateB = parseDate(b.invoiceDate) || parseDate(b.dueDate);
      const timeA = dateA ? dateA.getTime() : 0;
      const timeB = dateB ? dateB.getTime() : 0;
      return timeA - timeB;
    });

  const filteredItems = flaggedItems.filter((item) => {
    return (
      item.invoiceNo.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.supplierName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.id.toLowerCase().includes(searchTerm.toLowerCase())
    );
  });

  const getAnomalyTypeLabel = (anomaly: string) => {
    switch (anomaly) {
      case 'duplicate_payment':
      case 'duplicate':
        return 'Possible Duplicate Payment';
      case 'amount_exceeded':
      case 'incorrect_amount':
      case 'overpayment':
        return 'Payment Amount Exceeds Approved Invoice Amount';
      case 'multiple_active_records':
        return 'Multiple Payment Records Detected';
      default:
        return 'Payment Stage Anomaly';
    }
  };

  const handleOpenAction = (item: PaymentItem, type: 'credit_note' | 'refund_request') => {
    setSelectedItem(item);
    setActionType(type);

    if (item.anomaly === 'duplicate_payment' || item.anomaly === 'duplicate') {
      setReasonText(`Duplicate payment recovery request for Invoice ${item.invoiceNo} (${item.supplierName}). Previous payment ref: ${item.previousPaymentRef || 'Prior Payment'}.`);
    } else if (item.anomaly === 'amount_exceeded' || item.anomaly === 'incorrect_amount' || item.anomaly === 'overpayment') {
      const approved = item.approvedInvoiceAmount || item.matchedPoAmount;
      const diff = item.amount - approved;
      setReasonText(`Payment amount over-billed/paid recovery: Billed S$${item.amount.toFixed(2)} vs Approved INVOICES total S$${approved.toFixed(2)} (Overpayment S$${diff.toFixed(2)}).`);
    } else {
      setReasonText(`Payment stage anomaly recovery action for Invoice ${item.invoiceNo} (${item.supplierName}).`);
    }
  };

  const handleConfirmAction = () => {
    if (!selectedItem || !actionType) return;

    actionAnomaly(selectedItem.id, actionType, reasonText);
    setSelectedItem(null);
    setActionType(null);

    setTimeout(() => {
      if (confirm(`Your ${actionType === 'credit_note' ? 'Credit Note' : 'Refund'} request has been submitted. Status set to Pending Approval. Would you like to view it on the Credit Notes & Refunds page now?`)) {
        setCurrentPage('credit-notes');
      }
    }, 200);
  };

  const handleOpenResolution = (item: PaymentItem) => {
    setResolutionItem(item);
    if (item.anomaly === 'amount_exceeded' || item.anomaly === 'incorrect_amount' || item.anomaly === 'overpayment') {
      setResolutionType('adjust_amount');
    } else if (item.anomaly === 'duplicate_payment' || item.anomaly === 'duplicate' || item.anomaly === 'multiple_active_records') {
      setResolutionType('cancel_duplicate');
    } else {
      setResolutionType('approve_override');
    }
    setOverrideNotes('');
  };

  const handleConfirmResolution = () => {
    if (!resolutionItem) return;

    resolveAnomaly(resolutionItem.id, resolutionType, {
      newAmount: resolutionItem.approvedInvoiceAmount || resolutionItem.matchedPoAmount,
      notes: overrideNotes,
    });

    setResolutionItem(null);
  };

  return (
    <div className="space-y-6 pb-8">
      {/* Header */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <AlertOctagon className="w-5 h-5 text-slate-800" />
            <span>Flagged Payment-Stage Anomalies</span>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-800 border border-slate-200 font-mono">
              {flaggedItems.length} Detected
            </span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Detects payment-stage anomalies (Duplicate Payments, Amount Exceeding Approved Invoice Total, and Multiple Active Queue Records). Pre-payment anomalies are held automatically before payout.
          </p>
        </div>

        <button
          onClick={() => setCurrentPage('credit-notes')}
          className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs rounded-lg border border-slate-900 flex items-center gap-1.5 transition-colors self-start md:self-auto cursor-pointer"
        >
          <FileCheck className="w-4 h-4 text-white" />
          <span>View Credit Notes & Refunds</span>
        </button>
      </div>

      {/* Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search flagged payment records by invoice number, supplier, or invoice ID..."
            className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-slate-900 text-slate-900"
          />
        </div>
      </div>

      {/* Flagged Items Grid */}
      <div className="space-y-4">
        {filteredItems.length === 0 ? (
          <div className="bg-white p-8 text-center rounded-2xl border border-slate-200 text-slate-500 text-xs space-y-2">
            <CheckCircle className="w-8 h-8 text-slate-700 mx-auto" />
            <p className="font-semibold text-slate-800 text-sm">Zero Payment-Stage Anomalies Flagged!</p>
            <p className="text-slate-500">All active payment queue items match approved invoice totals with no duplicate payment attempts or multiple queue entries.</p>
          </div>
        ) : (
          filteredItems.map((item) => {
            const approvedAmount = item.approvedInvoiceAmount || item.matchedPoAmount;
            const diffAmount = item.amount - approvedAmount;
            const isPrePayment = item.status !== 'completed' && !item.isDiscoveredAfterPayment;

            return (
              <div
                key={item.id}
                className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs hover:shadow-md transition-all space-y-4"
              >
                {/* Header row */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-slate-900 text-white">
                        {getAnomalyTypeLabel(item.anomaly)}
                      </span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                        {isPrePayment ? 'On Hold – Anomaly Review' : 'Discovered Post-Payment'}
                      </span>
                      <span className="font-mono text-xs text-slate-500">ID: {item.id}</span>
                    </div>
                    <h3 className="font-bold text-slate-900 text-base mt-1.5">
                      {item.supplierName}
                    </h3>
                  </div>

                  <div className="text-left sm:text-right font-mono">
                    <span className="text-[11px] text-slate-500 block">Proposed / Paid Payment:</span>
                    <p className="text-lg font-bold text-slate-900">
                      {formatSGD(item.amount)}
                    </p>
                  </div>
                </div>

                {/* Plain-language Reason & Payment Details */}
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-xs space-y-3">
                  <div className="flex items-start gap-2 text-slate-900">
                    <AlertTriangle className="w-4 h-4 text-slate-700 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold text-slate-900">Reason Flagged:</span>
                      <p className="mt-0.5 text-slate-700 leading-relaxed">
                        {item.anomalyReason || 'Payment activity requires review.'}
                      </p>
                    </div>
                  </div>

                  {/* Specific Metric Breakdown */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3 border-t border-slate-200 text-slate-800">
                    <div>
                      <span className="text-[10px] text-slate-500 uppercase font-semibold block">Invoice Number / ID</span>
                      <p className="font-mono font-bold text-slate-900">{item.invoiceNo}</p>
                    </div>

                    <div>
                      <span className="text-[10px] text-slate-500 uppercase font-semibold block">Approved Invoice Amount</span>
                      <p className="font-mono font-bold text-slate-900">{formatSGD(approvedAmount)}</p>
                    </div>

                    <div>
                      <span className="text-[10px] text-slate-500 uppercase font-semibold block">
                        {item.anomaly === 'amount_exceeded' || item.anomaly === 'incorrect_amount' || item.anomaly === 'overpayment'
                          ? 'Amount Discrepancy'
                          : 'Previous Payment Record'}
                      </span>
                      <p className="font-mono font-bold text-slate-900">
                        {item.anomaly === 'amount_exceeded' || item.anomaly === 'incorrect_amount' || item.anomaly === 'overpayment'
                          ? `Exceeds by +${formatSGD(diffAmount > 0 ? diffAmount : 0)}`
                          : item.previousPaymentDate
                          ? `Paid on ${item.previousPaymentDate}`
                          : 'Duplicate Queue Entry'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Actions Bar */}
                <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3">
                  <div className="text-xs text-slate-500">
                    {isPrePayment
                      ? 'Pre-payment anomaly detected before payout. Resolve the anomaly or initiate recovery:'
                      : 'Post-payment anomaly detected. Initiate recovery action below:'}
                  </div>

                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    {isPrePayment && (
                      <button
                        onClick={() => handleOpenResolution(item)}
                        className="flex-1 sm:flex-initial px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs rounded-lg shadow-2xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <ShieldAlert className="w-4 h-4 text-white" />
                        <span>Resolve Anomaly</span>
                      </button>
                    )}

                    <button
                      onClick={() => handleOpenAction(item, 'credit_note')}
                      className="flex-1 sm:flex-initial px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-900 font-semibold text-xs rounded-lg border border-slate-300 shadow-2xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <FileCheck className="w-4 h-4 text-slate-700" />
                      <span>Request Credit Note</span>
                    </button>

                    <button
                      onClick={() => handleOpenAction(item, 'refund_request')}
                      className="flex-1 sm:flex-initial px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-900 font-semibold text-xs rounded-lg border border-slate-300 shadow-2xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <RefreshCw className="w-4 h-4 text-slate-700" />
                      <span>Request Refund</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Modal: Resolve Anomaly (Pre-Payment) */}
      {resolutionItem && (
        <ConfirmModal
          isOpen={true}
          title={`Resolve Payment-Stage Anomaly: ${resolutionItem.invoiceNo}`}
          confirmText="Confirm Anomaly Resolution"
          cancelText="Cancel"
          confirmVariant="primary"
          message={
            <div className="space-y-4">
              <p className="text-xs text-slate-600">
                Choose a resolution action to clear the anomaly hold on <strong>{resolutionItem.supplierName}</strong> (Invoice <strong>{resolutionItem.invoiceNo}</strong>):
              </p>

              <div className="space-y-2">
                {(resolutionItem.anomaly === 'amount_exceeded' || resolutionItem.anomaly === 'incorrect_amount' || resolutionItem.anomaly === 'overpayment') && (
                  <label className="flex items-start gap-2.5 p-3 border border-slate-200 rounded-xl hover:bg-slate-50 cursor-pointer text-xs">
                    <input
                      type="radio"
                      name="resType"
                      checked={resolutionType === 'adjust_amount'}
                      onChange={() => setResolutionType('adjust_amount')}
                      className="mt-0.5 text-slate-900 focus:ring-slate-900"
                    />
                    <div>
                      <span className="font-bold text-slate-900 block">Adjust Payment Amount to Approved Total</span>
                      <p className="text-slate-500 mt-0.5">
                        Adjust proposed payment from {formatSGD(resolutionItem.amount)} to approved INVOICES worksheet total of {formatSGD(resolutionItem.approvedInvoiceAmount || resolutionItem.matchedPoAmount)}. Releases payment hold.
                      </p>
                    </div>
                  </label>
                )}

                {(resolutionItem.anomaly === 'duplicate_payment' || resolutionItem.anomaly === 'duplicate' || resolutionItem.anomaly === 'multiple_active_records') && (
                  <label className="flex items-start gap-2.5 p-3 border border-slate-200 rounded-xl hover:bg-slate-50 cursor-pointer text-xs">
                    <input
                      type="radio"
                      name="resType"
                      checked={resolutionType === 'cancel_duplicate'}
                      onChange={() => setResolutionType('cancel_duplicate')}
                      className="mt-0.5 text-slate-900 focus:ring-slate-900"
                    />
                    <div>
                      <span className="font-bold text-slate-900 block">Cancel / Remove Duplicate Queue Record</span>
                      <p className="text-slate-500 mt-0.5">
                        Removes this duplicate payment queue record from active queue to prevent double payment.
                      </p>
                    </div>
                  </label>
                )}

                <label className="flex items-start gap-2.5 p-3 border border-slate-200 rounded-xl hover:bg-slate-50 cursor-pointer text-xs">
                  <input
                    type="radio"
                    name="resType"
                    checked={resolutionType === 'approve_override'}
                    onChange={() => setResolutionType('approve_override')}
                    className="mt-0.5 text-slate-900 focus:ring-slate-900"
                  />
                  <div>
                    <span className="font-bold text-slate-900 block">Manager Override & Release Hold</span>
                    <p className="text-slate-500 mt-0.5">
                      Confirm that the payment details are verified and authorized to proceed as scheduled.
                    </p>
                  </div>
                </label>
              </div>

              {resolutionType === 'approve_override' && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Manager Override Justification Notes:
                  </label>
                  <textarea
                    value={overrideNotes}
                    onChange={(e) => setOverrideNotes(e.target.value)}
                    placeholder="Enter reason for approving payment despite anomaly flag..."
                    rows={2}
                    className="w-full p-2 text-xs border border-slate-300 rounded-lg text-slate-900 focus:ring-2 focus:ring-slate-900 font-sans"
                  />
                </div>
              )}
            </div>
          }
          onConfirm={handleConfirmResolution}
          onCancel={() => setResolutionItem(null)}
        />
      )}

      {/* Confirmation Dialog for Credit Note / Refund Request */}
      {selectedItem && actionType && (
        <ConfirmModal
          isOpen={true}
          title={`Confirm Submission: ${actionType === 'credit_note' ? 'Request Credit Note' : 'Request Refund'}`}
          confirmText={`Submit ${actionType === 'credit_note' ? 'Credit Note Request' : 'Refund Request'}`}
          cancelText="Cancel"
          confirmVariant="primary"
          message={
            <div className="space-y-3">
              <p className="text-xs text-slate-700">
                Submit a formal <strong>{actionType === 'credit_note' ? 'Request Credit Note' : 'Request Refund'}</strong> for Invoice <strong>{selectedItem.invoiceNo}</strong> ({selectedItem.supplierName})?
              </p>

              <div className="p-2.5 bg-slate-100 border border-slate-200 rounded-lg text-xs text-slate-800 font-medium">
                The request will be recorded with Approval Status set to <strong>Pending Approval</strong>. Human confirmation remains required before recording receipt.
              </div>

              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs space-y-1 font-mono">
                <div>Requested Amount: <strong>{formatSGD(selectedItem.amount)}</strong></div>
                <div>Invoice Reference: <strong>{selectedItem.invoiceNo}</strong></div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Recovery Request Reason / Justification:
                </label>
                <textarea
                  value={reasonText}
                  onChange={(e) => setReasonText(e.target.value)}
                  rows={3}
                  className="w-full p-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 font-sans text-slate-900"
                />
              </div>
            </div>
          }
          onConfirm={handleConfirmAction}
          onCancel={() => {
            setSelectedItem(null);
            setActionType(null);
          }}
        />
      )}
    </div>
  );
};
