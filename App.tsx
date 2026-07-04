import React, {useEffect, useState} from 'react';
import {SafeAreaView, StatusBar, StyleSheet, View} from 'react-native';
import TdLib from 'react-native-tdlib';
import AuthScreen from './src/screens/AuthScreen';
import ChatsScreen, {ChatSummary} from './src/screens/ChatsScreen';
import ChatScreen from './src/screens/ChatScreen';
import {ThemeProvider, useTheme} from './src/theme';
import {safeJsonParse, useAuthState} from './src/tdlib';

type Route = {name: 'chats'} | {name: 'chat'; chat: ChatSummary};

const AppShell: React.FC = () => {
  const {theme} = useTheme();
  const auth = useAuthState();
  const [route, setRoute] = useState<Route>({name: 'chats'});
  const [meId, setMeId] = useState<number | null>(null);

  useEffect(() => {
    if (auth.state !== 'ready') {
      return;
    }
    TdLib.getProfile()
      .then(r => {
        const me = safeJsonParse<{id: number}>(r);
        if (me?.id) {
          setMeId(me.id);
        }
      })
      .catch(() => {});
  }, [auth.state]);

  useEffect(() => {
    if (auth.state !== 'ready' && route.name !== 'chats') {
      setRoute({name: 'chats'});
    }
  }, [auth.state, route.name]);

  const isAuthed = auth.state === 'ready';

  let body: React.ReactNode;
  if (!isAuthed) {
    body = <AuthScreen info={auth} />;
  } else if (route.name === 'chats') {
    body = <ChatsScreen onOpenChat={chat => setRoute({name: 'chat', chat})} />;
  } else {
    body = (
      <ChatScreen
        chat={route.chat}
        meId={meId}
        onBack={() => setRoute({name: 'chats'})}
      />
    );
  }

  return (
    <SafeAreaView
      style={[styles.safe, {backgroundColor: theme.background}]}>
      <StatusBar
        barStyle={theme.statusBar}
        backgroundColor={theme.background}
      />
      <View style={[styles.container, {backgroundColor: theme.background}]}>
        {body}
      </View>
    </SafeAreaView>
  );
};

const App: React.FC = () => (
  <ThemeProvider>
    <AppShell />
  </ThemeProvider>
);

const styles = StyleSheet.create({
  safe: {flex: 1},
  container: {flex: 1},
});

export default App;
