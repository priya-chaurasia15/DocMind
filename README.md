# DocMind: Chat with Your PDFs, Fully Offline

Ask questions about any PDF and get answers with **page citations**, running entirely on your own laptop. No cloud, no API keys, no data leaves your machine.
<!--
![DocMind screenshot](docmind_img)

**Demo video:** [Watch here](docmind_vid)
-->
## The Problem

Long PDFs such as research papers, contracts, notes, and manuals are slow to search through. Cloud AI tools can answer questions about them, but that means uploading private documents to someone else's servers, needing internet, and often paying for API usage.

## The Solution

DocMind uses **Retrieval-Augmented Generation (RAG)**. It finds the most relevant parts of your PDF and gives only those to a small local AI model. The model then answers using the document itself, and cites the page, so you can verify every answer.

-  **Private:** documents never leave your computer
-  **Offline:** works without internet once set up
-  **Trustworthy:** every answer shows its page numbers and source text
-  **Lightweight:** runs on a CPU-only laptop with 8 GB RAM

## Tech Stack

**MERN + Ollama**

| Part | Technology |
|---|---|
| Frontend | React (Vite) |
| Backend | Node.js, Express |
| Database | MongoDB |
| PDF parsing | pdf.js |
| Local AI | Ollama |

## Models Used and Why

| Model | Role | Why |
|---|---|---|
| **Llama 3.2 1B** | Writes the answer | Small enough to run on a CPU-only 8 GB laptop, yet good enough to answer from provided text |
| **all-minilm** | Turns text into vectors for search | Only ~46 MB and fast, so indexing and searching stay quick without a GPU |

## How It Works

1. **Upload:** text is extracted page by page and split into overlapping chunks
2. **Index:** each chunk is converted to an embedding and saved in MongoDB
3. **Search:** your question is embedded and matched to the closest chunks (cosine similarity)
4. **Answer:** the best chunks go to Llama 3.2, which streams back an answer with page citations

## Run It Locally

**Prerequisites:** Node.js 18+, MongoDB, [Ollama](https://ollama.com)

```bash
ollama pull llama3.2:1b
ollama pull all-minilm

git clone https://github.com/priya-chaurasia15/docmind.git
cd docmind/server && npm install && copy .env.example .env && npm run dev
```
**Start the frontend** in a second terminal:

```bash
cd docmind/client
npm install
npm run dev
```

Then open **http://localhost**, upload a PDF, and start asking questions. 

## Good to Know

- Works best with text-based PDFs. Scanned (image-only) PDFs need OCR first.
- The first answer can take a few seconds while the model loads. Later answers are faster.

## What's Next

- Search across multiple PDFs
- Chat memory for follow-up questions
- OCR support for scanned documents

---

⭐ If you like this project, give it a star! Built by **PRIYANKA CHAURASIA** · [GitHub](https://github.com/priya-chaurasia15) · [LinkedIn](https://www.linkedin.com/in/priyanka-chaurasia-147410253?)
