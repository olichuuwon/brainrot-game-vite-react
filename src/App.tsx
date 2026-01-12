import { useEffect, useRef } from "react";
import {
  Application,
  FederatedPointerEvent,
  Graphics,
  Rectangle,
  Text,
} from "pixi.js";

const CIRCLE_RADIUS = 30;

function collisionDetection(player: Graphics, obstacle: Graphics): boolean {
  const deltaX = player.x - obstacle.x;
  const deltaY = player.y - obstacle.y;
  const distanceSquared = deltaX * deltaX + deltaY * deltaY;

  const combinedRadius = CIRCLE_RADIUS + CIRCLE_RADIUS;
  const collisionThreshold = combinedRadius * combinedRadius;

  return distanceSquared <= collisionThreshold;
}

function App() {
  const containerRef = useRef<HTMLDivElement>(null);

  type Phase = "idle" | "playing" | "gameover";

  const phaseRef = useRef<Phase>("idle");

  const setPhase = (p: Phase) => {
    phaseRef.current = p;
  };

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let destroyed = false;
    let app: Application | null = null;

    let gameOverTimeout: number | null = null;

    const run = async () => {
      app = new Application();

      await app.init({
        background: "#2E3440",
        resizeTo: window,
        resolution: window.devicePixelRatio || 1,
        autoDensity: true,
      });

      if (destroyed) {
        app.destroy(true);
        app = null;
        return;
      }

      container.appendChild(app.canvas);

      // player
      const player = new Graphics().circle(0, 0, CIRCLE_RADIUS).fill(0x8fbcbb);
      player.eventMode = "static";
      player.cursor = "pointer";
      player.position.set(app.screen.width / 2, app.screen.height / 2);
      app.stage.addChild(player);

      // obstacles
      type Obstacle = { g: Graphics; vx: number; vy: number };
      const obstacles: Obstacle[] = [];

      let spawnElapsedMs = 0;
      const CHECK_MS = 120;

      const spawnObstacle = (score: number) => {
        if (!app) return;

        const g = new Graphics().circle(0, 0, CIRCLE_RADIUS).fill(0xbf616a);

        const minX = CIRCLE_RADIUS;
        const maxX = app.screen.width - CIRCLE_RADIUS;
        const x = minX + Math.random() * (maxX - minX);

        g.position.set(x, -CIRCLE_RADIUS);

        // difficulty ramp via velocity ranges
        // scale goes 0 -> 1 as score goes 0 -> 120 (then stays at 1)
        const t = Math.min(1, score / 120);

        const vxMax = 2 + t * 2;
        const vyMin = 2 + t * 2;
        const vyMax = 6 + t * 4;

        const vx = (Math.random() * 2 - 1) * vxMax;
        const vy = vyMin + Math.random() * (vyMax - vyMin);

        app.stage.addChild(g);
        obstacles.push({ g, vx, vy });
      };

      const clearObstacles = () => {
        if (!app) return;
        for (const ob of obstacles) {
          app.stage.removeChild(ob.g);
          ob.g.destroy();
        }
        obstacles.length = 0;
      };

      // interaction stage
      app.stage.eventMode = "static";
      app.stage.hitArea = new Rectangle(
        0,
        0,
        app.screen.width,
        app.screen.height
      );

      // basic text
      const basicText = new Text({
        style: { fontFamily: "Space Grotesk", fill: "white" },
      });

      basicText.x = 20;
      basicText.y = 20;

      app.stage.addChild(basicText);

      // drag state
      let dragTarget: Graphics | null = null;

      const onDragMove = (event: FederatedPointerEvent) => {
        if (phaseRef.current === "gameover") return;
        if (!dragTarget?.parent) return;
        dragTarget.parent.toLocal(event.global, undefined, dragTarget.position);
      };

      const stopDragging = () => {
        if (!app) return;
        app.stage.off("pointermove", onDragMove);
        if (dragTarget) dragTarget.alpha = 1;
        dragTarget = null;
      };

      const onDragStart = () => {
        if (phaseRef.current === "gameover") return;
        if (dragTarget) return;

        setPhase("playing");
        player.alpha = 0.5;
        dragTarget = player;
        app!.stage.on("pointermove", onDragMove);
      };

      const onDragEnd = () => {
        if (phaseRef.current === "gameover") return;
        setPhase("idle");
        stopDragging();
      };

      player.on("pointerdown", onDragStart);
      app.stage.on("pointerup", onDragEnd);
      app.stage.on("pointerupoutside", onDragEnd);

      // game loop
      let SCORE = 0;
      let lastShownScore = -1;

      const triggerGameOver = () => {
        player.clear().circle(0, 0, CIRCLE_RADIUS).fill(0xff0000);
        basicText.text = `GAME OVER! FINAL SCORE: ${Math.floor(SCORE)}`;

        setPhase("gameover");
        stopDragging();

        if (gameOverTimeout) window.clearTimeout(gameOverTimeout);
        gameOverTimeout = window.setTimeout(() => {
          SCORE = 0;
          lastShownScore = -1;
          spawnElapsedMs = 0;

          clearObstacles();

          basicText.text = "SCORE: 0";
          player.alpha = 1;
          player.clear().circle(0, 0, CIRCLE_RADIUS).fill(0x8fbcbb);
          player.x = app!.screen.width / 2;
          player.y = app!.screen.height / 2;

          setPhase("idle");
        }, 5000);
      };

      app.ticker.add((ticker) => {
        const phase = phaseRef.current;

        if (phase === "idle") {
          basicText.text = "HOLD CIRCLE TO PLAY";
          return;
        }

        if (phase === "gameover") {
          return;
        }

        // playing
        const dtMS = Math.min(ticker.deltaMS, 50);
        spawnElapsedMs += dtMS;

        // chance-based spawning
        const t = Math.min(1, SCORE / 120);
        const spawnChance = 0.08 + t * 0.1; // 8% -> 18%

        let rollsThisFrame = 0;
        const MAX_ROLLS_PER_FRAME = 2;

        while (
          spawnElapsedMs >= CHECK_MS &&
          rollsThisFrame < MAX_ROLLS_PER_FRAME
        ) {
          spawnElapsedMs -= CHECK_MS;
          rollsThisFrame++;

          if (Math.random() < spawnChance) {
            spawnObstacle(SCORE);
          }
        }

        for (let i = obstacles.length - 1; i >= 0; i--) {
          const ob = obstacles[i];

          ob.g.x += ob.vx * ticker.deltaTime;
          ob.g.y += ob.vy * ticker.deltaTime;

          // bounce x so they don't drift off the sides
          const minX = CIRCLE_RADIUS;
          const maxX = app!.screen.width - CIRCLE_RADIUS;
          if (ob.g.x <= minX) {
            ob.g.x = minX;
            ob.vx *= -1;
          } else if (ob.g.x >= maxX) {
            ob.g.x = maxX;
            ob.vx *= -1;
          }

          if (collisionDetection(player, ob.g)) {
            triggerGameOver();
            return;
          }

          if (ob.g.y - CIRCLE_RADIUS > app!.screen.height) {
            app!.stage.removeChild(ob.g);
            ob.g.destroy();
            obstacles.splice(i, 1);
          }
        }

        SCORE = SCORE + 0.1;

        const shown = Math.floor(SCORE);
        if (shown !== lastShownScore) {
          lastShownScore = shown;
          basicText.text = `SCORE: ${shown}`;
        }
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
