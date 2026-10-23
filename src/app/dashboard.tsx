import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  Platform,
  StatusBar as RNStatusBar,
  Alert,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';

// Import Types
import {
  User,
  Barang,
  TransaksiStok,
  AuthSession,
} from '../types';

// Import Services
import {
  logout,
  getSavedSession,
  getAuthHeader,
} from '../services/authService';
import { getLoadedInventoryData } from '../services/dataService';

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

  // State untuk toggle visibilitas rincian token JWT
  const [showTokenDetails, setShowTokenDetails] = useState<boolean>(false);

  const { summary, alertItems, transaksiList } = inventoryData;

  // -----------------------------------------------------------------------
  // PENERAPAN EFFECT (useEffect)
  // Dijalankan saat pertama kali Dashboard dipasang (mount) ke layar ([]).
  // -----------------------------------------------------------------------
  const loadDashboardData = useCallback(async () => {
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
    } catch (error) {
      console.warn('Gagal memuat data dashboard:', error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

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

  // Tampilan Loading Screen Awal
  if (isLoading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2563eb" />
        <Text style={styles.loadingText}>Memuat Dashboard EduStock...</Text>
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
          {/* Stok Masuk */}
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: '#f0fdf4', borderColor: '#bbf7d0' }]}
            onPress={() => Alert.alert('Aksi Cepat', 'Formulir Stok Masuk Gudang')}
          >
            <View style={[styles.actionCircle, { backgroundColor: '#16a34a' }]}>
              <Feather name="plus" size={18} color="#ffffff" />
            </View>
            <Text style={[styles.actionText, { color: '#16a34a' }]}>Stok Masuk</Text>
          </TouchableOpacity>

          {/* Stok Keluar */}
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: '#fef2f2', borderColor: '#fecaca' }]}
            onPress={() => Alert.alert('Aksi Cepat', 'Formulir Pengeluaran Stok')}
          >
            <View style={[styles.actionCircle, { backgroundColor: '#dc2626' }]}>
              <Feather name="minus" size={18} color="#ffffff" />
            </View>
            <Text style={[styles.actionText, { color: '#dc2626' }]}>Stok Keluar</Text>
          </TouchableOpacity>

          {/* Buka Daftar Barang (router.push) */}
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: '#eff6ff', borderColor: '#bfdbfe' }]}
            onPress={() => router.push('/barang')}
          >
            <View style={[styles.actionCircle, { backgroundColor: '#2563eb' }]}>
              <Feather name="box" size={18} color="#ffffff" />
            </View>
            <Text style={[styles.actionText, { color: '#2563eb' }]}>Daftar Barang</Text>
          </TouchableOpacity>
        </View>

        {/* Aktivitas Stok Terbaru */}
        <View style={styles.activityHeaderRow}>
          <Text style={styles.sectionTitle}>Aktivitas Stok Terbaru</Text>
          <TouchableOpacity onPress={() => router.push('/barang')}>
            <Text style={styles.linkViewAll}>Lihat Barang →</Text>
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
          onPress={() => Alert.alert('Mutasi Stok', 'Riwayat pergerakan stok barang.')}
        >
          <MaterialCommunityIcons name="swap-vertical" size={22} color="#64748b" />
          <Text style={styles.navLabel}>Mutasi Stok</Text>
        </TouchableOpacity>

        {/* Tab 4: Laporan */}
        <TouchableOpacity
          style={styles.navItem}
          onPress={() => Alert.alert('Laporan', 'Laporan inventaris & rekap per periode.')}
        >
          <Feather name="file-text" size={22} color="#64748b" />
          <Text style={styles.navLabel}>Laporan</Text>
        </TouchableOpacity>

        {/* Tab 5: Menu Profil */}
        <TouchableOpacity
          style={styles.navItem}
          onPress={() =>
            Alert.alert(
              'Profil EduStock',
              `Pengguna: ${currentUser.name}\nRole: ${currentUser.role}\nEmail: ${currentUser.email}`
            )
          }
        >
          <Feather name="grid" size={22} color="#64748b" />
          <Text style={styles.navLabel}>Menu</Text>
        </TouchableOpacity>
      </View>
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
});
