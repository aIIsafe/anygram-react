import TdLib from 'react-native-tdlib';

function normalizeLocalPath(path: string): string {
  return path.replace(/^file:\/\//, '');
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

export async function sendPhotoMessage(
  chatId: number,
  localUri: string,
  replyToMessageId?: number,
): Promise<void> {
  const path = normalizeLocalPath(localUri);
  await TdLib.td_json_client_send({
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

export async function sendVoiceMessage(
  chatId: number,
  localUri: string,
  durationSec: number,
  replyToMessageId?: number,
): Promise<void> {
  const path = normalizeLocalPath(localUri);
  const waveform = Array.from({length: 63}, (_, i) => 12 + ((i * 11) % 88));
  await TdLib.td_json_client_send({
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
      waveform,
    },
  });
}
