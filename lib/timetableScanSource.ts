import TextRecognition from "@react-native-ml-kit/text-recognition";
import * as FileSystem from "expo-file-system";
import { Platform } from "react-native";

import type { ScanOcrResult } from "@/lib/timetableScan";
import { getPdfPageCount, isPdfRenderingAvailable, renderPdfPage } from "@/modules/pdf-pages";

// Device side of timetable scanning: on-device OCR (ML Kit, offline) and PDF
// page rendering. The parsing itself lives in lib/timetableScan.ts.

/** Width pages are rendered at for reading: about 3 px per point on an A4/Letter page. */
const READ_WIDTH = 2400;
/** Width for spotting the section title while searching pages. */
const SEARCH_WIDTH = 1000;
/** aSc prints the section code above the grid, in the top fifth of the page. */
const TITLE_STRIP = 0.2;

export const isTimetableScanAvailable = Platform.OS === "android";
export const isPdfImportAvailable = isTimetableScanAvailable && isPdfRenderingAvailable;

export const recognizeImage = async (uri: string): Promise<ScanOcrResult> => {
  const result = await TextRecognition.recognize(uri);
  return result as ScanOcrResult;
};

const deleteQuietly = (uri: string) =>
  FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => undefined);

export const countPdfPages = (uri: string): Promise<number> => getPdfPageCount(uri);

export const readPdfPage = async (uri: string, pageIndex: number): Promise<ScanOcrResult> => {
  const page = await renderPdfPage(uri, pageIndex, READ_WIDTH);
  try {
    return await recognizeImage(page.uri);
  } finally {
    void deleteQuietly(page.uri);
  }
};

const sectionKey = (value: string) =>
  value.toUpperCase().replace(/[^A-Z0-9]/g, "").replace(/O/g, "0").replace(/[IL]/g, "1");

/**
 * Finds the page whose title is the student's section code (aSc PDFs print one
 * section per page, e.g. "1CHE01"). Returns the 0-based page, or -1.
 */
export const findSectionPage = async ({
  uri,
  section,
  pageCount,
  onProgress,
  isCancelled,
}: {
  uri: string;
  section: string;
  pageCount: number;
  onProgress: (page: number) => void;
  isCancelled: () => boolean;
}): Promise<number> => {
  const wanted = sectionKey(section);
  const pageHasSection = async (pageIndex: number, topFraction: number) => {
    const page = await renderPdfPage(uri, pageIndex, SEARCH_WIDTH, topFraction);
    try {
      const result = await TextRecognition.recognize(page.uri);
      return result.blocks.some((block) =>
        block.lines.some((line) => sectionKey(line.text) === wanted),
      );
    } finally {
      void deleteQuietly(page.uri);
    }
  };

  // Reading only the title strip is several times faster; fall back to whole
  // pages for PDFs that print the section somewhere else.
  for (const topFraction of [TITLE_STRIP, 1]) {
    for (let pageIndex = 0; pageIndex < pageCount; pageIndex += 1) {
      if (isCancelled()) {
        return -1;
      }
      onProgress(pageIndex + 1);
      if (await pageHasSection(pageIndex, topFraction)) {
        return pageIndex;
      }
    }
  }
  return -1;
};
