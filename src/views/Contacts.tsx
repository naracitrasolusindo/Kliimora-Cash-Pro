import { useEffect, useState } from 'react';
import { Box, Button, Typography, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, IconButton, Dialog, DialogTitle, DialogContent, DialogActions, TextField, MenuItem } from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import { getDb } from '../lib/db';
import { useAppStore } from '../store/useAppStore';

interface Contact {
  id: number;
  name: string;
  type: string;
  phone: string;
  email: string;
  address: string;
  npwp?: string;
}

export default function Contacts() {
  const { showNotification } = useAppStore();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [open, setOpen] = useState(false);
  const [formData, setFormData] = useState<Contact>({ id: 0, name: '', type: 'customer', phone: '', email: '', address: '', npwp: '' });
  const [isEdit, setIsEdit] = useState(false);

  const loadData = async () => {
    try {
      const db = await getDb();
      const result = await db.select<Contact[]>('SELECT * FROM contacts ORDER BY name ASC');
      setContacts(result);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleOpen = (c?: Contact) => {
    if (c) {
      setFormData(c);
      setIsEdit(true);
    } else {
      setFormData({ id: 0, name: '', type: 'customer', phone: '', email: '', address: '', npwp: '' });
      setIsEdit(false);
    }
    setOpen(true);
  };

  const handleSave = async () => {
    if (!formData.name) return showNotification('Nama kontak wajib diisi!', 'warning');
    try {
      const db = await getDb();
      if (isEdit) {
        await db.execute('UPDATE contacts SET name = $1, type = $2, phone = $3, email = $4, address = $5, npwp = $6 WHERE id = $7', 
          [formData.name, formData.type, formData.phone, formData.email, formData.address, formData.npwp, formData.id]);
      } else {
        await db.execute('INSERT INTO contacts (name, type, phone, email, address, npwp) VALUES ($1, $2, $3, $4, $5, $6)', 
          [formData.name, formData.type, formData.phone, formData.email, formData.address, formData.npwp]);
      }
      setOpen(false);
      loadData();
      showNotification('Kontak berhasil disimpan', 'success');
    } catch (err) {
      console.error(err);
      showNotification('Gagal menyimpan kontak', 'error');
    }
  };

  const handleDelete = async (id: number) => {
    if (window.confirm('Hapus kontak ini? Aksi ini bisa berdampak pada buku pembantu jika sudah ada transaksi.')) {
      try {
        const db = await getDb();
        await db.execute('DELETE FROM contacts WHERE id = $1', [id]);
        loadData();
        showNotification('Kontak berhasil dihapus', 'success');
      } catch (err) {
        console.error(err);
        showNotification('Gagal menghapus kontak (mungkin sedang digunakan di jurnal)', 'error');
      }
    }
  };

  return (
    <Box sx={{ maxWidth: 1000, mx: 'auto' }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography component="h4" variant="h4" color="primary" sx={{ fontWeight: "700" }}>Buku Kontak</Typography>
          <Typography component="h6" variant="subtitle1" color="text.secondary">Kelola Pelanggan dan Pemasok Anda</Typography>
        </Box>
        <Button variant="contained" onClick={() => handleOpen()}>Tambah Kontak</Button>
      </Box>

      <TableContainer component={Paper} sx={{ boxShadow: '0 4px 20px rgba(0,0,0,0.05)', borderRadius: 2 }}>
        <Table>
          <TableHead sx={{ bgcolor: 'action.hover' }}>
            <TableRow>
              <TableCell sx={{ fontWeight: 700 }}>Nama Kontak</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Tipe</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Telepon</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>NPWP</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Email</TableCell>
              <TableCell sx={{ fontWeight: 700 }} align="center">Aksi</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {contacts.length === 0 && (
              <TableRow><TableCell colSpan={5} align="center" sx={{ py: 3, color: 'text.secondary' }}>Belum ada kontak</TableCell></TableRow>
            )}
            {contacts.map((c) => (
              <TableRow key={c.id} hover>
                <TableCell sx={{ fontWeight: 500 }}>{c.name}</TableCell>
                <TableCell>
                  <Typography component="p" variant="body2" sx={{ 
                    display: 'inline-block', px: 1, py: 0.5, borderRadius: 1, fontWeight: 600,
                    bgcolor: c.type === 'customer' ? '#e3f2fd' : '#fce4ec',
                    color: c.type === 'customer' ? '#1976d2' : '#c2185b'
                  }}>
                    {c.type === 'customer' ? 'Pelanggan' : c.type === 'vendor' ? 'Pemasok' : 'Lainnya'}
                  </Typography>
                </TableCell>
                <TableCell>{c.phone || '-'}</TableCell>
                <TableCell>{c.npwp || '-'}</TableCell>
                <TableCell>{c.email || '-'}</TableCell>
                <TableCell align="center">
                  <IconButton color="primary" onClick={() => handleOpen(c)} size="small"><EditIcon fontSize="small" /></IconButton>
                  <IconButton color="error" onClick={() => handleDelete(c.id)} size="small"><DeleteIcon fontSize="small" /></IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 'bold' }}>{isEdit ? 'Edit Kontak' : 'Tambah Kontak'}</DialogTitle>
        <DialogContent sx={{ pt: 1 }}>
          <TextField 
            label="Nama Kontak" 
            value={formData.name} 
            onChange={(e) => setFormData({ ...formData, name: e.target.value })} 
            fullWidth 
            sx={{ mb: 2, mt: 1 }} 
            slotProps={{ inputLabel: { shrink: true } }}
          />
          <TextField 
            select 
            label="Tipe Kontak" 
            value={formData.type} 
            onChange={(e) => setFormData({ ...formData, type: e.target.value })} 
            fullWidth
            sx={{ mb: 2 }}
            slotProps={{ inputLabel: { shrink: true } }}
          >
            <MenuItem value="customer">Pelanggan (Customer)</MenuItem>
            <MenuItem value="vendor">Pemasok (Vendor)</MenuItem>
            <MenuItem value="other">Lainnya</MenuItem>
          </TextField>
          <TextField 
            label="Telepon" 
            value={formData.phone} 
            onChange={(e) => setFormData({ ...formData, phone: e.target.value })} 
            fullWidth 
            sx={{ mb: 2 }} 
            slotProps={{ inputLabel: { shrink: true } }}
          />
          <TextField 
            label="Email" 
            type="email"
            value={formData.email} 
            onChange={(e) => setFormData({ ...formData, email: e.target.value })} 
            fullWidth 
            sx={{ mb: 2 }} 
            slotProps={{ inputLabel: { shrink: true } }}
          />
          <TextField 
            label="NPWP (16 Digit)" 
            value={formData.npwp || ''} 
            onChange={(e) => {
              // Hanya menerima angka dan batasi maksimal 16 digit
              const val = e.target.value.replace(/\D/g, '').slice(0, 16);
              setFormData({ ...formData, npwp: val });
            }} 
            fullWidth 
            sx={{ mb: 2 }} 
            slotProps={{ inputLabel: { shrink: true } }}
          />
          <TextField 
            label="Alamat" 
            multiline
            rows={3}
            value={formData.address} 
            onChange={(e) => setFormData({ ...formData, address: e.target.value })} 
            fullWidth 
            slotProps={{ inputLabel: { shrink: true } }}
          />
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setOpen(false)}>Batal</Button>
          <Button variant="contained" onClick={handleSave}>Simpan</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
