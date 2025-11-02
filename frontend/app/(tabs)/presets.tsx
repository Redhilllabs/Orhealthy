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
  calculated_price?: number;
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
    step_size?: number;
  }>;
}

export default function PresetsScreen() {
  const [activeTab, setActiveTab] = useState<'all-combos' | 'all-combos' | 'my-combos' | 'my-combos'>('all-combos');
  const [allCombos, setAllCombos] = useState<Meal[]>([]);
  const [allCombos, setAllCombos] = useState<Meal[]>([]);
  const [myCombos, setMyCombos] = useState<Meal[]>([]);
  const [myCombos, setMyCombos] = useState<Meal[]>([]);
  const [filteredItems, setFilteredItems] = useState<Meal[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMeal, setSelectedMeal] = useState<Meal | null>(null);
  const [customizations, setCustomizations] = useState<any[]>([]);
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [allTags, setAllTags] = useState<string[]>([]);
  const { addToCart } = useCart();

  useEffect(() => {
    fetchAllData();
  }, []);

  useEffect(() => {
    let items: Meal[] = [];
    
    switch (activeTab) {
      case 'all-combos':
        items = allCombos;
        break;
      case 'all-combos':
        items = allCombos;
        break;
      case 'my-combos':
        items = myCombos;
        break;
      case 'my-combos':
        items = myCombos;
        break;
    }

    if (selectedTag) {
      items = items.filter(item => item.tags?.includes(selectedTag));
    }

    setFilteredItems(items);
  }, [selectedTag, allCombos, allCombos, myCombos, myCombos, activeTab]);

  const fetchAllData = async () => {
    await Promise.all([
      fetchAllCombos(),
      fetchAllCombos(),
      fetchMyCombos(),
      fetchMyCombos()
    ]);
  };

  const fetchAllCombos = async () => {
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
      if (!token) return;

      const response = await axios.get(`${API_URL}/saved-meals?type=meal`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setMyMeals(response.data);
    } catch (error) {
      console.error('Error fetching my recipes:', error);
    }
  };

  const fetchMyCombos = async () => {
    try {
      const token = await storage.getItemAsync('session_token');
      if (!token) return;

      const response = await axios.get(`${API_URL}/saved-meals?type=combo`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setMyCombos(response.data);
    } catch (error) {
      console.error('Error fetching my meals:', error);
    }
  };

  const deleteSavedItem = async (itemId: string) => {
    try {
      const token = await storage.getItemAsync('session_token');
      await axios.delete(`${API_URL}/saved-meals/${itemId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      Alert.alert('Success', 'Item deleted successfully');
      // Refresh the appropriate list
      if (activeTab === 'my-meals') {
        fetchMyMeals();
      } else if (activeTab === 'my-combos') {
        fetchMyCombos();
      }
    } catch (error) {
      console.error('Error deleting item:', error);
      Alert.alert('Error', 'Failed to delete item');
    }
  };

  const handleMealPress = (meal: Meal) => {
    setSelectedMeal(meal);
    if (activeTab.startsWith('my-')) {
      setCustomizations(meal.ingredients);
    } else {
      setCustomizations(
        meal.ingredients.map(ing => ({
          ...ing,
          quantity: ing.default_quantity || ing.quantity || 1,
        }))
      );
    }
  };

  const handleAddToCart = async () => {
    if (!selectedMeal) return;

    try {
      const totalPrice = activeTab.startsWith('my-')
        ? selectedMeal.total_price || selectedMeal.calculated_price || 0
        : customizations.reduce(
            (sum, ing) => sum + (ing.price || ing.price_per_unit || 0) * (ing.quantity || 1),
            selectedMeal.base_price || selectedMeal.calculated_price || 0
          );

      const cartCustomizations = customizations.map(ing => ({
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

      if (Platform.OS === 'web') {
        alert('Added to cart!');
      } else {
        Alert.alert('Success', 'Added to cart!');
      }
      
      setSelectedMeal(null);
    } catch (error) {
      console.error('Error adding to cart:', error);
      
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
    if (activeTab.startsWith('my-') && selectedMeal) {
      return selectedMeal.total_price || selectedMeal.calculated_price || 0;
    }
    const ingredientsTotal = customizations.reduce(
      (sum, ing) => sum + (ing.price || ing.price_per_unit || 0) * (ing.quantity || 1),
      0
    );
    return (selectedMeal?.base_price || selectedMeal?.calculated_price || 0) + ingredientsTotal;
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
          {item.description && (
            <Text style={styles.mealDescription} numberOfLines={2}>
              {item.description}
            </Text>
          )}
          <View style={styles.mealFooter}>
            <Text style={styles.mealPrice}>₹{mealPrice.toFixed(2)}</Text>
            {activeTab.startsWith('my-') && (
              <TouchableOpacity
                onPress={(e) => {
                  e.stopPropagation();
                  Alert.alert(
                    'Delete Item',
                    'Are you sure you want to delete this saved item?',
                    [
                      { text: 'Cancel', style: 'cancel' },
                      { text: 'Delete', style: 'destructive', onPress: () => deleteSavedItem(item._id) },
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
      {/* 4 Tabs */}
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        style={styles.tabContainer}
      >
        <TouchableOpacity
          style={[styles.tab, activeTab === 'all-meals' && styles.activeTab]}
          onPress={() => setActiveTab('all-meals')}
        >
          <Text style={[styles.tabText, activeTab === 'all-meals' && styles.activeTabText]}>
            All Meals ({allMeals.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'all-combos' && styles.activeTab]}
          onPress={() => setActiveTab('all-combos')}
        >
          <Text style={[styles.tabText, activeTab === 'all-combos' && styles.activeTabText]}>
            All Combos ({allCombos.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'my-meals' && styles.activeTab]}
          onPress={() => setActiveTab('my-meals')}
        >
          <Text style={[styles.tabText, activeTab === 'my-meals' && styles.activeTabText]}>
            My Meals ({myMeals.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'my-combos' && styles.activeTab]}
          onPress={() => setActiveTab('my-combos')}
        >
          <Text style={[styles.tabText, activeTab === 'my-combos' && styles.activeTabText]}>
            My Combos ({myCombos.length})
          </Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Tag filters */}
      {activeTab.startsWith('all-') && allTags.length > 0 && (
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
              {activeTab.startsWith('my-') ? 'No saved items yet' : 'No items available'}
            </Text>
            {activeTab.startsWith('my-') && (
              <Text style={styles.emptySubtext}>Save items from DIY to see them here</Text>
            )}
          </View>
        }
      />

      {/* Detail Modal */}
      <Modal
        isVisible={selectedMeal !== null}
        onBackdropPress={() => setSelectedMeal(null)}
        style={styles.modal}
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
    paddingBottom: 80,
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
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  tab: {
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
});
