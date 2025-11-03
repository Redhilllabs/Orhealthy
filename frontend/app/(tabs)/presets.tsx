import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  ScrollView,
  Dimensions,
  Alert,
  Platform,
  TextInput,
} from 'react-native';
import { useState, useEffect } from 'react';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import { useCart } from '../../src/context/CartContext';
import { useAuth } from '../../src/context/AuthContext';
import { storage } from '../../src/utils/storage';
import { SafeAreaView } from 'react-native-safe-area-context';
import Modal from 'react-native-modal';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL + '/api';
const { width } = Dimensions.get('window');

interface Meal {
  _id: string;
  name?: string;
  meal_name?: string;
  description?: string;
  images?: string[];
  base_price?: number;
  calculated_price?: number;
  total_price?: number;
  tags?: string[];
  ingredients?: Array<{
    ingredient_id?: string;
    ingredient_name?: string;
    name?: string;
    price?: number;
    price_per_unit?: number;
    default_quantity?: number;
    quantity?: number;
    unit?: string;
    step_size?: number;
  }>;
  recipes?: Array<{
    recipe_id?: string;
    name?: string;
    price?: number;
    quantity?: number;
    step_size?: number;
  }>;
}

export default function PresetsScreen() {
  const [activeTab, setActiveTab] = useState<'meals' | 'combos'>('meals');
  const [allMeals, setAllMeals] = useState<Meal[]>([]);
  const [allCombos, setAllCombos] = useState<Meal[]>([]);
  const [myMeals, setMyMeals] = useState<Meal[]>([]);
  const [myCombos, setMyCombos] = useState<Meal[]>([]);
  const [mealsSubTab, setMealsSubTab] = useState<'all-meals' | 'my-meals'>('all-meals');
  const [combosSubTab, setCombosSubTab] = useState<'all-combos' | 'my-combos'>('all-combos');
  const [filteredItems, setFilteredItems] = useState<Meal[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMeal, setSelectedMeal] = useState<Meal | null>(null);
  const [customizations, setCustomizations] = useState<any[]>([]);
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [allTags, setAllTags] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [globalLoading, setGlobalLoading] = useState(false);
  
  // Custom alert modal
  const [showAlertModal, setShowAlertModal] = useState(false);
  const [alertMessage, setAlertMessage] = useState('');
  const [alertType, setAlertType] = useState<'success' | 'error'>('success');
  
  const { addToCart } = useCart();
  const { user } = useAuth();
  
  // Delete confirmation modal
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);

  const showAlert = (message: string, type: 'success' | 'error' = 'success') => {
    setAlertMessage(message);
    setAlertType(type);
    setShowAlertModal(true);
  };

  useEffect(() => {
    fetchAllData();
  }, []);

  useEffect(() => {
    let items: Meal[] = [];
    
    // Determine which items to show based on active tab and sub-tab
    if (activeTab === 'meals') {
      items = mealsSubTab === 'all-meals' ? allMeals : myMeals;
    } else {
      items = combosSubTab === 'all-combos' ? allCombos : myCombos;
    }

    // Extract tags from current tab items BEFORE filtering
    const tags = new Set<string>();
    items.forEach(item => {
      item.tags?.forEach(tag => tags.add(tag));
    });
    setAllTags(Array.from(tags).sort());

    // Apply search filter
    if (searchQuery) {
      items = items.filter(item => {
        const name = item.name || item.meal_name || '';
        return name.toLowerCase().includes(searchQuery.toLowerCase());
      });
    }

    // Apply tag filter
    if (selectedTag) {
      items = items.filter(item => item.tags?.includes(selectedTag));
    }

    // Sort alphabetically by name
    items = items.sort((a, b) => {
      const nameA = (a.name || a.meal_name || '').toLowerCase();
      const nameB = (b.name || b.meal_name || '').toLowerCase();
      return nameA.localeCompare(nameB);
    });

    setFilteredItems(items);
  }, [searchQuery, selectedTag, allMeals, allCombos, myMeals, myCombos, activeTab, mealsSubTab, combosSubTab]);

  // Reset selected tag when switching tabs
  useEffect(() => {
    setSelectedTag(null);
    setSearchQuery('');
  }, [activeTab]);

  const fetchAllData = async () => {
    await Promise.all([
      fetchAllMeals(),
      fetchAllCombos()
    ]);
  };

  const fetchAllMeals = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API_URL}/recipes`);
      setAllMeals(response.data);

      const tags = new Set<string>();
      response.data.forEach((item: Meal) => {
        item.tags?.forEach(tag => tags.add(tag));
      });
      setAllTags(prev => Array.from(new Set([...prev, ...Array.from(tags)])));
    } catch (error) {
      console.error('Error fetching recipes:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchAllCombos = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API_URL}/meals`);
      setAllCombos(response.data);

      const tags = new Set<string>();
      response.data.forEach((item: Meal) => {
        item.tags?.forEach(tag => tags.add(tag));
      });
      setAllTags(prev => Array.from(new Set([...prev, ...Array.from(tags)])));
    } catch (error) {
      console.error('Error fetching meals:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchMyMeals = async () => {
    try {
      const token = await storage.getItemAsync('session_token');
      if (!token || !user) return;

      const response = await axios.get(`${API_URL}/recipes?user_id=${user._id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      
      // Filter only user-created meals (not presets)
      const userMeals = response.data.filter((meal: any) => meal.created_by === user._id && !meal.is_preset);
      setMyMeals(userMeals);
    } catch (error) {
      console.error('Error fetching my recipes:', error);
    }
  };

  const fetchMyCombos = async () => {
    try {
      const token = await storage.getItemAsync('session_token');
      if (!token || !user) return;

      const response = await axios.get(`${API_URL}/meals?user_id=${user._id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      
      // Filter only user-created combos (not presets)
      const userCombos = response.data.filter((combo: any) => combo.created_by === user._id && !combo.is_preset);
      setMyCombos(userCombos);
    } catch (error) {
      console.error('Error fetching my meals:', error);
    }
  };

  const deleteSavedItem = async (itemId: string) => {
    console.log('deleteSavedItem called with:', itemId, 'activeTab:', activeTab, 'mealsSubTab:', mealsSubTab, 'combosSubTab:', combosSubTab);
    try {
      setGlobalLoading(true);
      const token = await storage.getItemAsync('session_token');
      
      // Determine which endpoint to use based on active tab
      let endpoint = '';
      if (activeTab === 'meals' && mealsSubTab === 'my-meals') {
        endpoint = `${API_URL}/recipes/${itemId}`;
      } else if (activeTab === 'combos' && combosSubTab === 'my-combos') {
        endpoint = `${API_URL}/meals/${itemId}`;
      } else {
        console.log('Cannot delete - wrong tab combination');
        showAlert('Cannot delete preset items', 'error');
        return;
      }
      
      console.log('Deleting from endpoint:', endpoint);
      const response = await axios.delete(endpoint, {
        headers: { Authorization: `Bearer ${token}` },
      });
      console.log('Delete response:', response.status);
      
      showAlert('Item deleted successfully', 'success');
      
      // Refresh the appropriate list based on active tab
      if (activeTab === 'meals') {
        fetchMyMeals();
      } else {
        fetchMyCombos();
      }
    } catch (error: any) {
      console.error('Error deleting item:', error.response?.data || error.message);
      showAlert('Failed to delete item', 'error');
    } finally {
      setGlobalLoading(false);
    }
  };

  const handleMealPress = (meal: Meal) => {
    setSelectedMeal(meal);
    // For combos, use recipes; for meals, use ingredients
    if (activeTab === 'combos') {
      setCustomizations(
        (meal.recipes || []).map(recipe => ({
          ...recipe,
          quantity: recipe.quantity || 1,
        }))
      );
    } else {
      setCustomizations(
        (meal.ingredients || []).map(ing => ({
          ...ing,
          quantity: ing.default_quantity || ing.quantity || 1,
        }))
      );
    }
  };

  const handleAddToCart = async () => {
    if (!selectedMeal) return;

    // Validate that at least one item has quantity > 0
    const hasItems = customizations.some(ing => (ing.quantity || 0) > 0);
    
    if (!hasItems) {
      showAlert('Please add at least one item', 'error');
      return;
    }

    // Close the selections modal first
    setSelectedMeal(null);
    
    try {
      setGlobalLoading(true);
      
      // Use the same calculation as calculateTotal() - direct sum only
      const totalPrice = customizations.reduce(
        (sum, ing) => sum + (ing.price || ing.price_per_unit || 0) * (ing.quantity || 0),
        0
      );

      // Filter out items with quantity 0
      const cartCustomizations = customizations
        .filter(ing => (ing.quantity || 0) > 0)
        .map(ing => ({
          ingredient_id: ing.ingredient_id || ing._id || '',
          name: ing.name || ing.ingredient_name || '',
          price: ing.price || ing.price_per_unit || 0,
          default_quantity: ing.default_quantity || ing.quantity || 1,
          quantity: ing.quantity || ing.default_quantity || 1,
        }));

      await addToCart({
        meal_id: selectedMeal._id || selectedMeal.meal_id,
        meal_name: selectedMeal.name || selectedMeal.meal_name || 'Custom Meal',
        customizations: cartCustomizations,
        quantity: 1,
        price: totalPrice,
      });

      showAlert('Added to cart!', 'success');
    } catch (error) {
      console.error('Error adding to cart:', error);
      showAlert('Failed to add to cart', 'error');
    } finally {
      setGlobalLoading(false);
    }
  };

  const updateCustomization = (index: number, quantity: number) => {
    const updated = [...customizations];
    updated[index] = { ...updated[index], quantity: Math.max(0, quantity) };
    setCustomizations(updated);
  };

  const calculateTotal = () => {
    // Direct summation of individual ingredient/meal costs based on their quantities
    const total = customizations.reduce(
      (sum, ing) => sum + (ing.price || ing.price_per_unit || 0) * (ing.quantity || 0),
      0
    );
    return total;
  };

  const renderMeal = ({ item }: { item: Meal }) => {
    const mealName = item.name || item.meal_name || 'Unnamed Item';
    const mealPrice = item.calculated_price || item.base_price || item.total_price || 0;
    const mealImage = item.images?.[0];

    return (
      <TouchableOpacity style={styles.mealCard} onPress={() => handleMealPress(item)}>
        {mealImage ? (
          <Image source={{ uri: mealImage }} style={styles.mealImage} />
        ) : (
          <View style={[styles.mealImage, styles.placeholderImage]}>
            <Ionicons name="fast-food" size={40} color="#ccc" />
          </View>
        )}
        <View style={styles.mealInfo}>
          <Text style={styles.mealName}>{mealName}</Text>
          {item.description && item.description.trim() && (
            <Text style={styles.mealDescription} numberOfLines={2}>
              {item.description}
            </Text>
          )}
          <View style={styles.mealFooter}>
            <Text style={styles.mealPrice}>₹{mealPrice.toFixed(2)}</Text>
            {((activeTab === 'meals' && mealsSubTab === 'my-meals') || 
              (activeTab === 'combos' && combosSubTab === 'my-combos')) && (
              <TouchableOpacity
                style={styles.deleteButton}
                onPress={(e) => {
                  console.log('DELETE BUTTON CLICKED!', item._id, item.name);
                  e.stopPropagation();
                  setItemToDelete(item._id);
                  setShowDeleteModal(true);
                }}
              >
                <Ionicons name="trash-outline" size={20} color="#ef4444" />
              </TouchableOpacity>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#ffd700" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* 2 Main Tabs - Sticky */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'meals' && styles.activeTab]}
          onPress={() => setActiveTab('meals')}
        >
          <Text style={[styles.tabText, activeTab === 'meals' && styles.activeTabText]}>
            Meals
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'combos' && styles.activeTab]}
          onPress={() => setActiveTab('combos')}
        >
          <Text style={[styles.tabText, activeTab === 'combos' && styles.activeTabText]}>
            Combos
          </Text>
        </TouchableOpacity>
      </View>

      {/* Search - Sticky */}
      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={20} color="#999" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search items..."
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>
      </View>

      {/* Tag filters - Sticky */}
      {allTags.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.tagsContainer}
          contentContainerStyle={styles.tagsContent}
        >
          <TouchableOpacity
            style={[styles.tagChip, !selectedTag && styles.tagChipActive]}
            onPress={() => setSelectedTag(null)}
          >
            <Text style={[styles.tagText, !selectedTag && styles.tagTextActive]}>All</Text>
          </TouchableOpacity>
          {allTags.map((tag) => (
            <TouchableOpacity
              key={tag}
              style={[styles.tagChip, selectedTag === tag && styles.tagChipActive]}
              onPress={() => setSelectedTag(tag)}
            >
              <Text style={[styles.tagText, selectedTag === tag && styles.tagTextActive]}>
                {tag}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {/* Items List */}
      <FlatList
        data={filteredItems}
        renderItem={renderMeal}
        keyExtractor={(item) => item._id}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="restaurant-outline" size={64} color="#ccc" />
            <Text style={styles.emptyText}>
              {((activeTab === 'meals' && mealsSubTab === 'my-meals') || 
                (activeTab === 'combos' && combosSubTab === 'my-combos')) 
                ? 'No saved items yet' 
                : 'No items available'}
            </Text>
            {((activeTab === 'meals' && mealsSubTab === 'my-meals') || 
              (activeTab === 'combos' && combosSubTab === 'my-combos')) && (
              <Text style={styles.emptySubtext}>Save items from DIY to see them here</Text>
            )}
          </View>
        }
      />

      {/* Detail Modal */}
      <Modal
        isVisible={selectedMeal !== null}
        onBackdropPress={() => setSelectedMeal(null)}
        style={styles.modalBottom}
      >
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>
              {selectedMeal?.name || selectedMeal?.meal_name || 'Details'}
            </Text>
            <TouchableOpacity onPress={() => setSelectedMeal(null)}>
              <Ionicons name="close" size={28} color="#333" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalBody}>
            {selectedMeal?.description && (
              <Text style={styles.modalDescription}>{selectedMeal.description}</Text>
            )}

            <Text style={styles.sectionTitle}>
              {activeTab === 'combos' ? 'Meals' : 'Ingredients'}
            </Text>
            {customizations.map((ing, index) => (
              <View key={index} style={styles.ingredientRow}>
                <View style={styles.ingredientInfo}>
                  <Text style={styles.ingredientName}>
                    {ing.name || ing.ingredient_name}
                  </Text>
                  {activeTab === 'combos' ? (
                    <Text style={styles.ingredientPrice}>
                      ₹{(ing.price || 0).toFixed(2)}/meal • Total: ₹{((ing.price || 0) * (ing.quantity || 1)).toFixed(2)}
                    </Text>
                  ) : (
                    <Text style={styles.ingredientPrice}>
                      ₹{(ing.price || ing.price_per_unit || 0).toFixed(2)}/{ing.unit || 'unit'} • Total: ₹{((ing.price || ing.price_per_unit || 0) * (ing.quantity || ing.default_quantity || 1)).toFixed(2)}
                    </Text>
                  )}
                </View>
                <View style={styles.quantityControl}>
                  {(ing.quantity || 0) > 0 ? (
                    <>
                      <TouchableOpacity
                        onPress={() => {
                          const stepSize = activeTab === 'combos' ? 1 : (ing.step_size || 1);
                          updateCustomization(index, Math.max(0, ing.quantity - stepSize));
                        }}
                      >
                        <Ionicons name="remove-circle" size={28} color="#ffd700" />
                      </TouchableOpacity>
                      <Text style={styles.quantity}>
                        {activeTab === 'combos' ? `${ing.quantity || 1}` : `${ing.quantity || ing.default_quantity || 1}`}
                      </Text>
                      <TouchableOpacity
                        onPress={() => {
                          const stepSize = activeTab === 'combos' ? 1 : (ing.step_size || 1);
                          updateCustomization(index, ing.quantity + stepSize);
                        }}
                      >
                        <Ionicons name="add-circle" size={28} color="#ffd700" />
                      </TouchableOpacity>
                    </>
                  ) : (
                    <TouchableOpacity
                      onPress={() => {
                        const stepSize = activeTab === 'combos' ? 1 : (ing.step_size || 1);
                        updateCustomization(index, stepSize);
                      }}
                      style={styles.addBackButton}
                    >
                      <Ionicons name="add-circle" size={32} color="#ffd700" />
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            ))}
          </ScrollView>

          <View style={styles.modalFooter}>
            <View>
              <Text style={styles.footerLabel}>Total</Text>
              <Text style={styles.footerPrice}>₹{calculateTotal().toFixed(2)}</Text>
            </View>
            <TouchableOpacity style={styles.addButton} onPress={handleAddToCart}>
              <Ionicons name="cart" size={20} color="#fff" />
              <Text style={styles.addButtonText}>Add to Cart</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isVisible={showDeleteModal}
        onBackdropPress={() => setShowDeleteModal(false)}
        style={styles.modal}
      >
        <View style={styles.deleteModalContent}>
          <View style={styles.deleteModalHeader}>
            <Text style={styles.deleteModalTitle}>Delete Item</Text>
          </View>
          
          <View style={styles.deleteModalBody}>
            <Text style={styles.deleteModalText}>
              Are you sure you want to delete this saved item?
            </Text>
          </View>
          
          <View style={styles.deleteModalFooter}>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => {
                console.log('Delete cancelled');
                setShowDeleteModal(false);
                setItemToDelete(null);
              }}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={styles.confirmDeleteButton}
              onPress={() => {
                console.log('Delete confirmed, calling deleteSavedItem');
                if (itemToDelete) {
                  deleteSavedItem(itemToDelete);
                }
                setShowDeleteModal(false);
                setItemToDelete(null);
              }}
            >
              <Text style={styles.confirmDeleteButtonText}>Delete</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
      
      {/* Custom Alert Modal */}
      <Modal
        isVisible={showAlertModal}
        onBackdropPress={() => setShowAlertModal(false)}
        style={styles.modal}
      >
        <View style={styles.alertModalContent}>
          <View style={styles.alertIcon}>
            <Ionicons name="checkmark-circle" size={60} color="#4CAF50" />
          </View>
          <Text style={styles.alertMessage}>{alertMessage}</Text>
          <TouchableOpacity
            style={styles.alertButton}
            onPress={() => setShowAlertModal(false)}
          >
            <Text style={styles.alertButtonText}>OK</Text>
          </TouchableOpacity>
        </View>
      </Modal>
      
      {/* Global Loading Overlay */}
      {globalLoading && (
        <View style={styles.loadingOverlay}>
          <View style={styles.loadingOverlayContent}>
            <ActivityIndicator size="large" color="#ffd700" />
            <Text style={styles.loadingOverlayText}>Processing...</Text>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    paddingBottom: 80,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tabContainer: {
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    flexDirection: 'row',
  },
  tab: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
    height: 40,
  },
  activeTab: {
    borderBottomColor: '#ffd700',
  },
  tabText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#666',
  },
  activeTabText: {
    color: '#ffd700',
    fontWeight: '700',
  },
  subTabContainer: {
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    marginTop: 0,
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 12,
    justifyContent: 'space-evenly',
  },
  subTab: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
    backgroundColor: '#f5f5f5',
  },
  activeSubTab: {
    backgroundColor: '#ffd700',
  },
  subTabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  activeSubTabText: {
    color: '#333',
  },
  searchContainer: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 16,
    outlineStyle: 'none',
  },
  tagsContainer: {
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    maxHeight: 60,
    marginTop: 0,
  },
  tagsContent: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 8,
    alignItems: 'center',
  },
  tagChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#f5f5f5',
    borderWidth: 1,
    borderColor: '#ddd',
    minWidth: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tagChipActive: {
    backgroundColor: '#ffd700',
    borderColor: '#ffd700',
  },
  tagText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  tagTextActive: {
    color: '#fff',
  },
  listContent: {
    paddingTop: 12,
    paddingBottom: 16,
  },
  mealCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 12,
    marginHorizontal: 16,
    overflow: 'hidden',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  mealImage: {
    width: '100%',
    height: 180,
  },
  placeholderImage: {
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  mealInfo: {
    padding: 16,
  },
  mealName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  mealDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 12,
  },
  mealFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  mealPrice: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#ffd700',
  },
  deleteButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#fee',
    zIndex: 10,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 80,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#666',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#999',
    marginTop: 8,
  },
  modal: {
    justifyContent: 'center',
    alignItems: 'center',
    margin: 0,
  },
  modalBottom: {
    margin: 0,
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
    flex: 1,
  },
  modalBody: {
    padding: 20,
  },
  modalDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
  },
  ingredientRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  ingredientInfo: {
    flex: 1,
  },
  ingredientName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  ingredientPrice: {
    fontSize: 14,
    color: '#666',
  },
  quantityControl: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  quantity: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    minWidth: 32,
    textAlign: 'center',
  },
  addBackButton: {
    padding: 4,
  },
  modalFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  footerLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  footerPrice: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ffd700',
  },
  addButton: {
    backgroundColor: '#ffd700',
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
    gap: 8,
  },
  addButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  deleteModalContent: {
    backgroundColor: '#fff',
    borderRadius: 20,
    margin: 20,
    maxWidth: 400,
    alignSelf: 'center',
  },
  deleteModalHeader: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    alignItems: 'center',
  },
  deleteModalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  deleteModalBody: {
    padding: 20,
    alignItems: 'center',
  },
  deleteModalText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 24,
  },
  deleteModalFooter: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 16,
    alignItems: 'center',
    borderRightWidth: 1,
    borderRightColor: '#eee',
  },
  cancelButtonText: {
    fontSize: 16,
    color: '#666',
    fontWeight: '600',
  },
  confirmDeleteButton: {
    flex: 1,
    paddingVertical: 16,
    alignItems: 'center',
  },
  confirmDeleteButtonText: {
    fontSize: 16,
    color: '#ef4444',
    fontWeight: '600',
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 9999,
  },
  loadingOverlayContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
    minWidth: 200,
  },
  loadingOverlayText: {
    marginTop: 16,
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  alertModalContent: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 32,
    alignItems: 'center',
    maxWidth: 400,
  },
  alertIcon: {
    marginBottom: 16,
  },
  alertMessage: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    textAlign: 'center',
    marginBottom: 24,
  },
  alertButton: {
    backgroundColor: '#ffd700',
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 12,
    minWidth: 120,
  },
  alertButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
  },
});
