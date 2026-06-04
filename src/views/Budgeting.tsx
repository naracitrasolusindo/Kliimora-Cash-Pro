import React, { useEffect, useState } from 'react';
import { Box, Button, Typography, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, IconButton, Dialog, DialogTitle, DialogContent, DialogActions, TextField, Grid, MenuItem, LinearProgress } from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import { getDb } from '../lib/db';
import { useAppStore } from '../store/useAppStore';

interface Budget {
  id: number;
  account_id: number;
  account_name?: string;
  account_code?: string;
  period_month: number;
  period_year: number;
  amount: number;
  actual?: number;
}

interface Account {
  id: number;
  code: string;
  name: string;
}

export default function Budgeting() {
  const { showNotification } = useAppStore();
  const [data, setData] = useState<Budget[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  
  const currentDate = new Date();
  const [filterMonth, setFilterMonth] = useState(currentDate.getMonth() + 1);
  const [filterYear, setFilterYear] = useState(currentDate.getFullYear());

  const [open, setOpen] = useState(false);
  const [editModeId, setEditModeId] = useState<number | null>(null);
  const [formData, setFormData] = useState({ account_id: 0, amount: 0 });

  const loadData = async () => {
    try {
      const db = await getDb();
      
      const accountsData = await db.select<Account[]>('SELECT id, code, name FROM accounts WHERE type IN ("expense", "asset", "liability") ORDER BY code ASC');
      setAccounts(accountsData);

      const monthStr = filterMonth.toString().padStart(2, '0');
      const yearMonth = `${filterYear}-${monthStr}`;

      const budgetsData = await db.select<Budget[]>(`
        SELECT b.*, a.name as account_name, a.code as account_code 
        FROM budgets b
        JOIN accounts a ON b.account_id = a.id
        WHERE b.period_month = $1 AND b.period_year = $2
        ORDER BY a.code ASC
      `, [filterMonth, filterYear]);

      const actuals = await db.select<any[]>(`
        SELECT jl.account_id, SUM(jl.debit - jl.credit) as actual_amount
        FROM journal_lines jl
        JOIN journal_entries je ON jl.entry_id = je.id
        WHERE je.date LIKE $1
        GROUP BY jl.account_id
      `, [`${yearMonth}%`]);

      const dataWithActuals = budgetsData.map(b => {
        const actualRow = actuals.find(a => a.account_id === b.account_id);
        return {
          ...b,
          actual: actualRow ? actualRow.actual_amount : 0
        };
      });

      setData(dataWithActuals);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    loadData();
  }, [filterMonth, filterYear]);

  const handleOpen = () => {
    setEditModeId(null);
    setFormData({ account_id: 0, amount: 0 });
    setOpen(true);
  };

  const handleEdit = (row: Budget) => {
    setEditModeId(row.id);
    setFormData({ account_id: row.account_id, amount: row.amount });
    setOpen(true);
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('Yakin ingin menghapus anggaran ini?')) return;
    try {
      const db = await getDb();
      await db.execute('DELETE FROM budgets WHERE id = $1', [id]);
      showNotification('Anggaran berhasil dihapus', 'success');
      loadData();
    } catch (err: any) {
      showNotification('Gagal menghapus: ' + err.message, 'error');
    }
  };

  const handleSave = async () => {
    if (!formData.account_id || formData.amount <= 0) {
      showNotification('Akun dan jumlah anggaran wajib diisi', 'error');
      return;
    }
    
    try {
      const db = await getDb();
      if (editModeId) {
        await db.execute(
          'UPDATE budgets SET account_id = $1, amount = $2 WHERE id = $3',
          [formData.account_id, formData.amount, editModeId]
        );
        showNotification('Anggaran berhasil diperbarui', 'success');
      } else {
        await db.execute(
          'INSERT INTO budgets (account_id, period_month, period_year, amount) VALUES ($1, $2, $3, $4)',
          [formData.account_id, filterMonth, filterYear, formData.amount]
        );
        showNotification('Anggaran berhasil ditambahkan', 'success');
      }
      setOpen(false);
      loadData();
    } catch (err: any) {
      if (err.message.includes('UNIQUE')) {
        showNotification('Anggaran untuk akun ini di periode tersebut sudah ada.', 'error');
      } else {
        showNotification('Gagal menyimpan: ' + err.message, 'error');
      }
    }
  };

  return (
    <Box sx={{ maxWidth: 1000, mx: 'auto' }}>
      <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, justifyContent: 'space-between', alignItems: { xs: 'stretch', md: 'center' }, gap: 2, mb: 3 }}>
        <Box>
          <Typography variant="h4" fontWeight="700" color="primary">Anggaran (Budgeting)</Typography>
          <Typography variant="subtitle1" color="text.secondary">Kelola dan pantau realisasi anggaran</Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
          <TextField select label="Bulan" value={filterMonth} onChange={e => setFilterMonth(parseInt(e.target.value as string))} size="small" sx={{ width: 120 }}>
            {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
              <MenuItem key={m} value={m}>{new Date(0, m - 1).toLocaleString('id-ID', { month: 'long' })}</MenuItem>
            ))}
          </TextField>
          <TextField label="Tahun" type="number" value={filterYear} onChange={e => setFilterYear(parseInt(e.target.value))} size="small" sx={{ width: 100 }} />
          <Button variant="contained" onClick={handleOpen}>Tambah Anggaran</Button>
        </Box>
      </Box>

      <Paper sx={{ boxShadow: '0 4px 20px rgba(0,0,0,0.05)', borderRadius: 2, overflow: 'hidden' }}>
        <TableContainer>
          <Table>
            <TableHead sx={{ bgcolor: 'action.hover' }}>
              <TableRow>
                <TableCell sx={{ fontWeight: 700 }}>Kode</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Akun</TableCell>
                <TableCell align="right" sx={{ fontWeight: 700 }}>Anggaran</TableCell>
                <TableCell align="right" sx={{ fontWeight: 700 }}>Realisasi</TableCell>
                <TableCell sx={{ fontWeight: 700, width: 200 }}>Progress</TableCell>
                <TableCell align="center" sx={{ fontWeight: 700 }}>Aksi</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {data.length === 0 ? (
                <TableRow><TableCell colSpan={6} align="center" sx={{ py: 3, color: 'text.disabled' }}>Belum ada anggaran untuk periode ini</TableCell></TableRow>
              ) : data.map((row) => {
                const percentage = row.amount > 0 ? ((row.actual || 0) / row.amount) * 100 : 0;
                const isOverBudget = percentage > 100;

                return (
                  <TableRow key={row.id} hover>
                    <TableCell>{row.account_code}</TableCell>
                    <TableCell>{row.account_name}</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 600 }}>{row.amount.toLocaleString('id-ID')}</TableCell>
                    <TableCell align="right" sx={{ color: isOverBudget ? 'error.main' : 'inherit' }}>
                      {(row.actual || 0).toLocaleString('id-ID')}
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Box sx={{ width: '100%', mr: 1 }}>
                          <LinearProgress 
                            variant="determinate" 
                            value={Math.min(percentage, 100)} 
                            color={isOverBudget ? "error" : percentage > 80 ? "warning" : "success"}
                            sx={{ height: 8, borderRadius: 4 }}
                          />
                        </Box>
                        <Typography variant="body2" color="text.secondary">{Math.round(percentage)}%</Typography>
                      </Box>
                    </TableCell>
                    <TableCell align="center">
                      <IconButton size="small" onClick={() => handleEdit(row)} color="primary"><EditIcon fontSize="small" /></IconButton>
                      <IconButton size="small" onClick={() => handleDelete(row.id)} color="error"><DeleteIcon fontSize="small" /></IconButton>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editModeId ? 'Edit Anggaran' : 'Tambah Anggaran'}</DialogTitle>
        <DialogContent dividers>
          <Grid container spacing={3}>
            <Grid item xs={12}>
              <TextField 
                select 
                label="Pilih Akun" 
                fullWidth size="small" 
                value={formData.account_id} 
                onChange={e => setFormData({...formData, account_id: Number(e.target.value)})}
              >
                <MenuItem value={0} disabled>Pilih Akun</MenuItem>
                {accounts.map(a => <MenuItem key={a.id} value={a.id}>{a.code} - {a.name}</MenuItem>)}
              </TextField>
            </Grid>
            <Grid item xs={12}>
              <TextField 
                label="Jumlah Anggaran (Rp)" 
                type="number" 
                fullWidth size="small" 
                value={formData.amount === 0 ? '' : formData.amount} 
                onChange={e => setFormData({...formData, amount: parseFloat(e.target.value) || 0})} 
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>Batal</Button>
          <Button variant="contained" onClick={handleSave}>Simpan</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
