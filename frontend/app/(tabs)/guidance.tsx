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
  TextInput,
  Modal,
  Platform,
} from 'react-native';
import { useState, useEffect } from 'react';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { storage } from '../../src/utils/storage';
import { useAuth } from '../../src/context/AuthContext';
import DateTimePicker from '@react-native-community/datetimepicker';

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

interface MealPlan {
  _id: string;
  guidee_id: string;
  guidee_name: string;
  guide_id?: string;
  guide_name?: string;
  plan_type: string;
  start_date: string;
  meals_requested: string[];
  status: string;
  created_at: string;
}

interface Guide {
  _id: string;
  name: string;
  average_rating?: number;
}

export default function GuidanceScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'timeline' | 'plans' | 'about' | 'messages'>('timeline');
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [conversationRatings, setConversationRatings] = useState<Record<string, number>>({});
  const [habits, setHabits] = useState<HabitLog[]>([]);
  const [mealPlans, setMealPlans] = useState<MealPlan[]>([]);
  const [guides, setGuides] = useState<Guide[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
  // Plan Request Modal States
  const [showPlanModal, setShowPlanModal] = useState(false);
  const [planType, setPlanType] = useState('');
  const [startDate, setStartDate] = useState(new Date());
  const [startDateText, setStartDateText] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [selectedMeals, setSelectedMeals] = useState<string[]>([]);
  const [selectedGuide, setSelectedGuide] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Activity Log Modal States
  const [showActivityModal, setShowActivityModal] = useState(false);
  const [activityType, setActivityType] = useState('');
  const [activityData, setActivityData] = useState({
    name: '',
    value: '',
    unit: '',
    hours: '',
    startTime: '',
    endTime: '',
    note: '',
  });
  const [loggingActivity, setLoggingActivity] = useState(false);

  // About Tab States
  const [showEditModal, setShowEditModal] = useState(false);
  const [profileData, setProfileData] = useState({
    age: '',
    gender: '',
    height: '',
    weight: '',
    allergies: '',
    lifestyle_disorders: '',
    lifestyle_activity_level: '',
    profession: '',
    fitness_activities: '',
    bio: '',
  });
  const [savingProfile, setSavingProfile] = useState(false);

  const mealOptions = [
    'Breakfast',
    'Brunch',
    'Lunch',
    'Evening Snacks',
    'Dinner',
    'Supper',
  ];

  const planTypes = [
    { value: 'single_meal', label: 'Single Meal' },
    { value: '1_day', label: '1 Day' },
    { value: '3_day', label: '3 Day' },
    { value: 'week', label: 'Week' },
    { value: 'fortnight', label: 'Fortnight' },
    { value: 'month', label: 'Month' },
  ];

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
    if (activeTab === 'timeline') {
      fetchHabits();
    } else if (activeTab === 'messages') {
      fetchConversations();
    } else if (activeTab === 'plans') {
      fetchMealPlans();
      fetchGuides();
    } else if (activeTab === 'about') {
      fetchProfile();
    }
  }, [activeTab]);

  const fetchConversations = async () => {
    try {
      const token = await storage.getItemAsync('session_token');
      const response = await axios.get(`${API_URL}/conversations`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const convos = response.data;
      setConversations(convos);
      
      // Fetch ratings for all conversation participants
      const ratings: Record<string, number> = {};
      for (const convo of convos) {
        const otherUserId = convo.user1_id === user?._id ? convo.user2_id : convo.user1_id;
        try {
          const userResponse = await axios.get(`${API_URL}/users/${otherUserId}`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (userResponse.data.average_rating) {
            ratings[otherUserId] = userResponse.data.average_rating;
          }
        } catch (error) {
          console.log(`Could not fetch rating for user ${otherUserId}`);
        }
      }
      setConversationRatings(ratings);
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

  const fetchMealPlans = async () => {
    setLoading(true);
    try {
      const token = await storage.getItemAsync('session_token');
      const response = await axios.get(`${API_URL}/meal-plans`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setMealPlans(response.data || []);
    } catch (error) {
      console.error('Error fetching meal plans:', error);
      setMealPlans([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const fetchGuides = async () => {
    try {
      const token = await storage.getItemAsync('session_token');
      const response = await axios.get(`${API_URL}/following`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setGuides(response.data || []);
    } catch (error) {
      console.error('Error fetching guides:', error);
      setGuides([]);
    }
  };

  const fetchProfile = async () => {
    setLoading(true);
    try {
      const token = await storage.getItemAsync('session_token');
      const response = await axios.get(`${API_URL}/auth/me`, {
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
      Alert.alert('Success', 'Activity deleted successfully');
      fetchHabits();
    } catch (error) {
      console.error('Error deleting habit:', error);
      Alert.alert('Error', 'Failed to delete activity');
    }
  };

  const deletePlan = async (planId: string) => {
    try {
      const token = await storage.getItemAsync('session_token');
      await axios.delete(`${API_URL}/meal-plans/${planId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      Alert.alert('Success', 'Plan deleted successfully');
      fetchMealPlans();
    } catch (error) {
      console.error('Error deleting plan:', error);
      Alert.alert('Error', 'Failed to delete plan');
    }
  };

  const logActivity = async () => {
    if (!activityType) {
      Alert.alert('Error', 'Please select an activity type');
      return;
    }

    let description = '';
    let value: number | undefined;
    let unit: string | undefined;

    switch (activityType) {
      case 'exercise':
        if (!activityData.name || !activityData.value) {
          Alert.alert('Error', 'Please enter exercise name and duration');
          return;
        }
        description = activityData.name;
        value = parseFloat(activityData.value);
        unit = activityData.unit || 'minutes';
        break;
      case 'meals':
        if (!activityData.name) {
          Alert.alert('Error', 'Please enter meal name');
          return;
        }
        description = activityData.name;
        break;
      case 'sleep':
        if (!activityData.hours) {
          Alert.alert('Error', 'Please enter hours of sleep');
          return;
        }
        description = `${activityData.startTime || 'Night'} to ${activityData.endTime || 'Morning'}`;
        value = parseFloat(activityData.hours);
        unit = 'hours';
        break;
      case 'habit':
        if (!activityData.name || !activityData.value) {
          Alert.alert('Error', 'Please enter habit activity and value');
          return;
        }
        description = activityData.name;
        value = parseFloat(activityData.value);
        unit = activityData.unit || 'times';
        break;
      case 'water':
        if (!activityData.value) {
          Alert.alert('Error', 'Please enter water intake value');
          return;
        }
        description = 'Water intake';
        value = parseFloat(activityData.value);
        unit = activityData.unit || 'glasses';
        break;
      case 'note':
        if (!activityData.note) {
          Alert.alert('Error', 'Please enter a note');
          return;
        }
        description = activityData.note;
        break;
    }

    setLoggingActivity(true);
    try {
      const token = await storage.getItemAsync('session_token');
      await axios.post(
        `${API_URL}/habits`,
        {
          habit_type: activityType,
          description,
          value,
          unit,
          date: new Date().toISOString(),
        },
        {
          headers: { 
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      Alert.alert('Success', 'Activity logged successfully');
      setShowActivityModal(false);
      setActivityType('');
      setActivityData({
        name: '',
        value: '',
        unit: '',
        hours: '',
        startTime: '',
        endTime: '',
        note: '',
      });
      fetchHabits();
    } catch (error: any) {
      console.error('Error logging activity:', error);
      console.error('Error response:', error.response?.data);
      Alert.alert('Error', error.response?.data?.detail || 'Failed to log activity');
    } finally {
      setLoggingActivity(false);
    }
  };

  const submitPlanRequest = async () => {
    if (!planType || selectedMeals.length === 0) {
      Alert.alert('Error', 'Please select plan type and at least one meal');
      return;
    }

    setSubmitting(true);
    try {
      const token = await storage.getItemAsync('session_token');
      const guide = guides.find(g => g._id === selectedGuide);
      
      const dateToUse = Platform.OS === 'web' && startDateText 
        ? startDateText 
        : startDate.toISOString();

      await axios.post(
        `${API_URL}/meal-plans`,
        {
          plan_type: planType,
          start_date: dateToUse,
          meals_requested: selectedMeals.map(m => m.toLowerCase().replace(/ /g, '_')),
          guide_id: selectedGuide || null,
          guide_name: guide?.name || null,
        },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      Alert.alert('Success', 'Meal plan requested successfully');
      setShowPlanModal(false);
      setPlanType('');
      setSelectedMeals([]);
      setSelectedGuide('');
      setStartDateText('');
      fetchMealPlans();
    } catch (error) {
      console.error('Error submitting plan:', error);
      Alert.alert('Error', 'Failed to submit plan request');
    } finally {
      setSubmitting(false);
    }
  };

  const saveProfile = async () => {
    setSavingProfile(true);
    try {
      const token = await storage.getItemAsync('session_token');
      await axios.put(
        `${API_URL}/users/profile`,
        {
          age: profileData.age ? parseInt(profileData.age) : null,
          gender: profileData.gender || null,
          height: profileData.height ? parseFloat(profileData.height) : null,
          weight: profileData.weight ? parseFloat(profileData.weight) : null,
          allergies: profileData.allergies ? profileData.allergies.split(',').map(a => a.trim()) : [],
          lifestyle_disorders: profileData.lifestyle_disorders ? profileData.lifestyle_disorders.split(',').map(a => a.trim()) : [],
          lifestyle_activity_level: profileData.lifestyle_activity_level || null,
          profession: profileData.profession || null,
          fitness_activities: profileData.fitness_activities ? profileData.fitness_activities.split(',').map(a => a.trim()) : [],
          bio: profileData.bio || null,
        },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      Alert.alert('Success', 'Profile updated successfully');
      setShowEditModal(false);
      fetchProfile();
    } catch (error) {
      console.error('Error saving profile:', error);
      Alert.alert('Error', 'Failed to save profile');
    } finally {
      setSavingProfile(false);
    }
  };

  const toggleMealSelection = (meal: string) => {
    if (planType === 'single_meal') {
      setSelectedMeals([meal]);
    } else {
      if (selectedMeals.includes(meal)) {
        setSelectedMeals(selectedMeals.filter(m => m !== meal));
      } else {
        setSelectedMeals([...selectedMeals, meal]);
      }
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
    const rating = conversationRatings[otherUser.id];

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
            <View style={styles.nameRatingRow}>
              <Text style={styles.userName}>{otherUser.name}</Text>
              {rating && (
                <View style={styles.ratingBadge}>
                  <Ionicons name="star" size={12} color="#ffd700" />
                  <Text style={styles.ratingText}>{rating.toFixed(1)}</Text>
                </View>
              )}
            </View>
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

  const renderActivityForm = () => {
    switch (activityType) {
      case 'exercise':
        return (
          <>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Exercise Name *</Text>
              <TextInput
                style={styles.input}
                value={activityData.name}
                onChangeText={(text) => setActivityData({ ...activityData, name: text })}
                placeholder="e.g., Running, Yoga"
              />
            </View>
            <View style={styles.inputRow}>
              <View style={[styles.inputGroup, { flex: 1, marginRight: 8 }]}>
                <Text style={styles.inputLabel}>Duration *</Text>
                <TextInput
                  style={styles.input}
                  value={activityData.value}
                  onChangeText={(text) => setActivityData({ ...activityData, value: text })}
                  keyboardType="numeric"
                  placeholder="30"
                />
              </View>
              <View style={[styles.inputGroup, { flex: 1, marginLeft: 8 }]}>
                <Text style={styles.inputLabel}>Unit</Text>
                <TextInput
                  style={styles.input}
                  value={activityData.unit}
                  onChangeText={(text) => setActivityData({ ...activityData, unit: text })}
                  placeholder="minutes"
                />
              </View>
            </View>
          </>
        );
      case 'meals':
        return (
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Meal Name *</Text>
            <TextInput
              style={styles.input}
              value={activityData.name}
              onChangeText={(text) => setActivityData({ ...activityData, name: text })}
              placeholder="e.g., Grilled Chicken Salad"
            />
          </View>
        );
      case 'sleep':
        return (
          <>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Hours of Sleep *</Text>
              <TextInput
                style={styles.input}
                value={activityData.hours}
                onChangeText={(text) => setActivityData({ ...activityData, hours: text })}
                keyboardType="numeric"
                placeholder="8"
              />
            </View>
            <View style={styles.inputRow}>
              <View style={[styles.inputGroup, { flex: 1, marginRight: 8 }]}>
                <Text style={styles.inputLabel}>Start Time</Text>
                <TextInput
                  style={styles.input}
                  value={activityData.startTime}
                  onChangeText={(text) => setActivityData({ ...activityData, startTime: text })}
                  placeholder="10:00 PM"
                />
              </View>
              <View style={[styles.inputGroup, { flex: 1, marginLeft: 8 }]}>
                <Text style={styles.inputLabel}>End Time</Text>
                <TextInput
                  style={styles.input}
                  value={activityData.endTime}
                  onChangeText={(text) => setActivityData({ ...activityData, endTime: text })}
                  placeholder="6:00 AM"
                />
              </View>
            </View>
          </>
        );
      case 'habit':
        return (
          <>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Habit Activity *</Text>
              <TextInput
                style={styles.input}
                value={activityData.name}
                onChangeText={(text) => setActivityData({ ...activityData, name: text })}
                placeholder="e.g., Meditation, Reading"
              />
            </View>
            <View style={styles.inputRow}>
              <View style={[styles.inputGroup, { flex: 1, marginRight: 8 }]}>
                <Text style={styles.inputLabel}>Value *</Text>
                <TextInput
                  style={styles.input}
                  value={activityData.value}
                  onChangeText={(text) => setActivityData({ ...activityData, value: text })}
                  keyboardType="numeric"
                  placeholder="10"
                />
              </View>
              <View style={[styles.inputGroup, { flex: 1, marginLeft: 8 }]}>
                <Text style={styles.inputLabel}>Unit</Text>
                <TextInput
                  style={styles.input}
                  value={activityData.unit}
                  onChangeText={(text) => setActivityData({ ...activityData, unit: text })}
                  placeholder="minutes"
                />
              </View>
            </View>
          </>
        );
      case 'water':
        return (
          <View style={styles.inputRow}>
            <View style={[styles.inputGroup, { flex: 1, marginRight: 8 }]}>
              <Text style={styles.inputLabel}>Amount *</Text>
              <TextInput
                style={styles.input}
                value={activityData.value}
                onChangeText={(text) => setActivityData({ ...activityData, value: text })}
                keyboardType="numeric"
                placeholder="8"
              />
            </View>
            <View style={[styles.inputGroup, { flex: 1, marginLeft: 8 }]}>
              <Text style={styles.inputLabel}>Unit</Text>
              <TextInput
                style={styles.input}
                value={activityData.unit}
                onChangeText={(text) => setActivityData({ ...activityData, unit: text })}
                placeholder="glasses"
              />
            </View>
          </View>
        );
      case 'note':
        return (
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Note *</Text>
            <TextInput
              style={[styles.input, styles.bioInput]}
              value={activityData.note}
              onChangeText={(text) => setActivityData({ ...activityData, note: text })}
              placeholder="Write your note here..."
              multiline
              numberOfLines={4}
            />
          </View>
        );
      default:
        return null;
    }
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'timeline':
        return (
          <View style={styles.tabContent}>
            <TouchableOpacity
              style={styles.requestButton}
              onPress={() => setShowActivityModal(true)}
            >
              <Ionicons name="add-circle" size={24} color="#fff" />
              <Text style={styles.requestButtonText}>Log Activity</Text>
            </TouchableOpacity>

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
            <TouchableOpacity
              style={styles.requestButton}
              onPress={() => setShowPlanModal(true)}
            >
              <Ionicons name="add-circle" size={24} color="#fff" />
              <Text style={styles.requestButtonText}>Request New Plan</Text>
            </TouchableOpacity>

            {loading ? (
              <ActivityIndicator size="large" color="#ffd700" style={{ marginTop: 20 }} />
            ) : mealPlans.length === 0 ? (
              <Text style={styles.emptyText}>No meal plans yet</Text>
            ) : (
              <FlatList
                data={mealPlans}
                keyExtractor={(item) => item._id}
                renderItem={({ item }) => (
                  <View style={styles.planCard}>
                    <View style={styles.planHeader}>
                      <View>
                        <Text style={styles.planType}>
                          {planTypes.find(p => p.value === item.plan_type)?.label || item.plan_type}
                        </Text>
                        <Text style={styles.planDate}>
                          Starts: {new Date(item.start_date).toLocaleDateString()}
                        </Text>
                      </View>
                      <View style={[styles.statusBadge, item.status === 'requested' && styles.statusRequested]}>
                        <Text style={styles.statusText}>{item.status}</Text>
                      </View>
                    </View>
                    <Text style={styles.planMeals}>
                      Meals: {item.meals_requested.map(m => m.replace(/_/g, ' ')).join(', ')}
                    </Text>
                    {item.guide_name && (
                      <Text style={styles.planGuide}>Guide: {item.guide_name}</Text>
                    )}
                    <TouchableOpacity
                      style={styles.deletePlanButton}
                      onPress={() => {
                        Alert.alert(
                          'Delete Plan',
                          'Are you sure you want to delete this plan?',
                          [
                            { text: 'Cancel', style: 'cancel' },
                            { text: 'Delete', style: 'destructive', onPress: () => deletePlan(item._id) },
                          ]
                        );
                      }}
                    >
                      <Ionicons name="trash-outline" size={18} color="#ef4444" />
                      <Text style={styles.deletePlanText}>Delete</Text>
                    </TouchableOpacity>
                  </View>
                )}
                contentContainerStyle={styles.listContent}
                refreshControl={
                  <RefreshControl
                    refreshing={refreshing}
                    onRefresh={() => {
                      setRefreshing(true);
                      fetchMealPlans();
                    }}
                    colors={['#ffd700']}
                  />
                }
              />
            )}
          </View>
        );

      case 'about':
        return (
          <ScrollView
            style={styles.tabContent}
            contentContainerStyle={styles.aboutContent}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={() => {
                  setRefreshing(true);
                  fetchProfile();
                }}
                colors={['#ffd700']}
              />
            }
          >
            {loading ? (
              <ActivityIndicator size="large" color="#ffd700" style={{ marginTop: 20 }} />
            ) : (
              <>
                <TouchableOpacity
                  style={styles.editButton}
                  onPress={() => setShowEditModal(true)}
                >
                  <Ionicons name="pencil" size={20} color="#fff" />
                  <Text style={styles.editButtonText}>Edit Profile</Text>
                </TouchableOpacity>

                <View style={styles.profileCard}>
                  <View style={styles.profileRow}>
                    <Ionicons name="person" size={24} color="#ffd700" />
                    <View style={styles.profileRowText}>
                      <Text style={styles.profileLabel}>Age</Text>
                      <Text style={styles.profileValue}>{profileData.age || 'Not set'}</Text>
                    </View>
                  </View>

                  <View style={styles.profileRow}>
                    <Ionicons name="male-female" size={24} color="#ffd700" />
                    <View style={styles.profileRowText}>
                      <Text style={styles.profileLabel}>Gender</Text>
                      <Text style={styles.profileValue}>{profileData.gender ? profileData.gender.charAt(0).toUpperCase() + profileData.gender.slice(1) : 'Not set'}</Text>
                    </View>
                  </View>

                  <View style={styles.profileRow}>
                    <Ionicons name="resize" size={24} color="#ffd700" />
                    <View style={styles.profileRowText}>
                      <Text style={styles.profileLabel}>Height</Text>
                      <Text style={styles.profileValue}>{profileData.height ? `${profileData.height} cm` : 'Not set'}</Text>
                    </View>
                  </View>

                  <View style={styles.profileRow}>
                    <Ionicons name="scale" size={24} color="#ffd700" />
                    <View style={styles.profileRowText}>
                      <Text style={styles.profileLabel}>Weight</Text>
                      <Text style={styles.profileValue}>{profileData.weight ? `${profileData.weight} kg` : 'Not set'}</Text>
                    </View>
                  </View>

                  <View style={styles.profileRow}>
                    <Ionicons name="warning" size={24} color="#ffd700" />
                    <View style={styles.profileRowText}>
                      <Text style={styles.profileLabel}>Allergies</Text>
                      <Text style={styles.profileValue}>{profileData.allergies || 'None'}</Text>
                    </View>
                  </View>

                  <View style={styles.profileRow}>
                    <Ionicons name="medical" size={24} color="#ffd700" />
                    <View style={styles.profileRowText}>
                      <Text style={styles.profileLabel}>Lifestyle Disorders</Text>
                      <Text style={styles.profileValue}>{profileData.lifestyle_disorders || 'None'}</Text>
                    </View>
                  </View>

                  <View style={styles.profileRow}>
                    <Ionicons name="walk" size={24} color="#ffd700" />
                    <View style={styles.profileRowText}>
                      <Text style={styles.profileLabel}>Activity Level</Text>
                      <Text style={styles.profileValue}>{profileData.lifestyle_activity_level ? profileData.lifestyle_activity_level.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) : 'Not set'}</Text>
                    </View>
                  </View>

                  <View style={styles.profileRow}>
                    <Ionicons name="briefcase" size={24} color="#ffd700" />
                    <View style={styles.profileRowText}>
                      <Text style={styles.profileLabel}>Profession</Text>
                      <Text style={styles.profileValue}>{profileData.profession || 'Not set'}</Text>
                    </View>
                  </View>

                  <View style={styles.profileRow}>
                    <Ionicons name="barbell" size={24} color="#ffd700" />
                    <View style={styles.profileRowText}>
                      <Text style={styles.profileLabel}>Fitness Activities</Text>
                      <Text style={styles.profileValue}>{profileData.fitness_activities || 'None'}</Text>
                    </View>
                  </View>

                  <View style={styles.profileRow}>
                    <Ionicons name="document-text" size={24} color="#ffd700" />
                    <View style={styles.profileRowText}>
                      <Text style={styles.profileLabel}>Bio</Text>
                      <Text style={styles.profileValue}>{profileData.bio || 'Not set'}</Text>
                    </View>
                  </View>
                </View>
              </>
            )}
          </ScrollView>
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

      {/* Activity Log Modal */}
      <Modal
        visible={showActivityModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowActivityModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Log Activity</Text>
              <TouchableOpacity onPress={() => {
                setShowActivityModal(false);
                setActivityType('');
                setActivityData({
                  name: '',
                  value: '',
                  unit: '',
                  hours: '',
                  startTime: '',
                  endTime: '',
                  note: '',
                });
              }}>
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              <Text style={styles.sectionLabel}>Activity Type *</Text>
              <View style={styles.activityTypeGrid}>
                {activityTypes.map((type) => (
                  <TouchableOpacity
                    key={type.value}
                    style={[
                      styles.activityTypeButton,
                      activityType === type.value && styles.activityTypeButtonActive,
                    ]}
                    onPress={() => setActivityType(type.value)}
                  >
                    <Ionicons 
                      name={type.icon as any} 
                      size={24} 
                      color={activityType === type.value ? '#fff' : '#666'} 
                    />
                    <Text
                      style={[
                        styles.activityTypeText,
                        activityType === type.value && styles.activityTypeTextActive,
                      ]}
                    >
                      {type.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {activityType && renderActivityForm()}

              {activityType && (
                <TouchableOpacity
                  style={[styles.submitButton, loggingActivity && styles.submitButtonDisabled]}
                  onPress={logActivity}
                  disabled={loggingActivity}
                >
                  {loggingActivity ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.submitButtonText}>Log Activity</Text>
                  )}
                </TouchableOpacity>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Edit Profile Modal */}
      <Modal
        visible={showEditModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowEditModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit Profile</Text>
              <TouchableOpacity onPress={() => setShowEditModal(false)}>
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Age</Text>
                <TextInput
                  style={styles.input}
                  value={profileData.age}
                  onChangeText={(text) => setProfileData({ ...profileData, age: text })}
                  keyboardType="numeric"
                  placeholder="Enter your age"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Gender</Text>
                <View style={styles.genderRow}>
                  {['Male', 'Female', 'Other'].map((g) => (
                    <TouchableOpacity
                      key={g}
                      style={[
                        styles.genderButton,
                        profileData.gender === g.toLowerCase() && styles.genderButtonActive,
                      ]}
                      onPress={() => setProfileData({ ...profileData, gender: g.toLowerCase() })}
                    >
                      <Text
                        style={[
                          styles.genderButtonText,
                          profileData.gender === g.toLowerCase() && styles.genderButtonTextActive,
                        ]}
                      >
                        {g}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View style={styles.inputRow}>
                <View style={[styles.inputGroup, { flex: 1, marginRight: 8 }]}>
                  <Text style={styles.inputLabel}>Height (cm)</Text>
                  <TextInput
                    style={styles.input}
                    value={profileData.height}
                    onChangeText={(text) => setProfileData({ ...profileData, height: text })}
                    keyboardType="numeric"
                    placeholder="170"
                  />
                </View>
                <View style={[styles.inputGroup, { flex: 1, marginLeft: 8 }]}>
                  <Text style={styles.inputLabel}>Weight (kg)</Text>
                  <TextInput
                    style={styles.input}
                    value={profileData.weight}
                    onChangeText={(text) => setProfileData({ ...profileData, weight: text })}
                    keyboardType="numeric"
                    placeholder="70"
                  />
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Allergies (comma separated)</Text>
                <TextInput
                  style={styles.input}
                  value={profileData.allergies}
                  onChangeText={(text) => setProfileData({ ...profileData, allergies: text })}
                  placeholder="e.g., Nuts, Dairy"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Lifestyle Disorders (comma separated)</Text>
                <TextInput
                  style={styles.input}
                  value={profileData.lifestyle_disorders}
                  onChangeText={(text) => setProfileData({ ...profileData, lifestyle_disorders: text })}
                  placeholder="e.g., Diabetes, Hypertension, PCOS"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Lifestyle Activity Level</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View style={styles.optionsRow}>
                    {activityLevels.map((level) => (
                      <TouchableOpacity
                        key={level.value}
                        style={[
                          styles.optionButton,
                          profileData.lifestyle_activity_level === level.value && styles.optionButtonActive,
                        ]}
                        onPress={() => setProfileData({ ...profileData, lifestyle_activity_level: level.value })}
                      >
                        <Text
                          style={[
                            styles.optionButtonText,
                            profileData.lifestyle_activity_level === level.value && styles.optionButtonTextActive,
                          ]}
                        >
                          {level.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </ScrollView>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Profession</Text>
                <TextInput
                  style={styles.input}
                  value={profileData.profession}
                  onChangeText={(text) => setProfileData({ ...profileData, profession: text })}
                  placeholder="Your profession"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Fitness Activities (comma separated)</Text>
                <TextInput
                  style={styles.input}
                  value={profileData.fitness_activities}
                  onChangeText={(text) => setProfileData({ ...profileData, fitness_activities: text })}
                  placeholder="e.g., Running, Yoga, Swimming"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Bio</Text>
                <TextInput
                  style={[styles.input, styles.bioInput]}
                  value={profileData.bio}
                  onChangeText={(text) => setProfileData({ ...profileData, bio: text })}
                  placeholder="Tell us about yourself"
                  multiline
                  numberOfLines={4}
                />
              </View>

              <TouchableOpacity
                style={[styles.submitButton, savingProfile && styles.submitButtonDisabled]}
                onPress={saveProfile}
                disabled={savingProfile}
              >
                {savingProfile ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.submitButtonText}>Save Profile</Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Plan Request Modal */}
      <Modal
        visible={showPlanModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowPlanModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Request Meal Plan</Text>
              <TouchableOpacity onPress={() => setShowPlanModal(false)}>
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              <Text style={styles.sectionLabel}>Plan Type *</Text>
              <View style={styles.planTypeGrid}>
                {planTypes.map((type) => (
                  <TouchableOpacity
                    key={type.value}
                    style={[
                      styles.planTypeButton,
                      planType === type.value && styles.planTypeButtonActive,
                    ]}
                    onPress={() => setPlanType(type.value)}
                  >
                    <Text
                      style={[
                        styles.planTypeText,
                        planType === type.value && styles.planTypeTextActive,
                      ]}
                    >
                      {type.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.sectionLabel}>Start Date</Text>
              {Platform.OS === 'web' ? (
                <TextInput
                  style={styles.input}
                  value={startDateText}
                  onChangeText={setStartDateText}
                  placeholder="YYYY-MM-DD"
                />
              ) : (
                <>
                  <TouchableOpacity
                    style={styles.dateButton}
                    onPress={() => setShowDatePicker(true)}
                  >
                    <Text style={styles.dateButtonText}>
                      {startDate.toLocaleDateString()}
                    </Text>
                    <Ionicons name="calendar" size={20} color="#666" />
                  </TouchableOpacity>
                  {showDatePicker && (
                    <DateTimePicker
                      value={startDate}
                      mode="date"
                      display="default"
                      onChange={(event, selectedDate) => {
                        setShowDatePicker(Platform.OS === 'ios');
                        if (selectedDate) {
                          setStartDate(selectedDate);
                        }
                      }}
                      minimumDate={new Date()}
                    />
                  )}
                </>
              )}

              <Text style={styles.sectionLabel}>
                Meals Requested * {planType === 'single_meal' && '(Select one)'}
              </Text>
              <View style={styles.mealsGrid}>
                {mealOptions.map((meal) => (
                  <TouchableOpacity
                    key={meal}
                    style={[
                      styles.mealCheckbox,
                      selectedMeals.includes(meal) && styles.mealCheckboxActive,
                    ]}
                    onPress={() => toggleMealSelection(meal)}
                  >
                    <Ionicons
                      name={selectedMeals.includes(meal) ? 'checkbox' : 'square-outline'}
                      size={24}
                      color={selectedMeals.includes(meal) ? '#ffd700' : '#999'}
                    />
                    <Text style={styles.mealLabel}>{meal}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.sectionLabel}>Preferred Guide (Optional)</Text>
              <View style={styles.guidePicker}>
                <TouchableOpacity
                  style={[
                    styles.guideOption,
                    selectedGuide === '' && styles.guideOptionActive,
                  ]}
                  onPress={() => setSelectedGuide('')}
                >
                  <Text
                    style={[
                      styles.guideOptionText,
                      selectedGuide === '' && styles.guideOptionTextActive,
                    ]}
                  >
                    No Preference
                  </Text>
                </TouchableOpacity>
                {guides.map((guide) => (
                  <TouchableOpacity
                    key={guide._id}
                    style={[
                      styles.guideOption,
                      selectedGuide === guide._id && styles.guideOptionActive,
                    ]}
                    onPress={() => setSelectedGuide(guide._id)}
                  >
                    <Text
                      style={[
                        styles.guideOptionText,
                        selectedGuide === guide._id && styles.guideOptionTextActive,
                      ]}
                    >
                      {guide.name}
                      {guide.average_rating && ` (★${guide.average_rating.toFixed(1)})`}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <TouchableOpacity
                style={[styles.submitButton, submitting && styles.submitButtonDisabled]}
                onPress={submitPlanRequest}
                disabled={submitting}
              >
                {submitting ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.submitButtonText}>Request Plan</Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
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
  nameRatingRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e293b',
    marginRight: 8,
  },
  ratingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fef3c7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  ratingText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#92400e',
    marginLeft: 2,
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
  requestButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffd700',
    padding: 16,
    borderRadius: 12,
    margin: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  requestButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
    marginLeft: 8,
  },
  planCard: {
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
  planHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  planType: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1e293b',
  },
  planDate: {
    fontSize: 14,
    color: '#64748b',
    marginTop: 4,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: '#22c55e',
  },
  statusRequested: {
    backgroundColor: '#ffd700',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#fff',
    textTransform: 'capitalize',
  },
  planMeals: {
    fontSize: 14,
    color: '#64748b',
    marginBottom: 4,
    textTransform: 'capitalize',
  },
  planGuide: {
    fontSize: 14,
    color: '#64748b',
    marginBottom: 8,
  },
  deletePlanButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  deletePlanText: {
    fontSize: 14,
    color: '#ef4444',
    marginLeft: 4,
    fontWeight: '600',
  },
  aboutContent: {
    padding: 16,
    paddingBottom: 100,
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffd700',
    padding: 12,
    borderRadius: 12,
    marginBottom: 16,
  },
  editButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
    marginLeft: 8,
  },
  profileCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  profileRowText: {
    flex: 1,
    marginLeft: 12,
  },
  profileLabel: {
    fontSize: 12,
    color: '#64748b',
    marginBottom: 4,
  },
  profileValue: {
    fontSize: 16,
    color: '#1e293b',
    fontWeight: '500',
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#1e293b',
  },
  bioInput: {
    height: 100,
    textAlignVertical: 'top',
  },
  inputRow: {
    flexDirection: 'row',
  },
  genderRow: {
    flexDirection: 'row',
  },
  genderButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginRight: 8,
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  genderButtonActive: {
    backgroundColor: '#ffd700',
    borderColor: '#ffd700',
  },
  genderButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748b',
  },
  genderButtonTextActive: {
    color: '#fff',
  },
  optionsRow: {
    flexDirection: 'row',
  },
  optionButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginRight: 8,
    backgroundColor: '#fff',
  },
  optionButtonActive: {
    backgroundColor: '#ffd700',
    borderColor: '#ffd700',
  },
  optionButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748b',
  },
  optionButtonTextActive: {
    color: '#fff',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1e293b',
  },
  modalBody: {
    padding: 16,
  },
  sectionLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 12,
    marginTop: 8,
  },
  activityTypeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 16,
  },
  activityTypeButton: {
    width: '48%',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginRight: '2%',
    marginBottom: 8,
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  activityTypeButtonActive: {
    backgroundColor: '#ffd700',
    borderColor: '#ffd700',
  },
  activityTypeText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748b',
    marginTop: 8,
  },
  activityTypeTextActive: {
    color: '#fff',
  },
  planTypeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 16,
  },
  planTypeButton: {
    width: '48%',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginRight: '2%',
    marginBottom: 8,
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  planTypeButtonActive: {
    backgroundColor: '#ffd700',
    borderColor: '#ffd700',
  },
  planTypeText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748b',
  },
  planTypeTextActive: {
    color: '#fff',
  },
  dateButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  dateButtonText: {
    fontSize: 16,
    color: '#1e293b',
  },
  mealsGrid: {
    marginBottom: 16,
  },
  mealCheckbox: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    marginBottom: 8,
    borderRadius: 8,
    backgroundColor: '#f8fafc',
  },
  mealCheckboxActive: {
    backgroundColor: '#fef3c7',
  },
  mealLabel: {
    fontSize: 16,
    color: '#1e293b',
    marginLeft: 12,
  },
  guidePicker: {
    marginBottom: 16,
  },
  guideOption: {
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 8,
    backgroundColor: '#fff',
  },
  guideOptionActive: {
    backgroundColor: '#ffd700',
    borderColor: '#ffd700',
  },
  guideOptionText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748b',
  },
  guideOptionTextActive: {
    color: '#fff',
  },
  submitButton: {
    backgroundColor: '#ffd700',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 16,
    marginBottom: 32,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
  },
  emptyText: {
    fontSize: 16,
    color: '#94a3b8',
    textAlign: 'center',
    marginTop: 32,
  },
});