import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, borderRadius } from '../theme/tokens';

interface OtpVerificationSheetProps {
  visible: boolean;
  orderNumber: string;
  onVerify: (otp: string) => Promise<void>;
  onClose: () => void;
}

export const OtpVerificationSheet: React.FC<OtpVerificationSheetProps> = ({
  visible,
  orderNumber,
  onVerify,
  onClose,
}) => {
  const [digits, setDigits] = useState(['', '', '', '', '', '']);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);

  const inputRefs = useRef<Array<any>>([]);

  const handleDigitChange = (index: number, val: string) => {
    // Only accept numbers
    const clean = val.replace(/[^0-9]/g, '');
    const newDigits = [...digits];

    if (clean.length > 1) {
      // Pasted full 6-digit OTP
      const pasted = clean.slice(0, 6).split('');
      pasted.forEach((d, i) => {
        newDigits[i] = d;
      });
      setDigits(newDigits);
      if (newDigits.every((d) => d !== '')) {
        submitOtp(newDigits.join(''));
      }
      return;
    }

    newDigits[index] = clean;
    setDigits(newDigits);
    setErrorMsg(null);

    // Auto advance
    if (clean !== '' && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    // Auto submit if all 6 filled
    if (newDigits.every((d) => d !== '')) {
      submitOtp(newDigits.join(''));
    }
  };

  const handleKeyPress = (index: number, e: any) => {
    if (e.nativeEvent.key === 'Backspace' && digits[index] === '' && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const submitOtp = async (code: string) => {
    if (code.length !== 6) {
      setErrorMsg('Please enter all 6 digits');
      return;
    }

    setIsVerifying(true);
    setErrorMsg(null);

    try {
      await onVerify(code);
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Invalid delivery OTP. Please ask customer to re-check.');
    } finally {
      setIsVerifying(false);
    }
  };

  const handleManualSubmit = () => {
    submitOtp(digits.join(''));
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <View style={styles.sheetContainer}>
          {/* Header */}
          <View style={styles.headerRow}>
            <View style={styles.iconCircle}>
              <Ionicons name="shield-checkmark" size={24} color={colors.primary} />
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={22} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <Text style={styles.title}>Customer OTP Verification</Text>
          <Text style={styles.subtitle}>
            Ask customer for the 6-digit delivery PIN for order #{orderNumber}
          </Text>

          {/* 6 Digit Input Cells */}
          <View style={styles.pinContainer}>
            {digits.map((digit, idx) => (
              <TextInput
                key={idx}
                ref={(ref) => {
                  inputRefs.current[idx] = ref;
                }}
                style={[
                  styles.pinBox,
                  digit ? styles.pinBoxFilled : null,
                  errorMsg ? styles.pinBoxError : null,
                ]}
                keyboardType="number-pad"
                maxLength={6}
                value={digit}
                onChangeText={(val) => handleDigitChange(idx, val)}
                onKeyPress={(e) => handleKeyPress(idx, e)}
                selectTextOnFocus
                textAlign="center"
              />
            ))}
          </View>

          {errorMsg && (
            <View style={styles.errorContainer}>
              <Ionicons name="alert-circle" size={16} color={colors.error} />
              <Text style={styles.errorText}>{errorMsg}</Text>
            </View>
          )}

          <TouchableOpacity
            style={[
              styles.verifyButton,
              digits.some((d) => d === '') || isVerifying ? styles.verifyButtonDisabled : null,
            ]}
            onPress={handleManualSubmit}
            disabled={digits.some((d) => d === '') || isVerifying}
            activeOpacity={0.85}
          >
            {isVerifying ? (
              <ActivityIndicator color={colors.textWhite} />
            ) : (
              <>
                <Ionicons name="checkmark-done" size={20} color={colors.textWhite} />
                <Text style={styles.verifyButtonText}>COMPLETE DELIVERY</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    padding: spacing.xxl,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 8,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.surfaceGreen,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeButton: {
    padding: spacing.xs,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  subtitle: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 4,
    marginBottom: spacing.xl,
    lineHeight: 18,
  },
  pinContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
  },
  pinBox: {
    width: 46,
    height: 54,
    borderRadius: borderRadius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surfaceMuted,
    fontSize: 22,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  pinBoxFilled: {
    borderColor: colors.primary,
    backgroundColor: colors.surface,
  },
  pinBoxError: {
    borderColor: colors.error,
    backgroundColor: colors.errorLight,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: spacing.lg,
    backgroundColor: colors.errorLight,
    padding: spacing.sm,
    borderRadius: borderRadius.sm,
  },
  errorText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.error,
    flex: 1,
  },
  verifyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 52,
    borderRadius: borderRadius.md,
    backgroundColor: colors.primary,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  verifyButtonDisabled: {
    opacity: 0.5,
  },
  verifyButtonText: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.textWhite,
    letterSpacing: 0.5,
  },
});

