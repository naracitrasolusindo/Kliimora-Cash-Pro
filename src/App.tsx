import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { useMemo } from 'react';

import Layout from './components/Layout';
import Login from './views/Login';
import Dashboard from './views/Dashboard';
import Accounts from './views/Accounts';
import Journal from './views/Journal';
import Ledger from './views/Ledger';
import TrialBalance from './views/TrialBalance';
import IncomeStatement from './views/IncomeStatement';
import BalanceSheet from './views/BalanceSheet';
import Users from './views/Users';
import Contacts from './views/Contacts';
import SubLedger from './views/SubLedger';
import Settings from './views/Settings';
import Inventory from './views/Inventory';
import Invoices from './views/Invoices';
import Budgeting from './views/Budgeting';
import FixedAssets from './views/FixedAssets';
import Bills from './views/Bills';
import Closing from './views/Closing';
import BankReconciliation from './views/BankReconciliation';
import CashFlowStatement from './views/CashFlowStatement';
import About from './views/About';
import { useAuthStore } from './store/useAuthStore';
import { useAppStore } from './store/useAppStore';
import { initDbAndSeed } from './lib/db';

// theme constant dihilangkan karena akan dibuat dinamis di komponen App

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const user = useAuthStore((state) => state.user);
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const user = useAuthStore((state) => state.user);
  if (user?.role !== 'admin') {
    return <Navigate to="/" replace />;
  }
  return <>{children}</>;
}

export default function App() {
  const [dbReady, setDbReady] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const { themeMode } = useAppStore();

  const theme = useMemo(() => createTheme({
    palette: {
      mode: themeMode,
      primary: { main: themeMode === 'light' ? '#d32f2f' : '#f44336' }, // Kliimora Red
      secondary: { main: '#1976d2' },
      background: {
        default: themeMode === 'light' ? '#f5f5f5' : '#121212',
        paper: themeMode === 'light' ? '#ffffff' : '#1e1e1e',
      },
    },
    typography: { fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif' },
  }), [themeMode]);

  useEffect(() => {
    initDbAndSeed()
      .then(() => setDbReady(true))
      .catch((err) => {
        console.error('Gagal inisialisasi database:', err);
        setErrorMsg(String(err));
      });
  }, []);

  if (errorMsg) {
    return <div style={{ padding: 20, color: 'red', fontFamily: 'sans-serif' }}>Error memuat database: {errorMsg}</div>;
  }

  if (!dbReady) {
    return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', fontFamily: 'sans-serif' }}>Memuat Sistem...</div>;
  }

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Router>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Dashboard />} />
            <Route path="accounts" element={<Accounts />} />
            <Route path="journal" element={<Journal />} />
            <Route path="invoices" element={<Invoices />} />
            <Route path="bills" element={<Bills />} />
            <Route path="budgeting" element={<Budgeting />} />
            <Route path="fixed-assets" element={<FixedAssets />} />
            <Route path="contacts" element={<Contacts />} />
            <Route path="inventory" element={<Inventory />} />
            <Route path="ledger" element={<AdminRoute><Ledger /></AdminRoute>} />
            <Route path="sub-ledger" element={<AdminRoute><SubLedger /></AdminRoute>} />
            <Route path="trial-balance" element={<AdminRoute><TrialBalance /></AdminRoute>} />
            <Route path="income-statement" element={<AdminRoute><IncomeStatement /></AdminRoute>} />
            <Route path="balance-sheet" element={<AdminRoute><BalanceSheet /></AdminRoute>} />
            <Route path="cash-flow" element={<AdminRoute><CashFlowStatement /></AdminRoute>} />
            <Route path="users" element={<AdminRoute><Users /></AdminRoute>} />
            <Route path="settings" element={<AdminRoute><Settings /></AdminRoute>} />
            <Route path="closing" element={<AdminRoute><Closing /></AdminRoute>} />
            <Route path="bank-reconciliation" element={<AdminRoute><BankReconciliation /></AdminRoute>} />
            <Route path="about" element={<About />} />
            <Route path="*" element={<Dashboard />} />
          </Route>
        </Routes>
      </Router>
    </ThemeProvider>
  );
}
