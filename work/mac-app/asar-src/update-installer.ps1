param([Parameter(Mandatory=$true)][string]$Config)
$ErrorActionPreference='Stop'
$job=Get-Content -LiteralPath $Config -Raw -Encoding UTF8 | ConvertFrom-Json
if($job.platform -ne 'win32' -or [IO.Path]::GetDirectoryName($Config) -ne $job.directory -or $job.nonce -notmatch '^[-a-zA-Z0-9]+$'){throw 'Invalid update configuration'}
Set-Location -LiteralPath $job.directory
[System.Environment]::CurrentDirectory=$job.directory
$backup=$job.target+'.wenjian-previous-'+$job.nonce
$failed=$job.target+'.failed-'+$job.nonce
$stage=Join-Path $job.directory ('stage-'+$job.nonce)
$moved=$false
$app=$null
function Write-UpdateStatus($state,$message){
 $value=@{state=$state;version=$job.version};if($message){$value.error=$message}
 $file=Join-Path $job.directory 'status.json';$tmp=$file+'.helper-new'
 [IO.File]::WriteAllText($tmp,($value|ConvertTo-Json -Compress),[Text.UTF8Encoding]::new($false))
 Move-Item -LiteralPath $tmp -Destination $file -Force
}
function Move-WithRetry($source,$destination){
 for($i=0;$i -lt 40;$i++){try{Move-Item -LiteralPath $source -Destination $destination -ErrorAction Stop;return}catch{if($i -eq 39){throw};Start-Sleep -Milliseconds 250}}
}
try{
 for($i=0;$i -lt 300;$i++){if(-not(Get-Process -Id $job.pid -ErrorAction SilentlyContinue)){break};Start-Sleep -Milliseconds 200}
 if(Get-Process -Id $job.pid -ErrorAction SilentlyContinue){throw 'Application is still running'}
 if((Test-Path -LiteralPath $backup) -or (Test-Path -LiteralPath $failed) -or (Test-Path -LiteralPath $stage)){throw 'Recovery path already exists; no files changed'}
 Expand-Archive -LiteralPath $job.zip -DestinationPath $stage
 $roots=@(Get-ChildItem -LiteralPath $stage -Directory)
 if($roots.Count -ne 1 -or -not(Test-Path -LiteralPath (Join-Path $roots[0].FullName 'Wenjian.exe')) -or -not(Test-Path -LiteralPath (Join-Path $roots[0].FullName 'resources/app.asar'))){throw 'Invalid Windows application package'}
 $uninstaller=Join-Path $job.target 'Uninstall.exe'
 if(Test-Path -LiteralPath $uninstaller){Copy-Item -LiteralPath $uninstaller -Destination (Join-Path $roots[0].FullName 'Uninstall.exe')}
 Move-WithRetry $job.target $backup
 $moved=$true
 Move-WithRetry $roots[0].FullName $job.target
 $app=Start-Process -FilePath (Join-Path $job.target 'Wenjian.exe') -PassThru
 $ok=$false
 for($i=0;$i -lt 300;$i++){if(Test-Path -LiteralPath $job.confirmation){$result=Get-Content -LiteralPath $job.confirmation -Raw -Encoding UTF8|ConvertFrom-Json;if($result.nonce -eq $job.nonce -and $result.build -eq $job.build){$ok=$true;break}};Start-Sleep -Milliseconds 200}
 if(-not $ok){throw 'New application did not confirm valid startup'}
 if(-not(Test-Path -LiteralPath (Join-Path $job.target 'Wenjian.exe')) -or -not(Test-Path -LiteralPath (Join-Path $job.target 'resources/app.asar'))){throw 'Installed application is incomplete'}
 $registry='HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\Wenjian'
 if(Test-Path $registry){Set-ItemProperty -Path $registry -Name DisplayVersion -Value ($job.version+' ('+$job.build+')');Set-ItemProperty -Path $registry -Name Build -Value ([int]$job.build)}
 # Keep the complete previous program as a recovery copy; never delete it here.
 Write-UpdateStatus 'succeeded' $null
}catch{
 $message=$_.Exception.Message;$restored=$false
 if($moved){
  try{
   if($app){Stop-Process -Id $app.Id -ErrorAction SilentlyContinue;try{$app.WaitForExit(10000)|Out-Null}catch{}}
   if(-not(Test-Path -LiteralPath (Join-Path $backup 'Wenjian.exe')) -or -not(Test-Path -LiteralPath (Join-Path $backup 'resources/app.asar'))){throw 'Previous program is incomplete; both copies were preserved'}
   if(Test-Path -LiteralPath $job.target){Move-WithRetry $job.target $failed}
   Move-WithRetry $backup $job.target
   $restored=$true
   Start-Process -FilePath (Join-Path $job.target 'Wenjian.exe')|Out-Null
  }catch{$message+='; automatic recovery could not complete; copies are retained: '+$_.Exception.Message}
 }
 Write-UpdateStatus $(if($restored){'rolledBack'}else{'failed'}) $message
}
