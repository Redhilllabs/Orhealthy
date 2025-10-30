import { Stack } from 'expo-router';
import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { AuthProvider } from '../src/context/AuthContext';
import { CartProvider } from '../src/context/CartContext';
import { MessagesProvider } from '../src/context/MessagesContext';

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AuthProvider>
        <CartProvider>
          <MessagesProvider>
            <Stack screenOptions={{ headerShown: false }}>
              <Stack.Screen name="index" />
              <Stack.Screen name="(tabs)" />
              <Stack.Screen name="auth" />
              <Stack.Screen name="post/[id]" options={{ presentation: 'modal' }} />
              <Stack.Screen name="checkout" />
            </Stack>
          </MessagesProvider>
        </CartProvider>
      </AuthProvider>
    </GestureHandlerRootView>
  );
}
