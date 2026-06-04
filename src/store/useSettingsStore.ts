import { create } from 'zustand';
import { getDb } from '../lib/db';

interface SettingsState {
  companyName: string;
  companyAddress: string;
  companyBank: string;
  paymentTerms: string;
  officerName: string;
  officerTitle: string;
  companyLogo: string;
  fetchSettings: () => Promise<void>;
  updateSettings: (settings: { companyName: string, companyAddress: string, companyBank: string, paymentTerms: string, officerName: string, officerTitle: string, companyLogo: string }) => Promise<void>;
}

export const useSettingsStore = create<SettingsState>((set) => ({
  companyName: 'Perusahaan Anda',
  companyAddress: 'Jl. Contoh Alamat No. 123',
  companyBank: 'BCA - 1234567890 a/n Perusahaan Anda',
  paymentTerms: 'Pembayaran maksimal 14 hari kerja setelah invoice diterima.',
  officerName: 'Pimpinan Perusahaan',
  officerTitle: 'Direktur',
  companyLogo: '',
  fetchSettings: async () => {
    try {
      const db = await getDb();
      const rows = await db.select<{key: string, value: string}[]>('SELECT * FROM settings');
      const settingsMap: Record<string, string> = {};
      rows.forEach(r => settingsMap[r.key] = r.value);
      
      set({ 
        companyName: settingsMap['company_name'] || 'Perusahaan Anda',
        companyAddress: settingsMap['company_address'] || 'Jl. Contoh Alamat No. 123',
        companyBank: settingsMap['company_bank'] || 'BCA - 1234567890 a/n Perusahaan Anda',
        paymentTerms: settingsMap['payment_terms'] || 'Pembayaran maksimal 14 hari kerja setelah invoice diterima.',
        officerName: settingsMap['officer_name'] || 'Pimpinan Perusahaan',
        officerTitle: settingsMap['officer_title'] || 'Direktur',
        companyLogo: settingsMap['company_logo'] || '',
      });
    } catch (e) {
      console.error('Failed to load settings', e);
    }
  },
  updateSettings: async (settings) => {
    try {
      const db = await getDb();
      await db.execute('INSERT OR REPLACE INTO settings (key, value) VALUES ($1, $2)', ['company_name', settings.companyName]);
      await db.execute('INSERT OR REPLACE INTO settings (key, value) VALUES ($1, $2)', ['company_address', settings.companyAddress]);
      await db.execute('INSERT OR REPLACE INTO settings (key, value) VALUES ($1, $2)', ['company_bank', settings.companyBank]);
      await db.execute('INSERT OR REPLACE INTO settings (key, value) VALUES ($1, $2)', ['payment_terms', settings.paymentTerms]);
      await db.execute('INSERT OR REPLACE INTO settings (key, value) VALUES ($1, $2)', ['officer_name', settings.officerName]);
      await db.execute('INSERT OR REPLACE INTO settings (key, value) VALUES ($1, $2)', ['officer_title', settings.officerTitle]);
      await db.execute('INSERT OR REPLACE INTO settings (key, value) VALUES ($1, $2)', ['company_logo', settings.companyLogo]);
      
      set(settings);
    } catch (e) {
      console.error('Failed to save settings', e);
    }
  }
}));
