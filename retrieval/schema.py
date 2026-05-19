from dataclasses import dataclass, asdict
from enum import Enum

class ChunkType(str, Enum):
    FUNCTION = "function_def"
    METHOD = "method_def"
    CLASS = "class_def"
    PLAINTEXT = "plaintext"
    MARKDOWN = "markdown"

@dataclass
class ChunkSchema:
    id: str # for postgre to access
    content: str
    file_path: str
    start_line: str
    end_line: str
    chunk_type: ChunkType

    def to_metadata(self) -> dict:
        return {
            "file_path": self.file_path,
            "start_line": self.start_line,
            "end_line": self.end_line,
            "chunk_type": self.chunk_type.value,
        }
    
@dataclass
class RetrievedChunkSchema:
    id: str
    content: str
    file_path: str
    start_line: str
    end_line: str
    chunk_type: ChunkType
    score: float