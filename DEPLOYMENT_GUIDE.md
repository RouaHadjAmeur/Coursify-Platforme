# Deployment Guide for Render

This guide will help you deploy your Coursify application to Render.

## Prerequisites

1. A GitHub account
2. Your code pushed to a GitHub repository
3. A Render account (sign up at https://render.com)

## Important Considerations

### 1. File Storage
⚠️ **Render's filesystem is ephemeral** - files uploaded to `uploads/` will be lost when the service restarts.

**Solutions:**
- Use a cloud storage service (AWS S3, Cloudinary, etc.)
- Use Render's persistent disk (paid plans)
- Use MongoDB GridFS for file storage

### 2. Database
Currently, you're using JSON files for storage. For production, you should:
- Set up MongoDB Atlas (free tier available)
- Or use Render's MongoDB service

### 3. Environment Variables
You'll need to set these in Render's dashboard.

## Deployment Steps

### Step 1: Prepare Your Repository

1. Make sure your code is pushed to GitHub
2. Create a `.env.example` file (optional, for documentation)

### Step 2: Deploy Backend

1. Go to Render Dashboard → New → Web Service
2. Connect your GitHub repository
3. Configure:
   - **Name**: `coursify-backend`
   - **Environment**: `Node`
   - **Build Command**: `cd backEnd && npm install`
   - **Start Command**: `cd backEnd && npm start`
   - **Root Directory**: Leave empty (or set to `backEnd` if you prefer)

4. Add Environment Variables:
   ```
   NODE_ENV=production
   PORT=3000
   SESSION_SECRET=<generate a random secret>
   CORS_ORIGIN=<your-frontend-url> (set after frontend is deployed)
   ```

5. Click "Create Web Service"

### Step 3: Deploy Frontend

1. Go to Render Dashboard → New → Static Site
2. Connect your GitHub repository
3. Configure:
   - **Name**: `coursify-frontend`
   - **Build Command**: `npm install && npm run build`
   - **Publish Directory**: `dist`

4. Add Environment Variables:
   ```
   VITE_API_URL=<your-backend-url>
   ```

5. Click "Create Static Site"

### Step 4: Update CORS and API URLs

1. After both services are deployed, copy the frontend URL
2. Go to backend service → Environment → Add:
   ```
   CORS_ORIGIN=<your-frontend-url>
   ```
3. Copy the backend URL
4. Go to frontend service → Environment → Update:
   ```
   VITE_API_URL=<your-backend-url>
   ```
5. Redeploy both services

### Step 5: Update Code for Production

You'll need to update your code to use environment variables:

**backEnd/server.js** - Update CORS origins:
```javascript
const ALLOWED_ORIGINS = [
  process.env.CORS_ORIGIN || 'http://localhost:5173',
  // Add your Render frontend URL here
];
```

**frontEnd** - Update API URLs to use `import.meta.env.VITE_API_URL`

## Alternative: Single Service Deployment

You can also serve the frontend from the backend:

1. Build the frontend: `npm run build`
2. Serve static files from backend:
   ```javascript
   app.use(express.static(path.join(__dirname, '../dist')));
   app.get('*', (req, res) => {
     res.sendFile(path.join(__dirname, '../dist/index.html'));
   });
   ```

## Database Migration

For production, migrate from JSON files to MongoDB:

1. Sign up for MongoDB Atlas (free tier)
2. Create a cluster
3. Get connection string
4. Update `backEnd/config/database.js` to use MongoDB
5. Set `MONGODB_URI` environment variable in Render

## File Uploads

For production file uploads, consider:

1. **Cloudinary** (free tier available):
   - Sign up at cloudinary.com
   - Install: `npm install cloudinary`
   - Update upload handlers to use Cloudinary

2. **AWS S3**:
   - Create S3 bucket
   - Install: `npm install aws-sdk`
   - Configure credentials

3. **Render Persistent Disk** (paid):
   - Add disk service in Render
   - Mount to your service

## Troubleshooting

- **Build fails**: Check build logs in Render dashboard
- **CORS errors**: Verify CORS_ORIGIN is set correctly
- **Session issues**: Ensure SESSION_SECRET is set
- **File uploads fail**: Implement cloud storage (see above)

## Cost

- **Free tier**: Both services can run on free tier
- **Limitations**: 
  - Services sleep after 15 minutes of inactivity
  - Limited build minutes per month
  - Ephemeral filesystem

## Next Steps

1. Set up MongoDB Atlas
2. Implement cloud storage for uploads
3. Configure custom domains (optional)
4. Set up monitoring and logging
