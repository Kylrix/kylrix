# Self-Hosting Kylrix

Run your own instance of Kylrix on any Linux/macOS server or local machine with Docker.

---

## ⚡ Quick Start (1-Command Installer)

To install and run Kylrix in a single step:

```bash
curl -fsSL https://raw.githubusercontent.com/Kylrix/kylrix/master/selfhost.sh | bash
```

Once started, access your local instance at **`http://localhost:3006`** (or the port specified).

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
APP_PORT=3006
PORT=3000
NODE_ENV=production
NEXT_TELEMETRY_DISABLED=1
DOMAIN=localhost
NEXT_PUBLIC_DOMAIN=localhost
NEXT_PUBLIC_APPWRITE_ENDPOINT=https://api.kylrix.space/v1
NEXT_PUBLIC_APPWRITE_PROJECT_ID=67fe9627001d97e37ef3
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

## 🔄 Updates

To update your self-hosted instance to the latest release:

```bash
cd ~/kylrix-selfhost
git pull origin master
docker compose up -d --build
```
