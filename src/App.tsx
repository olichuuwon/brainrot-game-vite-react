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

      // obstacle
      const obstacle = new Graphics()
        .circle(0, 0, CIRCLE_RADIUS)
        .fill(0xbf616a);
      obstacle.position.set(
        CIRCLE_RADIUS * 2 + app.screen.width / 2,
        CIRCLE_RADIUS + app.screen.height / 2
      );
      app.stage.addChild(obstacle);

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

      app.ticker.add(() => {
        const phase = phaseRef.current;

        if (phase === "idle") {
          basicText.text = "HOLD CIRCLE TO PLAY";
          return;
        }

        if (phase === "gameover") {
          return;
        }

        if (collisionDetection(player, obstacle)) {
          player.clear().circle(0, 0, CIRCLE_RADIUS).fill(0xff0000);
          basicText.text = `GAME OVER! FINAL SCORE: ${SCORE.toFixed(0)}`;

          setPhase("gameover");
          stopDragging();

          if (gameOverTimeout) window.clearTimeout(gameOverTimeout);
          gameOverTimeout = window.setTimeout(() => {
            SCORE = 0;
            basicText.text = "SCORE: 0";
            player.alpha = 1;
            player.clear().circle(0, 0, CIRCLE_RADIUS).fill(0x8fbcbb);
            player.x = app!.screen.width / 2;
            player.y = app!.screen.height / 2;
            setPhase("idle");
          }, 5000);

          return;
        }

        SCORE = SCORE + 0.1;
        basicText.text = `SCORE: ${SCORE.toFixed(0)}`;
        player.clear().circle(0, 0, CIRCLE_RADIUS).fill(0x8fbcbb);
      });
    };

    run();
  }, []);

  return <div ref={containerRef} style={{ width: "100vw", height: "100vh" }} />;
}

export default App;
