import { useEffect, useState } from 'react';
import { Box, Paper, Table, TableBody, TableCell, TableContainer, TableRow, Button, TextField } from '@mui/material';
import { getDb } from '../lib/db';
import { exportToPDF, exportToExcel } from '../lib/exportUtils';

import ReportHeader from '../components/ReportHeader';
import { useSettingsStore } from '../store/useSettingsStore';

export default function IncomeStatement() {
  const { companyName } = useSettingsStore();
  const [revenues, setRevenues] = useState<any[]>([]);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [totalRevenue, setTotalRevenue] = useState(0);
  const [totalExpense, setTotalExpense] = useState(0);

  const dateObj = new Date();
  const firstDay = new Date(dateObj.getFullYear(), dateObj.getMonth(), 1).toISOString().split('T')[0];
  const today = dateObj.toISOString().split('T')[0];
  const [startDate, setStartDate] = useState(firstDay);
  const [endDate, setEndDate] = useState(today);

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
        LEFT JOIN journal_entries je ON jl.entry_id = je.id AND je.date >= $1 AND je.date <= $2 AND je.is_closing = 0
        WHERE a.type IN ('revenue', 'expense')
        GROUP BY a.id
        ORDER BY a.code ASC
      `, [startDate, endDate]);

      let revs: any[] = [];
      let exps: any[] = [];
      let tRev = 0;
      let tExp = 0;

      result.forEach(acc => {
        if (acc.type === 'revenue') {
          const balance = acc.initial_balance + acc.total_credit - acc.total_debit;
          if (balance !== 0) {
            revs.push({ ...acc, balance });
            tRev += balance;
          }
        } else if (acc.type === 'expense') {
          const balance = acc.initial_balance + acc.total_debit - acc.total_credit;
          if (balance !== 0) {
            exps.push({ ...acc, balance });
            tExp += balance;
          }
        }
      });

      setRevenues(revs);
      setExpenses(exps);
      setTotalRevenue(tRev);
      setTotalExpense(tExp);
    }
    loadData();
  }, [startDate, endDate]);

  const formatRupiah = (val: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(val);
  const netIncome = totalRevenue - totalExpense;

  const fmtStart = new Date(startDate).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' });
  const fmtEnd = new Date(endDate).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' });
  const periodText = `Periode: ${fmtStart} - ${fmtEnd}`;

  const handleExportPDF = () => {
    const body = [
      [{ content: 'PENDAPATAN', colSpan: 3, styles: { fontStyle: 'bold' } }],
      ...revenues.map(r => [r.code, r.name, r.balance]),
      ['', 'Total Pendapatan', totalRevenue],
      [{ content: 'BEBAN', colSpan: 3, styles: { fontStyle: 'bold' } }],
      ...expenses.map(e => [e.code, e.name, e.balance]),
      ['', 'Total Beban', totalExpense],
      ['', 'LABA (RUGI) BERSIH', netIncome]
    ];
    exportToPDF('Laporan Laba Rugi', ['Kode', 'Keterangan', 'Jumlah'], body, `Perusahaan: ${companyName}\n${periodText}`);
  };

  const handleExportExcel = () => {
    const data = [
      { Kode: '', Keterangan: 'PENDAPATAN', Jumlah: '' },
      ...revenues.map(r => ({ Kode: r.code, Keterangan: r.name, Jumlah: r.balance })),
      { Kode: '', Keterangan: 'Total Pendapatan', Jumlah: totalRevenue },
      { Kode: '', Keterangan: '', Jumlah: '' },
      { Kode: '', Keterangan: 'BEBAN', Jumlah: '' },
      ...expenses.map(e => ({ Kode: e.code, Keterangan: e.name, Jumlah: e.balance })),
      { Kode: '', Keterangan: 'Total Beban', Jumlah: totalExpense },
      { Kode: '', Keterangan: '', Jumlah: '' },
      { Kode: '', Keterangan: 'LABA (RUGI) BERSIH', Jumlah: netIncome }
    ];
    exportToExcel(`Laba_Rugi_${companyName.replace(/\s+/g, '_')}`, data);
  };

  return (
    <Box sx={{ maxWidth: 900, mx: 'auto' }}>
      <ReportHeader title="Laporan Laba Rugi" period={periodText} />
      
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <TextField
            label="Mulai Tanggal"
            type="date"
            size="small"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            InputLabelProps={{ shrink: true }}
          />
          <TextField
            label="Sampai Tanggal"
            type="date"
            size="small"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            InputLabelProps={{ shrink: true }}
          />
        </Box>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Button variant="outlined" color="primary" onClick={handleExportPDF} size="small">Ekspor PDF</Button>
          <Button variant="outlined" color="success" onClick={handleExportExcel} size="small">Ekspor Excel</Button>
        </Box>
      </Box>

      <Paper sx={{ p: 0, boxShadow: '0 4px 20px rgba(0,0,0,0.05)', borderRadius: 2, overflow: 'hidden' }}>
        <TableContainer>
          <Table size="small">
            <TableBody>
              {/* PENDAPATAN */}
              <TableRow sx={{ bgcolor: 'action.selected' }}>
                <TableCell colSpan={2} sx={{ fontWeight: 700, fontSize: '0.95rem', py: 2, borderBottom: '2px solid #e0e0e0' }}>PENDAPATAN</TableCell>
              </TableRow>
              {revenues.length > 0 ? revenues.map(r => (
                <TableRow key={r.code} hover>
                  <TableCell sx={{ pl: 4, py: 1.5, color: 'text.secondary', borderBottom: '1px dashed #eee' }}>{r.code} - {r.name}</TableCell>
                  <TableCell align="right" sx={{ py: 1.5, borderBottom: '1px dashed #eee' }}>{formatRupiah(r.balance)}</TableCell>
                </TableRow>
              )) : (
                <TableRow><TableCell colSpan={2} align="center" sx={{ py: 2, color: 'text.disabled' }}>Tidak ada data pendapatan</TableCell></TableRow>
              )}
              <TableRow>
                <TableCell sx={{ fontWeight: 600, pl: 4, py: 2 }}>Total Pendapatan</TableCell>
                <TableCell align="right" sx={{ fontWeight: 700, py: 2 }}>{formatRupiah(totalRevenue)}</TableCell>
              </TableRow>

              {/* BEBAN */}
              <TableRow sx={{ bgcolor: 'action.selected' }}>
                <TableCell colSpan={2} sx={{ fontWeight: 700, fontSize: '0.95rem', py: 2, borderBottom: '2px solid #e0e0e0', borderTop: '1px solid #e0e0e0' }}>BEBAN</TableCell>
              </TableRow>
              {expenses.length > 0 ? expenses.map(e => (
                <TableRow key={e.code} hover>
                  <TableCell sx={{ pl: 4, py: 1.5, color: 'text.secondary', borderBottom: '1px dashed #eee' }}>{e.code} - {e.name}</TableCell>
                  <TableCell align="right" sx={{ py: 1.5, borderBottom: '1px dashed #eee' }}>{formatRupiah(e.balance)}</TableCell>
                </TableRow>
              )) : (
                <TableRow><TableCell colSpan={2} align="center" sx={{ py: 2, color: 'text.disabled' }}>Tidak ada data beban</TableCell></TableRow>
              )}
              <TableRow>
                <TableCell sx={{ fontWeight: 600, pl: 4, py: 2, borderBottom: '2px solid #000' }}>Total Beban</TableCell>
                <TableCell align="right" sx={{ fontWeight: 700, py: 2, borderBottom: '2px solid #000' }}>{formatRupiah(totalExpense)}</TableCell>
              </TableRow>

              {/* LABA/RUGI BERSIH */}
              <TableRow sx={{ bgcolor: netIncome >= 0 ? 'rgba(76, 175, 80, 0.08)' : 'rgba(244, 67, 54, 0.08)' }}>
                <TableCell sx={{ fontWeight: 800, fontSize: '1.1rem', py: 3, color: netIncome >= 0 ? 'success.dark' : 'error.dark' }}>
                  LABA (RUGI) BERSIH
                </TableCell>
                <TableCell align="right" sx={{ fontWeight: 800, fontSize: '1.2rem', py: 3, color: netIncome >= 0 ? 'success.dark' : 'error.dark' }}>
                  {formatRupiah(netIncome)}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>
    </Box>
  );
}
