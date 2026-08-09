import React, { useState } from 'react';
import {
  Users,
  Mail,
  Phone,
  Building2,
  Calendar,
  CreditCard,
  Plus,
  Edit2,
  Trash2,
  Search,
  CheckCircle2,
  X,
  RefreshCw,
  AlertTriangle,
  FileText,
  Lock,
  ExternalLink,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useGoogleSync } from '../context/GoogleSyncContext';
import { Supplier, ConflictingBankAccount, InvoiceSheetRow } from '../types';
import { maskBankAccount, normalizeSupplierName } from '../utils/supplierUtils';
import { formatSGD } from '../utils/formatters';
import { ConfirmModal } from '../components/ConfirmModal';

export const SupplierInfoPage: React.FC = () => {
  const {
    suppliers,
    updateSupplier,
    addSupplier,
    deleteSupplier,
    resolveBankAccountConflict,
    resetSuppliersForDemo,
    rebuildSuppliersFromInvoices,
    currentUser,
  } = useApp();

  const { syncNow, invoicesRows, syncStatus } = useGoogleSync();

  const canEdit = Boolean(currentUser);

  const [deleteConfirmSupplier, setDeleteConfirmSupplier] = useState<Supplier | null>(null);
  const [showResetDemoModal, setShowResetDemoModal] = useState(false);
  const [resetSuccessMsg, setResetSuccessMsg] = useState('');

  const [searchTerm, setSearchTerm] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);

  // Form state
  const [formName, setFormName] = useState('');
  const [formContact, setFormContact] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formTerms, setFormTerms] = useState<number>(30);
  const [formBank, setFormBank] = useState('');
  const [formAddress, setFormAddress] = useState('');
  const [formNotes, setFormNotes] = useState('');
  const [emailError, setEmailError] = useState('');

  // Conflict Resolution Modal state
  const [conflictModalOpen, setConflictModalOpen] = useState(false);
  const [conflictSupplier, setConflictSupplier] = useState<Supplier | null>(null);
  const [selectedConflictBank, setSelectedConflictBank] = useState('');
  const [customConflictBank, setCustomConflictBank] = useState('');

  // Related Invoices Modal state
  const [invoicesModalOpen, setInvoicesModalOpen] = useState(false);
  const [selectedSupplierForInvoices, setSelectedSupplierForInvoices] = useState<Supplier | null>(null);

  // Filter active (non-removed) suppliers
  const activeSuppliers = suppliers.filter((s) => !s.isRemoved);

  const filteredSuppliers = activeSuppliers.filter(
    (s) =>
      s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.contactPerson.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.bankAccount.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.phone.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const conflictCount = activeSuppliers.filter((s) => s.hasBankConflict).length;

  const handleRefreshAndRebuild = async () => {
    await syncNow();
    rebuildSuppliersFromInvoices(invoicesRows);
    setResetSuccessMsg('Supplier Information rebuilt successfully from live INVOICES worksheet.');
    setTimeout(() => setResetSuccessMsg(''), 5000);
  };

  const handleConfirmResetDemo = () => {
    setShowResetDemoModal(false);
    resetSuppliersForDemo();
    setResetSuccessMsg('Supplier Information directory reset for demo. No worksheets were modified.');
    setTimeout(() => setResetSuccessMsg(''), 5000);
  };

  const handleOpenAdd = () => {
    setEditingSupplier(null);
    setFormName('');
    setFormContact('');
    setFormEmail('');
    setFormPhone('');
    setFormTerms(30);
    setFormBank('');
    setFormAddress('');
    setFormNotes('');
    setEmailError('');
    setModalOpen(true);
  };

  const handleOpenEdit = (sup: Supplier) => {
    setEditingSupplier(sup);
    setFormName(sup.name);
    setFormContact(sup.contactPerson || '');
    setFormEmail(sup.email || '');
    setFormPhone(sup.phone || '');
    setFormTerms(sup.creditTermsDays || 30);
    setFormBank(sup.bankAccount || '');
    setFormAddress(sup.address || '');
    setFormNotes(sup.notes || '');
    setEmailError('');
    setModalOpen(true);
  };

  const validateEmail = (email: string) => {
    if (!email) return true; // Optional if blank, but missing label shown in list
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (formEmail && !validateEmail(formEmail)) {
      setEmailError('Please enter a valid email address (e.g. accounts@supplier.com)');
      return;
    }

    if (editingSupplier) {
      updateSupplier({
        ...editingSupplier,
        name: formName,
        contactPerson: formContact,
        email: formEmail,
        phone: formPhone,
        creditTermsDays: Number(formTerms),
        bankAccount: formBank,
        address: formAddress,
        notes: formNotes,
        manuallySetBankAcc: formBank !== editingSupplier.bankAccount ? true : editingSupplier.manuallySetBankAcc,
      });
    } else {
      addSupplier({
        id: `SUP-${String(suppliers.length + 1).padStart(3, '0')}`,
        name: formName,
        contactPerson: formContact,
        email: formEmail,
        phone: formPhone,
        creditTermsDays: Number(formTerms),
        bankAccount: formBank,
        address: formAddress,
        notes: formNotes,
        manuallySetBankAcc: Boolean(formBank),
        isManualOnly: true,
        isRemoved: false,
      });
    }
    setModalOpen(false);
  };

  const handleOpenConflictModal = (sup: Supplier) => {
    setConflictSupplier(sup);
    setSelectedConflictBank(sup.conflictingBankAccounts?.[0]?.bankAccount || sup.bankAccount || '');
    setCustomConflictBank('');
    setConflictModalOpen(true);
  };

  const handleSaveConflictResolution = () => {
    if (!conflictSupplier) return;
    const finalBank = customConflictBank.trim() || selectedConflictBank.trim();
    if (!finalBank) {
      alert('Please select or enter a valid bank account number.');
      return;
    }
    resolveBankAccountConflict(conflictSupplier.id, finalBank);
    setConflictModalOpen(false);
  };

  const handleOpenInvoicesModal = (sup: Supplier) => {
    setSelectedSupplierForInvoices(sup);
    setInvoicesModalOpen(true);
  };

  const getRelatedInvoicesForSupplier = (sup: Supplier): InvoiceSheetRow[] => {
    if (!invoicesRows || invoicesRows.length === 0) return [];
    const norm = normalizeSupplierName(sup.name);
    return invoicesRows.filter((r) => normalizeSupplierName(r.supplierName || '') === norm);
  };

  return (
    <div className="space-y-6 pb-8">
      {/* Header */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Users className="w-5 h-5 text-slate-800" />
            <span>Supplier Information Directory</span>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-800 border border-slate-200 font-mono">
              {activeSuppliers.length} Active Profiles
            </span>
            {conflictCount > 0 && (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-800 border border-slate-200 flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5 text-slate-700" />
                <span>{conflictCount} Bank Conflict{conflictCount > 1 ? 's' : ''}</span>
              </span>
            )}
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            App 3’s single source of truth for supplier emails, phone numbers, contact persons, office locations, and bank accounts.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 self-start md:self-auto">
          <button
            onClick={() => setShowResetDemoModal(true)}
            className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold text-xs rounded-xl border border-slate-300 flex items-center gap-1.5 transition-colors cursor-pointer"
            title="Clear supplier profiles from App 3 for demo without deleting INVOICES sheet"
          >
            <Trash2 className="w-3.5 h-3.5 text-slate-600" />
            <span>Reset Supplier Information for Demo</span>
          </button>

          <button
            onClick={handleRefreshAndRebuild}
            className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold text-xs rounded-xl border border-slate-300 flex items-center gap-1.5 transition-colors cursor-pointer"
            title="Refresh Supplier Information from live INVOICES worksheet"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-slate-600 ${syncStatus === 'Synchronising...' ? 'animate-spin' : ''}`} />
            <span>Refresh Live Database & Rebuild Suppliers</span>
          </button>

          {canEdit && (
            <button
              onClick={handleOpenAdd}
              className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs rounded-xl shadow-2xs flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4 text-white" />
              <span>Add New Supplier</span>
            </button>
          )}
        </div>
      </div>

      {resetSuccessMsg && (
        <div className="p-4 bg-slate-100 border border-slate-300 text-slate-900 rounded-2xl text-xs font-bold flex items-center gap-2 shadow-2xs">
          <CheckCircle2 className="w-5 h-5 text-slate-700 shrink-0" />
          <span>{resetSuccessMsg}</span>
        </div>
      )}

      {/* Conflict Summary Banner */}
      {conflictCount > 0 && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-3 text-amber-900 text-xs">
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-amber-950">
                Conflicting Supplier Bank-Account Numbers Detected
              </p>
              <p className="text-amber-800 mt-0.5">
                {conflictCount} supplier profile{conflictCount > 1 ? 's' : ''} contain multiple conflicting bank account numbers across live INVOICES rows. Please review and resolve conflicts before processing payments.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Search */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by supplier name, contact person, email, phone, or bank account..."
            className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-slate-900 text-slate-900"
          />
        </div>
      </div>

      {activeSuppliers.length === 0 ? (
        <div className="bg-white p-12 rounded-2xl border border-slate-200 text-center space-y-4 shadow-2xs">
          <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mx-auto text-slate-400">
            <Users className="w-6 h-6" />
          </div>
          <div className="max-w-md mx-auto space-y-1">
            <h3 className="font-bold text-slate-800 text-base">No Supplier Profiles Loaded</h3>
            <p className="text-xs text-slate-500">
              No supplier profiles are currently loaded. Refresh the live database to rebuild Supplier Information from INVOICES.
            </p>
          </div>
          <button
            onClick={handleRefreshAndRebuild}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl inline-flex items-center gap-2 shadow-2xs transition-colors cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${syncStatus === 'Synchronising...' ? 'animate-spin' : ''}`} />
            <span>Refresh Live Database & Rebuild Suppliers</span>
          </button>
        </div>
      ) : (
        /* Cards Grid */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredSuppliers.map((sup) => {
          const relatedInvoices = getRelatedInvoicesForSupplier(sup);
          const invoiceCount = sup.invoiceCount ?? relatedInvoices.length;

          return (
            <div
              key={sup.id}
              className={`bg-white p-5 rounded-2xl border shadow-2xs hover:shadow-md transition-all flex flex-col justify-between space-y-4 ${
                sup.hasBankConflict ? 'border-amber-300 ring-2 ring-amber-100' : 'border-slate-200'
              }`}
            >
              <div>
                {/* Header Row */}
                <div className="flex items-start justify-between border-b border-slate-100 pb-3 mb-3">
                  <div>
                    <span className="text-[10px] font-mono text-slate-400 font-semibold">{sup.id}</span>
                    <h3 className="font-bold text-slate-900 text-base leading-tight mt-0.5">
                      {sup.name}
                    </h3>
                  </div>
                </div>

                {/* Bank Account Conflict Banner on Card */}
                {sup.hasBankConflict && (
                  <div className="mb-3 p-3 bg-amber-50 border border-amber-200 rounded-xl space-y-2 text-xs">
                    <div className="flex items-center gap-1.5 font-bold text-amber-900">
                      <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                      <span>Conflicting Bank Accounts Found</span>
                    </div>
                    <p className="text-[11px] text-amber-800">
                      Invoices for this supplier contain different bank account numbers:
                    </p>
                    <ul className="space-y-1 text-[11px] font-mono text-amber-900 bg-white/80 p-2 rounded border border-amber-200">
                      {sup.conflictingBankAccounts?.map((c, i) => (
                        <li key={i} className="flex justify-between items-center">
                          <span>{maskBankAccount(c.bankAccount)}</span>
                          <span className="text-[10px] text-slate-500 font-sans">Inv: {c.invoiceNumber || c.invoiceId}</span>
                        </li>
                      ))}
                    </ul>
                    <button
                      onClick={() => handleOpenConflictModal(sup)}
                      className="w-full py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded font-semibold text-[11px] transition-colors cursor-pointer"
                    >
                      Resolve Conflict
                    </button>
                  </div>
                )}

                {/* Supplier Details List */}
                <div className="space-y-2.5 text-xs text-slate-600">
                  {/* Bank Account */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <CreditCard className="w-4 h-4 text-slate-400 shrink-0" />
                      <span className="text-slate-500">Bank Account:</span>
                    </div>
                    {sup.bankAccount ? (
                      <span className="font-mono font-bold text-slate-800 bg-slate-50 px-2 py-0.5 rounded border border-slate-200 flex items-center gap-1" title="Masked in list view for security">
                        <Lock className="w-3 h-3 text-slate-400" />
                        {maskBankAccount(sup.bankAccount)}
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 bg-slate-100 text-slate-800 border border-slate-200 rounded text-[11px] font-medium">
                        Bank Account Missing
                      </span>
                    )}
                  </div>

                  {/* Contact Person */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Users className="w-4 h-4 text-slate-400 shrink-0" />
                      <span className="text-slate-500">Contact:</span>
                    </div>
                    {sup.contactPerson ? (
                      <span className="font-semibold text-slate-800">{sup.contactPerson}</span>
                    ) : (
                      <span className="px-2 py-0.5 bg-slate-100 text-slate-800 border border-slate-200 rounded text-[11px] font-medium">
                        Contact Person Missing
                      </span>
                    )}
                  </div>

                  {/* Email */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Mail className="w-4 h-4 text-slate-400 shrink-0" />
                      <span className="text-slate-500">Email:</span>
                    </div>
                    {sup.email ? (
                      <span className="font-mono text-slate-800 font-medium">{sup.email}</span>
                    ) : (
                      <span className="px-2 py-0.5 bg-slate-100 text-slate-800 border border-slate-200 rounded text-[11px] font-medium font-mono">
                        Email Missing
                      </span>
                    )}
                  </div>

                  {/* Phone */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Phone className="w-4 h-4 text-slate-400 shrink-0" />
                      <span className="text-slate-500">Phone:</span>
                    </div>
                    {sup.phone ? (
                      <span className="font-mono text-slate-800">{sup.phone}</span>
                    ) : (
                      <span className="px-2 py-0.5 bg-slate-100 text-slate-800 border border-slate-200 rounded text-[11px] font-medium font-mono">
                        Phone Missing
                      </span>
                    )}
                  </div>

                  {/* Office Location */}
                  <div className="flex items-start justify-between gap-2 pt-1 border-t border-slate-100">
                    <div className="flex items-center gap-2 shrink-0">
                      <Building2 className="w-4 h-4 text-slate-400 shrink-0" />
                      <span className="text-slate-500">Office:</span>
                    </div>
                    {sup.address ? (
                      <span className="text-[11px] text-slate-700 text-right">{sup.address}</span>
                    ) : (
                      <span className="px-2 py-0.5 bg-slate-100 text-slate-800 border border-slate-200 rounded text-[11px] font-medium">
                        Office Location Missing
                      </span>
                    )}
                  </div>

                  {/* Related Invoices Stat */}
                  <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100 flex items-center justify-between text-[11px] mt-2">
                    <div className="flex items-center gap-1.5 text-slate-600">
                      <FileText className="w-3.5 h-3.5 text-slate-700" />
                      <span>Related Invoices: <strong className="text-slate-900 font-mono">{invoiceCount}</strong></span>
                    </div>
                    {invoiceCount > 0 && (
                      <button
                        onClick={() => handleOpenInvoicesModal(sup)}
                        className="text-slate-900 font-semibold hover:underline flex items-center gap-1 cursor-pointer"
                      >
                        <span>View All</span>
                        <ExternalLink className="w-3 h-3" />
                      </button>
                    )}
                  </div>

                  {sup.latestInvoiceNo && (
                    <div className="text-[10px] text-slate-400 flex justify-between">
                      <span>Latest: #{sup.latestInvoiceNo} ({sup.latestInvoiceDate})</span>
                      <span>{sup.currency || 'SGD'} {sup.latestInvoiceAmount}</span>
                    </div>
                  )}

                  {sup.lastSynced && (
                    <div className="text-[10px] text-slate-400 text-right">
                      Last Synced: {sup.lastSynced}
                    </div>
                  )}
                </div>
              </div>

              {/* Card Footer Actions */}
              {canEdit && (
                <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                  <button
                    onClick={() => handleOpenInvoicesModal(sup)}
                    className="px-2.5 py-1.5 text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    <span>Invoices</span>
                  </button>

                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => handleOpenEdit(sup)}
                      className="px-3 py-1.5 text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200 rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                      <span>Edit Details</span>
                    </button>
                    <button
                      onClick={() => setDeleteConfirmSupplier(sup)}
                      className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                      title="Remove Supplier Profile"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
      )}

      {/* Add / Edit Supplier Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-lg overflow-hidden">
            <div className="p-5 bg-slate-50 border-b border-slate-200 text-slate-900 flex justify-between items-center">
              <div>
                <h3 className="font-bold text-sm text-slate-900">
                  {editingSupplier ? `Edit Supplier Profile (${editingSupplier.id})` : 'Add New Supplier Profile'}
                </h3>
                <p className="text-[11px] text-slate-600 font-medium mt-0.5">
                  Single source of truth used automatically across payment queues, emails, and notices.
                </p>
              </div>
              <button onClick={() => setModalOpen(false)} className="text-slate-400 hover:text-slate-700 cursor-pointer p-1 hover:bg-slate-200/60 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-6 space-y-4 text-xs text-slate-700">
              <div>
                <label className="block font-semibold mb-1">Company Name *</label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 text-slate-900 font-medium"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold mb-1">Contact Person</label>
                <input
                  type="text"
                  value={formContact}
                  onChange={(e) => setFormContact(e.target.value)}
                  placeholder="e.g. Accounts Payable Team"
                  className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 text-slate-900"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold mb-1">Email Address</label>
                  <input
                    type="email"
                    value={formEmail}
                    onChange={(e) => {
                      setFormEmail(e.target.value);
                      if (emailError) setEmailError('');
                    }}
                    placeholder="accounts@supplier.com"
                    className="w-full p-2.5 border border-slate-300 rounded-lg font-mono focus:ring-2 focus:ring-slate-900 text-slate-900"
                  />
                  {emailError && <p className="text-[11px] text-slate-800 mt-1 font-semibold">{emailError}</p>}
                </div>
                <div>
                  <label className="block font-semibold mb-1">Phone Number</label>
                  <input
                    type="text"
                    value={formPhone}
                    onChange={(e) => setFormPhone(e.target.value)}
                    placeholder="+65 6700 0000"
                    className="w-full p-2.5 border border-slate-300 rounded-lg font-mono focus:ring-2 focus:ring-slate-900 text-slate-900"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold mb-1 flex items-center justify-between">
                  <span>Bank Account Number</span>
                  <span className="text-[10px] text-slate-400 font-normal">Full details displayed in authorized view</span>
                </label>
                <input
                  type="text"
                  value={formBank}
                  onChange={(e) => setFormBank(e.target.value)}
                  placeholder="e.g. DBS 003-902184-1"
                  className="w-full p-2.5 border border-slate-300 rounded-lg font-mono focus:ring-2 focus:ring-slate-900 text-slate-900"
                />
              </div>

              <div>
                <label className="block font-semibold mb-1">Office Location / Address</label>
                <input
                  type="text"
                  value={formAddress}
                  onChange={(e) => setFormAddress(e.target.value)}
                  placeholder="e.g. 12 Tuas South Street 3, Singapore 638000"
                  className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 text-slate-900"
                />
              </div>

              <div>
                <label className="block font-semibold mb-1">Additional Notes</label>
                <textarea
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  placeholder="Internal notes or special credit conditions..."
                  className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 text-slate-900 h-16 resize-none"
                />
              </div>

              <div className="pt-3 flex justify-end gap-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-lg shadow-xs cursor-pointer"
                >
                  Save Supplier Details
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Conflict Resolution Modal */}
      {conflictModalOpen && conflictSupplier && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-lg overflow-hidden">
            <div className="p-5 bg-slate-900 text-white flex justify-between items-center">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-slate-300 shrink-0" />
                <h3 className="font-bold text-sm">Resolve Bank Account Conflict</h3>
              </div>
              <button onClick={() => setConflictModalOpen(false)} className="text-slate-400 hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs text-slate-700">
              <div className="p-3 bg-slate-100 border border-slate-200 rounded-xl">
                <p className="font-bold text-slate-900">Supplier: {conflictSupplier.name}</p>
                <p className="text-[11px] text-slate-600 mt-0.5">
                  Different bank accounts were found in live INVOICES rows for this supplier. Please select or enter the authoritative bank account number.
                </p>
              </div>

              <div className="space-y-2">
                <label className="block font-bold text-slate-800">Select Bank Account from Invoices:</label>
                {conflictSupplier.conflictingBankAccounts?.map((entry, idx) => (
                  <label
                    key={idx}
                    className={`p-3 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                      selectedConflictBank === entry.bankAccount && !customConflictBank
                        ? 'border-slate-900 bg-slate-100 ring-2 ring-slate-200'
                        : 'border-slate-200 bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <input
                        type="radio"
                        name="conflictBank"
                        checked={selectedConflictBank === entry.bankAccount && !customConflictBank}
                        onChange={() => {
                          setSelectedConflictBank(entry.bankAccount);
                          setCustomConflictBank('');
                        }}
                        className="text-slate-900 focus:ring-slate-900"
                      />
                      <div>
                        <p className="font-mono font-bold text-slate-900">{entry.bankAccount}</p>
                        <p className="text-[10px] text-slate-500">Invoice: #{entry.invoiceNumber || entry.invoiceId}</p>
                      </div>
                    </div>
                  </label>
                ))}
              </div>

              <div>
                <label className="block font-bold text-slate-800 mb-1">Or Enter Verified Bank Account Number:</label>
                <input
                  type="text"
                  value={customConflictBank}
                  onChange={(e) => setCustomConflictBank(e.target.value)}
                  placeholder="e.g. DBS 003-902184-1"
                  className="w-full p-2.5 border border-slate-300 rounded-lg font-mono focus:ring-2 focus:ring-slate-900 text-slate-900"
                />
              </div>

              <div className="pt-3 flex justify-end gap-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setConflictModalOpen(false)}
                  className="px-4 py-2 font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveConflictResolution}
                  className="px-4 py-2 font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-lg shadow-xs cursor-pointer"
                >
                  Save & Resolve Conflict
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Related Invoices Modal */}
      {invoicesModalOpen && selectedSupplierForInvoices && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-2xl overflow-hidden">
            <div className="p-5 bg-slate-50 border-b border-slate-200 text-slate-900 flex justify-between items-center">
              <div>
                <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                  <FileText className="w-4 h-4 text-teal-600" />
                  <span>Invoices for {selectedSupplierForInvoices.name}</span>
                </h3>
                <p className="text-[11px] text-slate-600 font-medium mt-0.5">
                  Live entries from worksheet INVOICES
                </p>
              </div>
              <button onClick={() => setInvoicesModalOpen(false)} className="text-slate-400 hover:text-slate-700 cursor-pointer p-1 hover:bg-slate-200/60 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs text-slate-700 max-h-[70vh] overflow-y-auto">
              {getRelatedInvoicesForSupplier(selectedSupplierForInvoices).length === 0 ? (
                <div className="p-8 text-center text-slate-500">
                  <FileText className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                  <p className="font-semibold">No direct live invoice rows found for this supplier name.</p>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Connect Google Sheets or run Sync Sheets to pull latest INVOICES rows.
                  </p>
                </div>
              ) : (
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <table className="w-full text-left border-collapse">
                    <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                      <tr>
                        <th className="p-3">Invoice ID</th>
                        <th className="p-3">Invoice No.</th>
                        <th className="p-3">Date</th>
                        <th className="p-3">Due Date</th>
                        <th className="p-3 text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-mono">
                      {getRelatedInvoicesForSupplier(selectedSupplierForInvoices).map((inv, idx) => (
                        <tr key={idx} className="hover:bg-slate-50">
                          <td className="p-3 text-slate-500">{inv.invoiceId}</td>
                          <td className="p-3 font-bold text-slate-900">{inv.invoiceNumber}</td>
                          <td className="p-3 text-slate-600">{inv.invoiceDate || '-'}</td>
                          <td className="p-3 text-slate-600">{inv.dueDate || '-'}</td>
                          <td className="p-3 text-right font-bold text-slate-900">
                            {inv.currency || 'SGD'} {inv.invoiceTotal}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <div className="pt-3 flex justify-end border-t border-slate-200">
                <button
                  onClick={() => setInvoicesModalOpen(false)}
                  className="px-4 py-2 font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Supplier Confirmation Modal */}
      <ConfirmModal
        isOpen={Boolean(deleteConfirmSupplier)}
        title="Remove Supplier Profile"
        message={
          deleteConfirmSupplier ? (
            <span>
              Are you sure you want to remove supplier profile <strong>'{deleteConfirmSupplier.name}'</strong>?
              <br /><br />
              Linked invoices and payment records will remain intact with 'Supplier Details Missing' label in App 3.
            </span>
          ) : ''
        }
        confirmText="Delete Supplier"
        cancelText="Cancel"
        confirmVariant="danger"
        onConfirm={() => {
          if (deleteConfirmSupplier) {
            deleteSupplier(deleteConfirmSupplier.id);
            setDeleteConfirmSupplier(null);
          }
        }}
        onCancel={() => setDeleteConfirmSupplier(null)}
      />

      {/* Reset Supplier Information for Demo Modal */}
      <ConfirmModal
        isOpen={showResetDemoModal}
        title="Reset Supplier Information for Demo"
        message={
          <span>
            Are you sure you want to reset Supplier Information profiles for demo purposes?
            <br /><br />
            <strong>What will happen:</strong>
            <ul className="list-disc pl-5 mt-1 text-slate-600 font-sans space-y-1">
              <li>All local supplier profiles in App 3 will be cleared.</li>
              <li>The live Google Sheets <strong>INVOICES</strong> worksheet will NOT be modified or deleted.</li>
              <li>You can click <strong>Refresh Live Database & Rebuild Suppliers</strong> at any time to rebuild profiles from INVOICES rows.</li>
            </ul>
          </span>
        }
        confirmText="Reset Supplier Info"
        cancelText="Cancel"
        confirmVariant="danger"
        onConfirm={handleConfirmResetDemo}
        onCancel={() => setShowResetDemoModal(false)}
      />
    </div>
  );
};
