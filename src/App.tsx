import React, { useEffect } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { GoogleSyncProvider, useGoogleSync } from './context/GoogleSyncContext';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { LoginPage } from './pages/LoginPage';
import { HomePage } from './pages/HomePage';
import { DashboardPage } from './pages/DashboardPage';
import { PaymentQueuePage } from './pages/PaymentQueuePage';
import { PaymentArchivesPage } from './pages/PaymentArchivesPage';
import { FlaggedAnomaliesPage } from './pages/FlaggedAnomaliesPage';
import { CreditNotesRefundsPage } from './pages/CreditNotesRefundsPage';
import { AuditTrailPage } from './pages/AuditTrailPage';
import { SupplierInfoPage } from './pages/SupplierInfoPage';
import { OverduePaymentsPage } from './pages/OverduePaymentsPage';
import { ManagementPage } from './pages/ManagementPage';
import { GoogleSheetsSimulatorPage } from './pages/GoogleSheetsSimulatorPage';

const AppContent: React.FC = () => {
  const { currentUser, mfaVerified, currentPage, processInvoicesForSuppliers } = useApp();
  const { invoicesRows } = useGoogleSync();

  useEffect(() => {
    if (invoicesRows && invoicesRows.length > 0) {
      processInvoicesForSuppliers(invoicesRows);
    }
  }, [invoicesRows]);

  // If user is not logged in or MFA is not completed, show Login/MFA screen
  if (!currentUser || !mfaVerified) {
    return <LoginPage />;
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex text-slate-800 font-sans">
      
      {/* Fixed Left Sidebar */}
      <Sidebar />

      {/* Main Content Workspace Area */}
      <div className="flex-1 ml-64 flex flex-col min-h-screen">
        
        {/* Sticky Header Bar */}
        <Header />

        {/* Page View Switcher */}
        <main className="flex-1 p-8 max-w-7xl w-full mx-auto">
          {currentPage === 'home' && <HomePage />}
          {currentPage === 'dashboard' && <DashboardPage />}
          {currentPage === 'payment-queue' && <PaymentQueuePage />}
          {currentPage === 'overdue-payments' && <OverduePaymentsPage />}
          {currentPage === 'payment-archives' && <PaymentArchivesPage />}
          {currentPage === 'flagged-anomalies' && <FlaggedAnomaliesPage />}
          {currentPage === 'credit-notes' && <CreditNotesRefundsPage />}
          {currentPage === 'audit-trail' && <AuditTrailPage />}
          {currentPage === 'supplier-info' && <SupplierInfoPage />}
          {currentPage === 'management' && <ManagementPage />}
          {currentPage === 'sheets-tab' && <GoogleSheetsSimulatorPage />}
        </main>

      </div>

    </div>
  );
};

export default function App() {
  return (
    <GoogleSyncProvider>
      <AppProvider>
        <AppContent />
      </AppProvider>
    </GoogleSyncProvider>
  );
}

