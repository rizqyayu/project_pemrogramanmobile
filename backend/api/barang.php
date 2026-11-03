<?php
/**
 * =========================================================================
 * ENDPOINT API: DAFTAR & MANAJEMEN BARANG
 * File: backend/api/barang.php
 * Method: GET, POST
 * =========================================================================
 */

require_once __DIR__ . '/config.php';

$pdo = getDbConnection();
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

// =========================================================================
// METHOD GET: Mengambil Data Barang (Semua / Filter / Search / Detail)
// =========================================================================
if ($method === 'GET') {
    // 1. Jika Database MySQL terhubung
    if ($pdo !== null) {
        try {
            $id = isset($_GET['id']) ? (int)$_GET['id'] : null;
            $kode = isset($_GET['kode']) ? trim($_GET['kode']) : null;
            $search = isset($_GET['search']) ? trim($_GET['search']) : null;
            $kategori = isset($_GET['kategori']) ? trim($_GET['kategori']) : null;

            // Kasus A: Ambil 1 barang berdasarkan ID
            if ($id !== null && $id > 0) {
                $stmt = $pdo->prepare("SELECT * FROM barang WHERE id = :id LIMIT 1");
                $stmt->execute([':id' => $id]);
                $item = $stmt->fetch();

                if (!$item) {
                    sendJsonResponse(false, "Barang dengan ID {$id} tidak ditemukan.", null, 404);
                }

                $item['id'] = (int)$item['id'];
                $item['stok'] = (int)$item['stok'];
                $item['stok_minimum'] = (int)$item['stok_minimum'];
                $item['harga_beli'] = (float)$item['harga_beli'];
                $item['harga_jual'] = (float)$item['harga_jual'];

                sendJsonResponse(true, "Detail barang berhasil diambil.", $item);
            }

            // Kasus B: Ambil 1 barang berdasarkan Kode (Cocok untuk Scanner Barcode)
            if ($kode !== null && $kode !== '') {
                $stmt = $pdo->prepare("SELECT * FROM barang WHERE LOWER(kode_barang) = LOWER(:kode) LIMIT 1");
                $stmt->execute([':kode' => $kode]);
                $item = $stmt->fetch();

                if (!$item) {
                    sendJsonResponse(false, "Barang dengan kode '{$kode}' tidak ditemukan.", null, 404);
                }

                $item['id'] = (int)$item['id'];
                $item['stok'] = (int)$item['stok'];
                $item['stok_minimum'] = (int)$item['stok_minimum'];
                $item['harga_beli'] = (float)$item['harga_beli'];
                $item['harga_jual'] = (float)$item['harga_jual'];

                sendJsonResponse(true, "Barang hasil scan barcode ditemukan.", $item);
            }

            // Kasus C: Daftar Banyak Barang (dengan opsional search & filter kategori)
            $sql = "SELECT * FROM barang WHERE 1=1";
            $params = [];

            if ($kategori !== null && $kategori !== '' && $kategori !== 'Semua') {
                $sql .= " AND kategori = :kategori";
                $params[':kategori'] = $kategori;
            }

            if ($search !== null && $search !== '') {
                $sql .= " AND (nama_barang LIKE :search OR kode_barang LIKE :search OR lokasi_rak LIKE :search OR deskripsi LIKE :search)";
                $params[':search'] = "%{$search}%";
            }

            $sql .= " ORDER BY id ASC";

            $stmt = $pdo->prepare($sql);
            $stmt->execute($params);
            $rows = $stmt->fetchAll();

            // Format data numerik dan atribut lengkap
            $barangList = array_map(function ($row) {
                return [
                    'id'           => (int)$row['id'],
                    'kode_barang'  => (string)$row['kode_barang'],
                    'nama_barang'  => (string)$row['nama_barang'],
                    'kategori'     => (string)$row['kategori'],
                    'stok'         => (int)$row['stok'],
                    'stok_minimum' => (int)$row['stok_minimum'],
                    'satuan'       => (string)$row['satuan'],
                    'harga_beli'   => (float)$row['harga_beli'],
                    'harga_jual'   => (float)$row['harga_jual'],
                    'lokasi_rak'   => (string)$row['lokasi_rak'],
                    'gambar'       => isset($row['gambar']) && !empty($row['gambar']) ? (string)$row['gambar'] : null,
                    'deskripsi'    => isset($row['deskripsi']) ? (string)$row['deskripsi'] : '',
                ];
            }, $rows);

            sendJsonResponse(true, "Berhasil memuat data dari database MySQL.", $barangList);

        } catch (PDOException $e) {
            sendJsonResponse(false, "Terjadi kesalahan kueri database: " . $e->getMessage(), null, 500);
        }
    }

    // 2. Fallback Otomatis: Jika MySQL belum di-import/aktif, baca dari file JSON
    $jsonPath = __DIR__ . '/../../src/data/inventoryData.json';
    if (!file_exists($jsonPath)) {
        // Coba jalur alternatif jika dipindah ke htdocs/EduStock/backend/api/
        $jsonPath = __DIR__ . '/inventoryData.json';
    }

    if (file_exists($jsonPath)) {
        $raw = file_get_contents($jsonPath);
        $decoded = json_decode($raw, true);
        if (isset($decoded['barang']) && is_array($decoded['barang'])) {
            sendJsonResponse(
                true,
                "Berhasil memuat data inventaris (Mode Cadangan JSON PHP).",
                $decoded['barang']
            );
        }
    }

    // Jika MySQL tidak aktif dan file JSON tidak ditemukan
    sendJsonResponse(
        false,
        "Database MySQL 'edustock' belum terhubung dan data JSON tidak ditemukan. Pastikan MySQL di XAMPP sudah aktif.",
        null,
        500
    );
}

// =========================================================================
// METHOD POST: Menambahkan Barang Baru ke Database
// =========================================================================
if ($method === 'POST') {
    if ($pdo === null) {
        sendJsonResponse(false, "Koneksi database MySQL diperlukan untuk menambah barang.", null, 500);
    }

    // Ambil payload JSON dari body request
    $rawInput = file_get_contents('php://input');
    $input = json_decode($rawInput, true);

    if (!is_array($input)) {
        $input = $_POST;
    }

    // Validasi field wajib
    $nama_barang = isset($input['nama_barang']) ? trim($input['nama_barang']) : '';
    $kategori = isset($input['kategori']) ? trim($input['kategori']) : 'Lab Komputer';
    $stok = isset($input['stok']) ? (int)$input['stok'] : 0;
    $stok_minimum = isset($input['stok_minimum']) ? (int)$input['stok_minimum'] : 5;
    $satuan = isset($input['satuan']) ? trim($input['satuan']) : 'Unit';
    $harga_beli = isset($input['harga_beli']) ? (float)$input['harga_beli'] : 0;
    $harga_jual = isset($input['harga_jual']) ? (float)$input['harga_jual'] : 0;
    $lokasi_rak = isset($input['lokasi_rak']) ? trim($input['lokasi_rak']) : 'Gudang Utama';
    $gambar = isset($input['gambar']) ? trim($input['gambar']) : '';
    $deskripsi = isset($input['deskripsi']) ? trim($input['deskripsi']) : '';

    if ($nama_barang === '') {
        sendJsonResponse(false, "Nama barang wajib diisi.", null, 400);
    }

    // Generate kode_barang otomatis jika tidak disediakan (contoh: BRG-0011)
    $kode_barang = isset($input['kode_barang']) ? trim($input['kode_barang']) : '';
    if ($kode_barang === '') {
        $stmtMax = $pdo->query("SELECT MAX(id) as max_id FROM barang");
        $maxRow = $stmtMax->fetch();
        $nextId = ((int)($maxRow['max_id'] ?? 0)) + 1;
        $kode_barang = 'BRG-' . str_pad($nextId, 4, '0', STR_PAD_LEFT);
    }

    try {
        $stmt = $pdo->prepare("
            INSERT INTO barang (kode_barang, nama_barang, kategori, stok, stok_minimum, satuan, harga_beli, harga_jual, lokasi_rak, gambar, deskripsi)
            VALUES (:kode_barang, :nama_barang, :kategori, :stok, :stok_minimum, :satuan, :harga_beli, :harga_jual, :lokasi_rak, :gambar, :deskripsi)
        ");

        $stmt->execute([
            ':kode_barang'  => $kode_barang,
            ':nama_barang'  => $nama_barang,
            ':kategori'     => $kategori,
            ':stok'         => $stok,
            ':stok_minimum' => $stok_minimum,
            ':satuan'       => $satuan,
            ':harga_beli'   => $harga_beli,
            ':harga_jual'   => $harga_jual,
            ':lokasi_rak'   => $lokasi_rak,
            ':gambar'       => $gambar ?: null,
            ':deskripsi'    => $deskripsi ?: null,
        ]);

        $newId = (int)$pdo->lastInsertId();

        $createdItem = [
            'id'           => $newId,
            'kode_barang'  => $kode_barang,
            'nama_barang'  => $nama_barang,
            'kategori'     => $kategori,
            'stok'         => $stok,
            'stok_minimum' => $stok_minimum,
            'satuan'       => $satuan,
            'harga_beli'   => $harga_beli,
            'harga_jual'   => $harga_jual,
            'lokasi_rak'   => $lokasi_rak,
            'gambar'       => $gambar,
            'deskripsi'    => $deskripsi,
        ];

        sendJsonResponse(true, "Barang '{$nama_barang}' berhasil ditambahkan ke inventaris.", $createdItem, 201);

    } catch (PDOException $e) {
        sendJsonResponse(false, "Gagal menyimpan barang: " . $e->getMessage(), null, 500);
    }
}

sendJsonResponse(false, "Method {$method} tidak didukung pada endpoint ini.", null, 405);
