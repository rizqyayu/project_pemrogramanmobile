import React, { useState, useEffect, useCallback } from 'react';
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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather, Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';

// Import Model Data
import { Barang } from '../types';

// Import Service API & Data
import { fetchBarangList } from '../services/dataService';

/**
 * =========================================================================
 * HALAMAN 3: DAFTAR BARANG (src/app/barang.tsx)
 * Memenuhi Kriteria Modul 2:
 * 1. useState:
 *    - barangList: Menyimpan kumpulan data barang master.
 *    - filteredList: Menyimpan data barang setelah disaring.
 *    - searchQuery: Menyimpan teks pencarian secara reaktif.
 *    - selectedCategory: Menyimpan kategori filter yang aktif.
 *    - isLoading & isRefreshing: Mengatur indikator pemuatan data.
 *    - dataSource: Menandai apakah data dari Backend PHP XAMPP atau Local Cache.
 * 2. useEffect:
 *    - Effect 1 ([]): Memuat data barang dari API backend saat halaman dibuka.
 *    - Effect 2 ([searchQuery, selectedCategory, barangList]):
 *      Menjalankan filter reaktif secara otomatis setiap kali kata kunci atau kategori berubah.
 * 3. Expo Router:
 *    - router.back(): Navigasi kembali ke halaman sebelumnya (Dashboard) dari tumpukan stack.
 * =========================================================================
 */
export default function BarangScreen() {
  // -----------------------------------------------------------------------
  // 1. PENERAPAN STATE (useState)
  // -----------------------------------------------------------------------
  const [barangList, setBarangList] = useState<Barang[]>([]); // Data master barang
  const [filteredList, setFilteredList] = useState<Barang[]>([]); // Data barang yang ditampilkan setelah filter
  const [searchQuery, setSearchQuery] = useState<string>(''); // Teks input pencarian
  const [selectedCategory, setSelectedCategory] = useState<string>('Semua'); // Kategori terpilih
  const [isLoading, setIsLoading] = useState<boolean>(true); // Status loading saat fetch awal
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false); // Status refresh tarik layar (pull-to-refresh)
  const [dataSource, setDataSource] = useState<'api' | 'local'>('local'); // Sumber data (API XAMPP / Local Data)

  // -----------------------------------------------------------------------
  // 2. PENERAPAN EFFECT (useEffect - Effect 1: Initial Load)
  // Dijalankan sekali saat komponen dipasang ke layar (Mounting).
  // Dependency array kosong [] memastikan pemanggilan API tidak terjadi berulang tanpa alasan.
  // -----------------------------------------------------------------------
  const loadData = useCallback(async () => {
    try {
      const result = await fetchBarangList();
      setBarangList(result.data);
      setDataSource(result.source);
    } catch (error) {
      console.warn('Gagal memuat barang:', error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;
    async function init() {
      try {
        const result = await fetchBarangList();
        if (isMounted) {
          setBarangList(result.data);
          setDataSource(result.source);
        }
      } catch (error) {
        console.warn('Gagal memuat barang:', error);
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
  // 3. PENERAPAN EFFECT (useEffect - Effect 2: Reaktif Filter & Search)
  // Dijalankan setiap kali salah satu dependensi [searchQuery, selectedCategory, barangList] berubah.
  // Ini mendemonstrasikan fungsi useEffect untuk sinkronisasi state turunan secara otomatis.
  // -----------------------------------------------------------------------
  useEffect(() => {
    let result = [...barangList];

    // Filter berdasarkan Kategori
    if (selectedCategory !== 'Semua') {
      result = result.filter((item) => item.kategori === selectedCategory);
    }

    // Filter berdasarkan Kata Kunci Pencarian (Nama, Kode, atau Lokasi Rak)
    if (searchQuery.trim() !== '') {
      const query = searchQuery.toLowerCase().trim();
      result = result.filter(
        (item) =>
          item.nama_barang.toLowerCase().includes(query) ||
          item.kode_barang.toLowerCase().includes(query) ||
          item.lokasi_rak.toLowerCase().includes(query)
      );
    }

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setFilteredList(result);
  }, [searchQuery, selectedCategory, barangList]);

  // Handler Pull to Refresh
  const onRefresh = async () => {
    setIsRefreshing(true);
    await loadData();
  };

  // Kategori dinamis yang diambil dari data barang yang ada
  const availableCategories = ['Semua', ...Array.from(new Set(barangList.map((b) => b.kategori)))];

  // Hitung jumlah status dari list yang sedang ditampilkan
  const countAman = filteredList.filter((b) => b.status_stok === 'Aman').length;
  const countMenipis = filteredList.filter((b) => b.status_stok === 'Menipis').length;
  const countHabis = filteredList.filter((b) => b.status_stok === 'Habis').length;

  // Format angka ke format mata uang Rupiah
  const formatRupiah = (num: number) => {
    return 'Rp ' + Number(num).toLocaleString('id-ID');
  };

  // Render Item Card untuk FlatList
  const renderItem = ({ item }: { item: Barang }) => {
    const isHabis = item.status_stok === 'Habis';
    const isMenipis = item.status_stok === 'Menipis';

    const badgeBg = isHabis ? '#fee2e2' : isMenipis ? '#fef3c7' : '#dcfce7';
    const badgeText = isHabis ? '#dc2626' : isMenipis ? '#b45309' : '#15803d';
    const dotColor = isHabis ? '#ef4444' : isMenipis ? '#f59e0b' : '#22c55e';

    return (
      <View style={styles.card}>
        {/* Baris Atas: Nama & Status Badge */}
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle} numberOfLines={2}>
            {item.nama_barang}
          </Text>
          <View style={[styles.statusBadge, { backgroundColor: badgeBg }]}>
            <View style={[styles.statusDot, { backgroundColor: dotColor }]} />
            <Text style={[styles.statusText, { color: badgeText }]}>{item.status_stok}</Text>
          </View>
        </View>

        {/* Baris Meta: Kode, Kategori & Lokasi Rak */}
        <View style={styles.cardMetaRow}>
          <View style={styles.metaChip}>
            <Text style={styles.metaChipText}>{item.kode_barang}</Text>
          </View>
          <View style={styles.metaChip}>
            <Text style={styles.metaChipText}>{item.kategori}</Text>
          </View>
          <View style={styles.metaChipLocation}>
            <Feather name="map-pin" size={11} color="#64748b" />
            <Text style={styles.metaLocationText}>{item.lokasi_rak}</Text>
          </View>
        </View>

        {/* Divider */}
        <View style={styles.cardDivider} />

        {/* Baris Informasi Stok & Harga */}
        <View style={styles.cardBottomRow}>
          {/* Stok Info */}
          <View>
            <Text style={styles.infoLabel}>Jumlah Stok</Text>
            <Text style={[styles.stokValue, isHabis && styles.stokRed, isMenipis && styles.stokOrange]}>
              {item.stok} <Text style={styles.satuanText}>{item.satuan}</Text>
            </Text>
            <Text style={styles.stokMinimumText}>Min: {item.stok_minimum} {item.satuan}</Text>
          </View>

          {/* Harga Info */}
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
      {/* HEADER SCREEN & TOMBOL NAVIGASI KEMBALI (router.back())           */}
      {/* ----------------------------------------------------------------- */}
      <View style={styles.topBar}>
        {/*
          PERBEDAAN ROUTER:
          router.back(): Menghapus halaman Barang dari atas tumpukan stack
          dan kembali ke halaman sebelumnya (Dashboard).
        */}
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

        {/* Badge Sumber Data (Membedakan Backend PHP XAMPP vs Data Lokal) */}
        <View
          style={[
            styles.sourceBadge,
            { backgroundColor: dataSource === 'api' ? '#ecfdf5' : '#f1f5f9' },
          ]}
        >
          <View
            style={[
              styles.sourceDot,
              { backgroundColor: dataSource === 'api' ? '#10b981' : '#94a3b8' },
            ]}
          />
          <Text
            style={[
              styles.sourceText,
              { color: dataSource === 'api' ? '#047857' : '#475569' },
            ]}
          >
            {dataSource === 'api' ? 'XAMPP API' : 'Lokal JSON'}
          </Text>
        </View>
      </View>

      {/* ----------------------------------------------------------------- */}
      {/* INPUT PENCARIAN (useState searchQuery)                            */}
      {/* ----------------------------------------------------------------- */}
      <View style={styles.searchSection}>
        <View style={styles.searchBar}>
          <Feather name="search" size={17} color="#94a3b8" style={{ marginRight: 8 }} />
          <TextInput
            style={styles.searchInput}
            placeholder="Cari nama, kode barang, atau lokasi rak..."
            placeholderTextColor="#94a3b8"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Feather name="x-circle" size={16} color="#94a3b8" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* ----------------------------------------------------------------- */}
      {/* FILTER KATEGORI (useState selectedCategory)                       */}
      {/* ----------------------------------------------------------------- */}
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

      {/* ----------------------------------------------------------------- */}
      {/* BAR RINGKASAN HASIL FILTER (Reaktif dari useState & useEffect)    */}
      {/* ----------------------------------------------------------------- */}
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

      {/* ----------------------------------------------------------------- */}
      {/* DAFTAR BARANG (FlatList dengan Pull-to-Refresh)                  */}
      {/* ----------------------------------------------------------------- */}
      {isLoading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#2563eb" />
          <Text style={styles.loadingMessage}>Memuat katalog barang...</Text>
        </View>
      ) : (
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
              {(searchQuery.length > 0 || selectedCategory !== 'Semua') && (
                <TouchableOpacity
                  style={styles.resetFilterBtn}
                  onPress={() => {
                    setSearchQuery('');
                    setSelectedCategory('Semua');
                  }}
                >
                  <Text style={styles.resetFilterText}>Reset Pencarian & Filter</Text>
                </TouchableOpacity>
              )}
            </View>
          }
        />
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
// STYLESHEET (Barang Screen)
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
  sourceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 5,
  },
  sourceDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  sourceText: {
    fontSize: 10,
    fontWeight: '700',
  },
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
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 8,
    marginBottom: 8,
  },
  cardTitle: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
    lineHeight: 19,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    gap: 4,
  },
  statusDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '700',
  },
  cardMetaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
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
  metaChipLocation: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    gap: 4,
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
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 30,
    gap: 12,
  },
  loadingMessage: {
    fontSize: 13,
    color: '#64748b',
    fontWeight: '600',
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
    marginBottom: 16,
  },
  resetFilterBtn: {
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#bfdbfe',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  resetFilterText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1d4ed8',
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
