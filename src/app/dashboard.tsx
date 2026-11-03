import { Feather, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useNetworkStatus } from '../hooks/useNetworkStatus';
import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  RefreshControl,
  StatusBar as RNStatusBar,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

// Import Types
import {
  AuthSession,
  Barang,
  TransaksiStok,
  User,
} from '../types';

// Import Services
import {
  getAuthHeader,
  getSavedSession,
  loginAsDemo,
  logout,
} from '../services/authService';
import {
  calculateInventorySummary,
  determineStatusStok,
  filterItemsBelowMinimum,
  getLoadedInventoryData,
} from '../services/dataService';

/**
 * =========================================================================
 * HALAMAN 2: DASHBOARD (src/app/dashboard.tsx)
 * Memenuhi Kriteria Modul 2:
 * 1. useState: Menyimpan data user, session token, ringkasan stok, status loading & refresh.
 * 2. useEffect: Memuat session & data inventaris saat halaman pertama kali dibuka.
 * 3. Expo Router:
 *    - router.push('/barang'): Membuka halaman Daftar Barang (menumpuk di stack).
 *    - router.replace('/'): Keluar (logout) dan kembali ke halaman Login.
 * =========================================================================
 */
export default function DashboardScreen() {
  // -----------------------------------------------------------------------
  // PENERAPAN STATE (useState)
  // -----------------------------------------------------------------------
  // State untuk menyimpan data pengguna yang sedang login
  const [currentUser, setCurrentUser] = useState<User>({
    id: 1,
    username: 'admin',
    name: 'Budi Santoso',
    email: 'budi.gudang@edustock.com',
    role: 'Admin Gudang',
  });

  // State untuk sesi autentikasi aktif (termasuk token JWT)
  const [session, setSession] = useState<AuthSession | null>(null);

  // State untuk data inventaris (summary, peringatan stok menipis, transaksi terbaru)
  const [inventoryData, setInventoryData] = useState(() => getLoadedInventoryData());

  // State untuk status loading awal dan refresh data
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [dashboardError, setDashboardError] = useState<string | null>(null); // State Error Dashboard

  // State untuk toggle visibilitas rincian token JWT
  const [showTokenDetails, setShowTokenDetails] = useState<boolean>(false);

  // State Form Modal Interaktif: Stok Masuk & Stok Keluar
  const [stokModalType, setStokModalType] = useState<'masuk' | 'keluar' | null>(null);
  const [selectedBarangId, setSelectedBarangId] = useState<number>(1);
  const [jumlahInput, setJumlahInput] = useState<string>('5');
  const [catatanInput, setCatatanInput] = useState<string>('');

  // State Modal Interaktif Fitur Lengkap: Mutasi Stok, Laporan, Menu Profil
  const [isMutasiModalVisible, setIsMutasiModalVisible] = useState<boolean>(false);
  const [mutasiFilter, setMutasiFilter] = useState<'semua' | 'masuk' | 'keluar'>('semua');
  const [isLaporanModalVisible, setIsLaporanModalVisible] = useState<boolean>(false);
  const [isMenuModalVisible, setIsMenuModalVisible] = useState<boolean>(false);

  const { summary, alertItems, transaksiList } = inventoryData;

  // Buka Modal Formulir Stok Masuk / Keluar
  const openStokModal = (type: 'masuk' | 'keluar') => {
    setStokModalType(type);
    setJumlahInput('5');
    setCatatanInput(type === 'masuk' ? 'Pengadaan Stok Baru' : 'Distribusi Unit Lab');
    if (inventoryData.barangList.length > 0) {
      setSelectedBarangId(inventoryData.barangList[0].id);
    }
  };

  // Stepper Pengubah Jumlah Unit (+ / -)
  const changeJumlah = (delta: number) => {
    const current = parseInt(jumlahInput, 10) || 0;
    const next = Math.max(1, current + delta);
    setJumlahInput(String(next));
  };

  // Barang yang sedang dipilih di Modal
  const selectedBarang =
    inventoryData.barangList.find((b) => b.id === selectedBarangId) ||
    inventoryData.barangList[0];
  const parsedJumlah = parseInt(jumlahInput, 10) || 0;
  const estimasiStokAkhir = selectedBarang
    ? stokModalType === 'masuk'
      ? selectedBarang.stok + parsedJumlah
      : selectedBarang.stok - parsedJumlah
    : 0;
  const isStokKurang =
    stokModalType === 'keluar' && selectedBarang && parsedJumlah > selectedBarang.stok;

  // Handler Simpan Transaksi Stok Masuk / Keluar
  const handleSimpanTransaksi = () => {
    if (!stokModalType || !selectedBarang) return;

    if (parsedJumlah <= 0) {
      Alert.alert('Perhatian', 'Jumlah unit harus berupa angka lebih dari 0.');
      return;
    }

    if (isStokKurang) {
      Alert.alert(
        'Stok Tidak Mencukupi',
        `Jumlah yang ingin dikeluarkan (${parsedJumlah} ${selectedBarang.satuan}) melebihi stok yang tersedia saat ini (${selectedBarang.stok} ${selectedBarang.satuan}).`
      );
      return;
    }

    // 1. Update data barang secara immutably
    const currentBarangList = inventoryData.barangList.map((item) => {
      if (item.id === selectedBarang.id) {
        const newStok = estimasiStokAkhir;
        const newStatus = determineStatusStok(newStok, item.stok_minimum);
        return {
          ...item,
          stok: newStok,
          status_stok: newStatus,
        };
      }
      return item;
    });

    // 2. Format tanggal transaksi (contoh: 27 Okt 2026)
    const todayStr = new Date().toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });

    // 3. Tambahkan transaksi baru ke riwayat
    const newTrx: TransaksiStok = {
      id: Date.now(),
      id_barang: selectedBarang.id,
      nama_barang: selectedBarang.nama_barang,
      jenis: stokModalType,
      jumlah: parsedJumlah,
      satuan: selectedBarang.satuan,
      tanggal: todayStr,
      operator: currentUser.name,
      role_operator: currentUser.role,
      sisa_stok: estimasiStokAkhir,
    };

    const updatedTrxList = [newTrx, ...inventoryData.transaksiList];

    // 4. Hitung ulang summary dan alert items
    const newSummary = calculateInventorySummary(currentBarangList, updatedTrxList);
    const newAlertItems = filterItemsBelowMinimum(currentBarangList);

    // 5. Update state inventaris (memicu pembaruan UI secara otomatis di Dashboard)
    setInventoryData({
      barangList: currentBarangList,
      transaksiList: updatedTrxList,
      summary: newSummary,
      alertItems: newAlertItems,
    });

    const isMasuk = stokModalType === 'masuk';
    const actionLabel = isMasuk ? 'Stok Masuk' : 'Stok Keluar';
    const sign = isMasuk ? '+' : '-';
    setStokModalType(null);

    Alert.alert(
      `Sukses Catat ${actionLabel}`,
      `Transaksi berhasil disimpan!\n\n` +
      `Barang: ${selectedBarang.nama_barang}\n` +
      `Perubahan: ${sign}${parsedJumlah} ${selectedBarang.satuan}\n` +
      `Stok Sekarang: ${estimasiStokAkhir} ${selectedBarang.satuan}\n` +
      `Catatan: ${catatanInput || '-'}\n` +
      `Operator: ${currentUser.name}`
    );
  };

  // -----------------------------------------------------------------------
  // HELPER & KALKULASI LAPORAN & MUTASI STOK
  // -----------------------------------------------------------------------
  const formatRupiah = (num: number) => {
    return 'Rp ' + Number(num).toLocaleString('id-ID');
  };

  // Handler Ganti Peran Cepat (Simulasi Multi-Role: Admin, Staff, Manager)
  const handleQuickSwitchRole = async (roleKey: 'admin' | 'staff' | 'manager') => {
    try {
      const newSession = await loginAsDemo(roleKey);
      setSession(newSession);
      setCurrentUser(newSession.user);
      Alert.alert(
        'Peran Berhasil Diperbarui',
        `Sesi aktif sekarang sebagai:\n• Nama: ${newSession.user.name}\n• Peran: ${newSession.user.role}\n• Email: ${newSession.user.email}`
      );
    } catch (err: any) {
      Alert.alert('Gagal Ganti Peran', err?.message || 'Terjadi kesalahan sistem.');
    }
  };

  // Kalkulasi Finansial Inventaris untuk Modal Laporan
  const totalAsetBeli = useMemo(() => {
    return inventoryData.barangList.reduce((acc, b) => acc + (b.harga_beli * b.stok), 0);
  }, [inventoryData.barangList]);

  const totalNilaiJual = useMemo(() => {
    return inventoryData.barangList.reduce((acc, b) => acc + (b.harga_jual * b.stok), 0);
  }, [inventoryData.barangList]);

  const potensiMargin = totalNilaiJual - totalAsetBeli;
  const persentaseMargin = totalAsetBeli > 0 ? ((potensiMargin / totalAsetBeli) * 100).toFixed(1) : '0';

  // Ringkasan per Kategori untuk Modal Laporan
  const kategoriSummary = useMemo(() => {
    const map = new Map<string, { count: number; totalStok: number; totalNilai: number }>();
    for (const b of inventoryData.barangList) {
      const current = map.get(b.kategori) || { count: 0, totalStok: 0, totalNilai: 0 };
      current.count += 1;
      current.totalStok += b.stok;
      current.totalNilai += b.harga_beli * b.stok;
      map.set(b.kategori, current);
    }
    return Array.from(map.entries()).map(([kategori, val]) => ({
      kategori,
      ...val,
    }));
  }, [inventoryData.barangList]);

  // Filter Mutasi Stok
  const filteredMutasiList = useMemo(() => {
    if (mutasiFilter === 'semua') return inventoryData.transaksiList;
    return inventoryData.transaksiList.filter((t) => t.jenis === mutasiFilter);
  }, [mutasiFilter, inventoryData.transaksiList]);

  const countMutasiMasuk = inventoryData.transaksiList.filter((t) => t.jenis === 'masuk').length;
  const countMutasiKeluar = inventoryData.transaksiList.filter((t) => t.jenis === 'keluar').length;

  // -----------------------------------------------------------------------
  // PENERAPAN EFFECT (useEffect)
  // Dijalankan saat pertama kali Dashboard dipasang (mount) ke layar ([]).
  // -----------------------------------------------------------------------
  const loadDashboardData = useCallback(async () => {
    setIsLoading(true);
    setDashboardError(null);
    try {
      // 1. Memeriksa session dari storage
      const savedSession = await getSavedSession();
      if (savedSession) {
        setSession(savedSession);
        setCurrentUser(savedSession.user);
      }

      // 2. Memuat kalkulasi data inventaris terbaru
      const data = getLoadedInventoryData();
      setInventoryData(data);
      setDashboardError(null);
    } catch (error: any) {
      console.warn('Gagal memuat data dashboard:', error);
      setDashboardError(error?.message || 'Gagal memuat data ringkasan inventaris.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  // -----------------------------------------------------------------------
  // OFFLINE HANDLING & REKONEKSI OTOMATIS
  // -----------------------------------------------------------------------
  const { isOffline } = useNetworkStatus({
    onReconnect: async () => {
      await loadDashboardData();
    },
    cooldownMs: 4000,
  });

  useEffect(() => {
    let isMounted = true;
    async function init() {
      try {
        const savedSession = await getSavedSession();
        if (isMounted && savedSession) {
          setSession(savedSession);
          setCurrentUser(savedSession.user);
        }
        const data = getLoadedInventoryData();
        if (isMounted) {
          setInventoryData(data);
        }
      } catch (err) {
        console.warn('Gagal memuat dashboard:', err);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }
    init();

    return () => {
      isMounted = false;
    };
  }, []);

  // Handler Pull-to-refresh
  const onRefresh = async () => {
    setIsRefreshing(true);
    await loadDashboardData();
  };

  // -----------------------------------------------------------------------
  // HANDLER: Logout & Navigasi router.replace()
  // -----------------------------------------------------------------------
  const handleLogout = async () => {
    Alert.alert(
      'Konfirmasi Keluar',
      'Apakah Anda yakin ingin keluar dari akun EduStock?',
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Ya, Keluar',
          style: 'destructive',
          onPress: async () => {
            await logout();
            /**
             * PERBEDAAN ROUTER:
             * router.replace('/'): Menggantikan Dashboard dengan Login Screen,
             * sehingga riwayat navigasi dibersihkan dan pengguna tidak bisa
             * kembali ke dashboard tanpa autentikasi ulang.
             */
            router.replace('/');
          },
        },
      ]
    );
  };

  // Handler Pengujian Bearer Token API Header
  const handleTestAuthHeader = async () => {
    const header = await getAuthHeader();
    Alert.alert(
      'Header Autentikasi Token (HTTP Bearer)',
      `Header HTTP siap dikirim ke Backend API:\n\nAuthorization: ${
        header.Authorization || 'Tidak ada token'
      }\n\nToken disimpan secara aman di persistent storage.`,
      [{ text: 'Tutup', style: 'default' }]
    );
  };

  // Tampilan Loading Screen Awal (State Loading)
  if (isLoading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2563eb" />
        <Text style={styles.loadingText}>Memuat Dashboard EduStock...</Text>
      </SafeAreaView>
    );
  }

  // Tampilan Error Screen (State Error & Retry)
  if (dashboardError) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <View style={styles.errorIconBadge}>
          <Feather name="alert-triangle" size={42} color="#dc2626" />
        </View>
        <Text style={styles.dashboardErrorTitle}>Gagal Memuat Dashboard</Text>
        <Text style={styles.dashboardErrorSubtitle}>{dashboardError}</Text>
        <TouchableOpacity
          style={styles.dashboardRetryBtn}
          activeOpacity={0.8}
          onPress={loadDashboardData}
        >
          <Feather name="refresh-cw" size={15} color="#ffffff" style={{ marginRight: 6 }} />
          <Text style={styles.dashboardRetryBtnText}>Coba Lagi</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Top Header App Bar */}
      <View style={styles.dashHeader}>
        <View style={styles.dashHeaderLeft}>
          <View style={styles.miniLogoCube}>
            <Feather name="box" size={14} color="#ffffff" />
          </View>
          <Text style={styles.dashHeaderTitle}>EduStock Inventory</Text>
        </View>

        {/* Tombol Logout (Menggunakan router.replace('/')) */}
        <TouchableOpacity
          style={styles.logoutBtn}
          activeOpacity={0.7}
          onPress={handleLogout}
        >
          <Feather name="log-out" size={13} color="#ef4444" />
          <Text style={styles.logoutBtnText}>Keluar</Text>
        </TouchableOpacity>
        
      </View>

      {/* Main Scroll Content */}
      <ScrollView
        style={styles.dashScrollView}
        contentContainerStyle={styles.dashScrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} colors={['#2563eb']} />
        }
      >
        {/* Indikator Kondisi Offline di Dashboard */}
        {isOffline && (
          <View style={styles.offlineAlertCard}>
            <Feather name="wifi-off" size={14} color="#b45309" style={{ marginRight: 8 }} />
            <Text style={styles.offlineAlertText}>
              Mode Offline: Koneksi internet tidak tersedia. Menampilkan data inventaris lokal.
            </Text>
          </View>
        )}

        {/* Dark Greeting Card */}
        <View style={styles.darkGreetingCard}>
          <View style={styles.darkCardTopRow}>
            <View>
              <Text style={styles.greetingName}>
                Halo, {currentUser.name} 👋
              </Text>
              <Text style={styles.greetingSub}>Sistem Monitoring Stok Real-time</Text>
            </View>
            <View style={styles.greetingRightCol}>
              <View style={styles.roleBadge}>
                <Text style={styles.roleBadgeText}>{currentUser.role}</Text>
              </View>
              <TouchableOpacity
                style={styles.switchAccountBtn}
                activeOpacity={0.7}
                onPress={handleLogout}
              >
                <Feather name="repeat" size={11} color="#f87171" />
                <Text style={styles.switchAccountText}>Ganti Akun</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* 3 Status Chips: Hasil Perhitungan State Inventaris */}
          <View style={styles.statusChipsRow}>
            <View style={styles.chipItem}>
              <View style={[styles.statusDot, { backgroundColor: '#22c55e' }]} />
              <Text style={styles.chipText}>Aman: {summary.statusAman}</Text>
            </View>
            <View style={styles.chipItem}>
              <View style={[styles.statusDot, { backgroundColor: '#f59e0b' }]} />
              <Text style={styles.chipText}>Menipis: {summary.statusMenipis}</Text>
            </View>
            <View style={styles.chipItem}>
              <View style={[styles.statusDot, { backgroundColor: '#ef4444' }]} />
              <Text style={styles.chipText}>Habis: {summary.statusHabis}</Text>
            </View>
          </View>
        </View>

        {/* Card Autentikasi & Bearer Token JWT */}
        <View style={styles.tokenCard}>
          <View style={styles.tokenCardHeader}>
            <View style={styles.tokenBadgeRow}>
              <Feather name="shield" size={14} color="#0284c7" />
              <Text style={styles.tokenTitle}>Status Autentikasi & Token</Text>
            </View>
            <View style={styles.activeTokenBadge}>
              <View style={styles.activeDot} />
              <Text style={styles.activeTokenText}>Aktif (Bearer)</Text>
            </View>
          </View>

          <View style={styles.tokenPreviewBox}>
            <Text style={styles.tokenLabel}>Bearer Token:</Text>
            <Text style={styles.tokenValue} numberOfLines={showTokenDetails ? undefined : 1}>
              {session?.token || 'Belum ada token'}
            </Text>
          </View>

          <View style={styles.tokenMetaRow}>
            <Text style={styles.tokenMetaText}>
              User ID: <Text style={styles.tokenMetaBold}>{currentUser.id}</Text> • Role:{' '}
              <Text style={styles.tokenMetaBold}>{currentUser.role}</Text>
            </Text>
            <TouchableOpacity onPress={() => setShowTokenDetails((prev) => !prev)}>
              <Text style={styles.tokenToggleText}>
                {showTokenDetails ? 'Ringkas' : 'Detail'}
              </Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={styles.testHeaderBtn} onPress={handleTestAuthHeader}>
            <Feather name="check-circle" size={13} color="#0369a1" />
            <Text style={styles.testHeaderBtnText}>Uji Authorization Header API</Text>
          </TouchableOpacity>
          
        </View>

        {/* 2x2 Stats Summary Grid (Dapat ditekan untuk membuka halaman barang) */}
        <View style={styles.statsGrid}>
          {/* Card 1: Total Barang -> Menavigasi ke halaman Barang dengan router.push() */}
          <TouchableOpacity
            style={[styles.statCard, styles.clickableStatCard]}
            activeOpacity={0.8}
            onPress={() => {
              /**
               * PERBEDAAN ROUTER:
               * router.push('/barang'): Menambahkan layar baru ke atas tumpukan stack.
               * Pengguna dapat kembali ke Dashboard kapan saja dengan router.back().
               */
              router.push('/barang');
            }}
          >

            <View style={styles.statCardHeader}>
              <View style={[styles.statIconBadge, { backgroundColor: '#eff6ff' }]}>
                <Feather name="box" size={16} color="#2563eb" />
              </View>
              <Text style={styles.statTitle}>Total Barang</Text>
              <Feather name="chevron-right" size={14} color="#94a3b8" style={{ marginLeft: 'auto' }} />
            </View>
            <Text style={styles.statNumber}>{summary.totalBarang}</Text>
            <Text style={styles.statLinkText}>Ketuk untuk buka katalog →</Text>
          </TouchableOpacity>

          {/* Card 2: Total Stok */}
          <View style={styles.statCard}>
            <View style={styles.statCardHeader}>
              <View style={[styles.statIconBadge, { backgroundColor: '#ecfeff' }]}>
                <Feather name="layers" size={16} color="#0891b2" />
              </View>
              <Text style={styles.statTitle}>Total Stok</Text>
            </View>
            <Text style={styles.statNumber}>{summary.totalStok}</Text>
            <Text style={styles.statDesc}>Unit barang di gudang</Text>
          </View>

          {/* Card 3: Stok Minimum */}
          <View style={styles.statCard}>
            <View style={styles.statCardHeader}>
              <View style={[styles.statIconBadge, { backgroundColor: '#fef2f2' }]}>
                <Feather name="alert-circle" size={16} color="#dc2626" />
              </View>
              <Text style={styles.statTitle}>Stok Minimum</Text>
            </View>
            <Text style={styles.statNumber}>{summary.stokMinimumCount}</Text>
            <Text style={styles.statDesc}>Perlu restock segera</Text>
          </View>

          {/* Card 4: Barang Masuk */}
          <View style={styles.statCard}>
            <View style={styles.statCardHeader}>
              <View style={[styles.statIconBadge, { backgroundColor: '#f0fdf4' }]}>
                <Feather name="arrow-down-circle" size={16} color="#16a34a" />
              </View>
              <Text style={styles.statTitle}>Barang Masuk</Text>
            </View>
            <Text style={styles.statNumber}>{summary.barangMasukCount}</Text>
            <Text style={styles.statDesc}>Total akumulasi masuk</Text>
          </View>
        </View>

        {/* Warning Box: Peringatan Stok Perlu Perhatian */}
        <View style={styles.alertBox}>
          <View style={styles.alertHeaderRow}>
            <Feather name="alert-triangle" size={16} color="#dc2626" />
            <Text style={styles.alertHeaderTitle}>
              Peringatan Stok Perlu Perhatian ({alertItems.length})
            </Text>
          </View>
          <Text style={styles.alertHeaderDesc}>
            Terdapat barang yang telah mencapai batas minimum atau habis. Segera buat catatan Stok Masuk.
          </Text>

          {/* Render List Barang Perlu Perhatian */}
          {alertItems.map((item: Barang) => (
            <TouchableOpacity
              key={item.id}
              style={styles.alertItemCard}
              activeOpacity={0.8}
              onPress={() => router.push('/barang')}
            >
              <View style={styles.alertItemTopRow}>
                <Text style={styles.alertItemTitle}>{item.nama_barang}</Text>
                <View
                  style={[
                    styles.menipisBadge,
                    item.stok === 0 && { backgroundColor: '#fee2e2', borderColor: '#fca5a5' },
                  ]}
                >
                  <Text
                    style={[
                      styles.menipisText,
                      item.stok === 0 && { color: '#dc2626' },
                    ]}
                  >
                    • {item.status_stok}
                  </Text>
                </View>
              </View>
              <Text style={styles.alertItemSpecs}>
                {item.kode_barang} • Sisa:{' '}
                <Text style={styles.boldRed}>
                  {item.stok} {item.satuan}
                </Text>{' '}
                (Min: {item.stok_minimum}) • {item.lokasi_rak}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Aksi Cepat Inventory */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>Aksi Cepat Inventory</Text>
        </View>
        <View style={styles.quickActionsRow}>
          {/* Scan Barcode (Sensor Kamera) */}
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: '#f5f3ff', borderColor: '#ddd6fe' }]}
            onPress={() => router.push('/scanner')}
          >
            <View style={[styles.actionCircle, { backgroundColor: '#7c3aed' }]}>
              <Feather name="camera" size={17} color="#ffffff" />
            </View>
            <Text style={[styles.actionText, { color: '#7c3aed' }]}>Scan Barcode</Text>
          </TouchableOpacity>

          {/* Stok Masuk (Aktif Interaktif) */}
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: '#f0fdf4', borderColor: '#bbf7d0' }]}
            onPress={() => openStokModal('masuk')}
          >
            <View style={[styles.actionCircle, { backgroundColor: '#16a34a' }]}>
              <Feather name="plus" size={17} color="#ffffff" />
            </View>
            <Text style={[styles.actionText, { color: '#16a34a' }]}>Stok Masuk</Text>
          </TouchableOpacity>

          {/* Stok Keluar (Aktif Interaktif) */}
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: '#fef2f2', borderColor: '#fecaca' }]}
            onPress={() => openStokModal('keluar')}
          >
            <View style={[styles.actionCircle, { backgroundColor: '#dc2626' }]}>
              <Feather name="minus" size={17} color="#ffffff" />
            </View>
            <Text style={[styles.actionText, { color: '#dc2626' }]}>Stok Keluar</Text>
          </TouchableOpacity>

          {/* Buka Daftar Barang (router.push) */}
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: '#eff6ff', borderColor: '#bfdbfe' }]}
            onPress={() => router.push('/barang')}
          >
            <View style={[styles.actionCircle, { backgroundColor: '#2563eb' }]}>
              <Feather name="box" size={17} color="#ffffff" />
            </View>
            <Text style={[styles.actionText, { color: '#2563eb' }]}>Barang</Text>
          </TouchableOpacity>
        </View>

        {/* Aktivitas Stok Terbaru */}
        <View style={styles.activityHeaderRow}>
          <Text style={styles.sectionTitle}>Aktivitas Stok Terbaru</Text>
          <TouchableOpacity onPress={() => setIsMutasiModalVisible(true)}>
            <Text style={styles.linkViewAll}>Lihat Semua Mutasi →</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.activityCard}>
          {transaksiList.map((trx: TransaksiStok, index: number) => {
            const isMasuk = trx.jenis === 'masuk';
            const isLast = index === transaksiList.length - 1;

            return (
              <View
                key={trx.id}
                style={[styles.activityItem, isLast && { borderBottomWidth: 0 }]}
              >
                <View
                  style={[
                    styles.activityCircle,
                    { backgroundColor: isMasuk ? '#f0fdf4' : '#fef2f2' },
                  ]}
                >
                  <Feather
                    name={isMasuk ? 'arrow-down' : 'arrow-up'}
                    size={15}
                    color={isMasuk ? '#16a34a' : '#ef4444'}
                  />
                </View>
                <View style={styles.activityDetails}>
                  <View style={styles.activityTopLine}>
                    <Text style={styles.activityItemName}>{trx.nama_barang}</Text>
                    <Text
                      style={[
                        styles.activityItemDiff,
                        { color: isMasuk ? '#16a34a' : '#dc2626' },
                      ]}
                    >
                      {isMasuk ? `+${trx.jumlah}` : `-${trx.jumlah}`} {trx.satuan}
                    </Text>
                  </View>
                  <View style={styles.activityBottomLine}>
                    <Text style={styles.activityMeta}>
                      {trx.tanggal} • {trx.operator} ({trx.role_operator})
                    </Text>
                    <Text style={styles.activityRemain}>Sisa: {trx.sisa_stok}</Text>
                  </View>
                </View>
              </View>
            );
          })}
        </View>

        <View style={{ height: 30 }} />
      </ScrollView>

      {/* Sticky Bottom Navigation Bar */}
      <View style={styles.bottomNav}>
        {/* Tab 1: Dashboard (Aktif) */}
        <TouchableOpacity style={styles.navItem} onPress={() => {}}>
          <Ionicons name="home" size={22} color="#2563eb" />
          <Text style={[styles.navLabel, { color: '#2563eb' }]}>Dashboard</Text>
        </TouchableOpacity>

        {/* Tab 2: Barang -> Membuka screen Barang dengan router.push('/barang') */}
        <TouchableOpacity
          style={styles.navItem}
          onPress={() => router.push('/barang')}
        >
          <Feather name="box" size={22} color="#64748b" />
          <Text style={styles.navLabel}>Barang</Text>
        </TouchableOpacity>

        {/* Tab 3: Mutasi Stok */}
        <TouchableOpacity
          style={styles.navItem}
          onPress={() => setIsMutasiModalVisible(true)}
        >
          <MaterialCommunityIcons name="swap-vertical" size={22} color={isMutasiModalVisible ? '#2563eb' : '#64748b'} />
          <Text style={[styles.navLabel, isMutasiModalVisible && { color: '#2563eb' }]}>Mutasi Stok</Text>
        </TouchableOpacity>

        {/* Tab 4: Laporan */}
        <TouchableOpacity
          style={styles.navItem}
          onPress={() => setIsLaporanModalVisible(true)}
        >
          <Feather name="file-text" size={22} color={isLaporanModalVisible ? '#2563eb' : '#64748b'} />
          <Text style={[styles.navLabel, isLaporanModalVisible && { color: '#2563eb' }]}>Laporan</Text>
        </TouchableOpacity>

        {/* Tab 5: Menu Profil */}
        <TouchableOpacity
          style={styles.navItem}
          onPress={() => setIsMenuModalVisible(true)}
        >
          <Feather name="grid" size={22} color={isMenuModalVisible ? '#2563eb' : '#64748b'} />
          <Text style={[styles.navLabel, isMenuModalVisible && { color: '#2563eb' }]}>Menu</Text>
        </TouchableOpacity>
      </View>

      {/* ============================================================= */}
      {/* MODAL FORMULIR TRANSAKSI: STOK MASUK & STOK KELUAR           */}
      {/* Memenuhi Kriteria Modul 2: useState untuk Form & Mutasi State */}
      {/* ============================================================= */}
      <Modal
        visible={stokModalType !== null}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setStokModalType(null)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.transaksiModalContent}>
            {/* Modal Header */}
            <View style={styles.transaksiModalHeader}>
              <View style={styles.transaksiHeaderLeft}>
                <View
                  style={[
                    styles.transaksiIconCircle,
                    {
                      backgroundColor:
                        stokModalType === 'masuk' ? '#f0fdf4' : '#fef2f2',
                    },
                  ]}
                >
                  <Feather
                    name={stokModalType === 'masuk' ? 'arrow-down-circle' : 'arrow-up-circle'}
                    size={22}
                    color={stokModalType === 'masuk' ? '#16a34a' : '#dc2626'}
                  />
                </View>
                <View>
                  <Text style={styles.transaksiModalTitle}>
                    {stokModalType === 'masuk' ? 'Formulir Stok Masuk' : 'Formulir Stok Keluar'}
                  </Text>
                  <Text style={styles.transaksiModalSubtitle}>
                    {stokModalType === 'masuk'
                      ? 'Tambah stok unit barang masuk gudang'
                      : 'Catat pengurangan stok barang keluar gudang'}
                  </Text>
                </View>
              </View>

              <TouchableOpacity
                style={styles.transaksiCloseBtn}
                onPress={() => setStokModalType(null)}
              >
                <Feather name="x" size={18} color="#64748b" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 420 }}>
              {/* Field 1: Pilih Barang */}
              <View style={styles.formSection}>
                <Text style={styles.formSectionLabel}>1. Pilih Barang Inventaris:</Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.barangScrollPills}
                >
                  {inventoryData.barangList.map((item) => {
                    const isSelected = item.id === selectedBarang?.id;
                    return (
                      <TouchableOpacity
                        key={item.id}
                        style={[
                          styles.barangSelectPill,
                          isSelected && styles.barangSelectPillActive,
                        ]}
                        activeOpacity={0.7}
                        onPress={() => setSelectedBarangId(item.id)}
                      >
                        <Text
                          style={[
                            styles.barangSelectName,
                            isSelected && styles.barangSelectNameActive,
                          ]}
                          numberOfLines={1}
                        >
                          {item.nama_barang}
                        </Text>
                        <Text
                          style={[
                            styles.barangSelectSub,
                            isSelected && styles.barangSelectSubActive,
                          ]}
                        >
                          {item.kode_barang} • Stok: {item.stok} {item.satuan}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>

              {/* Field 2: Jumlah Unit */}
              <View style={styles.formSection}>
                <Text style={styles.formSectionLabel}>2. Jumlah Unit:</Text>
                <View style={styles.stepperContainer}>
                  <TouchableOpacity
                    style={styles.stepBtn}
                    activeOpacity={0.7}
                    onPress={() => changeJumlah(-1)}
                  >
                    <Feather name="minus" size={18} color="#1e293b" />
                  </TouchableOpacity>

                  <TextInput
                    style={styles.qtyInput}
                    keyboardType="number-pad"
                    value={jumlahInput}
                    onChangeText={setJumlahInput}
                    selectTextOnFocus
                  />

                  <TouchableOpacity
                    style={styles.stepBtn}
                    activeOpacity={0.7}
                    onPress={() => changeJumlah(1)}
                  >
                    <Feather name="plus" size={18} color="#1e293b" />
                  </TouchableOpacity>

                  {/* Quick Shortcut Buttons */}
                  <TouchableOpacity
                    style={styles.quickAddPill}
                    onPress={() => changeJumlah(5)}
                  >
                    <Text style={styles.quickAddText}>+5</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.quickAddPill}
                    onPress={() => changeJumlah(10)}
                  >
                    <Text style={styles.quickAddText}>+10</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Field 3: Keterangan / Keperluan */}
              <View style={styles.formSection}>
                <Text style={styles.formSectionLabel}>3. Catatan / Keperluan:</Text>
                <TextInput
                  style={styles.catatanInput}
                  placeholder="Contoh: Pengadaan Baru, Distribusi Ruang Lab..."
                  placeholderTextColor="#94a3b8"
                  value={catatanInput}
                  onChangeText={setCatatanInput}
                />
              </View>

              {/* Preview Kalkulasi Stok Otomatis */}
              {selectedBarang ? (
                <View
                  style={[
                    styles.calcPreviewCard,
                    isStokKurang && styles.calcPreviewCardError,
                  ]}
                >
                  <Text style={styles.calcPreviewTitle}>Ringkasan Perubahan Stok:</Text>
                  <View style={styles.calcRow}>
                    <Text style={styles.calcLabel}>Barang:</Text>
                    <Text style={styles.calcValue}>{selectedBarang.nama_barang}</Text>
                  </View>
                  <View style={styles.calcRow}>
                    <Text style={styles.calcLabel}>Stok Gudang Saat Ini:</Text>
                    <Text style={styles.calcValue}>
                      {selectedBarang.stok} {selectedBarang.satuan}
                    </Text>
                  </View>
                  <View style={styles.calcRow}>
                    <Text style={styles.calcLabel}>
                      Perubahan ({stokModalType === 'masuk' ? 'Masuk' : 'Keluar'}):
                    </Text>
                    <Text
                      style={[
                        styles.calcValue,
                        {
                          color: stokModalType === 'masuk' ? '#16a34a' : '#dc2626',
                          fontWeight: '800',
                        },
                      ]}
                    >
                      {stokModalType === 'masuk' ? `+${parsedJumlah}` : `-${parsedJumlah}`}{' '}
                      {selectedBarang.satuan}
                    </Text>
                  </View>
                  <View style={[styles.calcRow, styles.calcRowTotal]}>
                    <Text style={styles.calcTotalLabel}>Estimasi Stok Akhir:</Text>
                    <Text
                      style={[
                        styles.calcTotalValue,
                        isStokKurang && { color: '#dc2626' },
                      ]}
                    >
                      {estimasiStokAkhir} {selectedBarang.satuan}
                    </Text>
                  </View>

                  {/* Peringatan jika stok tidak cukup */}
                  {isStokKurang ? (
                    <View style={styles.errorWarnBox}>
                      <Feather name="alert-circle" size={14} color="#dc2626" />
                      <Text style={styles.errorWarnText}>
                        Jumlah melebihi stok yang tersedia saat ini!
                      </Text>
                    </View>
                  ) : null}
                </View>
              ) : null}
            </ScrollView>

            {/* Action Buttons */}
            <View style={styles.modalActionButtons}>
              <TouchableOpacity
                style={styles.modalBatalBtn}
                onPress={() => setStokModalType(null)}
              >
                <Text style={styles.modalBatalBtnText}>Batal</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.modalSubmitBtn,
                  {
                    backgroundColor:
                      stokModalType === 'masuk' ? '#16a34a' : '#dc2626',
                  },
                  isStokKurang && { opacity: 0.5 },
                ]}
                disabled={isStokKurang}
                onPress={handleSimpanTransaksi}
              >
                <Feather name="check" size={16} color="#ffffff" />
                <Text style={styles.modalSubmitBtnText}>
                  {stokModalType === 'masuk' ? 'Simpan Stok Masuk' : 'Simpan Stok Keluar'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ============================================================= */}
      {/* 1. MODAL MUTASI STOK LENGKAP                                  */}
      {/* ============================================================= */}
      <Modal
        visible={isMutasiModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setIsMutasiModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.sheetModalContent}>
            {/* Modal Header */}
            <View style={styles.sheetModalHeader}>
              <View style={styles.sheetHeaderLeft}>
                <View style={[styles.sheetIconCircle, { backgroundColor: '#eff6ff' }]}>
                  <MaterialCommunityIcons name="swap-vertical" size={22} color="#2563eb" />
                </View>
                <View>
                  <Text style={styles.sheetModalTitle}>Riwayat Mutasi Stok</Text>
                  <Text style={styles.sheetModalSubtitle}>
                    Total {inventoryData.transaksiList.length} aktivitas log pergerakan stok
                  </Text>
                </View>
              </View>
              <TouchableOpacity
                style={styles.sheetCloseBtn}
                onPress={() => setIsMutasiModalVisible(false)}
              >
                <Feather name="x" size={18} color="#64748b" />
              </TouchableOpacity>
            </View>

            {/* Filter Pills */}
            <View style={styles.mutasiFilterRow}>
              <TouchableOpacity
                style={[
                  styles.mutasiFilterPill,
                  mutasiFilter === 'semua' && styles.mutasiFilterPillActive,
                ]}
                onPress={() => setMutasiFilter('semua')}
              >
                <Text
                  style={[
                    styles.mutasiFilterText,
                    mutasiFilter === 'semua' && styles.mutasiFilterTextActive,
                  ]}
                >
                  Semua ({inventoryData.transaksiList.length})
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.mutasiFilterPill,
                  mutasiFilter === 'masuk' && styles.mutasiFilterPillActiveMasuk,
                ]}
                onPress={() => setMutasiFilter('masuk')}
              >
                <View style={[styles.filterDot, { backgroundColor: '#16a34a' }]} />
                <Text
                  style={[
                    styles.mutasiFilterText,
                    mutasiFilter === 'masuk' && styles.mutasiFilterTextActiveMasuk,
                  ]}
                >
                  Masuk ({countMutasiMasuk})
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.mutasiFilterPill,
                  mutasiFilter === 'keluar' && styles.mutasiFilterPillActiveKeluar,
                ]}
                onPress={() => setMutasiFilter('keluar')}
              >
                <View style={[styles.filterDot, { backgroundColor: '#dc2626' }]} />
                <Text
                  style={[
                    styles.mutasiFilterText,
                    mutasiFilter === 'keluar' && styles.mutasiFilterTextActiveKeluar,
                  ]}
                >
                  Keluar ({countMutasiKeluar})
                </Text>
              </TouchableOpacity>
            </View>

            {/* List Mutasi */}
            <ScrollView
              showsVerticalScrollIndicator={false}
              style={{ maxHeight: 380, marginVertical: 8 }}
            >
              {filteredMutasiList.length === 0 ? (
                <View style={styles.emptyMutasiBox}>
                  <Feather name="inbox" size={32} color="#94a3b8" />
                  <Text style={styles.emptyMutasiText}>
                    Belum ada riwayat mutasi untuk filter ini.
                  </Text>
                </View>
              ) : (
                filteredMutasiList.map((trx: TransaksiStok) => {
                  const isMasuk = trx.jenis === 'masuk';
                  return (
                    <View key={trx.id} style={styles.mutasiItemCard}>
                      <View
                        style={[
                          styles.mutasiTypeBadge,
                          { backgroundColor: isMasuk ? '#f0fdf4' : '#fef2f2' },
                        ]}
                      >
                        <Feather
                          name={isMasuk ? 'arrow-down-left' : 'arrow-up-right'}
                          size={18}
                          color={isMasuk ? '#16a34a' : '#ef4444'}
                        />
                      </View>
                      <View style={styles.mutasiItemInfo}>
                        <View style={styles.mutasiItemHeaderRow}>
                          <Text style={styles.mutasiItemName}>{trx.nama_barang}</Text>
                          <Text
                            style={[
                              styles.mutasiItemQty,
                              { color: isMasuk ? '#16a34a' : '#dc2626' },
                            ]}
                          >
                            {isMasuk ? `+${trx.jumlah}` : `-${trx.jumlah}`} {trx.satuan}
                          </Text>
                        </View>
                        <View style={styles.mutasiItemMetaRow}>
                          <Text style={styles.mutasiItemDate}>{trx.tanggal}</Text>
                          <Text style={styles.mutasiItemOperator}>
                            Oleh: {trx.operator} ({trx.role_operator})
                          </Text>
                        </View>
                        <Text style={styles.mutasiItemSisa}>
                          Sisa stok gudang: <Text style={styles.boldDark}>{trx.sisa_stok} {trx.satuan}</Text>
                        </Text>
                      </View>
                    </View>
                  );
                })
              )}
            </ScrollView>

            {/* Bottom Actions */}
            <View style={styles.sheetActionRow}>
              <TouchableOpacity
                style={[styles.sheetSecondaryBtn, { flex: 1 }]}
                onPress={() => {
                  setIsMutasiModalVisible(false);
                  openStokModal('masuk');
                }}
              >
                <Feather name="plus-circle" size={15} color="#16a34a" />
                <Text style={[styles.sheetSecondaryBtnText, { color: '#16a34a' }]}>
                  + Stok Masuk
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.sheetSecondaryBtn, { flex: 1 }]}
                onPress={() => {
                  setIsMutasiModalVisible(false);
                  openStokModal('keluar');
                }}
              >
                <Feather name="minus-circle" size={15} color="#dc2626" />
                <Text style={[styles.sheetSecondaryBtnText, { color: '#dc2626' }]}>
                  - Stok Keluar
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ============================================================= */}
      {/* 2. MODAL LAPORAN & VALUASI STOK                               */}
      {/* ============================================================= */}
      <Modal
        visible={isLaporanModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setIsLaporanModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.sheetModalContent}>
            {/* Modal Header */}
            <View style={styles.sheetModalHeader}>
              <View style={styles.sheetHeaderLeft}>
                <View style={[styles.sheetIconCircle, { backgroundColor: '#f0fdf4' }]}>
                  <Feather name="bar-chart-2" size={22} color="#16a34a" />
                </View>
                <View>
                  <Text style={styles.sheetModalTitle}>Laporan & Valuasi Stok</Text>
                  <Text style={styles.sheetModalSubtitle}>
                    Analisis nilai aset & kesehatan inventaris
                  </Text>
                </View>
              </View>
              <TouchableOpacity
                style={styles.sheetCloseBtn}
                onPress={() => setIsLaporanModalVisible(false)}
              >
                <Feather name="x" size={18} color="#64748b" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 420 }}>
              {/* Card 1: Valuasi Finansial */}
              <View style={styles.laporanFinanceCard}>
                <Text style={styles.laporanCardTitle}>Valuasi Finansial Stok</Text>
                
                <View style={styles.financeItemRow}>
                  <View>
                    <Text style={styles.financeLabel}>Total Aset Pengadaan (Beli):</Text>
                    <Text style={styles.financeBeliValue}>{formatRupiah(totalAsetBeli)}</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={styles.financeLabel}>Potensi Penjualan:</Text>
                    <Text style={styles.financeJualValue}>{formatRupiah(totalNilaiJual)}</Text>
                  </View>
                </View>

                <View style={styles.financeMarginBox}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text style={styles.financeMarginLabel}>Potensi Margin Keuntungan:</Text>
                    <View style={styles.marginPercentBadge}>
                      <Text style={styles.marginPercentText}>+{persentaseMargin}%</Text>
                    </View>
                  </View>
                  <Text style={styles.financeMarginValue}>{formatRupiah(potensiMargin)}</Text>
                </View>
              </View>

              {/* Card 2: Status Kesehatan Stok */}
              <View style={styles.laporanHealthCard}>
                <Text style={styles.laporanCardTitle}>Kesehatan Inventaris</Text>
                <View style={styles.healthStatsGrid}>
                  <View style={[styles.healthStatItem, { backgroundColor: '#f0fdf4', borderColor: '#bbf7d0' }]}>
                    <Text style={[styles.healthStatNumber, { color: '#16a34a' }]}>{summary.statusAman}</Text>
                    <Text style={styles.healthStatLabel}>Barang Aman</Text>
                  </View>
                  <View style={[styles.healthStatItem, { backgroundColor: '#fef3c7', borderColor: '#fde68a' }]}>
                    <Text style={[styles.healthStatNumber, { color: '#d97706' }]}>{summary.statusMenipis}</Text>
                    <Text style={styles.healthStatLabel}>Stok Menipis</Text>
                  </View>
                  <View style={[styles.healthStatItem, { backgroundColor: '#fee2e2', borderColor: '#fca5a5' }]}>
                    <Text style={[styles.healthStatNumber, { color: '#dc2626' }]}>{summary.statusHabis}</Text>
                    <Text style={styles.healthStatLabel}>Stok Habis</Text>
                  </View>
                </View>
              </View>

              {/* Card 3: Breakdown per Kategori */}
              <View style={styles.laporanCategoryCard}>
                <Text style={styles.laporanCardTitle}>Distribusi Aset per Kategori</Text>
                {kategoriSummary.map((kat) => (
                  <View key={kat.kategori} style={styles.kategoriRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.kategoriName}>{kat.kategori}</Text>
                      <Text style={styles.kategoriDetail}>
                        {kat.count} item • {kat.totalStok} unit fisik
                      </Text>
                    </View>
                    <Text style={styles.kategoriAsetValue}>{formatRupiah(kat.totalNilai)}</Text>
                  </View>
                ))}
              </View>
            </ScrollView>

            {/* Export Report Button */}
            <View style={styles.sheetActionRow}>
              <TouchableOpacity
                style={styles.exportReportBtn}
                activeOpacity={0.8}
                onPress={() => {
                  Alert.alert(
                    'Ekspor Laporan Berhasil',
                    `Ringkasan Inventaris EduStock:\n\n` +
                    `• Total Barang: ${summary.totalBarang} SKU\n` +
                    `• Total Unit Fisik: ${summary.totalStok} unit\n` +
                    `• Total Valuasi Beli: ${formatRupiah(totalAsetBeli)}\n` +
                    `• Potensi Penjualan: ${formatRupiah(totalNilaiJual)}\n` +
                    `• Estimasi Margin: ${formatRupiah(potensiMargin)} (+${persentaseMargin}%)\n\n` +
                    `Laporan siap dicetak atau dikirim ke manajemen logistik.`
                  );
                }}
              >
                <Feather name="download" size={16} color="#ffffff" />
                <Text style={styles.exportReportBtnText}>Unduh Laporan Inventaris</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ============================================================= */}
      {/* 3. MODAL MENU & PUSAT KONTROL PROFIL                          */}
      {/* ============================================================= */}
      <Modal
        visible={isMenuModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setIsMenuModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.sheetModalContent}>
            {/* Modal Header */}
            <View style={styles.sheetModalHeader}>
              <View style={styles.sheetHeaderLeft}>
                <View style={[styles.sheetIconCircle, { backgroundColor: '#f5f3ff' }]}>
                  <Feather name="grid" size={22} color="#7c3aed" />
                </View>
                <View>
                  <Text style={styles.sheetModalTitle}>Pusat Kontrol & Profil</Text>
                  <Text style={styles.sheetModalSubtitle}>
                    Manajemen akun, sesi JWT, dan peran demo
                  </Text>
                </View>
              </View>
              <TouchableOpacity
                style={styles.sheetCloseBtn}
                onPress={() => setIsMenuModalVisible(false)}
              >
                <Feather name="x" size={18} color="#64748b" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 420 }}>
              {/* User Identity Card */}
              <View style={styles.menuUserCard}>
                <View style={styles.menuAvatarCircle}>
                  <Text style={styles.menuAvatarText}>
                    {currentUser.name.charAt(0).toUpperCase()}
                  </Text>
                </View>
                <View style={styles.menuUserInfo}>
                  <Text style={styles.menuUserName}>{currentUser.name}</Text>
                  <Text style={styles.menuUserEmail}>{currentUser.email}</Text>
                  <View style={styles.menuRoleBadgeRow}>
                    <View style={styles.menuRoleBadge}>
                      <Text style={styles.menuRoleBadgeText}>{currentUser.role}</Text>
                    </View>
                    <View style={styles.menuVerifiedBadge}>
                      <Feather name="check" size={11} color="#16a34a" />
                      <Text style={styles.menuVerifiedText}>Terverifikasi</Text>
                    </View>
                  </View>
                </View>
              </View>

              {/* Fast Role Switcher */}
              <View style={styles.menuSectionBox}>
                <Text style={styles.menuSectionTitle}>SIMULASI GANTI PERAN PENGGUNA (ROLE DEMO):</Text>
                <View style={styles.roleSwitcherContainer}>
                  <TouchableOpacity
                    style={[
                      styles.roleSwitchCard,
                      currentUser.username === 'admin' && styles.roleSwitchCardActive,
                    ]}
                    activeOpacity={0.7}
                    onPress={() => handleQuickSwitchRole('admin')}
                  >
                    <View style={styles.roleSwitchLeft}>
                      <Feather
                        name="shield"
                        size={16}
                        color={currentUser.username === 'admin' ? '#2563eb' : '#64748b'}
                      />
                      <View style={{ marginLeft: 8 }}>
                        <Text style={[styles.roleSwitchName, currentUser.username === 'admin' && { color: '#2563eb', fontWeight: '800' }]}>
                          Admin Gudang
                        </Text>
                        <Text style={styles.roleSwitchUser}>Budi Santoso</Text>
                      </View>
                    </View>
                    {currentUser.username === 'admin' ? (
                      <View style={styles.activeCheckPill}>
                        <Feather name="check" size={12} color="#ffffff" />
                        <Text style={styles.activeCheckText}>Aktif</Text>
                      </View>
                    ) : (
                      <Text style={styles.switchRoleHint}>Pilih →</Text>
                    )}
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.roleSwitchCard,
                      currentUser.username === 'staff' && styles.roleSwitchCardActive,
                    ]}
                    activeOpacity={0.7}
                    onPress={() => handleQuickSwitchRole('staff')}
                  >
                    <View style={styles.roleSwitchLeft}>
                      <Feather
                        name="user-check"
                        size={16}
                        color={currentUser.username === 'staff' ? '#2563eb' : '#64748b'}
                      />
                      <View style={{ marginLeft: 8 }}>
                        <Text style={[styles.roleSwitchName, currentUser.username === 'staff' && { color: '#2563eb', fontWeight: '800' }]}>
                          Staff Logistik
                        </Text>
                        <Text style={styles.roleSwitchUser}>Siti Rahma</Text>
                      </View>
                    </View>
                    {currentUser.username === 'staff' ? (
                      <View style={styles.activeCheckPill}>
                        <Feather name="check" size={12} color="#ffffff" />
                        <Text style={styles.activeCheckText}>Aktif</Text>
                      </View>
                    ) : (
                      <Text style={styles.switchRoleHint}>Pilih →</Text>
                    )}
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.roleSwitchCard,
                      currentUser.username === 'manager' && styles.roleSwitchCardActive,
                    ]}
                    activeOpacity={0.7}
                    onPress={() => handleQuickSwitchRole('manager')}
                  >
                    <View style={styles.roleSwitchLeft}>
                      <Feather
                        name="briefcase"
                        size={16}
                        color={currentUser.username === 'manager' ? '#2563eb' : '#64748b'}
                      />
                      <View style={{ marginLeft: 8 }}>
                        <Text style={[styles.roleSwitchName, currentUser.username === 'manager' && { color: '#2563eb', fontWeight: '800' }]}>
                          Manager Operasional
                        </Text>
                        <Text style={styles.roleSwitchUser}>Ahmad Fauzi</Text>
                      </View>
                    </View>
                    {currentUser.username === 'manager' ? (
                      <View style={styles.activeCheckPill}>
                        <Feather name="check" size={12} color="#ffffff" />
                        <Text style={styles.activeCheckText}>Aktif</Text>
                      </View>
                    ) : (
                      <Text style={styles.switchRoleHint}>Pilih →</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>

              {/* Navigasi Cepat */}
              <View style={styles.menuSectionBox}>
                <Text style={styles.menuSectionTitle}>PINTASAN FITUR:</Text>
                <View style={styles.menuShortcutsRow}>
                  <TouchableOpacity
                    style={styles.menuShortcutBtn}
                    onPress={() => {
                      setIsMenuModalVisible(false);
                      router.push('/barang');
                    }}
                  >
                    <Feather name="box" size={18} color="#2563eb" />
                    <Text style={styles.menuShortcutText}>Katalog Barang</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.menuShortcutBtn}
                    onPress={() => {
                      setIsMenuModalVisible(false);
                      router.push('/scanner');
                    }}
                  >
                    <Feather name="camera" size={18} color="#7c3aed" />
                    <Text style={styles.menuShortcutText}>Scan Barcode</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.menuShortcutBtn}
                    onPress={handleTestAuthHeader}
                  >
                    <Feather name="shield" size={18} color="#0891b2" />
                    <Text style={styles.menuShortcutText}>Uji Bearer JWT</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </ScrollView>

            {/* Logout Action Button */}
            <View style={styles.sheetActionRow}>
              <TouchableOpacity
                style={styles.menuLogoutBtn}
                activeOpacity={0.8}
                onPress={() => {
                  setIsMenuModalVisible(false);
                  handleLogout();
                }}
              >
                <Feather name="log-out" size={16} color="#ffffff" />
                <Text style={styles.menuLogoutBtnText}>Keluar dari Akun (Logout)</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// ==========================================
// STYLESHEET (Dashboard Screen)
// ==========================================
const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f8fafc',
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    color: '#64748b',
    fontWeight: '600',
  },
  errorIconBadge: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#fee2e2',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  dashboardErrorTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0f172a',
    textAlign: 'center',
  },
  dashboardErrorSubtitle: {
    fontSize: 13,
    color: '#64748b',
    textAlign: 'center',
    paddingHorizontal: 30,
    lineHeight: 18,
  },
  dashboardRetryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#dc2626',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 24,
    marginTop: 8,
  },
  dashboardRetryBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
  safeArea: {
    flex: 1,
    backgroundColor: '#f8fafc',
    paddingTop: Platform.OS === 'android' ? RNStatusBar.currentHeight : 0,
  },
  dashHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  dashHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  miniLogoCube: {
    width: 26,
    height: 26,
    borderRadius: 7,
    backgroundColor: '#2563eb',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dashHeaderTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0f172a',
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#fff5f5',
    borderWidth: 1,
    borderColor: '#fee2e2',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  logoutBtnText: {
    color: '#ef4444',
    fontSize: 11,
    fontWeight: '700',
  },
  dashScrollView: {
    flex: 1,
  },
  dashScrollContent: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 20,
  },
  darkGreetingCard: {
    backgroundColor: '#0e192b',
    borderRadius: 20,
    padding: 16,
    marginBottom: 12,
  },
  darkCardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 14,
  },
  greetingName: {
    fontSize: 18,
    fontWeight: '800',
    color: '#ffffff',
  },
  greetingSub: {
    fontSize: 11,
    color: '#94a3b8',
    marginTop: 3,
  },
  greetingRightCol: {
    alignItems: 'flex-end',
    gap: 6,
  },
  roleBadge: {
    backgroundColor: '#172554',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 6,
  },
  roleBadgeText: {
    color: '#38bdf8',
    fontSize: 10.5,
    fontWeight: '700',
  },
  switchAccountBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#391b24',
    borderWidth: 1,
    borderColor: '#4f1d2b',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  switchAccountText: {
    color: '#f87171',
    fontSize: 10,
    fontWeight: '700',
  },
  statusChipsRow: {
    flexDirection: 'row',
    gap: 6,
  },
  chipItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#182234',
    borderWidth: 1,
    borderColor: '#243048',
    borderRadius: 20,
    paddingVertical: 5,
    gap: 5,
  },
  statusDot: {
    width: 6.5,
    height: 6.5,
    borderRadius: 3.5,
  },
  chipText: {
    color: '#e2e8f0',
    fontSize: 11,
    fontWeight: '600',
  },
  tokenCard: {
    backgroundColor: '#f0f9ff',
    borderWidth: 1,
    borderColor: '#bae6fd',
    borderRadius: 16,
    padding: 12,
    marginBottom: 12,
  },
  tokenCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  tokenBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  tokenTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0369a1',
  },
  activeTokenBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e0f2fe',
    borderWidth: 1,
    borderColor: '#7dd3fc',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 10,
    gap: 4,
  },
  activeDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#0284c7',
  },
  activeTokenText: {
    fontSize: 9.5,
    color: '#0369a1',
    fontWeight: '700',
  },
  tokenPreviewBox: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e0f2fe',
    borderRadius: 8,
    padding: 8,
    marginBottom: 6,
  },
  tokenLabel: {
    fontSize: 10,
    color: '#64748b',
    fontWeight: '600',
    marginBottom: 2,
  },
  tokenValue: {
    fontSize: 10.5,
    color: '#0f172a',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  tokenMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  tokenMetaText: {
    fontSize: 10,
    color: '#64748b',
  },
  tokenMetaBold: {
    fontWeight: '700',
    color: '#0369a1',
  },
  tokenToggleText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#0284c7',
  },
  testHeaderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#e0f2fe',
    borderWidth: 1,
    borderColor: '#bae6fd',
    borderRadius: 8,
    paddingVertical: 6,
    gap: 6,
  },
  testHeaderBtnText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#0369a1',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 12,
  },
  statCard: {
    width: '48%',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 16,
    padding: 12,
  },
  clickableStatCard: {
    borderColor: '#bfdbfe',
    backgroundColor: '#fbfdff',
  },
  statCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statIconBadge: {
    width: 30,
    height: 30,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statTitle: {
    fontSize: 11.5,
    fontWeight: '600',
    color: '#64748b',
  },
  statNumber: {
    fontSize: 24,
    fontWeight: '800',
    color: '#0f172a',
    marginVertical: 4,
  },
  statDesc: {
    fontSize: 10.5,
    color: '#94a3b8',
  },
  statLinkText: {
    fontSize: 10,
    color: '#2563eb',
    fontWeight: '700',
  },
  alertBox: {
    backgroundColor: '#ffeff3',
    borderWidth: 1,
    borderColor: '#fecdd3',
    borderRadius: 18,
    padding: 14,
    marginBottom: 14,
  },
  alertHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  alertHeaderTitle: {
    fontSize: 13.5,
    fontWeight: '800',
    color: '#991b1b',
  },
  alertHeaderDesc: {
    fontSize: 11,
    color: '#991b1b',
    marginTop: 4,
    marginBottom: 10,
    lineHeight: 15,
  },
  alertItemCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#fee2e2',
  },
  alertItemTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 6,
  },
  alertItemTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1e293b',
    flex: 1,
  },
  menipisBadge: {
    backgroundColor: '#fef3c7',
    borderWidth: 1,
    borderColor: '#fde68a',
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  menipisText: {
    color: '#b45309',
    fontSize: 9.5,
    fontWeight: '700',
  },
  alertItemSpecs: {
    fontSize: 10.5,
    color: '#64748b',
    marginTop: 4,
  },
  boldRed: {
    color: '#dc2626',
    fontWeight: '700',
  },
  sectionHeaderRow: {
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0f172a',
  },
  quickActionsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
  },
  actionBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    gap: 6,
  },
  actionCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionText: {
    fontSize: 11,
    fontWeight: '700',
  },
  activityHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  linkViewAll: {
    color: '#2563eb',
    fontSize: 11.5,
    fontWeight: '700',
  },
  activityCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingHorizontal: 12,
  },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  activityCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activityDetails: {
    flex: 1,
    gap: 2,
  },
  activityTopLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  activityItemName: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1e293b',
  },
  activityItemDiff: {
    fontSize: 11.5,
    fontWeight: '800',
  },
  activityBottomLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  activityMeta: {
    fontSize: 10,
    color: '#64748b',
  },
  activityRemain: {
    fontSize: 10,
    color: '#64748b',
  },
  bottomNav: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  navItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  navLabel: {
    fontSize: 9.5,
    fontWeight: '600',
    color: '#64748b',
  },

  // Styles Modal Transaksi Stok Masuk & Keluar
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'flex-end',
  },
  transaksiModalContent: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: Platform.OS === 'ios' ? 36 : 24,
    maxHeight: '85%',
  },
  transaksiModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  transaksiHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  transaksiIconCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  transaksiModalTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0f172a',
  },
  transaksiModalSubtitle: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 1,
  },
  transaksiCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  formSection: {
    marginBottom: 14,
  },
  formSectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 8,
  },
  barangScrollPills: {
    gap: 8,
    paddingBottom: 4,
  },
  barangSelectPill: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    minWidth: 140,
  },
  barangSelectPillActive: {
    backgroundColor: '#eff6ff',
    borderColor: '#2563eb',
  },
  barangSelectName: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: 2,
  },
  barangSelectNameActive: {
    color: '#2563eb',
  },
  barangSelectSub: {
    fontSize: 10,
    color: '#64748b',
  },
  barangSelectSubActive: {
    color: '#1d4ed8',
  },
  stepperContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  stepBtn: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  qtyInput: {
    width: 60,
    height: 40,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '800',
    color: '#0f172a',
  },
  quickAddPill: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderRadius: 10,
  },
  quickAddText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
  },
  catatanInput: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 42,
    fontSize: 12.5,
    color: '#0f172a',
  },
  calcPreviewCard: {
    backgroundColor: '#f8fafc',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 16,
  },
  calcPreviewCardError: {
    backgroundColor: '#fff5f5',
    borderColor: '#fca5a5',
  },
  calcPreviewTitle: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#475569',
    marginBottom: 8,
  },
  calcRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 3,
  },
  calcLabel: {
    fontSize: 11,
    color: '#64748b',
  },
  calcValue: {
    fontSize: 11,
    fontWeight: '600',
    color: '#1e293b',
  },
  calcRowTotal: {
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    marginTop: 4,
    paddingTop: 6,
  },
  calcTotalLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0f172a',
  },
  calcTotalValue: {
    fontSize: 13,
    fontWeight: '800',
    color: '#16a34a',
  },
  errorWarnBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
    backgroundColor: '#fee2e2',
    padding: 6,
    borderRadius: 6,
  },
  errorWarnText: {
    fontSize: 10.5,
    color: '#dc2626',
    fontWeight: '600',
  },
  modalActionButtons: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  modalBatalBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#f8fafc',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalBatalBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#64748b',
  },
  modalSubmitBtn: {
    flex: 2,
    flexDirection: 'row',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  modalSubmitBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#ffffff',
  },
  offlineAlertCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fffbeb',
    borderWidth: 1,
    borderColor: '#fde68a',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 14,
  },
  offlineAlertText: {
    flex: 1,
    fontSize: 12,
    color: '#92400e',
    fontWeight: '500',
    lineHeight: 18,
  },
  // -------------------------------------------------------------
  // STYLESHEET: MODAL SHEET (MUTASI, LAPORAN, MENU PROFIL)
  // -------------------------------------------------------------
  sheetModalContent: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: Platform.OS === 'ios' ? 36 : 24,
    maxHeight: '90%',
  },
  sheetModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  sheetHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  sheetIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetModalTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0f172a',
  },
  sheetModalSubtitle: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 1,
  },
  sheetCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetActionRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  sheetSecondaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#f8fafc',
  },
  sheetSecondaryBtnText: {
    fontSize: 13,
    fontWeight: '700',
  },
  // Mutasi Styles
  mutasiFilterRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
    marginBottom: 6,
  },
  mutasiFilterPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 20,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  mutasiFilterPillActive: {
    backgroundColor: '#eff6ff',
    borderColor: '#bfdbfe',
  },
  mutasiFilterPillActiveMasuk: {
    backgroundColor: '#f0fdf4',
    borderColor: '#bbf7d0',
  },
  mutasiFilterPillActiveKeluar: {
    backgroundColor: '#fef2f2',
    borderColor: '#fecaca',
  },
  filterDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  mutasiFilterText: {
    fontSize: 11.5,
    fontWeight: '600',
    color: '#64748b',
  },
  mutasiFilterTextActive: {
    color: '#2563eb',
    fontWeight: '700',
  },
  mutasiFilterTextActiveMasuk: {
    color: '#16a34a',
    fontWeight: '700',
  },
  mutasiFilterTextActiveKeluar: {
    color: '#dc2626',
    fontWeight: '700',
  },
  emptyMutasiBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 36,
    gap: 8,
  },
  emptyMutasiText: {
    fontSize: 12,
    color: '#94a3b8',
  },
  mutasiItemCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    gap: 12,
  },
  mutasiTypeBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  mutasiItemInfo: {
    flex: 1,
  },
  mutasiItemHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  mutasiItemName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0f172a',
    flex: 1,
    marginRight: 8,
  },
  mutasiItemQty: {
    fontSize: 13,
    fontWeight: '800',
  },
  mutasiItemMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 3,
  },
  mutasiItemDate: {
    fontSize: 10.5,
    color: '#94a3b8',
  },
  mutasiItemOperator: {
    fontSize: 10.5,
    color: '#64748b',
    fontWeight: '500',
  },
  mutasiItemSisa: {
    fontSize: 10.5,
    color: '#64748b',
    marginTop: 3,
  },
  boldDark: {
    fontWeight: '700',
    color: '#1e293b',
  },
  // Laporan Styles
  laporanFinanceCard: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 16,
    padding: 14,
    marginVertical: 8,
  },
  laporanCardTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 10,
  },
  financeItemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  financeLabel: {
    fontSize: 10.5,
    color: '#64748b',
    marginBottom: 2,
  },
  financeBeliValue: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0f172a',
  },
  financeJualValue: {
    fontSize: 14,
    fontWeight: '800',
    color: '#2563eb',
  },
  financeMarginBox: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  financeMarginLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#475569',
  },
  marginPercentBadge: {
    backgroundColor: '#dcfce7',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  marginPercentText: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#16a34a',
  },
  financeMarginValue: {
    fontSize: 16,
    fontWeight: '900',
    color: '#16a34a',
    marginTop: 4,
  },
  laporanHealthCard: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#f1f5f9',
    borderRadius: 16,
    padding: 14,
    marginBottom: 8,
  },
  healthStatsGrid: {
    flexDirection: 'row',
    gap: 8,
  },
  healthStatItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  healthStatNumber: {
    fontSize: 18,
    fontWeight: '800',
  },
  healthStatLabel: {
    fontSize: 10,
    color: '#64748b',
    fontWeight: '600',
    marginTop: 2,
  },
  laporanCategoryCard: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#f1f5f9',
    borderRadius: 16,
    padding: 14,
    marginBottom: 8,
  },
  kategoriRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f8fafc',
  },
  kategoriName: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#0f172a',
  },
  kategoriDetail: {
    fontSize: 10.5,
    color: '#64748b',
    marginTop: 1,
  },
  kategoriAsetValue: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0f172a',
  },
  exportReportBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#2563eb',
    paddingVertical: 13,
    borderRadius: 14,
  },
  exportReportBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
  // Menu Styles
  menuUserCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0e192b',
    borderRadius: 16,
    padding: 14,
    marginVertical: 8,
    gap: 14,
  },
  menuAvatarCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#2563eb',
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuAvatarText: {
    fontSize: 20,
    fontWeight: '900',
    color: '#ffffff',
  },
  menuUserInfo: {
    flex: 1,
  },
  menuUserName: {
    fontSize: 15,
    fontWeight: '800',
    color: '#ffffff',
  },
  menuUserEmail: {
    fontSize: 11,
    color: '#94a3b8',
    marginTop: 1,
  },
  menuRoleBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 6,
  },
  menuRoleBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  menuRoleBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#38bdf8',
  },
  menuVerifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(34, 197, 94, 0.15)',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
  },
  menuVerifiedText: {
    fontSize: 9.5,
    fontWeight: '700',
    color: '#4ade80',
  },
  menuSectionBox: {
    marginTop: 12,
  },
  menuSectionTitle: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#64748b',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  roleSwitcherContainer: {
    gap: 8,
  },
  roleSwitchCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  roleSwitchCardActive: {
    backgroundColor: '#eff6ff',
    borderColor: '#93c5fd',
  },
  roleSwitchLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  roleSwitchName: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#1e293b',
  },
  roleSwitchUser: {
    fontSize: 10.5,
    color: '#64748b',
  },
  activeCheckPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#2563eb',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  activeCheckText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#ffffff',
  },
  switchRoleHint: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748b',
  },
  menuShortcutsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  menuShortcutBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    paddingVertical: 12,
    gap: 6,
  },
  menuShortcutText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#334155',
    textAlign: 'center',
  },
  menuLogoutBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#dc2626',
    paddingVertical: 13,
    borderRadius: 14,
  },
  menuLogoutBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
});
