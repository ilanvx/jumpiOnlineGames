; Jumpi Games installer extras (electron-builder NSIS "include").
; - an "Almost ready!" page after the folder page: a Desktop shortcut only if the player wants one
; - updates (silent, --updated) never add or remove the Desktop shortcut

!include nsDialogs.nsh
!include LogicLib.nsh

!ifndef BUILD_UNINSTALLER
  Var JumpiDesk
  Var JumpiDeskBox

  !macro customPageAfterChangeDir
    Page custom JumpiOptionsShow JumpiOptionsLeave
  !macroend

  Function JumpiOptionsShow
    !insertmacro MUI_HEADER_TEXT "Almost ready!" "Choose how you want to open Jumpi Games."
    nsDialogs::Create 1018
    Pop $0
    ${NSD_CreateLabel} 0 0 100% 24u "Jumpi Games will be in your Start menu. Do you also want a shortcut on your Desktop?"
    Pop $0
    ${NSD_CreateCheckbox} 0 34u 100% 14u "Create a Jumpi Games shortcut on my Desktop"
    Pop $JumpiDeskBox
    ${NSD_Check} $JumpiDeskBox
    nsDialogs::Show
  FunctionEnd

  Function JumpiOptionsLeave
    ${NSD_GetState} $JumpiDeskBox $JumpiDesk
  FunctionEnd

  !macro customInstall
    ${IfNot} ${isUpdated}
      ${If} $JumpiDesk == ${BST_CHECKED}
        CreateShortCut "$DESKTOP\Jumpi Games.lnk" "$appExe" "" "$appExe" 0
      ${EndIf}
    ${EndIf}
  !macroend
!endif

!macro customUnInstall
  ${IfNot} ${isUpdated}
    Delete "$DESKTOP\Jumpi Games.lnk"
  ${EndIf}
!macroend
