import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  FlatList,
  Dimensions,
} from 'react-native';
import { useState, useEffect } from 'react';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { storage } from '../../src/utils/storage';
import { useAuth } from '../../src/context/AuthContext';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL + '/api';
const { width } = Dimensions.get('window');

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
  const [isProcessing, setIsProcessing] = useState(false);
  const [activeTab, setActiveTab] = useState<'posts' | 'idols' | 'fans'>('posts');

  useEffect(() => {
    fetchUserData();
  }, [userId]);

  const fetchUserData = async () => {
    try {
      const response = await axios.get(`${API_URL}/users/${userId}`);
      setUserData(response.data);
      
      // Check if current user is a fan of this user
      if (currentUser) {
        setIsFan(response.data.fans?.includes(currentUser._id) || false);
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
      } else {
        await axios.post(
          `${API_URL}/users/${userId}/become-fan`,
          {},
          { headers: { Authorization: `Bearer ${token}` } }
        );
      }

      setIsFan(!isFan);
      await fetchUserData();
    } catch (error) {
      console.error('Error toggling fan status:', error);
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

  const renderPost = ({ item }: { item: any }) => (
    <View style={styles.postCard}>
      <Text style={styles.postContent} numberOfLines={3}>{item.content}</Text>
      {item.image && (
        <Image source={{ uri: item.image }} style={styles.postImage} />
      )}
      <View style={styles.postFooter}>
        <View style={styles.postStat}>
          <Ionicons name="heart" size={16} color="#F44336" />
          <Text style={styles.postStatText}>{item.vote_ups}</Text>
        </View>
      </View>
    </View>
  );

  const renderIdol = ({ item }: { item: string }) => (
    <TouchableOpacity
      style={styles.userListItem}
      onPress={() => router.push(`/user/${item}`)}
    >
      <View style={[styles.avatar, styles.avatarPlaceholder]}>
        <Ionicons name="person" size={24} color="#fff" />
      </View>
      <Text style={styles.userListText}>User</Text>
    </TouchableOpacity>
  );

  const renderTabContent = () => {
    switch (activeTab) {
      case 'posts':
        return (
          <FlatList
            data={userData?.posts || []}
            renderItem={renderPost}
            keyExtractor={(item) => item._id}
            numColumns={2}
            columnWrapperStyle={styles.postGrid}
            contentContainerStyle={styles.postsContent}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <Ionicons name="document-text-outline" size={48} color="#ccc" />
                <Text style={styles.emptyText}>No posts yet</Text>
              </View>
            }
          />
        );
      case 'idols':
        return (
          <FlatList
            data={userData?.idols || []}
            renderItem={renderIdol}
            keyExtractor={(item) => item}
            contentContainerStyle={styles.listContent}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <Ionicons name="people-outline" size={48} color="#ccc" />
                <Text style={styles.emptyText}>No idols yet</Text>
              </View>
            }
          />
        );
      case 'fans':
        return (
          <FlatList
            data={userData?.fans || []}
            renderItem={renderIdol}
            keyExtractor={(item) => item}
            contentContainerStyle={styles.listContent}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <Ionicons name="people-outline" size={48} color="#ccc" />
                <Text style={styles.emptyText}>No fans yet</Text>
              </View>
            }
          />
        );
    }
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
                      size={20}
                      color="#fff"
                    />
                    <Text style={styles.fanButtonText}>
                      {isFan ? 'Unfollow' : 'Follow'}
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          )}
        </View>

        <View style={styles.statsCards}>
          <View style={styles.statsCard}>
            <Text style={styles.statsCardValue}>{userData.fans?.length || 0}</Text>
            <Text style={styles.statsCardLabel}>Fans</Text>
          </View>
          <View style={styles.statsCard}>
            <Text style={styles.statsCardValue}>{userData.idols?.length || 0}</Text>
            <Text style={styles.statsCardLabel}>Following</Text>
          </View>
          <View style={styles.statsCard}>
            <Text style={styles.statsCardValue}>{userData.posts?.length || 0}</Text>
            <Text style={styles.statsCardLabel}>Posts</Text>
          </View>
        </View>

        <View style={styles.tabsContainer}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'posts' && styles.tabActive]}
            onPress={() => setActiveTab('posts')}
          >
            <Text style={[styles.tabText, activeTab === 'posts' && styles.tabTextActive]}>
              Posts
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'idols' && styles.tabActive]}
            onPress={() => setActiveTab('idols')}
          >
            <Text style={[styles.tabText, activeTab === 'idols' && styles.tabTextActive]}>
              Following
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'fans' && styles.tabActive]}
            onPress={() => setActiveTab('fans')}
          >
            <Text style={[styles.tabText, activeTab === 'fans' && styles.tabTextActive]}>
              Fans
            </Text>
          </TouchableOpacity>
        </View>

        {renderTabContent()}
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
    gap: 8,
  },
  fanButtonActive: {
    backgroundColor: '#666',
  },
  fanButtonText: {
    color: '#fff',
    fontSize: 16,
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
  tabsContainer: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginVertical: 8,
    borderRadius: 12,
    padding: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 8,
  },
  tabActive: {
    backgroundColor: '#ffd700',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  tabTextActive: {
    color: '#fff',
  },
  postsContent: {
    padding: 8,
  },
  postGrid: {
    gap: 8,
    paddingHorizontal: 8,
  },
  postCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    maxWidth: (width - 40) / 2,
  },
  postContent: {
    fontSize: 14,
    color: '#333',
    marginBottom: 8,
  },
  postImage: {
    width: '100%',
    height: 120,
    borderRadius: 8,
    marginBottom: 8,
  },
  postFooter: {
    flexDirection: 'row',
  },
  postStat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  postStatText: {
    fontSize: 12,
    color: '#666',
  },
  listContent: {
    padding: 16,
  },
  userListItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 12,
    marginBottom: 8,
    gap: 12,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  avatarPlaceholder: {
    backgroundColor: '#ffd700',
    justifyContent: 'center',
    alignItems: 'center',
  },
  userListText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 64,
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    marginTop: 16,
  },
});
