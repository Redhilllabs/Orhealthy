import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Image,
  ScrollView,
  Dimensions,
} from 'react-native';
import { useState, useEffect } from 'react';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import { useCart } from '../../src/context/CartContext';
import { SafeAreaView } from 'react-native-safe-area-context';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL + '/api';
const { width } = Dimensions.get('window');

interface Ingredient {
  _id: string;
  name: string;
  price_per_unit: number;
  unit: string;
  description?: string;
  images?: string[];
  tags?: string[];
}

export default function DIYScreen() {
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [selectedIngredients, setSelectedIngredients] = useState<Map<string, number>>(new Map());
  const [mealName, setMealName] = useState('');
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const { addToCart } = useCart();

  useEffect(() => {
    fetchIngredients();
  }, []);

  const fetchIngredients = async () => {
    try {
      const response = await axios.get(`${API_URL}/ingredients`);
      setIngredients(response.data);
    } catch (error) {
      console.error('Error fetching ingredients:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleIngredient = (ingredientId: string) => {
    const newSelected = new Map(selectedIngredients);
    if (newSelected.has(ingredientId)) {
      newSelected.delete(ingredientId);
    } else {
      newSelected.set(ingredientId, 1);
    }
    setSelectedIngredients(newSelected);
  };

  const updateQuantity = (ingredientId: string, quantity: number) => {
    const newSelected = new Map(selectedIngredients);
    if (quantity <= 0) {
      newSelected.delete(ingredientId);
    } else {
      newSelected.set(ingredientId, quantity);
    }
    setSelectedIngredients(newSelected);
  };

  const calculateTotal = () => {
    let total = 0;
    selectedIngredients.forEach((quantity, ingredientId) => {
      const ingredient = ingredients.find(ing => ing._id === ingredientId);
      if (ingredient) {
        total += ingredient.price_per_unit * quantity;
      }
    });
    return total;
  };

  const handleAddToCart = async () => {
    if (selectedIngredients.size === 0) {
      alert('Please select at least one ingredient');
      return;
    }

    try {
      const customizations = Array.from(selectedIngredients.entries()).map(([ingredientId, quantity]) => {
        const ingredient = ingredients.find(ing => ing._id === ingredientId);
        return {
          ingredient_id: ingredientId,
          name: ingredient?.name || '',
          price: ingredient?.price_per_unit || 0,
          default_quantity: quantity,
          quantity,
        };
      });

      await addToCart({
        meal_name: mealName || 'Custom DIY Meal',
        customizations,
        quantity: 1,
        price: calculateTotal(),
      });

      setMealName('');
      setSelectedIngredients(new Map());
      alert('Added to cart!');
    } catch (error) {
      console.error('Error adding to cart:', error);
      alert('Failed to add to cart');
    }
  };

  const filteredIngredients = ingredients.filter(ing =>
    ing.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const renderIngredient = ({ item }: { item: Ingredient }) => {
    const quantity = selectedIngredients.get(item._id) || 0;
    const isSelected = quantity > 0;

    return (
      <View style={styles.ingredientCard}>
        {item.images && item.images.length > 0 && (
          <View style={styles.imageContainer}>
            <ScrollView
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              style={styles.imageScroll}
            >
              {item.images.map((image, index) => (
                <Image
                  key={index}
                  source={{ uri: image }}
                  style={styles.ingredientImage}
                />
              ))}
            </ScrollView>
          </View>
        )}

        <TouchableOpacity
          style={[styles.ingredientContent, isSelected && styles.ingredientContentSelected]}
          onPress={() => toggleIngredient(item._id)}
        >
          <View style={styles.ingredientInfo}>
            <Text style={styles.ingredientName}>{item.name}</Text>
            <Text style={styles.ingredientPrice}>
              ₹{item.price_per_unit.toFixed(2)} / {item.unit}
            </Text>
            {item.description && (
              <Text style={styles.ingredientDescription} numberOfLines={1}>
                {item.description}
              </Text>
            )}
            {item.tags && item.tags.length > 0 && (
              <View style={styles.tagsContainer}>
                {item.tags.map((tag, index) => (
                  <View key={index} style={styles.tag}>
                    <Text style={styles.tagText}>{tag}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>

          {isSelected && (
            <View style={styles.quantityControl}>
              <TouchableOpacity
                style={styles.quantityButton}
                onPress={() => updateQuantity(item._id, quantity - 1)}
              >
                <Ionicons name="remove" size={20} color="#ffd700" />
              </TouchableOpacity>

              <Text style={styles.quantity}>{quantity}</Text>

              <TouchableOpacity
                style={styles.quantityButton}
                onPress={() => updateQuantity(item._id, quantity + 1)}
              >
                <Ionicons name="add" size={20} color="#ffd700" />
              </TouchableOpacity>
            </View>
          )}

          {!isSelected && (
            <Ionicons name="add-circle-outline" size={32} color="#ffd700" />
          )}
        </TouchableOpacity>
      </View>
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
        <Text style={styles.headerTitle}>DIY Your Meal</Text>
      </View>

      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color="#666" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search ingredients..."
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      <View style={styles.mealNameContainer}>
        <TextInput
          style={styles.mealNameInput}
          placeholder="Name your meal (optional)"
          value={mealName}
          onChangeText={setMealName}
          maxLength={50}
        />
      </View>

      <FlatList
        data={filteredIngredients}
        renderItem={renderIngredient}
        keyExtractor={(item) => item._id}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="nutrition-outline" size={64} color="#ccc" />
            <Text style={styles.emptyText}>No ingredients available</Text>
          </View>
        }
      />

      {selectedIngredients.size > 0 && (
        <View style={styles.footer}>
          <View style={styles.footerInfo}>
            <Text style={styles.footerLabel}>
              {selectedIngredients.size} ingredient{selectedIngredients.size !== 1 ? 's' : ''}
            </Text>
            <Text style={styles.footerTotal}>₹{calculateTotal().toFixed(2)}</Text>
          </View>

          <TouchableOpacity style={styles.addButton} onPress={handleAddToCart}>
            <Ionicons name="cart" size={20} color="#fff" />
            <Text style={styles.addButtonText}>Add to Cart</Text>
          </TouchableOpacity>
        </View>
      )}
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
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  searchIcon: {
    marginRight: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#333',
  },
  mealNameContainer: {
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  mealNameInput: {
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
  },
  listContent: {
    padding: 16,
  },
  ingredientCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  ingredientCardSelected: {
    borderWidth: 2,
    borderColor: '#ffd700',
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
    color: '#ffd700',
    fontWeight: '500',
    marginBottom: 4,
  },
  ingredientDescription: {
    fontSize: 12,
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
  footer: {
    backgroundColor: '#fff',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#eee',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  footerInfo: {
    flex: 1,
  },
  footerLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  footerTotal: {
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
