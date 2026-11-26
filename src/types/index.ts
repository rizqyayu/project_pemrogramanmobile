// ==========================================
// MODELING DATA & TYPES (TypeScript)
// ==========================================

export type UserRole = 'Admin Gudang' | 'Staff Inventory' | 'Pemilik Toko / Manajer';

export interface User {
  id: number;
  username: string;
  password?: string;
  name: string;
  email: string;
  role: UserRole;
  aktif?: boolean;
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
  gambar?: string;
  deskripsi?: string;
  status_stok?: StatusStok;
}

export type JenisTransaksi = 'masuk' | 'keluar' | 'koreksi';

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
  catatan?: string;
}

export type KoreksiStatus = 'pending' | 'approved' | 'rejected';

export interface KoreksiStokRequest {
  id: number;
  id_barang: number;
  kode_barang: string;
  nama_barang: string;
  satuan: string;
  stok_sistem: number;
  stok_fisik: number;
  selisih: number;
  alasan: string;
  diajukan_oleh: string;
  role_pengaju: UserRole;
  tanggal_pengajuan: string;
  status: KoreksiStatus;
  diputuskan_oleh?: string;
  tanggal_keputusan?: string;
}

export interface WarehouseConfig {
  nama_gudang: string;
  alamat_gudang: string;
  latitude: number;
  longitude: number;
  radius_geofence: number;
  interval_gps_ms: number;
}

export interface PresensiLog {
  id: number;
  nama: string;
  role: UserRole;
  waktu: string;
  tanggal: string;
  jarak_meter: number;
  dalam_area: boolean;
  alamat: string;
  koordinat: string;
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
  isDemo?: boolean;
}

export interface LoginResult {
  success: boolean;
  message: string;
  session?: AuthSession;
}

export type Permission =
  | 'dashboard:view'
  | 'catalog:view'
  | 'catalog:create'
  | 'catalog:edit'
  | 'catalog:delete'
  | 'catalog:view_finance'
  | 'category:manage'
  | 'barcode:scan'
  | 'stock:masuk'
  | 'stock:keluar'
  | 'stock:koreksi_submit'
  | 'stock:koreksi_approve'
  | 'transaksi:view_all'
  | 'transaksi:view_own'
  | 'report:view'
  | 'report:export'
  | 'users:manage'
  | 'warehouse:config'
  | 'location:view'
  | 'location:presensi'
  | 'location:geofence_admin'
  | 'staff:monitor'
  | 'demo:switch_role';

export type ApiErrorKind = '4xx' | '5xx' | 'NETWORK_ERROR';

export interface AppApiError {
  kind: ApiErrorKind;
  statusCode?: number;
  title: string;
  message: string;
}

export interface FetchBarangResult {
  data: Barang[];
  error?: AppApiError | null;
}
