// Native map (iOS / Android): the shared MapLibre runtime inside a WebView.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import { WebView as RNWebView } from 'react-native-webview';
const WebView = RNWebView as any;
import { config } from '@/services/config';
import { MAPLIBRE_CSS, MAPLIBRE_JS, RUNTIME, type MapProps } from './runtime';

export default function MapView({ style, onMarkerPress, onMapPress, ...props }: MapProps & { style?: StyleProp<ViewStyle>; onMarkerPress?: (id: string) => void; onMapPress?: () => void }) {
  const ref = useRef<any>(null);
  const [ready, setReady] = useState(false);
  const full = { ...props, mapboxToken: config.mapboxToken };
  const initial = useRef(full);

  const html = useMemo(() => `<!doctype html><html><head>
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
<link rel="stylesheet" href="${MAPLIBRE_CSS}">
<style>html,body,#m{margin:0;height:100%;background:#EDE8DE}</style>
<script src="${MAPLIBRE_JS}"></script></head><body><div id="m"></div>
<script>${RUNTIME}
var emit=function(e){window.ReactNativeWebView.postMessage(JSON.stringify(e))};
window.__map=createDetourMap(maplibregl,document.getElementById('m'),emit,${JSON.stringify(initial.current)});
window.__update=function(p){window.__map.update(p)};
</script></body></html>`, []);

  const json = JSON.stringify(full);
  useEffect(() => {
    if (ready) ref.current?.injectJavaScript(`window.__update(${json});true;`);
  }, [json, ready]);

  return (
    <View style={[{ backgroundColor: '#EDE8DE', overflow: 'hidden' }, style]}>
      <WebView
        ref={ref}
        originWhitelist={['*']}
        source={{ html }}
        style={{ flex: 1, backgroundColor: 'transparent' }}
        onMessage={(e: any) => {
          try {
            const m = JSON.parse(e.nativeEvent.data);
            if (m.type === 'ready') setReady(true);
            if (m.type === 'marker') onMarkerPress?.(m.id);
            if (m.type === 'mapclick') onMapPress?.();
          } catch {}
        }}
        javaScriptEnabled
        scrollEnabled={false}
        setSupportMultipleWindows={false}
        accessibilityLabel="Map"
      />
    </View>
  );
}
