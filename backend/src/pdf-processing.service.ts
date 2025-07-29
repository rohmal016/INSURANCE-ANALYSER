import { Injectable } from '@nestjs/common';
import { PDFDocument } from 'pdf-lib';
import * as fs from 'fs';

@Injectable()
export class PdfProcessingService {
  private readonly MAX_PAGES = 5;
  private readonly MAX_FILE_SIZE_MB = 10;

  /**
   * Process PDF from file path - truncate to 5 pages
   */
  async processPdfFromFile(pdfPath: string): Promise<Buffer> {
    const stats = fs.statSync(pdfPath);
    const fileSizeMB = stats.size / 1024 / 1024;

    if (fileSizeMB > this.MAX_FILE_SIZE_MB) {
      throw new Error(`File size ${fileSizeMB.toFixed(2)}MB exceeds maximum allowed size of ${this.MAX_FILE_SIZE_MB}MB`);
    }

    return this.processPdfFromFileInternal(pdfPath);
  }

  /**
   * Process PDF from buffer - truncate to 5 pages
   */
  async processPdfFromBuffer(pdfBuffer: Buffer): Promise<Buffer> {
    const fileSizeMB = pdfBuffer.length / 1024 / 1024;

    if (fileSizeMB > this.MAX_FILE_SIZE_MB) {
      throw new Error(`File size ${fileSizeMB.toFixed(2)}MB exceeds maximum allowed size of ${this.MAX_FILE_SIZE_MB}MB`);
    }

    return this.processPdfFromBufferInternal(pdfBuffer);
  }

  /**
   * Process PDF from file path internally - truncate to 5 pages
   */
  private async processPdfFromFileInternal(pdfPath: string): Promise<Buffer> {
    try {
      const pdfBytes = fs.readFileSync(pdfPath);
      const pdfDoc = await PDFDocument.load(pdfBytes);
      const pageCount = pdfDoc.getPageCount();

      // If more than MAX_PAGES, keep only first MAX_PAGES
      if (pageCount > this.MAX_PAGES) {
        for (let i = pageCount - 1; i >= this.MAX_PAGES; i--) {
          pdfDoc.removePage(i);
        }
      }

      const processedPdfBytes = await pdfDoc.save({
        useObjectStreams: false,
        addDefaultPage: false,
      });

      return Buffer.from(processedPdfBytes);
    } catch (error) {
      throw new Error(`PDF processing failed: ${error.message}`);
    }
  }

  /**
   * Process PDF from buffer internally - truncate to 5 pages
   */
  private async processPdfFromBufferInternal(pdfBuffer: Buffer): Promise<Buffer> {
    try {
      const pdfDoc = await PDFDocument.load(pdfBuffer);
      const pageCount = pdfDoc.getPageCount();

      // If more than MAX_PAGES, keep only first MAX_PAGES
      if (pageCount > this.MAX_PAGES) {
        for (let i = pageCount - 1; i >= this.MAX_PAGES; i--) {
          pdfDoc.removePage(i);
        }
      }

      const processedPdfBytes = await pdfDoc.save({
        useObjectStreams: false,
        addDefaultPage: false,
      });

      return Buffer.from(processedPdfBytes);
    } catch (error) {
      throw new Error(`PDF processing failed: ${error.message}`);
    }
  }

  /**
   * Process PDF from buffer with early truncation - only read first 5 pages
   */
  private async processPdfFromBufferOptimized(pdfBuffer: Buffer): Promise<Buffer> {
    try {
      // Create a new PDF document
      const newPdfDoc = await PDFDocument.create();
      
      // Load the original PDF
      const originalPdfDoc = await PDFDocument.load(pdfBuffer);
      const pageCount = originalPdfDoc.getPageCount();
      
      // Only copy the first 5 pages (or all if less than 5)
      const pagesToCopy = Math.min(pageCount, this.MAX_PAGES);
      
      for (let i = 0; i < pagesToCopy; i++) {
        const [copiedPage] = await newPdfDoc.copyPages(originalPdfDoc, [i]);
        newPdfDoc.addPage(copiedPage);
      }

      const processedPdfBytes = await newPdfDoc.save({
        useObjectStreams: false,
        addDefaultPage: false,
      });

      return Buffer.from(processedPdfBytes);
    } catch (error) {
      throw new Error(`PDF processing failed: ${error.message}`);
    }
  }
}



