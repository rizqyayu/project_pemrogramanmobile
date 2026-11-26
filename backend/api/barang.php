<?php
/**
 * =========================================================================
 * ENDPOINT API: DAFTAR & MANAJEMEN BARANG (DILINDUNGI RBAC)
 * File: backend/api/barang.php
 * Method: GET, POST, PUT, DELETE
 * =========================================================================
 */

require_once __DIR__ . '/config.php';

$pdo = getDbConnection();
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

// =========================================================================
// METHOD GET: Semua role terautentikasi boleh melihat katalog barang
// =========================================================================
if ($method === 'GET') {
    $authUser = requireRolePermission(
        ['Admin Gudang', 'Staff Inventory', 'Pemilik Toko / Manajer'],
        'melihat katalog barang'
    );
    $isStaff = ($authUser['role'] ?? '') === 'Staff Inventory';

    if ($pdo !== null) {
        try {
            $id = isset($_GET['id']) ? (int)$_GET['id'] : null;
            $kode = isset($_GET['kode']) ? trim($_GET['kode']) : null;
            $search = isset($_GET['search']) ? trim($_GET['search']) : null;
            $kategori = isset($_GET['kategori']) ? trim($_GET['kategori']) : null;

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
                $item['harga_beli'] = $isStaff ? 0 : (float)$item['harga_beli'];
                $item['harga_jual'] = (float)$item['harga_jual'];

                sendJsonResponse(true, "Detail barang berhasil diambil.", $item);
            }

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
                $item['harga_beli'] = $isStaff ? 0 : (float)$item['harga_beli'];
                $item['harga_jual'] = (float)$item['harga_jual'];

                sendJsonResponse(true, "Barang hasil scan barcode ditemukan.", $item);
            }

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

            $barangList = array_map(function ($row) use ($isStaff) {
                return [
                    'id'           => (int)$row['id'],
                    'kode_barang'  => (string)$row['kode_barang'],
                    'nama_barang'  => (string)$row['nama_barang'],
                    'kategori'     => (string)$row['kategori'],
                    'stok'         => (int)$row['stok'],
                    'stok_minimum' => (int)$row['stok_minimum'],
                    'satuan'       => (string)$row['satuan'],
                    'harga_beli'   => $isStaff ? 0 : (float)$row['harga_beli'],
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

    $jsonPath = __DIR__ . '/../../src/data/inventoryData.json';
    if (!file_exists($jsonPath)) {
        $jsonPath = __DIR__ . '/inventoryData.json';
    }

    if (file_exists($jsonPath)) {
        $raw = file_get_contents($jsonPath);
        $decoded = json_decode($raw, true);
        if (isset($decoded['barang']) && is_array($decoded['barang'])) {
            sendJsonResponse(true, "Berhasil memuat data inventaris (Mode Cadangan JSON PHP).", $decoded['barang']);
        }
    }

    sendJsonResponse(
        false,
        "Database MySQL 'edustock' belum terhubung dan data JSON tidak ditemukan.",
        null,
        500
    );
}

// =========================================================================
// METHOD POST / PUT / DELETE: Khusus Admin Gudang
// =========================================================================
if ($method === 'POST') {
    requireRolePermission(['Admin Gudang'], 'menambah master barang');

    if ($pdo === null) {
        sendJsonResponse(false, "Koneksi database MySQL diperlukan untuk menambah barang.", null, 500);
    }

    $rawInput = file_get_contents('php://input');
    $input = json_decode($rawInput, true);
    if (!is_array($input)) {
        $input = $_POST;
    }

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

if ($method === 'PUT') {
    requireRolePermission(['Admin Gudang'], 'mengubah master barang');

    if ($pdo === null) {
        sendJsonResponse(false, "Koneksi database MySQL diperlukan untuk memperbarui barang.", null, 500);
    }

    $input = json_decode(file_get_contents('php://input'), true);
    $id = isset($input['id']) ? (int)$input['id'] : 0;
    if ($id <= 0) {
        sendJsonResponse(false, "ID barang wajib diisi.", null, 400);
    }

    try {
        $stmt = $pdo->prepare("
            UPDATE barang
            SET nama_barang = :nama_barang,
                kategori = :kategori,
                stok_minimum = :stok_minimum,
                lokasi_rak = :lokasi_rak,
                harga_beli = :harga_beli,
                harga_jual = :harga_jual
            WHERE id = :id
        ");
        $stmt->execute([
            ':nama_barang'  => trim($input['nama_barang'] ?? ''),
            ':kategori'     => trim($input['kategori'] ?? 'Lab Komputer'),
            ':stok_minimum' => (int)($input['stok_minimum'] ?? 5),
            ':lokasi_rak'   => trim($input['lokasi_rak'] ?? 'Gudang Utama'),
            ':harga_beli'   => (float)($input['harga_beli'] ?? 0),
            ':harga_jual'   => (float)($input['harga_jual'] ?? 0),
            ':id'           => $id,
        ]);

        sendJsonResponse(true, "Data master barang berhasil diperbarui.", ['id' => $id]);
    } catch (PDOException $e) {
        sendJsonResponse(false, "Gagal memperbarui barang: " . $e->getMessage(), null, 500);
    }
}

if ($method === 'DELETE') {
    requireRolePermission(['Admin Gudang'], 'menghapus master barang');

    if ($pdo === null) {
        sendJsonResponse(false, "Koneksi database MySQL diperlukan untuk menghapus barang.", null, 500);
    }

    $id = isset($_GET['id']) ? (int)$_GET['id'] : 0;
    if ($id <= 0) {
        sendJsonResponse(false, "ID barang tidak valid.", null, 400);
    }

    try {
        $stmt = $pdo->prepare("DELETE FROM barang WHERE id = :id");
        $stmt->execute([':id' => $id]);
        sendJsonResponse(true, "Barang ID {$id} berhasil dihapus.", ['id' => $id]);
    } catch (PDOException $e) {
        sendJsonResponse(false, "Gagal menghapus barang: " . $e->getMessage(), null, 500);
    }
}

sendJsonResponse(false, "Method {$method} tidak didukung pada endpoint ini.", null, 405);
