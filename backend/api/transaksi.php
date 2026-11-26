<?php
/**
 * =========================================================================
 * ENDPOINT API: RIWAYAT & PENCATATAN TRANSAKSI STOK (DILINDUNGI RBAC)
 * File: backend/api/transaksi.php
 * Method: GET, POST
 * =========================================================================
 */

require_once __DIR__ . '/config.php';

$pdo = getDbConnection();
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

// =========================================================================
// METHOD GET:
// - Admin Gudang & Manajer: semua riwayat transaksi
// - Staff Inventory: HANYA riwayat transaksi miliknya
// =========================================================================
if ($method === 'GET') {
    $authUser = requireRolePermission(
        ['Admin Gudang', 'Staff Inventory', 'Pemilik Toko / Manajer'],
        'melihat riwayat mutasi stok'
    );
    $role = $authUser['role'] ?? '';
    $userName = $authUser['name'] ?? '';

    if ($pdo !== null) {
        try {
            if ($role === 'Staff Inventory') {
                $stmt = $pdo->prepare("SELECT * FROM transaksi WHERE operator = :operator ORDER BY id DESC");
                $stmt->execute([':operator' => $userName]);
            } else {
                $stmt = $pdo->query("SELECT * FROM transaksi ORDER BY id DESC");
            }
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

            sendJsonResponse(true, "Berhasil memuat riwayat transaksi.", $transaksiList);
        } catch (PDOException $e) {
            sendJsonResponse(false, "Terjadi kesalahan kueri transaksi: " . $e->getMessage(), null, 500);
        }
    }

    $jsonPath = __DIR__ . '/../../src/data/inventoryData.json';
    if (!file_exists($jsonPath)) {
        $jsonPath = __DIR__ . '/inventoryData.json';
    }

    if (file_exists($jsonPath)) {
        $raw = file_get_contents($jsonPath);
        $decoded = json_decode($raw, true);
        if (isset($decoded['transaksi']) && is_array($decoded['transaksi'])) {
            $list = $decoded['transaksi'];
            if ($role === 'Staff Inventory') {
                $list = array_values(array_filter($list, function ($item) use ($userName) {
                    return ($item['operator'] ?? '') === $userName;
                }));
            }
            sendJsonResponse(true, "Berhasil memuat data transaksi (Mode Cadangan JSON).", $list);
        }
    }

    sendJsonResponse(false, "Database belum aktif dan data cadangan tidak ditemukan.", null, 500);
}

// =========================================================================
// METHOD POST: Mencatat Transaksi Baru (Hanya Admin Gudang & Staff Inventory)
// =========================================================================
if ($method === 'POST') {
    $authUser = requireRolePermission(
        ['Admin Gudang', 'Staff Inventory'],
        'mencatat transaksi stok masuk/keluar'
    );

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

    // Gunakan identitas dari token terverifikasi, bukan percaya input body secara membabi buta
    $operator = $authUser['name'] ?? ($input['operator'] ?? 'Operator');
    $role_operator = $authUser['role'] ?? ($input['role_operator'] ?? 'Staff Inventory');

    if ($id_barang <= 0 || $jumlah <= 0) {
        sendJsonResponse(false, "ID barang dan jumlah unit transaksi (minimal 1) wajib diisi.", null, 400);
    }

    try {
        $pdo->beginTransaction();

        $stmtBarang = $pdo->prepare("SELECT * FROM barang WHERE id = :id FOR UPDATE");
        $stmtBarang->execute([':id' => $id_barang]);
        $barang = $stmtBarang->fetch();

        if (!$barang) {
            $pdo->rollBack();
            sendJsonResponse(false, "Barang dengan ID {$id_barang} tidak ditemukan.", null, 404);
        }

        $stokSekarang = (int)$barang['stok'];

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

        $stmtUpdate = $pdo->prepare("UPDATE barang SET stok = :sisa_stok WHERE id = :id");
        $stmtUpdate->execute([
            ':sisa_stok' => $sisa_stok,
            ':id'        => $id_barang,
        ]);

        $tanggalStr = date('j M Y');
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
