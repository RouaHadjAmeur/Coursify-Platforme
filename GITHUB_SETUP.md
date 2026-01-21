# How to Push Your Code to GitHub

Follow these steps to push your Coursify project to GitHub:

## Step 1: Initialize Git Repository

Open your terminal in the project directory and run:

```bash
cd /Users/mac/coursify
git init
```

## Step 2: Create .gitignore File

Make sure you have a `.gitignore` file to exclude sensitive files. Here's what should be ignored:

```
# Dependencies
node_modules/
package-lock.json

# Environment variables
.env
.env.local
.env.production

# Build outputs
dist/
build/

# Data files (if you want to keep them private)
backEnd/data/*.json
!backEnd/data/.gitkeep

# Uploads (user-generated content)
backEnd/uploads/
!backEnd/uploads/.gitkeep

# Logs
*.log
npm-debug.log*

# OS files
.DS_Store
Thumbs.db

# IDE files
.vscode/
.idea/
*.swp
*.swo

# Temporary files
*.tmp
.cache/
```

## Step 3: Add Files to Git

```bash
# Add all files
git add .

# Or add specific files
git add backEnd/ frontEnd/ package.json README.md
```

## Step 4: Make Your First Commit

```bash
git commit -m "Initial commit: Coursify learning platform"
```

## Step 5: Create a GitHub Repository

1. Go to https://github.com
2. Click the "+" icon in the top right
3. Select "New repository"
4. Name it (e.g., "coursify")
5. Choose Public or Private
6. **DO NOT** initialize with README, .gitignore, or license (you already have these)
7. Click "Create repository"

## Step 6: Connect Local Repository to GitHub

After creating the repository, GitHub will show you commands. Use these:

```bash
# Add the remote (replace YOUR_USERNAME with your GitHub username)
git remote add origin https://github.com/YOUR_USERNAME/coursify.git

# Or if you prefer SSH:
# git remote add origin git@github.com:YOUR_USERNAME/coursify.git
```

## Step 7: Push to GitHub

```bash
# Push to main branch
git branch -M main
git push -u origin main
```

If you're using master branch:
```bash
git branch -M master
git push -u origin master
```

## Step 8: Verify

Go to your GitHub repository page and verify all files are there.

## Troubleshooting

### Authentication Issues

If you get authentication errors:

**Option 1: Use Personal Access Token**
1. Go to GitHub → Settings → Developer settings → Personal access tokens → Tokens (classic)
2. Generate new token with `repo` scope
3. Use token as password when pushing

**Option 2: Use SSH**
1. Generate SSH key: `ssh-keygen -t ed25519 -C "your_email@example.com"`
2. Add to GitHub: Settings → SSH and GPG keys → New SSH key
3. Use SSH URL for remote

### Large Files

If you have large files in `uploads/`, consider:
- Adding `backEnd/uploads/` to `.gitignore`
- Using Git LFS for large files
- Or removing large files before pushing

## Next Steps After Pushing

1. Set up environment variables in Render
2. Connect Render to your GitHub repository
3. Deploy using the guide in `DEPLOYMENT_GUIDE.md`
