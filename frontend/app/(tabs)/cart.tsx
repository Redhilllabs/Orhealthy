import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useCart } from '../../src/context/CartContext';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function CartScreen() {
  const { cartItems, loading, removeFromCart, updateQuantity, totalPrice } = useCart();
  const router = useRouter();
  const [removing, setRemoving] = useState<number | null>(null);
  const [updating, setUpdating] = useState<number | null>(null);

  const handleRemove = async (index: number) => {
    setRemoving(index);
    try {
      await removeFromCart(index);
    } catch (error) {
      console.error('Error removing item:', error);
    } finally {
      setRemoving(null);
    }
  };

  const handleQuantityChange = async (index: number, newQuantity: number) => {
    if (newQuantity < 1) return;
    setUpdating(index);
    try {
      await updateQuantity(index, newQuantity);
    } catch (error) {
      console.error('Error updating quantity:', error);
    } finally {
      setUpdating(null);
    }
  };

  const renderItem = ({ item, index }: { item: any; index: number }) => (
    <View style={styles.cartItem}>
      <View style={styles.itemInfo}>
        <Text style={styles.itemName}>{item.meal_name}</Text>
        
        {item.customizations && item.customizations.length > 0 && (
          <View style={styles.ingredients}>
            {item.customizations.map((ing: any, idx: number) => (
              <Text key={idx} style={styles.ingredientText}>
                • {ing.name} (x{ing.quantity || ing.default_quantity})
              </Text>
            ))}
          </View>
        )}

        <View style={styles.itemFooter}>
          <Text style={styles.itemPrice}>₹{item.price.toFixed(2)}</Text>
          
          <View style={styles.quantityControl}>
            <TouchableOpacity
              style={styles.quantityButton}
              onPress={() => handleQuantityChange(index, item.quantity - 1)}
              disabled={item.quantity <= 1 || updating === index}
            >
              <Ionicons name="remove" size={20} color={item.quantity <= 1 ? "#ccc" : "#ffd700"} />
            </TouchableOpacity>
            
            <Text style={styles.quantityText}>{item.quantity}</Text>
            
            <TouchableOpacity
              style={styles.quantityButton}
              onPress={() => handleQuantityChange(index, item.quantity + 1)}
              disabled={updating === index}
            >
              <Ionicons name="add" size={20} color="#ffd700" />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <TouchableOpacity
        style={styles.removeButton}
        onPress={() => handleRemove(index)}
        disabled={removing === index}
      >
        {removing === index ? (
          <ActivityIndicator size="small" color="#F44336" />
        ) : (
          <Ionicons name="trash-outline" size={24} color="#F44336" />
        )}
      </TouchableOpacity>
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
        <Text style={styles.headerTitle}>My Cart</Text>
        {cartItems.length > 0 && (
          <View style={styles.itemCount}>
            <Text style={styles.itemCountText}>{cartItems.length}</Text>
          </View>
        )}
      </View>

      {cartItems.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="cart-outline" size={80} color="#ccc" />
          <Text style={styles.emptyText}>Your cart is empty</Text>
          <Text style={styles.emptySubtext}>
            Add some delicious meals to get started!
          </Text>
        </View>
      ) : (
        <>
          <FlatList
            data={cartItems}
            renderItem={renderItem}
            keyExtractor={(item, index) => index.toString()}
            contentContainerStyle={styles.listContent}
          />

          <View style={styles.footer}>
            <View style={styles.totalContainer}>
              <Text style={styles.totalLabel}>Total</Text>
              <Text style={styles.totalPrice}>₹{totalPrice.toFixed(2)}</Text>
            </View>

            <TouchableOpacity
              style={styles.checkoutButton}
              onPress={() => router.push('/checkout')}
            >
              <Text style={styles.checkoutButtonText}>Proceed to Checkout</Text>
              <Ionicons name="arrow-forward" size={20} color="#fff" />
            </TouchableOpacity>
          </View>
        </>
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
  itemCount: {
    backgroundColor: '#ffd700',
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  itemCountText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  listContent: {
    padding: 16,
  },
  cartItem: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  itemInfo: {
    flex: 1,
  },
  itemName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  ingredients: {
    marginBottom: 12,
  },
  ingredientText: {
    fontSize: 13,
    color: '#666',
    marginBottom: 2,
  },
  itemFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  itemPrice: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#ffd700',
  },
  itemQuantity: {
    fontSize: 14,
    color: '#666',
  },
  removeButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 12,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#666',
    marginTop: 24,
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 16,
    color: '#999',
    textAlign: 'center',
  },
  footer: {
    backgroundColor: '#fff',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  totalContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  totalLabel: {
    fontSize: 18,
    color: '#666',
  },
  totalPrice: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#ffd700',
  },
  checkoutButton: {
    backgroundColor: '#ffd700',
    paddingVertical: 16,
    borderRadius: 12,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  checkoutButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
});
