import { MatchResultRow, PaymentQueueRow, InvoiceSheetRow, InvoiceLookupStore } from '../types';
import { formatSGDate } from '../utils/formatters';

export function parseInvoicesSheet(rows: string[][]): InvoiceLookupStore {
  const store: InvoiceLookupStore = {
    allRows: [],
    byInvoiceId: new Map(),
    byInvoiceNum: new Map(),
    byNumAndSupplier: new Map(),
    byNumAndPo: new Map(),
  };

  if (!rows || rows.length <= 1) return store;

  const headers = rows[0].map((h) => h.trim().toLowerCase());

  const getColIdx = (candidates: string[], defaultIdx: number): number => {
    for (const cand of candidates) {
      const idx = headers.findIndex(
        (h) => h === cand.toLowerCase() || h.replace(/_/g, '') === cand.toLowerCase().replace(/_/g, '')
      );
      if (idx !== -1) return idx;
    }
    return defaultIdx;
  };

  const idxInvId = getColIdx(['invoice_id', 'invoiceid'], 0);
  const idxSourceFile = getColIdx(['source_file_name', 'sourcefile'], 1);
  const idxInvNum = getColIdx(['invoice_number', 'invoicenumber', 'invoiceno'], 2);
  const idxInvDate = getColIdx(['invoice_date', 'invoicedate'], 3);
  const idxDueDate = getColIdx(['due_date', 'duedate'], 4);
  const idxSupName = getColIdx(['supplier_name', 'suppliername'], 5);
  const idxSupBankAcc = getColIdx(
    ['supplier_bank_account_no', 'supplierbankaccountno', 'bank_account_no', 'bankaccountno', 'supplier_bank_account'],
    6
  );
  const idxPoNum = getColIdx(['po_number', 'ponumber'], 7);
  const idxTotal = getColIdx(['invoice_total', 'invoicetotal', 'total'], 11);
  const idxCurrency = getColIdx(['currency'], 12);

  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    if (!row || row.length === 0 || !row.some((cell) => cell.trim() !== '')) continue;

    const invoiceId = row[idxInvId]?.trim() || '';
    const invoiceNumber = row[idxInvNum]?.trim() || '';
    const invoiceTotal = row[idxTotal]?.trim() || '';
    const currency = row[idxCurrency]?.trim() || 'SGD';
    const dueDate = row[idxDueDate]?.trim() || '';
    const invoiceDate = row[idxInvDate]?.trim() || '';
    const supplierName = row[idxSupName]?.trim() || '';
    const supplierBankAccountNo = row[idxSupBankAcc]?.trim() || '';
    const poNumber = row[idxPoNum]?.trim() || '';

    if (!invoiceId && !invoiceNumber) continue;

    const parsedRow: InvoiceSheetRow = {
      invoiceId,
      invoiceNumber,
      invoiceTotal,
      currency,
      dueDate,
      invoiceDate,
      supplierName,
      supplierBankAccountNo,
      poNumber,
    };

    store.allRows.push(parsedRow);

    if (invoiceId) {
      const key = invoiceId.toLowerCase();
      const list = store.byInvoiceId.get(key) || [];
      list.push(parsedRow);
      store.byInvoiceId.set(key, list);
    }

    if (invoiceNumber) {
      const numKey = invoiceNumber.toLowerCase();
      const listNum = store.byInvoiceNum.get(numKey) || [];
      listNum.push(parsedRow);
      store.byInvoiceNum.set(numKey, listNum);

      if (supplierName) {
        const supKey = `${numKey}|${supplierName.toLowerCase()}`;
        const listSup = store.byNumAndSupplier.get(supKey) || [];
        listSup.push(parsedRow);
        store.byNumAndSupplier.set(supKey, listSup);
      }

      if (poNumber) {
        const poKey = `${numKey}|${poNumber.toLowerCase()}`;
        const listPo = store.byNumAndPo.get(poKey) || [];
        listPo.push(parsedRow);
        store.byNumAndPo.set(poKey, listPo);
      }
    }
  }

  return store;
}

export function resolveInvoiceForMatch(
  inv: MatchResultRow,
  store?: InvoiceLookupStore
): {
  amount: string;
  joinMethod: string;
  warning: string;
  diagnostic: string;
  dueDate?: string;
} {
  // Fresh resolution variables per iteration - NO cross-row contamination!
  let amount = 'Amount Unavailable';
  let joinMethod = 'None';
  let warning = '';
  let diagnostic = '';
  let resolvedInvoice: InvoiceSheetRow | null = null;

  if (!store || store.allRows.length === 0) {
    return {
      amount: 'Amount Unavailable',
      joinMethod: 'None',
      warning: 'INVOICES worksheet is empty or not loaded.',
      diagnostic: `Match_ID: ${inv.matchId}, Invoice_ID: ${inv.invoiceId} - INVOICES worksheet not connected.`,
    };
  }

  const normMatchInvId = inv.invoiceId ? inv.invoiceId.trim().toLowerCase() : '';
  const normMatchInvNum = inv.invoiceNumber ? inv.invoiceNumber.trim().toLowerCase() : '';
  const normMatchSup = inv.supplierName ? inv.supplierName.trim().toLowerCase() : '';
  const normMatchPo = inv.poNumber ? inv.poNumber.trim().toLowerCase() : '';

  // Step 1: Check Primary Join Key (Invoice_ID)
  if (normMatchInvId) {
    const idMatches = store.byInvoiceId.get(normMatchInvId) || [];

    if (idMatches.length > 1) {
      return {
        amount: 'Amount Requires Review',
        joinMethod: 'Duplicate Invoice_ID',
        warning: 'Duplicate Invoice_ID detected in INVOICES.',
        diagnostic: `Match_ID: ${inv.matchId}, MATCH_RESULTS.Invoice_ID: ${inv.invoiceId} matched ${idMatches.length} rows in INVOICES. Duplicate Invoice_ID detected.`,
      };
    }

    if (idMatches.length === 1) {
      const candidate = idMatches[0];

      // Secondary Validation
      const conflicts: string[] = [];
      if (normMatchInvNum && candidate.invoiceNumber && candidate.invoiceNumber.trim().toLowerCase() !== normMatchInvNum) {
        conflicts.push(`Invoice_Number mismatch (Match: '${inv.invoiceNumber}' vs Invoices: '${candidate.invoiceNumber}')`);
      }
      if (normMatchSup && candidate.supplierName && candidate.supplierName.trim().toLowerCase() !== normMatchSup) {
        conflicts.push(`Supplier_Name mismatch (Match: '${inv.supplierName}' vs Invoices: '${candidate.supplierName}')`);
      }
      if (normMatchPo && candidate.poNumber && candidate.poNumber.trim().toLowerCase() !== normMatchPo) {
        conflicts.push(`PO_Number mismatch (Match: '${inv.poNumber}' vs Invoices: '${candidate.poNumber}')`);
      }

      if (conflicts.length > 0) {
        return {
          amount: 'Amount Requires Review',
          joinMethod: 'Exact Invoice_ID (Secondary Conflict)',
          warning: 'Invoice record conflict detected.',
          diagnostic: `Match_ID: ${inv.matchId}, Invoice_ID: ${inv.invoiceId} matched, but secondary conflicts detected: ${conflicts.join('; ')}`,
        };
      }

      // Valid exact match!
      resolvedInvoice = candidate;
      joinMethod = 'Exact Invoice_ID';
    }
  }

  // Step 2: Fallback Matching (if no exact Invoice_ID match)
  if (!resolvedInvoice) {
    // Fallback 1: Exact Invoice_Number + Supplier_Name
    if (normMatchInvNum && normMatchSup) {
      const supKey = `${normMatchInvNum}|${normMatchSup}`;
      const supMatches = store.byNumAndSupplier.get(supKey) || [];
      if (supMatches.length === 1) {
        resolvedInvoice = supMatches[0];
        joinMethod = 'Invoice Number + Supplier';
      } else if (supMatches.length > 1) {
        return {
          amount: 'Amount Requires Review',
          joinMethod: 'Fallback (Multiple Matches)',
          warning: 'Multiple invoice records match this payment-ready record.',
          diagnostic: `Match_ID: ${inv.matchId} matched ${supMatches.length} rows on Invoice Number + Supplier.`,
        };
      }
    }

    // Fallback 2: Exact Invoice_Number + PO_Number
    if (!resolvedInvoice && normMatchInvNum && normMatchPo) {
      const poKey = `${normMatchInvNum}|${normMatchPo}`;
      const poMatches = store.byNumAndPo.get(poKey) || [];
      if (poMatches.length === 1) {
        resolvedInvoice = poMatches[0];
        joinMethod = 'Invoice Number + PO';
      } else if (poMatches.length > 1) {
        return {
          amount: 'Amount Requires Review',
          joinMethod: 'Fallback (Multiple Matches)',
          warning: 'Multiple invoice records match this payment-ready record.',
          diagnostic: `Match_ID: ${inv.matchId} matched ${poMatches.length} rows on Invoice Number + PO.`,
        };
      }
    }

    // Fallback 3: Exact Invoice_Number only, but ONLY if exactly one INVOICES record matches
    if (!resolvedInvoice && normMatchInvNum) {
      const numMatches = store.byInvoiceNum.get(normMatchInvNum) || [];
      if (numMatches.length === 1) {
        resolvedInvoice = numMatches[0];
        joinMethod = 'Invoice Number Only';
      } else if (numMatches.length > 1) {
        return {
          amount: 'Amount Requires Review',
          joinMethod: 'Fallback (Multiple Matches)',
          warning: 'Multiple invoice records match this payment-ready record.',
          diagnostic: `Match_ID: ${inv.matchId} matched ${numMatches.length} rows on Invoice Number.`,
        };
      }
    }
  }

  // Step 3: Handle outcome
  if (!resolvedInvoice) {
    return {
      amount: 'Amount Unavailable',
      joinMethod: 'None',
      warning: `Could not locate Invoice_ID ${inv.invoiceId || inv.invoiceNumber} in the INVOICES worksheet.`,
      diagnostic: `Match_ID: ${inv.matchId}, MATCH_RESULTS.Invoice_ID: ${inv.invoiceId}, MATCH_RESULTS.Invoice_Number: ${inv.invoiceNumber} - No matching record in INVOICES.`,
    };
  }

  // Parse monetary total
  const rawTotal = resolvedInvoice.invoiceTotal?.trim();
  const rawCurrency = resolvedInvoice.currency?.trim() || 'SGD';

  if (!rawTotal || rawTotal === '') {
    return {
      amount: 'Amount Requires Review',
      joinMethod,
      warning: 'Invoice_Total is blank in INVOICES worksheet.',
      diagnostic: `Match_ID: ${inv.matchId}, Resolved Invoice_ID: ${resolvedInvoice.invoiceId}, Invoice_Total is blank.`,
      dueDate: resolvedInvoice.dueDate,
    };
  }

  const cleanNum = parseFloat(rawTotal.replace(/[^0-9.-]/g, ''));
  if (isNaN(cleanNum)) {
    return {
      amount: 'Amount Requires Review',
      joinMethod,
      warning: `Non-numeric Invoice_Total ('${rawTotal}') in INVOICES worksheet.`,
      diagnostic: `Match_ID: ${inv.matchId}, Resolved Invoice_ID: ${resolvedInvoice.invoiceId}, Non-numeric value: '${rawTotal}'.`,
      dueDate: resolvedInvoice.dueDate,
    };
  }

  const formattedNum = cleanNum.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  const currencySymbol = rawCurrency.toUpperCase().includes('SGD') ? 'SGD' : rawCurrency;
  amount = `${currencySymbol} ${formattedNum}`;

  diagnostic = `Match_ID: ${inv.matchId}\nMATCH_RESULTS.Invoice_ID: ${inv.invoiceId}\nMATCH_RESULTS.Invoice_Number: ${inv.invoiceNumber}\nResolved INVOICES.Invoice_ID: ${resolvedInvoice.invoiceId}\nResolved INVOICES.Invoice_Number: ${resolvedInvoice.invoiceNumber}\nResolved INVOICES.Invoice_Total: ${amount}\nJoin method used: ${joinMethod}`;

  return {
    amount,
    joinMethod,
    warning,
    diagnostic,
    dueDate: resolvedInvoice.dueDate,
  };
}

export function extractSpreadsheetId(input: string): string {
  const trimmed = input.trim();
  const match = trimmed.match(/\/d\/([a-zA-Z0-9-_]+)/);
  if (match && match[1]) {
    return match[1];
  }
  return trimmed;
}

export async function fetchSpreadsheetInfo(spreadsheetId: string, accessToken: string) {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=sheets.properties.title,properties.title`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    const errorJson = await res.json().catch(() => ({}));
    const message = errorJson.error?.message || `HTTP ${res.status}: ${res.statusText}`;
    throw new Error(`Failed to connect to Google Sheet: ${message}`);
  }

  const data = await res.json();
  const sheetTitles: string[] = (data.sheets || []).map((s: any) => s.properties.title);
  return {
    title: data.properties?.title || 'Google Spreadsheet',
    sheetTitles,
  };
}

export async function readWorksheetValues(
  spreadsheetId: string,
  sheetTitle: string,
  accessToken: string
): Promise<string[][]> {
  const encodedTitle = encodeURIComponent(sheetTitle);
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodedTitle}!A1:ZZ2000`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (res.status === 404) {
    throw new Error(`Worksheet '${sheetTitle}' was not found in the spreadsheet.`);
  }

  if (!res.ok) {
    const errorJson = await res.json().catch(() => ({}));
    const message = errorJson.error?.message || `HTTP ${res.status}`;
    throw new Error(`Failed to read worksheet '${sheetTitle}': ${message}`);
  }

  const data = await res.json();
  return data.values || [];
}

export async function ensureWorksheetExists(
  spreadsheetId: string,
  sheetTitle: string,
  accessToken: string
): Promise<boolean> {
  try {
    const info = await fetchSpreadsheetInfo(spreadsheetId, accessToken);
    if (info.sheetTitles.includes(sheetTitle)) {
      return true;
    }

    // Create the worksheet
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`;
    const body = {
      requests: [
        {
          addSheet: {
            properties: { title: sheetTitle },
          },
        },
      ],
    };

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(`Could not create worksheet '${sheetTitle}': ${err.error?.message || res.statusText}`);
    }

    return true;
  } catch (err: any) {
    console.error(`Error ensuring sheet '${sheetTitle}':`, err);
    throw err;
  }
}

export function parseMatchResultsSheet(rows: string[][]): MatchResultRow[] {
  if (!rows || rows.length <= 1) return [];

  const headers = rows[0].map((h) => h.trim().toLowerCase());

  // Helper to find column index by candidate names
  const getColIdx = (candidates: string[], defaultIdx: number): number => {
    for (const cand of candidates) {
      const idx = headers.findIndex((h) => h === cand.toLowerCase() || h.replace(/_/g, '') === cand.toLowerCase().replace(/_/g, ''));
      if (idx !== -1) return idx;
    }
    return defaultIdx;
  };

  const idxMatchId = getColIdx(['match_id', 'matchid'], 0);
  const idxMatchVer = getColIdx(['match_version', 'matchversion'], 1);
  const idxInvId = getColIdx(['invoice_id', 'invoiceid'], 2);
  const idxInvNum = getColIdx(['invoice_number', 'invoicenumber', 'invoiceno'], 3);
  const idxPoNum = getColIdx(['po_number', 'ponumber', 'pono'], 4);
  const idxGrnNum = getColIdx(['grn_numbers', 'grnnumbers', 'grnno'], 5);
  const idxSupName = getColIdx(['supplier_name', 'suppliername', 'supplier'], 6);
  const idxMatchDate = getColIdx(['match_date', 'matchdate'], 7);
  const idxPoRef = getColIdx(['po_reference_result'], 8);
  const idxSupRes = getColIdx(['supplier_result'], 9);
  const idxItemRes = getColIdx(['item_result'], 10);
  const idxQtyRes = getColIdx(['quantity_result'], 11);
  const idxPriceRes = getColIdx(['price_result'], 12);
  const idxTotalRes = getColIdx(['total_result', 'invoice_amount', 'amount'], 13);
  const idxCondRes = getColIdx(['condition_result'], 14);
  const idxOverall = getColIdx(['overall_match_status', 'match_status'], 15);
  const idxRisk = getColIdx(['risk_level', 'risk'], 16);
  const idxDisc = getColIdx(['discrepancy_details', 'discrepancy'], 17);
  const idxRec = getColIdx(['recommended_action'], 18);
  const idxHumReq = getColIdx(['human_review_required'], 19);
  const idxHumRev = getColIdx(['human_reviewer'], 20);
  const idxHumDec = getColIdx(['human_decision'], 21);
  const idxHumCom = getColIdx(['human_comments'], 22);
  const idxRevTs = getColIdx(['review_timestamp'], 23);
  const idxReady3 = getColIdx(['ready_for_app_3', 'readyforapp3'], 24);

  const results: MatchResultRow[] = [];

  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    if (!row || row.length === 0 || !row.some((cell) => cell.trim() !== '')) continue;

    results.push({
      matchId: row[idxMatchId]?.trim() || `M-${r}`,
      matchVersion: row[idxMatchVer]?.trim() || 'v1',
      invoiceId: row[idxInvId]?.trim() || `INV-${r}`,
      invoiceNumber: row[idxInvNum]?.trim() || row[idxInvId]?.trim() || `INV-${1000 + r}`,
      poNumber: row[idxPoNum]?.trim() || `PO-2026-${100 + r}`,
      grnNumbers: row[idxGrnNum]?.trim() || `GRN-2026-${100 + r}`,
      supplierName: row[idxSupName]?.trim() || 'General Supplier',
      matchDate: row[idxMatchDate]?.trim() || new Date().toISOString().slice(0, 10),
      poReferenceResult: row[idxPoRef]?.trim() || 'Matched',
      supplierResult: row[idxSupRes]?.trim() || 'Matched',
      itemResult: row[idxItemRes]?.trim() || 'Matched',
      quantityResult: row[idxQtyRes]?.trim() || 'Matched',
      priceResult: row[idxPriceRes]?.trim() || 'Matched',
      totalResult: row[idxTotalRes]?.trim() || '0.00',
      conditionResult: row[idxCondRes]?.trim() || 'Passed',
      overallMatchStatus: row[idxOverall]?.trim() || '3-Way Match Passed',
      riskLevel: row[idxRisk]?.trim() || '',
      discrepancyDetails: row[idxDisc]?.trim() || 'None',
      recommendedAction: row[idxRec]?.trim() || 'Process Payment',
      humanReviewRequired: row[idxHumReq]?.trim() || 'No',
      humanReviewer: row[idxHumRev]?.trim() || 'N/A',
      humanDecision: row[idxHumDec]?.trim() || 'Approved',
      humanComments: row[idxHumCom]?.trim() || '',
      reviewTimestamp: row[idxRevTs]?.trim() || '',
      readyForApp3: row[idxReady3]?.trim() || 'FALSE',
    });
  }

  return results;
}

export const PAYMENT_QUEUE_HEADERS = [
  'Supplier / Invoice Info',
  '3-Way Match Ref (PO / GRN)',
  'Invoice Amount',
  'DUE DATE',
  'Status',
  'Payment Date',
  'Scheduling Actions',
];

export interface HeaderColumnMap {
  colSupInfo: number;
  colMatchRef: number;
  colAmount: number;
  colCreditTerms: number;
  colStatus: number;
  colPaymentDate: number;
  colActions: number;
  maxColIdx: number;
}

export function buildHeaderMap(row1: string[]): HeaderColumnMap | null {
  if (!row1 || row1.length < 7) return null;

  const normalize = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ');

  const headers = row1.map(normalize);

  const colSupInfo = headers.findIndex((h) => h.includes('supplier') && h.includes('info'));
  const colMatchRef = headers.findIndex((h) => h.includes('match') && h.includes('ref'));
  const colAmount = headers.findIndex((h) => h.includes('amount'));
  const colCreditTerms = headers.findIndex((h) => h.includes('credit') || h.includes('due'));
  const colStatus = headers.findIndex((h) => h === 'status');
  const colPaymentDate = headers.findIndex((h) => h.includes('payment date'));
  const colActions = headers.findIndex((h) => h.includes('actions') || h.includes('scheduling'));

  if (
    colSupInfo === -1 ||
    colMatchRef === -1 ||
    colAmount === -1 ||
    colCreditTerms === -1 ||
    colStatus === -1 ||
    colPaymentDate === -1 ||
    colActions === -1
  ) {
    return null;
  }

  const maxColIdx = Math.max(
    colSupInfo,
    colMatchRef,
    colAmount,
    colCreditTerms,
    colStatus,
    colPaymentDate,
    colActions
  );

  return {
    colSupInfo,
    colMatchRef,
    colAmount,
    colCreditTerms,
    colStatus,
    colPaymentDate,
    colActions,
    maxColIdx,
  };
}

export function extractMatchIdFromRow(threeWayRef: string, fallbackRow: string[]): string {
  if (threeWayRef) {
    const match = threeWayRef.match(/Match:\s*([^\n]+)/i);
    if (match && match[1]) return match[1].trim();
  }
  if (fallbackRow && fallbackRow[0] && fallbackRow[0].trim().startsWith('M-')) {
    return fallbackRow[0].trim();
  }
  return '';
}

export function extractInvoiceIdFromRow(supInfo: string, fallbackRow: string[]): string {
  if (supInfo) {
    const match = supInfo.match(/Invoice ID:\s*([^\n]+)/i);
    if (match && match[1]) return match[1].trim();
  }
  if (fallbackRow && fallbackRow[1] && fallbackRow[1].trim().startsWith('INV-')) {
    return fallbackRow[1].trim();
  }
  return '';
}

export function resolveSupplierCreditTermsStr(
  supplierName: string,
  dueDateSG: string,
  suppliersList?: any[]
): string {
  if (!dueDateSG || dueDateSG === 'Unavailable' || dueDateSG === '-') {
    return 'Due Date Unavailable';
  }
  return `Due: ${dueDateSG}`;
}

export async function syncPaymentQueueToGoogleSheets(
  spreadsheetId: string,
  accessToken: string,
  readyInvoices: MatchResultRow[],
  invoicesStore?: InvoiceLookupStore,
  suppliersList?: any[]
): Promise<PaymentQueueRow[]> {
  // 1. Ensure PAYMENT_QUEUE worksheet exists
  await ensureWorksheetExists(spreadsheetId, 'PAYMENT_QUEUE', accessToken);

  // 2. Read existing rows in PAYMENT_QUEUE
  let existingRows = await readWorksheetValues(spreadsheetId, 'PAYMENT_QUEUE', accessToken);

  // Check header row (Row 1)
  let headerMap = existingRows.length > 0 ? buildHeaderMap(existingRows[0]) : null;

  if (!headerMap) {
    // Write 7 authoritative headers to Row 1
    const putHeaderUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/PAYMENT_QUEUE!A1:G1?valueInputOption=USER_ENTERED`;
    const res = await fetch(putHeaderUrl, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ values: [PAYMENT_QUEUE_HEADERS] }),
    });

    if (!res.ok) {
      throw new Error('PAYMENT_QUEUE header validation failed.');
    }

    // Re-read rows and rebuild header map
    existingRows = await readWorksheetValues(spreadsheetId, 'PAYMENT_QUEUE', accessToken);
    headerMap = existingRows.length > 0 ? buildHeaderMap(existingRows[0]) : null;

    if (!headerMap) {
      throw new Error('PAYMENT_QUEUE header validation failed.');
    }
  }

  // Map existing rows by Match_ID and Invoice_ID
  const existingMap = new Map<string, { rowIndex: number; row: string[] }>();
  for (let i = 1; i < existingRows.length; i++) {
    const row = existingRows[i];
    if (!row || row.length === 0) continue;

    const supInfo = row[headerMap.colSupInfo] || '';
    const matchRef = row[headerMap.colMatchRef] || '';

    const matchId = extractMatchIdFromRow(matchRef, row);
    const invoiceId = extractInvoiceIdFromRow(supInfo, row);

    if (matchId) existingMap.set(matchId, { rowIndex: i + 1, row });
    if (invoiceId) existingMap.set(invoiceId, { rowIndex: i + 1, row });
  }

  const resultRows: PaymentQueueRow[] = [];

  for (const inv of readyInvoices) {
    // Retrieve actual invoice details using clean primary key join & fallback rules
    const resolution = resolveInvoiceForMatch(inv, invoicesStore);

    const formattedAmount = resolution.amount;
    const diagnosticInfo = resolution.diagnostic;
    const joinWarning = resolution.warning;

    const supInvoiceInfo = `${inv.supplierName}\nInvoice ${inv.invoiceNumber}\nInvoice ID: ${inv.invoiceId}`;
    const threeWayRef = `PO: ${inv.poNumber}\nGRN: ${inv.grnNumbers}\nMatch: ${inv.matchId}`;

    const rawDueDate = resolution.dueDate ? resolution.dueDate.trim() : '';
    const invDueDate = rawDueDate ? formatSGDate(rawDueDate) : 'Unavailable';
    const creditTermsStr = resolveSupplierCreditTermsStr(inv.supplierName, invDueDate, suppliersList);

    const existing = existingMap.get(inv.matchId) || existingMap.get(inv.invoiceId);

    if (existing) {
      const currentStatus = existing.row[headerMap.colStatus]?.trim() || 'Pending Payment';
      const currentPaymentDate = existing.row[headerMap.colPaymentDate]?.trim() || '';
      const currentActions = existing.row[headerMap.colActions]?.trim() || (currentStatus === 'Paid' ? 'Payment Completed' : 'Schedule Payment');

      // Construct exactly 7 values according to mapped columns A:G
      const updatedRowValues = new Array(7).fill('');
      updatedRowValues[headerMap.colSupInfo] = supInvoiceInfo;
      updatedRowValues[headerMap.colMatchRef] = threeWayRef;
      updatedRowValues[headerMap.colAmount] = formattedAmount;
      updatedRowValues[headerMap.colCreditTerms] = creditTermsStr;
      updatedRowValues[headerMap.colStatus] = currentStatus;
      updatedRowValues[headerMap.colPaymentDate] = currentPaymentDate;
      updatedRowValues[headerMap.colActions] = currentActions;

      const updateUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/PAYMENT_QUEUE!A${existing.rowIndex}:G${existing.rowIndex}?valueInputOption=USER_ENTERED`;
      const updateRes = await fetch(updateUrl, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ values: [updatedRowValues] }),
      });

      if (!updateRes.ok) {
        throw new Error(`Failed to update PAYMENT_QUEUE row ${existing.rowIndex}`);
      }

      resultRows.push({
        matchId: inv.matchId,
        invoiceId: inv.invoiceId,
        supplierInvoiceInfo: supInvoiceInfo,
        threeWayMatchRef: threeWayRef,
        invoiceAmount: formattedAmount,
        creditTermsAndDueDate: creditTermsStr,
        status: currentStatus,
        paymentDate: currentPaymentDate,
        schedulingActions: currentActions,
        riskLevel: inv.riskLevel,
        discrepancyDetails: inv.discrepancyDetails,
        diagnosticInfo,
        joinWarning,
        lastSynced: new Date().toLocaleTimeString(),
        rowIndex: existing.rowIndex,
      });
    } else {
      // Append new 7-column row
      const newStatus = 'Pending Payment';
      const newPaymentDate = '';
      const newActions = 'Schedule Payment';

      const newRowValues = new Array(7).fill('');
      newRowValues[headerMap.colSupInfo] = supInvoiceInfo;
      newRowValues[headerMap.colMatchRef] = threeWayRef;
      newRowValues[headerMap.colAmount] = formattedAmount;
      newRowValues[headerMap.colCreditTerms] = creditTermsStr;
      newRowValues[headerMap.colStatus] = newStatus;
      newRowValues[headerMap.colPaymentDate] = newPaymentDate;
      newRowValues[headerMap.colActions] = newActions;

      const appendUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/PAYMENT_QUEUE!A1:G1:append?valueInputOption=USER_ENTERED`;
      const res = await fetch(appendUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ values: [newRowValues] }),
      });

      if (!res.ok) {
        console.error('Failed to append row to PAYMENT_QUEUE in Google Sheets:', await res.text());
      }

      resultRows.push({
        matchId: inv.matchId,
        invoiceId: inv.invoiceId,
        supplierInvoiceInfo: supInvoiceInfo,
        threeWayMatchRef: threeWayRef,
        invoiceAmount: formattedAmount,
        creditTermsAndDueDate: creditTermsStr,
        status: newStatus,
        paymentDate: newPaymentDate,
        schedulingActions: newActions,
        riskLevel: inv.riskLevel,
        discrepancyDetails: inv.discrepancyDetails,
        diagnosticInfo,
        joinWarning,
        lastSynced: new Date().toLocaleTimeString(),
      });
    }
  }

  return resultRows;
}

export async function writePaymentUpdateToGoogleSheet(
  spreadsheetId: string,
  accessToken: string,
  matchId: string,
  invoiceId: string,
  newStatus: string,
  newPaymentDate: string,
  actionLabel?: string
) {
  const rows = await readWorksheetValues(spreadsheetId, 'PAYMENT_QUEUE', accessToken);
  if (rows.length === 0) return;

  let headerMap = buildHeaderMap(rows[0]);

  if (!headerMap) {
    // Write 7 authoritative headers to Row 1
    const putHeaderUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/PAYMENT_QUEUE!A1:G1?valueInputOption=USER_ENTERED`;
    await fetch(putHeaderUrl, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ values: [PAYMENT_QUEUE_HEADERS] }),
    });

    const refreshedRows = await readWorksheetValues(spreadsheetId, 'PAYMENT_QUEUE', accessToken);
    headerMap = buildHeaderMap(refreshedRows[0]);
    if (!headerMap) throw new Error('PAYMENT_QUEUE header validation failed.');
  }

  let targetRowIdx = -1;
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    if (!r) continue;
    const supInfo = r[headerMap.colSupInfo] || '';
    const matchRef = r[headerMap.colMatchRef] || '';

    const rowMatchId = extractMatchIdFromRow(matchRef, r);
    const rowInvId = extractInvoiceIdFromRow(supInfo, r);

    if ((matchId && rowMatchId === matchId) || (invoiceId && rowInvId === invoiceId)) {
      targetRowIdx = i + 1;
      break;
    }
  }

  if (targetRowIdx === -1) {
    console.warn(`Row for Match ${matchId} / Invoice ${invoiceId} not found in PAYMENT_QUEUE sheet`);
    return;
  }

  // Update Status, Payment Date, and Scheduling Actions for target row
  const rowRangeUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/PAYMENT_QUEUE!A${targetRowIdx}:G${targetRowIdx}`;
  const getRes = await fetch(rowRangeUrl, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  const existingRowData = getRes.ok ? (await getRes.json()).values?.[0] || [] : [];
  const updatedRowValues = [...existingRowData];
  while (updatedRowValues.length < 7) updatedRowValues.push('');

  updatedRowValues[headerMap.colStatus] = newStatus;
  updatedRowValues[headerMap.colPaymentDate] = newPaymentDate;
  updatedRowValues[headerMap.colActions] = actionLabel || (newStatus === 'Paid' ? 'Payment Completed' : 'Schedule Payment');

  const updateUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/PAYMENT_QUEUE!A${targetRowIdx}:G${targetRowIdx}?valueInputOption=USER_ENTERED`;
  const res = await fetch(updateUrl, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ values: [updatedRowValues] }),
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Failed to write update to Google Sheets: ${errorText}`);
  }
}

export async function repairPaymentQueueInSheets(
  spreadsheetId: string,
  accessToken: string,
  readyInvoices: MatchResultRow[],
  suppliersList?: any[],
  invoicesStore?: InvoiceLookupStore
): Promise<PaymentQueueRow[]> {
  await ensureWorksheetExists(spreadsheetId, 'PAYMENT_QUEUE', accessToken);
  const existingRows = await readWorksheetValues(spreadsheetId, 'PAYMENT_QUEUE', accessToken);

  // Preserve existing statuses and payment dates
  const statusMap = new Map<string, { status: string; date: string; actions: string }>();
  if (existingRows.length > 1) {
    for (let i = 1; i < existingRows.length; i++) {
      const row = existingRows[i];
      if (!row || row.length === 0) continue;

      const supInfo = row[2] || row[0] || '';
      const matchRef = row[3] || row[1] || '';

      const mId = extractMatchIdFromRow(matchRef, row);
      const invId = extractInvoiceIdFromRow(supInfo, row);

      let status = 'Pending Payment';
      let date = '';
      let actions = 'Schedule Payment';

      // Check where status and payment date might be located in existing row
      for (const cell of row) {
        const c = cell.trim();
        if (['Pending Payment', 'Scheduled', 'Paid', 'On Hold', 'Pending Approval', 'Cancelled', 'Overdue'].includes(c)) {
          status = c;
        }
        if (c.match(/^\d{2}\/\d{2}\/\d{4}$/)) {
          date = c;
        }
        if (['Schedule Payment', 'Re-schedule', 'Payment Completed', 'On Hold'].includes(c)) {
          actions = c;
        }
      }

      if (mId) statusMap.set(mId, { status, date, actions });
      if (invId) statusMap.set(invId, { status, date, actions });
    }
  }

  // 1. Clear stray columns H+ and clear old sheet content
  const clearUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/PAYMENT_QUEUE!A1:Z2000:clear`;
  await fetch(clearUrl, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  // 2. Write Row 1 Headings (A1:G1)
  const headerPutUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/PAYMENT_QUEUE!A1:G1?valueInputOption=USER_ENTERED`;
  await fetch(headerPutUrl, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ values: [PAYMENT_QUEUE_HEADERS] }),
  });

  // 3. Reconstruct rows
  const repairedRows: string[][] = [];
  const resultQueueRows: PaymentQueueRow[] = [];

  for (const inv of readyInvoices) {
    const resolution = resolveInvoiceForMatch(inv, invoicesStore);
    const formattedAmount = resolution.amount;
    const supInvoiceInfo = `${inv.supplierName}\nInvoice ${inv.invoiceNumber}\nInvoice ID: ${inv.invoiceId}`;
    const threeWayRef = `PO: ${inv.poNumber}\nGRN: ${inv.grnNumbers}\nMatch: ${inv.matchId}`;

    const rawDueDate = resolution.dueDate ? resolution.dueDate.trim() : '';
    const invDueDate = rawDueDate ? formatSGDate(rawDueDate) : 'Unavailable';
    const creditTermsStr = resolveSupplierCreditTermsStr(inv.supplierName, invDueDate, suppliersList);

    const prev = statusMap.get(inv.matchId) || statusMap.get(inv.invoiceId);
    const status = prev ? prev.status : 'Pending Payment';
    const paymentDate = prev ? prev.date : '';
    const schedulingActions = prev ? prev.actions : (status === 'Paid' ? 'Payment Completed' : 'Schedule Payment');

    repairedRows.push([
      supInvoiceInfo,
      threeWayRef,
      formattedAmount,
      creditTermsStr,
      status,
      paymentDate,
      schedulingActions,
    ]);

    resultQueueRows.push({
      matchId: inv.matchId,
      invoiceId: inv.invoiceId,
      supplierInvoiceInfo: supInvoiceInfo,
      threeWayMatchRef: threeWayRef,
      invoiceAmount: formattedAmount,
      creditTermsAndDueDate: creditTermsStr,
      status,
      paymentDate,
      schedulingActions,
      riskLevel: inv.riskLevel,
      discrepancyDetails: inv.discrepancyDetails,
      diagnosticInfo: resolution.diagnostic,
      joinWarning: resolution.warning,
      lastSynced: new Date().toLocaleTimeString(),
    });
  }

  if (repairedRows.length > 0) {
    const rowsPutUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/PAYMENT_QUEUE!A2:G${repairedRows.length + 1}?valueInputOption=USER_ENTERED`;
    const res = await fetch(rowsPutUrl, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ values: repairedRows }),
    });

    if (!res.ok) {
      throw new Error(`Failed to write repaired rows to PAYMENT_QUEUE: ${await res.text()}`);
    }
  }

  return resultQueueRows;
}

export async function clearPaymentQueueSheet(spreadsheetId: string, accessToken: string): Promise<{ rowsRemoved: number }> {
  await ensureWorksheetExists(spreadsheetId, 'PAYMENT_QUEUE', accessToken);
  
  // 1. Read existing rows to count data rows
  const initialRows = await readWorksheetValues(spreadsheetId, 'PAYMENT_QUEUE', accessToken);
  const dataRowCount = Math.max(0, initialRows.length - 1);

  // 2. Clear values from row 2 onwards to preserve Row 1 headers
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/PAYMENT_QUEUE!A2:Z2000:clear`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    const errorJson = await res.json().catch(() => ({}));
    const message = errorJson.error?.message || `HTTP ${res.status}`;
    throw new Error(`Failed to clear PAYMENT_QUEUE sheet: ${message}`);
  }

  // 3. Re-read worksheet to verify that all data rows are empty
  const verifiedRows = await readWorksheetValues(spreadsheetId, 'PAYMENT_QUEUE', accessToken);
  if (verifiedRows.length > 1) {
    // Check if any non-empty data rows remain
    const remainingData = verifiedRows.slice(1).filter(r => r.some(cell => cell.trim() !== ''));
    if (remainingData.length > 0) {
      throw new Error(`Verification failed: ${remainingData.length} data rows remained after clearing.`);
    }
  }

  return { rowsRemoved: dataRowCount };
}

export async function validateDatabaseAccess(
  spreadsheetId: string,
  accessToken: string
): Promise<{
  title: string;
  isEditor: boolean;
  missingWorksheets: string[];
  existingWorksheets: string[];
}> {
  const info = await fetchSpreadsheetInfo(spreadsheetId, accessToken);
  const required = ['INVOICES', 'MATCH_RESULTS', 'PAYMENT_QUEUE'];
  const missingWorksheets = required.filter(
    (req) => !info.sheetTitles.some((t) => t.trim().toUpperCase() === req)
  );

  // Default to true if fetch metadata succeeds (since token has full spreadsheets scope)
  let isEditor = true;

  return {
    title: info.title,
    isEditor,
    missingWorksheets,
    existingWorksheets: info.sheetTitles,
  };
}

function addDaysToDate(dateStr: string, days: number): string {
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '28/08/2026';
    d.setDate(d.getDate() + days);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  } catch {
    return '28/08/2026';
  }
}
