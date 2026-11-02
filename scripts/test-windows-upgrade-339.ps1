param([Parameter(Mandatory=$true)][string]$OldDirectory,[Parameter(Mandatory=$true)][string]$NewDirectory,[int]$OldBuild=339)
$ErrorActionPreference='Stop'
$old=@(Get-ChildItem (Resolve-Path $OldDirectory).Path -Filter '*Windows-x64-Setup.exe')
$oldZip=@(Get-ChildItem (Resolve-Path $OldDirectory).Path -Filter '*Windows-x64.zip')
$new=@(Get-ChildItem (Resolve-Path $NewDirectory).Path -Filter '*Windows-x64-Setup.exe')
if(($old.Count -ne 1 -and $oldZip.Count -ne 1) -or $new.Count -ne 1){throw 'Expected one old installation package and one new installer'}
$target=Join-Path $env:RUNNER_TEMP ('Wenjian Upgrade '+$OldBuild);$data=Join-Path $env:APPDATA '问间';$file=Join-Path $data 'notebook.json'
if((Test-Path $target) -or -not(Test-Path $file)){throw 'Expected isolated runner with saved fixture'}
$before=(Get-FileHash -LiteralPath $file -Algorithm SHA256).Hash
$draft=Join-Path $data 'drafts.json';$draftBefore=if(Test-Path $draft){(Get-FileHash -LiteralPath $draft -Algorithm SHA256).Hash}else{$null}
$report=[ordered]@{phase='before-old-install';oldBuild=$OldBuild;newInstaller=$new[0].Name;checks=@();success=$false}
function Record($phase){$script:report.phase=$phase;$script:report|ConvertTo-Json -Depth 10|Set-Content (Join-Path $NewDirectory 'windows-legacy-upgrade-report.json') -Encoding UTF8}
function Install($path){
 Write-Output ('Installing '+[IO.Path]::GetFileName($path)+' at '+$target)
 $p=Start-Process -FilePath $path -ArgumentList @('/S',('/D='+$target)) -PassThru
 if(-not $p.WaitForExit(180000) -or $p.ExitCode -ne 0){
  $script:report.exitCode=$p.ExitCode
  $script:report.registration=Get-ItemProperty 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\Wenjian' -ErrorAction SilentlyContinue|Select-Object Build,InstallLocation
  Record 'installer-failed'
  throw ('Installer '+[IO.Path]::GetFileName($path)+' failed: '+$p.ExitCode)
 }
}
Record 'before-old-install'
if($old.Count -eq 1){Install $old[0].FullName}else{
 Expand-Archive -LiteralPath $oldZip[0].FullName -DestinationPath (Join-Path $env:RUNNER_TEMP 'old-portable')
 $oldExe=Get-ChildItem (Join-Path $env:RUNNER_TEMP 'old-portable') -Filter Wenjian.exe -Recurse | Select-Object -First 1
 if(-not $oldExe){throw 'Old portable app missing'}
 New-Item -ItemType Directory -Force $target | Out-Null
 Copy-Item -Path (Join-Path $oldExe.Directory.FullName '*') -Destination $target -Recurse
}
$oldAsarHash=(Get-FileHash (Join-Path $target 'resources/app.asar') -Algorithm SHA256).Hash
$oldExeHash=(Get-FileHash (Join-Path $target 'Wenjian.exe') -Algorithm SHA256).Hash
$report.checks+=@('Original version installs at the selected path on a clean runner')
Record 'old-installed'
# 345 already stores live edits in SQLite. Exercise that actual state rather
# than only testing a never-opened installation containing legacy JSON.
if($OldBuild -ge 345){
 $env:WENJIAN_TEST_DISABLE_EXTERNAL='1';$env:WENJIAN_TEST_DATA_DIR=$data
 [IO.File]::WriteAllText((Join-Path $data 'tray-config.json'),'{"choiceVersion":2,"closeToTray":false}',[Text.UTF8Encoding]::new($false))
 $legacy=Start-Process -FilePath (Join-Path $target 'Wenjian.exe') -PassThru
 try{
  $ready=$false
  for($i=0;$i -lt 120;$i++){
   foreach($port in @(Get-NetTCPConnection -State Listen -OwningProcess $legacy.Id -ErrorAction SilentlyContinue)){
    try{$snapshot=Invoke-RestMethod ('http://127.0.0.1:'+$port.LocalPort+'/api/notebook') -TimeoutSec 2;if($snapshot.architecture -eq 1 -and ($snapshot.data.cards.id -contains 'legacy-upgrade-card')){$ready=$true;break}}catch{}
   }
   if($ready){break};if($legacy.HasExited){throw 'Old SQLite app exited before readiness'};Start-Sleep -Milliseconds 500
  }
  if(-not $ready -or -not(Test-Path ($file+'.sqlite3'))){throw 'Old release did not create its real record database'}
 }finally{
  if(-not $legacy.HasExited){
   # The local HTTP listener starts before Electron creates its main window.
   # Process caches MainWindowHandle, so refresh and wait for that actual window.
   $sent=$false
   for($i=0;$i -lt 120;$i++){$legacy.Refresh();if($legacy.HasExited){break};if($legacy.MainWindowHandle -ne [IntPtr]::Zero){$sent=$legacy.CloseMainWindow();if($sent){break}};Start-Sleep -Milliseconds 250}
   if(-not $legacy.HasExited -and (-not $sent -or -not $legacy.WaitForExit(30000))){
    $report.legacyCloseRequested=$sent;Record 'old-close-failed'
    Stop-Process -Id $legacy.Id -Force;throw 'Old fixture did not quit normally'
   }
  }
 }
 $before=(Get-FileHash -LiteralPath $file -Algorithm SHA256).Hash
 $draftBefore=(Get-FileHash -LiteralPath $draft -Algorithm SHA256).Hash
 $report.checks+=@('Actual previous SQLite release launched and saved its notebook before upgrade')
 Record 'old-sqlite-verified'
}
Install $new[0].FullName
Record 'new-installed'
if(-not(Test-Path (Join-Path $target 'Wenjian.exe')) -or -not(Test-Path (Join-Path $target 'resources/app.asar'))){throw 'Updated installation missing files'}
if((Get-FileHash -LiteralPath $file -Algorithm SHA256).Hash -ne $before){throw 'Notebook changed during installer upgrade'}
$previous=@(Get-ChildItem $env:RUNNER_TEMP -Directory | Where-Object {$_.FullName.StartsWith($target+'.previous-')})
$preserved=@($previous|Where-Object {(Test-Path (Join-Path $_.FullName 'Wenjian.exe')) -and (Test-Path (Join-Path $_.FullName 'resources/app.asar')) -and ((Get-FileHash (Join-Path $_.FullName 'Wenjian.exe') -Algorithm SHA256).Hash -eq $oldExeHash) -and ((Get-FileHash (Join-Path $_.FullName 'resources/app.asar') -Algorithm SHA256).Hash -eq $oldAsarHash)})
if($preserved.Count -lt 1){throw 'The exact previous program was not preserved'}
if($draftBefore -and (Get-FileHash -LiteralPath $draft -Algorithm SHA256).Hash -ne $draftBefore){throw 'Draft changed during installer upgrade'}
$report.checks+=@('New installer replaces the older version at the same selected path','Notebook remains byte-for-byte unchanged','Unsubmitted draft remains byte-for-byte unchanged','Exact previous executable and app archive remain available')
# Launch the new executable against the old notebook and verify native migration.
$env:WENJIAN_TEST_DISABLE_EXTERNAL='1'
$env:WENJIAN_TEST_DATA_DIR=$data
[IO.File]::WriteAllText((Join-Path $data 'tray-config.json'),'{"choiceVersion":2,"closeToTray":false}',[Text.UTF8Encoding]::new($false))
$app=Start-Process -FilePath (Join-Path $target 'Wenjian.exe') -PassThru -WindowStyle Hidden -RedirectStandardOutput (Join-Path $NewDirectory 'upgrade-output-report.log') -RedirectStandardError (Join-Path $NewDirectory 'upgrade-error-report.log')
try{
 $origin=$null
 for($attempt=0;$attempt -lt 120;$attempt++){
  foreach($port in @(Get-NetTCPConnection -State Listen -OwningProcess $app.Id -ErrorAction SilentlyContinue)){
   try{$candidate='http://127.0.0.1:'+$port.LocalPort;$info=Invoke-RestMethod ($candidate+'/api/app/info') -TimeoutSec 2;if($info.platform -eq 'win32'){$origin=$candidate;break}}catch{}
  }
  if($origin){break};if($app.HasExited){throw 'New app exited before migration completed'};Start-Sleep -Milliseconds 500
 }
 if(-not $origin){Get-Content (Join-Path $NewDirectory 'upgrade-error-report.log') -ErrorAction SilentlyContinue | Write-Output;throw 'Updated app did not start its notebook service'}
 $snapshot=Invoke-RestMethod ($origin+'/api/notebook')
 if($snapshot.architecture -ne 1 -or -not($snapshot.data.cards.id -contains 'legacy-upgrade-card')){throw 'Older notebook was not preserved in the record database'}
 $draftValue=Invoke-RestMethod ($origin+'/api/drafts?key=legacy-upgrade')
 if($draftValue.value.text -ne '未提交的虚构草稿'){throw 'Old draft was not migrated'}
 if(-not(Test-Path ($file+'.sqlite3'))){throw 'Record database was not created'}
 $report.checks+=@('New executable loads old notebook into SQLite','Keyed unsubmitted draft survives migration','Original source files remain preserved')
}finally{if(-not $app.HasExited){$null=$app.CloseMainWindow();if(-not $app.WaitForExit(15000)){Stop-Process -Id $app.Id -Force}}}
$report.success=$true;Record 'complete'
Write-Output 'PASS: original Windows version upgrades to the selected new release without changing notebook or draft; exact previous program retained'
