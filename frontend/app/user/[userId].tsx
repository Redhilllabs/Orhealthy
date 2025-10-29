import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  FlatList,
} from 'react-native';
import { useState, useEffect } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import axios from 'axios';
import { storage } from '../src/utils/storage';
import { useAuth } from '../src/context/AuthContext';
import { SafeAreaView } from 'react-native-safe-area-context';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL + '/api';

export default function UserProfileScreen() {
  const { userId } = useLocalSearchParams();
  const router = useRouter();
  const { user: currentUser } = useAuth();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isFan, setIsFan] = useState(false);

  useEffect(() => {
    if (userId) {
      fetchUserProfile();
    }
  }, [userId]);

  const fetchUserProfile = async () => {
    try {
      const response = await axios.get(`${API_URL}/users/${userId}`);
      setUser(response.data);
      
      // Check if current user is a fan
      if (currentUser && response.data.fans) {
        setIsFan(response.data.fans.includes(currentUser._id));
      }
    } catch (error) {
      console.error('Error fetching user profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFanToggle = async () => {
    try {
      const token = await storage.getItemAsync('session_token');
      if (isFan) {
        await axios.delete(`${API_URL}/users/${userId}/unfan`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setIsFan(false);
      } else {
        await axios.post(
          `${API_URL}/users/${userId}/become-fan`,
          {},
          { headers: { Authorization: `Bearer ${token}` } }
        );
        setIsFan(true);
      }
      await fetchUserProfile();
    } catch (error) {
      console.error('Error toggling fan:', error);
    }
  };

  const renderStars = (rating: number) => {
    return (
      <View style={styles.stars}>
        {Array.from({ length: 5 }).map((_, index) => (
          <Ionicons
            key={index}
            name={index < rating ? 'star' : 'star-outline'}
            size={16}
            color="#ffd700"
          />
        ))}
      </View>
    );
  };

  const renderPost = ({ item }: { item: any }) => (
    <View style={styles.postCard}>
      <Text style={styles.postContent}>{item.content}</Text>
      {item.image && (
        <Image source={{ uri: item.image }} style={styles.postImage} />
      )}
      <View style={styles.postFooter}>
        <View style={styles.postStat}>
          <Ionicons name="heart" size={16} color="#F44336" />
          <Text style={styles.postStatText}>{item.vote_ups}</Text>
        </View>
        <Text style={styles.postDate}>
          {new Date(item.created_at).toLocaleDateString()}
        </Text>
      </View>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#ffd700" />
      </View>
    );
  }

  if (!user) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={28} color="#333" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>User Not Found</Text>
        </View>
      </SafeAreaView>
    );
  }

  const isOwnProfile = currentUser && currentUser._id === userId;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={28} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Profile</Text>
        <View style={{ width: 28 }} />
      </View>

      <ScrollView>
        {/* Profile Header */}
        <View style={styles.profileHeader}>
          {user.picture ? (
            <Image source={{ uri: user.picture }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarPlaceholder]}>
              <Text style={styles.avatarText}>
                {user.name?.charAt(0).toUpperCase()}
              </Text>
            </View>
          )}

          <Text style={styles.name}>{user.name}</Text>
          <Text style={styles.email}>{user.email}</Text>

          {renderStars(user.star_rating)}

          <View style={styles.badge}>
            {user.is_guide ? (
              <View style={styles.guideBadge}>
                <Ionicons name="medal" size={20} color="#ffd700" />
                <Text style={styles.guideText}>Guide</Text>
              </View>
            ) : (
              <Text style={styles.guideeText}>Guidee</Text>
            )}
          </View>

          <View style={styles.statsRow}>
            <View style={styles.stat}>
              <Text style={styles.statValue}>{user.points + user.inherent_points}</Text>
              <Text style={styles.statLabel}>Points</Text>
            </View>
            <View style={styles.stat}>
              <Text style={styles.statValue}>{user.fans?.length || 0}</Text>
              <Text style={styles.statLabel}>Fans</Text>
            </View>
            <View style={styles.stat}>
              <Text style={styles.statValue}>{user.idols?.length || 0}</Text>
              <Text style={styles.statLabel}>Idols</Text>
            </View>
            <View style={styles.stat}>
              <Text style={styles.statValue}>{user.guidees?.length || 0}</Text>
              <Text style={styles.statLabel}>Guidees</Text>
            </View>
          </View>

          {!isOwnProfile && (
            <TouchableOpacity
              style={[styles.fanButton, isFan && styles.fanButtonActive]}
              onPress={handleFanToggle}
            >
              <Ionicons
                name={isFan ? 'star' : 'star-outline'}
                size={20}
                color={isFan ? '#ffd700' : '#fff'}
              />
              <Text style={styles.fanButtonText}>
                {isFan ? 'Idol ★' : 'Become a Fan'}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* User's Posts */}
        <View style={styles.postsSection}>
          <Text style={styles.sectionTitle}>Posts ({user.posts?.length || 0})</Text>
          {user.posts && user.posts.length > 0 ? (
            <FlatList
              data={user.posts}
              renderItem={renderPost}
              keyExtractor={(item) => item._id}
              scrollEnabled={false}
            />
          ) : (
            <Text style={styles.noPosts}>No posts yet</Text>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  profileHeader: {
    backgroundColor: '#fff',
    alignItems: 'center',
    paddingVertical: 32,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    marginBottom: 16,
  },
  avatarPlaceholder: {
    backgroundColor: '#ffd700',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: '#fff',
    fontSize: 40,
    fontWeight: 'bold',
  },
  name: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  email: {
    fontSize: 14,
    color: '#666',
    marginBottom: 12,
  },
  stars: {
    flexDirection: 'row',
    gap: 4,
    marginBottom: 16,
  },
  badge: {
    marginBottom: 24,
  },
  guideBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff8e1',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 8,
    borderWidth: 2,
    borderColor: '#ffd700',
  },
  guideText: {
    color: '#ffd700',
    fontWeight: '600',
    fontSize: 16,
  },
  guideeText: {
    color: '#666',
    fontSize: 16,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 24,
    marginBottom: 24,
  },
  stat: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ffd700',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
  },
  fanButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#ffd700',
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 25,
  },
  fanButtonActive: {
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#ffd700',
  },
  fanButtonText: {
    color: '#333',
    fontSize: 16,
    fontWeight: '600',
  },
  postsSection: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
  },
  postCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  postContent: {
    fontSize: 16,
    color: '#333',
    lineHeight: 24,
    marginBottom: 12,
  },
  postImage: {
    width: '100%',
    height: 200,
    borderRadius: 12,
    marginBottom: 12,
  },
  postFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  postStat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  postStatText: {
    fontSize: 14,
    color: '#666',
  },
  postDate: {
    fontSize: 12,
    color: '#999',
  },
  noPosts: {
    textAlign: 'center',
    color: '#999',
    fontSize: 16,
    marginTop: 32,
  },
});
