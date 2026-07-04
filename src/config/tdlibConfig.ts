import {TdLibParameters} from 'react-native-tdlib';

export const TDLIB_API_ID = 34053256;
export const TDLIB_API_HASH = 'bc8984a70877b5768e5a6a80222da985';

export const MTPROTO_PROXY = {
  server: '213.219.212.17',
  port: 8443,
  secret: '7p4d3g3gKi58ItEOL_-EEBN0Z25uLmxpdmU',
} as const;

export const TDLIB_PARAMETERS: TdLibParameters = {
  api_id: TDLIB_API_ID,
  api_hash: TDLIB_API_HASH,
  device_model: 'AnyGram iOS',
  system_version: '1.0',
  application_version: '1.0.0',
  system_language_code: 'en',
};
