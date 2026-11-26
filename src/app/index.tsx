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
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';

import { UI, cardShadow, primaryButtonShadow } from '../constants/uiTokens';
import { SoftBlueBackdrop, PrimaryGradientButton } from '../components/SoftBlueUI';
import { showAppAlert } from '../utils/feedback';

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
  const [usernameInput, setUsernameInput] = useState<string>('');
  const [passwordInput, setPasswordInput] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [focusedField, setFocusedField] = useState<'username' | 'password' | null>(null);

  useEffect(() => {
    async function loadLastSavedUser() {
      try {
        const savedSession = await getSavedSession();
        if (savedSession?.user?.username) {
          setUsernameInput(savedSession.user.username);
        }
      } catch (err) {
        console.warn('Gagal memuat sesi sebelumnya:', err);
      }
    }

    loadLastSavedUser();
  }, []);

  const handleLogin = async (roleKey?: 'admin' | 'staff' | 'manager') => {
    setErrorMessage(null);
    setIsLoading(true);

    try {
      if (roleKey) {
        await loginAsDemo(roleKey);
        router.replace('/dashboard');
      } else {
        if (!usernameInput.trim() || !passwordInput.trim()) {
          setErrorMessage('Silakan isi username dan password Anda terlebih dahulu.');
          setIsLoading(false);
          return;
        }

        const result = await authenticateUser(usernameInput, passwordInput);

        if (result.success && result.session) {
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
    <SoftBlueBackdrop>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView
          contentContainerStyle={styles.loginContainer}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header Mini */}
          <View style={styles.topUtilityRow}>
            <TouchableOpacity
              style={styles.infoIconBtn}
              activeOpacity={0.75}
              onPress={() =>
                showAppAlert(
                  'Informasi Modul 2',
                  'Aplikasi EduStock (Inventory Management)\nModul 2: State, Hooks & Navigasi Page'
                )
              }
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
            <Text style={styles.appSubtitle}>Inventory Management</Text>
          </View>

          {/* Form Login Compact Tanpa Card Besar */}
          <View style={styles.formContainer}>
            <Text style={styles.formHeaderTitle}>Masuk ke Akun</Text>
            <Text style={styles.formHeaderSubtitle}>
              Kelola inventaris dengan lebih mudah
            </Text>

            {errorMessage ? (
              <View style={styles.errorBanner}>
                <Feather name="alert-circle" size={15} color={UI.colors.dangerDark} />
                <Text style={styles.errorBannerText}>{errorMessage}</Text>
              </View>
            ) : null}

            {/* Input Username */}
            <View
              style={[
                styles.inputWrapper,
                focusedField === 'username' && styles.inputWrapperFocused,
              ]}
            >
              <Feather
                name="user"
                size={16}
                color={focusedField === 'username' ? UI.colors.primary : UI.colors.muted}
                style={styles.inputIcon}
              />
              <TextInput
                style={styles.textInput}
                placeholder="Email atau Username"
                placeholderTextColor={UI.colors.muted}
                value={usernameInput}
                onFocus={() => setFocusedField('username')}
                onBlur={() => setFocusedField(null)}
                onChangeText={(val) => {
                  setUsernameInput(val);
                  if (errorMessage) setErrorMessage(null);
                }}
                autoCapitalize="none"
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
                placeholder="Password"
                placeholderTextColor={UI.colors.muted}
                secureTextEntry={!showPassword}
                value={passwordInput}
                onFocus={() => setFocusedField('password')}
                onBlur={() => setFocusedField(null)}
                onChangeText={(val) => {
                  setPasswordInput(val);
                  if (errorMessage) setErrorMessage(null);
                }}
                onSubmitEditing={() => handleLogin()}
                returnKeyType="done"
              />
              <TouchableOpacity
                onPress={() => setShowPassword((prev) => !prev)}
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
              label="Masuk"
              disabled={isLoading}
              onPress={() => handleLogin()}
              loadingNode={
                isLoading ? <ActivityIndicator color="#FFFFFF" size="small" /> : undefined
              }
              iconRight={<Feather name="arrow-right" size={16} color="#FFFFFF" />}
              style={styles.loginButton}
            />

            {/* Akun Cepat (Demo) - Kecil, Rapi & Sejajar */}
            <Text style={styles.demoLabel}>Akun Cepat (Demo)</Text>
            <View style={styles.demoButtonsRow}>
              <TouchableOpacity
                style={styles.demoChip}
                activeOpacity={0.78}
                onPress={() => handleLogin('admin')}
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
                onPress={() => handleLogin('staff')}
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
                onPress={() => handleLogin('manager')}
                disabled={isLoading}
              >
                <View style={styles.demoChipIconBox}>
                  <Feather name="briefcase" size={15} color={UI.colors.primary} />
                </View>
                <Text style={styles.demoChipText}>Manajer</Text>
              </TouchableOpacity>
            </View>

            {/* Hint Ringkas */}
            <Text style={styles.credentialHint}>
              Manual: admin / staff / manager • Pass: password123
            </Text>
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
    justifyContent: 'flex-end',
    marginBottom: 8,
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
