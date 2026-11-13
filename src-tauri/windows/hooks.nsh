; Hasta la 0.6.0 el ejecutable se llamaba app.exe (nombre del paquete Cargo).
; Desde la 0.6.1 se llama Cuadra.exe y el instalador ya no conoce app.exe,
; así que lo borramos aquí para no dejar restos (si sigue en uso, al reiniciar).
;
; En la 0.8.0 Cuadra pasa a llamarse Zenit. La carpeta de instalación, la entrada de
; «Aplicaciones instaladas» y el acceso directo dependen del nombre, así que el instalador
; nuevo no ve la instalación antigua y la dejaría al lado. La quitamos aquí a mano, sin su
; desinstalador, para no tocar nunca los datos (%LOCALAPPDATA%\com.xyfos.cuadra, que no cambia).

; Al actualizar desde la app, el actualizador abre este instalador y justo después cierra Zenit.
; El instalador comprueba enseguida si Zenit sigue abierto (Restart Manager) y, si lo está, fuerza
; su cierre; pero si Zenit aún se está cerrando, Windows no deja forzarlo (TerminateProcess falla
; en un proceso que ya está terminando) y salía «No se ha podido cerrar Zenit». En una
; actualización esperamos antes (hasta 30 s) a que termine de cerrarse solo.
!macro NSIS_HOOK_PREINSTALL
  ${If} $UpdateMode = 1
    Push $R0
    Push $R8
    Push $0
    Push $1
    Push $2
    Push $3
    StrCpy $R8 0
    zenit_wait_exit:
      StrCpy $0 0
      !insertmacro RestartManager_StartSession $R0
      ${If} $R0 != ""
        !insertmacro RestartManager_RegisterFile $R0 "$INSTDIR\${MAINBINARYNAME}.exe"
        ${If} $0 = 0
          ; ERROR_MORE_DATA: algún proceso usa aún el ejecutable
          System::Call 'RSTRTMGR::RmGetList(p R0, *i .r1, *i .r2, p 0, *i .r3) i .r0'
        ${EndIf}
        !insertmacro RestartManager_EndSession $R0
      ${EndIf}
      ${If} $0 = ${ERROR_MORE_DATA}
      ${AndIf} $R8 < 60
        IntOp $R8 $R8 + 1
        Sleep 500
        Goto zenit_wait_exit
      ${EndIf}
    Pop $3
    Pop $2
    Pop $1
    Pop $0
    Pop $R8
    Pop $R0
  ${EndIf}
!macroend

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
