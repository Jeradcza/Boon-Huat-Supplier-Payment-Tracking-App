import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { User } from 'firebase/auth';
import {
  initGoogleAuth,
  googleSignIn,
  logoutGoogle as authLogout,
  getAccessToken,
  setCachedAccessToken,
} from '../services/googleAuth';
import {
  extractSpreadsheetId,
  fetchSpreadsheetInfo,
  readWorksheetValues,
  parseMatchResultsSheet,
  parseInvoicesSheet,
  syncPaymentQueueToGoogleSheets,
  writePaymentUpdateToGoogleSheet,
  clearPaymentQueueSheet,
  repairPaymentQueueInSheets,
} from '../services/googleSheets';
import {
  GoogleSyncStatus,
  MatchResultRow,
  PaymentQueueRow,
  InvoiceSheetRow,
  InvoiceLookupStore,
  DatabaseConnectionState,
} from '../types';
import { validateDatabaseAccess } from '../services/googleSheets';

interface GoogleSyncContextType {
  // Auth state
  googleUser: User | null;
  accessToken: string | null;
  isAuthLoading: boolean;
  authError: string | null;

  // Sync state
  syncStatus: GoogleSyncStatus;
  dbConnectionState: DatabaseConnectionState;
  spreadsheetId: string;
  spreadsheetUrl: string;
  spreadsheetTitle: string;
  lastSyncedAt: string | null;
  matchResultsCount: number;
  paymentReadyCount: number;
  paymentQueueCount: number;
  syncedQueueRows: PaymentQueueRow[];
  matchResultsRows: MatchResultRow[];
  invoicesRows: InvoiceSheetRow[];
  errorMessage: string | null;

  // Actions
  loginWithGoogle: () => Promise<void>;
  logoutGoogle: () => Promise<void>;
  connectSpreadsheet: (urlOrId: string) => Promise<boolean>;
  syncNow: (suppliersList?: any[]) => Promise<void>;
  updatePaymentInSheets: (
    matchId: string,
    invoiceId: string,
    newStatus: string,
    newPaymentDate: string,
    actionLabel?: string
  ) => Promise<void>;
  clearPaymentQueueInSheets: () => Promise<{ rowsRemoved: number }>;
  repairPaymentQueue: (suppliersList?: any[]) => Promise<PaymentQueueRow[]>;
}

const GoogleSyncContext = createContext<GoogleSyncContextType | undefined>(undefined);

const EXACT_SHEET_ID = '13mLCkvH-xVsQuBEdIdEMgfmOPoRqFxJQTqu-o4w9_Jk';
const EXACT_SHEET_URL = 'https://docs.google.com/spreadsheets/d/13mLCkvH-xVsQuBEdIdEMgfmOPoRqFxJQTqu-o4w9_Jk/edit?usp=sharing';

export const GoogleSyncProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [googleUser, setGoogleUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(getAccessToken());
  const [isAuthLoading, setIsAuthLoading] = useState<boolean>(true);
  const [authError, setAuthError] = useState<string | null>(null);

  const [syncStatus, setSyncStatus] = useState<GoogleSyncStatus>('Disconnected');
  const [dbConnectionState, setDbConnectionState] = useState<DatabaseConnectionState>('Google Not Connected');
  
  const [spreadsheetId, setSpreadsheetIdState] = useState<string>(EXACT_SHEET_ID);
  const [spreadsheetTitle, setSpreadsheetTitle] = useState<string>('Boon Huat Supplier Payment Tracking DB');
  const [spreadsheetUrl, setSpreadsheetUrl] = useState<string>(EXACT_SHEET_URL);

  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [matchResultsCount, setMatchResultsCount] = useState<number>(0);
  const [paymentReadyCount, setPaymentReadyCount] = useState<number>(0);
  const [paymentQueueCount, setPaymentQueueCount] = useState<number>(0);

  const [matchResultsRows, setMatchResultsRows] = useState<MatchResultRow[]>([]);
  const [syncedQueueRows, setSyncedQueueRows] = useState<PaymentQueueRow[]>([]);
  const [invoicesRows, setInvoicesRows] = useState<InvoiceSheetRow[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Initialize Firebase Auth listener
  useEffect(() => {
    const unsubscribe = initGoogleAuth(
      (user, token) => {
        setGoogleUser(user);
        setAccessToken(token);
        setIsAuthLoading(false);
        setAuthError(null);
        setDbConnectionState('Google Connected — Database Not Checked');
      },
      (errorMsg) => {
        setIsAuthLoading(false);
        if (errorMsg && errorMsg !== 'User logged out.') {
          setAuthError(errorMsg);
        }
        setDbConnectionState('Google Not Connected');
      }
    );
    return () => {
      unsubscribe();
    };
  }, []);

  const loginWithGoogle = async () => {
    setIsAuthLoading(true);
    setAuthError(null);
    setErrorMessage(null);
    try {
      const result = await googleSignIn();
      if (result) {
        setGoogleUser(result.user);
        setAccessToken(result.accessToken);
        setSyncStatus('Connected');
        setDbConnectionState('Google Connected — Database Not Checked');
      }
    } catch (err: any) {
      const code = err?.code || '';
      const rawMsg = err?.message || '';

      if (code === 'auth/popup-closed-by-user' || rawMsg.includes('popup-closed-by-user')) {
        setAuthError('Sign-in popup window was closed before completing authentication. Click "Connect Google" when ready.');
        setSyncStatus('Disconnected');
        setDbConnectionState('Google Not Connected');
      } else if (code === 'auth/popup-blocked' || rawMsg.includes('popup-blocked')) {
        setAuthError('Pop-up window was blocked by your browser. Please allow pop-ups for this site and try again.');
        setSyncStatus('Disconnected');
        setDbConnectionState('Google Not Connected');
      } else if (code === 'auth/cancelled-popup-request' || rawMsg.includes('cancelled-popup-request')) {
        setAuthError('Sign-in request was cancelled. Please try again.');
        setSyncStatus('Disconnected');
        setDbConnectionState('Google Not Connected');
      } else {
        console.error('Google Auth Failed:', err);
        const msg = rawMsg || 'Google Authentication failed. Please try again.';
        setAuthError(msg);
        setSyncStatus('Error');
        setDbConnectionState('Google Not Connected');
      }
    } finally {
      setIsAuthLoading(false);
    }
  };

  const logoutGoogle = async () => {
    await authLogout();
    setGoogleUser(null);
    setAccessToken(null);
    setSyncStatus('Disconnected');
    setDbConnectionState('Google Not Connected');
    setSyncedQueueRows([]);
    setMatchResultsRows([]);
    setLastSyncedAt(null);
  };

  // Perform core sync logic
  const performSync = useCallback(
    async (targetSheetId: string, token: string, suppliersList?: any[]): Promise<boolean> => {
      if (!token || !targetSheetId) {
        setSyncStatus('Disconnected');
        setDbConnectionState('Google Not Connected');
        return false;
      }

      setSyncStatus('Synchronising...');
      setDbConnectionState('Connecting to Database');
      setErrorMessage(null);

      try {
        // 1. Validate spreadsheet access and worksheets
        const val = await validateDatabaseAccess(targetSheetId, token);
        setSpreadsheetTitle(val.title);

        if (val.missingWorksheets.length > 0) {
          setSyncStatus('Connected');
          setDbConnectionState('Live Database Connected — Editor Access');
          setErrorMessage(`Missing worksheets: ${val.missingWorksheets.join(', ')}`);
        }

        // 2. Read MATCH_RESULTS tab
        const rawMatchRows = await readWorksheetValues(targetSheetId, 'MATCH_RESULTS', token);
        const parsedMatches = parseMatchResultsSheet(rawMatchRows);
        setMatchResultsRows(parsedMatches);
        setMatchResultsCount(parsedMatches.length);

        // 2b. Read INVOICES tab if present
        let invoicesStore: InvoiceLookupStore = {
          allRows: [],
          byInvoiceId: new Map(),
          byInvoiceNum: new Map(),
          byNumAndSupplier: new Map(),
          byNumAndPo: new Map(),
        };
        const invoicesSheetTitle = val.existingWorksheets.find((t) => t.trim().toLowerCase() === 'invoices');
        if (invoicesSheetTitle) {
          try {
            const rawInvoiceRows = await readWorksheetValues(targetSheetId, invoicesSheetTitle, token);
            invoicesStore = parseInvoicesSheet(rawInvoiceRows);
            setInvoicesRows(invoicesStore.allRows);
          } catch (err) {
            console.warn('Could not read INVOICES worksheet:', err);
          }
        }

        // 3. Filter payment-ready records
        const readyInvoices = parsedMatches.filter(
          (m) =>
            m.readyForApp3.toUpperCase() === 'TRUE' ||
            m.readyForApp3.toUpperCase() === 'YES' ||
            m.readyForApp3 === '1'
        );
        setPaymentReadyCount(readyInvoices.length);

        // 4. Synchronize into PAYMENT_QUEUE worksheet
        const queueRows = await syncPaymentQueueToGoogleSheets(targetSheetId, token, readyInvoices, invoicesStore, suppliersList);
        setSyncedQueueRows(queueRows);
        setPaymentQueueCount(queueRows.length);

        const nowStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        setLastSyncedAt(nowStr);
        setSyncStatus('Up to Date');
        setDbConnectionState(val.isEditor ? 'Live Database Connected — Editor Access' : 'Live Database Connected — Read Only');
        return true;
      } catch (err: any) {
        console.error('Sheet Sync Error:', err);
        setSyncStatus('Error');
        const raw = err?.message || 'Error connecting to Google Sheets.';
        if (raw.includes('404') || raw.toLowerCase().includes('not found')) {
          setDbConnectionState('Spreadsheet Not Found');
        } else if (raw.includes('403') || raw.toLowerCase().includes('permission') || raw.toLowerCase().includes('denied')) {
          setDbConnectionState('Access Denied');
        } else {
          setDbConnectionState('Database Connection Failed');
        }
        
        const cleanMsg = raw.includes('Failed to fetch')
          ? 'Unable to connect to Google Sheets API. Please check your network connection or spreadsheet permissions.'
          : raw;
        setErrorMessage(cleanMsg);
        return false;
      }
    },
    []
  );

  const connectSpreadsheet = async (urlOrId: string): Promise<boolean> => {
    const cleanId = extractSpreadsheetId(urlOrId) || EXACT_SHEET_ID;
    setSpreadsheetIdState(cleanId);
    setSpreadsheetUrl(EXACT_SHEET_URL);

    if (!accessToken) {
      setErrorMessage('Google Authentication required. Please click "Connect Google" first.');
      setSyncStatus('Disconnected');
      setDbConnectionState('Google Not Connected');
      return false;
    }

    return performSync(cleanId, accessToken);
  };

  const syncNow = async (suppliersList?: any[]) => {
    if (!accessToken) {
      setErrorMessage('Cannot sync: Google account is not authenticated.');
      setDbConnectionState('Google Not Connected');
      return;
    }
    await performSync(spreadsheetId, accessToken, suppliersList);
  };

  const repairPaymentQueue = async (suppliersList?: any[]): Promise<PaymentQueueRow[]> => {
    if (!accessToken || !spreadsheetId) {
      throw new Error('Google Sheet is not connected.');
    }

    setSyncStatus('Synchronising...');
    setErrorMessage(null);

    const rawMatchRows = await readWorksheetValues(spreadsheetId, 'MATCH_RESULTS', accessToken);
    const parsedMatches = parseMatchResultsSheet(rawMatchRows);
    setMatchResultsRows(parsedMatches);
    setMatchResultsCount(parsedMatches.length);

    const readyInvoices = parsedMatches.filter(
      (m) =>
        m.readyForApp3.toUpperCase() === 'TRUE' ||
        m.readyForApp3.toUpperCase() === 'YES' ||
        m.readyForApp3 === '1'
    );
    setPaymentReadyCount(readyInvoices.length);

    let invoicesStore: InvoiceLookupStore = {
      allRows: [],
      byInvoiceId: new Map(),
      byInvoiceNum: new Map(),
      byNumAndSupplier: new Map(),
      byNumAndPo: new Map(),
    };

    try {
      const info = await fetchSpreadsheetInfo(spreadsheetId, accessToken);
      const invoicesSheetTitle = info.sheetTitles.find((t) => t.trim().toLowerCase() === 'invoices');
      if (invoicesSheetTitle) {
        const rawInvoiceRows = await readWorksheetValues(spreadsheetId, invoicesSheetTitle, accessToken);
        invoicesStore = parseInvoicesSheet(rawInvoiceRows);
        setInvoicesRows(invoicesStore.allRows);
      }
    } catch (err) {
      console.warn('Could not load INVOICES worksheet during repair:', err);
    }

    const repaired = await repairPaymentQueueInSheets(
      spreadsheetId,
      accessToken,
      readyInvoices,
      suppliersList,
      invoicesStore
    );

    setSyncedQueueRows(repaired);
    setPaymentQueueCount(repaired.length);
    setLastSyncedAt(new Date().toLocaleTimeString());
    setSyncStatus('Up to Date');
    return repaired;
  };

  const updatePaymentInSheets = async (
    matchId: string,
    invoiceId: string,
    newStatus: string,
    newPaymentDate: string,
    actionLabel?: string
  ) => {
    // Locally update synced queue state immediately for seamless UX
    setSyncedQueueRows((prev) =>
      prev.map((row) => {
        if (row.matchId === matchId || row.invoiceId === invoiceId) {
          return {
            ...row,
            status: newStatus,
            paymentDate: newPaymentDate,
            schedulingActions: actionLabel || row.schedulingActions,
            lastSynced: new Date().toLocaleTimeString(),
          };
        }
        return row;
      })
    );

    if (!accessToken || !spreadsheetId) return;

    try {
      await writePaymentUpdateToGoogleSheet(
        spreadsheetId,
        accessToken,
        matchId,
        invoiceId,
        newStatus,
        newPaymentDate,
        actionLabel
      );

      setLastSyncedAt(new Date().toLocaleTimeString());
      setSyncStatus('Up to Date');
    } catch (err: any) {
      console.error('Failed to update Google Sheet row:', err);
      const raw = err?.message || 'Connection error';
      const clean = raw.includes('Failed to fetch')
        ? 'Unable to connect to Google Sheets API. Local state updated.'
        : raw;
      setErrorMessage(clean);
      setSyncStatus('Error');
    }
  };

  const clearPaymentQueueInSheets = async (): Promise<{ rowsRemoved: number }> => {
    if (!accessToken) {
      throw new Error('Google account is not connected.');
    }
    let removedCount = 0;
    try {
      setSyncStatus('Synchronising...');
      const res = await clearPaymentQueueSheet(spreadsheetId, accessToken);
      removedCount = res.rowsRemoved;
      setSyncStatus('Up to Date');
      setDbConnectionState('Live Database Connected — Editor Access');
    } catch (err: any) {
      console.error('Failed to clear PAYMENT_QUEUE sheet:', err);
      setErrorMessage(`Failed to clear PAYMENT_QUEUE sheet: ${err.message}`);
      setSyncStatus('Error');
      throw err;
    }
    setSyncedQueueRows([]);
    setPaymentQueueCount(0);
    setLastSyncedAt(new Date().toLocaleTimeString());
    return { rowsRemoved: removedCount };
  };

  // Continuous auto-sync loop (polls MATCH_RESULTS every 12 seconds when connected)
  useEffect(() => {
    if (!accessToken || !spreadsheetId || syncStatus === 'Disconnected') return;

    const intervalId = setInterval(() => {
      if (accessToken && spreadsheetId) {
        performSync(spreadsheetId, accessToken);
      }
    }, 12000);

    return () => clearInterval(intervalId);
  }, [accessToken, spreadsheetId, syncStatus, performSync]);

  return (
    <GoogleSyncContext.Provider
      value={{
        googleUser,
        accessToken,
        isAuthLoading,
        authError,
        syncStatus,
        dbConnectionState,
        spreadsheetId,
        spreadsheetUrl,
        spreadsheetTitle,
        lastSyncedAt,
        matchResultsCount,
        paymentReadyCount,
        paymentQueueCount,
        syncedQueueRows,
        matchResultsRows,
        invoicesRows,
        errorMessage,
        loginWithGoogle,
        logoutGoogle,
        connectSpreadsheet,
        syncNow,
        updatePaymentInSheets,
        clearPaymentQueueInSheets,
        repairPaymentQueue,
      }}
    >
      {children}
    </GoogleSyncContext.Provider>
  );
};

export const useGoogleSync = () => {
  const context = useContext(GoogleSyncContext);
  if (!context) {
    throw new Error('useGoogleSync must be used within a GoogleSyncProvider');
  }
  return context;
};
