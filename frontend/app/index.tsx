import { View, Text, StyleSheet, Image, ActivityIndicator, Platform } from 'react-native';
import { useEffect, useState } from 'react';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useAuth } from '../src/context/AuthContext';

export default function Index() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { user, loading, processSessionId, checkSession } = useAuth();
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    const init = async () => {
      console.log('[Index] Starting initialization');
      console.log('[Index] Params:', params);
      
      // Check for session_id in URL fragment (from OAuth redirect)
      let sessionId = params.session_id as string | undefined;
      
      // On web, check URL hash for session_id
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        console.log('[Index] Platform: web');
        console.log('[Index] Full URL:', window.location.href);
        console.log('[Index] Hash:', window.location.hash);
        
        const hash = window.location.hash;
        const match = hash.match(/session_id=([^&]+)/);
        if (match) {
          sessionId = match[1];
          console.log('[Index] Extracted session_id from hash:', sessionId);
          // Clean up the URL
          window.history.replaceState({}, document.title, window.location.pathname);
        } else {
          console.log('[Index] No session_id in hash');
        }
      }

      // If session_id found, process it
      if (sessionId) {
        console.log('[Index] Processing session_id:', sessionId);
        setProcessing(true);
        try {
          await processSessionId(sessionId);
          console.log('[Index] Session processed successfully, navigating to tabs');
          router.replace('/(tabs)');
        } catch (error) {
          console.error('[Index] Error processing session:', error);
          router.replace('/auth');
        } finally {
          setProcessing(false);
        }
        return;
      }

      console.log('[Index] No session_id, checking existing session');
      // Check existing session
      await checkSession();
    };

    init();
  }, []);

  useEffect(() => {
    if (!loading && !processing) {
      if (user) {
        router.replace('/(tabs)');
      } else {
        router.replace('/auth');
      }
    }
  }, [user, loading, processing]);

  return (
    <View style={styles.container}>
      <Image
        source={{ uri: 'https://customer-assets.emergentagent.com/job_nutritionhub-1/artifacts/kq74ajf1_Orhealthy%20Favicon.png' }}
        style={styles.logo}
      />
      <Text style={styles.title}>OrHealthy</Text>
      <ActivityIndicator size="large" color="#ffd700" style={styles.loader} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: {
    width: 120,
    height: 120,
    borderRadius: 60,
    marginBottom: 24,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#ffd700',
    marginBottom: 16,
  },
  loader: {
    marginTop: 24,
  },
});
