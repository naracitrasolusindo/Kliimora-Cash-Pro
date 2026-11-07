import { useState } from 'react';
import InfoIcon from '@mui/icons-material/Info';
import PeopleIcon from '@mui/icons-material/People';
import ContactsIcon from '@mui/icons-material/Contacts';
import MenuBookIcon from '@mui/icons-material/MenuBook';
import { Box, Drawer, AppBar, Toolbar, List, Typography, Divider, IconButton, ListItem, ListItemButton, ListItemIcon, ListItemText, Snackbar, Alert } from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import DarkModeIcon from '@mui/icons-material/DarkMode';
import LightModeIcon from '@mui/icons-material/LightMode';
import DashboardIcon from '@mui/icons-material/Dashboard';
import AccountBalanceIcon from '@mui/icons-material/AccountBalance';
import ReceiptIcon from '@mui/icons-material/Receipt';
import BookIcon from '@mui/icons-material/Book';

import ExitToAppIcon from '@mui/icons-material/ExitToApp';
import SettingsIcon from '@mui/icons-material/Settings';
import InventoryIcon from '@mui/icons-material/Inventory';
import RequestQuoteIcon from '@mui/icons-material/RequestQuote';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
import AccountTreeIcon from '@mui/icons-material/AccountTree';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import ScaleIcon from '@mui/icons-material/Scale';
import CurrencyExchangeIcon from '@mui/icons-material/CurrencyExchange';
import SyncAltIcon from '@mui/icons-material/SyncAlt';
import LockIcon from '@mui/icons-material/Lock';
import { useNavigate, Outlet, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/useAuthStore';
import { useAppStore } from '../store/useAppStore';
import { AnimatePresence } from 'framer-motion';
import PageWrapper from './PageWrapper';

const drawerWidth = 240;

export default function Layout() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuthStore();
  const { themeMode, toggleTheme, notification, closeNotification } = useAppStore();

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const menuItems = [
    { text: 'Dashboard', icon: <DashboardIcon sx={{ color: '#4caf50' }} />, path: '/' },
    { text: 'Daftar Akun (COA)', icon: <AccountBalanceIcon sx={{ color: '#ff9800' }} />, path: '/accounts' },
    { text: 'Kontak', icon: <ContactsIcon sx={{ color: '#795548' }} />, path: '/contacts' },
    { text: 'Stok Barang', icon: <InventoryIcon sx={{ color: '#f57c00' }} />, path: '/inventory' },
    { text: 'Tagihan Penjualan', icon: <RequestQuoteIcon sx={{ color: '#9c27b0' }} />, path: '/invoices' },
    { text: 'Tagihan Pemasok', icon: <ReceiptIcon sx={{ color: '#f44336' }} />, path: '/bills' },
    { text: 'Jurnal Umum', icon: <ReceiptIcon sx={{ color: '#2196f3' }} />, path: '/journal' },
    ...(user?.role === 'admin' ? [
      { text: 'Anggaran', icon: <AccountBalanceWalletIcon sx={{ color: '#009688' }} />, path: '/budgeting' },
      { text: 'Aset Tetap', icon: <InventoryIcon sx={{ color: '#3f51b5' }} />, path: '/fixed-assets' },
      { text: 'Buku Besar', icon: <BookIcon sx={{ color: '#9c27b0' }} />, path: '/ledger' },
      { text: 'Buku Pembantu', icon: <MenuBookIcon sx={{ color: '#ff5722' }} />, path: '/sub-ledger' },
      { text: 'Neraca Saldo', icon: <AccountTreeIcon sx={{ color: '#00bcd4' }} />, path: '/trial-balance' },
      { text: 'Laba Rugi', icon: <TrendingUpIcon sx={{ color: '#e91e63' }} />, path: '/income-statement' },
      { text: 'Neraca', icon: <ScaleIcon sx={{ color: '#3f51b5' }} />, path: '/balance-sheet' },
      { text: 'Arus Kas', icon: <CurrencyExchangeIcon sx={{ color: '#8bc34a' }} />, path: '/cash-flow' },
      { text: 'Rekonsiliasi Bank', icon: <SyncAltIcon sx={{ color: '#4caf50' }} />, path: '/bank-reconciliation' },
      { text: 'Tutup Buku', icon: <LockIcon sx={{ color: '#ff9800' }} />, path: '/closing' },
      { text: 'Manajemen Pengguna', icon: <PeopleIcon sx={{ color: '#607d8b' }} />, path: '/users' },
      { text: 'Pengaturan', icon: <SettingsIcon sx={{ color: '#9e9e9e' }} />, path: '/settings' },
      { text: 'Tentang Aplikasi', icon: <InfoIcon sx={{ color: '#2196f3' }} />, path: '/about' }
    ] : [])
  ];

  const drawer = (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Toolbar sx={{ my: 1, display: 'flex', alignItems: 'center', gap: 1.5 }}>
        <Box sx={{ 
          bgcolor: '#d32f2f', 
          color: 'white', 
          fontWeight: 900, 
          fontSize: '0.85rem',
          px: 1, 
          py: 0.4, 
          borderRadius: 1, 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          boxShadow: 4,
          border: '1px solid rgba(255,255,255,0.2)'
        }}>
          KCP
        </Box>
        <Typography component="div" sx={{ fontWeight: 800, fontSize: '0.95rem', color: 'text.primary', lineHeight: 1.2 }}>
          Kliimora Cash Pro
        </Typography>
      </Toolbar>
      <Divider sx={{ mb: 2 }} />
      <List 
        sx={{ 
          px: 2, 
          flexGrow: 1, 
          overflowY: 'auto',
          '&::-webkit-scrollbar': { display: 'none' },
          msOverflowStyle: 'none',
          scrollbarWidth: 'none'
        }}
      >
        {menuItems.map((item) => {
          const isActive = window.location.pathname === item.path;
          return (
            <ListItem key={item.text} disablePadding sx={{ mb: 0.5 }}>
              <ListItemButton 
                onClick={() => navigate(item.path)}
                sx={{ 
                  borderRadius: 2, 
                  py: 0.5,
                  bgcolor: isActive ? 'rgba(33, 150, 243, 0.08)' : 'transparent',
                  '&:hover': { bgcolor: 'rgba(33, 150, 243, 0.12)' }
                }}
              >
                <ListItemIcon sx={{ minWidth: 40 }}>{item.icon}</ListItemIcon>
                <ListItemText primary={item.text} primaryTypographyProps={{ fontWeight: isActive ? 700 : 500, color: isActive ? '#1976d2' : 'text.primary', fontSize: '0.9rem' }} />
              </ListItemButton>
            </ListItem>
          );
        })}
      </List>
      <Divider />
      <List sx={{ px: 2, pb: 2, pt: 2 }}>
        <ListItem disablePadding>
          <ListItemButton onClick={handleLogout} sx={{ borderRadius: 2, '&:hover': { bgcolor: 'rgba(211, 47, 47, 0.08)' } }}>
            <ListItemIcon sx={{ minWidth: 40 }}><ExitToAppIcon sx={{ color: '#f44336' }} /></ListItemIcon>
            <ListItemText primary="Logout" primaryTypographyProps={{ fontWeight: 600, color: '#f44336' }} />
          </ListItemButton>
        </ListItem>
      </List>
    </Box>
  );

  return (
    <Box sx={{ display: 'flex' }}>
      <AppBar
        position="fixed"
        sx={{
          width: { sm: `calc(100% - ${drawerWidth}px)` },
          ml: { sm: `${drawerWidth}px` },
          bgcolor: 'background.paper',
          color: 'text.primary',
          boxShadow: 1
        }}
      >
        <Toolbar>
          <IconButton
            color="inherit"
            aria-label="open drawer"
            edge="start"
            onClick={handleDrawerToggle}
            sx={{ mr: 2, display: { sm: 'none' } }}
          >
            <MenuIcon />
          </IconButton>
          <Typography variant="h6" noWrap component="div" sx={{ flexGrow: 1, display: { xs: 'none', md: 'block' } }}>
            {user ? `Halo, ${user.username}` : 'Laporan Keuangan'}
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <IconButton color="inherit" onClick={toggleTheme}>
              {themeMode === 'dark' ? <LightModeIcon /> : <DarkModeIcon />}
            </IconButton>
          </Box>
        </Toolbar>
      </AppBar>
      <Box
        component="nav"
        sx={{ width: { sm: drawerWidth }, flexShrink: { sm: 0 } }}
      >
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={handleDrawerToggle}
          ModalProps={{ keepMounted: true }}
          sx={{
            display: { xs: 'block', sm: 'none' },
            '& .MuiDrawer-paper': { boxSizing: 'border-box', width: drawerWidth },
          }}
        >
          {drawer}
        </Drawer>
        <Drawer
          variant="permanent"
          sx={{
            display: { xs: 'none', sm: 'block' },
            '& .MuiDrawer-paper': { boxSizing: 'border-box', width: drawerWidth },
          }}
          open
        >
          {drawer}
        </Drawer>
      </Box>
      <Box
        component="main"
        sx={{ flexGrow: 1, p: 3, width: { sm: `calc(100% - ${drawerWidth}px)` }, bgcolor: 'background.default', minHeight: '100vh' }}
      >
        <Toolbar />
        <AnimatePresence mode="wait">
          <PageWrapper key={location.pathname}>
            <Outlet />
          </PageWrapper>
        </AnimatePresence>
      </Box>

      <Snackbar 
        open={notification.open} 
        autoHideDuration={4000} 
        onClose={closeNotification}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert onClose={closeNotification} severity={notification.severity} variant="filled" sx={{ width: '100%' }}>
          {notification.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}
