param([Parameter(Mandatory=$true)][string]$ArtifactDirectory)
$ErrorActionPreference='Stop'
$artifacts=(Resolve-Path $ArtifactDirectory).Path
$zip=@(Get-ChildItem $artifacts -Filter '*Windows-x64*.zip')
if($zip.Count -ne 1){throw 'Expected a single Windows update archive'}
$portable=Get-ChildItem (Join-Path $artifacts 'portable') -Filter Wenjian.exe -Recurse | Select-Object -First 1
if(-not $portable){throw 'Portable test fixture missing'}
$root=Join-Path $env:RUNNER_TEMP ('WenjianRecovery-'+[guid]::NewGuid().ToString())
$target=Join-Path $root 'Wenjian Program';$data=Join-Path $root 'isolated-data';$cache=Join-Path $data 'update-cache';$nonce='recoveryfixture';$backup=$target+'.wenjian-previous-'+$nonce;$failed=$target+'.failed-'+$nonce
New-Item -ItemType Directory -Force $cache|Out-Null
Copy-Item -LiteralPath $portable.Directory.FullName -Destination $target -Recurse
[IO.File]::WriteAllText((Join-Path $target 'fictional-old-marker.txt'),'keep this old version')
$seed=Get-Content 'work/mac-app/seed.json' -Raw -Encoding UTF8 | ConvertFrom-Json
$seed.data.setupCompleted=$true;$seed.data.notes[0].title='虚构回滚测试'
[IO.File]::WriteAllText((Join-Path $data 'notebook.json'),($seed|ConvertTo-Json -Depth 100),[Text.UTF8Encoding]::new($false))
$spec=@{directory=$cache;zip=$zip[0].FullName;target=$target;pid=2147483647;platform='win32';exe=(Join-Path $target 'Wenjian.exe');version='3.141';build=342;nonce=$nonce;confirmation=(Join-Path $cache 'never-confirm.json')}
$config=Join-Path $cache 'fixture.json';[IO.File]::WriteAllText($config,($spec|ConvertTo-Json),[Text.UTF8Encoding]::new($false))
$oldData=$env:WENJIAN_TEST_DATA_DIR;$env:WENJIAN_TEST_DATA_DIR=$data
try{
 & powershell.exe -NoProfile -ExecutionPolicy Bypass -File 'work/mac-app/asar-src/update-installer.ps1' -Config $config
 $status=Get-Content (Join-Path $cache 'status.json') -Raw -Encoding UTF8|ConvertFrom-Json
 if($status.state -ne 'rolledBack'){throw ('Expected rollback; got '+$status.state+' '+$status.error)}
 if(-not(Test-Path (Join-Path $target 'fictional-old-marker.txt')) -or -not(Test-Path (Join-Path $target 'resources/app.asar'))){throw 'Original program was not restored'}
 if(-not(Test-Path (Join-Path $failed 'Wenjian.exe'))){throw 'Failed program was not preserved'}
 $saved=Get-Content (Join-Path $data 'notebook.json') -Raw -Encoding UTF8|ConvertFrom-Json
 if($saved.data.notes[0].title -ne '虚构回滚测试'){throw 'Notebook was not preserved'}
 Write-Output 'PASS: timed-out Windows startup restores the previous program, preserves the failed bundle and notebook'
}finally{
 $env:WENJIAN_TEST_DATA_DIR=$oldData
 Get-CimInstance Win32_Process -Filter "Name='Wenjian.exe'" | Where-Object {$_.ExecutablePath -and $_.ExecutablePath.StartsWith($root,[StringComparison]::OrdinalIgnoreCase)} | ForEach-Object {Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue}
}
