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
import Modal from 'react-native-modal';

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
  const [selectedSaveTags, setSelectedSaveTags] = useState<string[]>([]);
  const [showNameModal, setShowNameModal] = useState(false);
  const [showSelectedModal, setShowSelectedModal] = useState(false);
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
      const response = await axios.get(`${API_URL}/ingredients`);
      setIngredients(response.data);
      extractTags(response.data, []);
    } catch (error) {
      console.error('Error fetching ingredients:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchAllMeals = async () => {
    try {
      const response = await axios.get(`${API_URL}/recipes`);
      setAllMeals(response.data);
      extractTags([], response.data);
    } catch (error) {
      console.error('Error fetching all meals:', error);
    }
  };

  const fetchMyMeals = async () => {
    if (!user) return;
    try {
      const token = await storage.getItemAsync('session_token');
      const response = await axios.get(`${API_URL}/recipes?user_id=${user._id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      console.log('My meals from /recipes:', response.data);
      setMyMeals(response.data);
    } catch (error) {
      console.error('Error fetching my meals:', error);
    }
  };

  const extractTags = (ingredients: Ingredient[], meals: Recipe[]) => {
    const tags = new Set<string>();
    ingredients.forEach(ing => {
      ing.tags?.forEach(tag => tags.add(tag));
    });
    meals.forEach(meal => {
      meal.tags?.forEach(tag => tags.add(tag));
    });
    setAllTags(Array.from(tags));
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
      newSelected.set(recipeId, newSelected.get(recipeId)! + 1);
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
      newSelected.set(recipeId, Math.round(quantity));
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

  // Generate image from constituents
  const generateCompositeImage = () => {
    if (activeTab === 'diy-meals') {
      const images: string[] = [];
      selectedIngredients.forEach((qty, id) => {
        const ingredient = ingredients.find(i => i._id === id);
        if (ingredient?.images?.[0]) {
          images.push(ingredient.images[0]);
        }
      });
      return images.slice(0, 4);
    } else {
      const images: string[] = [];
      selectedMeals.forEach((qty, id) => {
        const recipe = (combosSubTab === 'all-meals' ? allMeals : myMeals).find(r => r._id === id);
        if (recipe?.images?.[0]) {
          images.push(recipe.images[0]);
        }
      });
      return images.slice(0, 4);
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

    if (activeTab !== 'diy-meals' && selectedMeals.size === 0) {
      Alert.alert('Error', 'Please select at least one meal');
      return;
    }

    try {
      setSaving(true);
      const token = await storage.getItemAsync('session_token');
      const compositeImages = generateCompositeImage();
      
      let endpoint = '';
      let mealData: any;
      
      if (activeTab === 'diy-meals') {
        // Creating meal from ingredients -> POST to /recipes
        const ingredientsList = Array.from(selectedIngredients.entries()).map(([id, qty]) => {
          const ingredient = ingredients.find(i => i._id === id);
          return {
            ingredient_id: id,
            name: ingredient?.name || '',
            quantity: qty,
            price: ingredient?.calculated_price || ingredient?.price_per_unit || 0,
            unit: ingredient?.unit || '',
            step_size: ingredient?.step_size || 1,
          };
        });

        endpoint = `${API_URL}/recipes`;
        mealData = {
          name: mealName,
          ingredients: ingredientsList,
          images: compositeImages,
          tags: selectedSaveTags,
          is_preset: false,
          created_by: user._id,
        };
      } else {
        // Creating combo from meals -> POST to /meals
        const recipesList = Array.from(selectedMeals.entries()).map(([id, qty]) => {
          const recipe = (combosSubTab === 'all-meals' ? allMeals : myMeals).find(r => r._id === id);
          return {
            recipe_id: id,
            name: recipe?.name || '',
            quantity: qty,
            step_size: 1,
            price: recipe?.calculated_price || 0,
          };
        });

        endpoint = `${API_URL}/meals`;
        mealData = {
          name: mealName,
          recipes: recipesList,
          images: compositeImages,
          tags: selectedSaveTags,
          is_preset: false,
          created_by: user._id,
        };
      }

      await axios.post(endpoint, mealData, {
        headers: { Authorization: `Bearer ${token}` },
      });

      Alert.alert('Success', `${activeTab === 'diy-meals' ? 'Meal' : 'Combo'} saved successfully!`);
      
      // Reset
      setMealName('');
      setSelectedSaveTags([]);
      setSelectedIngredients(new Map());
      setSelectedMeals(new Map());
      setShowSelectedModal(false);
      
      // Refresh data
      if (activeTab === 'diy-meals') {
        fetchMyMeals();
      }
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

    if (activeTab !== 'diy-meals' && selectedMeals.size === 0) {
      Alert.alert('Error', 'Please select at least one meal');
      return;
    }

    try {
      const compositeImages = generateCompositeImage();
      let cartData: any;
      
      if (activeTab === 'diy-meals') {
        const ingredientsList = Array.from(selectedIngredients.entries()).map(([id, qty]) => {
          const ingredient = ingredients.find(i => i._id === id);
          return {
            ingredient_id: id,
            name: ingredient?.name || '',
            quantity: qty,
            unit: ingredient?.unit || '',
            price: ingredient?.calculated_price || ingredient?.price_per_unit || 0,
          };
        });

        cartData = {
          meal_id: 'diy-meal-' + Date.now(),
          meal_name: 'DIY Meal',
          description: ingredientsList.map(i => `${i.name} (${i.quantity}${i.unit})`).join(', '),
          images: compositeImages,
          customizations: ingredientsList,
          quantity: 1,
          price: calculateTotal(),
          isDIY: true,
        };
      } else {
        const mealsData = Array.from(selectedMeals.entries()).map(([id, qty]) => {
          const recipe = (combosSubTab === 'all-meals' ? allMeals : myMeals).find(r => r._id === id);
          return {
            recipe_id: id,
            name: recipe?.name || '',
            quantity: qty,
            price: recipe?.calculated_price || 0,
            ingredients: recipe?.ingredients || [],
          };
        });

        cartData = {
          meal_id: 'diy-combo-' + Date.now(),
          meal_name: 'DIY Combo',
          description: mealsData.map(m => `${m.name} (x${m.quantity})`).join(', '),
          images: compositeImages,
          meals: mealsData,
          quantity: 1,
          price: calculateTotal(),
          isDIY: true,
        };
      }

      await addToCart(cartData);

      Alert.alert('Success', 'Added to cart!');
      
      // Reset selections
      setSelectedIngredients(new Map());
      setSelectedMeals(new Map());
      setShowSelectedModal(false);
    } catch (error) {
      console.error('Error adding to cart:', error);
      Alert.alert('Error', 'Failed to add to cart');
    }
  };

  const toggleSaveTag = (tag: string) => {
    setSelectedSaveTags(prev => {
      if (prev.includes(tag)) {
        return prev.filter(t => t !== tag);
      } else {
        return [...prev, tag];
      }
    });
  };

  const getSelectedCount = () => {
    return activeTab === 'diy-meals' ? selectedIngredients.size : selectedMeals.size;
  };

  const renderIngredientItem = ({ item }: { item: Ingredient }) => {
    const quantity = selectedIngredients.get(item._id) || 0;
    const stepSize = item.step_size || 1;
    
    return (
      <View style={styles.listItemCard}>
        {item.images?.[0] ? (
          <Image source={{ uri: item.images[0] }} style={styles.listItemImage} />
        ) : (
          <View style={[styles.listItemImage, styles.placeholderImage]}>
            <Ionicons name="nutrition" size={24} color="#ccc" />
          </View>
        )}
        <View style={styles.listItemInfo}>
          <Text style={styles.itemName}>{item.name}</Text>
          <Text style={styles.itemPrice}>
            ₹{(item.calculated_price || item.price_per_unit || 0).toFixed(2)}/{item.unit}
          </Text>
        </View>
        <View style={styles.listItemControls}>
          {quantity > 0 ? (
            <View style={styles.quantityControl}>
              <TouchableOpacity onPress={() => updateIngredientQuantity(item._id, quantity - stepSize)}>
                <Ionicons name="remove-circle" size={28} color="#ffd700" />
              </TouchableOpacity>
              <Text style={styles.quantityText}>{quantity}</Text>
              <TouchableOpacity onPress={() => updateIngredientQuantity(item._id, quantity + stepSize)}>
                <Ionicons name="add-circle" size={28} color="#ffd700" />
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity 
              style={styles.addButton}
              onPress={() => toggleIngredient(item._id, stepSize)}
            >
              <Ionicons name="add-circle" size={28} color="#ffd700" />
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  const renderRecipeItem = ({ item }: { item: Recipe }) => {
    const quantity = selectedMeals.get(item._id) || 0;
    
    return (
      <View style={styles.listItemCard}>
        {item.images?.[0] ? (
          <Image source={{ uri: item.images[0] }} style={styles.listItemImage} />
        ) : (
          <View style={[styles.listItemImage, styles.placeholderImage]}>
            <Ionicons name="restaurant" size={24} color="#ccc" />
          </View>
        )}
        <View style={styles.listItemInfo}>
          <Text style={styles.itemName}>{item.name}</Text>
          <Text style={styles.itemPrice}>₹{(item.calculated_price || 0).toFixed(2)}</Text>
        </View>
        <View style={styles.listItemControls}>
          {quantity > 0 ? (
            <View style={styles.quantityControl}>
              <TouchableOpacity onPress={() => updateMealQuantity(item._id, quantity - 1)}>
                <Ionicons name="remove-circle" size={28} color="#ffd700" />
              </TouchableOpacity>
              <Text style={styles.quantityText}>{quantity}</Text>
              <TouchableOpacity onPress={() => updateMealQuantity(item._id, quantity + 1)}>
                <Ionicons name="add-circle" size={28} color="#ffd700" />
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity 
              style={styles.addButton}
              onPress={() => toggleMeal(item._id)}
            >
              <Ionicons name="add-circle" size={28} color="#ffd700" />
            </TouchableOpacity>
          )}
        </View>
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

  const selectedCount = getSelectedCount();

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
      {/* 2 Main Tabs */}
      <View style={styles.tabContainer}>
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
      </View>

      {/* Sub-tabs for DIY Combos */}
      {activeTab === 'diy-combos' && (
        <View style={styles.subTabContainer}>
          <TouchableOpacity
            style={[styles.subTab, combosSubTab === 'all-meals' && styles.activeSubTab]}
            onPress={() => setCombosSubTab('all-meals')}
          >
            <Text style={[styles.subTabText, combosSubTab === 'all-meals' && styles.activeSubTabText]}>
              All Meals
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.subTab, combosSubTab === 'my-meals' && styles.activeSubTab]}
            onPress={() => setCombosSubTab('my-meals')}
          >
            <Text style={[styles.subTabText, combosSubTab === 'my-meals' && styles.activeSubTabText]}>
              My Meals
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Search and Filter */}
      <View style={styles.searchSection}>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={20} color="#999" />
          <TextInput
            style={styles.searchInput}
            placeholder={activeTab === 'diy-meals' ? 'Search ingredients...' : 'Search meals...'}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>
      </View>

      {/* Tags Filter */}
      {allTags.length > 0 && (
        <View style={styles.tagsContainer}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
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
                onPress={() => setSelectedTag(selectedTag === tag ? null : tag)}
              >
                <Text style={[styles.tagText, selectedTag === tag && styles.tagTextActive]}>{tag}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      {/* List */}
      <FlatList
        data={activeTab === 'diy-meals' ? filteredIngredients : filteredMeals}
        renderItem={activeTab === 'diy-meals' ? renderIngredientItem : renderRecipeItem}
        keyExtractor={(item) => item._id}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>
              {activeTab === 'diy-meals' ? 'No ingredients found' : 'No meals found'}
            </Text>
          </View>
        }
      />

      {/* Meal Name Input Modal with Tags */}
      {user && (
        <Modal
          isVisible={showNameModal}
          onBackdropPress={() => {
            setShowNameModal(false);
            setMealName('');
            setSelectedSaveTags([]);
          }}
          style={styles.modal}
        >
          <View style={styles.nameModalContent}>
            <Text style={styles.nameModalTitle}>
              Name your {activeTab === 'diy-meals' ? 'meal' : 'combo'}
            </Text>
            <TextInput
              style={styles.nameInput}
              placeholder={`Enter ${activeTab === 'diy-meals' ? 'meal' : 'combo'} name`}
              value={mealName}
              onChangeText={setMealName}
              autoFocus
            />
            
            {/* Tags Selection */}
            <Text style={styles.tagsLabel}>Select Tags (Optional)</Text>
            <ScrollView style={styles.tagsScrollView} showsVerticalScrollIndicator={false}>
              <View style={styles.tagsGrid}>
                {allTags.map((tag) => (
                  <TouchableOpacity
                    key={tag}
                    style={[
                      styles.tagSelectChip,
                      selectedSaveTags.includes(tag) && styles.tagSelectChipActive
                    ]}
                    onPress={() => toggleSaveTag(tag)}
                  >
                    <Text
                      style={[
                        styles.tagSelectText,
                        selectedSaveTags.includes(tag) && styles.tagSelectTextActive
                      ]}
                    >
                      {tag}
                    </Text>
                    {selectedSaveTags.includes(tag) && (
                      <Ionicons name="checkmark-circle" size={16} color="#ffd700" />
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>

            <View style={styles.nameModalButtons}>
              <TouchableOpacity
                style={[styles.nameModalButton, styles.cancelButton]}
                onPress={() => {
                  setShowNameModal(false);
                  setMealName('');
                  setSelectedSaveTags([]);
                }}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.nameModalButton, styles.confirmButton]}
                onPress={() => {
                  setShowNameModal(false);
                  if (mealName.trim()) {
                    saveMeal();
                  }
                }}
              >
                <Text style={styles.confirmButtonText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      )}

      {/* Selected Items Bottom Sheet Modal */}
      <Modal
        isVisible={showSelectedModal}
        onBackdropPress={() => setShowSelectedModal(false)}
        onSwipeComplete={() => setShowSelectedModal(false)}
        swipeDirection={['down']}
        style={styles.bottomSheetModal}
      >
        <View style={styles.bottomSheetContent}>
          <View style={styles.bottomSheetHandle} />
          <Text style={styles.bottomSheetTitle}>
            Selected {activeTab === 'diy-meals' ? 'Ingredients' : 'Meals'} ({selectedCount})
          </Text>
          
          <ScrollView style={styles.selectedItemsList}>
            {activeTab === 'diy-meals'
              ? Array.from(selectedIngredients.entries()).map(([id, qty]) => {
                  const ingredient = ingredients.find(i => i._id === id);
                  if (!ingredient) return null;
                  const stepSize = ingredient.step_size || 1;
                  return (
                    <View key={id} style={styles.selectedItemRow}>
                      <View style={styles.selectedItemInfo}>
                        <Text style={styles.selectedItemName}>{ingredient.name}</Text>
                        <Text style={styles.selectedItemPrice}>
                          ₹{((ingredient.calculated_price || ingredient.price_per_unit || 0) * qty).toFixed(2)}
                        </Text>
                      </View>
                      <View style={styles.selectedItemControls}>
                        <TouchableOpacity onPress={() => updateIngredientQuantity(id, qty - stepSize)}>
                          <Ionicons name="remove-circle" size={28} color="#ffd700" />
                        </TouchableOpacity>
                        <Text style={styles.selectedItemQty}>{qty}{ingredient.unit}</Text>
                        <TouchableOpacity onPress={() => updateIngredientQuantity(id, qty + stepSize)}>
                          <Ionicons name="add-circle" size={28} color="#ffd700" />
                        </TouchableOpacity>
                      </View>
                    </View>
                  );
                })
              : Array.from(selectedMeals.entries()).map(([id, qty]) => {
                  const recipe = (combosSubTab === 'all-meals' ? allMeals : myMeals).find(r => r._id === id);
                  if (!recipe) return null;
                  return (
                    <View key={id} style={styles.selectedItemRow}>
                      <View style={styles.selectedItemInfo}>
                        <Text style={styles.selectedItemName}>{recipe.name}</Text>
                        <Text style={styles.selectedItemPrice}>
                          ₹{((recipe.calculated_price || 0) * qty).toFixed(2)}
                        </Text>
                      </View>
                      <View style={styles.selectedItemControls}>
                        <TouchableOpacity onPress={() => updateMealQuantity(id, qty - 1)}>
                          <Ionicons name="remove-circle" size={28} color="#ffd700" />
                        </TouchableOpacity>
                        <Text style={styles.selectedItemQty}>x{qty}</Text>
                        <TouchableOpacity onPress={() => updateMealQuantity(id, qty + 1)}>
                          <Ionicons name="add-circle" size={28} color="#ffd700" />
                        </TouchableOpacity>
                      </View>
                    </View>
                  );
                })}
          </ScrollView>

          <View style={styles.bottomSheetFooter}>
            <View style={styles.totalSection}>
              <Text style={styles.totalLabel}>Total</Text>
              <Text style={styles.totalPrice}>₹{calculateTotal().toFixed(2)}</Text>
            </View>
            <View style={styles.bottomSheetActions}>
              {user && (
                <TouchableOpacity
                  style={[styles.bottomSheetButton, styles.saveButton]}
                  onPress={() => {
                    setShowSelectedModal(false);
                    setShowNameModal(true);
                  }}
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
                style={[styles.bottomSheetButton, styles.cartButton]}
                onPress={addToCartDirect}
              >
                <Ionicons name="cart" size={20} color="#fff" />
                <Text style={styles.cartButtonText}>Add to Cart</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
      </SafeAreaView>

      {/* Floating View Button */}
      {selectedCount > 0 && (
        <TouchableOpacity
          style={styles.floatingViewButton}
          onPress={() => setShowSelectedModal(true)}
        >
          <View style={styles.floatingButtonContent}>
            <View style={styles.floatingButtonBadge}>
              <Text style={styles.floatingButtonBadgeText}>{selectedCount}</Text>
            </View>
            <Text style={styles.floatingButtonText}>View Selected</Text>
            <Ionicons name="chevron-up" size={20} color="#333" />
          </View>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  safeArea: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  tab: {
    flex: 1,
    paddingVertical: 16,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  activeTab: {
    borderBottomColor: '#ffd700',
  },
  tabText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
  },
  activeTabText: {
    color: '#333',
  },
  subTabContainer: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 12,
    justifyContent: 'space-evenly',
  },
  subTab: {
    flex: 1,
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#f5f5f5',
    alignItems: 'center',
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
  searchSection: {
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
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 16,
    color: '#333',
  },
  tagsContainer: {
    backgroundColor: '#fff',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  tagChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#f5f5f5',
    marginLeft: 8,
  },
  tagChipActive: {
    backgroundColor: '#ffd700',
  },
  tagText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  tagTextActive: {
    color: '#333',
  },
  listContent: {
    paddingVertical: 8,
    paddingBottom: 100,
  },
  listItemCard: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 12,
    marginHorizontal: 16,
    marginVertical: 6,
    padding: 12,
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  listItemImage: {
    width: 60,
    height: 60,
    borderRadius: 8,
  },
  placeholderImage: {
    backgroundColor: '#f5f5f5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  listItemInfo: {
    flex: 1,
    marginLeft: 12,
  },
  itemName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  itemPrice: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffd700',
    marginTop: 4,
  },
  listItemControls: {
    marginLeft: 12,
  },
  addButton: {
    padding: 4,
  },
  quantityControl: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  quantityText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    minWidth: 40,
    textAlign: 'center',
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#999',
  },
  floatingViewButton: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    right: 20,
    backgroundColor: '#ffd700',
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 20,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  floatingButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  floatingButtonBadge: {
    backgroundColor: '#333',
    borderRadius: 12,
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  floatingButtonBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  floatingButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    flex: 1,
  },
  modal: {
    justifyContent: 'center',
    alignItems: 'center',
    margin: 0,
  },
  nameModalContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    width: '90%',
    maxWidth: 400,
    maxHeight: '80%',
  },
  nameModalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
    marginBottom: 16,
  },
  nameInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    marginBottom: 16,
    backgroundColor: '#f9f9f9',
  },
  tagsLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    marginBottom: 8,
  },
  tagsScrollView: {
    maxHeight: 200,
    marginBottom: 16,
  },
  tagsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tagSelectChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: '#f5f5f5',
    borderWidth: 1,
    borderColor: '#ddd',
    gap: 6,
  },
  tagSelectChipActive: {
    backgroundColor: '#fff8dc',
    borderColor: '#ffd700',
  },
  tagSelectText: {
    fontSize: 13,
    color: '#666',
  },
  tagSelectTextActive: {
    color: '#333',
    fontWeight: '600',
  },
  nameModalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  nameModalButton: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#f5f5f5',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  cancelButtonText: {
    color: '#666',
    fontSize: 16,
    fontWeight: '600',
  },
  confirmButton: {
    backgroundColor: '#ffd700',
  },
  confirmButtonText: {
    color: '#333',
    fontSize: 16,
    fontWeight: 'bold',
  },
  bottomSheetModal: {
    justifyContent: 'flex-end',
    margin: 0,
  },
  bottomSheetContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 12,
    maxHeight: '80%',
  },
  bottomSheetHandle: {
    width: 40,
    height: 4,
    backgroundColor: '#ddd',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
  },
  bottomSheetTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  selectedItemsList: {
    maxHeight: 400,
    paddingHorizontal: 20,
  },
  selectedItemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  selectedItemInfo: {
    flex: 1,
  },
  selectedItemName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  selectedItemPrice: {
    fontSize: 14,
    color: '#ffd700',
    fontWeight: '600',
  },
  selectedItemControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  selectedItemQty: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
    minWidth: 50,
    textAlign: 'center',
  },
  bottomSheetFooter: {
    borderTopWidth: 1,
    borderTopColor: '#eee',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  totalSection: {
    marginBottom: 16,
  },
  totalLabel: {
    fontSize: 14,
    color: '#666',
  },
  totalPrice: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 4,
  },
  bottomSheetActions: {
    flexDirection: 'row',
    gap: 12,
  },
  bottomSheetButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  saveButton: {
    backgroundColor: '#f5f5f5',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  cartButton: {
    backgroundColor: '#ffd700',
  },
  cartButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
});
