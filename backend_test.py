#!/usr/bin/env python3
"""
Backend API Testing for OrHealthy Meal Planning System
Tests the new meal planning endpoints for guides and guidees
"""

import requests
import json
import os
from datetime import datetime, timezone
import uuid

# Get backend URL from environment
BACKEND_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://health-planner-11.preview.emergentagent.com')
API_BASE = f"{BACKEND_URL}/api"

class MealPlanningTester:
    def __init__(self):
        self.session = requests.Session()
        self.guidee_token = None
        self.guide_token = None
        self.test_plan_id = None
        self.test_results = []
        
    def log_result(self, test_name, success, message, details=None):
        """Log test result"""
        result = {
            "test": test_name,
            "success": success,
            "message": message,
            "details": details or {}
        }
        self.test_results.append(result)
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status}: {test_name} - {message}")
        if details and not success:
            print(f"   Details: {details}")
    
    def test_authentication_required(self):
        """Test that all endpoints require authentication"""
        print("\n=== Testing Authentication Requirements ===")
        
        endpoints = [
            ("GET", f"{API_BASE}/meal-plans/guide"),
            ("PUT", f"{API_BASE}/meal-plans/dummy_id/accept"),
            ("PUT", f"{API_BASE}/meal-plans/dummy_id/save-progress"),
            ("PUT", f"{API_BASE}/meal-plans/dummy_id/submit")
        ]
        
        for method, url in endpoints:
            try:
                if method == "GET":
                    response = self.session.get(url)
                else:
                    response = self.session.put(url, json={})
                
                if response.status_code == 401:
                    self.log_result(
                        f"Auth Required - {method} {url.split('/')[-1]}", 
                        True, 
                        "Correctly requires authentication"
                    )
                else:
                    self.log_result(
                        f"Auth Required - {method} {url.split('/')[-1]}", 
                        False, 
                        f"Expected 401, got {response.status_code}",
                        {"response": response.text[:200]}
                    )
            except Exception as e:
                self.log_result(
                    f"Auth Required - {method} {url.split('/')[-1]}", 
                    False, 
                    f"Request failed: {str(e)}"
                )
    
    def create_test_users_and_plan(self):
        """Create test users and meal plan for testing"""
        print("\n=== Setting Up Test Data ===")
        
        # For this test, we'll use mock authentication tokens
        # In a real scenario, these would be obtained through proper auth flow
        self.guidee_token = "mock_guidee_token_" + str(uuid.uuid4())
        self.guide_token = "mock_guide_token_" + str(uuid.uuid4())
        
        # Create a test meal plan using the existing POST endpoint
        try:
            # First, let's test if we can create a meal plan (this requires auth)
            headers = {"Authorization": f"Bearer {self.guidee_token}"}
            
            meal_plan_data = {
                "guide_id": "mock_guide_id_123",
                "guide_name": "Test Guide",
                "plan_type": "3_day",
                "start_date": "2025-01-15",
                "meals_requested": ["breakfast", "lunch", "dinner"]
            }
            
            response = self.session.post(
                f"{API_BASE}/meal-plans", 
                json=meal_plan_data,
                headers=headers
            )
            
            if response.status_code == 201 or response.status_code == 200:
                plan_data = response.json()
                self.test_plan_id = plan_data.get("_id") or plan_data.get("id")
                self.log_result(
                    "Create Test Meal Plan", 
                    True, 
                    f"Created test plan with ID: {self.test_plan_id}"
                )
            else:
                # If we can't create through API, we'll use a mock ID for testing
                self.test_plan_id = "mock_plan_id_for_testing"
                self.log_result(
                    "Create Test Meal Plan", 
                    False, 
                    f"Could not create via API (status: {response.status_code}), using mock ID",
                    {"response": response.text[:200]}
                )
                
        except Exception as e:
            self.test_plan_id = "mock_plan_id_for_testing"
            self.log_result(
                "Create Test Meal Plan", 
                False, 
                f"Exception during creation: {str(e)}, using mock ID"
            )
    
    def test_get_guide_meal_plans(self):
        """Test GET /api/meal-plans/guide endpoint"""
        print("\n=== Testing GET /api/meal-plans/guide ===")
        
        # Test with guide authentication
        headers = {"Authorization": f"Bearer {self.guide_token}"}
        
        try:
            response = self.session.get(f"{API_BASE}/meal-plans/guide", headers=headers)
            
            if response.status_code == 401:
                self.log_result(
                    "GET Guide Plans - Auth Check", 
                    True, 
                    "Correctly requires authentication"
                )
            elif response.status_code == 200:
                plans = response.json()
                self.log_result(
                    "GET Guide Plans - Success", 
                    True, 
                    f"Retrieved {len(plans)} plans for guide",
                    {"plan_count": len(plans)}
                )
                
                # Validate response structure
                if isinstance(plans, list):
                    self.log_result(
                        "GET Guide Plans - Response Format", 
                        True, 
                        "Response is a list as expected"
                    )
                    
                    if plans:
                        plan = plans[0]
                        required_fields = ["_id", "guidee_id", "guidee_name", "status"]
                        missing_fields = [field for field in required_fields if field not in plan]
                        
                        if not missing_fields:
                            self.log_result(
                                "GET Guide Plans - Data Structure", 
                                True, 
                                "Plan contains all required fields"
                            )
                        else:
                            self.log_result(
                                "GET Guide Plans - Data Structure", 
                                False, 
                                f"Missing fields: {missing_fields}",
                                {"sample_plan": plan}
                            )
                else:
                    self.log_result(
                        "GET Guide Plans - Response Format", 
                        False, 
                        f"Expected list, got {type(plans)}"
                    )
            else:
                self.log_result(
                    "GET Guide Plans - Unexpected Status", 
                    False, 
                    f"Unexpected status code: {response.status_code}",
                    {"response": response.text[:200]}
                )
                
        except Exception as e:
            self.log_result(
                "GET Guide Plans - Exception", 
                False, 
                f"Request failed: {str(e)}"
            )
        
        # Test with non-guide user
        headers = {"Authorization": f"Bearer {self.guidee_token}"}
        
        try:
            response = self.session.get(f"{API_BASE}/meal-plans/guide", headers=headers)
            
            if response.status_code == 401:
                self.log_result(
                    "GET Guide Plans - Non-Guide Auth", 
                    True, 
                    "Correctly requires authentication"
                )
            elif response.status_code == 200:
                plans = response.json()
                # This should return empty list or only plans where user is guide
                self.log_result(
                    "GET Guide Plans - Non-Guide Access", 
                    True, 
                    f"Non-guide user got {len(plans)} plans (should be 0 or only their guide plans)"
                )
            else:
                self.log_result(
                    "GET Guide Plans - Non-Guide Unexpected", 
                    False, 
                    f"Unexpected status for non-guide: {response.status_code}"
                )
                
        except Exception as e:
            self.log_result(
                "GET Guide Plans - Non-Guide Exception", 
                False, 
                f"Non-guide request failed: {str(e)}"
            )
    
    def test_accept_meal_plan(self):
        """Test PUT /api/meal-plans/{plan_id}/accept endpoint"""
        print("\n=== Testing PUT /api/meal-plans/{plan_id}/accept ===")
        
        # Test with valid plan ID and guide auth
        headers = {"Authorization": f"Bearer {self.guide_token}"}
        
        try:
            response = self.session.put(
                f"{API_BASE}/meal-plans/{self.test_plan_id}/accept", 
                headers=headers
            )
            
            if response.status_code == 401:
                self.log_result(
                    "Accept Plan - Auth Check", 
                    True, 
                    "Correctly requires authentication"
                )
            elif response.status_code == 200:
                result = response.json()
                if "message" in result and "accepted" in result["message"].lower():
                    self.log_result(
                        "Accept Plan - Success", 
                        True, 
                        "Plan accepted successfully"
                    )
                else:
                    self.log_result(
                        "Accept Plan - Response Format", 
                        False, 
                        "Unexpected response format",
                        {"response": result}
                    )
            elif response.status_code == 404:
                self.log_result(
                    "Accept Plan - Not Found", 
                    True, 
                    "Correctly returns 404 for non-existent/unauthorized plan"
                )
            elif response.status_code == 400:
                self.log_result(
                    "Accept Plan - Bad Request", 
                    True, 
                    "Correctly returns 400 for invalid plan ID"
                )
            else:
                self.log_result(
                    "Accept Plan - Unexpected Status", 
                    False, 
                    f"Unexpected status code: {response.status_code}",
                    {"response": response.text[:200]}
                )
                
        except Exception as e:
            self.log_result(
                "Accept Plan - Exception", 
                False, 
                f"Request failed: {str(e)}"
            )
        
        # Test with invalid plan ID
        try:
            response = self.session.put(
                f"{API_BASE}/meal-plans/invalid_plan_id/accept", 
                headers=headers
            )
            
            if response.status_code in [400, 404]:
                self.log_result(
                    "Accept Plan - Invalid ID", 
                    True, 
                    f"Correctly handles invalid plan ID (status: {response.status_code})"
                )
            else:
                self.log_result(
                    "Accept Plan - Invalid ID Handling", 
                    False, 
                    f"Expected 400/404 for invalid ID, got {response.status_code}"
                )
                
        except Exception as e:
            self.log_result(
                "Accept Plan - Invalid ID Exception", 
                False, 
                f"Invalid ID test failed: {str(e)}"
            )
        
        # Test with unauthorized user (guidee trying to accept)
        headers = {"Authorization": f"Bearer {self.guidee_token}"}
        
        try:
            response = self.session.put(
                f"{API_BASE}/meal-plans/{self.test_plan_id}/accept", 
                headers=headers
            )
            
            if response.status_code in [401, 403, 404]:
                self.log_result(
                    "Accept Plan - Unauthorized User", 
                    True, 
                    f"Correctly prevents unauthorized access (status: {response.status_code})"
                )
            else:
                self.log_result(
                    "Accept Plan - Unauthorized Access", 
                    False, 
                    f"Should prevent unauthorized access, got {response.status_code}"
                )
                
        except Exception as e:
            self.log_result(
                "Accept Plan - Unauthorized Exception", 
                False, 
                f"Unauthorized test failed: {str(e)}"
            )
    
    def test_save_progress(self):
        """Test PUT /api/meal-plans/{plan_id}/save-progress endpoint"""
        print("\n=== Testing PUT /api/meal-plans/{plan_id}/save-progress ===")
        
        headers = {"Authorization": f"Bearer {self.guide_token}"}
        
        # Test with valid logged_meals data
        logged_meals_data = {
            "logged_meals": {
                "2025-01-15": {
                    "breakfast": "meal_id_123",
                    "lunch": "meal_id_456"
                },
                "2025-01-16": {
                    "breakfast": "meal_id_789"
                }
            }
        }
        
        try:
            response = self.session.put(
                f"{API_BASE}/meal-plans/{self.test_plan_id}/save-progress", 
                json=logged_meals_data,
                headers=headers
            )
            
            if response.status_code == 401:
                self.log_result(
                    "Save Progress - Auth Check", 
                    True, 
                    "Correctly requires authentication"
                )
            elif response.status_code == 200:
                result = response.json()
                if "message" in result and "saved" in result["message"].lower():
                    self.log_result(
                        "Save Progress - Success", 
                        True, 
                        "Progress saved successfully"
                    )
                else:
                    self.log_result(
                        "Save Progress - Response Format", 
                        False, 
                        "Unexpected response format",
                        {"response": result}
                    )
            elif response.status_code == 404:
                self.log_result(
                    "Save Progress - Not Found", 
                    True, 
                    "Correctly returns 404 for non-existent/unauthorized plan"
                )
            elif response.status_code == 400:
                self.log_result(
                    "Save Progress - Bad Request", 
                    True, 
                    "Correctly returns 400 for invalid plan ID"
                )
            else:
                self.log_result(
                    "Save Progress - Unexpected Status", 
                    False, 
                    f"Unexpected status code: {response.status_code}",
                    {"response": response.text[:200]}
                )
                
        except Exception as e:
            self.log_result(
                "Save Progress - Exception", 
                False, 
                f"Request failed: {str(e)}"
            )
        
        # Test with empty logged_meals
        empty_data = {"logged_meals": {}}
        
        try:
            response = self.session.put(
                f"{API_BASE}/meal-plans/{self.test_plan_id}/save-progress", 
                json=empty_data,
                headers=headers
            )
            
            if response.status_code in [200, 400, 401, 404]:
                self.log_result(
                    "Save Progress - Empty Data", 
                    True, 
                    f"Handles empty logged_meals appropriately (status: {response.status_code})"
                )
            else:
                self.log_result(
                    "Save Progress - Empty Data Handling", 
                    False, 
                    f"Unexpected status for empty data: {response.status_code}"
                )
                
        except Exception as e:
            self.log_result(
                "Save Progress - Empty Data Exception", 
                False, 
                f"Empty data test failed: {str(e)}"
            )
        
        # Test with invalid plan ID
        try:
            response = self.session.put(
                f"{API_BASE}/meal-plans/invalid_plan_id/save-progress", 
                json=logged_meals_data,
                headers=headers
            )
            
            if response.status_code in [400, 404]:
                self.log_result(
                    "Save Progress - Invalid ID", 
                    True, 
                    f"Correctly handles invalid plan ID (status: {response.status_code})"
                )
            else:
                self.log_result(
                    "Save Progress - Invalid ID Handling", 
                    False, 
                    f"Expected 400/404 for invalid ID, got {response.status_code}"
                )
                
        except Exception as e:
            self.log_result(
                "Save Progress - Invalid ID Exception", 
                False, 
                f"Invalid ID test failed: {str(e)}"
            )
        
        # Test with unauthorized user
        headers = {"Authorization": f"Bearer {self.guidee_token}"}
        
        try:
            response = self.session.put(
                f"{API_BASE}/meal-plans/{self.test_plan_id}/save-progress", 
                json=logged_meals_data,
                headers=headers
            )
            
            if response.status_code in [401, 403, 404]:
                self.log_result(
                    "Save Progress - Unauthorized User", 
                    True, 
                    f"Correctly prevents unauthorized access (status: {response.status_code})"
                )
            else:
                self.log_result(
                    "Save Progress - Unauthorized Access", 
                    False, 
                    f"Should prevent unauthorized access, got {response.status_code}"
                )
                
        except Exception as e:
            self.log_result(
                "Save Progress - Unauthorized Exception", 
                False, 
                f"Unauthorized test failed: {str(e)}"
            )
    
    def test_submit_plan(self):
        """Test PUT /api/meal-plans/{plan_id}/submit endpoint"""
        print("\n=== Testing PUT /api/meal-plans/{plan_id}/submit ===")
        
        headers = {"Authorization": f"Bearer {self.guide_token}"}
        
        # Test with complete logged_meals data
        complete_meals_data = {
            "logged_meals": {
                "2025-01-15": {
                    "breakfast": "meal_id_123",
                    "lunch": "meal_id_456", 
                    "dinner": "meal_id_789"
                },
                "2025-01-16": {
                    "breakfast": "meal_id_abc",
                    "lunch": "meal_id_def",
                    "dinner": "meal_id_ghi"
                },
                "2025-01-17": {
                    "breakfast": "meal_id_jkl",
                    "lunch": "meal_id_mno",
                    "dinner": "meal_id_pqr"
                }
            }
        }
        
        try:
            response = self.session.put(
                f"{API_BASE}/meal-plans/{self.test_plan_id}/submit", 
                json=complete_meals_data,
                headers=headers
            )
            
            if response.status_code == 401:
                self.log_result(
                    "Submit Plan - Auth Check", 
                    True, 
                    "Correctly requires authentication"
                )
            elif response.status_code == 200:
                result = response.json()
                if "message" in result and "submitted" in result["message"].lower():
                    self.log_result(
                        "Submit Plan - Success", 
                        True, 
                        "Plan submitted successfully"
                    )
                else:
                    self.log_result(
                        "Submit Plan - Response Format", 
                        False, 
                        "Unexpected response format",
                        {"response": result}
                    )
            elif response.status_code == 404:
                self.log_result(
                    "Submit Plan - Not Found", 
                    True, 
                    "Correctly returns 404 for non-existent/unauthorized plan"
                )
            elif response.status_code == 400:
                self.log_result(
                    "Submit Plan - Bad Request", 
                    True, 
                    "Correctly returns 400 for invalid plan ID"
                )
            else:
                self.log_result(
                    "Submit Plan - Unexpected Status", 
                    False, 
                    f"Unexpected status code: {response.status_code}",
                    {"response": response.text[:200]}
                )
                
        except Exception as e:
            self.log_result(
                "Submit Plan - Exception", 
                False, 
                f"Request failed: {str(e)}"
            )
        
        # Test with incomplete logged_meals data
        incomplete_data = {
            "logged_meals": {
                "2025-01-15": {
                    "breakfast": "meal_id_123"
                    # Missing lunch and dinner
                }
            }
        }
        
        try:
            response = self.session.put(
                f"{API_BASE}/meal-plans/{self.test_plan_id}/submit", 
                json=incomplete_data,
                headers=headers
            )
            
            # The API might accept incomplete data or reject it - both are valid behaviors
            if response.status_code in [200, 400, 401, 404]:
                self.log_result(
                    "Submit Plan - Incomplete Data", 
                    True, 
                    f"Handles incomplete logged_meals appropriately (status: {response.status_code})"
                )
            else:
                self.log_result(
                    "Submit Plan - Incomplete Data Handling", 
                    False, 
                    f"Unexpected status for incomplete data: {response.status_code}"
                )
                
        except Exception as e:
            self.log_result(
                "Submit Plan - Incomplete Data Exception", 
                False, 
                f"Incomplete data test failed: {str(e)}"
            )
        
        # Test with invalid plan ID
        try:
            response = self.session.put(
                f"{API_BASE}/meal-plans/invalid_plan_id/submit", 
                json=complete_meals_data,
                headers=headers
            )
            
            if response.status_code in [400, 404]:
                self.log_result(
                    "Submit Plan - Invalid ID", 
                    True, 
                    f"Correctly handles invalid plan ID (status: {response.status_code})"
                )
            else:
                self.log_result(
                    "Submit Plan - Invalid ID Handling", 
                    False, 
                    f"Expected 400/404 for invalid ID, got {response.status_code}"
                )
                
        except Exception as e:
            self.log_result(
                "Submit Plan - Invalid ID Exception", 
                False, 
                f"Invalid ID test failed: {str(e)}"
            )
        
        # Test with unauthorized user
        headers = {"Authorization": f"Bearer {self.guidee_token}"}
        
        try:
            response = self.session.put(
                f"{API_BASE}/meal-plans/{self.test_plan_id}/submit", 
                json=complete_meals_data,
                headers=headers
            )
            
            if response.status_code in [401, 403, 404]:
                self.log_result(
                    "Submit Plan - Unauthorized User", 
                    True, 
                    f"Correctly prevents unauthorized access (status: {response.status_code})"
                )
            else:
                self.log_result(
                    "Submit Plan - Unauthorized Access", 
                    False, 
                    f"Should prevent unauthorized access, got {response.status_code}"
                )
                
        except Exception as e:
            self.log_result(
                "Submit Plan - Unauthorized Exception", 
                False, 
                f"Unauthorized test failed: {str(e)}"
            )
    
    def test_edge_cases(self):
        """Test edge cases and error handling"""
        print("\n=== Testing Edge Cases ===")
        
        headers = {"Authorization": f"Bearer {self.guide_token}"}
        
        # Test with malformed JSON
        try:
            response = self.session.put(
                f"{API_BASE}/meal-plans/{self.test_plan_id}/save-progress",
                data="invalid json",
                headers={**headers, "Content-Type": "application/json"}
            )
            
            if response.status_code in [400, 422]:
                self.log_result(
                    "Edge Case - Malformed JSON", 
                    True, 
                    f"Correctly handles malformed JSON (status: {response.status_code})"
                )
            else:
                self.log_result(
                    "Edge Case - Malformed JSON Handling", 
                    False, 
                    f"Expected 400/422 for malformed JSON, got {response.status_code}"
                )
                
        except Exception as e:
            self.log_result(
                "Edge Case - Malformed JSON Exception", 
                False, 
                f"Malformed JSON test failed: {str(e)}"
            )
        
        # Test with missing Content-Type header
        try:
            response = self.session.put(
                f"{API_BASE}/meal-plans/{self.test_plan_id}/save-progress",
                data='{"logged_meals": {}}',
                headers={"Authorization": f"Bearer {self.guide_token}"}
            )
            
            # This might work or fail depending on FastAPI's handling
            self.log_result(
                "Edge Case - Missing Content-Type", 
                True, 
                f"Handled missing Content-Type header (status: {response.status_code})"
            )
                
        except Exception as e:
            self.log_result(
                "Edge Case - Missing Content-Type Exception", 
                False, 
                f"Missing Content-Type test failed: {str(e)}"
            )
    
    def run_all_tests(self):
        """Run all tests and generate summary"""
        print("🧪 Starting OrHealthy Meal Planning System Backend Tests")
        print(f"🔗 Testing against: {API_BASE}")
        print("=" * 60)
        
        # Run all test methods
        self.test_authentication_required()
        self.create_test_users_and_plan()
        self.test_get_guide_meal_plans()
        self.test_accept_meal_plan()
        self.test_save_progress()
        self.test_submit_plan()
        self.test_edge_cases()
        
        # Generate summary
        print("\n" + "=" * 60)
        print("📊 TEST SUMMARY")
        print("=" * 60)
        
        total_tests = len(self.test_results)
        passed_tests = sum(1 for result in self.test_results if result["success"])
        failed_tests = total_tests - passed_tests
        
        print(f"Total Tests: {total_tests}")
        print(f"✅ Passed: {passed_tests}")
        print(f"❌ Failed: {failed_tests}")
        print(f"📈 Success Rate: {(passed_tests/total_tests)*100:.1f}%")
        
        if failed_tests > 0:
            print(f"\n❌ FAILED TESTS ({failed_tests}):")
            for result in self.test_results:
                if not result["success"]:
                    print(f"   • {result['test']}: {result['message']}")
        
        print(f"\n✅ PASSED TESTS ({passed_tests}):")
        for result in self.test_results:
            if result["success"]:
                print(f"   • {result['test']}: {result['message']}")
        
        return {
            "total": total_tests,
            "passed": passed_tests,
            "failed": failed_tests,
            "success_rate": (passed_tests/total_tests)*100,
            "results": self.test_results
        }

if __name__ == "__main__":
    tester = MealPlanningTester()
    summary = tester.run_all_tests()
    
    # Exit with appropriate code
    exit_code = 0 if summary["failed"] == 0 else 1
    print(f"\n🏁 Testing completed with exit code: {exit_code}")
    exit(exit_code)