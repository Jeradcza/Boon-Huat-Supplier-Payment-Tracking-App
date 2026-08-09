import React, { useState } from 'react';
import * as XLSX from 'xlsx';
import {
  Archive,
  CheckCircle2,
  Search,
  Building2,
  Calendar,
  FileText,
  DollarSign,
  Download,
  Printer,
  Filter,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useGoogleSync } from '../context/GoogleSyncContext';
import { formatSGD, parseDate, formatSGDate, formatSGDateTime, extractDueDateFromSyncedStr } from '../utils/formatters';
import { PaymentItem } from '../types';

export const PaymentArchivesPage: React.FC = () => {
  const { paymentItems, suppliers } = useApp();
  const { syncedQueueRows, isGoogleConnected } = useGoogleSync();

  const [searchTerm, setSearchTerm] = useState('');
  const [supplierFilter, setSupplierFilter] = useState('all');
  const [selectedItem, setSelectedItem] = useState<PaymentItem | null>(null);

  // Filter completed payments (local + synced)
  const completedLocalItems = paymentItems.filter((p) => p.status === 'completed' || p.status === 'paid');
  const existingLocalInvoiceNos = new Set(completedLocalItems.map((p) => p.invoiceNo.toLowerCase()));

  const completedSyncedItems: PaymentItem[] = syncedQueueRows
    .filter((row) => row.status.toLowerCase().includes('paid') || row.status.toLowerCase().includes('completed'))
    .filter((row) => {
      const linesSup = row.supplierInvoiceInfo.split('\n');
      const invNo = (linesSup[1] || row.invoiceId).toLowerCase();
      return !existingLocalInvoiceNos.has(invNo) && !existingLocalInvoiceNos.has(row.invoiceId.toLowerCase());
    })
    .map((row) => {
      const linesSup = row.supplierInvoiceInfo.split('\n');
      const linesRef = row.threeWayMatchRef.split('\n');
      const amt = parseFloat(row.invoiceAmount.replace(/[^0-9.]/g, '')) || 0;
      const dueDateStr = extractDueDateFromSyncedStr(row.creditTermsAndDueDate);
      const sup = suppliers.find((s) => s.name.toLowerCase() === (linesSup[0] || '').toLowerCase());
      return {
        id: row.matchId || row.invoiceId,
        invoiceNo: linesSup[1] || row.invoiceId,
        supplierId: sup?.id || 'SUP-001',
        supplierName: linesSup[0] || 'Supplier',
        poNo: linesRef[0] || '',
        grnNo: linesRef[1] || '',
        amount: amt,
        invoiceDate: '15/07/2026',
        dueDate: dueDateStr,
        paymentDate: row.paymentDate || formatSGDate(new Date()),
        status: 'completed',
        anomalyFlag: false,
        anomalyType: undefined,
        threeWayMatchStatus: 'match',
        cashBufferMet: true,
        createdDate: '15/07/2026',
        lastUpdated: formatSGDateTime(new Date()),
      };
    });

  const completedItems = [...completedLocalItems, ...completedSyncedItems].sort((a, b) => {
    const dateA = parseDate(a.paymentDate || a.dueDate);
    const dateB = parseDate(b.paymentDate || b.dueDate);
    const timeA = dateA ? dateA.getTime() : 0;
    const timeB = dateB ? dateB.getTime() : 0;
    return timeB - timeA; // Most recent completed first
  });

  const filteredItems = completedItems.filter((item) => {
    const matchesSearch =
      item.invoiceNo.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.supplierName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.poNo.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.grnNo.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesSupplier = supplierFilter === 'all' || item.supplierId === supplierFilter;

    return matchesSearch && matchesSupplier;
  });

  const totalCompletedAmount = completedItems.reduce((sum, p) => sum + p.amount, 0);
  const avgAmount = completedItems.length > 0 ? totalCompletedAmount / completedItems.length : 0;

  const getSupplierBank = (supplierId: string, supplierName: string) => {
    const sup = suppliers.find((s) => s.id === supplierId || s.name.toLowerCase() === supplierName.toLowerCase());
    return sup ? sup.bankAccount : 'DBS Corporate *9841';
  };

  const handleExportExcel = () => {
    const data = filteredItems.map((item) => ({
      'Invoice No': item.invoiceNo,
      'PO No': item.poNo,
      'GRN No': item.grnNo,
      'Supplier Name': item.supplierName,
      'Amount (SGD)': item.amount,
      'Invoice Date': item.invoiceDate,
      'Due Date': item.dueDate,
      'Completed Date': item.paymentDate || 'N/A',
      'Status': 'Payment Completed',
    }));

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Payment Archives');
    XLSX.writeFile(workbook, `Payment_Archives_Export_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  return (
    <div className="space-y-6 pb-8">
      
      {/* Page Header */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-800 border border-slate-200">
              Historical Ledger
            </span>
            <span className="text-xs text-slate-400 font-mono">Archive Vault</span>
          </div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <Archive className="w-6 h-6 text-slate-700" />
            Payment Archives
          </h1>
          <p className="text-xs text-slate-500 mt-1 max-w-2xl">
            Complete record of all actioned and settled supplier payments. Maintains 3-way match references, completion timestamps, and ledger audit logs.
          </p>
        </div>

        <button
          onClick={handleExportExcel}
          className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl shadow-2xs flex items-center gap-2 transition-colors self-start md:self-auto cursor-pointer"
        >
          <Download className="w-4 h-4 text-white" />
          <span>Export Archives Excel</span>
        </button>
      </div>

      {/* Summary Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold mb-1">
            <span>Completed Payments</span>
            <CheckCircle2 className="w-4 h-4 text-slate-700" />
          </div>
          <p className="text-2xl font-bold text-slate-900 font-mono">
            {completedItems.length} <span className="text-xs text-slate-500 font-normal">records</span>
          </p>
          <p className="text-xs text-slate-600 font-medium mt-1">
            Fully settled & archived
          </p>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold mb-1">
            <span>Total Settled Volume</span>
            <DollarSign className="w-4 h-4 text-slate-700" />
          </div>
          <p className="text-2xl font-bold text-slate-900 font-mono">
            {formatSGD(totalCompletedAmount)}
          </p>
          <p className="text-xs text-slate-500 font-medium mt-1">
            Cumulative total paid
          </p>
        </div>

      </div>

      {/* Filters and Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-3">
        
        {/* Search */}
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search by Invoice #, Supplier, PO #, or GRN #..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-xl text-xs font-medium focus:ring-2 focus:ring-slate-900 focus:border-slate-900 bg-white text-slate-900"
          />
        </div>

        {/* Supplier Filter */}
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Filter className="w-4 h-4 text-slate-400 shrink-0" />
          <select
            value={supplierFilter}
            onChange={(e) => setSupplierFilter(e.target.value)}
            className="w-full sm:w-60 px-3 py-2 border border-slate-300 rounded-xl text-xs font-medium bg-white focus:ring-2 focus:ring-slate-900 text-slate-800"
          >
            <option value="all">All Suppliers</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>

      </div>

      {/* Main Archives Data Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-2">
            <Archive className="w-4 h-4 text-slate-600" />
            <h3 className="font-bold text-slate-800 text-sm">Archived Payment Records</h3>
            <span className="text-xs text-slate-500 font-mono">({filteredItems.length} records)</span>
          </div>
        </div>

        {filteredItems.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mx-auto text-slate-400">
              <Archive className="w-6 h-6" />
            </div>
            <h4 className="font-bold text-slate-700 text-sm">No Completed Payments Found</h4>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              {completedItems.length === 0
                ? "There are no completed payments in the archive yet. Once scheduled payments are marked as 'Payment Completed', they will appear here."
                : 'No archived payment records match your search query or supplier filter.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-500 font-semibold uppercase text-[10px] tracking-wider border-b border-slate-200">
                  <th className="p-3.5">Invoice & References</th>
                  <th className="p-3.5">Supplier & Bank Details</th>
                  <th className="p-3.5 text-right">Amount (SGD)</th>
                  <th className="p-3.5">Key Dates</th>
                  <th className="p-3.5">Settlement Status</th>
                  <th className="p-3.5 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {filteredItems.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                    
                    {/* Invoice & 3-way match refs */}
                    <td className="p-3.5 space-y-1">
                      <p className="font-bold font-mono text-slate-900">{item.invoiceNo}</p>
                      <div className="flex items-center gap-2 text-[10px] font-mono text-slate-500">
                        <span>PO: {item.poNo}</span>
                        <span>•</span>
                        <span>GRN: {item.grnNo}</span>
                      </div>
                    </td>

                    {/* Supplier */}
                    <td className="p-3.5">
                      <p className="font-bold text-slate-800">{item.supplierName}</p>
                      <p className="text-[10px] font-mono text-slate-500 mt-0.5">
                        {getSupplierBank(item.supplierId, item.supplierName)}
                      </p>
                    </td>

                    {/* Amount */}
                    <td className="p-3.5 text-right font-mono font-bold text-slate-900 text-sm">
                      {formatSGD(item.amount)}
                    </td>

                    {/* Dates */}
                    <td className="p-3.5 space-y-0.5 text-[11px]">
                      <div>
                        <span className="text-slate-400">Paid Date: </span>
                        <span className="font-mono font-bold text-slate-800 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                          {item.paymentDate || item.dueDate}
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-500">
                        Invoice: {item.invoiceDate} | Due: {item.dueDate}
                      </div>
                    </td>

                    {/* Status */}
                    <td className="p-3.5">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-800 border border-slate-200">
                        <CheckCircle2 className="w-3.5 h-3.5 text-slate-700" />
                        <span>Payment Completed</span>
                      </span>
                      {item.anomalyReason && (
                        <p className="text-[10px] text-slate-500 mt-1 max-w-xs truncate" title={item.anomalyReason}>
                          {item.anomalyReason}
                        </p>
                      )}
                    </td>

                    {/* Action */}
                    <td className="p-3.5 text-center">
                      <button
                        onClick={() => setSelectedItem(item)}
                        className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-lg transition-colors inline-flex items-center gap-1 cursor-pointer"
                      >
                        <FileText className="w-3.5 h-3.5 text-slate-500" />
                        <span>Voucher</span>
                      </button>
                    </td>

                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Settlement Voucher Modal */}
      {selectedItem && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 border border-slate-200 space-y-4">
            
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-slate-100 text-slate-700 rounded-lg border border-slate-200">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">Payment Completion Voucher</h3>
                  <p className="text-[10px] text-slate-500 font-mono">Ref: ARCH-{selectedItem.id}</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedItem(null)}
                className="text-slate-400 hover:text-slate-600 font-bold text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs bg-slate-50 p-4 rounded-xl border border-slate-200/80">
              <div className="flex justify-between border-b border-slate-200/60 pb-2">
                <span className="text-slate-500">Supplier Name:</span>
                <span className="font-bold text-slate-800">{selectedItem.supplierName}</span>
              </div>
              <div className="flex justify-between border-b border-slate-200/60 pb-2">
                <span className="text-slate-500">Invoice Number:</span>
                <span className="font-mono font-bold text-slate-800">{selectedItem.invoiceNo}</span>
              </div>
              <div className="flex justify-between border-b border-slate-200/60 pb-2">
                <span className="text-slate-500">PO & GRN Matching:</span>
                <span className="font-mono text-slate-700">{selectedItem.poNo} / {selectedItem.grnNo}</span>
              </div>
              <div className="flex justify-between border-b border-slate-200/60 pb-2">
                <span className="text-slate-500">Invoice Date:</span>
                <span className="font-mono text-slate-700">{selectedItem.invoiceDate}</span>
              </div>
              <div className="flex justify-between border-b border-slate-200/60 pb-2">
                <span className="text-slate-500">Completed Payment Date:</span>
                <span className="font-mono font-bold text-slate-900">{selectedItem.paymentDate || selectedItem.dueDate}</span>
              </div>
              <div className="flex justify-between pt-1">
                <span className="text-slate-600 font-bold">Settled Amount (SGD):</span>
                <span className="font-mono font-bold text-slate-900 text-base">{formatSGD(selectedItem.amount)}</span>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setSelectedItem(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-xl transition-colors cursor-pointer"
              >
                Close
              </button>
              <button
                onClick={() => {
                  window.print();
                }}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs rounded-xl shadow-2xs flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print Voucher</span>
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};
