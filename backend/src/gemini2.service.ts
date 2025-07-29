import { Injectable } from '@nestjs/common';
import { GoogleGenAI } from '@google/genai';
import { createUserContent, createPartFromUri } from '@google/genai';
import { PdfAnalysisResult } from './interfaces/pdf-analysis.interface';
import * as fs from 'fs';
import { PDFDocument } from 'pdf-lib';

@Injectable()
export class Gemini2Service {
  // Define model names as constants
  private readonly PRIMARY_MODEL = 'gemini-2.5-flash-lite';
  private readonly FALLBACK_MODEL = 'gemini-2.5-flash';

  private ai: GoogleGenAI;
  private currentModel: string;

  constructor() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY environment variable is required');
    }

    this.ai = new GoogleGenAI({ apiKey });
    this.currentModel = this.PRIMARY_MODEL;
  }

  /**
   * Switches to the fallback model.
   */
  private switchToFallbackModel(): void {
    this.currentModel = this.FALLBACK_MODEL;
  }







  /**
   * Analyzes the PDF using Gemini Files API (optimized).
   * PDF is already processed to 5 pages by controller.
   */
  async analyzeACORD25PDF(pdfPath: string): Promise<PdfAnalysisResult | null> {
    // Use the processed PDF directly (already 5 pages or less)
    const tempFilePath = pdfPath;
    
    const prompt = `
CRITICAL VALIDATION:
Your FIRST task is to determine if the provided document is a genuine ACORD 25 Certificate of Liability Insurance (COI) form.
- You MUST be at least 95% certain it is an ACORD 25 COI.
- If you are less than 95% certain, or if the document is not an ACORD 25 COI, you MUST immediately return only the literal JSON value: null
- Do NOT attempt to extract or hallucinate any data if you are not sure.
- Do NOT return any other text, explanation, or JSON structure. Just return null.

How to identify an ACORD 25 COI:
- Look for key terms such as "Certificate of Liability Insurance", "ACORD 25", "INSURER(S) AFFORDING COVERAGE", "CERTIFICATE HOLDER", "PRODUCER", "POLICY NUMBER", "EFFECTIVE DATE", "LIABILITY", etc.
- If these terms are missing or the document appears to be a different type of form, return null.

If the document is a valid ACORD 25 COI, proceed with extraction as instructed below.

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
- **NULL VALUES**: If any field has no information, use \`null\` instead of empty strings \`""\`

### 🎯 CERTIFICATE HOLDER EXTRACTION

- **certificate_holder**: Extract **ONLY the first line** under the "CERTIFICATE HOLDER" section. This should be just the business name (e.g., "JanCo FS 3, LLC Dba Velociti Services"). Do NOT include any address lines.

### 🎯 SPECIFIC INSTRUCTIONS FOR PRODUCER INFORMATION

- **full_name**: Extract the **contact person's name** from the **"NAME" field** under the PRODUCER section. This should be a real person's name (like "John Smith", "Jane Doe"). If the NAME field is blank or contains a business name, return null.

- **doing_business_as**: Extract the **agency/brokerage name** from the **first line directly underneath the "PRODUCER" title** on the form. This is the business name of the insurance agency (like "TechInsurance", "ABC Insurance Agency"). If no value is present, return null.

- **email_address**: Extract from the "E-MAIL ADDRESS" field. If blank, return null.

### 📞 PHONE NUMBER NORMALIZATION (CRITICAL)

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

---
IMPORTANT: If the provided document is NOT an ACORD 25 Certificate of Liability Insurance (COI) form, or if you are not at least 95% certain it is, return only null. Do NOT attempt to extract or hallucinate any data. If in doubt, return null. Do NOT return any other text, explanation, or JSON structure. Just return null.
`;

    let uploadedFile: any = null;
    try {
      // Upload the PROCESSED PDF (5 pages only) to save tokens
      uploadedFile = await this.ai.files.upload({
        file: tempFilePath, // Use processed 5-page PDF
        config: {
          displayName: `ACORD25_${Date.now()}.pdf`,
        },
      });

      // Wait for the file to be processed
      let getFile = await this.ai.files.get({ name: uploadedFile.name });
      while (getFile.state === 'PROCESSING') {
        getFile = await this.ai.files.get({ name: uploadedFile.name });
        console.log(`File processing status: ${getFile.state}`);
        
        // Wait 2 seconds before checking again
        await new Promise((resolve) => {
          setTimeout(resolve, 2000);
        });
      }

      if (getFile.state === 'FAILED') {
        throw new Error('File processing failed on Google servers');
      }

      // Now use the processed file for analysis
      const response = await this.ai.models.generateContent({
        model: this.currentModel,
        contents: createUserContent([
          prompt,
          createPartFromUri(uploadedFile.uri, uploadedFile.mimeType),
        ]),
        config: {
          temperature: 0,
          responseMimeType: 'application/json',
          thinkingConfig: {
            thinkingBudget: 0,
          },
        },
      });

      const analysisResult = response.text;
      const isNullString = typeof analysisResult === 'string' && analysisResult.trim() === 'null';
      if (!analysisResult || isNullString) {
        throw new Error('Primary model returned null or empty result');
      }

      try {
        return JSON.parse(analysisResult) as PdfAnalysisResult;
      } catch (parseError) {
        throw new Error('Primary model returned invalid JSON');
      }
    } catch (error) {
      // Switch to fallback model and retry
      this.switchToFallbackModel();
      try {
        const response = await this.ai.models.generateContent({
          model: this.currentModel,
          contents: createUserContent([
            prompt,
            createPartFromUri(uploadedFile?.uri, uploadedFile?.mimeType),
          ]),
          config: {
            temperature: 0,
            responseMimeType: 'application/json',
            thinkingConfig: {
              thinkingBudget: 0,
            },
          },
        });

        const analysisResult = response.text;
        const isNullString = typeof analysisResult === 'string' && analysisResult.trim() === 'null';
        if (!analysisResult || isNullString) {
          return null;
        }

        try {
          return JSON.parse(analysisResult) as PdfAnalysisResult;
        } catch (parseError) {
          return null;
        }
      } catch (fallbackError) {
        return null;
      }
    } finally {
      // Cleanup uploaded file from Google and truncated file
      setImmediate(async () => {
        try {
          if (uploadedFile) {
            await this.ai.files.delete({ name: uploadedFile.name });
          }
          // No cleanup needed - controller handles file management
        } catch (error) {
          console.warn('Failed to cleanup files:', error.message);
        }
      });
    }
  }
}