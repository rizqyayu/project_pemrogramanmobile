import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Platform,
  StatusBar as RNStatusBar,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';

// Data Akun Demo sesuai Gambar
const DEMO_ACCOUNTS = {
  admin: {
    username: 'admin',
    name: 'Budi',
    role: 'Admin Gudang',
    aman: 3,
    menipis: 3,
    habis: 0,
  },
  staff: {
    username: 'staff',
    name: 'Rian',
    role: 'Staff Inventory',
    aman: 3,
    menipis: 3,
    habis: 0,
  },
  manager: {
    username: 'manager',
    name: 'Hendra',
    role: 'Pemilik Toko / Manajer',
    aman: 3,
    menipis: 3,
    habis: 0,
  },
};

export default function EduStockApp() {
  const [currentView, setCurrentView] = useState<'login' | 'dashboard'>('login');
  const [currentUser, setCurrentUser] = useState(DEMO_ACCOUNTS.admin);
  const [usernameInput, setUsernameInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Navigasi login
  const handleLogin = (userKey?: 'admin' | 'staff' | 'manager') => {
    if (userKey && DEMO_ACCOUNTS[userKey]) {
      setCurrentUser(DEMO_ACCOUNTS[userKey]);
    } else {
      const lower = usernameInput.trim().toLowerCase();
      if (lower.includes('rian') || lower === 'staff') {
        setCurrentUser(DEMO_ACCOUNTS.staff);
      } else if (lower.includes('hendra') || lower.includes('manag')) {
        setCurrentUser(DEMO_ACCOUNTS.manager);
      } else {
        setCurrentUser(DEMO_ACCOUNTS.admin);
      }
    }
    setCurrentView('dashboard');
  };

  const handleLogout = () => {
    setCurrentView('login');
  };

  // ==========================================
  // TAMPILAN 1: LOGIN (Masuk ke Akun)
  // ==========================================
  if (currentView === 'login') {
    return (
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.loginContainer} showsVerticalScrollIndicator={false}>
          {/* Header Gear Icon */}
          <View style={styles.loginTopRight}>
            <TouchableOpacity style={styles.gearCircleBtn} activeOpacity={0.7} onPress={() => {}}>
              <Feather name="settings" size={18} color="#94a3b8" />
            </TouchableOpacity>
          </View>

          {/* Logo & Branding */}
          <View style={styles.logoSection}>
            <View style={styles.logoCubeBadge}>
              <Feather name="box" size={36} color="#ffffff" />
            </View>
            <Text style={styles.appTitle}>EduStock</Text>
            <Text style={styles.appSubtitle}>Mobile Inventory Management & Monitoring{'\n'}Sistem</Text>
          </View>

          {/* Card Form */}
          <View style={styles.loginCard}>
            <Text style={styles.cardHeaderTitle}>Masuk ke Akun</Text>
            <Text style={styles.cardHeaderSubtitle}>Gunakan kredensial yang terdaftar untuk mengakses inventory</Text>

            {/* Input Username */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Username atau Email</Text>
              <View style={styles.inputWrapper}>
                <Feather name="user" size={18} color="#94a3b8" style={styles.inputIcon} />
                <TextInput
                  style={styles.textInput}
                  placeholder="admin / staff / email..."
                  placeholderTextColor="#94a3b8"
                  value={usernameInput}
                  onChangeText={setUsernameInput}
                  autoCapitalize="none"
                />
              </View>
            </View>

            {/* Input Password */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Password</Text>
              <View style={styles.inputWrapper}>
                <Feather name="lock" size={18} color="#94a3b8" style={styles.inputIcon} />
                <TextInput
                  style={styles.textInput}
                  placeholder="Masukkan password..."
                  placeholderTextColor="#94a3b8"
                  secureTextEntry={!showPassword}
                  value={passwordInput}
                  onChangeText={setPasswordInput}
                />
                <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                  <Feather name={showPassword ? 'eye-off' : 'eye'} size={18} color="#64748b" />
                </TouchableOpacity>
              </View>
            </View>

            {/* Tombol Masuk Sekarang */}
            <TouchableOpacity style={styles.loginButton} activeOpacity={0.8} onPress={() => handleLogin()}>
              <Text style={styles.loginButtonText}>Masuk Sekarang</Text>
              <Feather name="arrow-right" size={18} color="#ffffff" />
            </TouchableOpacity>

            {/* Pilih Akun Cepat */}
            <View style={styles.demoSection}>
              <Text style={styles.demoLabel}>Pilih Akun Cepat (Development Demo):</Text>
              <View style={styles.demoButtonsRow}>
                <TouchableOpacity style={styles.demoPill} onPress={() => handleLogin('admin')}>
                  <Text style={styles.demoPillText}>Admin Gudang</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.demoPill} onPress={() => handleLogin('staff')}>
                  <Text style={styles.demoPillText}>Staff Inventory</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.demoPill} onPress={() => handleLogin('manager')}>
                  <Text style={styles.demoPillText}>Manajer</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {/* Footer API Info */}
          <Text style={styles.apiFooterText}>Terhubung ke API: http://192.168.1.7:3000/api</Text>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ==========================================
  // TAMPILAN 2: DASHBOARD (EduStock Inventory)
  // ==========================================
  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Top Header App Bar */}
      <View style={styles.dashHeader}>
        <Text style={styles.dashHeaderTitle}>EduStock Inventory</Text>
        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
          <Feather name="log-out" size={13} color="#ef4444" />
          <Text style={styles.logoutBtnText}>Keluar</Text>
        </TouchableOpacity>
      </View>

      {/* Main Scroll Content */}
      <ScrollView style={styles.dashScrollView} contentContainerStyle={styles.dashScrollContent} showsVerticalScrollIndicator={false}>
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
              <TouchableOpacity style={styles.switchAccountBtn} onPress={handleLogout}>
                <Feather name="repeat" size={11} color="#f87171" />
                <Text style={styles.switchAccountText}>Ganti Akun</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* 3 Status Chips */}
          <View style={styles.statusChipsRow}>
            <View style={styles.chipItem}>
              <View style={[styles.statusDot, { backgroundColor: '#22c55e' }]} />
              <Text style={styles.chipText}>Aman: {currentUser.aman}</Text>
            </View>
            <View style={styles.chipItem}>
              <View style={[styles.statusDot, { backgroundColor: '#f59e0b' }]} />
              <Text style={styles.chipText}>Menipis: {currentUser.menipis}</Text>
            </View>
            <View style={styles.chipItem}>
              <View style={[styles.statusDot, { backgroundColor: '#ef4444' }]} />
              <Text style={styles.chipText}>Habis: {currentUser.habis}</Text>
            </View>
          </View>
        </View>

        {/* 2x2 Stats Summary Grid */}
        <View style={styles.statsGrid}>
          {/* Total Barang */}
          <View style={styles.statCard}>
            <View style={styles.statCardHeader}>
              <View style={[styles.statIconBadge, { backgroundColor: '#eff6ff' }]}>
                <Feather name="box" size={16} color="#2563eb" />
              </View>
              <Text style={styles.statTitle}>Total Barang</Text>
            </View>
            <Text style={styles.statNumber}>6</Text>
            <Text style={styles.statDesc}>Jenis produk terdaftar</Text>
          </View>

          {/* Total Stok */}
          <View style={styles.statCard}>
            <View style={styles.statCardHeader}>
              <View style={[styles.statIconBadge, { backgroundColor: '#ecfeff' }]}>
                <Feather name="layers" size={16} color="#0891b2" />
              </View>
              <Text style={styles.statTitle}>Total Stok</Text>
            </View>
            <Text style={styles.statNumber}>85</Text>
            <Text style={styles.statDesc}>Unit barang di gudang</Text>
          </View>

          {/* Stok Minimum */}
          <View style={styles.statCard}>
            <View style={styles.statCardHeader}>
              <View style={[styles.statIconBadge, { backgroundColor: '#fef2f2' }]}>
                <Feather name="alert-circle" size={16} color="#dc2626" />
              </View>
              <Text style={styles.statTitle}>Stok Minimum</Text>
            </View>
            <Text style={styles.statNumber}>3</Text>
            <Text style={styles.statDesc}>Perlu restock segera</Text>
          </View>

          {/* Barang Masuk */}
          <View style={styles.statCard}>
            <View style={styles.statCardHeader}>
              <View style={[styles.statIconBadge, { backgroundColor: '#f0fdf4' }]}>
                <Feather name="arrow-down-circle" size={16} color="#16a34a" />
              </View>
              <Text style={styles.statTitle}>Barang Masuk</Text>
            </View>
            <Text style={styles.statNumber}>40</Text>
            <Text style={styles.statDesc}>Total akumulasi masuk</Text>
          </View>
        </View>

        {/* Warning Box: Peringatan Stok Perlu Perhatian */}
        <View style={styles.alertBox}>
          <View style={styles.alertHeaderRow}>
            <Feather name="alert-triangle" size={16} color="#dc2626" />
            <Text style={styles.alertHeaderTitle}>Peringatan Stok Perlu Perhatian (3)</Text>
          </View>
          <Text style={styles.alertHeaderDesc}>
            Terdapat barang yang telah mencapai batas minimum atau habis. Segera buat catatan Stok Masuk.
          </Text>

          {/* Item 1 */}
          <View style={styles.alertItemCard}>
            <View style={styles.alertItemTopRow}>
              <Text style={styles.alertItemTitle}>Proyektor Epson EB-X400 3300 Lumens</Text>
              <View style={styles.menipisBadge}>
                <Text style={styles.menipisText}>• Menipis</Text>
              </View>
            </View>
            <Text style={styles.alertItemSpecs}>
              BRG-002 • Sisa: <Text style={styles.boldRed}>3 Unit</Text> (Min: 5)
            </Text>
          </View>

          {/* Item 2 */}
          <View style={styles.alertItemCard}>
            <View style={styles.alertItemTopRow}>
              <Text style={styles.alertItemTitle}>Spidol Whiteboard Snowman Hitam</Text>
              <View style={styles.menipisBadge}>
                <Text style={styles.menipisText}>• Menipis</Text>
              </View>
            </View>
            <Text style={styles.alertItemSpecs}>
              BRG-004 • Sisa: <Text style={styles.boldRed}>5 Box</Text> (Min: 20)
            </Text>
          </View>

          {/* Item 3 */}
          <View style={styles.alertItemCard}>
            <View style={styles.alertItemTopRow}>
              <Text style={styles.alertItemTitle}>Kertas HVS PaperOne A4 80gr</Text>
              <View style={styles.menipisBadge}>
                <Text style={styles.menipisText}>• Menipis</Text>
              </View>
            </View>
            <Text style={styles.alertItemSpecs}>
              BRG-005 • Sisa: <Text style={styles.boldRed}>4 Rim</Text> (Min: 10)
            </Text>
          </View>
        </View>

        {/* Aksi Cepat Inventory */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>Aksi Cepat Inventory</Text>
        </View>
        <View style={styles.quickActionsRow}>
          {/* Stok Masuk */}
          <TouchableOpacity style={[styles.actionBtn, { backgroundColor: '#f0fdf4', borderColor: '#bbf7d0' }]} onPress={() => {}}>
            <View style={[styles.actionCircle, { backgroundColor: '#16a34a' }]}>
              <Feather name="plus" size={18} color="#ffffff" />
            </View>
            <Text style={[styles.actionText, { color: '#16a34a' }]}>Stok Masuk</Text>
          </TouchableOpacity>

          {/* Stok Keluar */}
          <TouchableOpacity style={[styles.actionBtn, { backgroundColor: '#fef2f2', borderColor: '#fecaca' }]} onPress={() => {}}>
            <View style={[styles.actionCircle, { backgroundColor: '#dc2626' }]}>
              <Feather name="minus" size={18} color="#ffffff" />
            </View>
            <Text style={[styles.actionText, { color: '#dc2626' }]}>Stok Keluar</Text>
          </TouchableOpacity>

          {/* Tambah Barang */}
          <TouchableOpacity style={[styles.actionBtn, { backgroundColor: '#eff6ff', borderColor: '#bfdbfe' }]} onPress={() => {}}>
            <View style={[styles.actionCircle, { backgroundColor: '#2563eb' }]}>
              <Feather name="box" size={18} color="#ffffff" />
            </View>
            <Text style={[styles.actionText, { color: '#2563eb' }]}>Tambah Barang</Text>
          </TouchableOpacity>
        </View>

        {/* Aktivitas Stok Terbaru */}
        <View style={styles.activityHeaderRow}>
          <Text style={styles.sectionTitle}>Aktivitas Stok Terbaru</Text>
          <TouchableOpacity onPress={() => {}}>
            <Text style={styles.linkViewAll}>Lihat Semua</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.activityCard}>
          {/* Item 1 */}
          <View style={styles.activityItem}>
            <View style={[styles.activityCircle, { backgroundColor: '#fef2f2' }]}>
              <Feather name="arrow-up" size={15} color="#ef4444" />
            </View>
            <View style={styles.activityDetails}>
              <View style={styles.activityTopLine}>
                <Text style={styles.activityItemName}>Spidol Whiteboard Snowman Hitam</Text>
                <Text style={[styles.activityItemDiff, { color: '#dc2626' }]}>-5 Box</Text>
              </View>
              <View style={styles.activityBottomLine}>
                <Text style={styles.activityMeta}>6 Okt 2026 • Rian Pratama (Staff Inventory)</Text>
                <Text style={styles.activityRemain}>Sisa: 5</Text>
              </View>
            </View>
          </View>

          {/* Item 2 */}
          <View style={styles.activityItem}>
            <View style={[styles.activityCircle, { backgroundColor: '#f0fdf4' }]}>
              <Feather name="arrow-down" size={15} color="#16a34a" />
            </View>
            <View style={styles.activityDetails}>
              <View style={styles.activityTopLine}>
                <Text style={styles.activityItemName}>Spidol Whiteboard Snowman Hitam</Text>
                <Text style={[styles.activityItemDiff, { color: '#16a34a' }]}>+10 Box</Text>
              </View>
              <View style={styles.activityBottomLine}>
                <Text style={styles.activityMeta}>6 Okt 2026 • Rian Pratama (Staff Inventory)</Text>
                <Text style={styles.activityRemain}>Sisa: 10</Text>
              </View>
            </View>
          </View>

          {/* Item 3 */}
          <View style={styles.activityItem}>
            <View style={[styles.activityCircle, { backgroundColor: '#fef2f2' }]}>
              <Feather name="arrow-up" size={15} color="#ef4444" />
            </View>
            <View style={styles.activityDetails}>
              <View style={styles.activityTopLine}>
                <Text style={styles.activityItemName}>Laptop ASUS ExpertBook i5</Text>
                <Text style={[styles.activityItemDiff, { color: '#dc2626' }]}>-5 Unit</Text>
              </View>
              <View style={styles.activityBottomLine}>
                <Text style={styles.activityMeta}>6 Okt 2026 • Budi Santoso (Admin Gudang)</Text>
                <Text style={styles.activityRemain}>Sisa: 20</Text>
              </View>
            </View>
          </View>

          {/* Item 4 */}
          <View style={styles.activityItem}>
            <View style={[styles.activityCircle, { backgroundColor: '#f0fdf4' }]}>
              <Feather name="arrow-down" size={15} color="#16a34a" />
            </View>
            <View style={styles.activityDetails}>
              <View style={styles.activityTopLine}>
                <Text style={styles.activityItemName}>Laptop ASUS ExpertBook i5</Text>
                <Text style={[styles.activityItemDiff, { color: '#16a34a' }]}>+10 Unit</Text>
              </View>
              <View style={styles.activityBottomLine}>
                <Text style={styles.activityMeta}>6 Okt 2026 • Budi Santoso (Admin Gudang)</Text>
                <Text style={styles.activityRemain}>Sisa: 25</Text>
              </View>
            </View>
          </View>

          {/* Item 5 */}
          <View style={styles.activityItem}>
            <View style={[styles.activityCircle, { backgroundColor: '#fef2f2' }]}>
              <Feather name="arrow-up" size={15} color="#ef4444" />
            </View>
            <View style={styles.activityDetails}>
              <View style={styles.activityTopLine}>
                <Text style={styles.activityItemName}>Proyektor Epson EB-X400 3300 Lumens</Text>
                <Text style={[styles.activityItemDiff, { color: '#dc2626' }]}>-2 Unit</Text>
              </View>
              <View style={styles.activityBottomLine}>
                <Text style={styles.activityMeta}>5 Okt 2026 • Rian Pratama (Staff Inventory)</Text>
                <Text style={styles.activityRemain}>Sisa: 3</Text>
              </View>
            </View>
          </View>

          {/* Item 6 */}
          <View style={[styles.activityItem, { borderBottomWidth: 0 }]}>
            <View style={[styles.activityCircle, { backgroundColor: '#f0fdf4' }]}>
              <Feather name="arrow-down" size={15} color="#16a34a" />
            </View>
            <View style={styles.activityDetails}>
              <View style={styles.activityTopLine}>
                <Text style={styles.activityItemName}>Laptop ASUS ExpertBook i5</Text>
                <Text style={[styles.activityItemDiff, { color: '#16a34a' }]}>+15 Unit</Text>
              </View>
              <View style={styles.activityBottomLine}>
                <Text style={styles.activityMeta}>3 Okt 2026 • Rian Pratama (Staff Inventory)</Text>
                <Text style={styles.activityRemain}>Sisa: 15</Text>
              </View>
            </View>
          </View>
        </View>

        <View style={{ height: 30 }} />
      </ScrollView>

      {/* Sticky Bottom Navigation Bar (5 tabs) */}
      <View style={styles.bottomNav}>
        {/* Dashboard (Active) */}
        <TouchableOpacity style={styles.navItem} onPress={() => {}}>
          <Ionicons name="home" size={22} color="#2563eb" />
          <Text style={[styles.navLabel, { color: '#2563eb' }]}>Dashboard</Text>
        </TouchableOpacity>

        {/* Barang (Belum ada reaksi apa-apa) */}
        <TouchableOpacity style={styles.navItem} onPress={() => {}}>
          <Feather name="box" size={22} color="#94a3b8" />
          <Text style={styles.navLabel}>Barang</Text>
        </TouchableOpacity>

        {/* Mutasi Stok (Belum ada reaksi apa-apa) */}
        <TouchableOpacity style={styles.navItem} onPress={() => {}}>
          <MaterialCommunityIcons name="swap-vertical" size={22} color="#94a3b8" />
          <Text style={styles.navLabel}>Mutasi Stok</Text>
        </TouchableOpacity>

        {/* Laporan (Belum ada reaksi apa-apa) */}
        <TouchableOpacity style={styles.navItem} onPress={() => {}}>
          <Feather name="file-text" size={22} color="#94a3b8" />
          <Text style={styles.navLabel}>Laporan</Text>
        </TouchableOpacity>

        {/* Menu (Belum ada reaksi apa-apa) */}
        <TouchableOpacity style={styles.navItem} onPress={() => {}}>
          <Feather name="grid" size={22} color="#94a3b8" />
          <Text style={styles.navLabel}>Menu</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

// ==========================================
// STYLESHEET REACT NATIVE
// ==========================================
const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f8fafc',
    paddingTop: Platform.OS === 'android' ? RNStatusBar.currentHeight : 0,
  },
  loginContainer: {
    paddingHorizontal: 20,
    paddingBottom: 24,
  },
  loginTopRight: {
    alignItems: 'flex-end',
    marginTop: 8,
  },
  gearCircleBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(148, 163, 184, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoSection: {
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 24,
  },
  logoCubeBadge: {
    width: 68,
    height: 68,
    borderRadius: 20,
    backgroundColor: '#2563eb',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#2563eb',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 8,
    marginBottom: 12,
  },
  appTitle: {
    fontSize: 27,
    fontWeight: '800',
    color: '#0f172a',
    letterSpacing: -0.5,
    marginBottom: 4,
  },
  appSubtitle: {
    fontSize: 12.5,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 18,
  },
  loginCard: {
    backgroundColor: '#ffffff',
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: '#f1f5f9',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 3,
  },
  cardHeaderTitle: {
    fontSize: 19,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 4,
  },
  cardHeaderSubtitle: {
    fontSize: 12,
    color: '#64748b',
    marginBottom: 18,
    lineHeight: 16,
  },
  inputGroup: {
    marginBottom: 14,
  },
  inputLabel: {
    fontSize: 12.5,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 6,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 48,
  },
  inputIcon: {
    marginRight: 8,
  },
  textInput: {
    flex: 1,
    fontSize: 13.5,
    color: '#0f172a',
  },
  loginButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2563eb',
    borderRadius: 12,
    height: 48,
    marginTop: 6,
    gap: 8,
    shadowColor: '#2563eb',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  loginButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
  demoSection: {
    marginTop: 18,
  },
  demoLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748b',
    marginBottom: 8,
  },
  demoButtonsRow: {
    flexDirection: 'row',
    gap: 6,
  },
  demoPill: {
    flex: 1,
    backgroundColor: '#f0f7ff',
    borderWidth: 1,
    borderColor: '#bfdbfe',
    borderRadius: 8,
    paddingVertical: 8,
    alignItems: 'center',
  },
  demoPillText: {
    color: '#1d4ed8',
    fontSize: 11,
    fontWeight: '700',
  },
  apiFooterText: {
    fontSize: 11,
    color: '#94a3b8',
    textAlign: 'center',
    marginTop: 24,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },

  // Dashboard Styles
  dashHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#f8fafc',
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
    paddingVertical: 4,
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

