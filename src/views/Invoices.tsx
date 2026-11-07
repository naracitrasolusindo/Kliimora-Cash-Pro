import { useEffect, useState } from 'react';
import { Box, Button, Typography, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, IconButton, Dialog, DialogTitle, DialogContent, DialogActions, TextField, Grid, MenuItem } from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import AddIcon from '@mui/icons-material/Add';
import { getDb } from '../lib/db';
import { useAppStore } from '../store/useAppStore';
import { exportInvoicePDF } from '../lib/exportUtils';
import { useSettingsStore } from '../store/useSettingsStore';

interface Invoice {
  id: number;
  invoice_number: string;
  date: string;
  due_date: string;
  contact_id: number;
  subtotal: number;
  tax_rate: number | null;
  tax_amount: number;
  total: number;
  status: string;
  notes: string;
  contact_name?: string;
  contact_address?: string;
  contact_npwp?: string;
}

interface InvoiceItem {
  id?: number;
  invoice_id?: number;
  product_id: number | null;
  description: string;
  quantity: number;
  price: number;
  total: number;
}

interface Product {
  id: number;
  name: string;
  price: number;
}

interface Contact {
  id: number;
  name: string;
}

export default function Invoices() {
  const { showNotification } = useAppStore();
  const { companyName, companyAddress, companyBank, paymentTerms, officerName, officerTitle, companyLogo, fetchSettings } = useSettingsStore();
  const [data, setData] = useState<Invoice[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  
  const [open, setOpen] = useState(false);
  const [editModeId, setEditModeId] = useState<number | null>(null);
  
  const [formData, setFormData] = useState({
    invoice_number: '',
    date: new Date().toISOString().split('T')[0],
    due_date: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    contact_id: 0,
    tax_rate: '' as number | string,
    tax_amount: 0,
    status: 'DRAFT',
    notes: ''
  });

  const [lines, setLines] = useState<InvoiceItem[]>([
    { product_id: null, description: '', quantity: 1, price: 0, total: 0 }
  ]);

  const loadData = async () => {
    try {
      const db = await getDb();
      const invoicesData = await db.select<Invoice[]>(`
        SELECT i.*, c.name as contact_name, c.address as contact_address, c.npwp as contact_npwp
        FROM invoices i 
        LEFT JOIN contacts c ON i.contact_id = c.id 
        ORDER BY i.date DESC, i.id DESC
      `);
      setData(invoicesData);

      const productsData = await db.select<Product[]>('SELECT id, name, price FROM products');
      setProducts(productsData);

      const contactsData = await db.select<Contact[]>('SELECT id, name FROM contacts');
      setContacts(contactsData);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    loadData();
    fetchSettings();
  }, []);

  const generateInvoiceNumber = () => {
    const today = new Date();
    const prefix = `INV-${today.getFullYear()}${(today.getMonth() + 1).toString().padStart(2, '0')}`;
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    return `${prefix}-${randomSuffix}`;
  };

  const handleOpen = () => {
    setEditModeId(null);
    setFormData({
      invoice_number: generateInvoiceNumber(),
      date: new Date().toISOString().split('T')[0],
      due_date: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      contact_id: 0,
      tax_rate: '',
      tax_amount: 0,
      status: 'DRAFT',
      notes: paymentTerms
    });
    setLines([{ product_id: null, description: '', quantity: 1, price: 0, total: 0 }]);
    setOpen(true);
  };

  const handleEdit = async (row: Invoice) => {
    try {
      const db = await getDb();
      const items = await db.select<InvoiceItem[]>('SELECT * FROM invoice_items WHERE invoice_id = $1', [row.id]);
      
      setEditModeId(row.id);
      setFormData({
        invoice_number: row.invoice_number,
        date: row.date,
        due_date: row.due_date || '',
        contact_id: row.contact_id || 0,
        tax_rate: row.tax_rate ?? '',
        tax_amount: row.tax_amount || 0,
        status: row.status,
        notes: row.notes || ''
      });
      
      if (items.length > 0) {
        setLines(items);
      } else {
        setLines([{ product_id: null, description: '', quantity: 1, price: 0, total: 0 }]);
      }
      setOpen(true);
    } catch (err: any) {
      showNotification('Gagal memuat detail tagihan: ' + err.message, 'error');
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('Yakin ingin menghapus tagihan ini?')) return;
    try {
      const db = await getDb();
      // Restore stock (kembalikan stok karena invoice dihapus)
      const oldItems = await db.select<InvoiceItem[]>('SELECT product_id, quantity FROM invoice_items WHERE invoice_id = $1', [id]);
      for (const item of oldItems) {
        if (item.product_id) {
          await db.execute('UPDATE products SET stock = stock + $1 WHERE id = $2', [item.quantity, item.product_id]);
        }
      }
      await db.execute('DELETE FROM invoices WHERE id = $1', [id]);
      showNotification('Tagihan berhasil dihapus', 'success');
      loadData();
    } catch (err: any) {
      showNotification('Gagal menghapus: ' + err.message, 'error');
    }
  };

  const calculateTotals = () => {
    const subtotal = lines.reduce((sum, line) => sum + (line.quantity * line.price), 0);
    let taxAmount = formData.tax_amount;
    
    // Auto calculate if tax_rate is provided
    if (formData.tax_rate !== '' && formData.tax_rate !== null) {
      taxAmount = subtotal * (Number(formData.tax_rate) / 100);
    }
    
    const total = subtotal + taxAmount;
    return { subtotal, taxAmount, total };
  };

  const handleSave = async () => {
    if (!formData.invoice_number || !formData.contact_id) {
      showNotification('Nomor Tagihan dan Pelanggan wajib diisi', 'error');
      return;
    }
    
    const { subtotal, taxAmount, total } = calculateTotals();
    const rate = formData.tax_rate === '' ? null : Number(formData.tax_rate);

    try {
      const db = await getDb();
      
      if (editModeId) {
        await db.execute(`
          UPDATE invoices SET 
          invoice_number = $1, date = $2, due_date = $3, contact_id = $4, 
          subtotal = $5, tax_rate = $6, tax_amount = $7, total = $8, 
          status = $9, notes = $10 
          WHERE id = $11`,
          [formData.invoice_number, formData.date, formData.due_date, formData.contact_id, subtotal, rate, taxAmount, total, formData.status, formData.notes, editModeId]
        );
        
        // Restore old stock (karena ini edit, kembalikan dulu stok lama)
        const oldItems = await db.select<InvoiceItem[]>('SELECT product_id, quantity FROM invoice_items WHERE invoice_id = $1', [editModeId]);
        for (const item of oldItems) {
          if (item.product_id) {
            await db.execute('UPDATE products SET stock = stock + $1 WHERE id = $2', [item.quantity, item.product_id]);
          }
        }

        await db.execute('DELETE FROM invoice_items WHERE invoice_id = $1', [editModeId]);
        
        for (const line of lines) {
          if (line.description || line.product_id) {
            await db.execute(
              'INSERT INTO invoice_items (invoice_id, product_id, description, quantity, price, total) VALUES ($1, $2, $3, $4, $5, $6)',
              [editModeId, line.product_id, line.description, line.quantity, line.price, line.quantity * line.price]
            );
            // Deduct new stock
            if (line.product_id) {
              await db.execute('UPDATE products SET stock = stock - $1 WHERE id = $2', [line.quantity, line.product_id]);
            }
          }
        }
        showNotification('Tagihan berhasil diperbarui', 'success');
      } else {
        const result = await db.execute(`
          INSERT INTO invoices (invoice_number, date, due_date, contact_id, subtotal, tax_rate, tax_amount, total, status, notes) 
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
          [formData.invoice_number, formData.date, formData.due_date, formData.contact_id, subtotal, rate, taxAmount, total, formData.status, formData.notes]
        );
        
        const invoiceId = result.lastInsertId;
        
        for (const line of lines) {
          if (line.description || line.product_id) {
            await db.execute(
              'INSERT INTO invoice_items (invoice_id, product_id, description, quantity, price, total) VALUES ($1, $2, $3, $4, $5, $6)',
              [invoiceId, line.product_id, line.description, line.quantity, line.price, line.quantity * line.price]
            );
            // Deduct stock
            if (line.product_id) {
              await db.execute('UPDATE products SET stock = stock - $1 WHERE id = $2', [line.quantity, line.product_id]);
            }
          }
        }
        showNotification('Tagihan berhasil ditambahkan', 'success');
      }
      setOpen(false);
      loadData();
    } catch (err: any) {
      showNotification('Gagal menyimpan: ' + err.message, 'error');
    }
  };

  const handlePrintPDF = async (row: Invoice) => {
    try {
      const db = await getDb();
      const items = await db.select<InvoiceItem[]>('SELECT * FROM invoice_items WHERE invoice_id = $1', [row.id]);
      
      const invoiceData = {
        ...row,
        items,
        companyName,
        companyAddress,
        companyBank,
        officerName,
        officerTitle,
        companyLogo
      };
      
      await exportInvoicePDF(invoiceData);
      showNotification('PDF berhasil dibuat', 'success');
    } catch (err: any) {
      showNotification('Gagal membuat PDF: ' + err.message, 'error');
    }
  };

  const updateLine = (index: number, field: string, value: any) => {
    const newLines = [...lines];
    newLines[index] = { ...newLines[index], [field]: value };
    
    if (field === 'product_id' && value) {
      const product = products.find(p => p.id === value);
      if (product) {
        newLines[index].price = product.price;
        newLines[index].description = product.name;
      }
    }
    
    setLines(newLines);
  };

  const { subtotal, taxAmount, total } = calculateTotals();

  return (
    <Box sx={{ maxWidth: 1200, mx: 'auto' }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography component="h4" variant="h4" fontWeight="700" color="primary">Tagihan (Invoices)</Typography>
          <Typography component="h6" variant="subtitle1" color="text.secondary">Kelola penagihan ke pelanggan</Typography>
        </Box>
        <Button variant="contained" onClick={handleOpen}>Buat Tagihan</Button>
      </Box>

      <Paper sx={{ boxShadow: '0 4px 20px rgba(0,0,0,0.05)', borderRadius: 2, overflow: 'hidden' }}>
        <TableContainer>
          <Table>
            <TableHead sx={{ bgcolor: 'action.hover' }}>
              <TableRow>
                <TableCell sx={{ fontWeight: 700 }}>Nomor Tagihan</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Tanggal</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Pelanggan</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
                <TableCell align="right" sx={{ fontWeight: 700 }}>Total (Rp)</TableCell>
                <TableCell align="center" sx={{ fontWeight: 700 }}>Aksi</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {data.length === 0 ? (
                <TableRow><TableCell colSpan={6} align="center" sx={{ py: 3, color: 'text.disabled' }}>Belum ada data tagihan</TableCell></TableRow>
              ) : data.map((row) => (
                <TableRow key={row.id} hover>
                  <TableCell sx={{ fontWeight: 600 }}>{row.invoice_number}</TableCell>
                  <TableCell>{row.date}</TableCell>
                  <TableCell>{row.contact_name}</TableCell>
                  <TableCell>
                    <Box sx={{ 
                      display: 'inline-block', 
                      px: 1.5, py: 0.5, 
                      borderRadius: 1, 
                      fontSize: '0.8rem', 
                      fontWeight: 'bold',
                      bgcolor: row.status === 'PAID' ? 'success.light' : row.status === 'UNPAID' ? 'error.light' : 'warning.light',
                      color: row.status === 'PAID' ? 'success.dark' : row.status === 'UNPAID' ? 'error.dark' : 'warning.dark'
                    }}>
                      {row.status}
                    </Box>
                  </TableCell>
                  <TableCell align="right" sx={{ fontWeight: 600 }}>{row.total.toLocaleString('id-ID')}</TableCell>
                  <TableCell align="center">
                    <IconButton size="small" onClick={() => handlePrintPDF(row)} color="secondary" title="Ekspor PDF"><PictureAsPdfIcon fontSize="small" /></IconButton>
                    <IconButton size="small" onClick={() => handleEdit(row)} color="primary"><EditIcon fontSize="small" /></IconButton>
                    <IconButton size="small" onClick={() => handleDelete(row.id)} color="error"><DeleteIcon fontSize="small" /></IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      {/* DIALOG FORM INVOICE */}
      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>{editModeId ? 'Edit Tagihan' : 'Buat Tagihan Baru'}</DialogTitle>
        <DialogContent dividers sx={{ p: 3 }}>
          <Grid container spacing={3} sx={{ mb: 4 }}>
            <Grid item xs={12} sm={4}>
              <TextField 
                label="Nomor Tagihan" 
                fullWidth size="small" 
                value={formData.invoice_number} 
                onChange={e => setFormData({...formData, invoice_number: e.target.value})} 
              />
            </Grid>
            <Grid item xs={12} sm={8}>
              <TextField 
                select 
                label="Pelanggan" 
                fullWidth size="small" 
                value={formData.contact_id} 
                onChange={e => setFormData({...formData, contact_id: Number(e.target.value)})}
              >
                <MenuItem value={0} disabled>Pilih Pelanggan</MenuItem>
                {contacts.map(c => <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>)}
              </TextField>
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField 
                label="Tanggal Tagihan" 
                type="date" 
                fullWidth size="small" 
                slotProps={{ inputLabel: { shrink: true } }} 
                value={formData.date} 
                onChange={e => setFormData({...formData, date: e.target.value})} 
              />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField 
                label="Jatuh Tempo" 
                type="date" 
                fullWidth size="small" 
                slotProps={{ inputLabel: { shrink: true } }} 
                value={formData.due_date} 
                onChange={e => setFormData({...formData, due_date: e.target.value})} 
              />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField 
                select 
                label="Status Pembayaran" 
                fullWidth size="small" 
                value={formData.status} 
                onChange={e => setFormData({...formData, status: e.target.value})}
              >
                <MenuItem value="DRAFT">DRAFT</MenuItem>
                <MenuItem value="UNPAID">UNPAID (Belum Lunas)</MenuItem>
                <MenuItem value="PAID">PAID (Lunas)</MenuItem>
              </TextField>
            </Grid>
          </Grid>

          <Typography component="h6" variant="h6" sx={{ mb: 2 }}>Detail Barang / Jasa</Typography>
          <TableContainer component={Paper} variant="outlined" sx={{ mb: 3 }}>
            <Table size="small">
              <TableHead sx={{ bgcolor: 'action.hover' }}>
                <TableRow>
                  <TableCell>Barang (Opsional)</TableCell>
                  <TableCell>Deskripsi</TableCell>
                  <TableCell width="100">Kuantitas</TableCell>
                  <TableCell width="150">Harga Satuan</TableCell>
                  <TableCell width="150" align="right">Total</TableCell>
                  <TableCell width="50"></TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {lines.map((line, index) => (
                  <TableRow key={index}>
                    <TableCell>
                      <TextField 
                        select 
                        fullWidth size="small" 
                        value={line.product_id || ''} 
                        onChange={e => updateLine(index, 'product_id', e.target.value ? Number(e.target.value) : null)}
                      >
                        <MenuItem value=""><em>-- Tidak Pilih --</em></MenuItem>
                        {products.map(p => <MenuItem key={p.id} value={p.id}>{p.name}</MenuItem>)}
                      </TextField>
                    </TableCell>
                    <TableCell>
                      <TextField 
                        fullWidth size="small" 
                        value={line.description} 
                        onChange={e => updateLine(index, 'description', e.target.value)} 
                        placeholder="Deskripsi..."
                      />
                    </TableCell>
                    <TableCell>
                      <TextField 
                        type="number" 
                        fullWidth size="small" 
                        value={line.quantity} 
                        onChange={e => updateLine(index, 'quantity', Number(e.target.value) || 0)} 
                      />
                    </TableCell>
                    <TableCell>
                      <TextField 
                        type="number" 
                        fullWidth size="small" 
                        value={line.price} 
                        onChange={e => updateLine(index, 'price', Number(e.target.value) || 0)} 
                      />
                    </TableCell>
                    <TableCell align="right" sx={{ verticalAlign: 'middle', fontWeight: 'bold' }}>
                      {(line.quantity * line.price).toLocaleString('id-ID')}
                    </TableCell>
                    <TableCell align="center">
                      <IconButton size="small" color="error" onClick={() => setLines(lines.filter((_, i) => i !== index))}>
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
          
          <Button startIcon={<AddIcon />} onClick={() => setLines([...lines, { product_id: null, description: '', quantity: 1, price: 0, total: 0 }])}>
            Tambah Baris
          </Button>

          <Grid container spacing={3} sx={{ mt: 2 }}>
            <Grid item xs={12} sm={6}>
              <TextField 
                label="Catatan & Ketentuan Pembayaran" 
                fullWidth multiline rows={4} size="small" 
                value={formData.notes} 
                onChange={e => setFormData({...formData, notes: e.target.value})} 
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <Box sx={{ p: 2, bgcolor: 'background.default', borderRadius: 2 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                  <Typography>Subtotal:</Typography>
                  <Typography fontWeight={600}>Rp {subtotal.toLocaleString('id-ID')}</Typography>
                </Box>
                
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1, gap: 2 }}>
                  <Typography>PPN:</Typography>
                  <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                    <TextField 
                      size="small" 
                      placeholder="%"
                      sx={{ width: 70 }}
                      value={formData.tax_rate}
                      onChange={e => {
                        setFormData({...formData, tax_rate: e.target.value});
                      }}
                      InputProps={{ endAdornment: '%' }}
                    />
                    <Typography>atau</Typography>
                    <TextField 
                      size="small" 
                      placeholder="Nominal"
                      sx={{ width: 120 }}
                      value={formData.tax_amount}
                      disabled={formData.tax_rate !== '' && formData.tax_rate !== null}
                      onChange={e => setFormData({...formData, tax_amount: Number(e.target.value) || 0})}
                    />
                  </Box>
                </Box>

                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                  <Typography color="text.secondary" variant="body2">Nilai PPN:</Typography>
                  <Typography color="text.secondary" variant="body2">Rp {taxAmount.toLocaleString('id-ID')}</Typography>
                </Box>
                
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 2, pt: 2, borderTop: '1px solid #ddd' }}>
                  <Typography component="h6" variant="h6" fontWeight={700}>Total:</Typography>
                  <Typography component="h6" variant="h6" fontWeight={700} color="primary">Rp {total.toLocaleString('id-ID')}</Typography>
                </Box>
              </Box>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={() => setOpen(false)}>Batal</Button>
          <Button variant="contained" onClick={handleSave}>Simpan Tagihan</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
