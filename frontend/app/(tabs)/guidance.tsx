import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  Alert,
} from 'react-native';
import { useState, useEffect } from 'react';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { storage } from '../../src/utils/storage';
import { useAuth } from '../../src/context/AuthContext';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL + '/api';

interface Conversation {
  _id: string;
  user1_id: string;
  user1_name: string;
  user1_picture?: string;
  user2_id: string;
  user2_name: string;
  user2_picture?: string;
  last_message?: string;
  last_message_at?: string;
  unread_count_user1: number;
  unread_count_user2: number;
}

interface HabitLog {
  _id: string;
  date: string;
  habit_type: string;
  description: string;
  value?: number;
  unit?: string;
  created_at: string;
}

export default function GuidanceScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'timeline' | 'plans' | 'about' | 'messages'>('timeline');
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [habits, setHabits] = useState<HabitLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (activeTab === 'timeline') {
      fetchHabits();
    } else if (activeTab === 'messages') {
      fetchConversations();
    }
  }, [activeTab]);

  const fetchConversations = async () => {
    try {
      const token = await storage.getItemAsync('session_token');
      const response = await axios.get(`${API_URL}/conversations`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setConversations(response.data);
    } catch (error) {
      console.error('Error fetching conversations:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const fetchHabits = async () => {
    setLoading(true);
    try {
      const token = await storage.getItemAsync('session_token');
      const response = await axios.get(`${API_URL}/habits`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setHabits(response.data || []);
    } catch (error) {
      console.error('Error fetching habits:', error);
      setHabits([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const deleteHabit = async (habitId: string) => {
    try {
      const token = await storage.getItemAsync('session_token');
      await axios.delete(`${API_URL}/habits/${habitId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      fetchHabits();
    } catch (error) {
      console.error('Error deleting habit:', error);
    }
  };

  const getOtherUser = (conversation: Conversation) => {
    if (conversation.user1_id === user?._id) {
      return {
        id: conversation.user2_id,
        name: conversation.user2_name,
        picture: conversation.user2_picture,
      };
    }
    return {
      id: conversation.user1_id,
      name: conversation.user1_name,
      picture: conversation.user1_picture,
    };
  };

  const getUnreadCount = (conversation: Conversation) => {
    if (conversation.user1_id === user?._id) {
      return conversation.unread_count_user1;
    }
    return conversation.unread_count_user2;
  };

  const renderConversation = ({ item }: { item: Conversation }) => {
    const otherUser = getOtherUser(item);
    const unreadCount = getUnreadCount(item);

    return (
      <TouchableOpacity
        style={styles.conversationCard}
        onPress={() => router.push(`/chat/${item._id}`)}
      >
        {otherUser.picture ? (
          <Image source={{ uri: otherUser.picture }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, styles.avatarPlaceholder]}>
            <Text style={styles.avatarText}>
              {otherUser.name?.charAt(0).toUpperCase()}
            </Text>
          </View>
        )}

        <View style={styles.conversationInfo}>
          <View style={styles.conversationHeader}>
            <Text style={styles.userName}>{otherUser.name}</Text>
            {item.last_message_at && (
              <Text style={styles.timestamp}>
                {new Date(item.last_message_at).toLocaleDateString()}
              </Text>
            )}
          </View>
          <View style={styles.messageRow}>
            <Text
              style={[
                styles.lastMessage,
                unreadCount > 0 && styles.unreadMessage,
              ]}
              numberOfLines={1}
            >
              {item.last_message || 'Start a conversation'}
            </Text>
            {unreadCount > 0 && (
              <View style={styles.unreadBadge}>
                <Text style={styles.unreadBadgeText}>{unreadCount}</Text>
              </View>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'timeline':
        return (
          <View style={styles.tabContent}>
            {loading ? (
              <ActivityIndicator size="large" color="#ffd700" style={{ marginTop: 20 }} />
            ) : habits.length === 0 ? (
              <Text style={styles.emptyText}>No timeline activities yet</Text>
            ) : (
              <FlatList
                data={habits}
                keyExtractor={(item) => item._id}
                renderItem={({ item }) => (
                  <View style={styles.habitCard}>
                    <View style={styles.habitHeader}>
                      <View style={styles.habitTypeContainer}>
                        <Ionicons
                          name={
                            item.habit_type === 'meals' ? 'restaurant' :
                            item.habit_type === 'exercise' ? 'fitness' :
                            item.habit_type === 'water' ? 'water' :
                            item.habit_type === 'sleep' ? 'moon' : 'document-text'
                          }
                          size={24}
                          color="#ffd700"
                        />
                        <Text style={styles.habitType}>{item.habit_type}</Text>
                      </View>
                      <TouchableOpacity
                        onPress={() => {
                          Alert.alert(
                            'Delete Activity',
                            'Are you sure you want to delete this activity?',
                            [
                              { text: 'Cancel', style: 'cancel' },
                              { text: 'Delete', style: 'destructive', onPress: () => deleteHabit(item._id) },
                            ]
                          );
                        }}
                      >
                        <Ionicons name="trash-outline" size={20} color="#ef4444" />
                      </TouchableOpacity>
                    </View>
                    <Text style={styles.habitDescription}>{item.description}</Text>
                    {item.value && (
                      <Text style={styles.habitValue}>
                        {item.value} {item.unit}
                      </Text>
                    )}
                    <Text style={styles.habitDate}>
                      {new Date(item.date).toLocaleDateString()} at {new Date(item.date).toLocaleTimeString()}
                    </Text>
                  </View>
                )}
                contentContainerStyle={styles.listContent}
                refreshControl={
                  <RefreshControl
                    refreshing={refreshing}
                    onRefresh={() => {
                      setRefreshing(true);
                      fetchHabits();
                    }}
                    colors={['#ffd700']}
                  />
                }
              />
            )}
          </View>
        );

      case 'plans':
        return (
          <View style={styles.tabContent}>
            <Text style={styles.comingSoonText}>My Plans - Coming Soon</Text>
          </View>
        );

      case 'about':
        return (
          <View style={styles.tabContent}>
            <Text style={styles.comingSoonText}>About - Coming Soon</Text>
          </View>
        );

      case 'messages':
        return (
          <View style={styles.tabContent}>
            {loading ? (
              <ActivityIndicator size="large" color="#ffd700" style={{ marginTop: 20 }} />
            ) : (
              <FlatList
                data={conversations}
                renderItem={renderConversation}
                keyExtractor={(item) => item._id}
                contentContainerStyle={styles.listContent}
                refreshControl={
                  <RefreshControl
                    refreshing={refreshing}
                    onRefresh={() => {
                      setRefreshing(true);
                      fetchConversations();
                    }}
                    colors={['#ffd700']}
                  />
                }
                ListEmptyComponent={
                  <Text style={styles.emptyText}>No conversations yet</Text>
                }
              />
            )}
          </View>
        );

      default:
        return null;
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Tab Carousel */}
      <View style={styles.tabCarouselContainer}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabCarousel}
        >
          <TouchableOpacity
            style={[styles.tabItem, activeTab === 'timeline' && styles.activeTabItem]}
            onPress={() => setActiveTab('timeline')}
          >
            <Text style={[styles.tabText, activeTab === 'timeline' && styles.activeTabText]}>
              Timeline
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabItem, activeTab === 'plans' && styles.activeTabItem]}
            onPress={() => setActiveTab('plans')}
          >
            <Text style={[styles.tabText, activeTab === 'plans' && styles.activeTabText]}>
              My Plans
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabItem, activeTab === 'about' && styles.activeTabItem]}
            onPress={() => setActiveTab('about')}
          >
            <Text style={[styles.tabText, activeTab === 'about' && styles.activeTabText]}>
              About
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabItem, activeTab === 'messages' && styles.activeTabItem]}
            onPress={() => setActiveTab('messages')}
          >
            <Text style={[styles.tabText, activeTab === 'messages' && styles.activeTabText]}>
              Messages
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      {/* Tab Content */}
      {renderTabContent()}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1e293b',
  },
  tabCarouselContainer: {
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    height: 60,
  },
  tabCarousel: {
    paddingHorizontal: 8,
    alignItems: 'center',
  },
  tabItem: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    marginHorizontal: 4,
    borderRadius: 20,
    backgroundColor: '#f5f5f5',
  },
  activeTabItem: {
    backgroundColor: '#ffd700',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  activeTabText: {
    color: '#333',
  },
  tabContent: {
    flex: 1,
  },
  listContent: {
    padding: 16,
  },
  conversationCard: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 12,
  },
  avatarPlaceholder: {
    backgroundColor: '#ffd700',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  conversationInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  conversationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e293b',
  },
  timestamp: {
    fontSize: 12,
    color: '#94a3b8',
  },
  messageRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  lastMessage: {
    flex: 1,
    fontSize: 14,
    color: '#64748b',
  },
  unreadMessage: {
    fontWeight: '600',
    color: '#1e293b',
  },
  unreadBadge: {
    backgroundColor: '#ffd700',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginLeft: 8,
  },
  unreadBadgeText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#1e293b',
  },
  habitCard: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  habitHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  habitTypeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  habitType: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e293b',
    marginLeft: 8,
    textTransform: 'capitalize',
  },
  habitDescription: {
    fontSize: 14,
    color: '#64748b',
    marginBottom: 8,
  },
  habitValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffd700',
    marginBottom: 4,
  },
  habitDate: {
    fontSize: 12,
    color: '#94a3b8',
  },
  emptyText: {
    fontSize: 16,
    color: '#94a3b8',
    textAlign: 'center',
    marginTop: 32,
  },
  comingSoonText: {
    fontSize: 18,
    color: '#94a3b8',
    textAlign: 'center',
    marginTop: 64,
    fontWeight: '600',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
