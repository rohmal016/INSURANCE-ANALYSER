import { Injectable } from '@nestjs/common';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { PDFDocument } from 'pdf-lib';

@Injectable()
export class GeminiService {
  private genAI: GoogleGenerativeAI;
  private model: any;

  constructor() {
    // Initialize Gemini AI - you'll need to set GEMINI_API_KEY in your environment
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.error('GEMINI_API_KEY environment variable is required');
      console.error('Please create a .env file with your Gemini API key');
      throw new Error('GEMINI_API_KEY environment variable is required');
    }
    
    this.genAI = new GoogleGenerativeAI(apiKey);
    this.model = this.genAI.getGenerativeModel({ model: 'gemini-2.5-flash-lite' });
  }

  private switchToLiteModel() {
    console.log('🔄 Switching to Gemini 2.5 Flash Lite model due to server overload...');
    this.model = this.genAI.getGenerativeModel({ model: 'gemini-2.5-flash-lite' });
  }

  /**
   * Compress and optimize PDF for AI processing
   * - Extracts first 5 pages if more than 5
   * - Compresses images and reduces file size
   * - Returns optimized base64 string
   */
  async compressPdfForAI(pdfBuffer: Buffer): Promise<string> {
    try {
      // Load the original PDF
      const pdfDoc = await PDFDocument.load(pdfBuffer);
      const pageCount = pdfDoc.getPageCount();
      
      let optimizedPdfDoc: PDFDocument;
      
      // If more than 5 pages, extract first 5 pages
      if (pageCount > 5) {
        optimizedPdfDoc = await PDFDocument.create();
        const pagesToCopy = Math.min(5, pageCount);
        
        for (let i = 0; i < pagesToCopy; i++) {
          const [copiedPage] = await optimizedPdfDoc.copyPages(pdfDoc, [i]);
          optimizedPdfDoc.addPage(copiedPage);
        }
      } else {
        // If 5 pages or less, use the original but optimize it
        optimizedPdfDoc = await PDFDocument.create();
        const pages = await optimizedPdfDoc.copyPages(pdfDoc, Array.from({ length: pageCount }, (_, i) => i));
        pages.forEach(page => optimizedPdfDoc.addPage(page));
      }
      
      // Compress the PDF with optimization settings
      const compressedPdfBytes = await optimizedPdfDoc.save({
        useObjectStreams: true,
        addDefaultPage: false,
        objectsPerTick: 20,
        updateFieldAppearances: false
      });
      
      // Convert to base64
      const base64PDF = Buffer.from(compressedPdfBytes).toString('base64');
      
      return base64PDF;
      
    } catch (error) {
      throw new Error(`PDF compression failed: ${error.message}`);
    }
  }

  async analyzeACORD25PDF(base64PDF: string): Promise<any> {
    try {
      const prompt = `You are extracting structured data from an ACORD 25 Certificate of Liability Insurance form. Return the output strictly in the JSON format shown below. Follow these rules carefully:

IMPORTANT: Return ONLY the JSON data enclosed in {} without any additional text, explanations, or markdown formatting.

### 📌 INSURER INFORMATION EXTRACTION

**FIRST**: Extract all insurer information from the **"INSURER(S) AFFORDING COVERAGE"** section at the top right of the form:
- For each insurer (A, B, C, D, E, F, etc.), extract:
  - \`insurer_letter\`: The letter (A, B, C, etc.)
  - \`insurer_name\`: Full insurer name
  - \`naic_code\`: NAIC number

### 📋 POLICY EXTRACTION RULES

For each policy in the COVERAGES section:
- **CRITICAL**: Carefully read the \`INSR LTR\` column for each policy row. This is the first column in the coverage table.
- Extract the exact letter (A, B, C, D, E, F, etc.) from the \`INSR LTR\` column - **DO NOT MAP TO INSURER NAME**
- **DOUBLE-CHECK**: Make sure you're reading the correct letter for each policy row. Each policy should have its own unique INSR LTR value.
- **IMPORTANT**: Do NOT assume alphabetical order or patterns. Read the actual letter from the INSR LTR column for each policy.
- Just return the letter as-is in the \`insurer_letter\` field
- Extract all other policy information (type, number, dates, coverages)
- Normalize dollar values (e.g., \`$1,000,000\` → \`1000000\`)
- Use \`limit_type\` for the coverage label (e.g., \`"EACH OCCURRENCE"\`, \`"MED EXP"\`)
- **CRITICAL RULE**: If a coverage limit value is 0, null, empty, or shows only "$" with no amount, DO NOT include that coverage in the results. Skip it entirely.
- **PHONE NUMBER NORMALIZATION**: Remove all parentheses, dashes, spaces, and special characters from phone numbers (e.g., \`(800) 668-7020\` → \`8006687020\`)
- **NULL VALUES**: If any field has no information, use \`null\` instead of empty strings \`""\`

### 🎯 CERTIFICATE HOLDER EXTRACTION

- **certificate_holder**: Extract **ONLY the first line** under the "CERTIFICATE HOLDER" section. This should be just the business name (e.g., "JanCo FS 3, LLC Dba Velociti Services"). Do NOT include any address lines.

### 🎯 SPECIFIC INSTRUCTIONS FOR PRODUCER INFORMATION

- **full_name**: Extract the **contact person's name** from the **"NAME" field** under the PRODUCER section. This should be a real person's name (like "John Smith", "Jane Doe"). If the NAME field is blank or contains a business name, return null.

- **doing_business_as**: Extract the **agency/brokerage name** from the **first line directly underneath the "PRODUCER" title** on the form. This is the business name of the insurance agency (like "TechInsurance", "ABC Insurance Agency"). If no value is present, return null.

- **email_address**: Extract from the "E-MAIL ADDRESS" field. If blank, return null.

- **phone_number**: Extract from the "PHONE" field and normalize (remove formatting). If blank, return null.

- **fax_number**: Extract from the "FAX" field and normalize (remove formatting). If blank, return null.

- **license_number**: Extract from the **"License#" field in the INSURED section** (not the PRODUCER section). This field is typically located near the top of the form, often in the upper left area. Extract the numeric value (e.g., "3000645669"). **IMPORTANT**: If the field is blank, return null.

### 🧾 RETURN THIS JSON STRUCTURE

Return ONLY the JSON data in this exact format, enclosed in {}:

{
  "certificate_information": {
    "certificate_holder": "string",
    "certificate_number": "string",
    "revision_number": "string or null",
    "issue_date": "MM/DD/YYYY"
  },
  "insurers": [
    {
      "insurer_letter": "string (A, B, C, etc.)",
      "insurer_name": "string",
      "naic_code": "string"
    }
  ],
  "policies": [
    {
      "policy_information": {
        "policy_type": "string",
        "policy_number": "string",
        "effective_date": "MM/DD/YYYY",
        "expiry_date": "MM/DD/YYYY"
      },
      "insurer_letter": "string (A, B, C, etc.)",
      "coverages": [
        {
          "limit_type": "string",
          "limit_value": number
        }
      ]
    }
  ],
  "producer_information": {
    "primary_details": {
      "full_name": "string or null",
      "email_address": "string or null",
      "doing_business_as": "string or null"
    },
    "contact_information": {
      "phone_number": "string (digits only, no formatting)",
      "fax_number": "string (digits only, no formatting) or null",
      "license_number": "string or null"
    },
    "address_details": {
      "address_line_1": "string",
      "address_line_2": "string or null",
      "address_line_3": "string or null",
      "city": "string",
      "state": "string",
      "zip_code": "string",
      "country": "USA"
    }
  }
}

Analyze the provided PDF and return ONLY the structured data in the exact JSON format above, enclosed in {}.`;

      try {
        const result = await this.model.generateContent([
          prompt,
          {
            inlineData: {
              mimeType: 'application/pdf',
              data: base64PDF
            }
          }
        ]);

        const response = await result.response;
        const text = response.text();
        
        // Try to extract JSON from the response
        const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/) || text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const jsonString = jsonMatch[1] || jsonMatch[0];
          const parsedData = JSON.parse(jsonString);
          return parsedData;
        } else {
          throw new Error('Could not extract JSON from Gemini response');
        }
              } catch (error: any) {
          // Switch to lite model on any error
          console.log(`🔄 Error with main model: ${error.message}, switching to lite model...`);
          this.switchToLiteModel();
          
          // Retry with the lite model (PDF data is still available in base64PDF)
          const retryResult = await this.model.generateContent([
            prompt,
            {
              inlineData: {
                mimeType: 'application/pdf',
                data: base64PDF
              }
            }
          ]);

          const retryResponse = await retryResult.response;
          const retryText = retryResponse.text();
          
          // Try to extract JSON from the retry response
          const retryJsonMatch = retryText.match(/```json\s*([\s\S]*?)\s*```/) || retryText.match(/\{[\s\S]*\}/);
          if (retryJsonMatch) {
            const retryJsonString = retryJsonMatch[1] || retryJsonMatch[0];
            const retryParsedData = JSON.parse(retryJsonString);
            return retryParsedData;
          } else {
            throw new Error('Could not extract JSON from Gemini Lite response');
          }
        } finally {
          // Memory cleanup - no PDF processing variables to clean up in this version
        }
    } 
    catch (error) {
      console.error('Error analyzing PDF with Gemini:', error);
      throw new Error(`Failed to analyze PDF: ${error.message}`);
    }
  }
} 