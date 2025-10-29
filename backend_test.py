#!/usr/bin/env python3
"""
Backend API Testing for OrHealthy Admin Panel - Phase 1
Tests all admin panel backend APIs as specified in the review request.
"""

import requests
import json
import sys
from typing import Dict, Any, Optional

# Backend URL from frontend/.env
BASE_URL = "https://nutrition-guide-9.preview.emergentagent.com"
API_BASE_URL = f"{BASE_URL}/api"

class AdminPanelTester:
    def __init__(self):
        self.session = requests.Session()
        self.test_results = []
        self.created_ingredient_id = None
        self.created_meal_id = None
        
    def log_test(self, test_name: str, success: bool, details: str = ""):
        """Log test result"""
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status} {test_name}")
        if details:
            print(f"   Details: {details}")
        self.test_results.append({
            "test": test_name,
            "success": success,
            "details": details
        })
        
    def test_admin_panel_access(self):
        """Test 1: Admin Panel Access - GET /admin"""
        try:
            response = self.session.get(f"{BASE_URL}/admin")
            if response.status_code == 200 and "admin" in response.text.lower():
                self.log_test("Admin Panel Access", True, f"Status: {response.status_code}, Content contains admin HTML")
                return True
            else:
                self.log_test("Admin Panel Access", False, f"Status: {response.status_code}, Response: {response.text[:200]}")
                return False
        except Exception as e:
            self.log_test("Admin Panel Access", False, f"Exception: {str(e)}")
            return False
            
    def test_star_config_get_default(self):
        """Test 2a: Star Rating Config - GET default config"""
        try:
            response = self.session.get(f"{API_BASE_URL}/admin/star-config")
            if response.status_code == 200:
                config = response.json()
                expected_keys = ["star1", "star2", "star3", "star4", "star5"]
                if all(key in config for key in expected_keys):
                    self.log_test("Star Config GET (default)", True, f"Config: {config}")
                    return True, config
                else:
                    self.log_test("Star Config GET (default)", False, f"Missing keys in config: {config}")
                    return False, None
            else:
                self.log_test("Star Config GET (default)", False, f"Status: {response.status_code}, Response: {response.text}")
                return False, None
        except Exception as e:
            self.log_test("Star Config GET (default)", False, f"Exception: {str(e)}")
            return False, None
            
    def test_star_config_post(self):
        """Test 2b: Star Rating Config - POST new config"""
        test_config = {
            "star1": 30,
            "star2": 120,
            "star3": 300,
            "star4": 600,
            "star5": 1200
        }
        
        try:
            response = self.session.post(
                f"{API_BASE_URL}/admin/star-config",
                json=test_config,
                headers={"Content-Type": "application/json"}
            )
            if response.status_code in [200, 201]:
                self.log_test("Star Config POST", True, f"Status: {response.status_code}, Config saved")
                return True
            else:
                self.log_test("Star Config POST", False, f"Status: {response.status_code}, Response: {response.text}")
                return False
        except Exception as e:
            self.log_test("Star Config POST", False, f"Exception: {str(e)}")
            return False
            
    def test_star_config_get_saved(self):
        """Test 2c: Star Rating Config - GET saved config to verify"""
        try:
            response = self.session.get(f"{API_BASE_URL}/admin/star-config")
            if response.status_code == 200:
                config = response.json()
                expected_config = {
                    "star1": 30,
                    "star2": 120,
                    "star3": 300,
                    "star4": 600,
                    "star5": 1200
                }
                if config == expected_config:
                    self.log_test("Star Config GET (saved)", True, f"Config matches expected: {config}")
                    return True
                else:
                    self.log_test("Star Config GET (saved)", False, f"Config mismatch. Got: {config}, Expected: {expected_config}")
                    return False
            else:
                self.log_test("Star Config GET (saved)", False, f"Status: {response.status_code}, Response: {response.text}")
                return False
        except Exception as e:
            self.log_test("Star Config GET (saved)", False, f"Exception: {str(e)}")
            return False
            
    def test_create_ingredient(self):
        """Test 3a: Create ingredient with images and tags"""
        # Small base64 test image (1x1 pixel PNG)
        test_image = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
        
        ingredient_data = {
            "name": "Fresh Organic Tomato",
            "price_per_unit": 25.50,
            "unit": "piece",
            "description": "Fresh organic tomato for healthy meals",
            "images": [test_image],
            "tags": ["organic", "fresh", "vegetable", "healthy"]
        }
        
        try:
            response = self.session.post(
                f"{API_BASE_URL}/admin/ingredients",
                json=ingredient_data,
                headers={"Content-Type": "application/json"}
            )
            if response.status_code in [200, 201]:
                result = response.json()
                self.created_ingredient_id = result.get("id")
                self.log_test("Create Ingredient", True, f"Status: {response.status_code}, ID: {self.created_ingredient_id}")
                return True
            else:
                self.log_test("Create Ingredient", False, f"Status: {response.status_code}, Response: {response.text}")
                return False
        except Exception as e:
            self.log_test("Create Ingredient", False, f"Exception: {str(e)}")
            return False
            
    def test_get_ingredients(self):
        """Test 3b: Get ingredients to verify creation"""
        try:
            response = self.session.get(f"{API_BASE_URL}/ingredients")
            if response.status_code == 200:
                ingredients = response.json()
                if isinstance(ingredients, list):
                    # Look for our created ingredient
                    found_ingredient = None
                    for ingredient in ingredients:
                        if ingredient.get("name") == "Fresh Organic Tomato":
                            found_ingredient = ingredient
                            break
                    
                    if found_ingredient:
                        # Verify it has images and tags
                        has_images = "images" in found_ingredient and len(found_ingredient["images"]) > 0
                        has_tags = "tags" in found_ingredient and len(found_ingredient["tags"]) > 0
                        
                        if has_images and has_tags:
                            self.log_test("Get Ingredients (verify)", True, f"Found ingredient with images and tags: {found_ingredient['name']}")
                            return True
                        else:
                            self.log_test("Get Ingredients (verify)", False, f"Ingredient missing images or tags. Images: {has_images}, Tags: {has_tags}")
                            return False
                    else:
                        self.log_test("Get Ingredients (verify)", False, "Created ingredient not found in list")
                        return False
                else:
                    self.log_test("Get Ingredients (verify)", False, f"Expected list, got: {type(ingredients)}")
                    return False
            else:
                self.log_test("Get Ingredients (verify)", False, f"Status: {response.status_code}, Response: {response.text}")
                return False
        except Exception as e:
            self.log_test("Get Ingredients (verify)", False, f"Exception: {str(e)}")
            return False
            
    def test_create_meal(self):
        """Test 4a: Create meal with images, tags, and ingredients"""
        if not self.created_ingredient_id:
            self.log_test("Create Meal", False, "No ingredient ID available - ingredient creation failed")
            return False
            
        # Small base64 test image (1x1 pixel PNG)
        test_image = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
        
        meal_data = {
            "name": "Healthy Garden Salad Bowl",
            "description": "Fresh and nutritious salad bowl with organic ingredients",
            "base_price": 150.00,
            "images": [test_image],
            "tags": ["healthy", "vegetarian", "low-carb", "fresh"],
            "ingredients": [
                {
                    "ingredient_id": self.created_ingredient_id,
                    "name": "Fresh Organic Tomato",
                    "price": 25.50,
                    "default_quantity": 2
                }
            ],
            "is_preset": True,
            "created_by": "admin"
        }
        
        try:
            response = self.session.post(
                f"{API_BASE_URL}/admin/meals",
                json=meal_data,
                headers={"Content-Type": "application/json"}
            )
            if response.status_code in [200, 201]:
                result = response.json()
                self.created_meal_id = result.get("id")
                self.log_test("Create Meal", True, f"Status: {response.status_code}, ID: {self.created_meal_id}")
                return True
            else:
                self.log_test("Create Meal", False, f"Status: {response.status_code}, Response: {response.text}")
                return False
        except Exception as e:
            self.log_test("Create Meal", False, f"Exception: {str(e)}")
            return False
            
    def test_get_meals(self):
        """Test 4b: Get meals to verify creation"""
        try:
            response = self.session.get(f"{API_BASE_URL}/meals")
            if response.status_code == 200:
                meals = response.json()
                if isinstance(meals, list):
                    # Look for our created meal
                    found_meal = None
                    for meal in meals:
                        if meal.get("name") == "Healthy Garden Salad Bowl":
                            found_meal = meal
                            break
                    
                    if found_meal:
                        # Verify it has images, tags, and ingredients
                        has_images = "images" in found_meal and len(found_meal["images"]) > 0
                        has_tags = "tags" in found_meal and len(found_meal["tags"]) > 0
                        has_ingredients = "ingredients" in found_meal and len(found_meal["ingredients"]) > 0
                        
                        if has_images and has_tags and has_ingredients:
                            self.log_test("Get Meals (verify)", True, f"Found meal with images, tags, and ingredients: {found_meal['name']}")
                            return True
                        else:
                            self.log_test("Get Meals (verify)", False, f"Meal missing data. Images: {has_images}, Tags: {has_tags}, Ingredients: {has_ingredients}")
                            return False
                    else:
                        self.log_test("Get Meals (verify)", False, "Created meal not found in list")
                        return False
                else:
                    self.log_test("Get Meals (verify)", False, f"Expected list, got: {type(meals)}")
                    return False
            else:
                self.log_test("Get Meals (verify)", False, f"Status: {response.status_code}, Response: {response.text}")
                return False
        except Exception as e:
            self.log_test("Get Meals (verify)", False, f"Exception: {str(e)}")
            return False
            
    def test_dashboard_stats_users(self):
        """Test 5a: Dashboard Stats - Get all users"""
        try:
            response = self.session.get(f"{API_BASE_URL}/admin/users")
            if response.status_code == 200:
                users = response.json()
                if isinstance(users, list):
                    self.log_test("Dashboard Users", True, f"Retrieved {len(users)} users")
                    return True, users
                else:
                    self.log_test("Dashboard Users", False, f"Expected list, got: {type(users)}")
                    return False, None
            else:
                self.log_test("Dashboard Users", False, f"Status: {response.status_code}, Response: {response.text}")
                return False, None
        except Exception as e:
            self.log_test("Dashboard Users", False, f"Exception: {str(e)}")
            return False, None
            
    def test_dashboard_stats_orders(self):
        """Test 5b: Dashboard Stats - Get all orders"""
        try:
            response = self.session.get(f"{API_BASE_URL}/admin/orders")
            if response.status_code == 200:
                orders = response.json()
                if isinstance(orders, list):
                    self.log_test("Dashboard Orders", True, f"Retrieved {len(orders)} orders")
                    return True, orders
                else:
                    self.log_test("Dashboard Orders", False, f"Expected list, got: {type(orders)}")
                    return False, None
            else:
                self.log_test("Dashboard Orders", False, f"Status: {response.status_code}, Response: {response.text}")
                return False, None
        except Exception as e:
            self.log_test("Dashboard Orders", False, f"Exception: {str(e)}")
            return False, None
            
    def test_user_points_update(self, users):
        """Test 6: User Points and Star Rating Update"""
        if not users or len(users) == 0:
            self.log_test("User Points Update", False, "No users available for testing")
            return False
            
        # Use the first user for testing
        test_user = users[0]
        user_id = test_user.get("_id")
        
        if not user_id:
            self.log_test("User Points Update", False, "No user ID found")
            return False
            
        # Update inherent points
        points_data = {"inherent_points": 500}
        
        try:
            response = self.session.put(
                f"{API_BASE_URL}/admin/users/{user_id}/points",
                json=points_data,
                headers={"Content-Type": "application/json"}
            )
            if response.status_code in [200, 201]:
                self.log_test("User Points Update", True, f"Status: {response.status_code}, Updated user {user_id} with 500 inherent points")
                return True
            else:
                self.log_test("User Points Update", False, f"Status: {response.status_code}, Response: {response.text}")
                return False
        except Exception as e:
            self.log_test("User Points Update", False, f"Exception: {str(e)}")
            return False
            
    def test_delete_meal(self):
        """Test cleanup: Delete created meal"""
        if not self.created_meal_id:
            self.log_test("Delete Meal", False, "No meal ID to delete")
            return False
            
        try:
            response = self.session.delete(f"{API_BASE_URL}/admin/meals/{self.created_meal_id}")
            if response.status_code in [200, 204]:
                self.log_test("Delete Meal", True, f"Status: {response.status_code}, Meal deleted")
                return True
            else:
                self.log_test("Delete Meal", False, f"Status: {response.status_code}, Response: {response.text}")
                return False
        except Exception as e:
            self.log_test("Delete Meal", False, f"Exception: {str(e)}")
            return False
            
    def test_delete_ingredient(self):
        """Test cleanup: Delete created ingredient"""
        if not self.created_ingredient_id:
            self.log_test("Delete Ingredient", False, "No ingredient ID to delete")
            return False
            
        try:
            response = self.session.delete(f"{API_BASE_URL}/admin/ingredients/{self.created_ingredient_id}")
            if response.status_code in [200, 204]:
                self.log_test("Delete Ingredient", True, f"Status: {response.status_code}, Ingredient deleted")
                return True
            else:
                self.log_test("Delete Ingredient", False, f"Status: {response.status_code}, Response: {response.text}")
                return False
        except Exception as e:
            self.log_test("Delete Ingredient", False, f"Exception: {str(e)}")
            return False
            
    def run_all_tests(self):
        """Run all admin panel tests"""
        print("🚀 Starting Admin Panel Backend API Tests")
        print("=" * 60)
        
        # Test 1: Admin Panel Access
        self.test_admin_panel_access()
        
        # Test 2: Star Rating Configuration
        self.test_star_config_get_default()
        self.test_star_config_post()
        self.test_star_config_get_saved()
        
        # Test 3: Ingredients with Images and Tags
        self.test_create_ingredient()
        self.test_get_ingredients()
        
        # Test 4: Meals with Images and Tags
        self.test_create_meal()
        self.test_get_meals()
        
        # Test 5: Dashboard Stats
        success_users, users = self.test_dashboard_stats_users()
        success_orders, orders = self.test_dashboard_stats_orders()
        
        # Test 6: User Points Update (if users exist)
        if success_users and users:
            self.test_user_points_update(users)
        
        # Cleanup: Delete created resources
        self.test_delete_meal()
        self.test_delete_ingredient()
        
        # Summary
        print("\n" + "=" * 60)
        print("📊 TEST SUMMARY")
        print("=" * 60)
        
        passed = sum(1 for result in self.test_results if result["success"])
        total = len(self.test_results)
        
        print(f"Total Tests: {total}")
        print(f"Passed: {passed}")
        print(f"Failed: {total - passed}")
        print(f"Success Rate: {(passed/total)*100:.1f}%")
        
        if total - passed > 0:
            print("\n❌ FAILED TESTS:")
            for result in self.test_results:
                if not result["success"]:
                    print(f"  - {result['test']}: {result['details']}")
        
        return passed == total

def main():
    """Main test execution"""
    tester = AdminPanelTester()
    success = tester.run_all_tests()
    
    if success:
        print("\n🎉 All tests passed!")
        sys.exit(0)
    else:
        print("\n💥 Some tests failed!")
        sys.exit(1)

if __name__ == "__main__":
    main()