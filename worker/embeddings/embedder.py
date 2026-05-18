from sentence_transformers import SentenceTransformer


_model = None


def get_model():

    global _model

    if _model is None:

        print("Loading embedding model...")

        _model = SentenceTransformer(
            "all-MiniLM-L6-v2"
        )

    return _model


def generate_embeddings(chunks, batch_size=64):

    model = get_model()

    texts = [chunk["content"] for chunk in chunks]

    embeddings = model.encode(
        texts,
        batch_size=batch_size,
        show_progress_bar=True
    )

    return embeddings