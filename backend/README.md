# Backend API EduStock (PHP & MySQL)

Backend REST API untuk aplikasi mobile **EduStock (Inventory Management)** yang dibangun menggunakan PHP murni (Native) dan database MySQL.

---

## 📁 Struktur Folder Backend

```text
backend/
├── api/
│   ├── config.php      # Koneksi Database PDO, CORS Header, Helper JSON Response
│   ├── barang.php      # Endpoint GET (Katalog, Filter, Search, Barcode) & POST (Tambah Barang)
│   └── transaksi.php   # Endpoint GET (Riwayat) & POST (Catat Stok Masuk/Keluar)
└── database/
    └── edustock.sql    # Skrip SQL untuk Import Database dan Data Awal
```

---

## 🚀 Panduan Pemasangan di XAMPP (Windows)

### Langkah 1: Pindahkan Folder ke `htdocs`
1. Buka folder instalasi XAMPP Anda (biasanya di `C:\xampp\htdocs`).
2. Buat folder baru bernama **`EduStock`**.
3. Salin (copy) folder **`backend`** ini ke dalam folder tersebut, sehingga strukturnya menjadi:
   ```text
   C:\xampp\htdocs\EduStock\backend\api\barang.php
   ```

### Langkah 2: Buat Database MySQL
1. Buka **XAMPP Control Panel**, lalu klik tombol **Start** pada modul **Apache** dan **MySQL**.
2. Buka browser dan akses **`http://localhost/phpmyadmin`**.
3. Buat database baru bernama: **`edustock`**.
4. Klik tab **Import** (Impor), pilih file **`backend/database/edustock.sql`**, lalu klik tombol **Import / Kirim**.

---

## 🧪 Menguji API di Browser / Postman

### 1. Ambil Semua Data Barang
- **URL**: `http://localhost/EduStock/backend/api/barang.php`
- **Method**: `GET`
- **Contoh Output JSON**:
```json
{
  "success": true,
  "message": "Berhasil memuat data dari database MySQL.",
  "data": [
    {
      "id": 1,
      "kode_barang": "BRG-0001",
      "nama_barang": "Laptop ASUS ExpertBook i5",
      "kategori": "Elektronik",
      "stok": 20,
      "stok_minimum": 5,
      "satuan": "Unit",
      "harga_beli": 9500000,
      "harga_jual": 11200000,
      "lokasi_rak": "Rak A-01"
    }
  ]
}
```

### 2. Cari Barang berdasarkan Kode Barcode (Untuk Scanner Kamera)
- **URL**: `http://localhost/EduStock/backend/api/barang.php?kode=BRG-0001`
- **Method**: `GET`

### 3. Filter berdasarkan Kategori
- **URL**: `http://localhost/EduStock/backend/api/barang.php?kategori=Elektronik`
- **Method**: `GET`

### 4. Tambah Barang Baru
- **URL**: `http://localhost/EduStock/backend/api/barang.php`
- **Method**: `POST`
- **Headers**: `Content-Type: application/json`
- **Body JSON**:
```json
{
  "nama_barang": "Mouse Wireless Logitech M331",
  "kategori": "Aksesoris",
  "stok": 15,
  "stok_minimum": 5,
  "satuan": "Pcs",
  "harga_beli": 180000,
  "harga_jual": 225000,
  "lokasi_rak": "Rak B-04"
}
```

### 5. Catat Stok Masuk / Keluar
- **URL**: `http://localhost/EduStock/backend/api/transaksi.php`
- **Method**: `POST`
- **Headers**: `Content-Type: application/json`
- **Body JSON**:
```json
{
  "id_barang": 1,
  "jenis": "masuk",
  "jumlah": 5,
  "operator": "Budi Santoso",
  "role_operator": "Admin Gudang"
}
```

---

## 📱 Menghubungkan ke HP Fisik (Expo Go)

Jika menguji aplikasi mobile menggunakan **Expo Go di HP fisik**, kata `localhost` pada URL tidak dapat diakses dari HP. Ganti `localhost` dengan **Alamat IP Wi-Fi Laptop** Anda:

1. Buka Command Prompt / PowerShell di laptop, ketik:
   ```bash
   ipconfig
   ```
2. Cari baris **IPv4 Address** pada adapter Wi-Fi (misal: `192.168.1.15`).
3. Buka file [`src/services/dataService.ts`](file:///d:/clone%20edustock/project_pemrogramanmobile/src/services/dataService.ts) dan ubah:
   ```typescript
   export const API_BASE_URL = 'http://192.168.1.15/EduStock/backend/api';
   ```
4. Pastikan HP dan Laptop terhubung ke **jaringan Wi-Fi / Hotspot yang sama**.

