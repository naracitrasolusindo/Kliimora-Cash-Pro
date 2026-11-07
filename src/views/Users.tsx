import { useEffect, useState } from 'react';
import { Box, Button, Typography, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, IconButton, Dialog, DialogTitle, DialogContent, DialogActions, TextField, MenuItem } from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import { getDb } from '../lib/db';
import { hashPassword } from '../lib/auth';
import { useAuthStore } from '../store/useAuthStore';
import { useAppStore } from '../store/useAppStore';

export default function Users() {
  const { user } = useAuthStore();
  const { showNotification } = useAppStore();
  const [users, setUsers] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [formData, setFormData] = useState({ id: 0, username: '', password: '', role: 'staff' });
  const [isEdit, setIsEdit] = useState(false);

  const loadData = async () => {
    try {
      const db = await getDb();
      const result = await db.select<any[]>('SELECT id, username, role FROM users ORDER BY id ASC');
      setUsers(result);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    if (user?.role === 'admin') {
      loadData();
    }
  }, [user]);

  const handleOpen = (u?: any) => {
    if (u) {
      setFormData({ id: u.id, username: u.username, password: '', role: u.role });
      setIsEdit(true);
    } else {
      setFormData({ id: 0, username: '', password: '', role: 'staff' });
      setIsEdit(false);
    }
    setOpen(true);
  };

  const handleSave = async () => {
    if (!formData.username) return showNotification('Username tidak boleh kosong!', 'warning');
    try {
      const db = await getDb();
      if (isEdit) {
        if (formData.password) {
          const hashed = await hashPassword(formData.password);
          await db.execute('UPDATE users SET username = ?, password_hash = ?, role = ? WHERE id = ?', [formData.username, hashed, formData.role, formData.id]);
        } else {
          await db.execute('UPDATE users SET username = ?, role = ? WHERE id = ?', [formData.username, formData.role, formData.id]);
        }
      } else {
        if (!formData.password) return showNotification('Password wajib diisi untuk pengguna baru!', 'warning');
        const hashed = await hashPassword(formData.password);
        await db.execute('INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)', [formData.username, hashed, formData.role]);
      }
      setOpen(false);
      loadData();
      showNotification('Pengguna berhasil disimpan', 'success');
    } catch (err) {
      console.error(err);
      showNotification('Gagal menyimpan pengguna (Username mungkin sudah ada)', 'error');
    }
  };

  const handleDelete = async (id: number) => {
    if (user?.id === id) {
      return showNotification('Tidak dapat menghapus akun Anda sendiri saat sedang login!', 'error');
    }
    if (window.confirm('Hapus pengguna ini?')) {
      try {
        const db = await getDb();
        await db.execute('DELETE FROM users WHERE id = ?', [id]);
        loadData();
        showNotification('Pengguna berhasil dihapus', 'success');
      } catch (err) {
        showNotification('Gagal menghapus pengguna', 'error');
      }
    }
  };

  if (user?.role !== 'admin') {
    return <Box sx={{ p: 3 }}><Typography color="error">Akses Ditolak. Halaman ini hanya untuk Admin.</Typography></Box>;
  }

  return (
    <Box sx={{ maxWidth: 1000, mx: 'auto' }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h4" color="primary" sx={{ fontWeight: 700 }}>Manajemen Pengguna</Typography>
          <Typography variant="subtitle1" color="text.secondary">Kelola akses dan hak pengguna aplikasi</Typography>
        </Box>
        <Button variant="contained" onClick={() => handleOpen()}>Tambah Pengguna</Button>
      </Box>

      <TableContainer component={Paper} sx={{ boxShadow: '0 4px 20px rgba(0,0,0,0.05)', borderRadius: 2 }}>
        <Table>
          <TableHead sx={{ bgcolor: 'action.hover' }}>
            <TableRow>
              <TableCell sx={{ fontWeight: 700 }}>ID</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Username</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Peran (Role)</TableCell>
              <TableCell sx={{ fontWeight: 700 }} align="center">Aksi</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {users.map((u) => (
              <TableRow key={u.id} hover>
                <TableCell>{u.id}</TableCell>
                <TableCell>{u.username} {user.id === u.id && '(Anda)'}</TableCell>
                <TableCell sx={{ textTransform: 'capitalize', fontWeight: u.role === 'admin' ? 700 : 400, color: u.role === 'admin' ? 'primary.main' : 'text.primary' }}>
                  {u.role}
                </TableCell>
                <TableCell align="center">
                  <IconButton color="primary" onClick={() => handleOpen(u)}><EditIcon fontSize="small" /></IconButton>
                  <IconButton color="error" onClick={() => handleDelete(u.id)} disabled={user.id === u.id}><DeleteIcon fontSize="small" /></IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 'bold' }}>{isEdit ? 'Edit Pengguna' : 'Tambah Pengguna'}</DialogTitle>
        <DialogContent sx={{ mt: 1 }}>
          <TextField 
            label="Username" 
            value={formData.username} 
            onChange={(e) => setFormData({ ...formData, username: e.target.value })} 
            fullWidth 
            sx={{ mb: 2 }} 
          />
          <TextField 
            label={isEdit ? "Password (Kosongkan jika tidak ingin diubah)" : "Password"} 
            type="password" 
            value={formData.password} 
            onChange={(e) => setFormData({ ...formData, password: e.target.value })} 
            fullWidth 
            sx={{ mb: 2 }} 
          />
          <TextField 
            select 
            label="Peran (Role)" 
            value={formData.role} 
            onChange={(e) => setFormData({ ...formData, role: e.target.value })} 
            fullWidth
            disabled={isEdit && user.id === formData.id} // Tidak bisa mengubah role sendiri
          >
            <MenuItem value="admin">Admin</MenuItem>
            <MenuItem value="staff">Staff</MenuItem>
          </TextField>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setOpen(false)}>Batal</Button>
          <Button variant="contained" onClick={handleSave}>Simpan</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
