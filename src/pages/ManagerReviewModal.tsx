import React, { useState } from 'react';
import {
  X,
  Lock,
  Sparkles,
  FileText,
  PackageCheck,
  Receipt,
  Mail,
  CheckCircle,
  PauseCircle,
  Clock,
  Send,
  AlertTriangle,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { ConfirmModal } from '../components/ConfirmModal';
import { PaymentItem } from '../types';
import { formatSGD } from '../utils/formatters';

interface ManagerReviewModalProps {
  isOpen: boolean;
  item: PaymentItem | null;
  onClose: () => void;
}

export const ManagerReviewModal: React.FC<ManagerReviewModalProps> = ({
  isOpen,
  item,
  onClose,
}) => {
  const {
    settings,
    suppliers,
    managerOverride,
    getSupplierById,
    getSupplierByName,
    currentUser,
  } = useApp();

  const [confirmAction, setConfirmAction] = useState<'on_hold' | 'scheduled' | 'pending' | null>(null);
  const [overrideReason, setOverrideReason] = useState<string>('Reviewed 3-way match and treasury liquidity.');
  const [showSupplierEmailModal, setShowSupplierEmailModal] = useState<boolean>(false);
  const [followUpReason, setFollowUpReason] = useState<string>('Clarification on Invoice / PO Discrepancy');
  const [followUpCustomReason, setFollowUpCustomReason] = useState<string>('');
  const [emailSubject, setEmailSubject] = useState<string>('');
  const [emailBody, setEmailBody] = useState<string>('');

  if (!isOpen || !item) return null;

  const supplier = getSupplierById(item.supplierId) || getSupplierByName(item.supplierName);
  const supplierEmail = supplier?.email || 'accounts@supplier.com.sg';

  const bankBalance = settings.bankBalance;
  const buffer = settings.cashBuffer;
  const availableLiquidity = bankBalance - buffer;

  const FOLLOW_UP_REASONS = [
    'Clarification on Invoice / PO Discrepancy',
    'Request Updated Statement of Accounts',
    'Notification of Payment Holding / Cash Flow Schedule',
    'Request Missing Supporting GRN / Delivery Documents',
    'Others',
  ];

  const buildFollowUpContent = (reason: string, customText: string) => {
    const senderName = currentUser?.name || 'Mdm Lim';
    const senderTitle = currentUser?.title || 'Accounts Executive';
    const recipient = supplier?.contactPerson || 'Accounts Team';

    let subj = `Follow-Up regarding Invoice ${item.invoiceNo} (PO ${item.poNo})`;
    let body = '';

    if (reason === 'Clarification on Invoice / PO Discrepancy') {
      subj = `Follow-Up: Clarification required for Invoice ${item.invoiceNo} (PO ${item.poNo})`;
      body =
`Dear ${recipient},

This is ${senderName} (${senderTitle}) following up regarding Invoice ${item.invoiceNo} for ${formatSGD(item.amount)}.

During our 3-way match verification, we noticed a discrepancy between the PO (${item.poNo}) and Invoice details. We kindly request your assistance in clarifying the line item pricing and quantities.

Please review and reply with updated details or a revised invoice at your earliest convenience.

Best regards,
${senderName}
${senderTitle}`;
    } else if (reason === 'Request Updated Statement of Accounts') {
      subj = `Follow-Up: Statement of Accounts request for Invoice ${item.invoiceNo}`;
      body =
`Dear ${recipient},

This is ${senderName} (${senderTitle}) following up regarding Invoice ${item.invoiceNo} for ${formatSGD(item.amount)}.

Could you please provide an updated Statement of Accounts (SOA) for our finance team to reconcile outstanding balances and confirm upcoming payment schedules?

Thank you for your prompt assistance.

Best regards,
${senderName}
${senderTitle}`;
    } else if (reason === 'Notification of Payment Holding / Cash Flow Schedule') {
      subj = `Follow-Up: Payment schedule update for Invoice ${item.invoiceNo}`;
      body =
`Dear ${recipient},

This is ${senderName} (${senderTitle}) regarding Invoice ${item.invoiceNo} for ${formatSGD(item.amount)}.

Our finance department is currently reviewing payment allocations in alignment with our monthly cash flow schedule and cash buffer requirements. We will update you as soon as the payment date is confirmed.

We appreciate your patience and continued partnership.

Best regards,
${senderName}
${senderTitle}`;
    } else if (reason === 'Request Missing Supporting GRN / Delivery Documents') {
      subj = `Follow-Up: Supporting documents requested for Invoice ${item.invoiceNo} (GRN ${item.grnNo})`;
      body =
`Dear ${recipient},

This is ${senderName} (${senderTitle}) following up regarding Invoice ${item.invoiceNo} for ${formatSGD(item.amount)}.

To complete our 3-way match audit, we require signed delivery orders or supporting GRN documentation (${item.grnNo}). Please send over copies of these documents so we can proceed with payment processing.

Thank you for your support.

Best regards,
${senderName}
${senderTitle}`;
    } else {
      subj = `Follow-Up regarding Invoice ${item.invoiceNo} (PO ${item.poNo})`;
      const reasonClause = customText ? `\nReason / Notes:\n• ${customText}\n` : '';
      body =
`Dear ${recipient},

This is ${senderName} (${senderTitle}) following up regarding Invoice ${item.invoiceNo} for ${formatSGD(item.amount)}.
${reasonClause}
Please let us know if you have any questions or require additional details from our end.

Best regards,
${senderName}
${senderTitle}`;
    }

    return { subj, body };
  };

  const handleReasonChange = (newReason: string, newCustomText?: string) => {
    setFollowUpReason(newReason);
    const custom = newCustomText !== undefined ? newCustomText : followUpCustomReason;
    if (newCustomText !== undefined) setFollowUpCustomReason(newCustomText);

    const { subj, body } = buildFollowUpContent(newReason, custom);
    setEmailSubject(subj);
    setEmailBody(body);
  };

  // AI-generated reasoning logic
  let aiRecommendation = '';
  let aiBadgeColor = '';

  if (item.amount > availableLiquidity) {
    aiRecommendation = `Suggested: Put On Hold — Payment amount (${formatSGD(item.amount)}) exceeds available liquidity after cash buffer (${formatSGD(availableLiquidity)}). Executing date would breach required S$${buffer.toLocaleString()} buffer.`;
    aiBadgeColor = 'bg-amber-100 text-amber-900 border-amber-300';
  } else if (item.anomaly !== 'none') {
    aiRecommendation = `Suggested: Put On Hold — Anomaly (${item.anomaly}) detected during 3-way matching. Verify invoice discrepancy before setting payment date.`;
    aiBadgeColor = 'bg-red-100 text-red-900 border-red-300';
  } else {
    aiRecommendation = `Suggested: Initiate Payment Date — 3-Way Match verified 100% across PO, GRN, and Invoice. Funds and liquidity are sufficient after cash buffer.`;
    aiBadgeColor = 'bg-emerald-100 text-emerald-900 border-emerald-300';
  }

  const handleActionClick = (action: 'on_hold' | 'scheduled' | 'pending') => {
    setConfirmAction(action);
  };

  const handleConfirmOverride = () => {
    if (!confirmAction) return;
    managerOverride(item.id, confirmAction, overrideReason);
    setConfirmAction(null);
    onClose();
  };

  const handleFollowUpSupplier = () => {
    const { subj, body } = buildFollowUpContent(followUpReason, followUpCustomReason);
    setEmailSubject(subj);
    setEmailBody(body);
    setShowSupplierEmailModal(true);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl overflow-hidden flex flex-col max-h-[92vh]">
        
        {/* Header Bar */}
        <div className="p-5 bg-slate-50 border-b border-slate-200 text-slate-900 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-100 text-amber-800 rounded-lg border border-amber-200 font-bold">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <span>Withheld Payment Review & 3-Way Match Inspection</span>
                <span className="text-xs bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded border border-emerald-200 font-bold">
                  {currentUser?.name} Authorized
                </span>
              </h3>
              <p className="text-xs text-slate-600 font-medium">
                Invoice {item.invoiceNo} &bull; {item.supplierName}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Content Scroll Area */}
        <div className="p-6 overflow-y-auto space-y-6 text-slate-800">
          
          {/* AI Reasoning Box */}
          <div className={`p-4 rounded-xl border ${aiBadgeColor} space-y-2`}>
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider">
              <Sparkles className="w-4 h-4 text-amber-600 animate-spin" />
              <span>AI Manager Recommendation & Financial Reasoning:</span>
            </div>
            <p className="text-xs leading-relaxed font-medium">
              {aiRecommendation}
            </p>
          </div>

          {/* Cash & Liquidity Context Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 bg-slate-50 border border-slate-200 rounded-xl text-xs">
            <div>
              <span className="text-slate-500">Current Bank Balance:</span>
              <p className="font-mono font-bold text-slate-900 text-sm">{formatSGD(bankBalance)}</p>
            </div>
            <div>
              <span className="text-slate-500">Min Cash Buffer:</span>
              <p className="font-mono font-bold text-amber-700 text-sm">{formatSGD(buffer)}</p>
            </div>
            <div>
              <span className="text-slate-500">Net Available Liquidity:</span>
              <p className="font-mono font-bold text-blue-700 text-sm">{formatSGD(availableLiquidity)}</p>
            </div>
          </div>

          {/* Side-by-Side 3-Way Match Details */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-3">
              Side-by-Side 3-Way Match Verification
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              
              {/* Purchase Order (PO) */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                <div className="flex items-center gap-2 text-slate-700 font-bold text-xs border-b border-slate-200 pb-2">
                  <FileText className="w-4 h-4 text-blue-600" />
                  <span>Purchase Order (PO)</span>
                </div>
                <div className="space-y-1 text-xs">
                  <div><span className="text-slate-500">PO Number:</span> <span className="font-mono font-semibold">{item.poNo}</span></div>
                  <div><span className="text-slate-500">Approved PO Amount:</span> <span className="font-mono font-bold">{formatSGD(item.matchedPoAmount)}</span></div>
                  <div><span className="text-slate-500">Match Status:</span> <span className="text-emerald-700 font-bold">Approved</span></div>
                </div>
              </div>

              {/* Goods Receipt Note (GRN) */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                <div className="flex items-center gap-2 text-slate-700 font-bold text-xs border-b border-slate-200 pb-2">
                  <PackageCheck className="w-4 h-4 text-emerald-600" />
                  <span>Goods Receipt (GRN)</span>
                </div>
                <div className="space-y-1 text-xs">
                  <div><span className="text-slate-500">GRN Number:</span> <span className="font-mono font-semibold">{item.grnNo}</span></div>
                  <div><span className="text-slate-500">Delivered Items Value:</span> <span className="font-mono font-bold">{formatSGD(item.matchedGrnAmount)}</span></div>
                  <div><span className="text-slate-500">Warehouse Signoff:</span> <span className="text-emerald-700 font-bold">Received OK</span></div>
                </div>
              </div>

              {/* Billed Invoice */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                <div className="flex items-center gap-2 text-slate-700 font-bold text-xs border-b border-slate-200 pb-2">
                  <Receipt className="w-4 h-4 text-purple-600" />
                  <span>Supplier Invoice</span>
                </div>
                <div className="space-y-1 text-xs">
                  <div><span className="text-slate-500">Invoice Number:</span> <span className="font-mono font-semibold">{item.invoiceNo}</span></div>
                  <div><span className="text-slate-500">Billed Total:</span> <span className="font-mono font-bold text-slate-900">{formatSGD(item.amount)}</span></div>
                  <div>
                    <span className="text-slate-500">Discrepancy:</span>{' '}
                    {item.amount !== item.matchedPoAmount ? (
                      <span className="text-red-600 font-bold">
                        {formatSGD(item.amount - item.matchedPoAmount)}
                      </span>
                    ) : (
                      <span className="text-emerald-700 font-bold">0.00 (Perfect Match)</span>
                    )}
                  </div>
                </div>
              </div>

            </div>
          </div>

          {/* Supplier Info Summary */}
          <div className="p-4 bg-blue-50/60 border border-blue-200 rounded-xl text-xs space-y-1">
            <div className="flex items-center justify-between font-semibold text-blue-900">
              <span>Supplier Contact (Single Source of Truth):</span>
              <span className="font-mono text-slate-700">{supplierEmail}</span>
            </div>
            <p className="text-blue-800">
              {supplier?.name} &bull; Attn: {supplier?.contactPerson} &bull; Tel: {supplier?.phone}
            </p>
          </div>

          {/* Manager Reason Note */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Manager Decision / Audit Note
            </label>
            <input
              type="text"
              value={overrideReason}
              onChange={(e) => setOverrideReason(e.target.value)}
              placeholder="Reason for manager override decision..."
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500"
            />
          </div>

        </div>

        {/* Modal Action Bar */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
          
          <button
            type="button"
            onClick={handleFollowUpSupplier}
            className="w-full sm:w-auto px-4 py-2 bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 font-semibold text-xs rounded-lg flex items-center justify-center gap-2 transition-colors"
          >
            <Mail className="w-4 h-4 text-blue-600" />
            <span>Follow Up with Supplier</span>
          </button>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              type="button"
              onClick={() => handleActionClick('on_hold')}
              className="flex-1 sm:flex-initial px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs rounded-lg flex items-center justify-center gap-1.5 transition-colors"
            >
              <PauseCircle className="w-4 h-4" />
              <span>Put On Hold</span>
            </button>

            <button
              type="button"
              onClick={() => handleActionClick('scheduled')}
              className="flex-1 sm:flex-initial px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs rounded-lg flex items-center justify-center gap-1.5 transition-colors"
            >
              <CheckCircle className="w-4 h-4" />
              <span>Initiate Payment Date</span>
            </button>
          </div>

        </div>

      </div>

      {/* Confirmation Modal */}
      {confirmAction && (
        <ConfirmModal
          isOpen={true}
          title="Confirm Manager Override Action"
          confirmText="Confirm Manager Decision"
          cancelText="Cancel"
          confirmVariant={confirmAction === 'scheduled' ? 'success' : 'warning'}
          message={
            <p>
              Are you sure you want to <strong>{confirmAction === 'scheduled' ? 'Initiate Payment Date' : 'Put On Hold'}</strong> for Invoice <strong>{item.invoiceNo}</strong>?
            </p>
          }
          onConfirm={handleConfirmOverride}
          onCancel={() => setConfirmAction(null)}
        />
      )}

      {/* Follow Up Email Modal */}
      {showSupplierEmailModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-lg p-6 space-y-4">
            <div className="flex justify-between items-center border-b border-slate-200 pb-2">
              <h4 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                <Mail className="w-4 h-4 text-blue-600" />
                Follow Up Email to {supplier?.name}
              </h4>
              <button onClick={() => setShowSupplierEmailModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="text-xs space-y-3">
              <div>
                <span className="text-slate-500">To Email (Auto-populated from Supplier Info):</span>
                <p className="font-mono font-bold text-slate-800">{supplierEmail}</p>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Select Reason for Follow-Up</label>
                <select
                  value={followUpReason}
                  onChange={(e) => handleReasonChange(e.target.value)}
                  className="w-full p-2 border border-slate-300 rounded text-xs font-medium bg-white focus:ring-2 focus:ring-blue-500"
                >
                  {FOLLOW_UP_REASONS.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </div>

              {followUpReason === 'Others' && (
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Specify Reason / Notes</label>
                  <input
                    type="text"
                    value={followUpCustomReason}
                    onChange={(e) => handleReasonChange('Others', e.target.value)}
                    placeholder="Enter custom reason..."
                    className="w-full p-2 border border-slate-300 rounded text-xs font-medium focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              )}

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Subject</label>
                <input
                  type="text"
                  value={emailSubject}
                  onChange={(e) => setEmailSubject(e.target.value)}
                  className="w-full p-2 border border-slate-300 rounded text-xs font-medium focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Message Body (Editable)</label>
                <textarea
                  value={emailBody}
                  onChange={(e) => setEmailBody(e.target.value)}
                  rows={7}
                  className="w-full p-2 border border-slate-300 rounded text-xs font-mono leading-relaxed focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setShowSupplierEmailModal(false)}
                className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  alert(`Follow up email logged and sent to ${supplierEmail}!`);
                  setShowSupplierEmailModal(false);
                }}
                className="px-4 py-1.5 text-xs font-semibold bg-blue-600 text-white rounded hover:bg-blue-700 flex items-center gap-1.5"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Send Email (Simulated)</span>
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
