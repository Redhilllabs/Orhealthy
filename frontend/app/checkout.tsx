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
  Modal,
  Switch,
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

interface Address {
  label: string;
  full_address: string;
  city: string;
  state: string;
  pincode: string;
  phone: string;
  is_default: boolean;
}

export default function CheckoutScreen() {
  const router = useRouter();
  const { cartItems, totalPrice, clearCart } = useCart();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [showThankYou, setShowThankYou] = useState(false);
  const [itemsExpanded, setItemsExpanded] = useState(false);
  const [showAddressModal, setShowAddressModal] = useState(false);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [guideeAddresses, setGuideeAddresses] = useState<Address[]>([]);
  const [selectedAddressIndex, setSelectedAddressIndex] = useState<number | null>(null);
  const [selectedGuideeAddressIndex, setSelectedGuideeAddressIndex] = useState<number | null>(null);

  // Coupon state
  const [couponCode, setCouponCode] = useState('');
  const [couponApplied, setCouponApplied] = useState(false);
  const [couponDiscount, setCouponDiscount] = useState(0);
  const [validatingCoupon, setValidatingCoupon] = useState(false);

  // Guide ordering state
  const [orderingForGuidee, setOrderingForGuidee] = useState(false);
  const [guidees, setGuidees] = useState<any[]>([]);
  const [selectedGuidee, setSelectedGuidee] = useState<any | null>(null);
  const [commissionRate, setCommissionRate] = useState(0);
  const [commissionAmount, setCommissionAmount] = useState(0);

  // New address form
  const [newAddressLabel, setNewAddressLabel] = useState('');
  const [newAddressApartment, setNewAddressApartment] = useState('');
  const [newAddressStreet, setNewAddressStreet] = useState('');
  const [newAddressCity, setNewAddressCity] = useState('');
  const [newAddressState, setNewAddressState] = useState('');
  const [newAddressZip, setNewAddressZip] = useState('');
  const [newAddressPhone, setNewAddressPhone] = useState('');

  // Preorder and delivery state
  const [isPreorder, setIsPreorder] = useState(false);
  const [showPreorderModal, setShowPreorderModal] = useState(false);
  const [preorderDate, setPreorderDate] = useState('');
  const [preorderTime, setPreorderTime] = useState('');
  const [deliveryConfig, setDeliveryConfig] = useState({ delivery_price: 50, min_order_for_free_delivery: 500 });
  const [storeTimings, setStoreTimings] = useState({ 
    opening_time: '6:00 AM', 
    closing_time: '9:00 PM',
    preorder_before_time: 120, // minutes
    preorder_cutoff_time: '10:00 PM'
  });
  const [timeSlots, setTimeSlots] = useState<string[]>([]);
  const [showStoreClosedAlert, setShowStoreClosedAlert] = useState(false);
  const [isWithinStoreHours, setIsWithinStoreHours] = useState(true);

  useEffect(() => {
    fetchAddresses();
    if (user?.is_guide) {
      fetchGuidees();
    }
  }, [user]);

  useEffect(() => {
    if (selectedGuidee) {
      fetchGuideeAddresses(selectedGuidee._id);
    }
  }, [selectedGuidee]);

  useEffect(() => {
    if (user?.is_guide && orderingForGuidee) {
      calculateCommission();
    }
  }, [orderingForGuidee, couponDiscount, totalPrice]);

  useEffect(() => {
    fetchDeliveryConfig();
    fetchStoreTimings();
  }, []);

  useEffect(() => {
    if (storeTimings.opening_time && storeTimings.closing_time) {
      setIsWithinStoreHours(checkStoreHours());
      generateTimeSlots();
    }
  }, [storeTimings]);

  useEffect(() => {
    if (preorderDate) {
      generateTimeSlots();
    }
  }, [preorderDate]);

  const fetchAddresses = async () => {
    try {
      const token = await storage.getItemAsync('session_token');
      const response = await axios.get(`${API_URL}/addresses`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setAddresses(response.data);
      // Auto-select default address
      const defaultIndex = response.data.findIndex((addr: Address) => addr.is_default);
      if (defaultIndex !== -1) {
        setSelectedAddressIndex(defaultIndex);
      }
    } catch (error) {
      console.error('Error fetching addresses:', error);
    }
  };

  const fetchGuideeAddresses = async (guideeId: string) => {
    try {
      const token = await storage.getItemAsync('session_token');
      const response = await axios.get(`${API_URL}/users/${guideeId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setGuideeAddresses(response.data.addresses || []);
    } catch (error) {
      console.error('Error fetching guidee addresses:', error);
      setGuideeAddresses([]);
    }
  };

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

  const saveNewAddress = async () => {
    if (!newAddressLabel || !newAddressStreet || !newAddressCity || !newAddressState || !newAddressZip || !newAddressPhone) {
      Alert.alert('Error', 'Please fill all required address fields');
      return;
    }

    try {
      const token = await storage.getItemAsync('session_token');
      
      // Combine apartment and street address
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

  const calculateCommission = async () => {
    if (!user?.star_rating) return;
    
    try {
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

  const fetchDeliveryConfig = async () => {
    try {
      const response = await axios.get(`${API_URL}/config/delivery`);
      setDeliveryConfig(response.data);
    } catch (error) {
      console.error('Error fetching delivery config:', error);
    }
  };

  const fetchStoreTimings = async () => {
    try {
      const response = await axios.get(`${API_URL}/config/store-timings`);
      setStoreTimings(response.data);
    } catch (error) {
      console.error('Error fetching store timings:', error);
    }
  };

  const parseTime = (timeStr: string) => {
    const [time, period] = timeStr.split(' ');
    let [hours, minutes] = time.split(':').map(Number);
    if (period === 'PM' && hours !== 12) hours += 12;
    if (period === 'AM' && hours === 12) hours = 0;
    return hours * 60 + minutes;
  };

  const formatTime = (minutes: number) => {
    let hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    const period = hours >= 12 ? 'PM' : 'AM';
    if (hours > 12) hours -= 12;
    if (hours === 0) hours = 12;
    return `${hours}:${mins.toString().padStart(2, '0')} ${period}`;
  };

  const getISTTime = () => {
    const now = new Date();
    const utcTime = now.getTime() + (now.getTimezoneOffset() * 60000);
    const istTime = new Date(utcTime + (3600000 * 5.5)); // IST is UTC+5:30
    return istTime;
  };

  const checkStoreHours = () => {
    const istNow = getISTTime();
    const currentMinutes = istNow.getHours() * 60 + istNow.getMinutes();
    const openMinutes = parseTime(storeTimings.opening_time);
    const closeMinutes = parseTime(storeTimings.closing_time);
    
    return currentMinutes >= openMinutes && currentMinutes <= closeMinutes;
  };

  const generateTimeSlots = () => {
    const slots: string[] = [];
    const istNow = getISTTime();
    const currentMinutes = istNow.getHours() * 60 + istNow.getMinutes();
    
    let startMinutes = parseTime(storeTimings.opening_time);
    const endMinutes = parseTime(storeTimings.closing_time);

    // If ordering for today and is preorder, adjust start time
    if (preorderDate === getISTTime().toISOString().split('T')[0]) {
      const minStartTime = currentMinutes + storeTimings.preorder_before_time;
      startMinutes = Math.max(startMinutes, Math.ceil(minStartTime / 30) * 30);
    }

    for (let i = startMinutes; i <= endMinutes; i += 30) {
      slots.push(formatTime(i));
    }

    setTimeSlots(slots);
  };

  const getMinDate = () => {
    const istNow = getISTTime();
    const cutoffMinutes = parseTime(storeTimings.preorder_cutoff_time);
    const currentMinutes = istNow.getHours() * 60 + istNow.getMinutes();
    
    // If past cutoff time, minimum date is day after tomorrow
    if (currentMinutes >= cutoffMinutes) {
      const dayAfterTomorrow = new Date(istNow);
      dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 2);
      return dayAfterTomorrow.toISOString().split('T')[0];
    }
    
    // Check if can order for today
    const openMinutes = parseTime(storeTimings.opening_time);
    const closeMinutes = parseTime(storeTimings.closing_time);
    const earliestOrderTime = openMinutes - storeTimings.preorder_before_time;
    const latestOrderTime = closeMinutes - storeTimings.preorder_before_time;
    
    if (currentMinutes >= earliestOrderTime && currentMinutes <= latestOrderTime) {
      // Can order for today
      return istNow.toISOString().split('T')[0];
    }
    
    // Default: tomorrow
    const tomorrow = new Date(istNow);
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().split('T')[0];
  };

  const handlePreorderToggle = (value: boolean) => {
    if (value) {
      // Check if current time is before 10 PM IST
      const now = new Date();
      const istOffset = 5.5 * 60 * 60 * 1000;
      const istTime = new Date(now.getTime() + istOffset);
      const istHours = istTime.getUTCHours();
      
      if (istHours >= 22) {
        Alert.alert('Preorder Closed', 'Preorders must be placed before 10 PM IST');
        return;
      }
      setShowPreorderModal(true);
    } else {
      setIsPreorder(false);
      setPreorderDate('');
      setPreorderTime('');
    }
  };

  const savePreorderDetails = () => {
    if (!preorderDate || !preorderTime) {
      Alert.alert('Error', 'Please select both date and time');
      return;
    }
    setIsPreorder(true);
    setShowPreorderModal(false);
    Alert.alert('Success', 'Preorder details saved');
  };

  const calculateDeliveryCharge = () => {
    const subtotal = totalPrice - couponDiscount;
    if (subtotal >= deliveryConfig.min_order_for_free_delivery) {
      return 0;
    }
    return deliveryConfig.delivery_price;
  };

  const deliveryCharge = calculateDeliveryCharge();

  const handlePlaceOrder = async () => {
    let deliveryAddress: Address;

    if (orderingForGuidee) {
      if (!selectedGuidee) {
        Alert.alert('Error', 'Please select a guidee');
        return;
      }
      if (selectedGuideeAddressIndex === null) {
        Alert.alert('Error', 'Please select a delivery address for the guidee');
        return;
      }
      deliveryAddress = guideeAddresses[selectedGuideeAddressIndex];
    } else {
      if (selectedAddressIndex === null) {
        Alert.alert('Error', 'Please select or add a delivery address');
        return;
      }
      deliveryAddress = addresses[selectedAddressIndex];
    }

    // Check if outside store hours and not preorder
    if (!isWithinStoreHours && !isPreorder) {
      setShowStoreClosedAlert(true);
      return;
    }

    try {
      setLoading(true);
      const token = await storage.getItemAsync('session_token');

      const orderData: any = {
        items: cartItems,
        total_price: totalPrice,
        discount_amount: couponDiscount,
        coupon_code: couponApplied ? couponCode : null,
        delivery_charge: deliveryCharge,
        final_price: totalPrice - couponDiscount + deliveryCharge,
        billing_address: deliveryAddress,
        shipping_address: deliveryAddress,
        payment_id: 'COD',
        is_preorder: isPreorder,
        preorder_date: isPreorder ? preorderDate : null,
        preorder_time: isPreorder ? preorderTime : null,
      };

      if (orderingForGuidee && selectedGuidee) {
        orderData.ordered_by_guide_id = user?._id;
        orderData.ordered_for_guidee_id = selectedGuidee._id;
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

  const finalPrice = totalPrice - couponDiscount + deliveryCharge;

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
              <View style={styles.couponInputContainer}>
                <TextInput
                  style={styles.couponTextInput}
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

          {/* Preorder Section */}
          <View style={styles.preorderContainer}>
            <View style={styles.preorderRow}>
              <Text style={styles.preorderLabel}>Preorder?</Text>
              <Switch
                value={isPreorder}
                onValueChange={handlePreorderToggle}
                trackColor={{ false: '#d1d5db', true: '#fcd34d' }}
                thumbColor={isPreorder ? '#ffd700' : '#f4f3f4'}
              />
            </View>
            {isPreorder && preorderDate && preorderTime && (
              <View style={styles.preorderDetails}>
                <Text style={styles.preorderDetailsText}>
                  📅 {preorderDate} at {preorderTime}
                </Text>
                <TouchableOpacity onPress={() => setShowPreorderModal(true)}>
                  <Text style={styles.changePreorderText}>Change</Text>
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
                onPress={() => {
                  setOrderingForGuidee(!orderingForGuidee);
                  if (orderingForGuidee) {
                    setSelectedGuidee(null);
                    setSelectedGuideeAddressIndex(null);
                  }
                }}
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
                        selectedGuidee?._id === guidee._id && styles.guideeOptionSelected,
                      ]}
                      onPress={() => setSelectedGuidee(guidee)}
                    >
                      <Text
                        style={[
                          styles.guideeName,
                          selectedGuidee?._id === guidee._id && styles.guideeNameSelected,
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

          {/* Address Selection */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>
                {orderingForGuidee ? 'Guidee Delivery Address' : 'Delivery Address'}
              </Text>
              {!orderingForGuidee && (
                <TouchableOpacity onPress={() => setShowAddressModal(true)}>
                  <Text style={styles.addAddressButton}>+ Add New</Text>
                </TouchableOpacity>
              )}
            </View>

            {orderingForGuidee ? (
              guideeAddresses.length > 0 ? (
                guideeAddresses.map((addr, index) => (
                  <TouchableOpacity
                    key={index}
                    style={[
                      styles.addressCard,
                      selectedGuideeAddressIndex === index && styles.addressCardSelected,
                    ]}
                    onPress={() => setSelectedGuideeAddressIndex(index)}
                  >
                    <View style={styles.addressHeader}>
                      <Text style={styles.addressLabel}>{addr.label}</Text>
                      {selectedGuideeAddressIndex === index && (
                        <Ionicons name="checkmark-circle" size={24} color="#10b981" />
                      )}
                    </View>
                    <Text style={styles.addressText}>{addr.full_address}</Text>
                    <Text style={styles.addressText}>
                      {addr.city}, {addr.state} - {addr.pincode}
                    </Text>
                    <Text style={styles.addressText}>☎ {addr.phone}</Text>
                  </TouchableOpacity>
                ))
              ) : (
                <Text style={styles.noAddressText}>
                  Guidee has no saved addresses. Please ask them to add addresses in their profile.
                </Text>
              )
            ) : (
              addresses.length > 0 ? (
                addresses.map((addr, index) => (
                  <TouchableOpacity
                    key={index}
                    style={[
                      styles.addressCard,
                      selectedAddressIndex === index && styles.addressCardSelected,
                    ]}
                    onPress={() => setSelectedAddressIndex(index)}
                  >
                    <View style={styles.addressHeader}>
                      <Text style={styles.addressLabel}>{addr.label}</Text>
                      {selectedAddressIndex === index && (
                        <Ionicons name="checkmark-circle" size={24} color="#10b981" />
                      )}
                    </View>
                    <Text style={styles.addressText}>{addr.full_address}</Text>
                    <Text style={styles.addressText}>
                      {addr.city}, {addr.state} - {addr.pincode}
                    </Text>
                    <Text style={styles.addressText}>☎ {addr.phone}</Text>
                  </TouchableOpacity>
                ))
              ) : (
                <Text style={styles.noAddressText}>
                  No saved addresses. Please add an address to continue.
                </Text>
              )
            )}
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
            <View style={styles.priceRow}>
              <Text style={styles.priceLabel}>Delivery Charge</Text>
              <Text style={styles.priceValue}>
                {deliveryCharge === 0 ? 'FREE' : `₹${deliveryCharge.toFixed(2)}`}
              </Text>
            </View>
            {deliveryCharge === 0 && totalPrice - couponDiscount >= deliveryConfig.min_order_for_free_delivery && (
              <Text style={styles.freeDeliveryText}>
                🎉 You've unlocked free delivery!
              </Text>
            )}
            
            <View style={[styles.priceRow, styles.totalRow]}>
              <Text style={styles.totalLabel}>To Pay</Text>
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
              <TouchableOpacity style={styles.saveAddressButton} onPress={saveNewAddress}>
                <Text style={styles.saveAddressButtonText}>Save Address</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Preorder Modal */}
      <Modal
        visible={showPreorderModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowPreorderModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.preorderModalContent}>
            <Text style={styles.preorderModalTitle}>Select Preorder Details</Text>
            
            <View style={styles.preorderInputGroup}>
              <Text style={styles.preorderInputLabel}>Delivery Date</Text>
              <input
                type="date"
                style={{
                  width: '100%',
                  padding: '12px',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontFamily: 'inherit',
                  cursor: 'pointer',
                  boxSizing: 'border-box',
                }}
                value={preorderDate}
                onChange={(e) => setPreorderDate(e.target.value)}
                min={getMinDate()}
              />
            </View>

            <View style={styles.preorderInputGroup}>
              <Text style={styles.preorderInputLabel}>Delivery Time</Text>
              <ScrollView style={styles.timeSlotsList}>
                {timeSlots.map((slot) => (
                  <TouchableOpacity
                    key={slot}
                    style={[
                      styles.timeSlotButton,
                      preorderTime === slot && styles.timeSlotButtonActive,
                    ]}
                    onPress={() => setPreorderTime(slot)}
                  >
                    <Text
                      style={[
                        styles.timeSlotText,
                        preorderTime === slot && styles.timeSlotTextActive,
                      ]}
                    >
                      {slot}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            <View style={styles.preorderModalActions}>
              <TouchableOpacity
                style={styles.preorderCancelButton}
                onPress={() => {
                  setShowPreorderModal(false);
                  setIsPreorder(false);
                }}
              >
                <Text style={styles.preorderCancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.preorderSaveButton}
                onPress={savePreorderDetails}
              >
                <Text style={styles.preorderSaveButtonText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Store Closed Alert Modal */}
      <Modal
        visible={showStoreClosedAlert}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setShowStoreClosedAlert(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.storeClosedModalContent}>
            <Ionicons name="time-outline" size={60} color="#ef4444" />
            <Text style={styles.storeClosedTitle}>Store is Closed</Text>
            <Text style={styles.storeClosedMessage}>
              We're currently closed. You can place a preorder for tomorrow or visit us during our operating hours:
            </Text>
            <Text style={styles.storeHours}>
              {storeTimings.opening_time} - {storeTimings.closing_time}
            </Text>
            <View style={styles.storeClosedActions}>
              <TouchableOpacity
                style={styles.preorderNowButton}
                onPress={() => {
                  setShowStoreClosedAlert(false);
                  handlePreorderToggle(true);
                }}
              >
                <Text style={styles.preorderNowButtonText}>Preorder Now</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.okButton}
                onPress={() => setShowStoreClosedAlert(false)}
              >
                <Text style={styles.okButtonText}>OK</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Store Closed Alert Modal */}
      <Modal
        visible={showStoreClosedAlert}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setShowStoreClosedAlert(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.alertModalContent}>
            <Text style={styles.alertModalTitle}>🕒 Kitchen Closed</Text>
            <Text style={styles.alertModalMessage}>
              Our kitchen is currently closed.{'\n\n'}
              <Text style={{ fontWeight: '600' }}>Opening Hours:</Text>{'\n'}
              {storeTimings.opening_time} - {storeTimings.closing_time}
            </Text>
            <Text style={styles.alertModalSubtext}>
              Would you like to place a preorder instead?
            </Text>
            <View style={styles.alertModalActions}>
              <TouchableOpacity
                style={styles.alertModalCancelButton}
                onPress={() => setShowStoreClosedAlert(false)}
              >
                <Text style={styles.alertModalCancelButtonText}>OK</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.alertModalConfirmButton}
                onPress={() => {
                  setShowStoreClosedAlert(false);
                  handlePreorderToggle(true);
                }}
              >
                <Text style={styles.alertModalConfirmButtonText}>Preorder Now</Text>
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
  addAddressButton: {
    color: '#3b82f6',
    fontSize: 14,
    fontWeight: '600',
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
  couponInputContainer: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'stretch',
  },
  couponTextInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
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
    minWidth: 80,
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
  addressCard: {
    padding: 12,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    marginBottom: 12,
  },
  addressCardSelected: {
    borderColor: '#10b981',
    backgroundColor: '#ecfdf5',
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
  noAddressText: {
    fontSize: 14,
    color: '#999',
    fontStyle: 'italic',
    textAlign: 'center',
    paddingVertical: 20,
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
  modalFooter: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  saveAddressButton: {
    backgroundColor: '#ffd700',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  saveAddressButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  freeDeliveryText: {
    fontSize: 14,
    color: '#10b981',
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 8,
  },
  preorderContainer: {
    backgroundColor: '#fef3c7',
    padding: 16,
    borderRadius: 8,
    marginVertical: 12,
  },
  preorderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  preorderLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e293b',
  },
  preorderDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#fde68a',
  },
  preorderDetailsText: {
    fontSize: 14,
    color: '#92400e',
    fontWeight: '500',
  },
  changePreorderText: {
    fontSize: 14,
    color: '#3b82f6',
    fontWeight: '600',
  },
  preorderModalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    maxHeight: '80%',
  },
  preorderModalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1e293b',
    marginBottom: 20,
  },
  preorderInputGroup: {
    marginBottom: 20,
  },
  preorderInputLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 8,
  },
  timeSlotsList: {
    maxHeight: 200,
  },
  timeSlotButton: {
    backgroundColor: '#f8fafc',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  timeSlotButtonActive: {
    backgroundColor: '#fef3c7',
    borderColor: '#ffd700',
  },
  timeSlotText: {
    fontSize: 16,
    color: '#64748b',
    textAlign: 'center',
  },
  timeSlotTextActive: {
    color: '#1e293b',
    fontWeight: '600',
  },
  preorderModalActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
  },
  preorderCancelButton: {
    flex: 1,
    backgroundColor: '#f1f5f9',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  preorderCancelButtonText: {
    color: '#64748b',
    fontSize: 16,
    fontWeight: '600',
  },
  preorderSaveButton: {
    flex: 1,
    backgroundColor: '#ffd700',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  preorderSaveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  storeClosedModalContent: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 24,
    margin: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  storeClosedTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ef4444',
    marginTop: 16,
    marginBottom: 12,
  },
  storeClosedMessage: {
    fontSize: 16,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 16,
  },
  storeHours: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 24,
  },
  storeClosedActions: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  preorderNowButton: {
    flex: 1,
    backgroundColor: '#ffd700',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  preorderNowButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  okButton: {
    flex: 1,
    backgroundColor: '#f1f5f9',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  okButtonText: {
    color: '#64748b',
    fontSize: 16,
    fontWeight: '600',
  },
  alertModalContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    width: '85%',
    maxWidth: 400,
  },
  alertModalTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#1e293b',
    marginBottom: 16,
    textAlign: 'center',
  },
  alertModalMessage: {
    fontSize: 16,
    color: '#64748b',
    lineHeight: 24,
    textAlign: 'center',
    marginBottom: 12,
  },
  alertModalSubtext: {
    fontSize: 14,
    color: '#92400e',
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 20,
  },
  alertModalActions: {
    flexDirection: 'row',
    gap: 12,
  },
  alertModalCancelButton: {
    flex: 1,
    backgroundColor: '#f1f5f9',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  alertModalCancelButtonText: {
    color: '#64748b',
    fontSize: 16,
    fontWeight: '600',
  },
  alertModalConfirmButton: {
    flex: 1,
    backgroundColor: '#ffd700',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  alertModalConfirmButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
