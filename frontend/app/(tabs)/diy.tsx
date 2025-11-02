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
  Alert,
  Platform,
} from 'react-native';
import { useState, useEffect } from 'react';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import { useCart } from '../../src/context/CartContext';
import { useAuth } from '../../src/context/AuthContext';
import { storage } from '../../src/utils/storage';
import { SafeAreaView } from 'react-native-safe-area-context';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL + '/api';

interface Ingredient {
  _id: string;
  name: string;
  price_per_unit?: number;
  calculated_price?: number;
  unit: string;
  description?: string;
  images?: string[];
  tags?: string[];
  step_size?: number;
}

interface Recipe {
  _id: string;
  name: string;
  description?: string;
  images?: string[];
  calculated_price?: number;
  tags?: string[];
  ingredients: Array<{
    ingredient_id: string;
    name: string;
    quantity: number;
    unit: string;
    step_size?: number;
    price: number;
  }>;
}

export default function DIYScreen() {
  const [activeTab, setActiveTab] = useState<'diy-meals' | 'diy-combos'>('diy-meals');
  const [combosSubTab, setCombosSubTab] = useState<'all-meals' | 'my-meals'>('all-meals');
  
  // DIY Meals tab state (from ingredients)
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [filteredIngredients, setFilteredIngredients] = useState<Ingredient[]>([]);
  const [selectedIngredients, setSelectedIngredients] = useState<Map<string, number>>(new Map());
  
  // DIY Combos tab state (from meals)
  const [allMeals, setAllMeals] = useState<Recipe[]>([]);
  const [myMeals, setMyMeals] = useState<Recipe[]>([]);
  const [filteredMeals, setFilteredMeals] = useState<Recipe[]>([]);
  const [selectedMeals, setSelectedMeals] = useState<Map<string, number>>(new Map());
  
  const [mealName, setMealName] = useState('');
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [allTags, setAllTags] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const { addToCart } = useCart();
  const { user } = useAuth();

  useEffect(() => {
    fetchAllData();
  }, []);

  useEffect(() => {
    if (activeTab === 'diy-meals') {
      filterIngredients();
    } else {
      filterMeals();
    }
  }, [searchQuery, selectedTag, ingredients, allMeals, myMeals, activeTab, combosSubTab]);

  const fetchAllData = async () => {
    await Promise.all([
      fetchIngredients(),
      fetchAllMeals(),
      fetchMyMeals()
    ]);
  };

  const fetchIngredients = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API_URL}/ingredients`);
      setIngredients(response.data);
      setFilteredIngredients(response.data);
      
      const tags = new Set<string>();
      response.data.forEach((ingredient: Ingredient) => {
        ingredient.tags?.forEach(tag => tags.add(tag));
      });
      setAllTags(prev => Array.from(new Set([...prev, ...Array.from(tags)])));
    } catch (error) {
      console.error('Error fetching ingredients:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchAllMeals = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API_URL}/recipes`);
      setAllMeals(response.data);
      
      const tags = new Set<string>();
      response.data.forEach((recipe: Recipe) => {
        recipe.tags?.forEach(tag => tags.add(tag));
      });
      setAllTags(prev => Array.from(new Set([...prev, ...Array.from(tags)])));
    } catch (error) {
      console.error('Error fetching recipes:', error);
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

  const filterIngredients = () => {
    let filtered = ingredients;

    if (searchQuery) {
      filtered = filtered.filter(ing =>
        ing.name.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    if (selectedTag) {
      filtered = filtered.filter(ing => ing.tags?.includes(selectedTag));
    }

    setFilteredIngredients(filtered);
  };

  const filterMeals = () => {
    let meals = combosSubTab === 'all-meals' ? allMeals : myMeals;

    if (searchQuery) {
      meals = meals.filter(meal =>
        meal.name.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    if (selectedTag) {
      meals = meals.filter(meal => meal.tags?.includes(selectedTag));
    }

    setFilteredMeals(meals);
  };

  const toggleIngredient = (ingredientId: string, stepSize: number = 1) => {
    const newSelected = new Map(selectedIngredients);
    if (newSelected.has(ingredientId)) {
      const currentQty = newSelected.get(ingredientId)!;
      newSelected.set(ingredientId, currentQty + stepSize);
    } else {
      newSelected.set(ingredientId, stepSize);
    }
    setSelectedIngredients(newSelected);
  };

  const removeIngredient = (ingredientId: string) => {
    const newSelected = new Map(selectedIngredients);
    newSelected.delete(ingredientId);
    setSelectedIngredients(newSelected);
  };

  const updateIngredientQuantity = (ingredientId: string, quantity: number) => {
    if (quantity <= 0) {
      removeIngredient(ingredientId);
    } else {
      const newSelected = new Map(selectedIngredients);
      newSelected.set(ingredientId, quantity);
      setSelectedIngredients(newSelected);
    }
  };

  const toggleMeal = (recipeId: string) => {
    const newSelected = new Map(selectedMeals);
    if (newSelected.has(recipeId)) {
      newSelected.set(recipeId, newSelected.get(recipeId)! + 0.5);
    } else {
      newSelected.set(recipeId, 1);
    }
    setSelectedMeals(newSelected);
  };

  const removeMeal = (recipeId: string) => {
    const newSelected = new Map(selectedMeals);
    newSelected.delete(recipeId);
    setSelectedMeals(newSelected);
  };

  const updateMealQuantity = (recipeId: string, quantity: number) => {
    if (quantity <= 0) {
      removeMeal(recipeId);
    } else {
      const newSelected = new Map(selectedMeals);
      newSelected.set(recipeId, quantity);
      setSelectedMeals(newSelected);
    }
  };

  const calculateTotal = () => {
    if (activeTab === 'diy-meals') {
      let total = 0;
      selectedIngredients.forEach((qty, id) => {
        const ingredient = ingredients.find(i => i._id === id);
        if (ingredient) {
          total += (ingredient.calculated_price || ingredient.price_per_unit || 0) * qty;
        }
      });
      return total;
    } else {
      let total = 0;
      selectedMeals.forEach((qty, id) => {
        const recipe = (combosSubTab === 'all-meals' ? allMeals : myMeals).find(r => r._id === id);
        if (recipe) {
          total += (recipe.calculated_price || 0) * qty;
        }
      });
      return total;
    }
  };

  const saveMeal = async () => {
    if (!user) {
      Alert.alert('Error', 'Please login to save meals');
      return;
    }

    if (!mealName.trim()) {
      Alert.alert('Error', 'Please enter a meal name');
      return;
    }

    if (activeTab === 'diy-meals' && selectedIngredients.size === 0) {
      Alert.alert('Error', 'Please select at least one ingredient');
      return;
    }

    if (activeTab !== 'ingredients' && selectedMeals.size === 0) {
      Alert.alert('Error', 'Please select at least one recipe');
      return;
    }

    try {
      setSaving(true);
      const token = await storage.getItemAsync('session_token');
      
      let mealData: any;
      
      if (activeTab === 'diy-meals') {
        // Creating meal from ingredients
        const ingredientsList = Array.from(selectedIngredients.entries()).map(([id, qty]) => {
          const ingredient = ingredients.find(i => i._id === id);
          return {
            ingredient_id: id,
            name: ingredient?.name || '',
            default_quantity: qty,
            quantity: qty,
            price: ingredient?.calculated_price || ingredient?.price_per_unit || 0,
            unit: ingredient?.unit || '',
          };
        });

        mealData = {
          name: mealName,
          ingredients: ingredientsList,
          total_price: calculateTotal(),
          is_preset: false,
          created_by: user._id,
        };
      } else {
        // Creating meal from recipes
        const recipesList = Array.from(selectedMeals.entries()).map(([id, qty]) => {
          const recipe = (combosSubTab === 'all-meals' ? allMeals : myMeals).find(r => r._id === id);
          return {
            recipe_id: id,
            name: recipe?.name || '',
            quantity: qty,
            step_size: 0.5,
            price: recipe?.calculated_price || 0,
          };
        });

        mealData = {
          name: mealName,
          recipes: recipesList,
          total_price: calculateTotal(),
          is_preset: false,
          created_by: user._id,
        };
      }

      await axios.post(`${API_URL}/saved-meals`, mealData, {
        headers: { Authorization: `Bearer ${token}` },
      });

      Alert.alert('Success', 'Meal saved successfully!');
      
      // Reset
      setMealName('');
      setSelectedIngredients(new Map());
      setSelectedMeals(new Map());
    } catch (error) {
      console.error('Error saving meal:', error);
      Alert.alert('Error', 'Failed to save meal');
    } finally {
      setSaving(false);
    }
  };

  const addToCartDirect = async () => {
    if (activeTab === 'diy-meals' && selectedIngredients.size === 0) {
      Alert.alert('Error', 'Please select at least one ingredient');
      return;
    }

    if (activeTab !== 'ingredients' && selectedMeals.size === 0) {
      Alert.alert('Error', 'Please select at least one recipe');
      return;
    }

    try {
      let cartData: any;
      
      if (activeTab === 'diy-meals') {
        const ingredientsList = Array.from(selectedIngredients.entries()).map(([id, qty]) => {
          const ingredient = ingredients.find(i => i._id === id);
          return {
            ingredient_id: id,
            name: ingredient?.name || '',
            quantity: qty,
            price: ingredient?.calculated_price || ingredient?.price_per_unit || 0,
          };
        });

        cartData = {
          meal_id: 'custom-' + Date.now(),
          meal_name: mealName || 'Custom Meal',
          customizations: ingredientsList,
          quantity: 1,
          price: calculateTotal(),
        };
      } else {
        const recipesList = Array.from(selectedMeals.entries()).map(([id, qty]) => {
          const recipe = (combosSubTab === 'all-meals' ? allMeals : myMeals).find(r => r._id === id);
          return {
            recipe_id: id,
            name: recipe?.name || '',
            quantity: qty,
            price: recipe?.calculated_price || 0,
          };
        });

        cartData = {
          meal_id: 'custom-meal-' + Date.now(),
          meal_name: mealName || 'Custom Meal',
          recipes: recipesList,
          quantity: 1,
          price: calculateTotal(),
        };
      }

      await addToCart(cartData);

      if (Platform.OS === 'web') {
        alert('Added to cart!');
      } else {
        Alert.alert('Success', 'Added to cart!');
      }
      
      setMealName('');
      setSelectedIngredients(new Map());
      setSelectedMeals(new Map());
    } catch (error) {
      console.error('Error adding to cart:', error);
      Alert.alert('Error', 'Failed to add to cart');
    }
  };

  const renderIngredientItem = ({ item }: { item: Ingredient }) => (
    <TouchableOpacity
      style={styles.itemCard}
      onPress={() => toggleIngredient(item._id, item.step_size || 1)}
    >
      {item.images?.[0] ? (
        <Image source={{ uri: item.images[0] }} style={styles.itemImage} />
      ) : (
        <View style={[styles.itemImage, styles.placeholderImage]}>
          <Ionicons name="nutrition" size={32} color="#ccc" />
        </View>
      )}
      <View style={styles.itemInfo}>
        <Text style={styles.itemName}>{item.name}</Text>
        <Text style={styles.itemPrice}>
          ₹{(item.calculated_price || item.price_per_unit || 0).toFixed(2)}/{item.unit}
        </Text>
        {selectedIngredients.has(item._id) && (
          <Text style={styles.selectedBadge}>✓ Added</Text>
        )}
      </View>
    </TouchableOpacity>
  );

  const renderRecipeItem = ({ item }: { item: Recipe }) => (
    <TouchableOpacity
      style={styles.itemCard}
      onPress={() => toggleMeal(item._id)}
    >
      {item.images?.[0] ? (
        <Image source={{ uri: item.images[0] }} style={styles.itemImage} />
      ) : (
        <View style={[styles.itemImage, styles.placeholderImage]}>
          <Ionicons name="restaurant" size={32} color="#ccc" />
        </View>
      )}
      <View style={styles.itemInfo}>
        <Text style={styles.itemName}>{item.name}</Text>
        {item.description && (
          <Text style={styles.itemDescription} numberOfLines={2}>
            {item.description}
          </Text>
        )}
        <Text style={styles.itemPrice}>₹{(item.calculated_price || 0).toFixed(2)}</Text>
        {selectedMeals.has(item._id) && (
          <Text style={styles.selectedBadge}>✓ Added</Text>
        )}
      </View>
    </TouchableOpacity>
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
      {/* 2 Main Tabs */}
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        style={styles.tabContainer}
      >
        <TouchableOpacity
          style={[styles.tab, activeTab === 'diy-meals' && styles.activeTab]}
          onPress={() => setActiveTab('diy-meals')}
        >
          <Text style={[styles.tabText, activeTab === 'diy-meals' && styles.activeTabText]}>
            DIY Meals
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'diy-combos' && styles.activeTab]}
          onPress={() => setActiveTab('diy-combos')}
        >
          <Text style={[styles.tabText, activeTab === 'diy-combos' && styles.activeTabText]}>
            DIY Combos
          </Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Sub-tabs for DIY Combos */}
      {activeTab === 'diy-combos' && (
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          style={styles.subTabContainer}
        >
          <TouchableOpacity
            style={[styles.subTab, combosSubTab === 'all-meals' && styles.activeSubTab]}
            onPress={() => setCombosSubTab('all-meals')}
          >
            <Text style={[styles.subTabText, combosSubTab === 'all-meals' && styles.activeSubTabText]}>
              All Meals ({allMeals.length})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.subTab, combosSubTab === 'my-meals' && styles.activeSubTab]}
            onPress={() => setCombosSubTab('my-meals')}
          >
            <Text style={[styles.subTabText, combosSubTab === 'my-meals' && styles.activeSubTabText]}>
              My Meals ({myMeals.length})
            </Text>
          </TouchableOpacity>
        </ScrollView>
      )}

      {/* Search and filters */}
      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={20} color="#999" />
          <TextInput
            style={styles.searchInput}
            placeholder={`Search ${activeTab === 'diy-meals' ? 'ingredients' : 'meals'}...`}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>
      </View>

      {/* Tag filters */}
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
        data={activeTab === 'diy-meals' ? filteredIngredients : filteredMeals}
        renderItem={activeTab === 'diy-meals' ? renderIngredientItem : renderRecipeItem}
        keyExtractor={(item) => item._id}
        contentContainerStyle={styles.listContent}
        numColumns={2}
        columnWrapperStyle={styles.columnWrapper}
      />

      {/* Selected Items Panel */}
      {((activeTab === 'diy-meals' && selectedIngredients.size > 0) || 
        (activeTab === 'diy-combos' && selectedMeals.size > 0)) && (
        <View style={styles.selectedPanel}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.selectedScroll}>
            {activeTab === 'diy-meals'
              ? Array.from(selectedIngredients.entries()).map(([id, qty]) => {
                  const ingredient = ingredients.find(i => i._id === id);
                  if (!ingredient) return null;
                  const stepSize = ingredient.step_size || 1;
                  return (
                    <View key={id} style={styles.selectedItem}>
                      <Text style={styles.selectedItemName}>{ingredient.name}</Text>
                      <View style={styles.quantityControl}>
                        <TouchableOpacity onPress={() => updateIngredientQuantity(id, qty - stepSize)}>
                          <Ionicons name="remove-circle" size={24} color="#ffd700" />
                        </TouchableOpacity>
                        <Text style={styles.quantityText}>{qty}</Text>
                        <TouchableOpacity onPress={() => updateIngredientQuantity(id, qty + stepSize)}>
                          <Ionicons name="add-circle" size={24} color="#ffd700" />
                        </TouchableOpacity>
                      </View>
                      <TouchableOpacity onPress={() => removeIngredient(id)}>
                        <Ionicons name="close-circle" size={20} color="#ef4444" />
                      </TouchableOpacity>
                    </View>
                  );
                })
              : Array.from(selectedMeals.entries()).map(([id, qty]) => {
                  const recipe = (combosSubTab === 'all-meals' ? allMeals : myMeals).find(r => r._id === id);
                  if (!recipe) return null;
                  return (
                    <View key={id} style={styles.selectedItem}>
                      <Text style={styles.selectedItemName}>{recipe.name}</Text>
                      <View style={styles.quantityControl}>
                        <TouchableOpacity onPress={() => updateMealQuantity(id, qty - 0.5)}>
                          <Ionicons name="remove-circle" size={24} color="#ffd700" />
                        </TouchableOpacity>
                        <Text style={styles.quantityText}>{qty}x</Text>
                        <TouchableOpacity onPress={() => updateMealQuantity(id, qty + 0.5)}>
                          <Ionicons name="add-circle" size={24} color="#ffd700" />
                        </TouchableOpacity>
                      </View>
                      <TouchableOpacity onPress={() => removeMeal(id)}>
                        <Ionicons name="close-circle" size={20} color="#ef4444" />
                      </TouchableOpacity>
                    </View>
                  );
                })}
          </ScrollView>
        </View>
      )}

      {/* Bottom Action Bar */}
      <View style={styles.bottomBar}>
        <View style={styles.totalSection}>
          <Text style={styles.totalLabel}>Total</Text>
          <Text style={styles.totalPrice}>₹{calculateTotal().toFixed(2)}</Text>
        </View>
        <View style={styles.actionButtons}>
          {user && (
            <TouchableOpacity
              style={[styles.actionButton, styles.saveButton]}
              onPress={saveMeal}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator size="small" color="#333" />
              ) : (
                <>
                  <Ionicons name="bookmark" size={20} color="#333" />
                  <Text style={styles.saveButtonText}>Save</Text>
                </>
              )}
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={[styles.actionButton, styles.cartButton]}
            onPress={addToCartDirect}
          >
            <Ionicons name="cart" size={20} color="#fff" />
            <Text style={styles.cartButtonText}>Add to Cart</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Meal Name Input (shows when user wants to save) */}
      {user && !mealName && (
        <TouchableOpacity
          style={styles.nameInputPrompt}
          onPress={() => {
            Alert.prompt(
              'Meal Name',
              'Enter a name for your meal',
              (text) => setMealName(text)
            );
          }}
        >
          <Text style={styles.nameInputPromptText}>Tap to name your meal</Text>
        </TouchableOpacity>
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
  subTabContainer: {
    backgroundColor: '#f8f8f8',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  subTab: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
    height: 35,
  },
  activeSubTab: {
    borderBottomColor: '#ffd700',
  },
  subTabText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#666',
  },
  activeSubTabText: {
    color: '#ffd700',
    fontWeight: '600',
  },
  searchContainer: {
    padding: 16,
    backgroundColor: '#fff',
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
    padding: 8,
  },
  columnWrapper: {
    justifyContent: 'space-between',
  },
  itemCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 12,
    margin: 8,
    overflow: 'hidden',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    maxWidth: '48%',
  },
  itemImage: {
    width: '100%',
    height: 120,
  },
  placeholderImage: {
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  itemInfo: {
    padding: 12,
  },
  itemName: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  itemDescription: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  itemPrice: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffd700',
  },
  selectedBadge: {
    fontSize: 12,
    color: '#10b981',
    fontWeight: '600',
    marginTop: 4,
  },
  selectedPanel: {
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#eee',
    paddingVertical: 12,
  },
  selectedScroll: {
    paddingHorizontal: 16,
  },
  selectedItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f9f9f9',
    borderRadius: 12,
    padding: 12,
    marginRight: 12,
    gap: 8,
  },
  selectedItemName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  quantityControl: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  quantityText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    minWidth: 32,
    textAlign: 'center',
  },
  bottomBar: {
    position: 'absolute',
    bottom: 60,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#eee',
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  totalSection: {
    flex: 1,
  },
  totalLabel: {
    fontSize: 14,
    color: '#666',
  },
  totalPrice: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ffd700',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    gap: 6,
  },
  saveButton: {
    backgroundColor: '#ffd700',
  },
  saveButtonText: {
    color: '#333',
    fontSize: 16,
    fontWeight: 'bold',
  },
  cartButton: {
    backgroundColor: '#333',
  },
  cartButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  nameInputPrompt: {
    position: 'absolute',
    bottom: 140,
    left: 16,
    right: 16,
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#ffd700',
    borderStyle: 'dashed',
  },
  nameInputPromptText: {
    fontSize: 14,
    color: '#ffd700',
    fontWeight: '600',
    textAlign: 'center',
  },
});
