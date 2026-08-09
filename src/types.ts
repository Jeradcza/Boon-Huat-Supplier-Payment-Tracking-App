export type UserRole = 'manager' | 'accounts';

export interface User {
  id: string;
  name: string;
  username: string;
  role: UserRole;
  email: string;
  title: string;
}

export type PaymentStatus = 
  | 'pending'      // Pending scheduling
  | 'scheduled'    // Date set
  | 'flagged'      // Anomaly detected
  | 'withheld'     // Withheld by buffer constraint or anomaly
  | 'on_hold'      // Put on hold by manager
  | 'completed';   // Marked as completed/paid in ledger

export type AnomalyType = 
  | 'none'
  | 'duplicate_payment'           // Possible Duplicate Payment
  | 'amount_exceeded'              // Payment Amount Exceeds Approved Invoice Amount
  | 'multiple_active_records'      // Multiple Payment Records Detected
  | 'duplicate'                    // legacy alias
  | 'incorrect_amount'             // legacy alias
  | 'overpayment';                 // legacy alias

export interface PaymentItem {
  id: string;
  invoiceNo: string;
  poNo: string;
  grnNo: string;
  supplierId: string;
  supplierName: string;
  amount: number;
  approvedInvoiceAmount?: number;
  matchedPoAmount: number;
  matchedGrnAmount: number;
  invoiceDate: string; // DD/MM/YYYY
  dueDate: string;     // DD/MM/YYYY
  paymentDate: string | null; // DD/MM/YYYY
  status: PaymentStatus;
  anomaly: AnomalyType;
  anomalyReason?: string;
  previousPaymentDate?: string;
  previousPaymentRef?: string;
  isDiscoveredAfterPayment?: boolean;
  withheldReason?: string;
  creditTermsDays: number;
  lastUpdated: string;
}

export interface ConflictingBankAccount {
  bankAccount: string;
  invoiceId: string;
  invoiceNumber: string;
  invoiceDate?: string;
  invoiceTotal?: string;
}

export interface Supplier {
  id: string;
  name: string;
  contactPerson: string;
  email: string;
  phone: string;
  creditTermsDays: number;
  bankAccount: string;
  address: string;
  notes?: string;
  bankName?: string;
  swiftCode?: string;
  creditLimit?: number;
  currentOutstanding?: number;
  paymentTerms?: string;

  // Supplier Information Directory fields
  invoiceCount?: number;
  latestInvoiceNo?: string;
  latestInvoiceDate?: string;
  latestInvoiceAmount?: string;
  currency?: string;
  lastSynced?: string;

  hasBankConflict?: boolean;
  conflictingBankAccounts?: ConflictingBankAccount[];
  manuallySetBankAcc?: boolean;
  isManualOnly?: boolean;
  isRemoved?: boolean;
}

export interface CreditNoteFollowUpAction {
  id: string;
  step: string;
  assignedTo: string;
  status: 'completed' | 'in_progress' | 'pending';
  updatedAt?: string;
  notes?: string;
}

export type CreditNoteStatus = 'pending_approval' | 'approved' | 'received' | 'rejected';

export interface CreditNoteRefund {
  id: string;
  type: 'credit_note' | 'refund_request';
  docNumber: string;
  invoiceNo: string;
  supplierId: string;
  supplierName: string;
  supplierEmail: string;
  amount: number;
  reason: string;
  requestedDate: string; // DD/MM/YYYY
  issueDate?: string;     // DD/MM/YYYY
  status: CreditNoteStatus;
  approvalStatus?: CreditNoteStatus;
  createdBy: string;
  assignedUser?: string;
  isApproved?: boolean;
  approvedBy?: string;
  approvedDate?: string;
  receivedDate?: string;
  receivedBy?: string;
  remarks?: string;
  expectedReceiptDate?: string; // DD/MM/YYYY
  assignedActions?: CreditNoteFollowUpAction[];
}

export type AuditActionType =
  | 'login'
  | 'logout'
  | 'payment_date'
  | 'schedule_payment'
  | 'reschedule_payment'
  | 'email_notice'
  | 'anomaly_flagged'
  | 'credit_note'
  | 'refund_request'
  | 'manager_override'
  | 'cash_buffer_change'
  | 'sheets_sync'
  | 'supplier_update'
  | 'invoice_upload'
  | 'invoice_edit'
  | 'status_change'
  | 'reminder_update'
  | 'credit_limit'
  | 'payment_completed'
  | 'payment_archived'
  | 'USER_LOGIN'
  | 'USER_LOGOUT'
  | 'PAYMENT_DATE_SCHEDULED'
  | 'PAYMENT_DATE_RESCHEDULED'
  | 'PAYMENT_COMPLETED'
  | 'PAYMENT_ARCHIVED'
  | 'DUPLICATE_ANOMALY_DETECTED'
  | 'DUPLICATE_PAYMENT_DETECTED'
  | 'INCORRECT_AMOUNT_DETECTED'
  | 'PAYMENT_AMOUNT_EXCEEDED'
  | 'MULTIPLE_PAYMENT_RECORDS_DETECTED'
  | 'PAYMENT_HELD_FOR_ANOMALY'
  | 'OVERPAYMENT_DETECTED'
  | 'OTHER_PAYMENT_ANOMALY_DETECTED'
  | 'CREDIT_NOTE_REQUESTED'
  | 'CREDIT_NOTE_APPROVED'
  | 'CREDIT_NOTE_RECEIVED'
  | 'REFUND_REQUESTED'
  | 'REFUND_APPROVED'
  | 'REFUND_RECEIVED'
  | 'SUPPLIER_FOLLOW_UP_EMAIL_SENT'
  | 'PAYMENT_PUT_ON_HOLD'
  | 'MANAGER_REVIEW_INITIATED'
  | 'PAYMENT_DATE_INITIATED'
  | 'SUPPLIER_FOLLOW_UP_INITIATED'
  | 'MANAGER_OVERRIDE_APPROVED'
  | 'MANAGER_OVERRIDE_REJECTED'
  | 'CASH_BUFFER_UPDATED'
  | 'SUPPLIER_ADDED'
  | 'SUPPLIER_UPDATED'
  | 'SUPPLIER_REMOVED'
  | 'SUPPLIER_IMPORTED_FROM_INVOICES'
  | 'SUPPLIER_DETAILS_ADDED'
  | 'SUPPLIER_DETAILS_UPDATED'
  | 'SUPPLIER_BANK_ACCOUNT_UPDATED'
  | 'SUPPLIER_BANK_ACCOUNT_CONFLICT_RESOLVED'
  | 'GOOGLE_SHEET_CONNECTED'
  | 'GOOGLE_SHEET_LINK_UPDATED'
  | 'GOOGLE_SHEET_DISCONNECTED'
  | 'GOOGLE_SHEET_SYNC_STARTED'
  | 'GOOGLE_SHEET_SYNC_COMPLETED'
  | 'GOOGLE_SHEET_SYNC_FAILED'
  | 'PAYMENT_QUEUE_REPAIR_STARTED'
  | 'PAYMENT_QUEUE_REPAIR_COMPLETED'
  | 'PAYMENT_QUEUE_REPAIR_FAILED'
  | 'PAYMENT_QUEUE_CLEARED'
  | 'SUPPLIER_INFORMATION_DEMO_RESET'
  | 'SUPPLIER_INFORMATION_REBUILT'
  | 'GOOGLE_CONNECTED'
  | 'GOOGLE_DISCONNECTED'
  | 'DATABASE_CONNECTION_VERIFIED'
  | 'DATABASE_CONNECTION_FAILED'
  | 'DATABASE_LINK_UPDATED';

export type DatabaseConnectionState =
  | 'Google Not Connected'
  | 'Google Connected — Database Not Checked'
  | 'Connecting to Database'
  | 'Live Database Connected — Editor Access'
  | 'Live Database Connected — Read Only'
  | 'Database Connection Failed'
  | 'Spreadsheet Not Found'
  | 'Access Denied';

export interface AuditLog {
  id: string;
  timestamp: string;
  user: string;
  userRole: UserRole;
  actionType: AuditActionType;
  description: string;
  metadata?: Record<string, any>;
}

export interface AppSettings {
  bankBalance: number;
  cashBuffer: number;
  reminderDaysBeforeDue: number;
  lastSyncedAt: string;
  googleSheetName: string;
  googleSheetUrl: string;
}

export interface EmailNotice {
  toEmail: string;
  supplierName: string;
  invoiceNo: string;
  amount: number;
  originalDueDate: string;
  proposedPaymentDate: string;
  reason?: string;
  customNotes?: string;
  bodyText?: string;
}

export interface EmailNoticeRecord {
  id: string;
  supplierName: string;
  invoiceNo: string;
  poNo?: string;
  paymentDateExceeded: string;
  creditTermDueDate: string;
  reasonSelected: string;
  customNotes?: string;
  sentAt: string;
  toEmail: string;
  amount: number;
}

export interface InvoiceSheetRow {
  invoiceId: string;
  sourceFileName?: string;
  invoiceNumber: string;
  invoiceDate?: string;
  dueDate?: string;
  supplierName?: string;
  supplierBankAccountNo?: string;
  poNumber?: string;
  itemDescription?: string;
  quantityInvoiced?: string;
  unitPriceInvoiced?: string;
  invoiceTotal: string;
  currency: string;
  extractionConfidence?: string;
  extractionStatus?: string;
  humanVerified?: string;
  matchStatus?: string;
  latestMatchId?: string;
  createdTimestamp?: string;
  updatedTimestamp?: string;
}

export interface InvoiceLookupStore {
  allRows: InvoiceSheetRow[];
  byInvoiceId: Map<string, InvoiceSheetRow[]>;
  byInvoiceNum: Map<string, InvoiceSheetRow[]>;
  byNumAndSupplier: Map<string, InvoiceSheetRow[]>;
  byNumAndPo: Map<string, InvoiceSheetRow[]>;
}

export interface MatchResultRow {
  matchId: string;
  matchVersion: string;
  invoiceId: string;
  invoiceNumber: string;
  poNumber: string;
  grnNumbers: string;
  supplierName: string;
  matchDate: string;
  poReferenceResult: string;
  supplierResult: string;
  itemResult: string;
  quantityResult: string;
  priceResult: string;
  totalResult: string;
  conditionResult: string;
  overallMatchStatus: string;
  riskLevel: string;
  discrepancyDetails: string;
  recommendedAction: string;
  humanReviewRequired: string;
  humanReviewer: string;
  humanDecision: string;
  humanComments: string;
  reviewTimestamp: string;
  readyForApp3: string;
}

export interface PaymentQueueRow {
  matchId: string;
  invoiceId: string;
  supplierInvoiceInfo: string;
  threeWayMatchRef: string;
  invoiceAmount: string;
  creditTermsAndDueDate: string;
  status: string;
  paymentDate: string;
  schedulingActions: string;
  riskLevel?: string;
  discrepancyDetails?: string;
  diagnosticInfo?: string;
  joinWarning?: string;
  lastSynced?: string;
  rowIndex?: number; // 1-based row index in PAYMENT_QUEUE sheet
}

export type GoogleSyncStatus =
  | 'Disconnected'
  | 'Connecting'
  | 'Connected'
  | 'Synchronising...'
  | 'Up to Date'
  | 'Waiting for Changes'
  | 'Error';
