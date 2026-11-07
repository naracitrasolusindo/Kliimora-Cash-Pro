import React, { useEffect, useState } from 'react';
import { Box, Typography, Paper, TextField, Button, Grid, Divider, Alert } from '@mui/material';
import SaveIcon from '@mui/icons-material/Save';
import BackupIcon from '@mui/icons-material/Backup';
import RestoreIcon from '@mui/icons-material/RestorePage';
import { useSettingsStore } from '../store/useSettingsStore';
import { appDataDir, join } from '@tauri-apps/api/path';
import { copyFile } from '@tauri-apps/plugin-fs';
import { save, open } from '@tauri-apps/plugin-dialog';
import { reloadDbConnection } from '../lib/db';

export default function Settings() {
  const { companyName, companyAddress, companyBank, paymentTerms, officerName, officerTitle, companyLogo, fetchSettings, updateSettings } = useSettingsStore();
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [bank, setBank] = useState('');
  const [terms, setTerms] = useState('');
  const [oName, setOName] = useState('');
  const [oTitle, setOTitle] = useState('');
  const [logo, setLogo] = useState('');
  const [message, setMessage] = useState<{type: 'success' | 'error', text: string} | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    fetchSettings().then(() => setIsInitialized(true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (isInitialized) {
      setName(companyName);
      setAddress(companyAddress);
      setBank(companyBank);
      setTerms(paymentTerms);
      setOName(officerName);
      setOTitle(officerTitle);
      setLogo(companyLogo);
    }
  }, [isInitialized]);

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setLogo(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSave = async () => {
    await updateSettings({
      companyName: name,
      companyAddress: address,
      companyBank: bank,
      paymentTerms: terms,
      officerName: oName,
      officerTitle: oTitle,
      companyLogo: logo
    });
    setMessage({ type: 'success', text: 'Pengaturan perusahaan berhasil disimpan!' });
  };

  const getActiveDbPath = async () => {
    const customPath = localStorage.getItem('kliimora_db_path');
    if (customPath) return customPath;
    
    const appData = await appDataDir();
    return await join(appData, 'laporan_keuangan.db');
  };

  const handleBackup = async () => {
    try {
      const dbPath = await getActiveDbPath();
      const savePath = await save({
        defaultPath: `Backup_Kliimora_${new Date().toISOString().split('T')[0]}.db`,
        filters: [{ name: 'SQLite Database', extensions: ['db'] }]
      });

      if (savePath) {
        await copyFile(dbPath, savePath);
        setMessage({ type: 'success', text: `Database berhasil dibackup ke: ${savePath}` });
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: 'Gagal melakukan backup: ' + err.message });
    }
  };

  const handleRestore = async () => {
    try {
      const selectedPath = await open({
        multiple: false,
        filters: [{ name: 'SQLite Database', extensions: ['db', 'sqlite', 'sqlite3'] }]
      });

      if (selectedPath && typeof selectedPath === 'string') {
        if (window.confirm('PERINGATAN: Semua data saat ini akan ditimpa dengan data dari file backup. Lanjutkan?')) {
          const dbPath = await getActiveDbPath();
          await copyFile(selectedPath, dbPath);
          await reloadDbConnection();
          setMessage({ type: 'success', text: 'Database berhasil di-restore dari backup!' });
        }
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: 'Gagal melakukan restore: ' + err.message });
    }
  };

  return (
    <Box sx={{ maxWidth: 800, mx: 'auto', mt: 4, pb: 6 }}>
      <Typography component="h4" variant="h4" color="primary" gutterBottom sx={{ fontWeight: 700 }}>
        Pengaturan Aplikasi
      </Typography>
      
      {message && (
        <Alert severity={message.type} sx={{ mb: 3 }} onClose={() => setMessage(null)}>
          {message.text}
        </Alert>
      )}

      <Paper sx={{ p: 4, borderRadius: 3, boxShadow: '0 4px 20px rgba(0,0,0,0.05)', mb: 4 }}>
        <Typography component="h6" variant="h6" sx={{ mb: 3, fontWeight: 'bold' }}>
          Informasi Perusahaan
        </Typography>
        
        <Grid container spacing={3}>
          <Grid size={{ xs: 12 }}>
            <TextField 
              label="Nama Perusahaan" 
              fullWidth 
              value={name} 
              onChange={(e) => setName(e.target.value)}
              helperText="Nama ini akan muncul di header laporan keuangan"
            />
          </Grid>
          <Grid size={{ xs: 12 }}>
            <TextField 
              label="Alamat Perusahaan" 
              fullWidth 
              multiline
              rows={2}
              value={address} 
              onChange={(e) => setAddress(e.target.value)}
              helperText="Akan dicetak di bawah nama perusahaan pada Kop Invoice"
            />
          </Grid>
          <Grid size={{ xs: 12 }}>
            <TextField 
              label="Informasi Bank" 
              fullWidth 
              value={bank} 
              onChange={(e) => setBank(e.target.value)}
              helperText="Contoh: BCA 1234567890 a/n PT Perusahaan Anda (untuk instruksi pembayaran)"
            />
          </Grid>
          <Grid size={{ xs: 12 }}>
            <TextField 
              label="Syarat dan Ketentuan Pembayaran (Payment Terms)" 
              fullWidth 
              multiline
              rows={2}
              value={terms} 
              onChange={(e) => setTerms(e.target.value)}
              helperText="Catatan tambahan di bagian bawah invoice"
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField 
              label="Nama Pejabat Perusahaan" 
              fullWidth 
              value={oName} 
              onChange={(e) => setOName(e.target.value)}
              helperText="Nama yang akan menandatangani invoice"
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField 
              label="Jabatan Pejabat" 
              fullWidth 
              value={oTitle} 
              onChange={(e) => setOTitle(e.target.value)}
              helperText="Contoh: Direktur, Manager Keuangan"
            />
          </Grid>
          <Grid size={{ xs: 12 }}>
            <Typography component="h6" variant="subtitle2" sx={{ mb: 1, color: 'text.secondary' }}>Logo Perusahaan (Tampil di Invoice)</Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              {logo && <Box component="img" src={logo} sx={{ height: 60, width: 'auto', border: '1px solid #ccc', borderRadius: 1 }} />}
              <Button variant="outlined" component="label">
                Pilih Logo
                <input type="file" hidden accept="image/*" onChange={handleLogoUpload} />
              </Button>
              {logo && <Button variant="text" color="error" onClick={() => setLogo('')}>Hapus</Button>}
            </Box>
          </Grid>
          <Grid size={{ xs: 12 }} sx={{ display: 'flex', justifyContent: 'flex-end', mt: 2 }}>
            <Button 
              variant="contained" 
              color="primary" 
              startIcon={<SaveIcon />}
              onClick={handleSave}
              sx={{ px: 4, py: 1.5, borderRadius: 2 }}
            >
              Simpan Pengaturan
            </Button>
          </Grid>
        </Grid>
      </Paper>

      <Paper sx={{ p: 4, borderRadius: 3, boxShadow: '0 4px 20px rgba(0,0,0,0.05)' }}>
        <Typography component="h6" variant="h6" sx={{ mb: 1, fontWeight: 'bold' }}>
          Manajemen Database
        </Typography>
        <Typography component="p" variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Backup data Anda secara berkala untuk mencegah kehilangan data. File backup dapat di-restore kapan saja.
        </Typography>
        <Divider sx={{ mb: 3 }} />
        
        <Box sx={{ display: 'flex', gap: 3 }}>
          <Button 
            variant="outlined" 
            color="primary" 
            startIcon={<BackupIcon />}
            onClick={handleBackup}
            sx={{ px: 4, py: 1.5, borderRadius: 2, flex: 1 }}
          >
            Backup Database
          </Button>
          <Button 
            variant="outlined" 
            color="error" 
            startIcon={<RestoreIcon />}
            onClick={handleRestore}
            sx={{ px: 4, py: 1.5, borderRadius: 2, flex: 1 }}
          >
            Restore dari Backup
          </Button>
        </Box>
      </Paper>
    </Box>
  );
}
