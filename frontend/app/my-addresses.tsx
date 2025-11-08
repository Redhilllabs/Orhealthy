import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput, Modal, Alert, ActivityIndicator } from 'react-native';
import { useState, useEffect } from 'react';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import { storage } from '../src/utils/storage';
import { useAuth } from '../src/context/AuthContext';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL + '/api';

interface Address {
  label: string;
  apartment: string;
  full_address: string;
  city: string;
  state: string;
  pincode: string;
  phone: string;
  is_default: boolean;
}

export default function MyAddressesScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddressModal, setShowAddressModal] = useState(false);
  const [editingAddressIndex, setEditingAddressIndex] = useState<number | null>(null);
  const [newAddressLabel, setNewAddressLabel] = useState('');
  const [newAddressApartment, setNewAddressApartment] = useState('');
  const [newAddressStreet, setNewAddressStreet] = useState('');
  const [newAddressCity, setNewAddressCity] = useState('');
  const [newAddressState, setNewAddressState] = useState('');
  const [newAddressZip, setNewAddressZip] = useState('');
  const [newAddressPhone, setNewAddressPhone] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteAddressIndex, setDeleteAddressIndex] = useState<number | null>(null);

  useEffect(() => {
    fetchAddresses();
  }, []);

  const fetchAddresses = async () => {
    try {
      setLoading(true);
      const token = await storage.getItemAsync('session_token');
      const response = await axios.get(`${API_URL}/addresses`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setAddresses(response.data || []);
    } catch (error) {
      console.error('Error fetching addresses:', error);
      setAddresses([]);
    } finally {
      setLoading(false);
    }
  };

  const openAddressModal = (index: number | null = null) => {
    if (index !== null) {
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
        await axios.put(
          `${API_URL}/addresses/${editingAddressIndex}`,
          addressData,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        Alert.alert('Success', 'Address updated successfully');
      } else {
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
      Alert.alert('Success', 'Address deleted successfully');
      await fetchAddresses();
    } catch (error: any) {
      console.error('Error deleting address:', error);
      Alert.alert('Error', 'Failed to delete address');
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Addresses</Text>
        <View style={{ width: 40 }} />
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#ffd700" />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          <TouchableOpacity
            style={styles.addButton}
            onPress={() => openAddressModal(null)}
          >
            <Ionicons name="add-circle" size={24} color="#ffd700" />
            <Text style={styles.addButtonText}>Add New Address</Text>
          </TouchableOpacity>

          {addresses.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="location-outline" size={80} color="#ccc" />
              <Text style={styles.emptyText}>No saved addresses</Text>
            </View>
          ) : (
            addresses.map((addr, index) => (
              <View key={index} style={styles.addressCard}>
                <View style={styles.addressHeader}>
                  <Text style={styles.addressLabel}>{addr.label}</Text>
                  <View style={styles.addressActions}>
                    <TouchableOpacity
                      onPress={() => openAddressModal(index)}
                      style={styles.addressActionButton}
                    >
                      <Ionicons name="pencil-outline" size={20} color="#6366f1" />
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => {
                        setDeleteAddressIndex(index);
                        setShowDeleteConfirm(true);
                      }}
                      style={styles.addressActionButton}
                    >
                      <Ionicons name="trash-outline" size={20} color="#ef4444" />
                    </TouchableOpacity>
                  </View>
                </View>
                <Text style={styles.addressText}>{addr.full_address}</Text>
                <Text style={styles.addressText}>
                  {addr.city}, {addr.state} - {addr.pincode}
                </Text>
                <Text style={styles.addressText}>☎ {addr.phone}</Text>
              </View>
            ))
          )}
        </ScrollView>
      )}

      {/* Add/Edit Address Modal */}
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
              <TouchableOpacity
                style={styles.saveButton}
                onPress={saveNewAddress}
              >
                <Text style={styles.saveButtonText}>Save Address</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Delete Confirmation Modal */}
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
  content: {
    padding: 16,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f9f9f9',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  addButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffd700',
    marginLeft: 12,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 16,
    color: '#999',
    marginTop: 16,
  },
  addressCard: {
    backgroundColor: '#f9f9f9',
    borderRadius: 12,
    padding: 16,
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
  addressActions: {
    flexDirection: 'row',
    gap: 12,
  },
  addressActionButton: {
    padding: 4,
  },
  addressText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
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
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 12,
  },
  modalFooter: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  saveButton: {
    backgroundColor: '#ffd700',
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
  },
});