// ==========================================
// MODELING DATA & TYPES (TypeScript)
// Memenuhi rubrik: "Menerapkan Type & Array of Objects"
// ==========================================

export type UserRole = 'Admin Gudang' | 'Staff Inventory' | 'Pemilik Toko / Manajer';

export interface User {
  id: number;
  username: string;
  password?: string;
  name: string;
  email: string;
  role: UserRole;
}

export type StatusStok = 'Aman' | 'Menipis' | 'Habis';

export interface Barang {
  id: number;
  kode_barang: string;
  nama_barang: string;
  kategori: string;
  stok: number;
  stok_minimum: number;
  satuan: string;
  harga_beli: number;
  harga_jual: number;
  lokasi_rak: string;
  status_stok?: StatusStok;
}

export type JenisTransaksi = 'masuk' | 'keluar';

export interface TransaksiStok {
  id: number;
  id_barang: number;
  nama_barang: string;
  jenis: JenisTransaksi;
  jumlah: number;
  satuan: string;
  tanggal: string;
  operator: string;
  role_operator: string;
  sisa_stok: number;
}

export interface InventorySummary {
  totalBarang: number;
  totalStok: number;
  stokMinimumCount: number;
  barangMasukCount: number;
  statusAman: number;
  statusMenipis: number;
  statusHabis: number;
}

export interface AuthSession {
  user: User;
  token: string;
  expiresAt: string;
}

export interface LoginResult {
  success: boolean;
  message: string;
  session?: AuthSession;
}

