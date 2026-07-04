/**
 * Telegram-style composer — pinned above keyboard with native glass blur.
 */

import React, {useMemo} from 'react';
import {
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import LiquidGlass from './LiquidGlass';
import {AppTheme} from '../theme';

interface Props {
  theme: AppTheme;
  value: string;
  onChangeText: (text: string) => void;
  onSend: () => void;
  sending: boolean;
  keyboardVisible: boolean;
}

const ChatComposer: React.FC<Props> = ({
  theme,
  value,
  onChangeText,
  onSend,
  sending,
  keyboardVisible,
}) => {
  const insets = useSafeAreaInsets();
  const styles = useMemo(
    () => createStyles(theme, insets.bottom, keyboardVisible),
    [theme, insets.bottom, keyboardVisible],
  );

  const canSend = !sending && value.trim().length > 0;

  return (
    <LiquidGlass intensity="soft" compact native style={styles.glass}>
      <View style={styles.bar}>
        <TouchableOpacity style={styles.attachBtn} activeOpacity={0.6}>
          <Text style={styles.attachIcon}>📎</Text>
        </TouchableOpacity>

        <View style={styles.fieldWrap}>
          <TextInput
            value={value}
            onChangeText={onChangeText}
            placeholder="Сообщение"
            placeholderTextColor={theme.textTertiary}
            style={styles.input}
            multiline
            maxLength={4096}
            scrollEnabled={false}
            textAlignVertical="center"
            underlineColorAndroid="transparent"
          />
        </View>

        <TouchableOpacity
          onPress={onSend}
          disabled={!canSend}
          style={[styles.actionBtn, canSend && styles.actionBtnActive]}
          activeOpacity={0.75}>
          <Text style={[styles.actionIcon, canSend && styles.actionIconActive]}>
            {canSend ? '➤' : '🎤'}
          </Text>
        </TouchableOpacity>
      </View>
    </LiquidGlass>
  );
};

function createStyles(
  theme: AppTheme,
  bottomInset: number,
  keyboardVisible: boolean,
) {
  const bottomPad = keyboardVisible
    ? Platform.OS === 'ios'
      ? 6
      : 8
    : Math.max(bottomInset, 8);

  return StyleSheet.create({
    glass: {
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: theme.glassBorder,
    },
    bar: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      paddingHorizontal: 8,
      paddingTop: 8,
      paddingBottom: bottomPad,
    },
    attachBtn: {
      width: 40,
      height: 40,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 2,
    },
    attachIcon: {
      fontSize: 22,
      opacity: 0.85,
    },
    fieldWrap: {
      flex: 1,
      minHeight: 40,
      maxHeight: 120,
      justifyContent: 'center',
      marginHorizontal: 4,
      borderRadius: 20,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.glassBorder,
      backgroundColor:
        theme.mode === 'dark'
          ? 'rgba(255,255,255,0.06)'
          : 'rgba(255,255,255,0.45)',
      paddingHorizontal: 14,
      paddingVertical: Platform.OS === 'ios' ? 8 : 6,
    },
    input: {
      fontSize: 16,
      lineHeight: 20,
      color: theme.textPrimary,
      padding: 0,
      margin: 0,
      maxHeight: 100,
    },
    actionBtn: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 2,
    },
    actionBtnActive: {
      backgroundColor: theme.primary,
    },
    actionIcon: {
      fontSize: 20,
      color: theme.textSecondary,
    },
    actionIconActive: {
      color: theme.textOnPrimary,
      marginLeft: 2,
    },
  });
}

export default ChatComposer;
