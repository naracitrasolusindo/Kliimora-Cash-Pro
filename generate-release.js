import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

// Konfigurasi
const version = '2.0.2'; // Ganti jika versinya naik
const repoName = 'naracitrasolusindo/Kliimora-Cash-Pro';
const privateKeyPath = 'C:\\Antigravity\\laporan-keuangan\\updater.key';
const privateKeyPassword = 'kliimora2026';

console.log('--- KLIIMORA CASH PRO: RELEASE GENERATOR ---');

// 1. Rename installer agar tidak ada spasi (opsional tapi disarankan)
const bundleDir = path.join(process.cwd(), 'src-tauri', 'target', 'release', 'bundle', 'nsis');
const oldInstallerName = `Kliimora Cash Pro_${version}_x64-setup.exe`;
const newInstallerName = `Kliimora_Cash_Pro_${version}_x64-setup.exe`;
const oldPath = path.join(bundleDir, oldInstallerName);
const newPath = path.join(bundleDir, newInstallerName);

if (fs.existsSync(oldPath)) {
  fs.renameSync(oldPath, newPath);
  console.log(`[1] Berhasil me-rename installer menjadi ${newInstallerName}`);
} else if (fs.existsSync(newPath)) {
  console.log(`[1] Installer sudah bernama ${newInstallerName}`);
} else {
  console.error(`[!] Installer tidak ditemukan di ${bundleDir}. Pastikan Anda sudah menjalankan npm run tauri build.`);
  process.exit(1);
}

// 2. Sign installer menggunakan Tauri CLI
console.log('[2] Membaca signature (tanda tangan)...');
let signature = '';
try {
  // Command untuk men-generate signature via CLI
  const command = `npx tauri signer sign -p "${privateKeyPassword}" -f "${privateKeyPath}" "${newPath}"`;
  execSync(command, { stdio: 'pipe' });
  
  // Baca file .sig yang dihasilkan
  const sigPath = newPath + '.sig';
  if (fs.existsSync(sigPath)) {
    signature = fs.readFileSync(sigPath, 'utf8').trim();
    console.log('[2] Berhasil membuat signature keamanan.');
  } else {
    throw new Error('File .sig tidak ditemukan setelah signing.');
  }
} catch (error) {
  console.error('[!] Gagal membuat signature. Pastikan password dan path updater.key benar.');
  console.error(error.toString());
  process.exit(1);
}

// 3. Buat latest.json
console.log('[3] Menghasilkan file latest.json...');
const latestJson = {
  version: version,
  notes: `Pembaruan v${version} - Kliimora Cash Pro`,
  pub_date: new Date().toISOString(),
  platforms: {
    "windows-x86_64": {
      signature: signature,
      url: `https://github.com/${repoName}/releases/download/v${version}/${newInstallerName}`
    }
  }
};

const latestJsonPath = path.join(bundleDir, 'latest.json');
fs.writeFileSync(latestJsonPath, JSON.stringify(latestJson, null, 2));

console.log('--------------------------------------------------');
console.log('✅ SUKSES! File rilis siap di-upload ke GitHub.');
console.log('Lokasi File:');
console.log(`1. Installer   : ${newPath}`);
console.log(`2. latest.json : ${latestJsonPath}`);
console.log('\nSilakan drag & drop 2 file di atas ke GitHub Releases!');
