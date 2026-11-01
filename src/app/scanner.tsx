import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Platform,
  StatusBar as RNStatusBar,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather, Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import {
  CameraView,
  useCameraPermissions,
  BarcodeScanningResult,
} from 'expo-camera';

// Import Types & Data Service
import { Barang } from '../types';
import { getLoadedInventoryData } from '../services/dataService';

/**
 * =========================================================================
 * HALAMAN 4: SCANNER KAMERA BARCODE & QR CODE (src/app/scanner.tsx)
 * Fitur Sensor Kamera:
 * 1. Menggunakan CameraView & useCameraPermissions dari 'expo-camera'
 * 2. Membaca Barcode & QR Code barang inventaris EduStock secara real-time
 * 3. Menampilkan detail barang yang cocok dari database inventaris
 * 4. Navigasi kembali ke Dashboard dengan router.back()
 * =========================================================================
 */
export default function ScannerScreen() {
  // 1. Hook Izin Sensor Kamera
  const [permission, requestPermission] = useCameraPermissions();

  // 2. State Kamera & Pemindaian
  const [scanned, setScanned] = useState<boolean>(false);
  const [torchOn, setTorchOn] = useState<boolean>(false);
  const [facing, setFacing] = useState<'back' | 'front'>('back');

  // 3. State Hasil Scan
  const [scannedItem, setScannedItem] = useState<Barang | null>(null);
  const [scannedCode, setScannedCode] = useState<string | null>(null);
  const [modalVisible, setModalVisible] = useState<boolean>(false);

  // Ambil data barang dari database lokal untuk pencocokan barcode
  const { barangList } = getLoadedInventoryData();

  // -----------------------------------------------------------------------
  // HANDLER: Proses Barcode yang Berhasil Dipindai
  // -----------------------------------------------------------------------
  const processBarcode = (code: string) => {
    setScanned(true);
    const cleanCode = code.trim();
    setScannedCode(cleanCode);

    // Cari barang berdasarkan kode_barang atau id
    const match = barangList.find(
      (b) =>
        b.kode_barang.toLowerCase() === cleanCode.toLowerCase() ||
        String(b.id) === cleanCode
    );

    if (match) {
      setScannedItem(match);
    } else {
      setScannedItem(null);
    }

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

  // Format Rupiah
  const formatRupiah = (num: number) => {
    return 'Rp ' + Number(num).toLocaleString('id-ID');
  };

  // -----------------------------------------------------------------------
  // TAMPILAN: JIKA IZIN KAMERA BELUM DIBERIKAN
  // -----------------------------------------------------------------------
  if (!permission) {
    return (
      <SafeAreaView style={styles.permissionContainer}>
        <Text style={styles.permissionText}>Memeriksa sensor kamera...</Text>
      </SafeAreaView>
    );
  }

  if (!permission.granted) {
    return (
      <SafeAreaView style={styles.permissionContainer}>
        <View style={styles.permissionCard}>
          <View style={styles.cameraIconBadge}>
            <Feather name="camera" size={36} color="#2563eb" />
          </View>
          <Text style={styles.permissionTitle}>Izin Akses Kamera Diperlukan</Text>
          <Text style={styles.permissionDesc}>
            EduStock membutuhkan akses ke sensor kamera untuk memindai barcode dan QR code pada label barang gudang.
          </Text>
          <TouchableOpacity
            style={styles.grantButton}
            activeOpacity={0.8}
            onPress={requestPermission}
          >
            <Feather name="check" size={18} color="#ffffff" />
            <Text style={styles.grantButtonText}>Izinkan Sensor Kamera</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.cancelBtn}
            onPress={() => router.back()}
          >
            <Text style={styles.cancelBtnText}>Kembali ke Dashboard</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // -----------------------------------------------------------------------
  // TAMPILAN UTAMA: KAMERA SCANNER AKTIF
  // -----------------------------------------------------------------------
  return (
    <View style={styles.container}>
      {/* Sensor Kamera Aktif */}
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

      {/* Overlay UI di atas Kamera */}
      <SafeAreaView style={styles.overlay}>
        {/* Header Top Controls */}
        <View style={styles.topControls}>
          <TouchableOpacity
            style={styles.controlCircle}
            activeOpacity={0.7}
            onPress={() => router.back()}
          >
            <Feather name="arrow-left" size={20} color="#ffffff" />
          </TouchableOpacity>

          <Text style={styles.headerScannerTitle}>Scan Barcode Barang</Text>

          {/* Toggle Senter / Torch */}
          <TouchableOpacity
            style={[styles.controlCircle, torchOn && styles.controlCircleActive]}
            activeOpacity={0.7}
            onPress={() => setTorchOn((prev) => !prev)}
          >
            <Feather
              name={torchOn ? 'zap' : 'zap-off'}
              size={18}
              color={torchOn ? '#f59e0b' : '#ffffff'}
            />
          </TouchableOpacity>

          {/* Toggle Kamera Depan / Belakang */}
          <TouchableOpacity
            style={styles.controlCircle}
            activeOpacity={0.7}
            onPress={() =>
              setFacing((prev) => (prev === 'back' ? 'front' : 'back'))
            }
          >
            <Ionicons name="camera-reverse" size={20} color="#ffffff" />
          </TouchableOpacity>
        </View>

        {/* Viewfinder / Reticle Kotak Scanner */}
        <View style={styles.viewfinderContainer}>
          <View style={styles.viewfinderFrame}>
            {/* Sudut-Sudut Reticle */}
            <View style={[styles.corner, styles.topLeft]} />
            <View style={[styles.corner, styles.topRight]} />
            <View style={[styles.corner, styles.bottomLeft]} />
            <View style={[styles.corner, styles.bottomRight]} />

            {/* Garis Merah Laser Pemindai */}
            <View style={styles.laserLine} />
          </View>
          <Text style={styles.viewfinderHint}>
            Arahkan kamera ke Barcode / QR Code produk
          </Text>
        </View>

        {/* Tombol Bantuan & Simulasi Demo */}
        <View style={styles.bottomCard}>
          <Text style={styles.demoTitle}>Simulasi Pengujian Barcode (Tanpa Fisik):</Text>
          <View style={styles.demoButtonsRow}>
            <TouchableOpacity
              style={styles.demoPill}
              activeOpacity={0.7}
              onPress={() => processBarcode('BRG-0001')}
            >
              <Feather name="box" size={13} color="#2563eb" />
              <Text style={styles.demoPillText}>BRG-0001 (Laptop)</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.demoPill}
              activeOpacity={0.7}
              onPress={() => processBarcode('BRG-0002')}
            >
              <Feather name="box" size={13} color="#0891b2" />
              <Text style={styles.demoPillText}>BRG-0002 (Proyektor)</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>

      {/* ----------------------------------------------------------------- */}
      {/* MODAL HASIL SCAN BARCODE                                         */}
      {/* ----------------------------------------------------------------- */}
      <Modal
        visible={modalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={resetScan}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalContent}>
            {scannedItem ? (
              // JIKA BARANG DITEMUKAN
              <>
                <View style={styles.modalHeaderRow}>
                  <View style={styles.successIconCircle}>
                    <Feather name="check-circle" size={24} color="#16a34a" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.modalSuccessTitle}>Barang Dikenali!</Text>
                    <Text style={styles.modalCodeText}>Kode: {scannedItem.kode_barang}</Text>
                  </View>
                </View>

                {/* Info Card Barang */}
                <View style={styles.scannedItemBox}>
                  <Text style={styles.scannedItemName}>{scannedItem.nama_barang}</Text>
                  <Text style={styles.scannedItemKategori}>Kategori: {scannedItem.kategori}</Text>

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
                          scannedItem.status_stok === 'Habis' && { color: '#dc2626' },
                          scannedItem.status_stok === 'Menipis' && { color: '#d97706' },
                        ]}
                      >
                        {scannedItem.status_stok}
                      </Text>
                    </View>
                  </View>

                  <Text style={styles.scannedPriceText}>
                    Harga Jual: {formatRupiah(scannedItem.harga_jual)}
                  </Text>
                </View>

                {/* Tombol Aksi */}
                <View style={styles.modalActions}>
                  <TouchableOpacity
                    style={styles.viewCatalogBtn}
                    onPress={() => {
                      resetScan();
                      router.push('/barang');
                    }}
                  >
                    <Feather name="list" size={16} color="#ffffff" />
                    <Text style={styles.viewCatalogBtnText}>Buka di Daftar Barang</Text>
                  </TouchableOpacity>

                  <TouchableOpacity style={styles.rescanBtn} onPress={resetScan}>
                    <Feather name="refresh-cw" size={15} color="#2563eb" />
                    <Text style={styles.rescanBtnText}>Scan Barang Lain</Text>
                  </TouchableOpacity>
                </View>
              </>
            ) : (
              // JIKA BARANG TIDAK TERDAFTAR
              <>
                <View style={styles.modalHeaderRow}>
                  <View style={[styles.successIconCircle, { backgroundColor: '#fef2f2' }]}>
                    <Feather name="alert-triangle" size={24} color="#dc2626" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.modalSuccessTitle, { color: '#991b1b' }]}>
                      Barang Tidak Ditemukan
                    </Text>
                    <Text style={styles.modalCodeText}>Kode Scan: {scannedCode}</Text>
                  </View>
                </View>
                <Text style={styles.notFoundDesc}>
                  Kode ini belum terdaftar di database inventaris EduStock. Silakan periksa kembali barcode produk.
                </Text>
                <TouchableOpacity style={styles.viewCatalogBtn} onPress={resetScan}>
                  <Feather name="refresh-cw" size={16} color="#ffffff" />
                  <Text style={styles.viewCatalogBtnText}>Scan Ulang</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ==========================================
// STYLESHEET (Scanner Screen)
// ==========================================
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  overlay: {
    flex: 1,
    justifyContent: 'space-between',
    paddingTop: Platform.OS === 'android' ? RNStatusBar.currentHeight : 0,
  },
  topControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    gap: 8,
  },
  controlCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  controlCircleActive: {
    backgroundColor: 'rgba(245, 158, 11, 0.35)',
    borderWidth: 1,
    borderColor: '#f59e0b',
  },
  headerScannerTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
    textAlign: 'center',
  },
  viewfinderContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewfinderFrame: {
    width: 250,
    height: 250,
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  corner: {
    position: 'absolute',
    width: 32,
    height: 32,
    borderColor: '#2563eb',
  },
  topLeft: {
    top: 0,
    left: 0,
    borderTopWidth: 4,
    borderLeftWidth: 4,
    borderTopLeftRadius: 10,
  },
  topRight: {
    top: 0,
    right: 0,
    borderTopWidth: 4,
    borderRightWidth: 4,
    borderTopRightRadius: 10,
  },
  bottomLeft: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 4,
    borderLeftWidth: 4,
    borderBottomLeftRadius: 10,
  },
  bottomRight: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 4,
    borderRightWidth: 4,
    borderBottomRightRadius: 10,
  },
  laserLine: {
    width: '85%',
    height: 2,
    backgroundColor: '#ef4444',
    shadowColor: '#ef4444',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 6,
    elevation: 4,
  },
  viewfinderHint: {
    color: '#ffffff',
    fontSize: 12.5,
    fontWeight: '600',
    marginTop: 18,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
  },
  bottomCard: {
    backgroundColor: 'rgba(15, 23, 42, 0.92)',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderTopWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  demoTitle: {
    color: '#94a3b8',
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 8,
    textAlign: 'center',
  },
  demoButtonsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  demoPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 10,
    paddingVertical: 8,
    gap: 6,
  },
  demoPillText: {
    color: '#f8fafc',
    fontSize: 11,
    fontWeight: '700',
  },
  permissionContainer: {
    flex: 1,
    backgroundColor: '#f8fafc',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  permissionCard: {
    backgroundColor: '#ffffff',
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    maxWidth: 340,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  cameraIconBadge: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#eff6ff',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  permissionTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0f172a',
    textAlign: 'center',
    marginBottom: 8,
  },
  permissionDesc: {
    fontSize: 12.5,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 20,
  },
  grantButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2563eb',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 20,
    gap: 8,
    width: '100%',
    marginBottom: 10,
  },
  grantButtonText: {
    color: '#ffffff',
    fontSize: 13.5,
    fontWeight: '700',
  },
  cancelBtn: {
    paddingVertical: 8,
  },
  cancelBtnText: {
    color: '#64748b',
    fontSize: 12,
    fontWeight: '600',
  },
  permissionText: {
    color: '#64748b',
    fontSize: 14,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: Platform.OS === 'ios' ? 36 : 24,
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
    borderRadius: 22,
    backgroundColor: '#f0fdf4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalSuccessTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#15803d',
  },
  modalCodeText: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '600',
  },
  scannedItemBox: {
    backgroundColor: '#f8fafc',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 16,
  },
  scannedItemName: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 2,
  },
  scannedItemKategori: {
    fontSize: 11.5,
    color: '#64748b',
    marginBottom: 10,
  },
  scannedMetaRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
  },
  metaBadge: {
    flex: 1,
    backgroundColor: '#ffffff',
    padding: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  metaBadgeLabel: {
    fontSize: 9.5,
    color: '#94a3b8',
    fontWeight: '600',
    marginBottom: 2,
  },
  metaBadgeValue: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0f172a',
  },
  scannedPriceText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#2563eb',
    marginTop: 2,
  },
  notFoundDesc: {
    fontSize: 12.5,
    color: '#64748b',
    lineHeight: 18,
    marginBottom: 16,
  },
  modalActions: {
    gap: 8,
  },
  viewCatalogBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2563eb',
    borderRadius: 12,
    paddingVertical: 12,
    gap: 8,
  },
  viewCatalogBtnText: {
    color: '#ffffff',
    fontSize: 13.5,
    fontWeight: '700',
  },
  rescanBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#bfdbfe',
    borderRadius: 12,
    paddingVertical: 10,
    gap: 6,
  },
  rescanBtnText: {
    color: '#1d4ed8',
    fontSize: 13,
    fontWeight: '700',
  },
});
