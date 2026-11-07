import { useEffect, useState } from 'react';
import { 
  Box, Typography, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, 
  Button, TextField, Dialog, DialogTitle, DialogContent, DialogActions, IconButton, Chip,
  FormControl, InputLabel, Select, MenuItem, Grid
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import GetAppIcon from '@mui/icons-material/GetApp';
import { getDb } from '../lib/db';
import { useAppStore } from '../store/useAppStore';
import { exportAssetsExcel } from '../lib/exportUtils';

interface Account {
  id: number;
  code: string;
  name: string;
  type: string;
}

interface FixedAsset {
  id: number;
  code: string;
  name: string;
  description: string;
  purchase_date: string;
  purchase_price: number;
  useful_life_months: number;
  salvage_value: number;
  asset_account_id: number;
  accum_dep_account_id: number;
  dep_expense_account_id: number;
  status: string;
  // Computed for display
  asset_account_name?: string;
}

export default function FixedAssets() {
  const [assets, setAssets] = useState<FixedAsset[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [openDialog, setOpenDialog] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  
  const [formData, setFormData] = useState({
    code: '',
    name: '',
    description: '',
    purchase_date: new Date().toISOString().split('T')[0],
    purchase_price: 0,
    useful_life_months: 48,
    salvage_value: 0,
    asset_account_id: '',
    accum_dep_account_id: '',
    dep_expense_account_id: '',
    status: 'ACTIVE'
  });

  const { showNotification } = useAppStore();

  const loadData = async () => {
    try {
      const db = await getDb();
      const accountsData = await db.select<Account[]>('SELECT id, code, name, type FROM accounts ORDER BY code');
      setAccounts(accountsData);

      const assetsData = await db.select<FixedAsset[]>(`
        SELECT f.*, a.name as asset_account_name 
        FROM fixed_assets f 
        LEFT JOIN accounts a ON f.asset_account_id = a.id
        ORDER BY f.id DESC
      `);
      setAssets(assetsData);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleOpen = (asset?: FixedAsset) => {
    if (asset) {
      setEditingId(asset.id);
      setFormData({
        code: asset.code || '',
        name: asset.name,
        description: asset.description || '',
        purchase_date: asset.purchase_date,
        purchase_price: asset.purchase_price,
        useful_life_months: asset.useful_life_months,
        salvage_value: asset.salvage_value,
        asset_account_id: asset.asset_account_id.toString(),
        accum_dep_account_id: asset.accum_dep_account_id.toString(),
        dep_expense_account_id: asset.dep_expense_account_id.toString(),
        status: asset.status
      });
    } else {
      setEditingId(null);
      setFormData({
        code: '',
        name: '',
        description: '',
        purchase_date: new Date().toISOString().split('T')[0],
        purchase_price: 0,
        useful_life_months: 48,
        salvage_value: 0,
        asset_account_id: '',
        accum_dep_account_id: '',
        dep_expense_account_id: '',
        status: 'ACTIVE'
      });
    }
    setOpenDialog(true);
  };

  const handleSave = async () => {
    if (!formData.name || !formData.purchase_date || !formData.purchase_price || !formData.asset_account_id || !formData.accum_dep_account_id || !formData.dep_expense_account_id) {
      showNotification('Mohon lengkapi semua field yang wajib!', 'error');
      return;
    }

    try {
      const db = await getDb();
      if (editingId) {
        await db.execute(
          `UPDATE fixed_assets SET code = $1, name = $2, description = $3, purchase_date = $4, purchase_price = $5, useful_life_months = $6, salvage_value = $7, asset_account_id = $8, accum_dep_account_id = $9, dep_expense_account_id = $10, status = $11 WHERE id = $12`,
          [formData.code, formData.name, formData.description, formData.purchase_date, formData.purchase_price, formData.useful_life_months, formData.salvage_value, formData.asset_account_id, formData.accum_dep_account_id, formData.dep_expense_account_id, formData.status, editingId]
        );
        showNotification('Data aset berhasil diperbarui', 'success');
      } else {
        await db.execute(
          `INSERT INTO fixed_assets (code, name, description, purchase_date, purchase_price, useful_life_months, salvage_value, asset_account_id, accum_dep_account_id, dep_expense_account_id, status) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
          [formData.code, formData.name, formData.description, formData.purchase_date, formData.purchase_price, formData.useful_life_months, formData.salvage_value, formData.asset_account_id, formData.accum_dep_account_id, formData.dep_expense_account_id, formData.status]
        );
        showNotification('Aset baru berhasil ditambahkan', 'success');
      }
      setOpenDialog(false);
      loadData();
    } catch (err: any) {
      showNotification('Gagal menyimpan data: ' + err.message, 'error');
    }
  };

  const handleDelete = async (id: number) => {
    if (window.confirm('Yakin ingin menghapus aset ini?')) {
      try {
        const db = await getDb();
        await db.execute('DELETE FROM fixed_assets WHERE id = $1', [id]);
        showNotification('Aset berhasil dihapus', 'success');
        loadData();
      } catch (err: any) {
        showNotification('Gagal menghapus aset', 'error');
      }
    }
  };

  const handleDepreciateAll = async () => {
    if (!window.confirm('Proses ini akan membuat Jurnal Penyusutan untuk semua aset aktif di bulan ini. Lanjutkan?')) return;
    
    try {
      const db = await getDb();
      const currentMonth = new Date().toISOString().substring(0, 7); // YYYY-MM
      let successCount = 0;

      for (const asset of assets) {
        if (asset.status !== 'ACTIVE') continue;

        const purchaseMonth = asset.purchase_date.substring(0, 7);
        if (currentMonth < purchaseMonth) continue; // Not yet purchased

        // Simple straight-line monthly depreciation
        const depreciableAmount = asset.purchase_price - asset.salvage_value;
        const monthlyDepreciation = depreciableAmount / asset.useful_life_months;

        if (monthlyDepreciation <= 0) continue;

        // Check if we already depreciated this asset this month
        const check = await db.select<any[]>(`
          SELECT id FROM journal_entries 
          WHERE description LIKE $1 AND date LIKE $2
        `, [`%Penyusutan ${asset.name}%`, `${currentMonth}%`]);

        if (check.length > 0) continue; // Already depreciated this month

        // Insert Journal Entry
        const dateStr = new Date().toISOString().split('T')[0];
        const res = await db.execute(
          'INSERT INTO journal_entries (date, description, reference) VALUES ($1, $2, $3)',
          [dateStr, `Beban Penyusutan ${asset.name} Bulan ${currentMonth}`, asset.code]
        );
        const entryId = res.lastInsertId;

        // Debit Expense
        await db.execute(
          'INSERT INTO journal_lines (entry_id, account_id, debit, credit) VALUES ($1, $2, $3, 0)',
          [entryId, asset.dep_expense_account_id, monthlyDepreciation]
        );
        // Credit Accum Dep
        await db.execute(
          'INSERT INTO journal_lines (entry_id, account_id, debit, credit) VALUES ($1, $2, 0, $3)',
          [entryId, asset.accum_dep_account_id, monthlyDepreciation]
        );
        successCount++;
      }

      if (successCount > 0) {
        showNotification(`Berhasil memproses ${successCount} jurnal penyusutan!`, 'success');
      } else {
        showNotification('Tidak ada penyusutan yang perlu diproses (mungkin sudah dilakukan bulan ini).', 'info');
      }
    } catch (err: any) {
      showNotification('Gagal memproses penyusutan: ' + err.message, 'error');
    }
  };

  const formatRupiah = (val: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(val);

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography component="h4" variant="h4" color="primary" sx={{ fontWeight: "700" }}>Aset Tetap</Typography>
          <Typography component="h6" variant="subtitle1" color="text.secondary">Kelola daftar inventaris dan penyusutan</Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Button variant="outlined" color="success" startIcon={<GetAppIcon />} onClick={() => {
            if (assets.length === 0) return showNotification('Tidak ada data aset untuk diekspor', 'warning');
            exportAssetsExcel(assets);
          }}>
            Ekspor Excel
          </Button>
          <Button variant="contained" color="secondary" startIcon={<AutoAwesomeIcon />} onClick={handleDepreciateAll}>
            Jurnal Penyusutan Bulan Ini
          </Button>
          <Button variant="contained" onClick={() => handleOpen()}>Tambah Aset</Button>
        </Box>
      </Box>

      <TableContainer component={Paper} sx={{ borderRadius: 2, boxShadow: '0 4px 20px rgba(0,0,0,0.05)' }}>
        <Table>
          <TableHead sx={{ bgcolor: 'background.default' }}>
            <TableRow>
              <TableCell>Kode</TableCell>
              <TableCell>Nama Aset</TableCell>
              <TableCell>Tanggal Beli</TableCell>
              <TableCell>Harga Beli</TableCell>
              <TableCell>Umur (Bulan)</TableCell>
              <TableCell>Penyusutan/Bln</TableCell>
              <TableCell>Status</TableCell>
              <TableCell align="center">Aksi</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {assets.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} align="center" sx={{ py: 3 }}>
                  <Typography component="p" variant="body1" color="text.secondary">Belum ada data aset tetap.</Typography>
                </TableCell>
              </TableRow>
            ) : (
              assets.map((a) => {
                const monthly = (a.purchase_price - a.salvage_value) / a.useful_life_months;
                return (
                  <TableRow key={a.id} hover>
                    <TableCell>{a.code || '-'}</TableCell>
                    <TableCell>
                      <Typography component="p" variant="body2" sx={{ fontWeight: "bold" }}>{a.name}</Typography>
                      <Typography component="span" variant="caption" color="text.secondary">{a.asset_account_name}</Typography>
                    </TableCell>
                    <TableCell>{a.purchase_date}</TableCell>
                    <TableCell>{formatRupiah(a.purchase_price)}</TableCell>
                    <TableCell>{a.useful_life_months} bln</TableCell>
                    <TableCell>{formatRupiah(monthly)}</TableCell>
                    <TableCell>
                      <Chip label={a.status} size="small" color={a.status === 'ACTIVE' ? 'success' : 'default'} />
                    </TableCell>
                    <TableCell align="center">
                      <IconButton size="small" onClick={() => handleOpen(a)} color="primary">
                        <EditIcon />
                      </IconButton>
                      <IconButton size="small" onClick={() => handleDelete(a.id)} color="error">
                        <DeleteIcon />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog open={openDialog} onClose={() => setOpenDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle>{editingId ? 'Edit Aset Tetap' : 'Tambah Aset Tetap Baru'}</DialogTitle>
        <DialogContent dividers>
          <Grid container spacing={3} sx={{ mt: 1 }}>
            <Grid size={{ xs: 12, sm: 4 }}>
              <TextField label="Kode Aset" fullWidth value={formData.code} onChange={e => setFormData({...formData, code: e.target.value})} />
            </Grid>
            <Grid size={{ xs: 12, sm: 8 }}>
              <TextField label="Nama Aset (wajib)" fullWidth value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} required />
            </Grid>
            <Grid size={{ xs: 12 }}>
              <TextField label="Deskripsi" fullWidth value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} />
            </Grid>
            
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField label="Tanggal Pembelian (wajib)" type="date" fullWidth value={formData.purchase_date} onChange={e => setFormData({...formData, purchase_date: e.target.value})} slotProps={{ inputLabel: { shrink: true } }} required />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField label="Harga Beli (wajib)" type="number" fullWidth value={formData.purchase_price} onChange={e => setFormData({...formData, purchase_price: Number(e.target.value)})} required />
            </Grid>
            
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField label="Umur Ekonomis (Bulan) (wajib)" type="number" fullWidth value={formData.useful_life_months} onChange={e => setFormData({...formData, useful_life_months: Number(e.target.value)})} required />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField label="Nilai Residu/Sisa" type="number" fullWidth value={formData.salvage_value} onChange={e => setFormData({...formData, salvage_value: Number(e.target.value)})} />
            </Grid>

            {/* Account Mapping Section */}
            <Grid size={{ xs: 12 }}>
              <Typography component="h6" variant="subtitle2" color="primary" sx={{ mt: 2 }}>Pemetaan Akun (Jurnal)</Typography>
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }}>
              <FormControl fullWidth required>
                <InputLabel>Akun Aset</InputLabel>
                <Select value={formData.asset_account_id} label="Akun Aset" onChange={e => setFormData({...formData, asset_account_id: e.target.value})}>
                  {accounts.filter(a => a.type === 'asset' && a.name.includes('Aset')).map(a => (
                    <MenuItem key={a.id} value={a.id}>{a.code} - {a.name}</MenuItem>
                  ))}
                  {accounts.map(a => (
                    <MenuItem key={a.id} value={a.id}>{a.code} - {a.name}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }}>
              <FormControl fullWidth required>
                <InputLabel>Akun Akum. Penyusutan</InputLabel>
                <Select value={formData.accum_dep_account_id} label="Akun Akum. Penyusutan" onChange={e => setFormData({...formData, accum_dep_account_id: e.target.value})}>
                  {accounts.map(a => (
                    <MenuItem key={a.id} value={a.id}>{a.code} - {a.name}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }}>
              <FormControl fullWidth required>
                <InputLabel>Akun Beban Penyusutan</InputLabel>
                <Select value={formData.dep_expense_account_id} label="Akun Beban Penyusutan" onChange={e => setFormData({...formData, dep_expense_account_id: e.target.value})}>
                  {accounts.map(a => (
                    <MenuItem key={a.id} value={a.id}>{a.code} - {a.name}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            <Grid size={{ xs: 12 }}>
              <FormControl fullWidth>
                <InputLabel>Status</InputLabel>
                <Select value={formData.status} label="Status" onChange={e => setFormData({...formData, status: e.target.value})}>
                  <MenuItem value="ACTIVE">Aktif (Disusutkan)</MenuItem>
                  <MenuItem value="DISPOSED">Dijual/Dibuang (Berhenti disusutkan)</MenuItem>
                </Select>
              </FormControl>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenDialog(false)}>Batal</Button>
          <Button onClick={handleSave} variant="contained">Simpan Aset</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
