# Deploy To GitHub Pages

This app is a static HTML/CSS/JavaScript app, so it can be hosted with GitHub Pages.

## First Time Setup

Run these commands from this project folder:

```powershell
git add index.html receipt-print.html manifest.json sw.js css js icons .github .nojekyll .gitignore GITHUB_PAGES_DEPLOY.md
git commit -m "Deploy C Plus billing app to GitHub Pages"
git push -u origin main
```

Then open GitHub:

```text
Repository -> Settings -> Pages -> Build and deployment -> Source -> GitHub Actions
```

After the workflow finishes, the app will be online at:

```text
https://k3sara.github.io/C-Plus-Billing-App/
```

## Update Later

After changing files, deploy again with:

```powershell
git add index.html receipt-print.html manifest.json sw.js css js icons .github .nojekyll .gitignore GITHUB_PAGES_DEPLOY.md
git commit -m "Update app"
git push
```
