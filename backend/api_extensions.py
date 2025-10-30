# API Extensions for Saved Meals, Coupons, Addresses, Withdrawals
from fastapi import APIRouter, HTTPException, Request
from bson import ObjectId
from datetime import datetime, timezone
from typing import List, Optional

# These will be imported in server.py
# Saved Meals endpoints
async def save_meal_endpoint(meal_data: dict, request: Request, db, get_current_user):
    user = await get_current_user(request)
    if not user or not user.get("is_guide"):
        raise HTTPException(status_code=403, detail="Only guides can save meals")
    
    saved_meal = {
        "guide_id": user["_id"],
        "meal_name": meal_data["meal_name"],
        "ingredients": meal_data["ingredients"],
        "total_price": meal_data["total_price"],
        "created_at": datetime.now(timezone.utc)
    }
    
    result = await db.saved_meals.insert_one(saved_meal)
    return {"message": "Meal saved", "id": str(result.inserted_id)}

async def get_saved_meals_endpoint(request: Request, db, get_current_user):
    user = await get_current_user(request)
    if not user or not user.get("is_guide"):
        raise HTTPException(status_code=403, detail="Only guides can view saved meals")
    
    meals = await db.saved_meals.find({"guide_id": user["_id"]}).to_list(100)
    for meal in meals:
        meal["_id"] = str(meal["_id"])
    return meals

async def delete_saved_meal_endpoint(meal_id: str, request: Request, db, get_current_user):
    user = await get_current_user(request)
    if not user or not user.get("is_guide"):
        raise HTTPException(status_code=403, detail="Only guides can delete saved meals")
    
    result = await db.saved_meals.delete_one({
        "_id": ObjectId(meal_id),
        "guide_id": user["_id"]
    })
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Meal not found")
    
    return {"message": "Meal deleted"}

# Address endpoints
async def add_address_endpoint(address_data: dict, request: Request, db, get_current_user):
    user = await get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    # If this is set as default, unset other defaults
    if address_data.get("is_default"):
        await db.users.update_one(
            {"_id": ObjectId(user["_id"])},
            {"$set": {"addresses.$[].is_default": False}}
        )
    
    result = await db.users.update_one(
        {"_id": ObjectId(user["_id"])},
        {"$push": {"addresses": address_data}}
    )
    
    return {"message": "Address added"}

async def get_addresses_endpoint(request: Request, db, get_current_user):
    user = await get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    user_data = await db.users.find_one({"_id": ObjectId(user["_id"])})
    return user_data.get("addresses", [])

async def delete_address_endpoint(address_index: int, request: Request, db, get_current_user):
    user = await get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    user_data = await db.users.find_one({"_id": ObjectId(user["_id"])})
    addresses = user_data.get("addresses", [])
    
    if address_index >= len(addresses):
        raise HTTPException(status_code=404, detail="Address not found")
    
    addresses.pop(address_index)
    
    await db.users.update_one(
        {"_id": ObjectId(user["_id"])},
        {"$set": {"addresses": addresses}}
    )
    
    return {"message": "Address deleted"}

# Coupon endpoints
async def validate_coupon_endpoint(coupon_code: str, order_value: float, db):
    coupon = await db.coupons.find_one({
        "code": coupon_code.upper(),
        "active": True
    })
    
    if not coupon:
        raise HTTPException(status_code=404, detail="Invalid coupon code")
    
    # Check expiry
    if coupon["expiry_date"] < datetime.now(timezone.utc):
        raise HTTPException(status_code=400, detail="Coupon has expired")
    
    # Check minimum order value
    if order_value < coupon["min_order_value"]:
        raise HTTPException(
            status_code=400,
            detail=f"Minimum order value of ₹{coupon['min_order_value']} required"
        )
    
    # Calculate discount
    if coupon["discount_type"] == "flat":
        discount = coupon["discount_value"]
    else:  # percentage
        discount = (order_value * coupon["discount_value"]) / 100
    
    return {
        "valid": True,
        "discount_amount": discount,
        "discount_type": coupon["discount_type"],
        "final_price": order_value - discount
    }

# Withdrawal request endpoints
async def create_withdrawal_request_endpoint(amount: float, request: Request, db, get_current_user):
    user = await get_current_user(request)
    if not user or not user.get("is_guide"):
        raise HTTPException(status_code=403, detail="Only guides can request withdrawals")
    
    # Check if user has sufficient balance
    if user.get("commission_balance", 0) < amount:
        raise HTTPException(status_code=400, detail="Insufficient balance")
    
    withdrawal = {
        "guide_id": user["_id"],
        "guide_name": user["name"],
        "amount": amount,
        "status": "pending",
        "created_at": datetime.now(timezone.utc)
    }
    
    result = await db.withdrawal_requests.insert_one(withdrawal)
    return {"message": "Withdrawal request submitted", "id": str(result.inserted_id)}

async def get_my_withdrawals_endpoint(request: Request, db, get_current_user):
    user = await get_current_user(request)
    if not user or not user.get("is_guide"):
        raise HTTPException(status_code=403, detail="Only guides can view withdrawals")
    
    withdrawals = await db.withdrawal_requests.find({"guide_id": user["_id"]}).to_list(100)
    for w in withdrawals:
        w["_id"] = str(w["_id"])
    return withdrawals
