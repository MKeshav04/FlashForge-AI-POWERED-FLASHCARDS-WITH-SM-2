import os
import json
import asyncio
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import pdfplumber
from groq import Groq
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

GROQ_API_KEY = os.getenv("GROQ_API_KEY")
if not GROQ_API_KEY:
    raise ValueError("GROQ_API_KEY is missing. Check your .env file.")

# Initialize the Groq client
client = Groq(api_key=GROQ_API_KEY)

# Initialize the backend server
app = FastAPI(title="Cuemath Flashcard API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def health_check():
    return {"status": "Backend is active and listening."}

@app.post("/api/generate")
async def generate_flashcards(file: UploadFile = File(...)):
    if not file.filename.endswith('.pdf'):
        raise HTTPException(status_code=400, detail="Invalid file type. Please upload a PDF.")

    try:
        # 1. Extract text
        extracted_text = ""
        with pdfplumber.open(file.file) as pdf:
            for page in pdf.pages:
                text = page.extract_text()
                if text:
                    extracted_text += text + "\n"

        if not extracted_text.strip():
            raise HTTPException(status_code=400, detail="Could not read text. This might be an image-only PDF.")

        # --- THE FIX: Chunking the PDF ---
        # Split text into chunks of 8000 characters to respect token limits
        chunk_size = 8000
        chunks = [extracted_text[i:i+chunk_size] for i in range(0, len(extracted_text), chunk_size)]

        # Protect the free-tier API: Limit to 3 chunks max (approx 10-15 pages) for the demo
        max_chunks = min(len(chunks), 3)

        all_cards = []

        # Process each chunk sequentially
        for i in range(max_chunks):
            prompt = f"""
            You are an expert cognitive science tutor evaluating material for Cuemath. 
            Extract the core concepts, technical definitions, and application scenarios from the following text into high-quality flashcards.
            
            You MUST output ONLY valid JSON matching this exact format:
            {{
                "cards": [
                    {{"front": "Question here", "back": "Answer here"}}
                ]
            }}
            
            Text context:
            {chunks[i]} 
            """

            response = client.chat.completions.create(
                messages=[
                    {
                        "role": "system",
                        "content": "You are a precise API that only outputs valid JSON."
                    },
                    {
                        "role": "user",
                        "content": prompt
                    }
                ],
                model="llama-3.3-70b-versatile",
                response_format={"type": "json_object"},
                temperature=0.2
            )

            # Append the new cards to our master list
            chunk_data = json.loads(response.choices[0].message.content)
            if "cards" in chunk_data:
                all_cards.extend(chunk_data["cards"])
                
            # Sleep for 1 second between API calls to prevent Groq rate limits
            await asyncio.sleep(1)

        # 3. Return the compiled JSON array to the frontend
        return {"cards": all_cards}

    except Exception as e:
        error_msg = str(e)
        print(f"Server Error: {error_msg}")
        
        if "rate limit" in error_msg.lower() or "429" in error_msg:
            raise HTTPException(
                status_code=429, 
                detail="API rate limit reached. Please wait a few seconds and try again."
            )
            
        raise HTTPException(status_code=500, detail="An error occurred while generating flashcards.")