// Bottom sheet: modal with drag-to-dismiss (Gesture Handler + Reanimated).
import React, { useEffect } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { color, radius, space } from '@/theme/tokens';

export function Sheet({ visible, onClose, children, maxHeight = 0.88, label }: { visible: boolean; onClose: () => void; children: React.ReactNode; maxHeight?: number; label?: string }) {
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const y = useSharedValue(height);
  const fade = useSharedValue(0);

  useEffect(() => {
    if (visible) { y.value = withSpring(0, { damping: 22, stiffness: 200 }); fade.value = withTiming(1, { duration: 220 }); }
  }, [visible, y, fade]);

  const close = () => {
    fade.value = withTiming(0, { duration: 180 });
    y.value = withTiming(height, { duration: 220 }, (done) => { if (done) runOnJS(onClose)(); });
  };

  const pan = Gesture.Pan()
    .activeOffsetY(8)
    .onUpdate((e) => { y.value = Math.max(0, e.translationY); })
    .onEnd((e) => {
      if (e.translationY > 120 || e.velocityY > 900) {
        fade.value = withTiming(0, { duration: 180 });
        y.value = withTiming(height, { duration: 200 }, (d) => { if (d) runOnJS(onClose)(); });
      } else y.value = withSpring(0, { damping: 20, stiffness: 220 });
    });

  const sheet = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }] }));
  const scrim = useAnimatedStyle(() => ({ opacity: fade.value }));

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={close} statusBarTranslucent>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: color.scrim }, scrim]}>
          <Pressable style={{ flex: 1 }} onPress={close} accessibilityLabel="Close" />
        </Animated.View>
        <Animated.View accessibilityViewIsModal accessibilityLabel={label}
          style={[{ position: 'absolute', left: 0, right: 0, bottom: 0, maxHeight: height * maxHeight, backgroundColor: color.white, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, paddingBottom: insets.bottom + space.lg, maxWidth: 480, alignSelf: 'center', width: '100%' }, sheet]}>
          <GestureDetector gesture={pan}>
            <View style={{ alignItems: 'center', paddingVertical: space.md }} accessibilityLabel="Drag down to close">
              <View style={{ width: 44, height: 5, borderRadius: 3, backgroundColor: '#CFC6B5' }} />
            </View>
          </GestureDetector>
          <ScrollView contentContainerStyle={{ paddingHorizontal: space.xl, paddingBottom: space.lg, gap: space.lg }} keyboardShouldPersistTaps="handled">
            {children}
          </ScrollView>
        </Animated.View>
      </GestureHandlerRootView>
    </Modal>
  );
}
