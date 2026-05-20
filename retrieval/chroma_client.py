import chromadb
import os

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

VECTOR_DB_PATH = os.path.join(BASE_DIR, "vector_db")

client = chromadb.PersistentClient(VECTOR_DB_PATH);