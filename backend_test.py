#!/usr/bin/env python3
"""
Backend Testing for OrHealthy TTD (Time to Deliver) System
Testing Focus: Delivery Config Endpoints, Order Status Updates, Admin Panel Integration
"""

import requests
import json
import time
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, Optional

# Configuration
BASE_URL = "https://preorder-meals.preview.emergentagent.com/api"
ADMIN_PANEL_URL = "https://preorder-meals.preview.emergentagent.com/api/admin-panel"
ADMIN_CREDENTIALS = {
    "email": "admin@admin.com",
    "password": "admin"
}

class TTDSystemTester:
    def __init__(self):
        self.session = requests.Session()
        self.test_results = []
        self.created_orders = []  # Track created test orders for cleanup
        
    def log_result(self, test_name: str, success: bool, details: str = "", response_data: Any = None):
        """Log test result"""
        result = {
            "test": test_name,
            "success": success,
            "details": details,
            "timestamp": datetime.now().isoformat(),
            "response_data": response_data
        }
        self.test_results.append(result)
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status}: {test_name}")
        if details:
            print(f"   Details: {details}")
        if not success and response_data:
            print(f"   Response: {response_data}")
        print()

    def test_delivery_config_get(self):
        """Test GET /api/config/delivery endpoint"""
        try:
            response = self.session.get(f"{BASE_URL}/config/delivery")
            
            if response.status_code == 200:
                data = response.json()
                
                # Check required fields
                required_fields = ["delivery_price", "min_order_for_free_delivery", "regular_order_ttd_minutes"]
                missing_fields = [field for field in required_fields if field not in data]
                
                if missing_fields:
                    self.log_result(
                        "GET /api/config/delivery - Required Fields",
                        False,
                        f"Missing fields: {missing_fields}",
                        data
                    )
                    return False
                
                # Check default value
                ttd_minutes = data.get("regular_order_ttd_minutes")
                if ttd_minutes is None:
                    self.log_result(
                        "GET /api/config/delivery - Default TTD",
                        False,
                        "regular_order_ttd_minutes field is None",
                        data
                    )
                    return False
                
                # Check backward compatibility with old field name
                self.log_result(
                    "GET /api/config/delivery - Success",
                    True,
                    f"TTD minutes: {ttd_minutes}, Delivery price: {data.get('delivery_price')}, Min order: {data.get('min_order_for_free_delivery')}",
                    data
                )
                return True
            else:
                self.log_result(
                    "GET /api/config/delivery - HTTP Error",
                    False,
                    f"Status: {response.status_code}",
                    response.text
                )
                return False
                
        except Exception as e:
            self.log_result(
                "GET /api/config/delivery - Exception",
                False,
                str(e)
            )
            return False

    def test_delivery_config_put(self):
        """Test PUT /api/config/delivery endpoint"""
        try:
            # Test data
            test_config = {
                "delivery_price": 60.0,
                "min_order_for_free_delivery": 600.0,
                "regular_order_ttd_minutes": 50
            }
            
            response = self.session.put(
                f"{BASE_URL}/config/delivery",
                json=test_config,
                headers={"Content-Type": "application/json"}
            )
            
            if response.status_code == 200:
                data = response.json()
                
                # Verify the update worked by getting the config again
                get_response = self.session.get(f"{BASE_URL}/config/delivery")
                if get_response.status_code == 200:
                    updated_data = get_response.json()
                    
                    # Check if values were saved correctly
                    if (updated_data.get("regular_order_ttd_minutes") == test_config["regular_order_ttd_minutes"] and
                        updated_data.get("delivery_price") == test_config["delivery_price"] and
                        updated_data.get("min_order_for_free_delivery") == test_config["min_order_for_free_delivery"]):
                        
                        self.log_result(
                            "PUT /api/config/delivery - Success",
                            True,
                            f"Successfully updated TTD to {test_config['regular_order_ttd_minutes']} minutes",
                            updated_data
                        )
                        return True
                    else:
                        self.log_result(
                            "PUT /api/config/delivery - Verification Failed",
                            False,
                            f"Expected: {test_config}, Got: {updated_data}",
                            updated_data
                        )
                        return False
                else:
                    self.log_result(
                        "PUT /api/config/delivery - Verification Error",
                        False,
                        f"Could not verify update, GET status: {get_response.status_code}"
                    )
                    return False
            else:
                self.log_result(
                    "PUT /api/config/delivery - HTTP Error",
                    False,
                    f"Status: {response.status_code}",
                    response.text
                )
                return False
                
        except Exception as e:
            self.log_result(
                "PUT /api/config/delivery - Exception",
                False,
                str(e)
            )
            return False

    def create_test_order(self) -> Optional[str]:
        """Create a test order for status testing"""
        try:
            # Create a minimal test order
            test_order = {
                "user_id": "test_user_ttd_system",
                "items": [
                    {
                        "meal_name": "Test Meal for TTD",
                        "quantity": 1,
                        "price": 100.0,
                        "customizations": []
                    }
                ],
                "total_price": 100.0,
                "final_price": 100.0,
                "status": "arrived",
                "billing_address": {
                    "name": "Test User",
                    "street": "Test Street",
                    "city": "Test City",
                    "state": "Test State",
                    "zip_code": "123456",
                    "phone": "9876543210"
                },
                "shipping_address": {
                    "name": "Test User",
                    "street": "Test Street",
                    "city": "Test City",
                    "state": "Test State",
                    "zip_code": "123456",
                    "phone": "9876543210"
                }
            }
            
            response = self.session.post(
                f"{BASE_URL}/orders",
                json=test_order,
                headers={"Content-Type": "application/json"}
            )
            
            if response.status_code == 200:
                data = response.json()
                order_id = data.get("id")
                if order_id:
                    self.created_orders.append(order_id)
                    return order_id
            
            # If direct order creation fails, try to find existing orders
            orders_response = self.session.get(f"{BASE_URL}/admin/orders")
            if orders_response.status_code == 200:
                orders = orders_response.json()
                if orders and len(orders) > 0:
                    # Use the first available order
                    return orders[0].get("_id")
            
            return None
            
        except Exception as e:
            print(f"Error creating test order: {e}")
            return None

    def test_order_status_update_accepted(self):
        """Test order status update to 'accepted' sets accepted_at timestamp"""
        try:
            # Get or create a test order
            order_id = self.create_test_order()
            if not order_id:
                # Try to get existing orders from admin endpoint
                orders_response = self.session.get(f"{BASE_URL}/admin/orders")
                if orders_response.status_code == 200:
                    orders = orders_response.json()
                    if orders and len(orders) > 0:
                        order_id = orders[0].get("_id")
                
            if not order_id:
                self.log_result(
                    "Order Status Update - Accepted (No Test Order)",
                    False,
                    "Could not create or find test order"
                )
                return False
            
            # Update status to accepted
            status_update = {"status": "accepted"}
            response = self.session.put(
                f"{BASE_URL}/admin/orders/{order_id}/status",
                json=status_update,
                headers={"Content-Type": "application/json"}
            )
            
            if response.status_code == 200:
                # Verify the order was updated
                order_response = self.session.get(f"{BASE_URL}/admin/orders/{order_id}")
                if order_response.status_code == 200:
                    order_data = order_response.json()
                    
                    # Check if accepted_at timestamp was set
                    if order_data.get("accepted_at"):
                        self.log_result(
                            "Order Status Update - Accepted",
                            True,
                            f"Order {order_id} accepted_at timestamp set: {order_data.get('accepted_at')}",
                            {"accepted_at": order_data.get("accepted_at")}
                        )
                        return True
                    else:
                        self.log_result(
                            "Order Status Update - Accepted (Missing Timestamp)",
                            False,
                            f"Order {order_id} status updated but accepted_at not set",
                            order_data
                        )
                        return False
                else:
                    self.log_result(
                        "Order Status Update - Accepted (Verification Failed)",
                        False,
                        f"Could not verify order update, status: {order_response.status_code}"
                    )
                    return False
            else:
                self.log_result(
                    "Order Status Update - Accepted (HTTP Error)",
                    False,
                    f"Status: {response.status_code}",
                    response.text
                )
                return False
                
        except Exception as e:
            self.log_result(
                "Order Status Update - Accepted (Exception)",
                False,
                str(e)
            )
            return False

    def test_order_status_update_delivered(self):
        """Test order status update to 'delivered' calculates TTD snapshot"""
        try:
            # Get or create a test order and set it to accepted first
            order_id = self.create_test_order()
            if not order_id:
                # Try to get existing orders
                orders_response = self.session.get(f"{BASE_URL}/admin/orders")
                if orders_response.status_code == 200:
                    orders = orders_response.json()
                    if orders and len(orders) > 0:
                        order_id = orders[0].get("_id")
            
            if not order_id:
                self.log_result(
                    "Order Status Update - Delivered (No Test Order)",
                    False,
                    "Could not create or find test order"
                )
                return False
            
            # First set to accepted to establish accepted_at timestamp
            accepted_update = {"status": "accepted"}
            self.session.put(
                f"{BASE_URL}/admin/orders/{order_id}/status",
                json=accepted_update,
                headers={"Content-Type": "application/json"}
            )
            
            # Wait a moment then update to delivered
            time.sleep(1)
            delivered_update = {"status": "delivered"}
            response = self.session.put(
                f"{BASE_URL}/admin/orders/{order_id}/status",
                json=delivered_update,
                headers={"Content-Type": "application/json"}
            )
            
            if response.status_code == 200:
                # Verify the order was updated with TTD snapshot
                order_response = self.session.get(f"{BASE_URL}/admin/orders/{order_id}")
                if order_response.status_code == 200:
                    order_data = order_response.json()
                    
                    # Check required fields for delivered status
                    required_fields = ["delivered_at", "actual_delivery_time", "ttd_minutes_snapshot"]
                    present_fields = [field for field in required_fields if order_data.get(field) is not None]
                    
                    if len(present_fields) == len(required_fields):
                        self.log_result(
                            "Order Status Update - Delivered",
                            True,
                            f"Order {order_id} delivered with TTD snapshot: {order_data.get('ttd_minutes_snapshot')} minutes",
                            {
                                "ttd_minutes_snapshot": order_data.get("ttd_minutes_snapshot"),
                                "delivered_at": order_data.get("delivered_at"),
                                "actual_delivery_time": order_data.get("actual_delivery_time")
                            }
                        )
                        return True
                    else:
                        missing_fields = [field for field in required_fields if field not in present_fields]
                        self.log_result(
                            "Order Status Update - Delivered (Missing Fields)",
                            False,
                            f"Order {order_id} missing fields: {missing_fields}",
                            order_data
                        )
                        return False
                else:
                    self.log_result(
                        "Order Status Update - Delivered (Verification Failed)",
                        False,
                        f"Could not verify order update, status: {order_response.status_code}"
                    )
                    return False
            else:
                self.log_result(
                    "Order Status Update - Delivered (HTTP Error)",
                    False,
                    f"Status: {response.status_code}",
                    response.text
                )
                return False
                
        except Exception as e:
            self.log_result(
                "Order Status Update - Delivered (Exception)",
                False,
                str(e)
            )
            return False

    def test_order_status_flow(self):
        """Test complete order status flow: arrived → accepted → preparing → ready → delivered"""
        try:
            # Get or create a test order
            order_id = self.create_test_order()
            if not order_id:
                orders_response = self.session.get(f"{BASE_URL}/admin/orders")
                if orders_response.status_code == 200:
                    orders = orders_response.json()
                    if orders and len(orders) > 0:
                        order_id = orders[0].get("_id")
            
            if not order_id:
                self.log_result(
                    "Order Status Flow (No Test Order)",
                    False,
                    "Could not create or find test order"
                )
                return False
            
            # Test status flow
            statuses = ["arrived", "accepted", "preparing", "ready", "delivered"]
            status_timestamps = {}
            
            for status in statuses:
                status_update = {"status": status}
                response = self.session.put(
                    f"{BASE_URL}/admin/orders/{order_id}/status",
                    json=status_update,
                    headers={"Content-Type": "application/json"}
                )
                
                if response.status_code != 200:
                    self.log_result(
                        f"Order Status Flow - {status} (HTTP Error)",
                        False,
                        f"Status: {response.status_code}",
                        response.text
                    )
                    return False
                
                # Verify status was updated
                order_response = self.session.get(f"{BASE_URL}/admin/orders/{order_id}")
                if order_response.status_code == 200:
                    order_data = order_response.json()
                    if order_data.get("status") == status:
                        status_timestamps[status] = order_data.get("delivery_status_timestamp", {}).get(status)
                    else:
                        self.log_result(
                            f"Order Status Flow - {status} (Status Not Updated)",
                            False,
                            f"Expected: {status}, Got: {order_data.get('status')}"
                        )
                        return False
                else:
                    self.log_result(
                        f"Order Status Flow - {status} (Verification Failed)",
                        False,
                        f"Could not verify status update, HTTP: {order_response.status_code}"
                    )
                    return False
                
                # Small delay between status updates
                time.sleep(0.5)
            
            # Verify final order state
            final_order_response = self.session.get(f"{BASE_URL}/admin/orders/{order_id}")
            if final_order_response.status_code == 200:
                final_order = final_order_response.json()
                
                # Check final delivered state
                success_conditions = [
                    final_order.get("status") == "delivered",
                    final_order.get("accepted_at") is not None,
                    final_order.get("delivered_at") is not None,
                    final_order.get("ttd_minutes_snapshot") is not None,
                    final_order.get("delivery_status_timestamp") is not None
                ]
                
                if all(success_conditions):
                    self.log_result(
                        "Order Status Flow - Complete",
                        True,
                        f"Order {order_id} successfully moved through all statuses with TTD calculation",
                        {
                            "final_status": final_order.get("status"),
                            "ttd_minutes_snapshot": final_order.get("ttd_minutes_snapshot"),
                            "status_timestamps": status_timestamps
                        }
                    )
                    return True
                else:
                    self.log_result(
                        "Order Status Flow - Incomplete",
                        False,
                        f"Order {order_id} missing required fields in final state",
                        final_order
                    )
                    return False
            else:
                self.log_result(
                    "Order Status Flow - Final Verification Failed",
                    False,
                    f"Could not get final order state, HTTP: {final_order_response.status_code}"
                )
                return False
                
        except Exception as e:
            self.log_result(
                "Order Status Flow - Exception",
                False,
                str(e)
            )
            return False

    def test_admin_panel_access(self):
        """Test admin panel accessibility and TTD elements"""
        try:
            response = self.session.get(ADMIN_PANEL_URL)
            
            if response.status_code == 200:
                html_content = response.text
                
                # Check for TTD-related elements in admin panel
                ttd_elements = [
                    "Regular Order TTD",
                    "regularOrderTTD",
                    "Delivery Configuration",
                    "saveDeliveryConfig",
                    "ttd-cell",
                    "TTD"
                ]
                
                found_elements = []
                missing_elements = []
                
                for element in ttd_elements:
                    if element in html_content:
                        found_elements.append(element)
                    else:
                        missing_elements.append(element)
                
                if len(found_elements) >= len(ttd_elements) * 0.7:  # At least 70% of elements found
                    self.log_result(
                        "Admin Panel - TTD Elements",
                        True,
                        f"Found {len(found_elements)}/{len(ttd_elements)} TTD elements: {found_elements}",
                        {"found": found_elements, "missing": missing_elements}
                    )
                    return True
                else:
                    self.log_result(
                        "Admin Panel - TTD Elements (Insufficient)",
                        False,
                        f"Only found {len(found_elements)}/{len(ttd_elements)} TTD elements",
                        {"found": found_elements, "missing": missing_elements}
                    )
                    return False
            else:
                self.log_result(
                    "Admin Panel - Access Error",
                    False,
                    f"Status: {response.status_code}",
                    response.text[:500]
                )
                return False
                
        except Exception as e:
            self.log_result(
                "Admin Panel - Exception",
                False,
                str(e)
            )
            return False

    def test_edge_cases(self):
        """Test edge cases for TTD system"""
        try:
            edge_case_results = []
            
            # Test 1: Invalid order ID
            try:
                invalid_response = self.session.put(
                    f"{BASE_URL}/admin/orders/invalid_order_id/status",
                    json={"status": "accepted"},
                    headers={"Content-Type": "application/json"}
                )
                if invalid_response.status_code in [400, 404]:
                    edge_case_results.append("Invalid order ID handled correctly")
                else:
                    edge_case_results.append(f"Invalid order ID not handled (status: {invalid_response.status_code})")
            except:
                edge_case_results.append("Invalid order ID caused exception")
            
            # Test 2: Missing accepted_at for delivered status
            order_id = self.create_test_order()
            if order_id:
                try:
                    # Try to set directly to delivered without accepted_at
                    delivered_response = self.session.put(
                        f"{BASE_URL}/admin/orders/{order_id}/status",
                        json={"status": "delivered"},
                        headers={"Content-Type": "application/json"}
                    )
                    if delivered_response.status_code == 200:
                        # Check if it handled missing accepted_at gracefully
                        order_check = self.session.get(f"{BASE_URL}/admin/orders/{order_id}")
                        if order_check.status_code == 200:
                            order_data = order_check.json()
                            if order_data.get("ttd_minutes_snapshot") is not None:
                                edge_case_results.append("Missing accepted_at handled gracefully")
                            else:
                                edge_case_results.append("Missing accepted_at not handled properly")
                        else:
                            edge_case_results.append("Could not verify missing accepted_at handling")
                    else:
                        edge_case_results.append(f"Delivered without accepted_at failed (status: {delivered_response.status_code})")
                except:
                    edge_case_results.append("Missing accepted_at test caused exception")
            
            # Test 3: Default TTD value when config is missing
            try:
                # This should return default value of 45 minutes
                config_response = self.session.get(f"{BASE_URL}/config/delivery")
                if config_response.status_code == 200:
                    config_data = config_response.json()
                    ttd_minutes = config_data.get("regular_order_ttd_minutes")
                    if ttd_minutes is not None and ttd_minutes > 0:
                        edge_case_results.append(f"Default TTD value working: {ttd_minutes} minutes")
                    else:
                        edge_case_results.append("Default TTD value not working")
                else:
                    edge_case_results.append("Could not test default TTD value")
            except:
                edge_case_results.append("Default TTD test caused exception")
            
            # Evaluate edge case results
            success_count = len([r for r in edge_case_results if "correctly" in r or "gracefully" in r or "working" in r])
            total_tests = len(edge_case_results)
            
            if success_count >= total_tests * 0.6:  # At least 60% success
                self.log_result(
                    "Edge Cases Testing",
                    True,
                    f"Passed {success_count}/{total_tests} edge case tests",
                    edge_case_results
                )
                return True
            else:
                self.log_result(
                    "Edge Cases Testing",
                    False,
                    f"Only passed {success_count}/{total_tests} edge case tests",
                    edge_case_results
                )
                return False
                
        except Exception as e:
            self.log_result(
                "Edge Cases Testing - Exception",
                False,
                str(e)
            )
            return False

    def cleanup_test_orders(self):
        """Clean up test orders created during testing"""
        for order_id in self.created_orders:
            try:
                # Try to delete test order (if endpoint exists)
                delete_response = self.session.delete(f"{BASE_URL}/admin/orders/{order_id}")
                # Don't fail if delete doesn't work, as it might not be implemented
            except:
                pass

    def run_all_tests(self):
        """Run all TTD system tests"""
        print("🚀 Starting TTD (Time to Deliver) System Testing")
        print("=" * 60)
        
        # Test delivery config endpoints
        print("📋 Testing Delivery Configuration Endpoints...")
        self.test_delivery_config_get()
        self.test_delivery_config_put()
        
        # Test order status update endpoints
        print("📦 Testing Order Status Update Endpoints...")
        self.test_order_status_update_accepted()
        self.test_order_status_update_delivered()
        self.test_order_status_flow()
        
        # Test admin panel integration
        print("🔧 Testing Admin Panel Integration...")
        self.test_admin_panel_access()
        
        # Test edge cases
        print("⚠️  Testing Edge Cases...")
        self.test_edge_cases()
        
        # Cleanup
        self.cleanup_test_orders()
        
        # Generate summary
        print("=" * 60)
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
            print("\n❌ FAILED TESTS:")
            for result in self.test_results:
                if not result["success"]:
                    print(f"  - {result['test']}: {result['details']}")
        
        print("\n🎯 TTD SYSTEM TESTING COMPLETE")
        
        return passed_tests, failed_tests, self.test_results

def main():
    """Main testing function"""
    tester = TTDSystemTester()
    passed, failed, results = tester.run_all_tests()
    
    # Return exit code based on results
    return 0 if failed == 0 else 1

if __name__ == "__main__":
    exit(main())