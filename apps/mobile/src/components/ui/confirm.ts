import { Alert, Platform } from 'react-native';

/** Confirmation dialog for destructive actions (native Alert, browser confirm on web). */
export function confirm(title: string, msg: string, ok: string, fn: () => void) {
  if (Platform.OS === 'web') {
    if ((globalThis as any).confirm(`${title}\n\n${msg}`)) fn();
    return;
  }
  Alert.alert(title, msg, [{ text: 'Cancel', style: 'cancel' }, { text: ok, style: 'destructive', onPress: fn }]);
}

export function notify(title: string, msg: string) {
  if (Platform.OS === 'web') (globalThis as any).alert(`${title}\n\n${msg}`);
  else Alert.alert(title, msg);
}
