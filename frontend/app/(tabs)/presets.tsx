import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  ActivityIndicator,
} from 'react-native';
import { useState, useEffect } from 'react';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import { useCart } from '../../src/context/CartContext';
import { SafeAreaView } from 'react-native-safe-area-context';
import Modal from 'react-native-modal';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL + '/api';

interface Meal {
  _id: string;
  name: string;
  description: string;
  image?: string;
  base_price: number;
  ingredients: Array<{
    ingredient_id: string;
    name: string;
    price: number;
    default_quantity: number;
    quantity?: number;
  }>;
}

export default function PresetsScreen() {
  const [meals, setMeals] = useState<Meal[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMeal, setSelectedMeal] = useState<Meal | null>(null);
  const [customizations, setCustomizations] = useState<any[]>([]);
  const { addToCart } = useCart();

  useEffect(() => {
    fetchMeals();
  }, []);

  const fetchMeals = async () => {
    try {
      const response = await axios.get(`${API_URL}/meals`);
      setMeals(response.data);
    } catch (error) {
      console.error('Error fetching meals:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddToCart = async (meal: Meal, customized: boolean = false) => {
    try {
      const ingredients = customized ? customizations : meal.ingredients;
      const totalPrice = ingredients.reduce(
        (sum, ing) => sum + ing.price * (ing.quantity || ing.default_quantity),
        0
      );

      await addToCart({
        meal_id: meal._id,
        meal_name: meal.name,
        customizations: ingredients,
        quantity: 1,
        price: totalPrice,
      });

      if (customized) {
        setSelectedMeal(null);
      }

      alert('Added to cart!');
    } catch (error) {
      console.error('Error adding to cart:', error);
      alert('Failed to add to cart');
    }
  };

  const openCustomization = (meal: Meal) => {
    setSelectedMeal(meal);
    setCustomizations(meal.ingredients.map(ing => ({ ...ing, quantity: ing.default_quantity })));
  };

  const updateIngredient = (index: number, quantity: number) => {
    const updated = [...customizations];
    updated[index].quantity = Math.max(0, quantity);
    setCustomizations(updated);
  };

  const calculateCustomPrice = () => {
    return customizations.reduce((sum, ing) => sum + ing.price * (ing.quantity || 0), 0);
  };

  const renderMeal = ({ item }: { item: Meal }) => (
    <View style={styles.mealCard}>
      <View style={styles.mealImageContainer}>
        {item.image ? (
          <Image source={{ uri: item.image }} style={styles.mealImage} />
        ) : (
          <View style={styles.mealImagePlaceholder}>
            <Ionicons name="restaurant" size={48} color="#ccc" />
          </View>
        )}
      </View>

      <View style={styles.mealInfo}>
        <Text style={styles.mealName}>{item.name}</Text>
        <Text style={styles.mealDescription} numberOfLines={2}>
          {item.description}
        </Text>
        <Text style={styles.mealPrice}>${item.base_price.toFixed(2)}</Text>

        <View style={styles.mealActions}>
          <TouchableOpacity
            style={styles.customizeButton}
            onPress={() => openCustomization(item)}
          >
            <Text style={styles.customizeButtonText}>Customize</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.addButton}
            onPress={() => handleAddToCart(item)}
          >
            <Ionicons name="cart" size={20} color="#fff" />
            <Text style={styles.addButtonText}>Add</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );

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
        <Text style={styles.headerTitle}>Preset Meals</Text>
      </View>

      <FlatList
        data={meals}
        renderItem={renderMeal}
        keyExtractor={(item) => item._id}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="restaurant-outline" size={64} color="#ccc" />
            <Text style={styles.emptyText}>No meals available</Text>
          </View>
        }
      />

      {/* Customization Modal */}
      <Modal
        isVisible={selectedMeal !== null}
        onBackdropPress={() => setSelectedMeal(null)}
        style={styles.modal}
      >
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Customize {selectedMeal?.name}</Text>
            <TouchableOpacity onPress={() => setSelectedMeal(null)}>
              <Ionicons name="close" size={28} color="#333" />
            </TouchableOpacity>
          </View>

          <FlatList
            data={customizations}
            keyExtractor={(item, index) => index.toString()}
            renderItem={({ item, index }) => (
              <View style={styles.ingredientRow}>
                <View style={styles.ingredientInfo}>
                  <Text style={styles.ingredientName}>{item.name}</Text>
                  <Text style={styles.ingredientPrice}>${item.price.toFixed(2)}</Text>
                </View>

                <View style={styles.quantityControl}>
                  <TouchableOpacity
                    style={styles.quantityButton}
                    onPress={() => updateIngredient(index, (item.quantity || 0) - 1)}
                  >
                    <Ionicons name="remove" size={20} color="#ffd700" />
                  </TouchableOpacity>

                  <Text style={styles.quantity}>{item.quantity || 0}</Text>

                  <TouchableOpacity
                    style={styles.quantityButton}
                    onPress={() => updateIngredient(index, (item.quantity || 0) + 1)}
                  >
                    <Ionicons name="add" size={20} color="#ffd700" />
                  </TouchableOpacity>
                </View>
              </View>
            )}
            style={styles.ingredientList}
          />

          <View style={styles.modalFooter}>
            <Text style={styles.totalPrice}>
              Total: ${calculateCustomPrice().toFixed(2)}
            </Text>
            <TouchableOpacity
              style={styles.addToCartButton}
              onPress={() => selectedMeal && handleAddToCart(selectedMeal, true)}
            >
              <Text style={styles.addToCartButtonText}>Add to Cart</Text>
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
    color: '#333',
  },
  listContent: {
    padding: 16,
  },
  mealCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    overflow: 'hidden',
  },
  mealImageContainer: {
    width: '100%',
    height: 180,
  },
  mealImage: {
    width: '100%',
    height: '100%',
  },
  mealImagePlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  mealInfo: {
    padding: 16,
  },
  mealName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  mealDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 12,
  },
  mealPrice: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ffd700',
    marginBottom: 16,
  },
  mealActions: {
    flexDirection: 'row',
    gap: 12,
  },
  customizeButton: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ffd700',
  },
  customizeButtonText: {
    color: '#ffd700',
    fontWeight: '600',
    fontSize: 16,
  },
  addButton: {
    flex: 1,
    backgroundColor: '#ffd700',
    paddingVertical: 12,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  addButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 64,
  },
  emptyText: {
    fontSize: 18,
    color: '#666',
    marginTop: 16,
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
  },
  ingredientList: {
    maxHeight: 400,
  },
  ingredientRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  ingredientInfo: {
    flex: 1,
  },
  ingredientName: {
    fontSize: 16,
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
  quantityButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  quantity: {
    fontSize: 18,
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
  totalPrice: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ffd700',
  },
  addToCartButton: {
    backgroundColor: '#ffd700',
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: 8,
  },
  addToCartButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
