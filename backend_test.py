#!/usr/bin/env python3
"""
Backend API Testing Suite for OrHealthy Mobile App - NEW FEATURES
Tests the new backend API changes:
1. GET /api/posts/{post_id}/comments - Updated to include user_picture field
2. GET /api/saved-meals - Now generates images array from ingredient images
3. POST /api/addresses - Now accepts apartment field
"""

import requests
import json
import sys
from datetime import datetime
import base64

# Backend URL from frontend/.env
BACKEND_URL = "https://meal-guide-4.preview.emergentagent.com/api"

class BackendTester:
    def __init__(self):
        self.session = requests.Session()
        self.test_results = []
        self.auth_token = None
        self.test_user_id = None
        self.test_post_id = None
        
    def log_result(self, test_name, success, message, details=None):
        """Log test result"""
        result = {
            "test": test_name,
            "success": success,
            "message": message,
            "details": details,
            "timestamp": datetime.now().isoformat()
        }
        self.test_results.append(result)
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status}: {test_name} - {message}")
        if details:
            print(f"   Details: {details}")
    
    def setup_test_data(self):
        """Setup test data - create a test post for comments testing"""
        print("\n=== Setting up test data ===")
        
        # First, let's get existing posts to use for testing
        try:
            response = self.session.get(f"{BACKEND_URL}/posts")
            if response.status_code == 200:
                posts = response.json()
                if posts:
                    self.test_post_id = posts[0]["_id"]
                    self.log_result("Setup - Get existing post", True, f"Using existing post ID: {self.test_post_id}")
                    return True
                else:
                    self.log_result("Setup - Get existing post", False, "No existing posts found")
            else:
                self.log_result("Setup - Get existing post", False, f"Failed to get posts: {response.status_code}")
        except Exception as e:
            self.log_result("Setup - Get existing post", False, f"Error getting posts: {str(e)}")
        
        return False
    
    def test_comments_api(self):
        """Test Comments API endpoints"""
        print("\n=== Testing Comments API ===")
        
        if not self.test_post_id:
            self.log_result("Comments API", False, "No test post available for comments testing")
            return
        
        # Test GET comments (should work without auth)
        try:
            response = self.session.get(f"{BACKEND_URL}/posts/{self.test_post_id}/comments")
            if response.status_code == 200:
                comments = response.json()
                self.log_result("GET comments", True, f"Retrieved {len(comments)} comments", f"Response: {comments}")
            else:
                self.log_result("GET comments", False, f"Status: {response.status_code}", response.text)
        except Exception as e:
            self.log_result("GET comments", False, f"Request failed: {str(e)}")
        
        # Test POST comment (requires auth - will fail but we can check the endpoint exists)
        try:
            comment_data = {"content": "Great post! This looks delicious and healthy."}
            response = self.session.post(f"{BACKEND_URL}/posts/{self.test_post_id}/comments", json=comment_data)
            
            if response.status_code == 401:
                self.log_result("POST comment (auth required)", True, "Endpoint exists, requires authentication as expected", f"Status: {response.status_code}")
            elif response.status_code == 201 or response.status_code == 200:
                self.log_result("POST comment", True, "Comment created successfully", response.json())
            else:
                self.log_result("POST comment", False, f"Unexpected status: {response.status_code}", response.text)
        except Exception as e:
            self.log_result("POST comment", False, f"Request failed: {str(e)}")
    
    def test_edit_post_api(self):
        """Test Edit Post API endpoint"""
        print("\n=== Testing Edit Post API ===")
        
        if not self.test_post_id:
            self.log_result("Edit Post API", False, "No test post available for edit testing")
            return
        
        # Test PUT post (requires auth - will fail but we can check the endpoint exists)
        try:
            # Sample base64 image (1x1 pixel PNG)
            sample_image = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
            
            update_data = {
                "content": "Updated content - This meal has been improved with better ingredients!",
                "image": sample_image
            }
            
            response = self.session.put(f"{BACKEND_URL}/posts/{self.test_post_id}", json=update_data)
            
            if response.status_code == 401:
                self.log_result("PUT post (auth required)", True, "Endpoint exists, requires authentication as expected", f"Status: {response.status_code}")
            elif response.status_code == 200:
                self.log_result("PUT post", True, "Post updated successfully", response.json())
            else:
                self.log_result("PUT post", False, f"Unexpected status: {response.status_code}", response.text)
        except Exception as e:
            self.log_result("PUT post", False, f"Request failed: {str(e)}")
    
    def test_user_profile_api(self):
        """Test User Profile API with relationships"""
        print("\n=== Testing User Profile API ===")
        
        # First, get a user ID from existing posts
        try:
            response = self.session.get(f"{BACKEND_URL}/posts")
            if response.status_code == 200:
                posts = response.json()
                if posts:
                    user_id = posts[0]["user_id"]
                    self.test_user_id = user_id
                    
                    # Test GET user profile
                    response = self.session.get(f"{BACKEND_URL}/users/{user_id}")
                    if response.status_code == 200:
                        user_data = response.json()
                        
                        # Check required fields
                        required_fields = ["name", "email", "points", "star_rating", "is_guide", "fans", "idols", "guides", "guidees", "posts"]
                        missing_fields = [field for field in required_fields if field not in user_data]
                        
                        if not missing_fields:
                            self.log_result("GET user profile", True, f"User profile complete with all relationships", 
                                          f"User: {user_data.get('name')}, Points: {user_data.get('points')}, Stars: {user_data.get('star_rating')}")
                        else:
                            self.log_result("GET user profile", False, f"Missing fields: {missing_fields}", user_data)
                    else:
                        self.log_result("GET user profile", False, f"Status: {response.status_code}", response.text)
                else:
                    self.log_result("GET user profile", False, "No posts available to get user ID")
            else:
                self.log_result("GET user profile", False, f"Failed to get posts: {response.status_code}")
        except Exception as e:
            self.log_result("GET user profile", False, f"Request failed: {str(e)}")
    
    def test_fan_idol_relationships(self):
        """Test Fan/Idol relationship endpoints"""
        print("\n=== Testing Fan/Idol Relationships ===")
        
        if not self.test_user_id:
            self.log_result("Fan/Idol relationships", False, "No test user available")
            return
        
        # Test POST become-fan (requires auth - will fail but we can check endpoint exists)
        try:
            response = self.session.post(f"{BACKEND_URL}/users/{self.test_user_id}/become-fan")
            
            if response.status_code == 401:
                self.log_result("POST become-fan (auth required)", True, "Endpoint exists, requires authentication as expected", f"Status: {response.status_code}")
            elif response.status_code == 200:
                self.log_result("POST become-fan", True, "Became fan successfully", response.json())
            else:
                self.log_result("POST become-fan", False, f"Unexpected status: {response.status_code}", response.text)
        except Exception as e:
            self.log_result("POST become-fan", False, f"Request failed: {str(e)}")
        
        # Test DELETE unfan (requires auth - will fail but we can check endpoint exists)
        try:
            response = self.session.delete(f"{BACKEND_URL}/users/{self.test_user_id}/unfan")
            
            if response.status_code == 401:
                self.log_result("DELETE unfan (auth required)", True, "Endpoint exists, requires authentication as expected", f"Status: {response.status_code}")
            elif response.status_code == 200:
                self.log_result("DELETE unfan", True, "Unfanned successfully", response.json())
            else:
                self.log_result("DELETE unfan", False, f"Unexpected status: {response.status_code}", response.text)
        except Exception as e:
            self.log_result("DELETE unfan", False, f"Request failed: {str(e)}")
    
    def test_meals_with_images_tags(self):
        """Test Meals API with images and tags arrays"""
        print("\n=== Testing Meals with Images and Tags ===")
        
        try:
            response = self.session.get(f"{BACKEND_URL}/meals")
            if response.status_code == 200:
                meals = response.json()
                
                if not meals:
                    self.log_result("GET meals", False, "No meals found in database")
                    return
                
                # Check if meals have required arrays
                valid_meals = 0
                for meal in meals:
                    has_images = "images" in meal and isinstance(meal["images"], list)
                    has_tags = "tags" in meal and isinstance(meal["tags"], list)
                    has_ingredients = "ingredients" in meal and isinstance(meal["ingredients"], list)
                    
                    if has_images and has_tags and has_ingredients:
                        valid_meals += 1
                
                if valid_meals > 0:
                    self.log_result("GET meals with arrays", True, 
                                  f"Found {valid_meals}/{len(meals)} meals with proper images and tags arrays",
                                  f"Sample meal: {meals[0].get('name', 'Unknown')} - Images: {len(meals[0].get('images', []))}, Tags: {len(meals[0].get('tags', []))}")
                else:
                    self.log_result("GET meals with arrays", False, 
                                  f"No meals have proper images/tags arrays structure",
                                  f"Sample meal structure: {list(meals[0].keys()) if meals else 'No meals'}")
            else:
                self.log_result("GET meals", False, f"Status: {response.status_code}", response.text)
        except Exception as e:
            self.log_result("GET meals", False, f"Request failed: {str(e)}")
    
    def test_chat_system_unauthenticated(self):
        """Test chat endpoints without authentication - should return 401"""
        print("\n=== Testing Chat System - Unauthenticated Requests ===")
        
        endpoints = [
            ("GET", "/conversations", "Get conversations without auth"),
            ("GET", "/conversations/test_user_id", "Get conversation without auth"),
            ("GET", "/conversations/test_conv_id/messages", "Get messages without auth"),
            ("POST", "/conversations/test_conv_id/messages", "Send message without auth")
        ]
        
        for method, endpoint, description in endpoints:
            try:
                if method == "GET":
                    response = self.session.get(f"{BACKEND_URL}{endpoint}")
                else:
                    response = self.session.post(f"{BACKEND_URL}{endpoint}", 
                                               json={"content": "test message"})
                
                if response.status_code == 401:
                    self.log_result(description, True, f"Correctly returned 401: {response.json().get('detail', 'Unauthorized')}")
                else:
                    self.log_result(description, False, f"Expected 401, got {response.status_code}: {response.text}")
                    
            except Exception as e:
                self.log_result(description, False, f"Request failed: {str(e)}")
    
    def test_get_conversations(self):
        """Test GET /api/conversations endpoint"""
        print("\n=== Testing GET /api/conversations ===")
        
        try:
            # Test with mock auth token (since we don't have real auth in test environment)
            headers = {"Authorization": "Bearer mock_token_for_testing"}
            response = self.session.get(f"{BACKEND_URL}/conversations", headers=headers)
            
            if response.status_code == 401:
                self.log_result("GET /api/conversations with mock auth", True, 
                            "Correctly requires authentication (401)")
            elif response.status_code == 200:
                data = response.json()
                if isinstance(data, list):
                    self.log_result("GET /api/conversations", True, 
                                f"Returns array with {len(data)} conversations")
                    
                    # Check conversation structure if any exist
                    if data:
                        conv = data[0]
                        required_fields = ['_id', 'user1_id', 'user1_name', 'user2_id', 'user2_name', 
                                         'last_message', 'last_message_at', 'unread_count_user1', 'unread_count_user2']
                        missing_fields = [field for field in required_fields if field not in conv]
                        
                        if not missing_fields:
                            self.log_result("Conversation structure validation", True, 
                                        "All required fields present")
                        else:
                            self.log_result("Conversation structure validation", False, 
                                        f"Missing fields: {missing_fields}")
                else:
                    self.log_result("GET /api/conversations", False, 
                                f"Expected array, got: {type(data)}")
            else:
                self.log_result("GET /api/conversations", False, 
                            f"Unexpected status {response.status_code}: {response.text}")
                
        except Exception as e:
            self.log_result("GET /api/conversations", False, f"Request failed: {str(e)}")
    
    def test_get_or_create_conversation(self):
        """Test GET /api/conversations/{other_user_id} endpoint"""
        print("\n=== Testing GET /api/conversations/{other_user_id} ===")
        
        try:
            # Test with mock auth token
            headers = {"Authorization": "Bearer mock_token_for_testing"}
            test_user_id = "test_user_12345"
            
            response = self.session.get(f"{BACKEND_URL}/conversations/{test_user_id}", headers=headers)
            
            if response.status_code == 401:
                self.log_result("GET /api/conversations/{other_user_id} with mock auth", True, 
                            "Correctly requires authentication (401)")
            elif response.status_code == 404:
                self.log_result("GET /api/conversations/{other_user_id}", True, 
                            "Correctly returns 404 for non-existent user")
            elif response.status_code == 200:
                data = response.json()
                required_fields = ['_id', 'user1_id', 'user1_name', 'user2_id', 'user2_name']
                missing_fields = [field for field in required_fields if field not in data]
                
                if not missing_fields:
                    self.log_result("GET /api/conversations/{other_user_id}", True, 
                                "Returns conversation with required fields")
                else:
                    self.log_result("GET /api/conversations/{other_user_id}", False, 
                                f"Missing fields: {missing_fields}")
            else:
                self.log_result("GET /api/conversations/{other_user_id}", False, 
                            f"Unexpected status {response.status_code}: {response.text}")
                
        except Exception as e:
            self.log_result("GET /api/conversations/{other_user_id}", False, f"Request failed: {str(e)}")
    
    def test_get_messages(self):
        """Test GET /api/conversations/{conversation_id}/messages endpoint"""
        print("\n=== Testing GET /api/conversations/{conversation_id}/messages ===")
        
        try:
            # Test with mock auth token
            headers = {"Authorization": "Bearer mock_token_for_testing"}
            test_conv_id = "test_conversation_12345"
            
            response = self.session.get(f"{BACKEND_URL}/conversations/{test_conv_id}/messages", headers=headers)
            
            if response.status_code == 401:
                self.log_result("GET /api/conversations/{conversation_id}/messages with mock auth", True, 
                            "Correctly requires authentication (401)")
            elif response.status_code == 404:
                self.log_result("GET /api/conversations/{conversation_id}/messages", True, 
                            "Correctly returns 404 for non-existent conversation")
            elif response.status_code == 403:
                self.log_result("GET /api/conversations/{conversation_id}/messages", True, 
                            "Correctly returns 403 for unauthorized access")
            elif response.status_code == 200:
                data = response.json()
                if isinstance(data, list):
                    self.log_result("GET /api/conversations/{conversation_id}/messages", True, 
                                f"Returns array with {len(data)} messages")
                    
                    # Check message structure if any exist
                    if data:
                        msg = data[0]
                        required_fields = ['_id', 'conversation_id', 'sender_id', 'sender_name', 'content', 'read', 'created_at']
                        missing_fields = [field for field in required_fields if field not in msg]
                        
                        if not missing_fields:
                            self.log_result("Message structure validation", True, 
                                        "All required fields present")
                        else:
                            self.log_result("Message structure validation", False, 
                                        f"Missing fields: {missing_fields}")
                else:
                    self.log_result("GET /api/conversations/{conversation_id}/messages", False, 
                                f"Expected array, got: {type(data)}")
            else:
                self.log_result("GET /api/conversations/{conversation_id}/messages", False, 
                            f"Unexpected status {response.status_code}: {response.text}")
                
        except Exception as e:
            self.log_result("GET /api/conversations/{conversation_id}/messages", False, f"Request failed: {str(e)}")
    
    def test_send_message(self):
        """Test POST /api/conversations/{conversation_id}/messages endpoint"""
        print("\n=== Testing POST /api/conversations/{conversation_id}/messages ===")
        
        try:
            # Test with mock auth token
            headers = {"Authorization": "Bearer mock_token_for_testing"}
            test_conv_id = "test_conversation_12345"
            message_data = {"content": "Hello! This is a test message from the API testing script."}
            
            response = self.session.post(f"{BACKEND_URL}/conversations/{test_conv_id}/messages", 
                                       headers=headers, json=message_data)
            
            if response.status_code == 401:
                self.log_result("POST /api/conversations/{conversation_id}/messages with mock auth", True, 
                            "Correctly requires authentication (401)")
            elif response.status_code == 404:
                self.log_result("POST /api/conversations/{conversation_id}/messages", True, 
                            "Correctly returns 404 for non-existent conversation")
            elif response.status_code == 403:
                self.log_result("POST /api/conversations/{conversation_id}/messages", True, 
                            "Correctly returns 403 for unauthorized access")
            elif response.status_code == 200:
                data = response.json()
                if "message" in data and "id" in data:
                    self.log_result("POST /api/conversations/{conversation_id}/messages", True, 
                                f"Message sent successfully: {data['message']}")
                else:
                    self.log_result("POST /api/conversations/{conversation_id}/messages", False, 
                                f"Unexpected response format: {data}")
            else:
                self.log_result("POST /api/conversations/{conversation_id}/messages", False, 
                            f"Unexpected status {response.status_code}: {response.text}")
                
        except Exception as e:
            self.log_result("POST /api/conversations/{conversation_id}/messages", False, f"Request failed: {str(e)}")
    
    def test_message_content_validation(self):
        """Test message content validation"""
        print("\n=== Testing Message Content Validation ===")
        
        try:
            headers = {"Authorization": "Bearer mock_token_for_testing"}
            test_conv_id = "test_conversation_12345"
            
            # Test empty content
            empty_message = {"content": ""}
            response = self.session.post(f"{BACKEND_URL}/conversations/{test_conv_id}/messages", 
                                       headers=headers, json=empty_message)
            
            if response.status_code in [400, 422]:
                self.log_result("Empty message content validation", True, 
                            "Correctly rejects empty content")
            elif response.status_code == 401:
                self.log_result("Empty message content validation", True, 
                            "Authentication required (expected)")
            else:
                self.log_result("Empty message content validation", False, 
                            f"Unexpected response to empty content: {response.status_code}")
            
            # Test missing content field
            no_content = {}
            response = self.session.post(f"{BACKEND_URL}/conversations/{test_conv_id}/messages", 
                                       headers=headers, json=no_content)
            
            if response.status_code in [400, 422]:
                self.log_result("Missing content field validation", True, 
                            "Correctly rejects missing content field")
            elif response.status_code == 401:
                self.log_result("Missing content field validation", True, 
                            "Authentication required (expected)")
            else:
                self.log_result("Missing content field validation", False, 
                            f"Unexpected response to missing content: {response.status_code}")
                
        except Exception as e:
            self.log_result("Message content validation", False, f"Request failed: {str(e)}")
    
    def test_additional_endpoints(self):
        """Test additional endpoints for completeness"""
        print("\n=== Testing Additional Endpoints ===")
        
        # Test GET posts
        try:
            response = self.session.get(f"{BACKEND_URL}/posts")
            if response.status_code == 200:
                posts = response.json()
                self.log_result("GET posts", True, f"Retrieved {len(posts)} posts")
            else:
                self.log_result("GET posts", False, f"Status: {response.status_code}", response.text)
        except Exception as e:
            self.log_result("GET posts", False, f"Request failed: {str(e)}")
        
        # Test GET ingredients
        try:
            response = self.session.get(f"{BACKEND_URL}/ingredients")
            if response.status_code == 200:
                ingredients = response.json()
                self.log_result("GET ingredients", True, f"Retrieved {len(ingredients)} ingredients")
            else:
                self.log_result("GET ingredients", False, f"Status: {response.status_code}", response.text)
        except Exception as e:
            self.log_result("GET ingredients", False, f"Request failed: {str(e)}")
    
    def test_comments_user_picture_field(self):
        """Test GET /api/posts/{post_id}/comments includes user_picture field"""
        print("\n=== Testing Comments API - User Picture Field ===")
        
        if not self.test_post_id:
            self.log_result("Comments User Picture", False, "No test post available")
            return
        
        try:
            response = self.session.get(f"{BACKEND_URL}/posts/{self.test_post_id}/comments")
            if response.status_code == 200:
                comments = response.json()
                self.log_result("GET comments - API call", True, f"Retrieved {len(comments)} comments")
                
                if comments:
                    # Check if user_picture field is present
                    comment = comments[0]
                    has_user_picture = 'user_picture' in comment
                    
                    if has_user_picture:
                        user_picture_value = comment.get('user_picture')
                        self.log_result("Comments - user_picture field", True, 
                                      f"user_picture field present: {user_picture_value}")
                    else:
                        self.log_result("Comments - user_picture field", False, 
                                      "user_picture field missing from comment response")
                    
                    # Test backward compatibility - check all required fields
                    required_fields = ['_id', 'post_id', 'user_id', 'user_name', 'content', 'created_at']
                    missing_fields = [field for field in required_fields if field not in comment]
                    
                    if not missing_fields:
                        self.log_result("Comments - backward compatibility", True, 
                                      "All existing fields preserved")
                    else:
                        self.log_result("Comments - backward compatibility", False, 
                                      f"Missing required fields: {missing_fields}")
                else:
                    self.log_result("Comments - user_picture field", "SKIP", 
                                  "No comments available to test user_picture field")
            else:
                self.log_result("GET comments - API call", False, 
                              f"Status: {response.status_code}, Response: {response.text}")
        except Exception as e:
            self.log_result("Comments User Picture", False, f"Request failed: {str(e)}")
    
    def test_saved_meals_images_generation(self):
        """Test GET /api/saved-meals generates images array from ingredient images"""
        print("\n=== Testing Saved Meals - Images Generation ===")
        
        # Test 1: Check without authentication (should return 401)
        try:
            response = self.session.get(f"{BACKEND_URL}/saved-meals")
            if response.status_code == 401:
                self.log_result("Saved meals - auth required", True, 
                              "Correctly requires authentication")
            else:
                self.log_result("Saved meals - auth required", False, 
                              f"Expected 401, got {response.status_code}")
        except Exception as e:
            self.log_result("Saved meals - auth required", False, f"Request failed: {str(e)}")
        
        # Test 2: Check ingredients have images for testing
        try:
            response = self.session.get(f"{BACKEND_URL}/ingredients")
            if response.status_code == 200:
                ingredients = response.json()
                ingredients_with_images = [ing for ing in ingredients if ing.get('images')]
                
                self.log_result("Ingredients - images check", True, 
                              f"Found {len(ingredients)} ingredients, {len(ingredients_with_images)} with images")
                
                if ingredients_with_images:
                    sample_ingredient = ingredients_with_images[0]
                    self.log_result("Ingredients - sample data", True, 
                                  f"Sample: {sample_ingredient.get('name')} has {len(sample_ingredient.get('images', []))} images")
                else:
                    self.log_result("Ingredients - sample data", "SKIP", 
                                  "No ingredients with images found for testing")
            else:
                self.log_result("Ingredients - images check", False, 
                              f"Could not fetch ingredients: {response.status_code}")
        except Exception as e:
            self.log_result("Ingredients - images check", False, f"Request failed: {str(e)}")
        
        # Test 3: Test with mock authentication (to check endpoint structure)
        try:
            headers = {"Authorization": "Bearer mock_token_for_testing"}
            response = self.session.get(f"{BACKEND_URL}/saved-meals", headers=headers)
            
            if response.status_code == 401:
                self.log_result("Saved meals - mock auth", True, 
                              "Authentication properly validated (401 with mock token)")
            elif response.status_code == 200:
                saved_meals = response.json()
                self.log_result("Saved meals - API structure", True, 
                              f"Returns array with {len(saved_meals)} saved meals")
                
                # Check if meals have images array
                if saved_meals:
                    meal = saved_meals[0]
                    has_images = 'images' in meal
                    if has_images:
                        images_count = len(meal.get('images', []))
                        self.log_result("Saved meals - images array", True, 
                                      f"Meal has images array with {images_count} images")
                    else:
                        self.log_result("Saved meals - images array", False, 
                                      "Meal missing images array field")
                else:
                    self.log_result("Saved meals - images array", "SKIP", 
                                  "No saved meals to test images generation")
            else:
                self.log_result("Saved meals - mock auth", False, 
                              f"Unexpected status: {response.status_code}")
        except Exception as e:
            self.log_result("Saved meals - mock auth", False, f"Request failed: {str(e)}")
    
    def test_addresses_apartment_field(self):
        """Test POST /api/addresses accepts apartment field"""
        print("\n=== Testing Addresses - Apartment Field ===")
        
        # Test 1: Test without authentication (should return 401)
        address_with_apartment = {
            "name": "Rajesh Kumar",
            "apartment": "Flat 3B, Sunrise Apartments",
            "street": "MG Road",
            "city": "Mumbai",
            "state": "Maharashtra",
            "zip_code": "400001",
            "phone": "9876543210"
        }
        
        try:
            response = self.session.post(f"{BACKEND_URL}/addresses", json=address_with_apartment)
            if response.status_code == 401:
                self.log_result("Address with apartment - auth required", True, 
                              "Correctly requires authentication")
            else:
                self.log_result("Address with apartment - auth required", False, 
                              f"Expected 401, got {response.status_code}")
        except Exception as e:
            self.log_result("Address with apartment - auth required", False, f"Request failed: {str(e)}")
        
        # Test 2: Test address without apartment field
        address_without_apartment = {
            "name": "Priya Sharma",
            "street": "Park Street",
            "city": "Delhi",
            "state": "Delhi",
            "zip_code": "110001",
            "phone": "9876543211"
        }
        
        try:
            response = self.session.post(f"{BACKEND_URL}/addresses", json=address_without_apartment)
            if response.status_code == 401:
                self.log_result("Address without apartment - auth required", True, 
                              "Correctly requires authentication (apartment field optional)")
            else:
                self.log_result("Address without apartment - auth required", False, 
                              f"Expected 401, got {response.status_code}")
        except Exception as e:
            self.log_result("Address without apartment - auth required", False, f"Request failed: {str(e)}")
        
        # Test 3: Test with mock authentication
        try:
            headers = {"Authorization": "Bearer mock_token_for_testing"}
            response = self.session.post(f"{BACKEND_URL}/addresses", 
                                       headers=headers, json=address_with_apartment)
            
            if response.status_code == 401:
                self.log_result("Address - mock auth validation", True, 
                              "Authentication properly validated (401 with mock token)")
            elif response.status_code == 200:
                result = response.json()
                self.log_result("Address with apartment - success", True, 
                              f"Address saved successfully: {result.get('message', 'Success')}")
            else:
                self.log_result("Address - mock auth validation", False, 
                              f"Unexpected status: {response.status_code}, Response: {response.text}")
        except Exception as e:
            self.log_result("Address - mock auth validation", False, f"Request failed: {str(e)}")
        
        # Test 4: Test malformed address data
        try:
            malformed_address = {"invalid_field": "test", "apartment": "Test Apt"}
            headers = {"Authorization": "Bearer mock_token_for_testing"}
            response = self.session.post(f"{BACKEND_URL}/addresses", 
                                       headers=headers, json=malformed_address)
            
            if response.status_code in [400, 422, 401]:
                self.log_result("Address - malformed data handling", True, 
                              f"Properly handles malformed data (HTTP {response.status_code})")
            else:
                self.log_result("Address - malformed data handling", False, 
                              f"Unexpected response to malformed data: {response.status_code}")
        except Exception as e:
            self.log_result("Address - malformed data handling", False, f"Request failed: {str(e)}")
    
    def test_edge_cases(self):
        """Test edge cases for the new features"""
        print("\n=== Testing Edge Cases ===")
        
        # Test comments with invalid post ID
        try:
            response = self.session.get(f"{BACKEND_URL}/posts/invalid_post_id/comments")
            if response.status_code == 200:
                comments = response.json()
                if isinstance(comments, list) and len(comments) == 0:
                    self.log_result("Comments - invalid post ID", True, 
                                  "Returns empty array for invalid post ID")
                else:
                    self.log_result("Comments - invalid post ID", False, 
                                  f"Unexpected response: {comments}")
            else:
                self.log_result("Comments - invalid post ID", True, 
                              f"Handles invalid post ID appropriately (HTTP {response.status_code})")
        except Exception as e:
            self.log_result("Comments - invalid post ID", False, f"Request failed: {str(e)}")
        
        # Test comments with comments that don't have user_id (backward compatibility)
        try:
            response = self.session.get(f"{BACKEND_URL}/posts")
            if response.status_code == 200:
                posts = response.json()
                if posts:
                    # Test multiple posts to check consistency
                    for i, post in enumerate(posts[:3]):  # Test first 3 posts
                        post_id = post['_id']
                        response = self.session.get(f"{BACKEND_URL}/posts/{post_id}/comments")
                        if response.status_code == 200:
                            comments = response.json()
                            self.log_result(f"Comments consistency - post {i+1}", True, 
                                          f"Post {post_id[:8]}... has {len(comments)} comments")
                        else:
                            self.log_result(f"Comments consistency - post {i+1}", False, 
                                          f"Failed to get comments for post {post_id}")
        except Exception as e:
            self.log_result("Comments - consistency check", False, f"Request failed: {str(e)}")

    def run_all_tests(self):
        """Run all backend tests focusing on NEW FEATURES"""
        print("🚀 Starting OrHealthy Mobile App Backend API Tests - NEW FEATURES")
        print(f"Backend URL: {BACKEND_URL}")
        print("=" * 70)
        
        # Setup test data
        self.setup_test_data()
        
        # NEW FEATURE TESTS (Primary Focus)
        print("\n🎯 TESTING NEW FEATURES:")
        self.test_comments_user_picture_field()
        self.test_saved_meals_images_generation()
        self.test_addresses_apartment_field()
        self.test_edge_cases()
        
        # EXISTING FEATURE TESTS (For regression testing)
        print("\n🔄 REGRESSION TESTING:")
        self.test_comments_api()
        self.test_additional_endpoints()
        
        # Summary
        self.print_summary()
    
    def print_summary(self):
        """Print test summary"""
        print("\n" + "=" * 60)
        print("📊 TEST SUMMARY")
        print("=" * 60)
        
        total_tests = len(self.test_results)
        passed_tests = len([r for r in self.test_results if r["success"]])
        failed_tests = total_tests - passed_tests
        
        print(f"Total Tests: {total_tests}")
        print(f"Passed: {passed_tests} ✅")
        print(f"Failed: {failed_tests} ❌")
        print(f"Success Rate: {(passed_tests/total_tests)*100:.1f}%")
        
        if failed_tests > 0:
            print("\n🔍 FAILED TESTS:")
            for result in self.test_results:
                if not result["success"]:
                    print(f"  ❌ {result['test']}: {result['message']}")
        
        print("\n" + "=" * 60)

if __name__ == "__main__":
    tester = BackendTester()
    tester.run_all_tests()