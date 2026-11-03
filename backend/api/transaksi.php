<?php
/**
 * =========================================================================
 * ENDPOINT API: RIWAYAT & PENCATATAN TRANSAKSI STOK
 * File: backend/api/transaksi.php
 * Method: GET, POST
 * =========================================================================
 */

require_once __DIR__ . '/config.php';

$pdo = getDbConnection();
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

// =========================================================================
// METHOD GET: Mengambil Riwayat Transaksi Stok (Masuk & Keluar)
// =========================================================================
if ($method === 'GET') {
    if ($pdo !== null) {
        try {
            $stmt = $pdo->query("SELECT * FROM transaksi ORDER BY id DESC");
            $rows = $stmt->fetchAll();

            $transaksiList = array_map(function ($row) {
                return [
                    'id'            => (int)$row['id'],
                    'id_barang'     => (int)$row['id_barang'],
                    'nama_barang'   => (string)$row['nama_barang'],
                    'jenis'         => (string)$row['jenis'],
                    'jumlah'        => (int)$row['jumlah'],
                    'satuan'        => (string)$row['satuan'],
                    'tanggal'       => (string)$row['tanggal'],
                    'operator'      => (string)$row['operator'],
                    'role_operator' => (string)$row['role_operator'],
                    'sisa_stok'     => (int)$row['sisa_stok'],
                ];
            }, $rows);

            sendJsonResponse(true, "Berhasil memuat riwayat transaksi dari database.", $transaksiList);
        } catch (PDOException $e) {
            sendJsonResponse(false, "Terjadi kesalahan kueri transaksi: " . $e->getMessage(), null, 500);
        }
    }

    // Fallback JSON
    $jsonPath = __DIR__ . '/../../src/data/inventoryData.json';
    if (!file_exists($jsonPath)) {
        $jsonPath = __DIR__ . '/inventoryData.json';
    }

    if (file_exists($jsonPath)) {
        $raw = file_get_contents($jsonPath);
        $decoded = json_decode($raw, true);
        if (isset($decoded['transaksi']) && is_array($decoded['transaksi'])) {
            sendJsonResponse(true, "Berhasil memuat data transaksi (Mode Cadangan JSON).", $decoded['transaksi']);
        }
    }

    sendJsonResponse(false, "Database belum aktif dan data cadangan tidak ditemukan.", null, 500);
}

// =========================================================================
// METHOD POST: Mencatat Transaksi Baru & Mengupdate Stok Barang
// =========================================================================
if ($method === 'POST') {
    if ($pdo === null) {
        sendJsonResponse(false, "Koneksi database MySQL diperlukan untuk mencatat transaksi.", null, 500);
    }

    $rawInput = file_get_contents('php://input');
    $input = json_decode($rawInput, true);

    if (!is_array($input)) {
        $input = $_POST;
    }

    $id_barang = isset($input['id_barang']) ? (int)$input['id_barang'] : 0;
    $jenis = isset($input['jenis']) && strtolower($input['jenis']) === 'keluar' ? 'keluar' : 'masuk';
    $jumlah = isset($input['jumlah']) ? (int)$input['jumlah'] : 0;
    $operator = isset($input['operator']) ? trim($input['operator']) : 'Admin Gudang';
    $role_operator = isset($input['role_operator']) ? trim($input['role_operator']) : 'Admin Gudang';

    if ($id_barang <= 0 || $jumlah <= 0) {
        sendJsonResponse(false, "ID barang dan jumlah unit transaksi (minimal 1) wajib diisi.", null, 400);
    }

    try {
        // Mulai Database Transaction untuk integritas data
        $pdo->beginTransaction();

        // 1. Ambil data barang saat ini dengan FOR UPDATE (row-level lock)
        $stmtBarang = $pdo->prepare("SELECT * FROM barang WHERE id = :id FOR UPDATE");
        $stmtBarang->execute([':id' => $id_barang]);
        $barang = $stmtBarang->fetch();

        if (!$barang) {
            $pdo->rollBack();
            sendJsonResponse(false, "Barang dengan ID {$id_barang} tidak ditemukan.", null, 404);
        }

        $stokSekarang = (int)$barang['stok'];

        // 2. Hitung stok akhir dan validasi kecukupan stok jika barang keluar
        if ($jenis === 'keluar') {
            if ($jumlah > $stokSekarang) {
                $pdo->rollBack();
                sendJsonResponse(
                    false,
                    "Stok tidak mencukupi. Stok saat ini ({$stokSekarang} {$barang['satuan']}) lebih kecil dari jumlah yang diminta ({$jumlah} {$barang['satuan']}).",
                    null,
                    400
                );
            }
            $sisa_stok = $stokSekarang - $jumlah;
        } else {
            $sisa_stok = $stokSekarang + $jumlah;
        }

        // 3. Update stok di tabel barang
        $stmtUpdate = $pdo->prepare("UPDATE barang SET stok = :sisa_stok WHERE id = :id");
        $stmtUpdate->execute([
            ':sisa_stok' => $sisa_stok,
            ':id'        => $id_barang,
        ]);

        // 4. Catat riwayat di tabel transaksi
        $tanggalStr = date('j M Y'); // Contoh: "3 Nov 2026"
        $stmtInsert = $pdo->prepare("
            INSERT INTO transaksi (id_barang, nama_barang, jenis, jumlah, satuan, tanggal, operator, role_operator, sisa_stok)
            VALUES (:id_barang, :nama_barang, :jenis, :jumlah, :satuan, :tanggal, :operator, :role_operator, :sisa_stok)
        ");
        $stmtInsert->execute([
            ':id_barang'     => $id_barang,
            ':nama_barang'   => $barang['nama_barang'],
            ':jenis'         => $jenis,
            ':jumlah'        => $jumlah,
            ':satuan'        => $barang['satuan'],
            ':tanggal'       => $tanggalStr,
            ':operator'      => $operator,
            ':role_operator' => $role_operator,
            ':sisa_stok'     => $sisa_stok,
        ]);

        $newTrxId = (int)$pdo->lastInsertId();

        // Selesai & Commit Transaction
        $pdo->commit();

        $resultData = [
            'id'            => $newTrxId,
            'id_barang'     => $id_barang,
            'nama_barang'   => $barang['nama_barang'],
            'jenis'         => $jenis,
            'jumlah'        => $jumlah,
            'satuan'        => $barang['satuan'],
            'tanggal'       => $tanggalStr,
            'operator'      => $operator,
            'role_operator' => $role_operator,
            'sisa_stok'     => $sisa_stok,
        ];

        sendJsonResponse(true, "Transaksi stok {$jenis} berhasil dicatat.", $resultData, 201);

    } catch (Exception $e) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        sendJsonResponse(false, "Gagal memproses transaksi: " . $e->getMessage(), null, 500);
    }
}

sendJsonResponse(false, "Method {$method} tidak didukung pada endpoint ini.", null, 405);

