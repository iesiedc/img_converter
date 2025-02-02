import React, { useState, useRef } from 'react';
import { Upload, Image as ImageIcon, Link, Copy } from 'lucide-react';
import axios from 'axios';

function App() {
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploadedUrl, setUploadedUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedImage(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreviewUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const file = event.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) {
      setSelectedImage(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreviewUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const uploadToGitHub = async () => {
    if (!selectedImage) return;

    setIsUploading(true);
    const formData = new FormData();
    formData.append('image', selectedImage);

    try {
      const response = await axios.post('http://localhost:3000/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      setUploadedUrl(response.data.url);
    } catch (error) {
      console.error('Error uploading image:', error);
      alert('Failed to upload image to GitHub');
    } finally {
      setIsUploading(false);
    }
  };

  const copyToClipboard = async () => {
    if (uploadedUrl) {
      try {
        await navigator.clipboard.writeText(uploadedUrl);
        alert('URL copied to clipboard!');
      } catch (err) {
        console.error('Failed to copy URL:', err);
      }
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 text-white p-8">
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold mb-4">Image Upload to GitHub</h1>
          <p className="text-gray-400">Upload your image and get a GitHub URL</p>
        </div>

        <div
          className="border-2 border-dashed border-gray-600 rounded-lg p-8 mb-8 hover:border-blue-500 transition-colors cursor-pointer"
          onClick={() => fileInputRef.current?.click()}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
        >
          <input
            type="file"
            ref={fileInputRef}
            className="hidden"
            accept="image/*"
            onChange={handleImageSelect}
          />
          <div className="flex flex-col items-center gap-4">
            {previewUrl ? (
              <img
                src={previewUrl}
                alt="Preview"
                className="max-h-64 rounded-lg shadow-lg"
              />
            ) : (
              <>
                <Upload className="w-16 h-16 text-gray-400" />
                <p className="text-gray-400 text-center">
                  Drag and drop your image here or click to select
                </p>
              </>
            )}
          </div>
        </div>

        {selectedImage && (
          <div className="bg-gray-800 rounded-lg p-6 shadow-xl">
            <div className="flex items-center gap-4 mb-4">
              <ImageIcon className="text-blue-500" />
              <span className="font-medium">{selectedImage.name}</span>
            </div>
            {uploadedUrl ? (
              <div className="mt-4">
                <div className="flex items-center gap-4 bg-gray-700 p-3 rounded">
                  <Link className="text-blue-500" />
                  <input
                    type="text"
                    value={uploadedUrl}
                    readOnly
                    className="flex-1 bg-transparent text-sm text-gray-300 outline-none"
                  />
                  <button
                    onClick={copyToClipboard}
                    className="text-blue-500 hover:text-blue-400"
                  >
                    <Copy className="w-5 h-5" />
                  </button>
                </div>
              </div>
            ) : (
              <button
                className={`mt-4 w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition-colors ${
                  isUploading ? 'opacity-50 cursor-not-allowed' : ''
                }`}
                onClick={uploadToGitHub}
                disabled={isUploading}
              >
                {isUploading ? 'Uploading...' : 'Upload to GitHub'}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default App;