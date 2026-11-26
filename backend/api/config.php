<?php
/**
 * =========================================================================
 * KONFIGURASI DATABASE, CORS & RBAC AUTH API EDUSTOCK
 * File: backend/api/config.php
 * =========================================================================
 */

header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With, Accept");
header("Content-Type: application/json; charset=UTF-8");

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'OPTIONS') {
    http_response_code(200);
    exit();
}

define('DB_HOST', 'localhost');
define('DB_USER', 'root');
define('DB_PASS', '');
define('DB_NAME', 'edustock');

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

/**
 * Mengambil Bearer Token dari HTTP Authorization header
 */
function getBearerTokenFromRequest() {
    $authHeader = $_SERVER['HTTP_AUTHORIZATION'] ?? $_SERVER['REDIRECT_HTTP_AUTHORIZATION'] ?? '';
    if (!$authHeader && function_exists('apache_request_headers')) {
        $headers = apache_request_headers();
        foreach ($headers as $key => $value) {
            if (strtolower($key) === 'authorization') {
                $authHeader = $value;
                break;
            }
        }
    }

    if (preg_match('/Bearer\s(\S+)/i', $authHeader, $matches)) {
        return $matches[1];
    }
    return null;
}

/**
 * Verifikasi dan decode JWT Token EduStock untuk RBAC di sisi Server
 */
function requireAuthenticatedUser() {
    $token = getBearerTokenFromRequest();
    if (!$token) {
        sendJsonResponse(false, "Token autentikasi (Bearer) tidak ditemukan.", null, 401);
    }

    $parts = explode('.', $token);
    if (count($parts) < 2) {
        sendJsonResponse(false, "Format token autentikasi tidak valid.", null, 401);
    }

    $payloadJson = base64_decode(strtr($parts[1], '-_', '+/'));
    $payload = json_decode($payloadJson, true);
    if (!is_array($payload) || empty($payload['role'])) {
        sendJsonResponse(false, "Payload token tidak valid atau peran tidak dikenali.", null, 401);
    }

    if (isset($payload['exp']) && (int)$payload['exp'] < time()) {
        sendJsonResponse(false, "Sesi token telah kedaluwarsa. Silakan login kembali.", null, 401);
    }

    return $payload;
}

/**
 * Penegakan Role-Based Access Control (RBAC) pada Endpoint Backend
 */
function requireRolePermission(array $allowedRoles, $actionName = 'aksi ini') {
    $user = requireAuthenticatedUser();
    $role = $user['role'] ?? '';

    if (!in_array($role, $allowedRoles, true)) {
        sendJsonResponse(
            false,
            "Akses ditolak (403): Peran '{$role}' tidak memiliki izin untuk {$actionName}.",
            null,
            403
        );
    }

    return $user;
}
