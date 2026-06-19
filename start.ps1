$env:PATH = "C:\Program Files\nodejs;" + $env:PATH
npx kill-port 3000
Start-Process powershell -ArgumentList "-NoExit", "-Command", "`$env:PATH = 'C:\Program Files\nodejs;' + `$env:PATH; npm run dev" -WindowStyle Hidden
