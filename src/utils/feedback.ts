import { Alert, Platform } from 'react-native';

/**
 * Helper Alert lintas platform (Android, iOS, dan Web).
 * Di React Native Web, Alert.alert dengan tombol konfirmasi sering tidak merespons,
 * sehingga menggunakan window.alert / window.confirm ketika berjalan di Web.
 */
export function showAppAlert(title: string, message?: string) {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    window.alert(message ? `${title}\n\n${message}` : title);
    return;
  }
  Alert.alert(title, message, [{ text: 'Tutup', style: 'default' }]);
}

export function showAppConfirm(
  title: string,
  message: string,
  confirmText: string,
  onConfirm: () => void | Promise<void>,
  destructive: boolean = false
) {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    const accepted = window.confirm(`${title}\n\n${message}`);
    if (accepted) {
      void onConfirm();
    }
    return;
  }

  Alert.alert(title, message, [
    { text: 'Batal', style: 'cancel' },
    {
      text: confirmText,
      style: destructive ? 'destructive' : 'default',
      onPress: () => {
        void onConfirm();
      },
    },
  ]);
}
