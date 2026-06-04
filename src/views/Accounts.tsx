import React, { useEffect, useState } from 'react';
import { Box, Button, Typography, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, IconButton, Dialog, DialogTitle, DialogContent, DialogActions, TextField, MenuItem } from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import { getDb } from '../lib/db';
import { useAuthStore } from '../store/useAuthStore';
import { useAppStore } from '../store/useAppStore';

interface Account {
  id: number;
  code: string;
  name: string;
  type: string;
  initial_balance: number;
}

export default function Accounts() {
  const { user } = useAuthStore();
  const { showNotification } = useAppStore();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [open, setOpen] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [currentId, setCurrentId] = useState<number | null>(null);
  const [formData, setFormData] = useState({ code: '', name: '', type: 'asset', initial_balance: 0 });

  const loadAccounts = async () => {
    try {
      const db = await getDb();
      const data = await db.select<Account[]>('SELECT * FROM accounts ORDER BY code ASC');
      setAccounts(data);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    loadAccounts();
  }, []);

  const handleOpen = (acc?: Account) => {
    if (acc) {
      setEditMode(true);
      setCurrentId(acc.id);
      setFormData({ code: acc.code, name: acc.name, type: acc.type, initial_balance: acc.initial_balance });
    } else {
      setEditMode(false);
      setCurrentId(null);
      setFormData({ code: '', name: '', type: 'asset', initial_balance: 0 });
    }
    setOpen(true);
  };

  const handleClose = () => setOpen(false);

  const handleSave = async () => {
    try {
      const db = await getDb();
      if (editMode && currentId) {
        await db.execute(
          'UPDATE accounts SET code = $1, name = $2, type = $3, initial_balance = $4 WHERE id = $5',
          [formData.code, formData.name, formData.type, formData.initial_balance, currentId]
        );
      } else {
        await db.execute(
          'INSERT INTO accounts (code, name, type, initial_balance) VALUES ($1, $2, $3, $4)',
          [formData.code, formData.name, formData.type, formData.initial_balance]
        );
      }
      setOpen(false);
      loadAccounts();
      showNotification('Akun berhasil disimpan', 'success');
    } catch (err) {
      console.error(err);
      showNotification('Gagal menyimpan data', 'error');
    }
  };

  const handleDelete = async (id: number) => {
    if (window.confirm('Hapus akun ini?')) {
      try {
        const db = await getDb();
        await db.execute('DELETE FROM accounts WHERE id = $1', [id]);
        loadAccounts();
        showNotification('Akun berhasil dihapus', 'success');
      } catch (err) {
        console.error(err);
        showNotification('Gagal menghapus data. Pastikan akun tidak digunakan di jurnal.', 'error');
      }
    }
  };

  const formatRupiah = (val: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(val);

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
        <Typography variant="h4" fontWeight="bold" color="primary">Daftar Akun (COA)</Typography>
        <Button variant="contained" onClick={() => handleOpen()} sx={{ borderRadius: 2 }}>Tambah Akun</Button>
      </Box>

      <TableContainer component={Paper} sx={{ boxShadow: 3, borderRadius: 2 }}>
        <Table size="small">
          <TableHead sx={{ bgcolor: 'primary.main' }}>
            <TableRow>
              <TableCell sx={{ color: 'white', fontWeight: 'bold', py: 1.5 }}>Kode</TableCell>
              <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Nama Akun</TableCell>
              <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Tipe</TableCell>
              <TableCell sx={{ color: 'white', fontWeight: 'bold' }} align="right">Saldo Awal</TableCell>
              <TableCell sx={{ color: 'white', fontWeight: 'bold' }} align="center">Aksi</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {accounts.map((acc) => (
              <TableRow key={acc.id} hover>
                <TableCell sx={{ py: 1 }}>{acc.code}</TableCell>
                <TableCell>{acc.name}</TableCell>
                <TableCell sx={{ textTransform: 'capitalize' }}>{acc.type}</TableCell>
                <TableCell align="right">{formatRupiah(acc.initial_balance)}</TableCell>
                <TableCell align="center">
                  <IconButton size="small" color="primary" onClick={() => handleOpen(acc)}><EditIcon fontSize="small" /></IconButton>
                  <IconButton size="small" color="error" onClick={() => handleDelete(acc.id)}><DeleteIcon fontSize="small" /></IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog open={open} onClose={handleClose}>
        <DialogTitle fontWeight="bold">{editMode ? 'Edit Akun' : 'Tambah Akun'}</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1, minWidth: 400 }}>
          <TextField label="Kode Akun" value={formData.code} onChange={(e) => setFormData({ ...formData, code: e.target.value })} fullWidth />
          <TextField label="Nama Akun" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} fullWidth />
          <TextField select label="Tipe Akun" value={formData.type} onChange={(e) => setFormData({ ...formData, type: e.target.value })} fullWidth>
            <MenuItem value="asset">Aset (Asset)</MenuItem>
            <MenuItem value="liability">Kewajiban (Liability)</MenuItem>
            <MenuItem value="equity">Ekuitas (Equity)</MenuItem>
            <MenuItem value="revenue">Pendapatan (Revenue)</MenuItem>
            <MenuItem value="expense">Beban (Expense)</MenuItem>
          </TextField>
          <TextField label="Saldo Awal (Rp)" type="number" value={formData.initial_balance} onChange={(e) => setFormData({ ...formData, initial_balance: parseFloat(e.target.value) || 0 })} fullWidth />
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={handleClose}>Batal</Button>
          <Button variant="contained" onClick={handleSave}>Simpan</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
