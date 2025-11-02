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
  Switch
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/src/context/AuthContext';
import Constants from 'expo-constants';

const BACKEND_URL = Constants.expoConfig?.extra?.EXPO_PUBLIC_BACKEND_URL;

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
  const [orders, setOrders] = useState<Order[]>({} as Order[]);
  const [credits, setCredits] = useState<CreditRecord[]>([]);
  const [activeTab, setActiveTab] = useState<'orders' | 'credits'>('orders');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      
      // Check if user is delivery agent
      const checkResponse = await fetch(`${BACKEND_URL}/api/delivery-agents/check`, {
        headers: {
          'Authorization': `Bearer ${user?.id_token}`,
        },
      });
      const checkData = await checkResponse.json();
      
      if (!checkData.is_delivery_agent) {
        Alert.alert('Error', 'You are not registered as a delivery agent');
        router.back();
        return;
      }
      
      setAgentData(checkData.agent);
      
      // Load orders
      const ordersResponse = await fetch(`${BACKEND_URL}/api/delivery-agents/my-orders`, {
        headers: {
          'Authorization': `Bearer ${user?.id_token}`,
        },
      });
      const ordersData = await ordersResponse.json();
      setOrders(ordersData);
      
      // Load credits
      const creditsResponse = await fetch(`${BACKEND_URL}/api/delivery-agents/credits`, {
        headers: {
          'Authorization': `Bearer ${user?.id_token}`,
        },
      });
      const creditsData = await creditsResponse.json();
      setCredits(creditsData.credits || []);
      
      // Update agent data with latest wallet balance
      if (creditsData.total_balance !== undefined) {
        setAgentData(prev => prev ? {...prev, wallet_balance: creditsData.total_balance} : null);
      }
      
    } catch (error) {
      console.error('Error loading delivery data:', error);
      Alert.alert('Error', 'Failed to load delivery data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const updateStatus = async (newStatus: string) => {
    if (!agentData) return;
    
    try {
      const response = await fetch(`${BACKEND_URL}/api/delivery-agents/${agentData._id}/status`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${user?.id_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: newStatus }),
      });
      
      if (response.ok) {
        setAgentData(prev => prev ? {...prev, status: newStatus} : null);
        Alert.alert('Success', `Status updated to ${newStatus}`);
      } else {
        Alert.alert('Error', 'Failed to update status');
      }
    } catch (error) {
      console.error('Error updating status:', error);
      Alert.alert('Error', 'Failed to update status');
    }
  };

  const markAsDelivered = async (orderId: string) => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/orders/${orderId}/status`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${user?.id_token}`,
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

  const switchToUserMode = () => {
    router.back();
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#ffd700" />
      </View>
    );
  }

  const activeOrders = orders.filter((o: Order) => o.status === 'out_for_delivery');
  const deliveredOrders = orders.filter((o: Order) => o.status === 'delivered');

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View>
            <Text style={styles.headerTitle}>Delivery Mode</Text>
            <Text style={styles.headerSubtitle}>{agentData?.name || 'Delivery Agent'}</Text>
          </View>
          <TouchableOpacity style={styles.switchButton} onPress={switchToUserMode}>
            <Text style={styles.switchButtonText}>Switch to User Mode</Text>
          </TouchableOpacity>
        </View>
        
        {/* Wallet Balance */}
        <View style={styles.walletCard}>
          <Text style={styles.walletLabel}>Wallet Balance</Text>
          <Text style={styles.walletAmount}>₹{agentData?.wallet_balance || 0}</Text>
          <Text style={styles.paymentInfo}>₹{agentData?.payment_per_delivery || 0} per delivery</Text>
        </View>
        
        {/* Status Switches */}
        <View style={styles.statusContainer}>
          <TouchableOpacity 
            style={[styles.statusButton, agentData?.status === 'available' && styles.statusButtonActive]}
            onPress={() => updateStatus('available')}
          >
            <Text style={[styles.statusButtonText, agentData?.status === 'available' && styles.statusButtonTextActive]}>
              Available
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.statusButton, agentData?.status === 'busy' && styles.statusButtonActive]}
            onPress={() => updateStatus('busy')}
          >
            <Text style={[styles.statusButtonText, agentData?.status === 'busy' && styles.statusButtonTextActive]}>
              Busy
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.statusButton, agentData?.status === 'offline' && styles.statusButtonActive]}
            onPress={() => updateStatus('offline')}
          >
            <Text style={[styles.statusButtonText, agentData?.status === 'offline' && styles.statusButtonTextActive]}>
              Offline
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Tabs */}
      <View style={styles.tabContainer}>
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'orders' && styles.tabActive]}
          onPress={() => setActiveTab('orders')}
        >
          <Text style={[styles.tabText, activeTab === 'orders' && styles.tabTextActive]}>
            Orders ({activeOrders.length})
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'credits' && styles.tabActive]}
          onPress={() => setActiveTab('credits')}
        >
          <Text style={[styles.tabText, activeTab === 'credits' && styles.tabTextActive]}>
            Credit History
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
        {activeTab === 'orders' ? (
          <View>
            {/* Active Orders */}
            {activeOrders.length > 0 && (
              <View>
                <Text style={styles.sectionTitle}>Active Deliveries</Text>
                {activeOrders.map((order: Order) => (
                  <View key={order._id} style={styles.orderCard}>
                    <View style={styles.orderHeader}>
                      <Text style={styles.orderIdgreen}># {order.order_id}</Text>
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
                ))}
              </View>
            )}
            
            {/* Delivered Orders */}
            {deliveredOrders.length > 0 && (
              <View style={{ marginTop: 20 }}>
                <Text style={styles.sectionTitle}>Delivered Orders</Text>
                {deliveredOrders.map((order: Order) => (
                  <View key={order._id} style={[styles.orderCard, styles.deliveredCard]}>
                    <View style={styles.orderHeader}>
                      <Text style={styles.orderIdgray}>#{order.order_id}</Text>
                      <Text style={styles.orderPricegray}>₹{order.final_price}</Text>
                    </View>
                    <Text style={styles.deliveredLabel}>✓ Delivered</Text>
                  </View>
                ))}
              </View>
            )}
            
            {activeOrders.length === 0 && deliveredOrders.length === 0 && (
              <View style={styles.emptyState}>
                <Text style={styles.emptyText}>No orders assigned yet</Text>
              </View>
            )}
          </View>
        ) : (
          <View>
            <Text style={styles.sectionTitle}>Credit History</Text>
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
    marginBottom: 20,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  switchButton: {
    backgroundColor: '#333',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  switchButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  walletCard: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 12,
    marginBottom: 16,
    alignItems: 'center',
  },
  walletLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  walletAmount: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  paymentInfo: {
    fontSize: 12,
    color: '#999',
  },
  statusContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  statusButton: {
    flex: 1,
    backgroundColor: '#fff',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  statusButtonActive: {
    backgroundColor: '#333',
  },
  statusButtonText: {
    color: '#333',
    fontWeight: '600',
    fontSize: 14,
  },
  statusButtonTextActive: {
    color: '#ffd700',
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
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
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
