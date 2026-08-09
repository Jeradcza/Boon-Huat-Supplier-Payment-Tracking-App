import React, { useState } from 'react';
import {
  FileCheck,
  Printer,
  Search,
  CheckCircle2,
  Clock,
  Check,
  Inbox,
  AlertCircle,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { PrintDocumentModal } from '../components/PrintDocumentModal';
import { CreditNoteFollowUpModal } from '../components/CreditNoteFollowUpModal';
import { CreditNoteRefund } from '../types';
import { formatSGD } from '../utils/formatters';

export const CreditNotesRefundsPage: React.FC = () => {
  const {
    creditNotes,
    getSupplierById,
    getSupplierByName,
    approveCreditNoteRefund,
    markCreditNoteRefundAsReceived,
  } = useApp();

  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'credit_note' | 'refund_request'>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedDoc, setSelectedDoc] = useState<CreditNoteRefund | null>(null);
  const [followUpDoc, setFollowUpDoc] = useState<CreditNoteRefund | null>(null);

  const filteredDocs = creditNotes.filter((doc) => {
    const matchesSearch =
      doc.docNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      doc.invoiceNo.toLowerCase().includes(searchTerm.toLowerCase()) ||
      doc.supplierName.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesType = typeFilter === 'all' || doc.type === typeFilter;
    const matchesStatus = statusFilter === 'all' || doc.status === statusFilter;

    return matchesSearch && matchesType && matchesStatus;
  });

  const getStatusBadge = (status: CreditNoteRefund['status']) => {
    switch (status) {
      case 'received':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-slate-100 text-slate-800 border border-slate-200">
            <CheckCircle2 className="w-3.5 h-3.5 text-slate-700" />
            <span>Received</span>
          </span>
        );
      case 'approved':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-slate-100 text-slate-800 border border-slate-200">
            <Check className="w-3.5 h-3.5 text-slate-700" />
            <span>Approved</span>
          </span>
        );
      case 'rejected':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-slate-100 text-slate-800 border border-slate-200">
            <AlertCircle className="w-3.5 h-3.5 text-slate-700" />
            <span>Rejected</span>
          </span>
        );
      case 'pending_approval':
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-slate-100 text-slate-800 border border-slate-200">
            <Clock className="w-3.5 h-3.5 text-slate-700" />
            <span>Pending Approval</span>
          </span>
        );
    }
  };

  return (
    <div className="space-y-6 pb-8">
      
      {/* Header */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-800 border border-slate-200 font-mono">
              Recovery Management
            </span>
          </div>
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <FileCheck className="w-5 h-5 text-slate-700" />
            <span>Credit Notes & Refund Requests Tracking</span>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-800 border border-slate-200 font-mono">
              {creditNotes.length} Total Requests
            </span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Track approval workflow lifecycle: <strong>Pending Approval</strong> → <strong>Approved</strong> → <strong>Received</strong>.
          </p>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search request #, invoice #, or supplier name..."
            className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-slate-900 text-slate-900"
          />
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className="text-slate-500 font-medium">Type:</span>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as any)}
              className="px-3 py-2 border border-slate-300 rounded-lg bg-white font-medium text-xs focus:ring-2 focus:ring-slate-900 text-slate-800"
            >
              <option value="all">All Request Types</option>
              <option value="credit_note">Credit Notes Only</option>
              <option value="refund_request">Refund Requests Only</option>
            </select>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-slate-500 font-medium">Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 border border-slate-300 rounded-lg bg-white font-medium text-xs focus:ring-2 focus:ring-slate-900 text-slate-800"
            >
              <option value="all">All Statuses</option>
              <option value="pending_approval">Pending Approval</option>
              <option value="approved">Approved</option>
              <option value="received">Received</option>
            </select>
          </div>
        </div>
      </div>

      {/* Main Data Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left border-collapse">
            <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200 uppercase tracking-wider text-[10px]">
              <tr>
                <th className="p-3.5">Request Type & Doc #</th>
                <th className="p-3.5">Supplier</th>
                <th className="p-3.5">Invoice #</th>
                <th className="p-3.5 text-right">Amount (SGD)</th>
                <th className="p-3.5">Current Status</th>
                <th className="p-3.5">Requested Date</th>
                <th className="p-3.5">Approved Date</th>
                <th className="p-3.5">Received Date</th>
                <th className="p-3.5">Assigned User</th>
                <th className="p-3.5">Remarks</th>
                <th className="p-3.5 text-center">Actions</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-200">
              {filteredDocs.length === 0 ? (
                <tr>
                  <td colSpan={11} className="p-12 text-center text-slate-500 space-y-2">
                    <Inbox className="w-8 h-8 text-slate-300 mx-auto" />
                    <p className="font-bold text-slate-700 text-sm">No Records Found</p>
                    <p className="text-xs text-slate-400">No credit notes or refund requests match your current filters.</p>
                  </td>
                </tr>
              ) : (
                filteredDocs.map((doc) => {
                  const isCN = doc.type === 'credit_note';

                  return (
                    <tr key={doc.id} className="hover:bg-slate-50/80 transition-colors">
                      
                      {/* Request Type & Doc # */}
                      <td className="p-3.5 space-y-1">
                        <span className="font-mono font-bold text-slate-900 text-xs block">
                          {doc.docNumber}
                        </span>
                        <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-slate-100 text-slate-800 border border-slate-200">
                          {isCN ? 'Credit Note' : 'Refund Request'}
                        </span>
                      </td>

                      {/* Supplier */}
                      <td className="p-3.5">
                        <p className="font-bold text-slate-900">{doc.supplierName}</p>
                        <p className="font-mono text-slate-500 text-[10px]">{doc.supplierEmail}</p>
                      </td>

                      {/* Invoice */}
                      <td className="p-3.5 font-mono font-semibold text-slate-800">
                        {doc.invoiceNo}
                      </td>

                      {/* Amount */}
                      <td className="p-3.5 text-right font-mono font-bold text-slate-900 text-sm">
                        {formatSGD(doc.amount)}
                      </td>

                      {/* Current Status */}
                      <td className="p-3.5">
                        {getStatusBadge(doc.status)}
                      </td>

                      {/* Requested Date */}
                      <td className="p-3.5 font-mono text-slate-700">
                        {doc.requestedDate || doc.issueDate || '—'}
                      </td>

                      {/* Approved Date */}
                      <td className="p-3.5 font-mono text-slate-700">
                        {doc.approvedDate ? (
                          <span className="font-bold text-slate-900">{doc.approvedDate}</span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>

                      {/* Received Date */}
                      <td className="p-3.5 font-mono text-slate-700">
                        {doc.receivedDate ? (
                          <span className="font-bold text-slate-900">{doc.receivedDate}</span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>

                      {/* Assigned User / Requested By */}
                      <td className="p-3.5 text-slate-800 font-medium">
                        {doc.assignedUser || doc.createdBy || 'Accounts Executive'}
                      </td>

                      {/* Remarks */}
                      <td className="p-3.5 text-slate-600 max-w-xs truncate" title={doc.remarks || doc.reason}>
                        {doc.remarks || doc.reason || '—'}
                      </td>

                      {/* Actions */}
                      <td className="p-3.5 text-center space-y-1.5">
                        <div className="flex items-center justify-center gap-1.5 flex-wrap">
                          {doc.status === 'pending_approval' && (
                            <button
                              onClick={() => approveCreditNoteRefund(doc.id)}
                              className="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs rounded-lg shadow-2xs transition-colors cursor-pointer inline-flex items-center gap-1"
                              title="Approve Request"
                            >
                              <Check className="w-3.5 h-3.5 text-white" />
                              <span>Approve</span>
                            </button>
                          )}

                          {doc.status === 'approved' && (
                            <button
                              onClick={() => markCreditNoteRefundAsReceived(doc.id)}
                              className="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs rounded-lg shadow-2xs transition-colors cursor-pointer inline-flex items-center gap-1"
                              title="Mark as Received"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5 text-white" />
                              <span>Mark as Received</span>
                            </button>
                          )}

                          <button
                            onClick={() => setFollowUpDoc(doc)}
                            className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold text-xs rounded-lg transition-colors cursor-pointer inline-flex items-center gap-1"
                            title="Follow-Up Details"
                          >
                            <Clock className="w-3.5 h-3.5 text-slate-500" />
                            <span>Follow-Up</span>
                          </button>

                          <button
                            onClick={() => setSelectedDoc(doc)}
                            className="px-2 py-1 bg-white hover:bg-slate-50 text-slate-800 font-semibold text-xs rounded-lg border border-slate-300 transition-colors cursor-pointer inline-flex items-center gap-1"
                            title="Print Voucher"
                          >
                            <Printer className="w-3.5 h-3.5 text-slate-600" />
                            <span>Print</span>
                          </button>
                        </div>
                      </td>

                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Printable Document Modal */}
      {selectedDoc && (
        <PrintDocumentModal
          isOpen={true}
          document={selectedDoc}
          supplier={getSupplierById(selectedDoc.supplierId) || getSupplierByName(selectedDoc.supplierName)}
          onClose={() => setSelectedDoc(null)}
        />
      )}

      {/* Follow-Up Action Status Modal */}
      {followUpDoc && (
        <CreditNoteFollowUpModal
          isOpen={true}
          document={followUpDoc}
          onClose={() => setFollowUpDoc(null)}
        />
      )}

    </div>
  );
};
