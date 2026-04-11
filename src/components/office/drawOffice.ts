import { Graphics, Container, Text, TextStyle } from "pixi.js";

const ACCENT = 0xecb00a;
const CARD = 0x1a1a1a;
const BORDER = 0x2a2a2a;
const FLOOR_LIGHT = 0x2a2a2a;
const FLOOR_DARK = 0x222222;
const WALL_COLOR = 0x333333;
const WALL_TRIM = ACCENT;
const DESK_TOP = 0x5a3d2b;
const DESK_LEGS = 0x3a2515;
const CHAIR_SEAT = 0x2a2420;
const CHAIR_BACK = 0x2a2420;
const PLANT_POT = 0x8b4513;
const PLANT_GREEN_1 = 0x2d6a4f;
const PLANT_GREEN_2 = 0x40916c;
const PLANT_GREEN_3 = 0x52b788;
const MONITOR_FRAME = 0x1a1a1a;
const MONITOR_SCREEN = 0x0984e3;
const BOOKSHELF = 0x5a3d2b;
const COOLER_BODY = 0xb2ebf2;
const COOLER_TOP = 0x0288d1;
const COOLER_BASE = 0x78909c;
const COUCH_BASE = 0x3a2a20;
const COUCH_CUSHION = 0x4a3a30;
const MEETING_TABLE_COLOR = 0x4a3020;
const COFFEE_TABLE = 0x3a2515;

export const WATER_COOLER_POS = { x: 490, y: 280 };
export const COFFEE_MACHINE_POS = { x: 490, y: 420 };
export const MEETING_TABLE_POS = { x: 250, y: 560 };
export const COUCH_POS = { x: 530, y: 570 };
export const GAMING_AREA_POS = { x: 550, y: 580 };

export interface DeskPosition {
  x: number;
  y: number;
}

// Fixed grid of desk positions — supports up to 12 agents
// Populated dynamically via buildDeskPositions() when agents load
export const DESK_GRID: DeskPosition[] = [
  { x: 150, y: 200 }, { x: 350, y: 200 }, { x: 550, y: 200 }, { x: 750, y: 200 },
  { x: 150, y: 370 }, { x: 350, y: 370 }, { x: 550, y: 370 }, { x: 750, y: 370 },
  { x: 250, y: 520 }, { x: 450, y: 520 }, { x: 650, y: 520 }, { x: 850, y: 520 },
];

// Build a positions map from any list of agent IDs — order determines desk assignment
export function buildDeskPositions(agentIds: string[]): Record<string, DeskPosition> {
  const result: Record<string, DeskPosition> = {};
  agentIds.forEach((id, i) => {
    if (i < DESK_GRID.length) {
      result[id] = DESK_GRID[i];
    }
  });
  return result;
}

// Populated at runtime by PixelOffice component — do not hardcode agent IDs here
export let DESK_POSITIONS: Record<string, DeskPosition> = {};

export const MEETING_SEATS: { x: number; y: number }[] = [
  { x: -40, y: -100 },
  { x: 0,   y: -100 },
  { x: 40,  y: -100 },
  { x: -40, y: 10 },
  { x: 0,   y: 10 },
  { x: 40,  y: 10 },
];

export function createOfficeEnvironment(width: number, height: number): Container {
  const office = new Container();
  office.label = "office-environment";

  office.addChild(drawFloor(width, height));
  office.addChild(drawWalls(width, height));
  office.addChild(drawDecorations(width, height));

  // Draw desks for all registered agents — desk type assigned by position index
  const deskTypes: DeskType[] = ["coordinator", "analyst", "writer", "producer", "analyst", "writer", "producer", "analyst", "writer", "producer", "coordinator", "analyst"];
  DESK_GRID.forEach((pos, i) => {
    office.addChild(drawDesk(pos.x, pos.y, deskTypes[i % deskTypes.length]));
  });

  // Shared furniture
  office.addChild(drawWaterCooler(WATER_COOLER_POS.x, WATER_COOLER_POS.y));
  office.addChild(drawCoffeeMachine(COFFEE_MACHINE_POS.x, COFFEE_MACHINE_POS.y));
  office.addChild(drawCouch(COUCH_POS.x, COUCH_POS.y));
  office.addChild(drawMeetingTable(MEETING_TABLE_POS.x, MEETING_TABLE_POS.y));
  office.addChild(drawCenterRug(450, 300));
  office.addChild(drawAmbientLights());

  return office;
}

function drawZoneDivider(x: number, yStart: number, height: number): Container {
  const container = new Container();
  container.label = "zone-divider";
  const g = new Graphics();

  // Dotted vertical line
  for (let y = yStart; y < yStart + height; y += 12) {
    g.rect(x, y, 2, 6);
    g.fill({ color: 0x444444, alpha: 0.5 });
  }

  // "Pixel Office" label (left zone)
  const labelStyleLeft = new TextStyle({
    fontFamily: '"Courier New", monospace',
    fontSize: 11,
    fontWeight: "bold",
    fill: 0xecb00a,
    align: "center",
  });
  const leftZoneLabel = new Text({ text: "🐱 Pixel Office", style: labelStyleLeft });
  leftZoneLabel.anchor.set(1, 0.5);
  leftZoneLabel.x = x - 8;
  leftZoneLabel.y = yStart + 12;
  container.addChild(leftZoneLabel);

  // Right zone label
  const labelStyleRight = new TextStyle({
    fontFamily: '"Courier New", monospace',
    fontSize: 11,
    fontWeight: "bold",
    fill: 0xe74c3c,
    align: "center",
  });
  const rightLabel = new Text({ text: "⚡ Agents", style: labelStyleRight });
  rightLabel.anchor.set(0, 0.5);
  rightLabel.x = x + 8;
  rightLabel.y = yStart + 12;
  container.addChild(rightLabel);

  container.addChild(g);
  return container;
}

function drawFloor(w: number, h: number): Graphics {
  const g = new Graphics();
  const plankH = 16;
  const plankW = 48;
  for (let y = 0; y < h; y += plankH) {
    const row = y / plankH;
    const offset = (row % 2) * (plankW / 2);
    for (let x = -plankW; x < w + plankW; x += plankW) {
      const px = x + offset;
      const isLight = ((Math.floor(px / plankW) + row) % 2) === 0;
      g.rect(px, y, plankW - 1, plankH - 1);
      g.fill(isLight ? FLOOR_LIGHT : FLOOR_DARK);
    }
  }
  return g;
}

function drawWalls(w: number, h: number): Graphics {
  const g = new Graphics();
  g.rect(0, 0, w, 60);
  g.fill(WALL_COLOR);
  g.rect(0, 57, w, 3);
  g.fill(WALL_TRIM);
  g.rect(0, 0, 3, h);
  g.fill(BORDER);
  g.rect(w - 3, 0, 3, h);
  g.fill(BORDER);
  g.rect(0, h - 3, w, 3);
  g.fill(BORDER);

  drawWindow(g, 100, 10, 80, 40);
  drawWindow(g, 340, 10, 80, 40);
  drawWindow(g, 580, 10, 80, 40);
  drawWindow(g, 800, 10, 80, 40);

  // Whiteboard
  g.rect(700, 8, 80, 44);
  g.fill(BORDER);
  g.rect(702, 10, 76, 40);
  g.fill(0xf0f0f0);
  g.rect(706, 16, 30, 2);
  g.fill(0xe17055);
  g.rect(706, 22, 40, 2);
  g.fill(ACCENT);
  g.rect(706, 28, 20, 2);
  g.fill(0x0984e3);

  // Door
  g.rect(20, 62, 36, 60);
  g.fill(0x3a2515);
  g.rect(22, 64, 32, 56);
  g.fill(DESK_TOP);
  g.circle(48, 94, 2);
  g.fill(ACCENT);

  // Clock
  g.circle(500, 28, 12);
  g.fill(BORDER);
  g.circle(500, 28, 10);
  g.fill(CARD);
  g.circle(500, 28, 8);
  g.fill(0x222222);
  g.rect(500, 21, 1, 3);
  g.fill(0xffffff);
  g.rect(507, 27, 3, 1);
  g.fill(0xffffff);
  g.rect(500, 33, 1, 3);
  g.fill(0xffffff);
  g.rect(492, 27, 3, 1);
  g.fill(0xffffff);
  g.rect(500, 24, 1, 5);
  g.fill(0xffffff);
  g.rect(498, 28, 4, 1);
  g.fill(ACCENT);
  g.circle(500, 28, 1);
  g.fill(ACCENT);

  return g;
}

function drawWindow(g: Graphics, x: number, y: number, w: number, h: number) {
  g.rect(x, y, w, h);
  g.fill(BORDER);
  g.rect(x + 2, y + 2, w - 4, h - 4);
  g.fill(0x1a1510);
  g.rect(x + 2, y + 2, w - 4, h - 4);
  g.fill({ color: 0xffd700, alpha: 0.3 });

  const baseY = y + h - 4;
  const buildings = [
    { bx: x + 6, bw: 8, bh: 14 },
    { bx: x + 16, bw: 6, bh: 20 },
    { bx: x + 24, bw: 10, bh: 10 },
    { bx: x + 36, bw: 7, bh: 18 },
    { bx: x + 45, bw: 10, bh: 12 },
    { bx: x + 57, bw: 6, bh: 22 },
    { bx: x + 65, bw: 9, bh: 15 },
  ];
  for (const b of buildings) {
    g.rect(b.bx, baseY - b.bh, b.bw, b.bh + 2);
    g.fill(0x0a0a0a);
    if (b.bh > 12) {
      g.rect(b.bx + 2, baseY - b.bh + 3, 2, 2);
      g.fill({ color: 0xffd700, alpha: 0.6 });
    }
  }

  const midX = x + w / 2;
  const midY = y + h / 2;
  g.rect(midX - 1, y + 2, 2, h - 4);
  g.fill(BORDER);
  g.rect(x + 2, midY - 1, w - 4, 2);
  g.fill(BORDER);
}

function drawDecorations(w: number, h: number): Graphics {
  const g = new Graphics();

  // Plants in all corners + between desks
  drawLargePlant(g, 66, 100);         // top-left corner
  drawLargePlant(g, w - 30, 560);     // bottom-right corner
  drawLargePlant(g, 66, 560);         // bottom-left corner
  drawLargePlant(g, w - 30, 100);     // top-right corner
  drawMediumPlant(g, 140, 14);        // windowsill left
  drawMediumPlant(g, 580, 14);        // windowsill center
  drawMediumPlant(g, 900, 14);        // windowsill right
  drawMediumPlant(g, 240, 490);       // between desk rows
  drawMediumPlant(g, 790, 490);       // between desks

  // Bookshelf on right wall
  g.rect(w - 55, 70, 45, 80);
  g.fill(BOOKSHELF);
  for (let i = 0; i < 4; i++) {
    g.rect(w - 53, 74 + i * 20, 41, 2);
    g.fill(0x6b4a3a);
    const bookColors = [0xe17055, ACCENT, PLANT_GREEN_2, 0xfdcb6e, 0x6c5ce7];
    for (let j = 0; j < 5; j++) {
      g.rect(w - 51 + j * 8, 78 + i * 20, 6, 16);
      g.fill(bookColors[j % bookColors.length]);
    }
  }

  // Second bookshelf on left wall
  g.rect(10, 170, 45, 80);
  g.fill(BOOKSHELF);
  for (let i = 0; i < 4; i++) {
    g.rect(12, 174 + i * 20, 41, 2);
    g.fill(0x6b4a3a);
    const bookColors = [0x6c5ce7, 0xe17055, 0xfdcb6e, PLANT_GREEN_2, ACCENT];
    for (let j = 0; j < 5; j++) {
      g.rect(14 + j * 8, 178 + i * 20, 6, 16);
      g.fill(bookColors[j % bookColors.length]);
    }
  }

  // Poster / motivational frame on wall
  g.rect(200, 8, 50, 38);
  g.fill(0x2a2a2a);
  g.rect(202, 10, 46, 34);
  g.fill(0x1a1a2e);
  // "⚡" lightning bolt design
  g.rect(216, 16, 4, 8);
  g.fill(ACCENT);
  g.rect(220, 22, 4, 8);
  g.fill(ACCENT);
  g.rect(216, 28, 4, 8);
  g.fill(ACCENT);

  // Rug under couch area
  g.roundRect(460, 530, 140, 60, 4);
  g.fill({ color: 0x3a1a5a, alpha: 0.2 });
  g.roundRect(464, 534, 132, 52, 3);
  g.stroke({ color: 0x6c5ce7, width: 1, alpha: 0.15 });

  // Floor lamp near couch
  g.rect(445, 530, 3, 40);
  g.fill(0x2d2d2d);
  g.ellipse(446, 528, 8, 4);
  g.fill(0x3a3a3a);
  g.ellipse(446, 528, 6, 3);
  g.fill({ color: ACCENT, alpha: 0.4 });

  // Trash can near door
  g.rect(68, 110, 12, 14);
  g.fill(0x3a3a3a);
  g.rect(66, 108, 16, 3);
  g.fill(0x4a4a4a);

  // Baseboards
  g.rect(3, h - 6, w - 6, 3);
  g.fill(0x3a3020);

  return g;
}

function drawLargePlant(g: Graphics, x: number, y: number) {
  g.rect(x - 8, y, 16, 14);
  g.fill(PLANT_POT);
  g.rect(x - 10, y - 2, 20, 4);
  g.fill(PLANT_POT);
  g.rect(x - 1, y - 20, 2, 20);
  g.fill(0x2d5a3f);
  g.ellipse(x, y - 26, 8, 12);
  g.fill(PLANT_GREEN_1);
  g.ellipse(x - 6, y - 20, 5, 8);
  g.fill(PLANT_GREEN_2);
  g.ellipse(x + 6, y - 20, 5, 8);
  g.fill(PLANT_GREEN_3);
}

function drawMediumPlant(g: Graphics, x: number, y: number) {
  g.rect(x - 5, y + 26, 10, 8);
  g.fill(PLANT_POT);
  g.rect(x - 6, y + 24, 12, 3);
  g.fill(PLANT_POT);
  g.ellipse(x, y + 18, 6, 8);
  g.fill(PLANT_GREEN_2);
  g.ellipse(x - 4, y + 20, 4, 6);
  g.fill(PLANT_GREEN_1);
  g.ellipse(x + 4, y + 20, 4, 6);
  g.fill(PLANT_GREEN_3);
}

type DeskType = "coordinator" | "analyst" | "writer" | "producer";

function drawDesk(x: number, y: number, type: DeskType): Container {
  const container = new Container();
  container.label = `desk-${type}`;
  const g = new Graphics();

  g.rect(x - 30, y + 6, 60, 20);
  g.fill(DESK_TOP);
  g.rect(x - 30, y + 24, 60, 3);
  g.fill(0x4a3020);
  g.rect(x - 28, y + 26, 3, 10);
  g.fill(DESK_LEGS);
  g.rect(x + 25, y + 26, 3, 10);
  g.fill(DESK_LEGS);
  g.rect(x - 8, y + 36, 16, 10);
  g.fill(CHAIR_SEAT);
  g.rect(x - 10, y + 28, 20, 10);
  g.fill(CHAIR_BACK);

  container.addChild(g);

  const equip = new Graphics();
  switch (type) {
    case "coordinator":
      drawMonitor(equip, x - 10, y);
      equip.rect(x + 10, y + 10, 12, 8);
      equip.fill(0xdfe6e9);
      break;
    case "analyst":
      drawMonitor(equip, x - 18, y);
      drawMonitor(equip, x + 2, y);
      break;
    case "writer":
      equip.rect(x - 14, y + 8, 16, 12);
      equip.fill(0xffeaa7);
      for (let i = 0; i < 3; i++) {
        equip.rect(x - 13, y + 9 + i * 4, 14, 1);
        equip.fill(0x636e72);
      }
      equip.rect(x + 8, y + 10, 6, 6);
      equip.fill(CARD);
      equip.rect(x + 9, y + 11, 4, 3);
      equip.fill(0x0984e3);
      break;
    case "producer":
      drawMonitor(equip, x - 14, y);
      equip.rect(x + 8, y + 8, 14, 10);
      equip.fill(CARD);
      equip.rect(x + 8, y + 6, 14, 4);
      equip.fill(0xdfe6e9);
      break;
  }
  container.addChild(equip);
  return container;
}

function drawMonitor(g: Graphics, x: number, y: number) {
  g.rect(x + 6, y + 6, 4, 4);
  g.fill(MONITOR_FRAME);
  g.rect(x, y - 6, 16, 14);
  g.fill(MONITOR_FRAME);
  g.rect(x + 1, y - 5, 14, 12);
  g.fill(MONITOR_SCREEN);
  g.rect(x + 2, y - 3, 8, 1);
  g.fill({ color: 0xffffff, alpha: 0.5 });
  g.rect(x + 2, y - 1, 10, 1);
  g.fill({ color: 0xffffff, alpha: 0.3 });
  g.rect(x + 2, y + 1, 6, 1);
  g.fill({ color: ACCENT, alpha: 0.5 });
}

function drawWaterCooler(x: number, y: number): Container {
  const container = new Container();
  container.label = "water-cooler";
  const g = new Graphics();
  g.rect(x - 8, y + 10, 16, 6);
  g.fill(COOLER_BASE);
  g.rect(x - 10, y - 14, 20, 24);
  g.fill(COOLER_BODY);
  g.rect(x - 8, y - 10, 16, 16);
  g.fill(0xe0f7fa);
  g.roundRect(x - 6, y - 28, 12, 16, 3);
  g.fill(0x4dd0e1);
  g.roundRect(x - 4, y - 30, 8, 6, 2);
  g.fill(COOLER_TOP);
  g.rect(x - 2, y + 2, 4, 4);
  g.fill(0x455a64);
  container.addChild(g);
  return container;
}

function drawCouch(x: number, y: number): Container {
  const container = new Container();
  container.label = "couch";
  const g = new Graphics();
  g.roundRect(x - 50, y, 100, 20, 3);
  g.fill(COUCH_BASE);
  g.roundRect(x - 48, y + 2, 46, 16, 2);
  g.fill(COUCH_CUSHION);
  g.roundRect(x + 2, y + 2, 46, 16, 2);
  g.fill(COUCH_CUSHION);
  g.roundRect(x - 50, y - 14, 100, 16, 3);
  g.fill(COUCH_BASE);
  g.roundRect(x - 48, y - 12, 30, 12, 2);
  g.fill(COUCH_CUSHION);
  g.roundRect(x - 16, y - 12, 30, 12, 2);
  g.fill(COUCH_CUSHION);
  g.roundRect(x + 16, y - 12, 32, 12, 2);
  g.fill(COUCH_CUSHION);
  g.roundRect(x - 54, y - 10, 6, 28, 2);
  g.fill(COUCH_BASE);
  g.roundRect(x + 48, y - 10, 6, 28, 2);
  g.fill(COUCH_BASE);
  container.addChild(g);
  return container;
}

function drawMeetingTable(x: number, y: number): Container {
  const container = new Container();
  container.label = "meeting-table";
  const g = new Graphics();
  g.roundRect(x - 60, y - 40, 120, 80, 4);
  g.fill(MEETING_TABLE_COLOR);
  g.roundRect(x - 58, y - 38, 116, 76, 3);
  g.fill(0x5a3a28);
  g.roundRect(x - 54, y - 34, 108, 68, 2);
  g.fill(MEETING_TABLE_COLOR);

  for (let i = -1; i <= 1; i++) {
    const cx = x + i * 40;
    g.rect(cx - 8, y - 52, 16, 10);
    g.fill(CHAIR_SEAT);
    g.rect(cx - 10, y - 60, 20, 10);
    g.fill(CHAIR_BACK);
  }
  for (let i = -1; i <= 1; i++) {
    const cx = x + i * 40;
    g.rect(cx - 8, y + 42, 16, 10);
    g.fill(CHAIR_SEAT);
    g.rect(cx - 10, y + 50, 20, 10);
    g.fill(CHAIR_BACK);
  }
  container.addChild(g);
  return container;
}

function drawCoffeeMachine(x: number, y: number): Container {
  const container = new Container();
  container.label = "coffee-machine";
  const g = new Graphics();

  // Table/counter
  g.rect(x - 16, y + 10, 32, 6);
  g.fill(DESK_TOP);
  g.rect(x - 14, y + 16, 3, 8);
  g.fill(DESK_LEGS);
  g.rect(x + 11, y + 16, 3, 8);
  g.fill(DESK_LEGS);

  // Machine body
  g.roundRect(x - 12, y - 16, 24, 26, 2);
  g.fill(0x2d2d2d);
  g.roundRect(x - 10, y - 14, 20, 14, 1);
  g.fill(0x1a1a1a);

  // Screen / display
  g.rect(x - 6, y - 12, 12, 8);
  g.fill(0x0984e3);
  g.rect(x - 4, y - 10, 8, 1);
  g.fill({ color: 0xffffff, alpha: 0.4 });

  // Buttons
  g.circle(x - 4, y + 2, 2);
  g.fill(0x00b894);
  g.circle(x + 4, y + 2, 2);
  g.fill(0xe17055);

  // Nozzle
  g.rect(x - 2, y + 4, 4, 4);
  g.fill(0x636e72);

  // Cup
  g.rect(x - 4, y + 8, 8, 5);
  g.fill(0xdfe6e9);
  g.rect(x - 3, y + 8, 6, 3);
  g.fill(0x8b6914);

  // Steam
  g.rect(x - 1, y - 18, 1, 3);
  g.fill({ color: 0xdfe6e9, alpha: 0.3 });
  g.rect(x + 2, y - 20, 1, 4);
  g.fill({ color: 0xdfe6e9, alpha: 0.2 });

  // Label
  const labelStyle = new TextStyle({
    fontFamily: '"Courier New", monospace',
    fontSize: 7,
    fill: 0x636e72,
  });
  const label = new Text({ text: "☕ Coffee", style: labelStyle });
  label.anchor.set(0.5, 0);
  label.x = x;
  label.y = y + 26;
  container.addChild(g);
  container.addChild(label);
  return container;
}

function drawCenterRug(cx: number, cy: number): Container {
  const container = new Container();
  container.label = "center-rug";
  const g = new Graphics();
  g.roundRect(cx - 100, cy - 70, 200, 140, 6);
  g.fill({ color: 0x8b2020, alpha: 0.25 });
  g.roundRect(cx - 94, cy - 64, 188, 128, 4);
  g.stroke({ color: ACCENT, width: 1.5, alpha: 0.2 });
  g.roundRect(cx - 90, cy - 60, 180, 120, 4);
  g.fill({ color: 0x6b1a1a, alpha: 0.18 });
  container.addChild(g);
  return container;
}

function drawAmbientLights(): Graphics {
  const g = new Graphics();
  const allPositions = Object.values(DESK_POSITIONS);
  for (const pos of allPositions) {
    g.ellipse(pos.x, pos.y, 50, 25);
    g.fill({ color: ACCENT, alpha: 0.06 });
    g.rect(pos.x - 1, 60, 2, 20);
    g.fill(BORDER);
    g.rect(pos.x - 8, 78, 16, 6);
    g.fill(0x2a2a2a);
  }
  g.ellipse(WATER_COOLER_POS.x, WATER_COOLER_POS.y, 50, 25);
  g.fill({ color: ACCENT, alpha: 0.05 });
  g.ellipse(MEETING_TABLE_POS.x, MEETING_TABLE_POS.y, 60, 30);
  g.fill({ color: ACCENT, alpha: 0.05 });
  return g;
}
