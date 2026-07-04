/**
 * Chat view — messages, send, reactions, reply, typing, photos, info modal.
 */

import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  FlatList,
  Keyboard,
  Linking,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextStyle,
  TouchableOpacity,
  View,
} from 'react-native';
import AudioRecorderPlayer from 'react-native-audio-recorder-player';
import {
  launchCamera,
  launchImageLibrary,
} from 'react-native-image-picker';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import TdLib from 'react-native-tdlib';
import ChatAvatar from '../components/ChatAvatar';
import ChatComposer from '../components/ChatComposer';
import LiquidGlass from '../components/LiquidGlass';
import MessagePhoto from '../components/MessagePhoto';
import MessageVoice from '../components/MessageVoice';
import ThemeToggle from '../components/ThemeToggle';
import TypingDots from '../components/TypingDots';
import {useKeyboardHeight} from '../hooks/useKeyboardHeight';
import {AppTheme, formatTime, useTheme} from '../theme';
import {safeJsonParse, useTdUpdate} from '../tdlib';
import {sendPhotoMessage, sendVoiceMessage} from '../tdlib/messages';
import {ChatSummary} from './ChatsScreen';

interface Props {
  chat: ChatSummary;
  meId: number | null;
  onBack: () => void;
}

interface Message {
  id: number;
  chat_id: number;
  is_outgoing: boolean;
  sender_id: {user_id?: number; chat_id?: number; '@type': string};
  date: number;
  content: any;
  can_be_deleted_only_for_self?: boolean;
  can_be_deleted_for_all_users?: boolean;
  reply_to?: {
    '@type': string;
    chat_id?: number;
    message_id?: number;
  };
  interaction_info?: {
    reactions?: {
      reactions?: Array<{
        type: {'@type': string; emoji?: string};
        total_count: number;
        is_chosen?: boolean;
      }>;
    };
  };
}

interface ChatInfo {
  id: number;
  title: string;
  type?: any;
  description?: string;
  member_count?: number;
}

const QUICK_REACTIONS = ['❤️', '👍', '👎', '🔥', '😂', '😢', '🙏'];

const ENTITY_LABELS: Record<string, string> = {
  textEntityTypeMention: '@ mention',
  textEntityTypeMentionName: '@ mention',
  textEntityTypeHashtag: '# hashtag',
  textEntityTypeCashtag: '$ cashtag',
  textEntityTypeBotCommand: '/ command',
  textEntityTypeUrl: '🔗 link',
  textEntityTypeEmailAddress: '✉ email',
  textEntityTypePhoneNumber: '☎ phone',
};

const summarizeEntities = (raw: string): string[] => {
  let parsed: any;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  const entities: any[] = parsed?.entities ?? [];
  const counts = new Map<string, number>();
  for (const e of entities) {
    const t = e?.type?.['@type'];
    const label = ENTITY_LABELS[t];
    if (!label) continue;
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  return Array.from(counts.entries()).map(([label, n]) =>
    n > 1 ? `${label} ×${n}` : label,
  );
};
const VIEW_BATCH_MS = 500;
const TYPING_TIMEOUT_MS = 5000;
const audioRecorder = new AudioRecorderPlayer();

const ChatScreen: React.FC<Props> = ({chat, meId, onBack}) => {
  const {theme} = useTheme();
  const insets = useSafeAreaInsets();
  const keyboardHeight = useKeyboardHeight();
  const styles = useMemo(() => createChatStyles(theme), [theme]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  const [reactingOn, setReactingOn] = useState<Message | null>(null);
  const [actionOn, setActionOn] = useState<Message | null>(null);
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);

  const [infoOpen, setInfoOpen] = useState(false);
  const [info, setInfo] = useState<ChatInfo | null>(null);

  const [typingUserIds, setTypingUserIds] = useState<number[]>([]);
  const [recording, setRecording] = useState(false);
  const [recordingSec, setRecordingSec] = useState(0);
  const [composerHeight, setComposerHeight] = useState(64);
  const [lastReadOutboxId, setLastReadOutboxId] = useState<number>(
    (chat as any).last_read_outbox_message_id ?? 0,
  );

  const [entityChips, setEntityChips] = useState<string[]>([]);

  const listRef = useRef<FlatList<Message>>(null);
  const viewedIdsRef = useRef<Set<number>>(new Set());
  const pendingViewRef = useRef<Set<number>>(new Set());
  const viewTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const typingTimersRef = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());
  const entitiesTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const entitiesReqIdRef = useRef(0);
  const recordStartedAtRef = useRef(0);
  const recordTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const recordSessionRef = useRef<'idle' | 'starting' | 'recording'>('idle');
  const stopPendingRef = useRef(false);

  const width = Dimensions.get('window').width;
  const keyboardOpen = keyboardHeight > 0;
  const footerHeight = composerHeight + keyboardHeight;
  const overlayExtra =
    (replyingTo ? 46 : 0) + (entityChips.length > 0 ? 34 : 0);
  const listBottomPad = composerHeight + overlayExtra + 12;

  const flushViewed = useCallback(() => {
    const ids = Array.from(pendingViewRef.current).filter(
      id => !viewedIdsRef.current.has(id),
    );
    if (ids.length === 0) return;
    ids.forEach(id => viewedIdsRef.current.add(id));
    pendingViewRef.current.clear();
    TdLib.viewMessages(chat.id, ids, false).catch(() => {});
  }, [chat.id]);

  const enqueueViewed = useCallback(
    (ids: number[]) => {
      let added = false;
      for (const id of ids) {
        if (!viewedIdsRef.current.has(id)) {
          pendingViewRef.current.add(id);
          added = true;
        }
      }
      if (!added) return;
      if (viewTimerRef.current) clearTimeout(viewTimerRef.current);
      viewTimerRef.current = setTimeout(flushViewed, VIEW_BATCH_MS);
    },
    [flushViewed],
  );

  const loadHistory = useCallback(
    async (fromMessageId = 0) => {
      try {
        const r = await TdLib.getChatHistory(chat.id, fromMessageId, 40, 0);
        const parsed = r
          .map(it => safeJsonParse<Message>(it.raw_json))
          .filter((m): m is Message => !!m);
        if (fromMessageId === 0) {
          setMessages(parsed);
        } else {
          setMessages(prev => [...prev, ...parsed]);
        }
        enqueueViewed(parsed.map(m => m.id));
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    },
    [chat.id, enqueueViewed],
  );

  useEffect(() => {
    setLoading(true);
    viewedIdsRef.current.clear();
    pendingViewRef.current.clear();
    TdLib.openChat(chat.id).catch(() => {});
    loadHistory(0);
    return () => {
      if (viewTimerRef.current) clearTimeout(viewTimerRef.current);
      if (entitiesTimerRef.current) clearTimeout(entitiesTimerRef.current);
      typingTimersRef.current.forEach(t => clearTimeout(t));
      typingTimersRef.current.clear();
      TdLib.closeChat(chat.id).catch(() => {});
    };
  }, [chat.id, loadHistory]);

  useEffect(() => {
    if (keyboardHeight > 0) {
      listRef.current?.scrollToOffset({offset: 0, animated: true});
    }
  }, [keyboardHeight]);

  useEffect(() => {
    return () => {
      if (recordTimerRef.current) {
        clearInterval(recordTimerRef.current);
      }
      audioRecorder.stopRecorder().catch(() => {});
      audioRecorder.removeRecordBackListener();
    };
  }, []);

  useTdUpdate('updateNewMessage', data => {
    const msg = data?.message as Message | undefined;
    if (!msg || msg.chat_id !== chat.id) return;
    setMessages(prev => {
      if (prev.some(m => m.id === msg.id)) return prev;
      return [msg, ...prev];
    });
    enqueueViewed([msg.id]);
  });

  useTdUpdate('updateMessageInteractionInfo', data => {
    if (data?.chat_id !== chat.id) return;
    const mid = data?.message_id;
    const ii = data?.interaction_info;
    if (!mid) return;
    setMessages(prev =>
      prev.map(m => (m.id === mid ? {...m, interaction_info: ii} : m)),
    );
  });

  useTdUpdate('updateMessageContent', data => {
    if (data?.chat_id !== chat.id) return;
    const mid = data?.message_id;
    const newContent = data?.new_content;
    if (!mid || !newContent) return;
    setMessages(prev =>
      prev.map(m => (m.id === mid ? {...m, content: newContent} : m)),
    );
  });

  useTdUpdate('updateDeleteMessages', data => {
    if (data?.chat_id !== chat.id) return;
    const ids: number[] = Array.isArray(data?.message_ids) ? data.message_ids : [];
    if (ids.length === 0) return;
    const idSet = new Set(ids);
    setMessages(prev => prev.filter(m => !idSet.has(m.id)));
  });

  useTdUpdate('updateChatReadOutbox', data => {
    if (data?.chat_id !== chat.id) return;
    const id = data?.last_read_outbox_message_id;
    if (typeof id === 'number') setLastReadOutboxId(id);
  });

  useTdUpdate('updateChatAction', data => {
    if (data?.chat_id !== chat.id) return;
    const senderId = data?.sender_id?.user_id;
    if (!senderId || senderId === meId) return;
    const action = data?.action;
    const isCancel = action?.['@type'] === 'chatActionCancel';
    setTypingUserIds(prev => {
      if (isCancel) return prev.filter(id => id !== senderId);
      if (prev.includes(senderId)) return prev;
      return [...prev, senderId];
    });
    const existing = typingTimersRef.current.get(senderId);
    if (existing) clearTimeout(existing);
    if (!isCancel) {
      typingTimersRef.current.set(
        senderId,
        setTimeout(() => {
          setTypingUserIds(prev => prev.filter(id => id !== senderId));
          typingTimersRef.current.delete(senderId);
        }, TYPING_TIMEOUT_MS),
      );
    } else {
      typingTimersRef.current.delete(senderId);
    }
  });

  const onSend = useCallback(async () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    setSending(true);
    const reply = replyingTo;
    setReplyingTo(null);
    try {
      await TdLib.sendMessage(chat.id, trimmed, reply?.id);
      setText('');
      setEntityChips([]);
    } catch {
      // restore reply on failure so user can retry
      if (reply) setReplyingTo(reply);
    } finally {
      setSending(false);
    }
  }, [chat.id, text, replyingTo]);

  const sendMedia = useCallback(
    async (sendFn: (replyId?: number) => Promise<void>) => {
      const replyId = replyingTo?.id;
      setReplyingTo(null);
      setSending(true);
      try {
        await sendFn(replyId);
        setEntityChips([]);
      } catch (e: any) {
        if (replyId != null) {
          const target = messages.find(m => m.id === replyId);
          if (target) {
            setReplyingTo(target);
          }
        }
        Alert.alert('Ошибка', e?.message ?? 'Не удалось отправить');
      } finally {
        setSending(false);
      }
    },
    [replyingTo?.id, messages],
  );

  const onAttach = useCallback(() => {
    Alert.alert('Отправить фото', undefined, [
      {
        text: 'Галерея',
        onPress: () => {
          launchImageLibrary({mediaType: 'photo', quality: 0.8, selectionLimit: 1})
            .then(result => {
              const uri = result.assets?.[0]?.uri;
              if (result.didCancel || !uri) {
                return;
              }
              sendMedia(replyId =>
                sendPhotoMessage(chat.id, uri, replyId),
              );
            })
            .catch(() => {});
        },
      },
      {
        text: 'Камера',
        onPress: () => {
          launchCamera({mediaType: 'photo', quality: 0.8, saveToPhotos: false})
            .then(result => {
              const uri = result.assets?.[0]?.uri;
              if (result.didCancel || !uri) {
                return;
              }
              sendMedia(replyId =>
                sendPhotoMessage(chat.id, uri, replyId),
              );
            })
            .catch(() => {});
        },
      },
      {text: 'Отмена', style: 'cancel'},
    ]);
  }, [chat.id, replyingTo?.id, sendMedia]);

  const finishRecording = useCallback(async () => {
    recordSessionRef.current = 'idle';
    setRecording(false);
    if (recordTimerRef.current) {
      clearInterval(recordTimerRef.current);
      recordTimerRef.current = null;
    }
    try {
      const uri = await audioRecorder.stopRecorder();
      audioRecorder.removeRecordBackListener();
      const duration = (Date.now() - recordStartedAtRef.current) / 1000;
      if (!uri) {
        Alert.alert('Голосовое', 'Файл записи не создан');
        return;
      }
      if (duration < 0.35) {
        Alert.alert('Голосовое', 'Слишком короткая запись — держите кнопку дольше');
        return;
      }
      await sendMedia(replyId =>
        sendVoiceMessage(chat.id, uri, duration, replyId),
      );
    } catch (e: any) {
      Alert.alert('Голосовое', e?.message ?? 'Не удалось отправить');
    } finally {
      setRecordingSec(0);
    }
  }, [chat.id, sendMedia]);

  const onRecordStart = useCallback(() => {
    if (recordSessionRef.current !== 'idle' || sending) {
      return;
    }
    recordSessionRef.current = 'starting';
    stopPendingRef.current = false;
    recordStartedAtRef.current = Date.now();
    setRecording(true);
    setRecordingSec(0);
    Keyboard.dismiss();

    audioRecorder
      .startRecorder(undefined, undefined, true)
      .then(() => {
        if (recordSessionRef.current === 'starting') {
          recordSessionRef.current = 'recording';
        }
        if (stopPendingRef.current) {
          stopPendingRef.current = false;
          finishRecording();
        }
      })
      .catch((e: any) => {
        recordSessionRef.current = 'idle';
        setRecording(false);
        setRecordingSec(0);
        if (recordTimerRef.current) {
          clearInterval(recordTimerRef.current);
          recordTimerRef.current = null;
        }
        Alert.alert(
          'Микрофон',
          e?.message ??
            'Разрешите доступ к микрофону в Настройки → AnyGram',
        );
      });

    recordTimerRef.current = setInterval(() => {
      setRecordingSec(
        Math.max(
          1,
          Math.round((Date.now() - recordStartedAtRef.current) / 1000),
        ),
      );
    }, 400);
  }, [sending, finishRecording]);

  const onRecordStop = useCallback(() => {
    if (recordSessionRef.current === 'idle') {
      return;
    }
    if (recordSessionRef.current === 'starting') {
      stopPendingRef.current = true;
      return;
    }
    if (recordSessionRef.current === 'recording') {
      finishRecording();
    }
  }, [finishRecording]);

  const onRecordCancel = useCallback(() => {
    if (recordSessionRef.current === 'idle') {
      return;
    }
    stopPendingRef.current = false;
    recordSessionRef.current = 'idle';
    setRecording(false);
    setRecordingSec(0);
    if (recordTimerRef.current) {
      clearInterval(recordTimerRef.current);
      recordTimerRef.current = null;
    }
    audioRecorder.stopRecorder().catch(() => {});
    audioRecorder.removeRecordBackListener();
  }, []);

  // Fire a typing action
  const typingSentRef = useRef<number>(0);
  const onChangeText = useCallback(
    (t: string) => {
      setText(t);
      const now = Date.now();
      if (now - typingSentRef.current > 3000 && t.length > 0) {
        typingSentRef.current = now;
        TdLib.td_json_client_send({
          '@type': 'sendChatAction',
          chat_id: chat.id,
          action: {'@type': 'chatActionTyping'},
        }).catch(() => {});
      }

      if (entitiesTimerRef.current) clearTimeout(entitiesTimerRef.current);
      if (!t.trim()) {
        setEntityChips([]);
        return;
      }
      const reqId = ++entitiesReqIdRef.current;
      entitiesTimerRef.current = setTimeout(async () => {
        try {
          const raw = await TdLib.getTextEntities(t);
          if (reqId !== entitiesReqIdRef.current) return;
          setEntityChips(summarizeEntities(raw));
        } catch {
          if (reqId === entitiesReqIdRef.current) setEntityChips([]);
        }
      }, 200);
    },
    [chat.id],
  );

  const loadOlder = useCallback(() => {
    if (messages.length === 0) return;
    const oldest = messages[messages.length - 1];
    if (!oldest) return;
    loadHistory(oldest.id);
  }, [loadHistory, messages]);

  const toggleReaction = useCallback(
    async (msg: Message, emoji: string) => {
      setReactingOn(null);
      const existing = msg.interaction_info?.reactions?.reactions?.find(
        r => r.type['@type'] === 'reactionTypeEmoji' && r.type.emoji === emoji,
      );
      try {
        if (existing?.is_chosen) {
          await TdLib.removeMessageReaction(chat.id, msg.id, emoji);
        } else {
          await TdLib.addMessageReaction(chat.id, msg.id, emoji);
        }
      } catch {
        // ignore
      }
    },
    [chat.id],
  );

  const openInfo = useCallback(async () => {
    setInfoOpen(true);
    try {
      const r = await TdLib.getChat(chat.id);
      const c = safeJsonParse<ChatInfo>(r?.raw ?? '');
      setInfo(c);
    } catch {
      setInfo(null);
    }
  }, [chat.id]);

  const startReply = useCallback((msg: Message) => {
    setActionOn(null);
    setReplyingTo(msg);
  }, []);

  const deleteMessage = useCallback(
    async (msg: Message, revoke: boolean) => {
      try {
        await TdLib.deleteMessages(chat.id, [msg.id], revoke);
      } catch (e: any) {
        Alert.alert('Failed to delete', e?.message ?? String(e));
      }
    },
    [chat.id],
  );

  const askDelete = useCallback(
    (msg: Message) => {
      setActionOn(null);
      // Trust TDLib to reject if the message truly cannot be deleted —
      // the can_be_deleted_* flags are omitted from JSON when false, so
      // gating on them client-side is unreliable.
      const canRevoke =
        msg.can_be_deleted_for_all_users ?? msg.is_outgoing ?? false;
      const buttons: Array<{
        text: string;
        style?: 'cancel' | 'destructive' | 'default';
        onPress?: () => void;
      }> = [
        {text: 'Cancel', style: 'cancel'},
        {
          text: canRevoke ? 'Delete for me' : 'Delete',
          style: 'destructive',
          onPress: () => deleteMessage(msg, false),
        },
      ];
      if (canRevoke) {
        buttons.push({
          text: 'Delete for everyone',
          style: 'destructive',
          onPress: () => deleteMessage(msg, true),
        });
      }
      Alert.alert('Delete message?', undefined, buttons);
    },
    [deleteMessage],
  );

  const messagesById = useMemo(() => {
    const m = new Map<number, Message>();
    messages.forEach(x => m.set(x.id, x));
    return m;
  }, [messages]);

  const renderItem = ({item}: {item: Message}) => {
    const own = meId != null && item.sender_id?.user_id === meId;
    const reactions = item.interaction_info?.reactions?.reactions ?? [];
    const isPhoto = item.content?.['@type'] === 'messagePhoto';
    const isVoice = item.content?.['@type'] === 'messageVoiceNote';
    const isMedia = isPhoto || isVoice;
    const replyToId =
      item.reply_to?.['@type'] === 'messageReplyToMessage'
        ? item.reply_to.message_id
        : undefined;
    const replyTarget = replyToId ? messagesById.get(replyToId) : undefined;

    return (
      <View
        style={[styles.bubbleRow, own ? styles.bubbleRowOwn : styles.bubbleRowOther]}>
        <Pressable
          onLongPress={() => setActionOn(item)}
          delayLongPress={250}
          style={[
            styles.bubble,
            own ? styles.bubbleOwn : styles.bubbleOther,
            isMedia && styles.bubblePhoto,
          ]}>
          {replyToId ? (
            <View style={styles.replyQuote}>
              <View style={styles.replyBar} />
              <Text style={styles.replyText} numberOfLines={1}>
                {replyTarget
                  ? renderContent(replyTarget.content)
                  : `ответ на #${replyToId}`}
              </Text>
            </View>
          ) : null}

          {isPhoto ? (
            <MessagePhoto
              photo={item.content.photo}
              caption={item.content.caption?.text}
              maxWidth={width * 0.68}
            />
          ) : isVoice ? (
            <MessageVoice
              voiceNote={item.content.voice_note}
              duration={item.content.voice_note?.duration}
            />
          ) : (
            renderMessageBody(item.content, styles.bubbleText, theme)
          )}

          {reactions.length > 0 && (
            <View style={styles.reactionsRow}>
              {reactions.map((r, i) => (
                <Pressable
                  key={i}
                  onPress={() => toggleReaction(item, r.type.emoji ?? '')}
                  style={[
                    styles.reactionPill,
                    r.is_chosen && styles.reactionPillActive,
                  ]}>
                  <Text style={styles.reactionEmoji}>{r.type.emoji ?? '?'}</Text>
                  <Text
                    style={[
                      styles.reactionCount,
                      r.is_chosen && styles.reactionCountActive,
                    ]}>
                    {r.total_count}
                  </Text>
                </Pressable>
              ))}
            </View>
          )}
          <View style={styles.bubbleMeta}>
            <Text style={styles.bubbleTime}>{formatTime(item.date)}</Text>
            {own && <Ticks state={sendingState(item, lastReadOutboxId)} />}
          </View>
        </Pressable>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <LiquidGlass intensity="soft" compact native style={styles.headerGlass}>
        <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn}>
          <Text style={styles.backText}>‹</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={openInfo} style={styles.headerCenter}>
          <ChatAvatar id={chat.id} title={chat.title} photo={chat.photo} size={36} />
          <View style={styles.headerBody}>
            <Text style={styles.headerTitle} numberOfLines={1}>
              {chat.title}
            </Text>
            {typingUserIds.length > 0 ? (
              <View style={styles.headerTypingRow}>
                <Text style={[styles.headerSubtitle, styles.headerTypingLabel]}>
                  печатает
                </Text>
                <TypingDots color={theme.primary} />
              </View>
            ) : (
              <Text style={styles.headerSubtitle} numberOfLines={1}>
                нажмите для информации
              </Text>
            )}
          </View>
        </TouchableOpacity>
        <ThemeToggle compact />
        </View>
      </LiquidGlass>

      <View style={[styles.messagesArea, {marginBottom: footerHeight}]}>
        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={theme.primary} />
          </View>
        ) : (
          <FlatList
            ref={listRef}
            style={styles.list}
            data={messages}
            keyExtractor={item => String(item.id)}
            renderItem={renderItem}
            extraData={lastReadOutboxId}
            inverted
            contentContainerStyle={[
              styles.listContent,
              {paddingTop: listBottomPad},
            ]}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="interactive"
            onEndReached={loadOlder}
            onEndReachedThreshold={0.3}
            initialNumToRender={20}
            windowSize={7}
            ListEmptyComponent={
              <View style={styles.empty}>
                <Text style={styles.emptyText}>Пока нет сообщений</Text>
              </View>
            }
          />
        )}
      </View>

      {entityChips.length > 0 ? (
        <View
          style={[
            styles.entitiesBar,
            {bottom: footerHeight},
          ]}>
          {entityChips.map(chip => (
            <View key={chip} style={styles.entityChip}>
              <Text style={styles.entityChipText}>{chip}</Text>
            </View>
          ))}
        </View>
      ) : null}

      {replyingTo ? (
        <View
          style={[
            styles.replyingBar,
            {bottom: footerHeight},
          ]}>
          <View style={styles.replyingBar_accent} />
          <View style={{flex: 1}}>
            <Text style={styles.replyingBar_label}>Ответ на</Text>
            <Text style={styles.replyingBar_preview} numberOfLines={1}>
              {renderContent(replyingTo.content)}
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => setReplyingTo(null)}
            style={styles.replyingBar_close}>
            <Text style={styles.replyingBar_closeText}>✕</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      <View
        style={[styles.composerDock, {bottom: keyboardHeight}]}
        onLayout={event => setComposerHeight(event.nativeEvent.layout.height)}>
        <ChatComposer
          theme={theme}
          value={text}
          onChangeText={onChangeText}
          onSend={onSend}
          onAttach={onAttach}
          onRecordStart={onRecordStart}
          onRecordStop={onRecordStop}
          onRecordCancel={onRecordCancel}
          sending={sending}
          recording={recording}
          recordingSec={recordingSec}
          keyboardOpen={keyboardOpen}
          bottomInset={keyboardOpen ? 6 : insets.bottom}
        />
      </View>

      {/* Action menu (Reply / React) */}
      <Modal
        visible={actionOn != null}
        transparent
        animationType="fade"
        onRequestClose={() => setActionOn(null)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setActionOn(null)}>
            <LiquidGlass intensity="soft" native style={styles.actionSheetGlass}>
            <View style={styles.actionSheet}>
            <TouchableOpacity
              style={styles.actionBtn}
              onPress={() => {
                const m = actionOn;
                setActionOn(null);
                if (m) setReactingOn(m);
              }}>
              <Text style={styles.actionEmoji}>😊</Text>
              <Text style={styles.actionLabel}>Реакция</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.actionBtn}
              onPress={() => actionOn && startReply(actionOn)}>
              <Text style={styles.actionEmoji}>↩︎</Text>
              <Text style={styles.actionLabel}>Ответить</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.actionBtn}
              onPress={() => actionOn && askDelete(actionOn)}>
              <Text style={[styles.actionEmoji, styles.actionDeleteEmoji]}>🗑</Text>
              <Text style={[styles.actionLabel, styles.actionDeleteLabel]}>
                Удалить
              </Text>
            </TouchableOpacity>
            </View>
          </LiquidGlass>
        </Pressable>
      </Modal>

      {/* Reaction picker */}
      <Modal
        visible={reactingOn != null}
        transparent
        animationType="fade"
        onRequestClose={() => setReactingOn(null)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setReactingOn(null)}>
          <LiquidGlass intensity="soft" native style={styles.reactionPickerGlass}>
            <View style={styles.reactionPicker}>
            {QUICK_REACTIONS.map(emoji => (
              <TouchableOpacity
                key={emoji}
                style={styles.reactionPickerBtn}
                onPress={() => {
                  if (reactingOn) toggleReaction(reactingOn, emoji);
                }}>
                <Text style={styles.reactionPickerEmoji}>{emoji}</Text>
              </TouchableOpacity>
            ))}
            </View>
          </LiquidGlass>
        </Pressable>
      </Modal>

      {/* Chat info */}
      <Modal
        visible={infoOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setInfoOpen(false)}>
        <Pressable
          style={styles.modalBackdrop}
          onPress={() => setInfoOpen(false)}>
          <Pressable style={styles.infoSheet}>
            <View style={styles.infoHeader}>
              <ChatAvatar
                id={chat.id}
                title={chat.title}
                photo={chat.photo}
                size={72}
              />
              <Text style={styles.infoTitle}>{chat.title}</Text>
              <Text style={styles.infoType}>
                {describeType(info?.type ?? chat.type)}
              </Text>
            </View>
            {info?.description ? (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Описание</Text>
                <Text style={styles.infoValue}>{info.description}</Text>
              </View>
            ) : null}
            {typeof info?.member_count === 'number' ? (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Участники</Text>
                <Text style={styles.infoValue}>{info.member_count}</Text>
              </View>
            ) : null}
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>ID чата</Text>
              <Text style={styles.infoValue}>{String(chat.id)}</Text>
            </View>
            <TouchableOpacity
              style={styles.infoClose}
              onPress={() => setInfoOpen(false)}>
              <Text style={styles.infoCloseText}>Закрыть</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
};

type TickState = 'pending' | 'sent' | 'read';

function sendingState(msg: Message, lastReadOutboxId: number): TickState {
  const ss = (msg as any).sending_state;
  if (ss?.['@type'] === 'messageSendingStatePending') return 'pending';
  if (msg.id <= lastReadOutboxId) return 'read';
  return 'sent';
}

const Ticks: React.FC<{state: TickState}> = ({state}) => {
  const {theme} = useTheme();
  const tickStyles = useMemo(
    () =>
      StyleSheet.create({
        ticks: {fontSize: 11, marginLeft: 4, lineHeight: 12, fontWeight: '700'},
        ticksSent: {color: theme.textTertiary},
        ticksRead: {color: theme.primary},
        tickPending: {fontSize: 10, marginLeft: 4, color: theme.textTertiary},
      }),
    [theme],
  );
  if (state === 'pending') {
    return <Text style={tickStyles.tickPending}>⏳</Text>;
  }
  return (
    <Text
      style={[
        tickStyles.ticks,
        state === 'read' ? tickStyles.ticksRead : tickStyles.ticksSent,
      ]}>
      {state === 'read' ? '✓✓' : '✓'}
    </Text>
  );
};

function describeType(t: any): string {
  if (!t) return '';
  switch (t['@type']) {
    case 'chatTypePrivate':
      return 'private chat';
    case 'chatTypeBasicGroup':
      return 'group';
    case 'chatTypeSupergroup':
      return t.is_channel ? 'channel' : 'supergroup';
    case 'chatTypeSecret':
      return 'secret chat';
    default:
      return t['@type'] ?? '';
  }
}

function renderFormattedText(
  formatted: {text?: string; entities?: any[]} | undefined,
  baseStyle: TextStyle,
  theme: AppTheme,
): React.ReactNode {
  const text = formatted?.text ?? '';
  const entities = (formatted?.entities ?? [])
    .filter((e: any) => typeof e?.offset === 'number' && typeof e?.length === 'number')
    .sort((a: any, b: any) => a.offset - b.offset);

  if (!entities.length) return <Text style={baseStyle}>{text}</Text>;

  const nodes: React.ReactNode[] = [];
  let cursor = 0;
  let key = 0;
  for (const e of entities) {
    if (e.offset < cursor) continue; // skip overlapping
    if (e.offset > cursor) {
      nodes.push(text.substring(cursor, e.offset));
    }
    const slice = text.substring(e.offset, e.offset + e.length);
    const t = e.type?.['@type'] as string | undefined;
    const style = entityStyle(t, theme);
    const onPress = entityPressHandler(e, slice);
    nodes.push(
      <Text
        key={`e${key++}`}
        style={style}
        onPress={onPress}
        suppressHighlighting={!onPress}>
        {slice}
      </Text>,
    );
    cursor = e.offset + e.length;
  }
  if (cursor < text.length) nodes.push(text.substring(cursor));
  return <Text style={baseStyle}>{nodes}</Text>;
}

function entityStyle(type: string | undefined, theme: AppTheme): TextStyle | undefined {
  switch (type) {
    case 'textEntityTypeMention':
    case 'textEntityTypeMentionName':
    case 'textEntityTypeHashtag':
    case 'textEntityTypeCashtag':
    case 'textEntityTypeBotCommand':
      return {color: theme.primary};
    case 'textEntityTypeUrl':
    case 'textEntityTypeTextUrl':
    case 'textEntityTypeEmailAddress':
    case 'textEntityTypePhoneNumber':
      return {color: theme.primary, textDecorationLine: 'underline'};
    case 'textEntityTypeBold':
      return {fontWeight: '700'};
    case 'textEntityTypeItalic':
      return {fontStyle: 'italic'};
    case 'textEntityTypeUnderline':
      return {textDecorationLine: 'underline'};
    case 'textEntityTypeStrikethrough':
      return {textDecorationLine: 'line-through'};
    case 'textEntityTypeCode':
    case 'textEntityTypePre':
    case 'textEntityTypePreCode':
      return {
        fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
        backgroundColor: theme.surface,
      };
    default:
      return undefined;
  }
}

function entityPressHandler(
  entity: any,
  slice: string,
): (() => void) | undefined {
  const t = entity?.type?.['@type'] as string | undefined;
  switch (t) {
    case 'textEntityTypeUrl':
      return () => Linking.openURL(slice).catch(() => {});
    case 'textEntityTypeTextUrl': {
      const url = entity?.type?.url ?? slice;
      return () => Linking.openURL(url).catch(() => {});
    }
    case 'textEntityTypeEmailAddress':
      return () => Linking.openURL(`mailto:${slice}`).catch(() => {});
    case 'textEntityTypePhoneNumber':
      return () =>
        Linking.openURL(`tel:${slice.replace(/\s+/g, '')}`).catch(() => {});
    default:
      return undefined;
  }
}

function renderMessageBody(
  content: any,
  baseStyle: TextStyle,
  theme: AppTheme,
): React.ReactNode {
  if (content?.['@type'] === 'messageText') {
    return renderFormattedText(content.text, baseStyle, theme);
  }
  return <Text style={baseStyle}>{renderContent(content)}</Text>;
}

function renderContent(content: any): string {
  if (!content) return '';
  const type = content['@type'] as string | undefined;
  const caption = content.caption?.text;
  const captionSuffix = caption ? ` · ${caption}` : '';
  switch (type) {
    case 'messageText':
      return content.text?.text ?? '';
    case 'messagePhoto':
      return `📷 Photo${captionSuffix}`;
    case 'messageVideo':
      return `🎥 Video${captionSuffix}`;
    case 'messageVideoNote':
      return '🟢 Video message';
    case 'messageVoiceNote':
      return '🎤 Voice message';
    case 'messageSticker':
      return `${content.sticker?.emoji ?? ''} Sticker`;
    case 'messageDocument': {
      const name = content.document?.file_name ?? 'Document';
      return `📎 ${name}${captionSuffix}`;
    }
    case 'messageAnimation':
      return `🎞️ GIF${captionSuffix}`;
    case 'messageAudio':
      return `🎵 ${content.audio?.title ?? 'Audio'}${captionSuffix}`;
    case 'messageLocation':
      return '📍 Location';
    case 'messageVenue':
      return `📍 ${content.venue?.title ?? 'Venue'}`;
    case 'messageContact':
      return `👤 Contact: ${content.contact?.first_name ?? ''}`;
    case 'messagePoll':
      return `📊 Poll: ${content.poll?.question?.text ?? ''}`;
    case 'messageCall':
      return '☎️ Call';
    case 'messageChatAddMembers':
      return '👋 joined';
    case 'messageChatDeleteMember':
      return '🚪 left';
    case 'messageChatJoinByLink':
      return '🔗 joined via invite link';
    case 'messagePinMessage':
      return '📌 pinned a message';
    case 'messageChatChangeTitle':
      return `✏️ changed title to "${content.title ?? ''}"`;
    case 'messageChatChangePhoto':
      return '🖼️ changed chat photo';
    case 'messageChatDeletePhoto':
      return '🖼️ removed chat photo';
    case 'messageUnsupported':
      return '[unsupported by TDLib]';
    default:
      return type ? `[${type.replace(/^message/, '')}]` : '[empty]';
  }
}

function createChatStyles(theme: AppTheme) {
  return StyleSheet.create({
  container: {flex: 1, backgroundColor: theme.backgroundAlt},
  headerGlass: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.glassBorder,
  },
  header: {
    paddingTop: 10,
    paddingBottom: 10,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  backBtn: {paddingHorizontal: 8, paddingVertical: 4, marginRight: 4},
  backText: {fontSize: 32, color: theme.primary, lineHeight: 32, marginTop: -4},
  headerCenter: {flex: 1, flexDirection: 'row', alignItems: 'center'},
  headerBody: {flex: 1, marginLeft: 10},
  headerTitle: {fontSize: 16, fontWeight: '600', color: theme.textPrimary},
  headerSubtitle: {fontSize: 12, color: theme.textSecondary, marginTop: 2},
  headerTypingRow: {flexDirection: 'row', alignItems: 'center', marginTop: 4},
  headerTypingLabel: {color: theme.primary, marginRight: 6},

  center: {flex: 1, alignItems: 'center', justifyContent: 'center'},
  messagesArea: {flex: 1, minHeight: 0},
  list: {flex: 1},
  listContent: {paddingHorizontal: 10, paddingVertical: 10},

  composerDock: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 20,
  },
  empty: {paddingTop: 80, alignItems: 'center'},
  emptyText: {color: theme.textSecondary, fontSize: 14},

  bubbleRow: {marginVertical: 2, flexDirection: 'row'},
  bubbleRowOwn: {justifyContent: 'flex-end'},
  bubbleRowOther: {justifyContent: 'flex-start'},
  bubble: {
    maxWidth: '78%',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 14,
    shadowColor: theme.bubbleShadow,
    shadowOpacity: 0.5,
    shadowRadius: 1,
    shadowOffset: {width: 0, height: 1},
    elevation: 1,
  },
  bubbleOwn: {backgroundColor: theme.bubbleOwn, borderBottomRightRadius: 4},
  bubbleOther: {backgroundColor: theme.bubbleOther, borderBottomLeftRadius: 4},
  bubblePhoto: {padding: 4},
  bubbleText: {fontSize: 15, color: theme.textPrimary, lineHeight: 20},
  bubbleMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-end',
    marginTop: 2,
  },
  bubbleTime: {fontSize: 10, color: theme.textTertiary},
  ticks: {fontSize: 11, marginLeft: 4, lineHeight: 12, fontWeight: '700'},
  ticksSent: {color: theme.textTertiary},
  ticksRead: {color: theme.primary},
  tickPending: {fontSize: 10, marginLeft: 4, color: theme.textTertiary},

  replyQuote: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
    backgroundColor: 'rgba(0,0,0,0.04)',
    borderRadius: 8,
    paddingRight: 8,
    paddingVertical: 4,
  },
  replyBar: {width: 3, backgroundColor: theme.primary, marginRight: 6, alignSelf: 'stretch'},
  replyText: {flex: 1, fontSize: 12, color: theme.textSecondary},

  reactionsRow: {flexDirection: 'row', flexWrap: 'wrap', marginTop: 6},
  reactionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.06)',
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginRight: 4,
    marginBottom: 2,
  },
  reactionPillActive: {backgroundColor: 'rgba(42,171,238,0.18)'},
  reactionEmoji: {fontSize: 12},
  reactionCount: {
    fontSize: 11,
    marginLeft: 3,
    color: theme.textSecondary,
    fontWeight: '600',
  },
  reactionCountActive: {color: theme.primary},

  replyingBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 15,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.divider,
    backgroundColor: theme.background,
  },
  replyingBar_accent: {
    width: 3,
    height: 32,
    backgroundColor: theme.primary,
    borderRadius: 2,
    marginRight: 8,
  },
  replyingBar_label: {fontSize: 11, color: theme.primary, fontWeight: '600'},
  replyingBar_preview: {fontSize: 13, color: theme.textSecondary},
  replyingBar_close: {paddingHorizontal: 8, paddingVertical: 4},
  replyingBar_closeText: {fontSize: 18, color: theme.textSecondary},

  entitiesBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 14,
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 12,
    paddingTop: 6,
    paddingBottom: 2,
    backgroundColor: theme.background,
  },
  entityChip: {
    backgroundColor: theme.surface,
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginRight: 6,
    marginBottom: 4,
  },
  entityChipText: {
    fontSize: 11,
    color: theme.textSecondary,
  },

  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionSheetGlass: {borderRadius: 20, overflow: 'hidden'},
  actionSheet: {
    flexDirection: 'row',
    padding: 4,
  },
  actionBtn: {alignItems: 'center', justifyContent: 'center', padding: 14, minWidth: 80},
  actionEmoji: {fontSize: 22},
  actionLabel: {fontSize: 12, color: theme.textSecondary, marginTop: 4, fontWeight: '600'},
  actionDeleteEmoji: {fontSize: 20},
  actionDeleteLabel: {color: theme.danger},

  reactionPickerGlass: {borderRadius: 24, overflow: 'hidden'},
  reactionPicker: {
    flexDirection: 'row',
    padding: 8,
  },
  reactionPickerBtn: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reactionPickerEmoji: {fontSize: 28},

  infoSheet: {
    backgroundColor: theme.glass,
    borderWidth: 1,
    borderColor: theme.glassBorder,
    borderRadius: 20,
    padding: 20,
    width: '84%',
    maxWidth: 360,
    alignItems: 'stretch',
  },
  infoHeader: {alignItems: 'center', marginBottom: 18},
  infoTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: theme.textPrimary,
    marginTop: 10,
    textAlign: 'center',
  },
  infoType: {fontSize: 13, color: theme.textSecondary, marginTop: 2},
  infoRow: {
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.divider,
  },
  infoLabel: {fontSize: 12, color: theme.textSecondary, marginBottom: 2},
  infoValue: {fontSize: 15, color: theme.textPrimary},
  infoClose: {
    marginTop: 18,
    backgroundColor: theme.primary,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  infoCloseText: {color: 'white', fontWeight: '600', fontSize: 15},
  });
}

export default ChatScreen;
