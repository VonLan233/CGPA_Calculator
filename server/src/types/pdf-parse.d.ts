declare module 'pdf-parse' {
  interface PDFData {
    text: string;
    numpages: number;
    numrender: number;
    info: object;
    metadata: object;
  }

  function pdf(dataBuffer: Buffer): Promise<PDFData>;
  export = pdf;
}
