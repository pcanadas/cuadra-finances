package com.xyfos.cuadra

import android.Manifest
import android.content.Intent
import android.graphics.Color
import android.os.Build
import android.os.Bundle
import android.provider.Settings
import android.webkit.JavascriptInterface
import android.webkit.WebView
import androidx.activity.SystemBarStyle
import androidx.activity.enableEdgeToEdge
import androidx.activity.result.IntentSenderRequest
import androidx.activity.result.contract.ActivityResultContracts
import androidx.core.app.ActivityCompat
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat
import com.google.android.play.core.appupdate.AppUpdateInfo
import com.google.android.play.core.appupdate.AppUpdateManagerFactory
import com.google.android.play.core.appupdate.AppUpdateOptions
import com.google.android.play.core.install.model.AppUpdateType
import com.google.android.play.core.install.model.UpdateAvailability

class MainActivity : TauriActivity() {
  // Márgenes de las barras del sistema (estado, navegación, recortes) en dp = px CSS.
  // El WebView de Android < 15 no los expone en env(safe-area-inset-*), así que se
  // los pasamos a la web: window.CuadraInsets.get() + evento "cuadra-insets".
  @Volatile private var insetsJson = """{"top":0,"right":0,"bottom":0,"left":0}"""

  private var webView: WebView? = null

  // Alta rápida pedida desde la notificación o un acceso directo ("gasto" | "ingreso").
  // La web la recoge con window.CuadraQuickAdd.consume() al arrancar o al recibir "cuadra-native-quick-add".
  @Volatile private var pendingQuickAdd: String? = null

  // Versión nueva en Google Play (in-app updates). Solo funciona si la app se instaló desde Play;
  // si no (APK de pruebas), la comprobación falla y no se avisa. La web pregunta con
  // window.CuadraUpdate.check() y recibe el resultado con el evento "cuadra-update".
  private val appUpdateManager by lazy { AppUpdateManagerFactory.create(this) }
  @Volatile private var updateInfo: AppUpdateInfo? = null
  @Volatile private var updateJson = """{"checked":false,"available":false}"""
  private val updateLauncher = registerForActivityResult(ActivityResultContracts.StartIntentSenderForResult()) { }

  override fun onCreate(savedInstanceState: Bundle?) {
    applySystemBars(isDark = false)
    super.onCreate(savedInstanceState)
    takeQuickAdd(intent)
  }

  override fun onNewIntent(intent: Intent) {
    super.onNewIntent(intent)
    if (takeQuickAdd(intent)) {
      webView?.post { webView?.evaluateJavascript("window.dispatchEvent(new Event('cuadra-native-quick-add'))", null) }
    }
  }

  override fun onResume() {
    super.onResume()
    // Una actualización inmediata que se interrumpió (p. ej. al salir de la app) se retoma
    appUpdateManager.appUpdateInfo.addOnSuccessListener { info ->
      if (info.updateAvailability() == UpdateAvailability.DEVELOPER_TRIGGERED_UPDATE_IN_PROGRESS) {
        appUpdateManager.startUpdateFlowForResult(info, updateLauncher, AppUpdateOptions.newBuilder(AppUpdateType.IMMEDIATE).build())
      }
    }
    // Android 14+ deja quitar las notificaciones fijas deslizando: al volver a la app se repone
    QuickAddNotification.refresh(this)
  }

  private fun takeQuickAdd(intent: Intent?): Boolean {
    if (intent?.action != QuickAddNotification.ACTION_QUICK_ADD) return false
    pendingQuickAdd = intent.getStringExtra(QuickAddNotification.EXTRA_TIPO) ?: "gasto"
    intent.action = null // que no se repita al recrear la actividad
    return true
  }

  private fun checkForUpdate() {
    appUpdateManager.appUpdateInfo
      .addOnSuccessListener { info ->
        val available = info.updateAvailability() == UpdateAvailability.UPDATE_AVAILABLE
        updateInfo = if (available) info else null
        updateJson = """{"checked":true,"available":$available,"versionCode":${if (available) info.availableVersionCode() else 0}}"""
        dispatchUpdateState()
      }
      .addOnFailureListener {
        updateInfo = null
        updateJson = """{"checked":true,"available":false,"error":true}"""
        dispatchUpdateState()
      }
  }

  private fun dispatchUpdateState() {
    webView?.post { webView?.evaluateJavascript("window.dispatchEvent(new Event('cuadra-update'))", null) }
  }

  // Pantalla de actualización de Google Play (descarga, instala y vuelve a abrir Zenit);
  // si no se puede desde la app, la ficha de Zenit en Play Store
  private fun startUpdate() {
    val info = updateInfo
    if (info != null && info.isUpdateTypeAllowed(AppUpdateType.IMMEDIATE)) {
      appUpdateManager.startUpdateFlowForResult(info, updateLauncher, AppUpdateOptions.newBuilder(AppUpdateType.IMMEDIATE).build())
      return
    }
    try {
      startActivity(Intent(Intent.ACTION_VIEW, android.net.Uri.parse("market://details?id=$packageName")))
    } catch (e: Exception) {
      startActivity(Intent(Intent.ACTION_VIEW, android.net.Uri.parse("https://play.google.com/store/apps/details?id=$packageName")))
    }
  }

  private fun notifyStateJson(): String =
    """{"enabled":${QuickAddNotification.isEnabled(this)},"allowed":${QuickAddNotification.canNotify(this)}}"""

  private fun dispatchNotifyState() {
    webView?.post { webView?.evaluateJavascript("window.dispatchEvent(new Event('cuadra-notify'))", null) }
  }

  @Deprecated("Deprecated in Java")
  override fun onRequestPermissionsResult(requestCode: Int, permissions: Array<out String>, grantResults: IntArray) {
    super.onRequestPermissionsResult(requestCode, permissions, grantResults)
    if (requestCode == REQ_NOTIFICATIONS) {
      QuickAddNotification.setEnabled(this, QuickAddNotification.canNotify(this))
      dispatchNotifyState()
    }
  }

  // Barras del sistema transparentes (la web pinta detrás) con iconos según el tema
  // de la app, no el del móvil. Sin el velo que Android pone a la barra de 3 botones.
  private fun applySystemBars(isDark: Boolean) {
    val style = if (isDark) SystemBarStyle.dark(Color.TRANSPARENT)
                else SystemBarStyle.light(Color.TRANSPARENT, Color.TRANSPARENT)
    enableEdgeToEdge(statusBarStyle = style, navigationBarStyle = style)
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
      window.isNavigationBarContrastEnforced = false
      window.isStatusBarContrastEnforced = false
    }
  }

  override fun onWebViewCreate(webView: WebView) {
    this.webView = webView

    webView.addJavascriptInterface(object {
      @JavascriptInterface
      fun consume(): String {
        val tipo = pendingQuickAdd ?: ""
        pendingQuickAdd = null
        return tipo
      }
    }, "CuadraQuickAdd")

    // Notificación con «+ Gasto» / «+ Ingreso» (Ajustes). El estado cambia de forma asíncrona
    // cuando hay que pedir permiso: se avisa con el evento "cuadra-notify".
    webView.addJavascriptInterface(object {
      @JavascriptInterface
      fun state(): String = notifyStateJson()

      @JavascriptInterface
      fun enable() {
        runOnUiThread {
          if (QuickAddNotification.hasPermission(this@MainActivity) || Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) {
            QuickAddNotification.setEnabled(this@MainActivity, QuickAddNotification.canNotify(this@MainActivity))
            dispatchNotifyState()
          } else {
            ActivityCompat.requestPermissions(this@MainActivity, arrayOf(Manifest.permission.POST_NOTIFICATIONS), REQ_NOTIFICATIONS)
          }
        }
      }

      @JavascriptInterface
      fun disable() {
        QuickAddNotification.setEnabled(this@MainActivity, false)
        dispatchNotifyState()
      }

      // Ajustes de notificaciones de la app (si el permiso se denegó o están bloqueadas)
      @JavascriptInterface
      fun openSettings() {
        val settings = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
          Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS).putExtra(Settings.EXTRA_APP_PACKAGE, packageName)
        } else {
          Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, android.net.Uri.parse("package:$packageName"))
        }
        runOnUiThread { startActivity(settings) }
      }
    }, "CuadraNotify")

    webView.addJavascriptInterface(object {
      @JavascriptInterface
      fun get(): String = insetsJson
    }, "CuadraInsets")

    webView.addJavascriptInterface(object {
      @JavascriptInterface
      fun check() { runOnUiThread { checkForUpdate() } }

      @JavascriptInterface
      fun state(): String = updateJson

      @JavascriptInterface
      fun start() { runOnUiThread { startUpdate() } }
    }, "CuadraUpdate")

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

    // Tema claro/oscuro de la app → iconos de las barras del sistema
    webView.addJavascriptInterface(object {
      @JavascriptInterface
      fun set(isDark: Boolean) {
        runOnUiThread { applySystemBars(isDark) }
      }
    }, "CuadraTheme")

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

  companion object {
    private const val REQ_NOTIFICATIONS = 4201
  }
}
