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
} from 'react-native';
import { useState, useEffect } from 'react';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import { useCart } from '../../src/context/CartContext';
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
  total_price?: number;
  tags?: string[];
  ingredients: Array<{
    ingredient_id?: string;
    ingredient_name?: string;
    name?: string;
    price?: number;
    price_per_unit?: number;
    default_quantity?: number;
    quantity?: number;
    unit?: string;
    step_size?: number; // Added step_size from recipe
  }>;
}

export default function PresetsScreen() {
  const [activeTab, setActiveTab] = useState<'my' | 'all'>('my');
  const [meals, setMeals] = useState<Meal[]>([]);
  const [savedMeals, setSavedMeals] = useState<Meal[]>([]);
  const [filteredMeals, setFilteredMeals] = useState<Meal[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMeal, setSelectedMeal] = useState<Meal | null>(null);
  const [customizations, setCustomizations] = useState<any[]>([]);
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [allTags, setAllTags] = useState<string[]>([]);
  const { addToCart } = useCart();

  useEffect(() => {
    fetchMeals();
    fetchSavedMeals();
  }, []);

  useEffect(() => {
    if (activeTab === 'all') {
      if (selectedTag) {
        setFilteredMeals(meals.filter(meal => meal.tags?.includes(selectedTag)));
      } else {
        setFilteredMeals(meals);
      }
    } else {
      setFilteredMeals(savedMeals);
    }
  }, [selectedTag, meals, savedMeals, activeTab]);

  const fetchMeals = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API_URL}/meals`);
      setMeals(response.data);

      const tags = new Set<string>();
      response.data.forEach((meal: Meal) => {
        meal.tags?.forEach(tag => tags.add(tag));
      });
      setAllTags(Array.from(tags));
    } catch (error) {
      console.error('Error fetching meals:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchSavedMeals = async () => {
    try {
      const token = await storage.getItemAsync('session_token');
      if (!token) return;

      const response = await axios.get(`${API_URL}/saved-meals`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setSavedMeals(response.data);
    } catch (error) {
      console.error('Error fetching saved meals:', error);
    }
  };

  const deleteSavedMeal = async (mealId: string) => {
    try {
      const token = await storage.getItemAsync('session_token');
      await axios.delete(`${API_URL}/saved-meals/${mealId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      Alert.alert('Success', 'Meal deleted successfully');
      fetchSavedMeals();
    } catch (error) {
      console.error('Error deleting saved meal:', error);
      Alert.alert('Error', 'Failed to delete meal');
    }
  };

  const handleMealPress = (meal: Meal) => {
    setSelectedMeal(meal);
    if (activeTab === 'my') {
      // Saved meals already have ingredients with quantities
      setCustomizations(meal.ingredients);
    } else {
      // Regular meals need default quantities
      setCustomizations(
        meal.ingredients.map(ing => ({
          ...ing,
          quantity: ing.default_quantity || 1,
        }))
      );
    }
  };

  const handleAddToCart = async () => {
    if (!selectedMeal) return;

    try {
      const totalPrice = activeTab === 'my'
        ? selectedMeal.total_price || 0
        : customizations.reduce(
            (sum, ing) => sum + (ing.price || ing.price_per_unit || 0) * (ing.quantity || 1),
            selectedMeal.base_price || 0
          );

      // For saved meals (my), use the meal's ingredients directly
      const cartCustomizations = activeTab === 'my' 
        ? (selectedMeal.ingredients || []).map(ing => ({
            ingredient_id: ing.ingredient_id || ing._id || '',
            name: ing.name || ing.ingredient_name || '',
            price: ing.price || ing.price_per_unit || 0,
            default_quantity: ing.default_quantity || ing.quantity || 1,
            quantity: ing.quantity || ing.default_quantity || 1,
          }))
        : customizations.map(ing => ({
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

      // Platform-specific success message
      if (Platform.OS === 'web') {
        alert('Added to cart!');
      } else {
        Alert.alert('Success', 'Added to cart!');
      }
      
      setSelectedMeal(null);
    } catch (error) {
      console.error('Error adding to cart:', error);
      
      // Platform-specific error message
      if (Platform.OS === 'web') {
        alert('Failed to add to cart');
      } else {
        Alert.alert('Error', 'Failed to add to cart');
      }
    }
  };

  const updateCustomization = (index: number, quantity: number) => {
    const updated = [...customizations];
    updated[index] = { ...updated[index], quantity: Math.max(0, quantity) };
    setCustomizations(updated);
  };

  const calculateTotal = () => {
    if (activeTab === 'my' && selectedMeal) {
      return selectedMeal.total_price || 0;
    }
    const ingredientsTotal = customizations.reduce(
      (sum, ing) => sum + (ing.price || ing.price_per_unit || 0) * (ing.quantity || 1),
      0
    );
    return (selectedMeal?.base_price || 0) + ingredientsTotal;
  };

  const renderMeal = ({ item }: { item: Meal }) => {
    const mealName = item.name || item.meal_name || 'Unnamed Meal';
    const mealPrice = item.base_price || item.total_price || 0;
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
          {item.description && (
            <Text style={styles.mealDescription} numberOfLines={2}>
              {item.description}
            </Text>
          )}
          <View style={styles.mealFooter}>
            <Text style={styles.mealPrice}>₹{mealPrice.toFixed(2)}</Text>
            {activeTab === 'my' && (
              <TouchableOpacity
                onPress={(e) => {
                  e.stopPropagation();
                  Alert.alert(
                    'Delete Meal',
                    'Are you sure you want to delete this saved meal?',
                    [
                      { text: 'Cancel', style: 'cancel' },
                      { text: 'Delete', style: 'destructive', onPress: () => deleteSavedMeal(item._id) },
                    ]
                  );
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
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Meal Presets</Text>
      </View>

      {/* Tabs */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'my' && styles.activeTab]}
          onPress={() => setActiveTab('my')}
        >
          <Text style={[styles.tabText, activeTab === 'my' && styles.activeTabText]}>
            My Meals ({savedMeals.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'all' && styles.activeTab]}
          onPress={() => setActiveTab('all')}
        >
          <Text style={[styles.tabText, activeTab === 'all' && styles.activeTabText]}>
            All Meals ({meals.length})
          </Text>
        </TouchableOpacity>
      </View>

      {/* Tag filters for All Meals */}
      {activeTab === 'all' && allTags.length > 0 && (
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

      {/* Meals List */}
      <FlatList
        data={filteredMeals}
        renderItem={renderMeal}
        keyExtractor={(item) => item._id}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="restaurant-outline" size={64} color="#ccc" />
            <Text style={styles.emptyText}>
              {activeTab === 'my' ? 'No saved meals yet' : 'No meals available'}
            </Text>
            {activeTab === 'my' && (
              <Text style={styles.emptySubtext}>Save meals from DIY to see them here</Text>
            )}
          </View>
        }
      />

      {/* Meal Detail Modal */}
      <Modal
        isVisible={selectedMeal !== null}
        onBackdropPress={() => setSelectedMeal(null)}
        style={styles.modal}
      >
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>
              {selectedMeal?.name || selectedMeal?.meal_name || 'Meal Details'}
            </Text>
            <TouchableOpacity onPress={() => setSelectedMeal(null)}>
              <Ionicons name="close" size={28} color="#333" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalBody}>
            {selectedMeal?.description && (
              <Text style={styles.modalDescription}>{selectedMeal.description}</Text>
            )}

            <Text style={styles.sectionTitle}>Ingredients</Text>
            {customizations.map((ing, index) => (
              <View key={index} style={styles.ingredientRow}>
                <View style={styles.ingredientInfo}>
                  <Text style={styles.ingredientName}>
                    {ing.name || ing.ingredient_name}
                  </Text>
                  <Text style={styles.ingredientPrice}>
                    ₹{(ing.price || ing.price_per_unit || 0).toFixed(2)} {ing.unit || ''}
                  </Text>
                </View>
                {/* Allow editing for both All Meals and My Meals */}
                <View style={styles.quantityControl}>
                  <TouchableOpacity
                    onPress={() => {
                      const stepSize = ing.step_size || 1;
                      updateCustomization(index, Math.max(0, ing.quantity - stepSize));
                    }}
                  >
                    <Ionicons name="remove-circle" size={28} color="#ffd700" />
                  </TouchableOpacity>
                  <Text style={styles.quantity}>{ing.quantity || ing.default_quantity || 1}</Text>
                  <TouchableOpacity
                    onPress={() => {
                      const stepSize = ing.step_size || 1;
                      updateCustomization(index, ing.quantity + stepSize);
                    }}
                  >
                    <Ionicons name="add-circle" size={28} color="#ffd700" />
                  </TouchableOpacity>
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
  header: {
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ffd700',
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
    minHeight: 48,
  },
  activeTab: {
    borderBottomColor: '#ffd700',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    textAlign: 'center',
  },
  activeTabText: {
    color: '#ffd700',
    fontWeight: '700',
  },
  tagsContainer: {
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    maxHeight: 60,
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
    padding: 16,
  },
  mealCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 16,
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
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  ingredientPrice: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
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
    minWidth: 30,
    textAlign: 'center',
  },
  quantityText: {
    fontSize: 14,
    color: '#666',
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
  },
  footerPrice: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ffd700',
  },
  addButton: {
    backgroundColor: '#ffd700',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  addButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
