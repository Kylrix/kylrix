# Self-Hosting Kylrix 🏴

**Take control of your sovereign agentic workspace.**

Kylrix is the first truly sovereign, E2EE agentic operating system designed to run anywhere. By self-hosting, you ensure absolute data ownership and eliminate reliance on third-party infrastructure. You are deploying a cutting-edge, open-source platform poised to capture the $100B+ combined AI agent and productivity market—right on your own hardware.

---

## 🚀 Prerequisites & Preparation

Before launching Kylrix, you need to prepare your infrastructure.

### 1. Appwrite Backend (Mandatory)
Kylrix requires an **Appwrite** instance. You can use their [Cloud service](https://appwrite.io) or [Self-host Appwrite](https://appwrite.io/docs/advanced/self-hosting) on your own server.

**Critical Appwrite Configuration:**
- **Add Web Platform:** In your Appwrite project, navigate to **Settings > Platforms** and add a **Web App**. 
  - **Hostname:** Set this to your deployment domain (e.g., `kylrix.my-domain.com` or `localhost`). This is required for CORS and Auth to function.
- **Email Setup (Optional but Recommended):** 
  - For **Collaboration:** If you intend to have multiple users collaborating, you **must** configure an SMTP provider in your Appwrite instance so users can verify emails and receive notifications.
  - For **Personal Use:** If you are the sole user, email setup is optional as you can manually verify your user account in the Appwrite Console.

### 2. AI Infrastructure (Agentic Features)
Kylrix supports a **BYOK (Bring Your Own Key)** model to power its agentic features. Ensure these are set in your `.env` file:
- `GOOGLE_API_KEY`: Your Google Gemini API key.
- `GEMINI_MODEL_NAME`: The specific model to use (e.g., `gemini-1.5-pro`).

---

## 📦 Quick Start with Docker/Podman

### 1. Clone and Configure
```bash
git clone https://github.com/Kylrix/kylrix.git
cd kylrix
cp env.sample .env
```

Edit `.env` and fill in the following:
- `NEXT_PUBLIC_APP_URL`: Your full public URL (e.g., `https://kylrix.my-domain.com`).
- `ADMINS`: Comma-separated list of admin email addresses.
- `KYLRIX_INTERNAL_JOBS_SECRET`: A long random string (min 32 chars) for internal task security.

### 2. Build and Launch
The provided `docker-compose.yml` handles the multi-stage build. 

**Note on Build-Time Config:** Because Kylrix currently has some hardcoded endpoint logic for high-performance inlining, you **must** pass your custom Appwrite details as environment variables *at build time* so the Dockerfile can surgically patch them.

**Using Docker:**
```bash
APPWRITE_ENDPOINT="https://your-api.com/v1" \
APPWRITE_PROJECT_ID="your_project_id" \
DOMAIN="your-domain.com" \
docker-compose up -d --build
```

**Using Podman:**
```bash
APPWRITE_ENDPOINT="https://your-api.com/v1" \
APPWRITE_PROJECT_ID="your_project_id" \
DOMAIN="your-domain.com" \
podman-compose up -d --build
```

---

## 🛡️ Configuration Reference

| Environment Variable | Build/Runtime | Description |
|----------|----------|-------------|
| `APPWRITE_ENDPOINT` | **Build** | Your Appwrite API URL (with `/v1`). |
| `APPWRITE_PROJECT_ID` | **Build** | Your Appwrite Project ID. |
| `DOMAIN` | **Build** | Your base domain for cookies/security. |
| `NEXT_PUBLIC_APP_URL` | Runtime | The URL where the frontend is hosted. |
| `GOOGLE_API_KEY` | Runtime | API Key for Gemini/AI features. |
| `ADMINS` | Runtime | Emails allowed to access admin functions. |

---

## 🏗️ Architecture for Sovereign Engineers

Self-hosting Kylrix gives you:
- **Zero-Knowledge Security:** All encryption (MEK generation/wrapping) happens in the browser; your server never sees the raw data.
- **Sovereign Agentic Workflows:** Host your own AI agents that work while you sleep.
- **Data Privacy:** Your databases, your rules.

---

## 🛠️ Troubleshooting

- **CORS Errors:** Double-check that your domain is added as a "Web Platform" in the Appwrite Console.
- **Build Failures:** Ensure you have at least 4GB of RAM. Next.js builds (especially with Turbopack) are resource-intensive.
- **Auth Issues:** Ensure `DOMAIN` is set correctly. If it doesn't match the browser's domain, security cookies for the MEK and session will fail to set.

**Welcome to the future of work. Stay sovereign.** 🌙
