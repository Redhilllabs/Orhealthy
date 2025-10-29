import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useCart } from '../src/context/CartContext';
import axios from 'axios';
import { storage } from '../src/utils/storage';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL + '/api';

export default function CheckoutScreen() {
  const router = useRouter();
  const { cartItems, totalPrice, clearCart } = useCart();
  const [loading, setLoading] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'cod' | 'online'>('cod');

  // Billing address
  const [billingName, setBillingName] = useState('');
  const [billingStreet, setBillingStreet] = useState('');
  const [billingCity, setBillingCity] = useState('');
  const [billingState, setBillingState] = useState('');
  const [billingZip, setBillingZip] = useState('');
  const [billingPhone, setBillingPhone] = useState('');

  // Shipping address
  const [sameAsB illing, setSameAsBilling] = useState(true);
  const [shippingName, setShippingName] = useState('');
  const [shippingStreet, setShippingStreet] = useState('');
  const [shippingCity, setShippingCity] = useState('');
  const [shippingState, setShippingState] = useState('');
  const [shippingZip, setShippingZip] = useState('');
  const [shippingPhone, setShippingPhone] = useState('');

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

    return true;
  };

  const handlePlaceOrder = async () => {
    if (!validateForm()) return;

    try {
      setLoading(true);
      const token = await storage.getItemAsync('session_token');

      const billingAddress = {
        name: billingName,
        street: billingStreet,
        city: billingCity,
        state: billingState,
        zip_code: billingZip,
        phone: billingPhone,
      };

      const shippingAddress = sameAsBilling
        ? billingAddress
        : {
            name: shippingName,
            street: shippingStreet,
            city: shippingCity,
            state: shippingState,
            zip_code: shippingZip,
            phone: shippingPhone,
          };

      await axios.post(
        `${API_URL}/orders`,
        {
          items: cartItems,
          total_price: totalPrice,
          billing_address: billingAddress,
          shipping_address: shippingAddress,
          payment_id: paymentMethod === 'cod' ? 'COD' : null,
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      await clearCart();
      
      Alert.alert(
        'Order Placed!',
        paymentMethod === 'cod'
          ? 'Your order has been placed successfully. Pay on delivery.'
          : 'Your order has been placed successfully.',
        [
          {
            text: 'OK',
            onPress: () => router.replace('/(tabs)'),
          },
        ]
      );
    } catch (error: any) {
      console.error('Error placing order:', error);
      Alert.alert('Error', error.response?.data?.detail || 'Failed to place order');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Checkout</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.scrollContent}>
        {/* Order Summary */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Order Summary</Text>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Items ({cartItems.length})</Text>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryText}>Total</Text>
              <Text style={styles.summaryPrice}>₹{totalPrice.toFixed(2)}</Text>
            </View>
          </View>
        </View>

        {/* Payment Method */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Payment Method</Text>
          <TouchableOpacity
            style={[
              styles.paymentOption,
              paymentMethod === 'cod' && styles.paymentOptionActive,
            ]}
            onPress={() => setPaymentMethod('cod')}
          >
            <View style={styles.radio}>
              {paymentMethod === 'cod' && <View style={styles.radioInner} />}
            </View>
            <View style={styles.paymentInfo}>
              <Text style={styles.paymentTitle}>Cash on Delivery</Text>
              <Text style={styles.paymentSubtitle}>Pay when you receive</Text>
            </View>
            <Ionicons name="cash-outline" size={24} color="#ffd700" />
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.paymentOption,
              paymentMethod === 'online' && styles.paymentOptionActive,
            ]}
            onPress={() => setPaymentMethod('online')}
          >
            <View style={styles.radio}>
              {paymentMethod === 'online' && <View style={styles.radioInner} />}
            </View>
            <View style={styles.paymentInfo}>
              <Text style={styles.paymentTitle}>Online Payment</Text>
              <Text style={styles.paymentSubtitle}>Coming soon</Text>
            </View>
            <Ionicons name="card-outline" size={24} color="#ccc" />
          </TouchableOpacity>
        </View>

        {/* Billing Address */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Billing Address</Text>
          <View style={styles.form}>
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
        </View>

        {/* Shipping Address */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Shipping Address</Text>
            <TouchableOpacity
              style={styles.checkbox}
              onPress={() => setSameAsBilling(!sameAsBilling)}
            >
              <Ionicons
                name={sameAsBilling ? 'checkbox' : 'square-outline'}
                size={24}
                color="#ffd700"
              />
              <Text style={styles.checkboxLabel}>Same as billing</Text>
            </TouchableOpacity>
          </View>

          {!sameAsBilling && (
            <View style={styles.form}>
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
            </View>
          )}
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Total Amount</Text>
          <Text style={styles.totalAmount}>₹{totalPrice.toFixed(2)}</Text>
        </View>
        <TouchableOpacity
          style={[styles.placeOrderButton, (loading || paymentMethod === 'online') && styles.placeOrderButtonDisabled]}
          onPress={handlePlaceOrder}
          disabled={loading || paymentMethod === 'online'}
        >
          {loading ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <>
              <Text style={styles.placeOrderButtonText}>
                {paymentMethod === 'cod' ? 'Place Order (COD)' : 'Coming Soon'}
              </Text>
              {paymentMethod === 'cod' && (
                <Ionicons name="arrow-forward" size={20} color="#fff" />
              )}
            </>
          )}
        </TouchableOpacity>
      </View>
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
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: '#fff',
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
  content: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 20,
  },
  section: {
    backgroundColor: '#fff',
    marginTop: 12,
    padding: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
  },
  summaryCard: {
    backgroundColor: '#f9f9f9',
    padding: 16,
    borderRadius: 8,
  },
  summaryLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 12,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  summaryText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  summaryPrice: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ffd700',
  },
  paymentOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  paymentOptionActive: {
    borderColor: '#ffd700',
    backgroundColor: '#fffef5',
  },
  radio: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#ffd700',
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#ffd700',
  },
  paymentInfo: {
    flex: 1,
  },
  paymentTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 2,
  },
  paymentSubtitle: {
    fontSize: 12,
    color: '#666',
  },
  form: {
    gap: 12,
  },
  input: {
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#eee',
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  halfInput: {
    flex: 1,
  },
  checkbox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  checkboxLabel: {
    fontSize: 14,
    color: '#666',
  },
  footer: {
    backgroundColor: '#fff',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  totalLabel: {
    fontSize: 16,
    color: '#666',
  },
  totalAmount: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#ffd700',
  },
  placeOrderButton: {
    backgroundColor: '#ffd700',
    paddingVertical: 16,
    borderRadius: 12,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  placeOrderButtonDisabled: {
    backgroundColor: '#ccc',
  },
  placeOrderButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
});
