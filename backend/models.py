from sqlalchemy import Column, String, Text, Integer, ForeignKey, TIMESTAMP
from sqlalchemy.sql import func
from backend.database import Base
from sqlalchemy import Index
from sqlalchemy.orm import relationship

import uuid


class Repo(Base):

    __tablename__ = "repos"

    #id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    id = Column(Integer, primary_key=True, autoincrement=True)

    github_url = Column(Text, nullable=False, unique=True)

    repo_name = Column(String, nullable=False)

    status = Column(String, nullable=False, default="pending")

    total_files = Column(Integer, default=0)

    total_chunks = Column(Integer, default=0)

    error_message = Column(Text)

    created_at = Column(TIMESTAMP, server_default=func.now())

    updated_at = Column(
        TIMESTAMP,
        server_default=func.now(),
        onupdate=func.now()
    )

    chunks = relationship(
        "Chunk",
        backref="repo",
        cascade="all, delete"
    )

    messages = relationship(
        "Message",
        backref="repo",
        cascade="all, delete"
    )


class Chunk(Base):

    __tablename__ = "chunks"

    id = Column(
        String,
        primary_key=True,
        default=lambda: str(uuid.uuid4())
    )

    repo_id = Column(
        Integer,
        ForeignKey("repos.id", ondelete="CASCADE"),
        nullable=False
    )

    chunk_index = Column(Integer, nullable=False)

    file_path = Column(Text, nullable=False)

    chunk_type = Column(String)

    signature = Column(Text)

    start_line = Column(Integer)

    end_line = Column(Integer)

    content = Column(Text, nullable=False)

    chroma_id = Column(String, unique=True)

    created_at = Column(
        TIMESTAMP,
        server_default=func.now()
    )
    
class Message(Base):

    __tablename__ = "messages"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))

    repo_id = Column(
        Integer,
        ForeignKey("repos.id", ondelete="CASCADE"),
        nullable=False
    )

    role = Column(String, nullable=False)

    content = Column(Text, nullable=False)

    created_at = Column(TIMESTAMP, server_default=func.now())


Index("idx_chunks_repo_id", Chunk.repo_id)
Index("idx_messages_repo_id", Message.repo_id)
Index("idx_repos_status", Repo.status)