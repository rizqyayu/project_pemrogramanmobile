import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Platform,
  StatusBar as RNStatusBar,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as Location from 'expo-location';
import { WebView } from 'react-native-webview';

import { UI, cardShadow, primaryButtonShadow } from '../constants/uiTokens';
import {
  SoftBlueBackdrop,
  PrimaryGradientButton,
  SecondaryOutlineButton,
} from '../components/SoftBlueUI';
import { AccessDeniedView } from '../components/AccessDeniedView';
import { showAppAlert } from '../utils/feedback';

import { AuthSession } from '../types';
import { getSavedSession } from '../services/authService';
import { authorizeAction, hasPermission } from '../services/rbacService';
import {
  getStoreSnapshot,
  recordPresensiGudang,
  subscribeInventoryStore,
  updateWarehouseConfig,
} from '../services/inventoryStore';

/**
 * =========================================================================
 * TASK 03 - LOCATION INTELLIGENCE & RBAC PRESENSI GUDANG (src/app/lokasi.tsx)
 * 7 Kemampuan Maps dipertahankan penuh:
 * 1. GPS, 2. Koordinat, 3. Peta Interaktif, 4. Marker, 5. Reverse Geocoding,
 * 6. Geofencing, 7. Optimasi Baterai (interval 2s / 1m)
 *
 * Pembatasan RBAC:
 * - Admin Gudang: Kelola radius geofence, edit alamat gudang, simulasi, GPS, presensi
 * - Staff Inventory: Deteksi GPS, Live Tracking, Presensi Gudang (tanpa ubah setting gudang)
 * - Manajer Operasional: Monitoring lokasi gudang & daftar presensi staff (read-only)
 * =========================================================================
 */

const OUTSIDE_LOCATION = {
  name: 'Luar Area Gudang (Seberang Kampus)',
  latitude: -7.92235,
  longitude: 112.59885,
  defaultAddress: 'Jl. Raya Tlogomas No.180, Lowokwaru, Kota Malang, Jawa Timur 65144',
};

function calculateDistanceInMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371e3;
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return Math.round(R * c);
}

export default function LokasiScreen() {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [sessionLoaded, setSessionLoaded] = useState<boolean>(false);
  const [storeSnapshot, setStoreSnapshot] = useState(() => getStoreSnapshot());

  const { warehouseConfig, presensiLogs } = storeSnapshot;

  const [coords, setCoords] = useState<{ latitude: number; longitude: number }>({
    latitude: warehouseConfig.latitude,
    longitude: warehouseConfig.longitude,
  });

  const [currentAddress, setCurrentAddress] = useState<string>(warehouseConfig.alamat_gudang);
  const [isGeocodingLoading, setIsGeocodingLoading] = useState<boolean>(false);

  const [geofenceRadius, setGeofenceRadius] = useState<number>(warehouseConfig.radius_geofence);
  const [showGeofenceBanner, setShowGeofenceBanner] = useState<boolean>(true);
  const [isRealGPSActive, setIsRealGPSActive] = useState<boolean>(false);

  const [isLiveTracking, setIsLiveTracking] = useState<boolean>(false);
  const watchSubscriptionRef = useRef<Location.LocationSubscription | null>(null);

  const [customAddressInput, setCustomAddressInput] = useState<string>('');
  const [isSearchingAddress, setIsSearchingAddress] = useState<boolean>(false);
  const [isEditingAddressManual, setIsEditingAddressManual] = useState<boolean>(false);
  const [manualAddressDraft, setManualAddressDraft] = useState<string>('');

  const [mapViewType, setMapViewType] = useState<'street' | 'satellite'>('street');
  const [mapZoom, setMapZoom] = useState<number>(17);

  useEffect(() => {
    let active = true;
    getSavedSession()
      .then((saved) => {
        if (active) {
          setSession(saved);
          setSessionLoaded(true);
        }
      })
      .catch(() => {
        if (active) setSessionLoaded(true);
      });

    const unsub = subscribeInventoryStore(() => {
      const snap = getStoreSnapshot();
      setStoreSnapshot(snap);
      setGeofenceRadius(snap.warehouseConfig.radius_geofence);
    });

    return () => {
      active = false;
      unsub();
    };
  }, []);

  const canAdminGeofence = hasPermission(session, 'location:geofence_admin');
  const canPresensi = hasPermission(session, 'location:presensi');
  const canMonitorStaff = hasPermission(session, 'staff:monitor');

  const googleMapsEmbedUrl = useMemo(() => {
    const lat = coords.latitude;
    const lng = coords.longitude;
    const mapTypeParam = mapViewType === 'satellite' ? 'k' : 'm';
    return `https://maps.google.com/maps?q=${lat},${lng}&hl=id&t=${mapTypeParam}&z=${mapZoom}&output=embed`;
  }, [coords.latitude, coords.longitude, mapViewType, mapZoom]);

  const distanceToGeofence = useMemo(() => {
    return calculateDistanceInMeters(
      coords.latitude,
      coords.longitude,
      warehouseConfig.latitude,
      warehouseConfig.longitude
    );
  }, [coords.latitude, coords.longitude, warehouseConfig.latitude, warehouseConfig.longitude]);

  const isInsideGeofence = distanceToGeofence <= geofenceRadius;

  // REVERSE GEOCODING
  useEffect(() => {
    let isMounted = true;

    Location.reverseGeocodeAsync({
      latitude: coords.latitude,
      longitude: coords.longitude,
    })
      .then((results) => {
        if (!isMounted) return;
        if (results && results.length > 0) {
          const item = results[0];
          const street = item.street ? `${item.street} ` : '';
          const streetNumber = item.streetNumber ? `No.${item.streetNumber}, ` : '';
          const district = item.district ? `${item.district}, ` : '';
          const city = item.city || item.subregion || '';
          const region = item.region ? `, ${item.region}` : '';
          const postalCode = item.postalCode ? ` ${item.postalCode}` : '';

          const fullFormatted = `${street}${streetNumber}${district}${city}${region}${postalCode}`.trim();
          setCurrentAddress(fullFormatted || warehouseConfig.alamat_gudang);
        } else {
          setCurrentAddress(
            Math.abs(coords.latitude - warehouseConfig.latitude) < 0.0008
              ? warehouseConfig.alamat_gudang
              : OUTSIDE_LOCATION.defaultAddress
          );
        }
      })
      .catch(() => {
        if (!isMounted) return;
        setCurrentAddress(
          Math.abs(coords.latitude - warehouseConfig.latitude) < 0.0008
            ? warehouseConfig.alamat_gudang
            : OUTSIDE_LOCATION.defaultAddress
        );
      })
      .finally(() => {
        if (isMounted) {
          setIsGeocodingLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [coords.latitude, coords.longitude, warehouseConfig.alamat_gudang, warehouseConfig.latitude]);

  // 1. GPS Perangkat Langsung
  const handleGetRealDeviceGPS = async () => {
    setIsGeocodingLoading(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        showAppAlert(
          'Izin Lokasi Diperlukan',
          'Aplikasi membutuhkan izin GPS perangkat untuk mendeteksi koordinat Anda secara real-time.'
        );
        setIsGeocodingLoading(false);
        return;
      }

      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      const newLat = position.coords.latitude;
      const newLng = position.coords.longitude;

      setCoords({ latitude: newLat, longitude: newLng });
      setIsRealGPSActive(true);
      showAppAlert(
        'GPS Asli Terhubung',
        `Koordinat diperoleh dari sensor perangkat:\nLatitude: ${newLat.toFixed(6)}\nLongitude: ${newLng.toFixed(6)}`
      );
    } catch {
      showAppAlert('Gagal Mengambil Lokasi', 'Pastikan layanan GPS perangkat Anda aktif.');
    } finally {
      setIsGeocodingLoading(false);
    }
  };

  // Presensi Gudang (Dilindungi RBAC location:presensi)
  const handlePresensiGudang = () => {
    const res = recordPresensiGudang(session, {
      jarak_meter: distanceToGeofence,
      dalam_area: isInsideGeofence,
      alamat: currentAddress,
      koordinat: `${coords.latitude.toFixed(6)}, ${coords.longitude.toFixed(6)}`,
    });

    if (!res.ok) {
      showAppAlert(`Ditolak (${res.statusCode})`, res.message);
      return;
    }

    showAppAlert('Presensi Tercatat', res.message);
  };

  // Handler Khusus Admin: Ubah Radius Geofence
  const handleChangeGeofenceRadius = (radius: number) => {
    const auth = authorizeAction(session, 'location:geofence_admin');
    if (!auth.allowed) {
      showAppAlert('Akses Ditolak (403)', auth.reason || 'Hanya Admin Gudang yang boleh mengubah radius geofence.');
      return;
    }
    setGeofenceRadius(radius);
    updateWarehouseConfig(session, { radius_geofence: radius });
  };

  // Handler Khusus Admin: Simulasi Area
  const handleSimulateInsideArea = () => {
    const auth = authorizeAction(session, 'location:geofence_admin');
    if (!auth.allowed) {
      showAppAlert('Akses Ditolak (403)', auth.reason || 'Simulasi lokasi hanya untuk Admin Gudang.');
      return;
    }
    setIsRealGPSActive(false);
    setShowGeofenceBanner(true);
    setCoords({
      latitude: warehouseConfig.latitude,
      longitude: warehouseConfig.longitude,
    });
  };

  const handleSimulateOutsideArea = () => {
    const auth = authorizeAction(session, 'location:geofence_admin');
    if (!auth.allowed) {
      showAppAlert('Akses Ditolak (403)', auth.reason || 'Simulasi lokasi hanya untuk Admin Gudang.');
      return;
    }
    setIsRealGPSActive(false);
    if (watchSubscriptionRef.current) {
      watchSubscriptionRef.current.remove();
      watchSubscriptionRef.current = null;
      setIsLiveTracking(false);
    }
    setCoords({
      latitude: OUTSIDE_LOCATION.latitude,
      longitude: OUTSIDE_LOCATION.longitude,
    });
  };

  // Live Tracking + Optimasi Baterai
  const toggleLiveTracking = async () => {
    if (isLiveTracking) {
      if (watchSubscriptionRef.current) {
        watchSubscriptionRef.current.remove();
        watchSubscriptionRef.current = null;
      }
      setIsLiveTracking(false);
      showAppAlert('Live Tracking Berhenti', 'Pelacakan GPS real-time telah dinonaktifkan.');
      return;
    }

    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        showAppAlert(
          'Izin Lokasi Diperlukan',
          'Aplikasi membutuhkan izin GPS perangkat untuk pelacakan real-time.'
        );
        return;
      }

      setIsGeocodingLoading(true);
      const sub = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          timeInterval: warehouseConfig.interval_gps_ms,
          distanceInterval: 1,
        },
        (location) => {
          setCoords({
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
          });
          setIsRealGPSActive(true);
          setIsGeocodingLoading(false);
        }
      );

      watchSubscriptionRef.current = sub;
      setIsLiveTracking(true);
      setIsRealGPSActive(true);
      showAppAlert(
        'Live Tracking Aktif',
        'Posisi Anda di peta dan jarak ke gudang terupdate otomatis (interval hemat baterai 2 detik / 1 meter).'
      );
    } catch {
      showAppAlert('Gagal Memulai Tracking', 'Pastikan layanan GPS perangkat Anda aktif.');
    } finally {
      setIsGeocodingLoading(false);
    }
  };

  useEffect(() => {
    return () => {
      if (watchSubscriptionRef.current) {
        watchSubscriptionRef.current.remove();
        watchSubscriptionRef.current = null;
      }
    };
  }, []);

  // Forward Geocoding (Admin Gudang)
  const handleSearchCustomAddress = async () => {
    const auth = authorizeAction(session, 'location:geofence_admin');
    if (!auth.allowed) {
      showAppAlert('Akses Ditolak (403)', auth.reason || 'Hanya Admin Gudang yang dapat mengubah pin alamat gudang.');
      return;
    }

    if (!customAddressInput.trim()) {
      showAppAlert('Alamat Kosong', 'Ketikkan nama jalan, gedung, atau kota yang ingin Anda cari.');
      return;
    }

    setIsSearchingAddress(true);
    setIsGeocodingLoading(true);
    try {
      const results = await Location.geocodeAsync(customAddressInput.trim());
      if (results && results.length > 0) {
        const { latitude, longitude } = results[0];
        setCoords({ latitude, longitude });
        setCurrentAddress(customAddressInput.trim());
        setIsRealGPSActive(false);
        if (isLiveTracking && watchSubscriptionRef.current) {
          watchSubscriptionRef.current.remove();
          watchSubscriptionRef.current = null;
          setIsLiveTracking(false);
        }
        showAppAlert(
          'Alamat Ditemukan',
          `Pin lokasi berhasil dipasang ke:\n"${customAddressInput.trim()}"\nKoordinat: Lat ${latitude.toFixed(6)}, Lng ${longitude.toFixed(6)}`
        );
      } else {
        setCurrentAddress(customAddressInput.trim());
        showAppAlert(
          'Alamat Diterapkan',
          `Alamat "${customAddressInput.trim()}" berhasil disimpan sebagai alamat gudang kustom.`
        );
      }
    } catch {
      setCurrentAddress(customAddressInput.trim());
      showAppAlert('Alamat Disimpan', `Alamat "${customAddressInput.trim()}" telah diterapkan.`);
    } finally {
      setIsSearchingAddress(false);
      setIsGeocodingLoading(false);
    }
  };

  const handleSaveManualAddress = () => {
    const auth = authorizeAction(session, 'location:geofence_admin');
    if (!auth.allowed) {
      showAppAlert('Akses Ditolak (403)', auth.reason || 'Hanya Admin Gudang yang boleh mengubah alamat gudang.');
      return;
    }
    if (manualAddressDraft.trim()) {
      setCurrentAddress(manualAddressDraft.trim());
      updateWarehouseConfig(session, { alamat_gudang: manualAddressDraft.trim() });
      setIsEditingAddressManual(false);
      showAppAlert('Berhasil', 'Alamat gudang berhasil diperbarui.');
    }
  };

  const handleOpenGoogleMaps = () => {
    const lat = coords.latitude;
    const lng = coords.longitude;
    const query = `${lat},${lng}`;
    const label = encodeURIComponent(currentAddress || warehouseConfig.nama_gudang);

    const url =
      Platform.select({
        ios: `maps:0,0?q=${label}@${lat},${lng}`,
        android: `geo:${lat},${lng}?q=${lat},${lng}(${label})`,
        default: `https://www.google.com/maps/search/?api=1&query=${query}`,
      }) || `https://www.google.com/maps/search/?api=1&query=${query}`;

    Linking.canOpenURL(url)
      .then((supported) => {
        if (supported) {
          return Linking.openURL(url);
        }
        return Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${query}`);
      })
      .catch(() => {
        Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${query}`);
      });
  };

  if (sessionLoaded && (!session || !authorizeAction(session, 'location:view').allowed)) {
    return (
      <SoftBlueBackdrop>
        <SafeAreaView style={styles.safeArea}>
          <AccessDeniedView
            title="Sesi Autentikasi Diperlukan"
            message="Silakan login terlebih dahulu untuk mengakses Lokasi & Presensi Gudang."
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
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            activeOpacity={0.75}
            onPress={() => router.back()}
          >
            <Feather name="arrow-left" size={19} color={UI.colors.text} />
          </TouchableOpacity>

          <View style={styles.headerTitleWrap}>
            <Text style={styles.headerBrandTitle}>Lokasi & Presensi Gudang</Text>
          </View>

          <View
            style={[
              styles.gpsStatusBadge,
              isRealGPSActive ? styles.gpsStatusBadgeReal : styles.gpsStatusBadgeSim,
            ]}
          >
            <View
              style={[
                styles.gpsDot,
                { backgroundColor: isRealGPSActive ? UI.colors.success : UI.colors.warning },
              ]}
            />
            <Text
              style={[
                styles.gpsStatusText,
                { color: isRealGPSActive ? UI.colors.success : UI.colors.warningDark },
              ]}
            >
              {isRealGPSActive ? 'Real GPS' : 'Simulasi'}
            </Text>
          </View>
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* HERO PETA INTERAKTIF */}
          <View style={styles.mapHeroCard}>
            <View style={styles.mapEmbedContainer}>
              {Platform.OS === 'web' ? (
                React.createElement('iframe', {
                  title: 'Google Maps Live View',
                  src: googleMapsEmbedUrl,
                  style: {
                    width: '100%',
                    height: '100%',
                    border: 'none',
                  },
                  allowFullScreen: true,
                  loading: 'lazy',
                })
              ) : (
                <WebView
                  key={`${coords.latitude}-${coords.longitude}-${mapViewType}-${mapZoom}`}
                  source={{ uri: googleMapsEmbedUrl }}
                  style={styles.mapWebView}
                  javaScriptEnabled={true}
                  domStorageEnabled={true}
                  startInLoadingState={true}
                  renderLoading={() => (
                    <View style={styles.mapLoadingOverlay}>
                      <ActivityIndicator size="small" color={UI.colors.primary} />
                      <Text style={styles.mapLoadingText}>Memuat Peta Interaktif...</Text>
                    </View>
                  )}
                />
              )}

              <View style={styles.floatingWarehousePill}>
                <View style={styles.warehouseMiniIcon}>
                  <MaterialCommunityIcons name="warehouse" size={14} color="#FFFFFF" />
                </View>
                <View>
                  <Text style={styles.warehousePillTitle}>{warehouseConfig.nama_gudang}</Text>
                  <Text style={styles.warehousePillSub}>
                    Radius {geofenceRadius}m • Jarak {distanceToGeofence}m
                  </Text>
                </View>
              </View>

              <View style={styles.geofenceVisualOverlay} pointerEvents="none">
                <View
                  style={[
                    styles.geofenceCircleRing,
                    !isInsideGeofence && styles.geofenceCircleRingOutside,
                  ]}
                >
                  <View style={styles.warehousePinBadge}>
                    <MaterialCommunityIcons name="warehouse" size={12} color={UI.colors.primary} />
                  </View>
                  <View
                    style={[
                      styles.userBlueMarkerDot,
                      !isInsideGeofence && {
                        transform: [{ translateX: 26 }, { translateY: 22 }],
                      },
                    ]}
                  >
                    <View style={styles.userBlueMarkerInner} />
                  </View>
                </View>
              </View>

              <View style={styles.floatingMapControls}>
                <TouchableOpacity
                  style={styles.mapControlBtn}
                  activeOpacity={0.8}
                  onPress={handleGetRealDeviceGPS}
                >
                  <Feather name="crosshair" size={16} color={UI.colors.primary} />
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.mapControlBtn}
                  activeOpacity={0.8}
                  onPress={() => setMapZoom((z) => Math.min(20, z + 1))}
                >
                  <Feather name="plus" size={16} color={UI.colors.text} />
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.mapControlBtn}
                  activeOpacity={0.8}
                  onPress={() => setMapZoom((z) => Math.max(12, z - 1))}
                >
                  <Feather name="minus" size={16} color={UI.colors.text} />
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.mapControlBtn}
                  activeOpacity={0.8}
                  onPress={handleOpenGoogleMaps}
                >
                  <Feather name="external-link" size={15} color={UI.colors.primary} />
                </TouchableOpacity>
              </View>

              <View style={styles.mapBottomBar}>
                <View style={styles.layerMiniToggle}>
                  <TouchableOpacity
                    style={[
                      styles.layerMiniChip,
                      mapViewType === 'street' && styles.layerMiniChipActive,
                    ]}
                    onPress={() => setMapViewType('street')}
                  >
                    <Text
                      style={[
                        styles.layerMiniText,
                        mapViewType === 'street' && styles.layerMiniTextActive,
                      ]}
                    >
                      Peta
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.layerMiniChip,
                      mapViewType === 'satellite' && styles.layerMiniChipActive,
                    ]}
                    onPress={() => setMapViewType('satellite')}
                  >
                    <Text
                      style={[
                        styles.layerMiniText,
                        mapViewType === 'satellite' && styles.layerMiniTextActive,
                      ]}
                    >
                      Satelit
                    </Text>
                  </TouchableOpacity>
                </View>

                {isLiveTracking && (
                  <View style={styles.liveTrackingFloatingBadge}>
                    <Text style={styles.liveTrackingFloatingBadgeText}>LIVE GPS</Text>
                  </View>
                )}
              </View>
            </View>
          </View>

          {/* PANEL RINGKAS KOORDINAT, ALAMAT, GEOFENCING & BATERAI */}
          <View style={styles.infoPanelCard}>
            <View style={styles.infoRowItem}>
              <View style={styles.infoBlueIcon}>
                <Feather name="map-pin" size={16} color={UI.colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.infoRowTitle}>Lokasi Saya</Text>
                <Text style={styles.coordsMonoText}>
                  Lat: {coords.latitude.toFixed(6)}, Long: {coords.longitude.toFixed(6)}
                </Text>
              </View>
              {isGeocodingLoading && (
                <ActivityIndicator size="small" color={UI.colors.primary} />
              )}
            </View>

            <View style={styles.panelDivider} />

            <View style={styles.infoRowItem}>
              <View style={styles.infoBlueIcon}>
                <Feather name="navigation" size={15} color={UI.colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                {isEditingAddressManual && canAdminGeofence ? (
                  <View style={styles.editAddressWrap}>
                    <TextInput
                      style={styles.editAddressTextInput}
                      value={manualAddressDraft}
                      onChangeText={setManualAddressDraft}
                      placeholder="Ketik alamat kustom Anda..."
                      placeholderTextColor={UI.colors.muted}
                      multiline
                    />
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                      <SecondaryOutlineButton
                        label="Batal"
                        onPress={() => setIsEditingAddressManual(false)}
                        style={{ flex: 1, height: 36 }}
                        textStyle={{ fontSize: 12 }}
                      />
                      <PrimaryGradientButton
                        label="Simpan"
                        onPress={handleSaveManualAddress}
                        style={{ flex: 1, height: 36 }}
                        textStyle={{ fontSize: 12 }}
                      />
                    </View>
                  </View>
                ) : (
                  <Text style={styles.addressText}>{currentAddress}</Text>
                )}
              </View>
              {!isEditingAddressManual && canAdminGeofence && (
                <TouchableOpacity
                  style={styles.editMiniBtn}
                  onPress={() => {
                    setManualAddressDraft(currentAddress);
                    setIsEditingAddressManual(true);
                  }}
                >
                  <Feather name="edit-2" size={13} color={UI.colors.primary} />
                </TouchableOpacity>
              )}
            </View>

            <View style={styles.panelDivider} />

            <View style={styles.statusSummaryFooter}>
              <View
                style={[
                  styles.geofenceStatusBadge,
                  isInsideGeofence ? styles.badgeInside : styles.badgeOutside,
                ]}
              >
                <Feather
                  name={isInsideGeofence ? 'check-circle' : 'alert-triangle'}
                  size={13}
                  color={isInsideGeofence ? UI.colors.success : UI.colors.dangerDark}
                />
                <Text
                  style={[
                    styles.geofenceStatusText,
                    { color: isInsideGeofence ? UI.colors.success : UI.colors.dangerDark },
                  ]}
                >
                  {isInsideGeofence
                    ? `Dalam Area Geofence (${distanceToGeofence}m)`
                    : `Di Luar Area (${distanceToGeofence}m)`}
                </Text>
              </View>

              <View style={styles.batteryChip}>
                <Feather name="battery-charging" size={12} color={UI.colors.primary} />
                <Text style={styles.batteryChipText}>
                  {isLiveTracking ? 'Hemat Baterai • 2s / 1m' : 'GPS Siaga • Hemat Daya'}
                </Text>
              </View>
            </View>
          </View>

          {isInsideGeofence && showGeofenceBanner && (
            <View style={styles.geofenceAlertBanner}>
              <Feather name="check-circle" size={16} color={UI.colors.success} />
              <Text style={styles.alertBannerText}>
                Terverifikasi di {warehouseConfig.nama_gudang}. Izin mutasi stok & scan barcode aktif.
              </Text>
              <TouchableOpacity
                onPress={() => setShowGeofenceBanner(false)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Feather name="x" size={15} color={UI.colors.muted} />
              </TouchableOpacity>
            </View>
          )}

          {!isInsideGeofence && (
            <View style={[styles.geofenceAlertBanner, styles.geofenceAlertBannerOutside]}>
              <Feather name="alert-triangle" size={16} color={UI.colors.dangerDark} />
              <Text style={[styles.alertBannerText, { color: UI.colors.dangerDark }]}>
                Di luar perimeter gudang ({distanceToGeofence}m). Mutasi stok dinonaktifkan demi keamanan.
              </Text>
            </View>
          )}

          {/* TOMBOL AKSI SESUAI PERAN (Admin & Staff: Presensi + GPS; Manajer: Monitoring) */}
          <View style={styles.primaryActionsStack}>
            {canPresensi && (
              <PrimaryGradientButton
                label="Presensi Gudang Sekarang"
                iconLeft={<Feather name="shield" size={16} color="#FFFFFF" />}
                onPress={handlePresensiGudang}
              />
            )}

            <PrimaryGradientButton
              label={
                isLiveTracking
                  ? 'Hentikan Live Tracking GPS'
                  : 'Aktifkan GPS & Live Tracking'
              }
              iconLeft={
                <MaterialCommunityIcons
                  name={isLiveTracking ? 'radar' : 'crosshairs-gps'}
                  size={18}
                  color="#FFFFFF"
                />
              }
              onPress={toggleLiveTracking}
            />

            <SecondaryOutlineButton
              label="Lokasi Saya (Deteksi GPS Perangkat)"
              iconLeft={<Feather name="navigation" size={15} color={UI.colors.primary} />}
              onPress={handleGetRealDeviceGPS}
            />
          </View>

          {/* KONTROL GEOFENCE & PENCARIAN ALAMAT (KHUSUS ADMIN GUDANG) */}
          {canAdminGeofence && (
            <View style={styles.toolsCard}>
              <Text style={styles.toolsSectionTitle}>
                Pengaturan Geofence & Alamat (Khusus Admin)
              </Text>

              <View style={styles.radiusPillsRow}>
                {[50, 100, 150].map((radius) => (
                  <TouchableOpacity
                    key={radius}
                    style={[
                      styles.radiusPill,
                      geofenceRadius === radius && styles.radiusPillActive,
                    ]}
                    onPress={() => handleChangeGeofenceRadius(radius)}
                  >
                    <Text
                      style={[
                        styles.radiusPillText,
                        geofenceRadius === radius && styles.radiusPillTextActive,
                      ]}
                    >
                      Radius {radius}m
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <View style={styles.simButtonsRow}>
                <SecondaryOutlineButton
                  label="Masuk Area (0m)"
                  onPress={handleSimulateInsideArea}
                  style={[
                    styles.simBtn,
                    isInsideGeofence && !isRealGPSActive && styles.simBtnActive,
                  ]}
                  textStyle={[
                    styles.simBtnText,
                    isInsideGeofence && !isRealGPSActive && styles.simBtnTextActive,
                  ]}
                />
                <SecondaryOutlineButton
                  label="Luar Area (~172m)"
                  onPress={handleSimulateOutsideArea}
                  style={[
                    styles.simBtn,
                    !isInsideGeofence && !isRealGPSActive && styles.simBtnActive,
                  ]}
                  textStyle={[
                    styles.simBtnText,
                    !isInsideGeofence && !isRealGPSActive && styles.simBtnTextActive,
                  ]}
                />
              </View>

              <View style={styles.searchAddressInputRow}>
                <TextInput
                  style={styles.searchAddressInput}
                  placeholder="Cari & pasang pin alamat..."
                  placeholderTextColor={UI.colors.muted}
                  value={customAddressInput}
                  onChangeText={setCustomAddressInput}
                  onSubmitEditing={handleSearchCustomAddress}
                  returnKeyType="search"
                />
                <PrimaryGradientButton
                  label="Cari"
                  disabled={isSearchingAddress}
                  onPress={handleSearchCustomAddress}
                  loadingNode={
                    isSearchingAddress ? <ActivityIndicator size="small" color="#FFFFFF" /> : undefined
                  }
                  iconLeft={<Feather name="search" size={14} color="#FFFFFF" />}
                  style={{ height: 42, paddingHorizontal: 14 }}
                  textStyle={{ fontSize: 12.5 }}
                />
              </View>
            </View>
          )}

          {/* MONITORING RIWAYAT PRESENSI STAFF (Admin & Manajer Operasional) */}
          {canMonitorStaff && (
            <View style={[styles.toolsCard, { marginTop: 12 }]}>
              <Text style={styles.toolsSectionTitle}>Riwayat Presensi Staff Gudang</Text>
              {presensiLogs.map((log, idx) => (
                <View
                  key={log.id}
                  style={[
                    styles.presensiLogRow,
                    idx === presensiLogs.length - 1 && { borderBottomWidth: 0, paddingBottom: 0 },
                  ]}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.presensiLogName}>
                      {log.nama} ({log.role})
                    </Text>
                    <Text style={styles.presensiLogMeta}>
                      {log.tanggal} • {log.waktu} • {log.jarak_meter}m
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.geofenceStatusBadge,
                      log.dalam_area ? styles.badgeInside : styles.badgeOutside,
                    ]}
                  >
                    <Text
                      style={[
                        styles.geofenceStatusText,
                        { color: log.dalam_area ? UI.colors.success : UI.colors.dangerDark },
                      ]}
                    >
                      {log.dalam_area ? 'Dalam Area' : 'Luar Area'}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          )}

          <View style={{ height: 24 }} />
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
  header: {
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
  headerBrandTitle: {
    fontSize: 16.5,
    fontWeight: '800',
    color: UI.colors.text,
    letterSpacing: -0.3,
  },
  gpsStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderWidth: 1,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: UI.radius.pill,
  },
  gpsStatusBadgeReal: {
    backgroundColor: UI.colors.successBg,
    borderColor: UI.colors.successBorder,
  },
  gpsStatusBadgeSim: {
    backgroundColor: UI.colors.warningBg,
    borderColor: UI.colors.warningBorder,
  },
  gpsDot: {
    width: 6.5,
    height: 6.5,
    borderRadius: 3.5,
  },
  gpsStatusText: {
    fontSize: 10.5,
    fontWeight: '700',
  },
  scrollView: {
    flex: 1,
    minHeight: 0,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 4,
  },

  mapHeroCard: {
    backgroundColor: UI.colors.surface,
    borderRadius: UI.radius.xl,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: UI.colors.borderSoft,
    marginBottom: 12,
    ...cardShadow,
  },
  mapEmbedContainer: {
    height: 295,
    backgroundColor: UI.colors.surfaceMuted,
    position: 'relative',
  },
  mapWebView: {
    flex: 1,
    backgroundColor: UI.colors.surfaceMuted,
  },
  mapLoadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: UI.colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  mapLoadingText: {
    fontSize: 11.5,
    fontWeight: '600',
    color: UI.colors.secondary,
  },
  floatingWarehousePill: {
    position: 'absolute',
    top: 10,
    left: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.94)',
    borderWidth: 1,
    borderColor: UI.colors.borderSoft,
    borderRadius: UI.radius.md,
    paddingHorizontal: 10,
    paddingVertical: 7,
    ...cardShadow,
  },
  warehouseMiniIcon: {
    width: 26,
    height: 26,
    borderRadius: 8,
    backgroundColor: UI.colors.primary,
    backgroundImage: UI.gradients.primaryBtn,
    alignItems: 'center',
    justifyContent: 'center',
  },
  warehousePillTitle: {
    fontSize: 11.5,
    fontWeight: '800',
    color: UI.colors.text,
  },
  warehousePillSub: {
    fontSize: 10,
    color: UI.colors.secondary,
    fontWeight: '600',
  },

  geofenceVisualOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  geofenceCircleRing: {
    width: 112,
    height: 112,
    borderRadius: 56,
    backgroundColor: 'rgba(37, 99, 235, 0.14)',
    borderWidth: 1.5,
    borderColor: 'rgba(37, 99, 235, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  geofenceCircleRingOutside: {
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderColor: 'rgba(239, 68, 68, 0.45)',
  },
  warehousePinBadge: {
    position: 'absolute',
    top: 14,
    right: 14,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: UI.colors.primaryBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  userBlueMarkerDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(37, 99, 235, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  userBlueMarkerInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: UI.colors.primary,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },

  floatingMapControls: {
    position: 'absolute',
    right: 10,
    top: 66,
    gap: 6,
  },
  mapControlBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.94)',
    borderWidth: 1,
    borderColor: UI.colors.borderSoft,
    alignItems: 'center',
    justifyContent: 'center',
    ...cardShadow,
  },
  mapBottomBar: {
    position: 'absolute',
    bottom: 10,
    left: 10,
    right: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  layerMiniToggle: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.94)',
    borderRadius: UI.radius.pill,
    borderWidth: 1,
    borderColor: UI.colors.borderSoft,
    padding: 3,
    gap: 2,
  },
  layerMiniChip: {
    paddingHorizontal: 11,
    paddingVertical: 4,
    borderRadius: UI.radius.pill,
  },
  layerMiniChipActive: {
    backgroundColor: UI.colors.primary,
    backgroundImage: UI.gradients.primaryBtn,
  },
  layerMiniText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: UI.colors.secondary,
  },
  layerMiniTextActive: {
    color: '#FFFFFF',
  },
  liveTrackingFloatingBadge: {
    backgroundColor: UI.colors.primary,
    backgroundImage: UI.gradients.primaryBtn,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: UI.radius.pill,
    ...primaryButtonShadow,
  },
  liveTrackingFloatingBadgeText: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#FFFFFF',
  },

  infoPanelCard: {
    backgroundColor: UI.colors.surface,
    borderRadius: UI.radius.lg,
    borderWidth: 1,
    borderColor: UI.colors.borderSoft,
    padding: 14,
    marginBottom: 12,
    ...cardShadow,
  },
  infoRowItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  infoBlueIcon: {
    width: 34,
    height: 34,
    borderRadius: 11,
    backgroundColor: UI.colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoRowTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: UI.colors.text,
  },
  coordsMonoText: {
    fontSize: 11,
    fontWeight: '600',
    color: UI.colors.secondary,
    fontFamily: UI.font.mono,
    marginTop: 1,
  },
  panelDivider: {
    height: 1,
    backgroundColor: UI.colors.borderSubtle,
    marginVertical: 10,
  },
  addressText: {
    fontSize: 12.5,
    color: UI.colors.textBody,
    lineHeight: 18,
    fontWeight: '600',
  },
  editMiniBtn: {
    width: 30,
    height: 30,
    borderRadius: 9,
    backgroundColor: UI.colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editAddressWrap: {
    gap: 8,
  },
  editAddressTextInput: {
    backgroundColor: UI.colors.background,
    borderWidth: 1,
    borderColor: UI.colors.primaryBorder,
    borderRadius: UI.radius.sm,
    padding: 9,
    fontSize: 12,
    color: UI.colors.text,
    lineHeight: 17,
  },
  statusSummaryFooter: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  geofenceStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: UI.radius.pill,
    borderWidth: 1,
  },
  badgeInside: {
    backgroundColor: UI.colors.successBg,
    borderColor: UI.colors.successBorder,
  },
  badgeOutside: {
    backgroundColor: UI.colors.dangerBg,
    borderColor: UI.colors.dangerBorder,
  },
  geofenceStatusText: {
    fontSize: 11,
    fontWeight: '700',
  },
  batteryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: UI.colors.primaryLight,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: UI.radius.pill,
  },
  batteryChipText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: UI.colors.primary,
  },

  geofenceAlertBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: UI.colors.successBg,
    borderWidth: 1,
    borderColor: UI.colors.successBorder,
    borderRadius: UI.radius.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
    gap: 8,
  },
  geofenceAlertBannerOutside: {
    backgroundColor: UI.colors.dangerBg,
    borderColor: UI.colors.dangerBorder,
  },
  alertBannerText: {
    flex: 1,
    fontSize: 11.5,
    fontWeight: '600',
    color: UI.colors.success,
    lineHeight: 16,
  },

  primaryActionsStack: {
    gap: 10,
    marginBottom: 12,
  },

  toolsCard: {
    backgroundColor: UI.colors.surface,
    borderRadius: UI.radius.lg,
    borderWidth: 1,
    borderColor: UI.colors.borderSoft,
    padding: 14,
    ...cardShadow,
  },
  toolsSectionTitle: {
    fontSize: 12.5,
    fontWeight: '800',
    color: UI.colors.text,
    marginBottom: 10,
  },
  radiusPillsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
  },
  radiusPill: {
    flex: 1,
    paddingVertical: 7,
    borderRadius: UI.radius.pill,
    backgroundColor: UI.colors.background,
    borderWidth: 1,
    borderColor: UI.colors.borderSoft,
    alignItems: 'center',
  },
  radiusPillActive: {
    backgroundColor: UI.colors.primary,
    backgroundImage: UI.gradients.primaryBtn,
    borderColor: UI.colors.primary,
  },
  radiusPillText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: UI.colors.secondary,
  },
  radiusPillTextActive: {
    color: '#FFFFFF',
  },
  simButtonsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
  },
  simBtn: {
    flex: 1,
    height: 40,
    borderColor: UI.colors.borderSoft,
  },
  simBtnActive: {
    backgroundColor: UI.colors.primaryLight,
    borderColor: UI.colors.primary,
  },
  simBtnText: {
    fontSize: 11.5,
    color: UI.colors.secondary,
  },
  simBtnTextActive: {
    color: UI.colors.primary,
  },
  searchAddressInputRow: {
    flexDirection: 'row',
    gap: 8,
  },
  searchAddressInput: {
    flex: 1,
    backgroundColor: UI.colors.background,
    borderWidth: 1,
    borderColor: UI.colors.borderSoft,
    borderRadius: UI.radius.md,
    paddingHorizontal: 12,
    height: 42,
    fontSize: 12.5,
    color: UI.colors.text,
  },
  presensiLogRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor: UI.colors.borderSubtle,
    gap: 8,
  },
  presensiLogName: {
    fontSize: 12.5,
    fontWeight: '700',
    color: UI.colors.text,
  },
  presensiLogMeta: {
    fontSize: 11,
    color: UI.colors.secondary,
    marginTop: 2,
  },
});
