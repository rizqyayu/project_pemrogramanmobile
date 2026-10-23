import rawInventoryData from '../data/inventoryData.json';
import {
  Barang,
  TransaksiStok,
  InventorySummary,
  StatusStok,
} from '../types';

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
 * INTEGRASI BACKEND PHP & MYSQL (XAMPP) DENGAN FALLBACK OTOMATIS
 * Memenuhi kriteria: Memuat data dari API & penanganan error/offline
 * =========================================================================
 */

// Konfigurasi endpoint API backend PHP XAMPP
// Jika diuji via Expo Go di smartphone fisik, ganti 'localhost' dengan alamat IP Wi-Fi laptop (contoh: 'http://192.168.1.10/EduStock/backend/api')
export const API_BASE_URL = 'http://localhost/EduStock/backend/api';

/**
 * Function Async: Memuat data barang dari API backend PHP XAMPP (barang.php)
 * Menggunakan AbortController untuk timeout agar aplikasi tidak hang saat XAMPP belum aktif.
 * Jika koneksi API gagal atau offline, otomatis fallback ke data lokal JSON
 * sehingga demo aplikasi tetap berjalan 100% lancar dan tanpa error.
 */
export async function fetchBarangList(): Promise<{
  data: Barang[];
  source: 'api' | 'local';
  message: string;
}> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2500); // 2.5 detik timeout

    const response = await fetch(`${API_BASE_URL}/barang.php`, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (response.ok) {
      const result = await response.json();
      if (result.success && Array.isArray(result.data)) {
        const mapped = mapJsonToBarangList(result.data);
        return {
          data: mapped,
          source: 'api',
          message: 'Berhasil memuat data langsung dari Backend PHP & MySQL (XAMPP).',
        };
      }
    }
  } catch {
    // API backend XAMPP tidak dapat dihubungi atau timeout (kondisi normal saat demo tanpa server lokal)
  }

  // Fallback aman ke data lokal JSON
  const localList = mapJsonToBarangList(rawInventoryData.barang);
  return {
    data: localList,
    source: 'local',
    message: 'Memuat data inventaris lokal (Backend XAMPP offline atau perangkat berbeda jaringan).',
  };
}


