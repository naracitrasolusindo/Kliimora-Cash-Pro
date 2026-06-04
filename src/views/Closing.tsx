import React, { useState, useEffect } from 'react';
import { Box, Typography, Paper, TextField, MenuItem, Button, Alert, CircularProgress, Divider } from '@mui/material';
import { getDb } from '../lib/db';
import { useAuthStore } from '../store/useAuthStore';

export default function Closing() {
  const { user } = useAuthStore();
  const [closingDate, setClosingDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [equities, setEquities] = useState<any[]>([]);
  const [selectedEquityId, setSelectedEquityId] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [preview, setPreview] = useState<{ totalRevenue: number, totalExpense: number, netIncome: number } | null>(null);

  useEffect(() => {
    async function loadEquities() {
      const db = await getDb();
      const result = await db.select<any[]>('SELECT id, code, name FROM accounts WHERE type = $1 ORDER BY code ASC', ['equity']);
      setEquities(result);
      if (result.length > 0) {
        setSelectedEquityId(result[0].id);
      }
    }
    loadEquities();
  }, []);

  const handlePreview = async () => {
    try {
      setMessage(null);
      setLoading(true);
      const db = await getDb();
      
      // Hitung total pendapatan dan beban yang belum ditutup hingga tanggal closingDate
      const result = await db.select<any[]>(`
        SELECT 
          a.id, a.type, a.initial_balance,
          COALESCE(SUM(jl.debit), 0) as total_debit,
          COALESCE(SUM(jl.credit), 0) as total_credit
        FROM accounts a
        LEFT JOIN journal_lines jl ON a.id = jl.account_id
        LEFT JOIN journal_entries je ON jl.entry_id = je.id AND je.date <= $1 AND je.is_closing = 0
        WHERE a.type IN ('revenue', 'expense')
        GROUP BY a.id
      `, [closingDate]);

      let tRev = 0;
      let tExp = 0;

      result.forEach(acc => {
        if (acc.type === 'revenue') {
          tRev += acc.initial_balance + acc.total_credit - acc.total_debit;
        } else if (acc.type === 'expense') {
          tExp += acc.initial_balance + acc.total_debit - acc.total_credit;
        }
      });

      setPreview({ totalRevenue: tRev, totalExpense: tExp, netIncome: tRev - tExp });
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Gagal menghitung data' });
    } finally {
      setLoading(false);
    }
  };

  const executeClosing = async () => {
    if (!selectedEquityId) {
      setMessage({ type: 'error', text: 'Pilih Akun Ekuitas/Laba Ditahan terlebih dahulu' });
      return;
    }
    if (!preview) return;

    if (!window.confirm(`Anda yakin akan mengeksekusi Tutup Buku per tanggal ${closingDate}? Tindakan ini akan menol-kan saldo pendapatan & beban dan memindahkannya ke ekuitas.`)) {
      return;
    }

    try {
      setLoading(true);
      const db = await getDb();
      
      const accounts = await db.select<any[]>(`
        SELECT 
          a.id, a.type, a.initial_balance,
          COALESCE(SUM(jl.debit), 0) as total_debit,
          COALESCE(SUM(jl.credit), 0) as total_credit
        FROM accounts a
        LEFT JOIN journal_lines jl ON a.id = jl.account_id
        LEFT JOIN journal_entries je ON jl.entry_id = je.id AND je.date <= $1 AND je.is_closing = 0
        WHERE a.type IN ('revenue', 'expense')
        GROUP BY a.id
      `, [closingDate]);

      let lines = [];
      let tRev = 0;
      let tExp = 0;

      for (const acc of accounts) {
        if (acc.type === 'revenue') {
          const balance = acc.initial_balance + acc.total_credit - acc.total_debit;
          if (balance !== 0) {
            tRev += balance;
            lines.push({ account_id: acc.id, debit: balance, credit: 0 });
          }
        } else if (acc.type === 'expense') {
          const balance = acc.initial_balance + acc.total_debit - acc.total_credit;
          if (balance !== 0) {
            tExp += balance;
            lines.push({ account_id: acc.id, debit: 0, credit: balance });
          }
        }
      }

      const netIncome = tRev - tExp;

      if (netIncome > 0) {
        lines.push({ account_id: selectedEquityId, debit: 0, credit: netIncome });
      } else if (netIncome < 0) {
        lines.push({ account_id: selectedEquityId, debit: Math.abs(netIncome), credit: 0 });
      }

      if (lines.length === 0) {
        setMessage({ type: 'error', text: 'Tidak ada saldo pendapatan/beban untuk ditutup' });
        return;
      }

      await db.execute('BEGIN TRANSACTION');

      const result = await db.execute(
        'INSERT INTO journal_entries (date, description, reference, is_closing) VALUES ($1, $2, $3, 1)',
        [closingDate, 'Jurnal Penutup Periode', 'JT-TUTUP']
      );
      
      const entryId = result.lastInsertId;

      for (const line of lines) {
        await db.execute(
          'INSERT INTO journal_lines (entry_id, account_id, debit, credit) VALUES ($1, $2, $3, $4)',
          [entryId, line.account_id, line.debit, line.credit]
        );
      }

      // Update initial_balances to 0 for these accounts, and add netIncome to equity initial balance, 
      // ONLY IF we wanted a hard reset. But true accounting uses the closing journal entry itself to zero out balances.
      // So no need to UPDATE accounts table!

      await db.execute('COMMIT');
      
      setMessage({ type: 'success', text: 'Tutup buku berhasil dijalankan!' });
      setPreview(null);
    } catch (err: any) {
      await getDb().then(db => db.execute('ROLLBACK')).catch(() => {});
      setMessage({ type: 'error', text: err.message || 'Gagal mengeksekusi tutup buku' });
    } finally {
      setLoading(false);
    }
  };

  const formatRupiah = (val: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(val);

  return (
    <Box sx={{ maxWidth: 800, mx: 'auto' }}>
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" fontWeight="700" color="primary">Tutup Buku</Typography>
        <Typography variant="subtitle1" color="text.secondary">Jurnal Penutup Pendapatan & Beban</Typography>
      </Box>

      {message && (
        <Alert severity={message.type} sx={{ mb: 3 }} onClose={() => setMessage(null)}>
          {message.text}
        </Alert>
      )}

      <Paper sx={{ p: 4, borderRadius: 2, boxShadow: '0 4px 20px rgba(0,0,0,0.05)' }}>
        <Typography variant="h6" fontWeight="bold" sx={{ mb: 3 }}>Parameter Penutupan</Typography>
        
        <Box sx={{ display: 'flex', gap: 3, mb: 3 }}>
          <TextField
            label="Tanggal Penutupan (Cut-off Date)"
            type="date"
            fullWidth
            value={closingDate}
            onChange={(e) => setClosingDate(e.target.value)}
            InputLabelProps={{ shrink: true }}
          />
          <TextField
            select
            label="Akun Laba Ditahan (Ekuitas)"
            fullWidth
            value={selectedEquityId}
            onChange={(e) => setSelectedEquityId(Number(e.target.value))}
          >
            <MenuItem value={0} disabled>Pilih Akun</MenuItem>
            {equities.map((eq) => (
              <MenuItem key={eq.id} value={eq.id}>
                {eq.code} - {eq.name}
              </MenuItem>
            ))}
          </TextField>
        </Box>

        <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
          <Button 
            variant="contained" 
            color="primary" 
            onClick={handlePreview} 
            disabled={loading || !selectedEquityId}
          >
            {loading ? <CircularProgress size={24} color="inherit" /> : 'Pratinjau Saldo'}
          </Button>
        </Box>

        {preview && (
          <Box sx={{ mt: 4, p: 3, bgcolor: 'background.paper', borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
            <Typography variant="h6" sx={{ mb: 2, color: 'text.primary' }}>Ringkasan Saldo yang Akan Ditutup</Typography>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
              <Typography color="text.secondary">Total Pendapatan:</Typography>
              <Typography fontWeight="bold">{formatRupiah(preview.totalRevenue)}</Typography>
            </Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
              <Typography color="text.secondary">Total Beban:</Typography>
              <Typography fontWeight="bold">{formatRupiah(preview.totalExpense)}</Typography>
            </Box>
            <Divider sx={{ my: 2 }} />
            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
              <Typography color="text.secondary" fontWeight="bold">Laba / Rugi Bersih:</Typography>
              <Typography fontWeight="bold" color={preview.netIncome >= 0 ? 'success.main' : 'error.main'} fontSize="1.1rem">
                {formatRupiah(preview.netIncome)}
              </Typography>
            </Box>
            
            <Box sx={{ mt: 4, display: 'flex', justifyContent: 'flex-end' }}>
              <Button 
                variant="contained" 
                color="error" 
                onClick={executeClosing} 
                disabled={loading}
              >
                Eksekusi Tutup Buku
              </Button>
            </Box>
          </Box>
        )}
      </Paper>
    </Box>
  );
}
