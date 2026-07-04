import TdLib from 'react-native-tdlib';
import {safeJsonParse} from '../tdlib';

function normalizeLocalPath(path: string): string {
  let normalized = path.replace(/^file:\/\//, '');
  if (normalized.startsWith('/private')) {
    normalized = normalized.replace(/^\/private/, '');
  }
  return normalized;
}

function replyFields(replyToMessageId?: number) {
  if (!replyToMessageId) {
    return {};
  }
  return {
    reply_to: {
      '@type': 'inputMessageReplyToMessage',
      message_id: replyToMessageId,
    },
  };
}

async function sendMessageRequest(payload: Record<string, unknown>): Promise<void> {
  const raw = await TdLib.td_json_client_send(payload);
  if (typeof raw === 'string' && raw.includes('error')) {
    const parsed = safeJsonParse<{message?: string}>(raw);
    if (parsed?.message) {
      throw new Error(parsed.message);
    }
  }
}

export async function sendPhotoMessage(
  chatId: number,
  localUri: string,
  replyToMessageId?: number,
): Promise<void> {
  const path = normalizeLocalPath(localUri);
  await sendMessageRequest({
    '@type': 'sendMessage',
    chat_id: chatId,
    ...replyFields(replyToMessageId),
    input_message_content: {
      '@type': 'inputMessagePhoto',
      photo: {
        '@type': 'inputFileLocal',
        path,
      },
    },
  });
}

/** Пустая waveform в TDLib JSON — base64-пустая строка (bytes). */
const EMPTY_WAVEFORM = '';

export async function sendVoiceMessage(
  chatId: number,
  localUri: string,
  durationSec: number,
  replyToMessageId?: number,
): Promise<void> {
  const path = normalizeLocalPath(localUri);
  await sendMessageRequest({
    '@type': 'sendMessage',
    chat_id: chatId,
    ...replyFields(replyToMessageId),
    input_message_content: {
      '@type': 'inputMessageVoiceNote',
      voice_note: {
        '@type': 'inputFileLocal',
        path,
      },
      duration: Math.max(1, Math.round(durationSec)),
      waveform: EMPTY_WAVEFORM,
    },
  });
}
