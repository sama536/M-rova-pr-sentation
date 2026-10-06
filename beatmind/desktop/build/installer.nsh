; Raccourcis avec l'icône BeatMind (l'exécutable garde l'icône Electron quand le build est fait hors Windows)
!macro customInstall
  CreateShortCut "$DESKTOP\BeatMind.lnk" "$INSTDIR\BeatMind.exe" "" "$INSTDIR\resources\icon.ico" 0
  CreateShortCut "$SMPROGRAMS\BeatMind.lnk" "$INSTDIR\BeatMind.exe" "" "$INSTDIR\resources\icon.ico" 0
!macroend
!macro customUnInstall
  Delete "$DESKTOP\BeatMind.lnk"
  Delete "$SMPROGRAMS\BeatMind.lnk"
!macroend
