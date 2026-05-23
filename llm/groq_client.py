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