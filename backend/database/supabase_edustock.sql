-- =========================================================================
-- SUPABASE POSTGRESQL SCHEMA & ROW LEVEL SECURITY (RLS) - EDUSTOCK
-- Modul 4: Database Cloud & Keamanan Tingkat Baris
--
-- CARA MENJALANKAN:
-- 1. Buka Dashboard Supabase project kalian
-- 2. Klik menu "SQL Editor" di sidebar kiri -> klik "New query"
-- 3. Copy-paste seluruh isi file ini lalu klik "Run"
-- =========================================================================

-- 1. Tabel Master Barang Inventaris (Cloud PostgreSQL)
CREATE TABLE IF NOT EXISTS public.barang (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL DEFAULT auth.uid(),
  kode_barang TEXT NOT NULL,
  nama_barang TEXT NOT NULL,
  kategori TEXT NOT NULL DEFAULT 'Lab Komputer',
  stok INTEGER NOT NULL DEFAULT 0 CHECK (stok >= 0),
  stok_minimum INTEGER NOT NULL DEFAULT 5 CHECK (stok_minimum >= 0),
  satuan TEXT NOT NULL DEFAULT 'Unit',
  harga_beli NUMERIC NOT NULL DEFAULT 0 CHECK (harga_beli >= 0),
  harga_jual NUMERIC NOT NULL DEFAULT 0 CHECK (harga_jual >= 0),
  lokasi_rak TEXT NOT NULL DEFAULT 'Rak A-01',
  gambar TEXT,
  deskripsi TEXT,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Tabel Riwayat Transaksi Stok Masuk & Keluar
CREATE TABLE IF NOT EXISTS public.transaksi (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL DEFAULT auth.uid(),
  barang_id UUID REFERENCES public.barang(id) ON DELETE CASCADE,
  nama_barang TEXT NOT NULL,
  jenis TEXT NOT NULL CHECK (jenis IN ('masuk', 'keluar', 'koreksi')),
  jumlah INTEGER NOT NULL CHECK (jumlah > 0),
  satuan TEXT NOT NULL DEFAULT 'Unit',
  operator TEXT NOT NULL,
  role_operator TEXT NOT NULL,
  sisa_stok INTEGER NOT NULL DEFAULT 0,
  catatan TEXT,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Aktifkan Row Level Security (RLS) pada kedua tabel
ALTER TABLE public.barang ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transaksi ENABLE ROW LEVEL SECURITY;

-- 4. Hapus policy lama jika re-run agar idempotent
DROP POLICY IF EXISTS "Users can view own barang" ON public.barang;
DROP POLICY IF EXISTS "Users can insert own barang" ON public.barang;
DROP POLICY IF EXISTS "Users can update own barang" ON public.barang;
DROP POLICY IF EXISTS "Users can delete own barang" ON public.barang;

DROP POLICY IF EXISTS "Users can view own transaksi" ON public.transaksi;
DROP POLICY IF EXISTS "Users can insert own transaksi" ON public.transaksi;
DROP POLICY IF EXISTS "Users can update own transaksi" ON public.transaksi;
DROP POLICY IF EXISTS "Users can delete own transaksi" ON public.transaksi;

-- 5. Kebijakan RLS Tabel barang: isolasi data per user terautentikasi (auth.uid())
CREATE POLICY "Users can view own barang"
  ON public.barang FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own barang"
  ON public.barang FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own barang"
  ON public.barang FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own barang"
  ON public.barang FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- 6. Kebijakan RLS Tabel transaksi: isolasi data per user terautentikasi (auth.uid())
CREATE POLICY "Users can view own transaksi"
  ON public.transaksi FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own transaksi"
  ON public.transaksi FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own transaksi"
  ON public.transaksi FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own transaksi"
  ON public.transaksi FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);
