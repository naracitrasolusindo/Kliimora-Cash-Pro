import { useState, useEffect } from 'react';
import { Box, Typography, Paper, TextField, MenuItem, Button, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Checkbox, Alert } from '@mui/material';
import { getDb } from '../lib/db';

export default function BankReconciliation() {
  const [accounts, setAccounts] = useState<any[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<number>(0);
  const [statementDate, setStatementDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [statementBalance, setStatementBalance] = useState<string>('');
  
  const [unreconciledLines, setUnreconciledLines] = useState<any[]>([]);
  const [selectedLines, setSelectedLines] = useState<Set<number>>(new Set());
  const [initialBalance, setInitialBalance] = useState<number>(0);
  
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  useEffect(() => {
    async function loadAccounts() {
      const db = await getDb();
      // Hanya ambil akun Kas/Bank (contoh: Kas dan Setara Kas)
      const result = await db.select<any[]>('SELECT id, code, name FROM accounts WHERE type = $1', ['asset']);
      setAccounts(result);
      if (result.length > 0) {
        setSelectedAccountId(result[0].id);
      }
    }
    loadAccounts();
  }, []);

  useEffect(() => {
    if (selectedAccountId) {
      loadUnreconciled();
    }
  }, [selectedAccountId, statementDate]);

  const loadUnreconciled = async () => {
    try {
      const db = await getDb();
      
      // Ambil saldo awal (termasuk mutasi yang SUDAH direkonsiliasi sebelumnya)
      const acc = await db.select<any[]>('SELECT initial_balance FROM accounts WHERE id = $1', [selectedAccountId]);
      const initial = acc[0]?.initial_balance || 0;

      const reconciledMutations = await db.select<any[]>(`
        SELECT COALESCE(SUM(jl.debit), 0) as t_debit, COALESCE(SUM(jl.credit), 0) as t_credit
        FROM journal_lines jl
        JOIN journal_entries je ON jl.entry_id = je.id
        WHERE jl.account_id = $1 AND jl.is_reconciled = 1
      `, [selectedAccountId]);

      const startBalance = initial + (reconciledMutations[0]?.t_debit || 0) - (reconciledMutations[0]?.t_credit || 0);
      setInitialBalance(startBalance);

      // Ambil transaksi yang belum direkonsiliasi sampai dengan tanggal statement
      const lines = await db.select<any[]>(`
        SELECT jl.id, je.date, je.reference, je.description, jl.debit, jl.credit
        FROM journal_lines jl
        JOIN journal_entries je ON jl.entry_id = je.id
        WHERE jl.account_id = $1 AND jl.is_reconciled = 0 AND je.date <= $2
        ORDER BY je.date ASC
      `, [selectedAccountId, statementDate]);
      
      setUnreconciledLines(lines);
      setSelectedLines(new Set());
      setMessage(null);
    } catch (err: any) {
      setMessage({ type: 'error', text: 'Gagal memuat transaksi: ' + err.message });
    }
  };

  const handleToggleLine = (id: number) => {
    const newSet = new Set(selectedLines);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedLines(newSet);
  };

  const calculateClearedBalance = () => {
    let cleared = initialBalance;
    unreconciledLines.forEach(line => {
      if (selectedLines.has(line.id)) {
        cleared += (line.debit || 0) - (line.credit || 0);
      }
    });
    return cleared;
  };

  const formatRupiah = (val: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(val);

  const clearedBalance = calculateClearedBalance();
  const targetBalance = Number(statementBalance.replace(/[^0-9.-]+/g, "")) || 0;
  const difference = clearedBalance - targetBalance;

  const handleSaveReconciliation = async () => {
    if (difference !== 0) {
      setMessage({ type: 'error', text: 'Selisih harus 0 sebelum rekonsiliasi dapat diselesaikan.' });
      return;
    }

    if (!window.confirm('Selesaikan rekonsiliasi bank? Transaksi yang dicentang akan dikunci.')) return;

    try {
      const db = await getDb();
      await db.execute('BEGIN TRANSACTION');

      const result = await db.execute(
        'INSERT INTO bank_reconciliations (account_id, statement_date, statement_balance, reconciled_balance, status) VALUES ($1, $2, $3, $4, $5)',
        [selectedAccountId, statementDate, targetBalance, clearedBalance, 'COMPLETED']
      );

      const reconId = result.lastInsertId;

      for (const lineId of Array.from(selectedLines)) {
        await db.execute(
          'UPDATE journal_lines SET is_reconciled = 1, recon_id = $1 WHERE id = $2',
          [reconId, lineId]
        );
      }

      await db.execute('COMMIT');
      setMessage({ type: 'success', text: 'Rekonsiliasi bank berhasil disimpan.' });
      loadUnreconciled();
    } catch (err: any) {
      await getDb().then(db => db.execute('ROLLBACK')).catch(() => {});
      setMessage({ type: 'error', text: 'Gagal menyimpan rekonsiliasi: ' + err.message });
    }
  };

  return (
    <Box sx={{ maxWidth: 1000, mx: 'auto' }}>
      <Typography variant="h4" fontWeight="700" color="primary" sx={{ mb: 1 }}>Rekonsiliasi Bank</Typography>
      <Typography variant="subtitle1" color="text.secondary" sx={{ mb: 4 }}>Cocokkan catatan buku kas dengan mutasi rekening koran asli</Typography>

      {message && (
        <Alert severity={message.type} sx={{ mb: 3 }} onClose={() => setMessage(null)}>
          {message.text}
        </Alert>
      )}

      <Paper sx={{ p: 3, mb: 4, borderRadius: 2 }}>
        <Box sx={{ display: 'flex', gap: 3 }}>
          <TextField
            select
            label="Pilih Akun Kas/Bank"
            fullWidth
            value={selectedAccountId}
            onChange={(e) => setSelectedAccountId(Number(e.target.value))}
          >
            <MenuItem value={0} disabled>Pilih Akun</MenuItem>
            {accounts.map((acc) => (
              <MenuItem key={acc.id} value={acc.id}>
                {acc.code} - {acc.name}
              </MenuItem>
            ))}
          </TextField>

          <TextField
            label="Tanggal Rekening Koran"
            type="date"
            fullWidth
            value={statementDate}
            onChange={(e) => setStatementDate(e.target.value)}
            InputLabelProps={{ shrink: true }}
          />

          <TextField
            label="Saldo Akhir di Bank (Rp)"
            fullWidth
            type="number"
            value={statementBalance}
            onChange={(e) => setStatementBalance(e.target.value)}
          />
        </Box>
      </Paper>

      <Box sx={{ display: 'flex', gap: 4 }}>
        <Box sx={{ flex: 2 }}>
          <Paper sx={{ p: 0, borderRadius: 2, overflow: 'hidden' }}>
            <TableContainer sx={{ maxHeight: 400 }}>
              <Table stickyHeader size="small">
                <TableHead>
                  <TableRow>
                    <TableCell padding="checkbox">
                      <Checkbox
                        indeterminate={selectedLines.size > 0 && selectedLines.size < unreconciledLines.length}
                        checked={unreconciledLines.length > 0 && selectedLines.size === unreconciledLines.length}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedLines(new Set(unreconciledLines.map(l => l.id)));
                          } else {
                            setSelectedLines(new Set());
                          }
                        }}
                      />
                    </TableCell>
                    <TableCell>Tanggal</TableCell>
                    <TableCell>Keterangan</TableCell>
                    <TableCell align="right">Uang Masuk (Debit)</TableCell>
                    <TableCell align="right">Uang Keluar (Kredit)</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {unreconciledLines.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} align="center" sx={{ py: 3, color: 'text.secondary' }}>Tidak ada transaksi yang belum direkonsiliasi hingga tanggal ini.</TableCell>
                    </TableRow>
                  ) : unreconciledLines.map((row) => {
                    const isSelected = selectedLines.has(row.id);
                    return (
                      <TableRow 
                        key={row.id} 
                        hover 
                        selected={isSelected}
                        onClick={() => handleToggleLine(row.id)}
                        sx={{ cursor: 'pointer' }}
                      >
                        <TableCell padding="checkbox">
                          <Checkbox checked={isSelected} />
                        </TableCell>
                        <TableCell>{row.date}</TableCell>
                        <TableCell>{row.description}</TableCell>
                        <TableCell align="right">{row.debit ? formatRupiah(row.debit) : '-'}</TableCell>
                        <TableCell align="right">{row.credit ? formatRupiah(row.credit) : '-'}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        </Box>

        <Box sx={{ flex: 1 }}>
          <Paper sx={{ p: 3, borderRadius: 2, bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider' }}>
            <Typography variant="h6" fontWeight="bold" sx={{ mb: 2 }}>Ringkasan Saldo</Typography>
            
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
              <Typography color="text.secondary">Saldo Awal Terekonsiliasi</Typography>
              <Typography>{formatRupiah(initialBalance)}</Typography>
            </Box>
            
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
              <Typography color="text.secondary">Transaksi Dicentang</Typography>
              <Typography>{formatRupiah(clearedBalance - initialBalance)}</Typography>
            </Box>

            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2, pt: 1, borderTop: '1px dashed #cbd5e1' }}>
              <Typography fontWeight="bold">Saldo Cleared</Typography>
              <Typography fontWeight="bold" color="primary">{formatRupiah(clearedBalance)}</Typography>
            </Box>
            
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
              <Typography color="text.secondary">Saldo Rekening Koran</Typography>
              <Typography>{formatRupiah(targetBalance)}</Typography>
            </Box>

            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3, p: 1.5, bgcolor: difference === 0 ? 'rgba(76, 175, 80, 0.1)' : 'rgba(244, 67, 54, 0.1)', borderRadius: 1 }}>
              <Typography fontWeight="bold" color={difference === 0 ? 'success.main' : 'error.main'}>Selisih</Typography>
              <Typography fontWeight="bold" color={difference === 0 ? 'success.main' : 'error.main'}>
                {formatRupiah(difference)}
              </Typography>
            </Box>

            <Button 
              variant="contained" 
              fullWidth 
              size="large"
              color={difference === 0 ? "success" : "primary"}
              disabled={difference !== 0 || !selectedAccountId}
              onClick={handleSaveReconciliation}
            >
              Selesaikan Rekonsiliasi
            </Button>
            {difference !== 0 && (
              <Typography variant="caption" color="error" sx={{ display: 'block', mt: 1, textAlign: 'center' }}>
                Selisih harus Rp 0 untuk menyelesaikan.
              </Typography>
            )}
          </Paper>
        </Box>
      </Box>
    </Box>
  );
}
