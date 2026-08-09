import { Supplier, InvoiceSheetRow, ConflictingBankAccount, AuditLog } from '../types';

export function normalizeSupplierName(name: string): string {
  if (!name) return '';
  return name.trim().replace(/\s+/g, ' ').toLowerCase();
}

export function maskBankAccount(acc: string): string {
  if (!acc) return '••••••';
  const clean = acc.trim();
  if (clean.length <= 4) return `••••${clean}`;
  return `••••••${clean.slice(-4)}`;
}

export function mergeSuppliersFromInvoices(
  existingSuppliers: Supplier[],
  invoiceRows: InvoiceSheetRow[],
  addAuditLog?: (action: AuditLog['actionType'], desc: string, meta?: any) => void
): Supplier[] {
  if (!invoiceRows || invoiceRows.length === 0) return existingSuppliers;

  // Group invoice rows by normalized supplier name
  const groups = new Map<
    string,
    {
      originalName: string;
      rows: InvoiceSheetRow[];
    }
  >();

  for (const row of invoiceRows) {
    const rawName = row.supplierName?.trim();
    if (!rawName) continue;
    const norm = normalizeSupplierName(rawName);
    if (!norm) continue;

    if (!groups.has(norm)) {
      groups.set(norm, { originalName: rawName, rows: [] });
    }
    groups.get(norm)!.rows.push(row);
  }

  const updatedSuppliers = [...existingSuppliers];
  const nowStr = new Date().toLocaleTimeString();

  for (const [normKey, { originalName, rows }] of groups.entries()) {
    const invoiceCount = rows.length;
    const latestRow = rows[rows.length - 1] || rows[0];
    const latestInvoiceNo = latestRow.invoiceNumber || latestRow.invoiceId || '';
    const latestInvoiceDate = latestRow.invoiceDate || '';
    const latestInvoiceAmount = latestRow.invoiceTotal || '';
    const currency = latestRow.currency || 'SGD';

    // Collect non-empty bank account entries
    const bankEntries: ConflictingBankAccount[] = [];
    for (const r of rows) {
      const bank = r.supplierBankAccountNo?.trim();
      if (bank) {
        bankEntries.push({
          bankAccount: bank,
          invoiceId: r.invoiceId || '',
          invoiceNumber: r.invoiceNumber || '',
          invoiceDate: r.invoiceDate,
          invoiceTotal: r.invoiceTotal,
        });
      }
    }

    const uniqueBankAccounts = Array.from(new Set(bankEntries.map((b) => b.bankAccount)));
    let hasBankConflict = false;
    let computedBankAccount = '';

    if (uniqueBankAccounts.length === 1) {
      computedBankAccount = uniqueBankAccounts[0];
    } else if (uniqueBankAccounts.length > 1) {
      hasBankConflict = true;
      computedBankAccount = uniqueBankAccounts[0];
    }

    const existingIndex = updatedSuppliers.findIndex(
      (s) => normalizeSupplierName(s.name) === normKey
    );

    if (existingIndex !== -1) {
      const existing = updatedSuppliers[existingIndex];

      let finalBankAccount = existing.bankAccount;
      let finalHasConflict = existing.hasBankConflict || false;
      let finalConflictEntries = existing.conflictingBankAccounts || [];

      if (!existing.manuallySetBankAcc) {
        if (hasBankConflict) {
          finalHasConflict = true;
          finalConflictEntries = bankEntries;
          if (!finalBankAccount) finalBankAccount = computedBankAccount;
        } else {
          finalHasConflict = false;
          finalConflictEntries = [];
          if (computedBankAccount) finalBankAccount = computedBankAccount;
        }
      }

      const merged: Supplier = {
        ...existing,
        name: existing.name || originalName,
        bankAccount: finalBankAccount,
        hasBankConflict: finalHasConflict,
        conflictingBankAccounts: finalConflictEntries,
        invoiceCount,
        latestInvoiceNo,
        latestInvoiceDate,
        latestInvoiceAmount,
        currency,
        lastSynced: nowStr,
        isRemoved: existing.isRemoved || false,
      };

      updatedSuppliers[existingIndex] = merged;
    } else {
      const newId = `SUP-${String(updatedSuppliers.length + 1).padStart(3, '0')}`;
      const newSupplier: Supplier = {
        id: newId,
        name: originalName,
        contactPerson: '',
        email: '',
        phone: '',
        creditTermsDays: 30,
        bankAccount: computedBankAccount,
        address: '',
        invoiceCount,
        latestInvoiceNo,
        latestInvoiceDate,
        latestInvoiceAmount,
        currency,
        lastSynced: nowStr,
        hasBankConflict,
        conflictingBankAccounts: hasBankConflict ? bankEntries : [],
        manuallySetBankAcc: false,
        isManualOnly: false,
        isRemoved: false,
      };

      updatedSuppliers.push(newSupplier);

      if (addAuditLog) {
        addAuditLog(
          'SUPPLIER_IMPORTED_FROM_INVOICES',
          `Automatically created supplier profile for '${originalName}' from live INVOICES sheet. Bank Account: ${
            computedBankAccount ? maskBankAccount(computedBankAccount) : 'None'
          }.`,
          { supplierName: originalName, id: newId }
        );
      }
    }
  }

  return updatedSuppliers;
}
