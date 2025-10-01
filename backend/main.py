import os
import uuid
from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

UPLOAD_DIR = 'uploads'
os.makedirs(UPLOAD_DIR, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")

@app.post('/classify')
async def classify(file: UploadFile = File(...)):
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Please upload an image file")
    
    ext = os.path.splitext(file.filename or "")[1] or ".jpg"
    filename = f"{uuid.uuid4().hex}{ext}"
    save_path = os.path.join(UPLOAD_DIR, filename)

    data = await file.read()
    if not data:
        raise HTTPException(status_code=400, detail="Empty file")
    with open(save_path, "wb") as f:
        f.write(data)

    file_url = f"/uploads/{filename}"

    return {
        "saved": True,
        "file_url": file_url,      # relative URL served by this app
        "filename": filename,
        "content_type": file.content_type,
        "note": "No model run yet; use file_url later for preprocessing/inference.",
    }