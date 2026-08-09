import React, { useState, useEffect } from 'react';
import { Mail, AlertTriangle, Send, X, CheckCircle } from 'lucide-react';
import { EmailNotice } from '../types';
import { formatSGD } from '../utils/formatters';

interface EmailNoticeModalProps {
  isOpen: boolean;
  emailNotice: EmailNotice | null;
  onSend: (finalNotice: EmailNotice) => void;
  onCancel: () => void;
}

export const EmailNoticeModal: React.FC<EmailNoticeModalProps> = ({
  isOpen,
  emailNotice,
  onSend,
  onCancel,
}) => {
  const [reason, setReason] = useState<string>('Cash flow scheduling alignment');
  const [customReason, setCustomReason] = useState<string>('');
  const [customNotes, setCustomNotes] = useState<string>('');
  const [bodyText, setBodyText] = useState<string>('');
  const [isSent, setIsSent] = useState<boolean>(false);

  const REASON_OPTIONS = [
    'Cash flow scheduling alignment',
    'Awaiting internal approval',
    'Temporary cash buffer preservation',
    'Payment batch processing schedule',
    'Supplier agreed to revised payment date',
    'Banking/public holiday delay',
    'Other',
  ];

  useEffect(() => {
    if (emailNotice) {
      updateDraft(reason, customReason, customNotes);
    }
    setIsSent(false);
  }, [emailNotice, reason, customReason, customNotes]);

  if (!isOpen || !emailNotice) return null;

  const updateDraft = (selectedReason: string, otherReasonText: string, notes: string) => {
    const activeReason = (selectedReason === 'Other' || selectedReason === 'Others') ? (otherReasonText || 'Custom delay reason') : selectedReason;
    
    const draft = 
`Dear ${emailNotice.supplierName} Accounts Team,

We are writing regarding Invoice ${emailNotice.invoiceNo} for the amount of ${formatSGD(emailNotice.amount)}, originally due on ${emailNotice.originalDueDate}.

Please be advised that our scheduled payment date has been set for ${emailNotice.proposedPaymentDate}.

Primary Reason for Schedule Adjustment:
• ${activeReason}
${notes ? `\nAdditional Notes:\n• ${notes}\n` : ''}
We appreciate your understanding and continued business partnership. Please contact us if you require further clarification.

Best regards,
Accounts Executive Team
Supplier Payment Operations`;

    setBodyText(draft);
  };

  const handleReasonChange = (newReason: string) => {
    setReason(newReason);
  };

  const handleSend = () => {
    setIsSent(true);
    setTimeout(() => {
      onSend({
        ...emailNotice,
        reason: (reason === 'Other' || reason === 'Others') ? customReason : reason,
        customNotes,
        bodyText,
      });
      setIsSent(false);
    }, 1200);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="p-5 bg-slate-50 border-b border-slate-200 flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-slate-900 text-white rounded-lg shadow-xs">
              <Mail className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-slate-900">
                Payment Delay Email Notice
              </h3>
              <p className="text-xs text-slate-600 mt-0.5">
                The scheduled payment date ({emailNotice.proposedPaymentDate}) falls after the invoice due date ({emailNotice.originalDueDate}).
              </p>
            </div>
          </div>
          <button
            onClick={onCancel}
            className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <div className="p-6 overflow-y-auto space-y-4 text-sm text-slate-700">
          <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs">
            <div>
              <span className="text-slate-500">Supplier:</span>
              <p className="font-semibold text-slate-800">{emailNotice.supplierName}</p>
            </div>
            <div>
              <span className="text-slate-500">To Email (Auto-populated):</span>
              {emailNotice.toEmail ? (
                <p className="font-mono text-slate-800">{emailNotice.toEmail}</p>
              ) : (
                <p className="font-semibold text-slate-700 flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5 text-slate-500" />
                  <span>Supplier email is unavailable.</span>
                </p>
              )}
            </div>
            <div>
              <span className="text-slate-500">Invoice No:</span>
              <p className="font-mono font-medium text-slate-800">{emailNotice.invoiceNo}</p>
            </div>
            <div>
              <span className="text-slate-500">Amount:</span>
              <p className="font-semibold text-slate-800">{formatSGD(emailNotice.amount)}</p>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Select Reason for Delay Notice
            </label>
            <select
              value={reason}
              onChange={(e) => handleReasonChange(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 text-slate-900"
            >
              {REASON_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>

          {(reason === 'Other' || reason === 'Others') && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Specify Custom Reason
              </label>
              <input
                type="text"
                value={customReason}
                onChange={(e) => setCustomReason(e.target.value)}
                placeholder="e.g. Awaiting final quality check approval..."
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 text-slate-900"
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Additional Internal / Supplier Notes (Optional)
            </label>
            <input
              type="text"
              value={customNotes}
              onChange={(e) => setCustomNotes(e.target.value)}
              placeholder="e.g. Batch payment execution on first week of August."
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 text-slate-900"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center justify-between">
              <span>Auto-Generated Email Draft (Editable)</span>
              <span className="text-[11px] text-slate-400">Can be edited before sending</span>
            </label>
            <textarea
              value={bodyText}
              onChange={(e) => setBodyText(e.target.value)}
              rows={8}
              className="w-full p-3 font-sans text-xs bg-white text-slate-900 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-900 shadow-2xs font-mono"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-100 cursor-pointer"
          >
            Cancel (Revert Schedule)
          </button>

          <button
            type="button"
            onClick={handleSend}
            disabled={isSent}
            className="px-4 py-2 text-sm font-medium text-white bg-slate-900 hover:bg-slate-800 rounded-lg shadow-xs flex items-center gap-2 cursor-pointer disabled:opacity-50"
          >
            {isSent ? (
              <>
                <CheckCircle className="w-4 h-4 text-white" />
                <span>Notice Logged & Sent!</span>
              </>
            ) : (
              <>
                <Send className="w-4 h-4 text-white" />
                <span>Send Email Notice (Simulated)</span>
              </>
            )}
          </button>
        </div>

      </div>
    </div>
  );
};
