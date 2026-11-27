// Web stand-in for apple.native.ts: Sign in with Apple is offered on iPhone only.
import type React from 'react';

export type AppleCredential = { token: string; nonce: string; name?: string };

export const AppleButton: React.ComponentType<any> = () => null;
export const AppleButtonType = { SIGN_IN: 0, CONTINUE: 1, SIGN_UP: 2 } as const;
export const AppleButtonStyle = { WHITE: 0, WHITE_OUTLINE: 1, BLACK: 2 } as const;

export async function appleAvailable(): Promise<boolean> { return false; }
export async function appleCredential(): Promise<AppleCredential | null> { return null; }
