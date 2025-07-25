"use client";
import { useRef, useState } from "react";

export default function Home() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState(false);
  const [pageCount, setPageCount] = useState<number | null>(null);
  const [rawResponse, setRawResponse] = useState<any>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage("");
    setSuccess(false);
    setPageCount(null);
    setRawResponse(null);
    
    const file = fileInputRef.current?.files?.[0];
    if (!file) {
      setMessage("Please select a PDF file.");
      setSuccess(false);
      return;
    }
    if (file.type !== "application/pdf") {
      setMessage("Only PDF files are allowed.");
      setSuccess(false);
      return;
    }
    
    setUploading(true);
    const formData = new FormData();
    formData.append("file", file);
    
    try {
      const res = await fetch("http://localhost:8000/api/analyze-coi", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      console.log('Raw Response:', data); // Debug log
      
      if (res.ok) {
        setMessage(data.message || "Analysis completed!");
        setSuccess(true);
        setRawResponse(data.data); // Show only the Gemini data, not the wrapper
      } else {
        setMessage(data.message || "Analysis failed.");
        setSuccess(false);
        setRawResponse(null);
      }
    } catch (error) {
      setMessage("Error analyzing file.");
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
          <label className="font-semibold text-gray-800 text-lg">Upload ACORD 25 PDF:</label>
          <input
            type="file"
            accept="application/pdf"
            ref={fileInputRef}
            className="border border-gray-300 rounded p-2 text-gray-700 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-400"
            disabled={uploading}
          />
          <button
            type="submit"
            className="bg-blue-600 text-white rounded px-4 py-2 font-semibold text-lg hover:bg-blue-700 transition disabled:opacity-50"
            disabled={uploading}
          >
            {uploading ? "Analyzing..." : "Analyze PDF"}
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
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Raw JSON Response:</h3>
            <pre className="bg-gray-900 text-green-400 p-4 rounded-lg overflow-x-auto text-sm font-mono border border-gray-700">
              {JSON.stringify(rawResponse, null, 2)}
            </pre>
          </div>
        )}
              </div>
      </div>
    );
  }
