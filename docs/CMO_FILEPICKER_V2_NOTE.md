# CMO Filepicker v2

Problem: Auf iPad/iOS werden `.cmo`-Dateien im Dateidialog grau dargestellt, wenn der Upload-Input einen `accept`-Filter besitzt.

Fix v2:
- Kein `accept` im HTML.
- Zusätzlich `removeAttribute('accept')` direkt vor `fileInput.click()`.
- Cache-Bust in der iframe-URL über `alv=cmo-filepicker-v2`.
