@echo off
echo Adding firewall rule for Next.js on port 3000...
netsh advfirewall firewall delete rule name="Next.js Dev Server" protocol=TCP localport=3000
netsh advfirewall firewall add rule name="Next.js Dev Server" dir=in action=allow protocol=TCP localport=3000
echo.
echo Firewall rule added successfully!
echo.
echo You can now access your app from other devices using:
echo http://192.168.100.96:3000
echo.
pause
