import { useEffect, useState } from 'react';
import { Box, Paper, Table, TableBody, TableCell, TableContainer, TableRow, Button, Grid, TextField } from '@mui/material';
import { getDb } from '../lib/db';
import { exportToPDF, exportToExcel } from '../lib/exportUtils';

import ReportHeader from '../components/ReportHeader';
import { useSettingsStore } from '../store/useSettingsStore';

export default function BalanceSheet() {
  const { companyName } = useSettingsStore();
  const [assets, setAssets] = useState<any[]>([]);
  const [liabilities, setLiabilities] = useState<any[]>([]);
  const [equities, setEquities] = useState<any[]>([]);
  
  const [totalAssets, setTotalAssets] = useState(0);
  const [totalLiabilities, setTotalLiabilities] = useState(0);
  const [totalEquity, setTotalEquity] = useState(0);
  const [netIncome, setNetIncome] = useState(0);

  const today = new Date().toISOString().split('T')[0];
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
        LEFT JOIN journal_entries je ON jl.entry_id = je.id AND je.date <= $1
        GROUP BY a.id
        ORDER BY a.code ASC
      `, [endDate]);

      let aList: any[] = [];
      let lList: any[] = [];
      let eList: any[] = [];
      let tA = 0, tL = 0, tE = 0, tRev = 0, tExp = 0;

      result.forEach(acc => {
        if (acc.type === 'asset') {
          const balance = acc.initial_balance + acc.total_debit - acc.total_credit;
          if (balance !== 0) { aList.push({ ...acc, balance }); tA += balance; }
        } else if (acc.type === 'liability') {
          const balance = acc.initial_balance + acc.total_credit - acc.total_debit;
          if (balance !== 0) { lList.push({ ...acc, balance }); tL += balance; }
        } else if (acc.type === 'equity') {
          const balance = acc.initial_balance + acc.total_credit - acc.total_debit;
          if (balance !== 0) { eList.push({ ...acc, balance }); tE += balance; }
        } else if (acc.type === 'revenue') {
          tRev += (acc.initial_balance + acc.total_credit - acc.total_debit);
        } else if (acc.type === 'expense') {
          tExp += (acc.initial_balance + acc.total_debit - acc.total_credit);
        }
      });

      const calculatedNetIncome = tRev - tExp;

      setAssets(aList);
      setLiabilities(lList);
      setEquities(eList);
      setTotalAssets(tA);
      setTotalLiabilities(tL);
      setTotalEquity(tE);
      setNetIncome(calculatedNetIncome);
    }
    loadData();
  }, [endDate]);

  const formatRupiah = (val: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(val);

  const totalLiabilitiesAndEquity = totalLiabilities + totalEquity + netIncome;
  const isBalanced = totalAssets === totalLiabilitiesAndEquity;

  const periodText = `Per ${new Date(endDate).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })}`;

  const handleExportPDF = () => {
    const body = [
      [{ content: 'ASET', colSpan: 3, styles: { fontStyle: 'bold' } }],
      ...assets.map(a => [a.code, a.name, a.balance]),
      ['', 'Total Aset', totalAssets],
      [{ content: 'KEWAJIBAN & EKUITAS', colSpan: 3, styles: { fontStyle: 'bold' } }],
      [{ content: 'Kewajiban', colSpan: 3, styles: { fontStyle: 'italic' } }],
      ...liabilities.map(l => [l.code, l.name, l.balance]),
      ['', 'Total Kewajiban', totalLiabilities],
      [{ content: 'Ekuitas', colSpan: 3, styles: { fontStyle: 'italic' } }],
      ...equities.map(e => [e.code, e.name, e.balance]),
      ['', 'Laba Berjalan', netIncome],
      ['', 'Total Ekuitas', totalEquity + netIncome],
      ['', 'TOTAL KEWAJIBAN & EKUITAS', totalLiabilitiesAndEquity]
    ];
    exportToPDF('Neraca', ['Kode', 'Keterangan', 'Jumlah'], body, `Perusahaan: ${companyName}\n${periodText}`);
  };

  const handleExportExcel = () => {
    const data = [
      { Kode: '', Keterangan: 'ASET', Jumlah: '' },
      ...assets.map(a => ({ Kode: a.code, Keterangan: a.name, Jumlah: a.balance })),
      { Kode: '', Keterangan: 'Total Aset', Jumlah: totalAssets },
      { Kode: '', Keterangan: '', Jumlah: '' },
      { Kode: '', Keterangan: 'KEWAJIBAN & EKUITAS', Jumlah: '' },
      { Kode: '', Keterangan: 'Kewajiban', Jumlah: '' },
      ...liabilities.map(l => ({ Kode: l.code, Keterangan: l.name, Jumlah: l.balance })),
      { Kode: '', Keterangan: 'Total Kewajiban', Jumlah: totalLiabilities },
      { Kode: '', Keterangan: 'Ekuitas', Jumlah: '' },
      ...equities.map(e => ({ Kode: e.code, Keterangan: e.name, Jumlah: e.balance })),
      { Kode: '', Keterangan: 'Laba Berjalan', Jumlah: netIncome },
      { Kode: '', Keterangan: 'Total Ekuitas', Jumlah: totalEquity + netIncome },
      { Kode: '', Keterangan: '', Jumlah: '' },
      { Kode: '', Keterangan: 'TOTAL KEWAJIBAN & EKUITAS', Jumlah: totalLiabilitiesAndEquity }
    ];
    exportToExcel(`Neraca_${companyName.replace(/\s+/g, '_')}`, data);
  };

  return (
    <Box sx={{ maxWidth: 1200, mx: 'auto' }}>
      <ReportHeader title="Neraca (Balance Sheet)" period={periodText} />
      
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <TextField
            label="Per Tanggal"
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

      <Grid container spacing={4}>
        {/* KOLOM ASET */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 0, boxShadow: '0 4px 20px rgba(0,0,0,0.05)', borderRadius: 2, height: '100%', overflow: 'hidden' }}>
            <TableContainer>
              <Table size="small">
                <TableBody>
                  <TableRow sx={{ bgcolor: 'action.selected' }}>
                    <TableCell colSpan={2} sx={{ fontWeight: 800, fontSize: '1rem', py: 2, borderBottom: '2px solid', borderColor: 'primary.main', color: 'primary.main' }}>ASET</TableCell>
                  </TableRow>
                  {assets.length > 0 ? assets.map(a => (
                    <TableRow key={a.code} hover>
                      <TableCell sx={{ pl: 3, py: 1.5, color: 'text.secondary', borderBottom: '1px dashed #eee' }}>{a.code} - {a.name}</TableCell>
                      <TableCell align="right" sx={{ py: 1.5, borderBottom: '1px dashed #eee' }}>{formatRupiah(a.balance)}</TableCell>
                    </TableRow>
                  )) : (
                    <TableRow><TableCell colSpan={2} align="center" sx={{ py: 2, color: 'text.disabled' }}>Tidak ada data aset</TableCell></TableRow>
                  )}
                  
                  {/* Spasi kosong agar seimbang dengan kolom sebelahnya jika perlu */}
                  <TableRow>
                    <TableCell colSpan={2} sx={{ py: 2, border: 'none' }}></TableCell>
                  </TableRow>

                  <TableRow sx={{ bgcolor: 'action.hover' }}>
                    <TableCell sx={{ fontWeight: 700, pl: 3, py: 2.5, borderTop: '2px solid #e0e0e0', borderBottom: 'none' }}>TOTAL ASET</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 800, fontSize: '1.05rem', py: 2.5, color: 'primary.main', borderTop: '2px solid', borderColor: 'divider', borderBottom: 'none' }}>
                      {formatRupiah(totalAssets)}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        </Grid>

        {/* KOLOM KEWAJIBAN & EKUITAS */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 0, boxShadow: '0 4px 20px rgba(0,0,0,0.05)', borderRadius: 2, height: '100%', overflow: 'hidden' }}>
            <TableContainer>
              <Table size="small">
                <TableBody>
                  <TableRow sx={{ bgcolor: 'action.selected' }}>
                    <TableCell colSpan={2} sx={{ fontWeight: 800, fontSize: '1rem', py: 2, borderBottom: '2px solid', borderColor: 'error.main', color: 'error.main' }}>KEWAJIBAN & EKUITAS</TableCell>
                  </TableRow>
                  
                  {/* Kewajiban */}
                  <TableRow>
                    <TableCell colSpan={2} sx={{ fontWeight: 700, fontSize: '0.9rem', pl: 3, py: 2, color: 'text.primary', borderBottom: '1px solid #f0f0f0' }}>Kewajiban</TableCell>
                  </TableRow>
                  {liabilities.length > 0 ? liabilities.map(l => (
                    <TableRow key={l.code} hover>
                      <TableCell sx={{ pl: 5, py: 1.5, color: 'text.secondary', borderBottom: '1px dashed #eee' }}>{l.code} - {l.name}</TableCell>
                      <TableCell align="right" sx={{ py: 1.5, borderBottom: '1px dashed #eee' }}>{formatRupiah(l.balance)}</TableCell>
                    </TableRow>
                  )) : (
                    <TableRow><TableCell colSpan={2} align="center" sx={{ py: 1, color: 'text.disabled' }}>-</TableCell></TableRow>
                  )}
                  <TableRow>
                    <TableCell sx={{ fontWeight: 600, pl: 5, py: 1.5 }}>Total Kewajiban</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 600, py: 1.5 }}>{formatRupiah(totalLiabilities)}</TableCell>
                  </TableRow>

                  {/* Ekuitas */}
                  <TableRow>
                    <TableCell colSpan={2} sx={{ fontWeight: 700, fontSize: '0.9rem', pl: 3, py: 2, color: 'text.primary', borderTop: '1px solid #f0f0f0', borderBottom: '1px solid #f0f0f0' }}>Ekuitas</TableCell>
                  </TableRow>
                  {equities.length > 0 ? equities.map(e => (
                    <TableRow key={e.code} hover>
                      <TableCell sx={{ pl: 5, py: 1.5, color: 'text.secondary', borderBottom: '1px dashed #eee' }}>{e.code} - {e.name}</TableCell>
                      <TableCell align="right" sx={{ py: 1.5, borderBottom: '1px dashed #eee' }}>{formatRupiah(e.balance)}</TableCell>
                    </TableRow>
                  )) : null}
                  <TableRow hover>
                    <TableCell sx={{ pl: 5, py: 1.5, color: 'text.secondary', borderBottom: '1px dashed #eee' }}>Laba (Rugi) Berjalan</TableCell>
                    <TableCell align="right" sx={{ py: 1.5, borderBottom: '1px dashed #eee', color: netIncome >= 0 ? 'success.main' : 'error.main' }}>
                      {formatRupiah(netIncome)}
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 600, pl: 5, py: 1.5 }}>Total Ekuitas</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 600, py: 1.5 }}>{formatRupiah(totalEquity + netIncome)}</TableCell>
                  </TableRow>

                  <TableRow sx={{ bgcolor: 'action.hover' }}>
                    <TableCell sx={{ fontWeight: 700, pl: 3, py: 2.5, borderTop: '2px solid #e0e0e0', borderBottom: 'none' }}>TOTAL KEWAJIBAN & EKUITAS</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 800, fontSize: '1.05rem', py: 2.5, borderTop: '2px solid #e0e0e0', borderBottom: 'none', color: isBalanced ? '#d32f2f' : 'error.main' }}>
                      {formatRupiah(totalLiabilitiesAndEquity)}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
}
