import React, { useState } from 'react';
import {
  Clock,
  CheckCircle2,
  AlertCircle,
  Calendar,
  User,
  X,
  FileCheck,
  Building2,
  Sparkles,
  Save,
} from 'lucide-react';
import { CreditNoteRefund } from '../types';
import { useApp } from '../context/AppContext';
import { formatSGD, toInputDateFormat, formatSGDate } from '../utils/formatters';
import { SGDatePicker } from './SGDatePicker';

interface CreditNoteFollowUpModalProps {
  isOpen: boolean;
  document: CreditNoteRefund;
  onClose: () => void;
}

export const CreditNoteFollowUpModal: React.FC<CreditNoteFollowUpModalProps> = ({
  isOpen,
  document: doc,
  onClose,
}) => {
  const { updateCreditNoteFollowUp } = useApp();

  const [approvalStatus, setApprovalStatus] = useState<
    'approved' | 'pending_approval' | 'rejected' | 'under_review'
  >(doc.approvalStatus || 'pending_approval');

  const [expectedDateInput, setExpectedDateInput] = useState<string>(
    doc.expectedReceiptDate ? toInputDateFormat(doc.expectedReceiptDate) : '2026-08-05'
  );

  const [savedSuccess, setSavedSuccess] = useState(false);

  if (!isOpen) return null;

  const isCN = doc.type === 'credit_note';

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const formattedSGDate = formatSGDate(expectedDateInput);
    updateCreditNoteFollowUp(doc.id, approvalStatus, formattedSGDate);
    setSavedSuccess(true);
    setTimeout(() => {
      setSavedSuccess(false);
      onClose();
    }, 1200);
  };

  const defaultActions = doc.assignedActions || [
    {
      id: 'ACT-1',
      step: 'Document Creation & Supplier Transmission',
      assignedTo: doc.createdBy || 'Accounts Dept',
      status: 'completed' as const,
      updatedAt: doc.issueDate,
      notes: `Generated ${doc.docNumber} against Ref Invoice ${doc.invoiceNo}`,
    },
    {
      id: 'ACT-2',
      step: `${isCN ? 'Credit Note' : 'Refund'} Approval & Acknowledgement`,
      assignedTo: `${doc.supplierName} Accounts`,
      status: approvalStatus === 'approved' ? ('completed' as const) : ('in_progress' as const),
      updatedAt: doc.approvedDate || doc.issueDate,
      notes: doc.approvedBy
        ? `Approved by ${doc.approvedBy}`
        : 'Pending formal supplier acknowledgement',
    },
    {
      id: 'ACT-3',
      step: `Expected Date ${isCN ? 'Credit Offset' : 'Refund Funds'} Received`,
      assignedTo: 'Finance Operations',
      status: 'in_progress' as const,
      notes: `Target receipt date: ${doc.expectedReceiptDate || formatSGDate(expectedDateInput)}`,
    },
  ];

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden border border-slate-200">
        
        {/* Modal Header */}
        <div className="p-5 bg-slate-50 border-b border-slate-200 text-slate-900 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-slate-100 text-slate-800 rounded-xl border border-slate-200">
              <Clock className="w-5 h-5 text-slate-700" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-base text-slate-900">
                  Follow-Up & Action Tracker
                </h3>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-slate-100 text-slate-800 border border-slate-200">
                  {isCN ? 'Credit Note' : 'Refund Request'}
                </span>
              </div>
              <p className="text-xs text-slate-600 font-mono mt-0.5 font-medium">
                Doc: <span className="font-bold text-slate-900">{doc.docNumber}</span> | Ref Inv: {doc.invoiceNo}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 p-1 rounded-lg hover:bg-slate-200/60 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSave} className="p-6 space-y-6">
          
          {/* Document Summary Card */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div>
              <span className="text-slate-400 block font-medium text-[11px]">Supplier:</span>
              <span className="font-bold text-slate-800 truncate block">{doc.supplierName}</span>
            </div>
            <div>
              <span className="text-slate-400 block font-medium text-[11px]">Recovery Amount:</span>
              <span className="font-mono font-bold text-slate-900 text-sm">{formatSGD(doc.amount)}</span>
            </div>
            <div>
              <span className="text-slate-400 block font-medium text-[11px]">Issued Date:</span>
              <span className="font-mono text-slate-700">{doc.issueDate}</span>
            </div>
            <div>
              <span className="text-slate-400 block font-medium text-[11px]">Created By:</span>
              <span className="text-slate-700 font-medium truncate block">{doc.createdBy}</span>
            </div>
          </div>

          {/* Key Status Form Fields */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            
            {/* Approval Status Field */}
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2">
              <label className="block text-xs font-bold text-slate-800 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-slate-700" />
                  Approval Status:
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-slate-200 text-slate-800 border border-slate-300">
                  {approvalStatus === 'approved' ? 'Approved' : approvalStatus === 'rejected' ? 'Rejected' : 'Pending Approval'}
                </span>
              </label>

              <select
                value={approvalStatus}
                onChange={(e) => setApprovalStatus(e.target.value as any)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-semibold bg-white focus:ring-2 focus:ring-slate-900 text-slate-900"
              >
                <option value="pending_approval">Pending Approval</option>
                <option value="approved">Approved (Authorised Approver / Supplier)</option>
                <option value="rejected">Rejected (Disputed / Denied)</option>
                <option value="under_review">Under Review / Negotiation</option>
              </select>

              {doc.approvedBy && (
                <p className="text-[11px] text-slate-500 font-medium pt-1">
                  Approved by: <strong className="text-slate-700">{doc.approvedBy}</strong> on {doc.approvedDate || doc.issueDate}
                </p>
              )}
            </div>

            {/* Expected Receipt Date Field */}
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2">
              <label className="block text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-slate-700" />
                Expected Receipt Date (DD/MM/YYYY):
              </label>

              <SGDatePicker
                value={expectedDateInput}
                onChange={(_, rawIso) => setExpectedDateInput(rawIso)}
                className="w-full"
              />

              <p className="text-[11px] text-slate-500">
                Expected receipt date in Singapore format: <strong className="text-slate-900 font-mono">{formatSGDate(expectedDateInput)}</strong>
              </p>
            </div>

          </div>

          {/* Assigned Actions & Timeline */}
          <div className="space-y-3">
            <h4 className="font-bold text-xs text-slate-800 uppercase tracking-wider flex items-center gap-1.5 border-b border-slate-200 pb-2">
              <Sparkles className="w-4 h-4 text-slate-700" />
              <span>Assigned Actions & Follow-Up Timeline</span>
            </h4>

            <div className="space-y-3">
              {defaultActions.map((act, index) => (
                <div
                  key={act.id}
                  className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-start gap-3 text-xs"
                >
                  <div
                    className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs shrink-0 mt-0.5 ${
                      act.status === 'completed'
                        ? 'bg-slate-200 text-slate-800 border border-slate-300'
                        : 'bg-slate-100 text-slate-700 border border-slate-200'
                    }`}
                  >
                    {act.status === 'completed' ? '✓' : index + 1}
                  </div>

                  <div className="flex-1 space-y-0.5">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-900">{act.step}</span>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                          act.status === 'completed'
                            ? 'bg-slate-200 text-slate-800'
                            : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {act.status === 'completed' ? 'Action Completed' : 'In Progress'}
                      </span>
                    </div>

                    <p className="text-[11px] text-slate-600 font-medium">
                      Assigned To: <strong className="text-slate-800">{act.assignedTo}</strong>
                    </p>

                    {act.notes && (
                      <p className="text-[11px] text-slate-500 italic bg-white p-2 rounded border border-slate-200/80 mt-1">
                        "{act.notes}"
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Action Footer */}
          <div className="pt-3 border-t border-slate-200 flex items-center justify-between">
            {savedSuccess ? (
              <span className="text-slate-900 text-xs font-bold flex items-center gap-1">
                <CheckCircle2 className="w-4 h-4 text-slate-700" />
                Follow-up details saved successfully!
              </span>
            ) : (
              <span className="text-slate-400 text-[11px]">
                Updates will be logged in system audit trail.
              </span>
            )}

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-xl transition-colors cursor-pointer"
              >
                Close
              </button>

              <button
                type="submit"
                className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs rounded-xl shadow-2xs flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Save className="w-4 h-4" />
                <span>Save Follow-Up Status</span>
              </button>
            </div>
          </div>

        </form>

      </div>
    </div>
  );
};
