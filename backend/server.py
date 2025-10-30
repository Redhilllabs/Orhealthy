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
    discount_amount: float = 0.0
    coupon_code: Optional[str] = None
    final_price: float
    status: str = "pending"  # pending, confirmed, delivered
    billing_address: Address
    shipping_address: Address
    payment_id: Optional[str] = None
    ordered_by_guide_id: Optional[str] = None  # If guide ordered for guidee
    ordered_for_guidee_id: Optional[str] = None  # The guidee this order is for
    commission_earned: float = 0.0  # Commission earned by guide
    commission_rate: float = 0.0  # Rate at which commission was calculated
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
async def get_posts(skip: int = 0, limit: int = 20):
    """Get all posts"""
    posts = await db.posts.find().sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    for post in posts:
        post["_id"] = str(post["_id"])
        # Fetch user's star rating
        user = await db.users.find_one({"_id": ObjectId(post["user_id"])})
        if user:
            post["star_rating"] = user.get("star_rating", 0)
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


# Saved Meals endpoints (for all users)
@api_router.post("/saved-meals")
async def save_meal(meal_data: dict, request: Request):
    """Save a DIY meal (all users)"""
    user = await get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    saved_meal = {
        "guide_id": user["_id"],  # Can be any user, not just guides
        "meal_name": meal_data["meal_name"],
        "ingredients": meal_data["ingredients"],
        "total_price": meal_data["total_price"],
        "created_at": datetime.now(timezone.utc)
    }
    
    result = await db.saved_meals.insert_one(saved_meal)
    return {"message": "Meal saved", "id": str(result.inserted_id)}

@api_router.get("/saved-meals")
async def get_saved_meals(request: Request):
    """Get user's saved meals"""
    user = await get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    meals = await db.saved_meals.find({"guide_id": user["_id"]}).to_list(100)
    for meal in meals:
        meal["_id"] = str(meal["_id"])
    return meals

@api_router.delete("/saved-meals/{meal_id}")
async def delete_saved_meal(meal_id: str, request: Request):
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

# Address endpoints
@api_router.post("/addresses")
async def add_address(address_data: dict, request: Request):
    """Add a new address"""
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
    commission_earned = 0.0
    commission_rate = 0.0
    
    # Calculate commission if guide is ordering for guidee
    if ordered_by_guide_id and ordered_for_guidee_id:
        guide = await db.users.find_one({"_id": ObjectId(ordered_by_guide_id)})
        if guide and guide.get("is_guide"):
            star_rating = guide.get("star_rating", 0)
            commission_rate = await calculate_commission_rate(star_rating)
            commission_earned = (final_price * commission_rate) / 100
            
            # Update guide's commission balance
            await db.users.update_one(
                {"_id": ObjectId(ordered_by_guide_id)},
                {"$inc": {"commission_balance": commission_earned}}
            )
    
    order = Order(
        user_id=ordered_for_guidee_id if ordered_for_guidee_id else user["_id"],
        items=order_data["items"],
        total_price=total_price,
        discount_amount=discount_amount,
        coupon_code=order_data.get("coupon_code"),
        final_price=final_price,
        billing_address=order_data["billing_address"],
        shipping_address=order_data["shipping_address"],
        payment_id=order_data.get("payment_id"),
        ordered_by_guide_id=ordered_by_guide_id,
        ordered_for_guidee_id=ordered_for_guidee_id,
        commission_earned=commission_earned,
        commission_rate=commission_rate
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
