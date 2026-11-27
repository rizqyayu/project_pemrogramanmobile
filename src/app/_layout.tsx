import React, { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { Stack, router, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { OfflineBanner } from '../components/OfflineBanner';
import { AuthProvider, useAuth } from '../contexts/AuthContext';
import { UI } from '../constants/uiTokens';

/**
 * =========================================================================
 * ROOT LAYOUT & ROUTE PROTECTION GUARD (Modul 2 + Modul 4)
 * - Membungkus seluruh aplikasi dengan AuthProvider global
 * - Menggunakan useSegments() untuk menjaga rute terlindungi tanpa flicker:
 *   1. Saat isLoading === true: tampilkan perisai pemuatan (tidak redirect)
 *   2. Belum login dan mengakses halaman dalam -> arahkan ke '/' (Login)
 *   3. Sudah login dan masih di halaman login -> arahkan ke '/dashboard'
 * =========================================================================
 */
function RootNavigatorWithGuard() {
  const { session, isLoading } = useAuth();
  const segments = useSegments();

  useEffect(() => {
    if (isLoading) return;

    const firstSegment = segments[0] as string | undefined;
    const isOnLoginScreen = !firstSegment || firstSegment === 'index';

    if (!session && !isOnLoginScreen) {
      router.replace('/');
    } else if (session && isOnLoginScreen) {
      router.replace('/dashboard');
    }
  }, [session, isLoading, segments]);

  if (isLoading) {
    return (
      <View style={styles.guardLoadingContainer}>
        <ActivityIndicator size="large" color={UI.colors.primary} />
        <Text style={styles.guardLoadingText}>Memverifikasi sesi terenkripsi...</Text>
      </View>
    );
  }

  return (
    <>
      {/* Indikator Global Offline Handling di seluruh aplikasi */}
      <OfflineBanner />

      {/* Stack Navigator membungkus semua halaman aplikasi */}
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: '#F4F8FF' },
          animation: 'slide_from_right',
        }}
      >
        {/* Rute 1: Halaman Login & Daftar Akun EduStock (src/app/index.tsx) */}
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

        {/* Rute 4: Halaman Scanner Kamera Barcode / QR (src/app/scanner.tsx) */}
        <Stack.Screen
          name="scanner"
          options={{
            title: 'Scan Barcode Barang',
          }}
        />

        {/* Rute 5: Halaman Lokasi & Geofence Gudang (src/app/lokasi.tsx) */}
        <Stack.Screen
          name="lokasi"
          options={{
            title: 'Lokasi & Geofence Gudang',
          }}
        />

        {/* Rute 6: Halaman Transaksi Stok Masuk & Keluar (src/app/transaksi.tsx) */}
        <Stack.Screen
          name="transaksi"
          options={{
            title: 'Transaksi Stok',
          }}
        />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <StatusBar style="dark" />
      <RootNavigatorWithGuard />
    </AuthProvider>
  );
}

const styles = StyleSheet.create({
  guardLoadingContainer: {
    flex: 1,
    backgroundColor: '#F4F8FF',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  guardLoadingText: {
    fontSize: 13.5,
    fontWeight: '600',
    color: UI.colors.secondary,
  },
});
