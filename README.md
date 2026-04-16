# FlashForge. | AI-Powered Spaced Repetition

**FlashForge** is an intelligent learning infrastructure designed to transform static documents into active recall systems. It utilizes AI for automated flashcard generation and implements the SuperMemo-2 (SM-2) algorithm to optimize human retention.

🔗 **[Live Demo](Insert-Your-Netlify-Link-Here)** | 📹 **[60-Second Video Walkthrough](Insert-Loom/YouTube-Link-Here)**

---

## 🧠 Core Architecture & Features

### 1. Automated Knowledge Extraction (Python / FastAPI)
Manual flashcard creation is the biggest bottleneck in active recall. FlashForge solves this by ingesting PDF documents and using AI to extract high-yield concepts.
* **PDF Parsing:** Extracts raw text from uploaded materials.
* **Semantic Chunking:** Contextualizes the text for the LLM to prevent hallucinations.
* **Q&A Generation:** Synthesizes the parsed data into strict Front/Back flashcard JSON pairs.

### 2. Spaced Repetition Engine (SM-2 Algorithm)
FlashForge doesn't just show you cards; it predicts when you are about to forget them. The application utilizes a custom implementation of the SM-2 algorithm to schedule reviews.

When a card is reviewed, the user grades their recall (0 = Blackout, 5 = Perfect). The engine calculates the next optimal review date using:
* **Ease Factor (EF):** $EF' = EF + (0.1 - (5 - q) \times (0.08 + (5 - q) \times 0.02))$
* **Interval (I):** Dictates the days until the next review based on the repetition count and current EF.
* **Query Logic:** The database actively filters out cards where `next_review > NOW()`, ensuring users only study what is mathematically required for retention.

### 3. Asynchronous UX & Security (React / Supabase)
* **Dynamic Polling:** Provides step-by-step UI feedback during the heavy AI processing phase.
* **Row Level Security (RLS):** Supabase database policies ensure user vaults are strictly isolated.
* **Session Management:** Secure JWT handling for standard email authentication and a frictionless "Guest Bypass" for technical evaluations.

---

## 🛠 Tech Stack

* **Frontend:** React (Vite), Tailwind CSS, Lucide Icons
* **Backend:** Python, FastAPI, Uvicorn
* **Database & Auth:** Supabase (PostgreSQL)
* **AI Integration:** LLM for structured JSON output

---

## 🚀 Local Development Setup

### 1. Clone the repository
```bash
git clone [https://github.com/MKeshav04/FlashForge-AI-POWERED-FLASHCARDS-WITH-SM-2.git](https://github.com/MKeshav04/FlashForge-AI-POWERED-FLASHCARDS-WITH-SM-2.git)
cd FlashForge-AI-POWERED-FLASHCARDS-WITH-SM-2