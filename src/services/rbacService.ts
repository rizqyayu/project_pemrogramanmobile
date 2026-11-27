import { AuthSession, Permission, TransaksiStok, UserRole } from '../types';
import { decodeToken } from './authService';

/**
 * =========================================================================
 * RBAC POLICY ENGINE (src/services/rbacService.ts)
 * Satu sumber kebenaran untuk otorisasi role, verifikasi token JWT,
 * pembatasan route, dan validasi aksi pada service layer.
 * =========================================================================
 */

export const ROLE_PERMISSIONS: Record<UserRole, readonly Permission[]> = {
  'Admin Gudang': [
    'dashboard:view',
    'catalog:view',
    'catalog:create',
    'catalog:edit',
    'catalog:delete',
    'catalog:view_finance',
    'category:manage',
    'barcode:scan',
    'stock:masuk',
    'stock:keluar',
    'stock:koreksi_submit',
    'transaksi:view_all',
    'report:view',
    'report:export',
    'users:manage',
    'warehouse:config',
    'location:view',
    'location:presensi',
    'location:geofence_admin',
    'staff:monitor',
    'demo:switch_role',
  ],
  'Staff Inventory': [
    'dashboard:view',
    'catalog:view',
    'barcode:scan',
    'stock:masuk',
    'stock:keluar',
    'transaksi:view_own',
    'location:view',
    'location:presensi',
    'demo:switch_role',
  ],
  'Pemilik Toko / Manajer': [
    'dashboard:view',
    'catalog:view',
    'catalog:view_finance',
    'stock:koreksi_approve',
    'transaksi:view_all',
    'report:view',
    'report:export',
    'location:view',
    'staff:monitor',
    'demo:switch_role',
  ],
};

export const PERMISSION_LABELS: Record<Permission, string> = {
  'dashboard:view': 'mengakses Dashboard',
  'catalog:view': 'melihat Katalog Barang',
  'catalog:create': 'menambah Master Barang',
  'catalog:edit': 'mengubah Master Barang',
  'catalog:delete': 'menghapus Master Barang',
  'catalog:view_finance': 'melihat Harga Beli & Margin',
  'category:manage': 'mengelola Kategori Barang',
  'barcode:scan': 'menggunakan Scanner Barcode',
  'stock:masuk': 'mencatat Stok Masuk',
  'stock:keluar': 'mencatat Stok Keluar',
  'stock:koreksi_submit': 'mengajukan Koreksi Stok',
  'stock:koreksi_approve': 'menyetujui/menolak Koreksi Stok',
  'transaksi:view_all': 'melihat semua riwayat mutasi stok',
  'transaksi:view_own': 'melihat riwayat mutasi pribadi',
  'report:view': 'melihat Laporan & Valuasi Stok',
  'report:export': 'mengunduh Laporan Inventaris',
  'users:manage': 'mengelola Pengguna & Peran',
  'warehouse:config': 'mengubah Pengaturan Gudang',
  'location:view': 'melihat Lokasi & Presensi Gudang',
  'location:presensi': 'melakukan Presensi GPS Gudang',
  'location:geofence_admin': 'mengubah konfigurasi Geofence & Simulasi',
  'staff:monitor': 'memantau aktivitas & presensi staff',
  'demo:switch_role': 'mengganti peran pada mode demo',
};

export interface AuthorizationResult {
  allowed: boolean;
  statusCode: 200 | 401 | 403;
  reason?: string;
}

/**
 * Verifikasi penuh: validasi session, keaslian payload token JWT, masa berlaku token,
 * kesesuaian role token vs user state, dan izin RBAC.
 */
export function authorizeAction(
  session: AuthSession | null,
  permission: Permission
): AuthorizationResult {
  if (!session || !session.token || !session.user) {
    return {
      allowed: false,
      statusCode: 401,
      reason: 'Sesi autentikasi tidak ditemukan. Silakan masuk terlebih dahulu.',
    };
  }

  const decoded = decodeToken(session.token);
  // Pada Supabase JWT, klaim role tingkat atas bernilai 'authenticated', sedangkan role aplikasi berada di user_metadata.role
  const tokenRole =
    decoded?.user_metadata?.role ||
    (decoded?.role && decoded.role !== 'authenticated' ? decoded.role : undefined) ||
    session.user.role;

  if (!decoded || !tokenRole) {
    return {
      allowed: false,
      statusCode: 401,
      reason: 'Token JWT tidak valid. Akses ditolak.',
    };
  }

  if (typeof decoded.exp === 'number' && decoded.exp * 1000 < Date.now()) {
    return {
      allowed: false,
      statusCode: 401,
      reason: 'Token autentikasi telah kedaluwarsa. Silakan login kembali.',
    };
  }

  // Pastikan role di state lokal sinkron dengan klaim role di token JWT
  if (tokenRole !== session.user.role) {
    return {
      allowed: false,
      statusCode: 403,
      reason: 'Ketidaksesuaian klaim peran pada token autentikasi.',
    };
  }

  // Cegah pergantian peran bebas pada akun non-demo/produksi
  if (permission === 'demo:switch_role') {
    const isDemo = session.isDemo === true && decoded.isDemo === true;
    if (!isDemo) {
      return {
        allowed: false,
        statusCode: 403,
        reason:
          'Ganti Peran (Demo) dinonaktifkan pada sesi akun reguler/produksi. Gunakan tombol Keluar untuk berganti akun.',
      };
    }
  }

  const role = tokenRole as UserRole;
  const allowedList = ROLE_PERMISSIONS[role] || [];

  if (!allowedList.includes(permission)) {
    return {
      allowed: false,
      statusCode: 403,
      reason: `Akses ditolak (403): Peran "${role}" tidak berwenang untuk ${PERMISSION_LABELS[permission]}.`,
    };
  }

  return { allowed: true, statusCode: 200 };
}

export function hasPermission(
  session: AuthSession | null,
  permission: Permission
): boolean {
  return authorizeAction(session, permission).allowed;
}

/**
 * Filter riwayat transaksi sesuai scope kewenangan role:
 * - Admin Gudang & Manajer: semua transaksi
 * - Staff Inventory: HANYA transaksi milik dirinya sendiri
 */
export function getScopedTransaksiList(
  transaksiList: TransaksiStok[],
  session: AuthSession | null
): TransaksiStok[] {
  if (!session) return [];
  if (hasPermission(session, 'transaksi:view_all')) {
    return transaksiList;
  }
  if (hasPermission(session, 'transaksi:view_own')) {
    return transaksiList.filter(
      (trx) =>
        trx.operator.toLowerCase() === session.user.name.toLowerCase() ||
        trx.role_operator === session.user.role
    );
  }
  return [];
}

export function getRoleShortTitle(role: UserRole): string {
  if (role === 'Pemilik Toko / Manajer') return 'Manajer Operasional';
  return role;
}
