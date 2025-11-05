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
import { useCart } from '../../src/context/CartContext';
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
  const { refreshCart } = useCart();
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
  const [planGoal, setPlanGoal] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Planning Modal States (for guides)
  const [showPlanningModal, setShowPlanningModal] = useState(false);
  const [currentPlanForPlanning, setCurrentPlanForPlanning] = useState<MealPlan | null>(null);
  const [planningMealSelections, setPlanningMealSelections] = useState<Record<string, Record<string, string>>>({});
  const [mealOptions, setMealOptions] = useState<MealOption[]>([]);
  const [savingPlan, setSavingPlan] = useState(false);

  // View Plan Modal States (for guidees)
  const [showViewPlanModal, setShowViewPlanModal] = useState(false);
  const [currentViewPlan, setCurrentViewPlan] = useState<MealPlan | null>(null);
  
  // Meal Detail Modal States
  const [showMealDetailModal, setShowMealDetailModal] = useState(false);
  const [selectedMealForDetail, setSelectedMealForDetail] = useState<any>(null);
  const [mealDetailLoading, setMealDetailLoading] = useState(false);
  const [addingToCart, setAddingToCart] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);

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
    current_goal: '',
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

  // Helper function to sort meals chronologically
  const sortMealsChronologically = (meals: string[]) => {
    const mealOrder = ['breakfast', 'brunch', 'lunch', 'evening_snacks', 'dinner', 'supper'];
    return [...meals].sort((a, b) => {
      const indexA = mealOrder.indexOf(a.toLowerCase());
      const indexB = mealOrder.indexOf(b.toLowerCase());
      return indexA - indexB;
    });
  };

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

  useEffect(() => {
    if (showViewPlanModal && currentViewPlan) {
      fetchMealOptionsForViewPlan();
    }
  }, [showViewPlanModal, currentViewPlan]);

  const fetchMealOptionsForViewPlan = async () => {
    try {
      const token = await storage.getItemAsync('session_token');
      
      // Fetch preset bowls (recipes with "Bowls" category)
      const recipesResponse = await axios.get(`${API_URL}/recipes`);
      const presetBowls = recipesResponse.data
        .filter((r: any) => r.categories && r.categories.includes('Bowls'))
        .map((r: any) => ({
          ...r,
          type: 'preset_bowl' as const,
        }));

      // Fetch preset meals (combos)
      const mealsResponse = await axios.get(`${API_URL}/meals`);
      const presetMeals = mealsResponse.data.map((m: any) => ({
        ...m,
        type: 'preset_meal' as const,
      }));

      // Fetch guide's MyDIY items if guide exists
      let guideBowls: any[] = [];
      let guideMeals: any[] = [];
      if (currentViewPlan?.guide_id) {
        try {
          const guideRecipesResponse = await axios.get(`${API_URL}/recipes?user_id=${currentViewPlan.guide_id}`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          guideBowls = guideRecipesResponse.data
            .filter((r: any) => !r.is_preset)
            .map((r: any) => ({ ...r, type: 'my_bowl' as const }));

          const guideMealsResponse = await axios.get(`${API_URL}/meals?user_id=${currentViewPlan.guide_id}`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          guideMeals = guideMealsResponse.data
            .filter((m: any) => !m.is_preset)
            .map((m: any) => ({ ...m, type: 'my_meal' as const }));
        } catch (error) {
          console.error('Error fetching guide MyDIY items:', error);
        }
      }

      setMealOptions([...presetBowls, ...presetMeals, ...guideBowls, ...guideMeals]);
    } catch (error) {
      console.error('Error fetching meal options:', error);
    }
  };

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
      
      // Fetch preset bowls (recipes with "Bowls" category)
      const recipesResponse = await axios.get(`${API_URL}/recipes`);
      const presetBowls = recipesResponse.data
        .filter((r: any) => r.categories && r.categories.includes('Bowls'))
        .map((r: any) => ({
          ...r,
          type: 'preset_bowl' as const,
        }));

      // Fetch preset meals (combos - all are meals)
      const mealsResponse = await axios.get(`${API_URL}/meals`);
      const presetMeals = mealsResponse.data.map((m: any) => ({
        ...m,
        type: 'preset_meal' as const,
      }));

      // Fetch guide's own MyDIY items
      const myRecipesResponse = await axios.get(`${API_URL}/recipes?user_id=${user?._id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const myBowls = myRecipesResponse.data
        .filter((r: any) => !r.is_preset)
        .map((r: any) => ({ ...r, type: 'my_bowl' as const }));

      const myMealsResponse = await axios.get(`${API_URL}/meals?user_id=${user?._id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const myMeals = myMealsResponse.data
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
    setShowPlanningModal(true); // Show modal immediately
    
    // Fetch data in background
    fetchMealOptionsForPlanning();
    
    // Initialize selections with existing logged meals if any
    if (plan.logged_meals) {
      setPlanningMealSelections(plan.logged_meals);
    } else {
      setPlanningMealSelections({});
    }
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
          goal: planGoal || null,
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
      setPlanGoal('');
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
                placeholderTextColor="#94a3b8"
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
                  placeholderTextColor="#94a3b8"
                />
              </View>
              <View style={[styles.inputGroup, { flex: 1, marginLeft: 8 }]}>
                <Text style={styles.inputLabel}>Unit</Text>
                <TextInput
                  style={styles.input}
                  value={activityData.unit}
                  onChangeText={(text) => setActivityData({ ...activityData, unit: text })}
                  placeholder="minutes"
                  placeholderTextColor="#94a3b8"
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
              placeholderTextColor="#94a3b8"
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
                placeholderTextColor="#94a3b8"
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
                  placeholderTextColor="#94a3b8"
                />
              </View>
              <View style={[styles.inputGroup, { flex: 1, marginLeft: 8 }]}>
                <Text style={styles.inputLabel}>End Time</Text>
                <TextInput
                  style={styles.input}
                  value={activityData.endTime}
                  onChangeText={(text) => setActivityData({ ...activityData, endTime: text })}
                  placeholder="6:00 AM"
                  placeholderTextColor="#94a3b8"
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
                placeholderTextColor="#94a3b8"
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
                  placeholderTextColor="#94a3b8"
                />
              </View>
              <View style={[styles.inputGroup, { flex: 1, marginLeft: 8 }]}>
                <Text style={styles.inputLabel}>Unit</Text>
                <TextInput
                  style={styles.input}
                  value={activityData.unit}
                  onChangeText={(text) => setActivityData({ ...activityData, unit: text })}
                  placeholder="times"
                  placeholderTextColor="#94a3b8"
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
                placeholderTextColor="#94a3b8"
              />
            </View>
            <View style={[styles.inputGroup, { flex: 1, marginLeft: 8 }]}>
              <Text style={styles.inputLabel}>Unit</Text>
              <TextInput
                style={styles.input}
                value={activityData.unit}
                onChangeText={(text) => setActivityData({ ...activityData, unit: text })}
                placeholder="glasses"
                placeholderTextColor="#94a3b8"
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
              placeholderTextColor="#94a3b8"
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
                        <TouchableOpacity 
                          style={styles.guideeNameButton}
                          onPress={() => router.push(`/user-profile/${item.guidee_id}`)}
                        >
                          <Ionicons name="person-circle" size={16} color="#3b82f6" />
                          <Text style={styles.guideeNameText}>{item.guidee_name}</Text>
                        </TouchableOpacity>
                        <Text style={styles.planType}>
                          {planTypes.find(p => p.value === item.plan_type)?.label || item.plan_type}
                        </Text>
                        <Text style={styles.planDate}>
                          Starts: {new Date(item.start_date).toLocaleDateString()}
                        </Text>
                        {item.goal && (
                          <Text style={styles.planName}>{item.goal}</Text>
                        )}
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
                      Meals: {sortMealsChronologically(item.meals_requested).map(m => m.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')).join(', ')}
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
                        <Text style={styles.planningButtonText}>
                          {item.logged_meals && Object.keys(item.logged_meals).length > 0 ? 'Keep Planning' : 'Start Planning'}
                        </Text>
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
                        style={styles.deleteIconButton}
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
                        {item.goal && (
                          <Text style={styles.planName}>{item.goal}</Text>
                        )}
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
                      Meals: {sortMealsChronologically(item.meals_requested).map(m => m.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')).join(', ')}
                    </Text>
                    {item.guide_name && (
                      <Text style={styles.planGuide}>Guide: {item.guide_name}</Text>
                    )}
                    
                    {item.status === 'submitted' && (
                      <TouchableOpacity
                        style={styles.viewPlanButton}
                        onPress={() => {
                          setCurrentViewPlan(item);
                          setShowViewPlanModal(true);
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
            <TouchableOpacity
              style={styles.requestButton}
              onPress={() => setShowEditModal(true)}
            >
              <Ionicons name="create-outline" size={24} color="#fff" />
              <Text style={styles.requestButtonText}>Edit Profile</Text>
            </TouchableOpacity>

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
                <Text style={styles.profileLabel}>Current Goal</Text>
                <Text style={styles.profileValue}>{profileData.current_goal || '-'}</Text>
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
                  placeholderTextColor="#94a3b8"
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
                    placeholderTextColor="#94a3b8"
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
                    placeholderTextColor="#94a3b8"
                  />
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Current Goal</Text>
                <TextInput
                  style={styles.input}
                  value={profileData.current_goal}
                  onChangeText={(text) => setProfileData({ ...profileData, current_goal: text })}
                  placeholder="e.g., Lose 5kg in 3 months"
                  placeholderTextColor="#94a3b8"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Allergies (comma separated)</Text>
                <TextInput
                  style={styles.input}
                  value={profileData.allergies}
                  onChangeText={(text) => setProfileData({ ...profileData, allergies: text })}
                  placeholder="e.g., Nuts, Dairy"
                  placeholderTextColor="#94a3b8"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Lifestyle Disorders (comma separated)</Text>
                <TextInput
                  style={styles.input}
                  value={profileData.lifestyle_disorders}
                  onChangeText={(text) => setProfileData({ ...profileData, lifestyle_disorders: text })}
                  placeholder="e.g., Diabetes, Hypertension"
                  placeholderTextColor="#94a3b8"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Activity Level</Text>
                <View style={styles.activityLevelPicker}>
                  {activityLevels.map((level) => (
                    <TouchableOpacity
                      key={level.value}
                      style={[
                        styles.activityLevelButton,
                        profileData.lifestyle_activity_level === level.value && styles.activityLevelButtonActive,
                      ]}
                      onPress={() => setProfileData({ ...profileData, lifestyle_activity_level: level.value })}
                    >
                      <Text
                        style={[
                          styles.activityLevelText,
                          profileData.lifestyle_activity_level === level.value && styles.activityLevelTextActive,
                        ]}
                      >
                        {level.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Profession</Text>
                <TextInput
                  style={styles.input}
                  value={profileData.profession}
                  onChangeText={(text) => setProfileData({ ...profileData, profession: text })}
                  placeholder="e.g., Software Engineer"
                  placeholderTextColor="#94a3b8"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Fitness Activities (comma separated)</Text>
                <TextInput
                  style={styles.input}
                  value={profileData.fitness_activities}
                  onChangeText={(text) => setProfileData({ ...profileData, fitness_activities: text })}
                  placeholder="e.g., Running, Yoga"
                  placeholderTextColor="#94a3b8"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Bio</Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  value={profileData.bio}
                  onChangeText={(text) => setProfileData({ ...profileData, bio: text })}
                  placeholder="Tell us about yourself..."
                  placeholderTextColor="#94a3b8"
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
                  <Text style={styles.submitButtonText}>Save Changes</Text>
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

              <Text style={styles.sectionLabel}>Start Date *</Text>
              {Platform.OS === 'web' ? (
                <input
                  type="date"
                  style={{
                    width: '100%',
                    padding: '12px',
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    fontSize: '14px',
                    marginBottom: '16px',
                    fontFamily: 'inherit',
                    color: '#1e293b',
                    boxSizing: 'border-box',
                  }}
                  value={startDateText}
                  onChange={(e) => setStartDateText(e.target.value)}
                  min={(() => {
                    const date = new Date();
                    date.setDate(date.getDate() + 2); // Day after tomorrow
                    return date.toISOString().split('T')[0];
                  })()}
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
                      minimumDate={(() => {
                        const date = new Date();
                        date.setDate(date.getDate() + 2); // Day after tomorrow
                        return date;
                      })()}
                    />
                  )}
                </>
              )}

              <Text style={styles.sectionLabel}>Plan Name (Optional)</Text>
              <TextInput
                style={styles.input}
                value={planGoal}
                onChangeText={setPlanGoal}
                placeholder="e.g., My Weight Loss Plan"
                placeholderTextColor="#94a3b8"
              />

              <Text style={styles.sectionLabel}>
                Meals Requested * {planType === 'single_meal' && '(Select one)'}
              </Text>
              <View style={styles.mealsGrid}>
                {mealOptionsArray.map((meal) => (
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

              <Text style={styles.sectionLabel}>Select Guide *</Text>
              <View style={styles.guidePicker}>
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

      {/* Planning Modal (for guides) */}
      <Modal
        visible={showPlanningModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowPlanningModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxHeight: '90%' }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Plan Meals</Text>
              <TouchableOpacity onPress={() => setShowPlanningModal(false)}>
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              {currentPlanForPlanning && (
                <>
                  <Text style={styles.planInfoText}>
                    Plan for: {currentPlanForPlanning.guidee_name}
                  </Text>
                  <Text style={styles.planInfoText}>
                    Type: {planTypes.find(p => p.value === currentPlanForPlanning.plan_type)?.label}
                  </Text>

                  {generateDatesForPlan(currentPlanForPlanning).map((date) => (
                    <View key={date} style={styles.dateSection}>
                      <Text style={styles.dateSectionTitle}>
                        {new Date(date).toLocaleDateString('en-US', { 
                          weekday: 'long', 
                          year: 'numeric', 
                          month: 'long', 
                          day: 'numeric' 
                        })}
                      </Text>

                      {(() => {
                        // Sort meals in chronological order
                        const mealOrder = ['breakfast', 'brunch', 'lunch', 'evening_snacks', 'dinner', 'supper'];
                        const sortedMeals = [...currentPlanForPlanning.meals_requested].sort((a, b) => {
                          return mealOrder.indexOf(a) - mealOrder.indexOf(b);
                        });
                        return sortedMeals;
                      })().map((meal) => {
                        const selectedMealId = planningMealSelections[date]?.[meal];
                        const selectedMeal = mealOptions.find(m => m._id === selectedMealId);
                        return (
                        <View key={`${date}-${meal}`} style={styles.mealPlanCard}>
                          <View style={styles.mealPlanHeader}>
                            <Text style={styles.mealTimeLabel}>
                              {meal.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')}
                            </Text>
                            {selectedMeal && (
                              <Text style={styles.selectedMealName}>
                                {selectedMeal.name} - ₹{selectedMeal.calculated_price?.toFixed(2) || '0.00'}
                              </Text>
                            )}
                          </View>
                          
                          {Platform.OS === 'web' ? (
                            <select
                              style={{
                                flex: 1,
                                padding: 12,
                                borderWidth: 1,
                                borderColor: '#e2e8f0',
                                borderRadius: 8,
                                fontSize: 14,
                              }}
                              value={planningMealSelections[date]?.[meal] || ''}
                              onChange={(e) => {
                                setPlanningMealSelections({
                                  ...planningMealSelections,
                                  [date]: {
                                    ...planningMealSelections[date],
                                    [meal]: e.target.value,
                                  },
                                });
                              }}
                            >
                              <option value="">Select a meal option</option>
                              {mealOptions.map((option) => (
                                <option key={option._id} value={option._id}>
                                  {option.name} - ₹{option.calculated_price?.toFixed(2) || '0.00'} ({option.type.replace('_', ' ')})
                                </option>
                              ))}
                            </select>
                          ) : (
                            <Picker
                              selectedValue={planningMealSelections[date]?.[meal] || ''}
                              style={styles.mealPicker}
                              onValueChange={(itemValue) => {
                                setPlanningMealSelections({
                                  ...planningMealSelections,
                                  [date]: {
                                    ...planningMealSelections[date],
                                    [meal]: itemValue,
                                  },
                                });
                              }}
                            >
                              <Picker.Item label="Select a meal option" value="" />
                              {mealOptions.map((option) => (
                                <Picker.Item
                                  key={option._id}
                                  label={`${option.name} - ₹${option.calculated_price?.toFixed(2) || '0.00'} (${option.type.replace('_', ' ')})`}
                                  value={option._id}
                                />
                              ))}
                            </Picker>
                          )}
                        </View>
                        );
                      })}
                    </View>
                  ))}

                  <View style={styles.planningButtonsRow}>
                    <TouchableOpacity
                      style={[styles.saveProgressButton, savingPlan && styles.submitButtonDisabled]}
                      onPress={savePlanProgress}
                      disabled={savingPlan}
                    >
                      {savingPlan ? (
                        <ActivityIndicator color="#fff" size="small" />
                      ) : (
                        <>
                          <Ionicons name="save" size={18} color="#fff" />
                          <Text style={styles.saveProgressButtonText}>Save Progress</Text>
                        </>
                      )}
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.submitButton, savingPlan && styles.submitButtonDisabled]}
                      onPress={submitCompletedPlan}
                      disabled={savingPlan}
                    >
                      {savingPlan ? (
                        <ActivityIndicator color="#fff" size="small" />
                      ) : (
                        <>
                          <Ionicons name="checkmark-done" size={18} color="#fff" />
                          <Text style={styles.submitButtonText}>Submit Plan</Text>
                        </>
                      )}
                    </TouchableOpacity>
                  </View>
                </>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        visible={showDeleteConfirm}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setShowDeleteConfirm(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.deleteModalContent}>
            <View style={styles.deleteModalHeader}>
              <Ionicons name="warning" size={32} color="#ef4444" />
              <Text style={styles.deleteModalTitle}>
                {deleteTarget?.type === 'habit' ? 'Delete Activity' : 'Delete Plan'}
              </Text>
            </View>
            
            <Text style={styles.deleteModalMessage}>
              {deleteTarget?.type === 'habit' 
                ? 'Are you sure you want to delete this activity? This action cannot be undone.'
                : 'Are you sure you want to delete this plan? This action cannot be undone.'
              }
            </Text>
            
            <View style={styles.deleteModalButtons}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => {
                  setShowDeleteConfirm(false);
                  setDeleteTarget(null);
                }}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={styles.deleteButton}
                onPress={() => {
                  if (deleteTarget?.type === 'habit') {
                    deleteHabit(deleteTarget.id);
                  } else if (deleteTarget?.type === 'plan') {
                    deletePlan(deleteTarget.id);
                  }
                  setShowDeleteConfirm(false);
                  setDeleteTarget(null);
                }}
              >
                <Text style={styles.deleteButtonText}>Delete</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Meal Detail Modal - Bottom Sheet */}
      <Modal
        visible={showMealDetailModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowMealDetailModal(false)}
        presentationStyle="overFullScreen"
        statusBarTranslucent
      >
        <View style={styles.bottomSheetOverlay}>
          <TouchableOpacity 
            style={styles.bottomSheetBackdrop} 
            activeOpacity={1}
            onPress={() => setShowMealDetailModal(false)}
          />
          <View style={styles.bottomSheetContent}>
            <View style={styles.bottomSheetHandle} />
            <View style={styles.bottomSheetHeader}>
              <Text style={styles.modalTitle}>Meal Details</Text>
              <TouchableOpacity onPress={() => setShowMealDetailModal(false)}>
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.bottomSheetBody}>
              {mealDetailLoading ? (
                <ActivityIndicator size="large" color="#ffd700" style={{ marginTop: 20 }} />
              ) : selectedMealForDetail ? (
                <>
                  <Text style={styles.mealDetailName}>{selectedMealForDetail.name}</Text>
                  <Text style={styles.mealDetailPrice}>
                    ₹{selectedMealForDetail.calculated_price?.toFixed(2) || selectedMealForDetail.price?.toFixed(2) || '0.00'}
                  </Text>

                  {selectedMealForDetail.ingredients && selectedMealForDetail.ingredients.length > 0 && (
                    <>
                      <Text style={styles.sectionLabel}>Ingredients:</Text>
                      {selectedMealForDetail.ingredients.map((ing: any, index: number) => (
                        <View key={index} style={styles.ingredientRow}>
                          <Text style={styles.ingredientName}>{ing.ingredient_name || ing.name || 'Ingredient'}</Text>
                          <Text style={styles.ingredientQuantity}>
                            {ing.quantity} {ing.unit}
                          </Text>
                        </View>
                      ))}
                    </>
                  )}

                  {selectedMealForDetail.recipes && selectedMealForDetail.recipes.length > 0 && (
                    <>
                      <Text style={styles.sectionLabel}>Items:</Text>
                      {selectedMealForDetail.recipes.map((recipe: any, index: number) => (
                        <View key={index} style={styles.ingredientRow}>
                          <Text style={styles.ingredientName}>{recipe.recipe_name || recipe.name || 'Item'}</Text>
                          <Text style={styles.ingredientQuantity}>
                            {recipe.quantity}
                          </Text>
                        </View>
                      ))}
                    </>
                  )}

                  <TouchableOpacity
                    style={[styles.submitButton, addingToCart && styles.submitButtonDisabled]}
                    onPress={async () => {
                      setAddingToCart(true);
                      try {
                        const token = await storage.getItemAsync('session_token');
                        
                        // Format customizations to match MealIngredient model
                        let customizations = [];
                        
                        // For bowls/recipes - use ingredients
                        if (selectedMealForDetail.ingredients && selectedMealForDetail.ingredients.length > 0) {
                          customizations = selectedMealForDetail.ingredients.map((ing: any) => ({
                            ingredient_id: ing.ingredient_id || ing._id,
                            name: ing.ingredient_name || ing.name,
                            price: ing.price || 0,
                            default_quantity: ing.quantity,
                            quantity: ing.quantity,
                          }));
                        }
                        // For meals - use recipes as customizations
                        else if (selectedMealForDetail.recipes && selectedMealForDetail.recipes.length > 0) {
                          customizations = selectedMealForDetail.recipes.map((recipe: any) => ({
                            ingredient_id: recipe.recipe_id || recipe._id,
                            name: recipe.recipe_name || recipe.name,
                            price: recipe.price || 0,
                            default_quantity: recipe.quantity,
                            quantity: recipe.quantity,
                          }));
                        }
                        
                        const cartItem = {
                          meal_id: selectedMealForDetail._id,
                          meal_name: selectedMealForDetail.name,
                          quantity: 1,
                          price: selectedMealForDetail.calculated_price || selectedMealForDetail.price || 0,
                          customizations: customizations,
                        };
                        
                        await axios.post(`${API_URL}/cart`, cartItem, {
                          headers: { Authorization: `Bearer ${token}` },
                        });
                        
                        // Refresh cart to update badge count
                        await refreshCart();
                        
                        setShowMealDetailModal(false);
                        setShowSuccessModal(true);
                      } catch (error: any) {
                        console.error('Error adding to cart:', error);
                        console.error('Error details:', error.response?.data);
                        Alert.alert('Error', error.response?.data?.detail || 'Failed to add item to cart');
                      } finally {
                        setAddingToCart(false);
                      }
                    }}
                    disabled={addingToCart}
                  >
                    {addingToCart ? (
                      <ActivityIndicator color="#fff" size="small" />
                    ) : (
                      <>
                        <Ionicons name="cart" size={20} color="#fff" />
                        <Text style={styles.submitButtonText}>Add to Cart</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </>
              ) : null}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* View Plan Modal (for guidees) */}
      <Modal
        visible={showViewPlanModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowViewPlanModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxHeight: '90%' }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Meal Plan Details</Text>
              <TouchableOpacity onPress={() => setShowViewPlanModal(false)}>
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              {currentViewPlan && (
                <>
                  <Text style={styles.planInfoText}>
                    Guide: {currentViewPlan.guide_name || 'Not assigned'}
                  </Text>
                  <Text style={styles.planInfoText}>
                    Type: {planTypes.find(p => p.value === currentViewPlan.plan_type)?.label}
                  </Text>
                  <Text style={styles.planInfoText}>
                    Start Date: {new Date(currentViewPlan.start_date).toLocaleDateString()}
                  </Text>

                  {currentViewPlan.logged_meals && Object.keys(currentViewPlan.logged_meals).length > 0 ? (
                    Object.entries(currentViewPlan.logged_meals).map(([date, meals]: [string, any]) => (
                      <View key={date} style={styles.dateSection}>
                        <Text style={styles.dateSectionTitle}>
                          {new Date(date).toLocaleDateString('en-US', { 
                            weekday: 'long', 
                            year: 'numeric', 
                            month: 'long', 
                            day: 'numeric' 
                          })}
                        </Text>

                        {Object.entries(meals).map(([mealTime, mealId]: [string, any]) => {
                          const mealOption = mealOptions.find(m => m._id === mealId);
                          return (
                            <View key={`${date}-${mealTime}`} style={styles.viewPlanMealCard}>
                              <View style={styles.viewPlanMealInfo}>
                                <Text style={styles.mealTimeLabel}>
                                  {mealTime.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                                </Text>
                                <Text style={styles.mealNameText}>
                                  {mealOption?.name || 'Meal Item'}
                                </Text>
                                {mealOption?.calculated_price && (
                                  <Text style={styles.mealPriceText}>
                                    ₹{mealOption.calculated_price.toFixed(2)}
                                  </Text>
                                )}
                              </View>
                              {mealOption && (
                                <TouchableOpacity
                                  style={styles.addToCartIconButton}
                                  onPress={async () => {
                                    // Close view plan modal first
                                    setShowViewPlanModal(false);
                                    
                                    // Small delay to ensure view plan modal is closed
                                    setTimeout(async () => {
                                      setShowMealDetailModal(true);
                                      setMealDetailLoading(true);
                                      try {
                                        const token = await storage.getItemAsync('session_token');
                                        let mealDetails;
                                        if (mealOption.type === 'preset_bowl' || mealOption.type === 'my_bowl') {
                                          const response = await axios.get(`${API_URL}/recipes/${mealOption._id}`, {
                                            headers: { Authorization: `Bearer ${token}` },
                                          });
                                          mealDetails = response.data;
                                        } else if (mealOption.type === 'preset_meal' || mealOption.type === 'my_meal') {
                                          const response = await axios.get(`${API_URL}/meals/${mealOption._id}`, {
                                            headers: { Authorization: `Bearer ${token}` },
                                          });
                                          mealDetails = response.data;
                                        }
                                        console.log('Fetched meal details:', mealDetails);
                                        setSelectedMealForDetail(mealDetails);
                                      } catch (error) {
                                        console.error('Error fetching meal details:', error);
                                        setSelectedMealForDetail(mealOption);
                                      } finally {
                                        setMealDetailLoading(false);
                                      }
                                    }, 300);
                                  }}
                                >
                                  <Ionicons name="eye" size={20} color="#ffd700" />
                                </TouchableOpacity>
                              )}
                            </View>
                          );
                        })}
                      </View>
                    ))
                  ) : (
                    <Text style={styles.emptyText}>No meals logged yet</Text>
                  )}
                </>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Success Modal */}
      <Modal
        visible={showSuccessModal}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setShowSuccessModal(false)}
      >
        <View style={styles.successModalOverlay}>
          <View style={styles.successModalContent}>
            <Ionicons name="checkmark-circle" size={64} color="#10b981" />
            <Text style={styles.successModalText}>Added to cart!</Text>
            <TouchableOpacity
              style={styles.successModalButton}
              onPress={() => setShowSuccessModal(false)}
            >
              <Text style={styles.successModalButtonText}>OK</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  tabBar: {
    maxHeight: 50,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    backgroundColor: '#fff',
  },
  tabBarContent: {
    paddingHorizontal: 16,
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginRight: 8,
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
  tabTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1e293b',
    marginBottom: 16,
  },
  tabHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  logButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ffd700',
  },
  logButtonHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#ffd700',
    marginBottom: 16,
    alignSelf: 'flex-start',
  },
  logButtonText: {
    color: '#ffd700',
    fontWeight: '600',
    fontSize: 14,
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
  requestButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#ffd700',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    marginBottom: 16,
  },
  requestButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
  planCard: {
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
  planHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  planFromText: {
    fontSize: 14,
    color: '#64748b',
    marginBottom: 4,
  },
  planFromTextLink: {
    fontSize: 14,
    color: '#3b82f6',
    marginBottom: 4,
    textDecorationLine: 'underline',
  },
  guideeNameButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: '#eff6ff',
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#3b82f6',
  },
  guideeNameText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#3b82f6',
  },
  planType: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 4,
  },
  planDate: {
    fontSize: 14,
    color: '#64748b',
  },
  planGoal: {
    fontSize: 13,
    color: '#64748b',
    fontStyle: 'italic',
    marginTop: 4,
  },
  planName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 4,
  },
  planMeals: {
    fontSize: 14,
    color: '#64748b',
    marginTop: 4,
  },
  planGoal: {
    fontSize: 14,
    color: '#64748b',
    fontStyle: 'italic',
  },
  statusBadge: {
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: '#e2e8f0',
  },
  statusRequested: {
    backgroundColor: '#fef3c7',
  },
  statusAccepted: {
    backgroundColor: '#dbeafe',
  },
  statusPlanning: {
    backgroundColor: '#e0e7ff',
  },
  statusSubmitted: {
    backgroundColor: '#dcfce7',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1e293b',
    textTransform: 'capitalize',
  },
  planMeals: {
    fontSize: 14,
    color: '#64748b',
    marginTop: 2,
    marginBottom: 8,
  },
  planGuide: {
    fontSize: 14,
    color: '#64748b',
    marginBottom: 12,
  },
  acceptButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#10b981',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginTop: 8,
  },
  acceptButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  planningButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#3b82f6',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginTop: 8,
  },
  planningButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  viewPlanButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#8b5cf6',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginTop: 8,
    marginBottom: 8,
  },
  viewPlanButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  deletePlanButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ef4444',
    marginTop: 8,
  },
  deletePlanText: {
    color: '#ef4444',
    fontWeight: '600',
    fontSize: 14,
  },
  conversationCard: {
    flexDirection: 'row',
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
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  conversationInfo: {
    flex: 1,
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
    gap: 8,
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e293b',
  },
  ratingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: '#fef3c7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  ratingText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#92400e',
  },
  timestamp: {
    fontSize: 12,
    color: '#94a3b8',
  },
  messageRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
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
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
    marginLeft: 8,
  },
  unreadBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  aboutContent: {
    paddingBottom: 20,
  },
  aboutHeader: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginBottom: 16,
  },
  editIconButton: {
    padding: 8,
  },
  viewPlanMealRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#f8fafc',
    borderRadius: 8,
  },
  viewPlanMealCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  viewPlanMealInfo: {
    flex: 1,
  },
  mealNameText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e293b',
    marginTop: 4,
  },
  mealPriceText: {
    fontSize: 14,
    color: '#10b981',
    marginTop: 4,
    fontWeight: '600',
  },
  addToCartIconButton: {
    padding: 8,
    backgroundColor: '#fef3c7',
    borderRadius: 8,
    marginLeft: 12,
  },
  mealPlanCard: {
    marginBottom: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  mealPlanHeader: {
    marginBottom: 12,
  },
  selectedMealName: {
    fontSize: 14,
    color: '#64748b',
    marginTop: 4,
  },
  mealDetailName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1e293b',
    marginBottom: 8,
  },
  mealDetailPrice: {
    fontSize: 20,
    fontWeight: '600',
    color: '#10b981',
    marginBottom: 20,
  },
  ingredientRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    marginBottom: 8,
  },
  ingredientName: {
    fontSize: 16,
    color: '#1e293b',
    flex: 1,
  },
  ingredientQuantity: {
    fontSize: 14,
    color: '#64748b',
    fontWeight: '600',
  },
  bottomSheetOverlay: {
    flex: 1,
    backgroundColor: 'transparent',
    justifyContent: 'flex-end',
    zIndex: 9998,
  },
  bottomSheetBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    zIndex: 9998,
  },
  bottomSheetContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 20,
    zIndex: 9999,
  },
  bottomSheetHandle: {
    width: 40,
    height: 4,
    backgroundColor: '#e2e8f0',
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 8,
    marginBottom: 4,
  },
  bottomSheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    paddingTop: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  bottomSheetBody: {
    padding: 20,
    maxHeight: '100%',
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    width: '100%',
    maxWidth: 500,
    maxHeight: '80%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1e293b',
  },
  modalBody: {
    padding: 20,
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 12,
    marginTop: 8,
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748b',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: '#1e293b',
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  inputRow: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  genderRow: {
    flexDirection: 'row',
    gap: 12,
  },
  genderButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    alignItems: 'center',
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
  activityLevelPicker: {
    gap: 8,
  },
  activityLevelButton: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    alignItems: 'center',
  },
  activityLevelButtonActive: {
    backgroundColor: '#ffd700',
    borderColor: '#ffd700',
  },
  activityLevelText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748b',
  },
  activityLevelTextActive: {
    color: '#fff',
  },
  activityTypeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 16,
  },
  activityTypeButton: {
    width: '30%',
    aspectRatio: 1,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#ffd700',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  activityTypeButtonActive: {
    backgroundColor: '#ffd700',
  },
  activityTypeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#ffd700',
    textAlign: 'center',
  },
  activityTypeTextActive: {
    color: '#fff',
  },
  planTypeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 16,
  },
  planTypeButton: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
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
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  dateButtonText: {
    fontSize: 14,
    color: '#1e293b',
  },
  mealsGrid: {
    gap: 12,
    marginBottom: 16,
  },
  mealCheckbox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  mealCheckboxActive: {
    backgroundColor: '#fef3c7',
    borderColor: '#ffd700',
  },
  mealLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1e293b',
  },
  guidePicker: {
    gap: 12,
    marginBottom: 16,
  },
  guideOption: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
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
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
  planInfoText: {
    fontSize: 14,
    color: '#64748b',
    marginBottom: 8,
  },
  dateSection: {
    marginBottom: 24,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
  },
  dateSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 12,
  },
  mealPlanRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  mealTimeLabel: {
    width: 120,
    fontSize: 14,
    fontWeight: '600',
    color: '#64748b',
  },
  mealPicker: {
    flex: 1,
    height: 50,
  },
  planningButtonsRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  saveProgressButton: {
    flex: 1,
    backgroundColor: '#64748b',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  saveProgressButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  deleteModalContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    margin: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
  },
  deleteModalHeader: {
    alignItems: 'center',
    marginBottom: 16,
  },
  deleteModalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1e293b',
    marginTop: 12,
    textAlign: 'center',
  },
  deleteModalMessage: {
    fontSize: 16,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 24,
  },
  deleteModalButtons: {
    flexDirection: 'row',
    width: '100%',
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#fff',
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#64748b',
  },
  deleteIconButton: {
    padding: 4,
  },
  deleteButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    backgroundColor: '#ef4444',
    alignItems: 'center',
  },
  deleteButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  successModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  successModalContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 10,
  },
  successModalText: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1e293b',
    marginTop: 16,
  },
  successModalButton: {
    marginTop: 24,
    paddingVertical: 12,
    paddingHorizontal: 32,
    backgroundColor: '#ffd700',
    borderRadius: 8,
  },
  successModalButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
});

      {/* Edit Profile Modal - Continuing in next file chunk due to size */}