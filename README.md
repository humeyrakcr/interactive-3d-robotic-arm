# Interactive 3D Robotic Arm

**Category** · Computer Graphics · Interactive 3D Simulation

## Portfolio copy

An interactive 3D simulation that shows how a robotic arm reaches user-defined pickup positions. Move the payload, then watch an analytical inverse-kinematics solver calculate the joint angles for pickup, lift, and placement. Targets outside the arm’s transfer range are flagged before the cycle starts. The demo also includes manual joint controls and an orbit camera.

**Preview alt text** · An orange robotic arm grips a turquoise cube between two stations on a dark grid.

**Call to action** · Open interactive demo

## Files

Download the complete [portfolio kit](robotic-arm-portfolio-kit.zip), or use the individual files below.

- `index.html`, `style.css`, and `arm.js` form the standalone browser demo. Keep these three files together and link the CTA to `index.html`. No installation or build is required.
- `robotic-arm-demo.mp4` is the primary preview. It is a silent, 9-second, 1280 × 720 H.264 video captured from the working browser simulator.
- `robotic-arm-preview.webp` is the poster and reduced-motion preview.
- `robotic-arm-demo.gif` is an optional 640 × 360 loop.
- `preview-snippet.html` is an integration example. Adjust the relative paths to match your site.

## Native C/OpenGL source

The original C project and macOS build instructions are in [robotic-arm-native-source.zip](robotic-arm-native-source.zip). The inverse-kinematics demo runs in the browser.

## Technical scope

The pickup target is adjustable in angle and radial distance on the station plane. A closed-form two-link solve computes shoulder and elbow angles. The base turns toward the target and the remaining joints keep the gripper pointing down at the transfer waypoints. The simulation checks the configured joint limits, interpolates between solved poses, and attaches the sample cube to the gripper during transport.

The published standalone preview is private to the owner. For a portfolio link that visitors can open, use the static files on your portfolio host. Personal contribution details and a project GitHub or Figma link are pending confirmation.
