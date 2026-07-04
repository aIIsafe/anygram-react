import React, {useCallback, useEffect, useRef, useState} from 'react';
import {Platform, StyleSheet, Text, TouchableOpacity, View} from 'react-native';
import AudioRecorderPlayer from 'react-native-audio-recorder-player';
import TdLib from 'react-native-tdlib';
import {useTheme} from '../theme';
import {useTdUpdate} from '../tdlib';

interface TdFile {
  id: number;
  local?: {
    path?: string;
    is_downloading_completed?: boolean;
    can_be_downloaded?: boolean;
  };
}

interface Props {
  voiceNote: TdFile;
  duration?: number;
}

const player = new AudioRecorderPlayer();

function filePath(file: TdFile | undefined): string | undefined {
  const p = file?.local?.path;
  if (!p || !file?.local?.is_downloading_completed) {
    return undefined;
  }
  return Platform.OS === 'android' && !p.startsWith('file://') ? `file://${p}` : p;
}

function formatDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

const MessageVoice: React.FC<Props> = ({voiceNote, duration = 0}) => {
  const {theme} = useTheme();
  const fileId = voiceNote?.id;
  const [path, setPath] = useState<string | undefined>(filePath(voiceNote));
  const [playing, setPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  const listenerRef = useRef<any>(null);

  useEffect(() => {
    setPath(filePath(voiceNote));
    if (!fileId) {
      return;
    }
    if (voiceNote?.local?.is_downloading_completed) {
      return;
    }
    if (voiceNote?.local?.can_be_downloaded === false) {
      return;
    }
    TdLib.td_json_client_send({
      '@type': 'downloadFile',
      file_id: fileId,
      priority: 1,
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
    const p = filePath(file);
    if (p) {
      setPath(p);
    }
  });

  useEffect(() => {
    return () => {
      player.stopPlayer().catch(() => {});
      player.removePlayBackListener();
    };
  }, []);

  const togglePlay = useCallback(async () => {
    if (!path) {
      return;
    }
    if (playing) {
      await player.stopPlayer();
      player.removePlayBackListener();
      setPlaying(false);
      setPosition(0);
      return;
    }
    await player.startPlayer(path);
    setPlaying(true);
    listenerRef.current = player.addPlayBackListener(meta => {
      setPosition(Math.floor(meta.currentPosition / 1000));
      if (meta.currentPosition >= meta.duration) {
        setPlaying(false);
        setPosition(0);
        player.stopPlayer().catch(() => {});
        player.removePlayBackListener();
      }
    });
  }, [path, playing]);

  const total = duration || Math.max(position, 1);
  const progress = total > 0 ? Math.min(position / total, 1) : 0;

  return (
    <View style={styles.row}>
      <TouchableOpacity
        onPress={togglePlay}
        disabled={!path}
        style={[styles.playBtn, {backgroundColor: theme.primary}]}
        activeOpacity={0.8}>
        <Text style={styles.playIcon}>{playing ? '⏸' : '▶'}</Text>
      </TouchableOpacity>
      <View style={styles.body}>
        <View style={[styles.track, {backgroundColor: theme.divider}]}>
          <View
            style={[
              styles.fill,
              {backgroundColor: theme.primary, width: `${progress * 100}%`},
            ]}
          />
        </View>
        <Text style={[styles.time, {color: theme.textSecondary}]}>
          {formatDuration(playing ? position : total)}
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  row: {flexDirection: 'row', alignItems: 'center', minWidth: 180, paddingVertical: 2},
  playBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  playIcon: {color: '#fff', fontSize: 14, marginLeft: 1},
  body: {flex: 1},
  track: {height: 4, borderRadius: 2, overflow: 'hidden', marginBottom: 4},
  fill: {height: 4, borderRadius: 2},
  time: {fontSize: 11},
});

export default MessageVoice;
