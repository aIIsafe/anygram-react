/**
 * Chats list — main + archive folders (TDLib chatListMain / chatListArchive).
 */

import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import TdLib from 'react-native-tdlib';
import ChatAvatar from '../components/ChatAvatar';
import {colors, formatTime} from '../theme';
import {
  archiveChat,
  ChatListKind,
  ChatSummary,
  getChatsInList,
  loadChatsInList,
  sortChatsByOrder,
  totalUnread,
  unarchiveChat,
} from '../tdlib/chatLists';
import {safeJsonParse, tdEmitter} from '../tdlib';

export type {ChatSummary};

interface Props {
  onOpenChat: (chat: ChatSummary) => void;
}

const PAGE_SIZE = 25;
const REFRESH_DEBOUNCE_MS = 400;

const ChatsScreen: React.FC<Props> = ({onOpenChat}) => {
  const [listView, setListView] = useState<ChatListKind>('main');
  const [chats, setChats] = useState<ChatSummary[]>([]);
  const [archiveChats, setArchiveChats] = useState<ChatSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState<ChatSummary[] | null>(
    null,
  );

  const loadedCountRef = useRef(0);
  const inFlightRef = useRef(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const listViewRef = useRef<ChatListKind>('main');

  useEffect(() => {
    listViewRef.current = listView;
  }, [listView]);

  const refreshArchivePreview = useCallback(async () => {
    try {
      await loadChatsInList('archive', PAGE_SIZE).catch(() => 'end');
      const list = await getChatsInList('archive', PAGE_SIZE);
      setArchiveChats(list);
    } catch {
      setArchiveChats([]);
    }
  }, []);

  const refresh = useCallback(async () => {
    if (inFlightRef.current) {
      return;
    }
    inFlightRef.current = true;
    const activeList = listViewRef.current;
    setLoading(prev => prev || loadedCountRef.current === 0);
    try {
      const target = Math.max(PAGE_SIZE, loadedCountRef.current);
      if (loadedCountRef.current < target) {
        const r = await loadChatsInList(
          activeList,
          target - loadedCountRef.current,
        ).catch(() => 'end' as const);
        if (r === 'end') {
          setHasMore(false);
        }
      }
      const list = await getChatsInList(activeList, target);
      loadedCountRef.current = list.length;
      setChats(list);
      setError(null);
      if (activeList === 'main') {
        await refreshArchivePreview();
      }
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setLoading(false);
      inFlightRef.current = false;
    }
  }, [refreshArchivePreview]);

  const scheduleRefresh = useCallback(() => {
    if (debounceRef.current) {
      return;
    }
    debounceRef.current = setTimeout(() => {
      debounceRef.current = null;
      refresh();
      if (listViewRef.current === 'main') {
        refreshArchivePreview();
      }
    }, REFRESH_DEBOUNCE_MS);
  }, [refresh, refreshArchivePreview]);

  const loadMore = useCallback(async () => {
    if (inFlightRef.current || loadingMore || !hasMore) {
      return;
    }
    inFlightRef.current = true;
    setLoadingMore(true);
    const activeList = listViewRef.current;
    try {
      const r = await loadChatsInList(activeList, PAGE_SIZE).catch(
        () => 'end' as const,
      );
      if (r === 'end') {
        setHasMore(false);
      }
      const next = loadedCountRef.current + PAGE_SIZE;
      const list = await getChatsInList(activeList, next);
      if (list.length <= loadedCountRef.current) {
        setHasMore(false);
      }
      loadedCountRef.current = list.length;
      setChats(list);
    } catch {
      // swallow
    } finally {
      setLoadingMore(false);
      inFlightRef.current = false;
    }
  }, [hasMore, loadingMore]);

  const openArchive = useCallback(() => {
    loadedCountRef.current = 0;
    setHasMore(true);
    setChats([]);
    setListView('archive');
  }, []);

  const backToMain = useCallback(() => {
    loadedCountRef.current = 0;
    setHasMore(true);
    setChats([]);
    setListView('main');
  }, []);

  useEffect(() => {
    loadedCountRef.current = 0;
    setHasMore(true);
    setChats([]);
    refresh();
  }, [listView, refresh]);

  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
      if (searchTimerRef.current) {
        clearTimeout(searchTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const TYPES = new Set([
      'updateNewMessage',
      'updateChatLastMessage',
      'updateChatReadInbox',
      'updateChatTitle',
      'updateChatPhoto',
      'updateChatPosition',
      'updateNewChat',
    ]);
    const sub = tdEmitter.addListener('tdlib-update', event => {
      if (TYPES.has(event?.type)) {
        scheduleRefresh();
      }
    });
    return () => sub.remove();
  }, [scheduleRefresh]);

  useEffect(() => {
    if (!searchOpen) {
      setSearchResults(null);
      return;
    }
    if (searchTimerRef.current) {
      clearTimeout(searchTimerRef.current);
    }
    const q = query.trim();
    if (!q) {
      setSearchResults(null);
      return;
    }
    searchTimerRef.current = setTimeout(async () => {
      try {
        const raw = await TdLib.searchChats(q, 20);
        const list = safeJsonParse<ChatSummary[]>(raw) ?? [];
        setSearchResults(list);
      } catch {
        setSearchResults([]);
      }
    }, 250);
    return () => {
      if (searchTimerRef.current) {
        clearTimeout(searchTimerRef.current);
      }
    };
  }, [query, searchOpen]);

  const sortedChats = useMemo(
    () => sortChatsByOrder(chats, listView),
    [chats, listView],
  );

  const displayed = searchResults ?? sortedChats;
  const archiveUnread = useMemo(() => totalUnread(archiveChats), [archiveChats]);

  const onLogout = useCallback(() => {
    Alert.alert(
      'Выйти',
      'Выйти из аккаунта? Локальные данные будут удалены.',
      [
        {text: 'Отмена', style: 'cancel'},
        {
          text: 'Выйти',
          style: 'destructive',
          onPress: () => {
            TdLib.logout().catch(() => {});
          },
        },
      ],
    );
  }, []);

  const onChatLongPress = useCallback(
    (chat: ChatSummary) => {
      const isArchive = listView === 'archive';
      Alert.alert(chat.title || 'Чат', undefined, [
        {
          text: isArchive ? 'Вернуть из архива' : 'В архив',
          onPress: async () => {
            try {
              if (isArchive) {
                await unarchiveChat(chat.id);
              } else {
                await archiveChat(chat.id);
              }
              scheduleRefresh();
            } catch (e: any) {
              Alert.alert('Ошибка', e?.message ?? String(e));
            }
          },
        },
        {text: 'Отмена', style: 'cancel'},
      ]);
    },
    [listView, scheduleRefresh],
  );

  const renderItem = ({item}: {item: ChatSummary}) => {
    const preview = extractPreview(item.last_message);
    const time = item.last_message?.date
      ? formatTime(item.last_message.date)
      : '';
    const unread = item.unread_count ?? 0;
    return (
      <TouchableOpacity
        onPress={() => onOpenChat(item)}
        onLongPress={() => onChatLongPress(item)}
        delayLongPress={350}
        activeOpacity={0.6}
        style={styles.row}>
        <ChatAvatar id={item.id} title={item.title} photo={item.photo} size={52} />
        <View style={styles.body}>
          <View style={styles.rowTop}>
            <Text style={styles.title} numberOfLines={1}>
              {item.title || 'Без названия'}
            </Text>
            <Text style={styles.time}>{time}</Text>
          </View>
          <View style={styles.rowBottom}>
            <Text style={styles.preview} numberOfLines={1}>
              {preview}
            </Text>
            {unread > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>
                  {unread > 99 ? '99+' : unread}
                </Text>
              </View>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const archiveFolder = listView === 'main' && archiveChats.length > 0 && (
    <TouchableOpacity
      onPress={openArchive}
      activeOpacity={0.6}
      style={styles.archiveRow}>
      <View style={styles.archiveIcon}>
        <Text style={styles.archiveIconText}>📁</Text>
      </View>
      <View style={styles.body}>
        <View style={styles.rowTop}>
          <Text style={styles.archiveTitle}>Архив</Text>
          {archiveUnread > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>
                {archiveUnread > 99 ? '99+' : archiveUnread}
              </Text>
            </View>
          )}
        </View>
        <Text style={styles.archiveSubtitle}>
          {archiveChats.length}{' '}
          {archiveChats.length === 1
            ? 'чат'
            : archiveChats.length < 5
            ? 'чата'
            : 'чатов'}
        </Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        {searchOpen ? (
          <View style={styles.searchRow}>
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Поиск…"
              placeholderTextColor={colors.textTertiary}
              style={styles.searchInput}
              autoFocus
            />
            <TouchableOpacity
              onPress={() => {
                setSearchOpen(false);
                setQuery('');
              }}
              style={styles.searchCancel}>
              <Text style={styles.searchCancelText}>Отмена</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            {listView === 'archive' ? (
              <TouchableOpacity onPress={backToMain} style={styles.backBtn}>
                <Text style={styles.backText}>‹ Назад</Text>
              </TouchableOpacity>
            ) : null}
            <Text style={styles.headerTitle}>
              {listView === 'archive' ? 'Архив' : 'Чаты'}
            </Text>
            <View style={styles.headerActions}>
              {listView === 'main' && (
                <TouchableOpacity
                  onPress={() => setSearchOpen(true)}
                  style={styles.headerAction}
                  hitSlop={{top: 8, bottom: 8, left: 8, right: 8}}>
                  <Text style={styles.headerActionText}>Поиск</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                onPress={onLogout}
                style={styles.headerAction}
                hitSlop={{top: 8, bottom: 8, left: 8, right: 8}}>
                <Text style={styles.headerActionText}>Выйти</Text>
              </TouchableOpacity>
            </View>
          </>
        )}
      </View>

      {loading && chats.length === 0 ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={displayed}
          keyExtractor={item => String(item.id)}
          renderItem={renderItem}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          ListHeaderComponent={
            searchResults ? null : (
              <>
                {archiveFolder}
                {archiveFolder ? <View style={styles.separator} /> : null}
              </>
            )
          }
          initialNumToRender={15}
          windowSize={5}
          removeClippedSubviews
          onEndReachedThreshold={0.5}
          onEndReached={searchResults ? undefined : loadMore}
          refreshControl={
            searchResults ? undefined : (
              <RefreshControl
                refreshing={loading}
                onRefresh={refresh}
                tintColor={colors.primary}
              />
            )
          }
          ListFooterComponent={
            !searchResults && loadingMore ? (
              <View style={styles.footer}>
                <ActivityIndicator color={colors.primary} />
              </View>
            ) : !searchResults && !hasMore && chats.length > 0 ? (
              <Text style={styles.footerEnd}>· конец ·</Text>
            ) : null
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyText}>
                {searchResults
                  ? query.trim()
                    ? 'Ничего не найдено'
                    : 'Введите запрос'
                  : listView === 'archive'
                  ? error ?? 'Архив пуст'
                  : error ?? 'Нет чатов. Потяните вниз для обновления.'}
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
};

function extractPreview(message: any): string {
  if (!message) {
    return '';
  }
  const c = message.content;
  if (!c) {
    return '';
  }
  const type = c['@type'];
  switch (type) {
    case 'messageText':
      return c.text?.text ?? '';
    case 'messagePhoto':
      return '📷 Фото';
    case 'messageVideo':
      return '🎥 Видео';
    case 'messageVideoNote':
      return '🟢 Кружок';
    case 'messageVoiceNote':
      return '🎤 Голосовое';
    case 'messageSticker':
      return `${c.sticker?.emoji ?? ''} Стикер`;
    case 'messageDocument':
      return `📎 ${c.document?.file_name ?? c.document?.fileName ?? 'Файл'}`;
    case 'messageAnimation':
      return '🎞️ GIF';
    case 'messageAudio':
      return `🎵 ${c.audio?.title ?? 'Аудио'}`;
    case 'messageLocation':
      return '📍 Локация';
    case 'messageContact':
      return '👤 Контакт';
    case 'messagePoll':
      return `📊 ${c.poll?.question?.text ?? 'Опрос'}`;
    case 'messageCall':
      return '☎️ Звонок';
    default:
      return type ? type.replace(/^message/, '') : '';
  }
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: colors.background},
  header: {
    paddingTop: 12,
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.divider,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitle: {
    flex: 1,
    fontSize: 24,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  backBtn: {marginRight: 8, paddingVertical: 4},
  backText: {color: colors.primary, fontSize: 17, fontWeight: '500'},
  headerActions: {flexDirection: 'row', alignItems: 'center'},
  headerAction: {paddingHorizontal: 8, paddingVertical: 6, marginLeft: 4},
  headerActionText: {color: colors.primary, fontSize: 15, fontWeight: '500'},
  searchRow: {flex: 1, flexDirection: 'row', alignItems: 'center'},
  searchInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.divider,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
    fontSize: 15,
    color: colors.textPrimary,
    backgroundColor: colors.surface,
  },
  searchCancel: {paddingHorizontal: 10, paddingVertical: 8},
  searchCancelText: {color: colors.primary, fontSize: 14, fontWeight: '600'},
  center: {flex: 1, alignItems: 'center', justifyContent: 'center'},
  archiveRow: {
    flexDirection: 'row',
    paddingHorizontal: 14,
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: colors.surface,
  },
  archiveIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.divider,
    alignItems: 'center',
    justifyContent: 'center',
  },
  archiveIconText: {fontSize: 24},
  archiveTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  archiveSubtitle: {fontSize: 14, color: colors.textSecondary, marginTop: 2},
  row: {
    flexDirection: 'row',
    paddingHorizontal: 14,
    paddingVertical: 10,
    alignItems: 'center',
  },
  body: {flex: 1, justifyContent: 'center', marginLeft: 12},
  rowTop: {flexDirection: 'row', alignItems: 'center', marginBottom: 4},
  rowBottom: {flexDirection: 'row', alignItems: 'center'},
  title: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
    marginRight: 8,
  },
  time: {fontSize: 12, color: colors.textTertiary},
  preview: {flex: 1, fontSize: 14, color: colors.textSecondary},
  badge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.badge,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 7,
    marginLeft: 8,
  },
  badgeText: {color: 'white', fontSize: 12, fontWeight: '700'},
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.divider,
    marginLeft: 78,
  },
  empty: {paddingTop: 80, alignItems: 'center'},
  emptyText: {color: colors.textSecondary, fontSize: 14},
  footer: {paddingVertical: 16, alignItems: 'center'},
  footerEnd: {
    textAlign: 'center',
    color: colors.textTertiary,
    fontSize: 11,
    paddingVertical: 14,
  },
});

export default ChatsScreen;
