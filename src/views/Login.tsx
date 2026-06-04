import React, { useState } from 'react';
import { Box, Button, TextField, Typography, Paper, Alert, IconButton, Dialog, DialogTitle, DialogContent, DialogActions } from '@mui/material';
import SettingsIcon from '@mui/icons-material/Settings';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/useAuthStore';
import { getDb, reloadDbConnection } from '../lib/db';
import { open } from '@tauri-apps/plugin-dialog';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [openSettings, setOpenSettings] = useState(false);
  const [dbPath, setDbPath] = useState(localStorage.getItem('kliimora_db_path') || '');
  const login = useAuthStore((state) => state.login);
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    try {
      const db = await getDb();
      const users = await db.select<any[]>('SELECT * FROM users WHERE username = $1 AND password_hash = $2', [username, password]);
      
      if (users.length > 0) {
        login({ id: users[0].id, username: users[0].username, role: users[0].role });
        navigate('/');
      } else {
        setError('Username atau password salah');
      }
    } catch (err: any) {
      setError(err.message || 'Terjadi kesalahan sistem saat mencoba login');
    }
  };

  const handleSelectDb = async () => {
    try {
      const selected = await open({
        multiple: false,
        filters: [{ name: 'SQLite Database', extensions: ['db', 'sqlite', 'sqlite3'] }]
      });
      if (selected && typeof selected === 'string') {
        setDbPath(selected);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleSaveDbSetting = async () => {
    if (dbPath.trim() === '') {
      localStorage.removeItem('kliimora_db_path');
    } else {
      localStorage.setItem('kliimora_db_path', dbPath.trim());
    }
    setOpenSettings(false);
    try {
      await reloadDbConnection();
    } catch(e) {
      setError('Gagal memuat database baru');
    }
  };

  return (
    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', bgcolor: '#f5f5f5', position: 'relative' }}>
      <IconButton 
        onClick={() => setOpenSettings(true)}
        sx={{ position: 'absolute', top: 16, right: 16, color: 'text.secondary' }}
      >
        <SettingsIcon />
      </IconButton>

      <Paper sx={{ p: 4, maxWidth: 400, width: '100%' }} elevation={3}>
        <Typography variant="h5" component="h1" gutterBottom align="center" fontWeight="bold">
          Kliimora Cash Pro
        </Typography>
        <Typography variant="body2" gutterBottom align="center" color="text.secondary" sx={{ mb: 3 }}>
          Silakan login untuk melanjutkan
        </Typography>

        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

        <form onSubmit={handleLogin}>
          <TextField
            fullWidth
            label="Username"
            variant="outlined"
            margin="normal"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
          />
          <TextField
            fullWidth
            label="Password"
            type="password"
            variant="outlined"
            margin="normal"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <Button type="submit" fullWidth variant="contained" size="large" sx={{ mt: 3 }}>
            Login
          </Button>
        </form>
      </Paper>

      <Dialog open={openSettings} onClose={() => setOpenSettings(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Pengaturan Jaringan Database</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Biarkan kosong untuk menggunakan database lokal bawaan. Jika Anda ingin menghubungkan aplikasi ke database di komputer lain (Network Share), klik Pilih File.
          </Typography>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <TextField 
              fullWidth 
              label="Path Database (.db)" 
              value={dbPath}
              onChange={(e) => setDbPath(e.target.value)}
              placeholder="Contoh: Z:\Shared\kliimora.db"
              size="small"
            />
            <Button variant="outlined" onClick={handleSelectDb}>Pilih File</Button>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenSettings(false)}>Batal</Button>
          <Button variant="contained" onClick={handleSaveDbSetting}>Simpan & Muat Ulang</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
