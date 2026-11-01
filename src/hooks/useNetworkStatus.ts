import { useState, useEffect, useRef, useCallback } from 'react';
import NetInfo, { NetInfoState } from '@react-native-community/netinfo';

export type NetworkConnectionState = 'online' | 'offline' | 'reconnected';

export interface UseNetworkStatusOptions {
  /**
   * Callback yang otomatis dipanggil saat koneksi internet kembali pulih (Offline -> Online).
   * Dilengkapi proteksi anti-loop dan cooldown.
   */
  onReconnect?: () => void | Promise<void>;
  /**
   * Batas waktu cooldown (dalam milidetik) untuk mencegah request berulang tanpa kendali
   * ketika terjadi lonjakan event jaringan (default: 4000ms).
   */
  cooldownMs?: number;
}

export interface NetworkStatus {
  /** Status siklus koneksi terpadu: 'online' | 'offline' | 'reconnected' */
  status: NetworkConnectionState;
  /** Apakah perangkat terhubung ke jaringan (Wi-Fi, Seluler, Ethernet, dll.) */
  isConnected: boolean;
  /** Apakah internet benar-benar dapat diakses (bukan sekadar terhubung ke router tanpa internet) */
  isInternetReachable: boolean | null;
  /** Status kemudahan: true jika terbukti offline (tidak terhubung atau tidak ada internet) */
  isOffline: boolean;
  /** Status kemudahan: true jika online dan internet aktif */
  isOnline: boolean;
  /** Jenis koneksi jaringan yang sedang aktif ('wifi', 'cellular', 'none', dll.) */
  connectionType: string;
  /** Fungsi untuk memicu pengecekan ulang status jaringan secara manual */
  refresh: () => void;
}

/**
 * =========================================================================
 * CUSTOM HOOK: useNetworkStatus
 * Memenuhi Kriteria Offline Handling:
 * 1. Mendeteksi status koneksi internet secara real-time (Online / Offline / Reconnected).
 * 2. Mengaktifkan callback onReconnect saat koneksi kembali pulih.
 * 3. Mencegah request API berulang tanpa kendali (Anti-Loop & Cooldown Protection).
 * =========================================================================
 */
export function useNetworkStatus(options?: UseNetworkStatusOptions): NetworkStatus {
  const [netState, setNetState] = useState<NetInfoState | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<NetworkConnectionState>('online');

  // Menyimpan status offline sebelumnya untuk membedakan initial load vs rekoneksi sesungguhnya
  const wasOfflineRef = useRef<boolean>(false);
  // Timestamp eksekusi rekoneksi terakhir untuk mekanisme Cooldown / Throttle
  const lastReconnectTimeRef = useRef<number>(0);
  // Flag penanda render pertama agar tidak memicu duplikasi request saat initial mount
  const isInitialMountRef = useRef<boolean>(true);
  // Timer pemulihan koneksi sementara untuk feedback visual
  const reconnectedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Menyimpan referensi callback onReconnect terbaru tanpa perlu re-subscribe listener
  const onReconnectRef = useRef(options?.onReconnect);

  useEffect(() => {
    onReconnectRef.current = options?.onReconnect;
  }, [options?.onReconnect]);

  const cooldownMs = options?.cooldownMs ?? 4000;

  // Handler pemrosesan perubahan jaringan dengan proteksi anti-loop
  const handleNetworkChange = useCallback(
    (state: NetInfoState) => {
      setNetState(state);

      const currentlyOffline =
        state.isConnected === false || state.isInternetReachable === false;

      // Bersihkan timer status reconnected sebelumnya jika ada perubahan baru
      if (reconnectedTimerRef.current) {
        clearTimeout(reconnectedTimerRef.current);
        reconnectedTimerRef.current = null;
      }

      // 1. Abaikan initial mount: Initial fetch sudah ditangani oleh useEffect masing-masing screen
      if (isInitialMountRef.current) {
        isInitialMountRef.current = false;
        if (currentlyOffline) {
          wasOfflineRef.current = true;
          setConnectionStatus('offline');
        } else {
          setConnectionStatus('online');
        }
        return;
      }

      // 2. Transisi: Online -> Offline
      if (currentlyOffline) {
        wasOfflineRef.current = true;
        setConnectionStatus('offline');
        return;
      }

      // 3. Transisi: Offline -> Online (Rekoneksi Terdeteksi)
      if (wasOfflineRef.current && !currentlyOffline) {
        const now = Date.now();
        // Proteksi Cooldown: Hanya jalankan jika telah melampaui jeda minimum (cooldownMs)
        if (now - lastReconnectTimeRef.current >= cooldownMs) {
          lastReconnectTimeRef.current = now;
          wasOfflineRef.current = false; // Reset flag agar event burst berikutnya tidak memicu panggilan ulang

          // Beri status reconnected untuk feedback visual
          setConnectionStatus('reconnected');

          if (onReconnectRef.current) {
            onReconnectRef.current();
          }

          // Setelah 3 detik kembalikan ke status online normal
          reconnectedTimerRef.current = setTimeout(() => {
            setConnectionStatus('online');
          }, 3000);
        } else {
          wasOfflineRef.current = false;
          setConnectionStatus('online');
        }
      } else if (!currentlyOffline) {
        setConnectionStatus('online');
      }
    },
    [cooldownMs]
  );

  useEffect(() => {
    let isMounted = true;

    // Ambil status jaringan awal
    NetInfo.fetch().then((state) => {
      if (isMounted) {
        handleNetworkChange(state);
      }
    });

    // Berlangganan event perubahan status jaringan secara real-time
    const unsubscribe = NetInfo.addEventListener((state) => {
      if (isMounted) {
        handleNetworkChange(state);
      }
    });

    return () => {
      isMounted = false;
      unsubscribe();
      if (reconnectedTimerRef.current) {
        clearTimeout(reconnectedTimerRef.current);
      }
    };
  }, [handleNetworkChange]);

  const refresh = useCallback(() => {
    NetInfo.refresh();
  }, []);

  const isOffline = connectionStatus === 'offline';
  const isOnline = !isOffline;

  return {
    status: connectionStatus,
    isConnected: netState?.isConnected ?? true,
    isInternetReachable: netState?.isInternetReachable ?? null,
    isOffline,
    isOnline,
    connectionType: netState?.type || 'unknown',
    refresh,
  };
}
