; Hasta la 0.6.0 el ejecutable se llamaba app.exe (nombre del paquete Cargo).
; Desde la 0.6.1 se llama Cuadra.exe y el instalador ya no conoce app.exe,
; así que lo borramos aquí para no dejar restos (si sigue en uso, al reiniciar).

!macro NSIS_HOOK_POSTINSTALL
  Delete /REBOOTOK "$INSTDIR\app.exe"
!macroend

!macro NSIS_HOOK_POSTUNINSTALL
  Delete /REBOOTOK "$INSTDIR\app.exe"
!macroend
