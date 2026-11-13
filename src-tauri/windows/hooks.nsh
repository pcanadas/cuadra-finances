; Hasta la 0.6.0 el ejecutable se llamaba app.exe (nombre del paquete Cargo).
; Desde la 0.6.1 se llama Cuadra.exe y el instalador ya no conoce app.exe,
; así que lo borramos aquí para no dejar restos (si sigue en uso, al reiniciar).
;
; En la 0.8.0 Cuadra pasa a llamarse Zenit. La carpeta de instalación, la entrada de
; «Aplicaciones instaladas» y el acceso directo dependen del nombre, así que el instalador
; nuevo no ve la instalación antigua y la dejaría al lado. La quitamos aquí a mano, sin su
; desinstalador, para no tocar nunca los datos (%LOCALAPPDATA%\com.xyfos.cuadra, que no cambia).

; «No se ha podido cerrar Zenit» al actualizar (0.10.1)
; La comprobación de «app abierta» de Tauri pregunta a Windows (Restart Manager) qué procesos usan
; Zenit.exe e intenta cerrarlos todos; un antivirus que tiene el archivo abierto (p. ej. McAfee,
; mc-fw-host, aunque Zenit esté cerrado) es un servicio protegido que no se puede cerrar, y la
; instalación se cancelaba. La sustituimos por la de versiones anteriores de Tauri: busca y cierra
; solo los procesos Zenit.exe del usuario, por nombre. Después apartamos el Zenit.exe antiguo
; (renombrar se puede aunque el antivirus lo tenga abierto; sobrescribirlo, no siempre) para que el
; nuevo se escriba sin conflicto; el apartado se borra al terminar o en la siguiente instalación.
!macroundef CheckIfAppIsRunning
!macro CheckIfAppIsRunning executablePath productName
  !define ZenitCheckID ${__LINE__}
  nsis_tauri_utils::StrReplace "$(appRunning)" "{{product_name}}" "${productName}"
  Pop $R1
  nsis_tauri_utils::StrReplace "$(appRunningOkKill)" "{{product_name}}" "${productName}"
  Pop $R2
  nsis_tauri_utils::StrReplace "$(failedToKillApp)" "{{product_name}}" "${productName}"
  Pop $R3

  ; Al actualizar, el actualizador cierra Zenit justo después de abrir el instalador: le damos
  ; hasta 15 s para que termine de cerrarse solo antes de forzarlo
  ${If} $UpdateMode = 1
    StrCpy $R4 0
    zenit_wait_${ZenitCheckID}:
      nsis_tauri_utils::FindProcessCurrentUser "${MAINBINARYNAME}.exe"
      Pop $R0
      ${If} $R0 = 0
      ${AndIf} $R4 < 30
        IntOp $R4 $R4 + 1
        Sleep 500
        Goto zenit_wait_${ZenitCheckID}
      ${EndIf}
  ${EndIf}

  nsis_tauri_utils::FindProcessCurrentUser "${MAINBINARYNAME}.exe"
  Pop $R0
  ${If} $R0 = 0 ; Zenit sigue abierto
    IfSilent zenit_kill_${ZenitCheckID} 0
    ${IfThen} $PassiveMode != 1 ${|} MessageBox MB_OKCANCEL $R2 IDOK zenit_kill_${ZenitCheckID} IDCANCEL zenit_cancel_${ZenitCheckID} ${|}
    zenit_kill_${ZenitCheckID}:
      nsis_tauri_utils::KillProcessCurrentUser "${MAINBINARYNAME}.exe"
      Pop $R0
      Sleep 500
      ${If} $R0 = 0
      ${OrIf} $R0 = 2
        Goto zenit_done_${ZenitCheckID}
      ${EndIf}
      Abort $R3
    zenit_cancel_${ZenitCheckID}:
      Abort $R1
  ${EndIf}
  zenit_done_${ZenitCheckID}:

  !ifndef __UNINSTALL__
    Delete "${executablePath}.old"
    Rename "${executablePath}" "${executablePath}.old"
  !endif
  !undef ZenitCheckID
!macroend

!macro NSIS_HOOK_POSTINSTALL
  Delete /REBOOTOK "$INSTDIR\app.exe"
  Delete "$INSTDIR\${MAINBINARYNAME}.exe.old" ; si el antivirus aún lo tiene, en la próxima instalación

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
  Delete "$INSTDIR\${MAINBINARYNAME}.exe.old"
!macroend
