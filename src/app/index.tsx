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
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';

import { UI, cardShadow, primaryButtonShadow } from '../constants/uiTokens';
import { SoftBlueBackdrop, PrimaryGradientButton } from '../components/SoftBlueUI';
import { showAppAlert } from '../utils/feedback';
import { useAuth } from '../contexts/AuthContext';
import { getSupabaseConfigStatus } from '../lib/supabase';
import { UserRole } from '../types';

const ROLE_OPTIONS: { label: string; value: UserRole }[] = [
  { label: 'Admin Gudang', value: 'Admin Gudang' },
  { label: 'Staff Inventory', value: 'Staff Inventory' },
  { label: 'Manajer', value: 'Pemilik Toko / Manajer' },
];

/**
 * =========================================================================
 * HALAMAN 1: LOGIN & REGISTRASI SUPABASE (src/app/index.tsx)
 * Modul 2 + Modul 4 (Supabase Auth, SecureStore, Validasi UX):
 * 1. Dual flow: Masuk (signInWithPassword) & Daftar Akun (signUp + metadata)
 * 2. Validasi input: .trim(), keyboardType="email-address", autoCapitalize="none", autoCorrect={false}
 * 3. Loading state & proteksi multiple submission
 * =========================================================================
 */
export default function LoginScreen() {
  const { signIn, signUp, signInLegacy, signInDemo, isSupabaseReady } = useAuth();

  const [isRegistering, setIsRegistering] = useState<boolean>(false);
  const [nameInput, setNameInput] = useState<string>('');
  const [roleInput, setRoleInput] = useState<UserRole>('Admin Gudang');
  const [emailInput, setEmailInput] = useState<string>('');
  const [passwordInput, setPasswordInput] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [focusedField, setFocusedField] = useState<'name' | 'email' | 'password' | null>(null);

  const toggleAuthMode = () => {
    if (isLoading) return;
    setIsRegistering((prev) => !prev);
    setErrorMessage(null);
    setSuccessMessage(null);
  };

  const handleAuth = async (demoRoleKey?: 'admin' | 'staff' | 'manager') => {
    if (isLoading) return;
    setErrorMessage(null);
    setSuccessMessage(null);
    setIsLoading(true);

    try {
      if (demoRoleKey) {
        await signInDemo(demoRoleKey);
        router.replace('/dashboard');
        return;
      }

      const cleanEmail = emailInput.trim();

      if (isRegistering) {
        const cleanName = nameInput.trim();
        if (!cleanName || !cleanEmail || !passwordInput) {
          setErrorMessage('Nama lengkap, email, dan password wajib diisi.');
          return;
        }
        if (!cleanEmail.includes('@')) {
          setErrorMessage('Masukkan format alamat email yang valid.');
          return;
        }
        if (passwordInput.length < 6) {
          setErrorMessage('Kata sandi minimal 6 karakter.');
          return;
        }

        const result = await signUp({
          email: cleanEmail,
          password: passwordInput,
          name: cleanName,
          role: roleInput,
        });

        if (!result.success) {
          setErrorMessage(result.message || 'Pendaftaran gagal.');
          return;
        }

        if (result.needsEmailConfirmation) {
          setSuccessMessage(result.message);
          setIsRegistering(false);
        } else {
          setSuccessMessage(result.message);
          router.replace('/dashboard');
        }
        return;
      }

      // Mode Masuk (Login)
      if (!cleanEmail || !passwordInput.trim()) {
        setErrorMessage('Silakan isi email dan password Anda terlebih dahulu.');
        return;
      }

      if (cleanEmail.includes('@')) {
        const result = await signIn(cleanEmail, passwordInput);
        if (result.success && result.session) {
          router.replace('/dashboard');
        } else {
          setErrorMessage(result.message || 'Kredensial login tidak valid.');
        }
      } else {
        // Fallback kompatibilitas akun lokal Modul 1-3 (admin/staff/manager)
        const result = await signInLegacy(cleanEmail, passwordInput);
        if (result.success && result.session) {
          router.replace('/dashboard');
        } else {
          setErrorMessage(
            isSupabaseReady
              ? 'Gunakan email terdaftar untuk login Supabase, atau username demo (admin/staff/manager).'
              : result.message || 'Kredensial tidak valid.'
          );
        }
      }
    } catch (error: any) {
      setErrorMessage(error?.message || 'Terjadi kesalahan pada sistem autentikasi.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SoftBlueBackdrop>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView
          contentContainerStyle={styles.loginContainer}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header Mini */}
          <View style={styles.topUtilityRow}>
            <View
              style={[
                styles.cloudStatusPill,
                !isSupabaseReady && styles.cloudStatusPillWarn,
              ]}
            >
              <View
                style={[
                  styles.cloudDot,
                  { backgroundColor: isSupabaseReady ? UI.colors.success : UI.colors.warning },
                ]}
              />
              <Text style={styles.cloudStatusText}>
                {isSupabaseReady ? 'Supabase Cloud Siap' : 'Env Supabase Belum Diisi'}
              </Text>
            </View>

            <TouchableOpacity
              style={styles.infoIconBtn}
              activeOpacity={0.75}
              onPress={() => {
                const { configured, url } = getSupabaseConfigStatus();
                showAppAlert(
                  'Health Check & Info Modul 4',
                  `Aplikasi EduStock (Inventory Management)\n` +
                    `Storage: Expo SecureStore\n` +
                    `Supabase Status: ${configured ? 'Terhubung (.env aktif)' : 'Belum dikonfigurasi di .env'}\n` +
                    `Supabase URL: ${url || '(belum diisi di .env)'}`
                );
              }}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Feather name="info" size={16} color={UI.colors.primary} />
            </TouchableOpacity>
          </View>

          {/* Logo & Branding Asli EduStock */}
          <View style={styles.logoSection}>
            <View style={styles.logoCubeBadge}>
              <Feather name="box" size={28} color="#FFFFFF" />
            </View>
            <Text style={styles.appTitle}>EduStock</Text>
            <Text style={styles.appSubtitle}>Cloud Inventory & Auth</Text>
          </View>

          {/* Form Login / Register */}
          <View style={styles.formContainer}>
            <Text style={styles.formHeaderTitle}>
              {isRegistering ? 'Daftar Akun Baru' : 'Masuk ke Akun'}
            </Text>
            <Text style={styles.formHeaderSubtitle}>
              {isRegistering
                ? 'Buat akun Supabase untuk menyimpan inventaris ke cloud'
                : 'Kelola inventaris secara real-time dengan aman'}
            </Text>

            {!isSupabaseReady ? (
              <View style={styles.warningBanner}>
                <Feather name="alert-triangle" size={15} color={UI.colors.warningDark} />
                <Text style={styles.warningBannerText}>
                  Isi EXPO_PUBLIC_SUPABASE_URL & EXPO_PUBLIC_SUPABASE_ANON_KEY di file .env lalu restart Expo.
                </Text>
              </View>
            ) : null}

            {errorMessage ? (
              <View style={styles.errorBanner}>
                <Feather name="alert-circle" size={15} color={UI.colors.dangerDark} />
                <Text style={styles.errorBannerText}>{errorMessage}</Text>
              </View>
            ) : null}

            {successMessage ? (
              <View style={styles.successBanner}>
                <Feather name="check-circle" size={15} color={UI.colors.success} />
                <Text style={styles.successBannerText}>{successMessage}</Text>
              </View>
            ) : null}

            {isRegistering ? (
              <>
                {/* Input Nama Lengkap (Metadata Supabase) */}
                <View
                  style={[
                    styles.inputWrapper,
                    focusedField === 'name' && styles.inputWrapperFocused,
                  ]}
                >
                  <Feather
                    name="user"
                    size={16}
                    color={focusedField === 'name' ? UI.colors.primary : UI.colors.muted}
                    style={styles.inputIcon}
                  />
                  <TextInput
                    style={styles.textInput}
                    placeholder="Nama Lengkap / Callsign"
                    placeholderTextColor={UI.colors.muted}
                    value={nameInput}
                    editable={!isLoading}
                    onFocus={() => setFocusedField('name')}
                    onBlur={() => setFocusedField(null)}
                    onChangeText={(val) => {
                      setNameInput(val);
                      if (errorMessage) setErrorMessage(null);
                    }}
                    autoCapitalize="words"
                    returnKeyType="next"
                  />
                </View>

                {/* Pilihan Role Akun */}
                <Text style={styles.roleLabel}>Peran Akun (Metadata):</Text>
                <View style={styles.roleRow}>
                  {ROLE_OPTIONS.map((opt) => {
                    const active = roleInput === opt.value;
                    return (
                      <TouchableOpacity
                        key={opt.value}
                        style={[styles.roleChip, active && styles.roleChipActive]}
                        activeOpacity={0.8}
                        disabled={isLoading}
                        onPress={() => setRoleInput(opt.value)}
                      >
                        <Text
                          style={[
                            styles.roleChipText,
                            active && styles.roleChipTextActive,
                          ]}
                          numberOfLines={1}
                        >
                          {opt.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </>
            ) : null}

            {/* Input Email */}
            <View
              style={[
                styles.inputWrapper,
                focusedField === 'email' && styles.inputWrapperFocused,
              ]}
            >
              <Feather
                name="mail"
                size={16}
                color={focusedField === 'email' ? UI.colors.primary : UI.colors.muted}
                style={styles.inputIcon}
              />
              <TextInput
                style={styles.textInput}
                placeholder={isRegistering ? 'Email (mis. nama@edustock.com)' : 'Email Supabase atau Username'}
                placeholderTextColor={UI.colors.muted}
                value={emailInput}
                editable={!isLoading}
                onFocus={() => setFocusedField('email')}
                onBlur={() => setFocusedField(null)}
                onChangeText={(val) => {
                  setEmailInput(val);
                  if (errorMessage) setErrorMessage(null);
                }}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="next"
              />
            </View>

            {/* Input Password */}
            <View
              style={[
                styles.inputWrapper,
                focusedField === 'password' && styles.inputWrapperFocused,
              ]}
            >
              <Feather
                name="lock"
                size={16}
                color={focusedField === 'password' ? UI.colors.primary : UI.colors.muted}
                style={styles.inputIcon}
              />
              <TextInput
                style={styles.textInput}
                placeholder={isRegistering ? 'Password (min. 6 karakter)' : 'Password'}
                placeholderTextColor={UI.colors.muted}
                secureTextEntry={!showPassword}
                value={passwordInput}
                editable={!isLoading}
                onFocus={() => setFocusedField('password')}
                onBlur={() => setFocusedField(null)}
                onChangeText={(val) => {
                  setPasswordInput(val);
                  if (errorMessage) setErrorMessage(null);
                }}
                onSubmitEditing={() => handleAuth()}
                returnKeyType="done"
              />
              <TouchableOpacity
                onPress={() => setShowPassword((prev) => !prev)}
                disabled={isLoading}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Feather
                  name={showPassword ? 'eye-off' : 'eye'}
                  size={16}
                  color={UI.colors.secondary}
                />
              </TouchableOpacity>
            </View>

            {/* Tombol Utama Gradient Biru */}
            <PrimaryGradientButton
              label={isRegistering ? 'Daftar Akun' : 'Masuk'}
              disabled={isLoading}
              onPress={() => handleAuth()}
              loadingNode={
                isLoading ? <ActivityIndicator color="#FFFFFF" size="small" /> : undefined
              }
              iconRight={<Feather name="arrow-right" size={16} color="#FFFFFF" />}
              style={styles.loginButton}
            />

            {/* Tombol Pindah Mode Masuk <-> Daftar */}
            <TouchableOpacity
              style={styles.switchModeBtn}
              activeOpacity={0.75}
              disabled={isLoading}
              onPress={toggleAuthMode}
            >
              <Text style={styles.switchModeText}>
                {isRegistering ? 'Sudah punya akun? ' : 'Belum punya akun? '}
                <Text style={styles.switchModeLink}>
                  {isRegistering ? 'Masuk di sini' : 'Daftar di sini'}
                </Text>
              </Text>
            </TouchableOpacity>

            {/* Akun Cepat (Demo Lokal Modul 1-3) */}
            <Text style={styles.demoLabel}>Mode Demo Lokal (Simulasi RBAC)</Text>
            <View style={styles.demoButtonsRow}>
              <TouchableOpacity
                style={styles.demoChip}
                activeOpacity={0.78}
                onPress={() => handleAuth('admin')}
                disabled={isLoading}
              >
                <View style={styles.demoChipIconBox}>
                  <Feather name="shield" size={15} color={UI.colors.primary} />
                </View>
                <Text style={styles.demoChipText}>Admin</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.demoChip}
                activeOpacity={0.78}
                onPress={() => handleAuth('staff')}
                disabled={isLoading}
              >
                <View style={styles.demoChipIconBox}>
                  <Feather name="users" size={15} color={UI.colors.primary} />
                </View>
                <Text style={styles.demoChipText}>Staff</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.demoChip}
                activeOpacity={0.78}
                onPress={() => handleAuth('manager')}
                disabled={isLoading}
              >
                <View style={styles.demoChipIconBox}>
                  <Feather name="briefcase" size={15} color={UI.colors.primary} />
                </View>
                <Text style={styles.demoChipText}>Manajer</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
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
  loginContainer: {
    flexGrow: 1,
    paddingHorizontal: 22,
    paddingTop: 8,
    paddingBottom: 24,
    justifyContent: 'center',
  },
  topUtilityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  cloudStatusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.88)',
    borderWidth: 1,
    borderColor: UI.colors.successBorder,
    borderRadius: UI.radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  cloudStatusPillWarn: {
    borderColor: UI.colors.warningBorder,
  },
  cloudDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  cloudStatusText: {
    fontSize: 11,
    fontWeight: '700',
    color: UI.colors.textBody,
  },
  infoIconBtn: {
    width: 34,
    height: 34,
    borderRadius: 11,
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
    borderWidth: 1,
    borderColor: UI.colors.borderSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoSection: {
    alignItems: 'center',
    marginBottom: 22,
  },
  logoCubeBadge: {
    width: 58,
    height: 58,
    borderRadius: 18,
    backgroundColor: UI.colors.primary,
    backgroundImage: UI.gradients.logoBox,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
    ...primaryButtonShadow,
  },
  appTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: UI.colors.text,
    letterSpacing: -0.6,
  },
  appSubtitle: {
    fontSize: 12.5,
    fontWeight: '600',
    color: UI.colors.secondary,
    marginTop: 2,
  },
  formContainer: {
    width: '100%',
    maxWidth: 420,
    alignSelf: 'center',
  },
  formHeaderTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: UI.colors.text,
    letterSpacing: -0.3,
  },
  formHeaderSubtitle: {
    fontSize: 12.5,
    color: UI.colors.secondary,
    marginTop: 2,
    marginBottom: 16,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: UI.colors.dangerBg,
    borderWidth: 1,
    borderColor: UI.colors.dangerBorder,
    borderRadius: UI.radius.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
  },
  errorBannerText: {
    flex: 1,
    color: UI.colors.dangerDark,
    fontSize: 12,
    fontWeight: '600',
  },
  warningBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: UI.colors.warningBg,
    borderWidth: 1,
    borderColor: UI.colors.warningBorder,
    borderRadius: UI.radius.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
  },
  warningBannerText: {
    flex: 1,
    color: UI.colors.warningDark,
    fontSize: 11.5,
    fontWeight: '600',
  },
  successBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: UI.colors.successBg,
    borderWidth: 1,
    borderColor: UI.colors.successBorder,
    borderRadius: UI.radius.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
  },
  successBannerText: {
    flex: 1,
    color: UI.colors.success,
    fontSize: 12,
    fontWeight: '600',
  },
  roleLabel: {
    fontSize: 11.5,
    fontWeight: '700',
    color: UI.colors.secondary,
    marginBottom: 6,
  },
  roleRow: {
    flexDirection: 'row',
    gap: 7,
    marginBottom: 11,
  },
  roleChip: {
    flex: 1,
    backgroundColor: UI.colors.surface,
    borderWidth: 1,
    borderColor: UI.colors.borderSoft,
    borderRadius: UI.radius.sm,
    paddingVertical: 8,
    paddingHorizontal: 6,
    alignItems: 'center',
  },
  roleChipActive: {
    backgroundColor: UI.colors.primaryLight,
    borderColor: UI.colors.primary,
  },
  roleChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: UI.colors.secondary,
  },
  roleChipTextActive: {
    color: UI.colors.primary,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: UI.colors.surface,
    borderWidth: 1,
    borderColor: UI.colors.borderSoft,
    borderRadius: UI.radius.md,
    paddingHorizontal: 13,
    height: 46,
    marginBottom: 11,
    ...cardShadow,
  },
  inputWrapperFocused: {
    borderColor: UI.colors.primary,
  },
  inputIcon: {
    marginRight: 10,
  },
  textInput: {
    flex: 1,
    fontSize: 13.5,
    color: UI.colors.text,
  },
  loginButton: {
    marginTop: 4,
    height: 46,
  },
  switchModeBtn: {
    marginTop: 14,
    alignItems: 'center',
    paddingVertical: 4,
  },
  switchModeText: {
    fontSize: 12.5,
    fontWeight: '600',
    color: UI.colors.secondary,
  },
  switchModeLink: {
    color: UI.colors.primary,
    fontWeight: '800',
  },
  demoLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: UI.colors.secondary,
    textAlign: 'center',
    marginTop: 20,
    marginBottom: 10,
  },
  demoButtonsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  demoChip: {
    flex: 1,
    backgroundColor: UI.colors.surface,
    borderWidth: 1,
    borderColor: UI.colors.borderSoft,
    borderRadius: UI.radius.md,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    ...cardShadow,
  },
  demoChipIconBox: {
    width: 30,
    height: 30,
    borderRadius: 10,
    backgroundColor: UI.colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  demoChipText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: UI.colors.text,
  },
  credentialHint: {
    fontSize: 11,
    color: UI.colors.muted,
    textAlign: 'center',
    marginTop: 14,
  },
});
