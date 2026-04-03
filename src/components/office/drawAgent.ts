import { Graphics, Container, Text, TextStyle } from "pixi.js";

// Universal agent ID — any string from OpenClaw agent registry
export type AgentId = string;

export interface AgentColors {
  skin: number;
  hair: number;
  shirt: number;
  pants: number;
  shoes: number;
  accessory: number;
}

// 10 color palettes — assigned by hash of agentId, so each agent gets a consistent color
const AGENT_PALETTES: AgentColors[] = [
  { skin: 0xf5c6a0, hair: 0x2d3436, shirt: 0xe74c3c, pants: 0x1a1a2e, shoes: 0x111122, accessory: 0xe74c3c },   // red
  { skin: 0xf5c6a0, hair: 0x4a3728, shirt: 0x3498db, pants: 0x1a1a2e, shoes: 0x111122, accessory: 0x3498db },   // blue
  { skin: 0xf0d5b8, hair: 0x4a3728, shirt: 0xe67e22, pants: 0x2d3436, shoes: 0x2d3436, accessory: 0xe67e22 },   // orange
  { skin: 0xf0d5b8, hair: 0x2d3436, shirt: 0x27ae60, pants: 0x1a1a2e, shoes: 0x111122, accessory: 0x27ae60 },   // green
  { skin: 0xf5c6a0, hair: 0x4a3728, shirt: 0xe84393, pants: 0x1a1a2e, shoes: 0x111122, accessory: 0xe84393 },   // pink
  { skin: 0xf0d5b8, hair: 0x2d3436, shirt: 0x636e72, pants: 0x2d3436, shoes: 0x2d3436, accessory: 0x636e72 },   // gray
  { skin: 0xf5c6a0, hair: 0x2d3436, shirt: 0x00b894, pants: 0x1a1a2e, shoes: 0x111122, accessory: 0x00b894 },   // teal
  { skin: 0xf0d5b8, hair: 0x4a3728, shirt: 0x6c5ce7, pants: 0x2d3436, shoes: 0x2d3436, accessory: 0xa29bfe },   // purple
  { skin: 0xf5c6a0, hair: 0x4a3728, shirt: 0xecb00a, pants: 0x1a1a2e, shoes: 0x111122, accessory: 0xecb00a },   // gold
  { skin: 0xf0d5b8, hair: 0x2d3436, shirt: 0xe17055, pants: 0x1a1a2e, shoes: 0x111122, accessory: 0xfdcb6e },   // coral
];

// 8 accessory types assigned by hash
const ACCESSORY_TYPES = ["badge", "chart", "pen", "phone", "target", "camera", "slides", "glass"] as const;

function getAgentColors(agentId: AgentId): AgentColors {
  const hash = agentId.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  return AGENT_PALETTES[hash % AGENT_PALETTES.length];
}

function getAccessoryType(agentId: AgentId): typeof ACCESSORY_TYPES[number] {
  const hash = agentId.split('').reduce((a, c) => a + c.charCodeAt(0) * 7, 0);
  return ACCESSORY_TYPES[hash % ACCESSORY_TYPES.length];
}

const LABEL_STYLE = new TextStyle({
  fontFamily: '"Courier New", monospace',
  fontSize: 14,
  fontWeight: "bold",
  fill: 0xffffff,
  align: "center",
  dropShadow: {
    color: 0x000000,
    blur: 2,
    distance: 1,
    alpha: 0.8,
  },
});

export function createAgentSprite(agentId: AgentId): Container {
  const container = new Container();
  container.label = `agent-${agentId}`;
  const colors = getAgentColors(agentId);
  const body = new Graphics();

  // Shadow
  body.ellipse(10, 30, 8, 3);
  body.fill({ color: 0x000000, alpha: 0.25 });

  // Shoes
  body.rect(4, 26, 5, 3);
  body.fill(colors.shoes);
  body.rect(11, 26, 5, 3);
  body.fill(colors.shoes);

  // Pants
  body.rect(5, 20, 4, 6);
  body.fill(colors.pants);
  body.rect(11, 20, 4, 6);
  body.fill(colors.pants);

  // Shirt
  body.rect(3, 12, 14, 9);
  body.fill(colors.shirt);

  // Arms
  body.rect(0, 13, 3, 7);
  body.fill(colors.shirt);
  body.rect(17, 13, 3, 7);
  body.fill(colors.shirt);

  // Hands
  body.rect(0, 19, 3, 2);
  body.fill(colors.skin);
  body.rect(17, 19, 3, 2);
  body.fill(colors.skin);

  // Neck
  body.rect(8, 10, 4, 3);
  body.fill(colors.skin);

  // Head
  body.roundRect(4, 0, 12, 11, 2);
  body.fill(colors.skin);

  // Hair
  body.rect(4, 0, 12, 4);
  body.fill(colors.hair);
  body.rect(4, 0, 2, 7);
  body.fill(colors.hair);
  body.rect(14, 0, 2, 5);
  body.fill(colors.hair);

  // Eyes
  body.rect(7, 5, 2, 2);
  body.fill(0x2d3436);
  body.rect(11, 5, 2, 2);
  body.fill(0x2d3436);

  // Mouth
  body.rect(9, 8, 3, 1);
  body.fill(0xd63031);

  container.addChild(body);

  const accessory = drawAccessory(agentId, colors);
  container.addChild(accessory);

  container.pivot.set(10, 30);
  return container;
}

function drawAccessory(agentId: AgentId, colors: AgentColors): Graphics {
  const g = new Graphics();
  const type = getAccessoryType(agentId);

  switch (type) {
    case "badge":
      g.rect(6, 14, 8, 6);
      g.fill(colors.accessory);
      g.rect(7, 15, 6, 4);
      g.fill(0xffffff);
      break;
    case "chart":
      g.rect(21, 13, 8, 8);
      g.fill(0x2d3436);
      g.rect(22, 18, 2, 3);
      g.fill(colors.accessory);
      g.rect(25, 16, 2, 5);
      g.fill(colors.accessory);
      break;
    case "pen":
      g.rect(18, 12, 1, 8);
      g.fill(0xdfe6e9);
      g.rect(17, 11, 3, 2);
      g.fill(colors.accessory);
      break;
    case "phone":
      g.rect(21, 12, 6, 10);
      g.fill(0x2d3436);
      g.rect(22, 13, 4, 7);
      g.fill(colors.accessory);
      break;
    case "target":
      g.circle(22, 14, 4);
      g.stroke({ color: colors.accessory, width: 1.5 });
      g.circle(22, 14, 1);
      g.fill(colors.accessory);
      break;
    case "camera":
      g.rect(21, 13, 8, 6);
      g.fill(0x2d3436);
      g.roundRect(23, 14, 4, 4, 2);
      g.fill(colors.accessory);
      g.circle(25, 16, 1);
      g.fill(0x74b9ff);
      break;
    case "slides":
      g.rect(21, 12, 8, 6);
      g.fill(0x2d3436);
      g.rect(22, 13, 6, 4);
      g.fill(colors.accessory);
      g.rect(23, 19, 6, 5);
      g.fill(0x3d3d3d);
      g.rect(24, 20, 4, 3);
      g.fill(colors.accessory);
      break;
    case "glass":
      g.circle(22, 12, 4);
      g.stroke({ color: colors.accessory, width: 1.5 });
      g.rect(24, 15, 3, 3);
      g.fill(colors.accessory);
      break;
  }
  return g;
}

export function createWalkingSprite(agentId: AgentId, frame: 0 | 1): Container {
  const container = new Container();
  container.label = `walk-${agentId}-${frame}`;
  const colors = getAgentColors(agentId);
  const body = new Graphics();

  body.ellipse(10, 30, 8, 3);
  body.fill({ color: 0x000000, alpha: 0.25 });

  if (frame === 0) {
    body.rect(4, 20, 4, 4);
    body.fill(colors.pants);
    body.rect(2, 24, 4, 3);
    body.fill(colors.pants);
    body.rect(1, 26, 5, 3);
    body.fill(colors.shoes);
    body.rect(12, 20, 4, 4);
    body.fill(colors.pants);
    body.rect(14, 24, 4, 3);
    body.fill(colors.pants);
    body.rect(15, 26, 5, 3);
    body.fill(colors.shoes);
  } else {
    body.rect(12, 20, 4, 4);
    body.fill(colors.pants);
    body.rect(14, 24, 4, 3);
    body.fill(colors.pants);
    body.rect(15, 26, 5, 3);
    body.fill(colors.shoes);
    body.rect(4, 20, 4, 4);
    body.fill(colors.pants);
    body.rect(2, 24, 4, 3);
    body.fill(colors.pants);
    body.rect(1, 26, 5, 3);
    body.fill(colors.shoes);
  }

  body.rect(3, 12, 14, 9);
  body.fill(colors.shirt);

  if (frame === 0) {
    body.rect(0, 14, 3, 6);
    body.fill(colors.shirt);
    body.rect(0, 19, 3, 2);
    body.fill(colors.skin);
    body.rect(17, 12, 3, 6);
    body.fill(colors.shirt);
    body.rect(17, 17, 3, 2);
    body.fill(colors.skin);
  } else {
    body.rect(0, 12, 3, 6);
    body.fill(colors.shirt);
    body.rect(0, 17, 3, 2);
    body.fill(colors.skin);
    body.rect(17, 14, 3, 6);
    body.fill(colors.shirt);
    body.rect(17, 19, 3, 2);
    body.fill(colors.skin);
  }

  body.rect(8, 10, 4, 3);
  body.fill(colors.skin);
  body.roundRect(4, 0, 12, 11, 2);
  body.fill(colors.skin);
  body.rect(4, 0, 12, 4);
  body.fill(colors.hair);
  body.rect(4, 0, 2, 7);
  body.fill(colors.hair);
  body.rect(14, 0, 2, 5);
  body.fill(colors.hair);
  body.rect(7, 5, 2, 2);
  body.fill(0x2d3436);
  body.rect(11, 5, 2, 2);
  body.fill(0x2d3436);
  body.rect(9, 8, 3, 1);
  body.fill(0xd63031);

  container.addChild(body);
  container.pivot.set(10, 30);
  return container;
}

export function createStretchSprite(agentId: AgentId): Container {
  const container = new Container();
  container.label = `stretch-${agentId}`;
  const colors = getAgentColors(agentId);
  const body = new Graphics();

  body.ellipse(10, 30, 8, 3);
  body.fill({ color: 0x000000, alpha: 0.25 });
  body.rect(4, 26, 5, 3);
  body.fill(colors.shoes);
  body.rect(11, 26, 5, 3);
  body.fill(colors.shoes);
  body.rect(5, 20, 4, 6);
  body.fill(colors.pants);
  body.rect(11, 20, 4, 6);
  body.fill(colors.pants);
  body.rect(3, 12, 14, 9);
  body.fill(colors.shirt);

  // Arms UP
  body.rect(1, 2, 3, 11);
  body.fill(colors.shirt);
  body.rect(16, 2, 3, 11);
  body.fill(colors.shirt);
  body.rect(1, 0, 3, 3);
  body.fill(colors.skin);
  body.rect(16, 0, 3, 3);
  body.fill(colors.skin);

  body.rect(8, 10, 4, 3);
  body.fill(colors.skin);
  body.roundRect(4, 0, 12, 11, 2);
  body.fill(colors.skin);
  body.rect(4, 0, 12, 4);
  body.fill(colors.hair);
  body.rect(7, 6, 2, 1);
  body.fill(0x2d3436);
  body.rect(11, 6, 2, 1);
  body.fill(0x2d3436);
  body.roundRect(9, 8, 3, 2, 1);
  body.fill(0xd63031);

  container.addChild(body);
  container.pivot.set(10, 30);
  return container;
}

export function createCoolerSprite(agentId: AgentId): Container {
  const container = new Container();
  container.label = `cooler-${agentId}`;
  const colors = getAgentColors(agentId);
  const body = new Graphics();

  body.ellipse(10, 30, 8, 3);
  body.fill({ color: 0x000000, alpha: 0.25 });
  body.rect(4, 26, 5, 3);
  body.fill(colors.shoes);
  body.rect(11, 26, 5, 3);
  body.fill(colors.shoes);
  body.rect(5, 20, 4, 6);
  body.fill(colors.pants);
  body.rect(11, 20, 4, 6);
  body.fill(colors.pants);
  body.rect(3, 12, 14, 9);
  body.fill(colors.shirt);
  body.rect(0, 13, 3, 7);
  body.fill(colors.shirt);
  body.rect(0, 19, 3, 2);
  body.fill(colors.skin);
  body.rect(17, 13, 3, 4);
  body.fill(colors.shirt);
  body.rect(18, 16, 5, 2);
  body.fill(colors.skin);
  body.rect(21, 14, 4, 4);
  body.fill(0xdfe6e9);
  body.rect(22, 14, 2, 3);
  body.fill(0x4dd0e1);
  body.rect(8, 10, 4, 3);
  body.fill(colors.skin);
  body.roundRect(4, 0, 12, 11, 2);
  body.fill(colors.skin);
  body.rect(4, 0, 12, 4);
  body.fill(colors.hair);
  body.rect(7, 5, 2, 2);
  body.fill(0x2d3436);
  body.rect(11, 5, 2, 2);
  body.fill(0x2d3436);
  body.rect(9, 8, 3, 1);
  body.fill(0xd63031);

  container.addChild(body);
  container.pivot.set(10, 30);
  return container;
}

export function createAgentLabel(name: string): Text {
  const label = new Text({ text: name, style: LABEL_STYLE });
  label.anchor.set(0.5, 0);
  return label;
}
