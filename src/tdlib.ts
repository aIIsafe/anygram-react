/**
 * AnyGram TDLib wrapper — initialization, MTProto proxy, auth state machine.
 */

import {useEffect, useRef, useState} from 'react';
import {NativeEventEmitter, NativeModules} from 'react-native';
import TdLib from 'react-native-tdlib';
import {MTPROTO_PROXY, TDLIB_PARAMETERS} from './config/tdlibConfig';

export type AnyGramTdLibParameters = typeof TDLIB_PARAMETERS & {
  mtproto_proxy: typeof MTPROTO_PROXY;
};

const START_PARAMETERS: AnyGramTdLibParameters = {
  ...TDLIB_PARAMETERS,
  mtproto_proxy: MTPROTO_PROXY,
};

export const tdEmitter = new NativeEventEmitter(NativeModules.TdLibModule);

export type AuthState =
  | 'loading'
  | 'wait_encryption'
  | 'wait_phone'
  | 'wait_code'
  | 'wait_password'
  | 'wait_registration'
  | 'wait_email'
  | 'ready'
  | 'closing'
  | 'closed'
  | 'unknown';

export interface AuthStateInfo {
  state: AuthState;
  phoneNumber?: string;
  codeType?: string;
  codeLength?: number;
  passwordHint?: string;
  hasRecoveryEmail?: boolean;
}

const STATE_MAP: Record<string, AuthState> = {
  authorizationStateWaitTdlibParameters: 'loading',
  authorizationStateWaitEncryptionKey: 'wait_encryption',
  authorizationStateWaitPhoneNumber: 'wait_phone',
  authorizationStateWaitCode: 'wait_code',
  authorizationStateWaitPassword: 'wait_password',
  authorizationStateWaitRegistration: 'wait_registration',
  authorizationStateWaitEmailAddress: 'wait_email',
  authorizationStateWaitEmailCode: 'wait_email',
  authorizationStateReady: 'ready',
  authorizationStateLoggingOut: 'loading',
  authorizationStateClosing: 'closing',
  authorizationStateClosed: 'closed',
};

let initPromise: Promise<void> | null = null;

/**
 * TDLib startup sequence (native patched):
 * 1. create client + setTdlibParameters
 * 2. addProxy with proxyTypeMtproto (chained before startTdLib resolves)
 */
export async function initializeTdLib(): Promise<void> {
  if (initPromise) {
    return initPromise;
  }

  initPromise = TdLib.startTdLib(START_PARAMETERS as any).then(() => undefined);

  try {
    await initPromise;
  } catch (error) {
    initPromise = null;
    throw error;
  }
}

export function resetTdLibInitialization(): void {
  initPromise = null;
}

async function submitDatabaseEncryptionKey(): Promise<void> {
  await TdLib.td_json_client_send({
    '@type': 'checkDatabaseEncryptionKey',
    encryption_key: '',
  });
}

function extractInfo(authState: any): AuthStateInfo {
  const type = authState?.['@type'] as string | undefined;
  const state = type ? STATE_MAP[type] ?? 'unknown' : 'unknown';

  const info: AuthStateInfo = {state};
  if (type === 'authorizationStateWaitCode') {
    const codeInfo = authState?.code_info ?? authState?.codeInfo;
    info.phoneNumber = codeInfo?.phone_number ?? codeInfo?.phoneNumber;
    const t = codeInfo?.type;
    info.codeType = t?.['@type'];
    info.codeLength = t?.length;
  }
  if (type === 'authorizationStateWaitPassword') {
    info.passwordHint = authState?.password_hint ?? authState?.passwordHint;
    info.hasRecoveryEmail =
      authState?.has_recovery_email_address ??
      authState?.hasRecoveryEmailAddress;
  }
  return info;
}

/**
 * Initialize TDLib with proxy, then keep auth state in sync with TDLib updates.
 */
export function useAuthState(): AuthStateInfo {
  const [info, setInfo] = useState<AuthStateInfo>({state: 'loading'});
  const encryptionHandled = useRef(false);

  useEffect(() => {
    let mounted = true;
    let restartInFlight = false;

    const restartIfNeeded = async (state: AuthState) => {
      if (state !== 'closed' || restartInFlight) {
        return;
      }
      restartInFlight = true;
      resetTdLibInitialization();
      encryptionHandled.current = false;
      try {
        await initializeTdLib();
      } catch {
        // TDLib may already be restarting via native layer
      } finally {
        restartInFlight = false;
      }
    };

    const apply = (newInfo: AuthStateInfo) => {
      if (!mounted) {
        return;
      }
      setInfo(newInfo);
      restartIfNeeded(newInfo.state);
    };

    const refresh = async () => {
      try {
        const r = await TdLib.getAuthorizationState();
        const parsed = JSON.parse(r);
        apply(extractInfo(parsed));
      } catch {
        if (mounted) {
          setInfo({state: 'unknown'});
        }
      }
    };

    const handleEncryptionKey = async () => {
      if (encryptionHandled.current) {
        return;
      }
      encryptionHandled.current = true;
      try {
        await submitDatabaseEncryptionKey();
      } catch {
        encryptionHandled.current = false;
      }
    };

    const sub = tdEmitter.addListener('tdlib-update', event => {
      if (!event?.type?.startsWith('updateAuthorizationState')) {
        return;
      }
      try {
        const data = JSON.parse(event.raw);
        const inner = data?.authorization_state ?? data?.authorizationState;
        if (!inner) {
          return;
        }
        if (inner['@type'] === 'authorizationStateWaitEncryptionKey') {
          handleEncryptionKey();
        }
        apply(extractInfo(inner));
      } catch {
        refresh();
      }
    });

    (async () => {
      try {
        await initializeTdLib();
      } catch {
        // Already started — pick up current state below
      }
      refresh();
    })();

    return () => {
      mounted = false;
      sub.remove();
    };
  }, []);

  return info;
}

export function useTdUpdate(
  typePrefix: string,
  handler: (data: any) => void,
): void {
  const handlerRef = useRef(handler);
  handlerRef.current = handler;
  useEffect(() => {
    const sub = tdEmitter.addListener('tdlib-update', event => {
      if (!event?.type?.startsWith(typePrefix)) {
        return;
      }
      try {
        handlerRef.current(JSON.parse(event.raw));
      } catch {
        // ignore malformed updates
      }
    });
    return () => sub.remove();
  }, [typePrefix]);
}

export function safeJsonParse<T = any>(s: string | null | undefined): T | null {
  if (!s) {
    return null;
  }
  try {
    return JSON.parse(s) as T;
  } catch {
    return null;
  }
}

export {default as TdLib} from 'react-native-tdlib';
