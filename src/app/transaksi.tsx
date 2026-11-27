import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  ActivityIndicator,
  FlatList,
  Modal,
  RefreshControl,
  ScrollView,
  StatusBar as RNStatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { SafeAreaView } from 'react-native-safe-area-context';

import {
  PrimaryGradientButton,
  SecondaryOutlineButton,
  SoftBlueBackdrop,
} from '../components/SoftBlueUI';
import { cardShadow, UI } from '../constants/uiTokens';
import { AccessDeniedView } from '../components/AccessDeniedView';
import { showAppAlert } from '../utils/feedback';

import { Barang, TransaksiStok } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { authorizeAction, hasPermission } from '../services/rbacService';
import {
  fetchCloudBarang,
  fetchCloudTransaksi,
  recordCloudStockMutation,
  shouldUseCloudDatabase,
} from '../services/supabaseBarangService';
import {
  getStoreSnapshot,
  recordStockMutation,
  subscribeInventoryStore,
} from '../services/inventoryStore';

/**
 * =========================================================================
 * HALAMAN TRANSAKSI STOK (src/app/transaksi.tsx)
 * - Barang Masuk: tambah stok barang ke gudang
 * - Barang Keluar: kurangi stok barang dari gudang
 * - Riwayat transaksi dengan filter jenis
 * - Tersimpan ke Supabase Cloud (jika dikonfigurasi) atau local store
 * =========================================================================
 */
export default function TransaksiScreen() {
  const { session, isLoading: authLoading } = useAuth();
  const sessionLoaded = !authLoading;
  const isCloudMode = shouldUseCloudDatabase(session);

  // Data state
  const [barangList, setBarangList] = useState<Barang[]>([]);
  const [transaksiList, setTransaksiList] = useState<TransaksiStok[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Form modal state
  const [modalVisible, setModalVisible] = useState(false);
  const [jenisTransaksi, setJenisTransaksi] = useState<'masuk' | 'keluar'>('masuk');
  const [selectedBarangId, setSelectedBarangId] = useState<number>(0);
  const [jumlahInput, setJumlahInput] = useState('1');
  const [catatanInput, setCatatanInput] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Filter state
  const [filterJenis, setFilterJenis] = useState<'semua' | 'masuk' | 'keluar'>('semua');

  // Permissions
  const canMasuk = hasPermission(session, 'stock:masuk');
  const canKeluar = hasPermission(session, 'stock:keluar');
  const canViewAll = hasPermission(session, 'transaksi:view_all');
  const canViewOwn = hasPermission(session, 'transaksi:view_own');

  // Load data
  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      if (isCloudMode) {
        const [barangRes, transaksiRes] = await Promise.all([
          fetchCloudBarang(),
          fetchCloudTransaksi(),
        ]);
        if (!barangRes.error) setBarangList(barangRes.data);
        if (!transaksiRes.error) setTransaksiList(transaksiRes.data);
      } else {
        const snap = getStoreSnapshot();
        setBarangList(snap.barangList);
        setTransaksiList(snap.transaksiList);
      }
    } catch (e: any) {
      showAppAlert('Gagal Memuat', e?.message || 'Terjadi kesalahan saat memuat data.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [isCloudMode]);

  useEffect(() => {
    if (!sessionLoaded) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadData();

    if (!isCloudMode) {
      const unsub = subscribeInventoryStore(() => {
        const snap = getStoreSnapshot();
        setBarangList(snap.barangList);
        setTransaksiList(snap.transaksiList);
      });
      return unsub;
    }
  }, [sessionLoaded, isCloudMode, loadData]);

  const onRefresh = async () => {
    setIsRefreshing(true);
    await loadData();
  };

  // Filtered transaksi list
  const filteredTransaksi = useMemo(() => {
    let list = [...transaksiList];
    // scope by role
    if (!canViewAll && session) {
      list = list.filter((t) => t.operator === session.user.name);
    }
    if (filterJenis !== 'semua') {
      list = list.filter((t) => t.jenis === filterJenis);
    }
    return list;
  }, [transaksiList, filterJenis, canViewAll, session]);

  const selectedBarang = barangList.find((b) => b.id === selectedBarangId) || barangList[0];
  const parsedJumlah = Math.max(1, parseInt(jumlahInput, 10) || 1);
  const estimasiStokAkhir = selectedBarang
    ? jenisTransaksi === 'masuk'
      ? selectedBarang.stok + parsedJumlah
      : selectedBarang.stok - parsedJumlah
    : 0;
  const isStokKurang =
    jenisTransaksi === 'keluar' && selectedBarang && parsedJumlah > selectedBarang.stok;

  const openModal = (jenis: 'masuk' | 'keluar') => {
    const perm = jenis === 'masuk' ? 'stock:masuk' : 'stock:keluar';
    const auth = authorizeAction(session, perm);
    if (!auth.allowed) {
      showAppAlert('Akses Ditolak (403)', auth.reason || 'Anda tidak memiliki izin transaksi stok.');
      return;
    }
    setJenisTransaksi(jenis);
    setJumlahInput('1');
    setCatatanInput(jenis === 'masuk' ? 'Pengadaan stok baru' : 'Distribusi barang');
    if (barangList.length > 0) setSelectedBarangId(barangList[0].id);
    setModalVisible(true);
  };

  const handleSimpan = async () => {
    if (!selectedBarang) {
      showAppAlert('Validasi', 'Pilih barang terlebih dahulu.');
      return;
    }
    if (parsedJumlah <= 0) {
      showAppAlert('Validasi', 'Jumlah harus lebih dari 0.');
      return;
    }
    if (isStokKurang) {
      showAppAlert(
        'Stok Tidak Cukup',
        `Stok tersedia: ${selectedBarang.stok} ${selectedBarang.satuan}`
      );
      return;
    }

    setIsSaving(true);
    try {
      if (isCloudMode && session && selectedBarang.cloud_id) {
        const res = await recordCloudStockMutation(session, {
          barang: selectedBarang,
          jenis: jenisTransaksi,
          jumlah: parsedJumlah,
          catatan: catatanInput,
        });
        if (!res.ok) {
          showAppAlert('Gagal', res.message);
          return;
        }
        setModalVisible(false);
        await loadData();
        showAppAlert(
          `Transaksi ${jenisTransaksi === 'masuk' ? 'Barang Masuk' : 'Barang Keluar'} Berhasil`,
          `${selectedBarang.nama_barang}\n` +
            `${jenisTransaksi === 'masuk' ? '+' : '-'}${parsedJumlah} ${selectedBarang.satuan}\n` +
            `Sisa stok: ${res.updatedBarang?.stok ?? estimasiStokAkhir} ${selectedBarang.satuan}\n\n` +
            `✅ Tersimpan di Supabase Cloud`
        );
      } else {
        // Local store
        if (!session) {
          showAppAlert('Error', 'Sesi tidak valid.');
          return;
        }
        const result = recordStockMutation(session, {
          id_barang: selectedBarang.id,
          jenis: jenisTransaksi,
          jumlah: parsedJumlah,
          catatan: catatanInput,
        });
        if (!result.ok) {
          showAppAlert(`Ditolak (${result.statusCode})`, result.message);
          return;
        }
        setModalVisible(false);
        showAppAlert(
          `Transaksi ${jenisTransaksi === 'masuk' ? 'Barang Masuk' : 'Barang Keluar'} Berhasil`,
          `${selectedBarang.nama_barang}\n` +
            `${jenisTransaksi === 'masuk' ? '+' : '-'}${parsedJumlah} ${selectedBarang.satuan}\n` +
            `Sisa stok: ${estimasiStokAkhir} ${selectedBarang.satuan}\n\n` +
            `📦 Tersimpan di penyimpanan lokal`
        );
      }
    } finally {
      setIsSaving(false);
    }
  };

  const changeJumlah = (delta: number) => {
    const current = parseInt(jumlahInput, 10) || 0;
    const next = Math.max(1, current + delta);
    setJumlahInput(String(next));
  };

  const formatTanggal = (tanggal: string) => tanggal;

  const renderTransaksiItem = ({ item }: { item: TransaksiStok }) => {
    const isMasuk = item.jenis === 'masuk';
    const isKoreksi = item.jenis === 'koreksi';
    const badgeColor = isMasuk
      ? UI.colors.success
      : isKoreksi
      ? UI.colors.warning
      : UI.colors.danger;
    const badgeBg = isMasuk ? '#dcfce7' : isKoreksi ? '#fef9c3' : '#fee2e2';
    const icon = isMasuk ? 'arrow-down-circle' : isKoreksi ? 'refresh-cw' : 'arrow-up-circle';
    const sign = isMasuk ? '+' : isKoreksi ? '±' : '-';

    return (
      <View style={styles.trxCard}>
        <View style={styles.trxIconWrap}>
          <Feather name={icon as any} size={22} color={badgeColor} />
        </View>
        <View style={styles.trxContent}>
          <View style={styles.trxTopRow}>
            <Text style={styles.trxNamaBarang} numberOfLines={1}>
              {item.nama_barang}
            </Text>
            <View style={[styles.jenisBadge, { backgroundColor: badgeBg }]}>
              <Text style={[styles.jenisBadgeText, { color: badgeColor }]}>
                {isMasuk ? 'Masuk' : isKoreksi ? 'Koreksi' : 'Keluar'}
              </Text>
            </View>
          </View>
          <View style={styles.trxMetaRow}>
            <Text style={styles.trxJumlah}>
              {sign}
              {item.jumlah} {item.satuan}
            </Text>
            <Text style={styles.trxDot}>·</Text>
            <Text style={styles.trxSisa}>Sisa: {item.sisa_stok}</Text>
          </View>
          <View style={styles.trxFooterRow}>
            <Feather name="user" size={11} color={UI.colors.muted} />
            <Text style={styles.trxOperator} numberOfLines={1}>
              {item.operator}
            </Text>
            <Text style={styles.trxDot}>·</Text>
            <Feather name="clock" size={11} color={UI.colors.muted} />
            <Text style={styles.trxTanggal}>{formatTanggal(item.tanggal)}</Text>
          </View>
          {item.catatan ? (
            <Text style={styles.trxCatatan} numberOfLines={1}>
              📝 {item.catatan}
            </Text>
          ) : null}
        </View>
      </View>
    );
  };

  if (sessionLoaded && (!session || (!canViewAll && !canViewOwn))) {
    return (
      <SoftBlueBackdrop>
        <SafeAreaView style={styles.safeArea}>
          <AccessDeniedView
            title="Akses Ditolak"
            message="Anda tidak memiliki izin untuk mengakses halaman Transaksi."
            actionLabel="Ke Dashboard"
            onAction={() => router.replace('/dashboard')}
          />
        </SafeAreaView>
      </SoftBlueBackdrop>
    );
  }

  return (
    <SoftBlueBackdrop>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <RNStatusBar barStyle="dark-content" />

        {/* ── HEADER ── */}
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
            <Text style={styles.headerTitle}>Transaksi Stok</Text>
            <Text style={styles.headerSubtitle}>
              {isCloudMode ? '☁️ Cloud Supabase' : '📦 Penyimpanan Lokal'}
            </Text>
          </View>

          <TouchableOpacity
            style={styles.refreshBtn}
            activeOpacity={0.75}
            onPress={onRefresh}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Feather name="refresh-cw" size={17} color={UI.colors.primary} />
          </TouchableOpacity>
        </View>

        {/* ── QUICK ACTION BUTTONS ── */}
        <View style={styles.actionRow}>
          <TouchableOpacity
            style={[styles.actionBtn, styles.actionBtnMasuk, !canMasuk && styles.actionBtnDisabled]}
            activeOpacity={0.8}
            onPress={() => openModal('masuk')}
          >
            <Feather name="arrow-down-circle" size={20} color="#FFFFFF" />
            <Text style={styles.actionBtnText}>Barang Masuk</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionBtn, styles.actionBtnKeluar, !canKeluar && styles.actionBtnDisabled]}
            activeOpacity={0.8}
            onPress={() => openModal('keluar')}
          >
            <Feather name="arrow-up-circle" size={20} color="#FFFFFF" />
            <Text style={styles.actionBtnText}>Barang Keluar</Text>
          </TouchableOpacity>
        </View>

        {/* ── FILTER CHIPS ── */}
        <View style={styles.filterRow}>
          <Text style={styles.filterLabel}>Riwayat:</Text>
          {(['semua', 'masuk', 'keluar'] as const).map((f) => (
            <TouchableOpacity
              key={f}
              style={[styles.filterChip, filterJenis === f && styles.filterChipActive]}
              activeOpacity={0.78}
              onPress={() => setFilterJenis(f)}
            >
              <Text style={[styles.filterChipText, filterJenis === f && styles.filterChipTextActive]}>
                {f === 'semua' ? 'Semua' : f === 'masuk' ? '↓ Masuk' : '↑ Keluar'}
              </Text>
            </TouchableOpacity>
          ))}

          <View style={styles.filterCountWrap}>
            <Text style={styles.filterCount}>{filteredTransaksi.length} transaksi</Text>
          </View>
        </View>

        {/* ── LIST / LOADING / EMPTY ── */}
        {isLoading ? (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color={UI.colors.primary} />
            <Text style={styles.loadingText}>Memuat transaksi...</Text>
          </View>
        ) : (
          <FlatList
            data={filteredTransaksi}
            keyExtractor={(item) => String(item.id)}
            renderItem={renderTransaksiItem}
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
                  <MaterialCommunityIcons name="swap-horizontal" size={34} color={UI.colors.muted} />
                </View>
                <Text style={styles.emptyTitle}>Belum ada transaksi</Text>
                <Text style={styles.emptySubtitle}>
                  Gunakan tombol Barang Masuk atau Barang Keluar untuk mencatat transaksi stok.
                </Text>
              </View>
            }
          />
        )}
      </SafeAreaView>

      {/* ══════════════════════════════════════════
          MODAL: FORM TRANSAKSI BARANG MASUK / KELUAR
          ══════════════════════════════════════════ */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <View style={styles.modalHandleBar} />
              <View style={styles.modalTitleRow}>
                <View
                  style={[
                    styles.modalTitleIcon,
                    jenisTransaksi === 'masuk' ? styles.iconBgMasuk : styles.iconBgKeluar,
                  ]}
                >
                  <Feather
                    name={jenisTransaksi === 'masuk' ? 'arrow-down-circle' : 'arrow-up-circle'}
                    size={22}
                    color="#FFFFFF"
                  />
                </View>
                <View>
                  <Text style={styles.modalTitle}>
                    {jenisTransaksi === 'masuk' ? 'Barang Masuk' : 'Barang Keluar'}
                  </Text>
                  <Text style={styles.modalSubtitle}>
                    {jenisTransaksi === 'masuk'
                      ? 'Tambah stok barang ke gudang'
                      : 'Kurangi stok barang dari gudang'}
                  </Text>
                </View>
              </View>
            </View>

            <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
              {/* Pilih Barang */}
              <Text style={styles.fieldLabel}>Pilih Barang</Text>
              {barangList.length === 0 ? (
                <View style={styles.emptyBarangWarn}>
                  <Feather name="alert-circle" size={16} color={UI.colors.warning} />
                  <Text style={styles.emptyBarangText}>
                    Tidak ada barang tersedia. Tambah barang terlebih dahulu.
                  </Text>
                </View>
              ) : (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={styles.barangPickerScroll}
                  contentContainerStyle={styles.barangPickerContent}
                >
                  {barangList.map((b) => {
                    const isSelected = b.id === selectedBarangId;
                    const isHabis = b.stok <= 0 && jenisTransaksi === 'keluar';
                    return (
                      <TouchableOpacity
                        key={b.id}
                        style={[
                          styles.barangChip,
                          isSelected && styles.barangChipSelected,
                          isHabis && styles.barangChipHabis,
                        ]}
                        activeOpacity={0.78}
                        onPress={() => setSelectedBarangId(b.id)}
                      >
                        <Text
                          style={[
                            styles.barangChipName,
                            isSelected && styles.barangChipNameSelected,
                          ]}
                          numberOfLines={1}
                        >
                          {b.nama_barang}
                        </Text>
                        <Text
                          style={[
                            styles.barangChipStok,
                            isSelected && styles.barangChipStokSelected,
                          ]}
                        >
                          Stok: {b.stok} {b.satuan}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              )}

              {/* Info Barang Terpilih */}
              {selectedBarang && (
                <View style={styles.selectedBarangInfo}>
                  <View style={styles.selectedBarangRow}>
                    <Feather name="box" size={14} color={UI.colors.secondary} />
                    <Text style={styles.selectedBarangText}>
                      {selectedBarang.kode_barang} · {selectedBarang.kategori}
                    </Text>
                  </View>
                  <View style={styles.selectedBarangRow}>
                    <Feather name="layers" size={14} color={UI.colors.secondary} />
                    <Text style={styles.selectedBarangText}>
                      Stok saat ini:{' '}
                      <Text style={styles.boldText}>{selectedBarang.stok} {selectedBarang.satuan}</Text>
                    </Text>
                  </View>
                </View>
              )}

              {/* Input Jumlah */}
              <Text style={styles.fieldLabel}>Jumlah</Text>
              <View style={styles.jumlahRow}>
                <TouchableOpacity
                  style={styles.jumlahBtn}
                  onPress={() => changeJumlah(-1)}
                  activeOpacity={0.75}
                >
                  <Feather name="minus" size={18} color={UI.colors.primary} />
                </TouchableOpacity>
                <TextInput
                  style={styles.jumlahInput}
                  value={jumlahInput}
                  onChangeText={(v) => setJumlahInput(v.replace(/[^0-9]/g, ''))}
                  keyboardType="number-pad"
                  textAlign="center"
                />
                <TouchableOpacity
                  style={styles.jumlahBtn}
                  onPress={() => changeJumlah(1)}
                  activeOpacity={0.75}
                >
                  <Feather name="plus" size={18} color={UI.colors.primary} />
                </TouchableOpacity>
                {selectedBarang && (
                  <Text style={styles.satuanLabel}>{selectedBarang.satuan}</Text>
                )}
              </View>

              {/* Estimasi Stok */}
              {selectedBarang && (
                <View
                  style={[styles.estimasiBox, isStokKurang && styles.estimasiBoxDanger]}
                >
                  {isStokKurang ? (
                    <>
                      <Feather name="alert-triangle" size={15} color={UI.colors.danger} />
                      <Text style={[styles.estimasiText, { color: UI.colors.danger }]}>
                        Stok tidak cukup! Tersedia: {selectedBarang.stok} {selectedBarang.satuan}
                      </Text>
                    </>
                  ) : (
                    <>
                      <Feather
                        name="trending-up"
                        size={15}
                        color={jenisTransaksi === 'masuk' ? UI.colors.success : UI.colors.primary}
                      />
                      <Text style={styles.estimasiText}>
                        Estimasi stok setelah transaksi:{' '}
                        <Text style={styles.boldText}>
                          {estimasiStokAkhir} {selectedBarang.satuan}
                        </Text>
                      </Text>
                    </>
                  )}
                </View>
              )}

              {/* Catatan */}
              <Text style={styles.fieldLabel}>Catatan (opsional)</Text>
              <TextInput
                style={styles.catatanInput}
                value={catatanInput}
                onChangeText={setCatatanInput}
                placeholder="Contoh: Pengadaan stok mingguan..."
                placeholderTextColor={UI.colors.muted}
                multiline
                numberOfLines={3}
              />

              {/* Mode Info */}
              <View style={styles.modeInfo}>
                <MaterialCommunityIcons
                  name={isCloudMode ? 'cloud-check' : 'database'}
                  size={14}
                  color={UI.colors.primary}
                />
                <Text style={styles.modeInfoText}>
                  {isCloudMode
                    ? 'Transaksi akan disimpan ke Supabase Cloud dan stok otomatis diperbarui.'
                    : 'Transaksi akan disimpan ke penyimpanan lokal aplikasi.'}
                </Text>
              </View>
            </ScrollView>

            {/* Footer Buttons */}
            <View style={styles.modalFooter}>
              <SecondaryOutlineButton
                label="Batal"
                onPress={() => setModalVisible(false)}
                style={styles.btnBatal}
              />
              <PrimaryGradientButton
                label={
                  isSaving
                    ? 'Menyimpan...'
                    : jenisTransaksi === 'masuk'
                    ? 'Simpan Masuk'
                    : 'Simpan Keluar'
                }
                onPress={handleSimpan}
                disabled={isSaving || barangList.length === 0 || !!isStokKurang}
                style={styles.btnSimpan}
              />
            </View>
          </View>
        </View>
      </Modal>
    </SoftBlueBackdrop>
  );
}

// ─────────────────────────── STYLES ───────────────────────────
const styles = StyleSheet.create({
  safeArea: { flex: 1 },

  // Header
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 10,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    ...cardShadow,
  },
  headerTitleWrap: { flex: 1 },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: UI.colors.text,
  },
  headerSubtitle: {
    fontSize: 11.5,
    color: UI.colors.secondary,
    marginTop: 1,
  },
  refreshBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    ...cardShadow,
  },

  // Action buttons
  actionRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 12,
    marginBottom: 12,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
    ...cardShadow,
  },
  actionBtnMasuk: { backgroundColor: UI.colors.success },
  actionBtnKeluar: { backgroundColor: UI.colors.danger },
  actionBtnDisabled: { opacity: 0.4 },
  actionBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  // Filter
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 10,
    gap: 6,
    flexWrap: 'wrap',
  },
  filterLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: UI.colors.secondary,
    marginRight: 2,
  },
  filterChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  filterChipActive: {
    backgroundColor: UI.colors.primary,
    borderColor: UI.colors.primary,
  },
  filterChipText: {
    fontSize: 11.5,
    fontWeight: '600',
    color: UI.colors.secondary,
  },
  filterChipTextActive: { color: '#FFFFFF' },
  filterCountWrap: { marginLeft: 'auto' },
  filterCount: {
    fontSize: 11.5,
    color: UI.colors.muted,
    fontWeight: '500',
  },

  // Loading / empty
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  loadingText: {
    fontSize: 13,
    color: UI.colors.secondary,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 32,
    gap: 10,
  },
  emptyIconCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: UI.colors.text,
  },
  emptySubtitle: {
    fontSize: 12.5,
    color: UI.colors.muted,
    textAlign: 'center',
    lineHeight: 18,
  },

  // List
  listContent: { paddingHorizontal: 16, paddingBottom: 32 },

  // Transaksi card
  trxCard: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    alignItems: 'flex-start',
    gap: 12,
    ...cardShadow,
  },
  trxIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: '#f8fafc',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  trxContent: { flex: 1 },
  trxTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 3,
  },
  trxNamaBarang: {
    fontSize: 13.5,
    fontWeight: '700',
    color: UI.colors.text,
    flex: 1,
    marginRight: 8,
  },
  jenisBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  jenisBadgeText: {
    fontSize: 10.5,
    fontWeight: '700',
  },
  trxMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 3,
  },
  trxJumlah: {
    fontSize: 13,
    fontWeight: '700',
    color: UI.colors.text,
  },
  trxDot: { fontSize: 12, color: UI.colors.muted },
  trxSisa: { fontSize: 12, color: UI.colors.secondary },
  trxFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  trxOperator: {
    fontSize: 11,
    color: UI.colors.secondary,
    maxWidth: 100,
  },
  trxTanggal: { fontSize: 11, color: UI.colors.muted },
  trxCatatan: {
    fontSize: 11,
    color: UI.colors.muted,
    marginTop: 3,
    fontStyle: 'italic',
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.42)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
  },
  modalHeader: {
    paddingTop: 10,
    paddingBottom: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  modalHandleBar: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#cbd5e1',
    alignSelf: 'center',
    marginBottom: 14,
  },
  modalTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  modalTitleIcon: {
    width: 44,
    height: 44,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBgMasuk: { backgroundColor: UI.colors.success },
  iconBgKeluar: { backgroundColor: UI.colors.danger },
  modalTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: UI.colors.text,
  },
  modalSubtitle: {
    fontSize: 12,
    color: UI.colors.secondary,
    marginTop: 2,
  },
  modalBody: {
    paddingHorizontal: 20,
    paddingTop: 16,
  },

  // Form fields
  fieldLabel: {
    fontSize: 12.5,
    fontWeight: '700',
    color: UI.colors.secondary,
    marginBottom: 8,
    marginTop: 14,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  emptyBarangWarn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#fef9c3',
    padding: 12,
    borderRadius: 10,
  },
  emptyBarangText: {
    fontSize: 12.5,
    color: '#92400e',
    flex: 1,
  },
  barangPickerScroll: { marginBottom: 4 },
  barangPickerContent: { gap: 8, paddingBottom: 4 },
  barangChip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: '#f8fafc',
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    minWidth: 110,
  },
  barangChipSelected: {
    backgroundColor: '#eff6ff',
    borderColor: UI.colors.primary,
  },
  barangChipHabis: {
    opacity: 0.4,
  },
  barangChipName: {
    fontSize: 13,
    fontWeight: '600',
    color: UI.colors.text,
    marginBottom: 2,
  },
  barangChipNameSelected: { color: UI.colors.primary },
  barangChipStok: {
    fontSize: 11,
    color: UI.colors.muted,
  },
  barangChipStokSelected: { color: UI.colors.primary },

  selectedBarangInfo: {
    backgroundColor: '#f8fafc',
    borderRadius: 10,
    padding: 12,
    gap: 5,
    marginTop: 6,
  },
  selectedBarangRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  selectedBarangText: {
    fontSize: 12.5,
    color: UI.colors.secondary,
  },
  boldText: { fontWeight: '700', color: UI.colors.text },

  jumlahRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  jumlahBtn: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: '#eff6ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  jumlahInput: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#f8fafc',
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    fontSize: 20,
    fontWeight: '700',
    color: UI.colors.text,
    paddingHorizontal: 8,
  },
  satuanLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: UI.colors.secondary,
    minWidth: 36,
  },

  estimasiBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#f0fdf4',
    borderRadius: 10,
    padding: 12,
    marginTop: 10,
  },
  estimasiBoxDanger: { backgroundColor: '#fef2f2' },
  estimasiText: {
    fontSize: 12.5,
    color: UI.colors.secondary,
    flex: 1,
  },

  catatanInput: {
    backgroundColor: '#f8fafc',
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    padding: 12,
    fontSize: 13.5,
    color: UI.colors.text,
    textAlignVertical: 'top',
    minHeight: 72,
  },

  modeInfo: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 7,
    backgroundColor: '#eff6ff',
    borderRadius: 10,
    padding: 11,
    marginTop: 14,
    marginBottom: 8,
  },
  modeInfoText: {
    fontSize: 11.5,
    color: UI.colors.primary,
    flex: 1,
    lineHeight: 16,
  },

  modalFooter: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 16,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  btnBatal: { flex: 1 },
  btnSimpan: { flex: 2 },
});
