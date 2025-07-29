import {
  Controller,
  Post,
  UploadedFiles,
  UseInterceptors,
  BadRequestException,
  Body,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { GeminiService } from './gemini.service';
import { Gemini2Service } from './gemini2.service';
import { GroqService } from './groq.service';

import { ErrorHandlerInterceptor } from './interceptors/error-handler.interceptor';
import * as fs from 'fs';
import * as path from 'path';
import * as multer from 'multer';
import { PDFDocument } from 'pdf-lib';

// Configure disk storage for file uploads
const uploadDir = path.join(__dirname, '../uploads');
const diskStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(7);
    const ext = path.extname(file.originalname);
    cb(null, `${timestamp}-${random}${ext}`);
  },
});

@Controller('api')
@UseInterceptors(ErrorHandlerInterceptor)
export class AppController {
  constructor(
    private readonly geminiService: GeminiService,
    private readonly gemini2Service: Gemini2Service,
    private readonly groqService: GroqService,
  ) {}

  /**
   * Smart PDF processing: If ≤5 pages, use as-is. If >5 pages, create 5-page PDF.
   */
  private async processPdfSmart(pdfPath: string): Promise<string> {
    try {
      // Read PDF and check page count
      const pdfBytes = fs.readFileSync(pdfPath);
      const pdfDoc = await PDFDocument.load(pdfBytes, {
        ignoreEncryption: true,
        updateMetadata: false
      });
      const pageCount = pdfDoc.getPageCount();

      if (pageCount <= 5) {
        // Use original PDF as-is (5 pages or less)
        return pdfPath;
      } else {
        // Create 5-page PDF (more than 5 pages)
        const newPdfDoc = await PDFDocument.create();
        
        // Copy only first 5 pages
        for (let i = 0; i < 5; i++) {
          const [copiedPage] = await newPdfDoc.copyPages(pdfDoc, [i]);
          newPdfDoc.addPage(copiedPage);
        }

        const newPdfBytes = await newPdfDoc.save({
          useObjectStreams: false,
          addDefaultPage: false,
          objectsPerTick: 50,
        });

        // Create new file with 5 pages
        const fivePagePdfPath = pdfPath.replace('.pdf', '-5pages.pdf');
        fs.writeFileSync(fivePagePdfPath, newPdfBytes);

        // Delete original file from disk
        if (fs.existsSync(pdfPath)) {
          fs.unlinkSync(pdfPath);
        }

        // Force garbage collection if available
        if (global.gc) {
          global.gc();
        }

        return fivePagePdfPath;
      }
    } catch (error) {
      throw new Error(`PDF processing failed: ${error.message}`);
    }
  }

  @Post('analyze-coi')
  @UseInterceptors(
    FilesInterceptor('files', 5, {
      storage: diskStorage,
      limits: {
        fileSize: 10 * 1024 * 1024, // 10MB per file
        files: 5,
      },
      fileFilter: (req, file, cb) => {
        const allowed = ['application/pdf', 'image/png', 'image/jpeg'];
        if (allowed.includes(file.mimetype)) {
          cb(null, true);
        } else {
          cb(new Error('Only PDF and image files are allowed!'), false);
        }
      },
    }),
  )
  async analyzeCOI(
    @UploadedFiles() files: Express.Multer.File[],
    @Body() body: { model: string },
  ) {
    if (!files || files.length === 0) {
      throw new BadRequestException('No files uploaded');
    }

    const pdfFiles = files.filter((f) => f.mimetype === 'application/pdf');
    const imageFiles = files.filter((f) => f.mimetype.startsWith('image/'));
    const { model } = body;

    // Validation
    if (pdfFiles.length > 1) {
      throw new BadRequestException('Only 1 PDF file allowed');
    }
    if (imageFiles.length > 5) {
      throw new BadRequestException('Maximum 5 images allowed');
    }
    if (pdfFiles.length && imageFiles.length) {
      throw new BadRequestException('Cannot upload PDF and images together');
    }
    if (!model) {
      throw new BadRequestException('Model selection is required');
    }

    const startTime = Date.now();
    let analysis;
    let savedFilePath: string | null = null;
    let savedImagePaths: string[] = [];

    try {
      if (pdfFiles.length > 0) {
        const pdfFile = pdfFiles[0];
        
        // Files are already saved to disk by multer
        const originalPdfPath = pdfFile.path;
        
        // Smart PDF processing: If ≤5 pages, use as-is. If >5 pages, create 5-page PDF.
        const processedPdfPath = await this.processPdfSmart(originalPdfPath);
        savedFilePath = processedPdfPath;
        
        // Use the processed PDF for all services
        if (model === 'gemini2') {
          analysis = await this.gemini2Service.analyzeACORD25PDF(processedPdfPath);
        } else if (model === 'gemini') {
          analysis = await this.geminiService.analyzeACORD25PDF(processedPdfPath);
        } else if (model === 'groq') {
          analysis = await this.groqService.analyzeACORD25WithGroq(processedPdfPath);
        } else {
          throw new BadRequestException(`Invalid model for PDF processing: ${model}. Valid models are: gemini, gemini2, groq`);
        }
      } else if (imageFiles.length > 0) {
        if (model !== 'groq') {
          throw new BadRequestException(
            'Images can only be processed with Groq model. Please select Groq as the AI model for image processing.',
          );
        }
        
        // Images are already saved to disk by multer
        const imagePaths = imageFiles.map(f => f.path);
        savedImagePaths = imagePaths;
        
        analysis = await this.groqService.analyzeACORD25WithImages(imagePaths);
      }

      const processingTime = Date.now() - startTime;
      
      return {
        message: 'Analysis completed successfully!',
        data: analysis,
        processingTime,
        model,
      };
    } catch (error) {
      throw new BadRequestException(`Analysis failed: ${error.message}`);
    } finally {
      // Cleanup saved files
      if (savedFilePath && fs.existsSync(savedFilePath)) {
        setImmediate(() => {
          fs.unlink(savedFilePath!, (err) => {
            if (err) console.error('Failed to delete saved file:', savedFilePath, err);
          });
        });
      }
      
      // Cleanup saved image files
      for (const imagePath of savedImagePaths) {
        if (fs.existsSync(imagePath)) {
          setImmediate(() => {
            fs.unlink(imagePath, (err) => {
              if (err) console.error('Failed to delete saved image:', imagePath, err);
            });
          });
        }
      }
    }
  }
}
