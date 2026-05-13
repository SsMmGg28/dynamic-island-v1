# Dynamic Island - Combined Media + Notification Bridge
# Merges get-media.ps1 and get-notifications.ps1 into a single process.
# Protocol:
#   READY        - both subsystems initialized
#   DATA:<json>  - response to an "info" media command
#   OK / BYE     - response to play/pause/toggle/next/prev/exit commands
#   ERR:<msg>    - non-fatal error from media command
#   NOTIF:<json> - new PC notification pushed by background runspace
#   FATAL:<msg>  - fatal init error (script exits)

$ErrorActionPreference = "SilentlyContinue"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

function Init-AsTaskHelper {
    return ([System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object {
        $_.Name -eq 'AsTask' -and
        $_.GetParameters().Count -eq 1 -and
        $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1'
    })[0]
}

function WaitAsync($asTaskGenericMethod, $WinRtTask, $ResultType) {
    $asTask = $asTaskGenericMethod.MakeGenericMethod($ResultType)
    $netTask = $asTask.Invoke($null, @($WinRtTask))
    # Return null on timeout rather than blocking forever via .Result
    if (-not $netTask.Wait(5000)) { return $null }
    return $netTask.Result
}

try {
    Add-Type -AssemblyName System.Runtime.WindowsRuntime
    $asTaskGeneric = Init-AsTaskHelper

    # ── Media: initialize GSMTC manager ──
    [Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager, Windows.Media.Control, ContentType = WindowsRuntime] | Out-Null
    [Windows.Media.Control.GlobalSystemMediaTransportControlsSessionMediaProperties, Windows.Media.Control, ContentType = WindowsRuntime] | Out-Null
    $mediaManager = WaitAsync $asTaskGeneric ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager]::RequestAsync()) ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager])

    # ── Notifications: initialize UserNotificationListener ──
    # Wrapped in try/catch so notification permission failures never kill the media bridge.
    $notifAllowed = $false
    try {
        [Windows.UI.Notifications.Management.UserNotificationListener, Windows.UI.Notifications, ContentType = WindowsRuntime] | Out-Null
        [Windows.UI.Notifications.Management.UserNotificationListenerAccessStatus, Windows.UI.Notifications, ContentType = WindowsRuntime] | Out-Null
        [Windows.UI.Notifications.NotificationKinds, Windows.UI.Notifications, ContentType = WindowsRuntime] | Out-Null
        $notifListener   = [Windows.UI.Notifications.Management.UserNotificationListener]::Current
        $notifStatus     = WaitAsync $asTaskGeneric ($notifListener.RequestAccessAsync()) ([Windows.UI.Notifications.Management.UserNotificationListenerAccessStatus])
        $notifAllowed    = ($notifStatus -eq [Windows.UI.Notifications.Management.UserNotificationListenerAccessStatus]::Allowed)
    } catch {}

    # ── Shared queue: notification runspace → main thread ──
    $outputQueue = [System.Collections.Concurrent.ConcurrentQueue[string]]::new()

    # ── Background runspace for notification polling ──
    if ($notifAllowed) {
        $notifRunspace = [runspacefactory]::CreateRunspace()
        $notifRunspace.Open()
        $notifRunspace.SessionStateProxy.SetVariable('listener',     $notifListener)
        $notifRunspace.SessionStateProxy.SetVariable('queue',        $outputQueue)

        $notifPS = [PowerShell]::Create()
        $notifPS.Runspace = $notifRunspace
        $notifPS.AddScript({
            Add-Type -AssemblyName System.Runtime.WindowsRuntime
            $asTaskGenericInner = ([System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object {
                $_.Name -eq 'AsTask' -and
                $_.GetParameters().Count -eq 1 -and
                $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1'
            })[0]
            function WaitAsyncInner($m, $t, $r) {
                $task = $m.MakeGenericMethod($r)
                $n = $task.Invoke($null, @($t))
                $n.Wait(5000) | Out-Null
                return $n.Result
            }

            [Windows.UI.Notifications.NotificationKinds, Windows.UI.Notifications, ContentType = WindowsRuntime] | Out-Null
            $seenIds = @{}

            while ($true) {
                try {
                    $notifications = WaitAsyncInner $asTaskGenericInner ($listener.GetNotificationsAsync([Windows.UI.Notifications.NotificationKinds]::Toast)) ([System.Collections.Generic.IReadOnlyList[Windows.UI.Notifications.UserNotification]])

                    if ($null -ne $notifications) {
                        foreach ($notif in $notifications) {
                            $id = $notif.Id.ToString()
                            if ($seenIds.ContainsKey($id)) { continue }
                            $seenIds[$id] = $true

                            try {
                                $appName = "Unknown"
                                if ($notif.AppInfo -and $notif.AppInfo.DisplayInfo) {
                                    $appName = $notif.AppInfo.DisplayInfo.DisplayName
                                }
                                $binding = $null
                                if ($notif.Notification.Visual) {
                                    $binding = $notif.Notification.Visual.GetBinding([Windows.UI.Notifications.KnownNotificationBindings]::ToastGeneric)
                                }
                                $title = ""; $body = ""
                                if ($null -ne $binding) {
                                    $els = $binding.GetTextElements()
                                    if ($els.Count -gt 0) { $title = $els[0].Text }
                                    if ($els.Count -gt 1) { $body  = $els[1].Text }
                                }
                                $obj = @{
                                    id        = $id
                                    source    = "pc"
                                    app       = $appName
                                    title     = $title
                                    body      = $body
                                    timestamp = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
                                }
                                $queue.Enqueue("NOTIF:" + ($obj | ConvertTo-Json -Compress))
                            } catch {}
                        }

                        # Prune stale seen IDs
                        if ($seenIds.Count -gt 500) {
                            $current = @{}
                            foreach ($n in $notifications) { $current[$n.Id.ToString()] = $true }
                            $toRemove = $seenIds.Keys | Where-Object { -not $current.ContainsKey($_) }
                            foreach ($k in $toRemove) { $seenIds.Remove($k) }
                        }
                    }
                } catch {}
                Start-Sleep -Seconds 2
            }
        }) | Out-Null
        $notifPS.BeginInvoke() | Out-Null
    }

    Write-Output "READY"
    [Console]::Out.Flush()

    # ── Main loop: handle media stdin commands + drain notification queue ──
    while ($true) {
        # Non-blocking stdin check
        if ([Console]::In.Peek() -ne -1) {
            $cmd = [Console]::In.ReadLine()
            if ($null -eq $cmd) { break }
            $cmd = $cmd.Trim()

            try {
                $session = $mediaManager.GetCurrentSession()
                switch ($cmd) {
                    "info" {
                        if ($null -ne $session) {
                            $props    = WaitAsync $asTaskGeneric ($session.TryGetMediaPropertiesAsync()) ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionMediaProperties])
                            $playback = $session.GetPlaybackInfo()
                            $timeline = $session.GetTimelineProperties()
                            $thumbData = ""
                            try {
                                $thumb = $props.Thumbnail
                                if ($null -ne $thumb) {
                                    [Windows.Storage.Streams.IRandomAccessStreamWithContentType, Windows.Storage.Streams, ContentType = WindowsRuntime] | Out-Null
                                    $stream = WaitAsync $asTaskGeneric ($thumb.OpenReadAsync()) ([Windows.Storage.Streams.IRandomAccessStreamWithContentType])
                                    $size = $stream.Size
                                    if ($size -gt 0 -and $size -lt 5000000) {
                                        $reader = New-Object System.IO.BinaryReader($stream.AsStreamForRead())
                                        $bytes = $reader.ReadBytes($size); $reader.Dispose()
                                        $ct = if ($stream.ContentType) { $stream.ContentType } else { "image/png" }
                                        $thumbData = "data:${ct};base64," + [Convert]::ToBase64String($bytes)
                                    }
                                    $stream.Dispose()
                                }
                            } catch {}
                            $obj = @{
                                title    = if ($props.Title)      { $props.Title }      else { "" }
                                artist   = if ($props.Artist)     { $props.Artist }     else { "" }
                                album    = if ($props.AlbumTitle) { $props.AlbumTitle } else { "" }
                                status   = $playback.PlaybackStatus.ToString()
                                position = [math]::Round($timeline.Position.TotalSeconds, 1)
                                duration = [math]::Round($timeline.EndTime.TotalSeconds, 1)
                                thumbnail = $thumbData
                            }
                            Write-Output ("DATA:" + ($obj | ConvertTo-Json -Compress))
                        } else {
                            Write-Output 'DATA:{"title":"","artist":"","album":"","status":"None","position":0,"duration":0,"thumbnail":""}'
                        }
                    }
                    "play"   { if ($null -ne $session) { WaitAsync $asTaskGeneric ($session.TryPlayAsync())            ([System.Boolean]) | Out-Null }; Write-Output "OK" }
                    "pause"  { if ($null -ne $session) { WaitAsync $asTaskGeneric ($session.TryPauseAsync())           ([System.Boolean]) | Out-Null }; Write-Output "OK" }
                    "toggle" { if ($null -ne $session) { WaitAsync $asTaskGeneric ($session.TryTogglePlayPauseAsync()) ([System.Boolean]) | Out-Null }; Write-Output "OK" }
                    "next"   { if ($null -ne $session) { WaitAsync $asTaskGeneric ($session.TrySkipNextAsync())        ([System.Boolean]) | Out-Null }; Write-Output "OK" }
                    "prev"   { if ($null -ne $session) { WaitAsync $asTaskGeneric ($session.TrySkipPreviousAsync())    ([System.Boolean]) | Out-Null }; Write-Output "OK" }
                    "exit"   { Write-Output "BYE"; [Console]::Out.Flush(); exit }
                    default  { Write-Output "ERR:Unknown command" }
                }
            } catch {
                Write-Output ("ERR:" + $_.Exception.Message)
            }
            [Console]::Out.Flush()
        }

        # Drain notification queue
        $item = $null
        while ($outputQueue.TryDequeue([ref]$item)) {
            Write-Output $item
            [Console]::Out.Flush()
        }

        Start-Sleep -Milliseconds 100
    }
} catch {
    Write-Output ("FATAL:" + $_.Exception.Message)
    [Console]::Out.Flush()
    exit 1
}
