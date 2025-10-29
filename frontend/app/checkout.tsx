import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useCart } from '../src/context/CartContext';
import { useRouter } from 'expo-router';
import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import { SafeAreaView } from 'react-native-safe-area-context';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL + '/api';

export default function CheckoutScreen() {
  const { cartItems, totalPrice, clearCart } = useCart();
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  // Billing Address
  const [billName, setBillName] = useState('');
  const [billStreet, setBillStreet] = useState('');
  const [billCity, setBillCity] = useState('');
  const [billState, setBillState] = useState('');
  const [billZip, setBillZip] = useState('');
  const [billPhone, setBillPhone] = useState('');

  // Shipping Address
  const [sameAsBilling, setSameAsBilling] = useState(true);
  const [shipName, setShipName] = useState('');
  const [shipStreet, setShipStreet] = useState('');
  const [shipCity, setShipCity] = useState('');
  const [shipState, setShipState] = useState('');
  const [shipZip, setShipZip] = useState('');
  const [shipPhone, setShipPhone] = useState('');

  const validateForm = () => {
    if (!billName || !billStreet || !billCity || !billState || !billZip || !billPhone) {
      Alert.alert('Error', 'Please fill in all billing address fields');
      return false;
    }

    if (!sameAsBilling && (!shipName || !shipStreet || !shipCity || !shipState || !shipZip || !shipPhone)) {
      Alert.alert('Error', 'Please fill in all shipping address fields');
      return false;
    }

    return true;
  };

  const handlePlaceOrder = async () => {
    if (!validateForm()) return;

    try {
      setLoading(true);
      
      const billingAddress = {
        name: billName,
        street: billStreet,
        city: billCity,
        state: billState,
        zip_code: billZip,
        phone: billPhone,
      };

      const shippingAddress = sameAsBilling ? billingAddress : {
        name: shipName,
        street: shipStreet,
        city: shipCity,
        state: shipState,
        zip_code: shipZip,
        phone: shipPhone,
      };

      const token = await SecureStore.getItemAsync('session_token');
      
      // For now, we'll just create the order without Razorpay integration
      // You can add Razorpay integration later
      await axios.post(
        `${API_URL}/orders`,
        {
          items: cartItems,
          total_price: totalPrice,
          billing_address: billingAddress,
          shipping_address: shippingAddress,
          payment_id: 'manual_payment', // TODO: Integrate Razorpay
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      await clearCart();
      
      Alert.alert(
        'Order Placed!',
        'Your order has been placed successfully. You will receive a confirmation soon.',
        [{ text: 'OK', onPress: () => router.replace('/(tabs)') }]
      );
    } catch (error) {
      console.error('Error placing order:', error);
      Alert.alert('Error', 'Failed to place order. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={28} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Checkout</Text>
        <View style={{ width: 28 }} />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flex}
      >
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {/* Order Summary */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Order Summary</Text>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Items ({cartItems.length})</Text>
              <Text style={styles.summaryValue}>${totalPrice.toFixed(2)}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.totalLabel}>Total</Text>
              <Text style={styles.totalValue}>${totalPrice.toFixed(2)}</Text>
            </View>
          </View>

          {/* Billing Address */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Billing Address</Text>
            
            <TextInput
              style={styles.input}
              placeholder="Full Name *"
              value={billName}
              onChangeText={setBillName}
            />
            <TextInput
              style={styles.input}
              placeholder="Street Address *"
              value={billStreet}
              onChangeText={setBillStreet}
            />
            <View style={styles.row}>
              <TextInput
                style={[styles.input, styles.halfInput]}
                placeholder="City *"
                value={billCity}
                onChangeText={setBillCity}
              />
              <TextInput
                style={[styles.input, styles.halfInput]}
                placeholder="State *"
                value={billState}
                onChangeText={setBillState}
              />
            </View>
            <View style={styles.row}>
              <TextInput
                style={[styles.input, styles.halfInput]}
                placeholder="ZIP Code *"
                value={billZip}
                onChangeText={setBillZip}
                keyboardType="number-pad"
              />
              <TextInput
                style={[styles.input, styles.halfInput]}
                placeholder="Phone *"
                value={billPhone}
                onChangeText={setBillPhone}
                keyboardType="phone-pad"
              />
            </View>
          </View>

          {/* Shipping Address */}
          <View style={styles.section}>
            <TouchableOpacity
              style={styles.checkboxRow}
              onPress={() => setSameAsBilling(!sameAsBilling)}
            >
              <Ionicons
                name={sameAsBilling ? 'checkbox' : 'square-outline'}
                size={24}
                color="#4CAF50"
              />
              <Text style={styles.checkboxLabel}>
                Shipping address same as billing
              </Text>
            </TouchableOpacity>

            {!sameAsBilling && (
              <>
                <Text style={styles.sectionTitle}>Shipping Address</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Full Name *"
                  value={shipName}
                  onChangeText={setShipName}
                />
                <TextInput
                  style={styles.input}
                  placeholder="Street Address *"
                  value={shipStreet}
                  onChangeText={setShipStreet}
                />
                <View style={styles.row}>
                  <TextInput
                    style={[styles.input, styles.halfInput]}
                    placeholder="City *"
                    value={shipCity}
                    onChangeText={setShipCity}
                  />
                  <TextInput
                    style={[styles.input, styles.halfInput]}
                    placeholder="State *"
                    value={shipState}
                    onChangeText={setShipState}
                  />
                </View>
                <View style={styles.row}>
                  <TextInput
                    style={[styles.input, styles.halfInput]}
                    placeholder="ZIP Code *"
                    value={shipZip}
                    onChangeText={setShipZip}
                    keyboardType="number-pad"
                  />
                  <TextInput
                    style={[styles.input, styles.halfInput]}
                    placeholder="Phone *"
                    value={shipPhone}
                    onChangeText={setShipPhone}
                    keyboardType="phone-pad"
                  />
                </View>
              </>
            )}
          </View>

          {/* Payment Note */}
          <View style={styles.paymentNote}>
            <Ionicons name="information-circle" size={20} color="#2196F3" />
            <Text style={styles.paymentNoteText}>
              Payment gateway integration (Razorpay) will be added soon.
            </Text>
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <TouchableOpacity
            style={styles.placeOrderButton}
            onPress={handlePlaceOrder}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Text style={styles.placeOrderButtonText}>Place Order</Text>
                <Text style={styles.placeOrderPrice}>${totalPrice.toFixed(2)}</Text>
              </>
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
  flex: {
    flex: 1,
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
  scrollContent: {
    paddingBottom: 32,
  },
  section: {
    backgroundColor: '#fff',
    marginTop: 16,
    padding: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  summaryLabel: {
    fontSize: 16,
    color: '#666',
  },
  summaryValue: {
    fontSize: 16,
    color: '#333',
  },
  totalLabel: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  totalValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#4CAF50',
  },
  input: {
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    marginBottom: 12,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  halfInput: {
    flex: 1,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  checkboxLabel: {
    fontSize: 16,
    color: '#333',
    marginLeft: 12,
  },
  paymentNote: {
    flexDirection: 'row',
    backgroundColor: '#E3F2FD',
    padding: 16,
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 8,
    gap: 12,
  },
  paymentNoteText: {
    flex: 1,
    fontSize: 14,
    color: '#1976D2',
  },
  footer: {
    backgroundColor: '#fff',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  placeOrderButton: {
    backgroundColor: '#4CAF50',
    paddingVertical: 16,
    borderRadius: 12,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  placeOrderButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  placeOrderPrice: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
});
