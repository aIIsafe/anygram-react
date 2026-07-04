import AudioRecorderPlayer from 'react-native-audio-recorder-player';

type StopFn = () => Promise<void>;

let player = new AudioRecorderPlayer();
let activeId: number | null = null;
let activeStop: StopFn | null = null;
const listeners = new Set<(id: number | null) => void>();

function notify() {
  listeners.forEach(fn => fn(activeId));
}

export function subscribeVoicePlayback(listener: (id: number | null) => void) {
  listeners.add(listener);
  listener(activeId);
  return () => {
    listeners.delete(listener);
  };
}

export function getActiveVoiceMessageId(): number | null {
  return activeId;
}

export async function stopVoicePlayback(): Promise<void> {
  if (activeStop) {
    const stop = activeStop;
    activeStop = null;
    activeId = null;
    notify();
    await stop();
  }
}

export async function playVoiceMessage(
  messageId: number,
  path: string,
  onProgress: (positionSec: number, durationSec: number) => void,
): Promise<void> {
  await stopVoicePlayback();

  activeId = messageId;
  notify();

  await player.startPlayer(path);
  player.addPlayBackListener(meta => {
    const pos = meta.currentPosition / 1000;
    const dur = Math.max(meta.duration / 1000, 0.001);
    onProgress(pos, dur);
    if (meta.currentPosition >= meta.duration && meta.duration > 0) {
      stopVoicePlayback().catch(() => {});
    }
  });

  activeStop = async () => {
    try {
      await player.stopPlayer();
    } catch {
      // ignore
    }
    player.removePlayBackListener();
  };
}

export async function seekVoicePlayback(positionSec: number): Promise<void> {
  await player.seekToPlayer(Math.max(0, positionSec * 1000));
}

export function resetVoicePlayer(): void {
  player = new AudioRecorderPlayer();
  activeId = null;
  activeStop = null;
}
