# Setup Guide for Gemini AI Integration

## Prerequisites

1. **Get a Gemini API Key**:
   - Go to [Google AI Studio](https://makersuite.google.com/app/apikey)
   - Create a new API key
   - Copy the API key

## Environment Setup

1. **Create a `.env` file** in the backend directory:
   ```bash
   cd backend
   touch .env
   ```

2. **Add your Gemini API key** to the `.env` file:
   ```
   GEMINI_API_KEY=your_actual_api_key_here
   ```

3. **Install dependencies** (if not already done):
   ```bash
   npm install
   ```

## Running the Application

1. **Start the backend**:
   ```bash
   npm run start:dev
   ```

2. **Start the frontend** (in a new terminal):
   ```bash
   cd ../frontend
   npm run dev
   ```

## Usage

1. Open your browser to `http://localhost:3000`
2. You'll see two sections:
   - **Basic PDF Analysis**: Upload any PDF to get page count
   - **ACORD 25 Analysis**: Upload ACORD 25 certificates for structured data extraction

## API Endpoints

- `POST /api/upload` - Basic PDF upload and page count
- `POST /api/analyze-acord25` - ACORD 25 certificate analysis with Gemini AI

## Features

- **PDF Page Count**: Extracts page count from any PDF
- **ACORD 25 Analysis**: Uses Gemini 2.5 Flash to extract structured data from ACORD 25 certificates including:
  - Certificate information
  - Policy details
  - Insurer information
  - Coverage limits
  - Producer information
  - Contact details and addresses 