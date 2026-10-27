; Hasta la 0.6.0 el ejecutable se llamaba app.exe (nombre del paquete Cargo).
; Desde la 0.6.1 se llama Cuadra.exe y el instalador ya no conoce app.exe,
; así que lo borramos aquí para no dejar restos (si sigue en uso, al reiniciar).
;
; En la 0.8.0 Cuadra pasa a llamarse Zenit. La carpeta de instalación, la entrada de
; «Aplicaciones instaladas» y el acceso directo dependen del nombre, así que el instalador
; nuevo no ve la instalación antigua y la dejaría al lado. La quitamos aquí a mano, sin su
; desinstalador, para no tocar nunca los datos (%LOCALAPPDATA%\com.xyfos.cuadra, que no cambia).

!macro NSIS_HOOK_POSTINSTALL
  Delete /REBOOTOK "$INSTDIR\app.exe"

  Push $R9
  ReadRegStr $R9 HKCU "Software\xyfos\Cuadra" ""
  ${If} $R9 != ""
  ${AndIf} $R9 != $INSTDIR
    Delete /REBOOTOK "$R9\Cuadra.exe"
    Delete /REBOOTOK "$R9\app.exe"
    Delete /REBOOTOK "$R9\uninstall.exe"
    RMDir /REBOOTOK "$R9" ; solo si ha quedado vacía
    DeleteRegKey HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\Cuadra"
    DeleteRegKey HKCU "Software\xyfos\Cuadra"
  ${EndIf}
  Pop $R9

  ; Los accesos directos antiguos pasan a abrir Zenit con su nombre nuevo
  ${If} ${FileExists} "$SMPROGRAMS\Cuadra.lnk"
    Delete "$SMPROGRAMS\Cuadra.lnk"
    CreateShortcut "$SMPROGRAMS\${PRODUCTNAME}.lnk" "$INSTDIR\${MAINBINARYNAME}.exe"
  ${EndIf}
  ${If} ${FileExists} "$DESKTOP\Cuadra.lnk"
    Delete "$DESKTOP\Cuadra.lnk"
    CreateShortcut "$DESKTOP\${PRODUCTNAME}.lnk" "$INSTDIR\${MAINBINARYNAME}.exe"
  ${EndIf}
!macroend

!macro NSIS_HOOK_POSTUNINSTALL
  Delete /REBOOTOK "$INSTDIR\app.exe"
!macroend
