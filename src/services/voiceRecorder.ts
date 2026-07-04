import {Platform} from 'react-native';
import AudioRecorderPlayer, {
  AudioEncoderAndroidType,
  AudioSourceAndroidType,
  AVEncoderAudioQualityIOSType,
  AVEncodingOption,
  AVModeIOSOption,
  AudioSet,
  OutputFormatAndroidType,
} from 'react-native-audio-recorder-player';

const IOS_AUDIO_SET: AudioSet = {
  AVFormatIDKeyIOS: AVEncodingOption.aac,
  AVModeIOS: AVModeIOSOption.spokenaudio,
  AVSampleRateKeyIOS: 44100,
  AVNumberOfChannelsKeyIOS: 1,
  AVEncoderAudioQualityKeyIOS: AVEncoderAudioQualityIOSType.high,
};

const ANDROID_AUDIO_SET: AudioSet = {
  AudioEncoderAndroid: AudioEncoderAndroidType.AAC,
  AudioSourceAndroid: AudioSourceAndroidType.MIC,
  OutputFormatAndroid: OutputFormatAndroidType.MPEG_4,
  AudioSamplingRateAndroid: 44100,
  AudioChannelsAndroid: 1,
};

export interface VoiceRecordingResult {
  uri: string;
  durationSec: number;
}

let recorder = new AudioRecorderPlayer();
let recordPath: string | null = null;
let startedAt = 0;

function audioSet(): AudioSet {
  return Platform.OS === 'ios' ? IOS_AUDIO_SET : ANDROID_AUDIO_SET;
}

export function isRecordingActive(): boolean {
  return recordPath != null;
}

export async function startVoiceRecording(): Promise<void> {
  if (recordPath != null) {
    return;
  }
  startedAt = Date.now();
  const path = await recorder.startRecorder(undefined, audioSet(), false);
  recordPath = path || null;
}

export async function stopVoiceRecording(): Promise<VoiceRecordingResult> {
  const fallbackPath = recordPath;
  let uri = '';
  try {
    uri = await recorder.stopRecorder();
  } catch {
    uri = fallbackPath ?? '';
  }
  recorder.removeRecordBackListener();

  recordPath = null;
  const durationSec = Math.max(0.1, (Date.now() - startedAt) / 1000);
  startedAt = 0;

  if (!uri) {
    throw new Error('Файл записи не создан');
  }

  return {uri, durationSec};
}

export async function cancelVoiceRecording(): Promise<void> {
  if (recordPath == null) {
    return;
  }
  try {
    await recorder.stopRecorder();
  } catch {
    // ignore
  }
  recorder.removeRecordBackListener();
  recordPath = null;
  startedAt = 0;
}

export function resetVoiceRecorder(): void {
  recordPath = null;
  startedAt = 0;
  recorder = new AudioRecorderPlayer();
}
