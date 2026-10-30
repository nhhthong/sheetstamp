import type Konva from "konva";
import { useEffect, useRef, useState } from "react";
import { Group, Image as KonvaImage, Layer, Rect, Stage, Text } from "react-konva";
import type { LayoutBox } from "../../../../shared/image-layout";
import { ied } from "../../../strings/image-editor";
import { labelFor } from "./fields";

export type BoxChange = Partial<Pick<LayoutBox, "x" | "y" | "width">>;

type Props = {
  background: ImageBitmap;
  boxes: readonly LayoutBox[];
  labels: Readonly<Record<string, string>>;
  /** First data row's values per field, when data is loaded. */
  selectedId: string | null;
  /** Boxes that do not fit inside the background: drawn in the warning colour. */
  flaggedIds?: ReadonlySet<string>;
  onSelect: (id: string | null) => void;
  onChange: (id: string, change: BoxChange) => void;
};

const OUTLINE = "#2563eb";
const FLAGGED = "#d97706";
const MIN_WIDTH = 20;
const LINE_HEIGHT = 1.25;
const konvaStyle = { normal: "normal", bold: "bold", italic: "italic", bolditalic: "italic bold" };

/**
 * The background and the boxes. react-konva only positions things: all positions are in pixels of the
 * background, and the stage scale (fit to the window) is a view concern. The canvas always shows the real image.
 */
export function EditorCanvas({
  background,
  boxes,
  labels,
  selectedId,
  flaggedIds,
  onSelect,
  onChange,
}: Props) {
  const holder = useRef<HTMLDivElement>(null);
  const [room, setRoom] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const element = holder.current;
    if (!element) return;
    const measure = () => setRoom({ width: element.clientWidth, height: element.clientHeight });
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const scale = Math.min(room.width / background.width, room.height / background.height);
  const ready = Number.isFinite(scale) && scale > 0;
  const handle = 12 / (ready ? scale : 1);

  return (
    <div ref={holder} className="h-full min-h-[300px] w-full" data-testid="editor-canvas">
      {ready ? (
        <Stage
          width={Math.floor(background.width * scale)}
          height={Math.floor(background.height * scale)}
          scaleX={scale}
          scaleY={scale}
          role="img"
          aria-label={ied.canvasLabel}
          onMouseDown={(e: Konva.KonvaEventObject<MouseEvent>) => {
            if (e.target === e.target.getStage() || e.target.name() === "background")
              onSelect(null);
          }}
        >
          <Layer>
            <KonvaImage name="background" image={background} />
            {boxes.map((box) => {
              const selected = box.id === selectedId;
              const flagged = flaggedIds?.has(box.id) === true;
              const height = box.fontSize * LINE_HEIGHT * box.maxLines;
              return (
                <Group
                  key={box.id}
                  x={box.x}
                  y={box.y}
                  draggable
                  onMouseDown={() => onSelect(box.id)}
                  onTap={() => onSelect(box.id)}
                  onDragEnd={(e: Konva.KonvaEventObject<DragEvent>) =>
                    onChange(box.id, { x: Math.round(e.target.x()), y: Math.round(e.target.y()) })
                  }
                >
                  <Rect
                    width={box.width}
                    height={height}
                    fill="rgba(37,99,235,0.08)"
                    stroke={flagged ? FLAGGED : OUTLINE}
                    strokeWidth={(selected || flagged ? 3 : 1) / scale}
                    dash={selected ? undefined : [6 / scale, 4 / scale]}
                  />
                  <Text
                    text={labelFor(box.field, labels)}
                    width={box.width}
                    height={height}
                    fontSize={box.fontSize}
                    fontFamily={box.fontFamily}
                    fontStyle={konvaStyle[box.style]}
                    fill={box.color}
                    align={box.align}
                    lineHeight={LINE_HEIGHT}
                    wrap={box.overflow === "wrap" && box.maxLines > 1 ? "word" : "none"}
                    ellipsis
                    listening={false}
                  />
                  {selected ? (
                    <Rect
                      name="resize"
                      x={box.width - handle / 2}
                      y={height / 2 - handle}
                      width={handle}
                      height={handle * 2}
                      fill={OUTLINE}
                      draggable
                      onDragStart={(e: Konva.KonvaEventObject<DragEvent>) => {
                        e.cancelBubble = true;
                      }}
                      onDragMove={(e: Konva.KonvaEventObject<DragEvent>) => {
                        e.cancelBubble = true;
                        const width = Math.max(MIN_WIDTH, Math.round(e.target.x() + handle / 2));
                        e.target.y(height / 2 - handle);
                        onChange(box.id, { width });
                      }}
                      onDragEnd={(e: Konva.KonvaEventObject<DragEvent>) => {
                        e.cancelBubble = true;
                      }}
                    />
                  ) : null}
                </Group>
              );
            })}
          </Layer>
        </Stage>
      ) : null}
    </div>
  );
}
