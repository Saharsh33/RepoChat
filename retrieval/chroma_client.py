import chromadb

VECTOR_DB_PATH = "/app/vector_db"

client = chromadb.PersistentClient(path=VECTOR_DB_PATH)