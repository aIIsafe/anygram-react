import {TdLibParameters} from 'react-native-tdlib';

export const TDLIB_API_ID = 34053256;
export const TDLIB_API_HASH = 'bc8984a70877b5768e5a6a80222da985';

export const MTPROTO_PROXY = {
  server: '78.17.154.32',
  port: 443,
  secret: 'ee012c78136de96da97a3b0c9b5dc635fd6966636f6e6669672e6d65',
} as const;

export const TDLIB_PARAMETERS: TdLibParameters = {
  api_id: TDLIB_API_ID,
  api_hash: TDLIB_API_HASH,
  device_model: 'AnyGram iOS',
  system_version: '1.0',
  application_version: '1.0.0',
  system_language_code: 'en',
};
