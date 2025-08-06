import { Injectable } from '@nestjs/common';
import Groq from 'groq-sdk';
import { fromPath } from 'pdf2pic';
import * as fs from 'fs';
import * as path from 'path';
import { PdfAnalysisResult } from './interfaces/pdf-analysis.interface';

@Injectable()
export class GroqService {
  private groq: Groq;
  private readonly TIMEOUT_MS = 15000;
  private readonly MAX_PAGES = 5;
  
  // Model configuration with fallbacks
  private readonly PRIMARY_MODEL = 'meta-llama/llama-4-scout-17b-16e-instruct';
  private readonly FALLBACK_MODEL = 'meta-llama/llama-4-maverick-17b-128e-instruct';
  private currentModel: string;

  constructor() {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      throw new Error('GROQ_API_KEY environment variable is required');
    }

    this.groq = new Groq({
      apiKey,
      timeout: this.TIMEOUT_MS,
    });
    
    this.currentModel = this.PRIMARY_MODEL;
  }

  /**
   * Switch to fallback model
   */
  private switchToFallbackModel(): void {
    this.currentModel = this.FALLBACK_MODEL;
    console.log('Switching to fallback model:', this.FALLBACK_MODEL);
  }

  /**
   * Reset to primary model
   */
  private resetToPrimaryModel(): void {
    this.currentModel = this.PRIMARY_MODEL;
  }

  /**
   * Convert PDF to images (only first 5 pages, do not convert all pages)
   */
  private async pdfToImages(pdfPath: string): Promise<string[]> {
    try {
      const options = {
        density: 150, // DPI
        saveFilename: "page",
        savePath: path.dirname(pdfPath) || './uploads',
        format: "png",
        width: 2480, // A4 width in pixels at 150 DPI
        height: 3508  // A4 height in pixels at 150 DPI
      };
      const convert = fromPath(pdfPath || '', options);
      // Only convert the first 5 pages - no matter how many pages the PDF has
      const imagePaths: string[] = [];
      for (let i = 1; i <= 5; i++) {
        try {
          const page = await convert(i);
          if (page && page.path) {
            imagePaths.push(page.path);
          }
        } catch (err) {
          // If less than 5 pages, break early
          break;
        }
      }
      return imagePaths;
    } catch (error) {
      console.error('Error converting PDF to images:', error);
      throw error;
    }
  }

  /**
   * Convert image to base64
   */
  private imageToBase64(filePath: string): string {
    const imageBuffer = fs.readFileSync(filePath);
    const base64String = imageBuffer.toString('base64');
    const mimeType = path.extname(filePath).toLowerCase();
    
    let mimeString: string;
    switch (mimeType) {
      case '.jpg':
      case '.jpeg':
        mimeString = 'image/jpeg';
        break;
      case '.png':
        mimeString = 'image/png';
        break;
      case '.gif':
        mimeString = 'image/gif';
        break;
      case '.bmp':
        mimeString = 'image/bmp';
        break;
      case '.tiff':
        mimeString = 'image/tiff';
        break;
      default:
        mimeString = 'image/jpeg';
    }
    
    return `data:${mimeString};base64,${base64String}`;
  }

  /**
   * Process multiple pages with Groq in a single request
   */
  private async processACORD25Pages(imageBase64Array: string[]): Promise<string> {
    try {
      const userContent: any[] = [
        {
          "type": "text",
          "text": `Please extract all the structured data from these ACORD 25 Certificate of Liability Insurance form pages (batch of ${imageBase64Array.length} pages). Process each page and return a comprehensive JSON object that combines all data from all pages in this batch. Return ONLY valid JSON without any markdown formatting, code blocks, or additional text. Start directly with { and end with }.`
        }
      ];

      // Add all images to the user content
      imageBase64Array.forEach((imageBase64, index) => {
        userContent.push({
          "type": "image_url",
          "image_url": {
            "url": imageBase64
          }
        });
      });

      const completion = await this.groq.chat.completions.create({
        model: this.currentModel,
        messages: [
          {
            "role": "system",
            "content": "CRITICAL VALIDATION:\nYour FIRST task is to determine if the provided document is a genuine ACORD 25 Certificate of Liability Insurance (COI) form.\n- You MUST be at least 95% certain it is an ACORD 25 COI.\n- If you are less than 95% certain, or if the document is not an ACORD 25 COI, you MUST immediately return only the literal JSON value: null\n- Do NOT attempt to extract or hallucinate any data if you are not sure.\n- Do NOT return any other text, explanation, or JSON structure. Just return null.\n\nHow to identify an ACORD 25 COI:\n- Look for key terms such as \"Certificate of Liability Insurance\", \"ACORD 25\", \"INSURER(S) AFFORDING COVERAGE\", \"CERTIFICATE HOLDER\", \"PRODUCER\", \"POLICY NUMBER\", \"EFFECTIVE DATE\", \"LIABILITY\", etc.\n- If these terms are missing or the document appears to be a different type of form, return null.\n\nIf the document is a valid ACORD 25 COI, proceed with extraction as instructed below.\n\n### 📌 INSURER INFORMATION EXTRACTION\n\n**FIRST**: Extract all insurer information from the **\"INSURER(S) AFFORDING COVERAGE\"** section at the top right of the form:\n- For each insurer (A, B, C, D, E, F, etc.), extract:\n  - \\`insurer_letter\\`: The letter (A, B, C, etc.)\n  - \\`insurer_name\\`: Full insurer name\n  - \\`naic_code\\`: NAIC number\n\n### 📋 POLICY EXTRACTION RULES\n\nFor each policy in the COVERAGES section:\n- **CRITICAL**: Carefully read the \\`INSR LTR\\` column for each policy row. This is the first column in the coverage table.\n- Extract the exact letter (A, B, C, D, E, F, etc.) from the \\`INSR LTR\\` column - **DO NOT MAP TO INSURER NAME**\n- **DOUBLE-CHECK**: Make sure you're reading the correct letter for each policy row. Each policy should have its own unique INSR LTR value.\n- **IMPORTANT**: Do NOT assume alphabetical order or patterns. Read the actual letter from the INSR LTR column for each policy.\n- Just return the letter as-is in the \\`insurer_letter\\` field\n- Extract all other policy information (type, number, dates, coverages)\n- Normalize dollar values (e.g., \\`$1,000,000\\` → \\`1000000\\`)\n- Use \\`limit_type\\` for the coverage label (e.g., \\`\"EACH OCCURRENCE\"\\`, \\`\"MED EXP\"\\`)\n- **CRITICAL RULE**: If a coverage limit value is 0, null, empty, or shows only \"$\" with no amount, DO NOT include that coverage in the results. Skip it entirely.\n- **NULL VALUES**: If any field has no information, use \\`null\\` instead of empty strings \\`\"\"\\`\n\n### �� CERTIFICATE HOLDER EXTRACTION\n\n- **certificate_holder**: Extract **ONLY the first line** under the \"CERTIFICATE HOLDER\" section. This should be just the business name (e.g., \"JanCo FS 3, LLC Dba Velociti Services\"). Do NOT include any address lines.\n\n### 🎯 SPECIFIC INSTRUCTIONS FOR PRODUCER INFORMATION\n\n- **full_name**: Extract the **contact person's name** from the **\"NAME\" field** under the PRODUCER section. This should be a real person's name (like \"John Smith\", \"Jane Doe\"). If the NAME field is blank or contains a business name, return null.\n\n- **doing_business_as**: Extract the **agency/brokerage name** from the **first line directly underneath the \"PRODUCER\" title** on the form. This is the business name of the insurance agency (like \"TechInsurance\", \"ABC Insurance Agency\"). If no value is present, return null.\n\n- **email_address**: Extract from the \"E-MAIL ADDRESS\" field. If blank, return null.\n\n### 📞 PHONE NUMBER NORMALIZATION (CRITICAL)\n\n- **fax_number**: Extract from the \"FAX\" field and normalize (remove formatting). If blank, return null.\n\n- **license_number**: Extract from the **\"License#\" field in the INSURED section** (not the PRODUCER section). This field is typically located near the top of the form, often in the upper left area. Extract the numeric value (e.g., \"3000645669\"). **IMPORTANT**: If the field is blank, return null.\n\n### 🧾 RETURN THIS JSON STRUCTURE\n\nReturn ONLY the JSON data in this exact format, enclosed in {}:\n\n{\n  \"certificate_information\": {\n    \"certificate_holder\": \"string\",\n    \"certificate_number\": \"string\",\n    \"revision_number\": \"string or null\",\n    \"issue_date\": \"MM/DD/YYYY\"\n  },\n  \"insurers\": [\n    {\n      \"insurer_letter\": \"string (A, B, C, etc.)\",\n      \"insurer_name\": \"string\",\n      \"naic_code\": \"string\"\n    }\n  ],\n  \"policies\": [\n    {\n      \"policy_information\": {\n        \"policy_type\": \"string\",\n        \"policy_number\": \"string\",\n        \"effective_date\": \"MM/DD/YYYY\",\n        \"expiry_date\": \"MM/DD/YYYY\"\n      },\n      \"insurer_letter\": \"string (A, B, C, etc.)\",\n      \"coverages\": [\n        {\n          \"limit_type\": \"string\",\n          \"limit_value\": number\n        }\n      ]\n    }\n  ],\n  \"producer_information\": {\n    \"primary_details\": {\n      \"full_name\": \"string or null\",\n      \"email_address\": \"string or null\",\n      \"doing_business_as\": \"string or null\"\n    },\n    \"contact_information\": {\n      \"phone_number\": \"string (digits only, no formatting)\",\n      \"fax_number\": \"string (digits only, no formatting) or null\",\n      \"license_number\": \"string or null\"\n    },\n    \"address_details\": {\n      \"address_line_1\": \"string\",\n      \"address_line_2\": \"string or null\",\n      \"address_line_3\": \"string or null\",\n      \"city\": \"string\",\n      \"state\": \"string\",\n      \"zip_code\": \"string\",\n      \"country\": \"USA\"\n    }\n  }\n}\n\n---\nIMPORTANT: If the provided document is NOT an ACORD 25 Certificate of Liability Insurance (COI) form, or if you are not at least 95% certain it is, return only null. Do NOT attempt to extract or hallucinate any data. If in doubt, return null. Do NOT return any other text, explanation, or JSON structure. Just return null."
          },
          {
            "role": "user",
            "content": userContent
          }
        ],
        temperature: 1,
        max_tokens: 5000, // Increased for multi-page processing
        top_p: 1,
        stream: false,
        stop: null,
      });

      const content = completion.choices[0].message.content;
      if (!content) {
        throw new Error('No content received from Groq API');
      }
      return content;
    } catch (error) {
      console.error(`Error processing images with Groq (${this.currentModel}):`, error);
      
      // Try fallback model if primary failed
      if (this.currentModel === this.PRIMARY_MODEL) {
        this.switchToFallbackModel();
        console.log(`Retrying with fallback model: ${this.currentModel}`);
        return this.processACORD25Pages(imageBase64Array);
      }
      
      // Both models failed
      throw error;
    }
  }

  /**
   * Process multiple pages and merge results (now simplified: only first 5 images/pages are processed)
   */
  private async processMultiPageDocument(filePath: string): Promise<PdfAnalysisResult> {
    try {
      const fileExt = path.extname(filePath).toLowerCase();
      let imagePaths: string[] = [];
      
      if (fileExt === '.pdf') {
        console.log('Converting PDF to images...');
        imagePaths = await this.pdfToImages(filePath); // already limited to 5
        console.log(`Converted PDF to ${imagePaths.length} images`);
      } else {
        imagePaths = [filePath];
      }
      
      // Convert all images to base64
      const imageBase64Array = imagePaths.map(path => this.imageToBase64(path));
      if (imageBase64Array.length === 0) {
        throw new Error('No images could be converted to base64');
      }
      
      // Process all images at once (max 5)
      const result = await this.processACORD25Pages(imageBase64Array);
      
      // Parse JSON result
      let parsedResult: PdfAnalysisResult;
      try {
        let jsonString = result.trim();
        if (jsonString.startsWith('```json')) {
          jsonString = jsonString.replace(/^```json\s*/, '');
        }
        if (jsonString.startsWith('```')) {
          jsonString = jsonString.replace(/^```\s*/, '');
        }
        if (jsonString.endsWith('```')) {
          jsonString = jsonString.replace(/\s*```$/, '');
        }
        parsedResult = JSON.parse(jsonString);
      } catch (parseError) {
        console.error('Failed to parse JSON:', parseError);
        console.error('Raw response:', result);
        // Clean up temporary images before throwing error
        if (fileExt === '.pdf') {
          for (const imagePath of imagePaths) {
            if (fs.existsSync(imagePath)) {
              fs.unlinkSync(imagePath);
            }
          }
        }
        global.gc && global.gc(); // Force garbage collection if enabled
        throw new Error('Failed to parse AI response as JSON');
      }
      
      // Clean up temporary images after successful parse
      if (fileExt === '.pdf') {
        for (const imagePath of imagePaths) {
          if (fs.existsSync(imagePath)) {
            fs.unlinkSync(imagePath);
          }
        }
      }
      global.gc && global.gc(); // Force garbage collection if enabled
      
      return parsedResult;
    } catch (error) {
      console.error('Error processing multi-page document:', error);
      throw error;
    }
  }

  /**
   * Analyze ACORD 25 with Groq using PDF
   */
  async analyzeACORD25WithGroq(pdfPath: string): Promise<PdfAnalysisResult> {
    try {
      // Reset to primary model for each new request
      this.resetToPrimaryModel();
      return await this.processMultiPageDocument(pdfPath);
    } catch (error) {
      throw new Error(`Groq analysis failed: ${error.message}`);
    }
  }

  /**
   * Analyze ACORD 25 with Groq using direct image paths
   */
  async analyzeACORD25WithImages(imagePaths: string[]): Promise<PdfAnalysisResult> {
    try {
      // Reset to primary model for each new request
      this.resetToPrimaryModel();
      
      if (imagePaths.length > this.MAX_PAGES) {
        throw new Error(`Maximum ${this.MAX_PAGES} images allowed`);
      }
      
      // Convert all images to base64
      const imageBase64Array = imagePaths.map(path => this.imageToBase64(path));
      if (imageBase64Array.length === 0) {
        throw new Error('No images could be converted to base64');
      }
      
      // Process all images at once
      const result = await this.processACORD25Pages(imageBase64Array);
      
      // Parse JSON result
      let parsedResult: PdfAnalysisResult;
      try {
        let jsonString = result.trim();
        if (jsonString.startsWith('```json')) {
          jsonString = jsonString.replace(/^```json\s*/, '');
        }
        if (jsonString.startsWith('```')) {
          jsonString = jsonString.replace(/^```\s*/, '');
        }
        if (jsonString.endsWith('```')) {
          jsonString = jsonString.replace(/\s*```$/, '');
        }
        parsedResult = JSON.parse(jsonString);
      } catch (parseError) {
        console.error('Failed to parse JSON:', parseError);
        console.error('Raw response:', result);
        global.gc && global.gc(); // Force garbage collection if enabled
        throw new Error('Failed to parse AI response as JSON');
      }
      
      global.gc && global.gc(); // Force garbage collection if enabled
      return parsedResult;
    } catch (error) {
      throw new Error(`Groq analysis failed: ${error.message}`);
    }
  }
}