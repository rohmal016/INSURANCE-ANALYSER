import {
  Controller,
  Get,
  Post,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AppService } from './app.service';
import { GeminiService } from './gemini.service';
import { ErrorHandlerInterceptor } from './interceptors/error-handler.interceptor';

@Controller('api')
@UseInterceptors(ErrorHandlerInterceptor)
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly geminiService: GeminiService,
  ) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }



  @Post('analyze-coi')
  @UseInterceptors(
    FileInterceptor('file', {
      fileFilter: (req, file, cb) => {
        if (file.mimetype === 'application/pdf') {
          cb(null, true);
        } else {
          cb(new Error('Only PDF files are allowed!'), false);
        }
      },
    }),
  )
  async analyzeCOI(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }
    
    const startTime = Date.now();
    
    try {
      // Compress and optimize PDF
      const compressedBase64 = await this.geminiService.compressPdfForAI(file.buffer);
      
      // Send to Gemini for analysis
      const analysis = await this.geminiService.analyzeACORD25PDF(compressedBase64);
      
      const processingTime = Date.now() - startTime;
      
      return {
        message: 'ACORD 25 analysis completed successfully!',
        data: analysis,
        metadata: {
          originalSize: file.buffer.length,
          pageCount: 'Compressed PDF',
          processingTime,
        }
      };
      
    } catch (error) {
      throw new BadRequestException(`PDF analysis failed: ${error.message}`);
    }
  }



}
