from sqlalchemy import Column, Integer, String
from database import Base

class Repo(Base):

    __tablename__ = "repos"

    id = Column(Integer, primary_key=True)

    github_url = Column(String)

    status = Column(String)