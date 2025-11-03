#!/usr/bin/env python3
"""
Backend Testing Script for Admin Panel - Meals & Combos Tab Fixes
Testing the specific fixes mentioned in the review request:
1. Meals not appearing in meals tab - Fixed by changing table ID from recipesBody to mealsBody
2. Error message verification - Need to check if "error loading meals" flashes in combos tab (should say "error loading combos")
"""

import requests
import json
import sys
import time
import re
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
    
    def test_admin_panel_access(self):
        """Test 1: Verify admin panel HTML is accessible"""
        try:
            response = self.session.get(f"{BACKEND_URL}/api/admin-panel")
            
            if response.status_code == 200:
                html_content = response.text
                
                # Check for key elements mentioned in the fix
                required_elements = [
                    'id="mealsBody"',  # Fixed table ID for meals
                    'id="combosBody"', # Table ID for combos
                    'loadMeals()',     # Function to load meals
                    'loadCombos()',    # Function to load combos
                    'Meals Management',
                    'Combos Management'
                ]
                
                missing_elements = []
                for element in required_elements:
                    if element not in html_content:
                        missing_elements.append(element)
                
                if missing_elements:
                    self.log_test("Admin Panel Access", False, 
                                f"Missing elements: {missing_elements}")
                    return False
                else:
                    self.log_test("Admin Panel Access", True, 
                                "Admin panel accessible with all required elements")
                    return True
            else:
                self.log_test("Admin Panel Access", False, 
                            f"HTTP {response.status_code}", response.text[:200])
                return False
                
        except Exception as e:
            self.log_test("Admin Panel Access", False, f"Exception: {str(e)}")
            return False
    
    def test_meals_api_endpoint(self):
        """Test 2: Verify GET /api/recipes endpoint (meals data)"""
        try:
            response = self.session.get(f"{BACKEND_URL}/api/recipes")
            
            if response.status_code == 200:
                meals_data = response.json()
                
                if isinstance(meals_data, list):
                    meal_count = len(meals_data)
                    
                    if meal_count > 0:
                        # Check structure of first meal
                        sample_meal = meals_data[0]
                        required_fields = ['_id', 'name', 'calculated_price']
                        missing_fields = [field for field in required_fields if field not in sample_meal]
                        
                        if missing_fields:
                            self.log_test("Meals API Endpoint", False, 
                                        f"Missing fields in meal data: {missing_fields}")
                            return False
                        else:
                            self.log_test("Meals API Endpoint", True, 
                                        f"Found {meal_count} meals with proper structure")
                            return True
                    else:
                        self.log_test("Meals API Endpoint", True, 
                                    "Meals endpoint accessible (empty data)")
                        return True
                else:
                    self.log_test("Meals API Endpoint", False, 
                                f"Expected list, got {type(meals_data)}")
                    return False
            else:
                self.log_test("Meals API Endpoint", False, 
                            f"HTTP {response.status_code}", response.text[:200])
                return False
                
        except Exception as e:
            self.log_test("Meals API Endpoint", False, f"Exception: {str(e)}")
            return False
    
    def test_combos_api_endpoint(self):
        """Test 3: Verify GET /api/meals endpoint (combos data)"""
        try:
            response = self.session.get(f"{BACKEND_URL}/api/meals")
            
            if response.status_code == 200:
                combos_data = response.json()
                
                if isinstance(combos_data, list):
                    combo_count = len(combos_data)
                    
                    if combo_count > 0:
                        # Check structure of first combo
                        sample_combo = combos_data[0]
                        required_fields = ['_id', 'name', 'calculated_price']
                        missing_fields = [field for field in required_fields if field not in sample_combo]
                        
                        if missing_fields:
                            self.log_test("Combos API Endpoint", False, 
                                        f"Missing fields in combo data: {missing_fields}")
                            return False
                        else:
                            self.log_test("Combos API Endpoint", True, 
                                        f"Found {combo_count} combos with proper structure")
                            return True
                    else:
                        self.log_test("Combos API Endpoint", True, 
                                    "Combos endpoint accessible (empty data)")
                        return True
                else:
                    self.log_test("Combos API Endpoint", False, 
                                f"Expected list, got {type(combos_data)}")
                    return False
            else:
                self.log_test("Combos API Endpoint", False, 
                            f"HTTP {response.status_code}", response.text[:200])
                return False
                
        except Exception as e:
            self.log_test("Combos API Endpoint", False, f"Exception: {str(e)}")
            return False
    
    def test_meals_tab_functionality(self):
        """Test 4: Verify meals tab shows data correctly"""
        try:
            # Get meals data that should appear in meals tab
            meals_response = self.session.get(f"{BACKEND_URL}/api/recipes")
            
            if meals_response.status_code == 200:
                meals_data = meals_response.json()
                
                # Verify admin panel HTML has correct table ID
                admin_response = self.session.get(f"{BACKEND_URL}/api/admin-panel")
                if admin_response.status_code == 200:
                    html_content = admin_response.text
                    
                    # Check that mealsBody table ID exists (the fix)
                    if 'id="mealsBody"' in html_content:
                        # Check that loadMeals function fetches from /recipes
                        if 'fetch(`${API_URL}/recipes`)' in html_content:
                            self.log_test("Meals Tab Functionality", True, 
                                        f"Meals tab correctly configured to show {len(meals_data)} meals from /api/recipes")
                            return True
                        else:
                            self.log_test("Meals Tab Functionality", False, 
                                        "loadMeals function not fetching from /recipes endpoint")
                            return False
                    else:
                        self.log_test("Meals Tab Functionality", False, 
                                    'Table ID "mealsBody" not found (fix not applied)')
                        return False
                else:
                    self.log_test("Meals Tab Functionality", False, 
                                f"Cannot access admin panel: HTTP {admin_response.status_code}")
                    return False
            else:
                self.log_test("Meals Tab Functionality", False, 
                            f"Cannot get meals data: HTTP {meals_response.status_code}")
                return False
                
        except Exception as e:
            self.log_test("Meals Tab Functionality", False, f"Exception: {str(e)}")
            return False
    
    def test_combos_tab_functionality(self):
        """Test 5: Verify combos tab shows data correctly"""
        try:
            # Get combos data that should appear in combos tab
            combos_response = self.session.get(f"{BACKEND_URL}/api/meals")
            
            if combos_response.status_code == 200:
                combos_data = combos_response.json()
                
                # Verify admin panel HTML has correct table ID and error messages
                admin_response = self.session.get(f"{BACKEND_URL}/api/admin-panel")
                if admin_response.status_code == 200:
                    html_content = admin_response.text
                    
                    # Check that combosBody table ID exists
                    if 'id="combosBody"' in html_content:
                        # Check that loadCombos function fetches from /meals
                        if 'fetch(`${API_URL}/meals`)' in html_content:
                            # Check for correct error message in loadCombos function
                            if "Error loading combos" in html_content:
                                self.log_test("Combos Tab Functionality", True, 
                                            f"Combos tab correctly configured with proper error message")
                                return True
                            else:
                                self.log_test("Combos Tab Functionality", False, 
                                            'Error message should say "Error loading combos"')
                                return False
                        else:
                            self.log_test("Combos Tab Functionality", False, 
                                        "loadCombos function not fetching from /meals endpoint")
                            return False
                    else:
                        self.log_test("Combos Tab Functionality", False, 
                                    'Table ID "combosBody" not found')
                        return False
                else:
                    self.log_test("Combos Tab Functionality", False, 
                                f"Cannot access admin panel: HTTP {admin_response.status_code}")
                    return False
            else:
                self.log_test("Combos Tab Functionality", False, 
                            f"Cannot get combos data: HTTP {combos_response.status_code}")
                return False
                
        except Exception as e:
            self.log_test("Combos Tab Functionality", False, f"Exception: {str(e)}")
            return False
    
    def test_error_message_verification(self):
        """Test 6: Verify error messages use correct terminology"""
        try:
            admin_response = self.session.get(f"{BACKEND_URL}/api/admin-panel")
            if admin_response.status_code == 200:
                html_content = admin_response.text
                
                # Look for the specific functions and their error messages
                # Find loadMeals function and check its error message
                meals_func_match = re.search(r'async function loadMeals\(\).*?catch.*?showAlert.*?\'(.*?)\'', 
                                           html_content, re.DOTALL)
                meals_error_correct = False
                if meals_func_match:
                    meals_error_msg = meals_func_match.group(1)
                    meals_error_correct = "meals" in meals_error_msg.lower() and "combos" not in meals_error_msg.lower()
                
                # Find loadCombos function and check its error message
                combos_func_match = re.search(r'async function loadCombos\(\).*?catch.*?showAlert.*?\'(.*?)\'', 
                                            html_content, re.DOTALL)
                combos_error_correct = False
                if combos_func_match:
                    combos_error_msg = combos_func_match.group(1)
                    combos_error_correct = "combos" in combos_error_msg.lower()
                
                if meals_error_correct and combos_error_correct:
                    self.log_test("Error Message Verification", True, 
                                "Both tabs have correct error messages")
                    return True
                elif not combos_error_correct:
                    self.log_test("Error Message Verification", False, 
                                'Combos tab error message incorrect - should say "Error loading combos"')
                    return False
                elif not meals_error_correct:
                    self.log_test("Error Message Verification", False, 
                                'Meals tab error message incorrect - should say "Error loading meals"')
                    return False
                else:
                    self.log_test("Error Message Verification", False, 
                                "Could not find error messages in functions")
                    return False
            else:
                self.log_test("Error Message Verification", False, 
                            f"Cannot access admin panel: HTTP {admin_response.status_code}")
                return False
                
        except Exception as e:
            self.log_test("Error Message Verification", False, f"Exception: {str(e)}")
            return False
    
    def test_cross_tab_navigation(self):
        """Test 7: Verify data loads correctly when switching between tabs"""
        try:
            # Test that both endpoints are accessible and return consistent data
            meals_response1 = self.session.get(f"{BACKEND_URL}/api/recipes")
            combos_response1 = self.session.get(f"{BACKEND_URL}/api/meals")
            
            time.sleep(1)  # Small delay to simulate tab switching
            
            meals_response2 = self.session.get(f"{BACKEND_URL}/api/recipes")
            combos_response2 = self.session.get(f"{BACKEND_URL}/api/meals")
            
            if all(r.status_code == 200 for r in [meals_response1, combos_response1, meals_response2, combos_response2]):
                meals_data1 = meals_response1.json()
                combos_data1 = combos_response1.json()
                meals_data2 = meals_response2.json()
                combos_data2 = combos_response2.json()
                
                # Check data consistency
                meals_consistent = len(meals_data1) == len(meals_data2)
                combos_consistent = len(combos_data1) == len(combos_data2)
                
                if meals_consistent and combos_consistent:
                    self.log_test("Cross-Tab Navigation", True, 
                                f"Data loads consistently - {len(meals_data1)} meals, {len(combos_data1)} combos")
                    return True
                else:
                    self.log_test("Cross-Tab Navigation", False, 
                                f"Data inconsistent - meals: {len(meals_data1)} vs {len(meals_data2)}, combos: {len(combos_data1)} vs {len(combos_data2)}")
                    return False
            else:
                status_codes = [r.status_code for r in [meals_response1, combos_response1, meals_response2, combos_response2]]
                self.log_test("Cross-Tab Navigation", False, 
                            f"API calls failed with status codes: {status_codes}")
                return False
                
        except Exception as e:
            self.log_test("Cross-Tab Navigation", False, f"Exception: {str(e)}")
            return False
    
    def run_all_tests(self):
        """Run all tests and provide summary"""
        print("🔧 ADMIN PANEL - MEALS & COMBOS TAB FIXES TESTING")
        print("=" * 60)
        print(f"Backend URL: {BACKEND_URL}")
        print()
        
        # Run tests in order
        tests = [
            self.test_admin_panel_access,
            self.test_meals_api_endpoint,
            self.test_combos_api_endpoint,
            self.test_meals_tab_functionality,
            self.test_combos_tab_functionality,
            self.test_error_message_verification,
            self.test_cross_tab_navigation
        ]
        
        passed = 0
        total = len(tests)
        
        for test_func in tests:
            if test_func():
                passed += 1
            print()
        
        # Summary
        print("=" * 60)
        print(f"SUMMARY: {passed}/{total} tests passed")
        
        if passed == total:
            print("🎉 ALL TESTS PASSED - Admin panel meals & combos tabs are working correctly!")
            print()
            print("✅ VERIFIED FIXES:")
            print("   - Meals tab uses correct table ID (mealsBody)")
            print("   - Meals tab loads data from GET /api/recipes")
            print("   - Combos tab uses correct table ID (combosBody)")
            print("   - Combos tab loads data from GET /api/meals")
            print("   - Error messages use correct terminology")
            print("   - Cross-tab navigation works properly")
        else:
            print("❌ SOME TESTS FAILED - Issues found with admin panel functionality")
            print()
            print("FAILED TESTS:")
            for result in self.test_results:
                if not result["success"]:
                    print(f"   - {result['test']}: {result['message']}")
        
        return passed == total

def main():
    """Main test execution"""
    tester = AdminPanelTester()
    success = tester.run_all_tests()
    sys.exit(0 if success else 1)

if __name__ == "__main__":
    main()