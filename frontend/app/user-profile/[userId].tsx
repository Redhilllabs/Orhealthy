import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  FlatList,
} from 'react-native';
import { useState, useEffect } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import axios from 'axios';
import { storage } from '../../src/utils/storage';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL + '/api';

interface HabitLog {
  _id: string;
  date: string;
  habit_type: string;
  description: string;
  value?: number;
  unit?: string;
  created_at: string;
}

export default function UserProfileScreen() {
  const params = useLocalSearchParams();
  const userId = Array.isArray(params.userId) ? params.userId[0] : params.userId;
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'timeline' | 'about'>('timeline');
  const [loading, setLoading] = useState(true);
  const [userData, setUserData] = useState<any>(null);
  const [habits, setHabits] = useState<HabitLog[]>([]);
  const [profileData, setProfileData] = useState<any>(null);

  const activityTypes = [
    { value: 'exercise', label: 'Exercise', icon: 'fitness' },
    { value: 'meals', label: 'Meal', icon: 'restaurant' },
    { value: 'sleep', label: 'Sleep', icon: 'moon' },
    { value: 'habit', label: 'Habit', icon: 'checkmark-circle' },
    { value: 'water', label: 'Water Intake', icon: 'water' },
    { value: 'note', label: 'Note', icon: 'document-text' },
  ];

  const activityLevels = [
    { value: 'sedentary', label: 'Sedentary' },
    { value: 'lightly_active', label: 'Lightly Active' },
    { value: 'moderately_active', label: 'Moderately Active' },
    { value: 'very_active', label: 'Very Active' },
    { value: 'extra_active', label: 'Extra Active' },
  ];

  useEffect(() => {
    fetchUserData();
    fetchHabits();
    fetchProfile();
  }, [userId]);

  const fetchUserData = async () => {
    try {
      const token = await storage.getItemAsync('session_token');
      const response = await axios.get(`${API_URL}/users/${userId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setUserData(response.data);
    } catch (error) {
      console.error('Error fetching user data:', error);
    }
  };

  const fetchHabits = async () => {
    setLoading(true);
    try {
      const token = await storage.getItemAsync('session_token');
      console.log('Fetching habits for userId:', userId);
      const response = await axios.get(`${API_URL}/habits/user/${userId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      console.log('Habits response:', response.data);
      console.log('Number of habits:', response.data?.length || 0);
      setHabits(response.data || []);
    } catch (error) {
      console.error('Error fetching habits:', error);
      setHabits([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchProfile = async () => {
    try {
      const token = await storage.getItemAsync('session_token');
      const response = await axios.get(`${API_URL}/users/${userId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const profile = response.data.profile || {};
      setProfileData({
        age: profile.age?.toString() || '',
        gender: profile.gender || '',
        height: profile.height?.toString() || '',
        weight: profile.weight?.toString() || '',
        allergies: profile.allergies?.join(', ') || '',
        lifestyle_disorders: profile.lifestyle_disorders?.join(', ') || '',
        lifestyle_activity_level: profile.lifestyle_activity_level || '',
        profession: profile.profession || '',
        fitness_activities: profile.fitness_activities?.join(', ') || '',
        bio: profile.bio || '',
      });
    } catch (error) {
      console.error('Error fetching profile:', error);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header with Back Button */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#1e293b" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{userData?.name || 'User Profile'}</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Tab Navigation */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'timeline' && styles.activeTab]}
          onPress={() => setActiveTab('timeline')}
        >
          <Ionicons
            name="time"
            size={20}
            color={activeTab === 'timeline' ? '#ffd700' : '#999'}
          />
          <Text style={[styles.tabLabel, activeTab === 'timeline' && styles.activeTabLabel]}>
            Timeline
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'about' && styles.activeTab]}
          onPress={() => setActiveTab('about')}
        >
          <Ionicons
            name="person"
            size={20}
            color={activeTab === 'about' ? '#ffd700' : '#999'}
          />
          <Text style={[styles.tabLabel, activeTab === 'about' && styles.activeTabLabel]}>
            About
          </Text>
        </TouchableOpacity>
      </View>

      {/* Tab Content */}
      {activeTab === 'timeline' ? (
        <View style={styles.tabContent}>
          {loading ? (
            <ActivityIndicator size="large" color="#ffd700" style={{ marginTop: 20 }} />
          ) : habits.length === 0 ? (
            <Text style={styles.emptyText}>No activities logged yet</Text>
          ) : (
            <FlatList
              data={habits}
              keyExtractor={(item) => item._id}
              renderItem={({ item }) => (
                <View style={styles.habitCard}>
                  <View style={styles.habitHeader}>
                    <View style={styles.habitTypeRow}>
                      <Ionicons
                        name={
                          activityTypes.find(t => t.value === item.habit_type)?.icon as any || 'fitness'
                        }
                        size={20}
                        color="#ffd700"
                      />
                      <Text style={styles.habitType}>
                        {activityTypes.find(t => t.value === item.habit_type)?.label || item.habit_type}
                      </Text>
                    </View>
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
            />
          )}
        </View>
      ) : (
        <ScrollView style={styles.tabContent} contentContainerStyle={styles.aboutContent}>
          {profileData && (
            <View style={styles.profileSection}>
              <View style={styles.profileRow}>
                <View style={styles.profileItem}>
                  <Text style={styles.profileLabel}>Age</Text>
                  <Text style={styles.profileValue}>{profileData.age || '-'}</Text>
                </View>
                <View style={styles.profileItem}>
                  <Text style={styles.profileLabel}>Gender</Text>
                  <Text style={styles.profileValue}>
                    {profileData.gender ? profileData.gender.charAt(0).toUpperCase() + profileData.gender.slice(1) : '-'}
                  </Text>
                </View>
              </View>

              <View style={styles.profileRow}>
                <View style={styles.profileItem}>
                  <Text style={styles.profileLabel}>Height</Text>
                  <Text style={styles.profileValue}>{profileData.height ? `${profileData.height} cm` : '-'}</Text>
                </View>
                <View style={styles.profileItem}>
                  <Text style={styles.profileLabel}>Weight</Text>
                  <Text style={styles.profileValue}>{profileData.weight ? `${profileData.weight} kg` : '-'}</Text>
                </View>
              </View>

              <View style={styles.profileFullItem}>
                <Text style={styles.profileLabel}>Allergies</Text>
                <Text style={styles.profileValue}>{profileData.allergies || '-'}</Text>
              </View>

              <View style={styles.profileFullItem}>
                <Text style={styles.profileLabel}>Lifestyle Disorders</Text>
                <Text style={styles.profileValue}>{profileData.lifestyle_disorders || '-'}</Text>
              </View>

              <View style={styles.profileFullItem}>
                <Text style={styles.profileLabel}>Activity Level</Text>
                <Text style={styles.profileValue}>
                  {activityLevels.find(a => a.value === profileData.lifestyle_activity_level)?.label || '-'}
                </Text>
              </View>

              <View style={styles.profileFullItem}>
                <Text style={styles.profileLabel}>Profession</Text>
                <Text style={styles.profileValue}>{profileData.profession || '-'}</Text>
              </View>

              <View style={styles.profileFullItem}>
                <Text style={styles.profileLabel}>Fitness Activities</Text>
                <Text style={styles.profileValue}>{profileData.fitness_activities || '-'}</Text>
              </View>

              <View style={styles.profileFullItem}>
                <Text style={styles.profileLabel}>Bio</Text>
                <Text style={styles.profileValue}>{profileData.bio || '-'}</Text>
              </View>
            </View>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1e293b',
  },
  tabBar: {
    flexDirection: 'row',
    maxHeight: 50,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    backgroundColor: '#fff',
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    gap: 8,
  },
  activeTab: {
    borderBottomWidth: 2,
    borderBottomColor: '#ffd700',
  },
  tabLabel: {
    fontSize: 14,
    color: '#999',
    fontWeight: '500',
  },
  activeTabLabel: {
    color: '#ffd700',
    fontWeight: '600',
  },
  tabContent: {
    flex: 1,
    padding: 16,
  },
  emptyText: {
    textAlign: 'center',
    color: '#94a3b8',
    fontSize: 16,
    marginTop: 32,
  },
  listContent: {
    paddingBottom: 20,
  },
  habitCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  habitHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  habitTypeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  habitType: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffd700',
    textTransform: 'capitalize',
  },
  habitDescription: {
    fontSize: 16,
    color: '#1e293b',
    marginBottom: 8,
  },
  habitValue: {
    fontSize: 14,
    color: '#64748b',
    marginBottom: 4,
  },
  habitDate: {
    fontSize: 12,
    color: '#94a3b8',
  },
  aboutContent: {
    paddingBottom: 20,
  },
  profileSection: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  profileRow: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 16,
  },
  profileItem: {
    flex: 1,
  },
  profileFullItem: {
    marginBottom: 16,
  },
  profileLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  profileValue: {
    fontSize: 16,
    color: '#1e293b',
  },
});
