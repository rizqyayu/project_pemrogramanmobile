import rawInventoryData from '../data/inventoryData.json';
import {
  AuthSession,
  Barang,
  InventorySummary,
  KoreksiStokRequest,
  PresensiLog,
  TransaksiStok,
  User,
  UserRole,
  WarehouseConfig,
} from '../types';
import {
  calculateInventorySummary,
  determineStatusStok,
  filterItemsBelowMinimum,
  mapJsonToBarangList,
  mapJsonToTransaksiList,
} from './dataService';
import { authorizeAction } from './rbacService';

/**
 * =========================================================================
 * SHARED INVENTORY & RBAC-ENFORCED SERVICE STORE
 * Semua aksi mutasi data (stok, koreksi approval, master barang, user,
 * konfigurasi gudang, presensi) harus lolos authorizeAction(session, perm)
 * sebelum mengubah state.
 * =========================================================================
 */

export interface StoreResult<T = unknown> {
  ok: boolean;
  statusCode: 200 | 201 | 400 | 401 | 403 | 404;
  message: string;
  data?: T;
}

export interface InventoryStoreSnapshot {
  barangList: Barang[];
  transaksiList: TransaksiStok[];
  summary: InventorySummary;
  alertItems: Barang[];
  koreksiList: KoreksiStokRequest[];
  managedUsers: User[];
  warehouseConfig: WarehouseConfig;
  presensiLogs: PresensiLog[];
}

// Initial seeded state
let barangState: Barang[] = mapJsonToBarangList(rawInventoryData.barang);
let transaksiState: TransaksiStok[] = mapJsonToTransaksiList(rawInventoryData.transaksi);

// Overlay CRUD katalog untuk item Public API (DummyJSON)
const catalogAdded: Barang[] = [];
const catalogEdited = new Map<number, Partial<Barang>>();
const catalogDeletedIds = new Set<number>();

export function applyCatalogOverrides(apiItems: Barang[]): Barang[] {
  const overlaid = apiItems
    .filter((item) => !catalogDeletedIds.has(item.id))
    .map((item) => {
      const patch = catalogEdited.get(item.id);
      if (!patch) return item;
      const nextMin =
        patch.stok_minimum !== undefined ? Math.max(0, patch.stok_minimum) : item.stok_minimum;
      const nextStok = patch.stok !== undefined ? patch.stok : item.stok;
      return {
        ...item,
        ...patch,
        stok: nextStok,
        stok_minimum: nextMin,
        status_stok: determineStatusStok(nextStok, nextMin),
      };
    });

  return [...catalogAdded, ...overlaid];
}

let koreksiState: KoreksiStokRequest[] = [
  {
    id: 101,
    id_barang: 4,
    kode_barang: 'BRG-0004',
    nama_barang: 'Kamera DSLR Canon EOS 3000D Kit 18-55mm',
    satuan: 'Unit',
    stok_sistem: 4,
    stok_fisik: 5,
    selisih: 1,
    alasan: 'Hasil stock opname Rak A-04 ditemukan 1 unit cadangan studio.',
    diajukan_oleh: 'Dhea Ayu',
    role_pengaju: 'Admin Gudang',
    tanggal_pengajuan: '25 Nov 2026',
    status: 'pending',
  },
];

let managedUsersState: User[] = (rawInventoryData.users as User[]).map((u) => ({
  id: u.id,
  username: u.username,
  name: u.name,
  email: u.email,
  role: u.role,
  aktif: true,
}));

let warehouseConfigState: WarehouseConfig = {
  nama_gudang: 'Gudang Utama EduStock',
  alamat_gudang: 'Jl. Raya Tlogomas No.246, Lowokwaru, Kota Malang, Jawa Timur 65144',
  latitude: -7.920942,
  longitude: 112.598214,
  radius_geofence: 100,
  interval_gps_ms: 2000,
};

let presensiLogsState: PresensiLog[] = [
  {
    id: 1,
    nama: 'Riqzy Ayu',
    role: 'Staff Inventory',
    waktu: '08:05 WIB',
    tanggal: '26 Nov 2026',
    jarak_meter: 12,
    dalam_area: true,
    alamat: 'Jl. Raya Tlogomas No.246, Lowokwaru, Kota Malang',
    koordinat: '-7.920942, 112.598214',
  },
];

const listeners = new Set<() => void>();

function notifyListeners() {
  listeners.forEach((cb) => cb());
}

export function subscribeInventoryStore(cb: () => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

export function getStoreSnapshot(): InventoryStoreSnapshot {
  return {
    barangList: barangState,
    transaksiList: transaksiState,
    summary: calculateInventorySummary(barangState, transaksiState),
    alertItems: filterItemsBelowMinimum(barangState),
    koreksiList: koreksiState,
    managedUsers: managedUsersState,
    warehouseConfig: warehouseConfigState,
    presensiLogs: presensiLogsState,
  };
}

/**
 * 1. Catat Transaksi Stok Masuk / Keluar (Hanya Admin Gudang & Staff Inventory)
 */
export function recordStockMutation(
  session: AuthSession | null,
  params: { id_barang: number; jenis: 'masuk' | 'keluar'; jumlah: number; catatan?: string }
): StoreResult<TransaksiStok> {
  const perm = params.jenis === 'masuk' ? 'stock:masuk' : 'stock:keluar';
  const auth = authorizeAction(session, perm);
  if (!auth.allowed || !session) {
    return {
      ok: false,
      statusCode: auth.statusCode,
      message: auth.reason || 'Akses ditolak.',
    };
  }

  const target = barangState.find((b) => b.id === params.id_barang);
  if (!target) {
    return { ok: false, statusCode: 404, message: 'Barang tidak ditemukan.' };
  }

  if (params.jumlah <= 0) {
    return { ok: false, statusCode: 400, message: 'Jumlah unit harus lebih dari 0.' };
  }

  if (params.jenis === 'keluar' && params.jumlah > target.stok) {
    return {
      ok: false,
      statusCode: 400,
      message: `Stok tidak mencukupi. Tersedia ${target.stok} ${target.satuan}.`,
    };
  }

  const nextStok =
    params.jenis === 'masuk' ? target.stok + params.jumlah : target.stok - params.jumlah;

  barangState = barangState.map((b) =>
    b.id === target.id
      ? { ...b, stok: nextStok, status_stok: determineStatusStok(nextStok, b.stok_minimum) }
      : b
  );

  const todayStr = new Date().toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  const newTrx: TransaksiStok = {
    id: Date.now(),
    id_barang: target.id,
    nama_barang: target.nama_barang,
    jenis: params.jenis,
    jumlah: params.jumlah,
    satuan: target.satuan,
    tanggal: todayStr,
    operator: session.user.name,
    role_operator: session.user.role,
    sisa_stok: nextStok,
    catatan: params.catatan,
  };

  transaksiState = [newTrx, ...transaksiState];
  notifyListeners();

  return {
    ok: true,
    statusCode: 201,
    message: `Transaksi stok ${params.jenis} berhasil dicatat.`,
    data: newTrx,
  };
}

/**
 * 2. Ajukan Koreksi Stok / Stock Opname (Hanya Admin Gudang)
 */
export function submitKoreksiStok(
  session: AuthSession | null,
  params: { id_barang: number; stok_fisik: number; alasan: string }
): StoreResult<KoreksiStokRequest> {
  const auth = authorizeAction(session, 'stock:koreksi_submit');
  if (!auth.allowed || !session) {
    return {
      ok: false,
      statusCode: auth.statusCode,
      message: auth.reason || 'Akses ditolak.',
    };
  }

  const target = barangState.find((b) => b.id === params.id_barang);
  if (!target) {
    return { ok: false, statusCode: 404, message: 'Barang tidak ditemukan.' };
  }

  if (params.stok_fisik < 0) {
    return { ok: false, statusCode: 400, message: 'Stok fisik tidak boleh negatif.' };
  }

  if (!params.alasan.trim()) {
    return { ok: false, statusCode: 400, message: 'Alasan koreksi stok wajib diisi.' };
  }

  const todayStr = new Date().toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  const req: KoreksiStokRequest = {
    id: Date.now(),
    id_barang: target.id,
    kode_barang: target.kode_barang,
    nama_barang: target.nama_barang,
    satuan: target.satuan,
    stok_sistem: target.stok,
    stok_fisik: params.stok_fisik,
    selisih: params.stok_fisik - target.stok,
    alasan: params.alasan.trim(),
    diajukan_oleh: session.user.name,
    role_pengaju: session.user.role,
    tanggal_pengajuan: todayStr,
    status: 'pending',
  };

  koreksiState = [req, ...koreksiState];
  notifyListeners();

  return {
    ok: true,
    statusCode: 201,
    message: 'Pengajuan koreksi stok berhasil dikirim untuk persetujuan Manajer Operasional.',
    data: req,
  };
}

/**
 * 3. Persetujuan Koreksi Stok (Hanya Manajer Operasional)
 */
export function reviewKoreksiStok(
  session: AuthSession | null,
  koreksiId: number,
  decision: 'approved' | 'rejected'
): StoreResult<KoreksiStokRequest> {
  const auth = authorizeAction(session, 'stock:koreksi_approve');
  if (!auth.allowed || !session) {
    return {
      ok: false,
      statusCode: auth.statusCode,
      message: auth.reason || 'Akses ditolak.',
    };
  }

  const req = koreksiState.find((k) => k.id === koreksiId);
  if (!req) {
    return { ok: false, statusCode: 404, message: 'Pengajuan koreksi tidak ditemukan.' };
  }

  if (req.status !== 'pending') {
    return { ok: false, statusCode: 400, message: 'Pengajuan koreksi sudah diproses sebelumnya.' };
  }

  const todayStr = new Date().toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  if (decision === 'approved') {
    const target = barangState.find((b) => b.id === req.id_barang);
    if (target) {
      const nextStok = req.stok_fisik;
      barangState = barangState.map((b) =>
        b.id === target.id
          ? { ...b, stok: nextStok, status_stok: determineStatusStok(nextStok, b.stok_minimum) }
          : b
      );

      const diff = nextStok - req.stok_sistem;
      const newTrx: TransaksiStok = {
        id: Date.now(),
        id_barang: target.id,
        nama_barang: target.nama_barang,
        jenis: diff >= 0 ? 'masuk' : 'keluar',
        jumlah: Math.abs(diff),
        satuan: target.satuan,
        tanggal: todayStr,
        operator: `${session.user.name} (Approval Koreksi)`,
        role_operator: session.user.role,
        sisa_stok: nextStok,
        catatan: `Koreksi stok disetujui: ${req.alasan}`,
      };
      transaksiState = [newTrx, ...transaksiState];
    }
  }

  let updatedReq: KoreksiStokRequest | undefined;
  koreksiState = koreksiState.map((k) => {
    if (k.id === koreksiId) {
      updatedReq = {
        ...k,
        status: decision,
        diputuskan_oleh: session.user.name,
        tanggal_keputusan: todayStr,
      };
      return updatedReq;
    }
    return k;
  });

  notifyListeners();

  return {
    ok: true,
    statusCode: 200,
    message:
      decision === 'approved'
        ? `Koreksi stok "${req.nama_barang}" disetujui dan stok sistem diperbarui.`
        : `Pengajuan koreksi stok "${req.nama_barang}" ditolak.`,
    data: updatedReq,
  };
}

/**
 * 4. CRUD Master Barang (Hanya Admin Gudang)
 */
export function createMasterBarang(
  session: AuthSession | null,
  payload: Omit<Barang, 'id' | 'kode_barang' | 'status_stok'> & { kode_barang?: string }
): StoreResult<Barang> {
  const auth = authorizeAction(session, 'catalog:create');
  if (!auth.allowed) {
    return { ok: false, statusCode: auth.statusCode, message: auth.reason || 'Akses ditolak.' };
  }

  if (!payload.nama_barang.trim()) {
    return { ok: false, statusCode: 400, message: 'Nama barang wajib diisi.' };
  }

  const maxId = Math.max(
    100,
    barangState.reduce((max, b) => Math.max(max, b.id), 0),
    catalogAdded.reduce((max, b) => Math.max(max, b.id), 0)
  );
  const nextId = maxId + 1;
  const kode = payload.kode_barang?.trim() || `BRG-${String(nextId).padStart(4, '0')}`;

  const created: Barang = {
    id: nextId,
    kode_barang: kode,
    nama_barang: payload.nama_barang.trim(),
    kategori: payload.kategori.trim() || 'Lab Komputer',
    stok: Math.max(0, Number(payload.stok) || 0),
    stok_minimum: Math.max(0, Number(payload.stok_minimum) || 5),
    satuan: payload.satuan.trim() || 'Unit',
    harga_beli: Math.max(0, Number(payload.harga_beli) || 0),
    harga_jual: Math.max(0, Number(payload.harga_jual) || 0),
    lokasi_rak: payload.lokasi_rak.trim() || 'Rak A-01',
    gambar: payload.gambar,
    deskripsi: payload.deskripsi,
    status_stok: determineStatusStok(
      Math.max(0, Number(payload.stok) || 0),
      Math.max(0, Number(payload.stok_minimum) || 5)
    ),
  };

  barangState = [created, ...barangState];
  catalogAdded.unshift(created);
  notifyListeners();

  return {
    ok: true,
    statusCode: 201,
    message: `Barang "${created.nama_barang}" berhasil ditambahkan.`,
    data: created,
  };
}

export function updateMasterBarang(
  session: AuthSession | null,
  id: number,
  updates: Partial<Pick<Barang, 'nama_barang' | 'kategori' | 'stok_minimum' | 'lokasi_rak' | 'harga_beli' | 'harga_jual'>>
): StoreResult<Barang> {
  const auth = authorizeAction(session, 'catalog:edit');
  if (!auth.allowed) {
    return { ok: false, statusCode: auth.statusCode, message: auth.reason || 'Akses ditolak.' };
  }

  let updatedItem: Barang | undefined;

  barangState = barangState.map((b) => {
    if (b.id === id) {
      const nextMin =
        updates.stok_minimum !== undefined ? Math.max(0, updates.stok_minimum) : b.stok_minimum;
      updatedItem = {
        ...b,
        ...updates,
        stok_minimum: nextMin,
        status_stok: determineStatusStok(b.stok, nextMin),
      };
      return updatedItem;
    }
    return b;
  });

  const addedIdx = catalogAdded.findIndex((b) => b.id === id);
  if (addedIdx !== -1) {
    const existing = catalogAdded[addedIdx];
    const nextMin =
      updates.stok_minimum !== undefined ? Math.max(0, updates.stok_minimum) : existing.stok_minimum;
    updatedItem = {
      ...existing,
      ...updates,
      stok_minimum: nextMin,
      status_stok: determineStatusStok(existing.stok, nextMin),
    };
    catalogAdded[addedIdx] = updatedItem;
  } else {
    const existingPatch = catalogEdited.get(id) || {};
    catalogEdited.set(id, { ...existingPatch, ...updates });
  }

  notifyListeners();
  return {
    ok: true,
    statusCode: 200,
    message: `Master barang "${updates.nama_barang || updatedItem?.nama_barang || id}" berhasil diperbarui.`,
    data: updatedItem,
  };
}

export function deleteMasterBarang(
  session: AuthSession | null,
  id: number
): StoreResult<void> {
  const auth = authorizeAction(session, 'catalog:delete');
  if (!auth.allowed) {
    return { ok: false, statusCode: auth.statusCode, message: auth.reason || 'Akses ditolak.' };
  }

  const target = barangState.find((b) => b.id === id) || catalogAdded.find((b) => b.id === id);

  barangState = barangState.filter((b) => b.id !== id);
  const addedIdx = catalogAdded.findIndex((b) => b.id === id);
  if (addedIdx !== -1) {
    catalogAdded.splice(addedIdx, 1);
  } else {
    catalogDeletedIds.add(id);
  }
  notifyListeners();

  return {
    ok: true,
    statusCode: 200,
    message: `Barang "${target?.nama_barang || `ID ${id}`}" berhasil dihapus dari katalog.`,
  };
}

/**
 * 5. Manajemen Pengguna & Pengaturan Gudang (Hanya Admin Gudang)
 */
export function toggleUserActiveStatus(
  session: AuthSession | null,
  userId: number
): StoreResult<User> {
  const auth = authorizeAction(session, 'users:manage');
  if (!auth.allowed) {
    return { ok: false, statusCode: auth.statusCode, message: auth.reason || 'Akses ditolak.' };
  }

  let updated: User | undefined;
  managedUsersState = managedUsersState.map((u) => {
    if (u.id === userId) {
      updated = { ...u, aktif: !(u.aktif ?? true) };
      return updated;
    }
    return u;
  });

  if (!updated) {
    return { ok: false, statusCode: 404, message: 'Pengguna tidak ditemukan.' };
  }

  notifyListeners();
  return {
    ok: true,
    statusCode: 200,
    message: `Status akun ${updated.name} diperbarui menjadi ${updated.aktif ? 'Aktif' : 'Nonaktif'}.`,
    data: updated,
  };
}

export function addManagedUser(
  session: AuthSession | null,
  params: { name: string; username: string; email: string; role: UserRole }
): StoreResult<User> {
  const auth = authorizeAction(session, 'users:manage');
  if (!auth.allowed) {
    return { ok: false, statusCode: auth.statusCode, message: auth.reason || 'Akses ditolak.' };
  }

  if (!params.name.trim() || !params.username.trim() || !params.email.trim()) {
    return { ok: false, statusCode: 400, message: 'Nama, username, dan email wajib diisi.' };
  }

  const nextId = managedUsersState.reduce((m, u) => Math.max(m, u.id), 0) + 1;
  const created: User = {
    id: nextId,
    username: params.username.trim().toLowerCase(),
    name: params.name.trim(),
    email: params.email.trim().toLowerCase(),
    role: params.role,
    aktif: true,
  };

  managedUsersState = [...managedUsersState, created];
  notifyListeners();

  return {
    ok: true,
    statusCode: 201,
    message: `Pengguna "${created.name}" (${created.role}) berhasil ditambahkan.`,
    data: created,
  };
}

export function updateWarehouseConfig(
  session: AuthSession | null,
  updates: Partial<WarehouseConfig>
): StoreResult<WarehouseConfig> {
  const auth = authorizeAction(session, 'warehouse:config');
  if (!auth.allowed) {
    return { ok: false, statusCode: auth.statusCode, message: auth.reason || 'Akses ditolak.' };
  }

  warehouseConfigState = {
    ...warehouseConfigState,
    ...updates,
  };
  notifyListeners();

  return {
    ok: true,
    statusCode: 200,
    message: 'Pengaturan gudang & geofence berhasil disimpan.',
    data: warehouseConfigState,
  };
}

/**
 * 6. Catat Presensi GPS Gudang (Admin Gudang & Staff Inventory)
 */
export function recordPresensiGudang(
  session: AuthSession | null,
  params: { jarak_meter: number; dalam_area: boolean; alamat: string; koordinat: string }
): StoreResult<PresensiLog> {
  const auth = authorizeAction(session, 'location:presensi');
  if (!auth.allowed || !session) {
    return { ok: false, statusCode: auth.statusCode, message: auth.reason || 'Akses ditolak.' };
  }

  const now = new Date();
  const waktu = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) + ' WIB';
  const tanggal = now.toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  const log: PresensiLog = {
    id: Date.now(),
    nama: session.user.name,
    role: session.user.role,
    waktu,
    tanggal,
    jarak_meter: params.jarak_meter,
    dalam_area: params.dalam_area,
    alamat: params.alamat,
    koordinat: params.koordinat,
  };

  presensiLogsState = [log, ...presensiLogsState];
  notifyListeners();

  return {
    ok: true,
    statusCode: 201,
    message: `Presensi GPS tercatat untuk ${session.user.name} (${params.dalam_area ? 'Dalam Area' : 'Di Luar Area'}).`,
    data: log,
  };
}
