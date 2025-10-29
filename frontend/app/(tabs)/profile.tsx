import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Image,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../src/context/AuthContext';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function ProfileScreen() {
  const { user, logout, updateProfile, refreshUser } = useAuth();
  const [editing, setEditing] = useState(false);
  const [height, setHeight] = useState(user?.profile?.height?.toString() || '');
  const [weight, setWeight] = useState(user?.profile?.weight?.toString() || '');
  const [allergies, setAllergies] = useState(
    user?.profile?.allergies?.join(', ') || ''
  );
  const [expertise, setExpertise] = useState(user?.profile?.expertise || '');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    try {
      setSaving(true);
      await updateProfile({
        height: height ? parseFloat(height) : undefined,
        weight: weight ? parseFloat(weight) : undefined,
        allergies: allergies ? allergies.split(',').map(a => a.trim()).filter(Boolean) : [],
        expertise,
      });
      setEditing(false);
      await refreshUser();
      alert('Profile updated successfully!');
    } catch (error) {
      console.error('Error updating profile:', error);
      alert('Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setHeight(user?.profile?.height?.toString() || '');
    setWeight(user?.profile?.weight?.toString() || '');
    setAllergies(user?.profile?.allergies?.join(', ') || '');
    setExpertise(user?.profile?.expertise || '');
    setEditing(false);
  };

  const renderStars = (rating: number) => {
    return Array.from({ length: 5 }).map((_, index) => (
      <Ionicons
        key={index}
        name={index < rating ? 'star' : 'star-outline'}
        size={24}
        color="#FFD700"
      />
    ));
  };

  if (!user) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#ffd700" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>My Profile</Text>
        <TouchableOpacity onPress={logout}>
          <Ionicons name="log-out-outline" size={28} color="#F44336" />
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flex}
      >
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {/* Profile Header */}
          <View style={styles.profileHeader}>
            {user.picture ? (
              <Image source={{ uri: user.picture }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, styles.avatarPlaceholder]}>
                <Text style={styles.avatarText}>
                  {user.name?.charAt(0).toUpperCase()}
                </Text>
              </View>
            )}

            <Text style={styles.name}>{user.name}</Text>
            <Text style={styles.email}>{user.email}</Text>

            <View style={styles.badge}>
              {user.is_guide ? (
                <View style={styles.guideBadge}>
                  <Ionicons name="medal" size={20} color="#ffd700" />
                  <Text style={styles.guideText}>Guide</Text>
                </View>
              ) : (
                <Text style={styles.guideeText}>Guidee</Text>
              )}
            </View>

            <View style={styles.statsContainer}>
              <View style={styles.statBox}>
                <Text style={styles.statValue}>{user.points + user.inherent_points}</Text>
                <Text style={styles.statLabel}>Points</Text>
              </View>

              <View style={styles.statBox}>
                <View style={styles.stars}>{renderStars(user.star_rating)}</View>
                <Text style={styles.statLabel}>Rating</Text>
              </View>
            </View>
          </View>

          {/* Profile Details */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Profile Details</Text>
              {!editing && (
                <TouchableOpacity onPress={() => setEditing(true)}>
                  <Ionicons name="create-outline" size={24} color="#ffd700" />
                </TouchableOpacity>
              )}
            </View>

            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Height (cm)</Text>
              {editing ? (
                <TextInput
                  style={styles.detailInput}
                  value={height}
                  onChangeText={setHeight}
                  placeholder="Enter height"
                  keyboardType="decimal-pad"
                />
              ) : (
                <Text style={styles.detailValue}>
                  {user.profile?.height || 'Not set'}
                </Text>
              )}
            </View>

            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Weight (kg)</Text>
              {editing ? (
                <TextInput
                  style={styles.detailInput}
                  value={weight}
                  onChangeText={setWeight}
                  placeholder="Enter weight"
                  keyboardType="decimal-pad"
                />
              ) : (
                <Text style={styles.detailValue}>
                  {user.profile?.weight || 'Not set'}
                </Text>
              )}
            </View>

            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Allergies</Text>
              {editing ? (
                <TextInput
                  style={[styles.detailInput, styles.detailInputMultiline]}
                  value={allergies}
                  onChangeText={setAllergies}
                  placeholder="Enter allergies (comma separated)"
                  multiline
                />
              ) : (
                <Text style={styles.detailValue}>
                  {user.profile?.allergies?.join(', ') || 'None'}
                </Text>
              )}
            </View>

            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Expertise</Text>
              {editing ? (
                <TextInput
                  style={styles.detailInput}
                  value={expertise}
                  onChangeText={setExpertise}
                  placeholder="Enter expertise"
                />
              ) : (
                <Text style={styles.detailValue}>
                  {user.profile?.expertise || 'Not set'}
                </Text>
              )}
            </View>

            {editing && (
              <View style={styles.editActions}>
                <TouchableOpacity
                  style={styles.cancelButton}
                  onPress={handleCancel}
                  disabled={saving}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.saveButton}
                  onPress={handleSave}
                  disabled={saving}
                >
                  {saving ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={styles.saveButtonText}>Save</Text>
                  )}
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* Guides/Guidees */}
          {user.is_guide && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>My Guidees</Text>
              <Text style={styles.guideesCount}>
                {user.guidees?.length || 0} Guidees
              </Text>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  flex: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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
  scrollContent: {
    paddingBottom: 32,
  },
  profileHeader: {
    backgroundColor: '#fff',
    alignItems: 'center',
    paddingVertical: 32,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    marginBottom: 16,
  },
  avatarPlaceholder: {
    backgroundColor: '#ffd700',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: '#fff',
    fontSize: 40,
    fontWeight: 'bold',
  },
  name: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  email: {
    fontSize: 14,
    color: '#666',
    marginBottom: 16,
  },
  badge: {
    marginBottom: 24,
  },
  guideBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F5E9',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 8,
  },
  guideText: {
    color: '#ffd700',
    fontWeight: '600',
    fontSize: 16,
  },
  guideeText: {
    color: '#666',
    fontSize: 16,
  },
  statsContainer: {
    flexDirection: 'row',
    gap: 32,
  },
  statBox: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#ffd700',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 14,
    color: '#666',
  },
  stars: {
    flexDirection: 'row',
    gap: 4,
    marginBottom: 4,
  },
  section: {
    backgroundColor: '#fff',
    marginTop: 16,
    padding: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  detailRow: {
    marginBottom: 16,
  },
  detailLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  detailValue: {
    fontSize: 16,
    color: '#333',
  },
  detailInput: {
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: '#333',
  },
  detailInputMultiline: {
    minHeight: 80,
  },
  editActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#666',
    fontSize: 16,
    fontWeight: '600',
  },
  saveButton: {
    flex: 1,
    backgroundColor: '#ffd700',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  guideesCount: {
    fontSize: 16,
    color: '#666',
  },
});
