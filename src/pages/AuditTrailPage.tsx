import React, { useState } from 'react';
import {
  History,
  Download,
  Search,
  Filter,
  User,
  Calendar,
  FileSpreadsheet,
  CheckCircle2,
  ShieldCheck,
  Lock,
  RefreshCw,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { useApp } from '../context/AppContext';
import { AuditLog, UserRole } from '../types';

export const AuditTrailPage: React.FC = () => {
  const { auditLogs } = useApp();

  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | UserRole>('all');
  const [actionFilter, setActionFilter] = useState<string>('all');

  const filteredLogs = auditLogs.filter((log) => {
    const matchesSearch =
      log.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.user.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.actionType.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesRole = roleFilter === 'all' || log.userRole === roleFilter;

    const matchesAction = actionFilter === 'all' || log.actionType === actionFilter;

    return matchesSearch && matchesRole && matchesAction;
  });

  const handleExportExcel = () => {
    // Format audit trail logs for Excel export
    const excelData = filteredLogs.map((log) => ({
      'Log ID': log.id,
      'Timestamp (SG)': log.timestamp,
      'User Name': log.user,
      'User Role': log.userRole === 'manager' ? 'Mr Boon (Manager)' : 'Mdm Lim (Accounts)',
      'Action Type': log.actionType.toUpperCase(),
      'Description & Audit Trail': log.description,
    }));

    const worksheet = XLSX.utils.json_to_sheet(excelData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'AuditTrail');

    // Auto fit column widths
    worksheet['!cols'] = [
      { wch: 15 },
      { wch: 22 },
      { wch: 18 },
      { wch: 22 },
      { wch: 20 },
      { wch: 60 },
    ];

    XLSX.writeFile(workbook, `Supplier_Payments_AuditTrail_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  return (
    <div className="space-y-6 pb-8">
      
      {/* Header */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <History className="w-5 h-5 text-slate-800" />
            <span>Activity & Payment Audit Trail</span>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-800 border border-slate-200 font-mono">
              {auditLogs.length} Records
            </span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Immutable log of payment dates, anomaly flags, manager overrides, cash buffer changes, and user logins.
          </p>
        </div>

        <button
          onClick={handleExportExcel}
          className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs rounded-xl shadow-xs flex items-center gap-2 transition-all self-start md:self-auto cursor-pointer"
        >
          <FileSpreadsheet className="w-4 h-4 text-white" />
          <span>Export Audit Trail (Excel .xlsx)</span>
        </button>
      </div>

      {/* Search & Filters */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
        
        {/* Search */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search log descriptions, user names, or action types..."
            className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-slate-900 text-slate-900"
          />
        </div>

        {/* Filter Dropdowns */}
        <div className="flex flex-wrap items-center gap-2">
          
          <div className="flex items-center gap-1">
            <User className="w-3.5 h-3.5 text-slate-500" />
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value as any)}
              className="px-2.5 py-1.5 border border-slate-300 rounded-lg bg-white font-medium text-xs text-slate-800"
            >
              <option value="all">All Roles</option>
              <option value="accounts">Mdm Lim (Accounts)</option>
              <option value="manager">Mr Boon (Manager)</option>
            </select>
          </div>

          <div className="flex items-center gap-1">
            <Filter className="w-3.5 h-3.5 text-slate-500" />
            <select
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
              className="px-2.5 py-1.5 border border-slate-300 rounded-lg bg-white font-medium text-xs text-slate-800"
            >
              <option value="all">All Action Types</option>
              <option value="payment_date">Payment Date Scheduled</option>
              <option value="anomaly_flagged">Anomaly Flagged</option>
              <option value="credit_note">Credit Note Generated</option>
              <option value="refund_request">Refund Request</option>
              <option value="manager_override">Manager Override</option>
              <option value="cash_buffer_change">Cash Buffer Changed</option>
              <option value="sheets_sync">Sheets Synced</option>
              <option value="SUPPLIER_IMPORTED_FROM_INVOICES">Supplier Imported from INVOICES</option>
              <option value="SUPPLIER_DETAILS_ADDED">Supplier Details Added</option>
              <option value="SUPPLIER_DETAILS_UPDATED">Supplier Details Updated</option>
              <option value="SUPPLIER_BANK_ACCOUNT_UPDATED">Supplier Bank Account Updated</option>
              <option value="SUPPLIER_BANK_ACCOUNT_CONFLICT_RESOLVED">Supplier Bank Conflict Resolved</option>
              <option value="SUPPLIER_REMOVED">Supplier Removed</option>
              <option value="login">User Login</option>
            </select>
          </div>

        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left border-collapse">
            <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200 uppercase tracking-wider text-[11px]">
              <tr>
                <th className="p-3.5">Timestamp (SG)</th>
                <th className="p-3.5">User & Role</th>
                <th className="p-3.5">Action Type</th>
                <th className="p-3.5">Detailed Audit Description</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-200 font-mono">
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={4} className="p-8 text-center text-slate-500 font-sans">
                    No audit records matching search parameters.
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log, idx) => {
                  const isManager = log.userRole === 'manager';

                  return (
                    <tr key={`${log.id}-${idx}`} className="hover:bg-slate-50/80 transition-colors">
                      
                      <td className="p-3.5 text-slate-600 font-medium whitespace-nowrap">
                        {log.timestamp}
                      </td>

                      <td className="p-3.5 font-sans">
                        <p className="font-bold text-slate-900">{log.user}</p>
                        <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase mt-0.5 bg-slate-100 text-slate-800 border border-slate-200">
                          {isManager ? 'Manager' : 'Accounts'}
                        </span>
                      </td>

                      <td className="p-3.5 font-sans">
                        <span className="px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-800 border border-slate-200">
                          {log.actionType.replace('_', ' ')}
                        </span>
                      </td>

                      <td className="p-3.5 font-sans text-slate-800 leading-relaxed">
                        {log.description}
                      </td>

                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
};
