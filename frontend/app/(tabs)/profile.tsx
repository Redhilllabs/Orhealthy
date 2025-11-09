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
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useState, useEffect } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../src/context/AuthContext';
import { storage } from '../../src/utils/storage';
import { useRouter, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import axios from 'axios';
import { useCallback } from 'react';

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

interface CommissionHistory {
  _id: string;
  order_id: string;
  guidee_name: string;
  order_amount: number;
  commission_amount: number;
  commission_rate: number;
  created_at: string;
}

export default function ProfileScreen() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'posts' | 'idols' | 'fans'>('posts');
  const [loading, setLoading] = useState(false);
  const [showWalletModal, setShowWalletModal] = useState(false);
  const [showWithdrawalModal, setShowWithdrawalModal] = useState(false);
  const [showConfirmWithdrawal, setShowConfirmWithdrawal] = useState(false);
  const [showWithdrawalSuccess, setShowWithdrawalSuccess] = useState(false);
  const [commissionHistory, setCommissionHistory] = useState<CommissionHistory[]>([]);
  const [withdrawalAmount, setWithdrawalAmount] = useState('');
  const [withdrawalUpiId, setWithdrawalUpiId] = useState('');
  const [withdrawalContact, setWithdrawalContact] = useState('');
  const [posts, setPosts] = useState<any[]>([]);
  const [idols, setIdols] = useState<any[]>([]);
  const [fans, setFans] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [habits, setHabits] = useState<HabitLog[]>([]);
  const [withdrawalRequests, setWithdrawalRequests] = useState<any[]>([]);
  const [isDeliveryAgent, setIsDeliveryAgent] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [scrollY, setScrollY] = useState(0);
  const [isTabSticky, setIsTabSticky] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteAddressIndex, setDeleteAddressIndex] = useState<number | null>(null);
  const [showCancelOrderConfirm, setShowCancelOrderConfirm] = useState(false);
  const [cancelOrderId, setCancelOrderId] = useState<string | null>(null);
  const [showGuideModal, setShowGuideModal] = useState(false);
  const [guideGuidance, setGuideGuidance] = useState('');
  const [guideExperience, setGuideExperience] = useState('');
  const [guideProofDoc, setGuideProofDoc] = useState<any>(null);
  
  // Address modal
  const [showAddressModal, setShowAddressModal] = useState(false);
  const [editingAddressIndex, setEditingAddressIndex] = useState<number | null>(null);
  const [newAddressLabel, setNewAddressLabel] = useState('');
  const [newAddressApartment, setNewAddressApartment] = useState('');
  const [newAddressStreet, setNewAddressStreet] = useState('');
  const [newAddressCity, setNewAddressCity] = useState('');
  const [newAddressState, setNewAddressState] = useState('');
  const [newAddressZip, setNewAddressZip] = useState('');
  const [newAddressPhone, setNewAddressPhone] = useState('');
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

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
    }
  }, [activeTab]);

  // Re-check delivery agent status when screen is focused
  useFocusEffect(
    useCallback(() => {
      if (user) {
        checkDeliveryAgent();
      }
    }, [user])
  );

  // Fetch commission history
  const fetchCommissionHistory = async () => {
    try {
      const token = await storage.getItemAsync('session_token');
      const response = await axios.get(`${API_URL}/commission-history`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setCommissionHistory(response.data.history);
    } catch (error) {
      console.error('Error fetching commission history:', error);
    }
  };

  // Validate and show confirmation
  const validateWithdrawal = () => {
    const amount = parseFloat(withdrawalAmount);
    
    if (!amount || amount <= 0) {
      Alert.alert('Error', 'Please enter a valid amount');
      return;
    }

    if (amount > (user?.commission_balance || 0)) {
      Alert.alert('Error', 'Insufficient balance');
      return;
    }

    if (!withdrawalUpiId.trim()) {
      Alert.alert('Error', 'Please enter UPI ID');
      return;
    }

    if (!withdrawalContact.trim() || withdrawalContact.length < 10) {
      Alert.alert('Error', 'Please enter valid contact number');
      return;
    }

    setShowWithdrawalModal(false);
    setShowConfirmWithdrawal(true);
  };

  // Handle withdrawal request
  const handleWithdrawalRequest = async () => {
    const amount = parseFloat(withdrawalAmount);

    try {
      const token = await storage.getItemAsync('session_token');
      await axios.post(
        `${API_URL}/withdrawal-requests`,
        { 
          amount,
          upi_id: withdrawalUpiId,
          contact_number: withdrawalContact
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setShowConfirmWithdrawal(false);
      setShowWithdrawalSuccess(true);
      
      // Clear form
      setWithdrawalAmount('');
      setWithdrawalUpiId('');
      setWithdrawalContact('');
    } catch (error: any) {
      setShowConfirmWithdrawal(false);
      Alert.alert('Error', error.response?.data?.detail || 'Failed to submit withdrawal request');
    }
  };


  const fetchProfileData = async () => {
    try {
      const token = await storage.getItemAsync('session_token');
      const response = await axios.get(`${API_URL}/users/${user?._id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      
      const data = response.data;
      
      

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

  const fetchOrders = async () => {
    try {
      setLoading(true);
      const token = await storage.getItemAsync('session_token');
      const response = await axios.get(`${API_URL}/orders`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setOrders(response.data || []);
    } catch (error) {
      console.error('Error fetching orders:', error);
      setOrders([]);
    } finally {
      setLoading(false);
    }
  };

  const cancelOrder = async (orderId: string) => {
    try {
      setLoading(true);
      const token = await storage.getItemAsync('session_token');
      await axios.put(
        `${API_URL}/orders/${orderId}/cancel`,
        {},
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      await fetchOrders(); // Refresh orders list
      // Show success message using a simple alert
      setTimeout(() => {
        Alert.alert('Success', 'Order cancelled successfully');
      }, 100);
    } catch (error: any) {
      const errorMessage = error.response?.data?.detail || 'Failed to cancel order';
      Alert.alert('Error', errorMessage);
    } finally {

  const submitGuideOnboarding = async () => {
    if (!guideGuidance.trim() || !guideExperience.trim()) {
      Alert.alert('Error', 'Please fill in all required fields');
      return;
    }

    if (guideProofDoc && guideProofDoc.size > 5 * 1024 * 1024) {
      Alert.alert('Error', 'File size must be less than 5MB');
      return;
    }

    try {
      setLoading(true);
      const token = await storage.getItemAsync('session_token');
      
      const formData = new FormData();
      formData.append('guidance', guideGuidance);
      formData.append('experience', guideExperience);
      
      if (guideProofDoc) {
        formData.append('proof_document', {
          uri: guideProofDoc.uri,
          type: guideProofDoc.type || 'application/pdf',
          name: guideProofDoc.name || 'document.pdf',
        } as any);
      }

      await axios.post(`${API_URL}/guide-onboarding`, formData, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data',
        },
      });

      Alert.alert('Success', 'Your guide onboarding request has been submitted successfully!');
      setShowGuideModal(false);
      setGuideGuidance('');
      setGuideExperience('');
      setGuideProofDoc(null);
    } catch (error: any) {
      console.error('Error submitting guide onboarding:', error);
      Alert.alert('Error', error.response?.data?.detail || 'Failed to submit request');
    } finally {
      setLoading(false);
    }
  };

  const pickDocument = async () => {
    try {
      const result = await import('expo-document-picker').then(module => 
        module.getDocumentAsync({
          type: ['application/pdf', 'image/*'],
          copyToCacheDirectory: true,
        })
      );

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const file = result.assets[0];
        if (file.size && file.size > 5 * 1024 * 1024) {
          Alert.alert('Error', 'File size must be less than 5MB');
          return;
        }
        setGuideProofDoc(file);
      }
    } catch (error) {
      console.error('Error picking document:', error);
      Alert.alert('Error', 'Failed to pick document');
    }
  };

      setLoading(false);
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
      console.log('Checking delivery agent status for user:', user?.email);
      const response = await axios.get(`${API_URL}/delivery-agents/check`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      console.log('Delivery agent check response:', response.data);
      setIsDeliveryAgent(response.data.is_delivery_agent || false);
    } catch (error) {
      console.error('Error checking delivery agent status:', error);
      setIsDeliveryAgent(false);
    }
  };


  const openAddressModal = (index: number | null = null) => {
    if (index !== null) {
      // Edit mode
      const addr = addresses[index];
      setEditingAddressIndex(index);
      setNewAddressLabel(addr.label || '');
      setNewAddressApartment(addr.apartment || '');
      setNewAddressStreet(addr.full_address || '');
      setNewAddressCity(addr.city || '');
      setNewAddressState(addr.state || '');
      setNewAddressZip(addr.pincode || '');
      setNewAddressPhone(addr.phone || '');
    } else {
      // Add mode
      setEditingAddressIndex(null);
      setNewAddressLabel('');
      setNewAddressApartment('');
      setNewAddressStreet('');
      setNewAddressCity('');
      setNewAddressState('');
      setNewAddressZip('');
      setNewAddressPhone('');
    }
    setShowAddressModal(true);
  };

  const saveNewAddress = async () => {
    if (!newAddressLabel || !newAddressApartment || !newAddressCity || !newAddressState || !newAddressZip || !newAddressPhone) {
      Alert.alert('Error', 'Please fill all required address fields');
      return;
    }

    try {
      const token = await storage.getItemAsync('session_token');
      
      const fullAddress = newAddressStreet 
        ? `${newAddressApartment}, ${newAddressStreet}`
        : newAddressApartment;
      
      const addressData = {
        label: newAddressLabel,
        apartment: newAddressApartment,
        full_address: fullAddress,
        city: newAddressCity,
        state: newAddressState,
        pincode: newAddressZip,
        phone: newAddressPhone,
        is_default: editingAddressIndex === null ? addresses.length === 0 : addresses[editingAddressIndex]?.is_default || false,
      };

      if (editingAddressIndex !== null) {
        // Update existing address
        await axios.put(
          `${API_URL}/addresses/${editingAddressIndex}`,
          addressData,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        Alert.alert('Success', 'Address updated successfully');
      } else {
        // Create new address
        await axios.post(
          `${API_URL}/addresses`,
          addressData,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        Alert.alert('Success', 'Address saved successfully');
      }

      await fetchAddresses();
      setShowAddressModal(false);
      setEditingAddressIndex(null);
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
    { key: 'idols', label: 'Idols', icon: 'heart' },
    { key: 'fans', label: 'Fans', icon: 'trophy' },
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
      {/* Fixed Header - Always on top */}
      <View style={styles.fixedHeader}>
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

          {!user.is_guide && (
            <TouchableOpacity style={styles.beGuideButton} onPress={() => setShowGuideModal(true)}>
              <Ionicons name="star" size={24} color="#ffd700" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Conditional Layout Based on User Type */}
      {user.is_guide || isDeliveryAgent ? (
        // Layout for Guides/Agents: Wallet/Delivery cards scroll, tabs stick
        <ScrollView 
          style={styles.mainScrollView}
          contentContainerStyle={styles.scrollContentContainer}
          stickyHeaderIndices={[1]}
          showsVerticalScrollIndicator={false}
        >
          {/* Wallet and Delivery Cards - Will scroll away */}
          <View style={styles.scrollableSection}>
            {/* Wallet Credit Section for Guides */}
            {user.is_guide && (
              <View style={styles.commissionSection}>
                <View style={styles.walletHeader}>
                  <Text style={styles.commissionLabel}>💰 Wallet Balance</Text>
                  <Text style={styles.commissionAmount}>
                    ₹{(user.commission_balance || 0).toFixed(2)}
                  </Text>
                </View>
                <View style={styles.walletButtons}>
                  <TouchableOpacity
                    style={styles.historyButton}
                    onPress={() => {
                      fetchCommissionHistory();
                      setShowWalletModal(true);
                    }}
                  >
                    <Ionicons name="time-outline" size={18} color="#6366f1" />
                    <Text style={styles.historyButtonText}>History</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.withdrawButton}
                    onPress={() => setShowWithdrawalModal(true)}
                  >
                    <Ionicons name="cash-outline" size={18} color="#fff" />
                    <Text style={styles.withdrawButtonText}>Withdraw</Text>
                  </TouchableOpacity>
                </View>
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
          </View>

          {/* Sticky Tabs */}
          <View style={styles.stickyTabsWrapper}>
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
          </View>

          {/* Tab Content */}
          <View style={styles.tabContentWrapper}>
            {renderTabContent()}
          </View>
        </ScrollView>
      ) : (
        // Layout for Normal Users: Fixed tabs, only content scrolls
        <>
          {/* Fixed Tabs - Always visible below header */}
          <View style={styles.fixedTabsWrapper}>
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
          </View>

          {/* Scrollable Content Only */}
          <ScrollView 
            style={styles.contentOnlyScrollView}
            contentContainerStyle={styles.scrollContentContainer}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.tabContentWrapper}>
              {renderTabContent()}
            </View>
          </ScrollView>
        </>
      )}

      {/* Address Modal */}
      <Modal visible={showAddressModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{editingAddressIndex !== null ? 'Edit Address' : 'Add New Address'}</Text>
              <TouchableOpacity onPress={() => {
                setShowAddressModal(false);
                setEditingAddressIndex(null);
              }}>
                <Ionicons name="close" size={28} color="#333" />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalBody}>
              <TextInput
                style={styles.input}
                placeholder="Label (e.g., Home, Office) *"
                placeholderTextColor="#999"
                value={newAddressLabel}
                onChangeText={setNewAddressLabel}
              />
              <TextInput
                style={styles.input}
                placeholder="Apartment / Suite / Floor *"
                placeholderTextColor="#999"
                value={newAddressApartment}
                onChangeText={setNewAddressApartment}
              />
              <TextInput
                style={styles.input}
                placeholder="Street Address (optional)"
                placeholderTextColor="#999"
                value={newAddressStreet}
                onChangeText={setNewAddressStreet}
              />
              <TextInput
                style={styles.input}
                placeholder="City *"
                placeholderTextColor="#999"
                value={newAddressCity}
                onChangeText={setNewAddressCity}
              />
              <TextInput
                style={styles.input}
                placeholder="State *"
                placeholderTextColor="#999"
                value={newAddressState}
                onChangeText={setNewAddressState}
              />
              <TextInput
                style={styles.input}
                placeholder="PIN Code *"
                placeholderTextColor="#999"
                value={newAddressZip}
                onChangeText={setNewAddressZip}
                keyboardType="numeric"
              />
              <TextInput
                style={styles.input}
                placeholder="Phone *"
                placeholderTextColor="#999"
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

      {/* Wallet History Modal */}
      <Modal visible={showWalletModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxHeight: '80%' }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Wallet History</Text>
              <TouchableOpacity onPress={() => setShowWalletModal(false)}>
                <Ionicons name="close" size={28} color="#333" />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalBody}>
              {commissionHistory.length === 0 ? (
                <View style={{ padding: 40, alignItems: 'center' }}>
                  <Ionicons name="wallet-outline" size={64} color="#ccc" />
                  <Text style={{ marginTop: 16, color: '#666', textAlign: 'center' }}>
                    No wallet history yet
                  </Text>
                </View>
              ) : (
                commissionHistory.map((item) => {
                  const isWithdrawal = item.display_type === 'withdrawal';
                  return (
                    <View 
                      key={item._id} 
                      style={[
                        styles.historyItem,
                        isWithdrawal && { borderLeftColor: '#ef4444' }
                      ]}
                    >
                      <View style={styles.historyItemHeader}>
                        <Text style={styles.historyGuideeName}>
                          {isWithdrawal ? '💸 Withdrawal' : item.guidee_name}
                        </Text>
                        <Text style={[
                          styles.historyAmount,
                          isWithdrawal && { color: '#ef4444' }
                        ]}>
                          {isWithdrawal ? '-' : '+'}₹{(item.amount || item.commission_amount).toFixed(2)}
                        </Text>
                      </View>
                      {isWithdrawal ? (
                        <View style={styles.historyItemDetails}>
                          <Text style={styles.historyDetail}>TXN: {item.transaction_id}</Text>
                          <Text style={styles.historyDetail}>•</Text>
                          <Text style={styles.historyDetail}>UPI: {item.upi_id}</Text>
                        </View>
                      ) : (
                        <View style={styles.historyItemDetails}>
                          <Text style={styles.historyDetail}>
                            Order: ₹{item.order_amount.toFixed(2)}
                          </Text>
                          <Text style={styles.historyDetail}>•</Text>
                          <Text style={styles.historyDetail}>
                            {item.commission_rate}% commission
                          </Text>
                        </View>
                      )}
                      <Text style={styles.historyDate}>
                        {new Date(item.created_at).toLocaleDateString('en-IN', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </Text>
                    </View>
                  );
                })
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Withdrawal Request Modal */}
      <Modal visible={showWithdrawalModal} animationType="slide" transparent>
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1 }}
        >
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, { maxHeight: '85%' }]}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Request Withdrawal</Text>
                <TouchableOpacity onPress={() => setShowWithdrawalModal(false)}>
                  <Ionicons name="close" size={28} color="#333" />
                </TouchableOpacity>
              </View>
              <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
              <View style={{ padding: 16, backgroundColor: '#eef2ff', borderRadius: 8, marginBottom: 20 }}>
                <Text style={{ fontSize: 12, color: '#4338ca' }}>Available Balance</Text>
                <Text style={{ fontSize: 28, fontWeight: 'bold', color: '#4338ca' }}>
                  ₹{(user?.commission_balance || 0).toFixed(2)}
                </Text>
              </View>
              
              <Text style={{ fontSize: 14, marginBottom: 8, color: '#374151', fontWeight: '600' }}>
                Withdrawal Amount *
              </Text>
              <TextInput
                style={styles.input}
                placeholder="Enter amount"
                keyboardType="numeric"
                value={withdrawalAmount}
                onChangeText={setWithdrawalAmount}
              />
              
              <Text style={{ fontSize: 14, marginBottom: 8, marginTop: 16, color: '#374151', fontWeight: '600' }}>
                UPI ID *
              </Text>
              <TextInput
                style={styles.input}
                placeholder="yourname@upi"
                value={withdrawalUpiId}
                onChangeText={setWithdrawalUpiId}
                autoCapitalize="none"
              />
              
              <Text style={{ fontSize: 14, marginBottom: 8, marginTop: 16, color: '#374151', fontWeight: '600' }}>
                Contact Number *
              </Text>
              <TextInput
                style={styles.input}
                placeholder="10-digit mobile number"
                keyboardType="phone-pad"
                value={withdrawalContact}
                onChangeText={setWithdrawalContact}
                maxLength={10}
              />
              
              <TouchableOpacity
                style={[styles.saveButton, { marginTop: 24, marginBottom: 20, backgroundColor: '#6366f1' }]}
                onPress={validateWithdrawal}
              >
                <Text style={styles.saveButtonText}>Continue</Text>
              </TouchableOpacity>
              </ScrollView>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Confirmation Modal */}
      <Modal visible={showConfirmWithdrawal} animationType="fade" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxWidth: 400 }]}>
            <View style={{ padding: 24, alignItems: 'center' }}>
              <Ionicons name="warning" size={64} color="#f59e0b" />
              <Text style={{ fontSize: 20, fontWeight: 'bold', marginTop: 16, textAlign: 'center' }}>
                Confirm Withdrawal
              </Text>
              <View style={{ marginTop: 20, padding: 16, backgroundColor: '#f9fafb', borderRadius: 8, width: '100%' }}>
                <Text style={{ fontSize: 14, color: '#6b7280', marginBottom: 8 }}>Amount</Text>
                <Text style={{ fontSize: 24, fontWeight: 'bold', color: '#1f2937' }}>₹{withdrawalAmount}</Text>
                <Text style={{ fontSize: 14, color: '#6b7280', marginTop: 12, marginBottom: 4 }}>UPI ID</Text>
                <Text style={{ fontSize: 16, color: '#1f2937' }}>{withdrawalUpiId}</Text>
              </View>
              <View style={{ flexDirection: 'row', gap: 12, marginTop: 24, width: '100%' }}>
                <TouchableOpacity
                  style={{ flex: 1, padding: 14, backgroundColor: '#f3f4f6', borderRadius: 8, alignItems: 'center' }}
                  onPress={() => {
                    setShowConfirmWithdrawal(false);
                    setShowWithdrawalModal(true);
                  }}
                >
                  <Text style={{ fontSize: 16, fontWeight: '600', color: '#6b7280' }}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={{ flex: 1, padding: 14, backgroundColor: '#6366f1', borderRadius: 8, alignItems: 'center' }}
                  onPress={handleWithdrawalRequest}
                >
                  <Text style={{ fontSize: 16, fontWeight: '600', color: '#fff' }}>Confirm</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </Modal>

      {/* Success Modal */}
      <Modal visible={showWithdrawalSuccess} animationType="fade" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxWidth: 400 }]}>
            <View style={{ padding: 24, alignItems: 'center' }}>
              <Ionicons name="checkmark-circle" size={64} color="#10b981" />
              <Text style={{ fontSize: 20, fontWeight: 'bold', marginTop: 16, textAlign: 'center' }}>
                Withdrawal Request Sent!
              </Text>
              <Text style={{ fontSize: 14, color: '#6b7280', marginTop: 8, textAlign: 'center' }}>
                Your withdrawal request has been submitted. You'll be notified once it's processed.
              </Text>
              <TouchableOpacity
                style={{ marginTop: 24, padding: 14, backgroundColor: '#6366f1', borderRadius: 8, width: '100%', alignItems: 'center' }}
                onPress={() => setShowWithdrawalSuccess(false)}
              >
                <Text style={{ fontSize: 16, fontWeight: '600', color: '#fff' }}>Done</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Cancel Order Confirmation Modal */}
      <Modal visible={showCancelOrderConfirm} animationType="fade" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxWidth: 400 }]}>
            <View style={{ padding: 24, alignItems: 'center' }}>
              <Ionicons name="close-circle-outline" size={64} color="#ef4444" />
              <Text style={{ fontSize: 20, fontWeight: 'bold', marginTop: 16, textAlign: 'center' }}>
                Cancel Order
              </Text>
              <Text style={{ fontSize: 14, color: '#6b7280', marginTop: 8, textAlign: 'center' }}>
                Are you sure you want to cancel this order? This action cannot be undone.
              </Text>
              <View style={{ flexDirection: 'row', gap: 12, marginTop: 24, width: '100%' }}>
                <TouchableOpacity
                  style={{ flex: 1, padding: 14, backgroundColor: '#f3f4f6', borderRadius: 8, alignItems: 'center' }}
                  onPress={() => {
                    setShowCancelOrderConfirm(false);
                    setCancelOrderId(null);
                    setTimeout(() => {
                      setShowOrderModal(true); // Reopen order modal
                    }, 300);
                  }}
                >
                  <Text style={{ fontSize: 16, fontWeight: '600', color: '#6b7280' }}>No, Keep Order</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={{ flex: 1, padding: 14, backgroundColor: '#ef4444', borderRadius: 8, alignItems: 'center' }}
                  onPress={async () => {
                    if (cancelOrderId) {
                      await cancelOrder(cancelOrderId);
                    }
                    setShowCancelOrderConfirm(false);
                    setCancelOrderId(null);
                  }}
                >
                  <Text style={{ fontSize: 16, fontWeight: '600', color: '#fff' }}>Yes, Cancel</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </Modal>

      {/* Delete Address Confirmation Modal */}
      <Modal visible={showDeleteConfirm} animationType="fade" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxWidth: 400 }]}>
            <View style={{ padding: 24, alignItems: 'center' }}>
              <Ionicons name="trash-outline" size={64} color="#ef4444" />
              <Text style={{ fontSize: 20, fontWeight: 'bold', marginTop: 16, textAlign: 'center' }}>
                Delete Address
              </Text>
              <Text style={{ fontSize: 14, color: '#6b7280', marginTop: 8, textAlign: 'center' }}>
                Are you sure you want to delete this address? This action cannot be undone.
              </Text>
              <View style={{ flexDirection: 'row', gap: 12, marginTop: 24, width: '100%' }}>
                <TouchableOpacity
                  style={{ flex: 1, padding: 14, backgroundColor: '#f3f4f6', borderRadius: 8, alignItems: 'center' }}
                  onPress={() => {
                    setShowDeleteConfirm(false);
                    setDeleteAddressIndex(null);
                  }}
                >
                  <Text style={{ fontSize: 16, fontWeight: '600', color: '#6b7280' }}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={{ flex: 1, padding: 14, backgroundColor: '#ef4444', borderRadius: 8, alignItems: 'center' }}
                  onPress={() => {
                    if (deleteAddressIndex !== null) {
                      deleteAddress(deleteAddressIndex);
                    }
                    setShowDeleteConfirm(false);
                    setDeleteAddressIndex(null);
                  }}
                >
                  <Text style={{ fontSize: 16, fontWeight: '600', color: '#fff' }}>Delete</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </Modal>

      {/* Logout Confirmation Modal */}
      <Modal visible={showLogoutConfirm} animationType="fade" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxWidth: 400 }]}>
            <View style={{ padding: 24, alignItems: 'center' }}>
              <Ionicons name="log-out-outline" size={64} color="#ef4444" />
              <Text style={{ fontSize: 20, fontWeight: 'bold', marginTop: 16, textAlign: 'center' }}>
                Logout
              </Text>
              <Text style={{ fontSize: 14, color: '#6b7280', marginTop: 8, textAlign: 'center' }}>
                Are you sure you want to logout?
              </Text>
              <View style={{ flexDirection: 'row', gap: 12, marginTop: 24, width: '100%' }}>
                <TouchableOpacity
                  style={{ flex: 1, padding: 14, backgroundColor: '#f3f4f6', borderRadius: 8, alignItems: 'center' }}
                  onPress={() => setShowLogoutConfirm(false)}
                >
                  <Text style={{ fontSize: 16, fontWeight: '600', color: '#6b7280' }}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={{ flex: 1, padding: 14, backgroundColor: '#ef4444', borderRadius: 8, alignItems: 'center' }}
                  onPress={async () => {
                    setShowLogoutConfirm(false);
                    await logout();
                    router.replace('/auth');
                  }}
                >
                  <Text style={{ fontSize: 16, fontWeight: '600', color: '#fff' }}>Logout</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </Modal>

      {/* Order Details Modal */}

      {/* Guide Onboarding Modal */}
      <Modal visible={showGuideModal} animationType="slide" transparent>
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={styles.guideModalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Become a Guide</Text>
              <TouchableOpacity onPress={() => setShowGuideModal(false)}>
                <Ionicons name="close" size={28} color="#333" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              <Text style={styles.guideModalDescription}>
                Share your expertise and help others achieve their health goals. Fill out the form below to apply as a guide.
              </Text>

              <Text style={styles.inputLabel}>Guidance Area *</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Describe your area of expertise (e.g., Nutrition, Fitness, Weight Loss)"
                placeholderTextColor="#999"
                value={guideGuidance}
                onChangeText={setGuideGuidance}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />

              <Text style={styles.inputLabel}>Experience *</Text>
              <TextInput
                style={styles.input}
                placeholder="Years of experience or qualifications"
                placeholderTextColor="#999"
                value={guideExperience}
                onChangeText={setGuideExperience}
              />

              <Text style={styles.inputLabel}>Proof of Qualification *</Text>
              <Text style={styles.fileHint}>Upload certificate or document (Max 5MB, PDF or Image)</Text>
              
              <TouchableOpacity
                style={styles.filePickerButton}
                onPress={pickDocument}
              >
                <Ionicons name="cloud-upload-outline" size={24} color="#6366f1" />
                <Text style={styles.filePickerText}>
                  {guideProofDoc ? guideProofDoc.name : 'Choose File'}
                </Text>
              </TouchableOpacity>

              {guideProofDoc && (
                <View style={styles.selectedFileInfo}>
                  <Ionicons name="document" size={20} color="#4caf50" />
                  <Text style={styles.selectedFileName}>{guideProofDoc.name}</Text>
                  <TouchableOpacity onPress={() => setGuideProofDoc(null)}>
                    <Ionicons name="close-circle" size={20} color="#ef4444" />
                  </TouchableOpacity>
                </View>
              )}
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.submitGuideButton}
                onPress={submitGuideOnboarding}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.submitGuideButtonText}>Submit Application</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={showOrderModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Order Details</Text>
              <TouchableOpacity onPress={() => setShowOrderModal(false)}>
                <Ionicons name="close" size={28} color="#333" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              {selectedOrder && (
                <>
                  {/* Order ID and Status */}
                  <View style={styles.orderDetailSection}>
                    <Text style={styles.orderDetailLabel}>Order ID</Text>
                    <Text style={styles.orderDetailValue}>#{selectedOrder.order_id || selectedOrder._id?.slice(-8)}</Text>
                  </View>

                  <View style={styles.orderDetailSection}>
                    <Text style={styles.orderDetailLabel}>Status</Text>
                    <View style={styles.orderDetailStatusRow}>
                      <Text style={styles.orderDetailValue}>
                        {selectedOrder.status?.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())}
                      </Text>
                    </View>
                  </View>

                  {/* Items */}
                  <View style={styles.orderDetailSection}>
                    <Text style={styles.orderDetailLabel}>Items Ordered</Text>
                    {selectedOrder.items?.map((item: any, index: number) => (
                      <View key={index} style={styles.orderDetailItem}>
                        <Text style={styles.orderDetailItemName}>{item.meal_name}</Text>
                        <Text style={styles.orderDetailItemQuantity}>x {item.quantity}</Text>
                        <Text style={styles.orderDetailItemPrice}>₹{(item.price * item.quantity).toFixed(2)}</Text>
                      </View>
                    ))}
                  </View>

                  {/* Payment Method */}
                  <View style={styles.orderDetailSection}>
                    <Text style={styles.orderDetailLabel}>Payment Method</Text>
                    <View style={styles.orderPaymentRow}>
                      <Ionicons 
                        name={selectedOrder.payment_method === 'online' ? "card" : "cash"} 
                        size={16} 
                        color="#666" 
                      />
                      <Text style={styles.orderDetailValue}>
                        {selectedOrder.payment_method === 'online' ? 'Online' : 'Pay on Delivery'}
                      </Text>
                    </View>
                  </View>

                  {/* Delivery Address */}
                  <View style={styles.orderDetailSection}>
                    <Text style={styles.orderDetailLabel}>Delivery Address</Text>
                    <Text style={styles.orderDetailValue}>
                      {selectedOrder.shipping_address?.street}
                      {selectedOrder.shipping_address?.apartment && `, ${selectedOrder.shipping_address.apartment}`}
                      {'\n'}{selectedOrder.shipping_address?.city}, {selectedOrder.shipping_address?.state} - {selectedOrder.shipping_address?.zip_code}
                      {'\n'}☎ {selectedOrder.shipping_address?.phone}
                    </Text>
                  </View>

                  {/* Total */}
                  <View style={[styles.orderDetailSection, styles.orderDetailTotal]}>
                    <Text style={styles.orderDetailTotalLabel}>Total Amount</Text>
                    <Text style={styles.orderDetailTotalValue}>₹{selectedOrder.final_price?.toFixed(2)}</Text>
                  </View>

                  {/* Cancel Button - only show if status is 'arrived' */}
                  {selectedOrder.status === 'arrived' && (
                    <TouchableOpacity
                      style={styles.cancelOrderButton}
                      onPress={() => {
                        setCancelOrderId(selectedOrder._id);
                        setShowOrderModal(false); // Close order modal first
                        setTimeout(() => {
                          setShowCancelOrderConfirm(true); // Then show cancel confirmation
                        }, 300);
                      }}
                    >
                      <Ionicons name="close-circle" size={20} color="#fff" />
                      <Text style={styles.cancelOrderButtonText}>Cancel Order</Text>
                    </TouchableOpacity>
                  )}
                </>
              )}
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
    backgroundColor: '#fff',
  },
  fixedHeader: {
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    zIndex: 1000,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
  },
  mainScrollView: {
    flex: 1,
  },
  scrollContentContainer: {
    flexGrow: 1,
    paddingBottom: 100,
  },
  stickyTabsWrapper: {
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    zIndex: 100,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
  },
  fixedTabsWrapper: {
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    zIndex: 100,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
  },
  contentOnlyScrollView: {
    flex: 1,
  },
  scrollableSection: {
    backgroundColor: '#f5f5f5',
    minHeight: 200,
  },
  tabContentWrapper: {
    flex: 1,
    backgroundColor: '#fff',
    minHeight: 600,
    paddingBottom: 20,
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
    padding: 20,
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 8,
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    shadowColor: '#6366f1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  walletHeader: {
    alignItems: 'center',
    marginBottom: 20,
  },
  commissionLabel: {
    fontSize: 16,
    color: '#6366f1',
    marginBottom: 8,
    fontWeight: '600',
  },
  commissionAmount: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#4338ca',
  },
  walletButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  historyButton: {
    flex: 1,
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#6366f1',
    paddingVertical: 12,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  historyButtonText: {
    color: '#6366f1',
    fontSize: 14,
    fontWeight: '600',
  },
  withdrawButton: {
    flex: 1,
    backgroundColor: '#6366f1',
    paddingVertical: 12,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  withdrawButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  historyItem: {
    backgroundColor: '#f9fafb',
    padding: 16,
    borderRadius: 8,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#10b981',
  },
  historyItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  historyGuideeName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
  },
  historyAmount: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#10b981',
  },
  historyItemDetails: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 4,
  },
  historyDetail: {
    fontSize: 13,
    color: '#6b7280',
  },
  historyDate: {
    fontSize: 12,
    color: '#9ca3af',
    marginTop: 4,
  },
  deliveryModeButton: {
    backgroundColor: '#4caf50',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    margin: 16,
    borderRadius: 12,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  deliveryModeText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    flex: 1,
    marginLeft: 12,
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
    paddingBottom: 100,
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
    padding: 16,
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
  addressActions: {
    flexDirection: 'row',
    gap: 12,
  },
  addressActionButton: {
    padding: 4,
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
  ordersContainer: {
    flex: 1,
    padding: 16,
  },
  orderCard: {
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
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  orderIdText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  orderStatusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
  },
  orderStatusText: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  orderItemCount: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  orderFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  orderPrice: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  orderDate: {
    fontSize: 12,
    color: '#999',
  },
  orderPaymentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  orderPaymentText: {
    fontSize: 12,
    color: '#666',
  },
  orderDetailSection: {
    marginBottom: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  orderDetailLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#999',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  orderDetailValue: {
    fontSize: 15,
    color: '#333',
    lineHeight: 22,
  },
  orderDetailStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  orderDetailItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f5f5f5',
  },
  orderDetailItemName: {
    flex: 1,
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  orderDetailItemQuantity: {
    fontSize: 14,
    color: '#666',
    marginHorizontal: 12,
  },
  orderDetailItemPrice: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  orderDetailTotal: {
    borderBottomWidth: 0,
    backgroundColor: '#f9f9f9',
    padding: 16,
    borderRadius: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  orderDetailTotalLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  orderDetailTotalValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#ffd700',
  },
  cancelOrderButton: {
    backgroundColor: '#ef4444',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 8,
    marginTop: 16,
  },
  cancelOrderButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  beGuideButton: {
    padding: 8,
  },
  guideModalContent: {
    backgroundColor: '#fff',
    borderRadius: 20,
    width: '95%',
    maxWidth: 500,
    maxHeight: '90%',
  },
  guideModalDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 20,
    lineHeight: 20,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  fileHint: {
    fontSize: 12,
    color: '#999',
    marginBottom: 12,
  },
  filePickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    padding: 16,
    backgroundColor: '#f0f0ff',
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#6366f1',
    borderStyle: 'dashed',
  },
  filePickerText: {
    fontSize: 14,
    color: '#6366f1',
    fontWeight: '500',
  },
  selectedFileInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    backgroundColor: '#f0fff4',
    borderRadius: 8,
    marginTop: 12,
  },
  selectedFileName: {
    flex: 1,
    fontSize: 14,
    color: '#333',
  },
  submitGuideButton: {
    backgroundColor: '#ffd700',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  submitGuideButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
  },
});
