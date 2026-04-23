# Dynamic Island - Windows Media Session Bridge
# Communicates via stdin/stdout with the Electron main process
# Uses Windows Runtime API for media detection and control

$ErrorActionPreference = "SilentlyContinue"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

try {
    Add-Type -AssemblyName System.Runtime.WindowsRuntime

    $asTaskGeneric = ([System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object {
        $_.Name -eq 'AsTask' -and
        $_.GetParameters().Count -eq 1 -and
        $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1'
    })[0]

    Function WaitAsync($WinRtTask, $ResultType) {
        $asTask = $asTaskGeneric.MakeGenericMethod($ResultType)
        $netTask = $asTask.Invoke($null, @($WinRtTask))
        $netTask.Wait(-1) | Out-Null
        $netTask.Result
    }

    [Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager, Windows.Media.Control, ContentType = WindowsRuntime] | Out-Null

    $manager = WaitAsync ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager]::RequestAsync()) ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager])

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
                        $props = WaitAsync ($session.TryGetMediaPropertiesAsync()) ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionMediaProperties])
                        $playback = $session.GetPlaybackInfo()
                        $timeline = $session.GetTimelineProperties()

                        # Extract thumbnail as base64
                        $thumbData = ""
                        try {
                            $thumb = $props.Thumbnail
                            if ($null -ne $thumb) {
                                [Windows.Storage.Streams.IRandomAccessStreamWithContentType, Windows.Storage.Streams, ContentType = WindowsRuntime] | Out-Null
                                $stream = WaitAsync ($thumb.OpenReadAsync()) ([Windows.Storage.Streams.IRandomAccessStreamWithContentType])
                                $size = $stream.Size
                                if ($size -gt 0 -and $size -lt 5000000) {
                                    $reader = New-Object System.IO.BinaryReader($stream.AsStreamForRead())
                                    $bytes = $reader.ReadBytes($size)
                                    $reader.Dispose()
                                    $b64 = [Convert]::ToBase64String($bytes)
                                    $ct = $stream.ContentType
                                    if (-not $ct) { $ct = "image/png" }
                                    $thumbData = "data:${ct};base64,${b64}"
                                }
                                $stream.Dispose()
                            }
                        } catch {}

                        $obj = @{
                            title    = if ($props.Title) { $props.Title } else { "" }
                            artist   = if ($props.Artist) { $props.Artist } else { "" }
                            album    = if ($props.AlbumTitle) { $props.AlbumTitle } else { "" }
                            status   = $playback.PlaybackStatus.ToString()
                            position = [math]::Round($timeline.Position.TotalSeconds, 1)
                            duration = [math]::Round($timeline.EndTime.TotalSeconds, 1)
                            thumbnail = $thumbData
                        }
                        Write-Output ("DATA:" + ($obj | ConvertTo-Json -Compress))
                    }
                    else {
                        Write-Output 'DATA:{"title":"","artist":"","album":"","status":"None","position":0,"duration":0,"thumbnail":""}'
                    }
                }
                "play" {
                    if ($null -ne $session) { 
                        $session.TryPlayAsync() | Out-Null
                    }
                    Write-Output "OK"
                }
                "pause" {
                    if ($null -ne $session) { 
                        $session.TryPauseAsync() | Out-Null
                    }
                    Write-Output "OK"
                }
                "toggle" {
                    if ($null -ne $session) { 
                        $session.TryTogglePlayPauseAsync() | Out-Null
                    }
                    Write-Output "OK"
                }
                "next" {
                    if ($null -ne $session) { 
                        $session.TrySkipNextAsync() | Out-Null
                    }
                    Write-Output "OK"
                }
                "prev" {
                    if ($null -ne $session) { 
                        $session.TrySkipPreviousAsync() | Out-Null
                    }
                    Write-Output "OK"
                }
                "exit" {
                    Write-Output "BYE"
                    exit
                }
                default {
                    Write-Output "ERR:Unknown command"
                }
            }
        }
        catch {
            Write-Output ("ERR:" + $_.Exception.Message)
        }
        [Console]::Out.Flush()
    }
}
catch {
    Write-Output ("FATAL:" + $_.Exception.Message)
    [Console]::Out.Flush()
    exit 1
}
