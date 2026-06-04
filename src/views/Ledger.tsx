import React, { useEffect, useState } from 'react';
import { Box, Typography, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, MenuItem, TextField, Button } from '@mui/material';
import { getDb } from '../lib/db';
import { exportToPDF, exportToExcel } from '../lib/exportUtils';
import { formatDateID } from '../lib/dateUtils';

import ReportHeader from '../components/ReportHeader';
import { useSettingsStore } from '../store/useSettingsStore';

export default function Ledger() {
  const { companyName } = useSettingsStore();
  const [accounts, setAccounts] = useState<any[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<number>(0);
  const [ledgerData, setLedgerData] = useState<any[]>([]);
  const [initialBalance, setInitialBalance] = useState<number>(0);
  const [isCreditNormal, setIsCreditNormal] = useState(false);

  useEffect(() => {
    async function loadAccounts() {
      const db = await getDb();
      const data = await db.select<any[]>('SELECT id, code, name, type FROM accounts ORDER BY code ASC');
      setAccounts(data);
    }
    loadAccounts();
  }, []);

  useEffect(() => {
    if (selectedAccountId) {
      loadLedger(selectedAccountId);
    } else {
      setLedgerData([]);
    }
  }, [selectedAccountId]);

  const loadLedger = async (accountId: number) => {
    const db = await getDb();
    const acc = await db.select<any[]>('SELECT type, initial_balance FROM accounts WHERE id = $1', [accountId]);
    const type = acc[0]?.type;
    const initBal = acc[0]?.initial_balance || 0;
    
    setInitialBalance(initBal);
    setIsCreditNormal(['liability', 'equity', 'revenue'].includes(type));

    const data = await db.select<any[]>(`
      SELECT je.date, je.reference, je.description, jl.debit, jl.credit 
      FROM journal_lines jl
      JOIN journal_entries je ON jl.entry_id = je.id
      WHERE jl.account_id = $1
      ORDER BY je.date ASC, je.id ASC
    `, [accountId]);
    
    setLedgerData(data);
  };

  const formatRupiah = (val: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(Math.abs(val));

  const calculateBalance = (bal: number, debit: number, credit: number) => {
    return isCreditNormal ? bal + credit - debit : bal + debit - credit;
  };

  let currentBalance = initialBalance;

  const periodText = `Hingga ${new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })}`;

  const handleExportPDF = () => {
    const acc = accounts.find(a => a.id === selectedAccountId);
    const title = 'Buku Besar - ' + (acc ? `${acc.code} ${acc.name}` : '');
    
    let bal = initialBalance;
    const body = ledgerData.map(row => {
      bal = calculateBalance(bal, row.debit || 0, row.credit || 0);
      return [
        row.date,
        row.reference,
        row.description,
        row.debit || '-',
        row.credit || '-',
        bal
      ];
    });
    const data = [['-', '-', 'Saldo Awal', '-', '-', initialBalance], ...body];
    exportToPDF(title, ['Tanggal', 'Referensi', 'Keterangan', 'Debit', 'Kredit', 'Saldo'], data, `Perusahaan: ${companyName}\n${periodText}`);
  };

  const handleExportExcel = () => {
    const acc = accounts.find(a => a.id === selectedAccountId);
    const title = 'Buku Besar - ' + (acc ? `${acc.code} ${acc.name}` : '');
    
    let bal = initialBalance;
    const data = [
      { Tanggal: '-', Referensi: '-', Keterangan: 'Saldo Awal', Debit: 0, Kredit: 0, Saldo: initialBalance },
      ...ledgerData.map(row => {
        bal = calculateBalance(bal, row.debit || 0, row.credit || 0);
        return {
          Tanggal: row.date,
          Referensi: row.reference,
          Keterangan: row.description,
          Debit: row.debit,
          Kredit: row.credit,
          Saldo: bal
        };
      })
    ];
    exportToExcel(`${title.replace(/\s+/g, '_')}_${companyName.replace(/\s+/g, '_')}`, data);
  };

  return (
    <Box>
      <ReportHeader title="Buku Besar" period={periodText} />
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 3 }}>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Button variant="outlined" onClick={handleExportPDF} disabled={!selectedAccountId}>Ekspor PDF</Button>
          <Button variant="outlined" onClick={handleExportExcel} disabled={!selectedAccountId}>Ekspor Excel</Button>
        </Box>
      </Box>

      <Paper sx={{ p: 3, mb: 3 }}>
        <TextField select label="Pilih Akun" value={selectedAccountId} onChange={(e) => setSelectedAccountId(parseInt(e.target.value as string))} fullWidth>
          <MenuItem value={0} disabled>-- Pilih Akun --</MenuItem>
          {accounts.map(acc => (
            <MenuItem key={acc.id} value={acc.id}>{acc.code} - {acc.name}</MenuItem>
          ))}
        </TextField>
      </Paper>

      {selectedAccountId > 0 && (
        <TableContainer component={Paper} sx={{ boxShadow: 3, borderRadius: 2 }}>
          <Table>
            <TableHead sx={{ bgcolor: 'primary.main' }}>
              <TableRow>
                <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Tanggal</TableCell>
                <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Referensi</TableCell>
                <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Keterangan</TableCell>
                <TableCell sx={{ color: 'white', fontWeight: 'bold' }} align="right">Debit</TableCell>
                <TableCell sx={{ color: 'white', fontWeight: 'bold' }} align="right">Kredit</TableCell>
                <TableCell sx={{ color: 'white', fontWeight: 'bold' }} align="right">Saldo</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              <TableRow sx={{ bgcolor: 'action.hover' }}>
                <TableCell colSpan={5} align="right" sx={{ fontWeight: 'bold' }}>Saldo Awal:</TableCell>
                <TableCell align="right" sx={{ fontWeight: 'bold' }}>{formatRupiah(initialBalance)}</TableCell>
              </TableRow>
              {ledgerData.map((row, idx) => {
                currentBalance = calculateBalance(currentBalance, row.debit || 0, row.credit || 0);
                return (
                  <TableRow key={idx} hover>
                    <TableCell>{formatDateID(row.date)}</TableCell>
                    <TableCell>{row.reference}</TableCell>
                    <TableCell>{row.description}</TableCell>
                    <TableCell align="right">{row.debit > 0 ? formatRupiah(row.debit) : '-'}</TableCell>
                    <TableCell align="right">{row.credit > 0 ? formatRupiah(row.credit) : '-'}</TableCell>
                    <TableCell align="right">{formatRupiah(currentBalance)}</TableCell>
                  </TableRow>
                );
              })}
              <TableRow sx={{ bgcolor: 'action.selected' }}>
                <TableCell colSpan={5} align="right" sx={{ fontWeight: 'bold', color: 'primary.main' }}>Saldo Akhir:</TableCell>
                <TableCell align="right" sx={{ fontWeight: 'bold', color: 'primary.main' }}>{formatRupiah(currentBalance)}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Box>
  );
}
