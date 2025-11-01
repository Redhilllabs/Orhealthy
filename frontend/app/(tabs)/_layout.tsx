import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { useCart } from '../../src/context/CartContext';
import { useMessages } from '../../src/context/MessagesContext';

export default function TabsLayout() {
  const { cartItems } = useCart();
  const { unreadCount: messagesUnreadCount } = useMessages();
  const cartCount = cartItems.length;

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#ffd700',
        tabBarInactiveTintColor: '#666',
        tabBarStyle: {
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          backgroundColor: '#fff',
          borderTopWidth: 1,
          borderTopColor: '#eee',
          height: Platform.OS === 'ios' ? 88 : 70,
          paddingBottom: Platform.OS === 'ios' ? 28 : 10,
          paddingTop: 8,
          elevation: 8,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: 0.1,
          shadowRadius: 8,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
          marginTop: 2,
          marginBottom: 0,
        },
        tabBarIconStyle: {
          marginTop: 2,
        },
        headerShown: false,
      }}
    >
      <Tabs.Screen
        name="presets"
        options={{
          title: 'Presets',
          tabBarIcon: ({ color }) => (
            <Ionicons name="restaurant" size={22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="diy"
        options={{
          title: 'DIY',
          tabBarIcon: ({ color }) => (
            <Ionicons name="create" size={22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color }) => (
            <Ionicons name="home" size={22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="messages"
        options={{
          title: 'Chats',
          tabBarIcon: ({ color }) => (
            <View style={styles.iconContainer}>
              <Ionicons name="chatbubbles" size={22} color={color} />
              {messagesUnreadCount > 0 && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{messagesUnreadCount}</Text>
                </View>
              )}
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="cart"
        options={{
          title: 'Cart',
          tabBarIcon: ({ color }) => (
            <View style={styles.iconContainer}>
              <Ionicons name="cart" size={22} color={color} />
              {cartCount > 0 && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{cartCount}</Text>
                </View>
              )}
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          href: null,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  iconContainer: {
    position: 'relative',
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    top: -6,
    right: -10,
    backgroundColor: '#ef4444',
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
    borderWidth: 2,
    borderColor: '#fff',
  },
  badgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
});
