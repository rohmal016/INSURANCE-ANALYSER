# Insurance Analyzer - ACORD 25 Certificate Analysis

A full-stack application for analyzing ACORD 25 Certificate of Liability Insurance forms using AI-powered OCR and structured data extraction.

## 🏗️ Project Structure

```
NESTJS OCR/
├── backend/          # NestJS API with Gemini AI integration
├── frontend/         # Next.js React frontend
└── README.md         # This file
```

## 🚀 Features

### Backend (NestJS)
- **ACORD 25 Analysis**: Extract structured data from insurance certificates
- **Gemini AI Integration**: Uses Google's Gemini 2.5 Flash for OCR
- **PDF Processing**: Compression and optimization for AI analysis
- **Fallback Mechanism**: Automatic switch to lite model on errors
- **Structured Output**: JSON format with certificate, policy, and producer information

### Frontend (Next.js)
- **Modern UI**: Clean, responsive interface
- **File Upload**: Drag-and-drop PDF upload
- **Real-time Analysis**: Live processing status
- **JSON Display**: Formatted results display

## 🛠️ Tech Stack

### Backend
- **NestJS**: Node.js framework
- **TypeScript**: Type-safe development
- **Google Gemini AI**: OCR and data extraction
- **PDF-lib**: PDF processing and compression
- **Multer**: File upload handling

### Frontend
- **Next.js 14**: React framework
- **TypeScript**: Type-safe development
- **Tailwind CSS**: Styling
- **React Hooks**: State management

## 📋 Prerequisites

- Node.js 18+ 
- npm or yarn
- Google Gemini API key

## 🔧 Installation

### 1. Clone the repository
```bash
git clone https://github.com/rohmal016/INSURANCE-ANALYSER.git
cd INSURANCE-ANALYSER
```

### 2. Backend Setup
```bash
cd backend
npm install
```

Create a `.env` file in the backend directory:
```env
GEMINI_API_KEY=your_gemini_api_key_here
```

### 3. Frontend Setup
```bash
cd frontend
npm install
```

## 🚀 Running the Application

### Backend
```bash
cd backend
npm run start:dev
```
Server runs on: `http://localhost:8000`

### Frontend
```bash
cd frontend
npm run dev
```
Frontend runs on: `http://localhost:3000`

## 📊 API Endpoints

- `POST /api/analyze-coi` - Analyze ACORD 25 certificates
- `GET /api` - Health check

## 🔍 Data Extraction

The system extracts the following information from ACORD 25 forms:

### Certificate Information
- Certificate holder
- Certificate number
- Issue date
- Revision number

### Insurers
- Insurer letters (A, B, C, etc.)
- Insurer names
- NAIC codes

### Policies
- Policy types
- Policy numbers
- Effective/expiry dates
- Coverage limits
- Insurer mappings

### Producer Information
- Contact details
- Agency information
- Address information
- License numbers

## 🎯 Usage

1. Open `http://localhost:3000`
2. Upload an ACORD 25 PDF certificate
3. Click "Analyze PDF"
4. View structured JSON results

## 🔄 Error Handling

- **Automatic Fallback**: Switches to Gemini Lite model on errors
- **PDF Validation**: Ensures valid PDF format
- **Compression**: Optimizes large files for processing
- **Page Limiting**: Handles multi-page documents

## 📝 Environment Variables

### Backend (.env)
```env
GEMINI_API_KEY=your_gemini_api_key_here
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## 📄 License

This project is licensed under the MIT License.

## 🆘 Support

For issues and questions, please create an issue in the GitHub repository. 
