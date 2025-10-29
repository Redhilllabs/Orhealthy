import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os
from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

async def seed_data():
    print("Seeding database with sample data...")

    # Sample ingredients
    ingredients = [
        {
            "name": "Brown Rice",
            "price_per_unit": 2.5,
            "unit": "cup",
            "description": "Healthy whole grain rice",
            "nutritional_info": {"calories": 200, "protein": 5, "carbs": 45}
        },
        {
            "name": "Grilled Chicken Breast",
            "price_per_unit": 5.0,
            "unit": "piece",
            "description": "Lean protein source",
            "nutritional_info": {"calories": 165, "protein": 31, "carbs": 0}
        },
        {
            "name": "Steamed Broccoli",
            "price_per_unit": 1.5,
            "unit": "cup",
            "description": "Rich in vitamins and fiber",
            "nutritional_info": {"calories": 55, "protein": 4, "carbs": 11}
        },
        {
            "name": "Avocado",
            "price_per_unit": 3.0,
            "unit": "piece",
            "description": "Healthy fats",
            "nutritional_info": {"calories": 240, "protein": 3, "carbs": 13}
        },
        {
            "name": "Quinoa",
            "price_per_unit": 3.5,
            "unit": "cup",
            "description": "Complete protein grain",
            "nutritional_info": {"calories": 222, "protein": 8, "carbs": 39}
        },
        {
            "name": "Sweet Potato",
            "price_per_unit": 2.0,
            "unit": "piece",
            "description": "Complex carbohydrates",
            "nutritional_info": {"calories": 103, "protein": 2, "carbs": 24}
        },
        {
            "name": "Salmon Fillet",
            "price_per_unit": 7.0,
            "unit": "piece",
            "description": "Omega-3 rich fish",
            "nutritional_info": {"calories": 206, "protein": 22, "carbs": 0}
        },
        {
            "name": "Mixed Greens Salad",
            "price_per_unit": 2.5,
            "unit": "bowl",
            "description": "Fresh leafy greens",
            "nutritional_info": {"calories": 25, "protein": 2, "carbs": 5}
        },
        {
            "name": "Almonds",
            "price_per_unit": 4.0,
            "unit": "oz",
            "description": "Healthy nuts",
            "nutritional_info": {"calories": 164, "protein": 6, "carbs": 6}
        },
        {
            "name": "Greek Yogurt",
            "price_per_unit": 2.0,
            "unit": "cup",
            "description": "High protein dairy",
            "nutritional_info": {"calories": 100, "protein": 17, "carbs": 6}
        }
    ]

    # Clear existing data
    await db.ingredients.delete_many({})
    result = await db.ingredients.insert_many(ingredients)
    ingredient_ids = result.inserted_ids
    print(f"Inserted {len(ingredient_ids)} ingredients")

    # Sample preset meals
    meals = [
        {
            "name": "Protein Power Bowl",
            "description": "High protein meal with chicken, quinoa, and veggies",
            "base_price": 12.0,
            "ingredients": [
                {"ingredient_id": str(ingredient_ids[1]), "name": "Grilled Chicken Breast", "price": 5.0, "default_quantity": 1},
                {"ingredient_id": str(ingredient_ids[4]), "name": "Quinoa", "price": 3.5, "default_quantity": 1},
                {"ingredient_id": str(ingredient_ids[2]), "name": "Steamed Broccoli", "price": 1.5, "default_quantity": 1},
                {"ingredient_id": str(ingredient_ids[3]), "name": "Avocado", "price": 3.0, "default_quantity": 0.5}
            ],
            "is_preset": True,
            "created_by": "admin"
        },
        {
            "name": "Mediterranean Salmon",
            "description": "Omega-3 rich salmon with healthy sides",
            "base_price": 15.0,
            "ingredients": [
                {"ingredient_id": str(ingredient_ids[6]), "name": "Salmon Fillet", "price": 7.0, "default_quantity": 1},
                {"ingredient_id": str(ingredient_ids[7]), "name": "Mixed Greens Salad", "price": 2.5, "default_quantity": 1},
                {"ingredient_id": str(ingredient_ids[5]), "name": "Sweet Potato", "price": 2.0, "default_quantity": 1}
            ],
            "is_preset": True,
            "created_by": "admin"
        },
        {
            "name": "Vegetarian Delight",
            "description": "Plant-based nutritious meal",
            "base_price": 10.0,
            "ingredients": [
                {"ingredient_id": str(ingredient_ids[0]), "name": "Brown Rice", "price": 2.5, "default_quantity": 1},
                {"ingredient_id": str(ingredient_ids[2]), "name": "Steamed Broccoli", "price": 1.5, "default_quantity": 1},
                {"ingredient_id": str(ingredient_ids[3]), "name": "Avocado", "price": 3.0, "default_quantity": 1},
                {"ingredient_id": str(ingredient_ids[8]), "name": "Almonds", "price": 4.0, "default_quantity": 1}
            ],
            "is_preset": True,
            "created_by": "admin"
        },
        {
            "name": "Fitness Fuel",
            "description": "Perfect post-workout meal",
            "base_price": 11.0,
            "ingredients": [
                {"ingredient_id": str(ingredient_ids[1]), "name": "Grilled Chicken Breast", "price": 5.0, "default_quantity": 1},
                {"ingredient_id": str(ingredient_ids[5]), "name": "Sweet Potato", "price": 2.0, "default_quantity": 1},
                {"ingredient_id": str(ingredient_ids[9]), "name": "Greek Yogurt", "price": 2.0, "default_quantity": 1}
            ],
            "is_preset": True,
            "created_by": "admin"
        },
        {
            "name": "Keto Classic",
            "description": "Low-carb, high-fat meal",
            "base_price": 13.0,
            "ingredients": [
                {"ingredient_id": str(ingredient_ids[6]), "name": "Salmon Fillet", "price": 7.0, "default_quantity": 1},
                {"ingredient_id": str(ingredient_ids[3]), "name": "Avocado", "price": 3.0, "default_quantity": 1},
                {"ingredient_id": str(ingredient_ids[7]), "name": "Mixed Greens Salad", "price": 2.5, "default_quantity": 1}
            ],
            "is_preset": True,
            "created_by": "admin"
        }
    ]

    await db.meals.delete_many({})
    result = await db.meals.insert_many(meals)
    print(f"Inserted {len(result.inserted_ids)} preset meals")

    print("Database seeded successfully!")

if __name__ == "__main__":
    asyncio.run(seed_data())
