from groq import Groq
import os

client = Groq(
    api_key=os.getenv("GROQ_API_KEY")
)

def generate_response(messages):
    print("Sending request to Groq...")
    completion = client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=messages,
        temperature=0.1,
    )
    print("Groq returned response")

    return completion.choices[0].message.content


def generate_response_stream(messages):
    """Yield content chunks from Groq streaming API."""
    print("Sending streaming request to Groq...")
    stream = client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=messages,
        temperature=0.1,
        stream=True,
    )
    for chunk in stream:
        delta = chunk.choices[0].delta
        if delta and delta.content:
            yield delta.content