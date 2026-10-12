# Kylrix REST API Quickstart Samples

Modular, copy-pasteable scripts for interacting with the **Kylrix HTTP API (`/api/v1`)**.

## 🔑 Authentication

Every script reads credentials from the `KYLRIX_TOKEN` environment variable:

```bash
# Personal Access Token (PAT) or Punch Token
export KYLRIX_TOKEN="kyl_pat_your_token_here"

# (Optional) Target local dev or self-hosted instance
export KYLRIX_URL="https://www.kylrix.space"  # or http://localhost:3005
```

Tokens can be minted instantly in the UI under **[Settings → Developers](https://www.kylrix.space/settings?tab=developers)**.

---

## 📂 Scripts Catalog

| Action | Python Script | Bash / cURL Script | Endpoint |
|---|---|---|---|
| **Identity Check** | [`whoami.py`](whoami.py) | [`whoami.sh`](whoami.sh) | `GET /api/v1/me` |
| **List Ideas** | [`list_ideas.py`](list_ideas.py) | [`list_ideas.sh`](list_ideas.sh) | `GET /api/v1/ideas` |
| **Create Idea** | [`create_idea.py`](create_idea.py) | [`create_idea.sh`](create_idea.sh) | `POST /api/v1/ideas` |
| **Edit Idea** | [`edit_idea.py`](edit_idea.py) | [`edit_idea.sh`](edit_idea.sh) | `PATCH /api/v1/ideas/:id` |
| **Delete Idea** | [`delete_idea.py`](delete_idea.py) | [`delete_idea.sh`](delete_idea.sh) | `DELETE /api/v1/ideas/:id` |
| **List Goals** | [`list_goals.py`](list_goals.py) | [`list_goals.sh`](list_goals.sh) | `GET /api/v1/goals` |
| **Create Goal** | [`create_goal.py`](create_goal.py) | [`create_goal.sh`](create_goal.sh) | `POST /api/v1/goals` |
| **Search Ideas** | [`search.py`](search.py) | [`search.sh`](search.sh) | `GET /api/v1/ideas` |

---

## 🚀 Examples

### Python
```bash
python3 create_idea.py "Decentralized Architecture" "All nodes replicate using CRDTs" "architecture,sync"
python3 list_ideas.py 10
python3 search.py "crdt"
```

### Bash / cURL
```bash
chmod +x *.sh
./create_idea.sh "Sovereign Vaults" "AES-256-GCM encrypted notes" "security,vault"
./list_ideas.sh 5
./whoami.sh
```
