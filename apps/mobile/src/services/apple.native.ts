// Sign in with Apple (iOS). Metro loads this file on native only; apple.ts is the web stand-in.
// Apple gets the SHA-256 of a one-time nonce; Supabase gets the raw nonce and checks they match.
import { Platform } from 'react-native';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';

export type AppleCredential = { token: string; nonce: string; name?: string };

export const AppleButton = AppleAuthentication.AppleAuthenticationButton;
export const AppleButtonType = AppleAuthentication.AppleAuthenticationButtonType;
export const AppleButtonStyle = AppleAuthentication.AppleAuthenticationButtonStyle;

export async function appleAvailable(): Promise<boolean> {
  if (Platform.OS !== 'ios') return false;
  try { return await AppleAuthentication.isAvailableAsync(); } catch { return false; }
}

/** Shows Apple's sheet. Returns null when the person cancels. */
export async function appleCredential(): Promise<AppleCredential | null> {
  const nonce = Crypto.randomUUID();
  const hashed = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, nonce);
  try {
    const c = await AppleAuthentication.signInAsync({
      requestedScopes: [AppleAuthentication.AppleAuthenticationScope.FULL_NAME, AppleAuthentication.AppleAuthenticationScope.EMAIL],
      nonce: hashed,
    });
    if (!c.identityToken) throw new Error('Apple did not return a sign-in token. Please try again.');
    // Apple sends the name only the first time someone signs in to this app.
    const name = [c.fullName?.givenName, c.fullName?.familyName].filter(Boolean).join(' ') || undefined;
    return { token: c.identityToken, nonce, name };
  } catch (e: any) {
    if (e?.code === 'ERR_REQUEST_CANCELED' || e?.code === 'ERR_CANCELED') return null;
    throw e;
  }
}
