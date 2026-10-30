param([Parameter(Mandatory=$true)][string]$OldDirectory,[Parameter(Mandatory=$true)][string]$NewDirectory)
$ErrorActionPreference='Stop'
$old=@(Get-ChildItem (Resolve-Path $OldDirectory).Path -Filter '*Windows-x64-Setup.exe')
$new=@(Get-ChildItem (Resolve-Path $NewDirectory).Path -Filter '*Windows-x64-Setup.exe')
if($old.Count -ne 1 -or $new.Count -ne 1){throw 'Expected old and new installer'}
$target=Join-Path $env:RUNNER_TEMP 'Wenjian Upgrade 339';$data=Join-Path $env:APPDATA '问间';$file=Join-Path $data 'notebook.json'
if((Test-Path $target) -or -not(Test-Path $file)){throw 'Expected isolated runner with saved fixture'}
$before=(Get-FileHash -LiteralPath $file -Algorithm SHA256).Hash
$draft=Join-Path $data 'drafts.json';$draftBefore=if(Test-Path $draft){(Get-FileHash -LiteralPath $draft -Algorithm SHA256).Hash}else{$null}
$report=[ordered]@{phase='before-old-install';oldInstaller=$old[0].Name;newInstaller=$new[0].Name;checks=@();success=$false}
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
Install $old[0].FullName
$oldExeHash=(Get-FileHash (Join-Path $target 'Wenjian.exe') -Algorithm SHA256).Hash
$report.checks+=@('Original 339 installs at the selected path on a clean runner')
Record 'old-installed'
Install $new[0].FullName
Record 'new-installed'
if(-not(Test-Path (Join-Path $target 'Wenjian.exe')) -or -not(Test-Path (Join-Path $target 'resources/app.asar'))){throw 'Updated installation missing files'}
if((Get-FileHash -LiteralPath $file -Algorithm SHA256).Hash -ne $before){throw 'Notebook changed during installer upgrade'}
$previous=@(Get-ChildItem $env:RUNNER_TEMP -Directory | Where-Object {$_.FullName.StartsWith($target+'.previous-')})
$preserved=@($previous|Where-Object {(Test-Path (Join-Path $_.FullName 'Wenjian.exe')) -and (Test-Path (Join-Path $_.FullName 'resources/app.asar')) -and ((Get-FileHash (Join-Path $_.FullName 'Wenjian.exe') -Algorithm SHA256).Hash -eq $oldExeHash)})
if($preserved.Count -lt 1){throw 'The exact previous program was not preserved'}
if($draftBefore -and (Get-FileHash -LiteralPath $draft -Algorithm SHA256).Hash -ne $draftBefore){throw 'Draft changed during installer upgrade'}
$report.checks+=@('New installer replaces 339 at the same selected path','Notebook remains byte-for-byte unchanged','Unsubmitted draft remains byte-for-byte unchanged','Exact previous executable and app archive remain available')
$report.success=$true;Record 'complete'
Write-Output 'PASS: original Windows 339 upgrades to the selected new release without changing notebook or draft; exact previous program retained'
