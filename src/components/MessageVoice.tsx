import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import TdLib from 'react-native-tdlib';
import {
  getActiveVoiceMessageId,
  playVoiceMessage,
  seekVoicePlayback,
  stopVoicePlayback,
  subscribeVoicePlayback,
} from '../services/voicePlayer';
import {useTheme} from '../theme';
import {useTdUpdate} from '../tdlib';
import {decodeVoiceWaveform, formatVoiceDuration} from '../utils/voiceWaveform';

interface TdFile {
  id: number;
  local?: {
    path?: string;
    is_downloading_completed?: boolean;
    can_be_downloaded?: boolean;
    is_downloading_active?: boolean;
  };
}

interface Props {
  messageId: number;
  voiceNote: TdFile;
  duration?: number;
  waveform?: unknown;
  isOwn?: boolean;
}

function playbackPath(file: TdFile | undefined): string | undefined {
  const p = file?.local?.path;
  if (!p || !file?.local?.is_downloading_completed) {
    return undefined;
  }
  if (p.startsWith('file://') || p.startsWith('http')) {
    return p;
  }
  return Platform.OS === 'android' ? `file://${p}` : p;
}

const MessageVoice: React.FC<Props> = ({
  messageId,
  voiceNote,
  duration = 0,
  waveform,
  isOwn = false,
}) => {
  const {theme} = useTheme();
  const fileId = voiceNote?.id;
  const [path, setPath] = useState<string | undefined>(playbackPath(voiceNote));
  const [downloading, setDownloading] = useState(
    !!fileId && !voiceNote?.local?.is_downloading_completed,
  );
  const [playing, setPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  const [liveDuration, setLiveDuration] = useState(duration);

  const samples = useMemo(() => decodeVoiceWaveform(waveform), [waveform]);
  const total = Math.max(liveDuration || duration || 0, 1);
  const progress = Math.min(position / total, 1);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        row: {
          flexDirection: 'row',
          alignItems: 'center',
          minWidth: 210,
          maxWidth: 260,
          paddingVertical: 4,
        },
        playBtn: {
          width: 40,
          height: 40,
          borderRadius: 20,
          alignItems: 'center',
          justifyContent: 'center',
          marginRight: 10,
          backgroundColor: isOwn ? theme.primary : theme.textPrimary,
        },
        playIcon: {color: theme.textOnPrimary, fontSize: 16, marginLeft: 2},
        body: {flex: 1},
        waveform: {
          flexDirection: 'row',
          alignItems: 'center',
          height: 28,
          marginBottom: 4,
        },
        bar: {
          width: 3,
          borderRadius: 2,
          marginHorizontal: 1,
        },
        footer: {
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
        },
        time: {fontSize: 11, color: theme.textSecondary},
        hint: {fontSize: 10, color: theme.textTertiary},
      }),
    [theme, isOwn],
  );

  useEffect(() => {
    setPath(playbackPath(voiceNote));
    setDownloading(!!fileId && !voiceNote?.local?.is_downloading_completed);
  }, [fileId, voiceNote]);

  useEffect(() => {
    if (!fileId) {
      return;
    }
    if (voiceNote?.local?.is_downloading_completed) {
      setDownloading(false);
      return;
    }
    if (voiceNote?.local?.can_be_downloaded === false) {
      return;
    }
    TdLib.td_json_client_send({
      '@type': 'downloadFile',
      file_id: fileId,
      priority: 2,
      offset: 0,
      limit: 0,
      synchronous: false,
    }).catch(() => {});
  }, [fileId, voiceNote]);

  useTdUpdate('updateFile', data => {
    const file: TdFile | undefined = data?.file;
    if (!file || file.id !== fileId) {
      return;
    }
    const p = playbackPath(file);
    if (p) {
      setPath(p);
      setDownloading(false);
    } else if (file.local?.is_downloading_active) {
      setDownloading(true);
    }
  });

  useEffect(() => {
    return subscribeVoicePlayback(activeId => {
      const isActive = activeId === messageId;
      setPlaying(isActive);
      if (!isActive) {
        setPosition(0);
      }
    });
  }, [messageId]);

  useEffect(() => {
    return () => {
      if (getActiveVoiceMessageId() === messageId) {
        stopVoicePlayback().catch(() => {});
      }
    };
  }, [messageId]);

  const togglePlay = useCallback(async () => {
    if (!path) {
      return;
    }
    if (playing) {
      await stopVoicePlayback();
      return;
    }
    try {
      await playVoiceMessage(messageId, path, (pos, dur) => {
        setPosition(pos);
        if (dur > 0) {
          setLiveDuration(Math.round(dur));
        }
      });
    } catch {
      setPlaying(false);
    }
  }, [path, playing, messageId]);

  const onSeek = useCallback(
    async (event: {nativeEvent: {locationX: number}}) => {
      if (!path || total <= 0) {
        return;
      }
      const width = Math.max(samples.length * 5, 160);
      const ratio = Math.max(0, Math.min(1, event.nativeEvent.locationX / width));
      const target = ratio * total;
      setPosition(target);
      if (playing) {
        await seekVoicePlayback(target);
      }
    },
    [path, total, playing, samples.length],
  );

  const playedColor = isOwn ? theme.primaryDark : theme.primary;
  const unplayedColor = theme.mode === 'dark' ? 'rgba(255,255,255,0.22)' : 'rgba(0,0,0,0.14)';

  return (
    <View style={styles.row}>
      <Pressable
        onPress={togglePlay}
        disabled={!path && !downloading}
        style={({pressed}) => [
          styles.playBtn,
          pressed && {opacity: 0.85},
          !path && {opacity: 0.55},
        ]}>
        {downloading && !path ? (
          <ActivityIndicator color={theme.textOnPrimary} size="small" />
        ) : (
          <Text style={styles.playIcon}>{playing ? '⏸' : '▶'}</Text>
        )}
      </Pressable>

      <View style={styles.body}>
        <Pressable onPress={onSeek} style={styles.waveform}>
          {samples.map((amp, i) => {
            const barPos = (i + 0.5) / samples.length;
            const isPlayed = barPos <= progress;
            return (
              <View
                key={i}
                style={[
                  styles.bar,
                  {
                    height: 4 + amp * 22,
                    backgroundColor: isPlayed ? playedColor : unplayedColor,
                    opacity: isPlayed ? 1 : 0.85,
                  },
                ]}
              />
            );
          })}
        </Pressable>
        <View style={styles.footer}>
          <Text style={styles.time}>
            {formatVoiceDuration(playing ? position : total)}
          </Text>
          {!path && downloading ? (
            <Text style={styles.hint}>загрузка…</Text>
          ) : null}
        </View>
      </View>
    </View>
  );
};

export default MessageVoice;
