-- =========================================================================
-- DATABASE EDUSTOCK (Inventory Management System)
-- File: backend/database/edustock.sql
-- =========================================================================

CREATE DATABASE IF NOT EXISTS `edustock` 
  DEFAULT CHARACTER SET utf8mb4 
  COLLATE utf8mb4_unicode_ci;

USE `edustock`;

-- -------------------------------------------------------------------------
-- 1. Tabel: users (Data Pengguna & Autentikasi)
-- -------------------------------------------------------------------------
DROP TABLE IF EXISTS `transaksi`;
DROP TABLE IF EXISTS `barang`;
DROP TABLE IF EXISTS `users`;

CREATE TABLE `users` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `username` VARCHAR(50) NOT NULL UNIQUE,
  `password` VARCHAR(255) NOT NULL,
  `name` VARCHAR(100) NOT NULL,
  `email` VARCHAR(100) NOT NULL UNIQUE,
  `role` VARCHAR(50) NOT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO `users` (`id`, `username`, `password`, `name`, `email`, `role`) VALUES
(1, 'admin', 'password123', 'Budi Santoso', 'budi.gudang@edustock.com', 'Admin Gudang'),
(2, 'staff', 'password123', 'Rian Pratama', 'rian.staff@edustock.com', 'Staff Inventory'),
(3, 'manager', 'password123', 'Hendra Wijaya', 'hendra.owner@edustock.com', 'Pemilik Toko / Manajer');

-- -------------------------------------------------------------------------
-- 2. Tabel: barang (Katalog Master Barang Inventaris & Gambar Produk)
-- -------------------------------------------------------------------------
CREATE TABLE `barang` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `kode_barang` VARCHAR(30) NOT NULL UNIQUE,
  `nama_barang` VARCHAR(150) NOT NULL,
  `kategori` VARCHAR(50) NOT NULL,
  `stok` INT NOT NULL DEFAULT 0,
  `stok_minimum` INT NOT NULL DEFAULT 5,
  `satuan` VARCHAR(20) NOT NULL DEFAULT 'Unit',
  `harga_beli` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  `harga_jual` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  `lokasi_rak` VARCHAR(50) NOT NULL DEFAULT 'Gudang Utama',
  `gambar` TEXT DEFAULT NULL,
  `deskripsi` TEXT DEFAULT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO `barang` (`id`, `kode_barang`, `nama_barang`, `kategori`, `stok`, `stok_minimum`, `satuan`, `harga_beli`, `harga_jual`, `lokasi_rak`, `gambar`, `deskripsi`) VALUES
(1, 'BRG-0001', 'Laptop ASUS ExpertBook B1400 Core i5', 'Lab Komputer', 20, 5, 'Unit', 9500000.00, 11200000.00, 'Rak A-01', 'https://images.unsplash.com/photo-1496181133206-80ce9b88a853?w=600&auto=format&fit=crop&q=80', 'Laptop standar lab coding & komputasi kampus, RAM 16GB NVMe SSD, tangguh untuk praktikum.'),
(2, 'BRG-0002', 'Proyektor Epson EB-E01 3300 Lumens 3LCD', 'Multimedia', 3, 5, 'Unit', 5200000.00, 6100000.00, 'Rak A-03', 'https://images.unsplash.com/photo-1517604931442-7e0c8ed2963c?w=600&auto=format&fit=crop&q=80', 'Proyektor kecerahan tinggi 3300 lumens untuk presentasi kelas multimedia dan ruang auditorium.'),
(3, 'BRG-0003', 'Drawing Tablet Wacom Intuos Pen Small', 'Lab Desain', 15, 5, 'Unit', 1100000.00, 1350000.00, 'Rak B-01', 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=600&auto=format&fit=crop&q=80', 'Pen tablet grafis 4096 level pressure untuk praktikum animasi 2D, DKV, dan ilustrasi digital.'),
(4, 'BRG-0004', 'Kamera DSLR Canon EOS 3000D Kit 18-55mm', 'Multimedia', 4, 6, 'Unit', 4800000.00, 5600000.00, 'Rak A-04', 'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?w=600&auto=format&fit=crop&q=80', 'Kamera dokumentasi dan laboratorium fotografi studio kampus, sensor APS-C 18 Megapixel.'),
(5, 'BRG-0005', 'Headphone Studio Audio-Technica ATH-M20x', 'Lab Bahasa', 30, 10, 'Unit', 650000.00, 780000.00, 'Rak B-03', 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=600&auto=format&fit=crop&q=80', 'Professional monitor headphone dengan isolasi suara optimal untuk lab bahasa dan podcast.'),
(6, 'BRG-0006', '3D Printer Creality Ender-3 V2 Silent Board', 'Lab Robotika', 2, 3, 'Unit', 3400000.00, 4100000.00, 'Rak D-01', 'https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=600&auto=format&fit=crop&q=80', 'Mesin cetak 3D filamen presisi untuk pembuatan prototipe robotika dan tugas rekayasa mesin.'),
(7, 'BRG-0007', 'Mikroskop Digital Biologi Lab 1600X LCD', 'Lab Sains', 8, 5, 'Unit', 1850000.00, 2300000.00, 'Rak C-02', 'https://images.unsplash.com/photo-1579154204601-01588f351e67?w=600&auto=format&fit=crop&q=80', 'Mikroskop biologi modern dengan kamera digital USB & display layar LCD untuk pengamatan sel.'),
(8, 'BRG-0008', 'Drone Edukasi Mini DJI Tello Programming', 'Lab Robotika', 6, 4, 'Unit', 1450000.00, 1750000.00, 'Rak D-03', 'https://images.unsplash.com/photo-1527977966376-1c8408f9f108?w=600&auto=format&fit=crop&q=80', 'Quadcopter mini edukatif yang dapat diprogram menggunakan Scratch dan bahasa Python.'),
(9, 'BRG-0009', 'Microphone Wireless Boya BY-V2 Dual Channel', 'Multimedia', 12, 5, 'Set', 420000.00, 550000.00, 'Rak A-05', 'https://images.unsplash.com/photo-1590602847861-f357a9332bbc?w=600&auto=format&fit=crop&q=80', 'Mic nirkabel dual-clip dengan teknologi smart noise reduction untuk kuliah umum dan podcast.'),
(10, 'BRG-0010', 'Kabel HDMI 4K Vention Braided 5 Meter', 'Aksesoris', 40, 10, 'Pcs', 85000.00, 120000.00, 'Rak B-02', 'https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=600&auto=format&fit=crop&q=80', 'Kabel video audio 4K Ultra HD gold-plated dengan pelindung nylon braided anti-kusut.');

-- -------------------------------------------------------------------------
-- 3. Tabel: transaksi (Riwayat Transaksi Stok Masuk & Keluar)
-- -------------------------------------------------------------------------
CREATE TABLE `transaksi` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `id_barang` INT NOT NULL,
  `nama_barang` VARCHAR(150) NOT NULL,
  `jenis` ENUM('masuk', 'keluar') NOT NULL,
  `jumlah` INT NOT NULL,
  `satuan` VARCHAR(20) NOT NULL,
  `tanggal` VARCHAR(50) NOT NULL,
  `operator` VARCHAR(100) NOT NULL,
  `role_operator` VARCHAR(50) NOT NULL,
  `sisa_stok` INT NOT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `fk_transaksi_barang` FOREIGN KEY (`id_barang`) REFERENCES `barang` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO `transaksi` (`id`, `id_barang`, `nama_barang`, `jenis`, `jumlah`, `satuan`, `tanggal`, `operator`, `role_operator`, `sisa_stok`) VALUES
(1, 3, 'Drawing Tablet Wacom Intuos Pen Small', 'keluar', 2, 'Unit', '6 Okt 2026', 'Rian Pratama', 'Staff Inventory', 15),
(2, 1, 'Laptop ASUS ExpertBook B1400 Core i5', 'keluar', 5, 'Unit', '6 Okt 2026', 'Budi Santoso', 'Admin Gudang', 20),
(3, 1, 'Laptop ASUS ExpertBook B1400 Core i5', 'masuk', 10, 'Unit', '5 Okt 2026', 'Budi Santoso', 'Admin Gudang', 25),
(4, 2, 'Proyektor Epson EB-E01 3300 Lumens 3LCD', 'keluar', 2, 'Unit', '5 Okt 2026', 'Rian Pratama', 'Staff Inventory', 3),
(5, 7, 'Mikroskop Digital Biologi Lab 1600X LCD', 'masuk', 8, 'Unit', '4 Okt 2026', 'Budi Santoso', 'Admin Gudang', 8),
(6, 6, '3D Printer Creality Ender-3 V2 Silent Board', 'masuk', 2, 'Unit', '3 Okt 2026', 'Rian Pratama', 'Staff Inventory', 2);
