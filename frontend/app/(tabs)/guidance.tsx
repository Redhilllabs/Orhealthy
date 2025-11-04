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
  Picker,
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
  logged_meals?: any;
}

interface Guide {
  _id: string;
  name: string;
  average_rating?: number;
}

interface MealOption {
  _id: string;
  name: string;
  calculated_price?: number;
  type: 'preset_bowl' | 'preset_meal' | 'my_bowl' | 'my_meal';
}

export default function GuidanceScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'plan-requests' | 'timeline' | 'plans' | 'about' | 'messages'>(
    user?.is_guide ? 'plan-requests' : 'timeline'
  );
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [conversationRatings, setConversationRatings] = useState<Record<string, number>>({});
  const [habits, setHabits] = useState<HabitLog[]>([]);
  const [mealPlans, setMealPlans] = useState<MealPlan[]>([]);
  const [guidePlans, setGuidePlans] = useState<MealPlan[]>([]); // Plans for guide
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

  // Planning Modal States (for guides)
  const [showPlanningModal, setShowPlanningModal] = useState(false);
  const [currentPlanForPlanning, setCurrentPlanForPlanning] = useState<MealPlan | null>(null);
  const [planningMealSelections, setPlanningMealSelections] = useState<Record<string, Record<string, string>>>({});
  const [mealOptions, setMealOptions] = useState<MealOption[]>([]);
  const [savingPlan, setSavingPlan] = useState(false);

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

  // Delete Confirmation Modal States
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ type: 'habit' | 'plan', id: string } | null>(null);

  const mealOptionsArray = [
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
    } else if (activeTab === 'plan-requests' && user?.is_guide) {
      fetchGuidePlans();
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

  const fetchGuidePlans = async () => {
    setLoading(true);
    try {
      const token = await storage.getItemAsync('session_token');
      const response = await axios.get(`${API_URL}/meal-plans/guide`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setGuidePlans(response.data || []);
    } catch (error) {
      console.error('Error fetching guide plans:', error);
      setGuidePlans([]);
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

  const fetchMealOptionsForPlanning = async () => {
    try {
      const token = await storage.getItemAsync('session_token');
      
      // Fetch preset bowls (recipes)
      const recipesResponse = await axios.get(`${API_URL}/recipes`);
      const presetBowls = recipesResponse.data.map((r: any) => ({
        ...r,
        type: 'preset_bowl' as const,
      }));

      // Fetch preset meals (combos)
      const mealsResponse = await axios.get(`${API_URL}/meals`);
      const presetMeals = mealsResponse.data.map((m: any) => ({
        ...m,
        type: 'preset_meal' as const,
      }));

      // Fetch user's saved bowls and meals
      const savedResponse = await axios.get(`${API_URL}/recipes?user_id=${user?._id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const myBowls = savedResponse.data
        .filter((r: any) => !r.is_preset)
        .map((r: any) => ({ ...r, type: 'my_bowl' as const }));

      const savedMealsResponse = await axios.get(`${API_URL}/meals?user_id=${user?._id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const myMeals = savedMealsResponse.data
        .filter((m: any) => !m.is_preset)
        .map((m: any) => ({ ...m, type: 'my_meal' as const }));

      setMealOptions([...presetBowls, ...presetMeals, ...myBowls, ...myMeals]);
    } catch (error) {
      console.error('Error fetching meal options:', error);
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

  const acceptPlan = async (planId: string) => {
    try {
      const token = await storage.getItemAsync('session_token');
      await axios.put(
        `${API_URL}/meal-plans/${planId}/accept`,
        {},
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      Alert.alert('Success', 'Plan accepted successfully');
      fetchGuidePlans();
    } catch (error) {
      console.error('Error accepting plan:', error);
      Alert.alert('Error', 'Failed to accept plan');
    }
  };

  const startPlanning = async (plan: MealPlan) => {
    setCurrentPlanForPlanning(plan);
    await fetchMealOptionsForPlanning();
    
    // Initialize selections with existing logged meals if any
    if (plan.logged_meals) {
      setPlanningMealSelections(plan.logged_meals);
    } else {
      setPlanningMealSelections({});
    }
    
    setShowPlanningModal(true);
  };

  const savePlanProgress = async () => {
    if (!currentPlanForPlanning) return;
    
    setSavingPlan(true);
    try {
      const token = await storage.getItemAsync('session_token');
      await axios.put(
        `${API_URL}/meal-plans/${currentPlanForPlanning._id}/save-progress`,
        { logged_meals: planningMealSelections },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      Alert.alert('Success', 'Progress saved successfully');
    } catch (error) {
      console.error('Error saving progress:', error);
      Alert.alert('Error', 'Failed to save progress');
    } finally {
      setSavingPlan(false);
    }
  };

  const submitCompletedPlan = async () => {
    if (!currentPlanForPlanning) return;
    
    // Check if all meals are logged
    const dates = generateDatesForPlan(currentPlanForPlanning);
    let allLogged = true;
    for (const date of dates) {
      for (const meal of currentPlanForPlanning.meals_requested) {
        if (!planningMealSelections[date]?.[meal]) {
          allLogged = false;
          break;
        }
      }
      if (!allLogged) break;
    }

    if (!allLogged) {
      Alert.alert('Incomplete Plan', 'Please log all meals before submitting');
      return;
    }

    setSavingPlan(true);
    try {
      const token = await storage.getItemAsync('session_token');
      await axios.put(
        `${API_URL}/meal-plans/${currentPlanForPlanning._id}/submit`,
        { logged_meals: planningMealSelections },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      Alert.alert('Success', 'Plan submitted successfully');
      setShowPlanningModal(false);
      fetchGuidePlans();
    } catch (error) {
      console.error('Error submitting plan:', error);
      Alert.alert('Error', 'Failed to submit plan');
    } finally {
      setSavingPlan(false);
    }
  };

  const generateDatesForPlan = (plan: MealPlan): string[] => {
    const dates: string[] = [];
    const startDate = new Date(plan.start_date);
    let numDays = 1;

    switch (plan.plan_type) {
      case 'single_meal':
        numDays = 1;
        break;
      case '1_day':
        numDays = 1;
        break;
      case '3_day':
        numDays = 3;
        break;
      case 'week':
        numDays = 7;
        break;
      case 'fortnight':
        numDays = 14;
        break;
      case 'month':
        numDays = 30;
        break;
    }

    for (let i = 0; i < numDays; i++) {
      const date = new Date(startDate);
      date.setDate(date.getDate() + i);
      dates.push(date.toISOString().split('T')[0]);
    }

    return dates;
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

    if (!selectedGuide) {
      Alert.alert('Error', 'Please select a guide');
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
          guide_id: selectedGuide,
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
              placeholder="Sprouted Legumes Bowl"
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
                <Text style={styles.inputLabel}>Count/Duration *</Text>
                <TextInput
                  style={styles.input}
                  value={activityData.value}
                  onChangeText={(text) => setActivityData({ ...activityData, value: text })}
                  keyboardType="numeric"
                  placeholder="15"
                />
              </View>
              <View style={[styles.inputGroup, { flex: 1, marginLeft: 8 }]}>
                <Text style={styles.inputLabel}>Unit</Text>
                <TextInput
                  style={styles.input}
                  value={activityData.unit}
                  onChangeText={(text) => setActivityData({ ...activityData, unit: text })}
                  placeholder="times"
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
              style={[styles.input, styles.textArea]}
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
      case 'plan-requests':
        return (
          <View style={styles.tabContent}>
            <Text style={styles.tabTitle}>Plan Requests</Text>
            {loading ? (
              <ActivityIndicator size="large" color="#ffd700" style={{ marginTop: 20 }} />
            ) : guidePlans.length === 0 ? (
              <Text style={styles.emptyText}>No plan requests yet</Text>
            ) : (
              <FlatList
                data={guidePlans}
                keyExtractor={(item) => item._id}
                renderItem={({ item }) => (
                  <View style={styles.planCard}>
                    <View style={styles.planHeader}>
                      <View>
                        <Text style={styles.planFromText}>From: {item.guidee_name}</Text>
                        <Text style={styles.planType}>
                          {planTypes.find(p => p.value === item.plan_type)?.label || item.plan_type}
                        </Text>
                        <Text style={styles.planDate}>
                          Starts: {new Date(item.start_date).toLocaleDateString()}
                        </Text>
                      </View>
                      <View style={[
                        styles.statusBadge,
                        item.status === 'requested' && styles.statusRequested,
                        item.status === 'accepted' && styles.statusAccepted,
                        item.status === 'planning' && styles.statusPlanning,
                        item.status === 'submitted' && styles.statusSubmitted,
                      ]}>
                        <Text style={styles.statusText}>{item.status}</Text>
                      </View>
                    </View>
                    <Text style={styles.planMeals}>
                      Meals: {item.meals_requested.map(m => m.replace(/_/g, ' ')).join(', ')}
                    </Text>
                    
                    {item.status === 'requested' && (
                      <TouchableOpacity
                        style={styles.acceptButton}
                        onPress={() => acceptPlan(item._id)}
                      >
                        <Ionicons name="checkmark-circle" size={18} color="#fff" />
                        <Text style={styles.acceptButtonText}>Accept</Text>
                      </TouchableOpacity>
                    )}
                    
                    {(item.status === 'accepted' || item.status === 'planning') && (
                      <TouchableOpacity
                        style={styles.planningButton}
                        onPress={() => startPlanning(item)}
                      >
                        <Ionicons name="create" size={18} color="#fff" />
                        <Text style={styles.planningButtonText}>Start Planning</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                )}
                contentContainerStyle={styles.listContent}
                refreshControl={
                  <RefreshControl
                    refreshing={refreshing}
                    onRefresh={() => {
                      setRefreshing(true);
                      fetchGuidePlans();
                    }}
                    colors={['#ffd700']}
                  />
                }
              />
            )}
          </View>
        );

      case 'timeline':
        return (
          <View style={styles.tabContent}>
            <View style={styles.tabHeader}>
              <Text style={styles.tabTitle}>Timeline</Text>
              <TouchableOpacity
                style={styles.logButton}
                onPress={() => setShowActivityModal(true)}
              >
                <Ionicons name="add-circle" size={24} color="#ffd700" />
                <Text style={styles.logButtonText}>Log Activity</Text>
              </TouchableOpacity>
            </View>

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
                      <TouchableOpacity
                        style={styles.deleteButton}
                        onPress={() => {
                          setDeleteTarget({ type: 'habit', id: item._id });
                          setShowDeleteConfirm(true);
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
                      <View style={[
                        styles.statusBadge,
                        item.status === 'requested' && styles.statusRequested,
                        item.status === 'accepted' && styles.statusAccepted,
                        item.status === 'submitted' && styles.statusSubmitted,
                      ]}>
                        <Text style={styles.statusText}>{item.status}</Text>
                      </View>
                    </View>
                    <Text style={styles.planMeals}>
                      Meals: {item.meals_requested.map(m => m.replace(/_/g, ' ')).join(', ')}
                    </Text>
                    {item.guide_name && (
                      <Text style={styles.planGuide}>Guide: {item.guide_name}</Text>
                    )}
                    
                    {item.status === 'submitted' && (
                      <TouchableOpacity
                        style={styles.viewPlanButton}
                        onPress={() => {
                          // Open view plan modal
                          Alert.alert('Plan Details', 'View submitted plan details here');
                        }}
                      >
                        <Ionicons name="eye" size={18} color="#fff" />
                        <Text style={styles.viewPlanButtonText}>View Plan</Text>
                      </TouchableOpacity>
                    )}
                    
                    <TouchableOpacity
                      style={styles.deletePlanButton}
                      onPress={() => {
                        setDeleteTarget({ type: 'plan', id: item._id });
                        setShowDeleteConfirm(true);
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
            <View style={styles.aboutHeader}>
              <Text style={styles.tabTitle}>About Me</Text>
              <TouchableOpacity
                style={styles.editIconButton}
                onPress={() => setShowEditModal(true)}
              >
                <Ionicons name="create-outline" size={24} color="#ffd700" />
              </TouchableOpacity>
            </View>

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
          </ScrollView>
        );

      case 'messages':
        return (
          <View style={styles.tabContent}>
            <Text style={styles.tabTitle}>Messages</Text>
            {loading ? (
              <ActivityIndicator size="large" color="#ffd700" style={{ marginTop: 20 }} />
            ) : conversations.length === 0 ? (
              <Text style={styles.emptyText}>No conversations yet</Text>
            ) : (
              <FlatList
                data={conversations}
                keyExtractor={(item) => item._id}
                renderItem={renderConversation}
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
              />
            )}
          </View>
        );

      default:
        return null;
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Tab Navigation */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.tabBar}
        contentContainerStyle={styles.tabBarContent}
      >
        {user?.is_guide && (
          <TouchableOpacity
            style={[styles.tab, activeTab === 'plan-requests' && styles.activeTab]}
            onPress={() => setActiveTab('plan-requests')}
          >
            <Ionicons
              name="clipboard"
              size={20}
              color={activeTab === 'plan-requests' ? '#ffd700' : '#999'}
            />
            <Text style={[styles.tabLabel, activeTab === 'plan-requests' && styles.activeTabLabel]}>
              Plan Requests
            </Text>
          </TouchableOpacity>
        )}
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
          style={[styles.tab, activeTab === 'plans' && styles.activeTab]}
          onPress={() => setActiveTab('plans')}
        >
          <Ionicons
            name="calendar"
            size={20}
            color={activeTab === 'plans' ? '#ffd700' : '#999'}
          />
          <Text style={[styles.tabLabel, activeTab === 'plans' && styles.activeTabLabel]}>
            My Plans
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
        <TouchableOpacity
          style={[styles.tab, activeTab === 'messages' && styles.activeTab]}
          onPress={() => setActiveTab('messages')}
        >
          <Ionicons
            name="chatbubbles"
            size={20}
            color={activeTab === 'messages' ? '#ffd700' : '#999'}
          />
          <Text style={[styles.tabLabel, activeTab === 'messages' && styles.activeTabLabel]}>
            Messages
          </Text>
        </TouchableOpacity>
      </ScrollView>

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
              <TouchableOpacity onPress={() => setShowActivityModal(false)}>
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
                      color={activityType === type.value ? '#fff' : '#ffd700'}
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

      {/* Edit Profile Modal - Continuing in next file chunk due to size */}