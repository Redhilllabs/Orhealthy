import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Alert,
  ActivityIndicator,
  Image,
  Switch,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '@/src/context/AuthContext';
import { storage } from '@/src/utils/storage';
import Constants from 'expo-constants';

// Use process.env instead of Constants for web
const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL || Constants.expoConfig?.extra?.EXPO_PUBLIC_BACKEND_URL;

interface Order {
  _id: string;
  order_id: string;
  items: any[];
  final_price: number;
  status: string;
  shipping_address: any;
  created_at: string;
  user_email?: string;
}

interface CreditRecord {
  _id: string;
  order_id: string;
  amount: number;
  created_at: string;
}

interface DeliveryAgent {
  _id: string;
  name: string;
  email: string;
  image?: string;
  vehicle: string;
  vehicle_number: string;
  contact_number?: string;
  status: string;
  payment_per_delivery: number;
  wallet_balance: number;
}

export default function DeliveryModeScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [agentData, setAgentData] = useState<DeliveryAgent | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [credits, setCredits] = useState<CreditRecord[]>([]);
  const [activeTab, setActiveTab] = useState<'assigned' | 'delivered' | 'history'>('assigned');
  const [isBusy, setIsBusy] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      console.log('Loading delivery agent data...');
      console.log('User email:', user?.email);
      console.log('Backend URL:', BACKEND_URL);
      
      // Get session token
      const token = await storage.getItemAsync('session_token');
      
      // Check if user is delivery agent
      const checkResponse = await fetch(`${BACKEND_URL}/api/delivery-agents/check`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      
      console.log('Check response status:', checkResponse.status);
      const checkData = await checkResponse.json();
      console.log('Check data:', JSON.stringify(checkData, null, 2));
      
      if (!checkData.is_delivery_agent) {
        Alert.alert('Error', 'You are not registered as a delivery agent');
        router.back();
        return;
      }
      
      console.log('Agent data received:', checkData.agent);
      setAgentData(checkData.agent);
      setIsBusy(checkData.agent?.status === 'busy');
      
      // Auto-set to available if not already set
      if (!checkData.agent?.status || checkData.agent.status === 'offline') {
        console.log('Setting agent to available...');
        await updateStatus('available');
        setIsBusy(false);
      }
      
      // Load orders
      const ordersResponse = await fetch(`${BACKEND_URL}/api/delivery-agents/my-orders`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      const ordersData = await ordersResponse.json();
      console.log('Orders loaded:', ordersData.length);
      setOrders(ordersData);
      
      // Load credits
      const creditsResponse = await fetch(`${BACKEND_URL}/api/delivery-agents/credits`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      const creditsData = await creditsResponse.json();
      console.log('Credits loaded:', creditsData.credits?.length);
      setCredits(creditsData.credits || []);
      
      // Update agent data with latest wallet balance
      if (creditsData.total_balance !== undefined) {
        setAgentData(prev => prev ? {...prev, wallet_balance: creditsData.total_balance} : null);
      }
      
    } catch (error) {
      console.error('Error loading delivery data:', error);
      Alert.alert('Error', 'Failed to load delivery data: ' + error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const updateStatus = async (newStatus: string) => {
    if (!agentData) return;
    
    try {
      const token = await storage.getItemAsync('session_token');
      const response = await fetch(`${BACKEND_URL}/api/delivery-agents/${agentData._id}/status`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: newStatus }),
      });
      
      if (response.ok) {
        setAgentData(prev => prev ? {...prev, status: newStatus} : null);
      } else {
        Alert.alert('Error', 'Failed to update status');
      }
    } catch (error) {
      console.error('Error updating status:', error);
      Alert.alert('Error', 'Failed to update status');
    }
  };

  const toggleBusyStatus = async (value: boolean) => {
    setIsBusy(value);
    await updateStatus(value ? 'busy' : 'available');
  };

  const markAsDelivered = async (orderId: string) => {
    try {
      const token = await storage.getItemAsync('session_token');
      const response = await fetch(`${BACKEND_URL}/api/orders/${orderId}/status`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: 'delivered' }),
      });
      
      if (response.ok) {
        Alert.alert('Success', 'Order marked as delivered!');
        loadData(); // Reload to update wallet balance
      } else {
        Alert.alert('Error', 'Failed to mark order as delivered');
      }
    } catch (error) {
      console.error('Error marking order as delivered:', error);
      Alert.alert('Error', 'Failed to mark order as delivered');
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const switchToUserMode = async () => {
    // Set status to offline before switching back
    if (agentData) {
      await updateStatus('offline');
    }
    router.back();
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#ffd700" />
      </View>
    );
  }

  if (!agentData) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.errorText}>No agent data available</Text>
        <TouchableOpacity style={styles.retryButton} onPress={loadData}>
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const activeOrders = orders.filter((o: Order) => o.status === 'out_for_delivery');
  const deliveredOrders = orders.filter((o: Order) => o.status === 'delivered');

  // Get initials for avatar placeholder
  const getInitials = (name: string) => {
    if (!name) return 'DA';
    const parts = name.split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View style={styles.headerLeft}>
            {agentData.image ? (
              <Image source={{ uri: agentData.image }} style={styles.profileImage} />
            ) : (
              <View style={styles.profilePlaceholder}>
                <Text style={styles.profilePlaceholderText}>
                  {getInitials(agentData.name)}
                </Text>
              </View>
            )}
            <View style={styles.headerInfo}>
              <Text style={styles.agentName}>{agentData.name || 'Delivery Agent'}</Text>
              <Text style={styles.vehicleInfo}>
                {agentData.vehicle ? `${agentData.vehicle.charAt(0).toUpperCase()}${agentData.vehicle.slice(1)}` : 'Vehicle'} • {agentData.vehicle_number || 'N/A'}
              </Text>
            </View>
          </View>
          <TouchableOpacity style={styles.exitButton} onPress={switchToUserMode}>
            <Ionicons name="log-out-outline" size={24} color="#fff" />
          </TouchableOpacity>
        </View>
        
        {/* Status Toggle */}
        <View style={styles.statusToggleContainer}>
          <View style={styles.statusToggle}>
            <Text style={[styles.statusLabel, !isBusy && styles.statusLabelActive]}>Available</Text>
            <Switch
              value={isBusy}
              onValueChange={toggleBusyStatus}
              trackColor={{ false: '#4caf50', true: '#ff9800' }}
              thumbColor="#fff"
              ios_backgroundColor="#4caf50"
            />
            <Text style={[styles.statusLabel, isBusy && styles.statusLabelActive]}>Busy</Text>
          </View>
        </View>
        
        {/* Wallet Balance - Thin Card */}
        <View style={styles.walletCardThin}>
          <Text style={styles.walletLabelThin}>Wallet:</Text>
          <Text style={styles.walletAmountThin}>₹{agentData.wallet_balance || 0}</Text>
          <Text style={styles.walletInfoThin}>(₹{agentData.payment_per_delivery || 0}/delivery)</Text>
        </View>
      </View>

      {/* Tabs */}
      <View style={styles.tabContainer}>
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'assigned' && styles.tabActive]}
          onPress={() => setActiveTab('assigned')}
        >
          <Text style={[styles.tabText, activeTab === 'assigned' && styles.tabTextActive]}>
            Assigned ({activeOrders.length})
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'delivered' && styles.tabActive]}
          onPress={() => setActiveTab('delivered')}
        >
          <Text style={[styles.tabText, activeTab === 'delivered' && styles.tabTextActive]}>
            Delivered ({deliveredOrders.length})
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'history' && styles.tabActive]}
          onPress={() => setActiveTab('history')}
        >
          <Text style={[styles.tabText, activeTab === 'history' && styles.tabTextActive]}>
            History
          </Text>
        </TouchableOpacity>
      </View>

      {/* Content */}
      <ScrollView 
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#ffd700']} />
        }
      >
        {activeTab === 'assigned' ? (
          <View>
            {activeOrders.length > 0 ? (
              activeOrders.map((order: Order) => (
                <View key={order._id} style={styles.orderCard}>
                  <View style={styles.orderHeader}>
                    <Text style={styles.orderIdgreen}>#{order.order_id}</Text>
                    <Text style={styles.orderPrice}>₹{order.final_price}</Text>
                  </View>
                  
                  <Text style={styles.orderItems}>
                    {order.items?.length || 0} item(s)
                  </Text>
                  
                  <View style={styles.addressSection}>
                    <Text style={styles.addressLabel}>Delivery Address:</Text>
                    <Text style={styles.addressText}>
                      {order.shipping_address?.street}, {order.shipping_address?.apartment && `${order.shipping_address.apartment}, `}
                      {order.shipping_address?.city}, {order.shipping_address?.state} {order.shipping_address?.zip}
                    </Text>
                  </View>
                  
                  <TouchableOpacity 
                    style={styles.deliveredButton}
                    onPress={() => markAsDelivered(order._id)}
                  >
                    <Text style={styles.deliveredButtonText}>Mark as Delivered</Text>
                  </TouchableOpacity>
                </View>
              ))
            ) : (
              <View style={styles.emptyState}>
                <Text style={styles.emptyText}>No assigned orders</Text>
              </View>
            )}
          </View>
        ) : activeTab === 'delivered' ? (
          <View>
            {deliveredOrders.length > 0 ? (
              deliveredOrders.map((order: Order) => (
                <View key={order._id} style={[styles.orderCard, styles.deliveredCard]}>
                  <View style={styles.orderHeader}>
                    <Text style={styles.orderIdgray}>#{order.order_id}</Text>
                    <Text style={styles.orderPricegray}>₹{order.final_price}</Text>
                  </View>
                  <Text style={styles.deliveredLabel}>✓ Delivered</Text>
                  <Text style={styles.orderDate}>
                    {new Date(order.created_at).toLocaleDateString()}
                  </Text>
                </View>
              ))
            ) : (
              <View style={styles.emptyState}>
                <Text style={styles.emptyText}>No delivered orders yet</Text>
              </View>
            )}
          </View>
        ) : (
          <View>
            {credits.length > 0 ? (
              credits.map((credit: CreditRecord) => (
                <View key={credit._id} style={styles.creditCard}>
                  <View style={styles.creditHeader}>
                    <Text style={styles.creditAmount}>+₹{credit.amount}</Text>
                    <Text style={styles.creditDate}>
                      {new Date(credit.created_at).toLocaleDateString()}
                    </Text>
                  </View>
                  <Text style={styles.creditOrder}>Order ID: {credit.order_id}</Text>
                </View>
              ))
            ) : (
              <View style={styles.emptyState}>
                <Text style={styles.emptyText}>No credit history yet</Text>
              </View>
            )}
          </View>
        )}
      </ScrollView>
    </View>
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
    backgroundColor: '#f5f5f5',
  },
  errorText: {
    fontSize: 16,
    color: '#999',
    marginBottom: 20,
  },
  retryButton: {
    backgroundColor: '#ffd700',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#333',
    fontSize: 16,
    fontWeight: 'bold',
  },
  header: {
    backgroundColor: '#ffd700',
    padding: 20,
    paddingTop: 50,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  profileImage: {
    width: 50,
    height: 50,
    borderRadius: 25,
    borderWidth: 2,
    borderColor: '#333',
  },
  profilePlaceholder: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#333',
    justifyContent: 'center',
    alignItems: 'center',
  },
  profilePlaceholderText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#ffd700',
  },
  headerInfo: {
    justifyContent: 'center',
  },
  agentName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  vehicleInfo: {
    fontSize: 13,
    color: '#666',
    marginTop: 2,
  },
  exitButton: {
    backgroundColor: '#333',
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statusToggleContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  statusToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 24,
    gap: 12,
  },
  statusLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#999',
  },
  statusLabelActive: {
    color: '#333',
  },
  walletCardThin: {
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  walletLabelThin: {
    fontSize: 14,
    color: '#666',
    fontWeight: '600',
  },
  walletAmountThin: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  walletInfoThin: {
    fontSize: 12,
    color: '#999',
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  tab: {
    flex: 1,
    paddingVertical: 16,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: {
    borderBottomColor: '#ffd700',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#999',
  },
  tabTextActive: {
    color: '#ffd700',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  orderCard: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  deliveredCard: {
    backgroundColor: '#f9f9f9',
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  orderIdgreen: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#4caf50',
  },
  orderIdgray: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#999',
  },
  orderPrice: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  orderPricegray: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#999',
  },
  orderItems: {
    fontSize: 14,
    color: '#666',
    marginBottom: 12,
  },
  addressSection: {
    backgroundColor: '#f9f9f9',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  addressLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
    marginBottom: 4,
  },
  addressText: {
    fontSize: 14,
    color: '#333',
  },
  deliveredButton: {
    backgroundColor: '#4caf50',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  deliveredButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
  },
  deliveredLabel: {
    fontSize: 14,
    color: '#4caf50',
    fontWeight: '600',
  },
  orderDate: {
    fontSize: 12,
    color: '#999',
    marginTop: 4,
  },
  creditCard: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  creditHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  creditAmount: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#4caf50',
  },
  creditDate: {
    fontSize: 12,
    color: '#999',
  },
  creditOrder: {
    fontSize: 12,
    color: '#666',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 16,
    color: '#999',
  },
});
