import { useEffect, useState } from 'react';
import { Box, Typography, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, MenuItem, Button } from '@mui/material';
import { getDb } from '../lib/db';
import { exportToPDF, exportToExcel } from '../lib/exportUtils';
import { formatDateID } from '../lib/dateUtils';

import ReportHeader from '../components/ReportHeader';
import { useSettingsStore } from '../store/useSettingsStore';

interface Contact {
  id: number;
  name: string;
  type: string;
}

export default function SubLedger() {
  const { companyName } = useSettingsStore();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [selectedContact, setSelectedContact] = useState<number>(0);
  const [data, setData] = useState<any[]>([]);

  useEffect(() => {
    async function fetchContacts() {
      const db = await getDb();
      const res = await db.select<Contact[]>('SELECT id, name, type FROM contacts ORDER BY name ASC');
      setContacts(res);
      if (res.length > 0) setSelectedContact(res[0].id);
    }
    fetchContacts();
  }, []);

  useEffect(() => {
    async function loadSubLedger() {
      if (!selectedContact) {
        setData([]);
        return;
      }

      const db = await getDb();
      const result = await db.select<any[]>(`
        SELECT je.date, je.reference, je.description, a.name as account_name, a.type as account_type, jl.debit, jl.credit
        FROM journal_lines jl
        JOIN journal_entries je ON jl.entry_id = je.id
        JOIN accounts a ON jl.account_id = a.id
        WHERE jl.contact_id = $1 
          AND (a.code LIKE '1102%' OR a.code LIKE '2101%')
        ORDER BY je.date ASC, je.id ASC
      `, [selectedContact]);

      let runningBalance = 0;
      const contact = contacts.find(c => c.id === selectedContact);
      // Asumsi: Customer biasanya saldo normal debit (Piutang), Vendor saldo normal kredit (Hutang)
      const isCreditNormal = contact?.type === 'vendor';

      const processed = result.map(row => {
        if (isCreditNormal) {
          runningBalance += row.credit - row.debit;
        } else {
          runningBalance += row.debit - row.credit;
        }
        return { ...row, balance: runningBalance };
      });

      setData(processed);
    }
    loadSubLedger();
  }, [selectedContact, contacts]);

  const formatRupiah = (val: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(val);

  const contactName = contacts.find(c => c.id === selectedContact)?.name || '';

  const periodText = `Hingga ${new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })}`;

  const handleExportPDF = () => {
    const body = data.map(row => [formatDateID(row.date), row.reference, row.description, row.account_name, row.debit, row.credit, row.balance]);
    exportToPDF(
      `Buku Pembantu - ${contactName}`, 
      ['Tanggal', 'Referensi', 'Keterangan', 'Akun', 'Debit', 'Kredit', 'Saldo'], 
      body,
      `Perusahaan: ${companyName}\n${periodText}`
    );
  };

  const handleExportExcel = () => {
    const excelData = data.map(row => ({
      'Tanggal': formatDateID(row.date),
      'Referensi': row.reference,
      'Keterangan': row.description,
      'Akun': row.account_name,
      'Debit': row.debit,
      'Kredit': row.credit,
      'Saldo': row.balance
    }));
    exportToExcel(`Buku_Pembantu_${contactName}_${companyName.replace(/\s+/g, '_')}`, excelData);
  };

  return (
    <Box sx={{ maxWidth: 1200, mx: 'auto' }}>
      <ReportHeader title="Buku Pembantu" period={periodText} />
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
        <Box></Box>
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
          <TextField 
            select 
            label="Pilih Kontak" 
            value={selectedContact} 
            onChange={e => setSelectedContact(parseInt(e.target.value as string))} 
            size="small" 
            sx={{ width: 250 }}
          >
            {contacts.map(c => (
              <MenuItem key={c.id} value={c.id}>{c.name} ({c.type === 'customer' ? 'Pelanggan' : 'Pemasok'})</MenuItem>
            ))}
          </TextField>
          <Button variant="outlined" color="primary" onClick={handleExportPDF} disabled={!selectedContact || data.length === 0}>Ekspor PDF</Button>
          <Button variant="outlined" color="success" onClick={handleExportExcel} disabled={!selectedContact || data.length === 0}>Ekspor Excel</Button>
        </Box>
      </Box>

      <TableContainer component={Paper} sx={{ boxShadow: '0 4px 20px rgba(0,0,0,0.05)', borderRadius: 2, overflow: 'hidden' }}>
        <Table size="small">
          <TableHead sx={{ bgcolor: 'action.hover' }}>
            <TableRow>
              <TableCell sx={{ fontWeight: 700, py: 2 }}>Tanggal</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Referensi</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Keterangan / Akun</TableCell>
              <TableCell sx={{ fontWeight: 700 }} align="right">Mutasi Debit</TableCell>
              <TableCell sx={{ fontWeight: 700 }} align="right">Mutasi Kredit</TableCell>
              <TableCell sx={{ fontWeight: 700 }} align="right">Saldo Akhir</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {contacts.length === 0 ? (
              <TableRow><TableCell colSpan={6} align="center" sx={{ py: 3, color: 'text.secondary' }}>Belum ada daftar kontak</TableCell></TableRow>
            ) : data.length === 0 ? (
              <TableRow><TableCell colSpan={6} align="center" sx={{ py: 3, color: 'text.secondary' }}>Tidak ada transaksi untuk kontak ini</TableCell></TableRow>
            ) : data.map((row, idx) => (
              <TableRow key={idx} hover>
                <TableCell sx={{ py: 1.5 }}>{formatDateID(row.date)}</TableCell>
                <TableCell>{row.reference}</TableCell>
                <TableCell>
                  {row.description}
                  <Typography component="span" variant="caption" color="primary" sx={{ display: 'block' }}>{row.account_name}</Typography>
                </TableCell>
                <TableCell align="right">{row.debit > 0 ? formatRupiah(row.debit) : '-'}</TableCell>
                <TableCell align="right">{row.credit > 0 ? formatRupiah(row.credit) : '-'}</TableCell>
                <TableCell align="right" sx={{ fontWeight: 600, color: row.balance >= 0 ? 'text.primary' : 'error.main' }}>
                  {formatRupiah(row.balance)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
}
