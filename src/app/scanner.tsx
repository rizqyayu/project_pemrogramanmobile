import React, { useEffect, useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Platform,
  StatusBar as RNStatusBar,
  Modal,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather, Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import {
  CameraView,
  useCameraPermissions,
  BarcodeScanningResult,
} from 'expo-camera';

import { UI, cardShadow } from '../constants/uiTokens';
import {
  SoftBlueBackdrop,
  PrimaryGradientButton,
  SecondaryOutlineButton,
} from '../components/SoftBlueUI';
import { AccessDeniedView } from '../components/AccessDeniedView';

import { AuthSession, Barang } from '../types';
import { getSavedSession } from '../services/authService';
import { authorizeAction } from '../services/rbacService';
import { getStoreSnapshot } from '../services/inventoryStore';

/**
 * =========================================================================
 * HALAMAN 4: SCANNER KAMERA BARCODE & QR CODE (DILINDUNGI RBAC)
 * - Diizinkan: Admin Gudang & Staff Inventory
 * - Ditolak (403): Manajer Operasional / Belum Login
 * =========================================================================
 */
export default function ScannerScreen() {
  const insets = useSafeAreaInsets();
  const [permission, requestPermission] = useCameraPermissions();

  const [session, setSession] = useState<AuthSession | null>(null);
  const [sessionLoaded, setSessionLoaded] = useState<boolean>(false);

  const [scanned, setScanned] = useState<boolean>(false);
  const [torchOn, setTorchOn] = useState<boolean>(false);
  const [facing, setFacing] = useState<'back' | 'front'>('back');

  const [scannedItem, setScannedItem] = useState<Barang | null>(null);
  const [scannedCode, setScannedCode] = useState<string | null>(null);
  const [modalVisible, setModalVisible] = useState<boolean>(false);

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
    return () => {
      active = false;
    };
  }, []);

  const authCheck = authorizeAction(session, 'barcode:scan');

  const processBarcode = (code: string) => {
    const guard = authorizeAction(session, 'barcode:scan');
    if (!guard.allowed) return;

    setScanned(true);
    const cleanCode = code.trim();
    setScannedCode(cleanCode);

    const { barangList } = getStoreSnapshot();
    const match = barangList.find(
      (b) =>
        b.kode_barang.toLowerCase() === cleanCode.toLowerCase() ||
        String(b.id) === cleanCode
    );

    setScannedItem(match || null);
    setModalVisible(true);
  };

  const handleBarcodeScanned = (result: BarcodeScanningResult) => {
    if (scanned) return;
    processBarcode(result.data);
  };

  const resetScan = () => {
    setScanned(false);
    setScannedItem(null);
    setScannedCode(null);
    setModalVisible(false);
  };

  const formatRupiah = (num: number) => {
    return 'Rp ' + Number(num).toLocaleString('id-ID');
  };

  if (!sessionLoaded) {
    return (
      <SoftBlueBackdrop>
        <SafeAreaView style={styles.permissionContainer}>
          <ActivityIndicator size="large" color={UI.colors.primary} />
        </SafeAreaView>
      </SoftBlueBackdrop>
    );
  }

  // ROUTE-LEVEL RBAC GUARD: Blokir Manajer Operasional / User belum login
  if (!authCheck.allowed) {
    return (
      <SoftBlueBackdrop>
        <SafeAreaView style={styles.safeArea}>
          <AccessDeniedView
            title={authCheck.statusCode === 401 ? 'Sesi Diperlukan' : 'Akses Scanner Ditolak (403)'}
            message={
              authCheck.reason ||
              'Peran Anda tidak memiliki akses ke pemindaian barcode operasional.'
            }
            roleName={session?.user?.role}
            actionLabel={authCheck.statusCode === 401 ? 'Ke Halaman Login' : 'Kembali ke Dashboard'}
            onAction={() =>
              authCheck.statusCode === 401 ? router.replace('/') : router.back()
            }
          />
        </SafeAreaView>
      </SoftBlueBackdrop>
    );
  }

  if (!permission) {
    return (
      <SoftBlueBackdrop>
        <SafeAreaView style={styles.permissionContainer}>
          <Text style={styles.permissionText}>Memeriksa sensor kamera...</Text>
        </SafeAreaView>
      </SoftBlueBackdrop>
    );
  }

  if (!permission.granted) {
    return (
      <SoftBlueBackdrop>
        <SafeAreaView style={styles.permissionContainer}>
          <View style={styles.permissionCard}>
            <View style={styles.cameraIconBadge}>
              <Feather name="camera" size={30} color={UI.colors.primary} />
            </View>
            <Text style={styles.permissionTitle}>Izin Akses Kamera Diperlukan</Text>
            <Text style={styles.permissionDesc}>
              EduStock membutuhkan akses ke sensor kamera untuk memindai barcode dan QR code pada label barang gudang.
            </Text>
            <PrimaryGradientButton
              label="Izinkan Sensor Kamera"
              iconLeft={<Feather name="check" size={16} color="#FFFFFF" />}
              onPress={requestPermission}
              style={{ width: '100%', marginBottom: 10 }}
            />
            <SecondaryOutlineButton
              label="Kembali ke Dashboard"
              onPress={() => router.back()}
              style={{ width: '100%', height: 42 }}
            />
          </View>
        </SafeAreaView>
      </SoftBlueBackdrop>
    );
  }

  return (
    <SoftBlueBackdrop>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <View style={styles.topHeader}>
          <TouchableOpacity
            style={styles.headerBackBtn}
            activeOpacity={0.75}
            onPress={() => router.back()}
          >
            <Feather name="arrow-left" size={19} color={UI.colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerScannerTitle}>Scan Barcode</Text>
          <View style={{ width: 36 }} />
        </View>

        <View style={styles.cameraCardWrapper}>
          <CameraView
            style={StyleSheet.absoluteFill}
            facing={facing}
            enableTorch={torchOn}
            barcodeScannerSettings={{
              barcodeTypes: [
                'qr',
                'code128',
                'code39',
                'ean13',
                'ean8',
                'upc_a',
                'upc_e',
              ],
            }}
            onBarcodeScanned={scanned ? undefined : handleBarcodeScanned}
          />

          <View style={styles.cameraTopActions}>
            <TouchableOpacity
              style={[styles.controlCircle, torchOn && styles.controlCircleActive]}
              activeOpacity={0.75}
              onPress={() => setTorchOn((prev) => !prev)}
            >
              <Feather
                name={torchOn ? 'zap' : 'zap-off'}
                size={17}
                color={torchOn ? UI.colors.warning : '#FFFFFF'}
              />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.controlCircle}
              activeOpacity={0.75}
              onPress={() =>
                setFacing((prev) => (prev === 'back' ? 'front' : 'back'))
              }
            >
              <Ionicons name="camera-reverse" size={19} color="#FFFFFF" />
            </TouchableOpacity>
          </View>

          <View style={styles.viewfinderContainer} pointerEvents="none">
            <View style={styles.viewfinderFrame}>
              <View style={[styles.corner, styles.topLeft]} />
              <View style={[styles.corner, styles.topRight]} />
              <View style={[styles.corner, styles.bottomLeft]} />
              <View style={[styles.corner, styles.bottomRight]} />
              <View style={styles.laserLine} />
            </View>
          </View>
        </View>

        <Text style={styles.viewfinderHint}>
          Arahkan kamera ke barcode pada barang
        </Text>

        <View
          style={[
            styles.bottomCard,
            { paddingBottom: Math.max(insets.bottom, 16) },
          ]}
        >
          <Text style={styles.demoTitle}>Simulasi Pengujian Barcode (Tanpa Fisik)</Text>
          <View style={styles.demoButtonsRow}>
            <SecondaryOutlineButton
              label="BRG-0001 (Laptop)"
              iconLeft={<Feather name="box" size={14} color={UI.colors.primary} />}
              onPress={() => processBarcode('BRG-0001')}
              style={styles.demoBtn}
              textStyle={styles.demoBtnText}
            />
            <SecondaryOutlineButton
              label="BRG-0002 (Proyektor)"
              iconLeft={<Feather name="box" size={14} color={UI.colors.primary} />}
              onPress={() => processBarcode('BRG-0002')}
              style={styles.demoBtn}
              textStyle={styles.demoBtnText}
            />
          </View>
        </View>

        <Modal
          visible={modalVisible}
          transparent={true}
          animationType="slide"
          onRequestClose={resetScan}
        >
          <View style={styles.modalBackdrop}>
            <View
              style={[
                styles.modalContent,
                { paddingBottom: Math.max(insets.bottom, 20) },
              ]}
            >
              <View style={styles.sheetHandle} />

              {scannedItem ? (
                <>
                  <View style={styles.modalHeaderRow}>
                    <View style={styles.successIconCircle}>
                      <Feather name="check-circle" size={22} color={UI.colors.success} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.modalSuccessTitle}>Barang Dikenali</Text>
                      <Text style={styles.modalCodeText}>Kode: {scannedItem.kode_barang}</Text>
                    </View>
                  </View>

                  <View style={styles.scannedItemBox}>
                    <Text style={styles.scannedItemName}>{scannedItem.nama_barang}</Text>
                    <Text style={styles.scannedItemKategori}>
                      Kategori: {scannedItem.kategori}
                    </Text>

                    <View style={styles.scannedMetaRow}>
                      <View style={styles.metaBadge}>
                        <Text style={styles.metaBadgeLabel}>Sisa Stok</Text>
                        <Text style={styles.metaBadgeValue}>
                          {scannedItem.stok} {scannedItem.satuan}
                        </Text>
                      </View>
                      <View style={styles.metaBadge}>
                        <Text style={styles.metaBadgeLabel}>Lokasi Rak</Text>
                        <Text style={styles.metaBadgeValue}>{scannedItem.lokasi_rak}</Text>
                      </View>
                      <View style={styles.metaBadge}>
                        <Text style={styles.metaBadgeLabel}>Status</Text>
                        <Text
                          style={[
                            styles.metaBadgeValue,
                            scannedItem.status_stok === 'Habis' && { color: UI.colors.dangerDark },
                            scannedItem.status_stok === 'Menipis' && { color: UI.colors.warningDark },
                            scannedItem.status_stok === 'Aman' && { color: UI.colors.success },
                          ]}
                        >
                          {scannedItem.status_stok}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.scannedPriceRow}>
                      <Text style={styles.scannedPriceLabel}>Harga Jual</Text>
                      <Text style={styles.scannedPriceText}>
                        {formatRupiah(scannedItem.harga_jual)}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.modalActions}>
                    <PrimaryGradientButton
                      label="Buka di Daftar Barang"
                      iconLeft={<Feather name="list" size={16} color="#FFFFFF" />}
                      onPress={() => {
                        resetScan();
                        router.push('/barang');
                      }}
                    />
                    <SecondaryOutlineButton
                      label="Scan Barang Lain"
                      iconLeft={<Feather name="refresh-cw" size={15} color={UI.colors.primary} />}
                      onPress={resetScan}
                    />
                  </View>
                </>
              ) : (
                <>
                  <View style={styles.modalHeaderRow}>
                    <View style={[styles.successIconCircle, { backgroundColor: UI.colors.dangerBg }]}>
                      <Feather name="alert-triangle" size={22} color={UI.colors.dangerDark} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.modalSuccessTitle, { color: UI.colors.dangerDark }]}>
                        Barang Tidak Ditemukan
                      </Text>
                      <Text style={styles.modalCodeText}>Kode Scan: {scannedCode}</Text>
                    </View>
                  </View>
                  <Text style={styles.notFoundDesc}>
                    Kode ini belum terdaftar di database inventaris EduStock. Silakan periksa kembali barcode produk.
                  </Text>
                  <PrimaryGradientButton
                    label="Scan Ulang"
                    iconLeft={<Feather name="refresh-cw" size={16} color="#FFFFFF" />}
                    onPress={resetScan}
                  />
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
  safeArea: {
    flex: 1,
    width: '100%',
    paddingTop: Platform.OS === 'android' ? RNStatusBar.currentHeight : 0,
  },
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 11,
  },
  headerBackBtn: {
    width: 36,
    height: 36,
    borderRadius: 11,
    backgroundColor: UI.colors.surface,
    borderWidth: 1,
    borderColor: UI.colors.borderSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerScannerTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: UI.colors.text,
  },
  cameraCardWrapper: {
    flex: 1,
    marginHorizontal: 16,
    borderRadius: UI.radius.xl,
    overflow: 'hidden',
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: UI.colors.primaryBorder,
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
    ...cardShadow,
  },
  cameraTopActions: {
    position: 'absolute',
    top: 12,
    right: 12,
    flexDirection: 'row',
    gap: 8,
    zIndex: 10,
  },
  controlCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(15, 23, 42, 0.58)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  controlCircleActive: {
    backgroundColor: 'rgba(245, 158, 11, 0.35)',
    borderWidth: 1,
    borderColor: UI.colors.warning,
  },
  viewfinderContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewfinderFrame: {
    width: 228,
    height: 228,
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderRadius: 16,
  },
  corner: {
    position: 'absolute',
    width: 32,
    height: 32,
    borderColor: UI.colors.primaryMid,
  },
  topLeft: {
    top: 0,
    left: 0,
    borderTopWidth: 4,
    borderLeftWidth: 4,
    borderTopLeftRadius: 14,
  },
  topRight: {
    top: 0,
    right: 0,
    borderTopWidth: 4,
    borderRightWidth: 4,
    borderTopRightRadius: 14,
  },
  bottomLeft: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 4,
    borderLeftWidth: 4,
    borderBottomLeftRadius: 14,
  },
  bottomRight: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 4,
    borderRightWidth: 4,
    borderBottomRightRadius: 14,
  },
  laserLine: {
    width: '84%',
    height: 2,
    backgroundColor: UI.colors.danger,
  },
  viewfinderHint: {
    color: UI.colors.secondary,
    fontSize: 12.5,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 14,
    marginBottom: 14,
  },
  bottomCard: {
    paddingHorizontal: 16,
  },
  demoTitle: {
    color: UI.colors.secondary,
    fontSize: 11.5,
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center',
  },
  demoButtonsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  demoBtn: {
    flex: 1,
    height: 44,
  },
  demoBtnText: {
    fontSize: 11.5,
  },

  permissionContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  permissionCard: {
    backgroundColor: UI.colors.surface,
    borderRadius: UI.radius.xl,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: UI.colors.borderSoft,
    maxWidth: 340,
    width: '100%',
    ...cardShadow,
  },
  cameraIconBadge: {
    width: 66,
    height: 66,
    borderRadius: 20,
    backgroundColor: UI.colors.primaryLight,
    borderWidth: 1,
    borderColor: UI.colors.primaryBorder,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  permissionTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: UI.colors.text,
    textAlign: 'center',
    marginBottom: 8,
  },
  permissionDesc: {
    fontSize: 12.5,
    color: UI.colors.secondary,
    textAlign: 'center',
    lineHeight: 19,
    marginBottom: 20,
  },
  permissionText: {
    color: UI.colors.secondary,
    fontSize: 14,
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
  modalContent: {
    backgroundColor: UI.colors.surface,
    backgroundImage: UI.gradients.headerSoft,
    borderTopLeftRadius: UI.radius.sheet,
    borderTopRightRadius: UI.radius.sheet,
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  modalHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 14,
  },
  successIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: UI.colors.successBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalSuccessTitle: {
    fontSize: 16.5,
    fontWeight: '800',
    color: UI.colors.success,
  },
  modalCodeText: {
    fontSize: 12,
    color: UI.colors.secondary,
    fontWeight: '600',
    marginTop: 1,
  },
  scannedItemBox: {
    backgroundColor: UI.colors.surface,
    borderRadius: UI.radius.lg,
    padding: 14,
    borderWidth: 1,
    borderColor: UI.colors.borderSoft,
    marginBottom: 16,
  },
  scannedItemName: {
    fontSize: 15.5,
    fontWeight: '800',
    color: UI.colors.text,
    marginBottom: 2,
  },
  scannedItemKategori: {
    fontSize: 12,
    color: UI.colors.secondary,
    marginBottom: 12,
  },
  scannedMetaRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  metaBadge: {
    flex: 1,
    backgroundColor: UI.colors.background,
    padding: 9,
    borderRadius: UI.radius.sm,
    borderWidth: 1,
    borderColor: UI.colors.borderSoft,
  },
  metaBadgeLabel: {
    fontSize: 10,
    color: UI.colors.secondary,
    fontWeight: '600',
    marginBottom: 2,
  },
  metaBadgeValue: {
    fontSize: 12,
    fontWeight: '700',
    color: UI.colors.text,
  },
  scannedPriceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: UI.colors.borderSubtle,
  },
  scannedPriceLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: UI.colors.secondary,
  },
  scannedPriceText: {
    fontSize: 14.5,
    fontWeight: '800',
    color: UI.colors.primary,
  },
  notFoundDesc: {
    fontSize: 12.5,
    color: UI.colors.secondary,
    lineHeight: 19,
    marginBottom: 16,
  },
  modalActions: {
    gap: 10,
  },
});
