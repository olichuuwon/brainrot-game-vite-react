# Brainrot

A browser game built with React 19, PixiJS 8, and TypeScript.

**▶ [Play it here](https://brainrot-game-vite-react.vercel.app)**

## About

Hold the circle to play. Let go and everything freezes exactly where it was, 
the game runs on a dead man's switch, so nothing advances while you aren't
holding it. That's the whole design, where it's built for divided attention.

## Tech stack

| | |
|---|---|
| **Rendering** | [PixiJS 8](https://pixijs.com) — WebGL2 canvas renderer |
| **UI** | React 19 |
| **Language** | TypeScript 5.5 |
| **Build** | Vite 5 |
| **Lint** | ESLint 9 (flat config) |
| **Hosting** | Vercel |

React handles menus, HUD, and app state. Pixi owns the canvas and the game loop.
The two talk through refs rather than re-rendering the scene graph on every frame.

## Running locally

Requires Node 18 or newer.

```bash
git clone https://github.com/olichuuwon/brainrot-game-vite-react.git
cd brainrot-game-vite-react
npm install
npm run dev
```

Vite serves on `http://localhost:5173` with hot reload.

## Project structure

```
├── public/            # Static assets — sprites, audio, fonts
├── src/               # Components, game logic, Pixi setup
├── index.html         # Vite entry point
└── vite.config.ts
```
