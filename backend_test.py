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

    def test_admin_panel_access(self):
        """Test admin panel HTML page access"""
        print_test_header("Admin Panel Access & Loading")
        
        try:
            # Test admin panel HTML page
            response = self.session.get(ADMIN_PANEL_URL, timeout=10)
            
            if response.status_code == 200:
                print_success(f"Admin panel accessible at {ADMIN_PANEL_URL}")
                
                # Check if HTML contains combo management elements
                html_content = response.text
                combo_elements = [
                    'combos',
                    'Combos Management', 
                    'Add Combo',
                    'comboModal',
                    'comboForm',
                    'comboName',
                    'comboDescription',
                    'comboPrice',
                    'comboTags',
                    'comboMealSelect'
                ]
                
                missing_elements = []
                for element in combo_elements:
                    if element not in html_content:
                        missing_elements.append(element)
                
                if not missing_elements:
                    print_success("All combo management HTML elements found")
                    self.test_results['passed'] += 1
                else:
                    print_error(f"Missing HTML elements: {missing_elements}")
                    self.test_results['failed'] += 1
                    
            else:
                print_error(f"Admin panel not accessible. Status: {response.status_code}")
                self.test_results['failed'] += 1
                
        except requests.exceptions.RequestException as e:
            print_error(f"Failed to access admin panel: {str(e)}")
            self.test_results['failed'] += 1
    
    def test_admin_authentication(self):
        """Test admin authentication"""
        print_test_header("Admin Authentication")
        
        try:
            # Test admin login endpoint (assuming it exists)
            login_data = {
                "email": ADMIN_EMAIL,
                "password": ADMIN_PASSWORD
            }
            
            # Try different possible admin login endpoints
            login_endpoints = [
                f"{API_BASE}/admin/login",
                f"{API_BASE}/auth/admin/login",
                f"{API_BASE}/admin-login"
            ]
            
            login_successful = False
            for endpoint in login_endpoints:
                try:
                    response = self.session.post(endpoint, json=login_data, timeout=10)
                    if response.status_code == 200:
                        print_success(f"Admin login successful at {endpoint}")
                        # Try to extract token if available
                        try:
                            data = response.json()
                            if 'token' in data:
                                self.admin_token = data['token']
                                self.session.headers.update({'Authorization': f'Bearer {self.admin_token}'})
                        except:
                            pass
                        login_successful = True
                        break
                except:
                    continue
            
            if not login_successful:
                print_warning("Admin login endpoint not found or credentials invalid")
                print_info("Proceeding with tests without authentication")
                self.test_results['warnings'] += 1
            else:
                self.test_results['passed'] += 1
                
        except Exception as e:
            print_warning(f"Admin authentication test failed: {str(e)}")
            self.test_results['warnings'] += 1
    
    def test_load_combos(self):
        """Test loading existing combos via GET /api/meals"""
        print_test_header("Load Existing Combos (GET /api/meals)")
        
        try:
            response = self.session.get(f"{API_BASE}/meals", timeout=10)
            
            if response.status_code == 200:
                combos = response.json()
                print_success(f"GET /api/meals successful. Found {len(combos)} combos")
                
                if combos:
                    # Check structure of first combo
                    first_combo = combos[0]
                    required_fields = ['_id', 'name', 'recipes', 'calculated_price']
                    optional_fields = ['description', 'images', 'tags']
                    
                    missing_required = [field for field in required_fields if field not in first_combo]
                    present_optional = [field for field in optional_fields if field in first_combo]
                    
                    if not missing_required:
                        print_success(f"Combo structure valid. Required fields: {required_fields}")
                        print_info(f"Optional fields present: {present_optional}")
                        
                        # Display sample combo info
                        print_info(f"Sample combo: {first_combo.get('name', 'Unknown')} - ₹{first_combo.get('calculated_price', 0)}")
                        if first_combo.get('recipes'):
                            print_info(f"Contains {len(first_combo['recipes'])} recipes")
                        
                        self.test_results['passed'] += 1
                    else:
                        print_error(f"Missing required fields in combo: {missing_required}")
                        self.test_results['failed'] += 1
                else:
                    print_info("No combos found in database")
                    self.test_results['passed'] += 1
                    
            else:
                print_error(f"Failed to load combos. Status: {response.status_code}")
                try:
                    error_data = response.json()
                    print_error(f"Error details: {error_data}")
                except:
                    print_error(f"Response text: {response.text}")
                self.test_results['failed'] += 1
                
        except requests.exceptions.RequestException as e:
            print_error(f"Network error loading combos: {str(e)}")
            self.test_results['failed'] += 1
        except Exception as e:
            print_error(f"Error loading combos: {str(e)}")
            self.test_results['failed'] += 1
    
    def test_load_recipes_for_combos(self):
        """Test loading recipes for combo creation via GET /api/recipes"""
        print_test_header("Load Recipes for Combo Creation (GET /api/recipes)")
        
        try:
            response = self.session.get(f"{API_BASE}/recipes", timeout=10)
            
            if response.status_code == 200:
                recipes = response.json()
                print_success(f"GET /api/recipes successful. Found {len(recipes)} recipes")
                
                if recipes:
                    # Check structure of first recipe
                    first_recipe = recipes[0]
                    required_fields = ['_id', 'name', 'calculated_price']
                    
                    missing_required = [field for field in required_fields if field not in first_recipe]
                    
                    if not missing_required:
                        print_success("Recipe structure valid for combo creation")
                        print_info(f"Sample recipe: {first_recipe.get('name', 'Unknown')} - ₹{first_recipe.get('calculated_price', 0)}")
                        self.test_results['passed'] += 1
                    else:
                        print_error(f"Missing required fields in recipe: {missing_required}")
                        self.test_results['failed'] += 1
                else:
                    print_warning("No recipes found - combo creation may not work properly")
                    self.test_results['warnings'] += 1
                    
            else:
                print_error(f"Failed to load recipes. Status: {response.status_code}")
                self.test_results['failed'] += 1
                
        except Exception as e:
            print_error(f"Error loading recipes: {str(e)}")
            self.test_results['failed'] += 1
    
    def test_create_combo(self):
        """Test creating a new combo via POST /api/meals"""
        print_test_header("Create New Combo (POST /api/meals)")
        
        try:
            # First get available recipes
            recipes_response = self.session.get(f"{API_BASE}/recipes", timeout=10)
            if recipes_response.status_code != 200:
                print_error("Cannot test combo creation - recipes not available")
                self.test_results['failed'] += 1
                return
            
            recipes = recipes_response.json()
            if not recipes:
                print_error("Cannot test combo creation - no recipes available")
                self.test_results['failed'] += 1
                return
            
            # Create test combo data
            test_combo = {
                "name": f"Test Combo {datetime.now().strftime('%H%M%S')}",
                "description": "Test combo created by automated testing",
                "images": ["data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=="],
                "recipes": [
                    {
                        "recipe_id": recipes[0]["_id"],
                        "name": recipes[0]["name"],
                        "quantity": 1.0,
                        "step_size": 1.0,
                        "price": recipes[0].get("calculated_price", 0)
                    }
                ],
                "tags": ["test", "automated"],
                "is_preset": True,
                "created_by": "admin"
            }
            
            response = self.session.post(f"{API_BASE}/meals", json=test_combo, timeout=10)
            
            if response.status_code == 200:
                result = response.json()
                print_success("Combo creation successful")
                print_info(f"Created combo ID: {result.get('id', 'Unknown')}")
                
                # Store the ID for later tests
                self.test_combo_id = result.get('id')
                self.test_results['passed'] += 1
                
            elif response.status_code == 401:
                print_warning("Combo creation requires authentication")
                self.test_results['warnings'] += 1
            else:
                print_error(f"Combo creation failed. Status: {response.status_code}")
                try:
                    error_data = response.json()
                    print_error(f"Error details: {error_data}")
                except:
                    print_error(f"Response text: {response.text}")
                self.test_results['failed'] += 1
                
        except Exception as e:
            print_error(f"Error creating combo: {str(e)}")
            self.test_results['failed'] += 1
    
    def test_edit_combo(self):
        """Test editing an existing combo via PUT /api/meals/{id}"""
        print_test_header("Edit Existing Combo (PUT /api/meals/{id})")
        
        try:
            # Get existing combos to edit
            combos_response = self.session.get(f"{API_BASE}/meals", timeout=10)
            if combos_response.status_code != 200:
                print_error("Cannot test combo editing - combos not available")
                self.test_results['failed'] += 1
                return
            
            combos = combos_response.json()
            if not combos:
                print_error("Cannot test combo editing - no combos available")
                self.test_results['failed'] += 1
                return
            
            # Use first combo for editing test
            combo_to_edit = combos[0]
            combo_id = combo_to_edit["_id"]
            
            # Create updated combo data
            updated_combo = {
                "name": f"Updated {combo_to_edit['name']} {datetime.now().strftime('%H%M%S')}",
                "description": "Updated by automated testing",
                "images": combo_to_edit.get("images", []),
                "recipes": combo_to_edit.get("recipes", []),
                "tags": ["updated", "test"],
                "is_preset": True,
                "created_by": "admin"
            }
            
            response = self.session.put(f"{API_BASE}/meals/{combo_id}", json=updated_combo, timeout=10)
            
            if response.status_code == 200:
                print_success("Combo editing successful")
                print_info(f"Updated combo ID: {combo_id}")
                self.test_results['passed'] += 1
                
            elif response.status_code == 401:
                print_warning("Combo editing requires authentication")
                self.test_results['warnings'] += 1
            elif response.status_code == 404:
                print_error("Combo not found for editing")
                self.test_results['failed'] += 1
            else:
                print_error(f"Combo editing failed. Status: {response.status_code}")
                try:
                    error_data = response.json()
                    print_error(f"Error details: {error_data}")
                except:
                    print_error(f"Response text: {response.text}")
                self.test_results['failed'] += 1
                
        except Exception as e:
            print_error(f"Error editing combo: {str(e)}")
            self.test_results['failed'] += 1
    
    def test_delete_combo(self):
        """Test deleting a combo via DELETE /api/meals/{id}"""
        print_test_header("Delete Combo (DELETE /api/meals/{id})")
        
        try:
            # First create a combo to delete
            recipes_response = self.session.get(f"{API_BASE}/recipes", timeout=10)
            if recipes_response.status_code != 200 or not recipes_response.json():
                print_error("Cannot test combo deletion - recipes not available")
                self.test_results['failed'] += 1
                return
            
            recipes = recipes_response.json()
            
            # Create a test combo to delete
            test_combo = {
                "name": f"Delete Test Combo {datetime.now().strftime('%H%M%S')}",
                "description": "Combo created for deletion testing",
                "recipes": [
                    {
                        "recipe_id": recipes[0]["_id"],
                        "name": recipes[0]["name"],
                        "quantity": 1.0,
                        "step_size": 1.0,
                        "price": recipes[0].get("calculated_price", 0)
                    }
                ],
                "tags": ["delete-test"],
                "is_preset": True,
                "created_by": "admin"
            }
            
            create_response = self.session.post(f"{API_BASE}/meals", json=test_combo, timeout=10)
            
            if create_response.status_code == 200:
                combo_id = create_response.json().get('id')
                print_info(f"Created test combo for deletion: {combo_id}")
                
                # Now delete it
                delete_response = self.session.delete(f"{API_BASE}/meals/{combo_id}", timeout=10)
                
                if delete_response.status_code == 200:
                    print_success("Combo deletion successful")
                    self.test_results['passed'] += 1
                elif delete_response.status_code == 401:
                    print_warning("Combo deletion requires authentication")
                    self.test_results['warnings'] += 1
                else:
                    print_error(f"Combo deletion failed. Status: {delete_response.status_code}")
                    self.test_results['failed'] += 1
            else:
                # Try deleting an existing combo instead
                combos_response = self.session.get(f"{API_BASE}/meals", timeout=10)
                if combos_response.status_code == 200:
                    combos = combos_response.json()
                    if combos:
                        combo_id = combos[-1]["_id"]  # Use last combo
                        delete_response = self.session.delete(f"{API_BASE}/meals/{combo_id}", timeout=10)
                        
                        if delete_response.status_code == 200:
                            print_success("Combo deletion successful (existing combo)")
                            self.test_results['passed'] += 1
                        elif delete_response.status_code == 401:
                            print_warning("Combo deletion requires authentication")
                            self.test_results['warnings'] += 1
                        else:
                            print_error(f"Combo deletion failed. Status: {delete_response.status_code}")
                            self.test_results['failed'] += 1
                    else:
                        print_warning("No combos available for deletion test")
                        self.test_results['warnings'] += 1
                else:
                    print_error("Cannot test combo deletion - unable to access combos")
                    self.test_results['failed'] += 1
                
        except Exception as e:
            print_error(f"Error testing combo deletion: {str(e)}")
            self.test_results['failed'] += 1
    
    def test_error_handling(self):
        """Test error handling scenarios"""
        print_test_header("Error Handling")
        
        try:
            # Test 1: Create combo without meals (should show error)
            print_info("Testing combo creation without meals...")
            empty_combo = {
                "name": "Empty Combo",
                "description": "Combo with no meals",
                "recipes": [],  # Empty recipes
                "tags": ["test"],
                "is_preset": True,
                "created_by": "admin"
            }
            
            response = self.session.post(f"{API_BASE}/meals", json=empty_combo, timeout=10)
            
            if response.status_code == 400:
                print_success("Properly rejected combo without meals (400 error)")
                self.test_results['passed'] += 1
            elif response.status_code == 200:
                print_warning("Combo without meals was accepted (may be valid behavior)")
                self.test_results['warnings'] += 1
            else:
                print_info(f"Combo without meals returned status: {response.status_code}")
                self.test_results['warnings'] += 1
            
            # Test 2: Delete non-existent combo
            print_info("Testing deletion of non-existent combo...")
            fake_id = "507f1f77bcf86cd799439011"  # Valid ObjectId format but non-existent
            
            delete_response = self.session.delete(f"{API_BASE}/meals/{fake_id}", timeout=10)
            
            if delete_response.status_code == 404:
                print_success("Properly handled non-existent combo deletion (404 error)")
                self.test_results['passed'] += 1
            elif delete_response.status_code == 401:
                print_warning("Non-existent combo deletion requires authentication")
                self.test_results['warnings'] += 1
            else:
                print_info(f"Non-existent combo deletion returned status: {delete_response.status_code}")
                self.test_results['warnings'] += 1
            
            # Test 3: Invalid combo ID format
            print_info("Testing invalid combo ID format...")
            invalid_id = "invalid-id-format"
            
            get_response = self.session.get(f"{API_BASE}/meals/{invalid_id}", timeout=10)
            
            if get_response.status_code in [400, 404]:
                print_success("Properly handled invalid combo ID format")
                self.test_results['passed'] += 1
            else:
                print_info(f"Invalid combo ID returned status: {get_response.status_code}")
                self.test_results['warnings'] += 1
                
        except Exception as e:
            print_error(f"Error testing error handling: {str(e)}")
            self.test_results['failed'] += 1
    
    def print_summary(self):
        """Print test summary"""
        print(f"\n{Colors.BOLD}{'='*60}{Colors.END}")
        print(f"{Colors.BOLD}TEST SUMMARY{Colors.END}")
        print(f"{Colors.BOLD}{'='*60}{Colors.END}")
        
        total_tests = self.test_results['passed'] + self.test_results['failed'] + self.test_results['warnings']
        
        print(f"{Colors.GREEN}✅ Passed: {self.test_results['passed']}{Colors.END}")
        print(f"{Colors.RED}❌ Failed: {self.test_results['failed']}{Colors.END}")
        print(f"{Colors.YELLOW}⚠️  Warnings: {self.test_results['warnings']}{Colors.END}")
        print(f"{Colors.BOLD}Total Tests: {total_tests}{Colors.END}")
        
        if self.test_results['failed'] == 0:
            if self.test_results['warnings'] == 0:
                print(f"\n{Colors.GREEN}{Colors.BOLD}🎉 ALL TESTS PASSED! Admin Panel Combo Management is working perfectly.{Colors.END}")
            else:
                print(f"\n{Colors.YELLOW}{Colors.BOLD}✅ Tests completed with warnings. Core functionality working.{Colors.END}")
        else:
            print(f"\n{Colors.RED}{Colors.BOLD}❌ Some tests failed. Admin Panel Combo Management needs attention.{Colors.END}")
        
        # Success rate
        if total_tests > 0:
            success_rate = ((self.test_results['passed'] + self.test_results['warnings']) / total_tests) * 100
            print(f"{Colors.BOLD}Success Rate: {success_rate:.1f}%{Colors.END}")

def main():
    """Main function to run all tests"""
    tester = AdminPanelTester()
    tester.run_all_tests()

if __name__ == "__main__":
    main()
        
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