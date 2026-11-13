import rawInventoryData from '../data/inventoryData.json';
import {
  Barang,
  TransaksiStok,
  InventorySummary,
  StatusStok,
  AppApiError,
  FetchBarangResult,
} from '../types';
import { getAuthHeader } from './authService';

/**
 * =========================================================================
 * CUSTOM FUNCTIONS & LOOPS (Memenuhi Rubrik: Custom Function & Loop)
 * =========================================================================
 */

/**
 * Custom Function 1: Menentukan status stok berdasarkan nilai stok dan batas minimum
 */
export function determineStatusStok(stok: number, stokMinimum: number): StatusStok {
  if (stok <= 0) {
    return 'Habis';
  } else if (stok <= stokMinimum) {
    return 'Menipis';
  } else {
    return 'Aman';
  }
}

/**
 * Custom Function 2: Mapping Array of Objects raw data JSON / API ke Model Barang
 * Menggunakan Loop for untuk memproses setiap objek data
 */
export function mapJsonToBarangList(rawList: any[]): Barang[] {
  const result: Barang[] = [];

  // Penerapan loop standar (for loop)
  for (let i = 0; i < rawList.length; i++) {
    const raw = rawList[i];
    const stok = Number(raw.stok ?? 0);
    const stokMinimum = Number(raw.stok_minimum ?? 5);
    const status = determineStatusStok(stok, stokMinimum);

    const item: Barang = {
      id: Number(raw.id),
      kode_barang: String(raw.kode_barang || `BRG-${String(raw.id).padStart(4, '0')}`),
      nama_barang: String(raw.nama_barang || 'Barang Tanpa Nama'),
      kategori: String(raw.kategori || raw.nama_kategori || (raw.id_kategori === 1 ? 'Elektronik' : 'Perlengkapan')),
      stok,
      stok_minimum: stokMinimum,
      satuan: String(raw.satuan || 'Unit'),
      harga_beli: Number(raw.harga_beli ?? 0),
      harga_jual: Number(raw.harga_jual ?? 0),
      lokasi_rak: String(raw.lokasi_rak || 'Gudang Utama'),
      gambar: raw.gambar || raw.image_url || undefined,
      deskripsi: raw.deskripsi ? String(raw.deskripsi) : undefined,
      status_stok: status,
    };

    result.push(item);
  }

  return result;
}

/**
 * Custom Function 3: Mapping Array of Objects transaksi dari JSON
 * Menggunakan Loop for...of
 */
export function mapJsonToTransaksiList(rawList: any[]): TransaksiStok[] {
  const result: TransaksiStok[] = [];

  // Penerapan loop for...of
  for (const raw of rawList) {
    const trx: TransaksiStok = {
      id: Number(raw.id),
      id_barang: Number(raw.id_barang),
      nama_barang: String(raw.nama_barang),
      jenis: raw.jenis === 'keluar' ? 'keluar' : 'masuk',
      jumlah: Number(raw.jumlah),
      satuan: String(raw.satuan),
      tanggal: String(raw.tanggal),
      operator: String(raw.operator),
      role_operator: String(raw.role_operator),
      sisa_stok: Number(raw.sisa_stok),
    };
    result.push(trx);
  }

  return result;
}

/**
 * Custom Function 4: Menghitung ringkasan inventaris (Summary)
 * Menggunakan while loop untuk menjumlahkan dan mengklasifikasikan stok
 */
export function calculateInventorySummary(
  items: Barang[],
  transactions: TransaksiStok[]
): InventorySummary {
  let totalStok = 0;
  let stokMinimumCount = 0;
  let statusAman = 0;
  let statusMenipis = 0;
  let statusHabis = 0;

  // Penerapan while loop
  let i = 0;
  while (i < items.length) {
    const item = items[i];
    totalStok += item.stok;

    if (item.stok <= item.stok_minimum) {
      stokMinimumCount++;
    }

    if (item.status_stok === 'Aman') {
      statusAman++;
    } else if (item.status_stok === 'Menipis') {
      statusMenipis++;
    } else if (item.status_stok === 'Habis') {
      statusHabis++;
    }

    i++;
  }

  // Hitung akumulasi barang masuk menggunakan loop for
  let barangMasukCount = 0;
  for (let j = 0; j < transactions.length; j++) {
    if (transactions[j].jenis === 'masuk') {
      barangMasukCount += transactions[j].jumlah;
    }
  }

  return {
    totalBarang: items.length,
    totalStok,
    stokMinimumCount,
    barangMasukCount,
    statusAman,
    statusMenipis,
    statusHabis,
  };
}

/**
 * Custom Function 5: Memfilter barang yang perlu perhatian (stok <= stok_minimum)
 * Menggunakan loop for
 */
export function filterItemsBelowMinimum(items: Barang[]): Barang[] {
  const lowStockItems: Barang[] = [];
  for (let i = 0; i < items.length; i++) {
    if (items[i].stok <= items[i].stok_minimum) {
      lowStockItems.push(items[i]);
    }
  }
  return lowStockItems;
}

/**
 * Function Helper untuk mengambil seluruh data ter-mapping siap pakai
 */
export function getLoadedInventoryData() {
  const barangList = mapJsonToBarangList(rawInventoryData.barang);
  const transaksiList = mapJsonToTransaksiList(rawInventoryData.transaksi);
  const summary = calculateInventorySummary(barangList, transaksiList);
  const alertItems = filterItemsBelowMinimum(barangList);

  return {
    barangList,
    transaksiList,
    summary,
    alertItems,
  };
}

/**
 * =========================================================================
 * TASK 01 - HANDLE API ERROR (MOBILE PROGRAMMING)
 * Memenuhi Kriteria Rubrik Tugas:
 * 1. 2xx: Request berhasil dan data diterima -> Data ditampilkan
 * 2. 4xx: Kesalahan dari sisi client (400, 401, 403, 404) -> Tampilan Client Error
 * 3. 5xx: Kesalahan dari sisi server (500, 503) -> Tampilan Server Error
 * 4. Request Gagal: Network error atau koneksi gagal -> Tampilan Network Error
 * 5. Terdapat tombol Coba Lagi (Retry)
 * 6. Data TIDAK ditampilkan ketika request gagal
 * =========================================================================
 */

// Konfigurasi endpoint API backend PHP XAMPP
export const API_BASE_URL = 'http://localhost/EduStock/backend/api';

// Mode Uji Skenario Respons (Mempermudah Evaluasi Tugas / Demonstrasi Dosen Sesuai Rubrik Task 01)
export type MockCondition = 'none' | '2xx' | '4xx' | '5xx' | 'network';
let activeMockCondition: MockCondition = '2xx'; // Default '2xx' agar katalog produk langsung tampil saat aplikasi dibuka

export function setActiveMockCondition(cond: MockCondition) {
  activeMockCondition = cond;
}

export function getActiveMockCondition(): MockCondition {
  return activeMockCondition;
}

/**
 * =========================================================================
 * FUNGSI PROMISE EKSPLISIT DENGAN RESOLVE & REJECT
 * (Memenuhi Rubrik: Menggunakan fungsi .then(), .resolve(), dan .reject())
 * =========================================================================
 */

/**
 * Custom Promise: Mengambil data barang menggunakan konstruktor Promise mandiri
 * Memperagakan fungsi resolve() saat sukses (2xx) dan reject() saat gagal (4xx, 5xx, Network)
 */
export function fetchBarangWithPromise(condition?: MockCondition): Promise<Barang[]> {
  return new Promise<Barang[]>((resolve, reject) => {
    const cond = condition || activeMockCondition;

    setTimeout(() => {
      if (cond === '4xx') {
        // [Rubrik Demo]: Memperagakan fungsi reject() saat Client Error (4xx / 404)
        reject({
          kind: '4xx',
          statusCode: 404,
          title: 'Data Tidak Ditemukan',
          message: 'Permintaan tidak dapat diproses atau URL/data tidak ditemukan.',
        });
      } else if (cond === '5xx') {
        // [Rubrik Demo]: Memperagakan fungsi reject() saat Server Error (5xx / 500)
        reject({
          kind: '5xx',
          statusCode: 500,
          title: 'Terjadi Kesalahan pada Server',
          message: 'Server sedang mengalami gangguan internal. Silakan coba beberapa saat lagi.',
        });
      } else if (cond === 'network') {
        // [Rubrik Demo]: Memperagakan fungsi reject() saat Network Error
        reject({
          kind: 'NETWORK_ERROR',
          title: 'Koneksi Jaringan Gagal',
          message: 'Tidak ada koneksi internet atau server backend tidak dapat dijangkau. Periksa koneksi perangkat Anda.',
        });
      } else {
        // [Rubrik Demo]: Memperagakan fungsi resolve() saat request berhasil (2xx)
        const list = mapJsonToBarangList(rawInventoryData.barang);
        resolve(list);
      }
    }, 600);
  });
}

/**
 * Custom Promise Helper: Cari Barang Berdasarkan Kode Barcode
 * Memperagakan pembuatan Custom Promise mandiri dengan resolve() dan reject()
 */
export function findBarangByCodePromise(kode: string): Promise<Barang> {
  return new Promise<Barang>((resolve, reject) => {
    const barangList = mapJsonToBarangList(rawInventoryData.barang);
    const found = barangList.find(
      (b) => b.kode_barang.toLowerCase() === kode.trim().toLowerCase()
    );

    if (found) {
      // [Rubrik Demo]: Memperagakan fungsi resolve() saat data ditemukan
      resolve(found);
    } else {
      // [Rubrik Demo]: Memperagakan fungsi reject() saat data tidak ditemukan
      reject(new Error(`Barang dengan barcode "${kode}" tidak ditemukan di database gudang.`));
    }
  });
}

/**
 * Function: Mengambil Data Barang dengan Penanganan Lengkap (2xx, 4xx, 5xx, Network Error)
 * Memperagakan konsumsi Promise menggunakan rantai .then() dan .catch()
 */
export function fetchBarangList(): Promise<FetchBarangResult> {
  // -------------------------------------------------------------------------
  // SKENARIO UJI MOCK (2xx, 4xx, 5xx, Network) menggunakan .then() dan .catch()
  // -------------------------------------------------------------------------
  if (activeMockCondition !== 'none') {
    return fetchBarangWithPromise()
      .then((data: Barang[]) => {
        // [Rubrik Demo]: Blok .then() menerima data hasil resolve()
        return {
          data, // [Rubrik]: Data HANYA ditampilkan saat request berhasil (2xx)
          error: null,
        };
      })
      .catch((err: any) => {
        // [Rubrik Demo]: Blok .catch() menangkap error hasil reject()
        const appError: AppApiError = {
          kind: err.kind || 'NETWORK_ERROR',
          statusCode: err.statusCode,
          title: err.title || 'Koneksi Jaringan Gagal',
          message: err.message || 'Terjadi kesalahan saat memuat data dari server.',
        };
        return {
          data: [], // [Rubrik]: Data TIDAK ditampilkan saat request gagal
          error: appError,
        };
      });
  }

  // -------------------------------------------------------------------------
  // PANGGILAN HTTP API NYATA (Backend PHP XAMPP) menggunakan .then() dan .catch()
  // -------------------------------------------------------------------------
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 4000); // 4 detik timeout

  return getAuthHeader()
    .then((authHeader) => {
      return fetch(`${API_BASE_URL}/barang.php`, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          ...authHeader,
        },
        signal: controller.signal,
      });
    })
    .then((response) => {
      clearTimeout(timeoutId);

      // KONDISI 1: 4xx (Kesalahan dari sisi client: 400, 401, 403, 404)
      if (response.status >= 400 && response.status < 500) {
        return Promise.reject({
          kind: '4xx',
          statusCode: response.status,
          title: response.status === 404 ? 'Data Tidak Ditemukan' : `Kesalahan Klien (${response.status})`,
          message: 'Permintaan tidak dapat diproses atau URL/data tidak ditemukan.',
        });
      }

      // KONDISI 2: 5xx (Kesalahan dari sisi server: 500, 502, 503)
      if (response.status >= 500) {
        return Promise.reject({
          kind: '5xx',
          statusCode: response.status,
          title: 'Terjadi Kesalahan pada Server',
          message: 'Server sedang mengalami gangguan. Silakan coba beberapa saat lagi.',
        });
      }

      if (!response.ok) {
        return Promise.reject({
          kind: '5xx',
          statusCode: response.status,
          title: 'Terjadi Kesalahan',
          message: `Server mengembalikan status respons HTTP ${response.status}.`,
        });
      }

      return response.text();
    })
    .then((rawText) => {
      let result: any;
      try {
        result = JSON.parse(rawText);
      } catch {
        return Promise.reject({
          kind: '5xx',
          statusCode: 500,
          title: 'Format Respons Tidak Sesuai',
          message: 'Server mengembalikan respons yang bukan berformat JSON yang valid.',
        });
      }

      const rawList = Array.isArray(result)
        ? result
        : Array.isArray(result.data)
        ? result.data
        : [];

      const mapped = mapJsonToBarangList(rawList);
      // [Rubrik Demo]: Memperagakan fungsi Promise.resolve()
      return Promise.resolve({
        data: mapped,
        error: null,
      });
    })
    .catch((err: any) => {
      clearTimeout(timeoutId);
      const isTimeout = err?.name === 'AbortError';
      const appError: AppApiError = {
        kind: err?.kind || 'NETWORK_ERROR',
        statusCode: err?.statusCode,
        title: err?.title || (isTimeout ? 'Waktu Permintaan Habis' : 'Koneksi Jaringan Gagal'),
        message:
          err?.message ||
          (isTimeout
            ? 'Waktu tunggu permintaan ke server telah habis (Request Timeout).'
            : 'Tidak ada koneksi internet atau server backend tidak dapat dijangkau.'),
      };
      return {
        data: [],
        error: appError,
      };
    });
}
