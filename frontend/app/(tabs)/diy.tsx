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
  const [activeTab, setActiveTab] = useState<'diy-meals' | 'diy-combos' | 'my-diy'>('diy-meals');
  const [myDiySubTab, setMyDiySubTab] = useState<'my-meals' | 'my-combos'>('my-meals');
  
  // DIY Meals tab state (from ingredients)
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [filteredIngredients, setFilteredIngredients] = useState<Ingredient[]>([]);
  const [selectedIngredients, setSelectedIngredients] = useState<Map<string, number>>(new Map());
  
  // DIY Combos tab state (from admin meals only)
  const [allMeals, setAllMeals] = useState<Recipe[]>([]);
  const [filteredMeals, setFilteredMeals] = useState<Recipe[]>([]);
  const [selectedMeals, setSelectedMeals] = useState<Map<string, number>>(new Map());
  
  // My DIY tab state (user-created items)
  const [myMeals, setMyMeals] = useState<Recipe[]>([]);
  const [myCombos, setMyCombos] = useState<Recipe[]>([]);
  const [filteredMyDiyItems, setFilteredMyDiyItems] = useState<Recipe[]>([]);
  
  const [mealName, setMealName] = useState('');
  const [selectedSaveTags, setSelectedSaveTags] = useState<string[]>([]);
  
  // Edit modal for My DIY items
  const [editingItem, setEditingItem] = useState<Recipe | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingCustomizations, setEditingCustomizations] = useState<any[]>([]);
  const [showDeleteConfirmModal, setShowDeleteConfirmModal] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);
  const [showNameModal, setShowNameModal] = useState(false);
  const [showSelectedModal, setShowSelectedModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [allTags, setAllTags] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [globalLoading, setGlobalLoading] = useState(false);
  const { addToCart } = useCart();
  const { user } = useAuth();

  useEffect(() => {
    fetchAllData();
  }, []);

  useEffect(() => {
    if (activeTab === 'diy-meals') {
      filterIngredients();
    } else if (activeTab === 'diy-combos') {
      filterMeals();
    } else if (activeTab === 'my-diy') {
      filterMyDiyItems();
    }
  }, [searchQuery, selectedTag, ingredients, allMeals, myMeals, myCombos, activeTab, myDiySubTab]);
  // Reset selected tag and search when switching tabs
  useEffect(() => {
    setSelectedTag(null);
    setSearchQuery('');
  }, [activeTab, myDiySubTab]);

  const fetchAllData = async () => {
    await Promise.all([
      fetchIngredients(),
      fetchAllMeals(),
      fetchMyMeals(),
      fetchMyCombos()
    ]);
  };

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

  const fetchAllMeals = async () => {
    try {
      const response = await axios.get(`${API_URL}/recipes`);
      // Filter only admin preset meals for "All Meals"
      const presetMeals = response.data.filter((meal: any) => meal.is_preset === true);
      setAllMeals(presetMeals);
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
      // Filter only user's non-preset meals for "My Meals"
      const userMeals = response.data.filter((meal: any) => meal.created_by === user._id && meal.is_preset === false);
      setMyMeals(userMeals);
    } catch (error) {
      console.error('Error fetching my meals:', error);
    }
  };

  const fetchMyCombos = async () => {
    if (!user) return;
    try {
      const token = await storage.getItemAsync('session_token');
      const response = await axios.get(`${API_URL}/meals?user_id=${user._id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      // Filter only user's non-preset combos for "My Combos"
      const userCombos = response.data.filter((combo: any) => combo.created_by === user._id && combo.is_preset === false);
      setMyCombos(userCombos);
    } catch (error) {
      console.error('Error fetching my combos:', error);
    }
  };

  const extractTags = (items: (Ingredient | Recipe)[]) => {
    const tags = new Set<string>();
    items.forEach(item => {
      item.tags?.forEach(tag => tags.add(tag));
    });
    setAllTags(Array.from(tags).sort());
  };

  const filterIngredients = () => {
    let filtered = [...ingredients];

    // Extract tags from ingredients for DIY Meals tab
    extractTags(ingredients);

    if (searchQuery) {
      filtered = filtered.filter(ing =>
        ing.name.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    if (selectedTag) {
      filtered = filtered.filter(ing => ing.tags?.includes(selectedTag));
    }

    // Sort alphabetically by name
    filtered = filtered.sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()));

    setFilteredIngredients(filtered);
  };

  const filterMeals = () => {
    // For DIY Combos, show only admin meals (allMeals)
    let meals = [...allMeals];

    // Extract tags from admin meals for DIY Combos tab
    extractTags(allMeals);

    if (searchQuery) {
      meals = meals.filter(meal =>
        meal.name.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    if (selectedTag) {
      meals = meals.filter(meal => meal.tags?.includes(selectedTag));
    }

    // Sort alphabetically by name
    meals = meals.sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()));

    setFilteredMeals(meals);
  };

  const filterMyDiyItems = () => {
    // For My DIY tab, show user items based on sub-tab
    let items = myDiySubTab === 'my-meals' ? myMeals : myCombos;

    // Extract tags from user items only for My DIY tab
    extractTags(items);

    if (searchQuery) {
      items = items.filter(item =>
        item.name.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    if (selectedTag) {
      items = items.filter(item => item.tags?.includes(selectedTag));
    }

    // Sort alphabetically by name
    items = items.sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()));

    setFilteredMyDiyItems(items);
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
          const price = ingredient.calculated_price || ingredient.price_per_unit || 0;
          total += price * qty;
        }
      });
      return total;
    } else {
      let total = 0;
      selectedMeals.forEach((qty, id) => {
        let recipe = allMeals.find(r => r._id === id);
        if (!recipe) {
          recipe = myMeals.find(r => r._id === id);
        }
        if (recipe) {
          const price = recipe.calculated_price || recipe.total_price || recipe.price || 0;
          total += price * qty;
        }
      });
      return total;
    }
  };

  const handleEditMyDiyItem = (item: Recipe) => {
    setEditingItem(item);
    // Initialize customizations from the item
    if (myDiySubTab === 'my-meals') {
      setEditingCustomizations(item.ingredients || []);
    } else {
      setEditingCustomizations(item.meals || []);
    }
    setShowEditModal(true);
  };

  const updateEditingCustomization = (index: number, newQty: number) => {
    const updated = [...editingCustomizations];
    updated[index] = { ...updated[index], quantity: Math.max(0, newQty) };
    setEditingCustomizations(updated);
  };

  const handleSaveMyDiyItem = async () => {
    if (!editingItem) return;
    
    try {
      setGlobalLoading(true);
      setShowEditModal(false);
      
      const token = await storage.getItemAsync('session_token');
      const endpoint = myDiySubTab === 'my-meals' 
        ? `${API_URL}/recipes/${editingItem._id}`
        : `${API_URL}/meals/${editingItem._id}`;
      
      // Send complete data with only updated customizations
      const updateData = myDiySubTab === 'my-meals'
        ? {
            name: editingItem.name,
            description: editingItem.description || '',
            images: editingItem.images || [],
            ingredients: editingCustomizations,
            tags: editingItem.tags || [],
            created_by: editingItem.created_by || 'user'
          }
        : {
            name: editingItem.name,
            description: editingItem.description || '',
            images: editingItem.images || [],
            recipes: editingCustomizations,
            tags: editingItem.tags || [],
            created_by: editingItem.created_by || 'user'
          };
      
      await axios.put(endpoint, updateData, {
        headers: { Authorization: `Bearer ${token}` },
      });
      
      setSuccessMessage('Item updated successfully');
      setShowSuccessModal(true);
      setEditingItem(null);
      
      // Refresh data
      if (myDiySubTab === 'my-meals') {
        fetchMyMeals();
      } else {
        fetchMyCombos();
      }
    } catch (error) {
      console.error('Error updating item:', error);
      setSuccessMessage('Failed to update item');
      setShowSuccessModal(true);
    } finally {
      setGlobalLoading(false);
    }
  };

  const handleDeleteMyDiyItem = async (itemId: string) => {
    try {
      setGlobalLoading(true);
      const token = await storage.getItemAsync('session_token');
      const endpoint = myDiySubTab === 'my-meals' 
        ? `${API_URL}/recipes/${itemId}`
        : `${API_URL}/meals/${itemId}`;
      
      await axios.delete(endpoint, {
        headers: { Authorization: `Bearer ${token}` },
      });
      
      setSuccessMessage('Item deleted successfully');
      setShowSuccessModal(true);
      
      // Refresh data
      if (myDiySubTab === 'my-meals') {
        fetchMyMeals();
      } else {
        fetchMyCombos();
      }
    } catch (error) {
      console.error('Error deleting item:', error);
      setSuccessMessage('Failed to delete item');
      setShowSuccessModal(true);
    } finally {
      setGlobalLoading(false);
    }
  };

  const handleAddEditedItemToCart = async () => {
    if (!editingItem) return;
    
    try {
      setGlobalLoading(true);
      setShowEditModal(false);
      
      // Calculate price from edited customizations
      const totalPrice = editingCustomizations.reduce(
        (sum, item) => sum + ((item.price || item.price_per_unit || 0) * (item.quantity || 0)), 
        0
      );
      
      if (myDiySubTab === 'my-meals') {
        // Add meal to cart with edited customizations
        const customizations = editingCustomizations
          .filter(ing => (ing.quantity || 0) > 0)
          .map(ing => ({
            ingredient_id: ing.ingredient_id || ing._id || '',
            name: ing.name || ing.ingredient_name || '',
            price: ing.price || ing.price_per_unit || 0,
            default_quantity: ing.default_quantity || ing.quantity || 1,
            quantity: ing.quantity || ing.default_quantity || 1,
          }));

        await addToCart({
          meal_id: editingItem._id,
          meal_name: editingItem.name,
          customizations: customizations,
          quantity: 1,
          price: totalPrice,
        });
      } else {
        // Add combo to cart with edited customizations
        const customizations = editingCustomizations
          .filter(meal => (meal.quantity || 0) > 0)
          .map(meal => ({
            ingredient_id: meal.recipe_id || meal._id || '',
            name: meal.name || '',
            price: meal.price || 0,
            default_quantity: meal.quantity || 1,
            quantity: meal.quantity || 1,
          }));

        await addToCart({
          meal_id: editingItem._id,
          meal_name: editingItem.name,
          customizations: customizations,
          quantity: 1,
          price: totalPrice,
        });
      }

      setSuccessMessage('Added to cart!');
      setShowSuccessModal(true);
      setEditingItem(null);
    } catch (error) {
      console.error('Error adding to cart:', error);
      setSuccessMessage('Failed to add to cart');
      setShowSuccessModal(true);
    } finally {
      setGlobalLoading(false);
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
        let recipe = allMeals.find(r => r._id === id);
        if (!recipe) {
          recipe = myMeals.find(r => r._id === id);
        }
        if (recipe?.images?.[0]) {
          images.push(recipe.images[0]);
        }
      });
      return images.slice(0, 4);
    }
  };

  const saveMeal = async () => {
    if (!user) {
      setSuccessMessage('Please login to save meals');
      setShowSuccessModal(true);
      return;
    }

    if (!mealName.trim()) {
      setSuccessMessage('Please enter a meal name');
      setShowSuccessModal(true);
      return;
    }

    if (activeTab === 'diy-meals' && selectedIngredients.size === 0) {
      setSuccessMessage('Please select at least one ingredient');
      setShowSuccessModal(true);
      return;
    }

    if (activeTab !== 'diy-meals' && selectedMeals.size === 0) {
      setSuccessMessage('Please select at least one meal');
      setShowSuccessModal(true);
      return;
    }

    try {
      setGlobalLoading(true);
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
          description: '',
          ingredients: ingredientsList,
          images: compositeImages,
          tags: selectedSaveTags,
          is_preset: false,
          created_by: user._id,
        };
      } else {
        // Creating combo from meals -> POST to /meals
        const recipesList = Array.from(selectedMeals.entries()).map(([id, qty]) => {
          let recipe = allMeals.find(r => r._id === id);
          if (!recipe) {
            recipe = myMeals.find(r => r._id === id);
          }
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
          description: '',
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

      // Show success message
      setSuccessMessage(`Saved to ${activeTab === 'diy-meals' ? 'My Meals' : 'My Combos'} in Presets!`);
      setShowSuccessModal(true);
      
      // Reset
      setMealName('');
      setSelectedSaveTags([]);
      setSelectedIngredients(new Map());
      setSelectedMeals(new Map());
      setShowSelectedModal(false);
      
      // Refresh data after a delay to allow modal to show
      setTimeout(() => {
        if (activeTab === 'diy-meals') {
          fetchMyMeals();
        } else if (activeTab === 'diy-combos') {
          fetchMyCombos();
        }
      }, 500);
    } catch (error) {
      console.error('Error saving meal:', error);
      setSuccessMessage('Failed to save. Please try again.');
      setShowSuccessModal(true);
    } finally {
      setSaving(false);
      setGlobalLoading(false);
    }
  };

  const addToCartDirect = async () => {
    if (activeTab === 'diy-meals' && selectedIngredients.size === 0) {
      setSuccessMessage('Please select at least one ingredient');
      setShowSuccessModal(true);
      return;
    }

    if (activeTab !== 'diy-meals' && selectedMeals.size === 0) {
      setSuccessMessage('Please select at least one meal');
      setShowSuccessModal(true);
      return;
    }

    // Close the selections modal first
    setShowSelectedModal(false);

    try {
      setGlobalLoading(true);
      
      if (activeTab === 'diy-meals') {
        const customizations = Array.from(selectedIngredients.entries()).map(([id, qty]) => {
          const ingredient = ingredients.find(i => i._id === id);
          return {
            ingredient_id: id,
            name: ingredient?.name || '',
            price: ingredient?.calculated_price || ingredient?.price_per_unit || 0,
            default_quantity: qty,
            quantity: qty,
          };
        });

        await addToCart({
          meal_id: 'diy-meal-' + Date.now(),
          meal_name: 'DIY Meal',
          customizations: customizations,
          quantity: 1,
          price: calculateTotal(),
        });
      } else {
        // For DIY combos, we need to flatten the meals into customizations
        const customizations = Array.from(selectedMeals.entries()).map(([id, qty]) => {
          let recipe = allMeals.find(r => r._id === id);
          if (!recipe) {
            recipe = myMeals.find(r => r._id === id);
          }
          return {
            ingredient_id: id,
            name: recipe?.name || '',
            price: recipe?.calculated_price || 0,
            default_quantity: qty,
            quantity: qty,
          };
        });

        await addToCart({
          meal_id: 'diy-combo-' + Date.now(),
          meal_name: 'DIY Combo',
          customizations: customizations,
          quantity: 1,
          price: calculateTotal(),
        });
      }

      setSuccessMessage('Added to cart!');
      setShowSuccessModal(true);
      
      // Reset selections
      setSelectedIngredients(new Map());
      setSelectedMeals(new Map());
    } catch (error) {
      console.error('Error adding to cart:', error);
      setSuccessMessage('Failed to add to cart. Please try again.');
      setShowSuccessModal(true);
    } finally {
      setGlobalLoading(false);
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
    const price = item.calculated_price || item.total_price || item.price || 0;
    
    // For My DIY tab, items are clickable to edit
    if (activeTab === 'my-diy') {
      return (
        <View style={styles.listItemCard}>
          <TouchableOpacity 
            style={styles.myDiyItemContent}
            onPress={() => handleEditMyDiyItem(item)}
          >
            {item.images?.[0] ? (
              <Image source={{ uri: item.images[0] }} style={styles.listItemImage} />
            ) : (
              <View style={[styles.listItemImage, styles.placeholderImage]}>
                <Ionicons name="restaurant" size={24} color="#ccc" />
              </View>
            )}
            <View style={styles.listItemInfo}>
              <Text style={styles.itemName}>{item.name}</Text>
              <Text style={styles.itemPrice}>₹{price.toFixed(2)}</Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.deleteIconButton}
            onPress={() => {
              // Show confirmation before delete
              setItemToDelete(item._id);
              setShowDeleteConfirmModal(true);
            }}
          >
            <Ionicons name="trash" size={20} color="#ef4444" />
          </TouchableOpacity>
        </View>
      );
    }
    
    // For DIY Combos tab, normal behavior with quantity controls
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
          <Text style={styles.itemPrice}>₹{price.toFixed(2)}</Text>
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
      {/* 3 Main Tabs */}
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
        <TouchableOpacity
          style={[styles.tab, activeTab === 'my-diy' && styles.activeTab]}
          onPress={() => setActiveTab('my-diy')}
        >
          <Text style={[styles.tabText, activeTab === 'my-diy' && styles.activeTabText]}>
            My DIY
          </Text>
        </TouchableOpacity>
      </View>

      {/* Sub-tabs for My DIY */}
      {activeTab === 'my-diy' && (
        <View style={styles.subTabContainer}>
          <TouchableOpacity
            style={[styles.subTab, myDiySubTab === 'my-meals' && styles.activeSubTab]}
            onPress={() => setMyDiySubTab('my-meals')}
          >
            <Text style={[styles.subTabText, myDiySubTab === 'my-meals' && styles.activeSubTabText]}>
              My Meals
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.subTab, myDiySubTab === 'my-combos' && styles.activeSubTab]}
            onPress={() => setMyDiySubTab('my-combos')}
          >
            <Text style={[styles.subTabText, myDiySubTab === 'my-combos' && styles.activeSubTabText]}>
              My Combos
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
            placeholder={
              activeTab === 'diy-meals' 
                ? 'Search ingredients...' 
                : activeTab === 'diy-combos'
                ? 'Search meals...'
                : myDiySubTab === 'my-meals'
                ? 'Search meals...'
                : 'Search combos...'
            }
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
        data={
          activeTab === 'diy-meals' 
            ? filteredIngredients 
            : activeTab === 'diy-combos'
            ? filteredMeals
            : filteredMyDiyItems
        }
        renderItem={activeTab === 'diy-meals' ? renderIngredientItem : renderRecipeItem}
        keyExtractor={(item) => item._id}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>
              {activeTab === 'diy-meals' 
                ? 'No ingredients found' 
                : activeTab === 'diy-combos'
                ? 'No meals found'
                : 'No saved items yet'}
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
            {activeTab === 'diy-meals' ? (
              <>
                {Array.from(selectedIngredients.entries()).map(([id, qty]) => {
                  const ingredient = ingredients.find(i => i._id === id);
                  if (!ingredient) return null;
                  const stepSize = ingredient.step_size || 1;
                  const pricePerUnit = ingredient.calculated_price || ingredient.price_per_unit || 0;
                  return (
                    <View key={id} style={styles.selectedItemRow}>
                      <View style={styles.selectedItemInfo}>
                        <Text style={styles.selectedItemName}>{ingredient.name}</Text>
                        <Text style={styles.selectedItemPrice}>
                          ₹{pricePerUnit.toFixed(2)}/{ingredient.unit} • Total: ₹{(pricePerUnit * qty).toFixed(2)}
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
                })}
              </>
            ) : (
              <>
                {Array.from(selectedMeals.entries()).map(([id, qty]) => {
                  // Search in both allMeals and myMeals to show combined selections
                  let recipe = allMeals.find(r => r._id === id);
                  if (!recipe) {
                    recipe = myMeals.find(r => r._id === id);
                  }
                  if (!recipe) return null;
                  const pricePerMeal = recipe.calculated_price || 0;
                  return (
                    <View key={id} style={styles.selectedItemRow}>
                      <View style={styles.selectedItemInfo}>
                        <Text style={styles.selectedItemName}>{recipe.name}</Text>
                        <Text style={styles.selectedItemPrice}>
                          ₹{pricePerMeal.toFixed(2)}/meal • Total: ₹{(pricePerMeal * qty).toFixed(2)}
                        </Text>
                      </View>
                      <View style={styles.selectedItemControls}>
                        <TouchableOpacity onPress={() => updateMealQuantity(id, qty - 1)}>
                          <Ionicons name="remove-circle" size={28} color="#ffd700" />
                        </TouchableOpacity>
                        <Text style={styles.selectedItemQty}>{qty}</Text>
                        <TouchableOpacity onPress={() => updateMealQuantity(id, qty + 1)}>
                          <Ionicons name="add-circle" size={28} color="#ffd700" />
                        </TouchableOpacity>
                      </View>
                    </View>
                  );
                })}
              </>
            )}
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
      
      {/* Success Modal */}
      <Modal
        isVisible={showSuccessModal}
        onBackdropPress={() => setShowSuccessModal(false)}
        style={styles.modal}
      >
        <View style={styles.successModalContent}>
          <View style={styles.successIcon}>
            <Ionicons name="checkmark-circle" size={60} color="#4CAF50" />
          </View>
          <Text style={styles.successMessage}>{successMessage}</Text>
          <TouchableOpacity
            style={styles.successButton}
            onPress={() => setShowSuccessModal(false)}
          >
            <Text style={styles.successButtonText}>OK</Text>
          </TouchableOpacity>
        </View>
      </Modal>
      
      {/* Edit My DIY Item Modal - Bottom Sheet */}
      <Modal
        isVisible={showEditModal}
        onBackdropPress={() => setShowEditModal(false)}
        style={styles.modalBottom}
      >
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{editingItem?.name}</Text>
            <TouchableOpacity onPress={() => setShowEditModal(false)}>
              <Ionicons name="close" size={28} color="#333" />
            </TouchableOpacity>
          </View>
          
          <ScrollView style={styles.modalBody}>
            {myDiySubTab === 'my-meals' ? (
              editingCustomizations.map((ing, index) => (
                <View key={index} style={styles.ingredientRow}>
                  <View style={styles.ingredientInfo}>
                    <Text style={styles.ingredientName}>{ing.name || ing.ingredient_name}</Text>
                    <Text style={styles.ingredientPrice}>
                      ₹{(ing.price || ing.price_per_unit || 0).toFixed(2)}/{ing.unit || 'unit'}
                    </Text>
                  </View>
                  <View style={styles.quantityControl}>
                    {(ing.quantity || 0) > 0 ? (
                      <>
                        <TouchableOpacity
                          onPress={() => {
                            const stepSize = ing.step_size || 1;
                            updateEditingCustomization(index, (ing.quantity || 0) - stepSize);
                          }}
                        >
                          <Ionicons name="remove-circle" size={28} color="#ffd700" />
                        </TouchableOpacity>
                        <Text style={styles.quantity}>{ing.quantity}</Text>
                        <TouchableOpacity
                          onPress={() => {
                            const stepSize = ing.step_size || 1;
                            updateEditingCustomization(index, (ing.quantity || 0) + stepSize);
                          }}
                        >
                          <Ionicons name="add-circle" size={28} color="#ffd700" />
                        </TouchableOpacity>
                      </>
                    ) : (
                      <TouchableOpacity
                        onPress={() => {
                          const stepSize = ing.step_size || 1;
                          updateEditingCustomization(index, stepSize);
                        }}
                        style={styles.addBackButton}
                      >
                        <Ionicons name="add-circle" size={32} color="#ffd700" />
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              ))
            ) : (
              editingCustomizations.map((meal, index) => (
                <View key={index} style={styles.ingredientRow}>
                  <View style={styles.ingredientInfo}>
                    <Text style={styles.ingredientName}>{meal.name}</Text>
                    <Text style={styles.ingredientPrice}>
                      ₹{(meal.price || 0).toFixed(2)}/meal
                    </Text>
                  </View>
                  <View style={styles.quantityControl}>
                    {(meal.quantity || 0) > 0 ? (
                      <>
                        <TouchableOpacity
                          onPress={() => updateEditingCustomization(index, (meal.quantity || 0) - 1)}
                        >
                          <Ionicons name="remove-circle" size={28} color="#ffd700" />
                        </TouchableOpacity>
                        <Text style={styles.quantity}>{meal.quantity}</Text>
                        <TouchableOpacity
                          onPress={() => updateEditingCustomization(index, (meal.quantity || 0) + 1)}
                        >
                          <Ionicons name="add-circle" size={28} color="#ffd700" />
                        </TouchableOpacity>
                      </>
                    ) : (
                      <TouchableOpacity
                        onPress={() => updateEditingCustomization(index, 1)}
                        style={styles.addBackButton}
                      >
                        <Ionicons name="add-circle" size={32} color="#ffd700" />
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              ))
            )}
          </ScrollView>
          
          <View style={styles.modalFooter}>
            <Text style={styles.modalFooterLabel}>Total:</Text>
            <Text style={styles.modalFooterPrice}>
              ₹{editingCustomizations.reduce((sum, item) => sum + ((item.price || item.price_per_unit || 0) * (item.quantity || 0)), 0).toFixed(2)}
            </Text>
          </View>
          
          <View style={styles.modalActions}>
            <TouchableOpacity
              style={styles.saveButton}
              onPress={handleSaveMyDiyItem}
            >
              <Text style={styles.saveButtonText}>Save</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.modalAddToCartButton}
              onPress={handleAddEditedItemToCart}
            >
              <Text style={styles.modalAddToCartButtonText}>Add to Cart</Text>
            </TouchableOpacity>
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
      
      {/* Global Loading Overlay */}
      {globalLoading && (
        <View style={styles.loadingOverlay}>
          <View style={styles.loadingOverlayContent}>
            <ActivityIndicator size="large" color="#ffd700" />
            <Text style={styles.loadingOverlayText}>Processing...</Text>
          </View>
        </View>
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
    outlineStyle: 'none',
  },
  tagsContainer: {
    backgroundColor: '#fff',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    height: 60,
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
    bottom: 90,
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
    fontSize: 13,
    color: '#666',
    fontWeight: '500',
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
  cartButton: {
    backgroundColor: '#ffd700',
  },
  cartButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  successModalContent: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 32,
    alignItems: 'center',
    maxWidth: 400,
  },
  successIcon: {
    marginBottom: 16,
  },
  successMessage: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    textAlign: 'center',
    marginBottom: 24,
  },
  successButton: {
    backgroundColor: '#ffd700',
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 12,
    minWidth: 120,
  },
  successButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
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
    textAlign: 'center',
  },
  myDiyItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  deleteIconButton: {
    padding: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  ingredientRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  ingredientInfo: {
    flex: 1,
  },
  ingredientName: {
    fontSize: 16,
    fontWeight: '500',
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
    minWidth: 40,
    textAlign: 'center',
  },
  addBackButton: {
    padding: 4,
  },
  modalFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  modalFooterLabel: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  modalFooterPrice: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#ffd700',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    paddingTop: 16,
  },
  saveButton: {
    flex: 1,
    backgroundColor: '#4CAF50',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  modalAddToCartButton: {
    flex: 1,
    backgroundColor: '#ffd700',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  modalAddToCartButtonText: {
    color: '#333',
    fontSize: 16,
    fontWeight: '600',
  },
  modalBottom: {
    justifyContent: 'flex-end',
    margin: 0,
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 12,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  modalBody: {
    paddingHorizontal: 20,
    maxHeight: 400,
  },
});
