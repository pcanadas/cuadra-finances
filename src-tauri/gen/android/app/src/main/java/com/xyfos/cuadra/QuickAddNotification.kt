package com.xyfos.cuadra

import android.Manifest
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.widget.RemoteViews
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat

/**
 * Notificación fija (opcional, se activa en Ajustes) con los botones «+ Gasto» y «+ Ingreso».
 * Cada botón abre MainActivity con ACTION_QUICK_ADD y el tipo; los accesos directos del
 * icono (res/xml/shortcuts.xml) usan el mismo intent.
 */
object QuickAddNotification {
  const val ACTION_QUICK_ADD = "com.xyfos.cuadra.QUICK_ADD"
  const val EXTRA_TIPO = "tipo"

  private const val CHANNEL_ID = "acceso_rapido"
  private const val NOTIFICATION_ID = 1
  private const val PREFS = "cuadra"
  private const val KEY_ENABLED = "quickAddNotification"

  fun isEnabled(context: Context): Boolean =
    context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getBoolean(KEY_ENABLED, false)

  fun setEnabled(context: Context, enabled: Boolean) {
    context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putBoolean(KEY_ENABLED, enabled).apply()
    if (enabled) show(context) else hide(context)
  }

  /** Android 13+ pide permiso para notificar; en versiones anteriores basta con no tenerlas bloqueadas. */
  fun hasPermission(context: Context): Boolean =
    Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU ||
      ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED

  fun canNotify(context: Context): Boolean =
    hasPermission(context) && NotificationManagerCompat.from(context).areNotificationsEnabled()

  /** Vuelve a ponerla si está activada (al abrir la app, tras reiniciar o actualizar). */
  fun refresh(context: Context) {
    if (isEnabled(context)) show(context)
  }

  fun quickAddIntent(context: Context, tipo: String): Intent =
    Intent(context, MainActivity::class.java).apply {
      action = ACTION_QUICK_ADD
      putExtra(EXTRA_TIPO, tipo)
      flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP
    }

  private fun show(context: Context) {
    if (!canNotify(context)) return
    val manager = context.getSystemService(NotificationManager::class.java)
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      // DEFAULT y no LOW: con LOW Android la agrupa en «Silenciosas» al final; el sonido se quita con setSilent
      val channel = NotificationChannel(CHANNEL_ID, "Acceso rápido", NotificationManager.IMPORTANCE_DEFAULT).apply {
        setSound(null, null)
        enableVibration(false)
        description = "Botones para apuntar un gasto o un ingreso desde la barra de notificaciones"
        setShowBadge(false)
      }
      manager.createNotificationChannel(channel)
    }

    val piFlags = PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
    fun action(tipo: String, requestCode: Int) =
      PendingIntent.getActivity(context, requestCode, quickAddIntent(context, tipo), piFlags)
    val open = PendingIntent.getActivity(
      context, 0,
      Intent(context, MainActivity::class.java).apply { flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP },
      piFlags,
    )

    val buttons = RemoteViews(context.packageName, R.layout.notification_quick_add).apply {
      setOnClickPendingIntent(R.id.quick_add_gasto, action("gasto", 1))
      setOnClickPendingIntent(R.id.quick_add_ingreso, action("ingreso", 2))
    }

    val notification = NotificationCompat.Builder(context, CHANNEL_ID)
      .setSmallIcon(R.drawable.ic_stat_cuadra)
      .setContentTitle("Apunta un movimiento")
      .setContentText("+ Gasto · + Ingreso")
      .setStyle(NotificationCompat.DecoratedCustomViewStyle())
      .setCustomContentView(buttons)
      .setCustomBigContentView(buttons)
      .setContentIntent(open)
      .setOngoing(true)
      .setShowWhen(false)
      .setSilent(true)
      .setOnlyAlertOnce(true)
      .setPriority(NotificationCompat.PRIORITY_DEFAULT)
      .setCategory(NotificationCompat.CATEGORY_REMINDER)
      .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
      .build()

    try {
      NotificationManagerCompat.from(context).notify(NOTIFICATION_ID, notification)
    } catch (_: SecurityException) {
      // Permiso retirado entre la comprobación y el aviso: no hay nada que mostrar
    }
  }

  private fun hide(context: Context) {
    NotificationManagerCompat.from(context).cancel(NOTIFICATION_ID)
  }
}

/** Tras reiniciar el móvil o actualizar la app, la notificación desaparece: se vuelve a poner. */
class QuickAddBootReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    if (intent.action == Intent.ACTION_BOOT_COMPLETED || intent.action == Intent.ACTION_MY_PACKAGE_REPLACED) {
      QuickAddNotification.refresh(context)
    }
  }
}
