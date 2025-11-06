from fastapi import FastAPI, APIRouter, HTTPException, Response, Cookie, Request
from fastapi.responses import JSONResponse, HTMLResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional
import uuid
from datetime import datetime, timezone, timedelta
import requests
from bson import ObjectId
import secrets
import hashlib

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# IST timezone helper
def get_ist_time():
    """Get current time in IST (UTC+5:30) as naive datetime"""
    utc_time = datetime.now(timezone.utc)
    # IST is UTC+5:30
    ist_offset = timedelta(hours=5, minutes=30)
    ist_time = utc_time + ist_offset
    # Return as naive datetime (without timezone info) so MongoDB stores it as-is
    return ist_time.replace(tzinfo=None)

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

app = FastAPI()
api_router = APIRouter(prefix="/api")

# Pydantic models
class UserProfile(BaseModel):
    age: Optional[int] = None
    gender: Optional[str] = None  # "male", "female", "other"
    height: Optional[float] = None  # in cm
    weight: Optional[float] = None  # in kg
    allergies: List[str] = []
    lifestyle_disorders: List[str] = []  # e.g., "Diabetes", "Hypertension", "PCOS"
    lifestyle_activity_level: Optional[str] = None  # "sedentary", "lightly_active", "moderately_active", "very_active", "extra_active"
    profession: Optional[str] = None
    fitness_activities: List[str] = []
    bio: Optional[str] = None
    current_goal: Optional[str] = None  # User's current health/fitness goal
    expertise: Optional[str] = None

class Address(BaseModel):
    label: str  # Home, Work, etc.
    full_address: str
    city: str
    state: str
    pincode: str
    phone: str
    is_default: bool = False

class User(BaseModel):
    email: str
    name: str
    picture: Optional[str] = None
    google_id: str
    profile_picture: Optional[str] = None
    profile: UserProfile = UserProfile()
    addresses: List[Address] = []
    contact_phone: Optional[str] = None
    points: int = 0
    inherent_points: int = 0
    star_rating: int = 0
    is_guide: bool = False
    commission_balance: float = 0.0
    guides: List[str] = []
    guidees: List[str] = []
    idols: List[str] = []  # Users this person follows as idol
    fans: List[str] = []   # Users who follow this person as idol
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class Session(BaseModel):
    user_id: str
    session_token: str
    expires_at: datetime

class Post(BaseModel):
    user_id: str
    user_name: str
    user_picture: Optional[str] = None
    content: str
    image: Optional[str] = None  # Kept for backward compatibility
    images: Optional[List[str]] = []
    vote_ups: int = 0
    voted_by: List[str] = []
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class Comment(BaseModel):
    post_id: str
    user_id: str
    user_name: str
    content: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class Notification(BaseModel):
    user_id: str  # User who will receive the notification
    type: str  # 'comment', 'like', 'fan', 'guidee'
    from_user: str  # User who triggered the notification
    from_user_name: str
    post_id: Optional[str] = None
    message: str
    read: bool = False
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class Message(BaseModel):
    conversation_id: str
    sender_id: str
    sender_name: str
    sender_picture: Optional[str] = None
    content: str
    image: Optional[str] = None
    read: bool = False
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class Conversation(BaseModel):
    user1_id: str
    user1_name: str
    user1_picture: Optional[str] = None
    user2_id: str
    user2_name: str
    user2_picture: Optional[str] = None
    last_message: Optional[str] = None
    last_message_at: Optional[datetime] = None
    unread_count_user1: int = 0
    unread_count_user2: int = 0
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class MealPlan(BaseModel):
    guidee_id: str  # User requesting the plan
    guidee_name: str
    guide_id: Optional[str] = None  # Preferred guide (optional)
    guide_name: Optional[str] = None
    plan_type: str  # "single_meal", "1_day", "3_day", "week", "fortnight", "month"
    start_date: str  # ISO date string
    meals_requested: List[str] = []  # ["breakfast", "brunch", "lunch", "evening_snacks", "dinner", "supper"]
    goal: Optional[str] = None  # Purpose/goal of the meal plan
    status: str = "requested"  # "requested", "accepted", "planning", "submitted", "cancelled"
    logged_meals: Optional[dict] = None  # {date: {meal_time: meal_id}}
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: Optional[datetime] = None



class SavedMeal(BaseModel):
    guide_id: str
    meal_name: str
    ingredients: List[dict]  # [{ingredient_id, ingredient_name, quantity, unit, price}]
    total_price: float
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class Coupon(BaseModel):
    code: str
    discount_type: str  # 'flat' or 'percentage'
    discount_value: float
    min_order_value: float
    usage_limit_type: str  # 'one_time' or 'recurring'
    expiry_date: datetime
    active: bool = True
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class WithdrawalRequest(BaseModel):
    guide_id: str
    guide_name: str
    amount: float
    status: str = 'pending'  # pending, approved, rejected
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    processed_at: Optional[datetime] = None


# New models for ingredient management
class SourceIngredientPurchase(BaseModel):
    purchase_quantity: float  # e.g., 8 (pcs)
    purchase_price: float  # e.g., 100 (Rs)
    unit_price: float  # Auto-calculated: purchase_price / purchase_quantity
    purchase_date: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class SourceIngredient(BaseModel):
    name: str
    image: Optional[str] = None  # Base64 encoded image
    unit: str  # pcs, kg, liters, etc.
    purchases: List[SourceIngredientPurchase] = []  # Purchase history
    
    @property
    def latest_unit_price(self):
        if not self.purchases:
            return 0
        return self.purchases[-1].unit_price
    
    @property
    def lowest_unit_price(self):
        if not self.purchases:
            return 0
        return min(p.unit_price for p in self.purchases)
    
    @property
    def highest_unit_price(self):
        if not self.purchases:
            return 0
        return max(p.unit_price for p in self.purchases)

class NutritionEntry(BaseModel):
    name: str  # e.g., Protein, Carbs, Vitamin A
    value: float  # Value per unit of processed ingredient
    unit: str  # g, mg, mcg, etc.

class SourceIngredientReference(BaseModel):
    source_ingredient_id: str
    source_quantity: float  # Quantity of this source ingredient needed

class Ingredient(BaseModel):
    """Processed Ingredient - created from source ingredients"""
    name: str
    unit: str  # g, ml, piece, cup, etc.
    description: Optional[str] = None
    images: List[str] = []  # Base64 encoded images
    tags: List[str] = []  # Tags for filtering
    # Source ingredients that make up this processed ingredient
    source_ingredients: List[SourceIngredientReference] = []  # Multiple source ingredients
    step_size: float = 1.0  # Default step size for frontend increment/decrement
    nutrition_profile: List[NutritionEntry] = []  # Nutrition per unit
    # Margin fields
    product_margin: float = 0.0
    operations_margin: float = 0.0
    branding_margin: float = 0.0
    rest_margins: float = 0.0
    miscellaneous_margins: float = 0.0
    # Price is auto-calculated from source ingredients + margins
    
    @property
    def price_per_unit(self):
        """Calculate price from source ingredients + margins"""
        if not self.source_ingredients:
            return 0
        # This will be calculated based on source ingredient prices + margins
        return 0  # Placeholder - will be calculated in endpoint

class RecipeIngredient(BaseModel):
    """Processed ingredient used in a recipe"""
    ingredient_id: str  # Reference to processed ingredient
    name: str
    quantity: float  # How much of this ingredient
    unit: str
    step_size: Optional[float] = None  # Override step size for this recipe, None = use ingredient's default
    price: float  # Calculated from processed ingredient

class Recipe(BaseModel):
    """Recipe - created from processed ingredients"""
    name: str
    description: str
    images: List[str] = []  # Base64 encoded images
    ingredients: List[RecipeIngredient]  # Processed ingredients
    tags: List[str] = []  # Tags for filtering
    categories: List[str] = []  # Categories like "Bowls", "Salads" etc.
    created_by: str = "admin"  # Can be user ID for saved recipes
    # Nutrition and price auto-calculated from ingredients
    
    @property
    def total_price(self):
        """Calculate total price from ingredients"""
        return sum(ing.price * ing.quantity for ing in self.ingredients)
    
    @property
    def nutrition_profile(self):
        """Calculate nutrition from all ingredients"""
        # Will be calculated from ingredient nutrition profiles
        return []

class MealRecipe(BaseModel):
    """Recipe used in a meal"""
    recipe_id: str  # Reference to recipe
    name: str
    quantity: float = 1.0  # Multiplier for the recipe
    step_size: Optional[float] = None  # Step size for adjusting this recipe in the meal
    price: float  # Calculated from recipe

class Meal(BaseModel):
    """Meal - combination of recipes"""
    name: str
    description: str
    images: List[str] = []  # Base64 encoded images
    recipes: List[MealRecipe]  # Recipes that make up this meal
    tags: List[str] = []  # Tags for filtering
    is_preset: bool = True  # True for admin-created, False for user-created
    created_by: str = "admin"  # User ID or "admin"
    
    @property
    def total_price(self):
        """Calculate total price from recipes"""
        return sum(recipe.price * recipe.quantity for recipe in self.recipes)
    
    @property
    def nutrition_profile(self):
        """Calculate nutrition from all recipes"""
        # Will be calculated from recipe nutrition profiles
        return []

# Legacy support - keep MealIngredient for cart compatibility
class MealIngredient(BaseModel):
    ingredient_id: str
    name: str
    price: float
    default_quantity: float
    quantity: Optional[float] = None  # For customization

class CartItem(BaseModel):
    meal_id: Optional[str] = None
    meal_name: str
    customizations: List[MealIngredient] = []
    quantity: int = 1
    price: float

class Cart(BaseModel):
    user_id: str
    items: List[CartItem] = []
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class Address(BaseModel):
    name: str
    street: str
    city: str
    state: str
    zip_code: str
    phone: str

class Order(BaseModel):
    user_id: str
    items: List[CartItem]
    total_price: float
    discount_amount: float = 0.0
    coupon_code: Optional[str] = None
    delivery_charge: float = 0.0  # Delivery charge (0 if free delivery)
    final_price: float
    status: str = "arrived"  # arrived, accepted, preparing, ready, out_for_delivery, delivered, cancelled
    billing_address: Address
    shipping_address: Address
    payment_id: Optional[str] = None
    ordered_by_guide_id: Optional[str] = None  # If guide ordered for guidee
    ordered_for_guidee_id: Optional[str] = None  # The guidee this order is for
    meal_plan_id: Optional[str] = None  # If order was placed from a meal plan
    commission_earned: float = 0.0  # Commission earned by guide
    commission_rate: float = 0.0  # Rate at which commission was calculated
    assigned_agent_id: Optional[str] = None  # Delivery agent assigned to this order
    agent_assigned_at: Optional[datetime] = None
    accepted_at: Optional[datetime] = None  # When order was accepted (for TTD calculation)
    delivered_at: Optional[datetime] = None
    ttd_minutes_snapshot: Optional[int] = None  # TTD remaining minutes when marked delivered
    actual_delivery_time: Optional[datetime] = None  # Actual delivery timestamp
    delivery_status_timestamp: Optional[dict] = {}  # Track status change timestamps
    is_preorder: bool = False  # Whether this is a preorder
    preorder_date: Optional[str] = None  # Delivery date for preorder (YYYY-MM-DD)
    preorder_time: Optional[str] = None  # Delivery time for preorder (e.g., "6:00 AM")
    created_at: datetime = Field(default_factory=get_ist_time)

class StoreTimingsConfig(BaseModel):
    opening_time: str  # Format: "6:00 AM"
    closing_time: str  # Format: "9:00 PM"
    preorder_before_time: int = 120  # Minutes before delivery time for preorders
    preorder_cutoff_time: str = "10:00 PM"  # Cut-off time for next day preorders
    
class DeliveryConfig(BaseModel):
    delivery_price: float
    min_order_for_free_delivery: float
    regular_order_ttd_minutes: int = 45  # Time to deliver for regular orders in minutes

class DeliveryAgent(BaseModel):
    email: str
    name: str
    contact_number: str  # Phone number for the delivery agent
    vehicle: str  # bike, car, van, etc.
    vehicle_number: str  # Vehicle registration number
    image: Optional[str] = None  # Base64 encoded image
    status: str = "available"  # available, busy, offline
    payment_per_delivery: float = 0.0  # Amount paid per delivery
    wallet_balance: float = 0.0  # Current wallet balance
    is_delivery_agent: bool = True
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class DeliveryCredit(BaseModel):
    agent_email: str
    order_id: str
    amount: float
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class Config(BaseModel):
    type: str  # star_rating_thresholds, point_values
    config: dict

# Price calculation helpers
async def calculate_processed_ingredient_price(ingredient_data: dict) -> float:
    """Calculate price for processed ingredient from source ingredients + margins"""
    total_price = 0.0
    
    for source_ref in ingredient_data.get("source_ingredients", []):
        source_id = source_ref.get("source_ingredient_id")
        source_quantity = source_ref.get("source_quantity", 0)
        
        # Get source ingredient
        source = await db.source_ingredients.find_one({"_id": ObjectId(source_id)})
        if source and source.get("purchases"):
            # Use latest unit price
            latest_purchase = source["purchases"][-1]
            unit_price = latest_purchase.get("unit_price", 0)
            total_price += unit_price * source_quantity
    
    # Add margins
    product_margin = ingredient_data.get("product_margin", 0)
    operations_margin = ingredient_data.get("operations_margin", 0)
    branding_margin = ingredient_data.get("branding_margin", 0)
    rest_margins = ingredient_data.get("rest_margins", 0)
    miscellaneous_margins = ingredient_data.get("miscellaneous_margins", 0)
    
    total_price += product_margin + operations_margin + branding_margin + rest_margins + miscellaneous_margins
    
    return total_price

async def calculate_recipe_price(recipe_data: dict) -> float:
    """Calculate total price for recipe from processed ingredients"""
    total_price = 0.0
    
    for ingredient in recipe_data.get("ingredients", []):
        ingredient_id = ingredient.get("ingredient_id")
        quantity = ingredient.get("quantity", 0)
        
        # Get processed ingredient and calculate its price
        try:
            processed_ing = await db.ingredients.find_one({"_id": ObjectId(ingredient_id)})
            if processed_ing:
                ing_price = await calculate_processed_ingredient_price(processed_ing)
                if ing_price is not None:
                    total_price += ing_price * quantity
        except Exception:
            # Skip invalid ingredient IDs
            continue
    
    return total_price

async def calculate_meal_price(meal_data: dict) -> float:
    """Calculate total price for meal from recipes"""
    total_price = 0.0
    
    for recipe_ref in meal_data.get("recipes", []):
        recipe_id = recipe_ref.get("recipe_id")
        quantity = recipe_ref.get("quantity", 1.0)
        
        # Get recipe and calculate its price
        try:
            recipe = await db.meals.find_one({"_id": ObjectId(recipe_id)})
            if recipe:
                recipe_price = await calculate_recipe_price(recipe)
                if recipe_price is not None:
                    total_price += recipe_price * quantity
        except Exception:
            # Skip invalid recipe IDs
            continue
    
    return total_price

async def calculate_nutrition_profile(ingredients: list, collection_name: str = "ingredients") -> list:
    """Calculate aggregated nutrition profile from ingredients/recipes"""
    nutrition_totals = {}
    
    for item in ingredients:
        item_id = item.get("ingredient_id") or item.get("recipe_id")
        quantity = item.get("quantity", 1.0)
        
        # Get the ingredient/recipe data
        try:
            if collection_name == "ingredients":
                data = await db.ingredients.find_one({"_id": ObjectId(item_id)})
            else:
                data = await db.meals.find_one({"_id": ObjectId(item_id)})
        except Exception:
            # Skip invalid IDs
            continue
        
        if data and data.get("nutrition_profile"):
            for nutrition in data["nutrition_profile"]:
                nutrient_name = nutrition.get("name")
                nutrient_value = nutrition.get("value", 0)
                nutrient_unit = nutrition.get("unit", "g")
                
                # Aggregate nutrition values
                if nutrient_name in nutrition_totals:
                    nutrition_totals[nutrient_name]["value"] += nutrient_value * quantity
                else:
                    nutrition_totals[nutrient_name] = {
                        "name": nutrient_name,
                        "value": nutrient_value * quantity,
                        "unit": nutrient_unit
                    }
    
    return list(nutrition_totals.values())


# Helper functions
async def get_star_config() -> dict:
    """Get star rating configuration from database"""
    config = await db.config.find_one({"type": "star_rating"})
    if not config:
        # Default configuration
        return {
            "star1": 25,
            "star2": 100,
            "star3": 250,
            "star4": 500,
            "star5": 1000
        }
    return config["config"]

async def calculate_star_rating(points: int) -> int:
    """Calculate star rating based on total points (earned + inherent)"""
    config = await get_star_config()
    
    # Check if we have dynamic star levels (star1, star2, etc.) or just 5 fixed levels
    star_levels = sorted([int(k.replace('star', '')) for k in config.keys() if k.startswith('star')])
    
    # Sort by points descending to check highest first
    for level in reversed(star_levels):
        key = f"star{level}"
        if points >= config[key]:
            return level
    
    return 0


async def get_commission_config() -> dict:
    """Get commission rate configuration from database"""
    config = await db.config.find_one({"type": "commission_rates"})
    if not config:
        # Default commission rates
        return {
            "star1": 3.0,
            "star2": 6.0,
            "star3": 9.0,
            "star4": 12.0,
            "star5": 15.0
        }
    return config["config"]

async def calculate_commission_rate(star_rating: int) -> float:
    """Get commission rate for a given star rating"""
    config = await get_commission_config()
    key = f"star{star_rating}"
    return config.get(key, 0.0)

async def get_current_user(request: Request) -> Optional[dict]:
    """Get current user from session token"""
    session_token = request.cookies.get("session_token")
    if not session_token:
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            session_token = auth_header.replace("Bearer ", "")
    
    if not session_token:
        return None
    
    session = await db.sessions.find_one({"session_token": session_token})
    if not session:
        return None
    
    # Check if session is expired
    if session.get("expires_at"):
        expires_at = session["expires_at"]
        # Ensure timezone-aware comparison
        if expires_at.tzinfo is None:
            expires_at = expires_at.replace(tzinfo=timezone.utc)
        
        if expires_at < datetime.now(timezone.utc):
            await db.sessions.delete_one({"session_token": session_token})
            return None
    
    # Get user
    user = await db.users.find_one({"_id": ObjectId(session["user_id"])})
    if user:
        user["_id"] = str(user["_id"])
    return user


# Admin authentication helpers
def hash_password(password: str) -> str:
    """Hash password using SHA-256"""
    return hashlib.sha256(password.encode()).hexdigest()

def generate_admin_token() -> str:
    """Generate a secure random token for admin session"""
    return secrets.token_urlsafe(32)

async def initialize_admin_credentials():
    """Initialize default admin credentials if not exists"""
    admin = await db.admin_users.find_one({"email": "redhilllabs@gmail.com"})
    if not admin:
        await db.admin_users.insert_one({
            "email": "redhilllabs@gmail.com",
            "password_hash": hash_password("@Redhilllabs"),
            "created_at": datetime.now(timezone.utc)
        })
        print("Default admin credentials initialized")

async def verify_admin_token(token: str) -> Optional[dict]:
    """Verify admin token and return admin user"""
    if not token:
        return None
    
    # Check if token exists in admin_sessions
    session = await db.admin_sessions.find_one({"token": token})
    if not session:
        return None
    
    # Check if token is expired (24 hours)
    if session.get("expires_at"):
        expires_at = session["expires_at"]
        # Ensure timezone-aware comparison
        if expires_at.tzinfo is None:
            expires_at = expires_at.replace(tzinfo=timezone.utc)
        
        if expires_at < datetime.now(timezone.utc):
            await db.admin_sessions.delete_one({"token": token})
            return None
    
    # Get admin user
    admin = await db.admin_users.find_one({"email": session["email"]})
    return admin


# Authentication endpoints
@api_router.get("/auth/session-data")
async def get_session_data(request: Request):
    """Process session ID and return session data"""
    session_id = request.headers.get("X-Session-ID")
    logger.info(f"Received session request with session_id: {session_id}")
    
    if not session_id:
        logger.error("No session ID provided")
        raise HTTPException(status_code=400, detail="No session ID provided")
    
    try:
        # Call Emergent auth service
        logger.info(f"Calling Emergent auth service with session_id: {session_id}")
        response = requests.get(
            "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data",
            headers={"X-Session-ID": session_id}
        )
        
        logger.info(f"Emergent auth response status: {response.status_code}")
        
        if response.status_code != 200:
            logger.error(f"Invalid session, status code: {response.status_code}, response: {response.text}")
            raise HTTPException(status_code=401, detail="Invalid session")
        
        data = response.json()
        logger.info(f"Received user data: {data.get('email')}")
        
        # Check if user exists
        user = await db.users.find_one({"email": data["email"]})
        
        if not user:
            # Create new user
            logger.info(f"Creating new user: {data['email']}")
            new_user = User(
                email=data["email"],
                name=data["name"],
                picture=data.get("picture"),
                google_id=data["id"]
            )
            result = await db.users.insert_one(new_user.dict())
            user_id = str(result.inserted_id)
            logger.info(f"New user created with id: {user_id}")
        else:
            user_id = str(user["_id"])
            logger.info(f"Existing user found with id: {user_id}")
        
        # Create session
        session_token = data["session_token"]
        expires_at = datetime.now(timezone.utc) + timedelta(days=7)
        
        session = Session(
            user_id=user_id,
            session_token=session_token,
            expires_at=expires_at
        )
        
        await db.sessions.insert_one(session.dict())
        logger.info(f"Session created for user: {user_id}")
        
        return {
            "id": data["id"],
            "email": data["email"],
            "name": data["name"],
            "picture": data.get("picture"),
            "session_token": session_token,
            "user_id": user_id
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error processing session: {str(e)}")
        raise HTTPException(status_code=500, detail="Error processing session")

@api_router.post("/auth/logout")
async def logout(request: Request, response: Response):
    """Logout user and clear session"""
    user = await get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    session_token = request.cookies.get("session_token")
    if session_token:
        await db.sessions.delete_one({"session_token": session_token})
    
    response.delete_cookie("session_token")
    return {"message": "Logged out successfully"}

@api_router.get("/auth/me")
async def get_me(request: Request):
    """Get current user info"""
    user = await get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return user

# User endpoints
@api_router.put("/users/profile")
async def update_profile(profile_data: dict, request: Request):
    """Update user profile"""
    user = await get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    await db.users.update_one(
        {"_id": ObjectId(user["_id"])},
        {"$set": {"profile": profile_data}}
    )
    
    return {"message": "Profile updated successfully"}

@api_router.get("/users/{user_id}")
async def get_user(user_id: str):
    """Get user by ID"""
    user = await db.users.find_one({"_id": ObjectId(user_id)})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user["_id"] = str(user["_id"])
    
    # Get user's posts
    posts = await db.posts.find({"user_id": user_id}).sort("created_at", -1).to_list(50)
    for post in posts:
        post["_id"] = str(post["_id"])
    user["posts"] = posts
    
    return user

@api_router.post("/users/{user_id}/become-fan")
async def become_fan(user_id: str, request: Request):
    """Become a fan of another user (idol relationship)"""
    current_user = await get_current_user(request)
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    if current_user["_id"] == user_id:
        raise HTTPException(status_code=400, detail="Cannot be your own fan")
    
    # Add to current user's idols list
    await db.users.update_one(
        {"_id": ObjectId(current_user["_id"])},
        {"$addToSet": {"idols": user_id}}
    )
    
    # Add current user to target user's fans list
    await db.users.update_one(
        {"_id": ObjectId(user_id)},
        {"$addToSet": {"fans": current_user["_id"]}}
    )
    
    # Create notification for the idol
    notification = Notification(
        user_id=user_id,
        type="fan",
        from_user=current_user["_id"],
        from_user_name=current_user["name"],
        message=f"{current_user['name']} is now your fan"
    )
    await db.notifications.insert_one(notification.dict())
    
    return {"message": "Successfully became a fan"}

@api_router.delete("/users/{user_id}/unfan")
async def unfan(user_id: str, request: Request):
    """Remove fan relationship"""
    current_user = await get_current_user(request)
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    # Remove from current user's idols list
    await db.users.update_one(
        {"_id": ObjectId(current_user["_id"])},
        {"$pull": {"idols": user_id}}
    )
    
    # Remove current user from target user's fans list
    await db.users.update_one(
        {"_id": ObjectId(user_id)},
        {"$pull": {"fans": current_user["_id"]}}
    )
    
    return {"message": "Unfanned successfully"}

# Post endpoints
@api_router.post("/posts")
async def create_post(post_data: dict, request: Request):
    """Create a new post"""
    user = await get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    # Handle both single image and images array
    images = post_data.get("images", [])
    single_image = post_data.get("image")
    
    # Backward compatibility: if single image provided, add to images array
    if single_image and single_image not in images:
        images = [single_image] + images
    
    post = Post(
        user_id=user["_id"],
        user_name=user["name"],
        user_picture=user.get("picture"),
        content=post_data["content"],
        image=images[0] if images else None,  # Keep first image for backward compatibility
        images=images
    )
    
    result = await db.posts.insert_one(post.dict())
    
    # Award points for posting
    await db.users.update_one(
        {"_id": ObjectId(user["_id"])},
        {"$inc": {"points": 5}}
    )
    
    # Update star rating
    updated_user = await db.users.find_one({"_id": ObjectId(user["_id"])})
    total_points = updated_user.get("points", 0) + updated_user.get("inherent_points", 0)
    new_rating = await calculate_star_rating(total_points)
    is_guide = new_rating >= 1
    
    await db.users.update_one(
        {"_id": ObjectId(user["_id"])},
        {"$set": {"star_rating": new_rating, "is_guide": is_guide}}
    )
    
    return {"message": "Post created", "id": str(result.inserted_id)}

@api_router.get("/posts")
async def get_posts(page: int = 1, limit: int = 20):
    """Get all posts with pagination"""
    skip = (page - 1) * limit
    posts = await db.posts.find().sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    for post in posts:
        post["_id"] = str(post["_id"])
        # Fetch user's star rating only if they're a guide with rating > 0
        user = await db.users.find_one({"_id": ObjectId(post["user_id"])})
        if user:
            star_rating = user.get("star_rating", 0)
            if star_rating and star_rating > 0:
                post["star_rating"] = star_rating
            # If star_rating is 0 or None, don't add it to the post
    return posts

@api_router.post("/posts/{post_id}/vote")
async def vote_post(post_id: str, request: Request):
    """Vote up a post"""
    user = await get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    post = await db.posts.find_one({"_id": ObjectId(post_id)})
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    
    # Check if already voted
    if user["_id"] in post.get("voted_by", []):
        # Remove vote
        await db.posts.update_one(
            {"_id": ObjectId(post_id)},
            {"$pull": {"voted_by": user["_id"]}, "$inc": {"vote_ups": -1}}
        )
        # Remove points from post owner
        await db.users.update_one(
            {"_id": ObjectId(post["user_id"])},
            {"$inc": {"points": -2}}
        )
        return {"message": "Vote removed", "voted": False}
    else:
        # Add vote
        await db.posts.update_one(
            {"_id": ObjectId(post_id)},
            {"$push": {"voted_by": user["_id"]}, "$inc": {"vote_ups": 1}}
        )
        # Award points to post owner
        await db.users.update_one(
            {"_id": ObjectId(post["user_id"])},
            {"$inc": {"points": 2}}
        )
        
        # Update star rating
        post_owner = await db.users.find_one({"_id": ObjectId(post["user_id"])})
        total_points = post_owner.get("points", 0) + post_owner.get("inherent_points", 0)
        new_rating = await calculate_star_rating(total_points)
        is_guide = new_rating >= 1
        
        await db.users.update_one(
            {"_id": ObjectId(post["user_id"])},
            {"$set": {"star_rating": new_rating, "is_guide": is_guide}}
        )
        
        # Create notification for post owner (if not voting own post)
        if post["user_id"] != user["_id"]:
            notification = Notification(
                user_id=post["user_id"],
                type="like",
                from_user=user["_id"],
                from_user_name=user["name"],
                post_id=post_id,
                message=f"{user['name']} liked your post"
            )
            await db.notifications.insert_one(notification.dict())
        
        return {"message": "Voted", "voted": True}

@api_router.delete("/posts/{post_id}")
async def delete_post(post_id: str, request: Request):
    """Delete a post (only by owner)"""
    user = await get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    post = await db.posts.find_one({"_id": ObjectId(post_id)})
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    
    # Check if user is the owner
    if post["user_id"] != user["_id"]:
        raise HTTPException(status_code=403, detail="Not authorized to delete this post")
    
    # Delete all comments associated with this post
    await db.comments.delete_many({"post_id": post_id})
    
    # Delete the post
    await db.posts.delete_one({"_id": ObjectId(post_id)})
    
    # Remove points for the deleted post
    await db.users.update_one(
        {"_id": ObjectId(user["_id"])},
        {"$inc": {"points": -5}}
    )
    
    # Update star rating
    updated_user = await db.users.find_one({"_id": ObjectId(user["_id"])})
    total_points = updated_user.get("points", 0) + updated_user.get("inherent_points", 0)
    new_rating = await calculate_star_rating(total_points)
    is_guide = new_rating >= 1
    
    await db.users.update_one(
        {"_id": ObjectId(user["_id"])},
        {"$set": {"star_rating": new_rating, "is_guide": is_guide}}
    )
    
    return {"message": "Post deleted"}

@api_router.put("/posts/{post_id}")
async def update_post(post_id: str, post_data: dict, request: Request):
    """Update a post (only by owner)"""
    user = await get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    post = await db.posts.find_one({"_id": ObjectId(post_id)})
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    
    # Check if user is the owner
    if post["user_id"] != user["_id"]:
        raise HTTPException(status_code=403, detail="Not authorized to edit this post")
    
    # Update the post
    update_data = {}
    if "content" in post_data:
        update_data["content"] = post_data["content"]
    
    # Handle both single image and images array
    if "images" in post_data:
        images = post_data["images"]
        update_data["images"] = images
        update_data["image"] = images[0] if images else None  # Keep first image for backward compatibility
    elif "image" in post_data:
        # Backward compatibility for single image
        update_data["image"] = post_data["image"]
        update_data["images"] = [post_data["image"]] if post_data["image"] else []
    
    await db.posts.update_one(
        {"_id": ObjectId(post_id)},
        {"$set": update_data}
    )
    
    return {"message": "Post updated"}

# Comment endpoints
@api_router.post("/posts/{post_id}/comments")
async def create_comment(post_id: str, comment_data: dict, request: Request):
    """Create a comment on a post"""
    user = await get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    # Get the post to find the owner
    post = await db.posts.find_one({"_id": ObjectId(post_id)})
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    
    comment = Comment(
        post_id=post_id,
        user_id=user["_id"],
        user_name=user["name"],
        content=comment_data["content"]
    )
    
    result = await db.comments.insert_one(comment.dict())
    
    # Create notification for post owner (if not commenting on own post)
    if post["user_id"] != user["_id"]:
        notification = Notification(
            user_id=post["user_id"],
            type="comment",
            from_user=user["_id"],
            from_user_name=user["name"],
            post_id=post_id,
            message=f"{user['name']} commented on your post"
        )
        await db.notifications.insert_one(notification.dict())
    
    return {"message": "Comment created", "id": str(result.inserted_id)}

@api_router.get("/posts/{post_id}/comments")
async def get_comments(post_id: str):
    """Get comments for a post with user information"""
    comments = await db.comments.find({"post_id": post_id}).sort("created_at", -1).to_list(100)
    
    # Enrich comments with user picture
    for comment in comments:
        comment["_id"] = str(comment["_id"])
        if comment.get("user_id"):
            user = await db.users.find_one({"_id": ObjectId(comment["user_id"])})
            if user:
                comment["user_picture"] = user.get("picture")
    
    return comments

# Notification endpoints
@api_router.get("/notifications")
async def get_notifications(request: Request):
    """Get user's notifications"""
    user = await get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    notifications = await db.notifications.find({"user_id": user["_id"]}).sort("created_at", -1).to_list(100)
    for notification in notifications:
        notification["_id"] = str(notification["_id"])
    return notifications

@api_router.put("/notifications/{notification_id}/read")
async def mark_notification_read(notification_id: str, request: Request):
    """Mark notification as read"""
    user = await get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    await db.notifications.update_one(
        {"_id": ObjectId(notification_id), "user_id": user["_id"]},
        {"$set": {"read": True}}
    )
    return {"message": "Notification marked as read"}

# Guidee/Guide relationship endpoints
@api_router.post("/users/{user_id}/add-guidee")
async def add_guidee(user_id: str, request: Request):
    """Add current user as guidee of the target user (guide)"""
    current_user = await get_current_user(request)
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    # Check if target user is a guide
    target_user = await db.users.find_one({"_id": ObjectId(user_id)})
    if not target_user or not target_user.get("is_guide"):
        raise HTTPException(status_code=400, detail="Target user is not a guide")
    
    # Add current user to target's guidees
    await db.users.update_one(
        {"_id": ObjectId(user_id)},
        {"$addToSet": {"guidees": current_user["_id"]}}
    )
    
    # Add target to current user's guides
    await db.users.update_one(
        {"_id": ObjectId(current_user["_id"])},
        {"$addToSet": {"guides": user_id}}
    )
    
    # Create notification
    notification = Notification(
        user_id=user_id,
        type="guidee",
        from_user=current_user["_id"],
        from_user_name=current_user["name"],
        message=f"{current_user['name']} is now your guidee"
    )
    await db.notifications.insert_one(notification.dict())
    
    return {"message": "Added as guidee"}

@api_router.delete("/users/{user_id}/remove-guidee")
async def remove_guidee(user_id: str, request: Request):
    """Remove current user as guidee of the target user"""
    current_user = await get_current_user(request)
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    # Remove current user from target's guidees
    await db.users.update_one(
        {"_id": ObjectId(user_id)},
        {"$pull": {"guidees": current_user["_id"]}}
    )
    
    # Remove target from current user's guides
    await db.users.update_one(
        {"_id": ObjectId(current_user["_id"])},
        {"$pull": {"guides": user_id}}
    )
    
    return {"message": "Removed as guidee"}

# Chat endpoints
@api_router.get("/conversations")
async def get_conversations(request: Request):
    """Get all conversations for the current user"""
    user = await get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    # Find conversations where user is either user1 or user2
    conversations = await db.conversations.find({
        "$or": [
            {"user1_id": user["_id"]},
            {"user2_id": user["_id"]}
        ]
    }).sort("last_message_at", -1).to_list(100)
    
    for conv in conversations:
        conv["_id"] = str(conv["_id"])
    
    return conversations

@api_router.get("/conversations/{other_user_id}")
async def get_or_create_conversation(other_user_id: str, request: Request):
    """Get or create a conversation with another user"""
    user = await get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    # Check if conversation exists (either direction)
    conversation = await db.conversations.find_one({
        "$or": [
            {"user1_id": user["_id"], "user2_id": other_user_id},
            {"user1_id": other_user_id, "user2_id": user["_id"]}
        ]
    })
    
    if conversation:
        conversation["_id"] = str(conversation["_id"])
        return conversation
    
    # Create new conversation
    other_user = await db.users.find_one({"_id": ObjectId(other_user_id)})
    if not other_user:
        raise HTTPException(status_code=404, detail="User not found")
    
    new_conversation = Conversation(
        user1_id=user["_id"],
        user1_name=user["name"],
        user1_picture=user.get("picture"),
        user2_id=other_user_id,
        user2_name=other_user["name"],
        user2_picture=other_user.get("picture")
    )
    
    result = await db.conversations.insert_one(new_conversation.dict())
    conversation = await db.conversations.find_one({"_id": result.inserted_id})
    conversation["_id"] = str(conversation["_id"])
    
    return conversation

@api_router.get("/conversations/{conversation_id}/messages")
async def get_messages(conversation_id: str, request: Request, skip: int = 0, limit: int = 50):
    """Get messages for a conversation"""
    user = await get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    # Verify user is part of the conversation
    conversation = await db.conversations.find_one({"_id": ObjectId(conversation_id)})
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")
    
    if conversation["user1_id"] != user["_id"] and conversation["user2_id"] != user["_id"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Get messages
    messages = await db.messages.find(
        {"conversation_id": conversation_id}
    ).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    
    # Reverse to show oldest first
    messages.reverse()
    
    for msg in messages:
        msg["_id"] = str(msg["_id"])
    
    # Mark messages as read for current user
    await db.messages.update_many(
        {
            "conversation_id": conversation_id,
            "sender_id": {"$ne": user["_id"]},
            "read": False
        },
        {"$set": {"read": True}}
    )
    
    # Reset unread count for current user
    if conversation["user1_id"] == user["_id"]:
        await db.conversations.update_one(
            {"_id": ObjectId(conversation_id)},
            {"$set": {"unread_count_user1": 0}}
        )
    else:
        await db.conversations.update_one(
            {"_id": ObjectId(conversation_id)},
            {"$set": {"unread_count_user2": 0}}
        )
    
    return messages

@api_router.post("/conversations/{conversation_id}/messages")
async def send_message(conversation_id: str, message_data: dict, request: Request):
    """Send a message in a conversation"""
    user = await get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    # Verify conversation exists and user is part of it
    conversation = await db.conversations.find_one({"_id": ObjectId(conversation_id)})
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")
    
    if conversation["user1_id"] != user["_id"] and conversation["user2_id"] != user["_id"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Create message
    message = Message(
        conversation_id=conversation_id,
        sender_id=user["_id"],
        sender_name=user["name"],
        sender_picture=user.get("picture"),
        content=message_data.get("content", ""),
        image=message_data.get("image")
    )
    
    result = await db.messages.insert_one(message.dict())
    
    # Update conversation
    receiver_id = conversation["user2_id"] if conversation["user1_id"] == user["_id"] else conversation["user1_id"]
    unread_field = "unread_count_user2" if conversation["user1_id"] == user["_id"] else "unread_count_user1"
    
    # Determine last message text
    last_msg_text = message_data.get("content", "")
    if not last_msg_text and message_data.get("image"):
        last_msg_text = "📷 Image"
    
    await db.conversations.update_one(
        {"_id": ObjectId(conversation_id)},
        {
            "$set": {
                "last_message": last_msg_text[:100],
                "last_message_at": datetime.now(timezone.utc)
            },
            "$inc": {unread_field: 1}
        }
    )
    
    # Create notification for receiver
    receiver = await db.users.find_one({"_id": ObjectId(receiver_id)})
    if receiver:
        notification = Notification(
            user_id=receiver_id,
            type="message",
            from_user=user["_id"],
            from_user_name=user["name"],
            message=f"{user['name']} sent you a message"
        )
        await db.notifications.insert_one(notification.dict())
    
    return {"message": "Message sent", "id": str(result.inserted_id)}


# Meal & Ingredient endpoints
@api_router.get("/ingredients")
async def get_ingredients():
    """Get all processed ingredients"""
    ingredients = await db.ingredients.find().to_list(1000)
    for ingredient in ingredients:
        ingredient["_id"] = str(ingredient["_id"])
        # Calculate price using helper function with error handling
        try:
            calculated_price = await calculate_processed_ingredient_price(ingredient)
            ingredient["calculated_price"] = calculated_price
            ingredient["price_per_unit"] = calculated_price  # Backward compatibility
        except Exception as e:
            # If calculation fails, set to 0 or use existing price_per_unit
            ingredient["calculated_price"] = ingredient.get("price_per_unit", 0)
            ingredient["price_per_unit"] = ingredient.get("price_per_unit", 0)
    return ingredients

# Source Ingredients endpoints
@api_router.get("/source-ingredients")
async def get_source_ingredients():
    """Get all source ingredients with purchase history"""
    sources = await db.source_ingredients.find().to_list(1000)
    for source in sources:
        source["_id"] = str(source["_id"])
        # Calculate stats
        if source.get("purchases"):
            unit_prices = [p["unit_price"] for p in source["purchases"]]
            source["latest_unit_price"] = source["purchases"][-1]["unit_price"]
            source["lowest_unit_price"] = min(unit_prices)
            source["highest_unit_price"] = max(unit_prices)
            source["latest_purchase"] = source["purchases"][-1]
        else:
            source["latest_unit_price"] = 0
            source["lowest_unit_price"] = 0
            source["highest_unit_price"] = 0
            source["latest_purchase"] = None
    return sources

@api_router.post("/source-ingredients")
async def create_source_ingredient(source_data: dict):
    """Create a new source ingredient"""
    source = {
        "name": source_data["name"],
        "image": source_data.get("image"),
        "unit": source_data["unit"],
        "purchases": []
    }
    result = await db.source_ingredients.insert_one(source)
    return {"message": "Source ingredient created", "id": str(result.inserted_id)}

@api_router.post("/source-ingredients/{source_id}/purchase")
async def add_purchase(source_id: str, purchase_data: dict):
    """Add a purchase entry to source ingredient"""
    unit_price = purchase_data["purchase_price"] / purchase_data["purchase_quantity"]
    
    purchase = {
        "purchase_quantity": purchase_data["purchase_quantity"],
        "purchase_price": purchase_data["purchase_price"],
        "unit_price": unit_price,
        "purchase_date": datetime.now(timezone.utc)
    }
    
    await db.source_ingredients.update_one(
        {"_id": ObjectId(source_id)},
        {"$push": {"purchases": purchase}}
    )
    
    # Update all processed ingredients linked to this source
    processed_ingredients = await db.ingredients.find({"source_ingredient_id": source_id}).to_list(1000)
    for ing in processed_ingredients:
        if ing.get("source_quantity"):
            new_price = ing["source_quantity"] * unit_price
            await db.ingredients.update_one(
                {"_id": ing["_id"]},
                {"$set": {"price_per_unit": new_price}}
            )
    
    return {"message": "Purchase added", "unit_price": unit_price}

@api_router.delete("/source-ingredients/{source_id}/purchase/{purchase_index}")
async def delete_purchase(source_id: str, purchase_index: int):
    """Delete a purchase entry from source ingredient history"""
    source = await db.source_ingredients.find_one({"_id": ObjectId(source_id)})
    if not source:
        raise HTTPException(status_code=404, detail="Source ingredient not found")
    
    purchases = source.get("purchases", [])
    if purchase_index < 0 or purchase_index >= len(purchases):
        raise HTTPException(status_code=400, detail="Invalid purchase index")
    
    purchases.pop(purchase_index)
    
    await db.source_ingredients.update_one(
        {"_id": ObjectId(source_id)},
        {"$set": {"purchases": purchases}}
    )
    
    return {"message": "Purchase deleted"}

@api_router.put("/source-ingredients/{source_id}")
async def update_source_ingredient(source_id: str, source_data: dict):
    """Update source ingredient details (not purchases)"""
    update_data = {}
    if "name" in source_data:
        update_data["name"] = source_data["name"]
    if "image" in source_data:
        update_data["image"] = source_data["image"]
    if "unit" in source_data:
        update_data["unit"] = source_data["unit"]
    
    await db.source_ingredients.update_one(
        {"_id": ObjectId(source_id)},
        {"$set": update_data}
    )
    
    return {"message": "Source ingredient updated"}

@api_router.delete("/source-ingredients/{source_id}")
async def delete_source_ingredient(source_id: str):
    """Delete a source ingredient"""
    # Check if any processed ingredients are linked to this source
    linked_count = await db.ingredients.count_documents({"source_ingredient_id": source_id})
    if linked_count > 0:
        raise HTTPException(status_code=400, detail=f"Cannot delete: {linked_count} processed ingredients are linked to this source")
    
    result = await db.source_ingredients.delete_one({"_id": ObjectId(source_id)})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Source ingredient not found")
    
    return {"message": "Source ingredient deleted"}

@api_router.get("/recipes")
async def get_recipes(user_id: str = None):
    """Get all recipes with calculated prices. If user_id provided, includes user's non-preset recipes."""
    if user_id:
        # Return both preset recipes AND user's non-preset recipes
        recipes = await db.meals.find({
            "$or": [
                {"is_preset": True},
                {"created_by": user_id, "is_preset": False}
            ]
        }).to_list(100)
    else:
        # Only preset recipes
        recipes = await db.meals.find({"is_preset": True}).to_list(100)
    
    for recipe in recipes:
        recipe["_id"] = str(recipe["_id"])
        # Calculate price from ingredients
        recipe["calculated_price"] = await calculate_recipe_price(recipe)
        # Calculate nutrition profile
        recipe["nutrition_profile"] = await calculate_nutrition_profile(
            recipe.get("ingredients", []), "ingredients"
        )
    return recipes

@api_router.get("/recipes/{recipe_id}")
async def get_recipe(recipe_id: str):
    """Get recipe by ID with calculated price and nutrition"""
    try:
        recipe = await db.meals.find_one({"_id": ObjectId(recipe_id)})
    except Exception:
        raise HTTPException(status_code=404, detail="Recipe not found")
    if not recipe:
        raise HTTPException(status_code=404, detail="Recipe not found")
    recipe["_id"] = str(recipe["_id"])
    
    # Refresh ingredient prices with latest calculated prices
    for ingredient_ref in recipe.get("ingredients", []):
        ingredient_id = ingredient_ref.get("ingredient_id")
        if ingredient_id:
            try:
                ingredient = await db.ingredients.find_one({"_id": ObjectId(ingredient_id)})
                if ingredient:
                    # Recalculate price from source ingredients
                    calculated_price = await calculate_processed_ingredient_price(ingredient)
                    ingredient_ref["price"] = calculated_price
            except Exception:
                pass
    
    # Calculate total price from refreshed ingredients
    recipe["calculated_price"] = await calculate_recipe_price(recipe)
    # Calculate nutrition profile
    recipe["nutrition_profile"] = await calculate_nutrition_profile(
        recipe.get("ingredients", []), "ingredients"
    )
    return recipe

# New Meals endpoints (meals are combinations of recipes)
@api_router.get("/meals")
async def get_meals(user_id: str = None):
    """Get all meals (combinations of recipes) with calculated prices. If user_id provided, includes user's non-preset meals."""
    if user_id:
        # Return both preset meals AND user's non-preset meals
        meals = await db.preset_meals.find({
            "$or": [
                {"is_preset": True},
                {"created_by": user_id, "is_preset": False}
            ]
        }).to_list(100)
    else:
        # Only preset meals
        meals = await db.preset_meals.find({"is_preset": True}).to_list(100)
    
    for meal in meals:
        meal["_id"] = str(meal["_id"])
        # Refresh recipe prices with latest calculated prices
        for recipe_ref in meal.get("recipes", []):
            recipe_id = recipe_ref.get("recipe_id")
            if recipe_id:
                try:
                    recipe = await db.meals.find_one({"_id": ObjectId(recipe_id)})
                    if recipe:
                        # Recalculate recipe price from its ingredients
                        calculated_price = await calculate_recipe_price(recipe)
                        recipe_ref["price"] = calculated_price
                except Exception:
                    pass
        # Calculate price from recipes
        meal["calculated_price"] = await calculate_meal_price(meal)
        # Calculate nutrition profile from recipes
        meal["nutrition_profile"] = await calculate_nutrition_profile(
            meal.get("recipes", []), "meals"
        )
    return meals

@api_router.get("/meals/{meal_id}")
async def get_meal(meal_id: str):
    """Get meal by ID with calculated price and nutrition"""
    try:
        meal = await db.preset_meals.find_one({"_id": ObjectId(meal_id)})
    except Exception:
        raise HTTPException(status_code=404, detail="Meal not found")
    if not meal:
        raise HTTPException(status_code=404, detail="Meal not found")
    meal["_id"] = str(meal["_id"])
    
    # Refresh recipe prices with latest calculated prices
    for recipe_ref in meal.get("recipes", []):
        recipe_id = recipe_ref.get("recipe_id")
        if recipe_id:
            try:
                recipe = await db.meals.find_one({"_id": ObjectId(recipe_id)})
                if recipe:
                    # Recalculate recipe price from its ingredients
                    calculated_price = await calculate_recipe_price(recipe)
                    recipe_ref["price"] = calculated_price
            except Exception:
                pass
    
    # Calculate total price from refreshed recipes
    meal["calculated_price"] = await calculate_meal_price(meal)
    # Calculate nutrition profile from recipes
    meal["nutrition_profile"] = await calculate_nutrition_profile(
        meal.get("recipes", []), "meals"
    )
    return meal

# CRUD endpoints for Recipes (admin)
@api_router.post("/recipes")
async def create_recipe(recipe_data: dict):
    """Create a new recipe (admin)"""
    recipe_doc = {
        "name": recipe_data["name"],
        "description": recipe_data.get("description", ""),
        "images": recipe_data.get("images", []),
        "ingredients": recipe_data["ingredients"],
        "tags": recipe_data.get("tags", []),
        "categories": recipe_data.get("categories", []),
        "created_by": recipe_data.get("created_by", "admin"),
        "is_preset": recipe_data.get("is_preset", True),
        "created_at": datetime.now(timezone.utc)
    }
    
    result = await db.meals.insert_one(recipe_doc)
    return {"message": "Recipe created", "id": str(result.inserted_id)}

@api_router.put("/recipes/{recipe_id}")
async def update_recipe(recipe_id: str, recipe_data: dict):
    """Update a recipe (admin)"""
    update_data = {
        "name": recipe_data["name"],
        "description": recipe_data["description"],
        "images": recipe_data.get("images", []),
        "ingredients": recipe_data["ingredients"],
        "tags": recipe_data.get("tags", []),
        "categories": recipe_data.get("categories", []),
        "created_by": recipe_data.get("created_by", "admin"),
        "updated_at": datetime.now(timezone.utc)
    }
    
    try:
        result = await db.meals.update_one(
            {"_id": ObjectId(recipe_id)},
            {"$set": update_data}
        )
    except Exception:
        raise HTTPException(status_code=404, detail="Recipe not found")
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Recipe not found")
    
    return {"message": "Recipe updated"}

@api_router.delete("/recipes/{recipe_id}")
async def delete_recipe(recipe_id: str):
    """Delete a recipe (admin)"""
    try:
        result = await db.meals.delete_one({"_id": ObjectId(recipe_id)})
    except Exception:
        raise HTTPException(status_code=404, detail="Recipe not found")
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Recipe not found")
    
    return {"message": "Recipe deleted"}

# CRUD endpoints for Meals (admin)
@api_router.post("/meals")
async def create_meal(meal_data: dict):
    """Create a new meal (combination of recipes - admin)"""
    meal_doc = {
        "name": meal_data["name"],
        "description": meal_data.get("description", ""),
        "images": meal_data.get("images", []),
        "recipes": meal_data["recipes"],
        "tags": meal_data.get("tags", []),
        "is_preset": meal_data.get("is_preset", True),
        "created_by": meal_data.get("created_by", "admin"),
        "created_at": datetime.now(timezone.utc)
    }
    
    result = await db.preset_meals.insert_one(meal_doc)
    return {"message": "Meal created", "id": str(result.inserted_id)}

@api_router.put("/meals/{meal_id}")
async def update_meal(meal_id: str, meal_data: dict):
    """Update a meal (admin)"""
    update_data = {
        "name": meal_data["name"],
        "description": meal_data.get("description", ""),
        "images": meal_data.get("images", []),
        "recipes": meal_data["recipes"],
        "tags": meal_data.get("tags", []),
        "is_preset": meal_data.get("is_preset", True),
        "created_by": meal_data.get("created_by", "admin"),
        "updated_at": datetime.now(timezone.utc)
    }
    
    try:
        result = await db.preset_meals.update_one(
            {"_id": ObjectId(meal_id)},
            {"$set": update_data}
        )
    except Exception:
        raise HTTPException(status_code=404, detail="Meal not found")
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Meal not found")
    
    return {"message": "Meal updated"}

@api_router.delete("/meals/{meal_id}")
async def delete_meal(meal_id: str):
    """Delete a meal (admin)"""
    try:
        result = await db.preset_meals.delete_one({"_id": ObjectId(meal_id)})
    except Exception:
        raise HTTPException(status_code=404, detail="Meal not found")
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Meal not found")
    
    return {"message": "Meal deleted"}



# Saved Recipes endpoints (for all users) - renamed from saved-meals
@api_router.post("/saved-recipes")
async def save_recipe(recipe_data: dict, request: Request):
    """Save a DIY recipe (all users)"""
    user = await get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    saved_recipe = {
        "user_id": user["_id"],
        "recipe_name": recipe_data.get("meal_name", recipe_data.get("recipe_name")),
        "ingredients": recipe_data["ingredients"],
        "total_price": recipe_data["total_price"],
        "created_at": datetime.now(timezone.utc)
    }
    
    result = await db.saved_recipes.insert_one(saved_recipe)
    return {"message": "Recipe saved", "id": str(result.inserted_id)}

@api_router.get("/saved-recipes")
async def get_saved_recipes(request: Request):
    """Get user's saved recipes with generated images from ingredients"""
    user = await get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    recipes = await db.saved_recipes.find({"user_id": user["_id"]}).to_list(100)
    
    # Enrich each recipe with images from ingredients
    for recipe in recipes:
        recipe["_id"] = str(recipe["_id"])
        
        # Generate images array from ingredient images
        images = []
        for ingredient in recipe.get("ingredients", []):
            ing_id = ingredient.get("ingredient_id")
            if ing_id:
                ing_data = await db.ingredients.find_one({"_id": ObjectId(ing_id)})
                if ing_data and ing_data.get("images"):
                    images.extend(ing_data["images"][:1])  # Take first image from each ingredient
                    if len(images) >= 4:  # Limit to 4 images
                        break
        
        recipe["images"] = images if images else []
    
    return recipes

# New Saved Meals endpoints (user-created meals from recipes)
@api_router.post("/saved-meals")
async def save_meal(meal_data: dict, request: Request):
    """Save a user-created meal (combination of recipes)"""
    user = await get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    saved_meal = {
        "user_id": user["_id"],
        "meal_name": meal_data.get("meal_name"),
        "recipes": meal_data.get("recipes", []),  # List of recipe references
        "total_price": meal_data.get("total_price"),
        "created_at": datetime.now(timezone.utc)
    }
    
    result = await db.user_meals.insert_one(saved_meal)
    return {"message": "Meal saved", "id": str(result.inserted_id)}

@api_router.get("/saved-meals")
async def get_saved_meals(request: Request):
    """Get user's saved meals (combinations of recipes)"""
    user = await get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    meals = await db.user_meals.find({"user_id": user["_id"]}).to_list(100)
    
    for meal in meals:
        meal["_id"] = str(meal["_id"])
        
        # Enrich with recipe data
        enriched_recipes = []
        for recipe_ref in meal.get("recipes", []):
            recipe_id = recipe_ref.get("recipe_id")
            if recipe_id:
                recipe_data = await db.meals.find_one({"_id": ObjectId(recipe_id)})
                if recipe_data:
                    enriched_recipes.append({
                        "recipe_id": recipe_id,
                        "name": recipe_data.get("name"),
                        "quantity": recipe_ref.get("quantity", 1),
                        "images": recipe_data.get("images", [])
                    })
        
        meal["enriched_recipes"] = enriched_recipes
    
    return meals

@api_router.delete("/saved-recipes/{recipe_id}")
async def delete_saved_recipe(recipe_id: str, request: Request):
    """Delete a saved meal"""
    user = await get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    result = await db.saved_meals.delete_one({
        "_id": ObjectId(meal_id),
        "guide_id": user["_id"]
    })
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Meal not found")
    
    return {"message": "Meal deleted"}

# Habit Logging endpoints
@api_router.post("/habits")
async def log_habit(habit_data: dict, request: Request):
    """Log a habit entry"""
    user = await get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    habit = {
        "user_id": user["_id"],
        "date": habit_data.get("date", datetime.now(timezone.utc).isoformat()),
        "habit_type": habit_data["habit_type"],  # meals, exercise, water, sleep, notes
        "description": habit_data.get("description", ""),
        "value": habit_data.get("value"),  # numeric value if applicable
        "unit": habit_data.get("unit"),  # cups, hours, servings, etc.
        "created_at": datetime.now(timezone.utc)
    }
    
    result = await db.habits.insert_one(habit)
    return {"message": "Habit logged", "id": str(result.inserted_id)}

@api_router.get("/habits")
async def get_habits(request: Request, user_id: Optional[str] = None):
    """Get habit logs for a user. If user_id provided, check if requester is their guide"""
    user = await get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    # If requesting own habits
    if not user_id or user_id == user["_id"]:
        target_user_id = user["_id"]
    else:
        # Check if requester is a guide of the target user
        target_user = await db.users.find_one({"_id": ObjectId(user_id)})
        if not target_user:
            raise HTTPException(status_code=404, detail="User not found")
        
        # Check if requester is in target user's guides list
        if user["_id"] not in target_user.get("guides", []):
            raise HTTPException(status_code=403, detail="Not authorized to view this user's habits")
        
        target_user_id = user_id
    
    habits = await db.habits.find({"user_id": target_user_id}).sort("date", -1).to_list(200)
    for habit in habits:
        habit["_id"] = str(habit["_id"])
    
    return habits

@api_router.get("/habits/user/{user_id}")
async def get_habits_by_user(user_id: str, request: Request):
    """Get all habits for a specific user (for guides viewing guidee timeline)"""
    user = await get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    print(f"Fetching habits for user_id: {user_id}")
    # Query with string user_id (habits store user_id as string, not ObjectId)
    habits = await db.habits.find({"user_id": user_id}).sort("date", -1).to_list(100)
    print(f"Found {len(habits)} habits")
    for habit in habits:
        habit["_id"] = str(habit["_id"])
    return habits

@api_router.delete("/habits/{habit_id}")
async def delete_habit(habit_id: str, request: Request):
    """Delete a habit entry"""
    user = await get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    try:
        result = await db.habits.delete_one({
            "_id": ObjectId(habit_id),
            "user_id": user["_id"]
        })
    except Exception as e:
        print(f"Error deleting habit: {e}")
        raise HTTPException(status_code=400, detail="Invalid habit ID")
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Habit not found or already deleted")
    
    return {"message": "Habit deleted successfully"}

# Following/Guides endpoints
@api_router.get("/following")
async def get_following(request: Request):
    """Get list of guides that the user follows with their ratings"""
    user = await get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    guide_ids = user.get("guides", [])
    guides = []
    
    for guide_id in guide_ids:
        try:
            guide = await db.users.find_one({"_id": ObjectId(guide_id)})
            if guide:
                guides.append({
                    "_id": str(guide["_id"]),
                    "name": guide.get("name", ""),
                    "email": guide.get("email", ""),
                    "star_rating": guide.get("star_rating", 0)
                })
        except Exception:
            continue
    
    return guides

@api_router.get("/guides/all")
async def get_all_guides(request: Request):
    """Get all users who are guides"""
    user = await get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    # Find all users with is_guide flag
    guides_cursor = db.users.find({"is_guide": True})
    guides = []
    
    async for guide in guides_cursor:
        guides.append({
            "_id": str(guide["_id"]),
            "name": guide.get("name", ""),
            "email": guide.get("email", ""),
            "star_rating": guide.get("star_rating", 0)
        })
    
    return guides

@api_router.get("/guides/guidees")
async def get_guidees(request: Request):
    """Get all guidees for the current guide"""
    user = await get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    if not user.get("is_guide"):
        return []
    
    # Get all users who have this guide in their guides list
    guidees_cursor = db.users.find({"guides": user["_id"]})
    guidees = []
    
    async for guidee in guidees_cursor:
        guidees.append({
            "_id": str(guidee["_id"]),
            "name": guidee.get("name", ""),
            "email": guidee.get("email", "")
        })
    
    return guidees

# Configuration endpoints
@api_router.get("/config/store-timings")
async def get_store_timings():
    """Get store opening and closing times"""
    config = await db.config.find_one({"type": "store_timings"})
    if not config:
        # Default timings
        return {
            "opening_time": "6:00 AM", 
            "closing_time": "9:00 PM",
            "preorder_before_time": 120,
            "preorder_cutoff_time": "10:00 PM"
        }
    return {
        "opening_time": config.get("opening_time"),
        "closing_time": config.get("closing_time"),
        "preorder_before_time": config.get("preorder_before_time", 120),
        "preorder_cutoff_time": config.get("preorder_cutoff_time", "10:00 PM")
    }

@api_router.put("/config/store-timings")
async def update_store_timings(timings: StoreTimingsConfig):
    """Update store timings (admin only)"""
    await db.config.update_one(
        {"type": "store_timings"},
        {"$set": {
            "type": "store_timings",
            "opening_time": timings.opening_time,
            "closing_time": timings.closing_time,
            "preorder_before_time": timings.preorder_before_time,
            "preorder_cutoff_time": timings.preorder_cutoff_time,
            "updated_at": datetime.now(timezone.utc)
        }},
        upsert=True
    )
    return {"success": True, "message": "Store timings updated"}

@api_router.get("/config/delivery")
async def get_delivery_config():
    """Get delivery configuration"""
    config = await db.config.find_one({"type": "delivery"})
    if not config:
        # Default delivery config
        return {"delivery_price": 50.0, "min_order_for_free_delivery": 500.0, "regular_order_ttd_minutes": 45}
    return {
        "delivery_price": config.get("delivery_price"),
        "min_order_for_free_delivery": config.get("min_order_for_free_delivery"),
        "regular_order_ttd_minutes": config.get("regular_order_ttd_minutes", config.get("ttd_regular_orders", 45))
    }

@api_router.put("/config/delivery")
async def update_delivery_config(delivery_config: DeliveryConfig):
    """Update delivery configuration (admin only)"""
    await db.config.update_one(
        {"type": "delivery"},
        {"$set": {
            "type": "delivery",
            "delivery_price": delivery_config.delivery_price,
            "min_order_for_free_delivery": delivery_config.min_order_for_free_delivery,
            "regular_order_ttd_minutes": delivery_config.regular_order_ttd_minutes,
            "updated_at": datetime.now(timezone.utc)
        }},
        upsert=True
    )
    return {"success": True, "message": "Delivery configuration updated"}

# Meal Plan endpoints
@api_router.post("/meal-plans")
async def create_meal_plan(request: Request, meal_plan_data: dict):
    """Create a meal plan request"""
    user = await get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    meal_plan = {
        "guidee_id": user["_id"],
        "guidee_name": user.get("name", ""),
        "guide_id": meal_plan_data.get("guide_id"),
        "guide_name": meal_plan_data.get("guide_name"),
        "plan_type": meal_plan_data["plan_type"],
        "start_date": meal_plan_data["start_date"],
        "meals_requested": meal_plan_data["meals_requested"],
        "goal": meal_plan_data.get("goal"),
        "status": "requested",
        "created_at": datetime.now(timezone.utc)
    }
    
    result = await db.meal_plans.insert_one(meal_plan)
    meal_plan["_id"] = str(result.inserted_id)
    return meal_plan

@api_router.get("/meal-plans")
async def get_meal_plans(request: Request):
    """Get meal plans for the logged-in user (only their own plans)"""
    user = await get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    # Get only plans where user is the guidee (creator)
    plans = await db.meal_plans.find({
        "guidee_id": user["_id"]
    }).sort("created_at", -1).to_list(100)
    
    for plan in plans:
        plan["_id"] = str(plan["_id"])
        plan["guidee_id"] = str(plan["guidee_id"])
        if plan.get("guide_id"):
            plan["guide_id"] = str(plan["guide_id"])
    
    return plans

@api_router.delete("/meal-plans/{plan_id}")
async def delete_meal_plan(request: Request, plan_id: str):
    """Delete a meal plan"""
    user = await get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    try:
        result = await db.meal_plans.delete_one({
            "_id": ObjectId(plan_id),
            "guidee_id": user["_id"]  # Only guidee can delete their own plans
        })
    except Exception as e:
        print(f"Error deleting meal plan: {e}")
        raise HTTPException(status_code=400, detail="Invalid plan ID")
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Plan not found or unauthorized")
    
    return {"message": "Plan deleted successfully"}

@api_router.get("/meal-plans/guide")
async def get_guide_meal_plans(request: Request):
    """Get meal plans for a guide (plans where they are the guide)"""
    user = await get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    # Get plans where user is the guide
    plans = await db.meal_plans.find({
        "guide_id": user["_id"]
    }).sort("created_at", -1).to_list(100)
    
    for plan in plans:
        plan["_id"] = str(plan["_id"])
        plan["guidee_id"] = str(plan["guidee_id"])
        if plan.get("guide_id"):
            plan["guide_id"] = str(plan["guide_id"])
    
    return plans

@api_router.put("/meal-plans/{plan_id}/accept")
async def accept_meal_plan(request: Request, plan_id: str):
    """Accept a meal plan request (guide only)"""
    user = await get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    try:
        result = await db.meal_plans.update_one(
            {
                "_id": ObjectId(plan_id),
                "guide_id": user["_id"],
                "status": "requested"
            },
            {
                "$set": {
                    "status": "accepted",
                    "updated_at": datetime.now(timezone.utc)
                }
            }
        )
    except Exception as e:
        print(f"Error accepting meal plan: {e}")
        raise HTTPException(status_code=400, detail="Invalid plan ID")
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Plan not found or already accepted")
    
    return {"message": "Plan accepted successfully"}

@api_router.put("/meal-plans/{plan_id}/save-progress")
async def save_meal_plan_progress(request: Request, plan_id: str, data: dict):
    """Save planning progress for a meal plan (guide only)"""
    user = await get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    try:
        result = await db.meal_plans.update_one(
            {
                "_id": ObjectId(plan_id),
                "guide_id": user["_id"]
            },
            {
                "$set": {
                    "logged_meals": data.get("logged_meals", {}),
                    "status": "planning",
                    "updated_at": datetime.now(timezone.utc)
                }
            }
        )
    except Exception as e:
        print(f"Error saving meal plan progress: {e}")
        raise HTTPException(status_code=400, detail="Invalid plan ID")
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Plan not found or unauthorized")
    
    return {"message": "Progress saved successfully"}

@api_router.put("/meal-plans/{plan_id}/submit")
async def submit_meal_plan(request: Request, plan_id: str, data: dict):
    """Submit completed meal plan (guide only)"""
    user = await get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    try:
        result = await db.meal_plans.update_one(
            {
                "_id": ObjectId(plan_id),
                "guide_id": user["_id"]
            },
            {
                "$set": {
                    "logged_meals": data.get("logged_meals", {}),
                    "status": "submitted",
                    "updated_at": datetime.now(timezone.utc)
                }
            }
        )
    except Exception as e:
        print(f"Error submitting meal plan: {e}")
        raise HTTPException(status_code=400, detail="Invalid plan ID")
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Plan not found or unauthorized")
    
    return {"message": "Plan submitted successfully"}

# Delivery Agent endpoints
@api_router.get("/delivery-agents")
async def get_delivery_agents():
    """Get all delivery agents"""
    agents = await db.delivery_agents.find().to_list(1000)
    for agent in agents:
        agent["_id"] = str(agent["_id"])
    return agents

@api_router.post("/delivery-agents")
async def create_delivery_agent(agent_data: dict):
    """Create a new delivery agent (admin endpoint)"""
    # Check if user with this email already exists
    existing_user = await db.users.find_one({"email": agent_data["email"]})
    
    agent = {
        "email": agent_data["email"],
        "name": agent_data["name"],
        "contact_number": agent_data.get("contact_number", ""),
        "vehicle": agent_data["vehicle"],
        "vehicle_number": agent_data["vehicle_number"],
        "image": agent_data.get("image"),
        "status": "available",
        "payment_per_delivery": float(agent_data.get("payment_per_delivery", 0)),
        "wallet_balance": 0.0,
        "is_delivery_agent": True,
        "created_at": datetime.now(timezone.utc)
    }
    
    result = await db.delivery_agents.insert_one(agent)
    
    # Also mark user as delivery agent if they exist
    if existing_user:
        await db.users.update_one(
            {"_id": existing_user["_id"]},
            {"$set": {"is_delivery_agent": True}}
        )
    
    return {"message": "Delivery agent created", "id": str(result.inserted_id)}

@api_router.put("/delivery-agents/{agent_id}")
async def update_delivery_agent(agent_id: str, agent_data: dict):
    """Update delivery agent details (admin endpoint)"""
    update_data = {}
    if "name" in agent_data:
        update_data["name"] = agent_data["name"]
    if "email" in agent_data:
        update_data["email"] = agent_data["email"]
    if "contact_number" in agent_data:
        update_data["contact_number"] = agent_data["contact_number"]
    if "vehicle" in agent_data:
        update_data["vehicle"] = agent_data["vehicle"]
    if "vehicle_number" in agent_data:
        update_data["vehicle_number"] = agent_data["vehicle_number"]
    if "image" in agent_data:
        update_data["image"] = agent_data["image"]
    if "status" in agent_data:
        update_data["status"] = agent_data["status"]
    if "payment_per_delivery" in agent_data:
        update_data["payment_per_delivery"] = float(agent_data["payment_per_delivery"])
    
    await db.delivery_agents.update_one(
        {"_id": ObjectId(agent_id)},
        {"$set": update_data}
    )
    
    return {"message": "Delivery agent updated"}

@api_router.put("/delivery-agents/{agent_id}/status")
async def update_agent_status(agent_id: str, status_data: dict, request: Request):
    """Update delivery agent status (available/busy/offline)"""
    user = await get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    # Check if user is the agent or admin
    agent = await db.delivery_agents.find_one({"_id": ObjectId(agent_id)})
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    
    if agent["email"] != user["email"] and not user.get("is_admin"):
        raise HTTPException(status_code=403, detail="Not authorized")
    
    await db.delivery_agents.update_one(
        {"_id": ObjectId(agent_id)},
        {"$set": {"status": status_data["status"]}}
    )
    
    return {"message": "Status updated"}

@api_router.delete("/delivery-agents/{agent_id}")
async def delete_delivery_agent(agent_id: str, request: Request):
    """Delete a delivery agent"""
    user = await get_current_user(request)
    if not user or not user.get("is_admin"):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    result = await db.delivery_agents.delete_one({"_id": ObjectId(agent_id)})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Agent not found")
    
    return {"message": "Delivery agent deleted"}

@api_router.get("/delivery-agents/my-orders")
async def get_agent_orders(request: Request):
    """Get orders assigned to logged-in delivery agent"""
    user = await get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    # Find agent by email
    agent = await db.delivery_agents.find_one({"email": user["email"]})
    if not agent:
        raise HTTPException(status_code=404, detail="Not a delivery agent")
    
    # Get assigned orders
    orders = await db.orders.find({"assigned_agent_id": str(agent["_id"])}).sort("created_at", -1).to_list(100)
    for order in orders:
        order["_id"] = str(order["_id"])
        
        # Fetch user details for each order
        order_user = await db.users.find_one({"_id": ObjectId(order["user_id"])})
        if order_user:
            order["user_name"] = order_user.get("name", "Unknown")
            order["user_email"] = order_user.get("email", "")
        else:
            order["user_name"] = "Unknown User"
            order["user_email"] = ""
    
    return orders

@api_router.put("/orders/{order_id}/undo-delivery")
async def undo_order_delivery(order_id: str, request: Request):
    """Undo a delivery - move back to out_for_delivery and remove credit"""
    user = await get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    # Get the order
    order = await db.orders.find_one({"_id": ObjectId(order_id)})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    # Verify the logged-in user is the assigned delivery agent
    agent = await db.delivery_agents.find_one({"email": user["email"]})
    if not agent or str(agent["_id"]) != order.get("assigned_agent_id"):
        raise HTTPException(status_code=403, detail="Not authorized - you are not the assigned agent")
    
    # Must be delivered to undo
    if order["status"] != "delivered":
        raise HTTPException(status_code=400, detail="Order is not in delivered status")
    
    # Move order back to out_for_delivery status - keeps agent assignment
    # This way it shows in agent's "Assigned" tab but backend shows "out_for_delivery"
    await db.orders.update_one(
        {"_id": ObjectId(order_id)},
        {"$set": {
            "status": "out_for_delivery",
            "delivered_at": None
        }}
    )
    
    # Remove the delivery credit if it exists
    await db.delivery_credits.delete_many({
        "agent_id": str(agent["_id"]),
        "order_id": order_id
    })
    
    # Update agent's wallet balance - subtract the payment
    payment_amount = agent.get("payment_per_delivery", 0)
    current_balance = agent.get("wallet_balance", 0)
    new_balance = max(0, current_balance - payment_amount)
    
    await db.delivery_agents.update_one(
        {"_id": agent["_id"]},
        {"$set": {"wallet_balance": new_balance}}
    )
    
    return {"message": "Delivery undone successfully", "order_status": "out_for_delivery"}



@api_router.get("/delivery-agents/check")
async def check_delivery_agent(request: Request):
    """Check if logged-in user is a delivery agent"""
    user = await get_current_user(request)
    if not user:
        return {"is_delivery_agent": False, "agent": None}
    
    agent = await db.delivery_agents.find_one({"email": user["email"]})
    if agent:
        agent["_id"] = str(agent["_id"])
        return {"is_delivery_agent": True, "agent": agent}
    
    return {"is_delivery_agent": False, "agent": None}

@api_router.get("/delivery-agents/credits")
async def get_delivery_credits(request: Request):
    """Get credit history for logged-in delivery agent"""
    user = await get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    # Find agent by email
    agent = await db.delivery_agents.find_one({"email": user["email"]})
    if not agent:
        raise HTTPException(status_code=404, detail="Not a delivery agent")
    
    # Get credit history
    credits = await db.delivery_credits.find({"agent_email": user["email"]}).sort("created_at", -1).to_list(100)
    for credit in credits:
        credit["_id"] = str(credit["_id"])
    
    return {"credits": credits, "total_balance": agent.get("wallet_balance", 0)}


# Order Management endpoints
@api_router.put("/orders/{order_id}/status")
async def update_order_status(order_id: str, status_data: dict, request: Request):
    """Update order status"""
    user = await get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    new_status = status_data["status"]
    current_time = get_ist_time()
    update_data = {"status": new_status}
    
    # Get the order
    order = await db.orders.find_one({"_id": ObjectId(order_id)})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    # Initialize delivery_status_timestamp if not exists
    if "delivery_status_timestamp" not in order:
        order["delivery_status_timestamp"] = {}
    
    # Track status change timestamp
    update_data["delivery_status_timestamp"] = order.get("delivery_status_timestamp", {})
    update_data["delivery_status_timestamp"][new_status] = current_time.isoformat()
    
    # If status is accepted, set accepted_at for TTD calculation
    if new_status == "accepted":
        update_data["accepted_at"] = current_time
    
    # If status is delivered, calculate TTD snapshot and set actual delivery time
    if new_status == "delivered":
        update_data["delivered_at"] = current_time
        update_data["actual_delivery_time"] = current_time
        
        # Calculate TTD snapshot (remaining time at delivery)
        if order.get("is_preorder"):
            # For preorders, expected time is preorder_time
            if order.get("preorder_date") and order.get("preorder_time"):
                from datetime import datetime as dt
                preorder_datetime_str = f"{order['preorder_date']} {order['preorder_time']}"
                try:
                    expected_time = dt.strptime(preorder_datetime_str, "%Y-%m-%d %I:%M %p")
                    # Convert to timezone-aware datetime in IST
                    ist_offset = timedelta(hours=5, minutes=30)
                    expected_time = expected_time.replace(tzinfo=timezone.utc) + ist_offset
                    
                    # Calculate remaining minutes
                    time_diff = (expected_time - current_time).total_seconds() / 60
                    update_data["ttd_minutes_snapshot"] = int(time_diff)
                except:
                    update_data["ttd_minutes_snapshot"] = 0
        else:
            # For regular orders, expected time is accepted_at + regular_order_ttd_minutes
            if order.get("accepted_at"):
                # Get delivery config for TTD minutes
                delivery_config = await db.config.find_one({"type": "delivery"})
                ttd_minutes = 45  # default
                if delivery_config:
                    ttd_minutes = delivery_config.get("regular_order_ttd_minutes", delivery_config.get("ttd_regular_orders", 45))
                
                accepted_at = order["accepted_at"]
                if isinstance(accepted_at, str):
                    from datetime import datetime as dt
                    accepted_at = dt.fromisoformat(accepted_at.replace('Z', '+00:00'))
                
                expected_time = accepted_at + timedelta(minutes=ttd_minutes)
                time_diff = (expected_time - current_time).total_seconds() / 60
                update_data["ttd_minutes_snapshot"] = int(time_diff)
        
        # Credit the delivery agent
        if order.get("assigned_agent_id"):
            agent = await db.delivery_agents.find_one({"_id": ObjectId(order["assigned_agent_id"])})
            if agent:
                payment_amount = agent.get("payment_per_delivery", 0)
                
                # Update agent wallet balance
                await db.delivery_agents.update_one(
                    {"_id": ObjectId(order["assigned_agent_id"])},
                    {"$inc": {"wallet_balance": payment_amount}}
                )
                
                # Record the credit transaction
                credit_record = {
                    "agent_email": agent["email"],
                    "agent_id": str(agent["_id"]),
                    "order_id": str(order["_id"]),
                    "amount": payment_amount,
                    "created_at": current_time
                }
                await db.delivery_credits.insert_one(credit_record)
    
    await db.orders.update_one(
        {"_id": ObjectId(order_id)},
        {"$set": update_data}
    )
    
    return {"message": "Order status updated"}

@api_router.put("/orders/{order_id}/assign-agent")
async def assign_delivery_agent(order_id: str, assignment_data: dict, request: Request):
    """Assign delivery agent to order"""
    user = await get_current_user(request)
    if not user or not user.get("is_admin"):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    agent_id = assignment_data["agent_id"]
    
    # Verify agent exists and is available
    agent = await db.delivery_agents.find_one({"_id": ObjectId(agent_id)})
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    
    # Update order with assigned agent
    await db.orders.update_one(
        {"_id": ObjectId(order_id)},
        {"$set": {
            "assigned_agent_id": agent_id,
            "agent_assigned_at": datetime.now(timezone.utc),
            "status": "out_for_delivery"
        }}
    )
    
    # Update agent status to busy
    await db.delivery_agents.update_one(
        {"_id": ObjectId(agent_id)},
        {"$set": {"status": "busy"}}
    )
    
    return {"message": "Agent assigned successfully"}

@api_router.get("/orders/by-status/{status}")
async def get_orders_by_status(status: str):
    """Get orders filtered by status (admin endpoint)"""
    orders = await db.orders.find({"status": status}).sort("created_at", -1).to_list(100)
    for order in orders:
        order["_id"] = str(order["_id"])
        # Get user info
        user_data = await db.users.find_one({"_id": ObjectId(order["user_id"])})
        if user_data:
            order["user_name"] = user_data.get("name", "Unknown")
            order["user_email"] = user_data.get("email", "")
        # Get agent info if assigned
        if order.get("assigned_agent_id"):
            agent_data = await db.delivery_agents.find_one({"_id": ObjectId(order["assigned_agent_id"])})
            if agent_data:
                order["agent_name"] = agent_data.get("name", "Unknown")
    
    return orders

# Address endpoints
@api_router.post("/addresses")
async def add_address(address_data: dict, request: Request):
    """Add a new address"""
    user = await get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    # Get current user document
    user_doc = await db.users.find_one({"_id": ObjectId(user["_id"])})
    
    # Initialize addresses array if it doesn't exist
    if "addresses" not in user_doc or user_doc["addresses"] is None:
        await db.users.update_one(
            {"_id": ObjectId(user["_id"])},
            {"$set": {"addresses": []}}
        )
    
    # If this is set as default, unset other defaults
    if address_data.get("is_default"):
        await db.users.update_one(
            {"_id": ObjectId(user["_id"])},
            {"$set": {"addresses.$[].is_default": False}}
        )
    
    # Add the new address
    result = await db.users.update_one(
        {"_id": ObjectId(user["_id"])},
        {"$push": {"addresses": address_data}}
    )
    
    return {"message": "Address added"}

@api_router.get("/addresses")
async def get_addresses(request: Request):
    """Get user's addresses"""
    user = await get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    user_data = await db.users.find_one({"_id": ObjectId(user["_id"])})
    return user_data.get("addresses", [])

@api_router.delete("/addresses/{address_index}")
async def delete_address(address_index: int, request: Request):
    """Delete an address"""
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

@api_router.put("/addresses/{address_index}/default")
async def set_default_address(address_index: int, request: Request):
    """Set an address as default"""
    user = await get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    user_data = await db.users.find_one({"_id": ObjectId(user["_id"])})
    addresses = user_data.get("addresses", [])
    
    if address_index >= len(addresses):
        raise HTTPException(status_code=404, detail="Address not found")
    
    # Unset all defaults
    for addr in addresses:
        addr["is_default"] = False
    
    # Set new default
    addresses[address_index]["is_default"] = True
    
    await db.users.update_one(
        {"_id": ObjectId(user["_id"])},
        {"$set": {"addresses": addresses}}
    )
    
    return {"message": "Default address updated"}

# Coupon endpoints
@api_router.post("/coupons/validate")
async def validate_coupon(coupon_data: dict):
    """Validate a coupon code"""
    coupon_code = coupon_data.get("code", "").upper()
    order_value = coupon_data.get("order_value", 0)
    
    coupon = await db.coupons.find_one({
        "code": coupon_code,
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
        "final_price": max(0, order_value - discount),
        "coupon_code": coupon_code
    }

# Withdrawal request endpoints
@api_router.post("/withdrawals")
async def create_withdrawal_request(withdrawal_data: dict, request: Request):
    """Create a withdrawal request (guides only)"""
    user = await get_current_user(request)
    if not user or not user.get("is_guide"):
        raise HTTPException(status_code=403, detail="Only guides can request withdrawals")
    
    amount = withdrawal_data.get("amount", 0)
    
    # Check if user has sufficient balance
    if user.get("commission_balance", 0) < amount:
        raise HTTPException(status_code=400, detail="Insufficient balance")
    
    withdrawal = {
        "guide_id": user["_id"],
        "guide_name": user["name"],
        "amount": amount,
        "status": "pending",
        "created_at": datetime.now(timezone.utc),
        "processed_at": None
    }
    
    result = await db.withdrawal_requests.insert_one(withdrawal)
    return {"message": "Withdrawal request submitted", "id": str(result.inserted_id)}

@api_router.get("/withdrawals")
async def get_my_withdrawals(request: Request):
    """Get guide's withdrawal requests"""
    user = await get_current_user(request)
    if not user or not user.get("is_guide"):
        raise HTTPException(status_code=403, detail="Only guides can view withdrawals")
    
    withdrawals = await db.withdrawal_requests.find({"guide_id": user["_id"]}).to_list(100)
    for w in withdrawals:
        w["_id"] = str(w["_id"])
    return withdrawals

# Guide ordering for guidees
@api_router.get("/my-guidees")
async def get_my_guidees(request: Request):
    """Get list of guide's guidees"""
    user = await get_current_user(request)
    if not user or not user.get("is_guide"):
        raise HTTPException(status_code=403, detail="Only guides can view guidees")
    
    guidee_ids = user.get("guidees", [])
    guidees = []
    
    for guidee_id in guidee_ids:
        guidee = await db.users.find_one({"_id": ObjectId(guidee_id)})
        if guidee:
            guidees.append({
                "_id": str(guidee["_id"]),
                "name": guidee["name"],
                "email": guidee["email"],
                "picture": guidee.get("picture")
            })
    
    return guidees

# Cart endpoints
@api_router.get("/cart")
async def get_cart(request: Request):
    """Get user's cart"""
    user = await get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    cart = await db.carts.find_one({"user_id": user["_id"]})
    if not cart:
        cart = {"user_id": user["_id"], "items": []}
    else:
        cart["_id"] = str(cart["_id"])
    return cart

@api_router.post("/cart")
async def add_to_cart(item: CartItem, request: Request):
    """Add item to cart"""
    user = await get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    cart = await db.carts.find_one({"user_id": user["_id"]})
    
    if not cart:
        cart = Cart(user_id=user["_id"], items=[item.dict()])
        await db.carts.insert_one(cart.dict())
    else:
        await db.carts.update_one(
            {"user_id": user["_id"]},
            {"$push": {"items": item.dict()}, "$set": {"updated_at": datetime.now(timezone.utc)}}
        )
    
    return {"message": "Item added to cart"}

@api_router.delete("/cart/{item_index}")
async def remove_from_cart(item_index: int, request: Request):
    """Remove item from cart"""
    user = await get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    cart = await db.carts.find_one({"user_id": user["_id"]})
    if cart and len(cart.get("items", [])) > item_index:
        items = cart["items"]
        items.pop(item_index)
        await db.carts.update_one(
            {"user_id": user["_id"]},
            {"$set": {"items": items, "updated_at": datetime.now(timezone.utc)}}
        )
    
    return {"message": "Item removed from cart"}


@api_router.put("/cart/{item_index}")
async def update_cart_quantity(item_index: int, quantity_data: dict, request: Request):
    """Update item quantity in cart"""
    user = await get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    quantity = quantity_data.get("quantity", 1)
    if quantity < 1:
        raise HTTPException(status_code=400, detail="Quantity must be at least 1")
    
    cart = await db.carts.find_one({"user_id": user["_id"]})
    if cart and len(cart.get("items", [])) > item_index:
        items = cart["items"]
        items[item_index]["quantity"] = quantity
        await db.carts.update_one(
            {"user_id": user["_id"]},
            {"$set": {"items": items, "updated_at": datetime.now(timezone.utc)}}
        )
        return {"message": "Quantity updated"}
    
    raise HTTPException(status_code=404, detail="Item not found in cart")

@api_router.delete("/cart")
async def clear_cart(request: Request):
    """Clear cart"""
    user = await get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    await db.carts.update_one(
        {"user_id": user["_id"]},
        {"$set": {"items": [], "updated_at": datetime.now(timezone.utc)}}
    )
    
    return {"message": "Cart cleared"}

# Order endpoints
@api_router.post("/orders")
async def create_order(order_data: dict, request: Request):
    """Create an order"""
    user = await get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    # Calculate final price with discount
    total_price = order_data["total_price"]
    discount_amount = order_data.get("discount_amount", 0.0)
    final_price = total_price - discount_amount
    
    # Check if guide is ordering for guidee
    ordered_by_guide_id = order_data.get("ordered_by_guide_id")
    ordered_for_guidee_id = order_data.get("ordered_for_guidee_id")
    meal_plan_id = order_data.get("meal_plan_id")
    commission_earned = 0.0
    commission_rate = 0.0
    guide_id_for_commission = None
    
    # Calculate commission if guide is ordering for guidee (direct order)
    if ordered_by_guide_id and ordered_for_guidee_id:
        guide_id_for_commission = ordered_by_guide_id
    
    # Calculate commission if guidee ordered from a meal plan submitted by their guide
    elif meal_plan_id:
        meal_plan = await db.meal_plans.find_one({"_id": ObjectId(meal_plan_id)})
        if meal_plan and meal_plan.get("guide_id"):
            guide_id_for_commission = meal_plan["guide_id"]
    
    # If we have a guide to credit commission to
    if guide_id_for_commission:
        guide = await db.users.find_one({"_id": ObjectId(guide_id_for_commission)})
        if guide and guide.get("is_guide"):
            star_rating = guide.get("star_rating", 0)
            commission_rate = await calculate_commission_rate(star_rating)
            commission_earned = (final_price * commission_rate) / 100
            
            # Update guide's commission balance
            await db.users.update_one(
                {"_id": ObjectId(guide_id_for_commission)},
                {"$inc": {"commission_balance": commission_earned}}
            )
    
    # Transform address from User Address format to Order Address format
    def transform_address(addr):
        return {
            "name": addr.get("label", ""),
            "street": addr.get("full_address", ""),
            "city": addr.get("city", ""),
            "state": addr.get("state", ""),
            "zip_code": addr.get("pincode", ""),
            "phone": addr.get("phone", "")
        }
    
    billing_address = transform_address(order_data["billing_address"])
    shipping_address = transform_address(order_data["shipping_address"])
    
    # Check if this is a preorder
    is_preorder = order_data.get("is_preorder", False)
    preorder_date = order_data.get("preorder_date")
    preorder_time = order_data.get("preorder_time")
    delivery_charge = order_data.get("delivery_charge", 0.0)
    
    order = Order(
        user_id=ordered_for_guidee_id if ordered_for_guidee_id else user["_id"],
        items=order_data["items"],
        total_price=total_price,
        discount_amount=discount_amount,
        coupon_code=order_data.get("coupon_code"),
        delivery_charge=delivery_charge,
        final_price=final_price + delivery_charge,
        billing_address=billing_address,
        shipping_address=shipping_address,
        payment_id=order_data.get("payment_id"),
        ordered_by_guide_id=ordered_by_guide_id,
        ordered_for_guidee_id=ordered_for_guidee_id,
        meal_plan_id=meal_plan_id,
        commission_earned=commission_earned,
        commission_rate=commission_rate,
        is_preorder=is_preorder,
        preorder_date=preorder_date,
        preorder_time=preorder_time,
        status="arrived"  # Preorders still start at arrived but can be filtered by is_preorder flag
    )
    
    result = await db.orders.insert_one(order.dict())
    
    # Clear cart
    await db.carts.update_one(
        {"user_id": user["_id"]},
        {"$set": {"items": []}}
    )
    
    return {
        "message": "Order created",
        "id": str(result.inserted_id),
        "commission_earned": commission_earned if commission_earned > 0 else None
    }

@api_router.get("/orders")
async def get_orders(request: Request):
    """Get user's orders"""
    user = await get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    orders = await db.orders.find({"user_id": user["_id"]}).sort("created_at", -1).to_list(100)
    for order in orders:
        order["_id"] = str(order["_id"])
    return orders

# Admin endpoints
@api_router.post("/admin/ingredients")
async def create_ingredient(ingredient: Ingredient, request: Request):
    """Create ingredient (admin only)"""
    result = await db.ingredients.insert_one(ingredient.dict())
    return {"message": "Ingredient created", "id": str(result.inserted_id)}

@api_router.put("/admin/ingredients/{ingredient_id}")
async def update_ingredient(ingredient_id: str, ingredient: Ingredient, request: Request):
    """Update ingredient (admin only)"""
    result = await db.ingredients.update_one(
        {"_id": ObjectId(ingredient_id)},
        {"$set": ingredient.dict()}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Ingredient not found")
    return {"message": "Ingredient updated"}

@api_router.delete("/admin/ingredients/{ingredient_id}")
async def delete_ingredient(ingredient_id: str, request: Request):
    """Delete ingredient (admin only)"""
    result = await db.ingredients.delete_one({"_id": ObjectId(ingredient_id)})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Ingredient not found")
    return {"message": "Ingredient deleted"}

@api_router.post("/admin/meals")
async def create_meal(meal: Meal, request: Request):
    """Create meal (admin only)"""
    result = await db.meals.insert_one(meal.dict())
    return {"message": "Meal created", "id": str(result.inserted_id)}

@api_router.put("/admin/meals/{meal_id}")
async def update_meal(meal_id: str, meal: Meal, request: Request):
    """Update meal (admin only)"""
    result = await db.meals.update_one(
        {"_id": ObjectId(meal_id)},
        {"$set": meal.dict()}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Meal not found")
    return {"message": "Meal updated"}

@api_router.delete("/admin/meals/{meal_id}")
async def delete_meal(meal_id: str, request: Request):
    """Delete meal (admin only)"""
    result = await db.meals.delete_one({"_id": ObjectId(meal_id)})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Meal not found")
    return {"message": "Meal deleted"}

@api_router.get("/admin/orders")
async def get_all_orders(request: Request):
    """Get all orders (admin only) with user details"""
    orders = await db.orders.find().sort("created_at", -1).to_list(1000)
    
    for order in orders:
        order["_id"] = str(order["_id"])
        
        # Fetch user details
        user = await db.users.find_one({"_id": ObjectId(order["user_id"])})
        if user:
            order["user_name"] = user.get("name", "Unknown")
            order["user_email"] = user.get("email", "")
        else:
            order["user_name"] = "Unknown User"
            order["user_email"] = ""
        
        # If ordered by guide for guidee, add those details
        if order.get("ordered_by_guide_id"):
            guide = await db.users.find_one({"_id": ObjectId(order["ordered_by_guide_id"])})
            if guide:
                order["guide_name"] = guide.get("name", "Unknown")
        
        if order.get("ordered_for_guidee_id"):
            guidee = await db.users.find_one({"_id": ObjectId(order["ordered_for_guidee_id"])})
            if guidee:
                order["guidee_name"] = guidee.get("name", "Unknown")
    
    return orders

@api_router.get("/admin/orders/{order_id}")
async def get_single_order(order_id: str, request: Request):
    """Get a single order by ID with full details (admin only)"""
    order = await db.orders.find_one({"_id": ObjectId(order_id)})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    order["_id"] = str(order["_id"])
    
    # Fetch user details
    user = await db.users.find_one({"_id": ObjectId(order["user_id"])})
    if user:
        order["user_name"] = user.get("name", "Unknown")
        order["user_email"] = user.get("email", "")
    else:
        order["user_name"] = "Unknown User"
        order["user_email"] = ""
    
    # If assigned to agent, get agent details
    if order.get("assigned_agent_id"):
        agent = await db.delivery_agents.find_one({"_id": ObjectId(order["assigned_agent_id"])})
        if agent:
            order["agent_name"] = agent.get("name", "Unknown")
    
    return order

@api_router.put("/admin/orders/{order_id}")
async def update_order_status(order_id: str, status_data: dict, request: Request):
    """Update order status (admin only)"""
    await db.orders.update_one(
        {"_id": ObjectId(order_id)},
        {"$set": {"status": status_data["status"]}}
    )
    return {"message": "Order status updated"}


@api_router.delete("/admin/orders/{order_id}")
async def delete_order(order_id: str, request: Request):
    """Delete an order (admin only)"""
    result = await db.orders.delete_one({"_id": ObjectId(order_id)})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Order not found")
    return {"message": "Order deleted"}


@api_router.get("/admin/users")
async def get_all_users():
    """Get all users for admin panel"""
    users = await db.users.find().to_list(1000)
    for user in users:
        user["_id"] = str(user["_id"])
    return users


@api_router.put("/admin/orders/{order_id}/status")
async def admin_update_order_status(order_id: str, status_data: dict):
    """Update order status (admin endpoint - no auth required)"""
    new_status = status_data["status"]
    current_time = get_ist_time()
    update_data = {"status": new_status}
    
    # Get the order
    order = await db.orders.find_one({"_id": ObjectId(order_id)})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    # Initialize delivery_status_timestamp if not exists
    if "delivery_status_timestamp" not in order:
        order["delivery_status_timestamp"] = {}
    
    # Track status change timestamp
    update_data["delivery_status_timestamp"] = order.get("delivery_status_timestamp", {})
    update_data["delivery_status_timestamp"][new_status] = current_time.isoformat()
    
    # If status is accepted, set accepted_at for TTD calculation
    if new_status == "accepted":
        update_data["accepted_at"] = current_time
    
    # If status is delivered, calculate TTD snapshot and set actual delivery time
    if new_status == "delivered":
        update_data["delivered_at"] = current_time
        update_data["actual_delivery_time"] = current_time
        
        # Calculate TTD snapshot (remaining time at delivery)
        if order.get("is_preorder"):
            # For preorders, expected time is preorder_time
            # Parse preorder date and time to calculate expected delivery datetime
            if order.get("preorder_date") and order.get("preorder_time"):
                from datetime import datetime as dt
                preorder_datetime_str = f"{order['preorder_date']} {order['preorder_time']}"
                try:
                    expected_time = dt.strptime(preorder_datetime_str, "%Y-%m-%d %I:%M %p")
                    # Convert to timezone-aware datetime in IST
                    ist_offset = timedelta(hours=5, minutes=30)
                    expected_time = expected_time.replace(tzinfo=timezone.utc) + ist_offset
                    
                    # Calculate remaining minutes
                    time_diff = (expected_time - current_time).total_seconds() / 60
                    update_data["ttd_minutes_snapshot"] = int(time_diff)
                except:
                    update_data["ttd_minutes_snapshot"] = 0
        else:
            # For regular orders, expected time is accepted_at + regular_order_ttd_minutes
            if order.get("accepted_at"):
                # Get delivery config for TTD minutes
                delivery_config = await db.config.find_one({"type": "delivery"})
                ttd_minutes = 45  # default
                if delivery_config:
                    ttd_minutes = delivery_config.get("regular_order_ttd_minutes", delivery_config.get("ttd_regular_orders", 45))
                
                accepted_at = order["accepted_at"]
                if isinstance(accepted_at, str):
                    from datetime import datetime as dt
                    accepted_at = dt.fromisoformat(accepted_at.replace('Z', '+00:00'))
                
                expected_time = accepted_at + timedelta(minutes=ttd_minutes)
                time_diff = (expected_time - current_time).total_seconds() / 60
                update_data["ttd_minutes_snapshot"] = int(time_diff)
        
        # Credit the delivery agent
        if order.get("assigned_agent_id"):
            agent = await db.delivery_agents.find_one({"_id": ObjectId(order["assigned_agent_id"])})
            if agent:
                payment_amount = agent.get("payment_per_delivery", 0)
                
                # Update agent wallet balance
                await db.delivery_agents.update_one(
                    {"_id": ObjectId(order["assigned_agent_id"])},
                    {"$inc": {"wallet_balance": payment_amount}}
                )
                
                # Record the credit transaction
                credit_record = {
                    "agent_email": agent["email"],
                    "agent_id": str(agent["_id"]),
                    "order_id": str(order["_id"]),
                    "amount": payment_amount,
                    "created_at": datetime.now(timezone.utc)
                }
                await db.delivery_credits.insert_one(credit_record)
    
    await db.orders.update_one(
        {"_id": ObjectId(order_id)},
        {"$set": update_data}
    )
    
    return {"message": "Order status updated"}

@api_router.put("/admin/orders/{order_id}/assign-agent")
async def admin_assign_delivery_agent(order_id: str, assignment_data: dict):
    """Assign delivery agent to order (admin endpoint - no auth required)"""
    agent_id = assignment_data["agent_id"]
    
    # Verify agent exists
    agent = await db.delivery_agents.find_one({"_id": ObjectId(agent_id)})
    if not agent:
        raise HTTPException(status_code=404, detail="Delivery agent not found")
    
    # Update order with agent assignment
    await db.orders.update_one(
        {"_id": ObjectId(order_id)},
        {"$set": {
            "assigned_agent_id": agent_id,
            "agent_name": agent["name"],
            "delivery_agent_status": "assigned"
        }}
    )
    
    return {"message": "Agent assigned successfully"}

async def get_all_users(request: Request):
    """Get all users (admin only)"""
    users = await db.users.find().to_list(1000)
    for user in users:
        user["_id"] = str(user["_id"])
    return users

@api_router.put("/admin/users/{user_id}/points")
async def update_user_points(user_id: str, points_data: dict, request: Request):
    """Update user inherent points (admin only)"""
    await db.users.update_one(
        {"_id": ObjectId(user_id)},
        {"$set": {"inherent_points": points_data["inherent_points"]}}
    )
    
    # Recalculate total points and star rating
    user = await db.users.find_one({"_id": ObjectId(user_id)})
    total_points = user["points"] + user["inherent_points"]
    new_rating = await calculate_star_rating(total_points)
    is_guide = new_rating >= 1
    
    await db.users.update_one(
        {"_id": ObjectId(user_id)},
        {"$set": {"star_rating": new_rating, "is_guide": is_guide}}
    )
    
    return {"message": "User points updated"}

@api_router.get("/admin/star-config")
async def get_star_rating_config():
    """Get star rating configuration"""
    config = await get_star_config()
    return config

@api_router.post("/admin/star-config")
async def save_star_rating_config(config_data: dict, request: Request):
    """Save star rating configuration (admin only)"""
    # Upsert configuration with all provided star levels
    await db.config.update_one(
        {"type": "star_rating"},
        {"$set": {"type": "star_rating", "config": config_data}},
        upsert=True
    )
    
    return {"message": "Star rating configuration saved"}

@api_router.get("/admin/points-config")
async def get_points_config():
    """Get points configuration"""
    config = await db.config.find_one({"type": "points"})
    if not config:
        # Default configuration
        return {
            "post": 5,
            "like": 2,
            "fan": 3,
            "guidee": 5
        }
    return config["config"]

@api_router.post("/admin/points-config")
async def save_points_config(config_data: dict, request: Request):
    """Save points configuration (admin only)"""
    config = {
        "post": config_data["post"],
        "like": config_data["like"],
        "fan": config_data["fan"],
        "guidee": config_data["guidee"]
    }
    
    # Upsert configuration
    await db.config.update_one(
        {"type": "points"},
        {"$set": {"type": "points", "config": config}},
        upsert=True
    )
    
    return {"message": "Points configuration saved"}


# Commission rates admin endpoints
@api_router.get("/admin/commission-rates")
async def get_commission_rates():
    """Get commission rates configuration"""
    config = await get_commission_config()
    return config

@api_router.post("/admin/commission-rates")
async def save_commission_rates(config_data: dict):
    """Save commission rates configuration (admin only)"""
    config = {
        "star1": config_data.get("star1", 3.0),
        "star2": config_data.get("star2", 6.0),
        "star3": config_data.get("star3", 9.0),
        "star4": config_data.get("star4", 12.0),
        "star5": config_data.get("star5", 15.0)
    }
    
    # Upsert configuration
    await db.config.update_one(
        {"type": "commission_rates"},
        {"$set": {"type": "commission_rates", "config": config}},
        upsert=True
    )
    
    return {"message": "Commission rates saved"}

# Coupon admin endpoints
@api_router.get("/admin/coupons")
async def get_all_coupons():
    """Get all coupons (admin only)"""
    coupons = await db.coupons.find().to_list(1000)
    for coupon in coupons:
        coupon["_id"] = str(coupon["_id"])
    return coupons

@api_router.post("/admin/coupons")
async def create_coupon(coupon_data: dict):
    """Create a coupon (admin only)"""
    coupon = {
        "code": coupon_data["code"].upper(),
        "discount_type": coupon_data["discount_type"],
        "discount_value": coupon_data["discount_value"],
        "min_order_value": coupon_data["min_order_value"],
        "usage_limit_type": coupon_data["usage_limit_type"],
        "expiry_date": datetime.fromisoformat(coupon_data["expiry_date"].replace("Z", "+00:00")),
        "active": coupon_data.get("active", True),
        "created_at": datetime.now(timezone.utc)
    }
    
    result = await db.coupons.insert_one(coupon)
    return {"message": "Coupon created", "id": str(result.inserted_id)}

@api_router.put("/admin/coupons/{coupon_id}")
async def update_coupon(coupon_id: str, coupon_data: dict):
    """Update a coupon (admin only)"""
    update_data = {
        "code": coupon_data["code"].upper(),
        "discount_type": coupon_data["discount_type"],
        "discount_value": coupon_data["discount_value"],
        "min_order_value": coupon_data["min_order_value"],
        "usage_limit_type": coupon_data["usage_limit_type"],
        "expiry_date": datetime.fromisoformat(coupon_data["expiry_date"].replace("Z", "+00:00")),
        "active": coupon_data.get("active", True)
    }
    
    result = await db.coupons.update_one(
        {"_id": ObjectId(coupon_id)},
        {"$set": update_data}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Coupon not found")
    
    return {"message": "Coupon updated"}

@api_router.delete("/admin/coupons/{coupon_id}")
async def delete_coupon(coupon_id: str):
    """Delete a coupon (admin only)"""
    result = await db.coupons.delete_one({"_id": ObjectId(coupon_id)})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Coupon not found")
    
    return {"message": "Coupon deleted"}

# Withdrawal requests admin endpoints
@api_router.get("/admin/withdrawals")
async def get_all_withdrawal_requests():
    """Get all withdrawal requests (admin only)"""
    withdrawals = await db.withdrawal_requests.find().sort("created_at", -1).to_list(1000)
    for w in withdrawals:
        w["_id"] = str(w["_id"])
    return withdrawals

@api_router.put("/admin/withdrawals/{withdrawal_id}/approve")
async def approve_withdrawal(withdrawal_id: str):
    """Approve a withdrawal request (admin only)"""
    withdrawal = await db.withdrawal_requests.find_one({"_id": ObjectId(withdrawal_id)})
    
    if not withdrawal:
        raise HTTPException(status_code=404, detail="Withdrawal request not found")
    
    if withdrawal["status"] != "pending":
        raise HTTPException(status_code=400, detail="Withdrawal already processed")
    
    # Deduct from guide's balance
    await db.users.update_one(
        {"_id": ObjectId(withdrawal["guide_id"])},
        {"$inc": {"commission_balance": -withdrawal["amount"]}}
    )
    
    # Update withdrawal status
    await db.withdrawal_requests.update_one(
        {"_id": ObjectId(withdrawal_id)},
        {"$set": {
            "status": "approved",
            "processed_at": datetime.now(timezone.utc)
        }}
    )
    
    return {"message": "Withdrawal approved"}

@api_router.put("/admin/withdrawals/{withdrawal_id}/reject")
async def reject_withdrawal(withdrawal_id: str):
    """Reject a withdrawal request (admin only)"""
    withdrawal = await db.withdrawal_requests.find_one({"_id": ObjectId(withdrawal_id)})
    
    if not withdrawal:
        raise HTTPException(status_code=404, detail="Withdrawal request not found")
    
    if withdrawal["status"] != "pending":
        raise HTTPException(status_code=400, detail="Withdrawal already processed")
    
    # Update withdrawal status
    await db.withdrawal_requests.update_one(
        {"_id": ObjectId(withdrawal_id)},
        {"$set": {
            "status": "rejected",
            "processed_at": datetime.now(timezone.utc)
        }}
    )
    
    return {"message": "Withdrawal rejected"}

@app.get("/admin")
async def admin_panel():
    """Serve admin panel"""
    admin_html_path = ROOT_DIR / "admin.html"
    with open(admin_html_path, "r") as f:
        html_content = f.read()
    return HTMLResponse(content=html_content)



# Admin Authentication Endpoints
@api_router.post("/admin/login")
async def admin_login(credentials: dict):
    """Admin login endpoint"""
    email = credentials.get("email")
    password = credentials.get("password")
    
    if not email or not password:
        raise HTTPException(status_code=400, detail="Email and password required")
    
    # Get admin user
    admin = await db.admin_users.find_one({"email": email})
    if not admin:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    # Verify password
    password_hash = hash_password(password)
    if admin["password_hash"] != password_hash:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    # Generate token
    token = generate_admin_token()
    
    # Store session
    await db.admin_sessions.insert_one({
        "token": token,
        "email": email,
        "created_at": datetime.now(timezone.utc),
        "expires_at": datetime.now(timezone.utc) + timedelta(days=1)
    })
    
    return {"token": token, "email": email}

@api_router.post("/admin/logout")
async def admin_logout(request: Request):
    """Admin logout endpoint"""
    token = request.headers.get("Authorization", "").replace("Bearer ", "")
    if token:
        await db.admin_sessions.delete_one({"token": token})
    return {"message": "Logged out successfully"}

@api_router.get("/admin/verify")
async def verify_admin(request: Request):
    """Verify admin token"""
    token = request.headers.get("Authorization", "").replace("Bearer ", "")
    admin = await verify_admin_token(token)
    if not admin:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    return {"email": admin["email"]}

@api_router.put("/admin/change-credentials")
async def change_admin_credentials(credentials: dict, request: Request):
    """Change admin email and password"""
    token = request.headers.get("Authorization", "").replace("Bearer ", "")
    admin = await verify_admin_token(token)
    if not admin:
        raise HTTPException(status_code=401, detail="Unauthorized")
    
    new_email = credentials.get("new_email")
    new_password = credentials.get("new_password")
    current_password = credentials.get("current_password")
    
    # Verify current password
    if not current_password:
        raise HTTPException(status_code=400, detail="Current password required")
    
    if hash_password(current_password) != admin["password_hash"]:
        raise HTTPException(status_code=401, detail="Invalid current password")
    
    # Update credentials
    update_data = {}
    if new_email:
        update_data["email"] = new_email
    if new_password:
        update_data["password_hash"] = hash_password(new_password)
    
    if update_data:
        await db.admin_users.update_one(
            {"email": admin["email"]},
            {"$set": update_data}
        )
        
        # If email changed, update sessions
        if new_email:
            await db.admin_sessions.update_many(
                {"email": admin["email"]},
                {"$set": {"email": new_email}}
            )
    
    return {"message": "Credentials updated successfully"}

# Serve admin login page via API router
@api_router.get("/admin-login")
async def serve_admin_login():
    """Serve admin login page"""
    login_html_path = ROOT_DIR / "admin_login.html"
    with open(login_html_path, "r") as f:
        html_content = f.read()
    return HTMLResponse(content=html_content)

# Serve admin panel with authentication check via API router
@api_router.get("/admin-panel")
async def admin_panel_api_route():
    """Serve admin panel (requires authentication via client-side check)"""
    admin_html_path = ROOT_DIR / "admin.html"
    with open(admin_html_path, "r") as f:
        html_content = f.read()
    return HTMLResponse(content=html_content)

@api_router.get("/admin-panel")
async def admin_panel_api():
    """Serve admin panel via API route"""
    admin_html_path = ROOT_DIR / "admin.html"
    with open(admin_html_path, "r") as f:
        html_content = f.read()
    return HTMLResponse(content=html_content)

app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("startup")
async def startup_event():
    """Initialize admin credentials on startup"""
    await initialize_admin_credentials()

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
