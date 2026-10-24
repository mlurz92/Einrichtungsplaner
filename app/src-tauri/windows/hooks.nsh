; NSIS-Hooks für den Einrichtungsplaner-Installer (bundle.windows.nsis.installerHooks).
;
; Windows zeigt nach einem Update über eine bestehende Installation oft noch das alte App-Icon auf der
; Desktop-Verknüpfung, weil Explorer Icons je Pfad zwischenspeichert. Nach der Installation wird die
; Verknüpfung deshalb mit ausdrücklichem Icon aus der neuen .exe neu geschrieben und der Icon-Cache der Shell
; aufgefrischt.

!macro NSIS_HOOK_POSTINSTALL
  ${If} ${FileExists} "$DESKTOP\${PRODUCTNAME}.lnk"
    CreateShortcut "$DESKTOP\${PRODUCTNAME}.lnk" "$INSTDIR\${MAINBINARYNAME}.exe" "" "$INSTDIR\${MAINBINARYNAME}.exe" 0
  ${EndIf}
  ; SHCNE_ASSOCCHANGED: Shell lädt Icons (Verknüpfungen, .we13-Dateien) neu
  System::Call 'shell32::SHChangeNotify(i 0x08000000, i 0, p 0, p 0)'
  nsExec::Exec '"$WINDIR\System32\ie4uinit.exe" -show'
  Pop $0
!macroend
