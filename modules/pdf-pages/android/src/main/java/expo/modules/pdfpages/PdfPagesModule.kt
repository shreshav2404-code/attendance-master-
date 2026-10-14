package expo.modules.pdfpages

import android.graphics.Bitmap
import android.graphics.Color
import android.graphics.Matrix
import android.graphics.pdf.PdfRenderer
import android.net.Uri
import android.os.ParcelFileDescriptor
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.File
import java.io.FileOutputStream

// Renders PDF pages to images with Android's built-in PdfRenderer, so the
// timetable PDF can be read by on-device OCR without any extra library.
class PdfPagesModule : Module() {
  private val context
    get() = appContext.reactContext
      ?: throw CodedException("ERR_NO_CONTEXT", "The app context isn't ready", null)

  private fun openPdf(uri: String): ParcelFileDescriptor {
    val parsed = Uri.parse(uri)
    return if (parsed.scheme == "content") {
      context.contentResolver.openFileDescriptor(parsed, "r")
        ?: throw CodedException("ERR_PDF_OPEN", "Couldn't open the PDF", null)
    } else {
      ParcelFileDescriptor.open(File(parsed.path ?: uri), ParcelFileDescriptor.MODE_READ_ONLY)
    }
  }

  override fun definition() = ModuleDefinition {
    Name("PdfPages")

    AsyncFunction("getPageCount") { uri: String ->
      openPdf(uri).use { descriptor ->
        PdfRenderer(descriptor).use { renderer -> renderer.pageCount }
      }
    }

    // Renders page `pageIndex` (0-based) `width` pixels wide to a JPEG in the cache
    // folder. `topFraction` below 1 keeps only the top of the page (a title strip).
    AsyncFunction("renderPage") { uri: String, pageIndex: Int, width: Int, topFraction: Double ->
      openPdf(uri).use { descriptor ->
        PdfRenderer(descriptor).use { renderer ->
          if (pageIndex < 0 || pageIndex >= renderer.pageCount) {
            throw CodedException("ERR_PDF_PAGE", "The PDF has no page ${pageIndex + 1}", null)
          }
          renderer.openPage(pageIndex).use { page ->
            val scale = width.toFloat() / page.width
            val fullHeight = page.height * scale
            val height = maxOf(1, (fullHeight * topFraction.coerceIn(0.05, 1.0)).toInt())
            val bitmap = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888)
            // Pages render onto a transparent bitmap; OCR needs dark text on white.
            bitmap.eraseColor(Color.WHITE)
            // An explicit scale keeps the page's proportions; the bitmap clips the rest.
            val transform = Matrix().apply { setScale(scale, scale) }
            page.render(bitmap, null, transform, PdfRenderer.Page.RENDER_MODE_FOR_DISPLAY)
            val file = File(context.cacheDir, "pdf-page-${System.nanoTime()}.jpg")
            FileOutputStream(file).use { stream ->
              bitmap.compress(Bitmap.CompressFormat.JPEG, 95, stream)
            }
            bitmap.recycle()
            mapOf("uri" to Uri.fromFile(file).toString(), "width" to width, "height" to height)
          }
        }
      }
    }
  }
}
