import os
import io
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
from dotenv import load_dotenv
from PyPDF2 import PdfReader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_community.vectorstores import FAISS

from langchain_community.embeddings import HuggingFaceEmbeddings
from openai import OpenAI
#test in smit branch

load_dotenv()

app = FastAPI()

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global variable for vector store (in-memory)
vector_store = None

class QueryRequest(BaseModel):
    question: str

class QueryResponse(BaseModel):
    answer: str

@app.get("/")
async def root():
    return {"message": "RAG Application API is running"}

def extract_text_from_pdf(file_content: bytes) -> str:
    pdf_reader = PdfReader(io.BytesIO(file_content))
    text = ""
    for page in pdf_reader.pages:
        text += page.extract_text() or ""
    return text

@app.post("/upload")
async def upload_pdf(file: UploadFile = File(...)):
    global vector_store
    if not file.filename.endswith(".pdf"):
        raise HTTPException(status_code=400, detail="File must be a PDF")

    try:
        content = await file.read()
        text = extract_text_from_pdf(content)

        if not text:
             raise HTTPException(status_code=400, detail="No text found in PDF")

        text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=1000,
            chunk_overlap=200,
            length_function=len,
        )
        chunks = text_splitter.split_text(text)

        # Use OpenAIEmbeddings with Gemini base_url
        embeddings = HuggingFaceEmbeddings(model_name="all-MiniLM-L6-v2")

        vector_store = FAISS.from_texts(chunks, embeddings)

        return {"message": f"Successfully processed {file.filename}. {len(chunks)} chunks indexed."}
    except Exception as e:
        print(f"Error in /upload: {e}")
        # In a real environment, you'd handle the 'UNIMPLEMENTED' error gracefully
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/query", response_model=QueryResponse)
async def query_question(request: QueryRequest):
    global vector_store
    if vector_store is None:
        raise HTTPException(status_code=400, detail="Please upload a PDF first.")

    try:
        # 1. Similarity search
        docs = vector_store.similarity_search(request.question, k=4)
        context = "\n\n".join([doc.page_content for doc in docs])

        # 2. RAG Prompt
        prompt = f"""You are a helpful assistant. Use the following pieces of context to answer the user's question.
If you don't know the answer based on the context, just say you don't know, don't try to make up an answer.

Context:
{context}

Question: {request.question}

Answer:"""

        # 3. Gemini-OpenAI SDK integration
        client = OpenAI(
            api_key=os.getenv("GEMINI_API_KEY"),
            base_url="https://generativelanguage.googleapis.com/v1beta/openai/"
        )

        response = client.chat.completions.create(
            model="gemini-2.5-flash",
            messages=[
                {"role": "system", "content": "You are a helpful assistant."},
                {"role": "user", "content": prompt}
            ]
        )

        answer = response.choices[0].message.content
        return QueryResponse(answer=answer)

    except Exception as e:
        print(f"Error in /query: {e}")
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
