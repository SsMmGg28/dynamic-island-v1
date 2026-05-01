# Dynamic Island - Windows Notification Bridge
# Polls UserNotificationListener (WinRT) and streams JSON events to Electron main process
# Protocol: READY on start, DATA:<json> on each new notification, ERR:<msg> on failure
# Requires Windows 10 1803+ and user permission for notification access.

$ErrorActionPreference = "SilentlyContinue"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

try {
    Add-Type -AssemblyName System.Runtime.WindowsRuntime

    # Resolve AsTask generic helper (same pattern as get-media.ps1)
    $asTaskGeneric = ([System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object {
        $_.Name -eq 'AsTask' -and
        $_.GetParameters().Count -eq 1 -and
        $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1'
    })[0]

    Function WaitAsync($WinRtTask, $ResultType) {
        $asTask = $asTaskGeneric.MakeGenericMethod($ResultType)
        $netTask = $asTask.Invoke($null, @($WinRtTask))
        $netTask.Wait(5000) | Out-Null
        $netTask.Result
    }

    # Load UserNotificationListener namespace
    [Windows.UI.Notifications.Management.UserNotificationListener, Windows.UI.Notifications, ContentType = WindowsRuntime] | Out-Null
    [Windows.UI.Notifications.Management.UserNotificationListenerAccessStatus, Windows.UI.Notifications, ContentType = WindowsRuntime] | Out-Null
    [Windows.UI.Notifications.NotificationKinds, Windows.UI.Notifications, ContentType = WindowsRuntime] | Out-Null

    $listener = [Windows.UI.Notifications.Management.UserNotificationListener]::Current

    # Request permission (shows Windows dialog on first run)
    $status = WaitAsync ($listener.RequestAccessAsync()) ([Windows.UI.Notifications.Management.UserNotificationListenerAccessStatus])
    if ($status -ne [Windows.UI.Notifications.Management.UserNotificationListenerAccessStatus]::Allowed) {
        Write-Output "ERR:Notification access denied. Please enable it in Windows Settings > Privacy > Notifications."
        [Console]::Out.Flush()
        exit 1
    }

    Write-Output "READY"
    [Console]::Out.Flush()

    # Track seen notification IDs to avoid duplicates
    $seenIds = @{}
    $pollInterval = 2  # seconds

    while ($true) {
        try {
            $notifications = WaitAsync ($listener.GetNotificationsAsync([Windows.UI.Notifications.NotificationKinds]::Toast)) ([System.Collections.Generic.IReadOnlyList[Windows.UI.Notifications.UserNotification]])

            if ($null -ne $notifications) {
                foreach ($notif in $notifications) {
                    $id = $notif.Id.ToString()
                    if ($seenIds.ContainsKey($id)) { continue }
                    $seenIds[$id] = $true

                    try {
                        $appInfo = $notif.AppInfo
                        $appName = if ($appInfo -and $appInfo.DisplayInfo -and $appInfo.DisplayInfo.DisplayName) {
                            $appInfo.DisplayInfo.DisplayName
                        } else { "Bilinmeyen Uygulama" }

                        $toast = $notif.Notification
                        $visual = $toast.Visual
                        $binding = if ($visual) { $visual.GetBinding([Windows.UI.Notifications.KnownNotificationBindings]::ToastGeneric) } else { $null }

                        $title = ""
                        $body  = ""

                        if ($null -ne $binding) {
                            $textElements = $binding.GetTextElements()
                            if ($textElements.Count -gt 0) { $title = $textElements[0].Text }
                            if ($textElements.Count -gt 1) { $body  = $textElements[1].Text }
                        }

                        $timestamp = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()

                        $obj = @{
                            id        = $id
                            source    = "pc"
                            app       = $appName
                            title     = $title
                            body      = $body
                            timestamp = $timestamp
                        }

                        Write-Output ("DATA:" + ($obj | ConvertTo-Json -Compress))
                        [Console]::Out.Flush()
                    } catch {
                        # Skip malformed notification
                    }
                }
            }

            # Prune seen IDs that are no longer in the notification center (dismissed)
            if ($seenIds.Count -gt 500) {
                $currentIds = @{}
                if ($null -ne $notifications) {
                    foreach ($n in $notifications) { $currentIds[$n.Id.ToString()] = $true }
                }
                $toRemove = $seenIds.Keys | Where-Object { -not $currentIds.ContainsKey($_) }
                foreach ($k in $toRemove) { $seenIds.Remove($k) }
            }
        } catch {
            # Transient WinRT error — keep polling
        }

        Start-Sleep -Seconds $pollInterval
    }
} catch {
    Write-Output ("ERR:" + $_.Exception.Message)
    [Console]::Out.Flush()
    exit 1
}
