import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
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
  Modal,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';

import { UI, cardShadow } from '../constants/uiTokens';
import {
  SoftBlueBackdrop,
  PrimaryGradientButton,
  SecondaryOutlineButton,
} from '../components/SoftBlueUI';
import { AccessDeniedView } from '../components/AccessDeniedView';
import { showAppAlert, showAppConfirm } from '../utils/feedback';

import { Barang, AppApiError, AuthSession } from '../types';
import { getSavedSession } from '../services/authService';
import { authorizeAction, hasPermission } from '../services/rbacService';
import {
  applyCatalogOverrides,
  createMasterBarang,
  deleteMasterBarang,
  subscribeInventoryStore,
  updateMasterBarang,
} from '../services/inventoryStore';
import {
  fetchBarangList,
  setActiveMockCondition,
  getActiveMockCondition,
  MockCondition,
} from '../services/dataService';

/**
 * =========================================================================
 * KATALOG & MANAJEMEN BARANG DENGAN RBAC + HANDLE API ERROR (src/app/barang.tsx)
 * - Admin Gudang: Lihat, Tambah, Edit, Hapus Master Barang, Scan Barcode, Finance
 * - Staff Inventory: Lihat, Cari, Scan Barcode (Tanpa Tambah/Edit/Hapus & Harga Beli/Margin)
 * - Manajer Operasional: Monitoring Katalog & Valuasi/Margin (Read-Only)
 * =========================================================================
 */
export default function BarangScreen() {
  const insets = useSafeAreaInsets();

  const [session, setSession] = useState<AuthSession | null>(null);
  const [sessionLoaded, setSessionLoaded] = useState<boolean>(false);
  const [barangList, setBarangList] = useState<Barang[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('Semua');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<AppApiError | null>(null);
  const [selectedDetailBarang, setSelectedDetailBarang] = useState<Barang | null>(null);

  // Admin CRUD Modal State
  const [isCrudModalVisible, setIsCrudModalVisible] = useState<boolean>(false);
  const [editingBarang, setEditingBarang] = useState<Barang | null>(null);
  const [formNama, setFormNama] = useState<string>('');
  const [formKategori, setFormKategori] = useState<string>('Lab Komputer');
  const [formStok, setFormStok] = useState<string>('10');
  const [formStokMin, setFormStokMin] = useState<string>('5');
  const [formSatuan, setFormSatuan] = useState<string>('Unit');
  const [formHargaBeli, setFormHargaBeli] = useState<string>('500000');
  const [formHargaJual, setFormHargaJual] = useState<string>('650000');
  const [formLokasiRak, setFormLokasiRak] = useState<string>('Rak A-01');

  const [currentMode, setCurrentMode] = useState<MockCondition>(() => getActiveMockCondition());
  const [showTestBar, setShowTestBar] = useState<boolean>(false);
  const isFetchingRef = useRef<boolean>(false);
  const rawApiItemsRef = useRef<Barang[]>([]);

  const canCreate = hasPermission(session, 'catalog:create');
  const canEdit = hasPermission(session, 'catalog:edit');
  const canDelete = hasPermission(session, 'catalog:delete');
  const canViewFinance = hasPermission(session, 'catalog:view_finance');
  const canScan = hasPermission(session, 'barcode:scan');

  const loadData = useCallback(() => {
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;
    setIsLoading(true);
    setError(null);

    fetchBarangList()
      .then((result) => {
        if (result.error) {
          rawApiItemsRef.current = [];
          setBarangList([]);
          setError(result.error);
        } else {
          rawApiItemsRef.current = result.data;
          setBarangList(applyCatalogOverrides(result.data));
          setError(null);
        }
      })
      .catch((err: any) => {
        rawApiItemsRef.current = [];
        setBarangList([]);
        setError({
          kind: 'NETWORK_ERROR',
          title: 'Koneksi Jaringan Gagal',
          message: err?.message || 'Terjadi kesalahan saat memuat data dari server.',
        });
      })
      .finally(() => {
        setIsLoading(false);
        setIsRefreshing(false);
        isFetchingRef.current = false;
      });
  }, []);

  useEffect(() => {
    let isMounted = true;

    getSavedSession()
      .then((saved) => {
        if (isMounted) {
          setSession(saved);
          setSessionLoaded(true);
        }
      })
      .catch(() => {
        if (isMounted) setSessionLoaded(true);
      });

    fetchBarangList()
      .then((result) => {
        if (!isMounted) return;
        if (result.error) {
          rawApiItemsRef.current = [];
          setBarangList([]);
          setError(result.error);
        } else {
          rawApiItemsRef.current = result.data;
          setBarangList(applyCatalogOverrides(result.data));
          setError(null);
        }
      })
      .catch((err: any) => {
        if (!isMounted) return;
        rawApiItemsRef.current = [];
        setBarangList([]);
        setError({
          kind: 'NETWORK_ERROR',
          title: 'Koneksi Jaringan Gagal',
          message: err?.message || 'Terjadi kesalahan saat memuat data dari server.',
        });
      })
      .finally(() => {
        if (isMounted) {
          setIsLoading(false);
        }
      });

    const unsub = subscribeInventoryStore(() => {
      if (rawApiItemsRef.current.length > 0) {
        setBarangList(applyCatalogOverrides(rawApiItemsRef.current));
      }
    });

    return () => {
      isMounted = false;
      unsub();
    };
  }, []);

  const filteredList = useMemo(() => {
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

    return result;
  }, [searchQuery, selectedCategory, barangList]);

  const onRefresh = async () => {
    setIsRefreshing(true);
    await loadData();
  };

  const handleChangeMode = async (mode: MockCondition) => {
    setCurrentMode(mode);
    setActiveMockCondition(mode);
    await loadData();
  };

  const openCreateModal = () => {
    const auth = authorizeAction(session, 'catalog:create');
    if (!auth.allowed) {
      showAppAlert('Akses Ditolak (403)', auth.reason || 'Hanya Admin Gudang yang boleh menambah barang.');
      return;
    }
    setEditingBarang(null);
    setFormNama('');
    setFormKategori('Lab Komputer');
    setFormStok('10');
    setFormStokMin('5');
    setFormSatuan('Unit');
    setFormHargaBeli('500000');
    setFormHargaJual('650000');
    setFormLokasiRak('Rak A-01');
    setIsCrudModalVisible(true);
  };

  const openEditModal = (item: Barang) => {
    const auth = authorizeAction(session, 'catalog:edit');
    if (!auth.allowed) {
      showAppAlert('Akses Ditolak (403)', auth.reason || 'Hanya Admin Gudang yang boleh mengubah master barang.');
      return;
    }
    setSelectedDetailBarang(null);
    setEditingBarang(item);
    setFormNama(item.nama_barang);
    setFormKategori(item.kategori);
    setFormStok(String(item.stok));
    setFormStokMin(String(item.stok_minimum));
    setFormSatuan(item.satuan);
    setFormHargaBeli(String(item.harga_beli));
    setFormHargaJual(String(item.harga_jual));
    setFormLokasiRak(item.lokasi_rak);
    setIsCrudModalVisible(true);
  };

  const handleSaveBarang = () => {
    if (editingBarang) {
      const res = updateMasterBarang(session, editingBarang.id, {
        nama_barang: formNama,
        kategori: formKategori,
        stok_minimum: parseInt(formStokMin, 10) || 5,
        lokasi_rak: formLokasiRak,
        harga_beli: parseFloat(formHargaBeli) || 0,
        harga_jual: parseFloat(formHargaJual) || 0,
      });
      if (!res.ok) {
        showAppAlert(`Ditolak (${res.statusCode})`, res.message);
        return;
      }
      setIsCrudModalVisible(false);
      setBarangList(applyCatalogOverrides(rawApiItemsRef.current));
      showAppAlert('Berhasil', res.message);
    } else {
      const res = createMasterBarang(session, {
        nama_barang: formNama,
        kategori: formKategori,
        stok: parseInt(formStok, 10) || 0,
        stok_minimum: parseInt(formStokMin, 10) || 5,
        satuan: formSatuan,
        harga_beli: parseFloat(formHargaBeli) || 0,
        harga_jual: parseFloat(formHargaJual) || 0,
        lokasi_rak: formLokasiRak,
      });
      if (!res.ok) {
        showAppAlert(`Ditolak (${res.statusCode})`, res.message);
        return;
      }
      setIsCrudModalVisible(false);
      setBarangList(applyCatalogOverrides(rawApiItemsRef.current));
      showAppAlert('Berhasil', res.message);
    }
  };

  const handleDeleteBarang = (item: Barang) => {
    const auth = authorizeAction(session, 'catalog:delete');
    if (!auth.allowed) {
      showAppAlert('Akses Ditolak (403)', auth.reason || 'Hanya Admin Gudang yang boleh menghapus barang.');
      return;
    }

    showAppConfirm(
      'Hapus Master Barang',
      `Yakin ingin menghapus "${item.nama_barang}" (${item.kode_barang}) dari inventaris?`,
      'Ya, Hapus',
      () => {
        const res = deleteMasterBarang(session, item.id);
        if (!res.ok) {
          showAppAlert(`Ditolak (${res.statusCode})`, res.message);
          return;
        }
        setSelectedDetailBarang(null);
        setBarangList(applyCatalogOverrides(rawApiItemsRef.current));
        showAppAlert('Barang Dihapus', res.message);
      },
      true
    );
  };

  const availableCategories = ['Semua', ...Array.from(new Set(barangList.map((b) => b.kategori)))];
  const countAman = filteredList.filter((b) => b.status_stok === 'Aman').length;
  const countMenipis = filteredList.filter((b) => b.status_stok === 'Menipis').length;
  const countHabis = filteredList.filter((b) => b.status_stok === 'Habis').length;

  const formatRupiah = (num: number) => {
    return 'Rp ' + Number(num).toLocaleString('id-ID');
  };

  const renderItem = ({ item }: { item: Barang }) => {
    const isHabis = item.status_stok === 'Habis';
    const isMenipis = item.status_stok === 'Menipis';

    const badgeText = isHabis
      ? UI.colors.dangerDark
      : isMenipis
      ? UI.colors.warningDark
      : UI.colors.success;
    const dotColor = isHabis
      ? UI.colors.danger
      : isMenipis
      ? UI.colors.warning
      : UI.colors.success;

    return (
      <TouchableOpacity
        style={styles.card}
        activeOpacity={0.82}
        onPress={() => setSelectedDetailBarang(item)}
      >
        <View style={styles.cardMainRow}>
          <View style={styles.productImageWrapper}>
            {item.gambar ? (
              <Image
                source={{ uri: item.gambar }}
                style={styles.productImage}
                resizeMode="cover"
              />
            ) : (
              <View style={styles.productImagePlaceholder}>
                <Feather name="box" size={22} color={UI.colors.muted} />
              </View>
            )}
          </View>

          <View style={styles.cardContentRight}>
            <View style={styles.cardTopMetaRow}>
              <View style={styles.codePill}>
                <Text style={styles.codePillText}>{item.kode_barang}</Text>
              </View>
              <View style={styles.katPill}>
                <Text style={styles.katPillText} numberOfLines={1}>
                  {item.kategori}
                </Text>
              </View>
            </View>

            <Text style={styles.cardTitle} numberOfLines={2}>
              {item.nama_barang}
            </Text>

            <View style={styles.statusInlineRow}>
              <View style={[styles.statusDot, { backgroundColor: dotColor }]} />
              <Text style={[styles.statusText, { color: badgeText }]}>
                {item.status_stok}
              </Text>
              <Text style={styles.metaDotSep}>•</Text>
              <Feather name="map-pin" size={11} color={UI.colors.secondary} />
              <Text style={styles.metaLocationText} numberOfLines={1}>
                {item.lokasi_rak}
              </Text>
            </View>

            <View style={styles.cardFooterRow}>
              <Text
                style={[
                  styles.stokValue,
                  isHabis && styles.stokRed,
                  isMenipis && styles.stokOrange,
                ]}
              >
                Stok: {item.stok} {item.satuan}
              </Text>
              <Text style={styles.priceValue}>{formatRupiah(item.harga_jual)}</Text>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  if (sessionLoaded && (!session || !authorizeAction(session, 'catalog:view').allowed)) {
    return (
      <SoftBlueBackdrop>
        <SafeAreaView style={styles.safeArea}>
          <AccessDeniedView
            title="Sesi Autentikasi Diperlukan"
            message="Anda harus login untuk mengakses katalog barang EduStock."
            actionLabel="Ke Halaman Login"
            onAction={() => router.replace('/')}
          />
        </SafeAreaView>
      </SoftBlueBackdrop>
    );
  }

  return (
    <SoftBlueBackdrop>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        {/* HEADER SCREEN */}
        <View style={styles.topBar}>
          <TouchableOpacity
            style={styles.backButton}
            activeOpacity={0.75}
            onPress={() => router.back()}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Feather name="arrow-left" size={19} color={UI.colors.text} />
          </TouchableOpacity>

          <View style={styles.headerTitleWrap}>
            <Text style={styles.headerTitle}>Daftar Barang</Text>
            <Text style={styles.headerSubtitle}>
              {canCreate
                ? 'Admin Mode: Kelola Master Barang'
                : canViewFinance
                ? 'Monitoring Katalog & Valuasi'
                : 'Mode Operasional Staff'}
            </Text>
          </View>

          {canCreate && (
            <TouchableOpacity
              style={styles.addHeaderBtn}
              activeOpacity={0.8}
              onPress={openCreateModal}
            >
              <Feather name="plus" size={16} color="#FFFFFF" />
              <Text style={styles.addHeaderBtnText}>Tambah</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={[styles.testMenuBtn, showTestBar && styles.testMenuBtnActive]}
            activeOpacity={0.75}
            onPress={() => setShowTestBar((prev) => !prev)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <MaterialCommunityIcons
              name="tune-variant"
              size={18}
              color={showTestBar ? UI.colors.primary : UI.colors.secondary}
            />
          </TouchableOpacity>
        </View>

        {/* PANEL PENGUJIAN SKENARIO TASK 01 */}
        {showTestBar && (
          <View style={styles.testModeBar}>
            <View style={styles.testModeHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={styles.testModeLabel}>RESPON API PENGUJIAN</Text>
                <View style={styles.publicApiTag}>
                  <Text style={styles.publicApiTagText}>Public API</Text>
                </View>
              </View>
              <TouchableOpacity
                onPress={() => setShowTestBar(false)}
                hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
              >
                <Feather name="x" size={14} color={UI.colors.muted} />
              </TouchableOpacity>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.testModeChips}
            >
              <TouchableOpacity
                style={[styles.testChip, currentMode === '2xx' && styles.testChipActive]}
                activeOpacity={0.75}
                onPress={() => handleChangeMode('2xx')}
              >
                <MaterialCommunityIcons
                  name="check-circle"
                  size={14}
                  color={currentMode === '2xx' ? '#FFFFFF' : UI.colors.success}
                />
                <Text style={[styles.testChipText, currentMode === '2xx' && styles.testChipTextActive]}>
                  2xx (Sukses)
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.testChip, currentMode === '4xx' && styles.testChipActive]}
                activeOpacity={0.75}
                onPress={() => handleChangeMode('4xx')}
              >
                <MaterialCommunityIcons
                  name="alert-circle"
                  size={14}
                  color={currentMode === '4xx' ? '#FFFFFF' : '#EA580C'}
                />
                <Text style={[styles.testChipText, currentMode === '4xx' && styles.testChipTextActive]}>
                  4xx (Client Error)
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.testChip, currentMode === '5xx' && styles.testChipActive]}
                activeOpacity={0.75}
                onPress={() => handleChangeMode('5xx')}
              >
                <MaterialCommunityIcons
                  name="server"
                  size={14}
                  color={currentMode === '5xx' ? '#FFFFFF' : UI.colors.dangerDark}
                />
                <Text style={[styles.testChipText, currentMode === '5xx' && styles.testChipTextActive]}>
                  5xx (Server Error)
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.testChip, currentMode === 'network' && styles.testChipActive]}
                activeOpacity={0.75}
                onPress={() => handleChangeMode('network')}
              >
                <MaterialCommunityIcons
                  name="wifi-off"
                  size={14}
                  color={currentMode === 'network' ? '#FFFFFF' : UI.colors.secondary}
                />
                <Text style={[styles.testChipText, currentMode === 'network' && styles.testChipTextActive]}>
                  Request Gagal
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.testChip, currentMode === 'none' && styles.testChipActive]}
                activeOpacity={0.75}
                onPress={() => handleChangeMode('none')}
              >
                <MaterialCommunityIcons
                  name="cloud-check"
                  size={14}
                  color={currentMode === 'none' ? '#FFFFFF' : UI.colors.primary}
                />
                <Text style={[styles.testChipText, currentMode === 'none' && styles.testChipTextActive]}>
                  API Publik (Live)
                </Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        )}

        {/* LOADING STATE */}
        {isLoading ? (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color={UI.colors.primary} />
            <Text style={styles.loadingTitle}>Memuat data...</Text>
            <Text style={styles.loadingSubtitle}>Mohon tunggu sebentar</Text>
          </View>
        ) : error ? (
          /* ERROR STATE */
          <View style={styles.errorStateContainer}>
            <View
              style={[
                styles.errorIconCircle,
                error.kind === '4xx' && styles.errorIconCircle4xx,
                error.kind === '5xx' && styles.errorIconCircle5xx,
                error.kind === 'NETWORK_ERROR' && styles.errorIconCircleNetwork,
              ]}
            >
              {error.kind === '4xx' ? (
                <MaterialCommunityIcons name="emoticon-sad-outline" size={56} color="#EA580C" />
              ) : error.kind === '5xx' ? (
                <MaterialCommunityIcons name="server-network" size={52} color={UI.colors.dangerDark} />
              ) : (
                <MaterialCommunityIcons name="wifi-off" size={52} color={UI.colors.secondary} />
              )}
            </View>

            <Text style={styles.errorStateTitle}>{error.title}</Text>
            <Text style={styles.errorStateMessage}>{error.message}</Text>

            <TouchableOpacity style={styles.retryButton} activeOpacity={0.85} onPress={loadData}>
              <Text style={styles.retryButtonText}>Coba Lagi</Text>
            </TouchableOpacity>
          </View>
        ) : (
          /* SUCCESS (2xx) */
          <>
            <View style={styles.searchRowContainer}>
              <View style={styles.searchBar}>
                <Feather name="search" size={16} color={UI.colors.muted} style={{ marginRight: 8 }} />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Cari nama, kode, atau lokasi rak..."
                  placeholderTextColor={UI.colors.muted}
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                />
                {searchQuery.length > 0 && (
                  <TouchableOpacity
                    onPress={() => setSearchQuery('')}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Feather name="x-circle" size={16} color={UI.colors.muted} />
                  </TouchableOpacity>
                )}
              </View>

              {canScan && (
                <TouchableOpacity
                  style={styles.scanQuickSquareBtn}
                  activeOpacity={0.8}
                  onPress={() => router.push('/scanner')}
                >
                  <MaterialCommunityIcons name="qrcode-scan" size={19} color={UI.colors.primary} />
                </TouchableOpacity>
              )}
            </View>

            <View style={{ marginBottom: 4 }}>
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
                      activeOpacity={0.78}
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

            <View style={styles.summaryBar}>
              <Text style={styles.summaryCountText}>
                <Text style={styles.boldText}>{filteredList.length}</Text> barang ditemukan
              </Text>
              <View style={styles.miniStatsRow}>
                <View style={styles.miniStatBadge}>
                  <View style={[styles.miniDot, { backgroundColor: UI.colors.success }]} />
                  <Text style={styles.miniStatText}>{countAman}</Text>
                </View>
                <View style={styles.miniStatBadge}>
                  <View style={[styles.miniDot, { backgroundColor: UI.colors.warning }]} />
                  <Text style={styles.miniStatText}>{countMenipis}</Text>
                </View>
                <View style={styles.miniStatBadge}>
                  <View style={[styles.miniDot, { backgroundColor: UI.colors.danger }]} />
                  <Text style={styles.miniStatText}>{countHabis}</Text>
                </View>
              </View>
            </View>

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
                  colors={[UI.colors.primary]}
                />
              }
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <View style={styles.emptyIconCircle}>
                    <Feather name="inbox" size={32} color={UI.colors.muted} />
                  </View>
                  <Text style={styles.emptyTitle}>Tidak ada barang yang cocok</Text>
                  <Text style={styles.emptySubtitle}>
                    Coba ubah kata kunci pencarian atau pilih kategori lain.
                  </Text>
                </View>
              }
            />
          </>
        )}

        <View
          style={[
            styles.bottomBar,
            { paddingBottom: Math.max(insets.bottom, 10) },
          ]}
        >
          <SecondaryOutlineButton
            label="Kembali ke Dashboard"
            iconLeft={<Ionicons name="home-outline" size={16} color={UI.colors.primary} />}
            onPress={() => router.back()}
            style={{ height: 44 }}
          />
        </View>

        {/* ============================================================= */}
        {/* MODAL DETAIL BARANG (DIFERENSIASI RBAC)                       */}
        {/* ============================================================= */}
        <Modal
          visible={selectedDetailBarang !== null}
          transparent={true}
          animationType="slide"
          onRequestClose={() => setSelectedDetailBarang(null)}
        >
          <View style={styles.modalBackdrop}>
            <View
              style={[
                styles.detailModalContent,
                { paddingBottom: Math.max(insets.bottom, 20) },
              ]}
            >
              <View style={styles.sheetHandle} />

              <View style={styles.detailModalHeader}>
                <TouchableOpacity
                  style={styles.detailBackBtn}
                  onPress={() => setSelectedDetailBarang(null)}
                >
                  <Feather name="arrow-left" size={18} color={UI.colors.text} />
                </TouchableOpacity>
                <Text style={styles.detailModalTitle}>Detail Barang</Text>
                <View style={{ width: 34 }} />
              </View>

              {selectedDetailBarang && (
                <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 480 }}>
                  <View style={styles.detailHeroCard}>
                    <View style={styles.detailHeroWrapper}>
                      {selectedDetailBarang.gambar ? (
                        <Image
                          source={{ uri: selectedDetailBarang.gambar }}
                          style={styles.detailHeroImage}
                          resizeMode="contain"
                        />
                      ) : (
                        <Feather name="box" size={44} color={UI.colors.muted} />
                      )}
                    </View>

                    <View style={styles.detailBadgeCenterRow}>
                      <View style={styles.codePill}>
                        <Text style={styles.codePillText}>{selectedDetailBarang.kode_barang}</Text>
                      </View>
                      <View style={styles.katPill}>
                        <Text style={styles.katPillText}>{selectedDetailBarang.kategori}</Text>
                      </View>
                    </View>

                    <Text style={styles.detailItemTitle}>{selectedDetailBarang.nama_barang}</Text>

                    <View style={styles.detailStatusCenter}>
                      <View
                        style={[
                          styles.statusDot,
                          {
                            backgroundColor:
                              selectedDetailBarang.status_stok === 'Habis'
                                ? UI.colors.danger
                                : selectedDetailBarang.status_stok === 'Menipis'
                                ? UI.colors.warning
                                : UI.colors.success,
                          },
                        ]}
                      />
                      <Text
                        style={[
                          styles.detailStatusText,
                          selectedDetailBarang.status_stok === 'Habis'
                            ? { color: UI.colors.dangerDark }
                            : selectedDetailBarang.status_stok === 'Menipis'
                            ? { color: UI.colors.warningDark }
                            : { color: UI.colors.success },
                        ]}
                      >
                        {selectedDetailBarang.status_stok}
                      </Text>
                    </View>

                    <Text style={styles.detailPriceBig}>
                      {formatRupiah(selectedDetailBarang.harga_jual)}
                    </Text>

                    {selectedDetailBarang.deskripsi ? (
                      <Text style={styles.detailItemDesc}>
                        {selectedDetailBarang.deskripsi}
                      </Text>
                    ) : null}
                  </View>

                  <View style={styles.detailInfoListCard}>
                    <Text style={styles.detailSectionHeading}>Informasi Barang</Text>

                    <View style={styles.detailListRow}>
                      <View style={styles.detailListLeft}>
                        <Feather name="layers" size={15} color={UI.colors.primary} />
                        <Text style={styles.detailListLabel}>Jumlah Stok</Text>
                      </View>
                      <Text style={styles.detailListValue}>
                        {selectedDetailBarang.stok} {selectedDetailBarang.satuan}
                      </Text>
                    </View>

                    <View style={styles.detailListRow}>
                      <View style={styles.detailListLeft}>
                        <Feather name="alert-circle" size={15} color={UI.colors.warningDark} />
                        <Text style={styles.detailListLabel}>Stok Minimum</Text>
                      </View>
                      <Text style={styles.detailListValue}>
                        {selectedDetailBarang.stok_minimum} {selectedDetailBarang.satuan}
                      </Text>
                    </View>

                    <View
                      style={[
                        styles.detailListRow,
                        !canViewFinance && { borderBottomWidth: 0 },
                      ]}
                    >
                      <View style={styles.detailListLeft}>
                        <Feather name="map-pin" size={15} color={UI.colors.primary} />
                        <Text style={styles.detailListLabel}>Lokasi</Text>
                      </View>
                      <Text style={styles.detailListValue}>{selectedDetailBarang.lokasi_rak}</Text>
                    </View>

                    {/* Data Finansial: Hanya Admin Gudang & Manajer Operasional */}
                    {canViewFinance && (
                      <>
                        <View style={styles.detailListRow}>
                          <View style={styles.detailListLeft}>
                            <Feather name="shopping-bag" size={15} color={UI.colors.secondary} />
                            <Text style={styles.detailListLabel}>Harga Beli</Text>
                          </View>
                          <Text style={styles.detailListValue}>
                            {formatRupiah(selectedDetailBarang.harga_beli)}
                          </Text>
                        </View>

                        <View style={styles.detailListRow}>
                          <View style={styles.detailListLeft}>
                            <Feather name="trending-up" size={15} color={UI.colors.success} />
                            <Text style={styles.detailListLabel}>Margin per Unit</Text>
                          </View>
                          <Text style={[styles.detailListValue, { color: UI.colors.success }]}>
                            +{formatRupiah(selectedDetailBarang.harga_jual - selectedDetailBarang.harga_beli)}
                          </Text>
                        </View>

                        <View style={[styles.detailListRow, { borderBottomWidth: 0 }]}>
                          <View style={styles.detailListLeft}>
                            <Feather name="pie-chart" size={15} color={UI.colors.primary} />
                            <Text style={styles.detailListLabel}>Total Valuasi Aset</Text>
                          </View>
                          <Text style={[styles.detailListValue, { color: UI.colors.primary }]}>
                            {formatRupiah(selectedDetailBarang.harga_beli * selectedDetailBarang.stok)}
                          </Text>
                        </View>
                      </>
                    )}
                  </View>

                  {/* Aksi Khusus Admin: Edit & Hapus Master Barang */}
                  {(canEdit || canDelete) && (
                    <View style={styles.adminCrudActionsRow}>
                      {canEdit && (
                        <SecondaryOutlineButton
                          label="Edit Barang"
                          iconLeft={<Feather name="edit-2" size={14} color={UI.colors.primary} />}
                          onPress={() => openEditModal(selectedDetailBarang)}
                          style={{ flex: 1, height: 42 }}
                          textStyle={{ fontSize: 12.5 }}
                        />
                      )}
                      {canDelete && (
                        <TouchableOpacity
                          style={styles.deleteDangerBtn}
                          onPress={() => handleDeleteBarang(selectedDetailBarang)}
                        >
                          <Feather name="trash-2" size={14} color={UI.colors.dangerDark} />
                          <Text style={styles.deleteDangerBtnText}>Hapus</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  )}
                </ScrollView>
              )}

              <View style={styles.detailActionRow}>
                {canScan && (
                  <SecondaryOutlineButton
                    label="Scan Barcode"
                    iconLeft={<Feather name="camera" size={15} color={UI.colors.primary} />}
                    onPress={() => {
                      setSelectedDetailBarang(null);
                      router.push('/scanner');
                    }}
                    style={{ flex: 1 }}
                  />
                )}
                <PrimaryGradientButton
                  label="Tutup"
                  onPress={() => setSelectedDetailBarang(null)}
                  style={{ flex: 1 }}
                />
              </View>
            </View>
          </View>
        </Modal>

        {/* ============================================================= */}
        {/* MODAL TAMBAH / EDIT MASTER BARANG (KHUSUS ADMIN GUDANG)       */}
        {/* ============================================================= */}
        <Modal
          visible={isCrudModalVisible}
          transparent={true}
          animationType="slide"
          onRequestClose={() => setIsCrudModalVisible(false)}
        >
          <View style={styles.modalBackdrop}>
            <View
              style={[
                styles.detailModalContent,
                { paddingBottom: Math.max(insets.bottom, 20) },
              ]}
            >
              <View style={styles.sheetHandle} />
              <View style={styles.detailModalHeader}>
                <TouchableOpacity
                  style={styles.detailBackBtn}
                  onPress={() => setIsCrudModalVisible(false)}
                >
                  <Feather name="x" size={18} color={UI.colors.text} />
                </TouchableOpacity>
                <Text style={styles.detailModalTitle}>
                  {editingBarang ? 'Edit Master Barang' : 'Tambah Barang Baru'}
                </Text>
                <View style={{ width: 34 }} />
              </View>

              <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 430 }}>
                <View style={styles.crudFormGroup}>
                  <Text style={styles.crudLabel}>Nama Barang *</Text>
                  <TextInput
                    style={styles.crudInput}
                    value={formNama}
                    onChangeText={setFormNama}
                    placeholder="Contoh: Router MikroTik RB750Gr3"
                    placeholderTextColor={UI.colors.muted}
                  />
                </View>

                <View style={styles.crudTwoCol}>
                  <View style={[styles.crudFormGroup, { flex: 1 }]}>
                    <Text style={styles.crudLabel}>Kategori</Text>
                    <TextInput
                      style={styles.crudInput}
                      value={formKategori}
                      onChangeText={setFormKategori}
                    />
                  </View>
                  <View style={[styles.crudFormGroup, { flex: 1 }]}>
                    <Text style={styles.crudLabel}>Lokasi Rak</Text>
                    <TextInput
                      style={styles.crudInput}
                      value={formLokasiRak}
                      onChangeText={setFormLokasiRak}
                    />
                  </View>
                </View>

                <View style={styles.crudTwoCol}>
                  {!editingBarang && (
                    <View style={[styles.crudFormGroup, { flex: 1 }]}>
                      <Text style={styles.crudLabel}>Stok Awal</Text>
                      <TextInput
                        style={styles.crudInput}
                        keyboardType="number-pad"
                        value={formStok}
                        onChangeText={setFormStok}
                      />
                    </View>
                  )}
                  <View style={[styles.crudFormGroup, { flex: 1 }]}>
                    <Text style={styles.crudLabel}>Stok Minimum</Text>
                    <TextInput
                      style={styles.crudInput}
                      keyboardType="number-pad"
                      value={formStokMin}
                      onChangeText={setFormStokMin}
                    />
                  </View>
                  {!editingBarang && (
                    <View style={[styles.crudFormGroup, { flex: 1 }]}>
                      <Text style={styles.crudLabel}>Satuan</Text>
                      <TextInput
                        style={styles.crudInput}
                        value={formSatuan}
                        onChangeText={setFormSatuan}
                      />
                    </View>
                  )}
                </View>

                <View style={styles.crudTwoCol}>
                  <View style={[styles.crudFormGroup, { flex: 1 }]}>
                    <Text style={styles.crudLabel}>Harga Beli (Rp)</Text>
                    <TextInput
                      style={styles.crudInput}
                      keyboardType="number-pad"
                      value={formHargaBeli}
                      onChangeText={setFormHargaBeli}
                    />
                  </View>
                  <View style={[styles.crudFormGroup, { flex: 1 }]}>
                    <Text style={styles.crudLabel}>Harga Jual (Rp)</Text>
                    <TextInput
                      style={styles.crudInput}
                      keyboardType="number-pad"
                      value={formHargaJual}
                      onChangeText={setFormHargaJual}
                    />
                  </View>
                </View>
              </ScrollView>

              <View style={styles.detailActionRow}>
                <SecondaryOutlineButton
                  label="Batal"
                  onPress={() => setIsCrudModalVisible(false)}
                  style={{ flex: 1 }}
                />
                <PrimaryGradientButton
                  label="Simpan"
                  onPress={handleSaveBarang}
                  style={{ flex: 1.5 }}
                />
              </View>
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    </SoftBlueBackdrop>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    width: '100%',
    paddingTop: Platform.OS === 'android' ? RNStatusBar.currentHeight : 0,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 11,
    gap: 10,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 11,
    backgroundColor: UI.colors.surface,
    borderWidth: 1,
    borderColor: UI.colors.borderSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitleWrap: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: UI.colors.text,
    letterSpacing: -0.3,
  },
  headerSubtitle: {
    fontSize: 11,
    color: UI.colors.secondary,
    marginTop: 1,
  },
  addHeaderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: UI.colors.primary,
    backgroundImage: UI.gradients.primaryBtn,
    paddingHorizontal: 11,
    height: 36,
    borderRadius: 11,
  },
  addHeaderBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  testMenuBtn: {
    width: 36,
    height: 36,
    borderRadius: 11,
    backgroundColor: UI.colors.surface,
    borderWidth: 1,
    borderColor: UI.colors.borderSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  testMenuBtnActive: {
    backgroundColor: UI.colors.primaryLight,
    borderColor: UI.colors.primaryBorder,
  },

  testModeBar: {
    backgroundColor: UI.colors.surface,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: UI.colors.borderSoft,
    paddingVertical: 10,
    marginBottom: 8,
  },
  testModeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  testModeLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: UI.colors.secondary,
    letterSpacing: 0.5,
  },
  publicApiTag: {
    backgroundColor: UI.colors.primaryLight,
    borderWidth: 1,
    borderColor: UI.colors.primaryBorder,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  publicApiTagText: {
    fontSize: 9.5,
    fontWeight: '700',
    color: UI.colors.primary,
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
    borderRadius: UI.radius.pill,
    backgroundColor: UI.colors.background,
    borderWidth: 1,
    borderColor: UI.colors.borderSoft,
    gap: 6,
  },
  testChipActive: {
    backgroundColor: UI.colors.primary,
    backgroundImage: UI.gradients.primaryBtn,
    borderColor: UI.colors.primary,
  },
  testChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: UI.colors.textBody,
  },
  testChipTextActive: {
    color: '#FFFFFF',
  },

  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 30,
  },
  loadingTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: UI.colors.text,
    marginTop: 14,
  },
  loadingSubtitle: {
    fontSize: 12.5,
    color: UI.colors.secondary,
    marginTop: 4,
  },
  errorStateContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingVertical: 40,
  },
  errorIconCircle: {
    width: 90,
    height: 90,
    borderRadius: 45,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  errorIconCircle4xx: {
    backgroundColor: '#FFF7ED',
    borderWidth: 2,
    borderColor: '#FED7AA',
  },
  errorIconCircle5xx: {
    backgroundColor: UI.colors.dangerBg,
    borderWidth: 2,
    borderColor: UI.colors.dangerBorder,
  },
  errorIconCircleNetwork: {
    backgroundColor: UI.colors.surfaceMuted,
    borderWidth: 2,
    borderColor: UI.colors.border,
  },
  errorStateTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: UI.colors.text,
    textAlign: 'center',
    marginBottom: 8,
  },
  errorStateMessage: {
    fontSize: 13,
    color: UI.colors.secondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 26,
  },
  retryButton: {
    width: '100%',
    maxWidth: 260,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: UI.colors.danger,
    borderRadius: UI.radius.md,
  },
  retryButtonText: {
    fontSize: 14.5,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  searchRowContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 8,
    marginBottom: 10,
  },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: UI.colors.surface,
    borderWidth: 1,
    borderColor: UI.colors.borderSoft,
    borderRadius: UI.radius.md,
    paddingHorizontal: 12,
    height: 44,
    ...cardShadow,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: UI.colors.text,
  },
  scanQuickSquareBtn: {
    width: 44,
    height: 44,
    borderRadius: UI.radius.md,
    backgroundColor: UI.colors.surface,
    borderWidth: 1,
    borderColor: UI.colors.primaryBorder,
    alignItems: 'center',
    justifyContent: 'center',
    ...cardShadow,
  },
  categoryList: {
    paddingHorizontal: 16,
    gap: 7,
  },
  categoryPill: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: UI.radius.pill,
    backgroundColor: UI.colors.surface,
    borderWidth: 1,
    borderColor: UI.colors.borderSoft,
  },
  categoryPillActive: {
    backgroundColor: UI.colors.primary,
    backgroundImage: UI.gradients.primaryBtn,
    borderColor: UI.colors.primary,
  },
  categoryPillText: {
    fontSize: 12,
    fontWeight: '600',
    color: UI.colors.secondary,
  },
  categoryPillTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  summaryBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  summaryCountText: {
    fontSize: 11.5,
    color: UI.colors.secondary,
  },
  boldText: {
    fontWeight: '700',
    color: UI.colors.text,
  },
  miniStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  miniStatBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: UI.colors.surface,
    borderWidth: 1,
    borderColor: UI.colors.borderSoft,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: UI.radius.pill,
  },
  miniDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  miniStatText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: UI.colors.text,
  },

  listContent: {
    paddingHorizontal: 16,
    paddingTop: 2,
    paddingBottom: 16,
    gap: 10,
  },
  card: {
    backgroundColor: UI.colors.surface,
    borderRadius: UI.radius.lg,
    padding: 12,
    borderWidth: 1,
    borderColor: UI.colors.borderSoft,
    ...cardShadow,
  },
  cardMainRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
  },
  productImageWrapper: {
    width: 74,
    height: 74,
    borderRadius: UI.radius.md,
    backgroundColor: UI.colors.background,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: UI.colors.borderSoft,
  },
  productImage: {
    width: '100%',
    height: '100%',
  },
  productImagePlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardContentRight: {
    flex: 1,
    gap: 4,
  },
  cardTopMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  codePill: {
    backgroundColor: UI.colors.primaryLight,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  codePillText: {
    fontSize: 10,
    fontWeight: '700',
    color: UI.colors.primary,
    fontFamily: UI.font.mono,
  },
  katPill: {
    backgroundColor: UI.colors.surfaceMuted,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    flexShrink: 1,
  },
  katPillText: {
    fontSize: 10,
    fontWeight: '600',
    color: UI.colors.secondary,
  },
  cardTitle: {
    fontSize: 13.5,
    fontWeight: '700',
    color: UI.colors.text,
    lineHeight: 18,
  },
  statusInlineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  statusText: {
    fontSize: 10.5,
    fontWeight: '700',
  },
  metaDotSep: {
    fontSize: 10,
    color: UI.colors.muted,
  },
  metaLocationText: {
    fontSize: 10.5,
    color: UI.colors.secondary,
    fontWeight: '500',
    flex: 1,
  },
  cardFooterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 2,
  },
  stokValue: {
    fontSize: 11.5,
    fontWeight: '700',
    color: UI.colors.text,
  },
  stokRed: {
    color: UI.colors.dangerDark,
  },
  stokOrange: {
    color: UI.colors.warningDark,
  },
  priceValue: {
    fontSize: 13.5,
    fontWeight: '800',
    color: UI.colors.primary,
  },

  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 44,
    paddingHorizontal: 20,
  },
  emptyIconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: UI.colors.surface,
    borderWidth: 1,
    borderColor: UI.colors.borderSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: UI.colors.text,
    marginBottom: 4,
  },
  emptySubtitle: {
    fontSize: 12.5,
    color: UI.colors.secondary,
    textAlign: 'center',
  },

  bottomBar: {
    backgroundColor: UI.colors.surface,
    borderTopWidth: 1,
    borderTopColor: UI.colors.borderSoft,
    paddingHorizontal: 16,
    paddingTop: 10,
  },

  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    justifyContent: 'flex-end',
  },
  sheetHandle: {
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#CBD5E1',
    alignSelf: 'center',
    marginBottom: 10,
  },
  detailModalContent: {
    backgroundColor: UI.colors.surface,
    backgroundImage: UI.gradients.headerSoft,
    borderTopLeftRadius: UI.radius.sheet,
    borderTopRightRadius: UI.radius.sheet,
    paddingHorizontal: 20,
    paddingTop: 10,
    maxHeight: '92%',
  },
  detailModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  detailBackBtn: {
    width: 34,
    height: 34,
    borderRadius: 11,
    backgroundColor: UI.colors.surface,
    borderWidth: 1,
    borderColor: UI.colors.borderSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailModalTitle: {
    fontSize: 16.5,
    fontWeight: '800',
    color: UI.colors.text,
  },
  detailHeroCard: {
    backgroundColor: UI.colors.surface,
    borderRadius: UI.radius.lg,
    borderWidth: 1,
    borderColor: UI.colors.borderSoft,
    padding: 16,
    alignItems: 'center',
    marginBottom: 12,
  },
  detailHeroWrapper: {
    width: 124,
    height: 124,
    borderRadius: UI.radius.lg,
    backgroundColor: UI.colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    overflow: 'hidden',
  },
  detailHeroImage: {
    width: '100%',
    height: '100%',
  },
  detailBadgeCenterRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 6,
  },
  detailItemTitle: {
    fontSize: 16.5,
    fontWeight: '800',
    color: UI.colors.text,
    textAlign: 'center',
    marginBottom: 6,
  },
  detailStatusCenter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 6,
  },
  detailStatusText: {
    fontSize: 12,
    fontWeight: '700',
  },
  detailPriceBig: {
    fontSize: 20,
    fontWeight: '800',
    color: UI.colors.primary,
    marginBottom: 4,
  },
  detailItemDesc: {
    fontSize: 12,
    color: UI.colors.secondary,
    textAlign: 'center',
    lineHeight: 17,
    marginTop: 4,
  },
  detailInfoListCard: {
    backgroundColor: UI.colors.surface,
    borderRadius: UI.radius.lg,
    borderWidth: 1,
    borderColor: UI.colors.borderSoft,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 4,
    marginBottom: 10,
  },
  detailSectionHeading: {
    fontSize: 13,
    fontWeight: '800',
    color: UI.colors.text,
    marginBottom: 6,
  },
  detailListRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: UI.colors.borderSubtle,
  },
  detailListLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  detailListLabel: {
    fontSize: 12.5,
    color: UI.colors.secondary,
    fontWeight: '600',
  },
  detailListValue: {
    fontSize: 12.5,
    fontWeight: '700',
    color: UI.colors.text,
  },
  adminCrudActionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 8,
  },
  deleteDangerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 42,
    paddingHorizontal: 16,
    borderRadius: UI.radius.md,
    backgroundColor: UI.colors.dangerBg,
    borderWidth: 1,
    borderColor: UI.colors.dangerBorder,
  },
  deleteDangerBtnText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: UI.colors.dangerDark,
  },
  detailActionRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 10,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: UI.colors.borderSubtle,
  },
  crudFormGroup: {
    marginBottom: 10,
  },
  crudLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: UI.colors.text,
    marginBottom: 5,
  },
  crudInput: {
    backgroundColor: UI.colors.surface,
    borderWidth: 1,
    borderColor: UI.colors.borderSoft,
    borderRadius: UI.radius.md,
    paddingHorizontal: 12,
    height: 42,
    fontSize: 13,
    color: UI.colors.text,
  },
  crudTwoCol: {
    flexDirection: 'row',
    gap: 8,
  },
});
