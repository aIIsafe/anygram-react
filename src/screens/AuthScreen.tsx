/**
 * Минималистичный экран входа с liquid glass и анимациями.
 */

import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {
  ActivityIndicator,
  Animated,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import TdLib from 'react-native-tdlib';
import AnimatedLogo from '../components/AnimatedLogo';
import AuthBackground from '../components/AuthBackground';
import LiquidGlass from '../components/LiquidGlass';
import ThemeToggle from '../components/ThemeToggle';
import {AppTheme, useTheme} from '../theme';
import {AuthStateInfo} from '../tdlib';

interface Props {
  info: AuthStateInfo;
}

const AuthScreen: React.FC<Props> = ({info}) => {
  const {theme} = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const [countryCode, setCountryCode] = useState('+7');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fade = useRef(new Animated.Value(1)).current;
  const prevState = useRef(info.state);

  useEffect(() => {
    if (prevState.current === info.state) {
      return;
    }
    prevState.current = info.state;
    fade.setValue(0);
    Animated.timing(fade, {
      toValue: 1,
      duration: 320,
      useNativeDriver: true,
    }).start();
  }, [info.state, fade]);

  const sendPhone = useCallback(async () => {
    setError(null);
    setBusy(true);
    try {
      await TdLib.login({countrycode: countryCode, phoneNumber: phone});
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setBusy(false);
    }
  }, [countryCode, phone]);

  const sendCode = useCallback(async () => {
    setError(null);
    setBusy(true);
    try {
      await TdLib.verifyPhoneNumber(code);
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setBusy(false);
    }
  }, [code]);

  const sendPassword = useCallback(async () => {
    setError(null);
    setBusy(true);
    try {
      await TdLib.verifyPassword(password);
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setBusy(false);
    }
  }, [password]);

  const startOver = useCallback(async () => {
    setError(null);
    setBusy(true);
    try {
      await TdLib.logout();
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setBusy(false);
    }
  }, []);

  if (
    info.state === 'loading' ||
    info.state === 'wait_encryption' ||
    info.state === 'closing' ||
    info.state === 'closed' ||
    info.state === 'unknown'
  ) {
    const label =
      info.state === 'closing' || info.state === 'closed'
        ? 'Выход…'
        : info.state === 'wait_encryption'
        ? 'Шифрование базы…'
        : 'Подключение к Telegram…';
    return (
      <AuthBackground>
        <View style={styles.topBar}>
          <ThemeToggle compact />
        </View>
        <View style={styles.center}>
          <AnimatedLogo />
          <ActivityIndicator size="large" color={theme.primary} />
          <Text style={styles.loading}>{label}</Text>
        </View>
      </AuthBackground>
    );
  }

  const titles: Record<string, string> = {
    wait_phone: 'Номер телефона',
    wait_code: `Код ${codeTypeLabel(info.codeType)}`,
    wait_password: 'Облачный пароль',
    wait_registration: 'Регистрация',
    wait_email: 'Подтверждение email',
  };

  const subtitles: Record<string, string> = {
    wait_phone: 'Введите номер — мы отправим код подтверждения.',
    wait_code: info.phoneNumber
      ? `Код отправлен на +${info.phoneNumber.replace(/^\+/, '')}`
      : 'Введите код из SMS или Telegram',
    wait_password: info.passwordHint
      ? `Подсказка: ${info.passwordHint}`
      : 'Аккаунт защищён двухфакторной аутентификацией',
    wait_registration: 'Номер не зарегистрирован. Создайте аккаунт в Telegram.',
    wait_email: 'Введите код из письма',
  };

  return (
    <AuthBackground>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}>
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          <View style={styles.topBar}>
            <View>
              <Text style={styles.brand}>AnyGram</Text>
              <Text style={styles.brandSub}>минималистичный клиент</Text>
            </View>
            <ThemeToggle compact />
          </View>

          <AnimatedLogo />

          <Animated.View style={{opacity: fade, width: '100%'}}>
            <LiquidGlass>
              <Text style={styles.stepIcon}>{stepIcon(info.state)}</Text>
              <Text style={styles.title}>{titles[info.state] ?? 'Вход'}</Text>
              <Text style={styles.subtitle}>
                {subtitles[info.state] ?? ''}
              </Text>

              {info.state === 'wait_phone' && (
                <View style={styles.form}>
                  <View style={styles.phoneRow}>
                    <TextInput
                      value={countryCode}
                      onChangeText={setCountryCode}
                      placeholder="+7"
                      placeholderTextColor={theme.textTertiary}
                      keyboardType="phone-pad"
                      style={[styles.input, styles.country]}
                    />
                    <TextInput
                      value={phone}
                      onChangeText={setPhone}
                      placeholder="Номер телефона"
                      placeholderTextColor={theme.textTertiary}
                      keyboardType="phone-pad"
                      style={[styles.input, styles.phone]}
                      autoFocus
                    />
                  </View>
                  <PrimaryButton
                    label="Продолжить"
                    onPress={sendPhone}
                    disabled={busy || !phone}
                    theme={theme}
                  />
                </View>
              )}

              {info.state === 'wait_code' && (
                <View style={styles.form}>
                  <TextInput
                    value={code}
                    onChangeText={setCode}
                    placeholder="• • • • •"
                    placeholderTextColor={theme.textTertiary}
                    keyboardType="number-pad"
                    style={[styles.input, styles.codeInput]}
                    autoFocus
                  />
                  <PrimaryButton
                    label="Подтвердить"
                    onPress={sendCode}
                    disabled={
                      busy ||
                      (info.codeLength
                        ? code.length < info.codeLength
                        : code.length < 4)
                    }
                    theme={theme}
                  />
                  <TextButton
                    label="Другой номер"
                    onPress={startOver}
                    disabled={busy}
                    theme={theme}
                  />
                </View>
              )}

              {info.state === 'wait_password' && (
                <View style={styles.form}>
                  <TextInput
                    value={password}
                    onChangeText={setPassword}
                    placeholder="Пароль"
                    placeholderTextColor={theme.textTertiary}
                    secureTextEntry
                    style={styles.input}
                    autoFocus
                  />
                  <PrimaryButton
                    label="Войти"
                    onPress={sendPassword}
                    disabled={busy || !password}
                    theme={theme}
                  />
                  <TextButton
                    label="Начать заново"
                    onPress={startOver}
                    disabled={busy}
                    theme={theme}
                  />
                </View>
              )}

              {info.state === 'wait_registration' && (
                <TextButton
                  label="Попробовать другой номер"
                  onPress={startOver}
                  disabled={busy}
                  theme={theme}
                />
              )}

              {error && <Text style={styles.error}>{error}</Text>}
              {busy && (
                <ActivityIndicator
                  color={theme.primary}
                  style={styles.spinner}
                />
              )}
            </LiquidGlass>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </AuthBackground>
  );
};

function stepIcon(state: string): string {
  switch (state) {
    case 'wait_phone':
      return '📱';
    case 'wait_code':
      return '✉️';
    case 'wait_password':
      return '🔐';
    case 'wait_registration':
      return '👤';
    case 'wait_email':
      return '📧';
    default:
      return '✨';
  }
}

function codeTypeLabel(type: string | undefined): string {
  switch (type) {
    case 'authenticationCodeTypeSms':
    case 'authenticationCodeTypeSmsWord':
    case 'authenticationCodeTypeSmsPhrase':
      return 'из SMS';
    case 'authenticationCodeTypeCall':
      return 'звонка';
    case 'authenticationCodeTypeTelegramMessage':
      return 'Telegram';
    default:
      return '';
  }
}

const PrimaryButton: React.FC<{
  label: string;
  onPress: () => void;
  disabled?: boolean;
  theme: AppTheme;
}> = ({label, onPress, disabled, theme}) => (
  <TouchableOpacity
    onPress={onPress}
    disabled={disabled}
    activeOpacity={0.85}
    style={[
      {
        backgroundColor: disabled ? theme.divider : theme.primary,
        borderRadius: 16,
        paddingVertical: 15,
        alignItems: 'center',
        marginTop: 12,
        shadowColor: theme.primary,
        shadowOffset: {width: 0, height: 6},
        shadowOpacity: disabled ? 0 : 0.35,
        shadowRadius: 12,
        elevation: disabled ? 0 : 4,
      },
    ]}>
    <Text style={{color: theme.textOnPrimary, fontSize: 16, fontWeight: '600'}}>
      {label}
    </Text>
  </TouchableOpacity>
);

const TextButton: React.FC<{
  label: string;
  onPress: () => void;
  disabled?: boolean;
  theme: AppTheme;
}> = ({label, onPress, disabled, theme}) => (
  <TouchableOpacity
    onPress={onPress}
    disabled={disabled}
    style={{alignItems: 'center', paddingVertical: 14, marginTop: 4}}
    activeOpacity={0.6}>
    <Text
      style={{
        color: disabled ? theme.textTertiary : theme.primary,
        fontSize: 14,
        fontWeight: '500',
      }}>
      {label}
    </Text>
  </TouchableOpacity>
);

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
    flex: {flex: 1},
    scroll: {
      flexGrow: 1,
      paddingHorizontal: 22,
      paddingBottom: 40,
      alignItems: 'center',
    },
    topBar: {
      width: '100%',
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginTop: 8,
      marginBottom: 8,
    },
    brand: {
      fontSize: 22,
      fontWeight: '700',
      color: theme.textPrimary,
      letterSpacing: -0.5,
    },
    brandSub: {
      fontSize: 12,
      color: theme.textTertiary,
      marginTop: 2,
    },
    center: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 24,
    },
    loading: {
      marginTop: 16,
      color: theme.textSecondary,
      fontSize: 15,
      fontWeight: '500',
    },
    stepIcon: {
      fontSize: 36,
      textAlign: 'center',
      marginBottom: 12,
    },
    title: {
      fontSize: 24,
      fontWeight: '700',
      color: theme.textPrimary,
      textAlign: 'center',
      marginBottom: 8,
      letterSpacing: -0.3,
    },
    subtitle: {
      fontSize: 15,
      color: theme.textSecondary,
      textAlign: 'center',
      lineHeight: 22,
      marginBottom: 4,
    },
    form: {marginTop: 8},
    phoneRow: {flexDirection: 'row', marginBottom: 4},
    country: {width: 76, textAlign: 'center', marginRight: 10},
    phone: {flex: 1},
    input: {
      borderWidth: 1,
      borderColor: theme.glassBorder,
      borderRadius: 16,
      paddingHorizontal: 16,
      paddingVertical: 14,
      fontSize: 17,
      color: theme.textPrimary,
      backgroundColor: theme.mode === 'dark' ? 'rgba(0,0,0,0.2)' : 'rgba(255,255,255,0.5)',
    },
    codeInput: {
      textAlign: 'center',
      letterSpacing: 8,
      fontSize: 22,
      fontWeight: '600',
    },
    error: {
      marginTop: 14,
      color: theme.danger,
      textAlign: 'center',
      fontSize: 13,
    },
    spinner: {marginTop: 12},
  });
}

export default AuthScreen;
