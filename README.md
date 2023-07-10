Reusable workflow for Addon Repository called from each Partners' repository. The pipeline is currently:
- checkout the latest code
- minification of CSS, JavaScript
- creating an artifact

Addon Repository will upload this artifact to FTP, remove the artifact from GitHub and update custom codes.