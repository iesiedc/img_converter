import express from 'express';
import cors from 'cors';
import multer from 'multer';
import { Octokit } from 'octokit';
import dotenv from 'dotenv';
import { Buffer } from 'buffer';
import axios from 'axios';
import sharp from 'sharp';  // Import sharp for image conversion

dotenv.config();

const app = express();
const upload = multer();

app.use(cors());
app.use(express.json());

const GITHUB_TOKEN = process.env.GITHUBTOKEN;
const GITHUB_OWNER = process.env.GITHUBOWNER;
const GITHUB_REPO = process.env.GITHUBREPO;
const GITHUB_BRANCH = process.env.GITHUB_BRANCH || 'main';

if (!GITHUB_TOKEN || !GITHUB_OWNER || !GITHUB_REPO) {
  console.error('❌ Missing required GitHub Secrets.');
  process.exit(1);
}

const octokit = new Octokit({ auth: GITHUB_TOKEN });

async function verifyRepoAccess() {
  try {
    await octokit.rest.repos.get({ owner: GITHUB_OWNER, repo: GITHUB_REPO });
    console.log('✅ Successfully connected to GitHub repository');
  } catch (error) {
    console.error('❌ Failed to access GitHub repository:', error.response?.data?.message || error.message);
    process.exit(1);
  }
}

verifyRepoAccess();

// 🔄 Function to Ping API Every 1 Minute
async function pingServer() {
  const url = 'https://iedc-03oe.onrender.com/api/test/ping';
  try {
    const response = await axios.get(url);
    console.log(`✅ Ping successful: ${response.status} ${response.statusText}`);
  } catch (error) {
    console.error('❌ Ping failed:', error.message);
  }
}

setInterval(pingServer, 60 * 10000);

app.post('/upload', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: '❌ No image file provided' });
    }

    let fileBuffer = req.file.buffer;
    let fileName = req.file.originalname;
    let fileExtension = fileName.split('.').pop().toLowerCase();

    // If image is HEIC, convert it to JPG
    if (fileExtension === 'heic' || fileExtension === 'heif') {
      console.log('🔄 Converting HEIC to JPG...');
      fileBuffer = await sharp(fileBuffer).jpeg({ quality: 100 }).toBuffer();
      fileName = fileName.replace(/\.[^.]+$/, '.jpg'); // Change extension to JPG
    }

    const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
    const filePath = `images/${Date.now()}-${sanitizedFileName}`;
    const fileContent = fileBuffer.toString('base64');

    let sha = null;

    try {
      const { data } = await octokit.rest.repos.getContent({
        owner: GITHUB_OWNER,
        repo: GITHUB_REPO,
        path: filePath
      });
      sha = data.sha;
      console.log(`ℹ️ File ${filePath} exists. Updating it...`);
    } catch (error) {
      if (error.status !== 404) {
        console.error('❌ Error checking file existence:', error.response?.data?.message || error.message);
        return res.status(500).json({ error: 'GitHub API error while checking file' });
      }
      console.log(`📂 File ${filePath} does not exist. Creating a new file...`);
    }

    try {
      const response = await octokit.rest.repos.createOrUpdateFileContents({
        owner: GITHUB_OWNER,
        repo: GITHUB_REPO,
        path: filePath,
        message: `Upload image: ${fileName}`,
        content: fileContent,
        branch: GITHUB_BRANCH,
        ...(sha && { sha })
      });

      const imageUrl = `https://raw.githubusercontent.com/${GITHUB_OWNER}/${GITHUB_REPO}/${GITHUB_BRANCH}/${filePath}`;
      console.log('✅ Successfully uploaded image:', imageUrl);
      res.json({ url: imageUrl });
    } catch (uploadError) {
      console.error('❌ GitHub API error during upload:', uploadError.response?.data?.message || uploadError.message);
      res.status(500).json({ error: 'Failed to upload image to GitHub' });
    }
  } catch (error) {
    console.error('❌ Unexpected error:', error.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📡 GitHub Configuration:`);
  console.log(`- Owner: ${GITHUB_OWNER}`);
  console.log(`- Repository: ${GITHUB_REPO}`);
  console.log(`- Branch: ${GITHUB_BRANCH}`);
});

app.get('/ping', async (req, res) => {
 console.log("server is fine ");
});
