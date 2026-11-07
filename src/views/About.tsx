import { useState } from 'react';
import { Box, Typography, Paper, Divider, Stack, Button, CircularProgress } from '@mui/material';
import EmailIcon from '@mui/icons-material/Email';
import PhoneIcon from '@mui/icons-material/Phone';
import PersonIcon from '@mui/icons-material/Person';
import SystemUpdateAltIcon from '@mui/icons-material/SystemUpdateAlt';
import { check } from '@tauri-apps/plugin-updater';
import { ask, message } from '@tauri-apps/plugin-dialog';
import { relaunch } from '@tauri-apps/plugin-process';

export default function About() {
  const [isChecking, setIsChecking] = useState(false);

  const handleCheckUpdate = async () => {
    try {
      setIsChecking(true);
      const update = await check();
      
      if (update) {
        const yes = await ask(
          `Pembaruan versi ${update.version} telah tersedia!\n\nCatatan Rilis:\n${update.body || 'Tidak ada deskripsi.'}\n\nApakah Anda ingin mengunduh dan menginstal pembaruan sekarang?`,
          { title: 'Pembaruan Tersedia', kind: 'info' }
        );
        
        if (yes) {
          await update.downloadAndInstall((event) => {
            switch (event.event) {
              case 'Started':
                break;
              case 'Progress':
                break;
              case 'Finished':
                break;
            }
          });

          await message('Pembaruan berhasil diinstal! Aplikasi akan dimuat ulang.', { title: 'Pembaruan Selesai', kind: 'info' });
          await relaunch();
        }
      } else {
        await message('Anda sudah menggunakan versi terbaru.', { title: 'Tidak Ada Pembaruan', kind: 'info' });
      }
    } catch (err: any) {
      await message('Gagal mengecek pembaruan: ' + err.toString(), { title: 'Error', kind: 'error' });
    } finally {
      setIsChecking(false);
    }
  };

  return (
    <Box sx={{ maxWidth: 800, mx: 'auto', p: 3 }}>
      <Paper sx={{ p: 5, borderRadius: 3, boxShadow: '0 10px 30px rgba(0,0,0,0.05)', border: '1px solid #f0f0f0', textAlign: 'center' }}>
        <Box sx={{ 
          bgcolor: '#d32f2f', 
          color: 'white', 
          fontWeight: 900, 
          fontSize: '2rem',
          width: 80,
          height: 80,
          mx: 'auto',
          mb: 3,
          borderRadius: 3, 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          boxShadow: 4,
          border: '2px solid rgba(255,255,255,0.2)'
        }}>
          KCP
        </Box>
        
        <Typography component="h4" variant="h4" fontWeight="800" color="text.primary" gutterBottom>
          Kliimora Cash Pro v.2.0.2
        </Typography>
        <Typography component="h6" variant="subtitle1" color="text.secondary" sx={{ mb: 4 }}>
          Aplikasi Pembukuan Desktop Gratis
        </Typography>
        
        <Divider sx={{ mb: 4 }} />
        
        <Box sx={{ display: 'inline-block', textAlign: 'left' }}>
          <Stack spacing={2}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <PersonIcon sx={{ color: '#1976d2' }} />
              <Typography component="p" variant="body1">
                <strong>Dibuat oleh:</strong> Muhammad Ridwan
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <EmailIcon sx={{ color: '#1976d2' }} />
              <Typography component="p" variant="body1">
                <strong>Email:</strong> naracitra.solusindo@gmail.com
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <PhoneIcon sx={{ color: '#1976d2' }} />
              <Typography component="p" variant="body1">
                <strong>Telp:</strong> 08211 348 7323
              </Typography>
            </Box>
          </Stack>
        </Box>
        
        <Box sx={{ mt: 6, mb: 2 }}>
          <Button 
            variant="outlined" 
            startIcon={isChecking ? <CircularProgress size={20} /> : <SystemUpdateAltIcon />}
            onClick={handleCheckUpdate}
            disabled={isChecking}
            color="primary"
          >
            {isChecking ? 'Mengecek...' : 'Cek Pembaruan'}
          </Button>
        </Box>

        <Box sx={{ mt: 4 }}>
          <Typography component="p" variant="body2" color="text.secondary" fontWeight={600}>
            Team Kliimora &copy; 2026
          </Typography>
        </Box>
      </Paper>
    </Box>
  );
}
