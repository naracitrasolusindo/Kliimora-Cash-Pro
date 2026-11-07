import Database from '@tauri-apps/plugin-sql';
import { hashPassword } from './auth';

export const COA_PSAK = [
  // Aset (Assets)
  { code: '1101', name: 'Kas dan Setara Kas', type: 'asset' },
  { code: '1102', name: 'Piutang Usaha', type: 'asset' },
  { code: '1103', name: 'Persediaan', type: 'asset' },
  { code: '1104', name: 'Biaya Dibayar Di Muka', type: 'asset' },
  { code: '1201', name: 'Aset Tetap - Peralatan', type: 'asset' },
  { code: '1202', name: 'Akum. Penyusutan - Peralatan', type: 'asset' },
  { code: '1203', name: 'Aset Tetap - Kendaraan', type: 'asset' },
  { code: '1204', name: 'Akum. Penyusutan - Kendaraan', type: 'asset' },
  { code: '1205', name: 'Aset Tetap - Gedung', type: 'asset' },
  { code: '1206', name: 'Akum. Penyusutan - Gedung', type: 'asset' },
  
  // Kewajiban (Liabilities)
  { code: '2101', name: 'Hutang Usaha', type: 'liability' },
  { code: '2102', name: 'Beban Masih Harus Dibayar', type: 'liability' },
  { code: '2103', name: 'Pendapatan Diterima Di Muka', type: 'liability' },
  { code: '2201', name: 'Hutang Bank Jangka Panjang', type: 'liability' },
  
  // Ekuitas (Equity)
  { code: '3101', name: 'Modal Saham / Modal Pemilik', type: 'equity' },
  { code: '3102', name: 'Prive Pemilik', type: 'equity' },
  { code: '3201', name: 'Laba Ditahan', type: 'equity' },
  
  // Pendapatan (Revenue)
  { code: '4101', name: 'Pendapatan Penjualan', type: 'revenue' },
  { code: '4102', name: 'Pendapatan Jasa', type: 'revenue' },
  { code: '4201', name: 'Pendapatan Bunga', type: 'revenue' },
  
  // Beban (Expense)
  { code: '5101', name: 'Beban Pokok Penjualan (HPP)', type: 'expense' },
  { code: '5201', name: 'Beban Gaji dan Upah', type: 'expense' },
  { code: '5202', name: 'Beban Sewa', type: 'expense' },
  { code: '5203', name: 'Beban Listrik, Air, Telepon', type: 'expense' },
  { code: '5204', name: 'Beban Penyusutan - Peralatan', type: 'expense' },
  { code: '5205', name: 'Beban Penyusutan - Kendaraan', type: 'expense' },
  { code: '5206', name: 'Beban Penyusutan - Gedung', type: 'expense' },
  { code: '5207', name: 'Beban Administrasi Bank', type: 'expense' },
];

let dbInstance: Database | null = null;

export async function getDb(): Promise<Database> {
  if (!dbInstance) {
    const customPath = localStorage.getItem('kliimora_db_path');
    const dbPath = customPath ? `sqlite:${customPath}` : 'sqlite:laporan_keuangan.db';
    dbInstance = await Database.load(dbPath);
  }
  return dbInstance;
}

export async function reloadDbConnection() {
  dbInstance = null;
  return await initDbAndSeed();
}

async function addColumnIfNotExists(db: Database, table: string, columnDef: string) {
  try {
    await db.execute(`ALTER TABLE ${table} ADD COLUMN ${columnDef}`);
  } catch {
    // Abaikan error jika kolom sudah ada
  }
}

export async function initDbAndSeed() {
  const db = await getDb();
  
  // 1. Eksekusi Schema Tables
  const schemas = [
    `CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL, role TEXT NOT NULL)`,
    `CREATE TABLE IF NOT EXISTS accounts (id INTEGER PRIMARY KEY AUTOINCREMENT, code TEXT NOT NULL UNIQUE, name TEXT NOT NULL, type TEXT NOT NULL, initial_balance REAL DEFAULT 0.0)`,
    `CREATE TABLE IF NOT EXISTS journal_entries (id INTEGER PRIMARY KEY AUTOINCREMENT, date TEXT NOT NULL, description TEXT NOT NULL, reference TEXT, is_closing INTEGER DEFAULT 0)`,
    `CREATE TABLE IF NOT EXISTS contacts (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, type TEXT NOT NULL, phone TEXT, email TEXT, address TEXT, npwp TEXT)`,
    `CREATE TABLE IF NOT EXISTS journal_lines (id INTEGER PRIMARY KEY AUTOINCREMENT, entry_id INTEGER NOT NULL, account_id INTEGER NOT NULL, debit REAL DEFAULT 0.0, credit REAL DEFAULT 0.0, contact_id INTEGER, is_reconciled INTEGER DEFAULT 0, recon_id INTEGER, FOREIGN KEY(entry_id) REFERENCES journal_entries(id) ON DELETE CASCADE, FOREIGN KEY(account_id) REFERENCES accounts(id), FOREIGN KEY(contact_id) REFERENCES contacts(id))`,
    `CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT)`,
    `CREATE TABLE IF NOT EXISTS bank_reconciliations (id INTEGER PRIMARY KEY AUTOINCREMENT, account_id INTEGER NOT NULL, statement_date TEXT NOT NULL, statement_balance REAL NOT NULL, reconciled_balance REAL NOT NULL, status TEXT NOT NULL, FOREIGN KEY(account_id) REFERENCES accounts(id))`,
    `CREATE TABLE IF NOT EXISTS products (id INTEGER PRIMARY KEY AUTOINCREMENT, code TEXT UNIQUE, name TEXT NOT NULL, description TEXT, price REAL DEFAULT 0, stock INTEGER DEFAULT 0)`,
    `CREATE TABLE IF NOT EXISTS invoices (id INTEGER PRIMARY KEY AUTOINCREMENT, invoice_number TEXT NOT NULL UNIQUE, date TEXT NOT NULL, due_date TEXT, contact_id INTEGER, subtotal REAL DEFAULT 0, tax_rate REAL, tax_amount REAL DEFAULT 0, total REAL DEFAULT 0, status TEXT DEFAULT 'DRAFT', notes TEXT, FOREIGN KEY(contact_id) REFERENCES contacts(id))`,
    `CREATE TABLE IF NOT EXISTS invoice_items (id INTEGER PRIMARY KEY AUTOINCREMENT, invoice_id INTEGER NOT NULL, product_id INTEGER, description TEXT, quantity INTEGER DEFAULT 1, price REAL DEFAULT 0, total REAL DEFAULT 0, FOREIGN KEY(invoice_id) REFERENCES invoices(id) ON DELETE CASCADE, FOREIGN KEY(product_id) REFERENCES products(id))`,
    `CREATE TABLE IF NOT EXISTS budgets (id INTEGER PRIMARY KEY AUTOINCREMENT, account_id INTEGER NOT NULL, period_month INTEGER NOT NULL, period_year INTEGER NOT NULL, amount REAL DEFAULT 0, FOREIGN KEY(account_id) REFERENCES accounts(id), UNIQUE(account_id, period_month, period_year))`,
    `CREATE TABLE IF NOT EXISTS fixed_assets (id INTEGER PRIMARY KEY AUTOINCREMENT, code TEXT UNIQUE, name TEXT NOT NULL, description TEXT, purchase_date TEXT NOT NULL, purchase_price REAL NOT NULL, useful_life_months INTEGER NOT NULL, salvage_value REAL DEFAULT 0, asset_account_id INTEGER, accum_dep_account_id INTEGER, dep_expense_account_id INTEGER, status TEXT DEFAULT 'ACTIVE', FOREIGN KEY(asset_account_id) REFERENCES accounts(id), FOREIGN KEY(accum_dep_account_id) REFERENCES accounts(id), FOREIGN KEY(dep_expense_account_id) REFERENCES accounts(id))`,
    `CREATE TABLE IF NOT EXISTS bills (id INTEGER PRIMARY KEY AUTOINCREMENT, bill_number TEXT NOT NULL UNIQUE, date TEXT NOT NULL, due_date TEXT, contact_id INTEGER, subtotal REAL DEFAULT 0, tax_rate REAL, tax_amount REAL DEFAULT 0, total REAL DEFAULT 0, status TEXT DEFAULT 'UNPAID', notes TEXT, FOREIGN KEY(contact_id) REFERENCES contacts(id))`,
    `CREATE TABLE IF NOT EXISTS bill_items (id INTEGER PRIMARY KEY AUTOINCREMENT, bill_id INTEGER NOT NULL, description TEXT, quantity INTEGER DEFAULT 1, price REAL DEFAULT 0, total REAL DEFAULT 0, account_id INTEGER, product_id INTEGER, FOREIGN KEY(bill_id) REFERENCES bills(id) ON DELETE CASCADE, FOREIGN KEY(account_id) REFERENCES accounts(id), FOREIGN KEY(product_id) REFERENCES products(id))`
  ];

  for (const sql of schemas) {
    await db.execute(sql);
  }

  // 2. Eksekusi Alter Tables (Migrasi kolom dinamis)
  await addColumnIfNotExists(db, 'journal_lines', 'contact_id INTEGER');
  await addColumnIfNotExists(db, 'journal_entries', 'is_closing INTEGER DEFAULT 0');
  await addColumnIfNotExists(db, 'journal_lines', 'is_reconciled INTEGER DEFAULT 0');
  await addColumnIfNotExists(db, 'journal_lines', 'recon_id INTEGER');
  await addColumnIfNotExists(db, 'contacts', 'npwp TEXT');
  await addColumnIfNotExists(db, 'bill_items', 'product_id INTEGER');

  // 3. Cek & Insert Admin
  await db.execute(
    'INSERT OR IGNORE INTO users (username, password_hash, role) VALUES (?, ?, ?)',
    ['admin', await hashPassword('admin123'), 'admin']
  );

  // 4. Default Settings
  await db.execute(
    `INSERT OR IGNORE INTO settings (key, value) VALUES 
    ('company_name', 'Perusahaan Anda'),
    ('company_address', 'Jl. Contoh Alamat No. 123'),
    ('company_bank', 'BCA - 1234567890 a/n Perusahaan Anda'),
    ('payment_terms', 'Pembayaran maksimal 14 hari kerja setelah invoice diterima.')`
  );

  // 5. Cek & Insert COA (Gunakan INSERT OR IGNORE agar COA baru otomatis ditambahkan)
  for (const acc of COA_PSAK) {
    await db.execute(
      'INSERT OR IGNORE INTO accounts (code, name, type, initial_balance) VALUES (?, ?, ?, ?)',
      [acc.code, acc.name, acc.type, 0.0]
    );
  }

  return db;
}
