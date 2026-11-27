import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { AuthSession, Barang, TransaksiStok } from '../types';
import { determineStatusStok } from './dataService';

/**
 * =========================================================================
 * SUPABASE CLOUD CRUD SERVICE (Modul 4: Postgres Cloud & Row Level Security)
 * Seluruh operasi query dijalankan dengan SDK Supabase (@supabase/supabase-js)
 * dan dilindungi kebijakan RLS berbasis auth.uid() di sisi PostgreSQL.
 * =========================================================================
 */

interface SupabaseBarangRow {
  id: string;
  user_id: string;
  kode_barang: string;
  nama_barang: string;
  kategori: string;
  stok: number;
  stok_minimum: number;
  satuan: string;
  harga_beli: number;
  harga_jual: number;
  lokasi_rak: string;
  gambar?: string | null;
  deskripsi?: string | null;
  created_at: string;
}

interface SupabaseTransaksiRow {
  id: string;
  user_id: string;
  barang_id?: string | null;
  nama_barang: string;
  jenis: 'masuk' | 'keluar' | 'koreksi';
  jumlah: number;
  satuan: string;
  operator: string;
  role_operator: string;
  sisa_stok: number;
  catatan?: string | null;
  created_at: string;
}

function hashUuidToNumber(uuid: string): number {
  let hash = 0;
  for (let i = 0; i < uuid.length; i++) {
    hash = (hash * 31 + uuid.charCodeAt(i)) | 0;
  }
  return Math.abs(hash) || 1;
}

function mapCloudRowToBarang(row: SupabaseBarangRow): Barang {
  const stok = Number(row.stok) || 0;
  const stokMinimum = Number(row.stok_minimum) || 0;
  return {
    id: hashUuidToNumber(row.id),
    cloud_id: row.id,
    user_id: row.user_id,
    kode_barang: row.kode_barang,
    nama_barang: row.nama_barang,
    kategori: row.kategori,
    stok,
    stok_minimum: stokMinimum,
    satuan: row.satuan || 'Unit',
    harga_beli: Number(row.harga_beli) || 0,
    harga_jual: Number(row.harga_jual) || 0,
    lokasi_rak: row.lokasi_rak || 'Rak A-01',
    gambar: row.gambar || undefined,
    deskripsi: row.deskripsi || undefined,
    status_stok: determineStatusStok(stok, stokMinimum),
  };
}

function mapCloudRowToTransaksi(row: SupabaseTransaksiRow): TransaksiStok {
  const formattedDate = new Date(row.created_at).toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
  return {
    id: hashUuidToNumber(row.id),
    id_barang: row.barang_id ? hashUuidToNumber(row.barang_id) : 0,
    nama_barang: row.nama_barang,
    jenis: row.jenis,
    jumlah: Number(row.jumlah) || 0,
    satuan: row.satuan || 'Unit',
    tanggal: formattedDate,
    operator: row.operator,
    role_operator: row.role_operator,
    sisa_stok: Number(row.sisa_stok) || 0,
    catatan: row.catatan || undefined,
  };
}

export function shouldUseCloudDatabase(session: AuthSession | null): boolean {
  return Boolean(isSupabaseConfigured && session && !session.isDemo && session.user.authUid);
}

/**
 * READ (SELECT): Ambil seluruh barang milik user yang sedang login (difilter oleh RLS auth.uid() = user_id)
 */
export async function fetchCloudBarang(): Promise<{ data: Barang[]; error: string | null }> {
  const { data, error } = await supabase
    .from('barang')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    return { data: [], error: error.message };
  }

  const mapped = ((data || []) as SupabaseBarangRow[]).map(mapCloudRowToBarang);
  return { data: mapped, error: null };
}

/**
 * CREATE (INSERT): Tambah barang baru ke PostgreSQL Supabase dengan user_id terautentikasi
 */
export async function createCloudBarang(
  session: AuthSession,
  payload: {
    kode_barang?: string;
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
  }
): Promise<{ data: Barang | null; error: string | null }> {
  const userId = session.user.authUid;
  if (!userId) {
    return { data: null, error: 'User ID Supabase tidak ditemukan pada sesi aktif.' };
  }

  const kode =
    payload.kode_barang?.trim() ||
    `BRG-${String(Math.floor(1000 + Math.random() * 9000))}`;

  const { data, error } = await supabase
    .from('barang')
    .insert([
      {
        user_id: userId,
        kode_barang: kode,
        nama_barang: payload.nama_barang.trim(),
        kategori: payload.kategori.trim() || 'Lab Komputer',
        stok: Math.max(0, payload.stok),
        stok_minimum: Math.max(0, payload.stok_minimum),
        satuan: payload.satuan.trim() || 'Unit',
        harga_beli: Math.max(0, payload.harga_beli),
        harga_jual: Math.max(0, payload.harga_jual),
        lokasi_rak: payload.lokasi_rak.trim() || 'Rak A-01',
        gambar: payload.gambar || null,
        deskripsi: payload.deskripsi || null,
      },
    ])
    .select()
    .single();

  if (error || !data) {
    return { data: null, error: error?.message || 'Gagal menambah barang ke Supabase.' };
  }

  return { data: mapCloudRowToBarang(data as SupabaseBarangRow), error: null };
}

/**
 * UPDATE: Perbarui data barang di PostgreSQL Supabase (dilindungi RLS)
 */
export async function updateCloudBarang(
  cloudId: string,
  updates: Partial<{
    nama_barang: string;
    kategori: string;
    stok: number;
    stok_minimum: number;
    lokasi_rak: string;
    harga_beli: number;
    harga_jual: number;
  }>
): Promise<{ data: Barang | null; error: string | null }> {
  const { data, error } = await supabase
    .from('barang')
    .update(updates)
    .eq('id', cloudId)
    .select()
    .single();

  if (error || !data) {
    return { data: null, error: error?.message || 'Gagal memperbarui barang di Supabase.' };
  }

  return { data: mapCloudRowToBarang(data as SupabaseBarangRow), error: null };
}

/**
 * DELETE: Hapus barang dari PostgreSQL Supabase (dilindungi RLS)
 */
export async function deleteCloudBarang(
  cloudId: string
): Promise<{ ok: boolean; error: string | null }> {
  const { error } = await supabase.from('barang').delete().eq('id', cloudId);

  if (error) {
    return { ok: false, error: error.message };
  }

  return { ok: true, error: null };
}

/**
 * READ (SELECT) Transaksi Cloud milik user aktif
 */
export async function fetchCloudTransaksi(): Promise<{
  data: TransaksiStok[];
  error: string | null;
}> {
  const { data, error } = await supabase
    .from('transaksi')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    return { data: [], error: error.message };
  }

  const mapped = ((data || []) as SupabaseTransaksiRow[]).map(mapCloudRowToTransaksi);
  return { data: mapped, error: null };
}

/**
 * Catat mutasi stok (update stok barang + insert transaksi) di Supabase Cloud
 */
export async function recordCloudStockMutation(
  session: AuthSession,
  params: {
    barang: Barang;
    jenis: 'masuk' | 'keluar';
    jumlah: number;
    catatan?: string;
  }
): Promise<{ ok: boolean; message: string; updatedBarang?: Barang }> {
  const userId = session.user.authUid;
  if (!userId || !params.barang.cloud_id) {
    return { ok: false, message: 'ID barang cloud atau sesi Supabase tidak valid.' };
  }

  if (params.jumlah <= 0) {
    return { ok: false, message: 'Jumlah unit harus lebih dari 0.' };
  }

  if (params.jenis === 'keluar' && params.jumlah > params.barang.stok) {
    return {
      ok: false,
      message: `Stok tidak mencukupi. Tersedia ${params.barang.stok} ${params.barang.satuan}.`,
    };
  }

  const nextStok =
    params.jenis === 'masuk'
      ? params.barang.stok + params.jumlah
      : params.barang.stok - params.jumlah;

  const { data: updatedRow, error: updateErr } = await supabase
    .from('barang')
    .update({ stok: nextStok })
    .eq('id', params.barang.cloud_id)
    .select()
    .single();

  if (updateErr || !updatedRow) {
    return { ok: false, message: updateErr?.message || 'Gagal memperbarui stok di cloud.' };
  }

  const { error: trxErr } = await supabase.from('transaksi').insert([
    {
      user_id: userId,
      barang_id: params.barang.cloud_id,
      nama_barang: params.barang.nama_barang,
      jenis: params.jenis,
      jumlah: params.jumlah,
      satuan: params.barang.satuan,
      operator: session.user.name,
      role_operator: session.user.role,
      sisa_stok: nextStok,
      catatan: params.catatan || null,
    },
  ]);

  if (trxErr) {
    return { ok: false, message: trxErr.message };
  }

  return {
    ok: true,
    message: `Transaksi stok ${params.jenis} tersimpan di Supabase Cloud.`,
    updatedBarang: mapCloudRowToBarang(updatedRow as SupabaseBarangRow),
  };
}
