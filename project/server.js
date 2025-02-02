import express from 'express';
import cors from 'cors';
import multer from 'multer';
import { Octokit } from 'octokit';
import dotenv from 'dotenv';
import { Buffer } from 'buffer';

dotenv.config();

const app = express();
const upload = multer();

app.use(cors());
app.use(express.json());

// Validate environment variables
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GITHUB_OWNER = process.env.GITHUB_OWNER;
const GITHUB_REPO = process.env.GITHUB_REPO;
const GITHUB_BRANCH = process.env.GITHUB_BRANCH || 'main'; // Default to 'main' if not specified

if (!GITHUB_TOKEN || !GITHUB_OWNER || !GITHUB_REPO) {
  console.error('❌ Missing required environment variables:');
  if (!GITHUB_TOKEN) console.error('- GITHUB_TOKEN');
  if (!GITHUB_OWNER) console.error('- GITHUB_OWNER');
  if (!GITHUB_REPO) console.error('- GITHUB_REPO');
  process.exit(1);
}

const octokit = new Octokit({ auth: GITHUB_TOKEN });

// Verify repository access
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

app.post('/upload', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: '❌ No image file provided' });
    }

    // Ensure images directory exists
    try {
      await octokit.rest.repos.getContent({ owner: GITHUB_OWNER, repo: GITHUB_REPO, path: 'images' });
    } catch (error) {
      if (error.status === 404) {
        console.log('📂 "images" folder not found. Creating it...');
        try {
          await octokit.rest.repos.createOrUpdateFileContents({
            owner: GITHUB_OWNER,
            repo: GITHUB_REPO,
            path: 'images/README.md',
            message: 'Create images directory',
            content: Buffer.from('# Images Directory\nThis directory contains uploaded images.').toString('base64'),
            branch: GITHUB_BRANCH
          });
        } catch (createError) {
          console.error('❌ Failed to create "images" folder:', createError.response?.data?.message || createError.message);
          return res.status(500).json({ error: 'Failed to create images directory on GitHub' });
        }
      } else {
        console.error('❌ Error checking "images" folder:', error.response?.data?.message || error.message);
        return res.status(500).json({ error: 'GitHub API error while checking folder' });
      }
    }

    const sanitizedFileName = req.file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
    const filePath = `images/${Date.now()}-${sanitizedFileName}`;
    const fileContent = req.file.buffer.toString('base64');

    let sha = null;

    try {
      // Check if the file already exists
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

    // Upload or update file
    try {
      const response = await octokit.rest.repos.createOrUpdateFileContents({
        owner: GITHUB_OWNER,
        repo: GITHUB_REPO,
        path: filePath,
        message: `Upload image: ${req.file.originalname}`,
        content: fileContent,
        branch: GITHUB_BRANCH,
        ...(sha && { sha }) // Include SHA if updating existing file
      });

      const imageUrl = `https://raw.githubusercontent.com/${GITHUB_OWNER}/${GITHUB_REPO}/${GITHUB_BRANCH}/${filePath}`;
      console.log('✅ Successfully uploaded image:', imageUrl);
      res.json({ url: imageUrl });
    } catch (uploadError) {
      console.error('❌ GitHub API error during upload:', uploadError.response?.data?.message || uploadError.message);
      console.error('Upload Error Details:', uploadError.response?.data || uploadError);
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
