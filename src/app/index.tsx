import React, { useState, useEffect } from 'react';
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
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';

// Import Services & Helper Autentikasi
import {
  authenticateUser,
  loginAsDemo,
  getSavedSession,
} from '../services/authService';

/**
 * =========================================================================
 * HALAMAN 1: LOGIN (src/app/index.tsx)
 * Memenuhi Kriteria Modul 2:
 * 1. useState: Mengelola input username, password, showPassword, loading, error.
 * 2. useEffect: Memeriksa session aktif saat aplikasi pertama kali dimuat.
 * 3. Expo Router: router.replace('/dashboard') setelah autentikasi berhasil.
 * =========================================================================
 */
export default function LoginScreen() {
  // -----------------------------------------------------------------------
  // PENERAPAN STATE (useState)
  // Digunakan untuk menyimpan data dinamis yang merubah tampilan UI secara reaktif
  // -----------------------------------------------------------------------
  const [usernameInput, setUsernameInput] = useState<string>(''); // State input username/email
  const [passwordInput, setPasswordInput] = useState<string>(''); // State input password
  const [showPassword, setShowPassword] = useState<boolean>(false); // State visibilitas karakter password
  const [isLoading, setIsLoading] = useState<boolean>(false); // State indikator proses autentikasi
  const [errorMessage, setErrorMessage] = useState<string | null>(null); // State pesan error jika login gagal

  // -----------------------------------------------------------------------
  // PENERAPAN EFFECT (useEffect)
  // Dijalankan sekali saat komponen pertama kali dibuka (dependency array kosong [])
  // Bertujuan memeriksa apakah token/sesi pengguna sudah tersimpan di AsyncStorage
  // -----------------------------------------------------------------------
  useEffect(() => {
    async function checkExistingSession() {
      try {
        const savedSession = await getSavedSession();
        if (savedSession) {
          /**
           * PERBEDAAN ROUTER:
           * router.replace(): Menggantikan layar saat ini pada tumpukan navigasi.
           * Pengguna yang sudah login langsung dialihkan ke Dashboard tanpa bisa
           * menekan tombol 'Back' untuk kembali ke halaman login.
           */
          router.replace('/dashboard');
        }
      } catch (err) {
        console.warn('Gagal memulihkan session:', err);
      }
    }

    checkExistingSession();
  }, []);

  // -----------------------------------------------------------------------
  // HANDLER: Proses Login Manual & Login Cepat Demo
  // -----------------------------------------------------------------------
  const handleLogin = async (roleKey?: 'admin' | 'staff' | 'manager') => {
    setErrorMessage(null);
    setIsLoading(true);

    try {
      if (roleKey) {
        // Login cepat demo menggunakan akun yang sudah disediakan
        await loginAsDemo(roleKey);

        /**
         * Navigasi ke Dashboard menggunakan router.replace().
         * Halaman login digantikan oleh halaman dashboard di stack navigasi.
         */
        router.replace('/dashboard');
      } else {
        // Validasi input manual
        if (!usernameInput.trim() || !passwordInput.trim()) {
          setErrorMessage('Silakan isi username dan password Anda terlebih dahulu.');
          setIsLoading(false);
          return;
        }

        // Panggil auth service untuk verifikasi kredensial & pembuatan JWT Token
        const result = await authenticateUser(usernameInput, passwordInput);

        if (result.success && result.session) {
          // Berhasil login -> Alihkan pengguna ke halaman Dashboard
          router.replace('/dashboard');
        } else {
          setErrorMessage(result.message || 'Kredensial tidak valid.');
        }
      }
    } catch (error: any) {
      setErrorMessage(error?.message || 'Terjadi kesalahan pada sistem autentikasi.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.loginContainer}
        showsVerticalScrollIndicator={false}
      >
        {/* Tombol Pengaturan di Header Atas */}
        <View style={styles.loginTopRight}>
          <TouchableOpacity
            style={styles.gearCircleBtn}
            activeOpacity={0.7}
            onPress={() =>
              Alert.alert(
                'Informasi Modul 2',
                'Aplikasi EduStock (Inventory Management)\nModul 2: State, Hooks & Navigasi Page'
              )
            }
          >
            <Feather name="settings" size={18} color="#94a3b8" />
          </TouchableOpacity>
        </View>

        {/* Logo & Branding EduStock */}
        <View style={styles.logoSection}>
          <View style={styles.logoCubeBadge}>
            <Feather name="box" size={36} color="#ffffff" />
          </View>
          <Text style={styles.appTitle}>EduStock</Text>
          <Text style={styles.appSubtitle}>
            Mobile Inventory Management & Monitoring{'\n'}Sistem
          </Text>
        </View>

        {/* Card Formulir Login */}
        <View style={styles.loginCard}>
          <Text style={styles.cardHeaderTitle}>Masuk ke Akun</Text>
          <Text style={styles.cardHeaderSubtitle}>
            Gunakan kredensial yang terdaftar untuk mengakses token & data inventory
          </Text>

          {/* Pesan Error Dinamis (Reaktif berdasarkan state errorMessage) */}
          {errorMessage ? (
            <View style={styles.errorBanner}>
              <Feather name="alert-circle" size={16} color="#dc2626" />
              <Text style={styles.errorBannerText}>{errorMessage}</Text>
            </View>
          ) : null}

          {/* Input Username (Controlled Component via useState) */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Username atau Email</Text>
            <View style={styles.inputWrapper}>
              <Feather name="user" size={18} color="#94a3b8" style={styles.inputIcon} />
              <TextInput
                style={styles.textInput}
                placeholder="admin / staff / manager..."
                placeholderTextColor="#94a3b8"
                value={usernameInput}
                onChangeText={(val) => {
                  setUsernameInput(val);
                  if (errorMessage) setErrorMessage(null);
                }}
                autoCapitalize="none"
              />
            </View>
          </View>

          {/* Input Password (Controlled Component via useState & toggle showPassword) */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Password</Text>
            <View style={styles.inputWrapper}>
              <Feather name="lock" size={18} color="#94a3b8" style={styles.inputIcon} />
              <TextInput
                style={styles.textInput}
                placeholder="password123"
                placeholderTextColor="#94a3b8"
                secureTextEntry={!showPassword}
                value={passwordInput}
                onChangeText={(val) => {
                  setPasswordInput(val);
                  if (errorMessage) setErrorMessage(null);
                }}
              />
              <TouchableOpacity
                onPress={() => setShowPassword((prev) => !prev)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Feather
                  name={showPassword ? 'eye-off' : 'eye'}
                  size={18}
                  color="#64748b"
                />
              </TouchableOpacity>
            </View>
          </View>

          {/* Tombol Submit Login */}
          <TouchableOpacity
            style={[styles.loginButton, isLoading && { opacity: 0.7 }]}
            activeOpacity={0.8}
            onPress={() => handleLogin()}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="#ffffff" size="small" />
            ) : (
              <>
                <Text style={styles.loginButtonText}>Masuk & Buka Dashboard</Text>
                <Feather name="arrow-right" size={18} color="#ffffff" />
              </>
            )}
          </TouchableOpacity>

          {/* Petunjuk Kredensial Data */}
          <View style={styles.credentialHintBox}>
            <Text style={styles.credentialHintTitle}>
              Kredensial Data Akun (Password: password123):
            </Text>
            <Text style={styles.credentialHintText}>• admin (Admin Gudang)</Text>
            <Text style={styles.credentialHintText}>• staff (Staff Inventory)</Text>
            <Text style={styles.credentialHintText}>• manager (Pemilik Toko / Manajer)</Text>
          </View>

          {/* Tombol Akses Cepat Demo (Otomatis Generate Token) */}
          <View style={styles.demoSection}>
            <Text style={styles.demoLabel}>Pilih Akun Cepat (Generate Token Otomatis):</Text>
            <View style={styles.demoButtonsRow}>
              <TouchableOpacity
                style={styles.demoPill}
                onPress={() => handleLogin('admin')}
                disabled={isLoading}
              >
                <Text style={styles.demoPillText}>Admin Gudang</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.demoPill}
                onPress={() => handleLogin('staff')}
                disabled={isLoading}
              >
                <Text style={styles.demoPillText}>Staff Inventory</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.demoPill}
                onPress={() => handleLogin('manager')}
                disabled={isLoading}
              >
                <Text style={styles.demoPillText}>Manajer</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Footer Info API & Modul */}
        <Text style={styles.apiFooterText}>
          Terhubung ke API & Token Provider: EduStock Auth Core
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

// ==========================================
// STYLESHEET (Login Screen)
// ==========================================
const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f8fafc',
    paddingTop: Platform.OS === 'android' ? RNStatusBar.currentHeight : 0,
  },
  loginContainer: {
    paddingHorizontal: 20,
    paddingBottom: 28,
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
    marginBottom: 20,
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
    marginBottom: 16,
    lineHeight: 16,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca',
    borderRadius: 10,
    padding: 10,
    marginBottom: 14,
  },
  errorBannerText: {
    flex: 1,
    color: '#b91c1c',
    fontSize: 12,
    fontWeight: '600',
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
  credentialHintBox: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    padding: 10,
    marginTop: 14,
  },
  credentialHintTitle: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#475569',
    marginBottom: 4,
  },
  credentialHintText: {
    fontSize: 10,
    color: '#64748b',
    lineHeight: 14,
  },
  demoSection: {
    marginTop: 14,
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
    marginTop: 20,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
});
