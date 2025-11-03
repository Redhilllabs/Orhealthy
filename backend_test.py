#!/usr/bin/env python3
"""
Backend API Testing for Admin Panel Combo Management
Tests the OrHealthy admin panel combo management functionality
"""

import requests
import json
import sys
import os
from datetime import datetime

# Get backend URL from frontend .env file
BACKEND_URL = "https://mealhierarchy.preview.emergentagent.com"
API_BASE = f"{BACKEND_URL}/api"
ADMIN_PANEL_URL = f"{API_BASE}/admin-panel"

# Admin credentials
ADMIN_EMAIL = "admin@admin.com"
ADMIN_PASSWORD = "admin"

class Colors:
    GREEN = '\033[92m'
    RED = '\033[91m'
    YELLOW = '\033[93m'
    BLUE = '\033[94m'
    BOLD = '\033[1m'
    END = '\033[0m'

def print_test_header(test_name):
    print(f"\n{Colors.BLUE}{Colors.BOLD}{'='*60}{Colors.END}")
    print(f"{Colors.BLUE}{Colors.BOLD}Testing: {test_name}{Colors.END}")
    print(f"{Colors.BLUE}{Colors.BOLD}{'='*60}{Colors.END}")

def print_success(message):
    print(f"{Colors.GREEN}✅ {message}{Colors.END}")

def print_error(message):
    print(f"{Colors.RED}❌ {message}{Colors.END}")

def print_warning(message):
    print(f"{Colors.YELLOW}⚠️  {message}{Colors.END}")

def print_info(message):
    print(f"{Colors.BLUE}ℹ️  {message}{Colors.END}")

class AdminPanelTester:
    def __init__(self):
        self.session = requests.Session()
        self.admin_token = None
        self.test_results = {
            'passed': 0,
            'failed': 0,
            'warnings': 0
        }
        self.test_combo_id = None
        
    def run_all_tests(self):
        """Run all admin panel combo management tests"""
        print(f"{Colors.BOLD}OrHealthy Admin Panel - Combo Management Testing{Colors.END}")
        print(f"Backend URL: {BACKEND_URL}")
        print(f"API Base: {API_BASE}")
        print(f"Admin Panel: {ADMIN_PANEL_URL}")
        
        try:
            # Test 1: Admin Panel Access & Loading
            self.test_admin_panel_access()
            
            # Test 2: Admin Authentication
            self.test_admin_authentication()
            
            # Test 3: Load Existing Combos (GET /api/meals)
            self.test_load_combos()
            
            # Test 4: Load Recipes for Combo Creation (GET /api/recipes)
            self.test_load_recipes_for_combos()
            
            # Test 5: Create New Combo (POST /api/meals)
            self.test_create_combo()
            
            # Test 6: Edit Existing Combo (PUT /api/meals/{id})
            self.test_edit_combo()
            
            # Test 7: Delete Combo (DELETE /api/meals/{id})
            self.test_delete_combo()
            
            # Test 8: Error Handling
            self.test_error_handling()
            
        except Exception as e:
            print_error(f"Critical test failure: {str(e)}")
            self.test_results['failed'] += 1
        
        self.print_summary()

    def test_recipe_endpoints(self):
        """Test all Recipe CRUD endpoints"""
        print("=" * 60)
        print("TESTING RECIPE CRUD ENDPOINTS")
        print("=" * 60)
        
        # Test 1: GET /api/recipes (list all recipes)
        try:
            response = self.session.get(f"{BACKEND_URL}/recipes")
            if response.status_code == 200:
                recipes = response.json()
                self.log_test("GET /api/recipes - List all recipes", True, 
                            f"Status: {response.status_code}, Found {len(recipes)} recipes")
            else:
                self.log_test("GET /api/recipes - List all recipes", False, 
                            f"Status: {response.status_code}, Response: {response.text}")
        except Exception as e:
            self.log_test("GET /api/recipes - List all recipes", False, f"Exception: {str(e)}")

        # Test 2: POST /api/recipes (create new recipe)
        recipe_data = {
            "name": "Test Recipe for API Testing",
            "description": "A comprehensive test recipe with processed ingredients",
            "ingredients": [
                {
                    "ingredient_id": "sample_ingredient_id_1",
                    "name": "Test Ingredient 1",
                    "quantity": 2.0,
                    "unit": "g",
                    "price": 10.0,
                    "step_size": 1.0
                },
                {
                    "ingredient_id": "sample_ingredient_id_2", 
                    "name": "Test Ingredient 2",
                    "quantity": 1.5,
                    "unit": "ml",
                    "price": 15.0,
                    "step_size": 0.5
                }
            ],
            "tags": ["test", "api", "sample"],
            "images": ["data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg=="],
            "created_by": "admin"
        }
        
        try:
            response = self.session.post(f"{BACKEND_URL}/recipes", json=recipe_data)
            if response.status_code == 200:
                result = response.json()
                self.created_recipe_id = result.get("id")
                self.log_test("POST /api/recipes - Create new recipe", True, 
                            f"Status: {response.status_code}, Recipe ID: {self.created_recipe_id}")
            else:
                self.log_test("POST /api/recipes - Create new recipe", False, 
                            f"Status: {response.status_code}, Response: {response.text}")
        except Exception as e:
            self.log_test("POST /api/recipes - Create new recipe", False, f"Exception: {str(e)}")

        # Test 3: GET /api/recipes/{recipe_id} (get specific recipe)
        if self.created_recipe_id:
            try:
                response = self.session.get(f"{BACKEND_URL}/recipes/{self.created_recipe_id}")
                if response.status_code == 200:
                    recipe = response.json()
                    has_calculated_price = "calculated_price" in recipe
                    self.log_test("GET /api/recipes/{recipe_id} - Get specific recipe", True, 
                                f"Status: {response.status_code}, Has calculated_price: {has_calculated_price}")
                else:
                    self.log_test("GET /api/recipes/{recipe_id} - Get specific recipe", False, 
                                f"Status: {response.status_code}, Response: {response.text}")
            except Exception as e:
                self.log_test("GET /api/recipes/{recipe_id} - Get specific recipe", False, f"Exception: {str(e)}")

        # Test 4: PUT /api/recipes/{recipe_id} (update recipe)
        if self.created_recipe_id:
            updated_recipe_data = {
                "name": "Updated Test Recipe",
                "description": "Updated description for testing",
                "ingredients": [
                    {
                        "ingredient_id": "sample_ingredient_id_1",
                        "name": "Updated Test Ingredient",
                        "quantity": 3.0,
                        "unit": "g",
                        "price": 12.0,
                        "step_size": 1.0
                    }
                ],
                "tags": ["updated", "test"],
                "images": ["data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg=="],
                "created_by": "admin"
            }
            
            try:
                response = self.session.put(f"{BACKEND_URL}/recipes/{self.created_recipe_id}", json=updated_recipe_data)
                if response.status_code == 200:
                    self.log_test("PUT /api/recipes/{recipe_id} - Update recipe", True, 
                                f"Status: {response.status_code}")
                else:
                    self.log_test("PUT /api/recipes/{recipe_id} - Update recipe", False, 
                                f"Status: {response.status_code}, Response: {response.text}")
            except Exception as e:
                self.log_test("PUT /api/recipes/{recipe_id} - Update recipe", False, f"Exception: {str(e)}")

        # Test 5: Error handling for non-existent recipe
        try:
            response = self.session.get(f"{BACKEND_URL}/recipes/nonexistent_recipe_id")
            if response.status_code == 404:
                self.log_test("GET /api/recipes/{invalid_id} - Error handling", True, 
                            f"Status: {response.status_code} (Expected 404)")
            else:
                self.log_test("GET /api/recipes/{invalid_id} - Error handling", False, 
                            f"Status: {response.status_code}, Expected 404")
        except Exception as e:
            self.log_test("GET /api/recipes/{invalid_id} - Error handling", False, f"Exception: {str(e)}")

    def test_meal_endpoints(self):
        """Test all Meal CRUD endpoints"""
        print("=" * 60)
        print("TESTING MEAL CRUD ENDPOINTS")
        print("=" * 60)
        
        # Test 1: GET /api/meals (list all meals)
        try:
            response = self.session.get(f"{BACKEND_URL}/meals")
            if response.status_code == 200:
                meals = response.json()
                self.log_test("GET /api/meals - List all meals", True, 
                            f"Status: {response.status_code}, Found {len(meals)} meals")
            else:
                self.log_test("GET /api/meals - List all meals", False, 
                            f"Status: {response.status_code}, Response: {response.text}")
        except Exception as e:
            self.log_test("GET /api/meals - List all meals", False, f"Exception: {str(e)}")

        # Test 2: POST /api/meals (create new meal)
        meal_data = {
            "name": "Test Meal for API Testing",
            "description": "A comprehensive test meal with recipes",
            "recipes": [
                {
                    "recipe_id": "sample_recipe_id_1",
                    "name": "Test Recipe 1",
                    "quantity": 1.0,
                    "step_size": 0.5,
                    "price": 20.0
                },
                {
                    "recipe_id": "sample_recipe_id_2",
                    "name": "Test Recipe 2", 
                    "quantity": 2.0,
                    "step_size": 1.0,
                    "price": 25.0
                }
            ],
            "tags": ["breakfast", "healthy", "test"],
            "images": ["data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg=="],
            "is_preset": True,
            "created_by": "admin"
        }
        
        try:
            response = self.session.post(f"{BACKEND_URL}/meals", json=meal_data)
            if response.status_code == 200:
                result = response.json()
                self.created_meal_id = result.get("id")
                self.log_test("POST /api/meals - Create new meal", True, 
                            f"Status: {response.status_code}, Meal ID: {self.created_meal_id}")
            else:
                self.log_test("POST /api/meals - Create new meal", False, 
                            f"Status: {response.status_code}, Response: {response.text}")
        except Exception as e:
            self.log_test("POST /api/meals - Create new meal", False, f"Exception: {str(e)}")

        # Test 3: GET /api/meals/{meal_id} (get specific meal)
        if self.created_meal_id:
            try:
                response = self.session.get(f"{BACKEND_URL}/meals/{self.created_meal_id}")
                if response.status_code == 200:
                    meal = response.json()
                    has_calculated_price = "calculated_price" in meal
                    self.log_test("GET /api/meals/{meal_id} - Get specific meal", True, 
                                f"Status: {response.status_code}, Has calculated_price: {has_calculated_price}")
                else:
                    self.log_test("GET /api/meals/{meal_id} - Get specific meal", False, 
                                f"Status: {response.status_code}, Response: {response.text}")
            except Exception as e:
                self.log_test("GET /api/meals/{meal_id} - Get specific meal", False, f"Exception: {str(e)}")

        # Test 4: PUT /api/meals/{meal_id} (update meal)
        if self.created_meal_id:
            updated_meal_data = {
                "name": "Updated Test Meal",
                "description": "Updated description for testing",
                "recipes": [
                    {
                        "recipe_id": "sample_recipe_id_1",
                        "name": "Updated Test Recipe",
                        "quantity": 1.5,
                        "step_size": 0.5,
                        "price": 22.0
                    }
                ],
                "tags": ["updated", "test", "dinner"],
                "images": ["data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg=="],
                "is_preset": True,
                "created_by": "admin"
            }
            
            try:
                response = self.session.put(f"{BACKEND_URL}/meals/{self.created_meal_id}", json=updated_meal_data)
                if response.status_code == 200:
                    self.log_test("PUT /api/meals/{meal_id} - Update meal", True, 
                                f"Status: {response.status_code}")
                else:
                    self.log_test("PUT /api/meals/{meal_id} - Update meal", False, 
                                f"Status: {response.status_code}, Response: {response.text}")
            except Exception as e:
                self.log_test("PUT /api/meals/{meal_id} - Update meal", False, f"Exception: {str(e)}")

        # Test 5: Error handling for non-existent meal
        try:
            response = self.session.get(f"{BACKEND_URL}/meals/nonexistent_meal_id")
            if response.status_code == 404:
                self.log_test("GET /api/meals/{invalid_id} - Error handling", True, 
                            f"Status: {response.status_code} (Expected 404)")
            else:
                self.log_test("GET /api/meals/{invalid_id} - Error handling", False, 
                            f"Status: {response.status_code}, Expected 404")
        except Exception as e:
            self.log_test("GET /api/meals/{invalid_id} - Error handling", False, f"Exception: {str(e)}")

    def test_cleanup(self):
        """Clean up test data"""
        print("=" * 60)
        print("CLEANUP - DELETING TEST DATA")
        print("=" * 60)
        
        # Delete test recipe
        if self.created_recipe_id:
            try:
                response = self.session.delete(f"{BACKEND_URL}/recipes/{self.created_recipe_id}")
                if response.status_code == 200:
                    self.log_test("DELETE /api/recipes/{recipe_id} - Delete recipe", True, 
                                f"Status: {response.status_code}")
                else:
                    self.log_test("DELETE /api/recipes/{recipe_id} - Delete recipe", False, 
                                f"Status: {response.status_code}, Response: {response.text}")
            except Exception as e:
                self.log_test("DELETE /api/recipes/{recipe_id} - Delete recipe", False, f"Exception: {str(e)}")

        # Delete test meal
        if self.created_meal_id:
            try:
                response = self.session.delete(f"{BACKEND_URL}/meals/{self.created_meal_id}")
                if response.status_code == 200:
                    self.log_test("DELETE /api/meals/{meal_id} - Delete meal", True, 
                                f"Status: {response.status_code}")
                else:
                    self.log_test("DELETE /api/meals/{meal_id} - Delete meal", False, 
                                f"Status: {response.status_code}, Response: {response.text}")
            except Exception as e:
                self.log_test("DELETE /api/meals/{meal_id} - Delete meal", False, f"Exception: {str(e)}")

    def run_all_tests(self):
        """Run all backend tests"""
        print(f"Starting Backend API Tests at {datetime.now()}")
        print(f"Backend URL: {BACKEND_URL}")
        print()
        
        # Test Recipe endpoints
        self.test_recipe_endpoints()
        
        # Test Meal endpoints  
        self.test_meal_endpoints()
        
        # Cleanup test data
        self.test_cleanup()
        
        # Print summary
        self.print_summary()

    def print_summary(self):
        """Print test summary"""
        print("=" * 60)
        print("TEST SUMMARY")
        print("=" * 60)
        
        total_tests = len(self.test_results)
        passed_tests = sum(1 for result in self.test_results if result["success"])
        failed_tests = total_tests - passed_tests
        
        print(f"Total Tests: {total_tests}")
        print(f"Passed: {passed_tests}")
        print(f"Failed: {failed_tests}")
        print(f"Success Rate: {(passed_tests/total_tests)*100:.1f}%")
        print()
        
        if failed_tests > 0:
            print("FAILED TESTS:")
            for result in self.test_results:
                if not result["success"]:
                    print(f"❌ {result['test']}")
                    if result["details"]:
                        print(f"   {result['details']}")
            print()
        
        print("PASSED TESTS:")
        for result in self.test_results:
            if result["success"]:
                print(f"✅ {result['test']}")
        
        return passed_tests, failed_tests

if __name__ == "__main__":
    tester = BackendTester()
    tester.run_all_tests()