import React from 'react';
import {
  Home,
  LayoutDashboard,
  CreditCard,
  Archive,
  AlertOctagon,
  FileCheck,
  History,
  Users,
  Settings,
  RefreshCw,
  Lock,
  Building2,
  FileSpreadsheet,
  AlertCircle,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { checkIsCreditTermOverdue } from '../utils/formatters';

export const Sidebar: React.FC = () => {
  const { currentUser, currentPage, setCurrentPage, paymentItems, syncSheets, settings, simulatedDate } = useApp();

  const isManager = currentUser?.role === 'manager';

  // Count flagged anomalies, withheld items, completed archives, and overdue payments
  const flaggedCount = paymentItems.filter(p => p.status === 'flagged').length;
  const withheldCount = paymentItems.filter(p => p.status === 'withheld').length;
  const completedCount = paymentItems.filter(p => p.status === 'completed').length;
  const overdueCount = paymentItems.filter(
    p => p.status !== 'completed' && checkIsCreditTermOverdue(p.invoiceDate, p.creditTermsDays, p.dueDate, simulatedDate)
  ).length;

  const navItems = [
    { id: 'home', label: 'Home', icon: Home, badge: null },
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, badge: null },
    { id: 'payment-queue', label: 'Payment Queue', icon: CreditCard, badge: null },
    { 
      id: 'overdue-payments', 
      label: 'Overdue Payments', 
      icon: AlertCircle, 
      badge: overdueCount > 0 ? overdueCount : null,
      badgeColor: 'bg-slate-100 text-slate-800 border border-slate-200 font-semibold'
    },
    { 
      id: 'payment-archives', 
      label: 'Payment Archives', 
      icon: Archive, 
      badge: completedCount > 0 ? completedCount : null,
      badgeColor: 'bg-slate-100 text-slate-800 border border-slate-200 font-semibold'
    },
    { 
      id: 'flagged-anomalies', 
      label: 'Flagged Items', 
      icon: AlertOctagon, 
      badge: flaggedCount > 0 ? flaggedCount : null,
      badgeColor: 'bg-slate-100 text-slate-800 border border-slate-200 font-semibold'
    },
    { id: 'credit-notes', label: 'Credit Notes & Refunds', icon: FileCheck, badge: null },
    { id: 'audit-trail', label: 'Audit Trail', icon: History, badge: null },
    { id: 'supplier-info', label: 'Supplier Info', icon: Users, badge: null },
    { id: 'sheets-tab', label: 'Google Sheets', icon: FileSpreadsheet, badge: null },
  ];

  const getInitials = (name?: string) => {
    if (!name) return 'U';
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase();
  };

  return (
    <aside className="w-64 bg-white border-r border-slate-200 flex flex-col h-screen fixed top-0 left-0 z-30 select-none">
      
      {/* Header Branding */}
      <div className="p-5 border-b border-slate-100">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-7 h-7 bg-slate-900 rounded shadow-xs flex items-center justify-center text-white shrink-0">
            <Building2 className="w-4 h-4 text-white" />
          </div>
          <span className="font-bold tracking-tight text-slate-900 text-xs leading-tight">
            Boon Huat Supplier Payment Tracking
          </span>
        </div>
        <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-widest pl-0.5">
          Supplier Payments
        </p>
      </div>

      {/* Main Navigation */}
      <nav className="flex-1 px-4 py-4 space-y-1 overflow-y-auto text-xs font-medium">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentPage === item.id;

          return (
            <button
              key={item.id}
              onClick={() => setCurrentPage(item.id)}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg transition-colors text-left cursor-pointer ${
                isActive
                  ? 'bg-slate-100 text-slate-900 font-bold'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              <div className="flex items-center gap-3">
                <Icon className={`w-5 h-5 ${isActive ? 'text-slate-900' : 'text-slate-400'}`} />
                <span>{item.label}</span>
              </div>

              {item.badge !== null && (
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${item.badgeColor || 'bg-slate-100 text-slate-700'}`}>
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}

        {/* Management Access */}
        <div className="pt-4 pb-1">
          <p className="px-3 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
            System Settings
          </p>
        </div>

        <button
          onClick={() => setCurrentPage('management')}
          className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg transition-colors text-left cursor-pointer ${
            currentPage === 'management'
              ? 'bg-slate-100 text-slate-900 font-bold'
              : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
          }`}
        >
          <div className="flex items-center gap-3">
            <Settings className={`w-5 h-5 ${currentPage === 'management' ? 'text-slate-900' : 'text-slate-400'}`} />
            <span>Management & Settings</span>
          </div>
          {withheldCount > 0 && (
            <span className="text-[10px] font-bold bg-slate-100 text-slate-800 px-1.5 py-0.5 rounded-full border border-slate-200">
              {withheldCount}
            </span>
          )}
        </button>
      </nav>

      {/* Sync Sheets Quick Action */}
      <div className="px-4 py-2 border-t border-slate-100 bg-slate-50/50">
        <button
          onClick={syncSheets}
          className="w-full py-2 px-3 bg-white hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 border border-slate-200 transition-colors shadow-2xs cursor-pointer"
        >
          <RefreshCw className="w-3.5 h-3.5 text-slate-700" />
          <span>Sync Sheets</span>
        </button>
        <div className="mt-1.5 text-[10px] text-slate-400 text-center truncate">
          Last synced: <span className="text-slate-500 font-mono">{settings.lastSyncedAt}</span>
        </div>
      </div>

      {/* Active User Footcard */}
      <div className="p-4 border-t border-slate-100">
        <div className="bg-slate-50 rounded-xl p-3 flex items-center gap-3 border border-slate-200">
          <div className="w-8 h-8 rounded-full bg-slate-200 text-slate-800 flex items-center justify-center font-bold text-xs shrink-0">
            {getInitials(currentUser?.name)}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold text-slate-900 truncate">{currentUser?.name}</p>
            <p className="text-[10px] text-slate-500 truncate">{currentUser?.title}</p>
          </div>
          <span className="text-[9px] px-1.5 py-0.5 rounded font-bold uppercase shrink-0 bg-slate-200 text-slate-800 border border-slate-300">
            {currentUser?.role}
          </span>
        </div>
      </div>

    </aside>
  );
};
