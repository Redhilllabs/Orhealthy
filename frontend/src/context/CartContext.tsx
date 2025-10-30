import { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';
import { storage } from '../utils/storage';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL + '/api';

interface CartItem {
  meal_id?: string;
  meal_name: string;
  customizations: any[];
  quantity: number;
  price: number;
}

interface CartContextType {
  cartItems: CartItem[];
  loading: boolean;
  addToCart: (item: CartItem) => Promise<void>;
  removeFromCart: (index: number) => Promise<void>;
  updateQuantity: (index: number, quantity: number) => Promise<void>;
  clearCart: () => Promise<void>;
  refreshCart: () => Promise<void>;
  totalPrice: number;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    refreshCart();
  }, []);

  const refreshCart = async () => {
    try {
      setLoading(true);
      const token = await storage.getItemAsync('session_token');
      if (!token) return;

      const response = await axios.get(`${API_URL}/cart`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      setCartItems(response.data.items || []);
    } catch (error) {
      console.error('Error fetching cart:', error);
    } finally {
      setLoading(false);
    }
  };

  const addToCart = async (item: CartItem) => {
    try {
      const token = await storage.getItemAsync('session_token');
      if (!token) throw new Error('Not authenticated');

      await axios.post(`${API_URL}/cart`, item, {
        headers: { Authorization: `Bearer ${token}` },
      });

      await refreshCart();
    } catch (error) {
      console.error('Error adding to cart:', error);
      throw error;
    }
  };

  const removeFromCart = async (index: number) => {
    try {
      const token = await storage.getItemAsync('session_token');
      if (!token) throw new Error('Not authenticated');

      await axios.delete(`${API_URL}/cart/${index}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      await refreshCart();
    } catch (error) {
      console.error('Error removing from cart:', error);
      throw error;
    }
  };

  const updateQuantity = async (index: number, quantity: number) => {
    try {
      const token = await storage.getItemAsync('session_token');
      if (!token) throw new Error('Not authenticated');

      await axios.put(
        `${API_URL}/cart/${index}`,
        { quantity },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      await refreshCart();
    } catch (error) {
      console.error('Error updating quantity:', error);
      throw error;
    }
  };

  const clearCart = async () => {
    try {
      const token = await storage.getItemAsync('session_token');
      if (!token) throw new Error('Not authenticated');

      await axios.delete(`${API_URL}/cart`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      setCartItems([]);
    } catch (error) {
      console.error('Error clearing cart:', error);
      throw error;
    }
  };

  const totalPrice = cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0);

  return (
    <CartContext.Provider
      value={{
        cartItems,
        loading,
        addToCart,
        removeFromCart,
        updateQuantity,
        clearCart,
        refreshCart,
        totalPrice,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (context === undefined) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
}
