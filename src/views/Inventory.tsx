import { useEffect, useState } from 'react';
import { Box, Button, Typography, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, IconButton, Dialog, DialogTitle, DialogContent, DialogActions, TextField, Grid } from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import { getDb } from '../lib/db';
import { useAppStore } from '../store/useAppStore';

interface Product {
  id: number;
  code: string;
  name: string;
  description: string;
  price: number;
  stock: number;
}

export default function Inventory() {
  const { showNotification } = useAppStore();
  const [data, setData] = useState<Product[]>([]);
  const [open, setOpen] = useState(false);
  const [editModeId, setEditModeId] = useState<number | null>(null);
  
  const [formData, setFormData] = useState({ code: '', name: '', description: '', price: 0, stock: 0 });

  const loadData = async () => {
    try {
      const db = await getDb();
      const rows = await db.select<Product[]>('SELECT * FROM products ORDER BY name ASC');
      setData(rows);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleOpen = () => {
    setEditModeId(null);
    setFormData({ code: '', name: '', description: '', price: 0, stock: 0 });
    setOpen(true);
  };

  const handleEdit = (row: Product) => {
    setEditModeId(row.id);
    setFormData({ 
      code: row.code || '', 
      name: row.name, 
      description: row.description || '', 
      price: row.price, 
      stock: row.stock 
    });
    setOpen(true);
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('Yakin ingin menghapus barang ini?')) return;
    try {
      const db = await getDb();
      await db.execute('DELETE FROM products WHERE id = $1', [id]);
      showNotification('Barang berhasil dihapus', 'success');
      loadData();
    } catch (err: any) {
      showNotification('Gagal menghapus: ' + err.message, 'error');
    }
  };

  const handleSave = async () => {
    if (!formData.name) {
      showNotification('Nama barang wajib diisi', 'error');
      return;
    }
    
    try {
      const db = await getDb();
      if (editModeId) {
        await db.execute(
          'UPDATE products SET code = $1, name = $2, description = $3, price = $4, stock = $5 WHERE id = $6',
          [formData.code, formData.name, formData.description, formData.price, formData.stock, editModeId]
        );
        showNotification('Barang berhasil diperbarui', 'success');
      } else {
        await db.execute(
          'INSERT INTO products (code, name, description, price, stock) VALUES ($1, $2, $3, $4, $5)',
          [formData.code, formData.name, formData.description, formData.price, formData.stock]
        );
        showNotification('Barang berhasil ditambahkan', 'success');
      }
      setOpen(false);
      loadData();
    } catch (err: any) {
      showNotification('Gagal menyimpan: ' + err.message, 'error');
    }
  };

  return (
    <Box sx={{ maxWidth: 1000, mx: 'auto' }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 3 }}>
        <Box>
          <Typography variant="h4" fontWeight="700" color="primary">Manajemen Stok Barang</Typography>
          <Typography variant="subtitle1" color="text.secondary">Kelola daftar barang, harga, dan ketersediaan stok</Typography>
        </Box>
        <Button variant="contained" onClick={handleOpen}>Tambah Barang</Button>
      </Box>

      <Paper sx={{ boxShadow: '0 4px 20px rgba(0,0,0,0.05)', borderRadius: 2, overflow: 'hidden' }}>
        <TableContainer>
          <Table size="small">
            <TableHead sx={{ bgcolor: 'action.hover' }}>
              <TableRow>
                <TableCell sx={{ fontWeight: 700, py: 2 }}>Kode</TableCell>
                <TableCell sx={{ fontWeight: 700, py: 2 }}>Nama Barang</TableCell>
                <TableCell sx={{ fontWeight: 700, py: 2 }}>Deskripsi</TableCell>
                <TableCell align="right" sx={{ fontWeight: 700, py: 2 }}>Harga (Rp)</TableCell>
                <TableCell align="right" sx={{ fontWeight: 700, py: 2 }}>Stok</TableCell>
                <TableCell align="center" sx={{ fontWeight: 700, py: 2, width: 100 }}>Aksi</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {data.length === 0 ? (
                <TableRow><TableCell colSpan={6} align="center" sx={{ py: 3, color: 'text.disabled' }}>Belum ada data barang</TableCell></TableRow>
              ) : data.map((row) => (
                <TableRow key={row.id} hover>
                  <TableCell>{row.code || '-'}</TableCell>
                  <TableCell sx={{ fontWeight: 500 }}>{row.name}</TableCell>
                  <TableCell>{row.description || '-'}</TableCell>
                  <TableCell align="right">{row.price.toLocaleString('id-ID')}</TableCell>
                  <TableCell align="right">
                    <Typography color={row.stock <= 5 ? 'error' : 'inherit'} fontWeight={row.stock <= 5 ? 700 : 400}>
                      {row.stock}
                    </Typography>
                  </TableCell>
                  <TableCell align="center">
                    <IconButton size="small" onClick={() => handleEdit(row)} color="primary"><EditIcon fontSize="small" /></IconButton>
                    <IconButton size="small" onClick={() => handleDelete(row.id)} color="error"><DeleteIcon fontSize="small" /></IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editModeId ? 'Edit Barang' : 'Tambah Barang'}</DialogTitle>
        <DialogContent dividers>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={4}>
              <TextField 
                label="Kode Barang" 
                fullWidth 
                size="small" 
                value={formData.code} 
                onChange={e => setFormData({...formData, code: e.target.value})} 
                placeholder="BRG-001"
              />
            </Grid>
            <Grid item xs={12} sm={8}>
              <TextField 
                label="Nama Barang *" 
                fullWidth 
                size="small" 
                value={formData.name} 
                onChange={e => setFormData({...formData, name: e.target.value})} 
              />
            </Grid>
            <Grid item xs={12}>
              <TextField 
                label="Deskripsi" 
                fullWidth 
                multiline
                rows={2}
                size="small" 
                value={formData.description} 
                onChange={e => setFormData({...formData, description: e.target.value})} 
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField 
                label="Harga Jual (Rp)" 
                type="number"
                fullWidth 
                size="small" 
                value={formData.price === 0 ? '' : formData.price} 
                onChange={e => setFormData({...formData, price: parseFloat(e.target.value) || 0})} 
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField 
                label="Stok Tersedia" 
                type="number"
                fullWidth 
                size="small" 
                value={formData.stock === 0 ? '' : formData.stock} 
                onChange={e => setFormData({...formData, stock: parseInt(e.target.value) || 0})} 
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
