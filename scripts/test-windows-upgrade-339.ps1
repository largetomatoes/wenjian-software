param([Parameter(Mandatory=$true)][string]$OldDirectory,[Parameter(Mandatory=$true)][string]$NewDirectory)
$ErrorActionPreference='Stop'
$old=@(Get-ChildItem (Resolve-Path $OldDirectory).Path -Filter '*Windows-x64-Setup.exe')
$new=@(Get-ChildItem (Resolve-Path $NewDirectory).Path -Filter '*Windows-x64-Setup.exe')
if($old.Count -ne 1 -or $new.Count -ne 1){throw 'Expected old and new installer'}
$target=Join-Path $env:RUNNER_TEMP 'Wenjian Upgrade 339';$data=Join-Path $env:APPDATA '问间';$file=Join-Path $data 'notebook.json'
if((Test-Path $target) -or -not(Test-Path $file)){throw 'Expected isolated runner with saved fixture'}
$before=(Get-FileHash -LiteralPath $file -Algorithm SHA256).Hash
function Install($path){$p=Start-Process -FilePath $path -ArgumentList @('/S',('/D='+$target)) -PassThru;if(-not $p.WaitForExit(180000) -or $p.ExitCode -ne 0){throw ('Installer failed: '+$p.ExitCode)}}
Install $old[0].FullName;Install $new[0].FullName
if(-not(Test-Path (Join-Path $target 'Wenjian.exe')) -or -not(Test-Path (Join-Path $target 'resources/app.asar'))){throw 'Updated installation missing files'}
if((Get-FileHash -LiteralPath $file -Algorithm SHA256).Hash -ne $before){throw 'Notebook changed during installer upgrade'}
$previous=@(Get-ChildItem $env:RUNNER_TEMP -Directory | Where-Object {$_.FullName.StartsWith($target+'.previous-')})
if($previous.Count -ne 1 -or -not(Test-Path (Join-Path $previous[0].FullName 'Wenjian.exe'))){throw 'Previous program is not preserved'}
Write-Output 'PASS: Windows 339 installer upgrades to 342 at a selected path without changing notebook; previous program retained'
