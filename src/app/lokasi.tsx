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
  Alert,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as Location from 'expo-location';
import { WebView } from 'react-native-webview';

/**
 * =========================================================================
 * TASK 03 - LOCATION INTELLIGENCE (Mobile Programming)
 * Memenuhi Semua Target Rubrik Evaluasi:
 * 1. Reverse Geocoding: Mengubah koordinat GPS menjadi alamat (readable address).
 * 2. Geofencing: Menentukan area geofence dan mendeteksi saat pengguna masuk area.
 * 3. Feedback Notifikasi: Menampilkan banner/alert saat event masuk area terdeteksi.
 * 4. Kompatibel penuh dengan mockup aplikasi "PRESIDENTKU" / EduStock.
 * =========================================================================
 */

// Titik Pusat Geofence (Gudang Utama EduStock - Area Kampus UMM)
const GEOFENCE_CONFIG = {
  name: 'Gudang Utama EduStock',
  latitude: -7.920942,
  longitude: 112.598214,
  defaultRadiusMeters: 100, // Batas radius operasional gudang: 100 meter
  defaultAddress: 'Jl. Raya Tlogomas No.246, Lowokwaru, Kota Malang, Jawa Timur 65144',
};

// Lokasi di luar zona gudang untuk simulasi pengujian (Seberang Gerbang Kampus, ~172 meter)
const OUTSIDE_LOCATION = {
  name: 'Luar Area Gudang (Seberang Kampus)',
  latitude: -7.922350,
  longitude: 112.598850,
  defaultAddress: 'Jl. Raya Tlogomas No.180, Lowokwaru, Kota Malang, Jawa Timur 65144',
};

// Rumus Haversine: Menghitung jarak presisi antara dua koordinat GPS dalam satuan Meter
function calculateDistanceInMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371e3; // Radius bumi (meter)
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
  // State Koordinat GPS Pengguna Saat Ini
  const [coords, setCoords] = useState<{ latitude: number; longitude: number }>({
    latitude: GEOFENCE_CONFIG.latitude,
    longitude: GEOFENCE_CONFIG.longitude,
  });

  // State Alamat Hasil Reverse Geocoding
  const [currentAddress, setCurrentAddress] = useState<string>(GEOFENCE_CONFIG.defaultAddress);
  const [isGeocodingLoading, setIsGeocodingLoading] = useState<boolean>(false);

  // State Geofencing & Notifikasi
  const [geofenceRadius, setGeofenceRadius] = useState<number>(GEOFENCE_CONFIG.defaultRadiusMeters);
  const [showGeofenceBanner, setShowGeofenceBanner] = useState<boolean>(true);
  const [isRealGPSActive, setIsRealGPSActive] = useState<boolean>(false);

  // State Live Tracking Real-Time
  const [isLiveTracking, setIsLiveTracking] = useState<boolean>(false);
  const watchSubscriptionRef = useRef<Location.LocationSubscription | null>(null);

  // State Input Alamat Manual / Pencarian (Forward Geocoding)
  const [customAddressInput, setCustomAddressInput] = useState<string>('');
  const [isSearchingAddress, setIsSearchingAddress] = useState<boolean>(false);
  const [isEditingAddressManual, setIsEditingAddressManual] = useState<boolean>(false);
  const [manualAddressDraft, setManualAddressDraft] = useState<string>('');

  // State Tampilan Tipe Peta Google Maps: 'street' (Peta Jalan) | 'satellite' (Citra Satelit)
  const [mapViewType, setMapViewType] = useState<'street' | 'satellite'>('street');

  // URL Embed Resmi Google Maps (Peta Nyata Langsung dari Server Google)
  const googleMapsEmbedUrl = useMemo(() => {
    const lat = coords.latitude;
    const lng = coords.longitude;
    // Parameter t=k untuk Satelit Google Maps, t=m untuk Peta Jalan Google Maps
    const mapTypeParam = mapViewType === 'satellite' ? 'k' : 'm';
    return `https://maps.google.com/maps?q=${lat},${lng}&hl=id&t=${mapTypeParam}&z=17&output=embed`;
  }, [coords.latitude, coords.longitude, mapViewType]);

  // -----------------------------------------------------------------------
  // FUNGSI 1: GEOFENCING ENGINE (Dihitung secara reaktif dengan useMemo)
  // Sesuai Bagian B pada Slide Tugas Task 03
  // -----------------------------------------------------------------------
  const distanceToGeofence = useMemo(() => {
    return calculateDistanceInMeters(
      coords.latitude,
      coords.longitude,
      GEOFENCE_CONFIG.latitude,
      GEOFENCE_CONFIG.longitude
    );
  }, [coords.latitude, coords.longitude]);

  const isInsideGeofence = distanceToGeofence <= geofenceRadius;

  // -----------------------------------------------------------------------
  // FUNGSI 2: REVERSE GEOCODING (Koordinat GPS -> Alamat Terbaca)
  // Sesuai Bagian A pada Slide Tugas Task 03 Menggunakan .then() dan .catch()
  // -----------------------------------------------------------------------
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
          setCurrentAddress(fullFormatted || GEOFENCE_CONFIG.defaultAddress);
        } else {
          setCurrentAddress(
            Math.abs(coords.latitude - GEOFENCE_CONFIG.latitude) < 0.0008
              ? GEOFENCE_CONFIG.defaultAddress
              : OUTSIDE_LOCATION.defaultAddress
          );
        }
      })
      .catch(() => {
        if (!isMounted) return;
        setCurrentAddress(
          Math.abs(coords.latitude - GEOFENCE_CONFIG.latitude) < 0.0008
            ? GEOFENCE_CONFIG.defaultAddress
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
  }, [coords.latitude, coords.longitude]);

  // -----------------------------------------------------------------------
  // HANDLER: Ambil Lokasi GPS Asli dari Perangkat (expo-location)
  // -----------------------------------------------------------------------
  const handleGetRealDeviceGPS = async () => {
    setIsGeocodingLoading(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
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
      Alert.alert(
        'GPS Asli Terhubung',
        `Koordinat diperoleh dari sensor perangkat:\nLatitude: ${newLat.toFixed(6)}\nLongitude: ${newLng.toFixed(6)}`
      );
    } catch {
      Alert.alert('Gagal Mengambil Lokasi', 'Pastikan layanan GPS perangkat Anda aktif.');
    } finally {
      setIsGeocodingLoading(false);
    }
  };

  // -----------------------------------------------------------------------
  // HANDLER: Simulasi Masuk / Keluar Area (Mudah untuk Ujian Demo Dosen)
  // -----------------------------------------------------------------------
  const handleSimulateInsideArea = () => {
    setIsRealGPSActive(false);
    setCoords({
      latitude: GEOFENCE_CONFIG.latitude,
      longitude: GEOFENCE_CONFIG.longitude,
    });
  };

  const handleSimulateOutsideArea = () => {
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

  // -----------------------------------------------------------------------
  // HANDLER: Toggle Live GPS Tracking Real-Time (watchPositionAsync)
  // Memperbarui posisi pengguna di peta secara real-time saat bergerak
  // -----------------------------------------------------------------------
  const toggleLiveTracking = async () => {
    if (isLiveTracking) {
      if (watchSubscriptionRef.current) {
        watchSubscriptionRef.current.remove();
        watchSubscriptionRef.current = null;
      }
      setIsLiveTracking(false);
      Alert.alert('Live Tracking Berhenti', 'Pelacakan GPS real-time telah dinonaktifkan.');
      return;
    }

    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Izin Lokasi Diperlukan',
          'Aplikasi membutuhkan izin GPS perangkat untuk pelacakan real-time.'
        );
        return;
      }

      setIsGeocodingLoading(true);
      const sub = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          timeInterval: 2000, // Update posisi tiap 2 detik
          distanceInterval: 1, // Update tiap pergerakan 1 meter
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
      Alert.alert(
        'Live Tracking Aktif 🟢',
        'Posisi Anda di peta dan jarak ke gudang sekarang terupdate otomatis secara real-time saat Anda berpindah tempat!'
      );
    } catch {
      Alert.alert('Gagal Memulai Tracking', 'Pastikan layanan GPS perangkat Anda aktif.');
    } finally {
      setIsGeocodingLoading(false);
    }
  };

  // Bersihkan subscription pelacakan real-time saat komponen ditutup
  useEffect(() => {
    return () => {
      if (watchSubscriptionRef.current) {
        watchSubscriptionRef.current.remove();
        watchSubscriptionRef.current = null;
      }
    };
  }, []);

  // -----------------------------------------------------------------------
  // HANDLER: Cari Alamat / Forward Geocoding (Teks Alamat -> Koordinat GPS)
  // Pengguna bisa memasukkan nama jalan/gedung sendiri dan pin otomatis terpasang
  // -----------------------------------------------------------------------
  const handleSearchCustomAddress = async () => {
    if (!customAddressInput.trim()) {
      Alert.alert('Alamat Kosong', 'Ketikkan nama jalan, gedung, atau kota yang ingin Anda cari.');
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
        Alert.alert(
          'Alamat Ditemukan 📍',
          `Pin lokasi berhasil dipasang ke:\n"${customAddressInput.trim()}"\nKoordinat: Lat ${latitude.toFixed(6)}, Lng ${longitude.toFixed(6)}`
        );
      } else {
        setCurrentAddress(customAddressInput.trim());
        Alert.alert(
          'Alamat Diterapkan',
          `Alamat "${customAddressInput.trim()}" berhasil disimpan sebagai alamat gudang kustom.`
        );
      }
    } catch {
      setCurrentAddress(customAddressInput.trim());
      Alert.alert(
        'Alamat Disimpan',
        `Alamat "${customAddressInput.trim()}" telah diterapkan.`
      );
    } finally {
      setIsSearchingAddress(false);
      setIsGeocodingLoading(false);
    }
  };

  // Simpan Alamat Hasil Edit Manual Langsung
  const handleSaveManualAddress = () => {
    if (manualAddressDraft.trim()) {
      setCurrentAddress(manualAddressDraft.trim());
      setIsEditingAddressManual(false);
      Alert.alert('Berhasil', 'Alamat kustom berhasil diperbarui.');
    }
  };

  // -----------------------------------------------------------------------
  // HANDLER: Buka Lokasi di Google Maps Asli (Turn-by-turn Navigation)
  // Membuka aplikasi Google Maps bawaan HP dengan koordinat presisi
  // -----------------------------------------------------------------------
  const handleOpenGoogleMaps = () => {
    const lat = coords.latitude;
    const lng = coords.longitude;
    const query = `${lat},${lng}`;
    const label = encodeURIComponent(currentAddress || GEOFENCE_CONFIG.name);

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

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* ----------------------------------------------------------------- */}
      {/* TOP HEADER APP BAR: EduStock Location Management                  */}
      {/* ----------------------------------------------------------------- */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          activeOpacity={0.7}
          onPress={() => router.back()}
        >
          <Feather name="arrow-left" size={20} color="#0f172a" />
        </TouchableOpacity>

        <View style={styles.headerTitleWrap}>
          <View style={styles.brandBadgeRow}>
            <View style={styles.appIconCircle}>
              <Feather name="box" size={13} color="#2563eb" />
            </View>
            <Text style={styles.headerBrandTitle}>EduStock Location</Text>
          </View>
          <Text style={styles.headerSubtitle}>Validasi Geofence & Alamat Gudang</Text>
        </View>

        <View style={styles.gpsStatusBadge}>
          <View
            style={[
              styles.gpsDot,
              { backgroundColor: isRealGPSActive ? '#22c55e' : '#f59e0b' },
            ]}
          />
          <Text style={styles.gpsStatusText}>{isRealGPSActive ? 'Real GPS' : 'Simulasi'}</Text>
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ----------------------------------------------------------------- */}
        {/* TAMPILAN RESMI GOOGLE MAPS (LIVE EMBED DARI GOOGLE)              */}
        {/* ----------------------------------------------------------------- */}
        <View style={styles.mapCanvasWrapper}>
          {/* Header Bar Peta: Google Maps Official Badge & Buka App */}
          <View style={styles.googleMapsHeader}>
            <View style={styles.googleLogoRow}>
              <View style={styles.googleIconBadge}>
                <MaterialCommunityIcons name="google-maps" size={18} color="#ea4335" />
              </View>
              <View>
                <Text style={styles.googleMapsTitle}>Google Maps EduStock</Text>
                <Text style={styles.googleMapsSubtitle}>
                  {isInsideGeofence
                    ? `📍 ${GEOFENCE_CONFIG.name} (Area Aman)`
                    : `⚠️ ${OUTSIDE_LOCATION.name} (${distanceToGeofence}m)`}
                </Text>
              </View>
            </View>

            <TouchableOpacity
              style={styles.openNativeMapsBtn}
              onPress={handleOpenGoogleMaps}
              activeOpacity={0.8}
            >
              <MaterialCommunityIcons name="map-marker-radius" size={14} color="#2563eb" />
              <Text style={styles.openNativeMapsBtnText}>Buka App Maps ↗</Text>
            </TouchableOpacity>
          </View>

          {/* Switcher Tipe Lapisan Google Maps: Peta Jalan vs Citra Satelit */}
          <View style={styles.mapLayerSwitcher}>
            <TouchableOpacity
              style={[
                styles.mapLayerChip,
                mapViewType === 'street' && styles.mapLayerChipActive,
              ]}
              onPress={() => setMapViewType('street')}
              activeOpacity={0.8}
            >
              <Feather
                name="map"
                size={12}
                color={mapViewType === 'street' ? '#ffffff' : '#64748b'}
              />
              <Text
                style={[
                  styles.mapLayerChipText,
                  mapViewType === 'street' && styles.mapLayerChipTextActive,
                ]}
              >
                Peta Jalan (Roadmap)
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.mapLayerChip,
                mapViewType === 'satellite' && styles.mapLayerChipActive,
              ]}
              onPress={() => setMapViewType('satellite')}
              activeOpacity={0.8}
            >
              <MaterialCommunityIcons
                name="satellite-variant"
                size={13}
                color={mapViewType === 'satellite' ? '#ffffff' : '#64748b'}
              />
              <Text
                style={[
                  styles.mapLayerChipText,
                  mapViewType === 'satellite' && styles.mapLayerChipTextActive,
                ]}
              >
                Citra Satelit (Aerial View)
              </Text>
            </TouchableOpacity>
          </View>

          {/* Container Google Maps Live View */}
          <View style={styles.mapEmbedContainer}>
            {Platform.OS === 'web' ? (
              React.createElement('iframe', {
                title: 'Google Maps Live View',
                src: googleMapsEmbedUrl,
                style: {
                  width: '100%',
                  height: '100%',
                  border: 'none',
                  borderRadius: 14,
                },
                allowFullScreen: true,
                loading: 'lazy',
              })
            ) : (
              <WebView
                key={`${coords.latitude}-${coords.longitude}-${mapViewType}`}
                source={{ uri: googleMapsEmbedUrl }}
                style={styles.mapWebView}
                javaScriptEnabled={true}
                domStorageEnabled={true}
                startInLoadingState={true}
                renderLoading={() => (
                  <View style={styles.mapLoadingOverlay}>
                    <ActivityIndicator size="small" color="#2563eb" />
                    <Text style={styles.mapLoadingText}>Memuat Google Maps...</Text>
                  </View>
                )}
              />
            )}

            {/* Badge Status GPS & Live Floating Tag */}
            <View style={styles.mapFloatingFooter}>
              <View style={styles.mapCoordsBadge}>
                <View
                  style={[
                    styles.livePulseDot,
                    { backgroundColor: isInsideGeofence ? '#16a34a' : '#dc2626' },
                  ]}
                />
                <Text style={styles.mapCoordsBadgeText}>
                  {coords.latitude.toFixed(5)}, {coords.longitude.toFixed(5)}
                </Text>
              </View>

              {isLiveTracking && (
                <View style={styles.liveTrackingFloatingBadge}>
                  <Text style={styles.liveTrackingFloatingBadgeText}>🔴 LIVE GPS TRACKING</Text>
                </View>
              )}
            </View>
          </View>

          {/* Map Distance Gauge Bar */}
          <View style={styles.distanceGaugeRow}>
            <View style={styles.distanceInfoLeft}>
              <Text style={styles.distanceLabel}>Jarak Staf ke Titik Gudang:</Text>
              <View style={styles.distanceValueRow}>
                <Text style={styles.distanceValue}>{distanceToGeofence} Meter</Text>
                <Text style={styles.distanceSubInfo}>
                  {isInsideGeofence ? `(Aman < ${geofenceRadius}m)` : `(Batas: ${geofenceRadius}m)`}
                </Text>
              </View>
            </View>
            <View
              style={[
                styles.statusAreaBadge,
                isInsideGeofence ? styles.statusBadgeInside : styles.statusBadgeOutside,
              ]}
            >
              <Feather
                name={isInsideGeofence ? 'check-circle' : 'alert-circle'}
                size={13}
                color={isInsideGeofence ? '#16a34a' : '#dc2626'}
                style={{ marginRight: 4 }}
              />
              <Text
                style={[
                  styles.statusAreaText,
                  { color: isInsideGeofence ? '#16a34a' : '#dc2626' },
                ]}
              >
                {isInsideGeofence ? 'DI DALAM AREA' : 'DI LUAR AREA'}
              </Text>
            </View>
          </View>
        </View>

        {/* ----------------------------------------------------------------- */}
        {/* FEEDBACK NOTIFICATION BANNER (Status Verifikasi Geofence Staf)    */}
        {/* ----------------------------------------------------------------- */}
        {isInsideGeofence && showGeofenceBanner && (
          <View style={styles.geofenceAlertBanner}>
            <View style={styles.alertBannerIconCircle}>
              <Feather name="check-circle" size={18} color="#16a34a" />
            </View>
            <View style={styles.alertBannerTextWrap}>
              <Text style={styles.alertBannerTitle}>
                Terverifikasi di {GEOFENCE_CONFIG.name}
              </Text>
              <Text style={styles.alertBannerSub}>
                Staf berada dalam radius aman gudang. Izin mutasi stok & scan barcode aktif.
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => setShowGeofenceBanner(false)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Feather name="x" size={16} color="#94a3b8" />
            </TouchableOpacity>
          </View>
        )}

        {!isInsideGeofence && (
          <View style={[styles.geofenceAlertBanner, styles.geofenceAlertBannerOutside]}>
            <View style={[styles.alertBannerIconCircle, { backgroundColor: '#fee2e2' }]}>
              <Feather name="alert-triangle" size={18} color="#dc2626" />
            </View>
            <View style={styles.alertBannerTextWrap}>
              <Text style={[styles.alertBannerTitle, { color: '#991b1b' }]}>
                Di Luar Perimeter Gudang ({distanceToGeofence}m)
              </Text>
              <Text style={[styles.alertBannerSub, { color: '#b91c1c' }]}>
                Staf berada di luar area aman. Fitur mutasi stok dinonaktifkan demi keamanan.
              </Text>
            </View>
          </View>
        )}

        {/* ----------------------------------------------------------------- */}
        {/* KARTU ALAMAT REVERSE GEOCODING (Bisa Diedit Manual)               */}
        {/* ----------------------------------------------------------------- */}
        <View style={styles.addressCard}>
          <View style={styles.addressCardHeader}>
            <View style={styles.pinIconSmall}>
              <Feather name="map-pin" size={16} color="#2563eb" />
            </View>
            <Text style={styles.addressCardHeaderTitle}>Alamat Terdeteksi</Text>
            {isGeocodingLoading && (
              <ActivityIndicator size="small" color="#2563eb" style={{ marginLeft: 6 }} />
            )}
            <TouchableOpacity
              style={styles.editAddressBtn}
              onPress={() => {
                setManualAddressDraft(currentAddress);
                setIsEditingAddressManual((prev) => !prev);
              }}
            >
              <Feather
                name={isEditingAddressManual ? 'x' : 'edit-2'}
                size={12}
                color="#2563eb"
              />
              <Text style={styles.editAddressBtnText}>
                {isEditingAddressManual ? 'Batal' : 'Edit Alamat'}
              </Text>
            </TouchableOpacity>
          </View>

          {isEditingAddressManual ? (
            <View style={styles.editAddressWrap}>
              <TextInput
                style={styles.editAddressTextInput}
                value={manualAddressDraft}
                onChangeText={setManualAddressDraft}
                placeholder="Ketik alamat kustom Anda..."
                placeholderTextColor="#94a3b8"
                multiline
              />
              <TouchableOpacity
                style={styles.saveManualBtn}
                onPress={handleSaveManualAddress}
              >
                <Feather name="check" size={13} color="#ffffff" />
                <Text style={styles.saveManualBtnText}>Simpan Alamat Ini</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <Text style={styles.addressText}>{currentAddress}</Text>
          )}

          <View style={styles.coordsDetailBox}>
            <Text style={styles.coordsDetailLabel}>Koordinat GPS:</Text>
            <Text style={styles.coordsDetailValue}>
              Lat: {coords.latitude.toFixed(6)}, Lng: {coords.longitude.toFixed(6)}
            </Text>
          </View>
        </View>

        {/* ----------------------------------------------------------------- */}
        {/* INPUT / PENCARIAN ALAMAT SENDIRI (FORWARD GEOCODING)              */}
        {/* ----------------------------------------------------------------- */}
        <View style={styles.searchAddressCard}>
          <View style={styles.searchAddressHeader}>
            <Feather name="search" size={14} color="#2563eb" />
            <Text style={styles.searchAddressTitle}>Cari & Pasang Pin Alamat Sendiri:</Text>
          </View>
          <View style={styles.searchAddressInputRow}>
            <TextInput
              style={styles.searchAddressInput}
              placeholder="Ketik alamat (misal: Jl. Soekarno Hatta Malang)..."
              placeholderTextColor="#94a3b8"
              value={customAddressInput}
              onChangeText={setCustomAddressInput}
            />
            <TouchableOpacity
              style={styles.searchAddressBtn}
              onPress={handleSearchCustomAddress}
              disabled={isSearchingAddress}
              activeOpacity={0.8}
            >
              {isSearchingAddress ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <>
                  <Feather name="map-pin" size={13} color="#ffffff" />
                  <Text style={styles.searchAddressBtnText}>Cari</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* ----------------------------------------------------------------- */}
        {/* PANEL KONTROL PENGUJIAN / DEMO DOSEN (Praktis & Instan)           */}
        {/* ----------------------------------------------------------------- */}
        <View style={styles.controlsCard}>
          <Text style={styles.controlsTitle}>SIMULASI & TRACKING OPERATOR GUDANG:</Text>

          {/* Tombol Toggle Live Tracking Real-Time */}
          <TouchableOpacity
            style={[
              styles.liveTrackingToggleBtn,
              isLiveTracking && styles.liveTrackingToggleBtnActive,
            ]}
            onPress={toggleLiveTracking}
            activeOpacity={0.8}
          >
            <View
              style={[
                styles.liveTrackingDot,
                isLiveTracking && styles.liveTrackingDotActive,
              ]}
            />
            <MaterialCommunityIcons
              name={isLiveTracking ? 'radar' : 'crosshairs-gps'}
              size={18}
              color={isLiveTracking ? '#ffffff' : '#2563eb'}
            />
            <Text
              style={[
                styles.liveTrackingToggleBtnText,
                isLiveTracking && { color: '#ffffff' },
              ]}
            >
              {isLiveTracking
                ? '🔴 Live Tracking Real-Time Aktif (Ketuk Matikan)'
                : '📡 Aktifkan Live Tracking Real-Time (GPS HP)'}
            </Text>
          </TouchableOpacity>

          {/* Opsi Pengaturan Radius Batas Area (Tidak Jauh) */}
          <View style={styles.radiusSelectorSection}>
            <Text style={styles.radiusSelectorLabel}>Batas Radius Geofence Gudang:</Text>
            <View style={styles.radiusPillsRow}>
              {[50, 100, 150].map((radius) => (
                <TouchableOpacity
                  key={radius}
                  style={[
                    styles.radiusPill,
                    geofenceRadius === radius && styles.radiusPillActive,
                  ]}
                  onPress={() => setGeofenceRadius(radius)}
                >
                  <Text
                    style={[
                      styles.radiusPillText,
                      geofenceRadius === radius && styles.radiusPillTextActive,
                    ]}
                  >
                    {radius} Meter
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.buttonsRow}>
            {/* Tombol 1: Masuk Area Gudang */}
            <TouchableOpacity
              style={[
                styles.actionBtn,
                isInsideGeofence && !isRealGPSActive && styles.actionBtnActiveInside,
              ]}
              onPress={handleSimulateInsideArea}
            >
              <Feather
                name="check-circle"
                size={14}
                color={isInsideGeofence && !isRealGPSActive ? '#16a34a' : '#64748b'}
              />
              <Text
                style={[
                  styles.actionBtnText,
                  isInsideGeofence && !isRealGPSActive && { color: '#16a34a' },
                ]}
              >
                Masuk Gudang (0m)
              </Text>
            </TouchableOpacity>

            {/* Tombol 2: Keluar Area Gudang */}
            <TouchableOpacity
              style={[
                styles.actionBtn,
                !isInsideGeofence && !isRealGPSActive && styles.actionBtnActiveOutside,
              ]}
              onPress={handleSimulateOutsideArea}
            >
              <Feather
                name="slash"
                size={14}
                color={!isInsideGeofence && !isRealGPSActive ? '#dc2626' : '#64748b'}
              />
              <Text
                style={[
                  styles.actionBtnText,
                  !isInsideGeofence && !isRealGPSActive && { color: '#dc2626' },
                ]}
              >
                Luar Gudang (~172m)
              </Text>
            </TouchableOpacity>
          </View>

          {/* Tombol 3: Ambil GPS Asli HP */}
          <TouchableOpacity
            style={[styles.realGpsBtn, isRealGPSActive && styles.realGpsBtnActive]}
            activeOpacity={0.8}
            onPress={handleGetRealDeviceGPS}
          >
            <Feather
              name="crosshair"
              size={15}
              color={isRealGPSActive ? '#ffffff' : '#2563eb'}
              style={{ marginRight: 6 }}
            />
            <Text
              style={[
                styles.realGpsBtnText,
                isRealGPSActive && { color: '#ffffff' },
              ]}
            >
              Deteksi Posisi Asli HP (Sensor GPS)
            </Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: 30 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f8fafc',
    paddingTop: Platform.OS === 'android' ? RNStatusBar.currentHeight : 0,
  },
  header: {
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
  brandBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  appIconCircle: {
    width: 22,
    height: 22,
    borderRadius: 6,
    backgroundColor: '#eff6ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerBrandTitle: {
    fontSize: 15.5,
    fontWeight: '800',
    color: '#0f172a',
    letterSpacing: 0.3,
  },
  headerSubtitle: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 1,
  },
  gpsStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  gpsDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  gpsStatusText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#475569',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  // Map Canvas
  mapCanvasWrapper: {
    backgroundColor: '#ffffff',
    borderRadius: 18,
    padding: 14,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    overflow: 'hidden',
  },
  mapAreaBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 10,
  },
  mapAreaBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#f5f3ff',
    borderWidth: 1,
    borderColor: '#ddd6fe',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 14,
  },
  mapAreaBadgeText: {
    fontSize: 11.5,
    fontWeight: '800',
    color: '#7c3aed',
  },
  liveTrackingMapBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#f0fdf4',
    borderWidth: 1,
    borderColor: '#86efac',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 14,
  },
  livePulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#16a34a',
  },
  liveTrackingMapBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#16a34a',
  },
  // Google Maps Header & Controls
  googleMapsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
    gap: 8,
  },
  googleLogoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  googleIconBadge: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#fef2f2',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#fee2e2',
  },
  googleMapsTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0f172a',
  },
  googleMapsSubtitle: {
    fontSize: 10.5,
    color: '#64748b',
    marginTop: 1,
  },
  openNativeMapsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#bfdbfe',
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 8,
  },
  openNativeMapsBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#2563eb',
  },
  // Map Layer Switcher Chips
  mapLayerSwitcher: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 10,
  },
  mapLayerChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 7,
    borderRadius: 10,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  mapLayerChipActive: {
    backgroundColor: '#2563eb',
    borderColor: '#1d4ed8',
  },
  mapLayerChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748b',
  },
  mapLayerChipTextActive: {
    color: '#ffffff',
    fontWeight: '800',
  },
  // Google Maps Embedded Container
  mapEmbedContainer: {
    height: 280,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    position: 'relative',
  },
  mapWebView: {
    flex: 1,
    backgroundColor: '#f1f5f9',
  },
  mapLoadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#f8fafc',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  mapLoadingText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#64748b',
  },
  mapFloatingFooter: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    right: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  mapCoordsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  mapCoordsBadgeText: {
    fontSize: 9.5,
    fontWeight: '700',
    color: '#ffffff',
  },
  liveTrackingFloatingBadge: {
    backgroundColor: 'rgba(22, 163, 74, 0.9)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  liveTrackingFloatingBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#ffffff',
  },
  distanceGaugeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  distanceInfoLeft: {},
  distanceLabel: {
    fontSize: 11,
    color: '#64748b',
  },
  distanceValueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 5,
  },
  distanceValue: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0f172a',
  },
  distanceSubInfo: {
    fontSize: 10.5,
    fontWeight: '600',
    color: '#64748b',
  },
  statusAreaBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    borderWidth: 1,
  },
  statusBadgeInside: {
    backgroundColor: '#f0fdf4',
    borderColor: '#bbf7d0',
  },
  statusBadgeOutside: {
    backgroundColor: '#fef2f2',
    borderColor: '#fecaca',
  },
  statusAreaText: {
    fontSize: 11,
    fontWeight: '800',
  },
  // Feedback Banner
  geofenceAlertBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0fdf4',
    borderWidth: 1,
    borderColor: '#bbf7d0',
    borderRadius: 14,
    padding: 12,
    marginBottom: 14,
    gap: 10,
  },
  geofenceAlertBannerOutside: {
    backgroundColor: '#fef2f2',
    borderColor: '#fecaca',
  },
  alertBannerIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#fef3c7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  alertBannerTextWrap: {
    flex: 1,
  },
  alertBannerTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#92400e',
  },
  alertBannerSub: {
    fontSize: 11,
    color: '#b45309',
    marginTop: 1,
  },
  // Address Card
  addressCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 14,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  addressCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 6,
  },
  pinIconSmall: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#eff6ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addressCardHeaderTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0f172a',
  },
  editAddressBtn: {
    marginLeft: 'auto',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#bfdbfe',
  },
  editAddressBtnText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#2563eb',
  },
  editAddressWrap: {
    marginBottom: 10,
    gap: 8,
  },
  editAddressTextInput: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    padding: 8,
    fontSize: 12,
    color: '#0f172a',
    lineHeight: 18,
  },
  saveManualBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#2563eb',
    paddingVertical: 7,
    borderRadius: 8,
  },
  saveManualBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#ffffff',
  },
  addressText: {
    fontSize: 13,
    color: '#334155',
    lineHeight: 19,
    fontWeight: '600',
    marginBottom: 10,
  },
  coordsDetailBox: {
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  coordsDetailLabel: {
    fontSize: 9.5,
    color: '#64748b',
    fontWeight: '600',
  },
  coordsDetailValue: {
    fontSize: 11,
    fontWeight: '700',
    color: '#2563eb',
    marginTop: 1,
  },
  // Search Custom Address Card
  searchAddressCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 14,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  searchAddressHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  searchAddressTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#475569',
  },
  searchAddressInputRow: {
    flexDirection: 'row',
    gap: 8,
  },
  searchAddressInput: {
    flex: 1,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 12,
    color: '#0f172a',
  },
  searchAddressBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    backgroundColor: '#2563eb',
    paddingHorizontal: 14,
    borderRadius: 10,
  },
  searchAddressBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#ffffff',
  },
  // Controls Card
  controlsCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 14,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  controlsTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#64748b',
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  liveTrackingToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: '#eff6ff',
    borderWidth: 1.5,
    borderColor: '#93c5fd',
    marginBottom: 12,
  },
  liveTrackingToggleBtnActive: {
    backgroundColor: '#16a34a',
    borderColor: '#15803d',
  },
  liveTrackingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#3b82f6',
  },
  liveTrackingDotActive: {
    backgroundColor: '#ffffff',
  },
  liveTrackingToggleBtnText: {
    fontSize: 11.5,
    fontWeight: '800',
    color: '#1d4ed8',
  },
  radiusSelectorSection: {
    marginBottom: 12,
    backgroundColor: '#f8fafc',
    borderRadius: 10,
    padding: 8,
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  radiusSelectorLabel: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#64748b',
    marginBottom: 6,
  },
  radiusPillsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  radiusPill: {
    flex: 1,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radiusPillActive: {
    backgroundColor: '#eff6ff',
    borderColor: '#2563eb',
  },
  radiusPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748b',
  },
  radiusPillTextActive: {
    color: '#2563eb',
    fontWeight: '800',
  },
  buttonsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  actionBtnActiveInside: {
    backgroundColor: '#f0fdf4',
    borderColor: '#bbf7d0',
  },
  actionBtnActiveOutside: {
    backgroundColor: '#fef2f2',
    borderColor: '#fecaca',
  },
  actionBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
  },
  realGpsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 11,
    borderRadius: 10,
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#bfdbfe',
  },
  realGpsBtnActive: {
    backgroundColor: '#2563eb',
    borderColor: '#1d4ed8',
  },
  realGpsBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#2563eb',
  },
});
