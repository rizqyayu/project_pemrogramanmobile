import React from 'react';
import {
  StyleProp,
  StyleSheet,
  Text,
  TextStyle,
  TouchableOpacity,
  View,
  ViewStyle,
} from 'react-native';
import { UI, primaryButtonShadow } from '../constants/uiTokens';

interface GradientBackdropProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

/**
 * Latar belakang Soft Blue Gradient modern yang konsisten di seluruh aplikasi.
 */
export function SoftBlueBackdrop({ children, style }: GradientBackdropProps) {
  return (
    <View style={[styles.backdrop, style]}>
      <View style={styles.orbTopRight} pointerEvents="none" />
      <View style={styles.orbTopLeft} pointerEvents="none" />
      {children}
    </View>
  );
}

interface PrimaryGradientButtonProps {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  iconLeft?: React.ReactNode;
  iconRight?: React.ReactNode;
  loadingNode?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
}

/**
 * Tombol utama seragam menggunakan Blue Gradient EduStock.
 */
export function PrimaryGradientButton({
  label,
  onPress,
  disabled,
  iconLeft,
  iconRight,
  loadingNode,
  style,
  textStyle,
}: PrimaryGradientButtonProps) {
  return (
    <TouchableOpacity
      activeOpacity={0.85}
      disabled={disabled}
      onPress={onPress}
      style={[
        styles.primaryBtn,
        disabled && styles.btnDisabled,
        style,
      ]}
    >
      {loadingNode ? (
        loadingNode
      ) : (
        <>
          {iconLeft}
          <Text style={[styles.primaryBtnText, textStyle]}>{label}</Text>
          {iconRight}
        </>
      )}
    </TouchableOpacity>
  );
}

interface SecondaryOutlineButtonProps {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  iconLeft?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
}

/**
 * Tombol sekunder seragam: Putih dengan outline biru (#2563EB).
 */
export function SecondaryOutlineButton({
  label,
  onPress,
  disabled,
  iconLeft,
  style,
  textStyle,
}: SecondaryOutlineButtonProps) {
  return (
    <TouchableOpacity
      activeOpacity={0.8}
      disabled={disabled}
      onPress={onPress}
      style={[styles.secondaryBtn, disabled && styles.btnDisabled, style]}
    >
      {iconLeft}
      <Text style={[styles.secondaryBtnText, textStyle]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    width: '100%',
    overflow: 'hidden',
    backgroundColor: UI.colors.background,
    backgroundImage: UI.gradients.pageBg,
    position: 'relative',
  },
  orbTopRight: {
    position: 'absolute',
    top: -70,
    right: -50,
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: 'rgba(59, 130, 246, 0.12)',
  },
  orbTopLeft: {
    position: 'absolute',
    top: 40,
    left: -80,
    width: 190,
    height: 190,
    borderRadius: 95,
    backgroundColor: 'rgba(147, 197, 253, 0.16)',
  },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: UI.colors.primary,
    backgroundImage: UI.gradients.primaryBtn,
    borderRadius: UI.radius.md,
    height: 46,
    paddingHorizontal: 16,
    gap: 8,
    ...primaryButtonShadow,
  },
  primaryBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.1,
  },
  secondaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: UI.colors.surface,
    borderWidth: 1.5,
    borderColor: UI.colors.primary,
    borderRadius: UI.radius.md,
    height: 46,
    paddingHorizontal: 14,
    gap: 7,
  },
  secondaryBtnText: {
    color: UI.colors.primary,
    fontSize: 13.5,
    fontWeight: '700',
  },
  btnDisabled: {
    opacity: 0.5,
  },
});
