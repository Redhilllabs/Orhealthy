import { View, Text, StyleSheet, TouchableOpacity, FlatList, ScrollView, Modal, ActivityIndicator, Alert } from 'react-native';
import { useState, useEffect } from 'react';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import { storage } from '../src/utils/storage';
import { useAuth } from '../src/context/AuthContext';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL + '/api';

export default function MyOrdersScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [showCancelOrderConfirm, setShowCancelOrderConfirm] = useState(false);
  const [cancelOrderId, setCancelOrderId] = useState<string | null>(null);

  useEffect(() => {
    fetchOrders();
  }, []);

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
      await fetchOrders();
      setTimeout(() => {
        Alert.alert('Success', 'Order cancelled successfully');
      }, 100);
    } catch (error: any) {
      const errorMessage = error.response?.data?.detail || 'Failed to cancel order';
      Alert.alert('Error', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const statusColors = {
    arrived: { bg: '#e3f2fd', border: '#2196f3', text: '#1565c0' },
    accepted: { bg: '#fff3e0', border: '#ff9800', text: '#e65100' },
    preparing: { bg: '#fff3e0', border: '#ff9800', text: '#e65100' },
    ready: { bg: '#f3e5f5', border: '#9c27b0', text: '#6a1b9a' },
    out_for_delivery: { bg: '#fce4ec', border: '#e91e63', text: '#880e4f' },
    delivered: { bg: '#e8f5e9', border: '#4caf50', text: '#2e7d32' },
    cancelled: { bg: '#ffebee', border: '#f44336', text: '#c62828' },
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Orders</Text>
        <View style={{ width: 40 }} />
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#ffd700" />
        </View>
      ) : orders.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="receipt-outline" size={80} color="#ccc" />
          <Text style={styles.emptyText}>No orders yet</Text>
        </View>
      ) : (
        <FlatList
          data={orders}
          keyExtractor={(item) => item._id}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => {
            const statusColor = statusColors[item.status as keyof typeof statusColors] || statusColors.arrived;
            const statusText = item.status.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase());

            return (
              <TouchableOpacity
                style={styles.orderCard}
                onPress={() => {
                  setSelectedOrder(item);
                  setShowOrderModal(true);
                }}
              >
                <View style={styles.orderHeader}>
                  <Text style={styles.orderIdText}>#{item.order_id || item._id.slice(-8)}</Text>
                  <View style={[styles.orderStatusBadge, { backgroundColor: statusColor.bg, borderColor: statusColor.border }]}>
                    <Text style={[styles.orderStatusText, { color: statusColor.text }]}>{statusText}</Text>
                  </View>
                </View>
                <Text style={styles.orderItemCount}>{item.items?.length || 0} items</Text>
                <View style={styles.orderFooter}>
                  <Text style={styles.orderPrice}>₹{item.final_price?.toFixed(2)}</Text>
                  <Text style={styles.orderDate}>
                    {new Date(item.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </Text>
                </View>
                <View style={styles.orderPaymentRow}>
                  <Ionicons 
                    name={item.payment_method === 'online' ? "card" : "cash"} 
                    size={14} 
                    color="#666" 
                  />
                  <Text style={styles.orderPaymentText}>
                    {item.payment_method === 'online' ? 'Online' : 'Pay on Delivery'}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          }}
        />
      )}

      {/* Order Details Modal */}
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
                  <View style={styles.orderDetailSection}>
                    <Text style={styles.orderDetailLabel}>Order ID</Text>
                    <Text style={styles.orderDetailValue}>#{selectedOrder.order_id || selectedOrder._id?.slice(-8)}</Text>
                  </View>

                  <View style={styles.orderDetailSection}>
                    <Text style={styles.orderDetailLabel}>Status</Text>
                    <Text style={styles.orderDetailValue}>
                      {selectedOrder.status?.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())}
                    </Text>
                  </View>

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

                  <View style={styles.orderDetailSection}>
                    <Text style={styles.orderDetailLabel}>Delivery Address</Text>
                    <Text style={styles.orderDetailValue}>
                      {selectedOrder.shipping_address?.street}
                      {selectedOrder.shipping_address?.apartment && `, ${selectedOrder.shipping_address.apartment}`}
                      {'\n'}{selectedOrder.shipping_address?.city}, {selectedOrder.shipping_address?.state} - {selectedOrder.shipping_address?.zip_code}
                      {'\n'}☎ {selectedOrder.shipping_address?.phone}
                    </Text>
                  </View>

                  <View style={[styles.orderDetailSection, styles.orderDetailTotal]}>
                    <Text style={styles.orderDetailTotalLabel}>Total Amount</Text>
                    <Text style={styles.orderDetailTotalValue}>₹{selectedOrder.final_price?.toFixed(2)}</Text>
                  </View>

                  {selectedOrder.status === 'arrived' && (
                    <TouchableOpacity
                      style={styles.cancelOrderButton}
                      onPress={() => {
                        setCancelOrderId(selectedOrder._id);
                        setShowOrderModal(false);
                        setTimeout(() => {
                          setShowCancelOrderConfirm(true);
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
                      setShowOrderModal(true);
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#999',
    marginTop: 16,
  },
  listContent: {
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 20,
    width: '90%',
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
});
