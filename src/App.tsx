import { useEffect, useRef } from "react";
import {
  Application,
  FederatedPointerEvent,
  Graphics,
  Rectangle,
  Text,
} from "pixi.js";

const CIRCLE_RADIUS = 30;

type Phase = "idle" | "playing" | "gameover";

function collisionDetection(player: Graphics, obstacle: Graphics): boolean {
  const dx = player.x - obstacle.x;
  const dy = player.y - obstacle.y;
  const dist2 = dx * dx + dy * dy;
  const combined = CIRCLE_RADIUS * 2;
  return dist2 <= combined * combined;
}

function createUI(app: Application, instructions: string) {
  const topText = new Text({
    text: "SCORE: 0",
    style: { fontFamily: "Space Grotesk", fill: "white" },
  });
  topText.position.set(20, 20);
  app.stage.addChild(topText);

  const middleText = new Text({
    text: instructions,
    style: { fontFamily: "Space Grotesk", fill: "white", align: "center" },
  });
  middleText.anchor.set(0.5);
  middleText.position.set(app.screen.width / 2, app.screen.height / 2 - 80);
  app.stage.addChild(middleText);

  const bottomText = new Text({
    text: "HIGH SCORE: 0",
    style: { fontFamily: "Space Grotesk", fill: "white" },
  });
  bottomText.position.set(20, app.screen.height - 50);
  app.stage.addChild(bottomText);

  let lastShownScore = -1;

  return {
    setScore(score: number) {
      const shown = Math.floor(score);
      if (shown !== lastShownScore) {
        lastShownScore = shown;
        topText.text = `SCORE: ${shown}`;
      }
    },
    showGameOver(score: number) {
      topText.text = `GAME OVER! FINAL SCORE: ${Math.floor(score)}`;
    },
    setHighScore(score: number) {
      bottomText.text = `HIGH SCORE: ${score}`;
    },
    setInstructions(text: string) {
      middleText.text = text;
    },
    clearInstructions() {
      middleText.text = "";
    },
  };
}

function createPlayer(app: Application) {
  const player = new Graphics().circle(0, 0, CIRCLE_RADIUS).fill(0x8fbcbb);
  player.eventMode = "static";
  player.cursor = "pointer";
  player.position.set(app.screen.width / 2, app.screen.height / 2);
  app.stage.addChild(player);

  return {
    player,
    reset() {
      player.alpha = 1;
      player.clear().circle(0, 0, CIRCLE_RADIUS).fill(0x8fbcbb);
      player.position.set(app.screen.width / 2, app.screen.height / 2);
    },
    setDead() {
      player.clear().circle(0, 0, CIRCLE_RADIUS).fill(0xff0000);
    },
  };
}

type Obstacle = { g: Graphics; vx: number; vy: number };

function createObstacleSystem(app: Application) {
  const obstacles: Obstacle[] = [];

  const spawn = (score: number) => {
    const g = new Graphics().circle(0, 0, CIRCLE_RADIUS).fill(0xbf616a);

    const minX = CIRCLE_RADIUS;
    const maxX = app.screen.width - CIRCLE_RADIUS;
    g.position.set(minX + Math.random() * (maxX - minX), -CIRCLE_RADIUS);

    const t = score / (score + 250);
    const vxMax = 2 + t * 2;
    const vyMin = 2 + t * 2;
    const vyMax = 6 + t * 4;

    const vx = (Math.random() * 2 - 1) * vxMax;
    const vy = vyMin + Math.random() * (vyMax - vyMin);

    app.stage.addChild(g);
    obstacles.push({ g, vx, vy });
  };

  const update = (deltaTime: number) => {
    for (let i = obstacles.length - 1; i >= 0; i--) {
      const ob = obstacles[i];

      ob.g.x += ob.vx * deltaTime;
      ob.g.y += ob.vy * deltaTime;

      const minX = CIRCLE_RADIUS;
      const maxX = app.screen.width - CIRCLE_RADIUS;

      if (ob.g.x <= minX || ob.g.x >= maxX) ob.vx *= -1;

      if (ob.g.y - CIRCLE_RADIUS > app.screen.height) {
        app.stage.removeChild(ob.g);
        ob.g.destroy();
        obstacles.splice(i, 1);
      }
    }
  };

  const clear = () => {
    for (const ob of obstacles) {
      app.stage.removeChild(ob.g);
      ob.g.destroy();
    }
    obstacles.length = 0;
  };

  return { obstacles, spawn, update, clear };
}

function createSpawner() {
  let timeToNextMs = 900;
  let playTimeMs = 0;

  const rand = (min: number, max: number) => min + Math.random() * (max - min);

  const nextIntervalMs = () => {
    const minutes = playTimeMs / 60000;
    const d = Math.log1p(minutes * 5);

    const base = Math.max(380, 900 - d * 70);
    const jitter = base * rand(-0.08, 0.08);

    return Math.max(280, base + jitter);
  };

  return {
    reset() {
      playTimeMs = 0;
      timeToNextMs = 900;
    },
    tick(dtMs: number, spawn: () => void, canSpawn: () => boolean) {
      playTimeMs += dtMs;
      timeToNextMs -= dtMs;

      let spawned = 0;
      while (timeToNextMs <= 0 && spawned < 2) {
        if (canSpawn()) spawn();
        spawned++;
        timeToNextMs += nextIntervalMs();
      }
    },
  };
}

function bindDragControls(args: {
  app: Application;
  player: Graphics;
  phaseRef: React.MutableRefObject<Phase>;
  setPhase: (p: Phase) => void;
  onStartPlaying: () => void;
  onStopPlaying: () => void;
}) {
  const { app, player, phaseRef, setPhase, onStartPlaying, onStopPlaying } =
    args;
  let dragTarget: Graphics | null = null;

  const onDragMove = (e: FederatedPointerEvent) => {
    if (!dragTarget || phaseRef.current === "gameover") return;
    dragTarget.parent?.toLocal(e.global, undefined, dragTarget.position);
  };

  const stopDragging = () => {
    app.stage.off("pointermove", onDragMove);
    if (dragTarget) dragTarget.alpha = 1;
    dragTarget = null;
  };

  const onDragStart = () => {
    if (phaseRef.current === "gameover" || dragTarget) return;
    setPhase("playing");
    onStartPlaying();
    player.alpha = 0.5;
    dragTarget = player;
    app.stage.on("pointermove", onDragMove);
  };

  const onDragEnd = () => {
    if (phaseRef.current === "gameover") return;
    setPhase("idle");
    stopDragging();
    onStopPlaying();
  };

  player.on("pointerdown", onDragStart);
  app.stage.on("pointerup", onDragEnd);
  app.stage.on("pointerupoutside", onDragEnd);

  return {
    stopDragging,
    cleanup() {
      stopDragging();
      player.off("pointerdown", onDragStart);
      app.stage.off("pointerup", onDragEnd);
      app.stage.off("pointerupoutside", onDragEnd);
    },
  };
}

function App() {
  const containerRef = useRef<HTMLDivElement>(null);
  const phaseRef = useRef<Phase>("idle");

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let destroyed = false;
    let gameOverTimeout: number | null = null;

    const run = async () => {
      const app = new Application();
      await app.init({
        background: "#2E3440",
        resizeTo: window,
        resolution: window.devicePixelRatio || 1,
        autoDensity: true,
      });

      if (destroyed) {
        app.destroy(true);
        return;
      }

      container.appendChild(app.canvas);
      app.stage.eventMode = "static";
      app.stage.hitArea = new Rectangle(
        0,
        0,
        app.screen.width,
        app.screen.height
      );

      const INSTRUCTIONS = "HOLD TO PLAY\nRELEASE TO PAUSE\nDRAG TO MOVE";

      const ui = createUI(app, INSTRUCTIONS);
      const { player, reset, setDead } = createPlayer(app);
      const obstacles = createObstacleSystem(app);
      const spawner = createSpawner();

      let score = 0;
      let highScore = 0;

      const resetGame = () => {
        score = 0;
        spawner.reset();
        obstacles.clear();
        reset();
        phaseRef.current = "idle";
        ui.setInstructions(INSTRUCTIONS);
        ui.setScore(score);
      };

      const triggerGameOver = (stopDragging: () => void) => {
        setDead();
        ui.showGameOver(score);
        phaseRef.current = "gameover";
        stopDragging();

        const final = Math.floor(score);
        if (final > highScore) {
          highScore = final;
          ui.setHighScore(highScore);
        }

        gameOverTimeout = window.setTimeout(resetGame, 5000);
      };

      const drag = bindDragControls({
        app,
        player,
        phaseRef,
        setPhase: (p) => (phaseRef.current = p),
        onStartPlaying: () => ui.clearInstructions(),
        onStopPlaying: () => ui.setInstructions("PAUSED"),
      });

      app.ticker.add((ticker) => {
        if (phaseRef.current !== "playing") return;

        const dtMS = Math.min(ticker.deltaMS, 50);

        spawner.tick(
          dtMS,
          () => obstacles.spawn(score),
          () => obstacles.obstacles.length < 12
        );

        obstacles.update(ticker.deltaTime);

        for (const ob of obstacles.obstacles) {
          if (collisionDetection(player, ob.g)) {
            triggerGameOver(drag.stopDragging);
            return;
          }
        }

        score += 0.1;
        ui.setScore(score);
      });
    };

    run();

    return () => {
      destroyed = true;
      if (gameOverTimeout) window.clearTimeout(gameOverTimeout);
    };
  }, []);

  return <div ref={containerRef} style={{ width: "100vw", height: "100vh" }} />;
}

export default App;
