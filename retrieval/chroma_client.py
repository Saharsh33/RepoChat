import chromadb

CHROMA_PATH = "./chroma_db"

client = chromadb.PersistentClient(CHROMA_PATH);