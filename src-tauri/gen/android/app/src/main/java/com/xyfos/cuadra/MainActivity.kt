package com.xyfos.cuadra

import android.content.Intent
import android.os.Bundle
import android.webkit.JavascriptInterface
import android.webkit.WebView
import androidx.activity.enableEdgeToEdge
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat

class MainActivity : TauriActivity() {
  // Márgenes de las barras del sistema (estado, navegación, recortes) en dp = px CSS.
  // El WebView de Android < 15 no los expone en env(safe-area-inset-*), así que se
  // los pasamos a la web: window.CuadraInsets.get() + evento "cuadra-insets".
  @Volatile private var insetsJson = """{"top":0,"right":0,"bottom":0,"left":0}"""

  override fun onCreate(savedInstanceState: Bundle?) {
    enableEdgeToEdge()
    super.onCreate(savedInstanceState)
  }

  override fun onWebViewCreate(webView: WebView) {
    webView.addJavascriptInterface(object {
      @JavascriptInterface
      fun get(): String = insetsJson
    }, "CuadraInsets")

    // Menú "Compartir" de Android (el WebView no implementa navigator.share)
    webView.addJavascriptInterface(object {
      @JavascriptInterface
      fun text(title: String, text: String) {
        val send = Intent(Intent.ACTION_SEND).apply {
          type = "text/plain"
          putExtra(Intent.EXTRA_TEXT, text)
        }
        runOnUiThread { startActivity(Intent.createChooser(send, title)) }
      }

      // Abre la app de correo con destinatario, asunto y cuerpo ya rellenos
      @JavascriptInterface
      fun email(to: String, subject: String, body: String): Boolean {
        val mail = Intent(Intent.ACTION_SENDTO).apply {
          data = android.net.Uri.parse("mailto:")
          putExtra(Intent.EXTRA_EMAIL, arrayOf(to))
          putExtra(Intent.EXTRA_SUBJECT, subject)
          putExtra(Intent.EXTRA_TEXT, body)
        }
        return try {
          runOnUiThread { startActivity(Intent.createChooser(mail, subject)) }
          true
        } catch (e: Exception) {
          false
        }
      }
    }, "CuadraShare")

    // Tamaño de letra propio de la app (Ajustes). 0 = el del sistema.
    val systemTextZoom = webView.settings.textZoom
    webView.addJavascriptInterface(object {
      @JavascriptInterface
      fun getSystem(): Int = systemTextZoom

      @JavascriptInterface
      fun set(percent: Int) {
        webView.post { webView.settings.textZoom = if (percent > 0) percent else systemTextZoom }
      }
    }, "CuadraTextSize")

    ViewCompat.setOnApplyWindowInsetsListener(webView) { view, insets ->
      val bars = insets.getInsets(
        WindowInsetsCompat.Type.systemBars() or WindowInsetsCompat.Type.displayCutout()
      )
      val d = view.resources.displayMetrics.density
      insetsJson = """{"top":${bars.top / d},"right":${bars.right / d},"bottom":${bars.bottom / d},"left":${bars.left / d}}"""
      view.post {
        (view as WebView).evaluateJavascript("window.dispatchEvent(new Event('cuadra-insets'))", null)
      }
      ViewCompat.onApplyWindowInsets(view, insets)
    }
    ViewCompat.requestApplyInsets(webView)
  }
}
