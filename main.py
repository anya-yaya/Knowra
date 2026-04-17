from fastapi import FastAPI, UploadFile
from fastapi.middleware.cors import CORSMiddleware
import fitz  # PyMuPDF
from sentence_transformers import SentenceTransformer
import chromadb
import ollama

# ------------------ INIT ------------------

app = FastAPI()

# Enable CORS (important for frontend)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Load embedding model
embedding_model = SentenceTransformer('all-MiniLM-L6-v2')

# Setup Chroma DB (persistent)
client = chromadb.PersistentClient(path="./data")
collection = client.get_or_create_collection("docs")

# ------------------ UTILS ------------------

def extract_text(file_bytes):
    doc = fitz.open(stream=file_bytes, filetype="pdf")
    text = ""
    for page in doc:
        text += page.get_text()
    return text


def chunk_text(text, size=500):
    return [text[i:i+size] for i in range(0, len(text), size)]


def get_embeddings(texts):
    return embedding_model.encode(texts).tolist()


def store(chunks, embeddings):
    for i, chunk in enumerate(chunks):
        collection.add(
            documents=[chunk],
            embeddings=[embeddings[i]],
            ids=[str(i)]
        )


def retrieve(query_embedding):
    results = collection.query(
        query_embeddings=[query_embedding],
        n_results=3
    )
    return results


# ------------------ FEATURES ------------------

def generate_quiz(context):
    prompt = f"Generate 3 MCQs from this:\n{context}"
    res = ollama.chat(model='llama3', messages=[
        {"role": "user", "content": prompt}
    ])
    return res['message']['content']


def generate_timeline(context):
    prompt = f"Extract a timeline of events:\n{context}"
    res = ollama.chat(model='llama3', messages=[
        {"role": "user", "content": prompt}
    ])
    return res['message']['content']


# ------------------ API ------------------

@app.get("/")
def home():
    return {"message": "NotebookLM++ Backend Running 🚀"}


@app.post("/upload")
async def upload(file: UploadFile):
    file_bytes = await file.read()
    
    text = extract_text(file_bytes)
    chunks = chunk_text(text)
    embeddings = get_embeddings(chunks)
    
    store(chunks, embeddings)

    return {
        "message": "Document processed successfully",
        "chunks": len(chunks)
    }


@app.post("/query")
async def query(q: str):
    query_emb = get_embeddings([q])[0]
    results = retrieve(query_emb)

    docs = results['documents'][0]
    context = "\n".join(docs)

    # LLM Answer
    prompt = f"""
    Answer using ONLY the context below.
    
    Context:
    {context}

    Question: {q}
    """

    response = ollama.chat(model='llama3', messages=[
        {"role": "user", "content": prompt}
    ])

    answer = response['message']['content']

    # Extra features
    quiz = generate_quiz(context)
    timeline = generate_timeline(context)

    # Confidence (simple logic)
    confidence = min(len(context) / 1000, 1.0)

    return {
        "answer": answer,
        "sources": docs,
        "quiz": quiz,
        "timeline": timeline,
        "confidence": confidence
    }