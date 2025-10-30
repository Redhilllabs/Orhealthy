import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useState, useEffect } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useCart } from '../src/context/CartContext';
import { useAuth } from '../src/context/AuthContext';
import axios from 'axios';
import { storage } from '../src/utils/storage';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL + '/api';

export default function CheckoutScreen() {
  const router = useRouter();
  const { cartItems, totalPrice, clearCart } = useCart();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'cod' | 'online'>('cod');
  const [showThankYou, setShowThankYou] = useState(false);
  const [itemsExpanded, setItemsExpanded] = useState(false);

  // Coupon state
  const [couponCode, setCouponCode] = useState('');
  const [couponApplied, setCouponApplied] = useState(false);
  const [couponDiscount, setCouponDiscount] = useState(0);
  const [validatingCoupon, setValidatingCoupon] = useState(false);

  // Guide ordering state
  const [orderingForGuidee, setOrderingForGuidee] = useState(false);
  const [guidees, setGuidees] = useState<any[]>([]);
  const [selectedGuidee, setSelectedGuidee] = useState<string | null>(null);
  const [commissionRate, setCommissionRate] = useState(0);
  const [commissionAmount, setCommissionAmount] = useState(0);

  // Address state
  const [billingName, setBillingName] = useState('');
  const [billingStreet, setBillingStreet] = useState('');
  const [billingCity, setBillingCity] = useState('');
  const [billingState, setBillingState] = useState('');
  const [billingZip, setBillingZip] = useState('');
  const [billingPhone, setBillingPhone] = useState('');

  const [sameAsBilling, setSameAsBilling] = useState(true);
  const [shippingName, setShippingName] = useState('');
  const [shippingStreet, setShippingStreet] = useState('');
  const [shippingCity, setShippingCity] = useState('');
  const [shippingState, setShippingState] = useState('');
  const [shippingZip, setShippingZip] = useState('');
  const [shippingPhone, setShippingPhone] = useState('');

  useEffect(() => {
    if (user?.is_guide) {
      fetchGuidees();
    }
  }, [user]);

  useEffect(() => {
    if (user?.is_guide && orderingForGuidee) {
      calculateCommission();
    }
  }, [orderingForGuidee, couponDiscount, totalPrice]);

  const fetchGuidees = async () => {
    try {
      const token = await storage.getItemAsync('session_token');
      const response = await axios.get(`${API_URL}/my-guidees`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setGuidees(response.data);
    } catch (error) {
      console.error('Error fetching guidees:', error);
    }
  };

  const calculateCommission = async () => {
    if (!user?.star_rating) return;
    
    try {
      const token = await storage.getItemAsync('session_token');
      const response = await axios.get(`${API_URL}/admin/commission-rates`);
      const rates = response.data;
      const rate = rates[`star${user.star_rating}`] || 0;
      setCommissionRate(rate);
      
      const finalPrice = totalPrice - couponDiscount;
      setCommissionAmount((finalPrice * rate) / 100);
    } catch (error) {
      console.error('Error calculating commission:', error);
    }
  };

  const validateCoupon = async () => {
    if (!couponCode.trim()) {
      Alert.alert('Error', 'Please enter a coupon code');
      return;
    }

    try {
      setValidatingCoupon(true);
      const response = await axios.post(`${API_URL}/coupons/validate`, {
        code: couponCode.trim(),
        order_value: totalPrice,
      });

      setCouponApplied(true);
      setCouponDiscount(response.data.discount_amount);
      Alert.alert('Success', `Coupon applied! You saved ₹${response.data.discount_amount.toFixed(2)}`);
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.detail || 'Invalid coupon code');
      setCouponApplied(false);
      setCouponDiscount(0);
    } finally {
      setValidatingCoupon(false);
    }
  };

  const removeCoupon = () => {
    setCouponCode('');
    setCouponApplied(false);
    setCouponDiscount(0);
  };

  const validateForm = () => {
    if (!billingName || !billingStreet || !billingCity || !billingState || !billingZip || !billingPhone) {
      Alert.alert('Error', 'Please fill in all billing address fields');
      return false;
    }

    if (!sameAsBilling) {
      if (!shippingName || !shippingStreet || !shippingCity || !shippingState || !shippingZip || !shippingPhone) {
        Alert.alert('Error', 'Please fill in all shipping address fields');
        return false;
      }
    }

    if (orderingForGuidee && !selectedGuidee) {
      Alert.alert('Error', 'Please select a guidee');
      return false;
    }

    return true;
  };

  const handlePlaceOrder = async () => {
    if (!validateForm()) return;

    try {
      setLoading(true);
      const token = await storage.getItemAsync('session_token');

      const billingAddress = {
        label: 'Billing',
        full_address: `${billingStreet}, ${billingCity}`,
        city: billingCity,
        state: billingState,
        pincode: billingZip,
        phone: billingPhone,
        is_default: false,
      };

      const shippingAddress = sameAsBilling
        ? billingAddress
        : {
            label: 'Shipping',
            full_address: `${shippingStreet}, ${shippingCity}`,
            city: shippingCity,
            state: shippingState,
            pincode: shippingZip,
            phone: shippingPhone,
            is_default: false,
          };

      const orderData: any = {
        items: cartItems,
        total_price: totalPrice,
        discount_amount: couponDiscount,
        coupon_code: couponApplied ? couponCode : null,
        final_price: totalPrice - couponDiscount,
        billing_address: billingAddress,
        shipping_address: shippingAddress,
        payment_id: paymentMethod === 'cod' ? 'COD' : null,
      };

      if (orderingForGuidee && selectedGuidee) {
        orderData.ordered_by_guide_id = user?._id;
        orderData.ordered_for_guidee_id = selectedGuidee;
      }

      await axios.post(`${API_URL}/orders`, orderData, {
        headers: { Authorization: `Bearer ${token}` },
      });

      await clearCart();
      setShowThankYou(true);

      setTimeout(() => {
        router.push('/');
      }, 3000);
    } catch (error) {
      console.error('Error placing order:', error);
      Alert.alert('Error', 'Failed to place order');
    } finally {
      setLoading(false);
    }
  };

  if (showThankYou) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.thankYouContainer}>
          <Ionicons name="checkmark-circle" size={80} color="#10b981" />
          <Text style={styles.thankYouTitle}>Order Placed!</Text>
          <Text style={styles.thankYouText}>Thank you for your order</Text>
          {commissionAmount > 0 && (
            <Text style={styles.commissionText}>
              Commission earned: ₹{commissionAmount.toFixed(2)}
            </Text>
          )}
        </View>
      </SafeAreaView>
    );
  }

  const finalPrice = totalPrice - couponDiscount;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Checkout</Text>
        <View style={{ width: 24 }} />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView style={styles.content}>
          {/* Items Summary */}
          <View style={styles.section}>
            <TouchableOpacity
              style={styles.sectionHeader}
              onPress={() => setItemsExpanded(!itemsExpanded)}
            >
              <Text style={styles.sectionTitle}>
                Order Summary ({cartItems.length} items)
              </Text>
              <Ionicons
                name={itemsExpanded ? 'chevron-up' : 'chevron-down'}
                size={24}
                color="#333"
              />
            </TouchableOpacity>

            {itemsExpanded && (
              <View style={styles.itemsList}>
                {cartItems.map((item, index) => (
                  <View key={index} style={styles.orderItem}>
                    <View style={styles.orderItemInfo}>
                      <Text style={styles.orderItemName}>{item.meal_name}</Text>
                      <Text style={styles.orderItemQty}>Qty: {item.quantity}</Text>
                    </View>
                    <Text style={styles.orderItemPrice}>
                      ₹{(item.price * item.quantity).toFixed(2)}
                    </Text>
                  </View>
                ))}
              </View>
            )}
          </View>

          {/* Coupon Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Coupon Code</Text>
            {!couponApplied ? (
              <View style={styles.couponInput}>
                <TextInput
                  style={styles.input}
                  placeholder="Enter coupon code"
                  value={couponCode}
                  onChangeText={setCouponCode}
                  autoCapitalize="characters"
                />
                <TouchableOpacity
                  style={styles.applyButton}
                  onPress={validateCoupon}
                  disabled={validatingCoupon}
                >
                  {validatingCoupon ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={styles.applyButtonText}>Apply</Text>
                  )}
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.couponApplied}>
                <View>
                  <Text style={styles.couponCodeText}>{couponCode}</Text>
                  <Text style={styles.couponDiscountText}>
                    -₹{couponDiscount.toFixed(2)}
                  </Text>
                </View>
                <TouchableOpacity onPress={removeCoupon}>
                  <Ionicons name="close-circle" size={24} color="#ef4444" />
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* Guide Ordering Section */}
          {user?.is_guide && guidees.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Order For Guidee</Text>
              <TouchableOpacity
                style={styles.checkboxContainer}
                onPress={() => setOrderingForGuidee(!orderingForGuidee)}
              >
                <Ionicons
                  name={orderingForGuidee ? 'checkbox' : 'square-outline'}
                  size={24}
                  color="#ffd700"
                />
                <Text style={styles.checkboxLabel}>I'm ordering for a guidee</Text>
              </TouchableOpacity>

              {orderingForGuidee && (
                <View style={styles.guideeSelector}>
                  <Text style={styles.label}>Select Guidee *</Text>
                  {guidees.map((guidee) => (
                    <TouchableOpacity
                      key={guidee._id}
                      style={[
                        styles.guideeOption,
                        selectedGuidee === guidee._id && styles.guideeOptionSelected,
                      ]}
                      onPress={() => setSelectedGuidee(guidee._id)}
                    >
                      <Text
                        style={[
                          styles.guideeName,
                          selectedGuidee === guidee._id && styles.guideeNameSelected,
                        ]}
                      >
                        {guidee.name}
                      </Text>
                      <Text style={styles.guideeEmail}>{guidee.email}</Text>
                    </TouchableOpacity>
                  ))}

                  {selectedGuidee && commissionAmount > 0 && (
                    <View style={styles.commissionCard}>
                      <Text style={styles.commissionTitle}>Your Commission</Text>
                      <Text style={styles.commissionValue}>
                        ₹{commissionAmount.toFixed(2)}
                      </Text>
                      <Text style={styles.commissionRate}>
                        {commissionRate}% on ₹{finalPrice.toFixed(2)}
                      </Text>
                    </View>
                  )}
                </View>
              )}
            </View>
          )}

          {/* Billing Address */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Billing Address</Text>
            <TextInput
              style={styles.input}
              placeholder="Full Name *"
              value={billingName}
              onChangeText={setBillingName}
            />
            <TextInput
              style={styles.input}
              placeholder="Street Address *"
              value={billingStreet}
              onChangeText={setBillingStreet}
            />
            <View style={styles.row}>
              <TextInput
                style={[styles.input, styles.halfInput]}
                placeholder="City *"
                value={billingCity}
                onChangeText={setBillingCity}
              />
              <TextInput
                style={[styles.input, styles.halfInput]}
                placeholder="State *"
                value={billingState}
                onChangeText={setBillingState}
              />
            </View>
            <View style={styles.row}>
              <TextInput
                style={[styles.input, styles.halfInput]}
                placeholder="ZIP Code *"
                value={billingZip}
                onChangeText={setBillingZip}
                keyboardType="numeric"
              />
              <TextInput
                style={[styles.input, styles.halfInput]}
                placeholder="Phone *"
                value={billingPhone}
                onChangeText={setBillingPhone}
                keyboardType="phone-pad"
              />
            </View>
          </View>

          {/* Shipping Address */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Shipping Address</Text>
            <TouchableOpacity
              style={styles.checkboxContainer}
              onPress={() => setSameAsBilling(!sameAsBilling)}
            >
              <Ionicons
                name={sameAsBilling ? 'checkbox' : 'square-outline'}
                size={24}
                color="#ffd700"
              />
              <Text style={styles.checkboxLabel}>Same as billing address</Text>
            </TouchableOpacity>

            {!sameAsBilling && (
              <>
                <TextInput
                  style={styles.input}
                  placeholder="Full Name *"
                  value={shippingName}
                  onChangeText={setShippingName}
                />
                <TextInput
                  style={styles.input}
                  placeholder="Street Address *"
                  value={shippingStreet}
                  onChangeText={setShippingStreet}
                />
                <View style={styles.row}>
                  <TextInput
                    style={[styles.input, styles.halfInput]}
                    placeholder="City *"
                    value={shippingCity}
                    onChangeText={setShippingCity}
                  />
                  <TextInput
                    style={[styles.input, styles.halfInput]}
                    placeholder="State *"
                    value={shippingState}
                    onChangeText={setShippingState}
                  />
                </View>
                <View style={styles.row}>
                  <TextInput
                    style={[styles.input, styles.halfInput]}
                    placeholder="ZIP Code *"
                    value={shippingZip}
                    onChangeText={setShippingZip}
                    keyboardType="numeric"
                  />
                  <TextInput
                    style={[styles.input, styles.halfInput]}
                    placeholder="Phone *"
                    value={shippingPhone}
                    onChangeText={setShippingPhone}
                    keyboardType="phone-pad"
                  />
                </View>
              </>
            )}
          </View>

          {/* Payment Method */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Payment Method</Text>
            <TouchableOpacity
              style={[
                styles.paymentOption,
                paymentMethod === 'cod' && styles.paymentOptionSelected,
              ]}
              onPress={() => setPaymentMethod('cod')}
            >
              <Ionicons
                name={paymentMethod === 'cod' ? 'radio-button-on' : 'radio-button-off'}
                size={24}
                color="#ffd700"
              />
              <Text style={styles.paymentLabel}>Cash on Delivery</Text>
            </TouchableOpacity>
          </View>

          {/* Price Summary */}
          <View style={styles.priceSection}>
            <View style={styles.priceRow}>
              <Text style={styles.priceLabel}>Subtotal</Text>
              <Text style={styles.priceValue}>₹{totalPrice.toFixed(2)}</Text>
            </View>
            {couponDiscount > 0 && (
              <View style={styles.priceRow}>
                <Text style={[styles.priceLabel, styles.discountLabel]}>Discount</Text>
                <Text style={[styles.priceValue, styles.discountValue]}>
                  -₹{couponDiscount.toFixed(2)}
                </Text>
              </View>
            )}
            <View style={[styles.priceRow, styles.totalRow]}>
              <Text style={styles.totalLabel}>Total</Text>
              <Text style={styles.totalValue}>₹{finalPrice.toFixed(2)}</Text>
            </View>
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <View style={styles.footerPriceInfo}>
            <Text style={styles.footerLabel}>Total</Text>
            <Text style={styles.footerPrice}>₹{finalPrice.toFixed(2)}</Text>
          </View>
          <TouchableOpacity
            style={styles.placeOrderButton}
            onPress={handlePlaceOrder}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.placeOrderButtonText}>Place Order</Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  content: {
    flex: 1,
  },
  section: {
    backgroundColor: '#fff',
    padding: 16,
    marginBottom: 8,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
  },
  itemsList: {
    marginTop: 12,
  },
  orderItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  orderItemInfo: {
    flex: 1,
  },
  orderItemName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  orderItemQty: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  orderItemPrice: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#ffd700',
  },
  couponInput: {
    flexDirection: 'row',
    gap: 8,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    backgroundColor: '#fff',
    marginBottom: 12,
  },
  applyButton: {
    backgroundColor: '#ffd700',
    paddingHorizontal: 20,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  applyButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  couponApplied: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#ecfdf5',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#10b981',
  },
  couponCodeText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#059669',
  },
  couponDiscountText: {
    fontSize: 14,
    color: '#059669',
    marginTop: 2,
  },
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  checkboxLabel: {
    fontSize: 14,
    color: '#333',
  },
  guideeSelector: {
    marginTop: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  guideeOption: {
    padding: 12,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    marginBottom: 8,
  },
  guideeOptionSelected: {
    borderColor: '#ffd700',
    backgroundColor: '#fffbeb',
  },
  guideeName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  guideeNameSelected: {
    color: '#ffd700',
  },
  guideeEmail: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  commissionCard: {
    backgroundColor: '#eff6ff',
    padding: 16,
    borderRadius: 8,
    marginTop: 8,
    alignItems: 'center',
  },
  commissionTitle: {
    fontSize: 14,
    color: '#1e40af',
    marginBottom: 4,
  },
  commissionValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1e40af',
    marginBottom: 4,
  },
  commissionRate: {
    fontSize: 12,
    color: '#64748b',
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  halfInput: {
    flex: 1,
  },
  paymentOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    marginBottom: 8,
  },
  paymentOptionSelected: {
    borderColor: '#ffd700',
    backgroundColor: '#fffbeb',
  },
  paymentLabel: {
    fontSize: 14,
    color: '#333',
  },
  priceSection: {
    backgroundColor: '#fff',
    padding: 16,
    marginBottom: 80,
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  priceLabel: {
    fontSize: 14,
    color: '#666',
  },
  priceValue: {
    fontSize: 14,
    color: '#333',
  },
  discountLabel: {
    color: '#10b981',
  },
  discountValue: {
    color: '#10b981',
    fontWeight: '600',
  },
  totalRow: {
    borderTopWidth: 1,
    borderTopColor: '#eee',
    paddingTop: 8,
    marginTop: 4,
  },
  totalLabel: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  totalValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#ffd700',
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  footerPriceInfo: {
    flex: 1,
  },
  footerLabel: {
    fontSize: 14,
    color: '#666',
  },
  footerPrice: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ffd700',
  },
  placeOrderButton: {
    backgroundColor: '#ffd700',
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 8,
  },
  placeOrderButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  thankYouContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  thankYouTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#10b981',
    marginTop: 16,
  },
  thankYouText: {
    fontSize: 16,
    color: '#666',
    marginTop: 8,
    textAlign: 'center',
  },
  commissionText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1e40af',
    marginTop: 16,
  },
});
