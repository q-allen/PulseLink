# Face API Models

This folder must contain the `face-api.js` model files so the auto-capture
verification can load them at runtime from `/models`.

Required nets:
- `tinyFaceDetector`
- `faceLandmark68Net`

Place the downloaded model assets here so the app can load them via:
`/models/<model files>`
