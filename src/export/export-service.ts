import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { Document, Packer, Paragraph } from 'docx';

export interface ExportOptions {
  filename: string;
  format: 'pdf' | 'docx';
  savePath?: string; // Optional: if provided, saves to this path instead of downloading
}

/**
 * Export rendered HTML content to PDF format
 */
async function exportToPDF(element: HTMLElement, filename: string, savePath?: string): Promise<void> {
  try {
    // Create canvas from the rendered HTML
    const canvas = await html2canvas(element, {
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff',
    });

    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    });

    // Calculate dimensions to fit the page
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = pdf.internal.pageSize.getHeight();
    const imgWidth = canvas.width;
    const imgHeight = canvas.height;
    const ratio = Math.min(pdfWidth / imgWidth, pdfHeight / imgHeight);
    const imgX = (pdfWidth - imgWidth * ratio) / 2;
    const imgY = 10;

    // Handle multi-page content
    const pageHeight = pdfHeight - 20; // Leave margins
    const totalPages = Math.ceil((imgHeight * ratio) / pageHeight);

    for (let page = 0; page < totalPages; page++) {
      if (page > 0) {
        pdf.addPage();
      }

      const position = -page * pageHeight;
      pdf.addImage(imgData, 'PNG', imgX, position + imgY, imgWidth * ratio, imgHeight * ratio);
    }

    if (savePath) {
      // For Tauri: save to specific path
      try {
        const pdfBlob = pdf.output('blob');
        const arrayBuffer = await pdfBlob.arrayBuffer();
        const uint8Array = new Uint8Array(arrayBuffer);

        // Use Tauri's writeFile API
        const { writeFile } = await import('@tauri-apps/plugin-fs');
        await writeFile(savePath, uint8Array);
      } catch (fsError) {
        console.error('Tauri file write error:', fsError);
        throw new Error(`Failed to write PDF file: ${fsError instanceof Error ? fsError.message : String(fsError)}`);
      }
    } else {
      // For browser: trigger download
      pdf.save(filename);
    }
  } catch (error) {
    console.error('Failed to export PDF:', error);
    throw new Error('Failed to export PDF. Please try again.');
  }
}

/**
 * Convert HTML element to plain text with basic structure preservation
 */
function htmlToText(element: HTMLElement): string {
  // Clone to avoid modifying the original
  const clone = element.cloneNode(true) as HTMLElement;

  // Remove elements that shouldn't be in the text export
  const scripts = clone.querySelectorAll('script, style, noscript');
  scripts.forEach((el) => el.remove());

  // Get text content with some structure
  let text = '';

  function processNode(node: Node): void {
    if (node.nodeType === Node.TEXT_NODE) {
      const textContent = node.textContent || '';
      if (textContent.trim()) {
        text += textContent;
      }
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as Element;
      const tagName = el.tagName.toLowerCase();

      // Add newlines for block elements
      if (['p', 'div', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'li', 'pre', 'blockquote'].includes(tagName)) {
        if (text && !text.endsWith('\n')) {
          text += '\n';
        }
      }

      // Add extra newline before headings
      if (['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(tagName)) {
        text += '\n';
      }

      // Process children
      for (const child of Array.from(node.childNodes)) {
        processNode(child);
      }

      // Add newlines after block elements
      if (['p', 'div', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'pre', 'blockquote', 'ul', 'ol'].includes(tagName)) {
        if (!text.endsWith('\n')) {
          text += '\n';
        }
      }

      // Add line breaks
      if (tagName === 'br') {
        text += '\n';
      }
    }
  }

  processNode(clone);

  return text;
}

/**
 * Export rendered HTML content to Word (DOCX) format
 */
async function exportToWord(element: HTMLElement, filename: string, savePath?: string): Promise<void> {
  try {
    // Extract text content from the rendered HTML
    const textContent = htmlToText(element);

    // Split into paragraphs
    const lines = textContent.split('\n').filter(line => line.trim());

    // Create document paragraphs
    const paragraphs = lines.map(line => {
      const trimmed = line.trim();

      // Simple heading detection (you can enhance this)
      if (trimmed.length > 0) {
        return new Paragraph({
          text: trimmed,
          spacing: {
            after: 200,
          },
        });
      }

      return new Paragraph({
        text: trimmed,
      });
    });

    // Create a new document
    const doc = new Document({
      sections: [
        {
          properties: {},
          children: paragraphs,
        },
      ],
    });

    // Generate the document blob
    const blob = await Packer.toBlob(doc);

    if (savePath) {
      // For Tauri: save to specific path
      try {
        const arrayBuffer = await blob.arrayBuffer();
        const uint8Array = new Uint8Array(arrayBuffer);

        // Use Tauri's writeFile API
        const { writeFile } = await import('@tauri-apps/plugin-fs');
        await writeFile(savePath, uint8Array);
      } catch (fsError) {
        console.error('Tauri file write error:', fsError);
        throw new Error(`Failed to write Word file: ${fsError instanceof Error ? fsError.message : String(fsError)}`);
      }
    } else {
      // For browser: trigger download
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }
  } catch (error) {
    console.error('Failed to export Word document:', error);
    throw new Error('Failed to export Word document. Please try again.');
  }
}

/**
 * Export rendered markdown content to the specified format
 */
export async function exportDocument(element: HTMLElement, options: ExportOptions): Promise<void> {
  const { filename, format, savePath } = options;

  // Ensure filename has correct extension
  const baseFilename = filename.replace(/\.(pdf|docx)$/i, '');
  const fullFilename = `${baseFilename}.${format}`;

  if (format === 'pdf') {
    await exportToPDF(element, fullFilename, savePath);
  } else if (format === 'docx') {
    await exportToWord(element, fullFilename, savePath);
  } else {
    throw new Error(`Unsupported export format: ${format}`);
  }
}
