const SAMPLE_COUNT = 100;

function base64ToBytes(base64: string): Uint8Array | null {
  if (!base64) {
    return null;
  }
  try {
    const atobFn = (globalThis as {atob?: (s: string) => string}).atob;
    if (!atobFn) {
      return null;
    }
    const binary = atobFn(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  } catch {
    return null;
  }
}

function toBytes(waveform: unknown): Uint8Array | null {
  if (waveform == null) {
    return null;
  }
  if (typeof waveform === 'string') {
    return base64ToBytes(waveform);
  }
  if (Array.isArray(waveform)) {
    return new Uint8Array(waveform.map(v => Number(v) & 0xff));
  }
  return null;
}

/** Декодирует TDLib waveform (5-bit packed) в амплитуды 0..1 */
export function decodeVoiceWaveform(
  waveform: unknown,
  sampleCount = SAMPLE_COUNT,
): number[] {
  const bytes = toBytes(waveform);
  if (!bytes || bytes.length === 0) {
    return placeholderWaveform(sampleCount);
  }

  const samples: number[] = [];
  for (let i = 0; i < sampleCount; i++) {
    const byteIndex = Math.floor((i * 5) / 8);
    const bitShift = (i * 5) % 8;
    if (byteIndex >= bytes.length) {
      break;
    }
    let value = (bytes[byteIndex] >> bitShift) & 0x1f;
    if (bitShift > 3 && byteIndex + 1 < bytes.length) {
      value |= (bytes[byteIndex + 1] << (8 - bitShift)) & 0x1f;
    }
    samples.push(Math.max(0.08, value / 31));
  }

  if (samples.length === 0) {
    return placeholderWaveform(sampleCount);
  }

  return downsample(samples, 40);
}

function downsample(samples: number[], target: number): number[] {
  if (samples.length <= target) {
    return samples;
  }
  const out: number[] = [];
  const step = samples.length / target;
  for (let i = 0; i < target; i++) {
    const idx = Math.min(samples.length - 1, Math.floor(i * step));
    out.push(samples[idx]);
  }
  return out;
}

function placeholderWaveform(count: number): number[] {
  return Array.from({length: count}, (_, i) => {
    const t = i / count;
    return 0.15 + Math.abs(Math.sin(t * Math.PI * 3)) * 0.35;
  });
}

export function formatVoiceDuration(sec: number): string {
  const safe = Math.max(0, Math.round(sec));
  const m = Math.floor(safe / 60);
  const s = safe % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}
