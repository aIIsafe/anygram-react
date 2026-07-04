import {NativeModules} from 'react-native';
import {safeJsonParse} from '../tdlib';

export type ChatListKind = 'main' | 'archive';

export interface ChatSummary {
  id: number;
  title: string;
  unread_count?: number;
  last_message?: any;
  photo?: any;
  type?: any;
  positions?: any[];
}

const {TdLibModule} = NativeModules;

const LOAD_BATCH = 200;
const MAX_CHATS = 100000;

export async function loadChatsInList(
  list: ChatListKind,
  limit: number,
): Promise<'loaded' | 'end'> {
  const result = await TdLibModule.loadChatsWithList(list, limit);
  return result === 'No more chats to load' ? 'end' : 'loaded';
}

/** Загружает весь список (main или archive) без лимита страниц. */
export async function loadAllChatsInList(
  list: ChatListKind,
): Promise<ChatSummary[]> {
  for (;;) {
    const status = await loadChatsInList(list, LOAD_BATCH).catch(
      () => 'end' as const,
    );
    if (status === 'end') {
      break;
    }
  }
  const chats = await getChatsInList(list, MAX_CHATS);
  return sortChatsByOrder(chats, list);
}

export async function getChatsInList(
  list: ChatListKind,
  limit: number,
): Promise<ChatSummary[]> {
  const raw = await TdLibModule.getChatsWithList(list, limit);
  return safeJsonParse<ChatSummary[]>(raw) ?? [];
}

export async function archiveChat(chatId: number): Promise<void> {
  await TdLibModule.addChatToList(chatId, 'archive');
}

export async function unarchiveChat(chatId: number): Promise<void> {
  await TdLibModule.addChatToList(chatId, 'main');
}

export function sortChatsByOrder(
  chats: ChatSummary[],
  list: ChatListKind = 'main',
): ChatSummary[] {
  const listType = list === 'archive' ? 'chatListArchive' : 'chatListMain';
  return [...chats].sort((a, b) => {
    const ao = positionOrder(a, listType);
    const bo = positionOrder(b, listType);
    return bo - ao;
  });
}

function positionOrder(chat: ChatSummary, listType: string): number {
  const positions = chat.positions ?? [];
  const pos = positions.find(p => p?.list?.['@type'] === listType);
  return Number(pos?.order ?? 0);
}

export function totalUnread(list: ChatSummary[]): number {
  return list.reduce((sum, chat) => sum + (chat.unread_count ?? 0), 0);
}
