WebAR.rocks.face is a lightweight, open-source JavaScript/WebGL library for real-time face detection, tracking, and facial landmark estimation that runs entirely in the browser (on-device, no server needed).
Core Purpose
It lets web developers add Augmented Reality (AR) face filters and Virtual Try-On (VTO) experiences directly in the browser using the user's webcam. It processes the live video feed in real time, even on mid-range mobile devices.
Key Features

Face detection & tracking — Detects one or multiple faces.
Facial landmarks — Outputs positions of key points (eyes, nose, mouth, jaw, etc.).
Face rotation & pose — Provides position, scale, and Euler angles for accurate 3D alignment.
Mobile-friendly — Optimized for performance on phones and tablets.
Lighting robust — Works well under various conditions.
Framework-agnostic — Outputs raw data (you can use it with Three.js, React Three Fiber, or plain WebGL).

It uses its own custom WebGL-based deep learning engine (home-made neural networks) rather than relying on TensorFlow.js, MediaPipe, or OpenCV.
Best For

Makeup virtual try-on (lipstick, full face makeup)
Accessories VTO (glasses, earrings, hats, helmets, necklaces)
Face filters & masks (flexible 3D masks, face replacement)
Your use case: Teeth coloring / dental simulation — you can adapt the mouth-region makeup demos.

How It Works (High-Level)

User allows camera access.
Library runs a neural network on the video frames.
Returns detection state + landmark positions every frame.
You use that data to position/align 3D models (e.g., a teeth model from Three.js) or apply color overlays.

Integration

Include the script: WebARRocksFace.js
Initialize with a canvas element + callback functions.
Use provided helpers for easier setup.
Demos available in both plain JavaScript and modern React + Three.js setups.

Open Source & Licensing

MIT License → Free to use, modify, and commercial projects.
Full source on GitHub: https://github.com/WebAR-rocks/WebAR.rocks.face
Optional paid yearly plans for professional support and updates.

It's part of the WebAR.rocks suite of computer vision libraries (they also have hand tracking, image tracking, etc.).