/**
 * Telegram-style composer — pinned above keyboard with native glass blur.
 */

import React, {useMemo} from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import LiquidGlass from './LiquidGlass';
import {AppTheme} from '../theme';

interface Props {
  theme: AppTheme;
  value: string;
  onChangeText: (text: string) => void;
  onSend: () => void;
  onAttach: () => void;
  onRecordStart: () => void;
  onRecordStop: () => void;
  sending: boolean;
  recording: boolean;
  recordingSec: number;
  bottomInset: number;
}

const ChatComposer: React.FC<Props> = ({
  theme,
  value,
  onChangeText,
  onSend,
  onAttach,
  onRecordStart,
  onRecordStop,
  sending,
  recording,
  recordingSec,
  bottomInset,
}) => {
  const styles = useMemo(
    () => createStyles(theme, bottomInset),
    [theme, bottomInset],
  );

  const canSend = !sending && !recording && value.trim().length > 0;

  return (
    <LiquidGlass intensity="soft" compact native style={styles.glass}>
      {recording ? (
        <View style={styles.recordingBar}>
          <View style={styles.recordingDot} />
          <Text style={styles.recordingText}>
            Запись {recordingSec} сек — отпустите для отправки
          </Text>
        </View>
      ) : null}
      <View style={styles.bar}>
        <Pressable
          onPress={onAttach}
          disabled={sending || recording}
          style={styles.attachBtn}
          hitSlop={8}>
          <Text style={styles.attachIcon}>📎</Text>
        </Pressable>

        <View style={styles.fieldWrap}>
          <TextInput
            value={value}
            onChangeText={onChangeText}
            placeholder="Сообщение"
            placeholderTextColor={theme.textTertiary}
            style={styles.input}
            multiline
            maxLength={4096}
            editable={!recording && !sending}
            underlineColorAndroid="transparent"
          />
        </View>

        {canSend ? (
          <Pressable
            onPress={onSend}
            disabled={sending}
            style={[styles.actionBtn, styles.actionBtnActive]}
            hitSlop={8}>
            {sending ? (
              <ActivityIndicator color={theme.textOnPrimary} size="small" />
            ) : (
              <Text style={[styles.actionIcon, styles.actionIconActive]}>➤</Text>
            )}
          </Pressable>
        ) : (
          <Pressable
            onPressIn={onRecordStart}
            onPressOut={onRecordStop}
            disabled={sending}
            style={[styles.actionBtn, recording && styles.actionBtnRecording]}
            hitSlop={8}>
            <Text style={[styles.actionIcon, recording && styles.actionIconRecording]}>
              🎤
            </Text>
          </Pressable>
        )}
      </View>
    </LiquidGlass>
  );
};

function createStyles(theme: AppTheme, bottomInset: number) {
  return StyleSheet.create({
    glass: {
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: theme.glassBorder,
    },
    recordingBar: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingTop: 8,
    },
    recordingDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: theme.danger,
      marginRight: 8,
    },
    recordingText: {
      color: theme.danger,
      fontSize: 13,
      fontWeight: '600',
    },
    bar: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      paddingHorizontal: 8,
      paddingTop: 8,
      paddingBottom: Math.max(bottomInset, 8),
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
          ? 'rgba(255,255,255,0.08)'
          : 'rgba(255,255,255,0.55)',
      paddingHorizontal: 14,
      paddingVertical: Platform.OS === 'ios' ? 9 : 7,
    },
    input: {
      fontSize: 16,
      lineHeight: 20,
      color: theme.textPrimary,
      padding: 0,
      margin: 0,
      maxHeight: 96,
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
    actionBtnRecording: {
      backgroundColor: theme.danger,
    },
    actionIcon: {
      fontSize: 20,
      color: theme.textSecondary,
    },
    actionIconActive: {
      color: theme.textOnPrimary,
      marginLeft: 2,
    },
    actionIconRecording: {
      color: theme.textOnPrimary,
    },
  });
}

export default ChatComposer;
