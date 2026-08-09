import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import {
  User,
  UserRole,
  PaymentItem,
  Supplier,
  CreditNoteRefund,
  AuditLog,
  AppSettings,
  PaymentStatus,
  AnomalyType,
  EmailNotice,
  EmailNoticeRecord,
  InvoiceSheetRow,
} from '../types';
import {
  INITIAL_SUPPLIERS,
  INITIAL_PAYMENT_ITEMS,
  INITIAL_CREDIT_NOTES_REFUNDS,
  INITIAL_AUDIT_LOGS,
  INITIAL_SETTINGS,
} from '../data/initialData';
import { formatSGDate, formatSGDateTime, isDateAfter, parseDate } from '../utils/formatters';
import {
  normalizeSupplierName,
  maskBankAccount,
  mergeSuppliersFromInvoices,
} from '../utils/supplierUtils';

export const MOCK_USERS: Record<string, User> = {
  'mr boon': {
    id: 'USR-001',
    name: 'Mr Boon',
    username: 'mr boon',
    role: 'manager',
    email: 'boon.owner@company.com.sg',
    title: 'Owner / General Manager',
  },
  'mdm lim': {
    id: 'USR-002',
    name: 'Mdm Lim',
    username: 'mdm lim',
    role: 'accounts',
    email: 'lim.accounts@company.com.sg',
    title: 'Accounts Executive',
  },
};

interface AppContextType {
  currentUser: User | null;
  mfaVerified: boolean;
  simulatedDate: string; // YYYY-MM-DD
  setSimulatedDate: (date: string) => void;
  login: (username: string, pass: string) => { success: boolean; requiresMFA?: boolean; message?: string };
  verifyMFA: (otpCode: string) => boolean;
  logout: () => void;
  switchRoleQuick: (roleKey: 'mdm lim' | 'mr boon') => void;
  
  paymentItems: PaymentItem[];
  suppliers: Supplier[];
  creditNotes: CreditNoteRefund[];
  auditLogs: AuditLog[];
  emailNoticeHistory: EmailNoticeRecord[];
  settings: AppSettings;
  
  // Active navigation page
  currentPage: string;
  setCurrentPage: (page: string) => void;
  highlightedItemId: string | null;
  setHighlightedItemId: (id: string | null) => void;
  
  // Actions
  syncSheets: () => void;
  setPaymentDate: (itemId: string, paymentDateSG: string) => { success: boolean; creditLimitExceeded?: boolean; emailNotice?: EmailNotice };
  addEmailNoticeRecord: (record: Omit<EmailNoticeRecord, 'id' | 'sentAt'>) => void;
  revertPaymentDate: (itemId: string, prevDate?: string, prevStatus?: PaymentStatus) => void;
  completePayment: (itemId: string) => { success: boolean; reason?: string };
  resolveAnomaly: (
    itemId: string,
    resolutionType: 'adjust_amount' | 'cancel_duplicate' | 'approve_override',
    details?: { newAmount?: number; notes?: string }
  ) => void;
  actionAnomaly: (itemId: string, actionType: 'credit_note' | 'refund_request', reason: string) => void;
  approveCreditNoteRefund: (id: string, notes?: string) => void;
  markCreditNoteRefundAsReceived: (id: string, notes?: string) => void;
  managerOverride: (itemId: string, action: 'on_hold' | 'scheduled' | 'pending', reason: string, paymentDate?: string) => void;
  updateCashBuffer: (newBuffer: number) => void;
  updateGoogleSheetUrl: (url: string) => void;
  updateCreditNoteFollowUp: (id: string, approvalStatus: CreditNoteRefund['approvalStatus'], expectedReceiptDate: string, notes?: string) => void;
  updateSupplier: (supplier: Supplier) => void;
  addSupplier: (supplier: Supplier) => void;
  deleteSupplier: (supplierId: string) => void;
  processInvoicesForSuppliers: (invoiceRows: InvoiceSheetRow[]) => void;
  resetSuppliersForDemo: () => void;
  rebuildSuppliersFromInvoices: (invoiceRows: InvoiceSheetRow[]) => void;
  resolveBankAccountConflict: (supplierId: string, chosenBankAccount: string) => void;
  addAuditLog: (actionType: AuditLog['actionType'], description: string, meta?: Record<string, any>) => void;
  clearLocalPaymentQueue: () => void;
  updateSettings: (newSettings: Partial<AppSettings>) => void;
  
  // Helper getters
  getSupplierById: (id: string) => Supplier | undefined;
  getSupplierByName: (name: string) => Supplier | undefined;
  checkPasswordReentry: (userId: string, pass: string) => boolean;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

const LOCAL_STORAGE_KEY = 'supplier_payments_app_v4_empty';

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // User starts unauthenticated requiring login first
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [mfaVerified, setMfaVerified] = useState<boolean>(true);
  const [simulatedDate, setSimulatedDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [currentPage, setCurrentPage] = useState<string>('home');
  const [highlightedItemId, setHighlightedItemId] = useState<string | null>(null);

  const [paymentItems, setPaymentItems] = useState<PaymentItem[]>(INITIAL_PAYMENT_ITEMS);
  const [suppliers, setSuppliers] = useState<Supplier[]>(INITIAL_SUPPLIERS);
  const [creditNotes, setCreditNotes] = useState<CreditNoteRefund[]>(INITIAL_CREDIT_NOTES_REFUNDS);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>(INITIAL_AUDIT_LOGS);
  const [emailNoticeHistory, setEmailNoticeHistory] = useState<EmailNoticeRecord[]>([]);
  const [settings, setSettings] = useState<AppSettings>(INITIAL_SETTINGS);

  // Load from LocalStorage if exists
  useEffect(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.paymentItems) setPaymentItems(parsed.paymentItems);
        if (parsed.suppliers) setSuppliers(parsed.suppliers);
        if (parsed.creditNotes) setCreditNotes(parsed.creditNotes);
        if (parsed.auditLogs) setAuditLogs(parsed.auditLogs);
        if (parsed.emailNoticeHistory) setEmailNoticeHistory(parsed.emailNoticeHistory);
        if (parsed.settings) setSettings(parsed.settings);
      }
    } catch (e) {
      console.error('Failed to load local state', e);
    }
  }, []);

  // Save to LocalStorage
  const saveState = (updated: Partial<{
    paymentItems: PaymentItem[];
    suppliers: Supplier[];
    creditNotes: CreditNoteRefund[];
    auditLogs: AuditLog[];
    emailNoticeHistory: EmailNoticeRecord[];
    settings: AppSettings;
  }>) => {
    try {
      const currentState = {
        paymentItems: updated.paymentItems || paymentItems,
        suppliers: updated.suppliers || suppliers,
        creditNotes: updated.creditNotes || creditNotes,
        auditLogs: updated.auditLogs || auditLogs,
        emailNoticeHistory: updated.emailNoticeHistory || emailNoticeHistory,
        settings: updated.settings || settings,
      };
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(currentState));
    } catch (e) {
      console.error('Failed to save state', e);
    }
  };

  const addAuditLog = (actionType: AuditLog['actionType'], description: string, meta?: Record<string, any>) => {
    const user = currentUser ? currentUser.name : 'System';
    const role = currentUser ? currentUser.role : 'accounts';
    
    const newLog: AuditLog = {
      id: `LOG-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      timestamp: formatSGDateTime(new Date()),
      user,
      userRole: role,
      actionType,
      description,
      metadata: meta,
    };

    setAuditLogs(prev => {
      const next = [newLog, ...prev];
      saveState({ auditLogs: next });
      return next;
    });
  };

  const login = (username: string, pass: string) => {
    const cleanUser = username.trim().toLowerCase();
    let userToAuth: User | null = null;

    if (cleanUser === 'mr boon' || cleanUser === 'usr-001' || cleanUser === 'boon.owner@company.com.sg') {
      userToAuth = MOCK_USERS['mr boon'];
    } else if (cleanUser === 'mdm lim' || cleanUser === 'usr-002' || cleanUser === 'lim.accounts@company.com.sg') {
      userToAuth = MOCK_USERS['mdm lim'];
    }

    if (userToAuth && pass === 'demo123') {
      setCurrentUser(userToAuth);
      setMfaVerified(true);
      addAuditLog('login', `User ${userToAuth.name} (${userToAuth.role}) successfully logged in.`);
      setCurrentPage('home');
      return { success: true };
    }
    return { success: false, message: 'Invalid User ID or Password. Please enter a valid account ID (e.g. "mdm lim" or "mr boon") with password "demo123".' };
  };

  const verifyMFA = (otpCode: string) => {
    // Accepts any 6-digit code or demo 123456
    if (otpCode.length === 6) {
      setMfaVerified(true);
      addAuditLog('login', `User ${currentUser?.name} successfully authenticated via MFA.`);
      setCurrentPage('home');
      return true;
    }
    return false;
  };

  const logout = () => {
    if (currentUser) {
      addAuditLog('login', `User ${currentUser.name} logged out.`);
    }
    setCurrentUser(null);
    setMfaVerified(false);
    setCurrentPage('login');
  };

  const switchRoleQuick = (roleKey: 'mdm lim' | 'mr boon') => {
    // Requires logging out to re-enter credentials for the specified user
    logout();
  };

  const checkPasswordReentry = (userId: string, pass: string) => {
    const cleanId = userId.trim().toLowerCase();
    const cleanPass = pass.trim();
    // Validates that the re-authentication ID matches Mr Boon's manager account and password matches demo123
    const isMrBoon = cleanId === 'mr boon' || cleanId === 'usr-001' || cleanId === 'boon.owner@company.com.sg';
    return isMrBoon && cleanPass === 'demo123';
  };

  const getSupplierById = (id: string) => suppliers.find(s => s.id === id && !s.isRemoved);
  const getSupplierByName = (name: string) => {
    if (!name) return undefined;
    const norm = normalizeSupplierName(name);
    const exact = suppliers.find(s => !s.isRemoved && normalizeSupplierName(s.name) === norm);
    if (exact) return exact;
    const partial = suppliers.find(s => !s.isRemoved && (normalizeSupplierName(s.name).includes(norm) || norm.includes(normalizeSupplierName(s.name))));
    return partial;
  };

  const syncSheets = () => {
    const timestamp = formatSGDateTime(new Date());
    const updatedSettings = { ...settings, lastSyncedAt: timestamp };
    setSettings(updatedSettings);

    addAuditLog('sheets_sync', `Manual Google Sheet synchronization completed. Refreshed payment queue from tab 'PaymentQueue'.`);
    saveState({ settings: updatedSettings });
  };

  const updateGoogleSheetUrl = (url: string) => {
    const updatedSettings = { ...settings, googleSheetUrl: url };
    setSettings(updatedSettings);
    addAuditLog('sheets_sync', `Updated connected Google Sheet URL to: ${url}`);
    saveState({ settings: updatedSettings });
  };

  const setPaymentDate = (itemId: string, paymentDateSG: string) => {
    const item = paymentItems.find(p => p.id === itemId);
    if (!item) return { success: false };

    const supplier = getSupplierById(item.supplierId) || getSupplierByName(item.supplierName);
    const updatedItems = paymentItems.map(p => {
      if (p.id === itemId) {
        return {
          ...p,
          paymentDate: paymentDateSG,
          status: 'scheduled' as PaymentStatus,
          lastUpdated: formatSGDateTime(new Date()),
        };
      }
      return p;
    });

    setPaymentItems(updatedItems);
    addAuditLog('payment_date', `Scheduled payment date ${paymentDateSG} for Invoice ${item.invoiceNo} (${item.supplierName}) - Amount: S$${item.amount.toLocaleString()}.`, {
      itemId,
      invoiceNo: item.invoiceNo,
      paymentDate: paymentDateSG,
      amount: item.amount,
    });

    saveState({ paymentItems: updatedItems });

    // Check if credit limit / terms exceeded
    const isExceeded = isDateAfter(paymentDateSG, item.dueDate);
    let emailNotice: EmailNotice | undefined = undefined;

    if (isExceeded && supplier) {
      emailNotice = {
        toEmail: supplier.email,
        supplierName: supplier.name,
        invoiceNo: item.invoiceNo,
        amount: item.amount,
        originalDueDate: item.dueDate,
        proposedPaymentDate: paymentDateSG,
        reason: 'Cash flow scheduling alignment',
        bodyText: `Dear ${supplier.contactPerson || 'Accounts Team'},\n\n` +
          `Regarding Invoice ${item.invoiceNo} (Amount: S$${item.amount.toFixed(2)}), originally due on ${item.dueDate}.\n` +
          `Please be informed that our scheduled payment date is set for ${paymentDateSG}.\n\n` +
          `Reason: Internal cash flow and batch processing schedule.\n\n` +
          `We appreciate your understanding and continued partnership.\n\n` +
          `Best regards,\n${currentUser?.name || 'Accounts Department'}\nCompany Finance Team`,
      };
    }

    return {
      success: true,
      creditLimitExceeded: isExceeded,
      emailNotice,
    };
  };

  const revertPaymentDate = (itemId: string, prevDate?: string, prevStatus?: PaymentStatus) => {
    const updatedItems = paymentItems.map(p => {
      if (p.id === itemId) {
        return {
          ...p,
          paymentDate: prevDate,
          status: prevStatus || 'pending',
          lastUpdated: formatSGDateTime(new Date()),
        };
      }
      return p;
    });
    setPaymentItems(updatedItems);
    addAuditLog('payment_date', `Reverted payment schedule for Invoice ID ${itemId}.`);
    saveState({ paymentItems: updatedItems });
  };

  const completePayment = (itemId: string): { success: boolean; reason?: string } => {
    const item = paymentItems.find(p => p.id === itemId);
    if (!item) return { success: false, reason: 'Payment record not found.' };

    // 1. Check if item has an unresolved anomaly
    if (item.anomaly !== 'none' || item.status === 'on_hold') {
      addAuditLog(
        'PAYMENT_HELD_FOR_ANOMALY',
        `Blocked payment completion for Invoice ${item.invoiceNo} (${item.supplierName}) due to unresolved anomaly (${item.anomaly || 'on hold'}). Status remains On Hold – Anomaly Review.`,
        { itemId, invoiceNo: item.invoiceNo, supplier: item.supplierName, anomaly: item.anomaly, status: item.status }
      );
      return {
        success: false,
        reason: 'Payment cannot be completed because it has an unresolved anomaly currently On Hold – Anomaly Review.',
      };
    }

    // 2. Check for Duplicate Payment against completed records
    const hasAlreadyBeenPaid = paymentItems.some(
      p => p.id !== item.id && p.invoiceNo.trim().toLowerCase() === item.invoiceNo.trim().toLowerCase() && (p.status === 'completed' || p.status === 'paid')
    );
    if (hasAlreadyBeenPaid || item.previousPaymentDate) {
      const updatedItems = paymentItems.map(p => {
        if (p.id === itemId) {
          return {
            ...p,
            anomaly: 'duplicate_payment' as AnomalyType,
            status: 'on_hold' as PaymentStatus,
            anomalyReason: `Invoice ID ${item.invoiceNo} has already been paid previously. Re-paying this record is blocked as a Possible Duplicate Payment.`,
            withheldReason: 'On Hold – Anomaly Review: Possible Duplicate Payment detected.',
            lastUpdated: formatSGDateTime(new Date()),
          };
        }
        return p;
      });
      setPaymentItems(updatedItems);
      addAuditLog(
        'DUPLICATE_PAYMENT_DETECTED',
        `Detected duplicate payment attempt for Invoice ${item.invoiceNo} (${item.supplierName}). Previous completed payment record detected. Payment blocked and set to On Hold – Anomaly Review.`,
        { itemId, invoiceNo: item.invoiceNo, supplier: item.supplierName, anomalyType: 'duplicate_payment', previousStatus: item.status, newStatus: 'on_hold' }
      );
      addAuditLog(
        'PAYMENT_HELD_FOR_ANOMALY',
        `Payment held for Invoice ${item.invoiceNo} due to DUPLICATE_PAYMENT_DETECTED.`,
        { itemId, invoiceNo: item.invoiceNo, supplier: item.supplierName }
      );
      saveState({ paymentItems: updatedItems });
      return {
        success: false,
        reason: 'Possible Duplicate Payment detected. The same invoice has already been paid previously. Record placed On Hold – Anomaly Review.',
      };
    }

    // 3. Check if Proposed Amount > Approved Invoice Amount
    if (item.approvedInvoiceAmount && item.amount > item.approvedInvoiceAmount) {
      const diff = item.amount - item.approvedInvoiceAmount;
      const updatedItems = paymentItems.map(p => {
        if (p.id === itemId) {
          return {
            ...p,
            anomaly: 'amount_exceeded' as AnomalyType,
            status: 'on_hold' as PaymentStatus,
            anomalyReason: `Proposed payment amount (S$${item.amount.toFixed(2)}) exceeds approved invoice total (S$${item.approvedInvoiceAmount?.toFixed(2)}) by S$${diff.toFixed(2)}.`,
            withheldReason: 'On Hold – Anomaly Review: Proposed Payment Amount Exceeds Approved Invoice Amount.',
            lastUpdated: formatSGDateTime(new Date()),
          };
        }
        return p;
      });
      setPaymentItems(updatedItems);
      addAuditLog(
        'PAYMENT_AMOUNT_EXCEEDED',
        `Proposed payment amount S$${item.amount.toFixed(2)} exceeds approved invoice total S$${item.approvedInvoiceAmount.toFixed(2)} by S$${diff.toFixed(2)} for Invoice ${item.invoiceNo} (${item.supplierName}). Payment blocked and set to On Hold – Anomaly Review.`,
        { itemId, invoiceNo: item.invoiceNo, supplier: item.supplierName, anomalyType: 'amount_exceeded', previousStatus: item.status, newStatus: 'on_hold' }
      );
      addAuditLog(
        'PAYMENT_HELD_FOR_ANOMALY',
        `Payment held for Invoice ${item.invoiceNo} due to PAYMENT_AMOUNT_EXCEEDED.`,
        { itemId, invoiceNo: item.invoiceNo, supplier: item.supplierName }
      );
      saveState({ paymentItems: updatedItems });
      return {
        success: false,
        reason: `Proposed payment amount (S$${item.amount.toFixed(2)}) exceeds approved invoice amount (S$${item.approvedInvoiceAmount.toFixed(2)}). Record placed On Hold – Anomaly Review.`,
      };
    }

    // Automatic Bank Balance Deduction
    const newBankBalance = settings.bankBalance - item.amount;
    const updatedSettings = {
      ...settings,
      bankBalance: newBankBalance,
    };

    const todaySG = formatSGDate(new Date());

    const updatedItems = paymentItems.map(p => {
      if (p.id === itemId) {
        return {
          ...p,
          status: 'completed' as PaymentStatus,
          paymentDate: p.paymentDate || todaySG,
          lastUpdated: formatSGDateTime(new Date()),
        };
      }
      return p;
    });

    setSettings(updatedSettings);
    setPaymentItems(updatedItems);

    addAuditLog(
      'payment_completed',
      `Marked payment for Invoice ${item.invoiceNo} (${item.supplierName}) - S$${item.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })} as Payment Completed. Deducted S$${item.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })} from bank balance. Moved to Payment Archives.`,
      { itemId, invoiceNo: item.invoiceNo, amount: item.amount, newBankBalance }
    );

    saveState({ paymentItems: updatedItems, settings: updatedSettings });
    return { success: true };
  };

  const resolveAnomaly = (
    itemId: string,
    resolutionType: 'adjust_amount' | 'cancel_duplicate' | 'approve_override',
    details?: { newAmount?: number; notes?: string }
  ) => {
    const item = paymentItems.find(p => p.id === itemId);
    if (!item) return;

    let updatedItems = paymentItems;

    if (resolutionType === 'cancel_duplicate') {
      updatedItems = paymentItems.filter(p => p.id !== itemId);
      addAuditLog(
        'status_change',
        `Resolved anomaly for Invoice ${item.invoiceNo} (${item.supplierName}): Cancelled duplicate active payment record from Payment Queue.`,
        { itemId, invoiceNo: item.invoiceNo, supplier: item.supplierName, resolution: 'cancel_duplicate' }
      );
    } else if (resolutionType === 'adjust_amount') {
      const adjustedAmount = details?.newAmount || item.approvedInvoiceAmount || item.matchedPoAmount;
      updatedItems = paymentItems.map(p => {
        if (p.id === itemId) {
          return {
            ...p,
            amount: adjustedAmount,
            anomaly: 'none' as AnomalyType,
            anomalyReason: undefined,
            withheldReason: undefined,
            status: 'pending' as PaymentStatus,
            lastUpdated: formatSGDateTime(new Date()),
          };
        }
        return p;
      });
      addAuditLog(
        'status_change',
        `Resolved anomaly for Invoice ${item.invoiceNo} (${item.supplierName}): Adjusted payment amount to approved total S$${adjustedAmount.toFixed(2)}. Anomaly hold released.`,
        { itemId, invoiceNo: item.invoiceNo, supplier: item.supplierName, newAmount: adjustedAmount, resolution: 'adjust_amount' }
      );
    } else if (resolutionType === 'approve_override') {
      updatedItems = paymentItems.map(p => {
        if (p.id === itemId) {
          return {
            ...p,
            anomaly: 'none' as AnomalyType,
            anomalyReason: undefined,
            withheldReason: undefined,
            status: 'pending' as PaymentStatus,
            lastUpdated: formatSGDateTime(new Date()),
          };
        }
        return p;
      });
      addAuditLog(
        'MANAGER_OVERRIDE_APPROVED',
        `Manager override approved for Invoice ${item.invoiceNo} (${item.supplierName}). Anomaly hold released by ${currentUser?.name || 'Manager'}. Notes: ${details?.notes || 'Reviewed and approved'}`,
        { itemId, invoiceNo: item.invoiceNo, supplier: item.supplierName, resolution: 'approve_override', notes: details?.notes }
      );
    }

    setPaymentItems(updatedItems);
    saveState({ paymentItems: updatedItems });
  };

  const actionAnomaly = (itemId: string, actionType: 'credit_note' | 'refund_request', reason: string) => {
    const item = paymentItems.find(p => p.id === itemId);
    if (!item) return;

    const supplier = getSupplierById(item.supplierId) || getSupplierByName(item.supplierName);
    const supplierEmail = supplier ? supplier.email : 'accounts@supplier.com.sg';

    const docPrefix = actionType === 'credit_note' ? 'CN' : 'RF';
    const docNumber = `${docPrefix}-${new Date().getFullYear()}-${String(creditNotes.length + 1).padStart(4, '0')}`;
    const todaySG = formatSGDate(new Date());

    const newDoc: CreditNoteRefund = {
      id: `CNR-${Date.now()}`,
      type: actionType,
      docNumber,
      invoiceNo: item.invoiceNo,
      supplierId: item.supplierId,
      supplierName: item.supplierName,
      supplierEmail,
      amount: item.amount,
      reason,
      requestedDate: todaySG,
      issueDate: todaySG,
      status: 'pending_approval',
      approvalStatus: 'pending_approval',
      createdBy: currentUser?.name || 'Accounts Executive',
      assignedUser: currentUser?.name || 'Accounts Executive',
      remarks: reason,
      assignedActions: [
        {
          id: `ACT-${Date.now()}-1`,
          step: 'Submit Request & Validation',
          assignedTo: `${currentUser?.name || 'Accounts'}`,
          status: 'completed',
          updatedAt: formatSGDateTime(new Date()),
          notes: `Submitted ${actionType === 'credit_note' ? 'Request Credit Note' : 'Request Refund'} for Invoice ${item.invoiceNo}.`,
        },
        {
          id: `ACT-${Date.now()}-2`,
          step: 'Authorised Approver Review',
          assignedTo: 'Authorised Approver / Manager',
          status: 'in_progress',
          updatedAt: formatSGDateTime(new Date()),
          notes: 'Approval Status: Pending Approval',
        },
        {
          id: `ACT-${Date.now()}-3`,
          step: 'Credit Offset / Refund Clearance',
          assignedTo: 'Finance Operations',
          status: 'pending',
          notes: 'Awaiting request approval.',
        }
      ],
    };

    const updatedCreditNotes = [newDoc, ...creditNotes];

    // Remove from flagged anomalies list by clearing anomaly flag and withholding payment
    const updatedItems = paymentItems.map(p => {
      if (p.id === itemId) {
        return {
          ...p,
          status: 'withheld' as PaymentStatus,
          anomaly: 'none' as AnomalyType,
          anomalyReason: `[${actionType === 'credit_note' ? 'Credit Note Requested' : 'Refund Requested'} - Pending Approval] ${reason}`,
          lastUpdated: formatSGDateTime(new Date()),
        };
      }
      return p;
    });

    setCreditNotes(updatedCreditNotes);
    setPaymentItems(updatedItems);

    const docTitle = actionType === 'credit_note' ? 'Credit Note Request' : 'Refund Request';
    addAuditLog(
      actionType === 'credit_note' ? 'credit_note' : 'refund_request',
      `Submitted ${docTitle} ${docNumber} for Invoice ${item.invoiceNo} (${item.supplierName}) - Amount S$${item.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}. Status: Pending Approval. Reason: ${reason}`,
      { docNumber, itemId, invoiceNo: item.invoiceNo, amount: item.amount, status: 'pending_approval' }
    );

    saveState({
      creditNotes: updatedCreditNotes,
      paymentItems: updatedItems,
    });
  };

  const approveCreditNoteRefund = (id: string, notes?: string) => {
    const todaySG = formatSGDate(new Date());
    const doc = creditNotes.find(c => c.id === id);
    if (!doc) return;

    const updatedCreditNotes = creditNotes.map((cn) => {
      if (cn.id === id) {
        return {
          ...cn,
          status: 'approved' as const,
          approvalStatus: 'approved' as const,
          isApproved: true,
          approvedBy: currentUser?.name || 'Mr Boon (Manager)',
          approvedDate: todaySG,
          remarks: notes || cn.remarks,
        };
      }
      return cn;
    });

    setCreditNotes(updatedCreditNotes);
    addAuditLog(
      doc.type === 'credit_note' ? 'credit_note' : 'refund_request',
      `Approved ${doc.type === 'credit_note' ? 'Credit Note Request' : 'Refund Request'} ${doc.docNumber} (Invoice ${doc.invoiceNo}). Status updated to Approved.`
    );
    saveState({ creditNotes: updatedCreditNotes });
  };

  const markCreditNoteRefundAsReceived = (id: string, notes?: string) => {
    const doc = creditNotes.find(c => c.id === id);
    if (!doc) return;

    const todaySG = formatSGDate(new Date());
    let newBalance = settings.bankBalance;
    let updatedSettings = settings;

    // For Refunds: Increase bank balance by refund amount
    if (doc.type === 'refund_request') {
      newBalance = settings.bankBalance + doc.amount;
      updatedSettings = { ...settings, bankBalance: newBalance };
      setSettings(updatedSettings);
    }

    const updatedCreditNotes = creditNotes.map(c => {
      if (c.id === id) {
        return {
          ...c,
          status: 'received' as const,
          approvalStatus: 'received' as const,
          receivedDate: todaySG,
          receivedBy: currentUser?.name || 'Accounts Executive',
          remarks: notes || c.remarks,
        };
      }
      return c;
    });

    setCreditNotes(updatedCreditNotes);

    if (doc.type === 'refund_request') {
      addAuditLog(
        'refund_request',
        `Marked Refund Request ${doc.docNumber} (Invoice ${doc.invoiceNo}) as Received. Bank balance increased by S$${doc.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}. New Bank Balance: S$${newBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}.`
      );
    } else {
      addAuditLog(
        'credit_note',
        `Marked Credit Note ${doc.docNumber} (Invoice ${doc.invoiceNo}) as Received. Document marked as received (no cash balance adjustment).`
      );
    }

    saveState({ creditNotes: updatedCreditNotes, settings: updatedSettings });
  };

  const updateCreditNoteFollowUp = (
    id: string,
    approvalStatus: CreditNoteRefund['approvalStatus'],
    expectedReceiptDate: string,
    notes?: string
  ) => {
    let affectedInvoiceNo = '';
    let affectedType: 'credit_note' | 'refund_request' = 'credit_note';
    const todaySG = formatSGDate(new Date());

    const updated = creditNotes.map((cn) => {
      if (cn.id === id) {
        affectedInvoiceNo = cn.invoiceNo;
        affectedType = cn.type;
        const newStatus = approvalStatus || cn.status;
        return {
          ...cn,
          status: newStatus,
          approvalStatus: newStatus,
          isApproved: newStatus === 'approved' || newStatus === 'received',
          approvedBy: newStatus === 'approved' || newStatus === 'received' ? (cn.approvedBy || currentUser?.name || 'Authorised Approver') : undefined,
          approvedDate: newStatus === 'approved' || newStatus === 'received' ? (cn.approvedDate || todaySG) : undefined,
          expectedReceiptDate,
          remarks: notes || cn.remarks,
        };
      }
      return cn;
    });

    setCreditNotes(updated);
    addAuditLog(
      'credit_note',
      `Updated ${affectedType === 'credit_note' ? 'Credit Note' : 'Refund'} request ${id}: Status updated to ${approvalStatus}. Expected Receipt=${expectedReceiptDate}`
    );
    saveState({ creditNotes: updated });
  };

  const managerOverride = (
    itemId: string,
    action: 'on_hold' | 'scheduled' | 'pending',
    reason: string,
    paymentDate?: string
  ) => {
    const item = paymentItems.find(p => p.id === itemId);
    if (!item) return;

    const updatedItems = paymentItems.map(p => {
      if (p.id === itemId) {
        return {
          ...p,
          status: action === 'scheduled' ? ('scheduled' as PaymentStatus) : action === 'on_hold' ? ('on_hold' as PaymentStatus) : ('pending' as PaymentStatus),
          paymentDate: paymentDate || p.paymentDate,
          withheldReason: reason ? `Review Action: ${reason}` : p.withheldReason,
          lastUpdated: formatSGDateTime(new Date()),
        };
      }
      return p;
    });

    setPaymentItems(updatedItems);

    const actionText = action === 'scheduled' ? `Approved & Scheduled payment` : action === 'on_hold' ? `Placed on Hold` : `Returned to Pending queue`;
    addAuditLog('manager_override', `${currentUser?.name || 'User'} performed Review Override on Invoice ${item.invoiceNo} (${item.supplierName}): ${actionText}. Note: ${reason}`, {
      itemId,
      invoiceNo: item.invoiceNo,
      action,
      reason,
    });

    saveState({ paymentItems: updatedItems });
  };

  const updateCashBuffer = (newBuffer: number) => {
    const oldBuffer = settings.cashBuffer;
    const updatedSettings = { ...settings, cashBuffer: newBuffer };

    // Re-evaluate withheld payments against new buffer
    const availableCash = settings.bankBalance - newBuffer;
    const updatedItems = paymentItems.map(p => {
      if (p.status === 'withheld' && p.amount <= availableCash && p.anomaly === 'none') {
        return {
          ...p,
          status: 'pending' as PaymentStatus,
          withheldReason: undefined,
          lastUpdated: formatSGDateTime(new Date()),
        };
      }
      return p;
    });

    setSettings(updatedSettings);
    setPaymentItems(updatedItems);

    addAuditLog('cash_buffer_change', `Minimum cash buffer updated from S$${oldBuffer.toLocaleString()} to S$${newBuffer.toLocaleString()} following Mr Boon manager authorization.`, {
      oldBuffer,
      newBuffer,
    });

    saveState({
      settings: updatedSettings,
      paymentItems: updatedItems,
    });
  };

  const updateSupplier = (updatedSup: Supplier) => {
    const prevSup = suppliers.find((s) => s.id === updatedSup.id);
    const bankAccChanged = prevSup && prevSup.bankAccount !== updatedSup.bankAccount;

    const next = suppliers.map((s) => (s.id === updatedSup.id ? updatedSup : s));
    setSuppliers(next);

    if (bankAccChanged) {
      addAuditLog(
        'SUPPLIER_BANK_ACCOUNT_UPDATED',
        `Updated bank account for supplier '${updatedSup.name}' from '${prevSup?.bankAccount ? maskBankAccount(prevSup.bankAccount) : 'None'}' to '${maskBankAccount(updatedSup.bankAccount)}'.`,
        { supplierId: updatedSup.id, supplierName: updatedSup.name }
      );
    } else {
      addAuditLog(
        'SUPPLIER_DETAILS_UPDATED',
        `Updated details for supplier '${updatedSup.name}'.`,
        { supplierId: updatedSup.id, supplierName: updatedSup.name }
      );
    }
    saveState({ suppliers: next });
  };

  const addSupplier = (newSup: Supplier) => {
    const next = [...suppliers, newSup];
    setSuppliers(next);
    addAuditLog(
      'SUPPLIER_DETAILS_ADDED',
      `Manually added new supplier profile '${newSup.name}' (Bank Account: ${newSup.bankAccount ? maskBankAccount(newSup.bankAccount) : 'None'}).`,
      { supplierId: newSup.id, supplierName: newSup.name }
    );
    saveState({ suppliers: next });
  };

  const deleteSupplier = (supplierId: string) => {
    const sup = suppliers.find((s) => s.id === supplierId);
    const next = suppliers.map((s) => (s.id === supplierId ? { ...s, isRemoved: true } : s));
    setSuppliers(next);
    if (sup) {
      addAuditLog(
        'SUPPLIER_REMOVED',
        `Removed supplier directory entry for '${sup.name}'. Linked invoices and payment records remain intact with 'Supplier Details Missing' label.`,
        { supplierId: sup.id, supplierName: sup.name }
      );
    }
    saveState({ suppliers: next });
  };

  const processInvoicesForSuppliers = (invoiceRows: InvoiceSheetRow[]) => {
    if (!invoiceRows || invoiceRows.length === 0) return;
    setSuppliers((prevSuppliers) => {
      const merged = mergeSuppliersFromInvoices(prevSuppliers, invoiceRows, addAuditLog);
      saveState({ suppliers: merged });
      return merged;
    });
  };

  const resolveBankAccountConflict = (supplierId: string, chosenBankAccount: string) => {
    const sup = suppliers.find((s) => s.id === supplierId);
    if (!sup) return;

    const updatedSup: Supplier = {
      ...sup,
      bankAccount: chosenBankAccount,
      hasBankConflict: false,
      conflictingBankAccounts: [],
      manuallySetBankAcc: true,
    };

    const next = suppliers.map((s) => (s.id === supplierId ? updatedSup : s));
    setSuppliers(next);

    addAuditLog(
      'SUPPLIER_BANK_ACCOUNT_CONFLICT_RESOLVED',
      `Resolved bank account conflict for supplier '${sup.name}'. Selected bank account: ${maskBankAccount(chosenBankAccount)}.`,
      { supplierId: sup.id, supplierName: sup.name, chosenBankAccount }
    );

    saveState({ suppliers: next });
  };

  const addEmailNoticeRecord = (record: Omit<EmailNoticeRecord, 'id' | 'sentAt'>) => {
    const newRecord: EmailNoticeRecord = {
      ...record,
      id: `ENR-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      sentAt: formatSGDateTime(new Date()),
    };
    const nextHistory = [newRecord, ...emailNoticeHistory];
    setEmailNoticeHistory(nextHistory);
    addAuditLog('payment_date', `Generated & sent payment credit delay notice email to ${record.supplierName} (${record.toEmail}) for Invoice ${record.invoiceNo}. Reason: ${record.reasonSelected}`);
    saveState({ emailNoticeHistory: nextHistory });
  };

  const resetSuppliersForDemo = () => {
    setSuppliers([]);
    addAuditLog(
      'SUPPLIER_INFORMATION_DEMO_RESET',
      `Reset Supplier Information directory for demo. Cleared all supplier profiles from App 3 without modifying INVOICES worksheet.`
    );
    saveState({ suppliers: [] });
  };

  const rebuildSuppliersFromInvoices = (invoiceRows: InvoiceSheetRow[]) => {
    if (!invoiceRows || invoiceRows.length === 0) {
      setSuppliers([]);
      addAuditLog(
        'SUPPLIER_INFORMATION_REBUILT',
        `Rebuilt Supplier Information: No data rows found in INVOICES worksheet.`
      );
      saveState({ suppliers: [] });
      return;
    }
    const rebuilt = mergeSuppliersFromInvoices([], invoiceRows, addAuditLog);
    setSuppliers(rebuilt);
    addAuditLog(
      'SUPPLIER_INFORMATION_REBUILT',
      `Rebuilt ${rebuilt.length} supplier profile(s) from live INVOICES worksheet.`
    );
    saveState({ suppliers: rebuilt });
  };

  const clearLocalPaymentQueue = () => {
    setPaymentItems([]);
    addAuditLog('PAYMENT_QUEUE_CLEARED', 'Cleared local payment queue data records following PAYMENT_QUEUE worksheet clear.');
    saveState({ paymentItems: [] });
  };

  const updateSettings = (newSettings: Partial<AppSettings>) => {
    setSettings((prev) => {
      const updated = { ...prev, ...newSettings };
      saveState({ settings: updated });
      return updated;
    });
  };

  return (
    <AppContext.Provider
      value={{
        currentUser,
        mfaVerified,
        simulatedDate,
        setSimulatedDate,
        login,
        verifyMFA,
        logout,
        switchRoleQuick,
        paymentItems,
        suppliers,
        creditNotes,
        auditLogs,
        emailNoticeHistory,
        settings,
        currentPage,
        setCurrentPage,
        highlightedItemId,
        setHighlightedItemId,
        syncSheets,
        setPaymentDate,
        addEmailNoticeRecord,
        revertPaymentDate,
        completePayment,
        resolveAnomaly,
        actionAnomaly,
        approveCreditNoteRefund,
        markCreditNoteRefundAsReceived,
        managerOverride,
        updateCashBuffer,
        updateGoogleSheetUrl,
        updateCreditNoteFollowUp,
        updateSupplier,
        addSupplier,
        deleteSupplier,
        processInvoicesForSuppliers,
        resetSuppliersForDemo,
        rebuildSuppliersFromInvoices,
        resolveBankAccountConflict,
        addAuditLog,
        clearLocalPaymentQueue,
        updateSettings,
        getSupplierById,
        getSupplierByName,
        checkPasswordReentry,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
