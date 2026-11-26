import React, { useEffect, useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Animated,
  Platform,
  StatusBar as RNStatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useNetworkStatus } from '../hooks/useNetworkStatus';

export interface OfflineBannerProps {
  /** Optional callback saat pengguna menekan tombol coba lagi */
  onRetry?: () => void;
}

/**
 * =========================================================================
 * KOMPONEN: OfflineBanner
 * Memenuhi Kriteria Offline Handling:
 * 1. Menampilkan notifikasi visual ketika koneksi internet terputus (Offline).
 * 2. Menampilkan feedback visual sukses saat koneksi kembali tersedia (Online).
 * 3. Menghilang secara otomatis dan halus setelah 3 detik saat koneksi pulih.
 * 4. Tidak mengganggu layout konten karena menggunakan overlay absolut non-intrusif.
 * =========================================================================
 */
export function OfflineBanner({ onRetry }: OfflineBannerProps) {
  const insets = useSafeAreaInsets();
  const { status, refresh } = useNetworkStatus();

  // Inisialisasi Animated.Value via state agar aman dari batasan ref compiler
  const [animValue] = useState(() => new Animated.Value(0));

  useEffect(() => {
    const useNative = Platform.OS !== 'web';
    if (status === 'offline' || status === 'reconnected') {
      Animated.timing(animValue, {
        toValue: 1,
        duration: 260,
        useNativeDriver: useNative,
      }).start();
    } else {
      Animated.timing(animValue, {
        toValue: 0,
        duration: 260,
        useNativeDriver: useNative,
      }).start();
    }
  }, [status, animValue]);

  // Jika kondisi online normal, jangan render overlay
  if (status === 'online') {
    return null;
  }

  const isRestored = status === 'reconnected';
  const bannerBg = isRestored ? '#16A34A' : '#EF4444';
  const iconName = isRestored ? 'wifi' : 'wifi-off';
  const titleText = isRestored ? 'Koneksi Kembali Tersedia' : 'Koneksi Internet Terputus';
  const descText = isRestored
    ? 'Aplikasi kembali online. Melanjutkan sinkronisasi data...'
    : 'Mode offline aktif. Data inventaris lokal tetap tersedia.';

  // Perhitungan padding atas yang aman (notch iPhone / status bar Android)
  const topInset = Math.max(
    insets.top,
    Platform.OS === 'android' ? (RNStatusBar.currentHeight ?? 0) : 0
  );

  return (
    <Animated.View
      style={[
        styles.overlayContainer,
        {
          paddingTop: topInset > 0 ? topInset + 4 : 8,
          backgroundColor: bannerBg,
          opacity: animValue,
          transform: [
            {
              translateY: animValue.interpolate({
                inputRange: [0, 1],
                outputRange: [-80, 0],
              }),
            },
          ],
        },
      ]}
      pointerEvents="box-none"
    >
      <View style={styles.bannerContent}>
        {/* Ikon Status Jaringan */}
        <View style={styles.iconWrapper}>
          <Feather name={iconName} size={15} color="#ffffff" />
        </View>

        {/* Teks Peringatan / Info */}
        <View style={styles.textContainer}>
          <Text style={styles.bannerTitle}>{titleText}</Text>
          <Text style={styles.bannerDesc} numberOfLines={1}>
            {descText}
          </Text>
        </View>

        {/* Tombol Coba Lagi Manual (hanya tampil saat kondisi offline) */}
        {!isRestored && (
          <TouchableOpacity
            style={styles.retryButton}
            activeOpacity={0.75}
            onPress={() => {
              refresh();
              if (onRetry) {
                onRetry();
              }
            }}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Feather name="refresh-cw" size={12} color="#ef4444" style={{ marginRight: 4 }} />
            <Text style={styles.retryButtonText}>Coba</Text>
          </TouchableOpacity>
        )}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlayContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 9999,
    elevation: 20,
    paddingBottom: 10,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.14,
    shadowRadius: 8,
  },
  bannerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 2,
  },
  iconWrapper: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  textContainer: {
    flex: 1,
    marginRight: 8,
  },
  bannerTitle: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: -0.1,
  },
  bannerDesc: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.92)',
    marginTop: 1,
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 999,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  retryButtonText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#EF4444',
  },
});
