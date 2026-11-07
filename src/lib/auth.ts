// Password hashing untuk Kliimora Cash Pro.
//
// Menggunakan Web Crypto SHA-256 dengan salt acak per-password. Format yang
// disimpan di kolom users.password_hash: "sha256$<saltHex>$<hashHex>".
//
// Nilai legacy (password polos, tanpa "$") tetap diterima oleh verifyPassword
// supaya instalasi lama tidak terkunci; Login meng-upgrade-nya ke hash saat
// login berhasil.

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return toHex(new Uint8Array(digest));
}

/** Hash sebuah password menjadi "sha256$<salt>$<hash>". */
export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const saltHex = toHex(salt);
  const hash = await sha256Hex(saltHex + password);
  return `sha256$${saltHex}$${hash}`;
}

/** True jika nilai tersimpan sudah berupa hash (bukan password polos legacy). */
export function isHashed(stored: string): boolean {
  return typeof stored === 'string' && stored.startsWith('sha256$');
}

/**
 * Verifikasi password terhadap nilai tersimpan. Untuk nilai legacy (polos)
 * dilakukan perbandingan langsung; pemanggilahnya bertanggung jawab meng-upgrade
 * ke hash setelah login berhasil.
 */
export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  if (!isHashed(stored)) {
    return password === stored;
  }
  const parts = stored.split('$');
  if (parts.length !== 3) return false;
  const hash = await sha256Hex(parts[1] + password);
  return hash === parts[2];
}
