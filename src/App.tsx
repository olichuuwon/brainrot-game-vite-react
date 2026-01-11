import { useEffect, useRef } from "react";
import {
  Application,
  FederatedPointerEvent,
  Graphics,
  Rectangle,
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

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let destroyed = false;
    let app: Application | null = null;

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

      // drag state
      let dragTarget: Graphics | null = null;

      const onDragMove = (event: FederatedPointerEvent) => {
        if (!dragTarget?.parent) return;
        dragTarget.parent.toLocal(event.global, undefined, dragTarget.position);
      };

      const onDragStart = () => {
        player.alpha = 0.5;
        dragTarget = player;
        app!.stage.on("pointermove", onDragMove);
      };

      const onDragEnd = () => {
        if (!dragTarget) return;
        app!.stage.off("pointermove", onDragMove);
        dragTarget.alpha = 1;
        dragTarget = null;
      };

      player.on("pointerdown", onDragStart);
      app.stage.on("pointerup", onDragEnd);
      app.stage.on("pointerupoutside", onDragEnd);

      // game loop
      app.ticker.add(() => {
        if (collisionDetection(player, obstacle)) {
          player.clear().circle(0, 0, CIRCLE_RADIUS).fill(0xff0000);
          obstacle.clear().circle(0, 0, CIRCLE_RADIUS).fill(0xff0000);
        } else {
          player.clear().circle(0, 0, CIRCLE_RADIUS).fill(0x8fbcbb);
          obstacle.clear().circle(0, 0, CIRCLE_RADIUS).fill(0xbf616a);
        }
      });
    };

    run();
  }, []);

  return <div ref={containerRef} style={{ width: "100vw", height: "100vh" }} />;
}

export default App;
