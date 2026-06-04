import { useEffect, useState } from 'react';
import { Box, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Button } from '@mui/material';
import { getDb } from '../lib/db';
import { exportToPDF, exportToExcel } from '../lib/exportUtils';

import ReportHeader from '../components/ReportHeader';
import { useSettingsStore } from '../store/useSettingsStore';

export default function TrialBalance() {
  const { companyName } = useSettingsStore();
  const [data, setData] = useState<any[]>([]);

  useEffect(() => {
    async function loadData() {
      const db = await getDb();
      const result = await db.select<any[]>(`
        SELECT 
          a.code, a.name, a.type, a.initial_balance,
          COALESCE(SUM(jl.debit), 0) as total_debit,
          COALESCE(SUM(jl.credit), 0) as total_credit
        FROM accounts a
        LEFT JOIN journal_lines jl ON a.id = jl.account_id
        GROUP BY a.id
        ORDER BY a.code ASC
      `);

      const processed = result.map(acc => {
        const isCreditNormal = ['liability', 'equity', 'revenue'].includes(acc.type);
        const bal = isCreditNormal 
          ? acc.initial_balance + acc.total_credit - acc.total_debit 
          : acc.initial_balance + acc.total_debit - acc.total_credit;
        
        let finalDebit = 0;
        let finalCredit = 0;

        if (bal > 0) {
          if (isCreditNormal) finalCredit = bal;
          else finalDebit = bal;
        } else if (bal < 0) {
          if (isCreditNormal) finalDebit = Math.abs(bal);
          else finalCredit = Math.abs(bal);
        }

        return {
          code: acc.code,
          name: acc.name,
          initial_balance: acc.initial_balance,
          mutasi_d: acc.total_debit,
          mutasi_k: acc.total_credit,
          final_debit: finalDebit,
          final_credit: finalCredit
        };
      }).filter(acc => acc.initial_balance !== 0 || acc.mutasi_d !== 0 || acc.mutasi_k !== 0);

      setData(processed);
    }
    loadData();
  }, []);

  const formatRupiah = (val: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(val);

  const totalMutasiD = data.reduce((sum, item) => sum + item.mutasi_d, 0);
  const totalMutasiK = data.reduce((sum, item) => sum + item.mutasi_k, 0);
  const totalAkhirD = data.reduce((sum, item) => sum + item.final_debit, 0);
  const totalAkhirK = data.reduce((sum, item) => sum + item.final_credit, 0);

  const isBalancedMutasi = totalMutasiD === totalMutasiK;
  const isBalancedAkhir = totalAkhirD === totalAkhirK;

  const periodText = `Per ${new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })}`;

  const handleExportPDF = () => {
    const body = data.map(row => [row.code, row.name, row.initial_balance, row.mutasi_d, row.mutasi_k, row.final_debit, row.final_credit]);
    body.push(['', 'TOTAL', '', totalMutasiD, totalMutasiK, totalAkhirD, totalAkhirK]);
    exportToPDF('Neraca Saldo', ['No Akun', 'Nama Akun', 'Saldo Awal', 'Mutasi (D)', 'Mutasi (K)', 'Akhir (D)', 'Akhir (K)'], body, `Perusahaan: ${companyName}\n${periodText}`);
  };

  const handleExportExcel = () => {
    const excelData = data.map(row => ({
      'No Akun': row.code,
      'Nama Akun': row.name,
      'Saldo Awal': row.initial_balance,
      'Mutasi (D)': row.mutasi_d,
      'Mutasi (K)': row.mutasi_k,
      'Saldo Akhir (D)': row.final_debit,
      'Saldo Akhir (K)': row.final_credit
    }));
    excelData.push({ 'No Akun': '', 'Nama Akun': 'TOTAL', 'Saldo Awal': 0, 'Mutasi (D)': totalMutasiD, 'Mutasi (K)': totalMutasiK, 'Saldo Akhir (D)': totalAkhirD, 'Saldo Akhir (K)': totalAkhirK });
    exportToExcel(`Neraca_Saldo_${companyName.replace(/\s+/g, '_')}`, excelData);
  };

  return (
    <Box sx={{ maxWidth: 1200, mx: 'auto' }}>
      <ReportHeader title="Neraca Saldo (Trial Balance)" period={periodText} />
      
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2, gap: 2 }}>
        <Button variant="outlined" color="primary" onClick={handleExportPDF} size="small">Ekspor PDF</Button>
        <Button variant="outlined" color="success" onClick={handleExportExcel} size="small">Ekspor Excel</Button>
      </Box>

      <TableContainer component={Paper} sx={{ boxShadow: '0 4px 20px rgba(0,0,0,0.05)', borderRadius: 2, overflow: 'hidden' }}>
        <Table size="small">
          <TableHead sx={{ bgcolor: 'action.hover' }}>
            <TableRow>
              <TableCell sx={{ fontWeight: 700, py: 2, borderBottom: '2px solid #e0e0e0' }}>No Akun</TableCell>
              <TableCell sx={{ fontWeight: 700, borderBottom: '2px solid #e0e0e0' }}>Nama Akun</TableCell>
              <TableCell sx={{ fontWeight: 700, borderBottom: '2px solid #e0e0e0' }} align="right">Saldo Awal</TableCell>
              <TableCell sx={{ fontWeight: 700, borderBottom: '2px solid #e0e0e0', borderLeft: '1px solid #f0f0f0' }} align="right">Mutasi (D)</TableCell>
              <TableCell sx={{ fontWeight: 700, borderBottom: '2px solid #e0e0e0' }} align="right">Mutasi (K)</TableCell>
              <TableCell sx={{ fontWeight: 700, borderBottom: '2px solid #e0e0e0', borderLeft: '1px solid #f0f0f0' }} align="right">Saldo Akhir (D)</TableCell>
              <TableCell sx={{ fontWeight: 700, borderBottom: '2px solid #e0e0e0' }} align="right">Saldo Akhir (K)</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {data.map((row, idx) => (
              <TableRow key={idx} hover>
                <TableCell sx={{ py: 1.5, color: 'text.secondary' }}>{row.code}</TableCell>
                <TableCell sx={{ color: 'text.secondary' }}>{row.name}</TableCell>
                <TableCell align="right" sx={{ color: 'text.secondary' }}>{row.initial_balance > 0 ? formatRupiah(row.initial_balance) : '-'}</TableCell>
                <TableCell align="right" sx={{ borderLeft: '1px solid #f0f0f0' }}>{row.mutasi_d > 0 ? formatRupiah(row.mutasi_d) : '-'}</TableCell>
                <TableCell align="right">{row.mutasi_k > 0 ? formatRupiah(row.mutasi_k) : '-'}</TableCell>
                <TableCell align="right" sx={{ borderLeft: '1px solid #f0f0f0', fontWeight: row.final_debit > 0 ? 600 : 400, color: row.final_debit > 0 ? 'text.primary' : 'text.secondary' }}>
                  {row.final_debit > 0 ? formatRupiah(row.final_debit) : '-'}
                </TableCell>
                <TableCell align="right" sx={{ fontWeight: row.final_credit > 0 ? 600 : 400, color: row.final_credit > 0 ? 'text.primary' : 'text.secondary' }}>
                  {row.final_credit > 0 ? formatRupiah(row.final_credit) : '-'}
                </TableCell>
              </TableRow>
            ))}
            <TableRow sx={{ bgcolor: 'action.hover' }}>
              <TableCell colSpan={3} align="right" sx={{ fontWeight: 700, py: 2, borderTop: '2px solid #e0e0e0' }}>TOTAL KESELURUHAN:</TableCell>
              <TableCell align="right" sx={{ fontWeight: 800, borderTop: '2px solid #e0e0e0', borderLeft: '1px solid #e0e0e0', color: isBalancedMutasi ? 'success.main' : 'error.main' }}>
                {formatRupiah(totalMutasiD)}
              </TableCell>
              <TableCell align="right" sx={{ fontWeight: 800, borderTop: '2px solid #e0e0e0', color: isBalancedMutasi ? 'success.main' : 'error.main' }}>
                {formatRupiah(totalMutasiK)}
              </TableCell>
              <TableCell align="right" sx={{ fontWeight: 800, borderTop: '2px solid #e0e0e0', borderLeft: '1px solid #e0e0e0', color: isBalancedAkhir ? 'primary.main' : 'error.main' }}>
                {formatRupiah(totalAkhirD)}
              </TableCell>
              <TableCell align="right" sx={{ fontWeight: 800, borderTop: '2px solid #e0e0e0', color: isBalancedAkhir ? 'primary.main' : 'error.main' }}>
                {formatRupiah(totalAkhirK)}
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
}
