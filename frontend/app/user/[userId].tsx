import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useState, useEffect } from 'react';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { storage } from '../../src/utils/storage';
import { useAuth } from '../../src/context/AuthContext';
import * as ImagePicker from 'expo-image-picker';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL + '/api';

interface UserData {
  _id: string;
  name: string;
  email: string;
  picture?: string;
  points: number;
  star_rating: number;
  is_guide: boolean;
  idols: string[];
  fans: string[];
  guides: string[];
  guidees: string[];
  posts: any[];
  profile?: {
    height?: number;
    weight?: number;
    allergies?: string[];
    expertise?: string;
  };
}

export default function UserProfileScreen() {
  const { userId } = useLocalSearchParams<{ userId: string }>();
  const { user: currentUser } = useAuth();
  const router = useRouter();
  const [userData, setUserData] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);
  const [isFan, setIsFan] = useState(false);
  const [isGuidee, setIsGuidee] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [activeModal, setActiveModal] = useState<'posts' | 'following' | 'fans' | null>(null);

  useEffect(() => {
    fetchUserData();
  }, [userId]);

  const fetchUserData = async () => {
    try {
      const response = await axios.get(`${API_URL}/users/${userId}`);
      setUserData(response.data);
      
      if (currentUser) {
        setIsFan(response.data.fans?.includes(currentUser._id) || false);
        setIsGuidee(response.data.guidees?.includes(currentUser._id) || false);
      }
    } catch (error) {
      console.error('Error fetching user data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFanToggle = async () => {
    if (!currentUser || isProcessing) return;

    try {
      setIsProcessing(true);
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

      await fetchUserData();
    } catch (error) {
      console.error('Error toggling fan status:', error);
      Alert.alert('Error', 'Failed to update relationship');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleGuideeToggle = async () => {
    if (!currentUser || isProcessing || !userData?.is_guide) return;

    try {
      setIsProcessing(true);
      const token = await storage.getItemAsync('session_token');
      
      if (isGuidee) {
        // Remove from guidees
        await axios.delete(`${API_URL}/users/${userId}/remove-guidee`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setIsGuidee(false);
      } else {
        // Add as guidee
        await axios.post(
          `${API_URL}/users/${userId}/add-guidee`,
          {},
          { headers: { Authorization: `Bearer ${token}` } }
        );
        setIsGuidee(true);
      }

      await fetchUserData();
    } catch (error) {
      console.error('Error toggling guidee status:', error);
      Alert.alert('Error', 'Failed to update guidance relationship');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleMessageUser = async () => {
    if (!currentUser || isProcessing) return;

    try {
      setIsProcessing(true);
      const token = await storage.getItemAsync('session_token');
      
      // Get or create conversation
      const response = await axios.get(`${API_URL}/conversations/${userId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      
      // Navigate to chat screen
      router.push(`/chat/${response.data._id}`);
    } catch (error) {
      console.error('Error creating conversation:', error);
      Alert.alert('Error', 'Failed to start conversation');
    } finally {
      setIsProcessing(false);
    }
  };

  const renderStars = (rating: number) => {
    return (
      <View style={styles.starsContainer}>
        {Array.from({ length: rating }).map((_, i) => (
          <Ionicons key={i} name="star" size={16} color="#ffd700" />
        ))}
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#ffd700" />
      </View>
    );
  }

  if (!userData) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle-outline" size={64} color="#ccc" />
          <Text style={styles.errorText}>User not found</Text>
        </View>
      </SafeAreaView>
    );
  }

  const isOwnProfile = currentUser && currentUser._id === userId;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Profile</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.content}>
        <View style={styles.profileSection}>
          {userData.picture ? (
            <Image source={{ uri: userData.picture }} style={styles.profileImage} />
          ) : (
            <View style={[styles.profileImage, styles.profileImagePlaceholder]}>
              <Text style={styles.profileImageText}>
                {userData.name?.charAt(0).toUpperCase()}
              </Text>
            </View>
          )}

          <Text style={styles.userName}>{userData.name}</Text>
          
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              {renderStars(userData.star_rating)}
              <Text style={styles.statLabel}>
                {userData.star_rating} Star{userData.star_rating !== 1 ? 's' : ''}
              </Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{userData.points}</Text>
              <Text style={styles.statLabel}>Points</Text>
            </View>
          </View>

          {userData.is_guide && (
            <View style={styles.guideBadge}>
              <Ionicons name="checkmark-circle" size={16} color="#4CAF50" />
              <Text style={styles.guideBadgeText}>Guide</Text>
            </View>
          )}

          {!isOwnProfile && currentUser && (
            <View style={styles.actionButtons}>
              <TouchableOpacity
                style={[styles.fanButton, isFan && styles.fanButtonActive]}
                onPress={handleFanToggle}
                disabled={isProcessing}
              >
                {isProcessing ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Ionicons
                      name={isFan ? 'heart' : 'heart-outline'}
                      size={18} color="#fff"
                    />
                    <Text style={styles.fanButtonText}>
                      {isFan ? 'Unfollow' : 'Follow'}
                    </Text>
                  </>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.messageButton}
                onPress={handleMessageUser}
                disabled={isProcessing}
              >
                {isProcessing ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Ionicons name="chatbubble" size={18} color="#fff" />
                    <Text style={styles.messageButtonText}>Message</Text>
                  </>
                )}
              </TouchableOpacity>

              {userData.is_guide && (
                <TouchableOpacity
                  style={[styles.guideeButton, isGuidee && styles.guideeButtonActive]}
                  onPress={handleGuideeToggle}
                  disabled={isProcessing}
                >
                  {isProcessing ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <>
                      <Ionicons
                        name={isGuidee ? 'people' : 'people-outline'}
                        size={18}
                        color="#fff"
                      />
                      <Text style={styles.guideeButtonText}>
                        {isGuidee ? 'Stop Guidance' : 'Be a Guidee'}
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>

        {/* Clickable Stats Cards */}
        <View style={styles.statsCards}>
          <TouchableOpacity
            style={styles.statsCard}
            onPress={() => setActiveModal('posts')}
          >
            <Text style={styles.statsCardValue}>{userData.posts?.length || 0}</Text>
            <Text style={styles.statsCardLabel}>Posts</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={styles.statsCard}
            onPress={() => setActiveModal('following')}
          >
            <Text style={styles.statsCardValue}>{userData.idols?.length || 0}</Text>
            <Text style={styles.statsCardLabel}>Following</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={styles.statsCard}
            onPress={() => setActiveModal('fans')}
          >
            <Text style={styles.statsCardValue}>{userData.fans?.length || 0}</Text>
            <Text style={styles.statsCardLabel}>Fans</Text>
          </TouchableOpacity>
        </View>

        {/* Modal Content based on activeModal */}
        {activeModal && (
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {activeModal === 'posts' && 'Posts'}
                {activeModal === 'following' && 'Following'}
                {activeModal === 'fans' && 'Fans'}
              </Text>
              <TouchableOpacity onPress={() => setActiveModal(null)}>
                <Ionicons name="close-circle" size={28} color="#666" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalScroll}>
              {activeModal === 'posts' && (
                <View style={styles.postsGrid}>
                  {userData.posts && userData.posts.length > 0 ? (
                    userData.posts.map((post) => (
                      <View key={post._id} style={styles.postCard}>
                        <Text style={styles.postContent} numberOfLines={3}>
                          {post.content}
                        </Text>
                        {post.image && (
                          <Image source={{ uri: post.image }} style={styles.postImage} />
                        )}
                        <View style={styles.postFooter}>
                          <Ionicons name="heart" size={14} color="#F44336" />
                          <Text style={styles.postStat}>{post.vote_ups}</Text>
                        </View>
                      </View>
                    ))
                  ) : (
                    <Text style={styles.emptyText}>No posts yet</Text>
                  )}
                </View>
              )}

              {activeModal === 'following' && (
                <View style={styles.usersList}>
                  {userData.idols && userData.idols.length > 0 ? (
                    userData.idols.map((userId) => (
                      <TouchableOpacity
                        key={userId}
                        style={styles.userItem}
                        onPress={() => {
                          setActiveModal(null);
                          router.push(`/user/${userId}`);
                        }}
                      >
                        <Ionicons name="person-circle" size={40} color="#ffd700" />
                        <Text style={styles.userItemText}>View Profile</Text>
                      </TouchableOpacity>
                    ))
                  ) : (
                    <Text style={styles.emptyText}>Not following anyone</Text>
                  )}
                </View>
              )}

              {activeModal === 'fans' && (
                <View style={styles.usersList}>
                  {userData.fans && userData.fans.length > 0 ? (
                    userData.fans.map((userId) => (
                      <TouchableOpacity
                        key={userId}
                        style={styles.userItem}
                        onPress={() => {
                          setActiveModal(null);
                          router.push(`/user/${userId}`);
                        }}
                      >
                        <Ionicons name="person-circle" size={40} color="#ffd700" />
                        <Text style={styles.userItemText}>View Profile</Text>
                      </TouchableOpacity>
                    ))
                  ) : (
                    <Text style={styles.emptyText}>No fans yet</Text>
                  )}
                </View>
              )}
            </ScrollView>
          </View>
        )}
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
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    fontSize: 18,
    color: '#666',
    marginTop: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  content: {
    flex: 1,
  },
  profileSection: {
    backgroundColor: '#fff',
    padding: 24,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  profileImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
    marginBottom: 16,
  },
  profileImagePlaceholder: {
    backgroundColor: '#ffd700',
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileImageText: {
    fontSize: 40,
    fontWeight: 'bold',
    color: '#fff',
  },
  userName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  statItem: {
    alignItems: 'center',
  },
  statDivider: {
    width: 1,
    height: 40,
    backgroundColor: '#eee',
    marginHorizontal: 24,
  },
  starsContainer: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ffd700',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 14,
    color: '#666',
  },
  guideBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F5E9',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginBottom: 16,
    gap: 4,
  },
  guideBadgeText: {
    color: '#4CAF50',
    fontSize: 14,
    fontWeight: '600',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  fanButton: {
    flex: 1,
    backgroundColor: '#ffd700',
    paddingVertical: 12,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  fanButtonActive: {
    backgroundColor: '#666',
  },
  fanButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  messageButton: {
    flex: 1,
    backgroundColor: '#007AFF',
    paddingVertical: 12,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  messageButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  guideeButton: {
    flex: 1,
    backgroundColor: '#4CAF50',
    paddingVertical: 12,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  guideeButtonActive: {
    backgroundColor: '#F44336',
  },
  guideeButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  statsCards: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
  },
  statsCard: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statsCardValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  statsCardLabel: {
    fontSize: 12,
    color: '#666',
  },
  modalContent: {
    backgroundColor: '#fff',
    margin: 16,
    borderRadius: 12,
    padding: 16,
    minHeight: 300,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  modalScroll: {
    maxHeight: 400,
  },
  postsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  postCard: {
    width: '48%',
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  postContent: {
    fontSize: 13,
    color: '#333',
    marginBottom: 8,
  },
  postImage: {
    width: '100%',
    height: 100,
    borderRadius: 6,
    marginBottom: 8,
  },
  postFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  postStat: {
    fontSize: 12,
    color: '#666',
  },
  usersList: {
    gap: 12,
  },
  userItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
  },
  userItemText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  emptyText: {
    textAlign: 'center',
    color: '#999',
    fontSize: 14,
    paddingVertical: 32,
  },
});
