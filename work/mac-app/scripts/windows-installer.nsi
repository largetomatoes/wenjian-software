Unicode True
RequestExecutionLevel user
!include "MUI2.nsh"
!include "LogicLib.nsh"
!include "x64.nsh"
!include "FileFunc.nsh"
!ifndef APP_DISPLAY_BUILD
 !define APP_DISPLAY_BUILD "${APP_BUILD}"
!endif
Name "问间 ${APP_VERSION}（${APP_DISPLAY_BUILD}）"
OutFile "${OUT_FILE}"
InstallDir "$LOCALAPPDATA\Programs\Wenjian"
; MUI sets Icon again when inserting its first page: configure its own variables.
!define MUI_ICON "..\InstallerIcon-win.ico"
!define MUI_UNICON "..\AppIcon-win.ico"
SetCompressor lzma
SetCompressorDictSize 32
VIProductVersion "3.14.${APP_BUILD}.0"
VIAddVersionKey "ProductName" "问间"
VIAddVersionKey "FileDescription" "问间离线安装程序"
VIAddVersionKey "FileVersion" "${APP_VERSION}.${APP_BUILD}"
VIAddVersionKey "LegalCopyright" "Wenjian authors"
!define MUI_ABORTWARNING
!define MUI_FINISHPAGE_RUN "$INSTDIR\Wenjian.exe"
!define MUI_FINISHPAGE_RUN_TEXT "打开问间"
!insertmacro MUI_PAGE_WELCOME
!define MUI_PAGE_CUSTOMFUNCTION_LEAVE CheckInstallDirectory
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH
!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES
!insertmacro MUI_LANGUAGE "SimpChinese"
Var Stage
Var Previous
Function .onInit
 ${IfNot} ${RunningX64}
  MessageBox MB_ICONSTOP "需要 64 位 Windows。" /SD IDOK
  Abort
 ${EndIf}
 SetRegView 64
 ReadRegDWORD $0 HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\Wenjian" "Build"
 ${If} $0 > ${APP_BUILD}
  MessageBox MB_ICONSTOP "已安装更新的构建，请使用最新安装包。" /SD IDOK
  Abort
 ${EndIf}
 ReadRegStr $1 HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\Wenjian" "InstallLocation"
 ${If} $1 != ""
  IfFileExists "$1\Wenjian.exe" 0 +2
  StrCpy $INSTDIR $1
 ${EndIf}
 SetShellVarContext current
FunctionEnd
Function CheckInstallDirectory
 ; The installer replaces its entire program directory. Never accept an unrelated folder.
 ; NSIS GetFullPathName rejects a not-yet-created folder; Win32 also normalizes new paths.
 System::Call 'kernel32::GetFullPathNameW(w "$INSTDIR", i ${NSIS_MAX_STRLEN}, w .r2, p 0) i.r3'
 ${If} $3 == 0
 ${OrIf} $3 >= ${NSIS_MAX_STRLEN}
  Goto invalid_directory
 ${EndIf}
 StrCpy $INSTDIR $2
 ${GetRoot} "$INSTDIR" $2
 ${If} $INSTDIR == "$2\"
 ${OrIf} $INSTDIR == "$2"
 ${OrIf} $INSTDIR == "$WINDIR"
 ${OrIf} $INSTDIR == "$PROFILE"
 ${OrIf} $INSTDIR == "$PROGRAMFILES"
 ${OrIf} $INSTDIR == "$PROGRAMFILES64"
 ${OrIf} $INSTDIR == "$APPDATA"
 ${OrIf} $INSTDIR == "$LOCALAPPDATA"
 ${OrIf} $INSTDIR == "$DOCUMENTS"
 ${OrIf} $INSTDIR == "$DESKTOP"
 ${OrIf} $INSTDIR == "$TEMP"
  Goto invalid_directory
 ${EndIf}
 IfFileExists "$INSTDIR\Wenjian.exe" 0 check_empty_directory
 IfFileExists "$INSTDIR\resources\app.asar" check_directory_writable invalid_directory
 check_empty_directory:
 FindFirst $2 $3 "$INSTDIR\*"
 check_directory_entry:
 ${If} $3 == ""
  FindClose $2
  Goto check_directory_writable
 ${EndIf}
 ${If} $3 != "."
 ${AndIf} $3 != ".."
  FindClose $2
  Goto invalid_directory
 ${EndIf}
 FindNext $2 $3
 Goto check_directory_entry
 check_directory_writable:
 ClearErrors
 CreateDirectory "$INSTDIR"
 System::Call 'kernel32::GetCurrentProcessId() i.r2'
 FileOpen $3 "$INSTDIR\.wenjian-write-test-$2" w
 IfErrors unwritable_directory
 FileClose $3
 Delete "$INSTDIR\.wenjian-write-test-$2"
 Return
 invalid_directory:
 SetErrorLevel 2
 MessageBox MB_ICONEXCLAMATION "请选择一个空的问间专用文件夹，或已有的问间程序目录，例如 D:\Apps\Wenjian。" /SD IDOK
 Abort
 unwritable_directory:
 SetErrorLevel 2
 MessageBox MB_ICONEXCLAMATION "无法写入所选安装目录，请选择当前账户可以写入的文件夹。" /SD IDOK
 Abort
FunctionEnd
Function CheckClosed
 StrCpy $4 0
 retry:
 IfFileExists "$INSTDIR\Wenjian.exe" 0 done
 System::Call 'kernel32::CreateFileW(w "$INSTDIR\Wenjian.exe", i 0x80000000, i 0, p 0, i 3, i 0, p 0) p.r0'
 ${If} $0 == -1
  IntOp $4 $4 + 1
  ${If} $4 < 40
   Sleep 250
   Goto retry
  ${EndIf}
  StrCpy $4 0
  MessageBox MB_RETRYCANCEL|MB_ICONEXCLAMATION "问间仍在运行。若已收起到托盘，请先从托盘菜单退出，再点击重试。" /SD IDCANCEL IDRETRY retry
  Abort
 ${EndIf}
 System::Call 'kernel32::CloseHandle(p r0)'
 done:
FunctionEnd
Section "问间" SEC_MAIN
 Call CheckInstallDirectory
 Call CheckClosed
 System::Call 'kernel32::GetCurrentProcessId() i.r1'
 StrCpy $Stage "$INSTDIR.install-${APP_BUILD}-$1"
 StrCpy $Previous "$INSTDIR.previous-${APP_BUILD}-$1"
 IfFileExists "$Previous\*" 0 +3
  MessageBox MB_ICONSTOP "发现此前安装的恢复目录，请先保留该目录并联系维护者。" /SD IDOK
  Abort
 ClearErrors
 SetOutPath "$Stage"
 File /r "${APP_DIR}\*.*"
 WriteUninstaller "$Stage\Uninstall.exe"
 IfErrors install_failed
 ; Windows locks the current working directory; release it before renaming stage.
 SetOutPath "$TEMP"
 IfFileExists "$INSTDIR\*" 0 new_install
 StrCpy $4 0
 retry_previous:
 ClearErrors
 Rename "$INSTDIR" "$Previous"
 IfErrors 0 new_install
 IntOp $4 $4 + 1
 ${If} $4 < 40
  Sleep 250
  Goto retry_previous
 ${EndIf}
 Goto install_failed
 new_install:
 StrCpy $4 0
 retry_publish:
 ClearErrors
 Rename "$Stage" "$INSTDIR"
 IfErrors 0 install_published
 IntOp $4 $4 + 1
 ${If} $4 < 40
  Sleep 250
  Goto retry_publish
 ${EndIf}
 Goto restore_previous
 install_published:
 WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\Wenjian" "DisplayName" "问间"
 WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\Wenjian" "DisplayVersion" "${APP_VERSION}（${APP_DISPLAY_BUILD}）"
 WriteRegDWORD HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\Wenjian" "Build" ${APP_BUILD}
 WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\Wenjian" "InstallLocation" "$INSTDIR"
 WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\Wenjian" "UninstallString" '$\"$INSTDIR\Uninstall.exe$\"'
 WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\Wenjian" "DisplayIcon" "$INSTDIR\Wenjian.exe"
 WriteRegDWORD HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\Wenjian" "NoModify" 1
 WriteRegDWORD HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\Wenjian" "NoRepair" 1
 CreateDirectory "$SMPROGRAMS\问间"
 CreateShortcut "$SMPROGRAMS\问间\问间.lnk" "$INSTDIR\Wenjian.exe"
 CreateShortcut "$DESKTOP\问间.lnk" "$INSTDIR\Wenjian.exe"
 ; Keep the previous installed program for recovery.
 Goto finished
 restore_previous:
 StrCpy $4 0
 retry_restore:
 ClearErrors
 Rename "$Previous" "$INSTDIR"
 IfErrors 0 install_failed
 IntOp $4 $4 + 1
 ${If} $4 < 40
  Sleep 250
  Goto retry_restore
 ${EndIf}
 install_failed:
 SetErrorLevel 1
 MessageBox MB_ICONSTOP "安装未完成，原程序和资料已保留。请关闭问间后重试。" /SD IDOK
 Abort
 finished:
SectionEnd
Function un.onInit
 SetShellVarContext current
 retry:
 IfFileExists "$INSTDIR\Wenjian.exe" 0 done
 System::Call 'kernel32::CreateFileW(w "$INSTDIR\Wenjian.exe", i 0x80000000, i 0, p 0, i 3, i 0, p 0) p.r0'
 ${If} $0 == -1
  MessageBox MB_RETRYCANCEL|MB_ICONEXCLAMATION "请先保存并退出问间，再卸载。资料将保留在本机。" /SD IDCANCEL IDRETRY retry
  Abort
 ${EndIf}
 System::Call 'kernel32::CloseHandle(p r0)'
 done:
FunctionEnd
Section "Uninstall"
 SetOutPath "$TEMP"
 SetRegView 64
 SetShellVarContext current
 ; Only remove installed program files. Never remove AppData, cloud or external books.
 Delete "$SMPROGRAMS\问间\问间.lnk"
 RMDir "$SMPROGRAMS\问间"
 Delete "$DESKTOP\问间.lnk"
 DeleteRegKey HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\Wenjian"
 RMDir /r "$INSTDIR"
SectionEnd
