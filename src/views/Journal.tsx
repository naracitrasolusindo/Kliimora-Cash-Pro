import React, { useEffect, useState } from 'react';
import { Box, Button, Typography, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, IconButton, Dialog, DialogTitle, DialogContent, DialogActions, TextField, MenuItem, Grid, InputAdornment } from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import PrintIcon from '@mui/icons-material/Print';
import EditIcon from '@mui/icons-material/Edit';
import SearchIcon from '@mui/icons-material/Search';
import { getDb } from '../lib/db';
import { exportToExcel, exportVoucherPDF, downloadExcelTemplate } from '../lib/exportUtils';
import { formatDateID } from '../lib/dateUtils';
import { useAuthStore } from '../store/useAuthStore';
import { useSettingsStore } from '../store/useSettingsStore';
import { useAppStore } from '../store/useAppStore';
import { open } from '@tauri-apps/plugin-dialog';
import { readFile } from '@tauri-apps/plugin-fs';
import * as XLSX from 'xlsx';

interface JournalFlatData {
  entry_id: number;
  date: string;
  reference: string;
  description: string;
  account_code: string;
  account_name: string;
  debit: number;
  credit: number;
  contact_name: string | null;
}

interface Account {
  id: number;
  code: string;
  name: string;
}

interface Contact {
  id: number;
  name: string;
  type: string;
}

export default function Journal() {
  const { user } = useAuthStore();
  const { showNotification } = useAppStore();
  const [data, setData] = useState<JournalFlatData[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [open, setOpen] = useState(false);
  const [editModeId, setEditModeId] = useState<number | null>(null);
  const [formData, setFormData] = useState({ date: new Date().toISOString().split('T')[0], description: '', reference: '' });
  const [lines, setLines] = useState([{ account_id: 0, contact_id: 0, debit: 0, credit: 0 }, { account_id: 0, contact_id: 0, debit: 0, credit: 0 }]);
  const companyName = useSettingsStore(state => state.companyName);
  
  const currentDate = new Date();
  const firstDay = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).toISOString().split('T')[0];
  const lastDay = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).toISOString().split('T')[0];
  const [startDate, setStartDate] = useState(firstDay);
  const [endDate, setEndDate] = useState(lastDay);
  const [searchQuery, setSearchQuery] = useState('');

  const loadData = async () => {
    try {
      const db = await getDb();
      const accountsData = await db.select<Account[]>('SELECT id, code, name FROM accounts ORDER BY code ASC');
      setAccounts(accountsData);

      const contactsData = await db.select<Contact[]>('SELECT id, name, type FROM contacts ORDER BY name ASC');
      setContacts(contactsData);

      const flatData = await db.select<JournalFlatData[]>(`
        SELECT je.id as entry_id, je.date, je.reference, je.description, a.code as account_code, a.name as account_name, jl.debit, jl.credit, c.name as contact_name
        FROM journal_lines jl
        JOIN journal_entries je ON jl.entry_id = je.id
        JOIN accounts a ON jl.account_id = a.id
        LEFT JOIN contacts c ON jl.contact_id = c.id
        WHERE je.date >= $1 AND je.date <= $2
        ORDER BY je.date DESC, je.id DESC, jl.debit DESC
      `, [startDate, endDate]);
      
      setData(flatData);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    loadData();
  }, [startDate, endDate]);

  const handleOpen = () => {
    setEditModeId(null);
    setFormData({ date: new Date().toISOString().split('T')[0], description: '', reference: '' });
    setLines([{ account_id: 0, contact_id: 0, debit: 0, credit: 0 }, { account_id: 0, contact_id: 0, debit: 0, credit: 0 }]);
    setOpen(true);
  };

  const handleEdit = async (entryId: number) => {
    const entryData = data.find(d => d.entry_id === entryId);
    if (!entryData) return;
    
    setFormData({ date: entryData.date, description: entryData.description, reference: entryData.reference || '' });
    setEditModeId(entryId);
    
    try {
      const db = await getDb();
      const dbLines = await db.select<any[]>('SELECT account_id, contact_id, debit, credit FROM journal_lines WHERE entry_id = $1', [entryId]);
      if (dbLines.length > 0) {
        setLines(dbLines.map(l => ({ 
          account_id: l.account_id, 
          contact_id: l.contact_id || 0, 
          debit: l.debit, 
          credit: l.credit 
        })));
      }
      setOpen(true);
    } catch (err) {
      console.error(err);
    }
  };

  const updateLine = (index: number, field: string, value: any) => {
    const newLines = [...lines];
    newLines[index] = { ...newLines[index], [field]: value };
    if (field === 'debit' && value > 0) newLines[index].credit = 0;
    if (field === 'credit' && value > 0) newLines[index].debit = 0;
    setLines(newLines);
  };

  const removeLine = (index: number) => {
    if (lines.length > 2) setLines(lines.filter((_, i) => i !== index));
  };

  const totalDebitInput = lines.reduce((sum, line) => sum + (line.debit || 0), 0);
  const totalCreditInput = lines.reduce((sum, line) => sum + (line.credit || 0), 0);
  const isBalanced = totalDebitInput > 0 && totalDebitInput === totalCreditInput;
  const isLinesValid = lines.every(l => l.account_id > 0 && (l.debit > 0 || l.credit > 0));

  const handleSave = async () => {
    if (!isBalanced) return showNotification('Total Debit dan Kredit harus seimbang!', 'warning');
    if (!isLinesValid) return showNotification('Data baris tidak valid.', 'warning');
    
    try {
      const db = await getDb();
      let entryId = editModeId;

      if (editModeId) {
        await db.execute(
          'UPDATE journal_entries SET date = $1, description = $2, reference = $3 WHERE id = $4',
          [formData.date, formData.description, formData.reference, editModeId]
        );
        await db.execute('DELETE FROM journal_lines WHERE entry_id = $1', [editModeId]);
      } else {
        const result = await db.execute(
          'INSERT INTO journal_entries (date, description, reference) VALUES ($1, $2, $3)',
          [formData.date, formData.description, formData.reference]
        );
        entryId = result.lastInsertId;
      }
      
      for (const line of lines) {
        await db.execute(
          'INSERT INTO journal_lines (entry_id, account_id, contact_id, debit, credit) VALUES ($1, $2, $3, $4, $5)',
          [entryId, line.account_id, line.contact_id > 0 ? line.contact_id : null, line.debit, line.credit]
        );
      }
      setOpen(false);
      loadData();
      showNotification('Jurnal berhasil disimpan', 'success');
    } catch (err) {
      console.error(err);
      showNotification('Gagal menyimpan jurnal', 'error');
    }
  };

  const handleDelete = async (id: number) => {
    if (window.confirm('Hapus jurnal ini?')) {
      try {
        const db = await getDb();
        await db.execute('DELETE FROM journal_entries WHERE id = $1', [id]);
        loadData();
        showNotification('Jurnal berhasil dihapus', 'success');
      } catch (err) {
        showNotification('Gagal menghapus jurnal', 'error');
      }
    }
  };

  const handlePrintVoucher = (entryId: number) => {
    const entryData = data.filter(d => d.entry_id === entryId);
    if (entryData.length === 0) return;
    
    exportVoucherPDF(companyName, entryData);
  };

  const formatRupiah = (val: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(val);

  const handleExportExcel = () => {
    const excelData = data.map(row => ({
      'Tanggal': row.date,
      'Referensi': row.reference,
      'Keterangan': row.description,
      'Kode Akun': row.account_code,
      'Nama Akun': row.account_name,
      'Kontak': row.contact_name || '',
      'Debit': row.debit,
      'Kredit': row.credit
    }));
    exportToExcel(`Jurnal_Umum_${filterYear}_${filterMonth}`, excelData);
  };

  const handleImportExcel = async () => {
    try {
      const selectedPath = await open({
        multiple: false,
        filters: [{ name: 'Excel Spreadsheet', extensions: ['xlsx', 'xls'] }]
      });

      if (!selectedPath || typeof selectedPath !== 'string') return;

      const fileData = await readFile(selectedPath);
      const wb = XLSX.read(fileData, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json<any>(ws, { raw: false, dateNF: 'dd/mm/yyyy' });

      if (jsonData.length === 0) {
        showNotification('File Excel kosong atau format tidak sesuai.', 'warning');
        return;
      }

      // Group by Referensi
      const grouped: Record<string, any[]> = {};
      for (const row of jsonData) {
        const ref = row['Referensi'];
        if (!ref) continue;
        if (!grouped[ref]) grouped[ref] = [];
        grouped[ref].push(row);
      }

      const db = await getDb();
      let importedRefs = 0;

      for (const ref in grouped) {
        const rows = grouped[ref];
        
        let totalDebit = 0;
        let totalCredit = 0;
        let isRefValid = true;

        for (const r of rows) {
          totalDebit += (Number(r['Debit']) || 0);
          totalCredit += (Number(r['Kredit']) || 0);
          
          const accCheck = await db.select<any[]>('SELECT id FROM accounts WHERE code = $1', [String(r['Kode Akun'])]);
          if (accCheck.length === 0) {
            showNotification(`Impor gagal pada Referensi ${ref}: Kode Akun ${r['Kode Akun']} tidak ditemukan.`, 'error');
            isRefValid = false;
            break;
          }
          r._accountId = accCheck[0].id;
        }

        if (!isRefValid) continue; 
        if (Math.abs(totalDebit - totalCredit) > 0.01) {
          showNotification(`Impor gagal pada Referensi ${ref}: Jurnal tidak balance (Debit: ${totalDebit}, Kredit: ${totalCredit}).`, 'error');
          continue; 
        }

        let rawDate = rows[0]['Tanggal (DD/MM/YYYY)'] || rows[0]['Tanggal'] || '';
        let isoDate = new Date().toISOString().split('T')[0];
        
        if (rawDate.includes('/')) {
          const parts = rawDate.split('/');
          if (parts.length === 3) {
            isoDate = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
          }
        } else if (rawDate.includes('-')) {
          const parts = rawDate.split('-');
          if (parts[0].length === 4) {
            isoDate = rawDate; // Already YYYY-MM-DD
          } else if (parts.length === 3) {
            isoDate = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
          }
        }

        const desc = rows[0]['Keterangan'] || '';
        
        const res = await db.execute(
          'INSERT INTO journal_entries (date, reference, description) VALUES ($1, $2, $3)',
          [isoDate, ref, desc]
        );
        const entryId = res.lastInsertId;

        for (const r of rows) {
          await db.execute(
            'INSERT INTO journal_lines (entry_id, account_id, contact_id, debit, credit) VALUES ($1, $2, null, $3, $4)',
            [entryId, r._accountId, (Number(r['Debit']) || 0), (Number(r['Kredit']) || 0)]
          );
        }
        importedRefs++;
      }

      if (importedRefs > 0) {
        showNotification(`Berhasil mengimpor ${importedRefs} referensi jurnal!`, 'success');
        loadData();
      }

    } catch (err: any) {
      console.error(err);
      showNotification('Gagal mengimpor file: ' + err.message, 'error');
    }
  };

  let currentEntryId = -1;

  return (
    <Box sx={{ maxWidth: 1200, mx: 'auto' }}>
      <Box sx={{ display: 'flex', flexDirection: { xs: 'column', lg: 'row' }, justifyContent: 'space-between', alignItems: { xs: 'stretch', lg: 'center' }, gap: 3, mb: 3 }}>
        <Box sx={{ flexShrink: 0 }}>
          <Typography variant="h4" fontWeight="700" color="primary">Jurnal Umum</Typography>
          <Typography variant="subtitle1" color="text.secondary">Tampilan Baris per Baris</Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap', justifyContent: { xs: 'flex-start', lg: 'flex-end' } }}>
          <TextField label="Mulai Tanggal" type="date" value={startDate} onChange={e => setStartDate(e.target.value)} size="small" InputLabelProps={{ shrink: true }} />
          <TextField label="Sampai Tanggal" type="date" value={endDate} onChange={e => setEndDate(e.target.value)} size="small" InputLabelProps={{ shrink: true }} />
          <TextField
            placeholder="Cari..."
            size="small"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" />
                </InputAdornment>
              ),
            }}
            sx={{ width: 200 }}
          />
          
          <Button variant="outlined" color="primary" onClick={downloadExcelTemplate}>Template</Button>
          <Button variant="outlined" color="secondary" onClick={handleImportExcel}>Impor</Button>
          <Button variant="outlined" color="success" onClick={handleExportExcel}>Ekspor</Button>
          <Button variant="contained" onClick={handleOpen}>Tambah</Button>
        </Box>
      </Box>

      <Paper sx={{ boxShadow: '0 4px 20px rgba(0,0,0,0.05)', borderRadius: 2, overflow: 'hidden' }}>
        <TableContainer>
          <Table size="small">
            <TableHead sx={{ bgcolor: 'action.hover' }}>
              <TableRow>
                <TableCell sx={{ fontWeight: 700, py: 2 }}>Tanggal</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Referensi</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Keterangan</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Akun / Kontak</TableCell>
                <TableCell sx={{ fontWeight: 700 }} align="right">Debit</TableCell>
                <TableCell sx={{ fontWeight: 700 }} align="right">Kredit</TableCell>
                <TableCell sx={{ fontWeight: 700 }} align="center">Aksi</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {(() => {
                const query = searchQuery.toLowerCase();
                const filteredData = data.filter(row => {
                  if (!query) return true;
                  return (
                    row.description.toLowerCase().includes(query) ||
                    row.reference.toLowerCase().includes(query) ||
                    row.debit.toString().includes(query) ||
                    row.credit.toString().includes(query) ||
                    row.account_name.toLowerCase().includes(query) ||
                    row.account_code.toLowerCase().includes(query)
                  );
                });

                if (filteredData.length === 0) {
                  return <TableRow><TableCell colSpan={7} align="center" sx={{ py: 3, color: 'text.disabled' }}>Tidak ada jurnal yang sesuai</TableCell></TableRow>;
                }

                return filteredData.map((row, idx) => {
                  const isNewEntry = row.entry_id !== currentEntryId;
                  if (isNewEntry) currentEntryId = row.entry_id;

                return (
                  <TableRow key={idx} hover sx={{ '& td': { borderBottom: isNewEntry && idx !== 0 ? '1px solid #e0e0e0' : 'none' } }}>
                    <TableCell sx={{ py: 1.5, color: 'text.secondary' }}>{isNewEntry ? formatDateID(row.date) : ''}</TableCell>
                    <TableCell sx={{ color: 'text.secondary' }}>{isNewEntry ? row.reference : ''}</TableCell>
                    <TableCell sx={{ color: 'text.secondary' }}>{isNewEntry ? row.description : ''}</TableCell>
                    <TableCell sx={{ color: 'text.primary', pl: row.credit > 0 ? 4 : 2 }}>
                      {row.account_code} - {row.account_name}
                      {row.contact_name && <Typography variant="caption" display="block" color="primary">@{row.contact_name}</Typography>}
                    </TableCell>
                    <TableCell align="right">{row.debit > 0 ? formatRupiah(row.debit) : '-'}</TableCell>
                    <TableCell align="right">{row.credit > 0 ? formatRupiah(row.credit) : '-'}</TableCell>
                    <TableCell align="center">
                      {isNewEntry && (
                        <Box sx={{ display: 'flex', justifyContent: 'center' }}>
                          <IconButton size="small" color="primary" onClick={() => handlePrintVoucher(row.entry_id)} title="Cetak Voucher">
                            <PrintIcon fontSize="small" />
                          </IconButton>
                          {user?.role === 'admin' && (
                            <>
                              <IconButton size="small" color="secondary" onClick={() => handleEdit(row.entry_id)} title="Edit Jurnal">
                                <EditIcon fontSize="small" />
                              </IconButton>
                              <IconButton size="small" color="error" onClick={() => handleDelete(row.entry_id)} title="Hapus Jurnal">
                                <DeleteIcon fontSize="small" />
                              </IconButton>
                            </>
                          )}
                        </Box>
                      )}
                    </TableCell>
                  </TableRow>
                );
                });
              })()}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      {/* Dialog Add Journal */}
      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="lg" fullWidth>
        <DialogTitle fontWeight="bold">{editModeId ? 'Edit Jurnal Entri' : 'Tambah Jurnal Entri'}</DialogTitle>
        <DialogContent sx={{ mt: 1 }}>
          <Grid container spacing={2} sx={{ mb: 3 }}>
            <Grid item xs={12} sm={4}>
              <TextField label="Tanggal" type="date" value={formData.date} onChange={(e) => setFormData({ ...formData, date: e.target.value })} fullWidth InputLabelProps={{ shrink: true }} />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField label="No. Referensi" value={formData.reference} onChange={(e) => setFormData({ ...formData, reference: e.target.value })} fullWidth />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField label="Keterangan" value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} fullWidth />
            </Grid>
          </Grid>

          <Typography variant="subtitle1" fontWeight="bold" gutterBottom>Baris Jurnal</Typography>
          {lines.map((line, index) => (
            <Grid container spacing={2} sx={{ mb: 2, alignItems: 'center' }} key={index}>
              <Grid item xs={12} sm={4}>
                <TextField select label="Akun" value={line.account_id} onChange={(e) => updateLine(index, 'account_id', parseInt(e.target.value))} fullWidth size="small">
                  <MenuItem value={0} disabled>Pilih Akun</MenuItem>
                  {accounts.map(acc => (
                    <MenuItem key={acc.id} value={acc.id}>{acc.code} - {acc.name}</MenuItem>
                  ))}
                </TextField>
              </Grid>
              <Grid item xs={12} sm={3}>
                <TextField select label="Kontak (Opsional)" value={line.contact_id} onChange={(e) => updateLine(index, 'contact_id', parseInt(e.target.value))} fullWidth size="small">
                  <MenuItem value={0}>- Tanpa Kontak -</MenuItem>
                  {contacts.map(c => (
                    <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>
                  ))}
                </TextField>
              </Grid>
              <Grid item xs={12} sm={2}>
                <TextField label="Debit (Rp)" type="number" value={line.debit || ''} onChange={(e) => updateLine(index, 'debit', parseFloat(e.target.value) || 0)} disabled={line.credit > 0} fullWidth size="small"/>
              </Grid>
              <Grid item xs={12} sm={2}>
                <TextField label="Kredit (Rp)" type="number" value={line.credit || ''} onChange={(e) => updateLine(index, 'credit', parseFloat(e.target.value) || 0)} disabled={line.debit > 0} fullWidth size="small"/>
              </Grid>
              <Grid item xs={12} sm={1}>
                <IconButton color="error" onClick={() => removeLine(index)} disabled={lines.length <= 2}><DeleteIcon /></IconButton>
              </Grid>
            </Grid>
          ))}
          <Button onClick={() => setLines([...lines, { account_id: 0, contact_id: 0, debit: 0, credit: 0 }])} variant="outlined" sx={{ mb: 3 }}>Tambah Baris</Button>

          <Grid container spacing={2} sx={{ borderTop: 1, borderColor: 'divider', pt: 2 }}>
            <Grid item xs={12} sm={7}><Typography align="right" fontWeight="bold">Total:</Typography></Grid>
            <Grid item xs={12} sm={2}><Typography fontWeight="bold" color={isBalanced ? 'success.main' : 'error.main'}>Rp {totalDebitInput.toLocaleString('id-ID')}</Typography></Grid>
            <Grid item xs={12} sm={2}><Typography fontWeight="bold" color={isBalanced ? 'success.main' : 'error.main'}>Rp {totalCreditInput.toLocaleString('id-ID')}</Typography></Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setOpen(false)}>Batal</Button>
          <Button variant="contained" onClick={handleSave} disabled={!isBalanced || !formData.description}>Simpan Jurnal</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
