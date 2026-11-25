// Outgoing HTTP identity.
// React Native on Android sends "okhttp/x.y" as User-Agent. Wikimedia (images, Wikipedia,
// Wikidata), Photon and Overpass reject that generic agent (403 / 406), so on native every
// request to an outside service names the app. Browsers set their own User-Agent and do not let
// pages change it, so on web nothing is added. No personal or account details go in here.
import { Platform } from 'react-native';

export const APP_USER_AGENT = 'DetourLoop/0.1 (mobile travel app)';

export const uaHeaders: Record<string, string> = Platform.OS === 'web' ? {} : { 'User-Agent': APP_USER_AGENT };

/** fetch() with the app User-Agent on iOS/Android. */
export function xfetch(input: string, init: RequestInit = {}) {
  return fetch(input, { ...init, headers: { ...uaHeaders, ...((init.headers as Record<string, string>) ?? {}) } });
}

/** expo-image source for a remote URL, carrying the app User-Agent on native. */
export function imageSource(uri: string) {
  return /^https?:\/\//.test(uri) && Platform.OS !== 'web' ? { uri, headers: uaHeaders } : { uri };
}
