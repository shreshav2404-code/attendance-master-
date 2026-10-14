import { requireOptionalNativeModule } from "expo";

export interface RenderedPdfPage {
  uri: string;
  width: number;
  height: number;
}

interface PdfPagesNativeModule {
  getPageCount(uri: string): Promise<number>;
  renderPage(
    uri: string,
    pageIndex: number,
    width: number,
    topFraction: number,
  ): Promise<RenderedPdfPage>;
}

// Android only (android/src/.../PdfPagesModule.kt); null on web.
const PdfPages = requireOptionalNativeModule<PdfPagesNativeModule>("PdfPages");

export const isPdfRenderingAvailable = PdfPages !== null;

const requireModule = (): PdfPagesNativeModule => {
  if (!PdfPages) {
    throw new Error("Reading PDFs needs the Android app.");
  }
  return PdfPages;
};

export const getPdfPageCount = (uri: string): Promise<number> =>
  requireModule().getPageCount(uri);

/** Renders a page (0-based) to a JPEG `width` pixels wide; `topFraction` < 1 keeps only the top part. */
export const renderPdfPage = (
  uri: string,
  pageIndex: number,
  width: number,
  topFraction = 1,
): Promise<RenderedPdfPage> => requireModule().renderPage(uri, pageIndex, width, topFraction);
