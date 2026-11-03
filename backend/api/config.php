<?php
/**
 * =========================================================================
 * KONFIGURASI DATABASE & CORS API EDUSTOCK
 * File: backend/api/config.php
 * =========================================================================
 */

// 1. Header CORS (Cross-Origin Resource Sharing)
// Mengizinkan aplikasi mobile (React Native / Expo / Web) mengakses API
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With, Accept");
header("Content-Type: application/json; charset=UTF-8");

// Tangani Preflight Request dari browser / fetch HTTP
if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'OPTIONS') {
    http_response_code(200);
    exit();
}

// 2. Pengaturan Kredensial Database MySQL (Default XAMPP)
define('DB_HOST', 'localhost');
define('DB_USER', 'root');
define('DB_PASS', '');
define('DB_NAME', 'edustock');

/**
 * Function: Membuka koneksi database menggunakan PDO
 * @return PDO|null
 */
function getDbConnection() {
    static $pdo = null;

    if ($pdo !== null) {
        return $pdo;
    }

    try {
        $dsn = "mysql:host=" . DB_HOST . ";dbname=" . DB_NAME . ";charset=utf8mb4";
        $options = [
            PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES   => false,
        ];
        $pdo = new PDO($dsn, DB_USER, DB_PASS, $options);
        return $pdo;
    } catch (PDOException $e) {
        return null;
    }
}

/**
 * Helper: Mengirimkan response JSON standar yang kompatibel dengan EduStock
 *
 * @param bool $success Status keberhasilan operasi
 * @param string $message Pesan yang informatif bagi pengguna
 * @param mixed $data Data muatan (biasanya array barang/transaksi)
 * @param int $statusCode HTTP Status Code (200, 201, 400, 404, 500)
 */
function sendJsonResponse($success, $message, $data = null, $statusCode = 200) {
    http_response_code($statusCode);
    echo json_encode([
        'success'   => (bool)$success,
        'message'   => $message,
        'data'      => $data,
        'timestamp' => date('Y-m-d H:i:s'),
    ], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
    exit();
}

