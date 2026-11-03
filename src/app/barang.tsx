import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  FlatList,
  Platform,
  StatusBar as RNStatusBar,
  ActivityIndicator,
  RefreshControl,
  Image,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';

// Import Model Data & Tipe Error
import { Barang, AppApiError } from '../types';

// Import Service API
import {
  fetchBarangList,
  setActiveMockCondition,
  getActiveMockCondition,
  MockCondition,
} from '../services/dataService';

/**
 * =========================================================================
 * TASK 01 - HANDLE API ERROR (src/app/barang.tsx)
 * Memenuhi Kriteria Rubrik Praktikum:
 * 1. Loading (Request): Menampilkan indikator memuat data saat request dikirim.
 *    - Indikator ActivityIndicator
 *    - Teks "Memuat data..." dan "Mohon tunggu sebentar"
 * 2. Success (2xx): Data HANYA ditampilkan ketika request berhasil (2xx).
 * 3. Client Error (4xx): Menampilkan error state kesalahan klien (misal 404 Data Tidak Ditemukan).
 * 4. Server Error (5xx): Menampilkan error state kesalahan server (misal 500 Terjadi Kesalahan pada Server).
 * 5. Request Gagal: Menampilkan error state koneksi jaringan / network error.
 * 6. Terdapat tombol Coba Lagi (Retry Button) berwarna merah untuk mengulang request.
 * 7. Data TIDAK ditampilkan ketika request gagal (data list dikosongkan).
 * =========================================================================
 */
export default function BarangScreen() {
  // -----------------------------------------------------------------------
  // 1. STATE SIKLUS API (Loading, Success, Error)
  // -----------------------------------------------------------------------
  const [barangList, setBarangList] = useState<Barang[]>([]); // Data master barang (hanya terisi saat 2xx)
  const [filteredList, setFilteredList] = useState<Barang[]>([]); // Data setelah pencarian/kategori
  const [searchQuery, setSearchQuery] = useState<string>(''); // Kata kunci pencarian
  const [selectedCategory, setSelectedCategory] = useState<string>('Semua'); // Filter kategori
  const [isLoading, setIsLoading] = useState<boolean>(true); // Status loading saat fetch
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false); // Pull to refresh
  const [error, setError] = useState<AppApiError | null>(null); // State API Error (4xx, 5xx, Network Error)

  // Mode Pengujian Rubrik Task 01: '2xx' | '4xx' | '5xx' | 'network' | 'none'
  const [currentMode, setCurrentMode] = useState<MockCondition>(() => getActiveMockCondition());
  const [showTestBar, setShowTestBar] = useState<boolean>(true); // Toggle panel uji evaluasi tugas

  // Ref penanda proses fetch sedang berjalan untuk proteksi anti-loop
  const isFetchingRef = useRef<boolean>(false);

  // -----------------------------------------------------------------------
  // 2. FUNGSI LOAD DATA DENGAN ERROR HANDLING
  // -----------------------------------------------------------------------
  const loadData = useCallback(async () => {
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;
    setIsLoading(true);
    setError(null);

    try {
      const result = await fetchBarangList();
      if (result.error) {
        // [Rubrik]: Data TIDAK ditampilkan ketika request gagal
        setBarangList([]);
        setError(result.error);
      } else {
        // [Rubrik]: Data HANYA ditampilkan ketika request berhasil (2xx)
        setBarangList(result.data);
        setError(null);
      }
    } catch (err: any) {
      console.log('API Error: ', err);
      setBarangList([]);
      setError({
        kind: 'NETWORK_ERROR',
        title: 'Koneksi Jaringan Gagal',
        message: err?.message || 'Terjadi kesalahan saat memuat data dari server.',
      });
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
      isFetchingRef.current = false;
    }
  }, []);

  // Inisialisasi saat pertama kali layar dibuka
  useEffect(() => {
    let isMounted = true;
    async function init() {
      setIsLoading(true);
      setError(null);
      try {
        const result = await fetchBarangList();
        if (isMounted) {
          if (result.error) {
            setBarangList([]);
            setError(result.error);
          } else {
            setBarangList(result.data);
            setError(null);
          }
        }
      } catch (err: any) {
        console.log('API Error: ', err);
        if (isMounted) {
          setBarangList([]);
          setError({
            kind: 'NETWORK_ERROR',
            title: 'Koneksi Jaringan Gagal',
            message: err?.message || 'Terjadi kesalahan saat memuat data dari server.',
          });
        }
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

  // -----------------------------------------------------------------------
  // 3. EFFECT FILTER & SEARCH (Hanya Berjalan Saat Data 2xx Tersedia)
  // -----------------------------------------------------------------------
  useEffect(() => {
    let result = [...barangList];

    if (selectedCategory !== 'Semua') {
      result = result.filter((item) => item.kategori === selectedCategory);
    }

    if (searchQuery.trim() !== '') {
      const query = searchQuery.toLowerCase().trim();
      result = result.filter(
        (item) =>
          item.nama_barang.toLowerCase().includes(query) ||
          item.kode_barang.toLowerCase().includes(query) ||
          item.lokasi_rak.toLowerCase().includes(query) ||
          (item.deskripsi && item.deskripsi.toLowerCase().includes(query))
      );
    }

    setFilteredList(result);
  }, [searchQuery, selectedCategory, barangList]);

  // Handler Pull to Refresh
  const onRefresh = async () => {
    setIsRefreshing(true);
    await loadData();
  };

  // Handler Penggantian Skenario Uji Task 01 (2xx, 4xx, 5xx, Network)
  const handleChangeMode = async (mode: MockCondition) => {
    setCurrentMode(mode);
    setActiveMockCondition(mode);
    await loadData();
  };

  // Kategori dinamis
  const availableCategories = ['Semua', ...Array.from(new Set(barangList.map((b) => b.kategori)))];

  // Hitung status stok
  const countAman = filteredList.filter((b) => b.status_stok === 'Aman').length;
  const countMenipis = filteredList.filter((b) => b.status_stok === 'Menipis').length;
  const countHabis = filteredList.filter((b) => b.status_stok === 'Habis').length;

  // Format Rupiah
  const formatRupiah = (num: number) => {
    return 'Rp ' + Number(num).toLocaleString('id-ID');
  };

  // Render Kartu Barang untuk FlatList
  const renderItem = ({ item }: { item: Barang }) => {
    const isHabis = item.status_stok === 'Habis';
    const isMenipis = item.status_stok === 'Menipis';

    const badgeBg = isHabis ? '#fee2e2' : isMenipis ? '#fef3c7' : '#dcfce7';
    const badgeText = isHabis ? '#dc2626' : isMenipis ? '#b45309' : '#15803d';
    const dotColor = isHabis ? '#ef4444' : isMenipis ? '#f59e0b' : '#22c55e';

    return (
      <View style={styles.card}>
        <View style={styles.cardMainRow}>
          {/* Gambar Thumbnail Produk */}
          <View style={styles.productImageWrapper}>
            {item.gambar ? (
              <Image
                source={{ uri: item.gambar }}
                style={styles.productImage}
                resizeMode="cover"
              />
            ) : (
              <View style={styles.productImagePlaceholder}>
                <Feather name="box" size={24} color="#94a3b8" />
              </View>
            )}
            <View style={[styles.statusBadgeOverlay, { backgroundColor: badgeBg }]}>
              <View style={[styles.statusDot, { backgroundColor: dotColor }]} />
              <Text style={[styles.statusText, { color: badgeText }]}>{item.status_stok}</Text>
            </View>
          </View>

          {/* Info Detail Produk */}
          <View style={styles.cardContentRight}>
            <View style={styles.cardMetaRow}>
              <View style={styles.metaChip}>
                <Text style={styles.metaChipText}>{item.kode_barang}</Text>
              </View>
              <View style={styles.metaChip}>
                <Text style={styles.metaChipText}>{item.kategori}</Text>
              </View>
            </View>

            <Text style={styles.cardTitle} numberOfLines={2}>
              {item.nama_barang}
            </Text>

            {item.deskripsi ? (
              <Text style={styles.cardDescription} numberOfLines={2}>
                {item.deskripsi}
              </Text>
            ) : null}

            <View style={styles.metaLocationRow}>
              <Feather name="map-pin" size={11} color="#64748b" />
              <Text style={styles.metaLocationText}>{item.lokasi_rak}</Text>
            </View>
          </View>
        </View>

        {/* Divider */}
        <View style={styles.cardDivider} />

        {/* Baris Informasi Stok & Harga */}
        <View style={styles.cardBottomRow}>
          <View>
            <Text style={styles.infoLabel}>Jumlah Stok</Text>
            <Text style={[styles.stokValue, isHabis && styles.stokRed, isMenipis && styles.stokOrange]}>
              {item.stok} <Text style={styles.satuanText}>{item.satuan}</Text>
            </Text>
            <Text style={styles.stokMinimumText}>Min: {item.stok_minimum} {item.satuan}</Text>
          </View>

          <View style={styles.priceContainer}>
            <Text style={styles.infoLabel}>Harga Jual</Text>
            <Text style={styles.priceValue}>{formatRupiah(item.harga_jual)}</Text>
            <Text style={styles.priceBeliText}>Beli: {formatRupiah(item.harga_beli)}</Text>
          </View>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* ----------------------------------------------------------------- */}
      {/* HEADER SCREEN & TOMBOL NAVIGASI                                   */}
      {/* ----------------------------------------------------------------- */}
      <View style={styles.topBar}>
        <TouchableOpacity
          style={styles.backButton}
          activeOpacity={0.7}
          onPress={() => router.back()}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Feather name="arrow-left" size={20} color="#0f172a" />
        </TouchableOpacity>

        <View style={styles.headerTitleWrap}>
          <Text style={styles.headerTitle}>Daftar Barang</Text>
          <Text style={styles.headerSubtitle}>Katalog Inventaris EduStock</Text>
        </View>

        {/* Tombol Toggle Panel Pengujian Rubrik */}
        <TouchableOpacity
          style={[styles.testMenuBtn, showTestBar && styles.testMenuBtnActive]}
          activeOpacity={0.7}
          onPress={() => setShowTestBar((prev) => !prev)}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <MaterialCommunityIcons
            name="tune-variant"
            size={18}
            color={showTestBar ? '#2563eb' : '#64748b'}
          />
        </TouchableOpacity>
      </View>

      {/* ----------------------------------------------------------------- */}
      {/* PANEL PENGUJIAN SKENARIO TASK 01 - HANDLE API ERROR               */}
      {/* Mempermudah Mahasiswa Memperagakan 2xx, 4xx, 5xx, Network Error   */}
      {/* ----------------------------------------------------------------- */}
      {showTestBar && (
        <View style={styles.testModeBar}>
          <View style={styles.testModeHeader}>
            <Text style={styles.testModeLabel}>PILIH RESPON API UNTUK PENGUJIAN:</Text>
            <TouchableOpacity
              onPress={() => setShowTestBar(false)}
              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
            >
              <Feather name="x" size={13} color="#94a3b8" />
            </TouchableOpacity>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.testModeChips}
          >
            {/* Opsi 1: 2xx Success */}
            <TouchableOpacity
              style={[
                styles.testChip,
                currentMode === '2xx' && styles.testChipActive2xx,
              ]}
              activeOpacity={0.7}
              onPress={() => handleChangeMode('2xx')}
            >
              <MaterialCommunityIcons
                name="check-circle"
                size={14}
                color={currentMode === '2xx' ? '#ffffff' : '#16a34a'}
              />
              <Text
                style={[
                  styles.testChipText,
                  currentMode === '2xx' && styles.testChipTextActive,
                ]}
              >
                2xx (Sukses)
              </Text>
            </TouchableOpacity>

            {/* Opsi 2: 4xx Client Error */}
            <TouchableOpacity
              style={[
                styles.testChip,
                currentMode === '4xx' && styles.testChipActive4xx,
              ]}
              activeOpacity={0.7}
              onPress={() => handleChangeMode('4xx')}
            >
              <MaterialCommunityIcons
                name="alert-circle"
                size={14}
                color={currentMode === '4xx' ? '#ffffff' : '#ea580c'}
              />
              <Text
                style={[
                  styles.testChipText,
                  currentMode === '4xx' && styles.testChipTextActive,
                ]}
              >
                4xx (Client Error)
              </Text>
            </TouchableOpacity>

            {/* Opsi 3: 5xx Server Error */}
            <TouchableOpacity
              style={[
                styles.testChip,
                currentMode === '5xx' && styles.testChipActive5xx,
              ]}
              activeOpacity={0.7}
              onPress={() => handleChangeMode('5xx')}
            >
              <MaterialCommunityIcons
                name="server"
                size={14}
                color={currentMode === '5xx' ? '#ffffff' : '#dc2626'}
              />
              <Text
                style={[
                  styles.testChipText,
                  currentMode === '5xx' && styles.testChipTextActive,
                ]}
              >
                5xx (Server Error)
              </Text>
            </TouchableOpacity>

            {/* Opsi 4: Request Gagal / Network Error */}
            <TouchableOpacity
              style={[
                styles.testChip,
                currentMode === 'network' && styles.testChipActiveNetwork,
              ]}
              activeOpacity={0.7}
              onPress={() => handleChangeMode('network')}
            >
              <MaterialCommunityIcons
                name="wifi-off"
                size={14}
                color={currentMode === 'network' ? '#ffffff' : '#475569'}
              />
              <Text
                style={[
                  styles.testChipText,
                  currentMode === 'network' && styles.testChipTextActive,
                ]}
              >
                Request Gagal
              </Text>
            </TouchableOpacity>

            {/* Opsi 5: Real Backend API */}
            <TouchableOpacity
              style={[
                styles.testChip,
                currentMode === 'none' && styles.testChipActiveReal,
              ]}
              activeOpacity={0.7}
              onPress={() => handleChangeMode('none')}
            >
              <MaterialCommunityIcons
                name="api"
                size={14}
                color={currentMode === 'none' ? '#ffffff' : '#2563eb'}
              />
              <Text
                style={[
                  styles.testChipText,
                  currentMode === 'none' && styles.testChipTextActive,
                ]}
              >
                Real Backend
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      )}

      {/* ----------------------------------------------------------------- */}
      {/* BODY SCREEN: MENAMPILKAN KONDISI SESUAI RUBRIK TASK 01            */}
      {/* ----------------------------------------------------------------- */}

      {/* KONDISI 1: LOADING STATE (Sesuai Slide Rubrik) */}
      {isLoading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#2563eb" />
          <Text style={styles.loadingTitle}>Memuat data...</Text>
          <Text style={styles.loadingSubtitle}>Mohon tunggu sebentar</Text>
        </View>
      ) : error ? (
        /* KONDISI 2: ERROR STATE (4xx Client Error / 5xx Server Error / Request Gagal) */
        <View style={styles.errorStateContainer}>
          {/* Ikon Lingkaran Visual Sesuai Mockup Slide Tugas */}
          <View
            style={[
              styles.errorIconCircle,
              error.kind === '4xx' && styles.errorIconCircle4xx,
              error.kind === '5xx' && styles.errorIconCircle5xx,
              error.kind === 'NETWORK_ERROR' && styles.errorIconCircleNetwork,
            ]}
          >
            {error.kind === '4xx' ? (
              <MaterialCommunityIcons name="emoticon-sad-outline" size={62} color="#ea580c" />
            ) : error.kind === '5xx' ? (
              <MaterialCommunityIcons name="server-network" size={56} color="#dc2626" />
            ) : (
              <MaterialCommunityIcons name="wifi-off" size={56} color="#475569" />
            )}
          </View>

          {/* Judul & Pesan Kesalahan Jelas Sesuai Slide Tugas */}
          <Text style={styles.errorStateTitle}>{error.title}</Text>
          <Text style={styles.errorStateMessage}>{error.message}</Text>

          {/* [Rubrik]: Terdapat tombol Coba Lagi (Retry Button) Berwarna Merah */}
          <TouchableOpacity
            style={styles.retryButton}
            activeOpacity={0.8}
            onPress={loadData}
          >
            <Text style={styles.retryButtonText}>Coba Lagi</Text>
          </TouchableOpacity>
        </View>
      ) : (
        /* KONDISI 3: SUCCESS (2xx) - Data HANYA ditampilkan ketika request berhasil */
        <>
          {/* Input Pencarian & Scan Kamera */}
          <View style={styles.searchSection}>
            <View style={styles.searchBar}>
              <Feather name="search" size={17} color="#94a3b8" style={{ marginRight: 8 }} />
              <TextInput
                style={styles.searchInput}
                placeholder="Cari nama, kode barang, atau spesifikasi..."
                placeholderTextColor="#94a3b8"
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Feather name="x-circle" size={16} color="#94a3b8" style={{ marginRight: 6 }} />
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={styles.scanCameraIconBtn}
                activeOpacity={0.7}
                onPress={() => router.push('/scanner')}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Feather name="camera" size={18} color="#2563eb" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Filter Kategori */}
          <View style={styles.categoriesContainer}>
            <FlatList
              horizontal
              showsHorizontalScrollIndicator={false}
              data={availableCategories}
              keyExtractor={(item) => item}
              contentContainerStyle={styles.categoryList}
              renderItem={({ item }) => {
                const isSelected = selectedCategory === item;
                return (
                  <TouchableOpacity
                    style={[styles.categoryPill, isSelected && styles.categoryPillActive]}
                    activeOpacity={0.7}
                    onPress={() => setSelectedCategory(item)}
                  >
                    <Text
                      style={[
                        styles.categoryPillText,
                        isSelected && styles.categoryPillTextActive,
                      ]}
                    >
                      {item}
                    </Text>
                  </TouchableOpacity>
                );
              }}
            />
          </View>

          {/* Bar Ringkasan */}
          <View style={styles.summaryBar}>
            <Text style={styles.summaryCountText}>
              Ditemukan: <Text style={styles.boldText}>{filteredList.length}</Text> dari {barangList.length} barang
            </Text>
            <View style={styles.miniStatsRow}>
              <View style={[styles.miniDot, { backgroundColor: '#22c55e' }]} />
              <Text style={styles.miniStatText}>{countAman}</Text>
              <View style={[styles.miniDot, { backgroundColor: '#f59e0b', marginLeft: 6 }]} />
              <Text style={styles.miniStatText}>{countMenipis}</Text>
              <View style={[styles.miniDot, { backgroundColor: '#ef4444', marginLeft: 6 }]} />
              <Text style={styles.miniStatText}>{countHabis}</Text>
            </View>
          </View>

          {/* Daftar Barang FlatList dengan Pull to Refresh */}
          <FlatList
            data={filteredList}
            keyExtractor={(item) => String(item.id)}
            renderItem={renderItem}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={isRefreshing}
                onRefresh={onRefresh}
                colors={['#2563eb']}
              />
            }
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <View style={styles.emptyIconCircle}>
                  <Feather name="inbox" size={36} color="#94a3b8" />
                </View>
                <Text style={styles.emptyTitle}>Tidak ada barang yang cocok</Text>
                <Text style={styles.emptySubtitle}>
                  Coba gunakan kata kunci lain atau ubah filter kategori.
                </Text>
              </View>
            }
          />
        </>
      )}

      {/* Bottom Sticky Action Bar */}
      <View style={styles.bottomBar}>
        <TouchableOpacity
          style={styles.backHomeBtn}
          activeOpacity={0.8}
          onPress={() => router.back()}
        >
          <Ionicons name="home-outline" size={16} color="#2563eb" />
          <Text style={styles.backHomeText}>Kembali ke Dashboard</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

// ==========================================
// STYLESHEET
// ==========================================
const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f8fafc',
    paddingTop: Platform.OS === 'android' ? RNStatusBar.currentHeight : 0,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    gap: 12,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitleWrap: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0f172a',
  },
  headerSubtitle: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 1,
  },
  testMenuBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  testMenuBtnActive: {
    backgroundColor: '#eff6ff',
    borderColor: '#bfdbfe',
  },

  // --------------------------------------------------
  // Bar Pengujian Mode Respon Task 01
  // --------------------------------------------------
  testModeBar: {
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    paddingTop: 8,
    paddingBottom: 8,
  },
  testModeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 6,
  },
  testModeLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#64748b',
    letterSpacing: 0.5,
  },
  testModeChips: {
    paddingHorizontal: 16,
    gap: 8,
  },
  testChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 18,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    gap: 6,
  },
  testChipActive2xx: {
    backgroundColor: '#16a34a',
    borderColor: '#16a34a',
  },
  testChipActive4xx: {
    backgroundColor: '#ea580c',
    borderColor: '#ea580c',
  },
  testChipActive5xx: {
    backgroundColor: '#dc2626',
    borderColor: '#dc2626',
  },
  testChipActiveNetwork: {
    backgroundColor: '#475569',
    borderColor: '#475569',
  },
  testChipActiveReal: {
    backgroundColor: '#2563eb',
    borderColor: '#2563eb',
  },
  testChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
  },
  testChipTextActive: {
    color: '#ffffff',
  },

  // --------------------------------------------------
  // State 1: Loading
  // --------------------------------------------------
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 30,
  },
  loadingTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
    marginTop: 14,
  },
  loadingSubtitle: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 4,
  },

  // --------------------------------------------------
  // State 2: Error (Sesuai Mockup Slide Rubrik)
  // --------------------------------------------------
  errorStateContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingVertical: 40,
  },
  errorIconCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  errorIconCircle4xx: {
    backgroundColor: '#fff7ed',
    borderWidth: 2,
    borderColor: '#fed7aa',
  },
  errorIconCircle5xx: {
    backgroundColor: '#fef2f2',
    borderWidth: 2,
    borderColor: '#fecaca',
  },
  errorIconCircleNetwork: {
    backgroundColor: '#f1f5f9',
    borderWidth: 2,
    borderColor: '#e2e8f0',
  },
  errorStateTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0f172a',
    textAlign: 'center',
    marginBottom: 8,
  },
  errorStateMessage: {
    fontSize: 13,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 28,
  },
  retryButton: {
    width: '100%',
    maxWidth: 280,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ef4444',
    borderRadius: 12,
    shadowColor: '#ef4444',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 3,
  },
  retryButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#ffffff',
  },

  // --------------------------------------------------
  // State 3: Success (2xx)
  // --------------------------------------------------
  searchSection: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
    backgroundColor: '#ffffff',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 44,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: '#0f172a',
  },
  scanCameraIconBtn: {
    paddingLeft: 8,
    paddingVertical: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  categoriesContainer: {
    backgroundColor: '#ffffff',
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  categoryList: {
    paddingHorizontal: 16,
    gap: 8,
  },
  categoryPill: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  categoryPillActive: {
    backgroundColor: '#2563eb',
    borderColor: '#2563eb',
  },
  categoryPillText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
  },
  categoryPillTextActive: {
    color: '#ffffff',
    fontWeight: '700',
  },
  summaryBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#f8fafc',
  },
  summaryCountText: {
    fontSize: 11.5,
    color: '#64748b',
  },
  boldText: {
    fontWeight: '700',
    color: '#0f172a',
  },
  miniStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  miniDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  miniStatText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#475569',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 20,
    gap: 10,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  cardMainRow: {
    flexDirection: 'row',
    gap: 12,
  },
  productImageWrapper: {
    width: 90,
    height: 90,
    borderRadius: 12,
    backgroundColor: '#f1f5f9',
    overflow: 'hidden',
    position: 'relative',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  productImage: {
    width: '100%',
    height: '100%',
  },
  productImagePlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f8fafc',
  },
  statusBadgeOverlay: {
    position: 'absolute',
    bottom: 3,
    left: 3,
    right: 3,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 6,
    gap: 3,
  },
  statusDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  statusText: {
    fontSize: 9.5,
    fontWeight: '700',
  },
  cardContentRight: {
    flex: 1,
    justifyContent: 'space-between',
  },
  cardTitle: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#0f172a',
    lineHeight: 18,
    marginTop: 2,
  },
  cardDescription: {
    fontSize: 11,
    color: '#64748b',
    lineHeight: 15,
    marginTop: 2,
    marginBottom: 4,
  },
  metaLocationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  cardMetaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 6,
  },
  metaChip: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  metaChipText: {
    fontSize: 10.5,
    fontWeight: '600',
    color: '#64748b',
  },
  metaLocationText: {
    fontSize: 10.5,
    color: '#475569',
    fontWeight: '600',
  },
  cardDivider: {
    height: 1,
    backgroundColor: '#f1f5f9',
    marginBottom: 10,
  },
  cardBottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  infoLabel: {
    fontSize: 10,
    color: '#94a3b8',
    fontWeight: '600',
    marginBottom: 2,
  },
  stokValue: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0f172a',
  },
  stokRed: {
    color: '#dc2626',
  },
  stokOrange: {
    color: '#d97706',
  },
  satuanText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748b',
  },
  stokMinimumText: {
    fontSize: 10,
    color: '#94a3b8',
    marginTop: 2,
  },
  priceContainer: {
    alignItems: 'flex-end',
  },
  priceValue: {
    fontSize: 14,
    fontWeight: '800',
    color: '#2563eb',
  },
  priceBeliText: {
    fontSize: 10,
    color: '#94a3b8',
    marginTop: 2,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    paddingHorizontal: 20,
  },
  emptyIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: 4,
  },
  emptySubtitle: {
    fontSize: 12,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 18,
  },
  bottomBar: {
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  backHomeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f0f7ff',
    borderWidth: 1,
    borderColor: '#bfdbfe',
    borderRadius: 10,
    paddingVertical: 10,
    gap: 8,
  },
  backHomeText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#2563eb',
  },
});
