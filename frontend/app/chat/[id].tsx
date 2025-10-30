import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Image,
} from 'react-native';
import { useState, useEffect, useRef } from 'react';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { storage } from '../../src/utils/storage';
import { useAuth } from '../../src/context/AuthContext';
import { useMessages } from '../../src/context/MessagesContext';
import * as ImagePicker from 'expo-image-picker';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL + '/api';

interface Message {
  _id: string;
  conversation_id: string;
  sender_id: string;
  sender_name: string;
  sender_picture?: string;
  content: string;
  image?: string;
  created_at: string;
  read: boolean;
}

export default function ChatScreen() {
  const { id: conversationId } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const { refreshUnreadCount } = useMessages();
  const router = useRouter();
  const flatListRef = useRef<FlatList>(null);
  
  const [messages, setMessages] = useState<Message[]>([]);
  const [messageText, setMessageText] = useState('');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [otherUserName, setOtherUserName] = useState('');

  useEffect(() => {
    fetchMessages();
  }, [conversationId]);

  const fetchMessages = async () => {
    try {
      const token = await storage.getItemAsync('session_token');
      
      // Fetch messages - this also marks them as read on backend
      const messagesResponse = await axios.get(
        `${API_URL}/conversations/${conversationId}/messages`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setMessages(messagesResponse.data);
      
      // Fetch conversation to get other user's name
      const conversationResponse = await axios.get(
        `${API_URL}/conversations`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      const conversation = conversationResponse.data.find(
        (conv: any) => conv._id === conversationId
      );
      
      if (conversation) {
        const otherUser = conversation.user1_id === user?._id
          ? conversation.user2_name
          : conversation.user1_name;
        setOtherUserName(otherUser);
      }
      
      // Refresh unread count in context
      await refreshUnreadCount();
      
      // Scroll to bottom after loading messages
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: false });
      }, 100);
    } catch (error) {
      console.error('Error fetching messages:', error);
    } finally {
      setLoading(false);
    }
  };

  const pickImage = async () => {
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
  };

  const sendMessage = async () => {
    if ((!messageText.trim() && !selectedImage) || sending) return;

    try {
      setSending(true);
      const token = await storage.getItemAsync('session_token');
      
      await axios.post(
        `${API_URL}/conversations/${conversationId}/messages`,
        { 
          content: messageText.trim(),
          image: selectedImage 
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      // Add message to local state immediately
      const newMessage: Message = {
        _id: Date.now().toString(),
        conversation_id: conversationId || '',
        sender_id: user?._id || '',
        sender_name: user?.name || '',
        sender_picture: user?.picture,
        content: messageText.trim(),
        image: selectedImage || undefined,
        created_at: new Date().toISOString(),
        read: true,
      };
      
      setMessages([...messages, newMessage]);
      setMessageText('');
      setSelectedImage(null);
      
      // Scroll to bottom
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    } catch (error) {
      console.error('Error sending message:', error);
    } finally {
      setSending(false);
    }
  };

  const renderMessage = ({ item }: { item: Message }) => {
    const isOwnMessage = item.sender_id === user?._id;

    return (
      <View
        style={[
          styles.messageContainer,
          isOwnMessage ? styles.ownMessage : styles.otherMessage,
        ]}
      >
        <View
          style={[
            styles.messageBubble,
            isOwnMessage ? styles.ownMessageBubble : styles.otherMessageBubble,
          ]}
        >
          {item.image && (
            <Image source={{ uri: item.image }} style={styles.messageImage} />
          )}
          {item.content ? (
            <Text
              style={[
                styles.messageText,
                isOwnMessage ? styles.ownMessageText : styles.otherMessageText,
              ]}
            >
              {item.content}
            </Text>
          ) : null}
          <Text
            style={[
              styles.timestamp,
              isOwnMessage ? styles.ownTimestamp : styles.otherTimestamp,
            ]}
          >
            {new Date(item.created_at).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </Text>
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
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{otherUserName}</Text>
        <View style={{ width: 24 }} />
      </View>

      <KeyboardAvoidingView
        style={styles.chatContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={90}
      >
        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderMessage}
          keyExtractor={(item) => item._id}
          contentContainerStyle={styles.messagesContent}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="chatbubble-ellipses-outline" size={80} color="#ccc" />
              <Text style={styles.emptyText}>No messages yet</Text>
              <Text style={styles.emptySubtext}>Start the conversation!</Text>
            </View>
          }
        />

        <View style={styles.inputWrapper}>
          {selectedImage && (
            <View style={styles.imagePreviewContainer}>
              <Image source={{ uri: selectedImage }} style={styles.imagePreview} />
              <TouchableOpacity
                style={styles.removeImageButton}
                onPress={() => setSelectedImage(null)}
              >
                <Ionicons name="close-circle" size={24} color="#F44336" />
              </TouchableOpacity>
            </View>
          )}

          <View style={styles.inputContainer}>
            <TouchableOpacity style={styles.imageButton} onPress={pickImage}>
              <Ionicons name="image-outline" size={24} color="#ffd700" />
            </TouchableOpacity>

            <TextInput
              style={styles.input}
              value={messageText}
              onChangeText={setMessageText}
              placeholder="Type a message..."
              placeholderTextColor="#999"
              multiline
              maxLength={500}
            />
            <TouchableOpacity
              style={[
                styles.sendButton,
                !messageText.trim() && !selectedImage && styles.sendButtonDisabled,
              ]}
              onPress={sendMessage}
              disabled={(!messageText.trim() && !selectedImage) || sending}
            >
              {sending ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Ionicons name="send" size={20} color="#fff" />
              )}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
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
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  chatContainer: {
    flex: 1,
  },
  messagesContent: {
    padding: 16,
    flexGrow: 1,
  },
  messageContainer: {
    marginBottom: 12,
    maxWidth: '80%',
  },
  ownMessage: {
    alignSelf: 'flex-end',
  },
  otherMessage: {
    alignSelf: 'flex-start',
  },
  messageBubble: {
    padding: 12,
    borderRadius: 16,
  },
  ownMessageBubble: {
    backgroundColor: '#ffd700',
    borderBottomRightRadius: 4,
  },
  otherMessageBubble: {
    backgroundColor: '#fff',
    borderBottomLeftRadius: 4,
  },
  messageText: {
    fontSize: 15,
    lineHeight: 20,
  },
  ownMessageText: {
    color: '#333',
  },
  otherMessageText: {
    color: '#333',
  },
  timestamp: {
    fontSize: 11,
    marginTop: 4,
  },
  ownTimestamp: {
    color: '#666',
    textAlign: 'right',
  },
  otherTimestamp: {
    color: '#999',
    textAlign: 'left',
  },
  inputWrapper: {
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  imagePreviewContainer: {
    padding: 12,
    paddingBottom: 0,
  },
  imagePreview: {
    width: 100,
    height: 100,
    borderRadius: 8,
  },
  removeImageButton: {
    position: 'absolute',
    top: 8,
    right: 8,
  },
  inputContainer: {
    flexDirection: 'row',
    padding: 12,
    alignItems: 'flex-end',
  },
  imageButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  input: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginRight: 8,
    fontSize: 15,
    maxHeight: 100,
    color: '#333',
  },
  messageImage: {
    width: 200,
    height: 150,
    borderRadius: 8,
    marginBottom: 8,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#ffd700',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: '#ccc',
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
  },
  emptyText: {
    fontSize: 22,
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
});
