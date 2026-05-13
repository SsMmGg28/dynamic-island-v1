# Dynamic Island - Windows Media Session Bridge
# Communicates via stdin/stdout with the Electron main process
# Uses Windows Runtime API for media detection and control

$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

try {
    Add-Type -AssemblyName System.Runtime.WindowsRuntime

    $asTaskGeneric = ([System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object {
        $_.Name -eq 'AsTask' -and
        $_.GetParameters().Count -eq 1 -and
        $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1'
    })[0]

    if ($null -eq $asTaskGeneric) { throw "AsTask generic method not found in System.Runtime.WindowsRuntime" }

    # $ResultType must be a loaded WinRT or .NET type object
    function WaitAsync($WinRtTask, $ResultType) {
        $task = $asTaskGeneric.MakeGenericMethod($ResultType)
        $netTask = $task.Invoke($null, @($WinRtTask))
        # Return $null on timeout instead of blocking forever via .Result
        if (-not $netTask.Wait(5000)) { return $null }
        return $netTask.Result
    }

    # Pre-load required WinRT types so MakeGenericMethod can resolve them
    [Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager,          Windows.Media.Control, ContentType = WindowsRuntime] | Out-Null
    [Windows.Media.Control.GlobalSystemMediaTransportControlsSessionMediaProperties,  Windows.Media.Control, ContentType = WindowsRuntime] | Out-Null

    $manager = WaitAsync ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager]::RequestAsync()) `
                         ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager])

    if ($null -eq $manager) { throw "MediaSessionManager RequestAsync timed out" }

    Write-Output "READY"
    [Console]::Out.Flush()

    while ($true) {
        $cmd = [Console]::In.ReadLine()
        if ($null -eq $cmd) { break }
        $cmd = $cmd.Trim()

        try {
            $session = $manager.GetCurrentSession()

            switch ($cmd) {
                "info" {
                    if ($null -ne $session) {
                        $props    = WaitAsync ($session.TryGetMediaPropertiesAsync()) ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionMediaProperties])
                        $playback = $session.GetPlaybackInfo()
                        $timeline = $session.GetTimelineProperties()

                        # Extract thumbnail as base64
                        $thumbData = ""
                        try {
                            if ($null -ne $props -and $null -ne $props.Thumbnail) {
                                [Windows.Storage.Streams.IRandomAccessStreamWithContentType, Windows.Storage.Streams, ContentType = WindowsRuntime] | Out-Null
                                $stream = WaitAsync ($props.Thumbnail.OpenReadAsync()) ([Windows.Storage.Streams.IRandomAccessStreamWithContentType])
                                if ($null -ne $stream) {
                                    $size = $stream.Size
                                    if ($size -gt 0 -and $size -lt 5000000) {
                                        $reader = New-Object System.IO.BinaryReader($stream.AsStreamForRead())
                                        $bytes  = $reader.ReadBytes($size)
                                        $reader.Dispose()
                                        $ct = if ($stream.ContentType) { $stream.ContentType } else { "image/png" }
                                        $thumbData = "data:${ct};base64," + [Convert]::ToBase64String($bytes)
                                    }
                                    $stream.Dispose()
                                }
                            }
                        } catch {}

                        $title    = if ($null -ne $props -and $props.Title)      { $props.Title }      else { "" }
                        $artist   = if ($null -ne $props -and $props.Artist)     { $props.Artist }     else { "" }
                        $album    = if ($null -ne $props -and $props.AlbumTitle) { $props.AlbumTitle } else { "" }
                        $status   = if ($null -ne $playback) { $playback.PlaybackStatus.ToString() } else { "None" }
                        $position = if ($null -ne $timeline) { [math]::Round($timeline.Position.TotalSeconds, 1) } else { 0 }
                        $duration = if ($null -ne $timeline) { [math]::Round($timeline.EndTime.TotalSeconds, 1) }  else { 0 }

                        $obj = @{
                            title     = $title
                            artist    = $artist
                            album     = $album
                            status    = $status
                            position  = $position
                            duration  = $duration
                            thumbnail = $thumbData
                        }
                        Write-Output ("DATA:" + ($obj | ConvertTo-Json -Compress))
                    } else {
                        Write-Output 'DATA:{"title":"","artist":"","album":"","status":"None","position":0,"duration":0,"thumbnail":""}'
                    }
                }
                "play"   { if ($null -ne $session) { WaitAsync ($session.TryPlayAsync())            ([System.Boolean]) | Out-Null }; Write-Output "OK" }
                "pause"  { if ($null -ne $session) { WaitAsync ($session.TryPauseAsync())           ([System.Boolean]) | Out-Null }; Write-Output "OK" }
                "toggle" { if ($null -ne $session) { WaitAsync ($session.TryTogglePlayPauseAsync()) ([System.Boolean]) | Out-Null }; Write-Output "OK" }
                "next"   { if ($null -ne $session) { WaitAsync ($session.TrySkipNextAsync())        ([System.Boolean]) | Out-Null }; Write-Output "OK" }
                "prev"   { if ($null -ne $session) { WaitAsync ($session.TrySkipPreviousAsync())    ([System.Boolean]) | Out-Null }; Write-Output "OK" }
                "exit"   { Write-Output "BYE"; [Console]::Out.Flush(); exit }
                default  { Write-Output "ERR:Unknown command" }
            }
        } catch {
            Write-Output ("ERR:" + $_.Exception.Message)
        }
        [Console]::Out.Flush()
    }
} catch {
    Write-Output ("FATAL:" + $_.Exception.Message)
    [Console]::Out.Flush()
    exit 1
}
