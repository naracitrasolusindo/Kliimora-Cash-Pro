import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { save } from '@tauri-apps/plugin-dialog';
import { writeFile } from '@tauri-apps/plugin-fs';

export const exportToPDF = async (title: string, columns: string[], data: any[][], subtitle?: string) => {
  try {
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text(title, 14, 15);
    
    let startY = 25;
    if (subtitle) {
      doc.setFontSize(11);
      const splitTitle = doc.splitTextToSize(subtitle, 180);
      doc.text(splitTitle, 14, 25);
      startY = 25 + (splitTitle.length * 5) + 5;
    }
    
    autoTable(doc, {
      head: [columns],
      body: data,
      startY: startY,
    });
    
    const defaultFileName = `${title.replace(/\s+/g, '_').toLowerCase()}.pdf`;
    
    try {
      const filePath = await save({ 
        defaultPath: defaultFileName, 
        filters: [{ name: 'PDF Document', extensions: ['pdf'] }] 
      });
      if (filePath) {
        const arrayBuffer = doc.output('arraybuffer');
        await writeFile(filePath, new Uint8Array(arrayBuffer));
      }
    } catch (e) {
      console.warn('Tauri dialog failed, falling back to browser save', e);
      doc.save(defaultFileName);
    }
  } catch (err) {
    console.error('PDF Export Error:', err);
    alert('Gagal mengekspor PDF: ' + String(err));
  }
};

export const exportVoucherPDF = async (companyName: string, entryData: any[]) => {
  try {
    const doc = new jsPDF();
    const ref = entryData[0].reference || entryData[0].entry_id;
    const date = entryData[0].date;
    const desc = entryData[0].description;
    
    // Header
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text(companyName || 'Perusahaan', 14, 20);
    
    doc.setFontSize(20);
    doc.text("BUKTI JURNAL", 130, 20);
    
    // Info Box
    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");
    doc.text(`No. Referensi : ${ref}`, 14, 35);
    doc.text(`Tanggal       : ${date}`, 14, 42);
    
    const splitDesc = doc.splitTextToSize(`Keterangan    : ${desc}`, 120);
    doc.text(splitDesc, 14, 49);
    
    let startY = 49 + (splitDesc.length * 5) + 5;

    // Table Data
    const columns = ['Kode Akun', 'Nama Akun', 'Kontak', 'Debit', 'Kredit'];
    const data = entryData.map(row => [
      row.account_code, 
      row.account_name, 
      row.contact_name || '-',
      new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(row.debit), 
      new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(row.credit)
    ]);
    
    const totalDebit = entryData.reduce((s, row) => s + row.debit, 0);
    const totalCredit = entryData.reduce((s, row) => s + row.credit, 0);
    
    data.push([
      '', 
      'TOTAL', 
      '', 
      new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(totalDebit), 
      new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(totalCredit)
    ]);

    autoTable(doc, {
      head: [columns],
      body: data,
      startY: startY,
      theme: 'grid',
      headStyles: { fillColor: [33, 150, 243] },
      willDrawCell: function(data) {
        if (data.row.index === entryData.length) {
          data.cell.styles.fontStyle = 'bold';
        }
      }
    });

    // Signature Block
    const finalY = (doc as any).lastAutoTable.finalY + 30;
    doc.text("Dibuat Oleh,", 30, finalY);
    doc.text("_________________", 25, finalY + 25);
    
    doc.text("Disetujui Oleh,", 140, finalY);
    doc.text("_________________", 135, finalY + 25);

    const defaultFileName = `Voucher_${ref}.pdf`;
    
    try {
      const filePath = await save({ 
        defaultPath: defaultFileName, 
        filters: [{ name: 'PDF Document', extensions: ['pdf'] }] 
      });
      if (filePath) {
        const arrayBuffer = doc.output('arraybuffer');
        await writeFile(filePath, new Uint8Array(arrayBuffer));
      }
    } catch (e) {
      console.warn('Tauri dialog failed, falling back to browser save', e);
      doc.save(defaultFileName);
    }
  } catch (err) {
    console.error('PDF Export Error:', err);
    alert('Gagal mengekspor PDF: ' + String(err));
  }
};

export const exportToExcel = async (title: string, data: object[]) => {
  try {
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
    
    const defaultFileName = `${title.replace(/\s+/g, '_').toLowerCase()}.xlsx`;
    
    try {
      const filePath = await save({ 
        defaultPath: defaultFileName, 
        filters: [{ name: 'Excel Spreadsheet', extensions: ['xlsx'] }] 
      });
      if (filePath) {
        const arrayBuffer = XLSX.write(wb, { type: "array", bookType: "xlsx" });
        await writeFile(filePath, new Uint8Array(arrayBuffer));
      }
    } catch (e) {
      console.warn('Tauri dialog failed, falling back to browser save', e);
      XLSX.writeFile(wb, defaultFileName);
    }
  } catch (err) {
    console.error('Excel Export Error:', err);
    alert('Gagal mengekspor Excel: ' + String(err));
  }
};

export const downloadExcelTemplate = async () => {
  try {
    const templateData = [
      {
        'Tanggal (DD/MM/YYYY)': '31/12/2026',
        'Referensi': 'REF-001',
        'Keterangan': 'Contoh Transaksi',
        'Kode Akun': '1101',
        'Debit': 100000,
        'Kredit': 0
      },
      {
        'Tanggal (DD/MM/YYYY)': '31/12/2026',
        'Referensi': 'REF-001',
        'Keterangan': 'Contoh Transaksi',
        'Kode Akun': '4101',
        'Debit': 0,
        'Kredit': 100000
      }
    ];

    const ws = XLSX.utils.json_to_sheet(templateData);
    
    // Auto-size columns
    ws['!cols'] = [
      { wch: 12 }, // Tanggal
      { wch: 15 }, // Referensi
      { wch: 30 }, // Keterangan
      { wch: 15 }, // Kode Akun
      { wch: 15 }, // Debit
      { wch: 15 }  // Kredit
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Template Jurnal");
    
    const defaultFileName = "Template_Impor_Jurnal.xlsx";
    
    try {
      const filePath = await save({ 
        defaultPath: defaultFileName, 
        filters: [{ name: 'Excel Spreadsheet', extensions: ['xlsx'] }] 
      });
      if (filePath) {
        const arrayBuffer = XLSX.write(wb, { type: "array", bookType: "xlsx" });
        await writeFile(filePath, new Uint8Array(arrayBuffer));
      }
    } catch (e) {
      console.warn('Tauri dialog failed, falling back to browser save', e);
      XLSX.writeFile(wb, defaultFileName);
    }
  } catch (err) {
    console.error('Template Download Error:', err);
    alert('Gagal mengunduh template: ' + String(err));
  }
};

export interface CashFlowData {
  companyName: string;
  startDate: string;
  endDate: string;
  operatingInflow: number;
  operatingOutflow: number;
  investingInflow: number;
  investingOutflow: number;
  financingInflow: number;
  financingOutflow: number;
  beginningCash: number;
}

export const exportCashFlowPDF = async (data: CashFlowData) => {
  try {
    const doc = new jsPDF();
    
    // Header
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text(data.companyName || 'Perusahaan', 14, 20);
    
    doc.setFontSize(14);
    doc.text("Laporan Arus Kas (Cash Flow)", 14, 28);
    
    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");
    doc.text(`Periode: ${data.startDate} s.d. ${data.endDate}`, 14, 35);
    
    const formatRp = (val: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(val);
    
    const netOp = data.operatingInflow - data.operatingOutflow;
    const netInv = data.investingInflow - data.investingOutflow;
    const netFin = data.financingInflow - data.financingOutflow;
    const netInc = netOp + netInv + netFin;
    const endCash = data.beginningCash + netInc;

    const tableData = [
      [{ content: 'Arus Kas dari Aktivitas Operasi', colSpan: 2, styles: { fontStyle: 'bold', fillColor: [240, 240, 240] } }],
      ['  Penerimaan Kas (Pendapatan/Piutang)', formatRp(data.operatingInflow)],
      ['  Pengeluaran Kas (Beban/Hutang/Persediaan)', `(${formatRp(data.operatingOutflow)})`],
      [{ content: 'Kas Bersih dari Aktivitas Operasi', styles: { fontStyle: 'bold' } }, { content: formatRp(netOp), styles: { fontStyle: 'bold' } }],
      
      [{ content: 'Arus Kas dari Aktivitas Investasi', colSpan: 2, styles: { fontStyle: 'bold', fillColor: [240, 240, 240] } }],
      ['  Penerimaan dari Penjualan Aset Tetap', formatRp(data.investingInflow)],
      ['  Pengeluaran untuk Pembelian Aset Tetap', `(${formatRp(data.investingOutflow)})`],
      [{ content: 'Kas Bersih dari Aktivitas Investasi', styles: { fontStyle: 'bold' } }, { content: formatRp(netInv), styles: { fontStyle: 'bold' } }],
      
      [{ content: 'Arus Kas dari Aktivitas Pendanaan', colSpan: 2, styles: { fontStyle: 'bold', fillColor: [240, 240, 240] } }],
      ['  Penerimaan Pinjaman Bank / Setoran Modal', formatRp(data.financingInflow)],
      ['  Pelunasan Pinjaman / Prive / Dividen', `(${formatRp(data.financingOutflow)})`],
      [{ content: 'Kas Bersih dari Aktivitas Pendanaan', styles: { fontStyle: 'bold' } }, { content: formatRp(netFin), styles: { fontStyle: 'bold' } }],
      
      [{ content: 'Kenaikan (Penurunan) Kas Bersih', styles: { fontStyle: 'bold', fontSize: 11 } }, { content: formatRp(netInc), styles: { fontStyle: 'bold', fontSize: 11 } }],
      [{ content: 'Saldo Kas Awal Periode', styles: { fontStyle: 'bold' } }, { content: formatRp(data.beginningCash), styles: { fontStyle: 'bold' } }],
      [{ content: 'Saldo Kas Akhir Periode', styles: { fontStyle: 'bold', textColor: [25, 118, 210] } }, { content: formatRp(endCash), styles: { fontStyle: 'bold', textColor: [25, 118, 210] } }],
    ];

    autoTable(doc, {
      body: tableData,
      startY: 45,
      theme: 'plain',
      styles: { cellPadding: 3, fontSize: 10 },
      columnStyles: {
        0: { cellWidth: 120 },
        1: { cellWidth: 60, halign: 'right' }
      }
    });

    const defaultFileName = `Arus_Kas_${data.startDate}_sd_${data.endDate}.pdf`;
    
    try {
      const filePath = await save({ 
        defaultPath: defaultFileName, 
        filters: [{ name: 'PDF Document', extensions: ['pdf'] }] 
      });
      if (filePath) {
        const arrayBuffer = doc.output('arraybuffer');
        await writeFile(filePath, new Uint8Array(arrayBuffer));
      }
    } catch (e) {
      console.warn('Tauri dialog failed, falling back to browser save', e);
      doc.save(defaultFileName);
    }
  } catch (err) {
    console.error('PDF Export Error:', err);
    alert('Gagal mengekspor PDF: ' + String(err));
  }
};

export const exportInvoicePDF = async (invoiceData: any) => {
  try {
    const doc = new jsPDF();
    const { invoice_number, date, due_date, contact_name, contact_address, contact_npwp, subtotal, tax_rate, tax_amount, total, status, notes, items, companyName, companyAddress, companyBank, officerName, officerTitle, companyLogo } = invoiceData;

    // Helper for dd/mm/yyyy formatting
    const formatDate = (d: string) => {
      if (!d) return '-';
      const parts = d.split('-');
      if (parts.length === 3) {
        return `${parts[2]}/${parts[1]}/${parts[0]}`;
      }
      return d;
    };

    // Kop Perusahaan & Logo
    let startY = 20;
    if (companyLogo) {
      try {
        // Logo is a base64 string
        doc.addImage(companyLogo, 'PNG', 14, 15, 30, 30);
        
        doc.setFontSize(20);
        doc.setFont('helvetica', 'bold');
        doc.text(companyName || 'Perusahaan', 48, 24);
        
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        if (companyAddress) {
          const addressLines = doc.splitTextToSize(companyAddress, 80);
          doc.text(addressLines, 48, 32);
        }
        startY = 50;
      } catch (e) {
        // fallback if image breaks
        doc.setFontSize(20);
        doc.setFont('helvetica', 'bold');
        doc.text(companyName || 'Perusahaan', 14, 20);
        
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        if (companyAddress) {
          const addressLines = doc.splitTextToSize(companyAddress, 100);
          doc.text(addressLines, 14, 28);
        }
        startY = 35;
      }
    } else {
      doc.setFontSize(20);
      doc.setFont('helvetica', 'bold');
      doc.text(companyName || 'Perusahaan', 14, 20);
      
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      if (companyAddress) {
        const addressLines = doc.splitTextToSize(companyAddress, 100);
        doc.text(addressLines, 14, 28);
      }
      startY = 35;
    }

    // Title INVOICE
    doc.setFontSize(24);
    doc.setFont('helvetica', 'bold');
    doc.text('INVOICE', 140, 20);

    // Invoice Details
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Nomor    : ${invoice_number}`, 140, 30);
    doc.text(`Tanggal  : ${formatDate(date)}`, 140, 35);
    doc.text(`Tempo    : ${formatDate(due_date)}`, 140, 40);
    doc.text(`Status     : ${status}`, 140, 45);

    // Bill To
    doc.setFont('helvetica', 'bold');
    doc.text('Ditagihkan Kepada:', 14, startY + 5);
    doc.setFont('helvetica', 'normal');
    doc.text(contact_name || 'Pelanggan', 14, startY + 11);
    
    let tableStartY = startY + 15;
    if (contact_address) {
      const cAddrLines = doc.splitTextToSize(contact_address, 80);
      doc.text(cAddrLines, 14, startY + 16);
      tableStartY = startY + 16 + (cAddrLines.length * 5);
    }
    if (contact_npwp) {
      doc.text(`NPWP: ${contact_npwp}`, 14, tableStartY);
      tableStartY += 5;
    }

    // Items Table
    const tableData = items.map((item: any, index: number) => [
      index + 1,
      item.description || '-',
      item.quantity,
      `Rp ${Number(item.price).toLocaleString('id-ID')}`,
      `Rp ${Number(item.total).toLocaleString('id-ID')}`
    ]);

    autoTable(doc, {
      startY: Math.max(tableStartY, 65),
      head: [['No', 'Deskripsi', 'Kuantitas', 'Harga Satuan', 'Total']],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: [41, 128, 185] }
    });

    // Totals
    const finalY = (doc as any).lastAutoTable.finalY + 10;
    
    doc.text(`Subtotal : Rp ${Number(subtotal).toLocaleString('id-ID')}`, 140, finalY);
    if (tax_rate !== null && tax_rate !== '') {
      doc.text(`PPN (${tax_rate}%) : Rp ${Number(tax_amount).toLocaleString('id-ID')}`, 140, finalY + 6);
    } else if (tax_amount > 0) {
      doc.text(`PPN : Rp ${Number(tax_amount).toLocaleString('id-ID')}`, 140, finalY + 6);
    }
    
    doc.setFont('helvetica', 'bold');
    doc.text(`TOTAL : Rp ${Number(total).toLocaleString('id-ID')}`, 140, finalY + 14);

    // Notes and Bank Info
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    let noteY = finalY + 20;
    
    if (notes) {
      doc.setFont('helvetica', 'bold');
      doc.text('Catatan & Pembayaran:', 14, noteY);
      doc.setFont('helvetica', 'normal');
      const noteLines = doc.splitTextToSize(notes, 100);
      doc.text(noteLines, 14, noteY + 5);
      noteY += 5 + (noteLines.length * 5);
    }

    if (companyBank) {
      doc.setFont('helvetica', 'bold');
      doc.text('Transfer Bank:', 14, noteY + 5);
      doc.setFont('helvetica', 'normal');
      const bankLines = doc.splitTextToSize(companyBank, 100);
      doc.text(bankLines, 14, noteY + 10);
    }

    // Signature
    if (officerName) {
      const sigY = finalY + 30;
      doc.text('Hormat kami,', 140, sigY);
      doc.setFont('helvetica', 'bold');
      doc.text(officerName, 140, sigY + 20);
      doc.setFont('helvetica', 'normal');
      if (officerTitle) {
        doc.text(officerTitle, 140, sigY + 25);
      }
    }

    const defaultFileName = `Invoice_${invoice_number.replace(/\s+/g, '_')}.pdf`;
    try {
      const filePath = await save({ 
        defaultPath: defaultFileName, 
        filters: [{ name: 'PDF Document', extensions: ['pdf'] }] 
      });
      if (filePath) {
        const arrayBuffer = doc.output('arraybuffer');
        await writeFile(filePath, new Uint8Array(arrayBuffer));
      }
    } catch (e) {
      doc.save(defaultFileName);
    }
  } catch (err) {
    console.error('Invoice PDF Export Error:', err);
    alert('Gagal mengekspor PDF: ' + String(err));
  }
};




export const exportBillPDF = async (billData: any) => {
  try {
    const doc = new jsPDF();
    const { bill_number, date, due_date, contact_name, contact_address, contact_npwp, subtotal, tax_rate, tax_amount, total, status, notes, items, companyName, companyAddress, companyBank, officerName, officerTitle, companyLogo } = billData;

    // Helper for dd/mm/yyyy formatting
    const formatDate = (d: string) => {
      if (!d) return '-';
      const parts = d.split('-');
      if (parts.length === 3) {
        return `${parts[2]}/${parts[1]}/${parts[0]}`;
      }
      return d;
    };

    // Kop Perusahaan & Logo
    let startY = 20;
    if (companyLogo) {
      try {
        // Logo is a base64 string
        doc.addImage(companyLogo, 'PNG', 14, 15, 30, 30);
        
        doc.setFontSize(20);
        doc.setFont('helvetica', 'bold');
        doc.text(companyName || 'Perusahaan', 48, 24);
        
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        if (companyAddress) {
          const addressLines = doc.splitTextToSize(companyAddress, 80);
          doc.text(addressLines, 48, 32);
        }
        startY = 50;
      } catch (e) {
        // fallback if image breaks
        doc.setFontSize(20);
        doc.setFont('helvetica', 'bold');
        doc.text(companyName || 'Perusahaan', 14, 20);
        
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        if (companyAddress) {
          const addressLines = doc.splitTextToSize(companyAddress, 100);
          doc.text(addressLines, 14, 28);
        }
        startY = 35;
      }
    } else {
      doc.setFontSize(20);
      doc.setFont('helvetica', 'bold');
      doc.text(companyName || 'Perusahaan', 14, 20);
      
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      if (companyAddress) {
        const addressLines = doc.splitTextToSize(companyAddress, 100);
        doc.text(addressLines, 14, 28);
      }
      startY = 35;
    }

    // Title TAGIHAN PEMASOK
    doc.setFontSize(24);
    doc.setFont('helvetica', 'bold');
    doc.text('TAGIHAN PEMASOK', 140, 20);

    // TAGIHAN PEMASOK Details
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Nomor    : ${bill_number}`, 140, 30);
    doc.text(`Tanggal  : ${formatDate(date)}`, 140, 35);
    doc.text(`Tempo    : ${formatDate(due_date)}`, 140, 40);
    doc.text(`Status     : ${status}`, 140, 45);

    // Bill To
    doc.setFont('helvetica', 'bold');
    doc.text('Ditagihkan Oleh:', 14, startY + 5);
    doc.setFont('helvetica', 'normal');
    doc.text(contact_name || 'Pemasok', 14, startY + 11);
    
    let tableStartY = startY + 15;
    if (contact_address) {
      const cAddrLines = doc.splitTextToSize(contact_address, 80);
      doc.text(cAddrLines, 14, startY + 16);
      tableStartY = startY + 16 + (cAddrLines.length * 5);
    }
    if (contact_npwp) {
      doc.text(`NPWP: ${contact_npwp}`, 14, tableStartY);
      tableStartY += 5;
    }

    // Items Table
    const tableData = items.map((item: any, index: number) => [
      index + 1,
      item.description || '-',
      item.quantity,
      `Rp ${Number(item.price).toLocaleString('id-ID')}`,
      `Rp ${Number(item.total).toLocaleString('id-ID')}`
    ]);

    autoTable(doc, {
      startY: Math.max(tableStartY, 65),
      head: [['No', 'Deskripsi', 'Kuantitas', 'Harga Satuan', 'Total']],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: [41, 128, 185] }
    });

    // Totals
    const finalY = (doc as any).lastAutoTable.finalY + 10;
    
    doc.text(`Subtotal : Rp ${Number(subtotal).toLocaleString('id-ID')}`, 140, finalY);
    if (tax_rate !== null && tax_rate !== '') {
      doc.text(`PPN (${tax_rate}%) : Rp ${Number(tax_amount).toLocaleString('id-ID')}`, 140, finalY + 6);
    } else if (tax_amount > 0) {
      doc.text(`PPN : Rp ${Number(tax_amount).toLocaleString('id-ID')}`, 140, finalY + 6);
    }
    
    doc.setFont('helvetica', 'bold');
    doc.text(`TOTAL : Rp ${Number(total).toLocaleString('id-ID')}`, 140, finalY + 14);

    // Notes and Bank Info
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    let noteY = finalY + 20;
    
    if (notes) {
      doc.setFont('helvetica', 'bold');
      doc.text('Catatan & Pembayaran:', 14, noteY);
      doc.setFont('helvetica', 'normal');
      const noteLines = doc.splitTextToSize(notes, 100);
      doc.text(noteLines, 14, noteY + 5);
      noteY += 5 + (noteLines.length * 5);
    }

    if (companyBank) {
      doc.setFont('helvetica', 'bold');
      doc.text('Transfer Bank:', 14, noteY + 5);
      doc.setFont('helvetica', 'normal');
      const bankLines = doc.splitTextToSize(companyBank, 100);
      doc.text(bankLines, 14, noteY + 10);
    }

    // Signature
    if (officerName) {
      const sigY = finalY + 30;
      doc.text('Hormat kami,', 140, sigY);
      doc.setFont('helvetica', 'bold');
      doc.text(officerName, 140, sigY + 20);
      doc.setFont('helvetica', 'normal');
      if (officerTitle) {
        doc.text(officerTitle, 140, sigY + 25);
      }
    }

    const defaultFileName = `TAGIHAN PEMASOK_${bill_number.replace(/\s+/g, '_')}.pdf`;
    try {
      const filePath = await save({ 
        defaultPath: defaultFileName, 
        filters: [{ name: 'PDF Document', extensions: ['pdf'] }] 
      });
      if (filePath) {
        const arrayBuffer = doc.output('arraybuffer');
        await writeFile(filePath, new Uint8Array(arrayBuffer));
      }
    } catch (e) {
      doc.save(defaultFileName);
    }
  } catch (err) {
    console.error('TAGIHAN PEMASOK PDF Export Error:', err);
    alert('Gagal mengekspor PDF: ' + String(err));
  }
};




export const exportAssetsExcel = async (assets: any[]) => {
  try {
    const wsData = assets.map(a => ({
      'Kode Aset': a.code || '-',
      'Nama Aset': a.name,
      'Tanggal Beli': a.purchase_date,
      'Harga Beli': a.purchase_price,
      'Umur (Bulan)': a.useful_life_months,
      'Penyusutan/Bulan': (a.purchase_price - a.salvage_value) / a.useful_life_months,
      'Nilai Sisa': a.salvage_value,
      'Status': a.status,
      'Akun Aset': a.asset_account_name
    }));

    const ws = XLSX.utils.json_to_sheet(wsData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Aset Tetap");

    const defaultFileName = "Daftar_Aset_Tetap.xlsx";
    try {
      const filePath = await save({ 
        defaultPath: defaultFileName, 
        filters: [{ name: 'Excel Spreadsheet', extensions: ['xlsx'] }] 
      });
      if (filePath) {
        const arrayBuffer = XLSX.write(wb, { type: "array", bookType: "xlsx" });
        await writeFile(filePath, new Uint8Array(arrayBuffer));
      }
    } catch (e) {
      console.warn('Tauri dialog failed, falling back to browser save', e);
      XLSX.writeFile(wb, defaultFileName);
    }
  } catch (err) {
    console.error('Asset Excel Export Error:', err);
    alert('Gagal mengekspor Excel: ' + String(err));
  }
};
