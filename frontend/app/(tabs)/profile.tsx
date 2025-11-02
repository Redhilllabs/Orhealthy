import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Alert,
  TextInput,
  Modal,
  FlatList,
} from 'react-native';
import { useState, useEffect } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../src/context/AuthContext';
import { storage } from '../../src/utils/storage';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import axios from 'axios';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL + '/api';

interface Address {
  label: string;
  apartment?: string;
  full_address: string;
  city: string;
  state: string;
  pincode: string;
  phone: string;
  is_default: boolean;
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

export default function ProfileScreen() {
  const { user, signOut } = useAuth();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'posts' | 'guides' | 'guidees' | 'idols' | 'fans' | 'addresses' | 'habits'>('posts');
  const [loading, setLoading] = useState(false);
  const [posts, setPosts] = useState<any[]>([]);
  const [guides, setGuides] = useState<any[]>([]);
  const [guidees, setGuidees] = useState<any[]>([]);
  const [idols, setIdols] = useState<any[]>([]);
  const [fans, setFans] = useState<any[]>([]);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [habits, setHabits] = useState<HabitLog[]>([]);
  const [withdrawalRequests, setWithdrawalRequests] = useState<any[]>([]);
  const [isDeliveryAgent, setIsDeliveryAgent] = useState(false);
  
  // Address modal
  const [showAddressModal, setShowAddressModal] = useState(false);
  const [newAddressLabel, setNewAddressLabel] = useState('');
  const [newAddressApartment, setNewAddressApartment] = useState('');
  const [newAddressStreet, setNewAddressStreet] = useState('');
  const [newAddressCity, setNewAddressCity] = useState('');
  const [newAddressState, setNewAddressState] = useState('');
  const [newAddressZip, setNewAddressZip] = useState('');
  const [newAddressPhone, setNewAddressPhone] = useState('');

  // Habit modal
  const [showHabitModal, setShowHabitModal] = useState(false);
  const [habitType, setHabitType] = useState('meals');
  const [habitDescription, setHabitDescription] = useState('');
  const [habitValue, setHabitValue] = useState('');
  const [habitUnit, setHabitUnit] = useState('servings');

  // Withdrawal modal
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [requesting, setRequesting] = useState(false);

  useEffect(() => {
    if (user) {
      fetchProfileData();
      fetchAddresses();
      checkDeliveryAgent();
      if (user.is_guide) {
        fetchWithdrawals();
      }
    }
  }, [user]);

  useEffect(() => {
    if (activeTab === 'posts') {
      fetchPosts();
    } else if (activeTab === 'habits') {
      fetchHabits();
    }
  }, [activeTab]);

  const fetchProfileData = async () => {
    try {
      const token = await storage.getItemAsync('session_token');
      const response = await axios.get(`${API_URL}/users/${user?._id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      
      const data = response.data;
      
      // Fetch guides
      if (data.guides && data.guides.length > 0) {
        const guidePromises = data.guides.map((id: string) =>
          axios.get(`${API_URL}/users/${id}`, {
            headers: { Authorization: `Bearer ${token}` },
          })
        );
        const guideResponses = await Promise.all(guidePromises);
        setGuides(guideResponses.map(r => r.data));
      }

      // Fetch guidees
      if (data.guidees && data.guidees.length > 0) {
        const guideePromises = data.guidees.map((id: string) =>
          axios.get(`${API_URL}/users/${id}`, {
            headers: { Authorization: `Bearer ${token}` },
          })
        );
        const guideeResponses = await Promise.all(guideePromises);
        setGuidees(guideeResponses.map(r => r.data));
      }

      // Fetch idols (people user follows)
      if (data.idols && data.idols.length > 0) {
        const idolPromises = data.idols.map((id: string) =>
          axios.get(`${API_URL}/users/${id}`, {
            headers: { Authorization: `Bearer ${token}` },
          })
        );
        const idolResponses = await Promise.all(idolPromises);
        setIdols(idolResponses.map(r => r.data));
      }

      // Fetch fans (people who follow user)
      if (data.fans && data.fans.length > 0) {
        const fanPromises = data.fans.map((id: string) =>
          axios.get(`${API_URL}/users/${id}`, {
            headers: { Authorization: `Bearer ${token}` },
          })
        );
        const fanResponses = await Promise.all(fanPromises);
        setFans(fanResponses.map(r => r.data));
      }
    } catch (error) {
      console.error('Error fetching profile data:', error);
    }
  };

  const fetchPosts = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API_URL}/posts`);
      const userPosts = response.data.filter((post: any) => post.user_id === user?._id);
      setPosts(userPosts);
    } catch (error) {
      console.error('Error fetching posts:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchAddresses = async () => {
    try {
      const token = await storage.getItemAsync('session_token');
      const response = await axios.get(`${API_URL}/addresses`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setAddresses(response.data || []);
    } catch (error) {
      console.error('Error fetching addresses:', error);
      setAddresses([]);
    }
  };

  const fetchHabits = async () => {
    try {
      setLoading(true);
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
    }
  };

  const fetchWithdrawals = async () => {
    try {
      const token = await storage.getItemAsync('session_token');
      const response = await axios.get(`${API_URL}/withdrawal-requests/my`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setWithdrawalRequests(response.data || []);
    } catch (error) {
      console.error('Error fetching withdrawals:', error);
    }
  };

  const checkDeliveryAgent = async () => {
    try {
      const token = await storage.getItemAsync('session_token');
      const response = await axios.get(`${API_URL}/delivery-agents/check`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setIsDeliveryAgent(response.data.is_delivery_agent || false);
    } catch (error) {
      console.error('Error checking delivery agent status:', error);
    }
  };


  const saveNewAddress = async () => {
    if (!newAddressLabel || !newAddressStreet || !newAddressCity || !newAddressState || !newAddressZip || !newAddressPhone) {
      Alert.alert('Error', 'Please fill all required address fields');
      return;
    }

    try {
      const token = await storage.getItemAsync('session_token');
      
      const fullAddress = newAddressApartment 
        ? `${newAddressApartment}, ${newAddressStreet}`
        : newAddressStreet;
      
      await axios.post(
        `${API_URL}/addresses`,
        {
          label: newAddressLabel,
          apartment: newAddressApartment,
          full_address: fullAddress,
          city: newAddressCity,
          state: newAddressState,
          pincode: newAddressZip,
          phone: newAddressPhone,
          is_default: addresses.length === 0,
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      Alert.alert('Success', 'Address saved successfully');
      await fetchAddresses();
      setShowAddressModal(false);
      // Clear form
      setNewAddressLabel('');
      setNewAddressApartment('');
      setNewAddressStreet('');
      setNewAddressCity('');
      setNewAddressState('');
      setNewAddressZip('');
      setNewAddressPhone('');
    } catch (error: any) {
      console.error('Error saving address:', error);
      Alert.alert('Error', error.response?.data?.detail || 'Failed to save address');
    }
  };

  const deleteAddress = async (index: number) => {
    try {
      const token = await storage.getItemAsync('session_token');
      await axios.delete(`${API_URL}/addresses/${index}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      Alert.alert('Success', 'Address deleted');
      fetchAddresses();
    } catch (error) {
      console.error('Error deleting address:', error);
      Alert.alert('Error', 'Failed to delete address');
    }
  };

  const logHabit = async () => {
    if (!habitDescription.trim()) {
      Alert.alert('Error', 'Please enter habit details');
      return;
    }

    try {
      const token = await storage.getItemAsync('session_token');
      await axios.post(
        `${API_URL}/habits`,
        {
          date: new Date().toISOString(),
          habit_type: habitType,
          description: habitDescription,
          value: habitValue ? parseFloat(habitValue) : undefined,
          unit: habitValue ? habitUnit : undefined,
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      Alert.alert('Success', 'Habit logged successfully');
      setShowHabitModal(false);
      setHabitDescription('');
      setHabitValue('');
      fetchHabits();
    } catch (error: any) {
      console.error('Error logging habit:', error);
      Alert.alert('Error', error.response?.data?.detail || 'Failed to log habit');
    }
  };

  const deleteHabit = async (habitId: string) => {
    try {
      const token = await storage.getItemAsync('session_token');
      await axios.delete(`${API_URL}/habits/${habitId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      Alert.alert('Success', 'Habit deleted');
      fetchHabits();
    } catch (error) {
      console.error('Error deleting habit:', error);
      Alert.alert('Error', 'Failed to delete habit');
    }
  };

  const requestWithdrawal = async () => {
    if (!withdrawAmount || parseFloat(withdrawAmount) <= 0) {
      Alert.alert('Error', 'Please enter a valid amount');
      return;
    }

    if (parseFloat(withdrawAmount) > (user?.commission_balance || 0)) {
      Alert.alert('Error', 'Insufficient commission balance');
      return;
    }

    try {
      setRequesting(true);
      const token = await storage.getItemAsync('session_token');
      await axios.post(
        `${API_URL}/withdrawal-requests`,
        { amount: parseFloat(withdrawAmount) },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      Alert.alert('Success', 'Withdrawal request submitted');
      setShowWithdrawModal(false);
      setWithdrawAmount('');
      fetchWithdrawals();
    } catch (error: any) {
      console.error('Error requesting withdrawal:', error);
      Alert.alert('Error', error.response?.data?.detail || 'Failed to submit request');
    } finally {
      setRequesting(false);
    }
  };

  const tabs = [
    { key: 'posts', label: 'Posts', icon: 'list' },
    { key: 'guides', label: 'Guides', icon: 'star' },
    { key: 'guidees', label: 'Guidees', icon: 'people' },
    { key: 'idols', label: 'Idols', icon: 'heart' },
    { key: 'fans', label: 'Fans', icon: 'trophy' },
    { key: 'addresses', label: 'Addresses', icon: 'location' },
    { key: 'habits', label: 'Habits', icon: 'fitness' },
  ];

  const renderTabContent = () => {
    if (loading) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#ffd700" />
        </View>
      );
    }

    switch (activeTab) {
      case 'posts':
        return (
          <FlatList
            data={posts}
            keyExtractor={(item) => item._id}
            renderItem={({ item }) => (
              <View style={styles.postCard}>
                <Text style={styles.postContent}>{item.content}</Text>
                {item.images && item.images.length > 0 && (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.postImagesScroll}>
                    {item.images.map((img: string, idx: number) => (
                      <Image key={idx} source={{ uri: img }} style={styles.postImage} />
                    ))}
                  </ScrollView>
                )}
                <Text style={styles.postDate}>
                  {new Date(item.created_at).toLocaleDateString()}
                </Text>
              </View>
            )}
            ListEmptyComponent={
              <Text style={styles.emptyText}>No posts yet</Text>
            }
          />
        );

      case 'guides':
        return (
          <FlatList
            data={guides}
            keyExtractor={(item) => item._id}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.userCard}
                onPress={() => router.push(`/user/${item._id}`)}
              >
                {item.picture ? (
                  <Image source={{ uri: item.picture }} style={styles.userAvatar} />
                ) : (
                  <View style={[styles.userAvatar, styles.avatarPlaceholder]}>
                    <Text style={styles.avatarText}>{item.name?.charAt(0)}</Text>
                  </View>
                )}
                <View style={styles.userInfo}>
                  <Text style={styles.userName}>{item.name}</Text>
                  {item.star_rating && item.star_rating > 0 && (
                    <Text style={styles.userRating}>{item.star_rating}⭐</Text>
                  )}
                </View>
              </TouchableOpacity>
            )}
            ListEmptyComponent={
              <Text style={styles.emptyText}>No guides yet</Text>
            }
          />
        );

      case 'guidees':
        return (
          <FlatList
            data={guidees}
            keyExtractor={(item) => item._id}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.userCard}
                onPress={() => router.push(`/user/${item._id}`)}
              >
                {item.picture ? (
                  <Image source={{ uri: item.picture }} style={styles.userAvatar} />
                ) : (
                  <View style={[styles.userAvatar, styles.avatarPlaceholder]}>
                    <Text style={styles.avatarText}>{item.name?.charAt(0)}</Text>
                  </View>
                )}
                <View style={styles.userInfo}>
                  <Text style={styles.userName}>{item.name}</Text>
                </View>
              </TouchableOpacity>
            )}
            ListEmptyComponent={
              <Text style={styles.emptyText}>No guidees yet</Text>
            }
          />
        );

      case 'idols':
        return (
          <FlatList
            data={idols}
            keyExtractor={(item) => item._id}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.userCard}
                onPress={() => router.push(`/user/${item._id}`)}
              >
                {item.picture ? (
                  <Image source={{ uri: item.picture }} style={styles.userAvatar} />
                ) : (
                  <View style={[styles.userAvatar, styles.avatarPlaceholder]}>
                    <Text style={styles.avatarText}>{item.name?.charAt(0)}</Text>
                  </View>
                )}
                <View style={styles.userInfo}>
                  <Text style={styles.userName}>{item.name}</Text>
                </View>
              </TouchableOpacity>
            )}
            ListEmptyComponent={
              <Text style={styles.emptyText}>Not following anyone yet</Text>
            }
          />
        );

      case 'fans':
        return (
          <FlatList
            data={fans}
            keyExtractor={(item) => item._id}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.userCard}
                onPress={() => router.push(`/user/${item._id}`)}
              >
                {item.picture ? (
                  <Image source={{ uri: item.picture }} style={styles.userAvatar} />
                ) : (
                  <View style={[styles.userAvatar, styles.avatarPlaceholder]}>
                    <Text style={styles.avatarText}>{item.name?.charAt(0)}</Text>
                  </View>
                )}
                <View style={styles.userInfo}>
                  <Text style={styles.userName}>{item.name}</Text>
                </View>
              </TouchableOpacity>
            )}
            ListEmptyComponent={
              <Text style={styles.emptyText}>No fans yet</Text>
            }
          />
        );

      case 'addresses':
        return (
          <View style={styles.addressesContainer}>
            <TouchableOpacity
              style={styles.addButton}
              onPress={() => setShowAddressModal(true)}
            >
              <Ionicons name="add-circle" size={24} color="#ffd700" />
              <Text style={styles.addButtonText}>Add New Address</Text>
            </TouchableOpacity>

            {addresses.length === 0 ? (
              <Text style={styles.emptyText}>No saved addresses</Text>
            ) : (
              addresses.map((addr, index) => (
                <View key={index} style={styles.addressCard}>
                  <View style={styles.addressHeader}>
                    <Text style={styles.addressLabel}>{addr.label}</Text>
                    <TouchableOpacity
                      onPress={() => {
                        Alert.alert(
                          'Delete Address',
                          'Are you sure you want to delete this address?',
                          [
                            { text: 'Cancel', style: 'cancel' },
                            { text: 'Delete', style: 'destructive', onPress: () => deleteAddress(index) },
                          ]
                        );
                      }}
                    >
                      <Ionicons name="trash-outline" size={20} color="#ef4444" />
                    </TouchableOpacity>
                  </View>
                  <Text style={styles.addressText}>{addr.full_address}</Text>
                  <Text style={styles.addressText}>
                    {addr.city}, {addr.state} - {addr.pincode}
                  </Text>
                  <Text style={styles.addressText}>☎ {addr.phone}</Text>
                </View>
              ))
            )}
          </View>
        );

      case 'habits':
        return (
          <View style={styles.habitsContainer}>
            <TouchableOpacity
              style={styles.addButton}
              onPress={() => setShowHabitModal(true)}
            >
              <Ionicons name="add-circle" size={24} color="#ffd700" />
              <Text style={styles.addButtonText}>Log Habit</Text>
            </TouchableOpacity>

            {habits.length === 0 ? (
              <Text style={styles.emptyText}>No habits logged yet</Text>
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
                            'Delete Habit',
                            'Are you sure you want to delete this habit log?',
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
              />
            )}
          </View>
        );

      default:
        return null;
    }
  };

  if (!user) {
    return (
      <View style={styles.container}>
        <Text>Not logged in</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <View style={styles.profileSection}>
          {user.picture ? (
            <Image source={{ uri: user.picture }} style={styles.profilePicture} />
          ) : (
            <View style={[styles.profilePicture, styles.avatarPlaceholder]}>
              <Text style={styles.avatarText}>{user.name?.charAt(0)}</Text>
            </View>
          )}
          <View style={styles.profileInfo}>
            <Text style={styles.profileName}>{user.name}</Text>
            <Text style={styles.profileEmail}>{user.email}</Text>
            {user.is_guide && user.star_rating && user.star_rating > 0 && (
              <Text style={styles.starRating}>{user.star_rating}⭐ Guide</Text>
            )}
            {user.is_guide && (!user.star_rating || user.star_rating === 0) && (
              <Text style={styles.starRating}>Guide</Text>
            )}
          </View>
        </View>

        <TouchableOpacity style={styles.logoutButton} onPress={signOut}>
          <Ionicons name="log-out-outline" size={24} color="#ef4444" />
        </TouchableOpacity>
      </View>

      {/* Commission Section for Guides */}
      {user.is_guide && (
        <View style={styles.commissionSection}>
          <View style={styles.commissionInfo}>
            <Text style={styles.commissionLabel}>Commission Balance</Text>
            <Text style={styles.commissionAmount}>
              ₹{(user.commission_balance || 0).toFixed(2)}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.withdrawButton}
            onPress={() => setShowWithdrawModal(true)}
          >
            <Text style={styles.withdrawButtonText}>Withdraw</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Delivery Agent Section */}
      {isDeliveryAgent && (
        <TouchableOpacity
          style={styles.deliveryModeButton}
          onPress={() => router.push('/delivery-mode')}
        >
          <Ionicons name="bicycle" size={24} color="#fff" />
          <Text style={styles.deliveryModeText}>Switch to Delivery Mode</Text>
          <Ionicons name="arrow-forward" size={20} color="#fff" />
        </TouchableOpacity>
      )}

      {/* Horizontal Tabs */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.tabsContainer}
        contentContainerStyle={styles.tabsContent}
      >
        {tabs.map((tab) => (
          <TouchableOpacity
            key={tab.key}
            style={[styles.tab, activeTab === tab.key && styles.activeTab]}
            onPress={() => setActiveTab(tab.key as any)}
          >
            <Ionicons
              name={tab.icon as any}
              size={18}
              color={activeTab === tab.key ? '#ffd700' : '#666'}
            />
            <Text style={[styles.tabLabel, activeTab === tab.key && styles.activeTabLabel]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Tab Content */}
      <View style={styles.content}>
        {renderTabContent()}
      </View>

      {/* Address Modal */}
      <Modal visible={showAddressModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add New Address</Text>
              <TouchableOpacity onPress={() => setShowAddressModal(false)}>
                <Ionicons name="close" size={28} color="#333" />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalBody}>
              <TextInput
                style={styles.input}
                placeholder="Label (e.g., Home, Office) *"
                value={newAddressLabel}
                onChangeText={setNewAddressLabel}
              />
              <TextInput
                style={styles.input}
                placeholder="Apartment / Suite (optional)"
                value={newAddressApartment}
                onChangeText={setNewAddressApartment}
              />
              <TextInput
                style={styles.input}
                placeholder="Street Address *"
                value={newAddressStreet}
                onChangeText={setNewAddressStreet}
              />
              <TextInput
                style={styles.input}
                placeholder="City *"
                value={newAddressCity}
                onChangeText={setNewAddressCity}
              />
              <TextInput
                style={styles.input}
                placeholder="State *"
                value={newAddressState}
                onChangeText={setNewAddressState}
              />
              <TextInput
                style={styles.input}
                placeholder="PIN Code *"
                value={newAddressZip}
                onChangeText={setNewAddressZip}
                keyboardType="numeric"
              />
              <TextInput
                style={styles.input}
                placeholder="Phone *"
                value={newAddressPhone}
                onChangeText={setNewAddressPhone}
                keyboardType="phone-pad"
              />
            </ScrollView>
            <View style={styles.modalFooter}>
              <TouchableOpacity style={styles.saveButton} onPress={saveNewAddress}>
                <Text style={styles.saveButtonText}>Save Address</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Habit Modal */}
      <Modal visible={showHabitModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Log Habit</Text>
              <TouchableOpacity onPress={() => setShowHabitModal(false)}>
                <Ionicons name="close" size={28} color="#333" />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalBody}>
              <Text style={styles.label}>Habit Type</Text>
              <View style={styles.habitTypeSelector}>
                {['meals', 'exercise', 'water', 'sleep', 'notes'].map((type) => (
                  <TouchableOpacity
                    key={type}
                    style={[
                      styles.habitTypeButton,
                      habitType === type && styles.habitTypeButtonActive
                    ]}
                    onPress={() => setHabitType(type)}
                  >
                    <Text style={[
                      styles.habitTypeButtonText,
                      habitType === type && styles.habitTypeButtonTextActive
                    ]}>
                      {type.charAt(0).toUpperCase() + type.slice(1)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Description *"
                value={habitDescription}
                onChangeText={setHabitDescription}
                multiline
                numberOfLines={4}
              />

              <TextInput
                style={styles.input}
                placeholder="Value (optional)"
                value={habitValue}
                onChangeText={setHabitValue}
                keyboardType="numeric"
              />

              {habitValue && (
                <>
                  <Text style={styles.label}>Unit</Text>
                  <View style={styles.unitSelector}>
                    {['servings', 'cups', 'hours', 'minutes', 'reps', 'km'].map((unit) => (
                      <TouchableOpacity
                        key={unit}
                        style={[
                          styles.unitButton,
                          habitUnit === unit && styles.unitButtonActive
                        ]}
                        onPress={() => setHabitUnit(unit)}
                      >
                        <Text style={[
                          styles.unitButtonText,
                          habitUnit === unit && styles.unitButtonTextActive
                        ]}>
                          {unit}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </>
              )}
            </ScrollView>
            <View style={styles.modalFooter}>
              <TouchableOpacity style={styles.saveButton} onPress={logHabit}>
                <Text style={styles.saveButtonText}>Log Habit</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Withdrawal Modal */}
      <Modal visible={showWithdrawModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Request Withdrawal</Text>
              <TouchableOpacity onPress={() => setShowWithdrawModal(false)}>
                <Ionicons name="close" size={28} color="#333" />
              </TouchableOpacity>
            </View>
            <View style={styles.modalBody}>
              <Text style={styles.label}>
                Available Balance: ₹{(user?.commission_balance || 0).toFixed(2)}
              </Text>
              <TextInput
                style={styles.input}
                placeholder="Amount to withdraw"
                value={withdrawAmount}
                onChangeText={setWithdrawAmount}
                keyboardType="numeric"
              />

              {withdrawalRequests.length > 0 && (
                <View style={styles.requestsSection}>
                  <Text style={styles.label}>Recent Requests:</Text>
                  {withdrawalRequests.slice(0, 3).map((req) => (
                    <View key={req._id} style={styles.requestCard}>
                      <Text style={styles.requestAmount}>₹{req.amount.toFixed(2)}</Text>
                      <Text style={[
                        styles.requestStatus,
                        req.status === 'approved' && styles.statusApproved,
                        req.status === 'rejected' && styles.statusRejected
                      ]}>
                        {req.status}
                      </Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.saveButton}
                onPress={requestWithdrawal}
                disabled={requesting}
              >
                {requesting ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.saveButtonText}>Submit Request</Text>
                )}
              </TouchableOpacity>
            </View>
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
  header: {
    backgroundColor: '#fff',
    padding: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  profileSection: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  profilePicture: {
    width: 70,
    height: 70,
    borderRadius: 35,
    marginRight: 16,
  },
  avatarPlaceholder: {
    backgroundColor: '#ffd700',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: '#fff',
    fontSize: 28,
    fontWeight: 'bold',
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  profileEmail: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  starRating: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffd700',
  },
  logoutButton: {
    padding: 8,
  },
  commissionSection: {
    backgroundColor: '#eff6ff',
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e7ff',
  },
  commissionInfo: {
    flex: 1,
  },
  commissionLabel: {
    fontSize: 14,
    color: '#1e40af',
    marginBottom: 4,
  },
  commissionAmount: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1e40af',
  },
  withdrawButton: {
    backgroundColor: '#ffd700',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  withdrawButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  tabsContainer: {
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    maxHeight: 60,
  },
  tabsContent: {
    paddingHorizontal: 8,
    paddingVertical: 8,
    gap: 8,
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: '#f5f5f5',
    gap: 6,
    marginRight: 8,
  },
  activeTab: {
    backgroundColor: '#fffbeb',
    borderWidth: 2,
    borderColor: '#ffd700',
  },
  tabLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  activeTabLabel: {
    color: '#ffd700',
    fontWeight: 'bold',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    textAlign: 'center',
    fontSize: 16,
    color: '#999',
    marginTop: 32,
  },
  postCard: {
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
  postContent: {
    fontSize: 16,
    color: '#333',
    lineHeight: 24,
    marginBottom: 8,
  },
  postImagesScroll: {
    marginVertical: 12,
  },
  postImage: {
    width: 280,
    height: 280,
    borderRadius: 12,
    marginRight: 12,
  },
  postDate: {
    fontSize: 12,
    color: '#999',
  },
  userCard: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  userAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 12,
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  userRating: {
    fontSize: 14,
    color: '#ffd700',
    fontWeight: '600',
  },
  addressesContainer: {
    flex: 1,
  },
  habitsContainer: {
    flex: 1,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    gap: 8,
    borderWidth: 2,
    borderColor: '#ffd700',
    borderStyle: 'dashed',
  },
  addButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffd700',
  },
  addressCard: {
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
  addressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  addressLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  addressText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
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
    gap: 8,
  },
  habitType: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    textTransform: 'capitalize',
  },
  habitDescription: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
    marginBottom: 8,
  },
  habitValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffd700',
    marginBottom: 8,
  },
  habitDate: {
    fontSize: 12,
    color: '#999',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  modalBody: {
    padding: 20,
    maxHeight: 400,
  },
  modalFooter: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    backgroundColor: '#fff',
    marginBottom: 12,
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  habitTypeSelector: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  habitTypeButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#f5f5f5',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  habitTypeButtonActive: {
    backgroundColor: '#ffd700',
    borderColor: '#ffd700',
  },
  habitTypeButtonText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  habitTypeButtonTextActive: {
    color: '#fff',
    fontWeight: '600',
  },
  unitSelector: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  unitButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#f5f5f5',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  unitButtonActive: {
    backgroundColor: '#ffd700',
    borderColor: '#ffd700',
  },
  unitButtonText: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
  },
  unitButtonTextActive: {
    color: '#fff',
    fontWeight: '600',
  },
  saveButton: {
    backgroundColor: '#ffd700',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  requestsSection: {
    marginTop: 16,
  },
  requestCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    marginBottom: 8,
  },
  requestAmount: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  requestStatus: {
    fontSize: 14,
    fontWeight: '600',
    textTransform: 'capitalize',
    color: '#f59e0b',
  },
  statusApproved: {
    color: '#10b981',
  },
  statusRejected: {
    color: '#ef4444',
  },
});
