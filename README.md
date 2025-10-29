# OrHealthy - Complete Nutrition Ecosystem App

![OrHealthy Logo](https://customer-assets.emergentagent.com/job_nutritionhub-1/artifacts/kq74ajf1_Orhealthy%20Favicon.png)

## Overview

**OrHealthy** is a comprehensive nutrition and healthy eating ecosystem mobile application built with Expo (React Native) for iOS, Android, and Web, powered by a FastAPI backend and MongoDB database.

## Features

### 1. **User System**
- Google OAuth authentication via Emergent integration
- Two user types: **Guides** and **Guidees**
- Point-based progression system
- Star rating system (1-5 stars based on points)
- Users automatically become Guides when reaching 3+ star rating

### 2. **Social Feed (Home)**
- Create and share posts about healthy eating experiences
- Vote up (like) posts
- Comment on posts  
- Earn points for posting and receiving vote ups
- Real-time point and rating updates

### 3. **Preset Meals**
- Browse pre-configured healthy meals
- View meal details, ingredients, and prices
- Quick "Add to Cart" option
- Customize meals by adjusting ingredient quantities
- Dynamic price calculation based on customization

### 4. **DIY Meals**
- Create custom meals from scratch
- Browse and search all available ingredients
- Add/remove ingredients with quantity control
- Name your custom creation
- Real-time total price calculation

### 5. **Shopping Cart**
- View all added meals (preset and DIY)
- See ingredient breakdown for each item
- Remove items or clear entire cart
- Calculate total price

### 6. **Checkout System**
- Billing and shipping address forms
- Option to use same address for both
- Razorpay payment integration (placeholder for now)
- Order confirmation and tracking

### 7. **User Profile**
- View and edit profile information:
  - Height, weight
  - Allergies list
  - Expertise
- Display points and star rating
- Show Guide/Guidee status
- Track number of guidees (for Guides)

### 8. **Point System**
Points are earned through:
- Creating posts: **+5 points**
- Receiving vote ups: **+2 points per vote**
- Number of guidees: **Variable points**
- Inherent points: **Assigned by admin**

**Star Rating Thresholds:**
- 1 Star: 25+ points
- 2 Stars: 100+ points
- 3 Stars: 250+ points (becomes Guide)
- 4 Stars: 500+ points
- 5 Stars: 1000+ points

## Tech Stack

### Frontend
- **Expo** (React Native)
- **Expo Router** (file-based routing)
- **TypeScript**
- **React Navigation** (bottom tabs)
- **Axios** (HTTP client)
- **React Native Modal**
- **@shopify/flash-list** (performant lists)

### Backend
- **FastAPI** (Python)
- **Motor** (async MongoDB driver)
- **Pydantic** (data validation)
- **Emergentintegrations** (Google OAuth)

### Database
- **MongoDB** (document store)

## Database Collections

- **Users**: User profiles, points, ratings, Guide/Guidee relationships
- **Posts**: Social feed posts with vote tracking
- **Comments**: Post comments
- **Meals**: Preset meal configurations
- **Ingredients**: Available ingredients with pricing
- **Cart**: User shopping carts
- **Orders**: Completed orders
- **Sessions**: Authentication sessions

## Sample Data

The seed script creates:
- **10 Ingredients**: Brown Rice, Chicken Breast, Broccoli, Avocado, Quinoa, Sweet Potato, Salmon, Mixed Greens, Almonds, Greek Yogurt
- **5 Preset Meals**: Protein Power Bowl, Mediterranean Salmon, Vegetarian Delight, Fitness Fuel, Keto Classic

## Future Enhancements

### Planned Features
- Razorpay payment integration
- Admin panel (web interface) for managing users, meals, and orders
- Guide/Guidee relationship management
- Direct messaging between guides and guidees
- Meal recommendations based on user profile
- Nutrition tracking and analytics

## Testing

The app can be tested on:
- Web browser (http://localhost:3000)
- iOS device using Expo Go
- Android device using Expo Go
- iOS Simulator
- Android Emulator

## Author

Built with ❤️ using Emergent AI Platform

---

**Note**: This is an MVP (Minimum Viable Product). Payment integration, admin panel, and advanced features are planned for future releases.
