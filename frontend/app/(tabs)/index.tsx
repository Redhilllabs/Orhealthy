import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  Image,
  RefreshControl,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Modal,
  ScrollView,
} from 'react-native';
import { useState, useEffect } from 'react';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import { storage } from '../../src/utils/storage';
import { useAuth } from '../../src/context/AuthContext';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL + '/api';

interface Post {
  _id: string;
  user_id: string;
  user_name: string;
  user_picture?: string;
  content: string;
  image?: string;
  vote_ups: number;
  voted_by: string[];
  created_at: string;
}

interface Comment {
  _id: string;
  user_name: string;
  content: string;
  created_at: string;
}

export default function HomeScreen() {
  const { user, refreshUser } = useAuth();
  const router = useRouter();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [content, setContent] = useState('');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [posting, setPosting] = useState(false);
  
  // Comment modal state
  const [showCommentsModal, setShowCommentsModal] = useState(false);
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentText, setCommentText] = useState('');
  const [loadingComments, setLoadingComments] = useState(false);
  
  // Edit modal state
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingPost, setEditingPost] = useState<Post | null>(null);
  const [editContent, setEditContent] = useState('');
  const [editImage, setEditImage] = useState<string | null>(null);

  useEffect(() => {
    fetchPosts();
  }, []);

  const fetchPosts = async () => {
    try {
      const response = await axios.get(`${API_URL}/posts`);
      setPosts(response.data);
    } catch (error) {
      console.error('Error fetching posts:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const pickImage = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Please grant camera roll permissions');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.5,
        base64: true,
      });

      if (!result.canceled && result.assets[0].base64) {
        setSelectedImage(`data:image/jpeg;base64,${result.assets[0].base64}`);
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to pick image');
    }
  };

  const pickEditImage = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Please grant camera roll permissions');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.5,
        base64: true,
      });

      if (!result.canceled && result.assets[0].base64) {
        setEditImage(`data:image/jpeg;base64,${result.assets[0].base64}`);
      }
    } catch (error) {
      console.error('Error picking image:', error);
    }
  };

  const createPost = async () => {
    if (!content.trim()) {
      Alert.alert('Error', 'Please enter some content');
      return;
    }

    try {
      setPosting(true);
      const token = await storage.getItemAsync('session_token');
      await axios.post(
        `${API_URL}/posts`,
        { content, image: selectedImage },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setContent('');
      setSelectedImage(null);
      await fetchPosts();
      await refreshUser();
      Alert.alert('Success', 'Post created successfully!');
    } catch (error: any) {
      console.error('Error creating post:', error);
      Alert.alert('Error', error.response?.data?.detail || 'Failed to create post');
    } finally {
      setPosting(false);
    }
  };

  const toggleVote = async (postId: string) => {
    try {
      const token = await storage.getItemAsync('session_token');
      await axios.post(
        `${API_URL}/posts/${postId}/vote`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );

      await fetchPosts();
      await refreshUser();
    } catch (error) {
      console.error('Error voting:', error);
    }
  };

  const handleShowComments = async (postId: string) => {
    setSelectedPostId(postId);
    setShowCommentsModal(true);
    setLoadingComments(true);
    
    try {
      const response = await axios.get(`${API_URL}/posts/${postId}/comments`);
      setComments(response.data);
    } catch (error) {
      console.error('Error fetching comments:', error);
    } finally {
      setLoadingComments(false);
    }
  };

  const submitComment = async () => {
    if (!commentText.trim() || !selectedPostId) return;

    try {
      const token = await storage.getItemAsync('session_token');
      await axios.post(
        `${API_URL}/posts/${selectedPostId}/comments`,
        { content: commentText },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setCommentText('');
      // Refresh comments
      const response = await axios.get(`${API_URL}/posts/${selectedPostId}/comments`);
      setComments(response.data);
    } catch (error) {
      console.error('Error posting comment:', error);
      Alert.alert('Error', 'Failed to post comment');
    }
  };

  const handleEditPost = (post: Post) => {
    setEditingPost(post);
    setEditContent(post.content);
    setEditImage(post.image || null);
    setShowEditModal(true);
  };

  const saveEditPost = async () => {
    if (!editContent.trim() || !editingPost) return;

    try {
      const token = await storage.getItemAsync('session_token');
      await axios.put(
        `${API_URL}/posts/${editingPost._id}`,
        { content: editContent, image: editImage },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setShowEditModal(false);
      setEditingPost(null);
      await fetchPosts();
      Alert.alert('Success', 'Post updated successfully!');
    } catch (error) {
      console.error('Error updating post:', error);
      Alert.alert('Error', 'Failed to update post');
    }
  };

  const handleDeletePost = async (postId: string) => {
    Alert.alert(
      'Delete Post',
      'Are you sure you want to delete this post?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const token = await storage.getItemAsync('session_token');
              await axios.delete(`${API_URL}/posts/${postId}`, {
                headers: { Authorization: `Bearer ${token}` },
              });

              await fetchPosts();
              await refreshUser();
              Alert.alert('Success', 'Post deleted successfully');
            } catch (error) {
              console.error('Error deleting post:', error);
              Alert.alert('Error', 'Failed to delete post');
            }
          },
        },
      ]
    );
  };

  const renderPost = ({ item }: { item: Post }) => {
    const isVoted = user && item.voted_by?.includes(user._id);
    const isOwner = user && item.user_id === user._id;

    return (
      <View style={styles.postCard}>
        <TouchableOpacity 
          style={styles.postHeader}
          onPress={() => router.push(`/user/${item.user_id}`)}
        >
          {item.user_picture ? (
            <Image source={{ uri: item.user_picture }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarPlaceholder]}>
              <Text style={styles.avatarText}>
                {item.user_name?.charAt(0).toUpperCase()}
              </Text>
            </View>
          )}
          <View style={styles.userInfo}>
            <Text style={styles.userName}>{item.user_name}</Text>
          </View>
          
          {isOwner && (
            <View style={styles.postActions}>
              <TouchableOpacity
                style={styles.actionIconButton}
                onPress={() => handleEditPost(item)}
              >
                <Ionicons name="create-outline" size={20} color="#666" />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.actionIconButton}
                onPress={() => handleDeletePost(item._id)}
              >
                <Ionicons name="trash-outline" size={20} color="#F44336" />
              </TouchableOpacity>
            </View>
          )}
        </TouchableOpacity>

        <Text style={styles.postContent}>{item.content}</Text>

        {item.image && (
          <Image source={{ uri: item.image }} style={styles.postImage} />
        )}

        <View style={styles.postActionsRow}>
          <TouchableOpacity
            style={styles.voteButton}
            onPress={() => toggleVote(item._id)}
          >
            <Ionicons
              name={isVoted ? 'heart' : 'heart-outline'}
              size={24}
              color={isVoted ? '#F44336' : '#666'}
            />
            <Text style={styles.voteCount}>{item.vote_ups}</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.commentButton}
            onPress={() => handleShowComments(item._id)}
          >
            <Ionicons name="chatbubble-outline" size={20} color="#666" />
            <Text style={styles.commentText}>Comment</Text>
          </TouchableOpacity>
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

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Image
          source={{ uri: 'https://customer-assets.emergentagent.com/job_nutritionhub-1/artifacts/kq74ajf1_Orhealthy%20Favicon.png' }}
          style={styles.logo}
        />
        <Text style={styles.headerTitle}>OrHealthy</Text>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flex}
      >
        <View style={styles.createPost}>
          {selectedImage && (
            <View style={styles.imagePreview}>
              <Image source={{ uri: selectedImage }} style={styles.previewImage} />
              <TouchableOpacity
                style={styles.removeImageButton}
                onPress={() => setSelectedImage(null)}
              >
                <Ionicons name="close-circle" size={24} color="#F44336" />
              </TouchableOpacity>
            </View>
          )}
          
          <View style={styles.inputRow}>
            <TextInput
              style={styles.input}
              placeholder="Share your healthy eating experience..."
              value={content}
              onChangeText={setContent}
              multiline
              maxLength={500}
            />
            <View style={styles.actionsRow}>
              <TouchableOpacity style={styles.imageButton} onPress={pickImage}>
                <Ionicons name="image-outline" size={24} color="#ffd700" />
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.postButton, (!content.trim() || posting) && styles.postButtonDisabled]}
                onPress={createPost}
                disabled={!content.trim() || posting}
              >
                {posting ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.postButtonText}>Post</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>

        <FlatList
          data={posts}
          renderItem={renderPost}
          keyExtractor={(item) => item._id}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                fetchPosts();
              }}
              tintColor="#ffd700"
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="chatbubbles-outline" size={64} color="#ccc" />
              <Text style={styles.emptyText}>No posts yet</Text>
              <Text style={styles.emptySubtext}>Be the first to share!</Text>
            </View>
          }
        />
      </KeyboardAvoidingView>

      {/* Comments Modal */}
      <Modal
        visible={showCommentsModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowCommentsModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.commentsModal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Comments</Text>
              <TouchableOpacity onPress={() => setShowCommentsModal(false)}>
                <Ionicons name="close" size={28} color="#333" />
              </TouchableOpacity>
            </View>

            {loadingComments ? (
              <ActivityIndicator size="large" color="#ffd700" style={{ marginVertical: 32 }} />
            ) : (
              <ScrollView style={styles.commentsScroll}>
                {comments.length === 0 ? (
                  <View style={styles.emptyComments}>
                    <Text style={styles.emptyCommentsText}>No comments yet</Text>
                    <Text style={styles.emptyCommentsSubtext}>Be the first to comment!</Text>
                  </View>
                ) : (
                  comments.map((comment) => (
                    <View key={comment._id} style={styles.commentItem}>
                      <Text style={styles.commentUser}>{comment.user_name}</Text>
                      <Text style={styles.commentContent}>{comment.content}</Text>
                    </View>
                  ))
                )}
              </ScrollView>
            )}

            <View style={styles.commentInputContainer}>
              <TextInput
                style={styles.commentInput}
                placeholder="Add a comment..."
                value={commentText}
                onChangeText={setCommentText}
                multiline
              />
              <TouchableOpacity
                style={[styles.sendButton, !commentText.trim() && styles.sendButtonDisabled]}
                onPress={submitComment}
                disabled={!commentText.trim()}
              >
                <Ionicons name="send" size={20} color="#fff" />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Edit Post Modal */}
      <Modal
        visible={showEditModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowEditModal(false)}
      >
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={styles.editModal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit Post</Text>
              <TouchableOpacity onPress={() => setShowEditModal(false)}>
                <Ionicons name="close" size={28} color="#333" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.editContent}>
              {editImage && (
                <View style={styles.imagePreview}>
                  <Image source={{ uri: editImage }} style={styles.previewImage} />
                  <TouchableOpacity
                    style={styles.removeImageButton}
                    onPress={() => setEditImage(null)}
                  >
                    <Ionicons name="close-circle" size={24} color="#F44336" />
                  </TouchableOpacity>
                </View>
              )}

              <TextInput
                style={styles.editInput}
                placeholder="What's on your mind?"
                value={editContent}
                onChangeText={setEditContent}
                multiline
                maxLength={500}
              />

              <TouchableOpacity style={styles.editImageButton} onPress={pickEditImage}>
                <Ionicons name="image-outline" size={24} color="#ffd700" />
                <Text style={styles.editImageButtonText}>Change Image</Text>
              </TouchableOpacity>
            </ScrollView>

            <View style={styles.editFooter}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setShowEditModal(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.saveButton, !editContent.trim() && styles.saveButtonDisabled]}
                onPress={saveEditPost}
                disabled={!editContent.trim()}
              >
                <Text style={styles.saveButtonText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
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
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  logo: {
    width: 36,
    height: 36,
    borderRadius: 18,
    marginRight: 12,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ffd700',
  },
  createPost: {
    backgroundColor: '#fff',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  imagePreview: {
    position: 'relative',
    marginBottom: 12,
  },
  previewImage: {
    width: '100%',
    height: 200,
    borderRadius: 12,
  },
  removeImageButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: '#fff',
    borderRadius: 12,
  },
  inputRow: {
    gap: 12,
  },
  input: {
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 8,
    minHeight: 60,
    fontSize: 16,
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  imageButton: {
    padding: 8,
  },
  postButton: {
    flex: 1,
    backgroundColor: '#ffd700',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 20,
    alignItems: 'center',
  },
  postButtonDisabled: {
    backgroundColor: '#ccc',
  },
  postButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  listContent: {
    paddingVertical: 8,
  },
  postCard: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginVertical: 8,
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  postHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
  },
  avatarPlaceholder: {
    backgroundColor: '#ffd700',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  postActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionIconButton: {
    padding: 8,
  },
  postContent: {
    fontSize: 16,
    color: '#333',
    lineHeight: 24,
    marginBottom: 16,
  },
  postImage: {
    width: '100%',
    height: 250,
    borderRadius: 12,
    marginBottom: 16,
  },
  postActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  voteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 24,
  },
  voteCount: {
    marginLeft: 8,
    fontSize: 16,
    color: '#666',
    fontWeight: '500',
  },
  commentButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  commentText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#666',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 64,
  },
  emptyText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#666',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 16,
    color: '#999',
    marginTop: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  commentsModal: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
    paddingBottom: 20,
  },
  editModal: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  commentsScroll: {
    maxHeight: 400,
    padding: 16,
  },
  commentItem: {
    marginBottom: 16,
    padding: 12,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
  },
  commentUser: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  commentContent: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  emptyComments: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  emptyCommentsText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
  },
  emptyCommentsSubtext: {
    fontSize: 14,
    color: '#999',
    marginTop: 4,
  },
  commentInputContainer: {
    flexDirection: 'row',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#eee',
    alignItems: 'center',
    gap: 12,
  },
  commentInput: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 14,
    maxHeight: 100,
  },
  sendButton: {
    backgroundColor: '#ffd700',
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: '#ccc',
  },
  editContent: {
    padding: 16,
  },
  editInput: {
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    minHeight: 120,
    textAlignVertical: 'top',
    marginBottom: 16,
  },
  editImageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    gap: 8,
  },
  editImageButtonText: {
    fontSize: 16,
    color: '#ffd700',
    fontWeight: '600',
  },
  editFooter: {
    flexDirection: 'row',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#eee',
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    padding: 14,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    color: '#666',
    fontWeight: '600',
  },
  saveButton: {
    flex: 1,
    padding: 14,
    backgroundColor: '#ffd700',
    borderRadius: 8,
    alignItems: 'center',
  },
  saveButtonDisabled: {
    backgroundColor: '#ccc',
  },
  saveButtonText: {
    fontSize: 16,
    color: '#fff',
    fontWeight: 'bold',
  },
});
