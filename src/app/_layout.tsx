import React from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

/**
 * =========================================================================
 * ROOT LAYOUT (Expo Router Navigation Stack)
 * Memenuhi Kriteria Modul 2: Penerapan _layout.tsx & <Stack.Screen />
 *
 * PENJELASAN UNTUK UJIAN PRAKTIK:
 * 1. File '_layout.tsx' di Expo Router bertindak sebagai pembungkus utama
 *    (layout wrapper) untuk seluruh rute halaman di dalam folder 'src/app/'.
 * 2. Komponen '<Stack>' bertindak sebagai Stack Navigator, yaitu tumpukan
 *    layar yang memungkinkan transisi navigasi maju (push), tumpuk (replace),
 *    dan mundur (back).
 * 3. Komponen '<Stack.Screen />' digunakan untuk mendaftarkan dan mengonfigurasi
 *    setiap rute yang tersedia (seperti judul header, animasi, dan visibilitas header).
 * =========================================================================
 */
export default function RootLayout() {
  return (
    <>
      {/* Mengatur warna indikator status bar perangkat */}
      <StatusBar style="dark" />

      {/* Stack Navigator membungkus semua halaman aplikasi */}
      <Stack
        screenOptions={{
          headerShown: false, // Menggunakan custom header di masing-masing screen agar UI EduStock konsisten & rapi
          contentStyle: { backgroundColor: '#f8fafc' },
          animation: 'slide_from_right', // Transisi animasi halus saat membuka halaman baru
        }}
      >
        {/* Rute 1: Halaman Login EduStock (src/app/index.tsx) */}
        <Stack.Screen
          name="index"
          options={{
            title: 'Masuk - EduStock',
          }}
        />

        {/* Rute 2: Halaman Dashboard Inventaris (src/app/dashboard.tsx) */}
        <Stack.Screen
          name="dashboard"
          options={{
            title: 'Dashboard EduStock',
          }}
        />

        {/* Rute 3: Halaman Daftar & Manajemen Barang (src/app/barang.tsx) */}
        <Stack.Screen
          name="barang"
          options={{
            title: 'Daftar Barang',
          }}
        />
      </Stack>
    </>
  );
}
