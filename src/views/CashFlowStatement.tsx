import { useEffect, useState } from 'react';
import { Box, Paper, Table, TableBody, TableCell, TableContainer, TableRow, TextField, Button } from '@mui/material';
import { getDb } from '../lib/db';
import ReportHeader from '../components/ReportHeader';
import { exportCashFlowPDF } from '../lib/exportUtils';
import { useSettingsStore } from '../store/useSettingsStore';

export default function CashFlowStatement() {
  const [operatingInflow, setOperatingInflow] = useState(0);
  const [operatingOutflow, setOperatingOutflow] = useState(0);
  const [investingInflow, setInvestingInflow] = useState(0);
  const [investingOutflow, setInvestingOutflow] = useState(0);
  const [financingInflow, setFinancingInflow] = useState(0);
  const [financingOutflow, setFinancingOutflow] = useState(0);
  const [beginningCash, setBeginningCash] = useState(0);

  const today = new Date().toISOString().split('T')[0];
  const [startDate, setStartDate] = useState(new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(today);

  useEffect(() => {
    async function loadData() {
      try {
        const db = await getDb();

        // Saldo Awal Kas (sebelum startDate)
        const initialCashQuery = await db.select<any[]>(`
          SELECT 
            COALESCE(SUM(jl.debit), 0) - COALESCE(SUM(jl.credit), 0) as balance 
          FROM journal_lines jl
          JOIN accounts a ON jl.account_id = a.id
          JOIN journal_entries je ON jl.entry_id = je.id
          WHERE a.code = '1101' AND je.date < $1
        `, [startDate]);
        
        // Cek jika akun 1101 memiliki initial_balance di tabel accounts
        const cashAcc = await db.select<any[]>(`SELECT initial_balance FROM accounts WHERE code = '1101'`);
        const baseCash = cashAcc[0]?.initial_balance || 0;
        
        setBeginningCash(baseCash + (initialCashQuery[0]?.balance || 0));

        // Ambil semua baris jurnal dalam periode tersebut, abaikan jurnal penutup
        const entries = await db.select<any[]>(`
          SELECT je.id as entry_id, a.code as account_code, a.type as account_type, jl.debit, jl.credit
          FROM journal_lines jl
          JOIN accounts a ON jl.account_id = a.id
          JOIN journal_entries je ON jl.entry_id = je.id
          WHERE je.date >= $1 AND je.date <= $2 AND je.is_closing = 0
        `, [startDate, endDate]);

        // Kelompokkan per entry_id
        const entryMap: Record<number, any[]> = {};
        entries.forEach(e => {
          if (!entryMap[e.entry_id]) entryMap[e.entry_id] = [];
          entryMap[e.entry_id].push(e);
        });

        let opIn = 0, opOut = 0;
        let invIn = 0, invOut = 0;
        let finIn = 0, finOut = 0;

        // Analisis tiap jurnal
        Object.values(entryMap).forEach(lines => {
          const cashLine = lines.find(l => l.account_code === '1101');
          if (!cashLine) return; // Jurnal ini tidak melibatkan kas

          const netCashMovement = (cashLine.debit || 0) - (cashLine.credit || 0);
          if (netCashMovement === 0) return;

          // Tentukan klasifikasi berdasarkan line lain yang dominan
          const otherLines = lines.filter(l => l.account_code !== '1101');
          let category = 'OPERATING'; // default

          // Jika melibatkan Aset Tetap -> INVESTING
          if (otherLines.some(l => l.account_code.startsWith('12'))) {
            category = 'INVESTING';
          } 
          // Jika melibatkan Hutang Jangka Panjang atau Modal -> FINANCING
          else if (otherLines.some(l => l.account_code.startsWith('22') || l.account_type === 'equity')) {
            category = 'FINANCING';
          }

          if (netCashMovement > 0) {
            if (category === 'OPERATING') opIn += netCashMovement;
            else if (category === 'INVESTING') invIn += netCashMovement;
            else if (category === 'FINANCING') finIn += netCashMovement;
          } else {
            const outAmount = Math.abs(netCashMovement);
            if (category === 'OPERATING') opOut += outAmount;
            else if (category === 'INVESTING') invOut += outAmount;
            else if (category === 'FINANCING') finOut += outAmount;
          }
        });

        setOperatingInflow(opIn);
        setOperatingOutflow(opOut);
        setInvestingInflow(invIn);
        setInvestingOutflow(invOut);
        setFinancingInflow(finIn);
        setFinancingOutflow(finOut);

      } catch (e) {
        console.error(e);
      }
    }
    loadData();
  }, [startDate, endDate]);

  const formatRupiah = (val: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(val);

  const netOperating = operatingInflow - operatingOutflow;
  const netInvesting = investingInflow - investingOutflow;
  const netFinancing = financingInflow - financingOutflow;
  
  const netIncreaseInCash = netOperating + netInvesting + netFinancing;
  const endingCash = beginningCash + netIncreaseInCash;

  const companyName = useSettingsStore(state => state.companyName);

  const handlePrint = async () => {
    await exportCashFlowPDF({
      companyName,
      startDate,
      endDate,
      operatingInflow,
      operatingOutflow,
      investingInflow,
      investingOutflow,
      financingInflow,
      financingOutflow,
      beginningCash,
    });
  };

  return (
    <Box sx={{ maxWidth: 900, mx: 'auto', pb: 5 }}>
      <Box sx={{ display: 'flex', gap: 2, mb: 3, p: 2, bgcolor: 'background.paper', borderRadius: 1, boxShadow: 1, '@media print': { display: 'none' } }}>
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
        <Button variant="outlined" onClick={handlePrint}>Cetak PDF</Button>
      </Box>

      <Paper sx={{ p: 4 }} className="print-area">
        <ReportHeader title="Laporan Arus Kas (Cash Flow)" period={`Periode: ${startDate} s.d. ${endDate}`} />

        <TableContainer>
          <Table size="small">
            <TableBody>
              {/* OPERATING ACTIVITIES */}
              <TableRow>
                <TableCell colSpan={2} sx={{ fontWeight: 'bold', borderBottom: 'none', pt: 3 }}>Arus Kas dari Aktivitas Operasi</TableCell>
              </TableRow>
              <TableRow>
                <TableCell sx={{ pl: 4, borderBottom: 'none' }}>Penerimaan Kas (Pendapatan/Piutang)</TableCell>
                <TableCell align="right" sx={{ borderBottom: 'none' }}>{formatRupiah(operatingInflow)}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell sx={{ pl: 4, borderBottom: 'none' }}>Pengeluaran Kas (Beban/Hutang/Persediaan)</TableCell>
                <TableCell align="right" sx={{ borderBottom: 'none' }}>({formatRupiah(operatingOutflow)})</TableCell>
              </TableRow>
              <TableRow>
                <TableCell sx={{ pl: 4, fontWeight: 'bold' }}>Kas Bersih dari Aktivitas Operasi</TableCell>
                <TableCell align="right" sx={{ fontWeight: 'bold' }}>{formatRupiah(netOperating)}</TableCell>
              </TableRow>

              {/* INVESTING ACTIVITIES */}
              <TableRow>
                <TableCell colSpan={2} sx={{ fontWeight: 'bold', borderBottom: 'none', pt: 3 }}>Arus Kas dari Aktivitas Investasi</TableCell>
              </TableRow>
              <TableRow>
                <TableCell sx={{ pl: 4, borderBottom: 'none' }}>Penerimaan dari Penjualan Aset Tetap</TableCell>
                <TableCell align="right" sx={{ borderBottom: 'none' }}>{formatRupiah(investingInflow)}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell sx={{ pl: 4, borderBottom: 'none' }}>Pengeluaran untuk Pembelian Aset Tetap</TableCell>
                <TableCell align="right" sx={{ borderBottom: 'none' }}>({formatRupiah(investingOutflow)})</TableCell>
              </TableRow>
              <TableRow>
                <TableCell sx={{ pl: 4, fontWeight: 'bold' }}>Kas Bersih dari Aktivitas Investasi</TableCell>
                <TableCell align="right" sx={{ fontWeight: 'bold' }}>{formatRupiah(netInvesting)}</TableCell>
              </TableRow>

              {/* FINANCING ACTIVITIES */}
              <TableRow>
                <TableCell colSpan={2} sx={{ fontWeight: 'bold', borderBottom: 'none', pt: 3 }}>Arus Kas dari Aktivitas Pendanaan</TableCell>
              </TableRow>
              <TableRow>
                <TableCell sx={{ pl: 4, borderBottom: 'none' }}>Penerimaan Pinjaman Bank / Setoran Modal</TableCell>
                <TableCell align="right" sx={{ borderBottom: 'none' }}>{formatRupiah(financingInflow)}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell sx={{ pl: 4, borderBottom: 'none' }}>Pelunasan Pinjaman / Prive / Dividen</TableCell>
                <TableCell align="right" sx={{ borderBottom: 'none' }}>({formatRupiah(financingOutflow)})</TableCell>
              </TableRow>
              <TableRow>
                <TableCell sx={{ pl: 4, fontWeight: 'bold' }}>Kas Bersih dari Aktivitas Pendanaan</TableCell>
                <TableCell align="right" sx={{ fontWeight: 'bold' }}>{formatRupiah(netFinancing)}</TableCell>
              </TableRow>

              {/* TOTALS */}
              <TableRow>
                <TableCell sx={{ fontWeight: 'bold', pt: 4, fontSize: '1.1rem' }}>Kenaikan (Penurunan) Kas Bersih</TableCell>
                <TableCell align="right" sx={{ fontWeight: 'bold', pt: 4, fontSize: '1.1rem' }}>{formatRupiah(netIncreaseInCash)}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell sx={{ fontWeight: 'bold' }}>Saldo Kas Awal Periode</TableCell>
                <TableCell align="right" sx={{ fontWeight: 'bold' }}>{formatRupiah(beginningCash)}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell sx={{ fontWeight: 'bold', fontSize: '1.1rem', color: 'primary.main' }}>Saldo Kas Akhir Periode</TableCell>
                <TableCell align="right" sx={{ fontWeight: 'bold', fontSize: '1.1rem', color: 'primary.main' }}>{formatRupiah(endingCash)}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>
    </Box>
  );
}
