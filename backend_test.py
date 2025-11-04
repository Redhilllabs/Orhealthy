#!/usr/bin/env python3
"""
Backend API Testing for OrHealthy App - Delete Functionality
Testing DELETE /api/habits/{habit_id} and DELETE /api/meal-plans/{plan_id}
"""

import requests
import json
import sys
from datetime import datetime, timezone

# Backend URL from frontend environment
BACKEND_URL = "https://health-planner-11.preview.emergentagent.com/api"

class BackendTester:
    def __init__(self):
        self.session = requests.Session()
        self.auth_token = None
        self.test_results = []
        
    def log_test(self, test_name, success, details=""):
        """Log test results"""
        status = "✅ PASS" if success else "❌ FAIL"
        self.test_results.append({
            "test": test_name,
            "success": success,
            "details": details,
            "timestamp": datetime.now().isoformat()
        })
        print(f"{status}: {test_name}")
        if details:
            print(f"   Details: {details}")
    
    def authenticate_user(self):
        """Create a test user session for authentication"""
        try:
            # For testing purposes, we'll use a mock authentication
            # In real scenario, this would go through Google OAuth
            test_user_data = {
                "email": "testuser@example.com",
                "name": "Test User",
                "google_id": "test_google_id_123"
            }
            
            # Create a session token for testing
            self.auth_token = "test_session_token_for_delete_testing"
            
            # Set authorization header
            self.session.headers.update({
                "Authorization": f"Bearer {self.auth_token}",
                "Content-Type": "application/json"
            })
            
            self.log_test("Authentication Setup", True, "Mock authentication configured")
            return True
            
        except Exception as e:
            self.log_test("Authentication Setup", False, f"Error: {str(e)}")
            return False
    
    def create_test_habit(self):
        """Create a test habit for deletion testing"""
        try:
            habit_data = {
                "activity_name": "Test Morning Workout",
                "activity_type": "exercise",
                "duration": 30,
                "calories_burned": 200,
                "notes": "Test habit for deletion testing"
            }
            
            response = self.session.post(f"{BACKEND_URL}/habits", json=habit_data)
            
            if response.status_code == 201:
                result = response.json()
                habit_id = result.get("id")
                self.log_test("Create Test Habit", True, f"Created habit with ID: {habit_id}")
                return habit_id
            else:
                self.log_test("Create Test Habit", False, f"Status: {response.status_code}, Response: {response.text}")
                return None
                
        except Exception as e:
            self.log_test("Create Test Habit", False, f"Error: {str(e)}")
            return None
    
    def create_test_meal_plan(self):
        """Create a test meal plan for deletion testing"""
        try:
            plan_data = {
                "plan_type": "single_meal",
                "start_date": "2025-01-01",
                "meals_requested": ["breakfast"],
                "status": "requested"
            }
            
            response = self.session.post(f"{BACKEND_URL}/meal-plans", json=plan_data)
            
            if response.status_code == 201:
                result = response.json()
                plan_id = result.get("id")
                self.log_test("Create Test Meal Plan", True, f"Created plan with ID: {plan_id}")
                return plan_id
            else:
                self.log_test("Create Test Meal Plan", False, f"Status: {response.status_code}, Response: {response.text}")
                return None
                
        except Exception as e:
            self.log_test("Create Test Meal Plan", False, f"Error: {str(e)}")
            return None
    
    def test_delete_habit_valid_id(self, habit_id):
        """Test DELETE /api/habits/{habit_id} with valid ID"""
        try:
            response = self.session.delete(f"{BACKEND_URL}/habits/{habit_id}")
            
            if response.status_code == 200:
                result = response.json()
                expected_message = "Habit deleted successfully"
                if result.get("message") == expected_message:
                    self.log_test("Delete Habit - Valid ID", True, f"Message: {result.get('message')}")
                    return True
                else:
                    self.log_test("Delete Habit - Valid ID", False, f"Unexpected message: {result.get('message')}")
                    return False
            else:
                self.log_test("Delete Habit - Valid ID", False, f"Status: {response.status_code}, Response: {response.text}")
                return False
                
        except Exception as e:
            self.log_test("Delete Habit - Valid ID", False, f"Error: {str(e)}")
            return False
    
    def test_delete_habit_invalid_id(self):
        """Test DELETE /api/habits/{habit_id} with invalid ID"""
        try:
            invalid_id = "invalid_habit_id_123"
            response = self.session.delete(f"{BACKEND_URL}/habits/{invalid_id}")
            
            if response.status_code == 400:
                result = response.json()
                expected_message = "Invalid habit ID"
                if result.get("detail") == expected_message:
                    self.log_test("Delete Habit - Invalid ID", True, f"Correct 400 error: {result.get('detail')}")
                    return True
                else:
                    self.log_test("Delete Habit - Invalid ID", False, f"Unexpected error message: {result.get('detail')}")
                    return False
            else:
                self.log_test("Delete Habit - Invalid ID", False, f"Expected 400, got {response.status_code}: {response.text}")
                return False
                
        except Exception as e:
            self.log_test("Delete Habit - Invalid ID", False, f"Error: {str(e)}")
            return False
    
    def test_delete_habit_nonexistent_id(self):
        """Test DELETE /api/habits/{habit_id} with non-existent but valid ObjectId"""
        try:
            # Valid ObjectId format but non-existent
            nonexistent_id = "507f1f77bcf86cd799439011"
            response = self.session.delete(f"{BACKEND_URL}/habits/{nonexistent_id}")
            
            if response.status_code == 404:
                result = response.json()
                expected_message = "Habit not found or already deleted"
                if result.get("detail") == expected_message:
                    self.log_test("Delete Habit - Non-existent ID", True, f"Correct 404 error: {result.get('detail')}")
                    return True
                else:
                    self.log_test("Delete Habit - Non-existent ID", False, f"Unexpected error message: {result.get('detail')}")
                    return False
            else:
                self.log_test("Delete Habit - Non-existent ID", False, f"Expected 404, got {response.status_code}: {response.text}")
                return False
                
        except Exception as e:
            self.log_test("Delete Habit - Non-existent ID", False, f"Error: {str(e)}")
            return False
    
    def test_delete_meal_plan_valid_id(self, plan_id):
        """Test DELETE /api/meal-plans/{plan_id} with valid ID"""
        try:
            response = self.session.delete(f"{BACKEND_URL}/meal-plans/{plan_id}")
            
            if response.status_code == 200:
                result = response.json()
                expected_message = "Plan deleted successfully"
                if result.get("message") == expected_message:
                    self.log_test("Delete Meal Plan - Valid ID", True, f"Message: {result.get('message')}")
                    return True
                else:
                    self.log_test("Delete Meal Plan - Valid ID", False, f"Unexpected message: {result.get('message')}")
                    return False
            else:
                self.log_test("Delete Meal Plan - Valid ID", False, f"Status: {response.status_code}, Response: {response.text}")
                return False
                
        except Exception as e:
            self.log_test("Delete Meal Plan - Valid ID", False, f"Error: {str(e)}")
            return False
    
    def test_delete_meal_plan_invalid_id(self):
        """Test DELETE /api/meal-plans/{plan_id} with invalid ID"""
        try:
            invalid_id = "invalid_plan_id_123"
            response = self.session.delete(f"{BACKEND_URL}/meal-plans/{invalid_id}")
            
            if response.status_code == 400:
                result = response.json()
                expected_message = "Invalid plan ID"
                if result.get("detail") == expected_message:
                    self.log_test("Delete Meal Plan - Invalid ID", True, f"Correct 400 error: {result.get('detail')}")
                    return True
                else:
                    self.log_test("Delete Meal Plan - Invalid ID", False, f"Unexpected error message: {result.get('detail')}")
                    return False
            else:
                self.log_test("Delete Meal Plan - Invalid ID", False, f"Expected 400, got {response.status_code}: {response.text}")
                return False
                
        except Exception as e:
            self.log_test("Delete Meal Plan - Invalid ID", False, f"Error: {str(e)}")
            return False
    
    def test_delete_meal_plan_nonexistent_id(self):
        """Test DELETE /api/meal-plans/{plan_id} with non-existent but valid ObjectId"""
        try:
            # Valid ObjectId format but non-existent
            nonexistent_id = "507f1f77bcf86cd799439011"
            response = self.session.delete(f"{BACKEND_URL}/meal-plans/{nonexistent_id}")
            
            if response.status_code == 404:
                result = response.json()
                expected_message = "Plan not found or unauthorized"
                if result.get("detail") == expected_message:
                    self.log_test("Delete Meal Plan - Non-existent ID", True, f"Correct 404 error: {result.get('detail')}")
                    return True
                else:
                    self.log_test("Delete Meal Plan - Non-existent ID", False, f"Unexpected error message: {result.get('detail')}")
                    return False
            else:
                self.log_test("Delete Meal Plan - Non-existent ID", False, f"Expected 404, got {response.status_code}: {response.text}")
                return False
                
        except Exception as e:
            self.log_test("Delete Meal Plan - Non-existent ID", False, f"Error: {str(e)}")
            return False
    
    def test_unauthenticated_requests(self):
        """Test delete endpoints without authentication"""
        try:
            # Remove auth header temporarily
            original_headers = self.session.headers.copy()
            if 'Authorization' in self.session.headers:
                del self.session.headers['Authorization']
            
            # Test habit deletion without auth
            response = self.session.delete(f"{BACKEND_URL}/habits/507f1f77bcf86cd799439011")
            habit_auth_test = response.status_code == 401
            
            # Test meal plan deletion without auth
            response = self.session.delete(f"{BACKEND_URL}/meal-plans/507f1f77bcf86cd799439011")
            plan_auth_test = response.status_code == 401
            
            # Restore headers
            self.session.headers.update(original_headers)
            
            if habit_auth_test and plan_auth_test:
                self.log_test("Unauthenticated Requests", True, "Both endpoints correctly return 401")
                return True
            else:
                self.log_test("Unauthenticated Requests", False, f"Habit auth: {habit_auth_test}, Plan auth: {plan_auth_test}")
                return False
                
        except Exception as e:
            self.log_test("Unauthenticated Requests", False, f"Error: {str(e)}")
            return False
    
    def run_all_tests(self):
        """Run all delete functionality tests"""
        print("🧪 Starting OrHealthy Delete Functionality Tests")
        print("=" * 60)
        
        # Setup authentication
        if not self.authenticate_user():
            print("❌ Authentication failed, cannot proceed with tests")
            return False
        
        # Test unauthenticated requests first
        self.test_unauthenticated_requests()
        
        # Create test data
        habit_id = self.create_test_habit()
        plan_id = self.create_test_meal_plan()
        
        # Test habit deletion scenarios
        print("\n🔹 Testing Habit Deletion Scenarios:")
        if habit_id:
            self.test_delete_habit_valid_id(habit_id)
        
        self.test_delete_habit_invalid_id()
        self.test_delete_habit_nonexistent_id()
        
        # Test meal plan deletion scenarios
        print("\n🔹 Testing Meal Plan Deletion Scenarios:")
        if plan_id:
            self.test_delete_meal_plan_valid_id(plan_id)
        
        self.test_delete_meal_plan_invalid_id()
        self.test_delete_meal_plan_nonexistent_id()
        
        # Print summary
        self.print_summary()
        
        return True
    
    def print_summary(self):
        """Print test summary"""
        print("\n" + "=" * 60)
        print("📊 TEST SUMMARY")
        print("=" * 60)
        
        total_tests = len(self.test_results)
        passed_tests = sum(1 for result in self.test_results if result["success"])
        failed_tests = total_tests - passed_tests
        
        print(f"Total Tests: {total_tests}")
        print(f"✅ Passed: {passed_tests}")
        print(f"❌ Failed: {failed_tests}")
        print(f"Success Rate: {(passed_tests/total_tests)*100:.1f}%")
        
        if failed_tests > 0:
            print("\n🔍 FAILED TESTS:")
            for result in self.test_results:
                if not result["success"]:
                    print(f"   ❌ {result['test']}: {result['details']}")
        
        print("\n" + "=" * 60)

def main():
    """Main test execution"""
    tester = AdminPanelTester()
    success = tester.run_all_tests()
    sys.exit(0 if success else 1)

if __name__ == "__main__":
    main()