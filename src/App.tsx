import { useEffect, useRef } from "react";
import { Application, Assets, Sprite, FederatedPointerEvent, Rectangle } from "pixi.js";

function App() {
  const containerRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<Application | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let destroyed = false;

    const run = async () => {
      const app = new Application();
      await app.init({
        background: "#1099bb",
        resizeTo: window,
        resolution: window.devicePixelRatio || 1,
        autoDensity: true,
      });

      if (destroyed) {
        app.destroy(true);
        return;
      }

      appRef.current = app;
      container.appendChild(app.canvas);

      // Load the bunny texture
      const texture = await Assets.load("https://pixijs.com/assets/bunny.png");
      texture.source.scaleMode = "nearest";

      // Create bunny
      const bunny = new Sprite(texture);
      bunny.eventMode = "static";
      bunny.cursor = "pointer";
      bunny.anchor.set(0.5);
      bunny.scale.set(3);
      bunny.position.set(window.innerWidth / 2, window.innerHeight / 2);
      app.stage.addChild(bunny);

      // Drag state
      let dragTarget: Sprite | null = null;

      // Make stage interactive with proper hit area
      app.stage.eventMode = "static";
      app.stage.hitArea = new Rectangle(0, 0, app.screen.width, app.screen.height);

      function onDragMove(event: FederatedPointerEvent) {
        if (dragTarget?.parent) {
          dragTarget.parent.toLocal(event.global, undefined, dragTarget.position);
        }
      }

      function onDragStart(this: Sprite) {
        this.alpha = 0.5;
        dragTarget = this;
        app.stage.on("pointermove", onDragMove);
      }

      function onDragEnd() {
        if (dragTarget) {
          app.stage.off("pointermove", onDragMove);
          dragTarget.alpha = 1;
          dragTarget = null;
        }
      }

      bunny.on("pointerdown", onDragStart, bunny);
      app.stage.on("pointerup", onDragEnd);
      app.stage.on("pointerupoutside", onDragEnd);
    };

    run();

    return () => {
      destroyed = true;
      appRef.current?.destroy(true, { children: true });
      appRef.current = null;
    };
  }, []);

  return (
    <div>
      <div ref={containerRef} style={{ width: "100vw", height: "100vh" }} />
    </div>
  );
}

export default App;