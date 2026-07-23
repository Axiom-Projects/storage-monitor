-- Send an iMessage. Usage: osascript send-imessage.applescript "<handle>" "<message>"
-- Handle = phone number or Apple ID email registered with iMessage.
on run argv
	set targetHandle to item 1 of argv
	set msgText to item 2 of argv
	tell application "Messages"
		set targetService to 1st service whose service type = iMessage
		send msgText to buddy targetHandle of targetService
	end tell
end run
