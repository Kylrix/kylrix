# Self-Hosting Kylrix

Run your own instance of Kylrix on any Linux/macOS server or local machine with Docker.

---

## ⚡ Quick Start (1-Command Installer)

To install and run Kylrix in a single step:

```bash
curl -fsSL https://raw.githubusercontent.com/Kylrix/kylrix/master/selfhost.sh | bash
```

Once started, access your local instance at **`http://localhost:5003`** (or the port specified).

---

## 🛠️ Manual Docker Compose Deployment

If you prefer to clone and manage your instance manually:

### 1. Clone the repository
```bash
git clone https://github.com/Kylrix/kylrix.git
cd kylrix
```

### 2. Configure Environment (`.env`)
```bash
cp .env.example .env
```
Default ports and parameters:
```env
APP_PORT=5003
PORT=3000
NODE_ENV=production
NEXT_TELEMETRY_DISABLED=1
DOMAIN=localhost
NEXT_PUBLIC_DOMAIN=localhost
NEXT_PUBLIC_APPWRITE_ENDPOINT=https://api.kylrix.space/v1
NEXT_PUBLIC_APPWRITE_PROJECT_ID=67fe9627001d97e37ef3

# Optional: Local Ollama AI Integration
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=llama3:latest

# Optional: Custom OpenAI-Compatible Local/Remote Endpoints
OPENAI_BASE_URL=http://localhost:8000/v1
OPENAI_API_KEY=your-key
OPENAI_MODEL=mistral
```

### 3. Build and Start
```bash
docker compose up -d --build
```

### 4. Check Container Status
```bash
docker compose ps
docker compose logs -f kylrix
```

---

## 🤖 Local AI & Ollama Configuration

Kylrix natively connects to local LLMs with automatic fallbacks:
- **Ollama**: Set `OLLAMA_BASE_URL=http://host.docker.internal:11434` (or `http://localhost:11434` if running natively) and `OLLAMA_MODEL=llama3:latest`.
- **OpenAI-Compatible Local Endpoints (vLLM, LM Studio, LocalAI, text-generation-webui)**: Set `OPENAI_BASE_URL` and `OPENAI_MODEL`.
- **Google Gemini**: Set `GOOGLE_API_KEY`.

---

## 🔄 Updates

To update your self-hosted instance to the latest release:

```bash
cd ~/kylrix-selfhost
git pull origin master
docker compose up -d --build
```
