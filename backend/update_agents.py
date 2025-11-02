import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os
from dotenv import load_dotenv

load_dotenv()

async def update_agents():
    mongo_url = os.getenv('MONGO_URL')
    client = AsyncIOMotorClient(mongo_url)
    db = client['orhealthy']
    
    # Update all delivery agents to have wallet_balance if missing
    result = await db.delivery_agents.update_many(
        {"wallet_balance": {"$exists": False}},
        {"$set": {"wallet_balance": 0.0}}
    )
    
    print(f"Updated {result.modified_count} delivery agents with wallet_balance")
    
    # Show all agents
    agents = await db.delivery_agents.find().to_list(100)
    for agent in agents:
        print(f"Agent: {agent['name']} - Wallet: {agent.get('wallet_balance', 0)}")

if __name__ == "__main__":
    asyncio.run(update_agents())
