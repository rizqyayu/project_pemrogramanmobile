import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { UI, cardShadow } from '../constants/uiTokens';
import { PrimaryGradientButton } from './SoftBlueUI';

interface AccessDeniedViewProps {
  title?: string;
  message: string;
  roleName?: string;
  actionLabel?: string;
  onAction?: () => void;
}

/**
 * Tampilan standar HTTP 403 / Akses Ditolak ketika pengguna mencoba membuka
 * route, tab, atau fitur di luar kewenangan perannya.
 */
export function AccessDeniedView({
  title = 'Akses Ditolak (403)',
  message,
  roleName,
  actionLabel = 'Kembali ke Dashboard',
  onAction,
}: AccessDeniedViewProps) {
  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <View style={styles.iconCircle}>
          <Feather name="shield-off" size={28} color={UI.colors.dangerDark} />
        </View>
        {roleName ? (
          <View style={styles.rolePill}>
            <Text style={styles.rolePillText}>Peran Aktif: {roleName}</Text>
          </View>
        ) : null}
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.message}>{message}</Text>
        {onAction ? (
          <PrimaryGradientButton
            label={actionLabel}
            iconLeft={<Feather name="arrow-left" size={15} color="#FFFFFF" />}
            onPress={onAction}
            style={{ width: '100%' }}
          />
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: UI.colors.surface,
    borderWidth: 1,
    borderColor: UI.colors.dangerBorder,
    borderRadius: UI.radius.xl,
    padding: 22,
    alignItems: 'center',
    ...cardShadow,
  },
  iconCircle: {
    width: 62,
    height: 62,
    borderRadius: 20,
    backgroundColor: UI.colors.dangerBg,
    borderWidth: 1,
    borderColor: UI.colors.dangerBorder,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  rolePill: {
    backgroundColor: UI.colors.primaryLight,
    borderWidth: 1,
    borderColor: UI.colors.primaryBorder,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: UI.radius.pill,
    marginBottom: 10,
  },
  rolePillText: {
    fontSize: 11,
    fontWeight: '700',
    color: UI.colors.primary,
  },
  title: {
    fontSize: 17,
    fontWeight: '800',
    color: UI.colors.text,
    textAlign: 'center',
    marginBottom: 6,
  },
  message: {
    fontSize: 12.5,
    color: UI.colors.secondary,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 18,
  },
});
