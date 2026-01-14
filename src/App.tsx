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

  const combined = CIRCLE_RADIUS + CIRCLE_RADIUS;
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
    style: {
      fontFamily: "Space Grotesk",
      fill: "white",
      align: "center",
    },
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
    setHighScore(high: number) {
      bottomText.text = `HIGH SCORE: ${high}`;
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

  const reset = () => {
    player.alpha = 1;
    player.clear().circle(0, 0, CIRCLE_RADIUS).fill(0x8fbcbb);
    player.position.set(app.screen.width / 2, app.screen.height / 2);
  };

  const setDead = () => {
    player.clear().circle(0, 0, CIRCLE_RADIUS).fill(0xff0000);
  };

  return { player, reset, setDead };
}

type Obstacle = { g: Graphics; vx: number; vy: number };

function createObstacleSystem(app: Application) {
  const obstacles: Obstacle[] = [];

  const spawn = (score: number) => {
    const g = new Graphics().circle(0, 0, CIRCLE_RADIUS).fill(0xbf616a);

    const minX = CIRCLE_RADIUS;
    const maxX = app.screen.width - CIRCLE_RADIUS;
    const x = minX + Math.random() * (maxX - minX);

    g.position.set(x, -CIRCLE_RADIUS);

    // difficulty ramp via velocity ranges
    const t = Math.min(1, score / 120);
    const vxMax = 2 + t * 2;
    const vyMin = 2 + t * 2;
    const vyMax = 6 + t * 4;

    const vx = (Math.random() * 2 - 1) * vxMax;
    const vy = vyMin + Math.random() * (vyMax - vyMin);

    app.stage.addChild(g);
    obstacles.push({ g, vx, vy });
  };

  const clear = () => {
    for (const ob of obstacles) {
      app.stage.removeChild(ob.g);
      ob.g.destroy();
    }
    obstacles.length = 0;
  };

  const update = (deltaTime: number) => {
    for (let i = obstacles.length - 1; i >= 0; i--) {
      const ob = obstacles[i];

      ob.g.x += ob.vx * deltaTime;
      ob.g.y += ob.vy * deltaTime;

      // bounce x so they don't drift off the sides
      const minX = CIRCLE_RADIUS;
      const maxX = app.screen.width - CIRCLE_RADIUS;
      if (ob.g.x <= minX) {
        ob.g.x = minX;
        ob.vx *= -1;
      } else if (ob.g.x >= maxX) {
        ob.g.x = maxX;
        ob.vx *= -1;
      }

      // offscreen cleanup
      if (ob.g.y - CIRCLE_RADIUS > app.screen.height) {
        app.stage.removeChild(ob.g);
        ob.g.destroy();
        obstacles.splice(i, 1);
      }
    }
  };

  return { obstacles, spawn, clear, update };
}

function createSpawner() {
  let spawnElapsedMs = 0;
  const CHECK_MS = 120;

  return {
    reset() {
      spawnElapsedMs = 0;
    },
     // calls `spawn()` 0..N times based on elapsed time and chance
    tick(dtMs: number, score: number, spawn: (score: number) => void) {
      spawnElapsedMs += dtMs;

      const t = Math.min(1, score / 120);
      const spawnChance = 0.08 + t * 0.1; // 8% -> 18%

      let rollsThisFrame = 0;
      const MAX_ROLLS_PER_FRAME = 2;

      while (spawnElapsedMs >= CHECK_MS && rollsThisFrame < MAX_ROLLS_PER_FRAME) {
        spawnElapsedMs -= CHECK_MS;
        rollsThisFrame++;

        if (Math.random() < spawnChance) {
          spawn(score);
        }
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
  const { app, player, phaseRef, setPhase, onStartPlaying, onStopPlaying } = args;

  let dragTarget: Graphics | null = null;

  const onDragMove = (event: FederatedPointerEvent) => {
    if (phaseRef.current === "gameover") return;
    if (!dragTarget?.parent) return;
    dragTarget.parent.toLocal(event.global, undefined, dragTarget.position);
  };

  const stopDragging = () => {
    app.stage.off("pointermove", onDragMove);
    if (dragTarget) dragTarget.alpha = 1;
    dragTarget = null;
  };

  const onDragStart = () => {
    if (phaseRef.current === "gameover") return;
    if (dragTarget) return;

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
  const setPhase = (p: Phase) => {
    phaseRef.current = p;
  };

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

      // interaction stage
      app.stage.eventMode = "static";
      app.stage.hitArea = new Rectangle(0, 0, app.screen.width, app.screen.height);

      const INSTRUCTIONS =
        "HOLD TO PLAY, " + "RELEASE TO PAUSE\n" + "DRAG TO MOVE, " + "AVOID RED BALLS";

      const ui = createUI(app, INSTRUCTIONS);
      const { player, reset: resetPlayer, setDead } = createPlayer(app);
      const obstacles = createObstacleSystem(app);
      const spawner = createSpawner();

      let score = 0;
      let highScore = 0;

      const resetGame = () => {
        score = 0;
        spawner.reset();
        obstacles.clear();
        resetPlayer();
        setPhase("idle");
        ui.setInstructions(INSTRUCTIONS);
        ui.setScore(score);
      };

      const triggerGameOver = (stopDragging: () => void) => {
        setDead();
        ui.showGameOver(score);

        setPhase("gameover");
        stopDragging();

        const final = Math.floor(score);
        if (final > highScore) {
          highScore = final;
          ui.setHighScore(highScore);
        }

        if (gameOverTimeout) window.clearTimeout(gameOverTimeout);
        gameOverTimeout = window.setTimeout(() => {
          resetGame();
        }, 5000);
      };

      const drag = bindDragControls({
        app,
        player,
        phaseRef,
        setPhase,
        onStartPlaying: () => ui.clearInstructions(),
        onStopPlaying: () => {
          ui.setInstructions("PAUSED, DRAG TO CONTINUE");
        },
      });

      const onTick = (ticker: { deltaMS: number; deltaTime: number }) => {
        const phase = phaseRef.current;
        if (phase !== "playing") return;

        const dtMS = Math.min(ticker.deltaMS, 50);

        // spawn
        spawner.tick(dtMS, score, obstacles.spawn);

        // move
        obstacles.update(ticker.deltaTime);

        // collide
        for (let i = obstacles.obstacles.length - 1; i >= 0; i--) {
          const ob = obstacles.obstacles[i];
          if (collisionDetection(player, ob.g)) {
            triggerGameOver(drag.stopDragging);
            return;
          }
        }

        // score
        score += 0.1;
        ui.setScore(score);
      };

      app.ticker.add(onTick);

      // cleanup for this run()
      return () => {
        if (gameOverTimeout) window.clearTimeout(gameOverTimeout);
        drag.cleanup();
        app.ticker.remove(onTick);
        app.destroy(true);
      };
    };

    let cleanupRun: null | (() => void) = null;

    run().then((cleanup) => {
      if (typeof cleanup === "function") cleanupRun = cleanup;
    });

    return () => {
      destroyed = true;
      if (gameOverTimeout) window.clearTimeout(gameOverTimeout);
      if (cleanupRun) cleanupRun();
    };
  }, []);

  return <div ref={containerRef} style={{ width: "100vw", height: "100vh" }} />;
}

export default App;
