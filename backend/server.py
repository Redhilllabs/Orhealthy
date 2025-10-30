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

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

app = FastAPI()
api_router = APIRouter(prefix="/api")

# Pydantic models
class UserProfile(BaseModel):
    height: Optional[float] = None
    weight: Optional[float] = None
    allergies: List[str] = []
    expertise: Optional[str] = None

class User(BaseModel):
    email: str
    name: str
    picture: Optional[str] = None
    google_id: str
    profile_picture: Optional[str] = None
    profile: UserProfile = UserProfile()
    points: int = 0
    inherent_points: int = 0
    star_rating: int = 0
    is_guide: bool = False
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

class Ingredient(BaseModel):
    name: str
    price_per_unit: float
    unit: str  # g, ml, piece
    description: Optional[str] = None
    nutritional_info: Optional[dict] = None
    images: List[str] = []  # Base64 encoded images
    tags: List[str] = []  # Tags for filtering

class MealIngredient(BaseModel):
    ingredient_id: str
    name: str
    price: float
    default_quantity: float
    quantity: Optional[float] = None  # For customization

class Meal(BaseModel):
    name: str
    description: str
    images: List[str] = []  # Base64 encoded images
    base_price: float
    ingredients: List[MealIngredient]
    tags: List[str] = []  # Tags for filtering
    is_preset: bool = True
    created_by: str = "admin"

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
    status: str = "pending"  # pending, confirmed, delivered
    billing_address: Address
    shipping_address: Address
    payment_id: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class Config(BaseModel):
    type: str  # star_rating_thresholds, point_values
    config: dict

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
    """Calculate star rating based on points"""
    config = await get_star_config()
    
    if points >= config["star5"]:
        return 5
    elif points >= config["star4"]:
        return 4
    elif points >= config["star3"]:
        return 3
    elif points >= config["star2"]:
        return 2
    elif points >= config["star1"]:
        return 1
    return 0

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
    
    # Convert expires_at to timezone-aware datetime if it isn't already
    expires_at = session["expires_at"]
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    
    if expires_at < datetime.now(timezone.utc):
        return None
    
    user = await db.users.find_one({"_id": ObjectId(session["user_id"])})
    if user:
        user["_id"] = str(user["_id"])
    return user

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
    new_rating = await calculate_star_rating(updated_user["points"])
    is_guide = new_rating >= 1
    
    await db.users.update_one(
        {"_id": ObjectId(user["_id"])},
        {"$set": {"star_rating": new_rating, "is_guide": is_guide}}
    )
    
    return {"message": "Post created", "id": str(result.inserted_id)}

@api_router.get("/posts")
async def get_posts(skip: int = 0, limit: int = 20):
    """Get all posts"""
    posts = await db.posts.find().sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    for post in posts:
        post["_id"] = str(post["_id"])
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
        new_rating = await calculate_star_rating(post_owner["points"])
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
    new_rating = await calculate_star_rating(updated_user["points"])
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
    """Get comments for a post"""
    comments = await db.comments.find({"post_id": post_id}).sort("created_at", -1).to_list(100)
    for comment in comments:
        comment["_id"] = str(comment["_id"])
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

# Meal & Ingredient endpoints
@api_router.get("/ingredients")
async def get_ingredients():
    """Get all ingredients"""
    ingredients = await db.ingredients.find().to_list(1000)
    for ingredient in ingredients:
        ingredient["_id"] = str(ingredient["_id"])
    return ingredients

@api_router.get("/meals")
async def get_meals():
    """Get all preset meals"""
    meals = await db.meals.find({"is_preset": True}).to_list(100)
    for meal in meals:
        meal["_id"] = str(meal["_id"])
    return meals

@api_router.get("/meals/{meal_id}")
async def get_meal(meal_id: str):
    """Get meal by ID"""
    meal = await db.meals.find_one({"_id": ObjectId(meal_id)})
    if not meal:
        raise HTTPException(status_code=404, detail="Meal not found")
    meal["_id"] = str(meal["_id"])
    return meal

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
    
    order = Order(
        user_id=user["_id"],
        items=order_data["items"],
        total_price=order_data["total_price"],
        billing_address=order_data["billing_address"],
        shipping_address=order_data["shipping_address"],
        payment_id=order_data.get("payment_id")
    )
    
    result = await db.orders.insert_one(order.dict())
    
    # Clear cart
    await db.carts.update_one(
        {"user_id": user["_id"]},
        {"$set": {"items": []}}
    )
    
    return {"message": "Order created", "id": str(result.inserted_id)}

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
    """Get all orders (admin only)"""
    orders = await db.orders.find().sort("created_at", -1).to_list(1000)
    for order in orders:
        order["_id"] = str(order["_id"])
    return orders

@api_router.put("/admin/orders/{order_id}")
async def update_order_status(order_id: str, status_data: dict, request: Request):
    """Update order status (admin only)"""
    await db.orders.update_one(
        {"_id": ObjectId(order_id)},
        {"$set": {"status": status_data["status"]}}
    )
    return {"message": "Order status updated"}

@api_router.get("/admin/users")
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
    config = {
        "star1": config_data["star1"],
        "star2": config_data["star2"],
        "star3": config_data["star3"],
        "star4": config_data["star4"],
        "star5": config_data["star5"]
    }
    
    # Upsert configuration
    await db.config.update_one(
        {"type": "star_rating"},
        {"$set": {"type": "star_rating", "config": config}},
        upsert=True
    )
    
    return {"message": "Star rating configuration saved"}

@app.get("/admin")
async def admin_panel():
    """Serve admin panel"""
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

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
