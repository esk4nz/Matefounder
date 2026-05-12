import re
from fastapi import FastAPI
from pydantic import BaseModel
from sentence_transformers import SentenceTransformer
from typing import List

app = FastAPI(title="Matefounder Vector API")

model = SentenceTransformer('lang-uk/ukr-paraphrase-multilingual-mpnet-base')
print("Модель готова")

class ProfileDataRequest(BaseModel):
    bio: str
    interests: List[str]

def clean_text(text: str) -> str:
    text_with_spaces = text.replace('/', ' / ')
    pattern = r'[^a-zA-Zа-яА-ЯґҐєЄіІїЇ\s\-\/\'\’]'
    cleaned = re.sub(pattern, '', text_with_spaces)
    return " ".join(cleaned.split())

@app.post("/generate-vector")
async def generate_vector(data: ProfileDataRequest):
    cleaned_interests = [clean_text(tag) for tag in data.interests if tag]
    interests_str = ", ".join(cleaned_interests)
    
    if interests_str:
        combined_text = f"{data.bio} Мої інтереси: {interests_str}."
    else:
        combined_text = data.bio
        
    vector = model.encode(combined_text)
    
    return {
        "vector": vector.tolist(),
        "combined_text": combined_text
    }