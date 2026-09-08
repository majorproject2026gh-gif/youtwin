# Git & GitHub Setup

This project isn't tracked in git yet on your machine. Here's exactly how to set that up
and push it to GitHub — useful for your professor to review commit history, and for
submitting the project as a repo link.

## 1. Initialize git (one-time, in the project root)

```bash
cd C:\Users\HP\Downloads\youtwin
git init
git add .
git commit -m "Initial commit: YouTwin - digital twin interaction framework"
```

**Important:** `git add .` respects `.gitignore`, so `node_modules/`, `.venv/`, and every
`.env` file (your real API keys) are automatically excluded — they will NOT be committed
or pushed. Only source code goes to GitHub.

## 2. Create the GitHub repo

1. Go to [github.com/new](https://github.com/new)
2. Repository name: `youtwin` (or whatever you like)
3. Leave it **empty** — don't check "Add a README" or ".gitignore" (you already have both)
4. Click **Create repository**

## 3. Connect and push

GitHub will show you a page with commands after creating the repo — they'll look like this
(replace `your-username` with your actual GitHub username):

```bash
git remote add origin https://github.com/your-username/youtwin.git
git branch -M main
git push -u origin main
```

If prompted to sign in, use your GitHub username and a **Personal Access Token** as the
password (GitHub no longer accepts your account password directly for git operations) —
create one at [github.com/settings/tokens](https://github.com/settings/tokens) → "Generate
new token (classic)" → check the `repo` scope.

## 4. Ongoing workflow

Every time you make changes you want saved:

```bash
git add .
git commit -m "Describe what changed"
git push
```

## 5. Team collaboration (optional, since this is a 4-person project)

Add your teammates as collaborators: GitHub repo → Settings → Collaborators → Add people.
Each teammate then clones the repo locally:

```bash
git clone https://github.com/your-username/youtwin.git
```

They'll each need their own `.env` files (never committed) — copy the `.env.example`
templates in `ai-service/` and `api-service/`, and `frontend/.env.local` isn't templated
but follows the same pattern shown in the main README's Quickstart section.

## 6. What NOT to commit

Never commit real `.env` files — they contain your Qdrant, Neon, Groq, and Google OAuth
credentials. The `.gitignore` already blocks this, but always double-check with
`git status` before pushing if you ever manually add files with `git add <specific-file>`.
