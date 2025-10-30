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
  full_address: string;
  city: string;
  state: string;
  pincode: string;
  phone: string;
  is_default: boolean;
}

export default function ProfileScreen() {
  const { user, signOut } = useAuth();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'posts' | 'guides' | 'guidees' | 'idols' | 'fans'>('posts');
  const [loading, setLoading] = useState(false);
  const [posts, setPosts] = useState<any[]>([]);
  const [guides, setGuides] = useState<any[]>([]);
  const [guidees, setGuidees] = useState<any[]>([]);
  const [idols, setIdols] = useState<any[]>([]);
  const [fans, setFans] = useState<any[]>([]);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [withdrawalRequests, setWithdrawalRequests] = useState<any[]>([]);
  
  // Address modal
  const [showAddressModal, setShowAddressModal] = useState(false);
  const [newAddressLabel, setNewAddressLabel] = useState('');
  const [newAddressStreet, setNewAddressStreet] = useState('');
  const [newAddressCity, setNewAddressCity] = useState('');
  const [newAddressState, setNewAddressState] = useState('');
  const [newAddressZip, setNewAddressZip] = useState('');
  const [newAddressPhone, setNewAddressPhone] = useState('');

  // Withdrawal modal
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [requesting, setRequesting] = useState(false);

  useEffect(() => {
    if (user) {
      fetchProfileData();
      fetchAddresses();
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

      // Fetch idols
      if (data.idols && data.idols.length > 0) {
        const idolPromises = data.idols.map((id: string) =>
          axios.get(`${API_URL}/users/${id}`, {
            headers: { Authorization: `Bearer ${token}` },
          })
        );
        const idolResponses = await Promise.all(idolPromises);
        setIdols(idolResponses.map(r => r.data));
      }

      // Fetch fans
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
      const token = await storage.getItemAsync('session_token');
      const response = await axios.get(`${API_URL}/posts`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      // Filter user's posts
      const userPosts = response.data.filter((post: any) => post.user_id === user?._id);
      setPosts(userPosts);
    } catch (error) {
      console.error('Error fetching posts:', error);
    }
  };

  const fetchAddresses = async () => {
    try {
      const token = await storage.getItemAsync('session_token');
      const response = await axios.get(`${API_URL}/addresses`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setAddresses(response.data);
    } catch (error) {
      console.error('Error fetching addresses:', error);
    }
  };

  const fetchWithdrawals = async () => {
    try {
      const token = await storage.getItemAsync('session_token');
      const response = await axios.get(`${API_URL}/withdrawals`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setWithdrawalRequests(response.data);
    } catch (error) {
      console.error('Error fetching withdrawals:', error);
    }
  };

  const saveNewAddress = async () => {
    if (!newAddressLabel || !newAddressStreet || !newAddressCity || !newAddressState || !newAddressZip || !newAddressPhone) {
      Alert.alert('Error', 'Please fill all address fields');
      return;
    }

    try {
      const token = await storage.getItemAsync('session_token');
      await axios.post(
        `${API_URL}/addresses`,
        {
          label: newAddressLabel,
          full_address: newAddressStreet,
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
      setNewAddressStreet('');
      setNewAddressCity('');
      setNewAddressState('');
      setNewAddressZip('');
      setNewAddressPhone('');
    } catch (error) {
      console.error('Error saving address:', error);
      Alert.alert('Error', 'Failed to save address');
    }
  };

  const deleteAddress = async (index: number) => {
    try {
      const token = await storage.getItemAsync('session_token');
      await axios.delete(`${API_URL}/addresses/${index}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      Alert.alert('Success', 'Address deleted');
      await fetchAddresses();
    } catch (error) {
      console.error('Error deleting address:', error);
      Alert.alert('Error', 'Failed to delete address');
    }
  };

  const setDefaultAddress = async (index: number) => {
    try {
      const token = await storage.getItemAsync('session_token');
      await axios.put(
        `${API_URL}/addresses/${index}/default`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      await fetchAddresses();
    } catch (error) {
      console.error('Error setting default address:', error);
    }
  };

  const requestWithdrawal = async () => {
    const amount = parseFloat(withdrawAmount);
    
    if (!amount || amount <= 0) {
      Alert.alert('Error', 'Please enter a valid amount');
      return;
    }

    if (amount > (user?.commission_balance || 0)) {
      Alert.alert('Error', 'Insufficient balance');
      return;
    }

    try {
      setRequesting(true);
      const token = await storage.getItemAsync('session_token');
      await axios.post(
        `${API_URL}/withdrawals`,
        { amount },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      Alert.alert('Success', 'Withdrawal request submitted successfully');
      setShowWithdrawModal(false);
      setWithdrawAmount('');
      await fetchWithdrawals();
    } catch (error: any) {
      console.error('Error requesting withdrawal:', error);
      Alert.alert('Error', error.response?.data?.detail || 'Failed to submit withdrawal request');
    } finally {
      setRequesting(false);
    }
  };

  const renderPost = ({ item }: { item: any }) => (
    <View style={styles.postCard}>
      <Text style={styles.postContent}>{item.content}</Text>
      {item.images && item.images.length > 0 && (
        <Image source={{ uri: item.images[0] }} style={styles.postImage} />
      )}
      <View style={styles.postStats}>
        <View style={styles.statItem}>
          <Ionicons name="heart" size={16} color="#ef4444" />
          <Text style={styles.statText}>{item.likes?.length || 0}</Text>
        </View>
        <View style={styles.statItem}>
          <Ionicons name="chatbubble" size={16} color="#3b82f6" />
          <Text style={styles.statText}>{item.comments_count || 0}</Text>
        </View>
      </View>
    </View>
  );

  const renderUser = ({ item }: { item: any }) => (
    <TouchableOpacity
      style={styles.userCard}
      onPress={() => router.push(`/user/${item._id}`)}
    >
      {item.picture ? (
        <Image source={{ uri: item.picture }} style={styles.userAvatar} />
      ) : (
        <View style={styles.userAvatarPlaceholder}>
          <Text style={styles.userAvatarText}>{item.name?.charAt(0).toUpperCase()}</Text>
        </View>
      )}
      <View style={styles.userInfo}>
        <Text style={styles.userName}>{item.name}</Text>
        <Text style={styles.userEmail}>{item.email}</Text>
        {item.star_rating > 0 && (
          <Text style={styles.userRating}>{item.star_rating}⭐</Text>
        )}
      </View>
      <Ionicons name="chevron-forward" size={24} color="#999" />
    </TouchableOpacity>
  );

  const renderTabContent = () => {
    switch (activeTab) {
      case 'posts':
        return (
          <FlatList
            data={posts}
            renderItem={renderPost}
            keyExtractor={(item) => item._id}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <Ionicons name="document-text-outline" size={64} color="#ccc" />
                <Text style={styles.emptyText}>No posts yet</Text>
              </View>
            }
          />
        );
      case 'guides':
        return (
          <FlatList
            data={guides}
            renderItem={renderUser}
            keyExtractor={(item) => item._id}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <Ionicons name="people-outline" size={64} color="#ccc" />
                <Text style={styles.emptyText}>No guides yet</Text>
              </View>
            }
          />
        );
      case 'guidees':
        return (
          <FlatList
            data={guidees}
            renderItem={renderUser}
            keyExtractor={(item) => item._id}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <Ionicons name="people-outline" size={64} color="#ccc" />
                <Text style={styles.emptyText}>No guidees yet</Text>
              </View>
            }
          />
        );
      case 'idols':
        return (
          <FlatList
            data={idols}
            renderItem={renderUser}
            keyExtractor={(item) => item._id}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <Ionicons name="star-outline" size={64} color="#ccc" />
                <Text style={styles.emptyText}>Not following anyone</Text>
              </View>
            }
          />
        );
      case 'fans':
        return (
          <FlatList
            data={fans}
            renderItem={renderUser}
            keyExtractor={(item) => item._id}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <Ionicons name="heart-outline" size={64} color="#ccc" />
                <Text style={styles.emptyText}>No followers yet</Text>
              </View>
            }
          />
        );
    }
  };

  if (!user) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#ffd700" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView>
        {/* Profile Header */}
        <View style={styles.profileHeader}>
          {user.picture ? (
            <Image source={{ uri: user.picture }} style={styles.profileImage} />
          ) : (
            <View style={styles.profileImagePlaceholder}>
              <Text style={styles.profileImageText}>{user.name?.charAt(0).toUpperCase()}</Text>
            </View>
          )}
          <Text style={styles.profileName}>{user.name}</Text>
          <Text style={styles.profileEmail}>{user.email}</Text>
          {user.star_rating > 0 && (
            <Text style={styles.starRating}>{user.star_rating}⭐</Text>
          )}
          <TouchableOpacity style={styles.signOutButton} onPress={signOut}>
            <Ionicons name="log-out-outline" size={20} color="#ef4444" />
            <Text style={styles.signOutText}>Sign Out</Text>
          </TouchableOpacity>
        </View>

        {/* Commission Card (Guides Only) */}
        {user.is_guide && (
          <View style={styles.commissionCard}>
            <View style={styles.commissionHeader}>
              <Text style={styles.commissionTitle}>Commission Balance</Text>
              <TouchableOpacity
                style={styles.withdrawButton}
                onPress={() => setShowWithdrawModal(true)}
              >
                <Ionicons name="cash-outline" size={20} color="#fff" />
                <Text style={styles.withdrawButtonText}>Withdraw</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.commissionAmount}>
              ₹{(user.commission_balance || 0).toFixed(2)}
            </Text>
            
            {withdrawalRequests.length > 0 && (
              <View style={styles.withdrawalsList}>
                <Text style={styles.withdrawalsTitle}>Recent Requests</Text>
                {withdrawalRequests.slice(0, 3).map((req: any) => (
                  <View key={req._id} style={styles.withdrawalItem}>
                    <View>
                      <Text style={styles.withdrawalAmount}>₹{req.amount.toFixed(2)}</Text>
                      <Text style={styles.withdrawalDate}>
                        {new Date(req.created_at).toLocaleDateString()}
                      </Text>
                    </View>
                    <View
                      style={[
                        styles.statusBadge,
                        req.status === 'approved' && styles.statusApproved,
                        req.status === 'rejected' && styles.statusRejected,
                      ]}
                    >
                      <Text style={styles.statusText}>{req.status}</Text>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </View>
        )}

        {/* Horizontal Tabs */}
        <View style={styles.tabsContainer}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <TouchableOpacity
              style={[styles.tab, activeTab === 'posts' && styles.activeTab]}
              onPress={() => setActiveTab('posts')}
            >
              <Ionicons
                name="document-text"
                size={20}
                color={activeTab === 'posts' ? '#ffd700' : '#666'}
              />
              <Text style={[styles.tabText, activeTab === 'posts' && styles.activeTabText]}>
                Posts ({posts.length})
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.tab, activeTab === 'guides' && styles.activeTab]}
              onPress={() => setActiveTab('guides')}
            >
              <Ionicons
                name="people"
                size={20}
                color={activeTab === 'guides' ? '#ffd700' : '#666'}
              />
              <Text style={[styles.tabText, activeTab === 'guides' && styles.activeTabText]}>
                Guides ({guides.length})
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.tab, activeTab === 'guidees' && styles.activeTab]}
              onPress={() => setActiveTab('guidees')}
            >
              <Ionicons
                name="school"
                size={20}
                color={activeTab === 'guidees' ? '#ffd700' : '#666'}
              />
              <Text style={[styles.tabText, activeTab === 'guidees' && styles.activeTabText]}>
                Guidees ({guidees.length})
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.tab, activeTab === 'idols' && styles.activeTab]}
              onPress={() => setActiveTab('idols')}
            >
              <Ionicons
                name="star"
                size={20}
                color={activeTab === 'idols' ? '#ffd700' : '#666'}
              />
              <Text style={[styles.tabText, activeTab === 'idols' && styles.activeTabText]}>
                Idols ({idols.length})
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.tab, activeTab === 'fans' && styles.activeTab]}
              onPress={() => setActiveTab('fans')}
            >
              <Ionicons
                name="heart"
                size={20}
                color={activeTab === 'fans' ? '#ffd700' : '#666'}
              />
              <Text style={[styles.tabText, activeTab === 'fans' && styles.activeTabText]}>
                Fans ({fans.length})
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </View>

        {/* Tab Content */}
        <View style={styles.tabContent}>{renderTabContent()}</View>

        {/* Saved Addresses Section */}
        <View style={styles.addressesSection}>
          <View style={styles.addressesHeader}>
            <Text style={styles.sectionTitle}>Saved Addresses</Text>
            <TouchableOpacity
              style={styles.addButton}
              onPress={() => setShowAddressModal(true)}
            >
              <Ionicons name="add-circle" size={24} color="#ffd700" />
              <Text style={styles.addButtonText}>Add New</Text>
            </TouchableOpacity>
          </View>

          {addresses.length > 0 ? (
            addresses.map((addr, index) => (
              <View key={index} style={styles.addressCard}>
                <View style={styles.addressHeader}>
                  <Text style={styles.addressLabel}>{addr.label}</Text>
                  {addr.is_default && (
                    <View style={styles.defaultBadge}>
                      <Text style={styles.defaultText}>Default</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.addressText}>{addr.full_address}</Text>
                <Text style={styles.addressText}>
                  {addr.city}, {addr.state} - {addr.pincode}
                </Text>
                <Text style={styles.addressText}>☎ {addr.phone}</Text>
                <View style={styles.addressActions}>
                  {!addr.is_default && (
                    <TouchableOpacity
                      style={styles.actionButton}
                      onPress={() => setDefaultAddress(index)}
                    >
                      <Text style={styles.actionButtonText}>Set as Default</Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity
                    style={[styles.actionButton, styles.deleteButton]}
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
                    <Text style={styles.deleteButtonText}>Delete</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))
          ) : (
            <View style={styles.emptyState}>
              <Ionicons name="location-outline" size={64} color="#ccc" />
              <Text style={styles.emptyText}>No saved addresses</Text>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Add Address Modal */}
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
              <Text style={styles.balanceText}>
                Available Balance: ₹{(user.commission_balance || 0).toFixed(2)}
              </Text>
              <TextInput
                style={styles.input}
                placeholder="Enter amount to withdraw"
                value={withdrawAmount}
                onChangeText={setWithdrawAmount}
                keyboardType="decimal-pad"
              />
              <Text style={styles.noteText}>
                Note: Withdrawal requests will be processed manually by admin.
              </Text>
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileHeader: {
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
    marginBottom: 12,
  },
  profileImagePlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#ffd700',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  profileImageText: {
    fontSize: 40,
    fontWeight: 'bold',
    color: '#fff',
  },
  profileName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  profileEmail: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  starRating: {
    fontSize: 20,
    marginBottom: 12,
  },
  signOutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ef4444',
  },
  signOutText: {
    color: '#ef4444',
    fontWeight: '600',
  },
  commissionCard: {
    backgroundColor: '#eff6ff',
    margin: 16,
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#3b82f6',
  },
  commissionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  commissionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e40af',
  },
  withdrawButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#3b82f6',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
  },
  withdrawButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  commissionAmount: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#1e40af',
    marginBottom: 16,
  },
  withdrawalsList: {
    borderTopWidth: 1,
    borderTopColor: '#93c5fd',
    paddingTop: 12,
  },
  withdrawalsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1e40af',
    marginBottom: 8,
  },
  withdrawalItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  withdrawalAmount: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e40af',
  },
  withdrawalDate: {
    fontSize: 12,
    color: '#64748b',
  },
  statusBadge: {
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: '#fbbf24',
  },
  statusApproved: {
    backgroundColor: '#10b981',
  },
  statusRejected: {
    backgroundColor: '#ef4444',
  },
  statusText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  tabsContainer: {
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  activeTab: {
    borderBottomColor: '#ffd700',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  activeTabText: {
    color: '#ffd700',
  },
  tabContent: {
    minHeight: 300,
  },
  postCard: {
    backgroundColor: '#fff',
    padding: 16,
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 12,
  },
  postContent: {
    fontSize: 14,
    color: '#333',
    marginBottom: 12,
  },
  postImage: {
    width: '100%',
    height: 200,
    borderRadius: 8,
    marginBottom: 12,
  },
  postStats: {
    flexDirection: 'row',
    gap: 16,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statText: {
    fontSize: 14,
    color: '#666',
  },
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 16,
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 12,
  },
  userAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 12,
  },
  userAvatarPlaceholder: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#ffd700',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  userAvatarText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  userEmail: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  userRating: {
    fontSize: 14,
    marginTop: 4,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 16,
    color: '#999',
    marginTop: 12,
  },
  addressesSection: {
    padding: 16,
    paddingBottom: 100,
  },
  addressesHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  addButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffd700',
  },
  addressCard: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
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
  defaultBadge: {
    backgroundColor: '#10b981',
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderRadius: 12,
  },
  defaultText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  addressText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  addressActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
  },
  actionButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#ffd700',
  },
  actionButtonText: {
    color: '#ffd700',
    fontSize: 14,
    fontWeight: '600',
  },
  deleteButton: {
    borderColor: '#ef4444',
  },
  deleteButtonText: {
    color: '#ef4444',
    fontSize: 14,
    fontWeight: '600',
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
    maxHeight: '80%',
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
  balanceText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e40af',
    marginBottom: 16,
  },
  noteText: {
    fontSize: 12,
    color: '#666',
    fontStyle: 'italic',
    marginTop: 8,
  },
  modalFooter: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#eee',
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
});
