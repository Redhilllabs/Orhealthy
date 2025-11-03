#!/usr/bin/env python3
"""
Backend Testing for Admin Panel - Meals Tab Functionality
Tests the fixed issues with meals management in the admin panel.
"""

import requests
import json
import sys
import time
from datetime import datetime

# Configuration
BACKEND_URL = "https://mealhierarchy.preview.emergentagent.com"
ADMIN_EMAIL = "admin@admin.com"
ADMIN_PASSWORD = "admin"

class AdminPanelTester:
    def __init__(self):
        self.session = requests.Session()
        self.admin_token = None
        self.test_results = []
        
    def log_test(self, test_name, success, message, details=None):
        """Log test results"""
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
        if details and not success:
            print(f"   Details: {details}")
    
    def admin_login(self):
        """Test admin authentication"""
        try:
            # Try to access admin panel first
            response = self.session.get(f"{BACKEND_URL}/api/admin-panel")
            if response.status_code == 200:
                self.log_test("Admin Panel Access", True, "Admin panel accessible without authentication")
                return True
            else:
                self.log_test("Admin Panel Access", False, f"Admin panel not accessible: {response.status_code}")
                return False
        except Exception as e:
            self.log_test("Admin Panel Access", False, f"Error accessing admin panel: {str(e)}")
            return False
    
    def test_admin_panel_loading(self):
        """Test admin panel HTML loading and structure"""
        try:
            response = self.session.get(f"{BACKEND_URL}/api/admin-panel")
            if response.status_code == 200:
                html_content = response.text
                
                # Check for key elements mentioned in the review request
                required_elements = [
                    'id="meals"',  # Meals section
                    'Meals Management',  # Section title
                    'Add Meal',  # Add button text
                    'id="mealModal"',  # Modal
                    'id="mealForm"',  # Form
                    'Add Ingredient',  # Add ingredient button
                    'mealIngredientSelect',  # Ingredient dropdown
                    'step_size',  # Step size override field
                ]
                
                missing_elements = []
                for element in required_elements:
                    if element not in html_content:
                        missing_elements.append(element)
                
                if missing_elements:
                    self.log_test("Admin Panel HTML Structure", False, 
                                f"Missing elements: {', '.join(missing_elements)}")
                    return False
                else:
                    self.log_test("Admin Panel HTML Structure", True, 
                                "All required HTML elements found")
                    return True
            else:
                self.log_test("Admin Panel HTML Structure", False, 
                            f"Failed to load admin panel: {response.status_code}")
                return False
        except Exception as e:
            self.log_test("Admin Panel HTML Structure", False, f"Error: {str(e)}")
            return False
    
    def test_load_meals_api(self):
        """Test GET /api/recipes endpoint (admin panel 'meals' maps to backend 'recipes')"""
        try:
            response = self.session.get(f"{BACKEND_URL}/api/recipes")
            if response.status_code == 200:
                meals = response.json()
                self.log_test("Load Meals API", True, 
                            f"Successfully loaded {len(meals)} meals", 
                            f"Sample meal: {meals[0] if meals else 'No meals found'}")
                return meals
            else:
                self.log_test("Load Meals API", False, 
                            f"Failed to load meals: {response.status_code}")
                return []
        except Exception as e:
            self.log_test("Load Meals API", False, f"Error loading meals: {str(e)}")
            return []
    
    def test_load_ingredients_api(self):
        """Test GET /api/ingredients endpoint for meal creation"""
        try:
            response = self.session.get(f"{BACKEND_URL}/api/ingredients")
            if response.status_code == 200:
                ingredients = response.json()
                self.log_test("Load Ingredients API", True, 
                            f"Successfully loaded {len(ingredients)} processed ingredients",
                            f"Sample ingredient: {ingredients[0] if ingredients else 'No ingredients found'}")
                return ingredients
            else:
                self.log_test("Load Ingredients API", False, 
                            f"Failed to load ingredients: {response.status_code}")
                return []
        except Exception as e:
            self.log_test("Load Ingredients API", False, f"Error loading ingredients: {str(e)}")
            return []
    
    def test_create_meal(self, ingredients):
        """Test POST /api/recipes endpoint (create new meal)"""
        if not ingredients:
            self.log_test("Create Meal API", False, "No ingredients available for meal creation")
            return None
            
        try:
            # Create test meal with first available ingredient
            test_ingredient = ingredients[0]
            meal_data = {
                "name": f"Test Meal {int(time.time())}",
                "description": "Test meal created by automated testing",
                "images": ["data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=="],
                "ingredients": [
                    {
                        "ingredient_id": test_ingredient["_id"],
                        "name": test_ingredient["name"],
                        "quantity": 2.0,
                        "unit": test_ingredient["unit"],
                        "step_size": 1.0,
                        "price": test_ingredient.get("calculated_price", 0)
                    }
                ],
                "tags": ["test", "automated"],
                "created_by": "admin"
            }
            
            response = self.session.post(f"{BACKEND_URL}/api/recipes", json=meal_data)
            if response.status_code == 200:
                result = response.json()
                meal_id = result.get("id")
                self.log_test("Create Meal API", True, 
                            f"Successfully created meal with ID: {meal_id}")
                return meal_id
            else:
                self.log_test("Create Meal API", False, 
                            f"Failed to create meal: {response.status_code} - {response.text}")
                return None
        except Exception as e:
            self.log_test("Create Meal API", False, f"Error creating meal: {str(e)}")
            return None
    
    def test_edit_meal(self, meal_id, ingredients):
        """Test PUT /api/recipes/{id} endpoint (edit meal)"""
        if not meal_id or not ingredients:
            self.log_test("Edit Meal API", False, "No meal ID or ingredients available for editing")
            return False
            
        try:
            # Update meal data
            updated_meal_data = {
                "name": f"Updated Test Meal {int(time.time())}",
                "description": "Updated test meal description",
                "images": [],
                "ingredients": [
                    {
                        "ingredient_id": ingredients[0]["_id"],
                        "name": ingredients[0]["name"],
                        "quantity": 3.0,  # Changed quantity
                        "unit": ingredients[0]["unit"],
                        "step_size": 2.0,  # Changed step size
                        "price": ingredients[0].get("calculated_price", 0)
                    }
                ],
                "tags": ["test", "updated"],
                "created_by": "admin"
            }
            
            response = self.session.put(f"{BACKEND_URL}/api/recipes/{meal_id}", json=updated_meal_data)
            if response.status_code == 200:
                self.log_test("Edit Meal API", True, f"Successfully updated meal {meal_id}")
                return True
            else:
                self.log_test("Edit Meal API", False, 
                            f"Failed to update meal: {response.status_code} - {response.text}")
                return False
        except Exception as e:
            self.log_test("Edit Meal API", False, f"Error updating meal: {str(e)}")
            return False
    
    def test_delete_meal(self, meal_id):
        """Test DELETE /api/recipes/{id} endpoint (delete meal)"""
        if not meal_id:
            self.log_test("Delete Meal API", False, "No meal ID available for deletion")
            return False
            
        try:
            response = self.session.delete(f"{BACKEND_URL}/api/recipes/{meal_id}")
            if response.status_code == 200:
                self.log_test("Delete Meal API", True, f"Successfully deleted meal {meal_id}")
                return True
            else:
                self.log_test("Delete Meal API", False, 
                            f"Failed to delete meal: {response.status_code} - {response.text}")
                return False
        except Exception as e:
            self.log_test("Delete Meal API", False, f"Error deleting meal: {str(e)}")
            return False
    
    def test_price_calculation(self, ingredients):
        """Test price auto-calculation functionality"""
        if not ingredients:
            self.log_test("Price Calculation", False, "No ingredients available for price calculation test")
            return False
            
        try:
            # Create meal with multiple ingredients to test price calculation
            test_ingredients = ingredients[:2] if len(ingredients) >= 2 else ingredients[:1]
            total_expected_price = 0
            meal_ingredients = []
            
            for ing in test_ingredients:
                quantity = 2.0
                price = ing.get("calculated_price", 0)
                total_expected_price += price * quantity
                
                meal_ingredients.append({
                    "ingredient_id": ing["_id"],
                    "name": ing["name"],
                    "quantity": quantity,
                    "unit": ing["unit"],
                    "step_size": 1.0,
                    "price": price
                })
            
            meal_data = {
                "name": f"Price Test Meal {int(time.time())}",
                "description": "Testing price calculation",
                "ingredients": meal_ingredients,
                "tags": ["price-test"],
                "created_by": "admin"
            }
            
            # Create meal
            response = self.session.post(f"{BACKEND_URL}/api/recipes", json=meal_data)
            if response.status_code == 200:
                meal_id = response.json().get("id")
                
                # Get the created meal to check calculated price
                get_response = self.session.get(f"{BACKEND_URL}/api/recipes/{meal_id}")
                if get_response.status_code == 200:
                    meal = get_response.json()
                    calculated_price = meal.get("calculated_price", 0)
                    
                    # Clean up
                    self.session.delete(f"{BACKEND_URL}/api/recipes/{meal_id}")
                    
                    if abs(calculated_price - total_expected_price) < 0.01:  # Allow small floating point differences
                        self.log_test("Price Calculation", True, 
                                    f"Price calculation correct: Expected ₹{total_expected_price:.2f}, Got ₹{calculated_price:.2f}")
                        return True
                    else:
                        self.log_test("Price Calculation", False, 
                                    f"Price calculation incorrect: Expected ₹{total_expected_price:.2f}, Got ₹{calculated_price:.2f}")
                        return False
                else:
                    self.log_test("Price Calculation", False, "Failed to retrieve created meal for price verification")
                    return False
            else:
                self.log_test("Price Calculation", False, f"Failed to create test meal: {response.status_code}")
                return False
        except Exception as e:
            self.log_test("Price Calculation", False, f"Error testing price calculation: {str(e)}")
            return False
    
    def test_error_handling(self):
        """Test error handling for invalid operations"""
        try:
            # Test invalid meal ID
            response = self.session.get(f"{BACKEND_URL}/api/recipes/invalid_id")
            if response.status_code == 404:
                self.log_test("Error Handling - Invalid ID", True, "Properly returns 404 for invalid meal ID")
            else:
                self.log_test("Error Handling - Invalid ID", False, f"Unexpected response for invalid ID: {response.status_code}")
            
            # Test deleting non-existent meal
            response = self.session.delete(f"{BACKEND_URL}/api/recipes/507f1f77bcf86cd799439011")  # Valid ObjectId format but non-existent
            if response.status_code == 404:
                self.log_test("Error Handling - Delete Non-existent", True, "Properly returns 404 for non-existent meal deletion")
            else:
                self.log_test("Error Handling - Delete Non-existent", False, f"Unexpected response for non-existent deletion: {response.status_code}")
            
            return True
        except Exception as e:
            self.log_test("Error Handling", False, f"Error testing error handling: {str(e)}")
            return False
    
    def run_all_tests(self):
        """Run all admin panel meals tab tests"""
        print("🧪 Starting Admin Panel - Meals Tab Testing")
        print("=" * 60)
        
        # Test 1: Admin Panel Access & Loading
        if not self.admin_login():
            print("❌ Cannot proceed without admin panel access")
            return False
        
        # Test 2: Admin Panel HTML Structure
        self.test_admin_panel_loading()
        
        # Test 3: Load Meals API
        meals = self.test_load_meals_api()
        
        # Test 4: Load Ingredients API
        ingredients = self.test_load_ingredients_api()
        
        # Test 5: Create New Meal
        meal_id = self.test_create_meal(ingredients)
        
        # Test 6: Edit Existing Meal
        if meal_id:
            self.test_edit_meal(meal_id, ingredients)
        
        # Test 7: Price Calculation
        self.test_price_calculation(ingredients)
        
        # Test 8: Delete Meal
        if meal_id:
            self.test_delete_meal(meal_id)
        
        # Test 9: Error Handling
        self.test_error_handling()
        
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
                    print(f"  • {result['test']}: {result['message']}")
        
        return passed == total

def main():
    """Main test execution"""
    tester = AdminPanelTester()
    success = tester.run_all_tests()
    
    if success:
        print("\n🎉 All tests passed! Admin Panel Meals Tab is working correctly.")
        sys.exit(0)
    else:
        print("\n⚠️  Some tests failed. Please check the issues above.")
        sys.exit(1)

if __name__ == "__main__":
    main()