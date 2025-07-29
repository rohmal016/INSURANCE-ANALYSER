"use client";
import { useRef, useState } from "react";

interface FileInfo {
  name: string;
  type: string;
  size: number;
}

export default function Home() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState(false);
  const [rawResponse, setRawResponse] = useState<object | null>(null);
  const [selectedModel, setSelectedModel] = useState("gemini"); // Default to Gemini
  const [detectedFiles, setDetectedFiles] = useState<FileInfo[]>([]);
  const [detectionMessage, setDetectionMessage] = useState("");
  const [isValidUpload, setIsValidUpload] = useState(false);

  // Intelligent file detection
  const detectFileTypes = (files: FileList) => {
    const pdfFiles = Array.from(files).filter(f => f.type === "application/pdf");
    const imageFiles = Array.from(files).filter(f => f.type.startsWith("image/"));
    
    const fileInfos: FileInfo[] = Array.from(files).map(f => ({
      name: f.name,
      type: f.type,
      size: f.size
    }));
    
    setDetectedFiles(fileInfos);
    
    // Validation logic
    if (pdfFiles.length > 0 && imageFiles.length > 0) {
      setDetectionMessage("❌ Cannot mix PDF and image files in the same upload");
      setIsValidUpload(false);
      return { isValid: false, type: null };
    }
    
    if (pdfFiles.length > 1) {
      setDetectionMessage("❌ Only one PDF file is allowed");
      setIsValidUpload(false);
      return { isValid: false, type: null };
    }
    
    if (imageFiles.length > 5) {
      setDetectionMessage("❌ Maximum 5 image files are allowed");
      setIsValidUpload(false);
      return { isValid: false, type: null };
    }
    
    if (pdfFiles.length === 1) {
      const pdfSizeMB = pdfFiles[0].size / 1024 / 1024;
      if (pdfSizeMB > 5) {
        setDetectionMessage(`❌ PDF file too large: ${pdfSizeMB.toFixed(2)} MB. Maximum allowed: 5 MB`);
        setIsValidUpload(false);
        return { isValid: false, type: null };
      }
      setDetectionMessage(`✅ Detected: 1 PDF file (${pdfSizeMB.toFixed(2)} MB)`);
      setIsValidUpload(true);
      return { isValid: true, type: "pdf" };
    }
    
    if (imageFiles.length > 0) {
      setDetectionMessage(`✅ Detected: ${imageFiles.length} image file(s) (${(imageFiles.reduce((sum, f) => sum + f.size, 0) / 1024 / 1024).toFixed(2)} MB total)`);
      setIsValidUpload(true);
      return { isValid: true, type: "images" };
    }
    
    setDetectionMessage("❌ No valid files detected");
    setIsValidUpload(false);
    return { isValid: false, type: null };
  };

  // Handle file selection
  const handleFileChange = () => {
    const files = fileInputRef.current?.files;
    if (!files || files.length === 0) {
      setDetectedFiles([]);
      setDetectionMessage("");
      setIsValidUpload(false);
      return;
    }
    
    const detection = detectFileTypes(files);
    
    // Auto-select appropriate model
    if (detection.isValid && detection.type === "images") {
      setSelectedModel("groq"); // Images can only use Groq
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage("");
    setSuccess(false);
    setRawResponse(null);
    
    const files = fileInputRef.current?.files;
    if (!files || files.length === 0) {
      setMessage("Please select files.");
      setSuccess(false);
      return;
    }

    // Re-validate file types and counts
    const detection = detectFileTypes(files);
    if (!detection.isValid) {
      setMessage(detectionMessage);
      setSuccess(false);
      return;
    }

    // Additional validation for model compatibility
    if (detection.type === "images" && selectedModel !== "groq") {
      setMessage("Images can only be processed with Groq model.");
      setSuccess(false);
      return;
    }
    
    setUploading(true);
    const formData = new FormData();
    
    // Add all files
    for (let i = 0; i < files.length; i++) {
      formData.append("files", files[i]);
    }
    
    // Add model selection
    formData.append("model", selectedModel);
    
    try {
      // Use the correct endpoint
      const endpoint = "http://localhost:8000/api/analyze-coi";
      
      const res = await fetch(endpoint, {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      console.log('Raw Response:', data); // Debug log
      
      if (res.ok) {
        const modelNames = {
          gemini: "Gemini AI",
          gemini2: "Gemini2 (Files API)",
          groq: "Groq AI"
        };
        setMessage(`${data.message || "Analysis completed!"} (${modelNames[selectedModel as keyof typeof modelNames]})`);
        setSuccess(true);
        setRawResponse(data.data); // Show only the data, not the wrapper
      } else {
        setMessage(data.message || "Analysis failed.");
        setSuccess(false);
        setRawResponse(null);
      }
    } catch {
      setMessage("Error analyzing files.");
      setSuccess(false);
      setRawResponse(null);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="w-full max-w-4xl p-8">
        <h1 className="text-3xl font-bold text-center text-gray-800 mb-8">PDF Analysis Tool</h1>
        
        <form onSubmit={handleSubmit} className="flex flex-col gap-4 border p-8 rounded-xl bg-white shadow-lg mb-8">
          <label className="font-semibold text-gray-800 text-lg">Upload ACORD 25 Files:</label>
          
          {/* File Upload */}
          <div className="flex flex-col gap-2">
            <label className="font-medium text-gray-700">Select Files:</label>
            <input
              type="file"
              accept="application/pdf,image/*"
              multiple
              ref={fileInputRef}
              onChange={handleFileChange}
              className="border border-gray-300 rounded p-2 text-gray-700 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-400"
              disabled={uploading}
            />
            <p className="text-sm text-gray-500">
              📄 PDF: 1 file maximum | 🖼️ Images: Up to 5 files maximum
            </p>
          </div>

          {/* File Detection Display */}
          {detectionMessage && (
            <div className={`p-3 rounded-lg border ${
              isValidUpload 
                ? "bg-green-50 border-green-200 text-green-800" 
                : "bg-red-50 border-red-200 text-red-800"
            }`}>
              <p className="font-medium">{detectionMessage}</p>
              {detectedFiles.length > 0 && (
                <div className="mt-2 text-sm">
                  <p className="font-medium">Selected files:</p>
                  <ul className="list-disc list-inside mt-1">
                    {detectedFiles.map((file, index) => (
                      <li key={index}>
                        {file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
          
          {/* Model Selection */}
          <div className="flex flex-col gap-2">
            <label className="font-medium text-gray-700">Select AI Model:</label>
            <select
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
              className="border border-gray-300 rounded p-2 text-gray-700 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-400"
              disabled={uploading || (detectedFiles.some(f => f.type.startsWith('image/')) && detectedFiles.length > 0)}
            >
              <option value="gemini">Google Gemini (Base64)</option>
              <option value="gemini2">Google Gemini2 (Files API)</option>
              <option value="groq">Groq (Llama 4 Scout)</option>
            </select>
            <p className="text-sm text-gray-600">
              {detectedFiles.some(f => f.type.startsWith('image/')) && detectedFiles.length > 0
                ? "🖼️ Images detected: Only Groq model is available for image processing"
                : selectedModel === "gemini" 
                ? "Uses Google Gemini AI with base64 encoding and fallback support"
                : selectedModel === "gemini2"
                ? "Uses Google Gemini AI with Files API for better large file handling"
                : "Uses Groq's Llama 4 Scout model with image-based processing"
              }
            </p>
          </div>
          <button
            type="submit"
            className="bg-blue-600 text-white rounded px-4 py-2 font-semibold text-lg hover:bg-blue-700 transition disabled:opacity-50"
            disabled={uploading || !isValidUpload}
          >
            {uploading ? `Analyzing with ${selectedModel === "gemini" ? "Gemini" : selectedModel === "gemini2" ? "Gemini2" : "Groq"}...` : "Analyze Files"}
          </button>
        </form>

        {message && (
          <div className={`text-center text-base font-medium p-4 rounded-lg mb-4 ${
            success ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
          }`}>
            {message}
          </div>
        )}

        {rawResponse && (
          <div className="bg-white rounded-xl shadow-lg p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">
              Analysis Results ({selectedModel === "gemini" ? "Gemini AI" : selectedModel === "gemini2" ? "Gemini2 (Files API)" : "Groq AI"}):
            </h3>
            <pre className="bg-gray-900 text-green-400 p-4 rounded-lg overflow-x-auto text-sm font-mono border border-gray-700">
              {JSON.stringify(rawResponse, null, 2)}
            </pre>
          </div>
        )}
              </div>
      </div>
    );
  }
