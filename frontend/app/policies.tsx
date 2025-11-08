import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

export default function PoliciesScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Policies</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Privacy Policy</Text>
          <Text style={styles.sectionText}>
            At OrHealthy, we take your privacy seriously. This Privacy Policy describes how we collect, use, and protect your personal information when you use our services.
          </Text>
          <Text style={styles.sectionText}>
            We collect information you provide directly to us, such as when you create an account, place orders, or contact customer support. This may include your name, email address, phone number, and delivery address.
          </Text>
          <Text style={styles.sectionText}>
            We use this information to provide and improve our services, process your orders, communicate with you, and ensure a better user experience.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Terms of Service</Text>
          <Text style={styles.sectionText}>
            By accessing and using OrHealthy, you agree to be bound by these Terms of Service. Please read them carefully before using our platform.
          </Text>
          <Text style={styles.sectionText}>
            You must be at least 18 years old to use our services. You are responsible for maintaining the confidentiality of your account credentials and for all activities that occur under your account.
          </Text>
          <Text style={styles.sectionText}>
            All content, including meal plans, recipes, and nutritional advice, is provided for informational purposes only and should not replace professional medical advice.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Refund Policy</Text>
          <Text style={styles.sectionText}>
            We want you to be completely satisfied with your orders. If you're not happy with your meal, please contact us within 24 hours of delivery.
          </Text>
          <Text style={styles.sectionText}>
            Refunds are available for cancelled orders before they are accepted by our team. Once an order is in preparation, cancellation may not be possible.
          </Text>
          <Text style={styles.sectionText}>
            Refunds will be processed within 5-7 business days to your original payment method.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Delivery Policy</Text>
          <Text style={styles.sectionText}>
            We strive to deliver your meals on time and in perfect condition. Delivery times are estimates and may vary based on traffic, weather, and other factors.
          </Text>
          <Text style={styles.sectionText}>
            Please ensure someone is available to receive your order at the delivery address. We are not responsible for delays caused by incorrect or incomplete addresses.
          </Text>
          <Text style={styles.sectionText}>
            For any delivery issues, please contact our support team immediately.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Guide Terms & Conditions</Text>
          <Text style={styles.sectionText}>
            Guides on OrHealthy must adhere to professional standards and provide accurate nutritional advice. All meal plans should be tailored to individual needs and preferences.
          </Text>
          <Text style={styles.sectionText}>
            Guides earn commissions on orders placed through their meal plans. Commissions are credited after successful delivery of orders.
          </Text>
          <Text style={styles.sectionText}>
            Guides must maintain respectful communication with clients and respond promptly to inquiries.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  content: {
    padding: 20,
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
  },
  sectionText: {
    fontSize: 15,
    color: '#666',
    lineHeight: 24,
    marginBottom: 12,
  },
});