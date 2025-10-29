import { View, Text, StyleSheet, Image, ActivityIndicator } from 'react-native';
import { useEffect, useState } from 'react';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useAuth } from '../src/context/AuthContext';

export default function Index() {
  const router = useRouter();
  const { session_id } = useLocalSearchParams();
  const { user, loading, processSessionId, checkSession } = useAuth();
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    const init = async () => {
      // If session_id in URL, process it
      if (session_id && typeof session_id === 'string') {
        setProcessing(true);
        await processSessionId(session_id);
        setProcessing(false);
        router.replace('/(tabs)');
        return;
      }

      // Check existing session
      await checkSession();
    };

    init();
  }, [session_id]);

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
      <ActivityIndicator size="large" color="#4CAF50" style={styles.loader} />
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
    color: '#4CAF50',
    marginBottom: 16,
  },
  loader: {
    marginTop: 24,
  },
});
