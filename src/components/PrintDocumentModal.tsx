import React from 'react';
import { Printer, Download, X, FileText, CheckCircle2 } from 'lucide-react';
import { CreditNoteRefund, Supplier } from '../types';
import { formatSGD } from '../utils/formatters';

interface PrintDocumentModalProps {
  isOpen: boolean;
  document: CreditNoteRefund | null;
  supplier?: Supplier;
  onClose: () => void;
}

export const PrintDocumentModal: React.FC<PrintDocumentModalProps> = ({
  isOpen,
  document,
  supplier,
  onClose,
}) => {
  if (!isOpen || !document) return null;

  const isCreditNote = document.type === 'credit_note';
  const title = isCreditNote ? 'OFFICIAL CREDIT NOTE' : 'REFUND REQUEST FORM';

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPDF = () => {
    const element = window.document.getElementById('printable-doc-area');
    if (!element) return;
    
    // Create print window or download HTML file
    const content = element.outerHTML;
    const blob = new Blob([`
      <!DOCTYPE html>
      <html>
        <head>
          <title>${document.docNumber} - ${document.supplierName}</title>
          <style>
            body { font-family: system-ui, -apple-system, sans-serif; padding: 40px; color: #1e293b; background: white; }
            .header { border-bottom: 2px solid #0f172a; padding-bottom: 16px; margin-bottom: 24px; display: flex; justify-content: space-between; }
            .title { font-size: 20px; font-weight: bold; color: #0f172a; }
            .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 24px; }
            .card { background: #f8fafc; padding: 16px; border-radius: 8px; border: 1px solid #e2e8f0; }
            table { width: 100%; border-collapse: collapse; margin-top: 16px; }
            th, td { padding: 10px; border: 1px solid #e2e8f0; text-align: left; }
            th { background: #f1f5f9; font-weight: 600; }
            .total { font-size: 18px; font-weight: bold; color: #0f172a; text-align: right; padding-top: 16px; }
            .signatures { margin-top: 60px; display: grid; grid-template-columns: 1fr 1fr; gap: 40px; }
            .sig-line { border-top: 1px solid #94a3b8; padding-top: 8px; text-align: center; font-size: 12px; color: #64748b; }
          </style>
        </head>
        <body>
          ${content}
        </body>
      </html>
    `], { type: 'text/html' });

    const url = URL.createObjectURL(blob);
    const a = window.document.createElement('a');
    a.href = url;
    a.download = `${document.docNumber}_${document.supplierName.replace(/[^a-zA-Z0-9]/g, '_')}.html`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-3xl overflow-hidden flex flex-col max-h-[92vh]">
        
        {/* Top Control Bar */}
        <div className="p-4 bg-slate-50 border-b border-slate-200 text-slate-900 flex items-center justify-between no-print">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-emerald-600" />
            <h3 className="font-bold text-sm text-slate-900">
              Document Viewer: {document.docNumber}
            </h3>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="px-3 py-1.5 text-xs font-bold bg-white hover:bg-slate-100 text-slate-800 rounded-lg flex items-center gap-1.5 transition-colors border border-slate-200 shadow-2xs cursor-pointer"
            >
              <Printer className="w-4 h-4 text-slate-600" />
              <span>Print</span>
            </button>
            <button
              onClick={handleDownloadPDF}
              className="px-3 py-1.5 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg flex items-center gap-1.5 shadow-2xs transition-colors cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>Export Document</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-lg transition-colors ml-2 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Document Printable Area */}
        <div className="p-8 overflow-y-auto bg-slate-50 flex justify-center">
          <div 
            id="printable-doc-area"
            className="bg-white p-8 rounded-lg shadow-sm border border-slate-200 w-full max-w-2xl text-slate-800 space-y-6"
          >
            {/* Document Header */}
            <div className="border-b-2 border-slate-900 pb-4 flex justify-between items-start">
              <div>
                <h1 className="text-xl font-bold text-slate-900 tracking-tight">
                  SINGAPORE SUPPLIER OPERATIONS PTE LTD
                </h1>
                <p className="text-xs text-slate-500 mt-1">
                  10 Anson Road #22-08, International Plaza, Singapore 079903
                </p>
                <p className="text-xs text-slate-500">
                  Co. Reg No: 201829401G | GST Reg No: M90382910X
                </p>
              </div>
              <div className="text-right">
                <span className={`inline-block px-3 py-1 rounded text-xs font-bold uppercase tracking-wider ${
                  isCreditNote ? 'bg-purple-100 text-purple-900' : 'bg-blue-100 text-blue-900'
                }`}>
                  {title}
                </span>
                <p className="text-sm font-mono font-bold text-slate-900 mt-2">
                  {document.docNumber}
                </p>
                <p className="text-xs text-slate-500">
                  Date: {document.issueDate}
                </p>
              </div>
            </div>

            {/* Supplier & Ref Info */}
            <div className="grid grid-cols-2 gap-4 text-xs">
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                <p className="text-slate-400 font-medium uppercase text-[10px] tracking-wider mb-1">
                  Issued To (Supplier):
                </p>
                <p className="font-bold text-slate-900 text-sm">{document.supplierName}</p>
                <p className="text-slate-600 mt-1">{supplier?.address || 'Singapore'}</p>
                <p className="text-slate-600">Attn: {supplier?.contactPerson || 'Accounts Team'}</p>
                <p className="font-mono text-slate-600">{document.supplierEmail}</p>
              </div>

              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-1.5">
                <div>
                  <span className="text-slate-400">Reference Invoice:</span>
                  <p className="font-mono font-semibold text-slate-800">{document.invoiceNo}</p>
                </div>
                <div>
                  <span className="text-slate-400">Approval Status:</span>
                  <p className="font-semibold flex items-center gap-1 mt-0.5">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                      document.approvalStatus === 'approved'
                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                        : document.approvalStatus === 'rejected'
                        ? 'bg-red-100 text-red-800 border border-red-200'
                        : 'bg-amber-100 text-amber-800 border border-amber-200'
                    }`}>
                      {document.approvalStatus === 'approved' ? 'Approved' : document.approvalStatus === 'rejected' ? 'Rejected' : 'Pending Approval'}
                    </span>
                  </p>
                </div>
                <div>
                  <span className="text-slate-400">Issued By:</span>
                  <p className="text-slate-800">{document.createdBy}</p>
                </div>
              </div>
            </div>

            {/* Itemized Table */}
            <div>
              <table className="w-full text-xs text-left border border-slate-200 rounded-lg overflow-hidden">
                <thead className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="p-2.5">Item Description / Recovery Reason</th>
                    <th className="p-2.5 text-center">Ref Invoice</th>
                    <th className="p-2.5 text-right">Amount (SGD)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  <tr>
                    <td className="p-3 text-slate-800">
                      <p className="font-semibold">{isCreditNote ? 'Credit Note Adjustment' : 'Refund Request Recovery'}</p>
                      <p className="text-slate-500 mt-0.5">{document.reason}</p>
                    </td>
                    <td className="p-3 text-center font-mono">{document.invoiceNo}</td>
                    <td className="p-3 text-right font-mono font-bold text-slate-900">
                      {formatSGD(document.amount)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Total Amount */}
            <div className="flex justify-end pt-2 border-t border-slate-200">
              <div className="text-right">
                <span className="text-xs text-slate-500 font-medium">TOTAL RECOVERY AMOUNT:</span>
                <p className="text-xl font-bold text-slate-900 font-mono mt-0.5">
                  {formatSGD(document.amount)}
                </p>
              </div>
            </div>

            {/* Authorization Signatures */}
            <div className="pt-8 grid grid-cols-2 gap-12 text-center text-xs text-slate-500">
              <div>
                <div className="border-b border-slate-300 pb-1 font-semibold text-slate-700">
                  {document.createdBy}
                </div>
                <p className="mt-1">Prepared By (Accounts Executive)</p>
              </div>
              <div>
                <div className="border-b border-slate-300 pb-1 font-semibold text-slate-700">
                  Mr Boon (Owner / Manager)
                </div>
                <p className="mt-1">Authorized Manager Signoff</p>
              </div>
            </div>

            <div className="text-[10px] text-center text-slate-400 pt-4 border-t border-slate-100">
              This document is generated by App 3 — Supplier Payments Tracking system. Valid without physical stamp if signed digitally.
            </div>

          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-white border-t border-slate-200 flex items-center justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg"
          >
            Close Document
          </button>
        </div>

      </div>
    </div>
  );
};
