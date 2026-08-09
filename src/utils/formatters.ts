/**
 * Utility functions for Singapore Date formatting (DD/MM/YYYY)
 * and SGD Currency formatting.
 */

// Formats number to SGD currency e.g. "S$12,450.00"
export function formatSGD(amount: number): string {
  if (isNaN(amount)) return 'S$0.00';
  return new Intl.NumberFormat('en-SG', {
    style: 'currency',
    currency: 'SGD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount).replace('SGD', 'S$');
}

// Converts Date object or YYYY-MM-DD to DD/MM/YYYY
export function formatSGDate(date: Date | string | null | undefined): string {
  if (!date) return '-';
  
  if (typeof date === 'string') {
    // If already in DD/MM/YYYY
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(date)) {
      return date;
    }
    // If YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      const [y, m, d] = date.split('-');
      return `${d}/${m}/${y}`;
    }
  }

  const d = new Date(date);
  if (isNaN(d.getTime())) return String(date);

  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();

  return `${day}/${month}/${year}`;
}

// Converts DD/MM/YYYY or Date to YYYY-MM-DD for <input type="date">
export function toInputDateFormat(sgDateStr: string | Date | null | undefined): string {
  if (!sgDateStr) return '';
  if (sgDateStr instanceof Date) {
    const y = sgDateStr.getFullYear();
    const m = String(sgDateStr.getMonth() + 1).padStart(2, '0');
    const d = String(sgDateStr.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(sgDateStr)) {
    return sgDateStr;
  }
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(sgDateStr)) {
    const [d, m, y] = sgDateStr.split('/');
    return `${y}-${m}-${d}`;
  }
  return '';
}

// Parses DD/MM/YYYY or YYYY-MM-DD into Date object
export function parseDate(dateStr: string): Date | null {
  if (!dateStr) return null;
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(dateStr)) {
    const [d, m, y] = dateStr.split('/').map(Number);
    return new Date(y, m - 1, d);
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    const [y, m, d] = dateStr.split('-').map(Number);
    return new Date(y, m - 1, d);
  }
  const parsed = new Date(dateStr);
  return isNaN(parsed.getTime()) ? null : parsed;
}

// Checks if date A is after date B
export function isDateAfter(dateAStr: string, dateBStr: string): boolean {
  const dateA = parseDate(dateAStr);
  const dateB = parseDate(dateBStr);
  if (!dateA || !dateB) return false;
  
  // Set to midnight for clean comparison
  dateA.setHours(0, 0, 0, 0);
  dateB.setHours(0, 0, 0, 0);
  
  return dateA.getTime() > dateB.getTime();
}

// Checks if due date is before the simulated date
export function isOverdue(dueDateStr: string, simDateStr: string = '31/07/2026'): boolean {
  const due = parseDate(dueDateStr);
  const sim = parseDate(simDateStr) || new Date();
  if (!due || !sim) return false;
  
  due.setHours(0, 0, 0, 0);
  sim.setHours(0, 0, 0, 0);
  
  return due.getTime() < sim.getTime();
}

// Returns the number of days a payment is overdue
export function getDaysOverdue(dueDateStr: string, simDateStr: string = '31/07/2026'): number {
  const due = parseDate(dueDateStr);
  const sim = parseDate(simDateStr) || new Date();
  if (!due || !sim) return 0;
  
  due.setHours(0, 0, 0, 0);
  sim.setHours(0, 0, 0, 0);
  
  const diffTime = sim.getTime() - due.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  return diffDays > 0 ? diffDays : 0;
}

// Format current timestamp in SG format (e.g., "31/07/2026 11:45 AM")
export function formatSGDateTime(date: Date = new Date()): string {
  const datePart = formatSGDate(date);
  let hours = date.getHours();
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  hours = hours ? hours : 12;
  const strHours = String(hours).padStart(2, '0');
  return `${datePart} ${strHours}:${minutes} ${ampm}`;
}

// Get day of week name and formatted SG date e.g. "Friday, 31 July 2026"
export function formatFriendlyDate(dateStr?: string | Date): string {
  const d = dateStr ? parseDate(String(dateStr)) || new Date() : new Date();
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  
  const dayName = days[d.getDay()];
  const dayNum = d.getDate();
  const monthName = months[d.getMonth()];
  const year = d.getFullYear();

  return `${dayName}, ${dayNum} ${monthName} ${year}`;
}

/**
 * Extracts due date string from synced due date string (e.g. "Due: 02/09/2026")
 */
export function extractDueDateFromSyncedStr(str: string): string {
  if (!str) return '';
  const match = str.match(/Due:\s*(\d{2}\/\d{2}\/\d{4})/i) || str.match(/(\d{2}\/\d{2}\/\d{4})/);
  if (match && match[1]) return match[1];
  if (str.toLowerCase().includes('due:') && str.toLowerCase().includes('unavailable')) return 'Unavailable';
  return '';
}

/**
 * Formats due date string for display (e.g. "Due: 29/08/2026" or "Due Date Unavailable")
 * Strips legacy "Credit Terms Missing | " or "Net 30 Days | " prefixes if present in synced data.
 */
export function formatDueDateDisplay(str?: string): string {
  if (!str) return 'Due Date Unavailable';
  const clean = str.trim();
  if (!clean || clean === '-' || clean.toLowerCase().includes('unavailable')) {
    return 'Due Date Unavailable';
  }
  const match = clean.match(/Due:\s*(\d{2}\/\d{2}\/\d{4})/i) || clean.match(/(\d{2}\/\d{2}\/\d{4})/);
  if (match && match[1]) {
    return `Due: ${match[1]}`;
  }
  if (clean.startsWith('Due:')) return clean;
  return `Due: ${clean}`;
}

/**
 * Returns the authoritative due date directly from INVOICES.Due_Date (via fallbackDueDate / item.dueDate).
 * Do NOT independently calculate invoiceDate + creditTerms.
 */
export function calculateCreditTermDueDate(
  invoiceDateStr?: string,
  creditTermsDays: number = 30,
  fallbackDueDate?: string
): string {
  if (fallbackDueDate && fallbackDueDate !== 'Unavailable' && fallbackDueDate !== 'Invalid Date' && fallbackDueDate !== '-') {
    return formatSGDate(fallbackDueDate);
  }
  return (fallbackDueDate && fallbackDueDate !== 'Unavailable') ? fallbackDueDate : '';
}

/**
 * Checks if an invoice is overdue based on its authoritative due date from INVOICES.Due_Date.
 */
export function checkIsCreditTermOverdue(
  invoiceDateStr?: string,
  creditTermsDays: number = 30,
  fallbackDueDate?: string,
  simulatedDateStr?: string
): boolean {
  const creditTermDueDate = calculateCreditTermDueDate(invoiceDateStr, creditTermsDays, fallbackDueDate);
  if (!creditTermDueDate || creditTermDueDate === 'Unavailable') return false;
  return isOverdue(creditTermDueDate, simulatedDateStr);
}
