import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert } from 'react-native';
import { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuth } from '../src/context/AuthContext';

export default function ContactUsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!subject.trim() || !message.trim()) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    setSubmitting(true);
    // Simulate API call
    setTimeout(() => {
      setSubmitting(false);
      Alert.alert('Success', 'Your message has been sent successfully. We\'ll get back to you soon!');
      setSubject('');
      setMessage('');
    }, 1000);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Contact Us</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.infoSection}>
          <View style={styles.infoCard}>
            <Ionicons name="mail-outline" size={32} color="#ffd700" />
            <Text style={styles.infoTitle}>Email</Text>
            <Text style={styles.infoText}>support@orhealthy.com</Text>
          </View>

          <View style={styles.infoCard}>
            <Ionicons name="call-outline" size={32} color="#ffd700" />
            <Text style={styles.infoTitle}>Phone</Text>
            <Text style={styles.infoText}>+91 1800-123-4567</Text>
          </View>

          <View style={styles.infoCard}>
            <Ionicons name="time-outline" size={32} color="#ffd700" />
            <Text style={styles.infoTitle}>Working Hours</Text>
            <Text style={styles.infoText}>Mon - Sat: 9:00 AM - 9:00 PM</Text>
          </View>
        </View>

        <View style={styles.formSection}>
          <Text style={styles.formTitle}>Send us a message</Text>
          <Text style={styles.formSubtitle}>We'd love to hear from you!</Text>

          <TextInput
            style={styles.input}
            placeholder="Your Name"
            placeholderTextColor="#999"
            value={user?.name || ''}
            editable={false}
          />

          <TextInput
            style={styles.input}
            placeholder="Your Email"
            placeholderTextColor="#999"
            value={user?.email || ''}
            editable={false}
          />

          <TextInput
            style={styles.input}
            placeholder="Subject *"
            placeholderTextColor="#999"
            value={subject}
            onChangeText={setSubject}
          />

          <TextInput
            style={[styles.input, styles.messageInput]}
            placeholder="Your Message *"
            placeholderTextColor="#999"
            value={message}
            onChangeText={setMessage}
            multiline
            numberOfLines={6}
            textAlignVertical="top"
          />

          <TouchableOpacity
            style={[styles.submitButton, submitting && styles.submitButtonDisabled]}
            onPress={handleSubmit}
            disabled={submitting}
          >
            {submitting ? (
              <Text style={styles.submitButtonText}>Sending...</Text>
            ) : (
              <Text style={styles.submitButtonText}>Send Message</Text>
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.socialSection}>
          <Text style={styles.socialTitle}>Follow Us</Text>
          <View style={styles.socialIcons}>
            <TouchableOpacity style={styles.socialButton}>
              <Ionicons name="logo-facebook" size={28} color="#3b5998" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.socialButton}>
              <Ionicons name="logo-twitter" size={28} color="#1da1f2" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.socialButton}>
              <Ionicons name="logo-instagram" size={28} color="#e4405f" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.socialButton}>
              <Ionicons name="logo-linkedin" size={28} color="#0077b5" />
            </TouchableOpacity>
          </View>
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
  infoSection: {
    marginBottom: 32,
  },
  infoCard: {
    backgroundColor: '#f9f9f9',
    borderRadius: 12,
    padding: 20,
    marginBottom: 12,
    alignItems: 'center',
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 12,
    marginBottom: 4,
  },
  infoText: {
    fontSize: 14,
    color: '#666',
  },
  formSection: {
    marginBottom: 32,
  },
  formTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  formSubtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 20,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 12,
  },
  messageInput: {
    height: 120,
  },
  submitButton: {
    backgroundColor: '#ffd700',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
  },
  submitButtonDisabled: {
    backgroundColor: '#ccc',
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
  },
  socialSection: {
    alignItems: 'center',
  },
  socialTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
  },
  socialIcons: {
    flexDirection: 'row',
    gap: 16,
  },
  socialButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#f9f9f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
});