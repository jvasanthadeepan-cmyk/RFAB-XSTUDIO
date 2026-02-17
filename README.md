# Lab Material Management System

## Deployment

This project is configured for deployment on Render using a Blueprint (`render.yaml`).

### Steps to Deploy
1. Push this code to a GitHub repository.
2. Go to [Render Dashboard](https://dashboard.render.com/).
3. Select **New +** -> **Blueprint**.
4. Connect your repository.
5. Click **Apply**.

Render will automatically provision a PostgreSQL database and start the web service.

### Local Development
1. `npm install`
2. `npm run dev` creates a local server at `http://localhost:5000`.
3. Ensure you have a local PostgreSQL database running and configured in `.env` (or use default credentials).
