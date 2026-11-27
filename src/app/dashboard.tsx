
import { Feather, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  ActivityIndicator,
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

import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { AccessDeniedView } from '../components/AccessDeniedView';
import {
  PrimaryGradientButton,
  SecondaryOutlineButton,
  SoftBlueBackdrop,
} from '../components/SoftBlueUI';

import { cardShadow, primaryButtonShadow, UI } from '../constants/uiTokens';
import { useNetworkStatus } from '../hooks/useNetworkStatus';
import { showAppAlert, showAppConfirm } from '../utils/feedback';

// Import Types
import {
  Barang,
  KoreksiStokRequest,
  TransaksiStok,
  User,
  UserRole,
} from '../types';

// Import Services & RBAC
import { useAuth } from '../contexts/AuthContext';
import { getAuthHeader } from '../services/authService';
import {
  calculateInventorySummary,
  filterItemsBelowMinimum,
} from '../services/dataService';
import {
  fetchCloudBarang,
  fetchCloudTransaksi,
  recordCloudStockMutation,
  shouldUseCloudDatabase,
} from '../services/supabaseBarangService';

import {
  authorizeAction,
  getRoleShortTitle,
  getScopedTransaksiList,
  hasPermission,
} from '../services/rbacService';

import {
  addManagedUser,
  getStoreSnapshot,
  recordStockMutation,
  reviewKoreksiStok,
  submitKoreksiStok,
  subscribeInventoryStore,
  toggleUserActiveStatus,
  updateWarehouseConfig,
} from '../services/inventoryStore';


/**
 * =========================================================================
 * HALAMAN 2: DASHBOARD DENGAN RBAC PENUH (src/app/dashboard.tsx)
 * 3 Pengalaman Dashboard Terpisah:
 * 1. Admin Gudang (Dhea Ayu): kontrol penuh, CRUD, koreksi stok, pengguna, pengaturan gudang
 * 2. Staff Inventory (Riqzy Ayu): operasional masuk/keluar, scan, riwayat pribadi, presensi GPS
 * 3. Manajer Operasional (Khansa Kirana): monitoring eksekutif, approval koreksi stok, laporan
 * =========================================================================
 */
export default function DashboardScreen() {
  const insets = useSafeAreaInsets();
  const { session, isLoading: authLoading, signOut, signInDemo } = useAuth();
  const isCloudMode = shouldUseCloudDatabase(session);

  const [storeSnapshot, setStoreSnapshot] = useState(() => getStoreSnapshot());
  const [cloudBarangList, setCloudBarangList] = useState<Barang[] | null>(null);
  const [cloudTransaksiList, setCloudTransaksiList] = useState<TransaksiStok[] | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [dashboardError, setDashboardError] = useState<string | null>(null);
  const [showTokenDetails, setShowTokenDetails] = useState<boolean>(false);

  // State Form Modal Interaktif: Stok Masuk & Stok Keluar
  const [stokModalType, setStokModalType] = useState<'masuk' | 'keluar' | null>(null);
  const [selectedBarangId, setSelectedBarangId] = useState<number>(1);
  const [jumlahInput, setJumlahInput] = useState<string>('5');
  const [catatanInput, setCatatanInput] = useState<string>('');

  // State Modal Koreksi Stok (Admin Gudang)
  const [isKoreksiModalVisible, setIsKoreksiModalVisible] = useState<boolean>(false);
  const [koreksiBarangId, setKoreksiBarangId] = useState<number>(1);
  const [koreksiStokFisik, setKoreksiStokFisik] = useState<string>('0');
  const [koreksiAlasan, setKoreksiAlasan] = useState<string>('');

  // State Modal Kelola Pengguna & Pengaturan Gudang (Admin Gudang)
  const [isUsersModalVisible, setIsUsersModalVisible] = useState<boolean>(false);
  const [newUserName, setNewUserName] = useState<string>('');
  const [newUserUsername, setNewUserUsername] = useState<string>('');
  const [newUserEmail, setNewUserEmail] = useState<string>('');
  const [newUserRole, setNewUserRole] = useState<UserRole>('Staff Inventory');

  const [isWarehouseModalVisible, setIsWarehouseModalVisible] = useState<boolean>(false);
  const [whNameDraft, setWhNameDraft] = useState<string>('');
  const [whAddressDraft, setWhAddressDraft] = useState<string>('');
  const [whRadiusDraft, setWhRadiusDraft] = useState<number>(100);

  // State Modal Approval Koreksi Stok (Manajer Operasional)
  const [isApprovalModalVisible, setIsApprovalModalVisible] = useState<boolean>(false);

  // State Modal Utama Bottom Nav: Mutasi, Laporan, Menu + Ganti Peran
  const [isMutasiModalVisible, setIsMutasiModalVisible] = useState<boolean>(false);
  const [mutasiFilter, setMutasiFilter] = useState<'semua' | 'masuk' | 'keluar'>('semua');
  const [isLaporanModalVisible, setIsLaporanModalVisible] = useState<boolean>(false);
  const [isMenuModalVisible, setIsMenuModalVisible] = useState<boolean>(false);
  const [menuViewMode, setMenuViewMode] = useState<'menu' | 'role'>('menu');
  const [pendingRoleKey, setPendingRoleKey] = useState<'admin' | 'staff' | 'manager'>('admin');

  const currentUser: User = session?.user || {
    id: 0,
    username: 'guest',
    name: 'Tamu',
    email: '-',
    role: 'Staff Inventory',
  };

  // Sinkronisasi reactive dengan shared store
  useEffect(() => {
    const unsubscribe = subscribeInventoryStore(() => {
      setStoreSnapshot(getStoreSnapshot());
    });
    return unsubscribe;
  }, []);

  const {
    barangList: localBarangList,
    transaksiList: localTransaksiList,
    summary: localSummary,
    alertItems: localAlertItems,
    koreksiList,
    managedUsers,
    warehouseConfig,
    presensiLogs,
  } = storeSnapshot;

  const barangList = isCloudMode && cloudBarangList !== null ? cloudBarangList : localBarangList;
  const transaksiList =
    isCloudMode && cloudTransaksiList !== null ? cloudTransaksiList : localTransaksiList;
  const summary = useMemo(
    () =>
      isCloudMode && cloudBarangList !== null
        ? calculateInventorySummary(barangList, transaksiList)
        : localSummary,
    [isCloudMode, cloudBarangList, barangList, transaksiList, localSummary]
  );
  const alertItems = useMemo(
    () =>
      isCloudMode && cloudBarangList !== null
        ? filterItemsBelowMinimum(barangList)
        : localAlertItems,
    [isCloudMode, cloudBarangList, barangList, localAlertItems]
  );

  // Hak Akses RBAC Turunan dari Token & Session
  const isAdmin = currentUser.role === 'Admin Gudang';
  const isStaff = currentUser.role === 'Staff Inventory';
  const isManager = currentUser.role === 'Pemilik Toko / Manajer';

  const canMutateStock = hasPermission(session, 'stock:masuk') && hasPermission(session, 'stock:keluar');
  const canScanBarcode = hasPermission(session, 'barcode:scan');
  const canViewReports = hasPermission(session, 'report:view');
  const canSubmitKoreksi = hasPermission(session, 'stock:koreksi_submit');
  const canApproveKoreksi = hasPermission(session, 'stock:koreksi_approve');
  const canManageUsers = hasPermission(session, 'users:manage');
  const canConfigWarehouse = hasPermission(session, 'warehouse:config');
  const canMonitorStaff = hasPermission(session, 'staff:monitor');
  const canSwitchDemoRole = authorizeAction(session, 'demo:switch_role').allowed;

  // Scope riwayat transaksi: Staff hanya melihat miliknya, Admin & Manajer melihat semua
  const scopedTransaksiList = useMemo(
    () => getScopedTransaksiList(transaksiList, session),
    [transaksiList, session]
  );

  const pendingKoreksiCount = useMemo(
    () => koreksiList.filter((k) => k.status === 'pending').length,
    [koreksiList]
  );

  const myLatestPresensi = useMemo(
    () => presensiLogs.find((p) => p.nama.toLowerCase() === currentUser.name.toLowerCase()),
    [presensiLogs, currentUser.name]
  );

  const todayFormatted = useMemo(
    () =>
      new Date().toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      }),
    []
  );

  // Buka Modal Formulir Stok Masuk / Keluar (Dengan Guard RBAC)
  const openStokModal = (type: 'masuk' | 'keluar') => {
    const perm = type === 'masuk' ? 'stock:masuk' : 'stock:keluar';
    const auth = authorizeAction(session, perm);
    if (!auth.allowed) {
      showAppAlert('Akses Ditolak (403)', auth.reason || 'Anda tidak memiliki izin transaksi stok.');
      return;
    }

    setStokModalType(type);
    setJumlahInput('5');
    setCatatanInput(type === 'masuk' ? 'Pengadaan Stok Baru' : 'Distribusi Unit Lab');
    if (barangList.length > 0) {
      setSelectedBarangId(barangList[0].id);
    }
  };

  const changeJumlah = (delta: number) => {
    const current = parseInt(jumlahInput, 10) || 0;
    const next = Math.max(1, current + delta);
    setJumlahInput(String(next));
  };

  const selectedBarang = barangList.find((b) => b.id === selectedBarangId) || barangList[0];
  const parsedJumlah = parseInt(jumlahInput, 10) || 0;
  const estimasiStokAkhir = selectedBarang
    ? stokModalType === 'masuk'
      ? selectedBarang.stok + parsedJumlah
      : selectedBarang.stok - parsedJumlah
    : 0;
  const isStokKurang =
    stokModalType === 'keluar' && selectedBarang && parsedJumlah > selectedBarang.stok;

  // Handler Simpan Transaksi Stok Masuk / Keluar melalui Store / Cloud Supabase yang dilindungi RBAC
  const handleSimpanTransaksi = async () => {
    if (!stokModalType || !selectedBarang) return;

    if (isCloudMode && session && selectedBarang.cloud_id) {
      const perm = stokModalType === 'masuk' ? 'stock:masuk' : 'stock:keluar';
      const auth = authorizeAction(session, perm);
      if (!auth.allowed) {
        showAppAlert(`Ditolak (${auth.statusCode})`, auth.reason || 'Akses ditolak.');
        return;
      }

      const cloudRes = await recordCloudStockMutation(session, {
        barang: selectedBarang,
        jenis: stokModalType,
        jumlah: parsedJumlah,
        catatan: catatanInput,
      });

      if (!cloudRes.ok) {
        showAppAlert('Gagal Menyimpan ke Cloud', cloudRes.message);
        return;
      }

      const isMasuk = stokModalType === 'masuk';
      const actionLabel = isMasuk ? 'Stok Masuk' : 'Stok Keluar';
      const sign = isMasuk ? '+' : '-';
      setStokModalType(null);
      await loadDashboardData();

      showAppAlert(
        `Sukses Catat ${actionLabel} (Cloud)`,
        `Transaksi tersimpan di Supabase!\n\n` +
          `Barang: ${selectedBarang.nama_barang}\n` +
          `Perubahan: ${sign}${parsedJumlah} ${selectedBarang.satuan}\n` +
          `Sisa Stok: ${cloudRes.updatedBarang?.stok ?? estimasiStokAkhir} ${selectedBarang.satuan}`
      );
      return;
    }

    const result = recordStockMutation(session, {
      id_barang: selectedBarang.id,
      jenis: stokModalType,
      jumlah: parsedJumlah,
      catatan: catatanInput,
    });

    if (!result.ok) {
      showAppAlert(`Ditolak (${result.statusCode})`, result.message);
      return;
    }

    const isMasuk = stokModalType === 'masuk';
    const actionLabel = isMasuk ? 'Stok Masuk' : 'Stok Keluar';
    const sign = isMasuk ? '+' : '-';
    setStokModalType(null);

    showAppAlert(
      `Sukses Catat ${actionLabel}`,
      `Transaksi berhasil disimpan!\n\n` +
        `Barang: ${selectedBarang.nama_barang}\n` +
        `Perubahan: ${sign}${parsedJumlah} ${selectedBarang.satuan}\n` +
        `Stok Sekarang: ${result.data?.sisa_stok} ${selectedBarang.satuan}\n` +
        `Catatan: ${catatanInput || '-'}\n` +
        `Operator: ${currentUser.name} (${currentUser.role})`
    );
  };

  // Handler Pengajuan Koreksi Stok (Admin Gudang)
  const openKoreksiModal = () => {
    const auth = authorizeAction(session, 'stock:koreksi_submit');
    if (!auth.allowed) {
      showAppAlert('Akses Ditolak (403)', auth.reason || 'Hanya Admin Gudang yang dapat mengajukan koreksi stok.');
      return;
    }
    if (barangList.length > 0) {
      setKoreksiBarangId(barangList[0].id);
      setKoreksiStokFisik(String(barangList[0].stok));
    }
    setKoreksiAlasan('');
    setIsKoreksiModalVisible(true);
  };

  const handleSubmitKoreksi = () => {
    const fisik = parseInt(koreksiStokFisik, 10);
    if (Number.isNaN(fisik)) {
      showAppAlert('Perhatian', 'Masukkan angka stok fisik yang valid.');
      return;
    }

    const res = submitKoreksiStok(session, {
      id_barang: koreksiBarangId,
      stok_fisik: fisik,
      alasan: koreksiAlasan,
    });

    if (!res.ok) {
      showAppAlert(`Ditolak (${res.statusCode})`, res.message);
      return;
    }

    setIsKoreksiModalVisible(false);
    showAppAlert('Koreksi Diajukan', res.message);
  };

  // Handler Approval Koreksi Stok (Manajer Operasional)
  const handleReviewKoreksi = (koreksiId: number, decision: 'approved' | 'rejected') => {
    const res = reviewKoreksiStok(session, koreksiId, decision);
    if (!res.ok) {
      showAppAlert(`Ditolak (${res.statusCode})`, res.message);
      return;
    }
    showAppAlert(
      decision === 'approved' ? 'Koreksi Disetujui' : 'Koreksi Ditolak',
      res.message
    );
  };

  // Handler Manajemen Pengguna (Admin Gudang)
  const handleAddUser = () => {
    const res = addManagedUser(session, {
      name: newUserName,
      username: newUserUsername,
      email: newUserEmail,
      role: newUserRole,
    });
    if (!res.ok) {
      showAppAlert(`Ditolak (${res.statusCode})`, res.message);
      return;
    }
    setNewUserName('');
    setNewUserUsername('');
    setNewUserEmail('');
    showAppAlert('Pengguna Ditambahkan', res.message);
  };

  const handleToggleUserStatus = (userId: number) => {
    const res = toggleUserActiveStatus(session, userId);
    if (!res.ok) {
      showAppAlert(`Ditolak (${res.statusCode})`, res.message);
      return;
    }
    showAppAlert('Status Pengguna', res.message);
  };

  // Handler Pengaturan Gudang (Admin Gudang)
  const openWarehouseModal = () => {
    const auth = authorizeAction(session, 'warehouse:config');
    if (!auth.allowed) {
      showAppAlert('Akses Ditolak (403)', auth.reason || 'Hanya Admin Gudang yang dapat mengubah pengaturan gudang.');
      return;
    }
    setWhNameDraft(warehouseConfig.nama_gudang);
    setWhAddressDraft(warehouseConfig.alamat_gudang);
    setWhRadiusDraft(warehouseConfig.radius_geofence);
    setIsWarehouseModalVisible(true);
  };

  const handleSaveWarehouseConfig = () => {
    const res = updateWarehouseConfig(session, {
      nama_gudang: whNameDraft.trim() || warehouseConfig.nama_gudang,
      alamat_gudang: whAddressDraft.trim() || warehouseConfig.alamat_gudang,
      radius_geofence: whRadiusDraft,
    });
    if (!res.ok) {
      showAppAlert(`Ditolak (${res.statusCode})`, res.message);
      return;
    }
    setIsWarehouseModalVisible(false);
    showAppAlert('Pengaturan Disimpan', res.message);
  };

  const formatRupiah = (num: number) => {
    return 'Rp ' + Number(num).toLocaleString('id-ID');
  };

  // Handler Ganti Peran Demo (Hanya diizinkan saat sesi demo aktif)
  const handleQuickSwitchRole = async (roleKey: 'admin' | 'staff' | 'manager') => {
    const auth = authorizeAction(session, 'demo:switch_role');
    if (!auth.allowed) {
      showAppAlert('Akses Ditolak (403)', auth.reason || 'Pergantian peran diblokir pada sesi produksi.');
      return;
    }

    try {
      const newSession = await signInDemo(roleKey);
      setMenuViewMode('menu');
      showAppAlert(
        'Peran Berhasil Diperbarui',
        `Sesi aktif sekarang sebagai:\n• Nama: ${newSession.user.name}\n• Peran: ${newSession.user.role}\n• Email: ${newSession.user.email}`
      );
    } catch (err: any) {
      showAppAlert('Gagal Ganti Peran', err?.message || 'Terjadi kesalahan sistem.');
    }
  };

  // Kalkulasi Finansial Inventaris (Hanya relevan untuk Admin & Manajer)
  const totalAsetBeli = useMemo(() => {
    return barangList.reduce((acc, b) => acc + b.harga_beli * b.stok, 0);
  }, [barangList]);

  const totalNilaiJual = useMemo(() => {
    return barangList.reduce((acc, b) => acc + b.harga_jual * b.stok, 0);
  }, [barangList]);

  const potensiMargin = totalNilaiJual - totalAsetBeli;
  const persentaseMargin =
    totalAsetBeli > 0 ? ((potensiMargin / totalAsetBeli) * 100).toFixed(1) : '0';

  const kategoriSummary = useMemo(() => {
    const map = new Map<string, { count: number; totalStok: number; totalNilai: number }>();
    for (const b of barangList) {
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
  }, [barangList]);

  const filteredMutasiList = useMemo(() => {
    if (mutasiFilter === 'semua') return scopedTransaksiList;
    return scopedTransaksiList.filter((t) => t.jenis === mutasiFilter);
  }, [mutasiFilter, scopedTransaksiList]);

  const countMutasiMasuk = scopedTransaksiList.filter((t) => t.jenis === 'masuk').length;
  const countMutasiKeluar = scopedTransaksiList.filter((t) => t.jenis === 'keluar').length;
  const totalSkuForBar = Math.max(
    1,
    summary.statusAman + summary.statusMenipis + summary.statusHabis
  );

  const loadDashboardData = useCallback(async () => {
    setIsLoading(true);
    setDashboardError(null);
    try {
      setStoreSnapshot(getStoreSnapshot());
      if (isCloudMode) {
        const [barangRes, trxRes] = await Promise.all([
          fetchCloudBarang(),
          fetchCloudTransaksi(),
        ]);
        if (barangRes.error) {
          throw new Error(barangRes.error);
        }
        setCloudBarangList(barangRes.data);
        setCloudTransaksiList(trxRes.error ? [] : trxRes.data);
      } else {
        setCloudBarangList(null);
        setCloudTransaksiList(null);
      }
      setDashboardError(null);
    } catch (error: any) {
      console.warn('Gagal memuat data dashboard:', error);
      setDashboardError(error?.message || 'Gagal memuat data ringkasan inventaris.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [isCloudMode]);

  const { isOffline } = useNetworkStatus({
    onReconnect: async () => {
      await loadDashboardData();
    },
    cooldownMs: 4000,
  });

  useEffect(() => {
    if (authLoading) return;
    loadDashboardData();
  }, [authLoading, loadDashboardData]);

  const onRefresh = async () => {
    setIsRefreshing(true);
    await loadDashboardData();
  };

  const handleLogout = () => {
    showAppConfirm(
      'Konfirmasi Keluar',
      'Apakah Anda yakin ingin keluar dari akun EduStock?',
      'Ya, Keluar',
      async () => {
        await signOut();
        router.replace('/');
      },
      true
    );
  };

  const handleTestAuthHeader = async () => {
    const header = await getAuthHeader();
    showAppAlert(
      'Header Autentikasi Token (HTTP Bearer)',
      `Header HTTP siap dikirim ke Backend API:\n\nAuthorization: ${
        header.Authorization || 'Tidak ada token'
      }\n\nRole Token: ${currentUser.role}\nMode Sesi: ${
        session?.isDemo ? 'Demo / Simulasi' : 'Akun Reguler'
      }`
    );
  };

  const openMenuSheet = () => {
    const roleKey =
      currentUser.username === 'staff'
        ? 'staff'
        : currentUser.username === 'manager'
        ? 'manager'
        : 'admin';
    setPendingRoleKey(roleKey);
    setMenuViewMode('menu');
    setIsMenuModalVisible(true);
  };

  if (isLoading) {
    return (
      <SoftBlueBackdrop>
        <SafeAreaView style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={UI.colors.primary} />
          <Text style={styles.loadingText}>Memuat Dashboard EduStock...</Text>
        </SafeAreaView>
      </SoftBlueBackdrop>
    );
  }

  // Guard Route: Jika belum terautentikasi / token tidak ada -> Tolak Akses
  if (!session || !authorizeAction(session, 'dashboard:view').allowed) {
    return (
      <SoftBlueBackdrop>
        <SafeAreaView style={styles.safeArea}>
          <AccessDeniedView
            title="Sesi Autentikasi Diperlukan"
            message="Anda belum masuk atau sesi token telah berakhir. Silakan login menggunakan akun EduStock Anda."
            actionLabel="Masuk ke Halaman Login"
            onAction={() => router.replace('/')}
          />
        </SafeAreaView>
      </SoftBlueBackdrop>
    );
  }

  if (dashboardError) {
    return (
      <SoftBlueBackdrop>
        <SafeAreaView style={styles.loadingContainer}>
          <View style={styles.errorIconBadge}>
            <Feather name="alert-triangle" size={36} color={UI.colors.dangerDark} />
          </View>
          <Text style={styles.dashboardErrorTitle}>Gagal Memuat Dashboard</Text>
          <Text style={styles.dashboardErrorSubtitle}>{dashboardError}</Text>
          <PrimaryGradientButton
            label="Coba Lagi"
            onPress={loadDashboardData}
            iconLeft={<Feather name="refresh-cw" size={15} color="#FFFFFF" />}
            style={{ paddingHorizontal: 24, marginTop: 8 }}
          />
        </SafeAreaView>
      </SoftBlueBackdrop>
    );
  }

  return (
    <SoftBlueBackdrop>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        {/* Top App Bar */}
        <View style={styles.dashHeader}>
          <View style={styles.dashHeaderLeft}>
            <View style={styles.miniLogoCube}>
              <Feather name="box" size={15} color="#FFFFFF" />
            </View>
            <View>
              <Text style={styles.dashHeaderTitle}>EduStock</Text>
              <Text style={styles.dashHeaderSub}>{getRoleShortTitle(currentUser.role)}</Text>
            </View>
          </View>

          <View style={styles.dashHeaderRight}>
            <TouchableOpacity
              style={styles.headerBellBtn}
              activeOpacity={0.75}
              onPress={() => {
                if (isManager) {
                  setIsApprovalModalVisible(true);
                } else {
                  setIsMutasiModalVisible(true);
                }
              }}
            >
              <Feather name="bell" size={16} color={UI.colors.text} />
              {(isManager ? pendingKoreksiCount > 0 : alertItems.length > 0) && (
                <View style={styles.headerBellDot} />
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.logoutBtn}
              activeOpacity={0.75}
              onPress={handleLogout}
            >
              <Feather name="log-out" size={14} color={UI.colors.dangerDark} />
              <Text style={styles.logoutBtnText}>Keluar</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Main Scroll Content */}
        <ScrollView
          style={styles.dashScrollView}
          contentContainerStyle={styles.dashScrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={onRefresh}
              colors={[UI.colors.primary]}
            />
          }
        >
          {isOffline && (
            <View style={styles.offlineAlertCard}>
              <Feather
                name="wifi-off"
                size={15}
                color={UI.colors.warningDark}
                style={{ marginRight: 8 }}
              />
              <Text style={styles.offlineAlertText}>
                Mode Offline: Menampilkan data inventaris lokal.
              </Text>
            </View>
          )}

          {/* Greeting Section */}
          <View style={styles.greetingRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.greetingName}>Halo, {currentUser.name} 👋</Text>
              <View style={styles.greetingRoleRow}>
                <View style={styles.roleBadge}>
                  <Text style={styles.roleBadgeText}>{getRoleShortTitle(currentUser.role)}</Text>
                </View>
                <View style={styles.sessionTypePill}>
                  <Text style={styles.sessionTypeText}>
                    {session.isDemo ? 'Mode Demo' : 'Sesi Reguler'}
                  </Text>
                </View>
                <TouchableOpacity onPress={handleLogout} activeOpacity={0.7}>
                  <Text style={styles.switchAccountLink}>Ganti Akun</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {/* Status Strip Card (Aman / Menipis / Habis) */}
          <View style={styles.statusStripCard}>
            <View style={styles.statusCol}>
              <View style={styles.statusLabelRow}>
                <View style={[styles.statusDot, { backgroundColor: UI.colors.success }]} />
                <Text style={styles.statusColLabel}>Aman</Text>
              </View>
              <Text style={styles.statusColValue}>{summary.statusAman}</Text>
            </View>

            <View style={styles.statusDivider} />

            <View style={styles.statusCol}>
              <View style={styles.statusLabelRow}>
                <View style={[styles.statusDot, { backgroundColor: UI.colors.warning }]} />
                <Text style={styles.statusColLabel}>Menipis</Text>
              </View>
              <Text style={styles.statusColValue}>{summary.statusMenipis}</Text>
            </View>

            <View style={styles.statusDivider} />

            <View style={styles.statusCol}>
              <View style={styles.statusLabelRow}>
                <View style={[styles.statusDot, { backgroundColor: UI.colors.danger }]} />
                <Text style={styles.statusColLabel}>Habis</Text>
              </View>
              <Text style={styles.statusColValue}>{summary.statusHabis}</Text>
            </View>
          </View>

          {/* ============================================================= */}
          {/* KONTEN KHUSUS PER ROLE (3 PENGALAMAN DASHBOARD BERBEDA)       */}
          {/* ============================================================= */}

          {isAdmin && (
            <>
              {/* ADMIN GUDANG: KPI Penuh */}
              <View style={styles.sectionHeaderRow}>
                <Text style={styles.sectionTitle}>Ringkasan Kendali Gudang</Text>
              </View>
              <View style={styles.statsGrid}>
                <View style={styles.statsRow}>
                  <TouchableOpacity
                    style={[styles.statCard, styles.clickableStatCard]}
                    activeOpacity={0.8}
                    onPress={() => router.push('/barang')}
                  >
                    <View style={styles.statTopRow}>
                      <View style={styles.statIconBadge}>
                        <Feather name="box" size={16} color={UI.colors.primary} />
                      </View>
                      <Feather name="arrow-up-right" size={15} color={UI.colors.primary} />
                    </View>
                    <Text style={styles.statNumber}>{summary.totalBarang}</Text>
                    <Text style={styles.statTitle}>Kelola Barang</Text>
                  </TouchableOpacity>

                  <View style={styles.statCard}>
                    <View style={styles.statTopRow}>
                      <View style={styles.statIconBadge}>
                        <Feather name="layers" size={16} color={UI.colors.primary} />
                      </View>
                    </View>
                    <Text style={styles.statNumber}>{summary.totalStok}</Text>
                    <Text style={styles.statTitle}>Total Unit Stok</Text>
                  </View>
                </View>

                <View style={styles.statsRow}>
                  <View style={styles.statCard}>
                    <View style={styles.statTopRow}>
                      <View
                        style={[
                          styles.statIconBadge,
                          summary.stokMinimumCount > 0 && { backgroundColor: UI.colors.dangerBg },
                        ]}
                      >
                        <Feather
                          name="alert-circle"
                          size={16}
                          color={
                            summary.stokMinimumCount > 0
                              ? UI.colors.dangerDark
                              : UI.colors.primary
                          }
                        />
                      </View>
                    </View>
                    <Text
                      style={[
                        styles.statNumber,
                        summary.stokMinimumCount > 0 && { color: UI.colors.dangerDark },
                      ]}
                    >
                      {summary.stokMinimumCount}
                    </Text>
                    <Text style={styles.statTitle}>Stok Minimum</Text>
                  </View>

                  <View style={styles.statCard}>
                    <View style={styles.statTopRow}>
                      <View style={styles.statIconBadge}>
                        <Feather name="users" size={16} color={UI.colors.primary} />
                      </View>
                    </View>
                    <Text style={styles.statNumber}>{managedUsers.length}</Text>
                    <Text style={styles.statTitle}>Pengguna Terdaftar</Text>
                  </View>
                </View>
              </View>

              {/* Aksi Cepat Admin: Masuk, Keluar, Koreksi Stok, Kelola Barang */}
              <View style={styles.sectionHeaderRow}>
                <Text style={styles.sectionTitle}>Aksi Cepat Administrator</Text>
              </View>
              <View style={styles.quickActionsCard}>
                <TouchableOpacity
                  style={styles.quickActionItem}
                  activeOpacity={0.78}
                  onPress={() => openStokModal('masuk')}
                >
                  <View style={styles.quickActionCircle}>
                    <Feather name="plus" size={18} color={UI.colors.primary} />
                  </View>
                  <Text style={styles.quickActionLabel}>Stok{'\n'}Masuk</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.quickActionItem}
                  activeOpacity={0.78}
                  onPress={() => openStokModal('keluar')}
                >
                  <View style={styles.quickActionCircle}>
                    <Feather name="minus" size={18} color={UI.colors.primary} />
                  </View>
                  <Text style={styles.quickActionLabel}>Stok{'\n'}Keluar</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.quickActionItem}
                  activeOpacity={0.78}
                  onPress={openKoreksiModal}
                >
                  <View style={styles.quickActionCircle}>
                    <Feather name="sliders" size={17} color={UI.colors.primary} />
                  </View>
                  <Text style={styles.quickActionLabel}>Koreksi{'\n'}Stok</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.quickActionItem}
                  activeOpacity={0.78}
                  onPress={() => router.push('/scanner')}
                >
                  <View style={styles.quickActionCircle}>
                    <Feather name="camera" size={17} color={UI.colors.primary} />
                  </View>
                  <Text style={styles.quickActionLabel}>Scan{'\n'}Barcode</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.quickActionItem}
                  activeOpacity={0.78}
                  onPress={() => router.push('/transaksi' as any)}
                >
                  <View style={[styles.quickActionCircle, { backgroundColor: '#dcfce7' }]}>
                    <MaterialCommunityIcons name="swap-horizontal" size={19} color={UI.colors.success} />
                  </View>
                  <Text style={styles.quickActionLabel}>Riwayat{'\n'}Transaksi</Text>
                </TouchableOpacity>
              </View>

              {/* Panel Administrasi Sistem Eksklusif Admin */}
              <View style={styles.adminControlRow}>
                <TouchableOpacity
                  style={styles.adminControlCard}
                  activeOpacity={0.8}
                  onPress={() => setIsUsersModalVisible(true)}
                >
                  <View style={styles.adminControlIcon}>
                    <Feather name="users" size={17} color={UI.colors.primary} />
                  </View>
                  <Text style={styles.adminControlTitle}>Kelola Pengguna</Text>
                  <Text style={styles.adminControlSub}>
                    {managedUsers.filter((u) => u.aktif !== false).length} akun aktif
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.adminControlCard}
                  activeOpacity={0.8}
                  onPress={openWarehouseModal}
                >
                  <View style={styles.adminControlIcon}>
                    <Feather name="settings" size={17} color={UI.colors.primary} />
                  </View>
                  <Text style={styles.adminControlTitle}>Pengaturan Gudang</Text>
                  <Text style={styles.adminControlSub}>
                    Radius {warehouseConfig.radius_geofence}m
                  </Text>
                </TouchableOpacity>
              </View>
            </>
          )}

          {isStaff && (
            <>
              {/* STAFF INVENTORY: Fokus Operasional Harian (Tanpa Valuasi & Pengaturan Sistem) */}
              <View style={styles.sectionHeaderRow}>
                <Text style={styles.sectionTitle}>Ringkasan Operasional</Text>
              </View>
              <View style={styles.statsGrid}>
                <View style={styles.statsRow}>
                  <TouchableOpacity
                    style={[styles.statCard, styles.clickableStatCard]}
                    activeOpacity={0.8}
                    onPress={() => router.push('/barang')}
                  >
                    <View style={styles.statTopRow}>
                      <View style={styles.statIconBadge}>
                        <Feather name="box" size={16} color={UI.colors.primary} />
                      </View>
                      <Feather name="arrow-up-right" size={15} color={UI.colors.primary} />
                    </View>
                    <Text style={styles.statNumber}>{summary.totalBarang}</Text>
                    <Text style={styles.statTitle}>Katalog Barang</Text>
                  </TouchableOpacity>

                  <View style={styles.statCard}>
                    <View style={styles.statTopRow}>
                      <View style={styles.statIconBadge}>
                        <Feather name="activity" size={16} color={UI.colors.primary} />
                      </View>
                    </View>
                    <Text style={styles.statNumber}>{scopedTransaksiList.length}</Text>
                    <Text style={styles.statTitle}>Transaksi Saya</Text>
                  </View>
                </View>
              </View>

              {/* Status Presensi Staff Hari Ini */}
              <TouchableOpacity
                style={styles.presensiStatusCard}
                activeOpacity={0.82}
                onPress={() => router.push('/lokasi' as any)}
              >
                <View style={styles.presensiIconCircle}>
                  <Feather name="map-pin" size={18} color="#FFFFFF" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.presensiCardTitle}>Presensi GPS Gudang</Text>
                  <Text style={styles.presensiCardSub}>
                    {myLatestPresensi
                      ? `Terakhir: ${myLatestPresensi.tanggal} • ${myLatestPresensi.waktu} (${
                          myLatestPresensi.dalam_area ? 'Dalam Area' : 'Di Luar Area'
                        })`
                      : 'Belum ada presensi tercatat hari ini'}
                  </Text>
                </View>
                <View style={styles.presensiActionBadge}>
                  <Text style={styles.presensiActionText}>Presensi</Text>
                </View>
              </TouchableOpacity>

              {/* Aksi Cepat Staff */}
              <View style={styles.sectionHeaderRow}>
                <Text style={styles.sectionTitle}>Aksi Cepat Operasional</Text>
              </View>
              <View style={styles.quickActionsCard}>
                <TouchableOpacity
                  style={styles.quickActionItem}
                  activeOpacity={0.78}
                  onPress={() => openStokModal('masuk')}
                >
                  <View style={styles.quickActionCircle}>
                    <Feather name="plus" size={18} color={UI.colors.primary} />
                  </View>
                  <Text style={styles.quickActionLabel}>Stok{'\n'}Masuk</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.quickActionItem}
                  activeOpacity={0.78}
                  onPress={() => openStokModal('keluar')}
                >
                  <View style={styles.quickActionCircle}>
                    <Feather name="minus" size={18} color={UI.colors.primary} />
                  </View>
                  <Text style={styles.quickActionLabel}>Stok{'\n'}Keluar</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.quickActionItem}
                  activeOpacity={0.78}
                  onPress={() => router.push('/scanner')}
                >
                  <View style={styles.quickActionCircle}>
                    <Feather name="camera" size={17} color={UI.colors.primary} />
                  </View>
                  <Text style={styles.quickActionLabel}>Scan{'\n'}Barcode</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.quickActionItem}
                  activeOpacity={0.78}
                  onPress={() => router.push('/lokasi' as any)}
                >
                  <View style={styles.quickActionCircle}>
                    <Feather name="navigation" size={17} color={UI.colors.primary} />
                  </View>
                  <Text style={styles.quickActionLabel}>Presensi{'\n'}GPS</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.quickActionItem}
                  activeOpacity={0.78}
                  onPress={() => router.push('/transaksi' as any)}
                >
                  <View style={[styles.quickActionCircle, { backgroundColor: '#dcfce7' }]}>
                    <MaterialCommunityIcons name="swap-horizontal" size={19} color={UI.colors.success} />
                  </View>
                  <Text style={styles.quickActionLabel}>Riwayat{'\n'}Transaksi</Text>
                </TouchableOpacity>
              </View>
            </>
          )}

          {isManager && (
            <>
              {/* MANAJER OPERASIONAL: Monitoring Eksekutif & Persetujuan Koreksi Stok */}
              <View style={styles.sectionHeaderRow}>
                <Text style={styles.sectionTitle}>Ringkasan Manajerial</Text>
              </View>
              <View style={styles.statsGrid}>
                <View style={styles.statsRow}>
                  <TouchableOpacity
                    style={[styles.statCard, styles.clickableStatCard]}
                    activeOpacity={0.8}
                    onPress={() => setIsLaporanModalVisible(true)}
                  >
                    <View style={styles.statTopRow}>
                      <View style={styles.statIconBadge}>
                        <Feather name="dollar-sign" size={16} color={UI.colors.primary} />
                      </View>
                      <Feather name="arrow-up-right" size={15} color={UI.colors.primary} />
                    </View>
                    <Text style={styles.statMoneyNumber} numberOfLines={1}>
                      {formatRupiah(totalAsetBeli)}
                    </Text>
                    <Text style={styles.statTitle}>Valuasi Aset Gudang</Text>
                  </TouchableOpacity>

                  <View style={styles.statCard}>
                    <View style={styles.statTopRow}>
                      <View style={styles.statIconBadge}>
                        <Feather name="trending-up" size={16} color={UI.colors.primary} />
                      </View>
                    </View>
                    <Text style={[styles.statNumber, { color: UI.colors.success }]}>
                      +{persentaseMargin}%
                    </Text>
                    <Text style={styles.statTitle}>Potensi Margin</Text>
                  </View>
                </View>

                <View style={styles.statsRow}>
                  <TouchableOpacity
                    style={styles.statCard}
                    activeOpacity={0.8}
                    onPress={() => router.push('/barang')}
                  >
                    <View style={styles.statTopRow}>
                      <View style={styles.statIconBadge}>
                        <Feather name="box" size={16} color={UI.colors.primary} />
                      </View>
                    </View>
                    <Text style={styles.statNumber}>{summary.totalBarang}</Text>
                    <Text style={styles.statTitle}>Total SKU Katalog</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.statCard,
                      pendingKoreksiCount > 0 && { borderColor: UI.colors.primaryBorder },
                    ]}
                    activeOpacity={0.8}
                    onPress={() => setIsApprovalModalVisible(true)}
                  >
                    <View style={styles.statTopRow}>
                      <View style={styles.statIconBadge}>
                        <Feather name="check-square" size={16} color={UI.colors.primary} />
                      </View>
                    </View>
                    <Text style={styles.statNumber}>{pendingKoreksiCount}</Text>
                    <Text style={styles.statTitle}>Menunggu Approval</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Persetujuan Koreksi Stok (Eksklusif Manajer) */}
              <View style={styles.activityHeaderRow}>
                <Text style={styles.sectionTitle}>Persetujuan Koreksi Stok</Text>
                <TouchableOpacity onPress={() => setIsApprovalModalVisible(true)}>
                  <Text style={styles.linkViewAll}>Lihat Semua ({koreksiList.length}) →</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.approvalBox}>
                {koreksiList.filter((k) => k.status === 'pending').length === 0 ? (
                  <View style={styles.alertEmptyBox}>
                    <Feather name="check-circle" size={15} color={UI.colors.success} />
                    <Text style={styles.alertEmptyText}>
                      Tidak ada pengajuan koreksi stok yang menunggu persetujuan.
                    </Text>
                  </View>
                ) : (
                  koreksiList
                    .filter((k) => k.status === 'pending')
                    .map((req: KoreksiStokRequest) => (
                      <View key={req.id} style={styles.approvalItemCard}>
                        <View style={styles.approvalTopRow}>
                          <Text style={styles.approvalItemName} numberOfLines={1}>
                            {req.nama_barang}
                          </Text>
                          <View style={styles.pendingPill}>
                            <Text style={styles.pendingPillText}>Menunggu</Text>
                          </View>
                        </View>
                        <Text style={styles.approvalMeta}>
                          Sistem: {req.stok_sistem} → Fisik: {req.stok_fisik} ({req.selisih >= 0 ? `+${req.selisih}` : req.selisih} {req.satuan})
                        </Text>
                        <Text style={styles.approvalReason}>
                          Alasan: {req.alasan} • Oleh {req.diajukan_oleh}
                        </Text>
                        <View style={styles.approvalActionsRow}>
                          <SecondaryOutlineButton
                            label="Tolak"
                            onPress={() => handleReviewKoreksi(req.id, 'rejected')}
                            style={{ flex: 1, height: 38 }}
                            textStyle={{ fontSize: 12.5 }}
                          />
                          <PrimaryGradientButton
                            label="Setujui Koreksi"
                            onPress={() => handleReviewKoreksi(req.id, 'approved')}
                            style={{ flex: 1.4, height: 38 }}
                            textStyle={{ fontSize: 12.5 }}
                          />
                        </View>
                      </View>
                    ))
                )}
              </View>

              {/* Aksi Cepat Manajer (Khusus Monitoring & Laporan — Tanpa Mutasi Rutin / Scan) */}
              <View style={styles.sectionHeaderRow}>
                <Text style={styles.sectionTitle}>Akses Monitoring</Text>
              </View>
              <View style={styles.quickActionsCard}>
                <TouchableOpacity
                  style={styles.quickActionItem}
                  activeOpacity={0.78}
                  onPress={() => setIsLaporanModalVisible(true)}
                >
                  <View style={styles.quickActionCircle}>
                    <Feather name="bar-chart-2" size={17} color={UI.colors.primary} />
                  </View>
                  <Text style={styles.quickActionLabel}>Laporan{'\n'}Valuasi</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.quickActionItem}
                  activeOpacity={0.78}
                  onPress={() => setIsMutasiModalVisible(true)}
                >
                  <View style={styles.quickActionCircle}>
                    <MaterialCommunityIcons name="swap-vertical" size={19} color={UI.colors.primary} />
                  </View>
                  <Text style={styles.quickActionLabel}>Monitor{'\n'}Mutasi</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.quickActionItem}
                  activeOpacity={0.78}
                  onPress={() => router.push('/barang')}
                >
                  <View style={styles.quickActionCircle}>
                    <Feather name="box" size={17} color={UI.colors.primary} />
                  </View>
                  <Text style={styles.quickActionLabel}>Lihat{'\n'}Katalog</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.quickActionItem}
                  activeOpacity={0.78}
                  onPress={() => router.push('/lokasi' as any)}
                >
                  <View style={styles.quickActionCircle}>
                    <Feather name="map-pin" size={17} color={UI.colors.primary} />
                  </View>
                  <Text style={styles.quickActionLabel}>Lokasi &{'\n'}Presensi</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.quickActionItem}
                  activeOpacity={0.78}
                  onPress={() => router.push('/transaksi' as any)}
                >
                  <View style={[styles.quickActionCircle, { backgroundColor: '#dcfce7' }]}>
                    <MaterialCommunityIcons name="swap-horizontal" size={19} color={UI.colors.success} />
                  </View>
                  <Text style={styles.quickActionLabel}>Riwayat{'\n'}Transaksi</Text>
                </TouchableOpacity>
              </View>
            </>
          )}

          {/* Monitoring Aktivitas & Presensi Staff (Untuk Admin & Manajer) */}
          {canMonitorStaff && (
            <>
              <View style={styles.sectionHeaderRow}>
                <Text style={styles.sectionTitle}>Monitoring Presensi Staff</Text>
              </View>
              <View style={styles.activityCard}>
                {presensiLogs.slice(0, 3).map((log, idx) => {
                  const isLast = idx === Math.min(presensiLogs.length, 3) - 1;
                  return (
                    <View
                      key={log.id}
                      style={[styles.activityItem, isLast && { borderBottomWidth: 0 }]}
                    >
                      <View
                        style={[
                          styles.activityCircle,
                          {
                            backgroundColor: log.dalam_area
                              ? UI.colors.successBg
                              : UI.colors.dangerBg,
                          },
                        ]}
                      >
                        <Feather
                          name="map-pin"
                          size={14}
                          color={log.dalam_area ? UI.colors.success : UI.colors.dangerDark}
                        />
                      </View>
                      <View style={styles.activityDetails}>
                        <View style={styles.activityTopLine}>
                          <Text style={styles.activityItemName} numberOfLines={1}>
                            {log.nama} ({log.role})
                          </Text>
                          <Text
                            style={[
                              styles.activityItemDiff,
                              {
                                color: log.dalam_area
                                  ? UI.colors.success
                                  : UI.colors.dangerDark,
                              },
                            ]}
                          >
                            {log.dalam_area ? 'Dalam Area' : 'Luar Area'}
                          </Text>
                        </View>
                        <Text style={styles.activityMeta} numberOfLines={1}>
                          {log.tanggal} • {log.waktu} • Jarak {log.jarak_meter}m
                        </Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            </>
          )}

          {/* Lokasi Gudang Banner (Akses semua role dengan peran berbeda di halaman Lokasi) */}
          <TouchableOpacity
            style={styles.locationBannerCard}
            activeOpacity={0.82}
            onPress={() => router.push('/lokasi' as any)}
          >
            <View style={styles.locationBannerLeft}>
              <View style={styles.locationBannerIconCircle}>
                <MaterialCommunityIcons
                  name="map-marker-radius"
                  size={21}
                  color="#FFFFFF"
                />
              </View>
              <View style={styles.locationBannerTextWrap}>
                <View style={styles.locationTitleRow}>
                  <Text style={styles.locationBannerTitle}>Lokasi & Presensi Gudang</Text>
                  <View style={styles.locationBannerTagPill}>
                    <Text style={styles.locationBannerTag}>MAPS</Text>
                  </View>
                </View>
                <Text style={styles.locationBannerSub}>
                  {isAdmin
                    ? 'Kelola geofence, GPS real-time & radius gudang'
                    : isStaff
                    ? 'Presensi GPS staf & cek area geofence'
                    : 'Monitoring lokasi gudang & kehadiran staff'}
                </Text>
              </View>
            </View>
            <Feather name="chevron-right" size={18} color={UI.colors.primary} />
          </TouchableOpacity>

          {/* Peringatan Stok Minimum */}
          <View style={styles.alertBox}>
            <View style={styles.alertHeaderRow}>
              <View style={styles.alertHeaderLeft}>
                <View style={styles.alertIconBadge}>
                  <Feather name="alert-triangle" size={15} color={UI.colors.dangerDark} />
                </View>
                <View>
                  <Text style={styles.alertHeaderTitle}>Peringatan Stok Minimum</Text>
                  <Text style={styles.alertHeaderDesc}>Perlu perhatian segera</Text>
                </View>
              </View>
              <View style={styles.alertCountPill}>
                <Text style={styles.alertCountText}>{alertItems.length}</Text>
              </View>
            </View>

            {alertItems.length === 0 ? (
              <View style={styles.alertEmptyBox}>
                <Feather name="check-circle" size={15} color={UI.colors.success} />
                <Text style={styles.alertEmptyText}>Semua stok dalam kondisi aman.</Text>
              </View>
            ) : (
              alertItems.map((item: Barang, idx: number) => {
                const isHabis = item.stok === 0;
                const isLast = idx === alertItems.length - 1;
                return (
                  <TouchableOpacity
                    key={item.id}
                    style={[styles.alertItemCard, isLast && { marginBottom: 0 }]}
                    activeOpacity={0.78}
                    onPress={() => router.push('/barang')}
                  >
                    <View style={styles.alertItemBody}>
                      <View style={styles.alertItemTopRow}>
                        <Text style={styles.alertItemTitle} numberOfLines={1}>
                          {item.nama_barang}
                        </Text>
                        <View
                          style={[
                            styles.statusPillSmall,
                            isHabis
                              ? { backgroundColor: UI.colors.dangerBg, borderColor: UI.colors.dangerBorder }
                              : { backgroundColor: UI.colors.warningBg, borderColor: UI.colors.warningBorder },
                          ]}
                        >
                          <Text
                            style={[
                              styles.statusPillSmallText,
                              { color: isHabis ? UI.colors.dangerDark : UI.colors.warningDark },
                            ]}
                          >
                            {item.status_stok}
                          </Text>
                        </View>
                      </View>
                      <Text style={styles.alertItemSpecs}>
                        {item.kode_barang} • Sisa{' '}
                        <Text style={styles.boldRed}>
                          {item.stok} {item.satuan}
                        </Text>{' '}
                        (Min {item.stok_minimum}) • {item.lokasi_rak}
                      </Text>
                    </View>
                    <Feather name="chevron-right" size={16} color={UI.colors.muted} />
                  </TouchableOpacity>
                );
              })
            )}
          </View>

          {/* Aktivitas Stok Terbaru (Scoped berdasarkan Role!) */}
          <View style={styles.activityHeaderRow}>
            <Text style={styles.sectionTitle}>
              {isStaff ? 'Riwayat Transaksi Saya' : 'Aktivitas Stok Terbaru'}
            </Text>
            <TouchableOpacity onPress={() => setIsMutasiModalVisible(true)}>
              <Text style={styles.linkViewAll}>Lihat Semua →</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.activityCard}>
            {scopedTransaksiList.length === 0 ? (
              <View style={styles.emptyMutasiBox}>
                <Feather name="inbox" size={26} color={UI.colors.muted} />
                <Text style={styles.emptyMutasiText}>Belum ada transaksi untuk akun Anda.</Text>
              </View>
            ) : (
              scopedTransaksiList.map((trx: TransaksiStok, index: number) => {
                const isMasuk = trx.jenis === 'masuk';
                const isLast = index === scopedTransaksiList.length - 1;

                return (
                  <View
                    key={trx.id}
                    style={[styles.activityItem, isLast && { borderBottomWidth: 0 }]}
                  >
                    <View
                      style={[
                        styles.activityCircle,
                        { backgroundColor: isMasuk ? UI.colors.successBg : UI.colors.dangerBg },
                      ]}
                    >
                      <Feather
                        name={isMasuk ? 'arrow-down-left' : 'arrow-up-right'}
                        size={15}
                        color={isMasuk ? UI.colors.success : UI.colors.dangerDark}
                      />
                    </View>
                    <View style={styles.activityDetails}>
                      <View style={styles.activityTopLine}>
                        <Text style={styles.activityItemName} numberOfLines={1}>
                          {trx.nama_barang}
                        </Text>
                        <View
                          style={[
                            styles.activityQtyBadge,
                            { backgroundColor: isMasuk ? UI.colors.successBg : UI.colors.dangerBg },
                          ]}
                        >
                          <Text
                            style={[
                              styles.activityItemDiff,
                              { color: isMasuk ? UI.colors.success : UI.colors.dangerDark },
                            ]}
                          >
                            {isMasuk ? `+${trx.jumlah}` : `-${trx.jumlah}`} {trx.satuan}
                          </Text>
                        </View>
                      </View>
                      <View style={styles.activityBottomLine}>
                        <Text style={styles.activityMeta} numberOfLines={1}>
                          {trx.tanggal} • {trx.operator} ({trx.role_operator})
                        </Text>
                        <Text style={styles.activityRemain}>Sisa: {trx.sisa_stok}</Text>
                      </View>
                    </View>
                  </View>
                );
              })
            )}
          </View>

          {/* Card Autentikasi & Bearer Token JWT */}
          <View style={styles.tokenCard}>
            <View style={styles.tokenCardHeader}>
              <View style={styles.tokenBadgeRow}>
                <View style={styles.tokenShieldCircle}>
                  <Feather name="shield" size={13} color={UI.colors.primary} />
                </View>
                <Text style={styles.tokenTitle}>Autentikasi & Token JWT</Text>
              </View>
              <View style={styles.activeTokenBadge}>
                <View style={styles.activeDot} />
                <Text style={styles.activeTokenText}>Aktif (Bearer)</Text>
              </View>
            </View>

            <View style={styles.tokenPreviewBox}>
              <Text style={styles.tokenLabel}>Bearer Token</Text>
              <Text style={styles.tokenValue} numberOfLines={showTokenDetails ? undefined : 1}>
                {session?.token || 'Belum ada token'}
              </Text>
            </View>

            <View style={styles.tokenMetaRow}>
              <Text style={styles.tokenMetaText}>
                User ID: <Text style={styles.tokenMetaBold}>{currentUser.id}</Text> • Role:{' '}
                <Text style={styles.tokenMetaBold}>{currentUser.role}</Text>
              </Text>
              <TouchableOpacity
                onPress={() => setShowTokenDetails((prev) => !prev)}
                hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
              >
                <Text style={styles.tokenToggleText}>
                  {showTokenDetails ? 'Ringkas' : 'Detail'}
                </Text>
              </TouchableOpacity>
            </View>

            <SecondaryOutlineButton
              label="Uji Authorization Header API"
              onPress={handleTestAuthHeader}
              iconLeft={<Feather name="check-circle" size={14} color={UI.colors.primary} />}
              style={styles.testHeaderBtn}
              textStyle={styles.testHeaderBtnText}
            />
          </View>

          <View style={{ height: 16 }} />
        </ScrollView>

        {/* Sticky Bottom Navigation Bar: Dashboard - Barang - Mutasi - Laporan - Menu */}
        <View
          style={[
            styles.bottomNav,
            { paddingBottom: Math.max(insets.bottom, 10) },
          ]}
        >
          <TouchableOpacity style={styles.navItem} onPress={() => {}}>
            <View
              style={[
                styles.navIconWrap,
                !isMutasiModalVisible &&
                  !isLaporanModalVisible &&
                  !isMenuModalVisible &&
                  styles.navIconWrapActive,
              ]}
            >
              <Ionicons
                name="home"
                size={19}
                color={
                  !isMutasiModalVisible && !isLaporanModalVisible && !isMenuModalVisible
                    ? '#FFFFFF'
                    : UI.colors.secondary
                }
              />
            </View>
            <Text
              style={[
                styles.navLabel,
                !isMutasiModalVisible &&
                  !isLaporanModalVisible &&
                  !isMenuModalVisible &&
                  styles.navLabelActive,
              ]}
            >
              Dashboard
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.navItem}
            onPress={() => router.push('/barang')}
          >
            <View style={styles.navIconWrap}>
              <Feather name="box" size={19} color={UI.colors.secondary} />
            </View>
            <Text style={styles.navLabel}>Barang</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.navItem}
            onPress={() => setIsMutasiModalVisible(true)}
          >
            <View
              style={[
                styles.navIconWrap,
                isMutasiModalVisible && styles.navIconWrapActive,
              ]}
            >
              <MaterialCommunityIcons
                name="swap-vertical"
                size={20}
                color={isMutasiModalVisible ? '#FFFFFF' : UI.colors.secondary}
              />
            </View>
            <Text style={[styles.navLabel, isMutasiModalVisible && styles.navLabelActive]}>
              Mutasi
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.navItem}
            onPress={() => setIsLaporanModalVisible(true)}
          >
            <View
              style={[
                styles.navIconWrap,
                isLaporanModalVisible && styles.navIconWrapActive,
              ]}
            >
              <Feather
                name={canViewReports ? 'file-text' : 'lock'}
                size={18}
                color={isLaporanModalVisible ? '#FFFFFF' : UI.colors.secondary}
              />
            </View>
            <Text style={[styles.navLabel, isLaporanModalVisible && styles.navLabelActive]}>
              Laporan
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.navItem}
            onPress={openMenuSheet}
          >
            <View
              style={[
                styles.navIconWrap,
                isMenuModalVisible && styles.navIconWrapActive,
              ]}
            >
              <Feather
                name="menu"
                size={19}
                color={isMenuModalVisible ? '#FFFFFF' : UI.colors.secondary}
              />
            </View>
            <Text style={[styles.navLabel, isMenuModalVisible && styles.navLabelActive]}>
              Menu
            </Text>
          </TouchableOpacity>
        </View>

        {/* ============================================================= */}
        {/* MODAL FORMULIR TRANSAKSI: STOK MASUK & STOK KELUAR           */}
        {/* ============================================================= */}
        <Modal
          visible={stokModalType !== null}
          transparent={true}
          animationType="slide"
          onRequestClose={() => setStokModalType(null)}
        >
          <View style={styles.modalBackdrop}>
            <View
              style={[
                styles.transaksiModalContent,
                { paddingBottom: Math.max(insets.bottom, 20) },
              ]}
            >
              <View style={styles.sheetHandle} />

              <View style={styles.transaksiModalHeader}>
                <TouchableOpacity
                  style={styles.transaksiCloseBtn}
                  onPress={() => setStokModalType(null)}
                >
                  <Feather name="arrow-left" size={18} color={UI.colors.text} />
                </TouchableOpacity>
                <Text style={styles.transaksiModalTitle}>Mutasi Stok</Text>
                <View style={{ width: 34 }} />
              </View>

              {!canMutateStock ? (
                <AccessDeniedView
                  message="Peran Manajer Operasional hanya memiliki akses monitoring dan persetujuan koreksi stok."
                  roleName={currentUser.role}
                  actionLabel="Tutup"
                  onAction={() => setStokModalType(null)}
                />
              ) : (
                <>
                  <View style={styles.formTypeSwitch}>
                    <TouchableOpacity
                      style={[
                        styles.formTypePill,
                        stokModalType === 'masuk' && styles.formTypePillActive,
                      ]}
                      onPress={() => {
                        setStokModalType('masuk');
                        if (catatanInput === 'Distribusi Unit Lab') {
                          setCatatanInput('Pengadaan Stok Baru');
                        }
                      }}
                    >
                      <Text
                        style={[
                          styles.formTypeText,
                          stokModalType === 'masuk' && styles.formTypeTextActive,
                        ]}
                      >
                        Stok Masuk
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[
                        styles.formTypePill,
                        stokModalType === 'keluar' && styles.formTypePillActive,
                      ]}
                      onPress={() => {
                        setStokModalType('keluar');
                        if (catatanInput === 'Pengadaan Stok Baru') {
                          setCatatanInput('Distribusi Unit Lab');
                        }
                      }}
                    >
                      <Text
                        style={[
                          styles.formTypeText,
                          stokModalType === 'keluar' && styles.formTypeTextActive,
                        ]}
                      >
                        Stok Keluar
                      </Text>
                    </TouchableOpacity>
                  </View>

                  <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 410 }}>
                    <View style={styles.formSection}>
                      <Text style={styles.formSectionLabel}>Pilih Barang *</Text>
                      <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={styles.barangScrollPills}
                      >
                        {barangList.map((item) => {
                          const isSelected = item.id === selectedBarang?.id;
                          return (
                            <TouchableOpacity
                              key={item.id}
                              style={[
                                styles.barangSelectPill,
                                isSelected && styles.barangSelectPillActive,
                              ]}
                              activeOpacity={0.75}
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

                    <View style={styles.formSection}>
                      <Text style={styles.formSectionLabel}>
                        {stokModalType === 'masuk' ? 'Jumlah Masuk *' : 'Jumlah Keluar *'}
                      </Text>
                      <View style={styles.stepperContainer}>
                        <TouchableOpacity
                          style={styles.stepBtn}
                          activeOpacity={0.75}
                          onPress={() => changeJumlah(-1)}
                        >
                          <Feather name="minus" size={17} color={UI.colors.text} />
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
                          activeOpacity={0.75}
                          onPress={() => changeJumlah(1)}
                        >
                          <Feather name="plus" size={17} color={UI.colors.text} />
                        </TouchableOpacity>

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

                    <View style={styles.formSection}>
                      <Text style={styles.formSectionLabel}>Tanggal</Text>
                      <View style={styles.dateReadonlyBox}>
                        <Text style={styles.dateReadonlyText}>{todayFormatted}</Text>
                        <Feather name="calendar" size={16} color={UI.colors.secondary} />
                      </View>
                    </View>

                    <View style={styles.formSection}>
                      <Text style={styles.formSectionLabel}>Keterangan</Text>
                      <TextInput
                        style={styles.catatanInput}
                        placeholder="Masukkan keterangan (opsional)"
                        placeholderTextColor={UI.colors.muted}
                        value={catatanInput}
                        onChangeText={setCatatanInput}
                      />
                    </View>

                    {selectedBarang ? (
                      <View
                        style={[
                          styles.calcPreviewCard,
                          isStokKurang && styles.calcPreviewCardError,
                        ]}
                      >
                        <Text style={styles.calcPreviewTitle}>Ringkasan Perubahan Stok</Text>
                        <View style={styles.calcRow}>
                          <Text style={styles.calcLabel}>Barang</Text>
                          <Text style={styles.calcValue} numberOfLines={1}>
                            {selectedBarang.nama_barang}
                          </Text>
                        </View>
                        <View style={styles.calcRow}>
                          <Text style={styles.calcLabel}>Stok Saat Ini</Text>
                          <Text style={styles.calcValue}>
                            {selectedBarang.stok} {selectedBarang.satuan}
                          </Text>
                        </View>
                        <View style={styles.calcRow}>
                          <Text style={styles.calcLabel}>
                            Perubahan ({stokModalType === 'masuk' ? 'Masuk' : 'Keluar'})
                          </Text>
                          <Text
                            style={[
                              styles.calcValue,
                              {
                                color:
                                  stokModalType === 'masuk'
                                    ? UI.colors.success
                                    : UI.colors.dangerDark,
                                fontWeight: '800',
                              },
                            ]}
                          >
                            {stokModalType === 'masuk' ? `+${parsedJumlah}` : `-${parsedJumlah}`}{' '}
                            {selectedBarang.satuan}
                          </Text>
                        </View>
                        <View style={[styles.calcRow, styles.calcRowTotal]}>
                          <Text style={styles.calcTotalLabel}>Estimasi Stok Akhir</Text>
                          <Text
                            style={[
                              styles.calcTotalValue,
                              isStokKurang && { color: UI.colors.dangerDark },
                            ]}
                          >
                            {estimasiStokAkhir} {selectedBarang.satuan}
                          </Text>
                        </View>

                        {isStokKurang ? (
                          <View style={styles.errorWarnBox}>
                            <Feather name="alert-circle" size={14} color={UI.colors.dangerDark} />
                            <Text style={styles.errorWarnText}>
                              Jumlah melebihi stok yang tersedia saat ini.
                            </Text>
                          </View>
                        ) : null}
                      </View>
                    ) : null}
                  </ScrollView>

                  <View style={styles.modalActionButtons}>
                    <SecondaryOutlineButton
                      label="Batal"
                      onPress={() => setStokModalType(null)}
                      style={{ flex: 1 }}
                    />
                    <PrimaryGradientButton
                      label="Simpan"
                      disabled={Boolean(isStokKurang)}
                      onPress={handleSimpanTransaksi}
                      iconLeft={<Feather name="check" size={16} color="#FFFFFF" />}
                      style={{ flex: 2 }}
                    />
                  </View>
                </>
              )}
            </View>
          </View>
        </Modal>

        {/* ============================================================= */}
        {/* MODAL KOREKSI STOK (KHUSUS ADMIN GUDANG -> APPROVAL MANAJER)  */}
        {/* ============================================================= */}
        <Modal
          visible={isKoreksiModalVisible}
          transparent={true}
          animationType="slide"
          onRequestClose={() => setIsKoreksiModalVisible(false)}
        >
          <View style={styles.modalBackdrop}>
            <View
              style={[
                styles.sheetModalContent,
                { paddingBottom: Math.max(insets.bottom, 20) },
              ]}
            >
              <View style={styles.sheetHandle} />

              <View style={styles.sheetModalHeader}>
                <View style={styles.sheetHeaderLeft}>
                  <View style={[styles.sheetIconCircle, { backgroundColor: UI.colors.primaryLight }]}>
                    <Feather name="sliders" size={19} color={UI.colors.primary} />
                  </View>
                  <View>
                    <Text style={styles.sheetModalTitle}>Pengajuan Koreksi Stok</Text>
                    <Text style={styles.sheetModalSubtitle}>
                      Menunggu persetujuan Manajer Operasional
                    </Text>
                  </View>
                </View>
                <TouchableOpacity
                  style={styles.sheetCloseBtn}
                  onPress={() => setIsKoreksiModalVisible(false)}
                >
                  <Feather name="x" size={18} color={UI.colors.secondary} />
                </TouchableOpacity>
              </View>

              {!canSubmitKoreksi ? (
                <AccessDeniedView
                  message="Hanya Admin Gudang yang berwenang mengajukan koreksi stok."
                  roleName={currentUser.role}
                  actionLabel="Tutup"
                  onAction={() => setIsKoreksiModalVisible(false)}
                />
              ) : (
                <>
                  <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 380, marginTop: 12 }}>
                    <View style={styles.formSection}>
                      <Text style={styles.formSectionLabel}>Pilih Barang *</Text>
                      <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={styles.barangScrollPills}
                      >
                        {barangList.map((item) => {
                          const isSelected = item.id === koreksiBarangId;
                          return (
                            <TouchableOpacity
                              key={item.id}
                              style={[
                                styles.barangSelectPill,
                                isSelected && styles.barangSelectPillActive,
                              ]}
                              onPress={() => {
                                setKoreksiBarangId(item.id);
                                setKoreksiStokFisik(String(item.stok));
                              }}
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
                              <Text style={styles.barangSelectSub}>
                                Sistem: {item.stok} {item.satuan}
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                      </ScrollView>
                    </View>

                    <View style={styles.formSection}>
                      <Text style={styles.formSectionLabel}>Stok Fisik Hasil Opname *</Text>
                      <TextInput
                        style={styles.catatanInput}
                        keyboardType="number-pad"
                        value={koreksiStokFisik}
                        onChangeText={setKoreksiStokFisik}
                        placeholder="Jumlah fisik aktual"
                        placeholderTextColor={UI.colors.muted}
                      />
                    </View>

                    <View style={styles.formSection}>
                      <Text style={styles.formSectionLabel}>Alasan Koreksi *</Text>
                      <TextInput
                        style={styles.catatanInput}
                        value={koreksiAlasan}
                        onChangeText={setKoreksiAlasan}
                        placeholder="Contoh: Selisih opname bulanan rak A-01"
                        placeholderTextColor={UI.colors.muted}
                      />
                    </View>
                  </ScrollView>

                  <View style={styles.sheetActionRow}>
                    <SecondaryOutlineButton
                      label="Batal"
                      onPress={() => setIsKoreksiModalVisible(false)}
                      style={{ flex: 1 }}
                    />
                    <PrimaryGradientButton
                      label="Ajukan Koreksi"
                      onPress={handleSubmitKoreksi}
                      style={{ flex: 1.6 }}
                    />
                  </View>
                </>
              )}
            </View>
          </View>
        </Modal>

        {/* ============================================================= */}
        {/* MODAL PERSETUJUAN KOREKSI STOK (KHUSUS MANAJER OPERASIONAL)   */}
        {/* ============================================================= */}
        <Modal
          visible={isApprovalModalVisible}
          transparent={true}
          animationType="slide"
          onRequestClose={() => setIsApprovalModalVisible(false)}
        >
          <View style={styles.modalBackdrop}>
            <View
              style={[
                styles.sheetModalContent,
                { paddingBottom: Math.max(insets.bottom, 20) },
              ]}
            >
              <View style={styles.sheetHandle} />

              <View style={styles.sheetModalHeader}>
                <View style={styles.sheetHeaderLeft}>
                  <View style={[styles.sheetIconCircle, { backgroundColor: UI.colors.primaryLight }]}>
                    <Feather name="check-square" size={19} color={UI.colors.primary} />
                  </View>
                  <View>
                    <Text style={styles.sheetModalTitle}>Persetujuan Koreksi Stok</Text>
                    <Text style={styles.sheetModalSubtitle}>
                      Otorisasi Manajer Operasional
                    </Text>
                  </View>
                </View>
                <TouchableOpacity
                  style={styles.sheetCloseBtn}
                  onPress={() => setIsApprovalModalVisible(false)}
                >
                  <Feather name="x" size={18} color={UI.colors.secondary} />
                </TouchableOpacity>
              </View>

              {!canApproveKoreksi ? (
                <AccessDeniedView
                  message="Persetujuan koreksi stok hanya dapat dilakukan oleh Manajer Operasional."
                  roleName={currentUser.role}
                  actionLabel="Tutup"
                  onAction={() => setIsApprovalModalVisible(false)}
                />
              ) : (
                <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 420, marginTop: 12 }}>
                  {koreksiList.map((req) => (
                    <View key={req.id} style={styles.approvalItemCard}>
                      <View style={styles.approvalTopRow}>
                        <Text style={styles.approvalItemName} numberOfLines={1}>
                          {req.nama_barang}
                        </Text>
                        <View
                          style={[
                            styles.pendingPill,
                            req.status === 'approved' && { backgroundColor: UI.colors.successBg, borderColor: UI.colors.successBorder },
                            req.status === 'rejected' && { backgroundColor: UI.colors.dangerBg, borderColor: UI.colors.dangerBorder },
                          ]}
                        >
                          <Text
                            style={[
                              styles.pendingPillText,
                              req.status === 'approved' && { color: UI.colors.success },
                              req.status === 'rejected' && { color: UI.colors.dangerDark },
                            ]}
                          >
                            {req.status === 'pending'
                              ? 'Menunggu'
                              : req.status === 'approved'
                              ? 'Disetujui'
                              : 'Ditolak'}
                          </Text>
                        </View>
                      </View>
                      <Text style={styles.approvalMeta}>
                        Sistem: {req.stok_sistem} → Fisik: {req.stok_fisik} ({req.selisih >= 0 ? `+${req.selisih}` : req.selisih} {req.satuan})
                      </Text>
                      <Text style={styles.approvalReason}>
                        Alasan: {req.alasan} • {req.diajukan_oleh} ({req.tanggal_pengajuan})
                      </Text>
                      {req.status === 'pending' ? (
                        <View style={styles.approvalActionsRow}>
                          <SecondaryOutlineButton
                            label="Tolak"
                            onPress={() => handleReviewKoreksi(req.id, 'rejected')}
                            style={{ flex: 1, height: 38 }}
                            textStyle={{ fontSize: 12.5 }}
                          />
                          <PrimaryGradientButton
                            label="Setujui"
                            onPress={() => handleReviewKoreksi(req.id, 'approved')}
                            style={{ flex: 1.4, height: 38 }}
                            textStyle={{ fontSize: 12.5 }}
                          />
                        </View>
                      ) : (
                        <Text style={styles.approvalDecisionMeta}>
                          Diputuskan oleh {req.diputuskan_oleh} • {req.tanggal_keputusan}
                        </Text>
                      )}
                    </View>
                  ))}
                </ScrollView>
              )}
            </View>
          </View>
        </Modal>

        {/* ============================================================= */}
        {/* MODAL KELOLA PENGGUNA (KHUSUS ADMIN GUDANG)                   */}
        {/* ============================================================= */}
        <Modal
          visible={isUsersModalVisible}
          transparent={true}
          animationType="slide"
          onRequestClose={() => setIsUsersModalVisible(false)}
        >
          <View style={styles.modalBackdrop}>
            <View
              style={[
                styles.sheetModalContent,
                { paddingBottom: Math.max(insets.bottom, 20) },
              ]}
            >
              <View style={styles.sheetHandle} />

              <View style={styles.sheetModalHeader}>
                <View style={styles.sheetHeaderLeft}>
                  <View style={[styles.sheetIconCircle, { backgroundColor: UI.colors.primaryLight }]}>
                    <Feather name="users" size={19} color={UI.colors.primary} />
                  </View>
                  <View>
                    <Text style={styles.sheetModalTitle}>Kelola Pengguna</Text>
                    <Text style={styles.sheetModalSubtitle}>Administrasi akun & peran</Text>
                  </View>
                </View>
                <TouchableOpacity
                  style={styles.sheetCloseBtn}
                  onPress={() => setIsUsersModalVisible(false)}
                >
                  <Feather name="x" size={18} color={UI.colors.secondary} />
                </TouchableOpacity>
              </View>

              {!canManageUsers ? (
                <AccessDeniedView
                  message="Hanya Admin Gudang yang berwenang mengelola pengguna."
                  roleName={currentUser.role}
                  actionLabel="Tutup"
                  onAction={() => setIsUsersModalVisible(false)}
                />
              ) : (
                <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 450, marginTop: 12 }}>
                  {managedUsers.map((u) => (
                    <View key={u.id} style={styles.userRowCard}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.userRowName}>{u.name}</Text>
                        <Text style={styles.userRowMeta}>
                          @{u.username} • {u.role}
                        </Text>
                      </View>
                      <TouchableOpacity
                        style={[
                          styles.userStatusPill,
                          u.aktif === false && styles.userStatusPillOff,
                        ]}
                        onPress={() => handleToggleUserStatus(u.id)}
                      >
                        <Text
                          style={[
                            styles.userStatusText,
                            u.aktif === false && { color: UI.colors.dangerDark },
                          ]}
                        >
                          {u.aktif !== false ? 'Aktif' : 'Nonaktif'}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  ))}

                  <View style={styles.addUserBox}>
                    <Text style={styles.formSectionLabel}>Tambah Pengguna Baru</Text>
                    <TextInput
                      style={[styles.catatanInput, { marginBottom: 8 }]}
                      placeholder="Nama lengkap"
                      placeholderTextColor={UI.colors.muted}
                      value={newUserName}
                      onChangeText={setNewUserName}
                    />
                    <TextInput
                      style={[styles.catatanInput, { marginBottom: 8 }]}
                      placeholder="Username"
                      placeholderTextColor={UI.colors.muted}
                      autoCapitalize="none"
                      value={newUserUsername}
                      onChangeText={setNewUserUsername}
                    />
                    <TextInput
                      style={[styles.catatanInput, { marginBottom: 8 }]}
                      placeholder="Email (@edustock.com)"
                      placeholderTextColor={UI.colors.muted}
                      autoCapitalize="none"
                      value={newUserEmail}
                      onChangeText={setNewUserEmail}
                    />
                    <View style={styles.radiusRow}>
                      {(['Admin Gudang', 'Staff Inventory', 'Pemilik Toko / Manajer'] as const).map(
                        (r) => (
                          <TouchableOpacity
                            key={r}
                            style={[
                              styles.roleSelectChip,
                              newUserRole === r && styles.roleSelectChipActive,
                            ]}
                            onPress={() => setNewUserRole(r)}
                          >
                            <Text
                              style={[
                                styles.roleSelectChipText,
                                newUserRole === r && { color: '#FFFFFF' },
                              ]}
                              numberOfLines={1}
                            >
                              {r === 'Pemilik Toko / Manajer' ? 'Manajer' : r}
                            </Text>
                          </TouchableOpacity>
                        )
                      )}
                    </View>
                    <PrimaryGradientButton
                      label="Tambah Pengguna"
                      onPress={handleAddUser}
                      style={{ marginTop: 10 }}
                    />
                  </View>
                </ScrollView>
              )}
            </View>
          </View>
        </Modal>

        {/* ============================================================= */}
        {/* MODAL PENGATURAN GUDANG (KHUSUS ADMIN GUDANG)                 */}
        {/* ============================================================= */}
        <Modal
          visible={isWarehouseModalVisible}
          transparent={true}
          animationType="slide"
          onRequestClose={() => setIsWarehouseModalVisible(false)}
        >
          <View style={styles.modalBackdrop}>
            <View
              style={[
                styles.sheetModalContent,
                { paddingBottom: Math.max(insets.bottom, 20) },
              ]}
            >
              <View style={styles.sheetHandle} />
              <View style={styles.sheetModalHeader}>
                <View style={styles.sheetHeaderLeft}>
                  <View style={[styles.sheetIconCircle, { backgroundColor: UI.colors.primaryLight }]}>
                    <Feather name="settings" size={19} color={UI.colors.primary} />
                  </View>
                  <View>
                    <Text style={styles.sheetModalTitle}>Pengaturan Gudang</Text>
                    <Text style={styles.sheetModalSubtitle}>Konfigurasi lokasi & geofence</Text>
                  </View>
                </View>
                <TouchableOpacity
                  style={styles.sheetCloseBtn}
                  onPress={() => setIsWarehouseModalVisible(false)}
                >
                  <Feather name="x" size={18} color={UI.colors.secondary} />
                </TouchableOpacity>
              </View>

              {!canConfigWarehouse ? (
                <AccessDeniedView
                  message="Hanya Admin Gudang yang berwenang mengubah konfigurasi gudang."
                  roleName={currentUser.role}
                  actionLabel="Tutup"
                  onAction={() => setIsWarehouseModalVisible(false)}
                />
              ) : (
                <>
                  <View style={{ marginTop: 12, gap: 10 }}>
                    <View>
                      <Text style={styles.formSectionLabel}>Nama Gudang</Text>
                      <TextInput
                        style={styles.catatanInput}
                        value={whNameDraft}
                        onChangeText={setWhNameDraft}
                      />
                    </View>
                    <View>
                      <Text style={styles.formSectionLabel}>Alamat Gudang</Text>
                      <TextInput
                        style={styles.catatanInput}
                        value={whAddressDraft}
                        onChangeText={setWhAddressDraft}
                      />
                    </View>
                    <View>
                      <Text style={styles.formSectionLabel}>Radius Geofence Default</Text>
                      <View style={styles.radiusRow}>
                        {[50, 100, 150].map((rad) => (
                          <TouchableOpacity
                            key={rad}
                            style={[
                              styles.roleSelectChip,
                              whRadiusDraft === rad && styles.roleSelectChipActive,
                            ]}
                            onPress={() => setWhRadiusDraft(rad)}
                          >
                            <Text
                              style={[
                                styles.roleSelectChipText,
                                whRadiusDraft === rad && { color: '#FFFFFF' },
                              ]}
                            >
                              {rad} Meter
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </View>
                  </View>
                  <View style={styles.sheetActionRow}>
                    <SecondaryOutlineButton
                      label="Batal"
                      onPress={() => setIsWarehouseModalVisible(false)}
                      style={{ flex: 1 }}
                    />
                    <PrimaryGradientButton
                      label="Simpan Pengaturan"
                      onPress={handleSaveWarehouseConfig}
                      style={{ flex: 1.6 }}
                    />
                  </View>
                </>
              )}
            </View>
          </View>
        </Modal>

        {/* ============================================================= */}
        {/* 1. MODAL RIWAYAT MUTASI STOK (SCOPED BY ROLE)                 */}
        {/* ============================================================= */}
        <Modal
          visible={isMutasiModalVisible}
          transparent={true}
          animationType="slide"
          onRequestClose={() => setIsMutasiModalVisible(false)}
        >
          <View style={styles.modalBackdrop}>
            <View
              style={[
                styles.sheetModalContent,
                { paddingBottom: Math.max(insets.bottom, 20) },
              ]}
            >
              <View style={styles.sheetHandle} />

              <View style={styles.sheetModalHeader}>
                <View style={styles.sheetHeaderLeft}>
                  <View style={[styles.sheetIconCircle, { backgroundColor: UI.colors.primaryLight }]}>
                    <MaterialCommunityIcons name="swap-vertical" size={20} color={UI.colors.primary} />
                  </View>
                  <View>
                    <Text style={styles.sheetModalTitle}>
                      {isStaff ? 'Riwayat Transaksi Saya' : 'Riwayat Mutasi Stok'}
                    </Text>
                    <Text style={styles.sheetModalSubtitle}>
                      {scopedTransaksiList.length} log pergerakan stok {isStaff ? '(milik Anda)' : ''}
                    </Text>
                  </View>
                </View>
                <TouchableOpacity
                  style={styles.sheetCloseBtn}
                  onPress={() => setIsMutasiModalVisible(false)}
                >
                  <Feather name="x" size={18} color={UI.colors.secondary} />
                </TouchableOpacity>
              </View>

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
                    Semua ({scopedTransaksiList.length})
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.mutasiFilterPill,
                    mutasiFilter === 'masuk' && styles.mutasiFilterPillActive,
                  ]}
                  onPress={() => setMutasiFilter('masuk')}
                >
                  <View
                    style={[
                      styles.filterDot,
                      { backgroundColor: mutasiFilter === 'masuk' ? '#FFFFFF' : UI.colors.success },
                    ]}
                  />
                  <Text
                    style={[
                      styles.mutasiFilterText,
                      mutasiFilter === 'masuk' && styles.mutasiFilterTextActive,
                    ]}
                  >
                    Masuk ({countMutasiMasuk})
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.mutasiFilterPill,
                    mutasiFilter === 'keluar' && styles.mutasiFilterPillActive,
                  ]}
                  onPress={() => setMutasiFilter('keluar')}
                >
                  <View
                    style={[
                      styles.filterDot,
                      { backgroundColor: mutasiFilter === 'keluar' ? '#FFFFFF' : UI.colors.danger },
                    ]}
                  />
                  <Text
                    style={[
                      styles.mutasiFilterText,
                      mutasiFilter === 'keluar' && styles.mutasiFilterTextActive,
                    ]}
                  >
                    Keluar ({countMutasiKeluar})
                  </Text>
                </TouchableOpacity>
              </View>

              <ScrollView
                showsVerticalScrollIndicator={false}
                style={{ maxHeight: 380, marginVertical: 6 }}
              >
                {filteredMutasiList.length === 0 ? (
                  <View style={styles.emptyMutasiBox}>
                    <Feather name="inbox" size={32} color={UI.colors.muted} />
                    <Text style={styles.emptyMutasiText}>
                      Belum ada riwayat mutasi untuk filter ini.
                    </Text>
                  </View>
                ) : (
                  filteredMutasiList.map((trx: TransaksiStok, idx: number) => {
                    const isMasuk = trx.jenis === 'masuk';
                    const isLast = idx === filteredMutasiList.length - 1;
                    return (
                      <View
                        key={trx.id}
                        style={[styles.mutasiItemCard, isLast && { borderBottomWidth: 0 }]}
                      >
                        <View
                          style={[
                            styles.mutasiTypeBadge,
                            { backgroundColor: isMasuk ? UI.colors.successBg : UI.colors.dangerBg },
                          ]}
                        >
                          <Feather
                            name={isMasuk ? 'arrow-down-left' : 'arrow-up-right'}
                            size={17}
                            color={isMasuk ? UI.colors.success : UI.colors.dangerDark}
                          />
                        </View>
                        <View style={styles.mutasiItemInfo}>
                          <View style={styles.mutasiItemHeaderRow}>
                            <Text style={styles.mutasiItemName} numberOfLines={1}>
                              {trx.nama_barang}
                            </Text>
                            <View
                              style={[
                                styles.activityQtyBadge,
                                { backgroundColor: isMasuk ? UI.colors.successBg : UI.colors.dangerBg },
                              ]}
                            >
                              <Text
                                style={[
                                  styles.mutasiItemQty,
                                  { color: isMasuk ? UI.colors.success : UI.colors.dangerDark },
                                ]}
                              >
                                {isMasuk ? `+${trx.jumlah}` : `-${trx.jumlah}`} {trx.satuan}
                              </Text>
                            </View>
                          </View>
                          <View style={styles.mutasiItemMetaRow}>
                            <Text style={styles.mutasiItemDate}>{trx.tanggal}</Text>
                            <Text style={styles.mutasiItemOperator}>
                              {trx.operator} ({trx.role_operator})
                            </Text>
                          </View>
                          <Text style={styles.mutasiItemSisa}>
                            Sisa stok: <Text style={styles.boldDark}>{trx.sisa_stok} {trx.satuan}</Text>
                          </Text>
                        </View>
                      </View>
                    );
                  })
                )}
              </ScrollView>

              {canMutateStock ? (
                <View style={styles.sheetActionRow}>
                  <SecondaryOutlineButton
                    label="Stok Keluar"
                    iconLeft={<Feather name="minus-circle" size={15} color={UI.colors.primary} />}
                    onPress={() => {
                      setIsMutasiModalVisible(false);
                      openStokModal('keluar');
                    }}
                    style={{ flex: 1 }}
                  />
                  <PrimaryGradientButton
                    label="Stok Masuk"
                    iconLeft={<Feather name="plus-circle" size={15} color="#FFFFFF" />}
                    onPress={() => {
                      setIsMutasiModalVisible(false);
                      openStokModal('masuk');
                    }}
                    style={{ flex: 1 }}
                  />
                </View>
              ) : (
                <View style={styles.sheetActionRow}>
                  <SecondaryOutlineButton
                    label="Mode Monitoring (Tutup)"
                    onPress={() => setIsMutasiModalVisible(false)}
                    style={{ flex: 1 }}
                  />
                </View>
              )}
            </View>
          </View>
        </Modal>

        {/* ============================================================= */}
        {/* 2. MODAL LAPORAN & VALUASI STOK (GUARDED RBAC)                */}
        {/* ============================================================= */}
        <Modal
          visible={isLaporanModalVisible}
          transparent={true}
          animationType="slide"
          onRequestClose={() => setIsLaporanModalVisible(false)}
        >
          <View style={styles.modalBackdrop}>
            <View
              style={[
                styles.sheetModalContent,
                { paddingBottom: Math.max(insets.bottom, 20) },
              ]}
            >
              <View style={styles.sheetHandle} />

              <View style={styles.sheetModalHeader}>
                <View style={styles.sheetHeaderLeft}>
                  <View style={[styles.sheetIconCircle, { backgroundColor: UI.colors.primaryLight }]}>
                    <Feather name="bar-chart-2" size={20} color={UI.colors.primary} />
                  </View>
                  <View>
                    <Text style={styles.sheetModalTitle}>Laporan & Valuasi</Text>
                    <Text style={styles.sheetModalSubtitle}>
                      Ringkasan aset & kesehatan inventaris
                    </Text>
                  </View>
                </View>
                <TouchableOpacity
                  style={styles.sheetCloseBtn}
                  onPress={() => setIsLaporanModalVisible(false)}
                >
                  <Feather name="x" size={18} color={UI.colors.secondary} />
                </TouchableOpacity>
              </View>

              {!canViewReports ? (
                <AccessDeniedView
                  title="Akses Laporan Dibatasi (403)"
                  message="Laporan valuasi finansial dan ekspor data inventaris hanya tersedia untuk Admin Gudang dan Manajer Operasional."
                  roleName={currentUser.role}
                  actionLabel="Tutup"
                  onAction={() => setIsLaporanModalVisible(false)}
                />
              ) : (
                <>
                  <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 430 }}>
                    <View style={styles.laporanFinanceCard}>
                      <Text style={styles.laporanCardTitle}>Valuasi Finansial Stok</Text>

                      <View style={styles.financeItemRow}>
                        <View style={styles.financeMetricBox}>
                          <Text style={styles.financeLabel}>Total Aset Beli</Text>
                          <Text style={styles.financeBeliValue}>{formatRupiah(totalAsetBeli)}</Text>
                        </View>
                        <View style={styles.financeMetricDivider} />
                        <View style={styles.financeMetricBox}>
                          <Text style={styles.financeLabel}>Potensi Penjualan</Text>
                          <Text style={styles.financeJualValue}>{formatRupiah(totalNilaiJual)}</Text>
                        </View>
                      </View>

                      <View style={styles.financeMarginBox}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Text style={styles.financeMarginLabel}>Potensi Margin Keuntungan</Text>
                          <View style={styles.marginPercentBadge}>
                            <Text style={styles.marginPercentText}>+{persentaseMargin}%</Text>
                          </View>
                        </View>
                        <Text style={styles.financeMarginValue}>{formatRupiah(potensiMargin)}</Text>
                      </View>
                    </View>

                    <View style={styles.laporanHealthCard}>
                      <Text style={styles.laporanCardTitle}>Kesehatan Inventaris</Text>

                      <View style={styles.healthStackedBar}>
                        {summary.statusAman > 0 && (
                          <View
                            style={{
                              flex: summary.statusAman / totalSkuForBar,
                              backgroundColor: UI.colors.success,
                            }}
                          />
                        )}
                        {summary.statusMenipis > 0 && (
                          <View
                            style={{
                              flex: summary.statusMenipis / totalSkuForBar,
                              backgroundColor: UI.colors.warning,
                            }}
                          />
                        )}
                        {summary.statusHabis > 0 && (
                          <View
                            style={{
                              flex: summary.statusHabis / totalSkuForBar,
                              backgroundColor: UI.colors.danger,
                            }}
                          />
                        )}
                      </View>

                      <View style={styles.healthStatsGrid}>
                        <View style={[styles.healthStatItem, { backgroundColor: UI.colors.successBg, borderColor: UI.colors.successBorder }]}>
                          <Text style={[styles.healthStatNumber, { color: UI.colors.success }]}>
                            {summary.statusAman}
                          </Text>
                          <Text style={styles.healthStatLabel}>Aman</Text>
                        </View>
                        <View style={[styles.healthStatItem, { backgroundColor: UI.colors.warningBg, borderColor: UI.colors.warningBorder }]}>
                          <Text style={[styles.healthStatNumber, { color: UI.colors.warningDark }]}>
                            {summary.statusMenipis}
                          </Text>
                          <Text style={styles.healthStatLabel}>Menipis</Text>
                        </View>
                        <View style={[styles.healthStatItem, { backgroundColor: UI.colors.dangerBg, borderColor: UI.colors.dangerBorder }]}>
                          <Text style={[styles.healthStatNumber, { color: UI.colors.dangerDark }]}>
                            {summary.statusHabis}
                          </Text>
                          <Text style={styles.healthStatLabel}>Habis</Text>
                        </View>
                      </View>
                    </View>

                    <View style={styles.laporanCategoryCard}>
                      <Text style={styles.laporanCardTitle}>Distribusi Aset per Kategori</Text>
                      {kategoriSummary.map((kat, idx) => {
                        const ratio =
                          totalAsetBeli > 0
                            ? Math.min(100, Math.round((kat.totalNilai / totalAsetBeli) * 100))
                            : 0;
                        const isLast = idx === kategoriSummary.length - 1;
                        return (
                          <View
                            key={kat.kategori}
                            style={[styles.kategoriRowWrap, isLast && { borderBottomWidth: 0, paddingBottom: 0 }]}
                          >
                            <View style={styles.kategoriRow}>
                              <View style={{ flex: 1 }}>
                                <Text style={styles.kategoriName}>{kat.kategori}</Text>
                                <Text style={styles.kategoriDetail}>
                                  {kat.count} SKU • {kat.totalStok} unit ({ratio}%)
                                </Text>
                              </View>
                              <Text style={styles.kategoriAsetValue}>{formatRupiah(kat.totalNilai)}</Text>
                            </View>
                            <View style={styles.kategoriBarTrack}>
                              <View style={[styles.kategoriBarFill, { width: `${ratio}%` }]} />
                            </View>
                          </View>
                        );
                      })}
                    </View>
                  </ScrollView>

                  <View style={styles.sheetActionRow}>
                    <PrimaryGradientButton
                      label="Unduh Laporan Inventaris"
                      iconLeft={<Feather name="download" size={16} color="#FFFFFF" />}
                      onPress={() => {
                        const auth = authorizeAction(session, 'report:export');
                        if (!auth.allowed) {
                          showAppAlert('Akses Ditolak (403)', auth.reason);
                          return;
                        }
                        showAppAlert(
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
                      style={{ flex: 1 }}
                    />
                  </View>
                </>
              )}
            </View>
          </View>
        </Modal>

        {/* ============================================================= */}
        {/* 3. MODAL MENU, PROFIL & GANTI PERAN (FILTERED BY RBAC)        */}
        {/* ============================================================= */}
        <Modal
          visible={isMenuModalVisible}
          transparent={true}
          animationType="slide"
          onRequestClose={() => setIsMenuModalVisible(false)}
        >
          <View style={styles.modalBackdrop}>
            <View
              style={[
                styles.sheetModalContent,
                { paddingBottom: Math.max(insets.bottom, 20) },
              ]}
            >
              <View style={styles.sheetHandle} />

              {menuViewMode === 'menu' ? (
                <>
                  <View style={styles.sheetModalHeader}>
                    <View style={styles.sheetHeaderLeft}>
                      <View style={[styles.sheetIconCircle, { backgroundColor: UI.colors.primaryLight }]}>
                        <Feather name="grid" size={19} color={UI.colors.primary} />
                      </View>
                      <View>
                        <Text style={styles.sheetModalTitle}>Menu</Text>
                        <Text style={styles.sheetModalSubtitle}>
                          Fitur sesuai hak akses {getRoleShortTitle(currentUser.role)}
                        </Text>
                      </View>
                    </View>
                    <TouchableOpacity
                      style={styles.sheetCloseBtn}
                      onPress={() => setIsMenuModalVisible(false)}
                    >
                      <Feather name="x" size={18} color={UI.colors.secondary} />
                    </TouchableOpacity>
                  </View>

                  <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 430 }}>
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
                            <Text style={styles.menuRoleBadgeText}>
                              {getRoleShortTitle(currentUser.role)}
                            </Text>
                          </View>
                          <View style={styles.menuVerifiedBadge}>
                            <Feather name="check" size={11} color={UI.colors.success} />
                            <Text style={styles.menuVerifiedText}>Terverifikasi</Text>
                          </View>
                        </View>
                      </View>
                    </View>

                    {/* Menu Items Filtered by Permission */}
                    <View style={styles.menuListCard}>
                      <TouchableOpacity
                        style={styles.menuListRow}
                        onPress={() => {
                          setIsMenuModalVisible(false);
                          router.push('/barang');
                        }}
                      >
                        <View style={styles.menuListIcon}>
                          <Feather name="box" size={17} color={UI.colors.primary} />
                        </View>
                        <Text style={styles.menuListText}>
                          {isAdmin ? 'Kelola Master Barang' : 'Katalog Barang'}
                        </Text>
                        <Feather name="chevron-right" size={17} color={UI.colors.muted} />
                      </TouchableOpacity>

                      {canScanBarcode && (
                        <TouchableOpacity
                          style={styles.menuListRow}
                          onPress={() => {
                            setIsMenuModalVisible(false);
                            router.push('/scanner');
                          }}
                        >
                          <View style={styles.menuListIcon}>
                            <Feather name="camera" size={17} color={UI.colors.primary} />
                          </View>
                          <Text style={styles.menuListText}>Scan Barcode</Text>
                          <Feather name="chevron-right" size={17} color={UI.colors.muted} />
                        </TouchableOpacity>
                      )}

                      {canSubmitKoreksi && (
                        <TouchableOpacity
                          style={styles.menuListRow}
                          onPress={() => {
                            setIsMenuModalVisible(false);
                            openKoreksiModal();
                          }}
                        >
                          <View style={styles.menuListIcon}>
                            <Feather name="sliders" size={17} color={UI.colors.primary} />
                          </View>
                          <Text style={styles.menuListText}>Koreksi Stok (Opname)</Text>
                          <Feather name="chevron-right" size={17} color={UI.colors.muted} />
                        </TouchableOpacity>
                      )}

                      {canApproveKoreksi && (
                        <TouchableOpacity
                          style={styles.menuListRow}
                          onPress={() => {
                            setIsMenuModalVisible(false);
                            setIsApprovalModalVisible(true);
                          }}
                        >
                          <View style={styles.menuListIcon}>
                            <Feather name="check-square" size={17} color={UI.colors.primary} />
                          </View>
                          <Text style={styles.menuListText}>
                            Persetujuan Koreksi Stok ({pendingKoreksiCount})
                          </Text>
                          <Feather name="chevron-right" size={17} color={UI.colors.muted} />
                        </TouchableOpacity>
                      )}

                      {canManageUsers && (
                        <TouchableOpacity
                          style={styles.menuListRow}
                          onPress={() => {
                            setIsMenuModalVisible(false);
                            setIsUsersModalVisible(true);
                          }}
                        >
                          <View style={styles.menuListIcon}>
                            <Feather name="users" size={17} color={UI.colors.primary} />
                          </View>
                          <Text style={styles.menuListText}>Kelola Pengguna</Text>
                          <Feather name="chevron-right" size={17} color={UI.colors.muted} />
                        </TouchableOpacity>
                      )}

                      {canConfigWarehouse && (
                        <TouchableOpacity
                          style={styles.menuListRow}
                          onPress={() => {
                            setIsMenuModalVisible(false);
                            openWarehouseModal();
                          }}
                        >
                          <View style={styles.menuListIcon}>
                            <Feather name="settings" size={17} color={UI.colors.primary} />
                          </View>
                          <Text style={styles.menuListText}>Pengaturan Gudang</Text>
                          <Feather name="chevron-right" size={17} color={UI.colors.muted} />
                        </TouchableOpacity>
                      )}

                      <TouchableOpacity
                        style={styles.menuListRow}
                        onPress={() => {
                          setIsMenuModalVisible(false);
                          router.push('/lokasi' as any);
                        }}
                      >
                        <View style={styles.menuListIcon}>
                          <Feather name="map-pin" size={17} color={UI.colors.primary} />
                        </View>
                        <Text style={styles.menuListText}>Lokasi & Presensi Gudang</Text>
                        <Feather name="chevron-right" size={17} color={UI.colors.muted} />
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={styles.menuListRow}
                        onPress={handleTestAuthHeader}
                      >
                        <View style={styles.menuListIcon}>
                          <Feather name="shield" size={17} color={UI.colors.primary} />
                        </View>
                        <Text style={styles.menuListText}>Uji Bearer Token</Text>
                        <Feather name="chevron-right" size={17} color={UI.colors.muted} />
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[styles.menuListRow, { borderBottomWidth: 0 }]}
                        onPress={() => {
                          if (!canSwitchDemoRole) {
                            showAppAlert(
                              'Mode Akun Reguler',
                              'Pergantian peran secara langsung hanya tersedia pada Mode Demo/Simulasi. Silakan gunakan tombol Keluar untuk berganti akun.'
                            );
                            return;
                          }
                          const roleKey =
                            currentUser.username === 'staff'
                              ? 'staff'
                              : currentUser.username === 'manager'
                              ? 'manager'
                              : 'admin';
                          setPendingRoleKey(roleKey);
                          setMenuViewMode('role');
                        }}
                      >
                        <View style={styles.menuListIcon}>
                          <Feather
                            name={canSwitchDemoRole ? 'repeat' : 'lock'}
                            size={17}
                            color={canSwitchDemoRole ? UI.colors.primary : UI.colors.muted}
                          />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text
                            style={[
                              styles.menuListText,
                              !canSwitchDemoRole && { color: UI.colors.muted },
                            ]}
                          >
                            Ganti Peran (Demo)
                          </Text>
                          {!canSwitchDemoRole && (
                            <Text style={{ fontSize: 10, color: UI.colors.muted }}>
                              Nonaktif pada login kredensial produksi
                            </Text>
                          )}
                        </View>
                        <Feather name="chevron-right" size={17} color={UI.colors.muted} />
                      </TouchableOpacity>
                    </View>
                  </ScrollView>

                  <View style={styles.sheetActionRow}>
                    <TouchableOpacity
                      style={styles.menuLogoutBtn}
                      activeOpacity={0.8}
                      onPress={() => {
                        setIsMenuModalVisible(false);
                        if (Platform.OS === 'web') {
                          handleLogout();
                        } else {
                          setTimeout(() => handleLogout(), 150);
                        }
                      }}
                    >
                      <Feather name="log-out" size={16} color={UI.colors.dangerDark} />
                      <Text style={styles.menuLogoutBtnText}>Keluar dari Akun</Text>
                    </TouchableOpacity>
                  </View>
                </>
              ) : (
                <>
                  <View style={styles.sheetModalHeader}>
                    <TouchableOpacity
                      style={styles.sheetCloseBtn}
                      onPress={() => setMenuViewMode('menu')}
                    >
                      <Feather name="arrow-left" size={18} color={UI.colors.text} />
                    </TouchableOpacity>
                    <Text style={[styles.sheetModalTitle, { flex: 1, marginLeft: 10 }]}>
                      Ganti Peran (Demo)
                    </Text>
                    <TouchableOpacity
                      style={styles.sheetCloseBtn}
                      onPress={() => setIsMenuModalVisible(false)}
                    >
                      <Feather name="x" size={18} color={UI.colors.secondary} />
                    </TouchableOpacity>
                  </View>

                  <View style={styles.roleListCard}>
                    {(
                      [
                        { key: 'admin', title: 'Admin Gudang', sub: 'Dhea Ayu' },
                        { key: 'staff', title: 'Staff Inventory', sub: 'Riqzy Ayu' },
                        { key: 'manager', title: 'Manajer Operasional', sub: 'Khansa Kirana' },
                      ] as const
                    ).map((r, idx) => {
                      const isChecked = pendingRoleKey === r.key;
                      return (
                        <TouchableOpacity
                          key={r.key}
                          style={[
                            styles.roleRadioRow,
                            idx === 2 && { borderBottomWidth: 0 },
                          ]}
                          activeOpacity={0.75}
                          onPress={() => setPendingRoleKey(r.key)}
                        >
                          <View style={{ flex: 1 }}>
                            <Text
                              style={[
                                styles.roleRadioTitle,
                                isChecked && { color: UI.colors.primary, fontWeight: '800' },
                              ]}
                            >
                              {r.title}
                            </Text>
                            <Text style={styles.roleRadioSub}>{r.sub}</Text>
                          </View>

                          <View
                            style={[
                              styles.radioOuter,
                              isChecked && styles.radioOuterActive,
                            ]}
                          >
                            {isChecked && <View style={styles.radioInner} />}
                          </View>
                        </TouchableOpacity>
                      );
                    })}
                  </View>

                  <View style={styles.sheetActionRow}>
                    <PrimaryGradientButton
                      label="Terapkan Peran"
                      iconLeft={<Feather name="refresh-cw" size={15} color="#FFFFFF" />}
                      onPress={() => handleQuickSwitchRole(pendingRoleKey)}
                      style={{ flex: 1 }}
                    />
                  </View>
                </>
              )}
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    </SoftBlueBackdrop>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    color: UI.colors.secondary,
    fontWeight: '600',
  },
  errorIconBadge: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: UI.colors.dangerBg,
    borderWidth: 1,
    borderColor: UI.colors.dangerBorder,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  dashboardErrorTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: UI.colors.text,
    textAlign: 'center',
  },
  dashboardErrorSubtitle: {
    fontSize: 13,
    color: UI.colors.secondary,
    textAlign: 'center',
    paddingHorizontal: 30,
    lineHeight: 18,
  },
  safeArea: {
    flex: 1,
    width: '100%',
    paddingTop: Platform.OS === 'android' ? RNStatusBar.currentHeight : 0,
  },
  dashHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 11,
  },
  dashHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  miniLogoCube: {
    width: 34,
    height: 34,
    borderRadius: 11,
    backgroundColor: UI.colors.primary,
    backgroundImage: UI.gradients.logoBox,
    alignItems: 'center',
    justifyContent: 'center',
    ...primaryButtonShadow,
  },
  dashHeaderTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: UI.colors.text,
    letterSpacing: -0.3,
  },
  dashHeaderSub: {
    fontSize: 10.5,
    color: UI.colors.primary,
    fontWeight: '700',
  },
  dashHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerBellBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: UI.colors.surface,
    borderWidth: 1,
    borderColor: UI.colors.borderSoft,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  headerBellDot: {
    position: 'absolute',
    top: 7,
    right: 8,
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: UI.colors.danger,
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: UI.colors.surface,
    borderWidth: 1,
    borderColor: UI.colors.dangerBorder,
    paddingHorizontal: 10,
    height: 36,
    borderRadius: 12,
  },
  logoutBtnText: {
    color: UI.colors.dangerDark,
    fontSize: 11.5,
    fontWeight: '700',
  },
  dashScrollView: {
    flex: 1,
    minHeight: 0,
  },
  dashScrollContent: {
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 16,
  },
  offlineAlertCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: UI.colors.warningBg,
    borderWidth: 1,
    borderColor: UI.colors.warningBorder,
    borderRadius: UI.radius.md,
    paddingHorizontal: 12,
    paddingVertical: 9,
    marginBottom: 12,
  },
  offlineAlertText: {
    flex: 1,
    fontSize: 11.5,
    color: UI.colors.warningDark,
    fontWeight: '600',
  },

  // Greeting
  greetingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  greetingName: {
    fontSize: 19,
    fontWeight: '800',
    color: UI.colors.text,
    letterSpacing: -0.4,
  },
  greetingRoleRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
    marginTop: 5,
  },
  roleBadge: {
    backgroundColor: UI.colors.surface,
    borderWidth: 1,
    borderColor: UI.colors.primaryBorder,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: UI.radius.pill,
  },
  roleBadgeText: {
    color: UI.colors.primary,
    fontSize: 11,
    fontWeight: '700',
  },
  sessionTypePill: {
    backgroundColor: UI.colors.primaryLight,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: UI.radius.pill,
  },
  sessionTypeText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: UI.colors.primaryDark,
  },
  switchAccountLink: {
    fontSize: 11.5,
    fontWeight: '700',
    color: UI.colors.secondary,
  },

  // Status Strip Card
  statusStripCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: UI.colors.surface,
    borderRadius: UI.radius.lg,
    borderWidth: 1,
    borderColor: UI.colors.borderSoft,
    paddingVertical: 12,
    paddingHorizontal: 10,
    marginBottom: 16,
    ...cardShadow,
  },
  statusCol: {
    flex: 1,
    alignItems: 'center',
    gap: 3,
  },
  statusLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusColLabel: {
    fontSize: 11.5,
    fontWeight: '600',
    color: UI.colors.secondary,
  },
  statusColValue: {
    fontSize: 17,
    fontWeight: '800',
    color: UI.colors.text,
  },
  statusDivider: {
    width: 1,
    height: 28,
    backgroundColor: UI.colors.borderSubtle,
  },

  sectionHeaderRow: {
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 14.5,
    fontWeight: '800',
    color: UI.colors.text,
    letterSpacing: -0.2,
  },

  statsGrid: {
    gap: 10,
    marginBottom: 16,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  statCard: {
    flex: 1,
    backgroundColor: UI.colors.surface,
    borderWidth: 1,
    borderColor: UI.colors.borderSoft,
    borderRadius: UI.radius.lg,
    padding: 13,
    ...cardShadow,
  },
  clickableStatCard: {
    borderColor: UI.colors.primaryBorder,
  },
  statTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  statIconBadge: {
    width: 34,
    height: 34,
    borderRadius: 11,
    backgroundColor: UI.colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statNumber: {
    fontSize: 22,
    fontWeight: '800',
    color: UI.colors.text,
    letterSpacing: -0.5,
  },
  statMoneyNumber: {
    fontSize: 15,
    fontWeight: '800',
    color: UI.colors.primary,
    marginVertical: 4,
  },
  statTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: UI.colors.secondary,
    marginTop: 2,
  },

  // Admin Control Cards
  adminControlRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  adminControlCard: {
    flex: 1,
    backgroundColor: UI.colors.surface,
    borderWidth: 1,
    borderColor: UI.colors.primaryBorder,
    borderRadius: UI.radius.lg,
    padding: 13,
    ...cardShadow,
  },
  adminControlIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: UI.colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  adminControlTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: UI.colors.text,
  },
  adminControlSub: {
    fontSize: 11,
    color: UI.colors.secondary,
    marginTop: 2,
  },

  // Staff Presensi Card
  presensiStatusCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: UI.colors.surface,
    borderWidth: 1,
    borderColor: UI.colors.primaryBorder,
    borderRadius: UI.radius.lg,
    padding: 13,
    gap: 11,
    marginBottom: 16,
    ...cardShadow,
  },
  presensiIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: UI.colors.primary,
    backgroundImage: UI.gradients.primaryBtn,
    alignItems: 'center',
    justifyContent: 'center',
  },
  presensiCardTitle: {
    fontSize: 13.5,
    fontWeight: '800',
    color: UI.colors.text,
  },
  presensiCardSub: {
    fontSize: 11,
    color: UI.colors.secondary,
    marginTop: 2,
  },
  presensiActionBadge: {
    backgroundColor: UI.colors.primaryLight,
    borderWidth: 1,
    borderColor: UI.colors.primaryBorder,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: UI.radius.pill,
  },
  presensiActionText: {
    fontSize: 11,
    fontWeight: '700',
    color: UI.colors.primary,
  },

  // Manager Approval Queue
  approvalBox: {
    backgroundColor: UI.colors.surface,
    borderWidth: 1,
    borderColor: UI.colors.primaryBorder,
    borderRadius: UI.radius.lg,
    padding: 13,
    marginBottom: 16,
    ...cardShadow,
  },
  approvalItemCard: {
    backgroundColor: UI.colors.background,
    borderWidth: 1,
    borderColor: UI.colors.borderSoft,
    borderRadius: UI.radius.md,
    padding: 12,
    marginBottom: 8,
  },
  approvalTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 4,
  },
  approvalItemName: {
    flex: 1,
    fontSize: 13,
    fontWeight: '800',
    color: UI.colors.text,
  },
  pendingPill: {
    backgroundColor: UI.colors.warningBg,
    borderWidth: 1,
    borderColor: UI.colors.warningBorder,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: UI.radius.pill,
  },
  pendingPillText: {
    fontSize: 10,
    fontWeight: '700',
    color: UI.colors.warningDark,
  },
  approvalMeta: {
    fontSize: 11.5,
    fontWeight: '700',
    color: UI.colors.primary,
    marginBottom: 3,
  },
  approvalReason: {
    fontSize: 11,
    color: UI.colors.secondary,
    marginBottom: 10,
  },
  approvalActionsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  approvalDecisionMeta: {
    fontSize: 11,
    fontWeight: '600',
    color: UI.colors.secondary,
    marginTop: 2,
  },

  quickActionsCard: {
    flexDirection: 'row',
    backgroundColor: UI.colors.surface,
    borderWidth: 1,
    borderColor: UI.colors.borderSoft,
    borderRadius: UI.radius.lg,
    paddingVertical: 14,
    paddingHorizontal: 8,
    marginBottom: 12,
    ...cardShadow,
  },
  quickActionItem: {
    flex: 1,
    alignItems: 'center',
    gap: 7,
  },
  quickActionCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: UI.colors.primaryLight,
    borderWidth: 1,
    borderColor: UI.colors.primaryBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickActionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: UI.colors.text,
    textAlign: 'center',
    lineHeight: 14,
  },

  locationBannerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: UI.colors.surface,
    borderWidth: 1,
    borderColor: UI.colors.primaryBorder,
    borderRadius: UI.radius.lg,
    padding: 13,
    marginBottom: 16,
    ...cardShadow,
  },
  locationBannerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  locationBannerIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 13,
    backgroundColor: UI.colors.primary,
    backgroundImage: UI.gradients.primaryBtn,
    alignItems: 'center',
    justifyContent: 'center',
  },
  locationBannerTextWrap: {
    flex: 1,
  },
  locationTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  locationBannerTitle: {
    fontSize: 13.5,
    fontWeight: '800',
    color: UI.colors.text,
  },
  locationBannerTagPill: {
    backgroundColor: UI.colors.primaryLight,
    borderWidth: 1,
    borderColor: UI.colors.primaryBorder,
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 5,
  },
  locationBannerTag: {
    fontSize: 9,
    fontWeight: '800',
    color: UI.colors.primary,
  },
  locationBannerSub: {
    fontSize: 11,
    color: UI.colors.secondary,
    marginTop: 2,
  },

  alertBox: {
    backgroundColor: UI.colors.surface,
    borderWidth: 1,
    borderColor: UI.colors.dangerBorder,
    borderRadius: UI.radius.lg,
    padding: 14,
    marginBottom: 16,
    ...cardShadow,
  },
  alertHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  alertHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  alertIconBadge: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: UI.colors.dangerBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  alertHeaderTitle: {
    fontSize: 13.5,
    fontWeight: '800',
    color: UI.colors.text,
  },
  alertHeaderDesc: {
    fontSize: 11,
    color: UI.colors.secondary,
    marginTop: 1,
  },
  alertCountPill: {
    backgroundColor: UI.colors.dangerBg,
    borderWidth: 1,
    borderColor: UI.colors.dangerBorder,
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: UI.radius.pill,
  },
  alertCountText: {
    fontSize: 11.5,
    fontWeight: '800',
    color: UI.colors.dangerDark,
  },
  alertEmptyBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: UI.colors.successBg,
    borderRadius: UI.radius.md,
    padding: 10,
  },
  alertEmptyText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
    color: UI.colors.success,
  },
  alertItemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: UI.colors.background,
    borderRadius: UI.radius.md,
    padding: 11,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: UI.colors.border,
    gap: 8,
  },
  alertItemBody: {
    flex: 1,
  },
  alertItemTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 6,
  },
  alertItemTitle: {
    fontSize: 12.5,
    fontWeight: '700',
    color: UI.colors.text,
    flex: 1,
  },
  statusPillSmall: {
    borderWidth: 1,
    borderRadius: UI.radius.pill,
    paddingHorizontal: 7,
    paddingVertical: 1.5,
  },
  statusPillSmallText: {
    fontSize: 9.5,
    fontWeight: '700',
  },
  alertItemSpecs: {
    fontSize: 11,
    color: UI.colors.secondary,
    marginTop: 3,
  },
  boldRed: {
    color: UI.colors.dangerDark,
    fontWeight: '700',
  },

  activityHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  linkViewAll: {
    color: UI.colors.primary,
    fontSize: 12,
    fontWeight: '700',
  },
  activityCard: {
    backgroundColor: UI.colors.surface,
    borderRadius: UI.radius.lg,
    borderWidth: 1,
    borderColor: UI.colors.borderSoft,
    paddingHorizontal: 14,
    marginBottom: 16,
    ...cardShadow,
  },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: UI.colors.borderSubtle,
  },
  activityCircle: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activityDetails: {
    flex: 1,
    gap: 3,
  },
  activityTopLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  activityItemName: {
    flex: 1,
    fontSize: 12.5,
    fontWeight: '700',
    color: UI.colors.text,
  },
  activityQtyBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 7,
  },
  activityItemDiff: {
    fontSize: 11,
    fontWeight: '800',
  },
  activityBottomLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  activityMeta: {
    flex: 1,
    fontSize: 10.5,
    color: UI.colors.secondary,
  },
  activityRemain: {
    fontSize: 10.5,
    fontWeight: '600',
    color: UI.colors.secondary,
  },

  tokenCard: {
    backgroundColor: UI.colors.surface,
    borderWidth: 1,
    borderColor: UI.colors.borderSoft,
    borderRadius: UI.radius.lg,
    padding: 14,
    ...cardShadow,
  },
  tokenCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  tokenBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  tokenShieldCircle: {
    width: 26,
    height: 26,
    borderRadius: 8,
    backgroundColor: UI.colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tokenTitle: {
    fontSize: 12.5,
    fontWeight: '700',
    color: UI.colors.text,
  },
  activeTokenBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: UI.colors.successBg,
    borderWidth: 1,
    borderColor: UI.colors.successBorder,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: UI.radius.pill,
    gap: 5,
  },
  activeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: UI.colors.success,
  },
  activeTokenText: {
    fontSize: 10,
    color: UI.colors.success,
    fontWeight: '700',
  },
  tokenPreviewBox: {
    backgroundColor: UI.colors.background,
    borderWidth: 1,
    borderColor: UI.colors.borderSoft,
    borderRadius: UI.radius.sm,
    padding: 9,
    marginBottom: 8,
  },
  tokenLabel: {
    fontSize: 10,
    color: UI.colors.secondary,
    fontWeight: '600',
    marginBottom: 2,
  },
  tokenValue: {
    fontSize: 10.5,
    color: UI.colors.text,
    fontFamily: UI.font.mono,
  },
  tokenMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  tokenMetaText: {
    fontSize: 11,
    color: UI.colors.secondary,
  },
  tokenMetaBold: {
    fontWeight: '700',
    color: UI.colors.text,
  },
  tokenToggleText: {
    fontSize: 11,
    fontWeight: '700',
    color: UI.colors.primary,
  },
  testHeaderBtn: {
    height: 40,
  },
  testHeaderBtnText: {
    fontSize: 12,
  },

  bottomNav: {
    flexDirection: 'row',
    backgroundColor: UI.colors.surface,
    borderTopWidth: 1,
    borderTopColor: UI.colors.borderSoft,
    paddingTop: 8,
    paddingHorizontal: 6,
  },
  navItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  navIconWrap: {
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: UI.radius.pill,
  },
  navIconWrapActive: {
    backgroundColor: UI.colors.primary,
    backgroundImage: UI.gradients.primaryBtn,
  },
  navLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: UI.colors.secondary,
  },
  navLabelActive: {
    color: UI.colors.primary,
    fontWeight: '700',
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
  transaksiModalContent: {
    backgroundColor: UI.colors.surface,
    backgroundImage: UI.gradients.headerSoft,
    borderTopLeftRadius: UI.radius.sheet,
    borderTopRightRadius: UI.radius.sheet,
    paddingHorizontal: 20,
    paddingTop: 10,
    maxHeight: '90%',
  },
  transaksiModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  transaksiModalTitle: {
    fontSize: 16.5,
    fontWeight: '800',
    color: UI.colors.text,
  },
  transaksiCloseBtn: {
    width: 34,
    height: 34,
    borderRadius: 11,
    backgroundColor: UI.colors.surface,
    borderWidth: 1,
    borderColor: UI.colors.borderSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  formTypeSwitch: {
    flexDirection: 'row',
    backgroundColor: UI.colors.surface,
    borderRadius: UI.radius.pill,
    borderWidth: 1,
    borderColor: UI.colors.borderSoft,
    padding: 4,
    gap: 4,
    marginBottom: 14,
  },
  formTypePill: {
    flex: 1,
    height: 36,
    borderRadius: UI.radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  formTypePillActive: {
    backgroundColor: UI.colors.primary,
    backgroundImage: UI.gradients.primaryBtn,
  },
  formTypeText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: UI.colors.secondary,
  },
  formTypeTextActive: {
    color: '#FFFFFF',
  },
  formSection: {
    marginBottom: 13,
  },
  formSectionLabel: {
    fontSize: 12.5,
    fontWeight: '700',
    color: UI.colors.text,
    marginBottom: 7,
  },
  barangScrollPills: {
    gap: 8,
    paddingBottom: 2,
  },
  barangSelectPill: {
    backgroundColor: UI.colors.surface,
    borderWidth: 1,
    borderColor: UI.colors.borderSoft,
    borderRadius: UI.radius.md,
    paddingHorizontal: 12,
    paddingVertical: 9,
    minWidth: 146,
    maxWidth: 185,
  },
  barangSelectPillActive: {
    backgroundColor: UI.colors.primaryLight,
    borderColor: UI.colors.primary,
  },
  barangSelectName: {
    fontSize: 12,
    fontWeight: '700',
    color: UI.colors.text,
    marginBottom: 2,
  },
  barangSelectNameActive: {
    color: UI.colors.primary,
  },
  barangSelectSub: {
    fontSize: 10.5,
    color: UI.colors.secondary,
  },
  barangSelectSubActive: {
    color: UI.colors.primaryDark,
  },
  stepperContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  stepBtn: {
    width: 42,
    height: 42,
    borderRadius: UI.radius.md,
    backgroundColor: UI.colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: UI.colors.borderSoft,
  },
  qtyInput: {
    width: 64,
    height: 42,
    backgroundColor: UI.colors.surface,
    borderWidth: 1,
    borderColor: UI.colors.borderSoft,
    borderRadius: UI.radius.md,
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '800',
    color: UI.colors.text,
  },
  quickAddPill: {
    backgroundColor: UI.colors.surface,
    borderWidth: 1,
    borderColor: UI.colors.primaryBorder,
    paddingHorizontal: 11,
    paddingVertical: 10,
    borderRadius: UI.radius.md,
  },
  quickAddText: {
    fontSize: 12,
    fontWeight: '700',
    color: UI.colors.primary,
  },
  dateReadonlyBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: UI.colors.surface,
    borderWidth: 1,
    borderColor: UI.colors.borderSoft,
    borderRadius: UI.radius.md,
    paddingHorizontal: 13,
    height: 42,
  },
  dateReadonlyText: {
    fontSize: 13,
    fontWeight: '600',
    color: UI.colors.text,
  },
  catatanInput: {
    backgroundColor: UI.colors.surface,
    borderWidth: 1,
    borderColor: UI.colors.borderSoft,
    borderRadius: UI.radius.md,
    paddingHorizontal: 13,
    height: 44,
    fontSize: 13,
    color: UI.colors.text,
  },
  calcPreviewCard: {
    backgroundColor: UI.colors.surface,
    borderRadius: UI.radius.md,
    padding: 12,
    borderWidth: 1,
    borderColor: UI.colors.borderSoft,
    marginBottom: 12,
  },
  calcPreviewCardError: {
    backgroundColor: UI.colors.dangerBg,
    borderColor: UI.colors.dangerBorder,
  },
  calcPreviewTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: UI.colors.text,
    marginBottom: 7,
  },
  calcRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 3,
    gap: 12,
  },
  calcLabel: {
    fontSize: 11.5,
    color: UI.colors.secondary,
  },
  calcValue: {
    fontSize: 11.5,
    fontWeight: '600',
    color: UI.colors.text,
    flexShrink: 1,
    textAlign: 'right',
  },
  calcRowTotal: {
    borderTopWidth: 1,
    borderTopColor: UI.colors.borderSubtle,
    marginTop: 5,
    paddingTop: 7,
  },
  calcTotalLabel: {
    fontSize: 12.5,
    fontWeight: '700',
    color: UI.colors.text,
  },
  calcTotalValue: {
    fontSize: 13.5,
    fontWeight: '800',
    color: UI.colors.primary,
  },
  errorWarnBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
    backgroundColor: UI.colors.surface,
    borderWidth: 1,
    borderColor: UI.colors.dangerBorder,
    padding: 8,
    borderRadius: UI.radius.sm,
  },
  errorWarnText: {
    fontSize: 11,
    color: UI.colors.dangerDark,
    fontWeight: '600',
  },
  modalActionButtons: {
    flexDirection: 'row',
    gap: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: UI.colors.borderSubtle,
  },

  sheetModalContent: {
    backgroundColor: UI.colors.surface,
    backgroundImage: UI.gradients.headerSoft,
    borderTopLeftRadius: UI.radius.sheet,
    borderTopRightRadius: UI.radius.sheet,
    paddingHorizontal: 20,
    paddingTop: 10,
    maxHeight: '90%',
  },
  sheetModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: UI.colors.borderSubtle,
  },
  sheetHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  sheetIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetModalTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: UI.colors.text,
  },
  sheetModalSubtitle: {
    fontSize: 11.5,
    color: UI.colors.secondary,
    marginTop: 1,
  },
  sheetCloseBtn: {
    width: 34,
    height: 34,
    borderRadius: 11,
    backgroundColor: UI.colors.surface,
    borderWidth: 1,
    borderColor: UI.colors.borderSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetActionRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 10,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: UI.colors.borderSubtle,
  },

  // Users & Warehouse Modals
  userRowCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: UI.colors.surface,
    borderWidth: 1,
    borderColor: UI.colors.borderSoft,
    borderRadius: UI.radius.md,
    padding: 12,
    marginBottom: 8,
  },
  userRowName: {
    fontSize: 13,
    fontWeight: '800',
    color: UI.colors.text,
  },
  userRowMeta: {
    fontSize: 11,
    color: UI.colors.secondary,
    marginTop: 2,
  },
  userStatusPill: {
    backgroundColor: UI.colors.successBg,
    borderWidth: 1,
    borderColor: UI.colors.successBorder,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: UI.radius.pill,
  },
  userStatusPillOff: {
    backgroundColor: UI.colors.dangerBg,
    borderColor: UI.colors.dangerBorder,
  },
  userStatusText: {
    fontSize: 11,
    fontWeight: '700',
    color: UI.colors.success,
  },
  addUserBox: {
    backgroundColor: UI.colors.surface,
    borderWidth: 1,
    borderColor: UI.colors.borderSoft,
    borderRadius: UI.radius.lg,
    padding: 12,
    marginTop: 6,
  },
  radiusRow: {
    flexDirection: 'row',
    gap: 6,
  },
  roleSelectChip: {
    flex: 1,
    backgroundColor: UI.colors.background,
    borderWidth: 1,
    borderColor: UI.colors.borderSoft,
    borderRadius: UI.radius.pill,
    paddingVertical: 8,
    paddingHorizontal: 6,
    alignItems: 'center',
  },
  roleSelectChipActive: {
    backgroundColor: UI.colors.primary,
    backgroundImage: UI.gradients.primaryBtn,
    borderColor: UI.colors.primary,
  },
  roleSelectChipText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: UI.colors.secondary,
  },

  mutasiFilterRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
    marginBottom: 8,
  },
  mutasiFilterPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 7,
    paddingHorizontal: 13,
    borderRadius: UI.radius.pill,
    backgroundColor: UI.colors.surface,
    borderWidth: 1,
    borderColor: UI.colors.borderSoft,
  },
  mutasiFilterPillActive: {
    backgroundColor: UI.colors.primary,
    backgroundImage: UI.gradients.primaryBtn,
    borderColor: UI.colors.primary,
  },
  filterDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  mutasiFilterText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: UI.colors.secondary,
  },
  mutasiFilterTextActive: {
    color: '#FFFFFF',
  },
  emptyMutasiBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 30,
    gap: 8,
  },
  emptyMutasiText: {
    fontSize: 12.5,
    color: UI.colors.muted,
  },
  mutasiItemCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 11,
    paddingHorizontal: 12,
    marginBottom: 8,
    backgroundColor: UI.colors.surface,
    borderRadius: UI.radius.md,
    borderWidth: 1,
    borderColor: UI.colors.borderSoft,
    gap: 11,
  },
  mutasiTypeBadge: {
    width: 34,
    height: 34,
    borderRadius: 10,
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
    gap: 8,
  },
  mutasiItemName: {
    fontSize: 13,
    fontWeight: '700',
    color: UI.colors.text,
    flex: 1,
  },
  mutasiItemQty: {
    fontSize: 11.5,
    fontWeight: '800',
  },
  mutasiItemMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
    gap: 6,
  },
  mutasiItemDate: {
    fontSize: 10.5,
    color: UI.colors.muted,
  },
  mutasiItemOperator: {
    fontSize: 10.5,
    color: UI.colors.secondary,
    fontWeight: '500',
  },
  mutasiItemSisa: {
    fontSize: 11,
    color: UI.colors.secondary,
    marginTop: 3,
  },
  boldDark: {
    fontWeight: '700',
    color: UI.colors.text,
  },

  laporanFinanceCard: {
    backgroundColor: UI.colors.surface,
    borderWidth: 1,
    borderColor: UI.colors.borderSoft,
    borderRadius: UI.radius.lg,
    padding: 14,
    marginTop: 12,
    marginBottom: 10,
  },
  laporanCardTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: UI.colors.text,
    marginBottom: 10,
  },
  financeItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: UI.colors.background,
    borderRadius: UI.radius.md,
    borderWidth: 1,
    borderColor: UI.colors.borderSoft,
    padding: 11,
    marginBottom: 10,
  },
  financeMetricBox: {
    flex: 1,
  },
  financeMetricDivider: {
    width: 1,
    height: 30,
    backgroundColor: UI.colors.border,
    marginHorizontal: 12,
  },
  financeLabel: {
    fontSize: 10.5,
    color: UI.colors.secondary,
    marginBottom: 2,
  },
  financeBeliValue: {
    fontSize: 13.5,
    fontWeight: '800',
    color: UI.colors.text,
  },
  financeJualValue: {
    fontSize: 13.5,
    fontWeight: '800',
    color: UI.colors.primary,
  },
  financeMarginBox: {
    backgroundColor: UI.colors.primaryLight,
    borderRadius: UI.radius.md,
    padding: 11,
    borderWidth: 1,
    borderColor: UI.colors.primaryBorder,
  },
  financeMarginLabel: {
    fontSize: 11.5,
    fontWeight: '600',
    color: UI.colors.textBody,
  },
  marginPercentBadge: {
    backgroundColor: UI.colors.successBg,
    borderWidth: 1,
    borderColor: UI.colors.successBorder,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: UI.radius.pill,
  },
  marginPercentText: {
    fontSize: 10.5,
    fontWeight: '800',
    color: UI.colors.success,
  },
  financeMarginValue: {
    fontSize: 17,
    fontWeight: '800',
    color: UI.colors.primary,
    marginTop: 4,
  },
  laporanHealthCard: {
    backgroundColor: UI.colors.surface,
    borderWidth: 1,
    borderColor: UI.colors.borderSoft,
    borderRadius: UI.radius.lg,
    padding: 14,
    marginBottom: 10,
  },
  healthStackedBar: {
    flexDirection: 'row',
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
    backgroundColor: UI.colors.surfaceMuted,
    marginBottom: 12,
    gap: 2,
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
    borderRadius: UI.radius.md,
    borderWidth: 1,
  },
  healthStatNumber: {
    fontSize: 18,
    fontWeight: '800',
  },
  healthStatLabel: {
    fontSize: 10.5,
    color: UI.colors.secondary,
    fontWeight: '600',
    marginTop: 2,
  },
  laporanCategoryCard: {
    backgroundColor: UI.colors.surface,
    borderWidth: 1,
    borderColor: UI.colors.borderSoft,
    borderRadius: UI.radius.lg,
    padding: 14,
    marginBottom: 6,
  },
  kategoriRowWrap: {
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor: UI.colors.borderSubtle,
  },
  kategoriRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  kategoriName: {
    fontSize: 12.5,
    fontWeight: '700',
    color: UI.colors.text,
  },
  kategoriDetail: {
    fontSize: 10.5,
    color: UI.colors.secondary,
    marginTop: 1,
  },
  kategoriAsetValue: {
    fontSize: 12.5,
    fontWeight: '700',
    color: UI.colors.text,
  },
  kategoriBarTrack: {
    height: 5,
    borderRadius: 3,
    backgroundColor: UI.colors.primaryLight,
    overflow: 'hidden',
  },
  kategoriBarFill: {
    height: '100%',
    borderRadius: 3,
    backgroundColor: UI.colors.primary,
    backgroundImage: UI.gradients.primaryBtn,
  },

  menuUserCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: UI.colors.surface,
    borderWidth: 1,
    borderColor: UI.colors.primaryBorder,
    borderRadius: UI.radius.lg,
    padding: 14,
    marginTop: 12,
    gap: 13,
  },
  menuAvatarCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: UI.colors.primary,
    backgroundImage: UI.gradients.primaryBtn,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuAvatarText: {
    fontSize: 20,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  menuUserInfo: {
    flex: 1,
  },
  menuUserName: {
    fontSize: 15,
    fontWeight: '800',
    color: UI.colors.text,
  },
  menuUserEmail: {
    fontSize: 11.5,
    color: UI.colors.secondary,
    marginTop: 1,
  },
  menuRoleBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 7,
  },
  menuRoleBadge: {
    backgroundColor: UI.colors.primaryLight,
    borderWidth: 1,
    borderColor: UI.colors.primaryBorder,
    paddingHorizontal: 8,
    paddingVertical: 2.5,
    borderRadius: UI.radius.pill,
  },
  menuRoleBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: UI.colors.primary,
  },
  menuVerifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: UI.colors.successBg,
    borderWidth: 1,
    borderColor: UI.colors.successBorder,
    paddingHorizontal: 7,
    paddingVertical: 2.5,
    borderRadius: UI.radius.pill,
  },
  menuVerifiedText: {
    fontSize: 10,
    fontWeight: '700',
    color: UI.colors.success,
  },
  menuListCard: {
    backgroundColor: UI.colors.surface,
    borderWidth: 1,
    borderColor: UI.colors.borderSoft,
    borderRadius: UI.radius.lg,
    marginTop: 12,
    paddingHorizontal: 14,
  },
  menuListRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: UI.colors.borderSubtle,
    gap: 12,
  },
  menuListIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: UI.colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuListText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '700',
    color: UI.colors.text,
  },
  menuLogoutBtn: {
    flex: 1,
    height: 46,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: UI.colors.dangerBg,
    borderWidth: 1,
    borderColor: UI.colors.dangerBorder,
    borderRadius: UI.radius.md,
  },
  menuLogoutBtnText: {
    color: UI.colors.dangerDark,
    fontSize: 13.5,
    fontWeight: '700',
  },

  roleListCard: {
    backgroundColor: UI.colors.surface,
    borderWidth: 1,
    borderColor: UI.colors.borderSoft,
    borderRadius: UI.radius.lg,
    marginTop: 14,
    marginBottom: 8,
    paddingHorizontal: 14,
  },
  roleRadioRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: UI.colors.borderSubtle,
  },
  roleRadioTitle: {
    fontSize: 13.5,
    fontWeight: '700',
    color: UI.colors.text,
  },
  roleRadioSub: {
    fontSize: 11.5,
    color: UI.colors.secondary,
    marginTop: 2,
  },
  radioOuter: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: UI.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioOuterActive: {
    borderColor: UI.colors.primary,
  },
  radioInner: {
    width: 11,
    height: 11,
    borderRadius: 5.5,
    backgroundColor: UI.colors.primary,
  },
});
