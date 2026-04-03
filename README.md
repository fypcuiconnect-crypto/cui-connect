# CUI Connect AI
**An Intelligent RAG-Powered Assistant for COMSATS University Islamabad.**

CUI Connect is a full-stack AI platform designed to help students and faculty navigate university information—from fee structures and department details to campus-specific queries—using Retrieval-Augmented Generation (RAG).

---

## Key Features

* **RAG-Powered Conversations:** Real-time streaming chat that retrieves accurate data from the official COMSATS knowledge base.
* **Inline Smart Autocomplete:** Powered by **Algolia v5**, featuring "Ghost Text" suggestions and **Tab-to-Complete** functionality for common student queries.
* **Dynamic UI/UX:**
    * Official **CUI Branding** and iconography.
    * **High-Tech Loading States:** A randomized "Thinking" spinner that cycles through backend processing verbs.
    * **Responsive Sidebar:** Collapsible navigation with optimistic updates for renaming and deleting chats.
* **Complete Chat Management:** Full CRUD operations for chat history synced with **Supabase**.
* **Theme Support:** Fully integrated Light and Dark modes.

---

## Tech Stack

### Frontend
* **Framework:** Next.js 14/15 (App Router)
* **Styling:** Tailwind CSS + Shadcn UI
* **Animations:** Framer Motion
* **Search/Autocomplete:** Algolia Search Client (v5)
* **Markdown:** React-Markdown with GFM support

### Backend
* **API:** FastAPI (Python)
* **Database & Auth:** Supabase (PostgreSQL)
* **Security:** Row Level Security (RLS) policies for data privacy.
* **Async Processing:** Python `asyncio` for non-blocking database operations.

---

## Getting Started

### 1. Prerequisites
* Node.js (v18 or higher)
* Python 3.10+
* A Supabase Project
* An Algolia Application (with a `query` searchable attribute)

### 2. Installation

**Frontend Setup:**
```bash
cd frontend
npm install --legacy-peer-deps
npm run dev
```

**Backend Setup:**
```bash
cd backend
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload
```
