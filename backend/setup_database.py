"""
One-time database initialization script.

Creates all tables defined in the SQLAlchemy models.
Run this once after setting up MySQL and configuring DATABASE_URL in .env.

Usage:
    python setup_database.py
"""

import sys
from pathlib import Path

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent))

from app.db.models import init_db, engine, Base, User, SessionLocal
from app.config import get_settings


def seed_demo_users():
    """
    Seed demo user accounts for development and testing.

    NOTE: Passwords are stored in plain text for development only.
    TODO: Before any real deployment, implement password hashing (passlib[bcrypt]).
    """
    db = SessionLocal()
    try:
        # Check if users already exist
        existing = db.query(User).first()
        if existing:
            print("\n[SKIP] Demo users already exist")
            return

        # Create demo users
        demo_users = [
            User(
                username="demo",
                password="demo123",  # Plain text for dev only
                full_name="Demo User",
            ),
            User(
                username="priya",
                password="priya123",
                full_name="Priya Sharma",
            ),
        ]

        for user in demo_users:
            db.add(user)

        db.commit()
        print("\n[OK] Seeded demo users:")
        print("  - username: demo, password: demo123, name: Demo User")
        print("  - username: priya, password: priya123, name: Priya Sharma")

    except Exception as e:
        print(f"\n[ERROR] Failed to seed demo users: {e}")
        db.rollback()
    finally:
        db.close()


def main():
    print("=" * 60)
    print("Orthonova Database Setup")
    print("=" * 60)

    settings = get_settings()
    print(f"\nDatabase URL: {settings.database_url}")

    print("\nCreating tables...")
    try:
        # Create all tables
        Base.metadata.create_all(bind=engine)
        print("[OK] Tables created successfully")

        # List created tables
        from sqlalchemy import inspect
        inspector = inspect(engine)
        tables = inspector.get_table_names()
        print(f"\nCreated tables: {', '.join(tables)}")

        # Seed demo users
        seed_demo_users()

        print("\n" + "=" * 60)
        print("Database setup complete!")
        print("=" * 60)
        print("\nNext steps:")
        print("1. Train the ML model: python -m app.ml.train_model")
        print("2. Start the API: uvicorn app.main:app --reload")

    except Exception as e:
        print(f"\n[ERROR] Error creating tables: {e}")
        print("\nTroubleshooting:")
        print("1. Make sure MySQL is running")
        print("2. Check DATABASE_URL in backend/.env")
        print("3. Create the database first:")
        print("   mysql -u root -p")
        print("   CREATE DATABASE orthonova CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;")
        sys.exit(1)


if __name__ == "__main__":
    main()
