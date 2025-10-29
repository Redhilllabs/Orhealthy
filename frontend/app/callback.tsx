import { View, Text, StyleSheet, ActivityIndicator, Platform } from 'react-native';
import { useEffect } from 'react';
import { useRouter } from 'expo-router';
import { useAuth } from '../src/context/AuthContext';

export default function CallbackScreen() {
  const router = useRouter();
  const { processSessionId } = useAuth();

  useEffect(() => {
    const handleCallback = async () => {
      console.log('[Callback] Starting callback handling');
      
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        console.log('[Callback] Full URL:', window.location.href);
        console.log('[Callback] Hash:', window.location.hash);
        console.log('[Callback] Search:', window.location.search);
        
        // Check URL hash for session_id
        const hash = window.location.hash;
        const hashMatch = hash.match(/session_id=([^&]+)/);
        
        // Also check query params
        const search = window.location.search;
        const searchMatch = search.match(/session_id=([^&]+)/);
        
        const sessionId = hashMatch?.[1] || searchMatch?.[1];
        
        if (sessionId) {
          console.log('[Callback] Found session_id:', sessionId);
          try {
            await processSessionId(sessionId);
            console.log('[Callback] Session processed, redirecting to tabs');
            router.replace('/(tabs)');
          } catch (error) {
            console.error('[Callback] Error processing session:', error);
            router.replace('/auth');
          }
        } else {
          console.log('[Callback] No session_id found, redirecting to auth');
          router.replace('/auth');
        }
      } else {
        console.log('[Callback] Not on web platform');
        router.replace('/auth');
      }
    };

    handleCallback();
  }, []);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#4CAF50" />
      <Text style={styles.text}>Processing authentication...</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  text: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
});
