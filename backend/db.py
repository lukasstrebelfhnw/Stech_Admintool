from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
import os

DATABASE_URL = os.getenv("DATABASE_URL")

engine = create_engine(DATABASE_URL, future=True)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine, future=True)

Base = declarative_base()


def get_db():
    from fastapi import Depends
    from typing import Generator

    def _get_db() -> Generator:
        db = SessionLocal()
        try:
            yield db
        finally:
            db.close()

    return Depends(_get_db)