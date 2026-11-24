import os
from dotenv import load_dotenv
from google import genai

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
client = genai.Client(api_key=GEMINI_API_KEY)
class ChatRequest(BaseModel):
    question: str
    paper_context: str = ""
app = FastAPI(
    title="PaperDigest API",
    description="Backend for PaperDigest",
    version="1.0.0"
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5500",
        "http://127.0.0.1:5500",
        "http://localhost:8001",
        "http://127.0.0.1:8001"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def home():
    return {
        "message": "Welcome to PaperDigest API!",
        "status": "running"
    }


@app.get("/health")
def health_check():
    return {
        "status": "healthy"
    }


@app.get("/api/test")
def test_connection():
    return {
        "message": "Frontend and backend are ready to connect!",
        "success": True
    }



@app.post("/api/ask")
def ask_ai(request: ChatRequest):

    if not request.question.strip():
        raise HTTPException(
            status_code=400,
            detail="Question cannot be empty"
        )

    try:
        contents = f"""
You are PaperDigest's AI Research Companion.

Answer the user's question using the research paper context below.
If the context does not contain the answer, say that the provided paper information does not specify it. Do not invent details.

Research paper:
{request.paper_context}

User question:
{request.question}
"""

        response = client.models.generate_content(
            model="gemini-3.8-flash",
            contents=contents
        )

        return {
            "answer": response.text
        }

    except Exception as e:
        print("Gemini API error:", e)
        raise HTTPException(
            status_code=502,
            detail="Unable to generate an AI response"
        )