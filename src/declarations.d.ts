// Deklarasi ambient untuk deep-import ikon MUI.
//
// @mui/icons-material v9 tidak menyertakan .d.ts per-file untuk path seperti
// '@mui/icons-material/Delete', sehingga tsc memunculkan TS7016. Deep-import
// dipertahankan demi tree-shaking bundel; ikon ditipisasi sebagai any (komponen
// SVG React). Kalau nanti butuh tipe ketat, ganti dengan:
//   import { Delete } from '@mui/icons-material';
// (barrel punya tipe, tapi membundel semua ikon).
declare module '@mui/icons-material/*';
