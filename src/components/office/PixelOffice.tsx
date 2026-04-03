"use client";

import { useRef, useEffect, useCallback, useImperativeHandle, forwardRef } from "react";
import { Application, Container, Graphics, Text, TextStyle } from "pixi.js";
import {
  createAgentSprite,
  createAgentLabel,
  createWalkingSprite,
  createStretchSprite,
  createCoolerSprite,
  type AgentId,
} from "./drawAgent";
import { createOfficeEnvironment, buildDeskPositions, DESK_POSITIONS, WATER_COOLER_POS, COFFEE_MACHINE_POS, MEETING_TABLE_POS, MEETING_SEATS, GAMING_AREA_POS } from "./drawOffice";
import type { Agent, AgentStatus } from "@/lib/utils/types";

interface PixelOfficeProps {
  agents: Agent[];
  onAgentClick?: (agentId: string) => void;
  className?: string;
}

export interface PixelOfficeHandle {
  triggerAllMeeting: () => void;
}

type MovementState =
  | "SITTING"
  | "WALKING_TO"
  | "AT_COOLER"
  | "INTERACTING"
  | "WALKING_BACK"
  | "STRETCHING"
  | "LOOKING_AROUND"
  | "AT_MEETING";

interface AgentNode {
  container: Container;
  sprite: Container;
  walkFrames: [Container, Container];
  stretchSprite: Container;
  coolerSprite: Container;
  label: Text;
  statusBubble: Container;
  particles: Container;
  glowOverlay: Graphics;
  apiStatus: AgentStatus;
  moveState: MovementState;
  animTime: number;
  particleTimer: number;
  homeX: number;
  homeY: number;
  targetX: number;
  targetY: number;
  walkFrame: 0 | 1;
  walkFrameTimer: number;
  idleTimer: number;
  idleInterval: number;
  stateTimer: number;
  stateDuration: number;
  interactTarget: string | null;
  lookDir: -1 | 0 | 1;
  lookTimer: number;
  agentId: AgentId;
}

const CANVAS_W = 1060;
const CANVAS_H = 640;
const BG_COLOR = 0x0f0f0f;
const WALK_SPEED = 60;
const WALK_FRAME_INTERVAL = 0.25;

const STATUS_COLORS: Record<string, number> = {
  idle: 0x636e72,
  working: 0x00b894,
  thinking: 0xfdcb6e,
  busy: 0xe17055,
  offline: 0x555555,
};

const BUBBLE_STYLE = new TextStyle({
  fontFamily: '"Courier New", monospace',
  fontSize: 11,
  fontWeight: "bold",
  fill: 0xffffff,
  wordWrap: true,
  wordWrapWidth: 130,
});

const CHAT_BUBBLE_STYLE = new TextStyle({
  fontFamily: '"Courier New", monospace',
  fontSize: 14,
  fill: 0xffffff,
});

// Derive display name from agent metadata or id
function getAgentDisplayName(agent: Agent): string {
  // Use agent.name if available
  if ((agent as any).name) return (agent as any).name;
  // Otherwise derive from last segment of id
  const parts = agent.id.split("-");
  const last = parts[parts.length - 1];
  return last.charAt(0).toUpperCase() + last.slice(1);
}

function randomRange(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function showSpriteVariant(node: AgentNode, which: "sit" | "walk" | "stretch" | "cooler") {
  node.sprite.visible = which === "sit";
  node.walkFrames[0].visible = which === "walk" && node.walkFrame === 0;
  node.walkFrames[1].visible = which === "walk" && node.walkFrame === 1;
  node.stretchSprite.visible = which === "stretch";
  node.coolerSprite.visible = which === "cooler";
}

export const PixelOffice = forwardRef<PixelOfficeHandle, PixelOfficeProps>(
  function PixelOffice({ agents, onAgentClick, className }, ref) {
    const containerRef = useRef<HTMLDivElement>(null);
    const appRef = useRef<Application | null>(null);
    const nodesRef = useRef<Map<string, AgentNode>>(new Map());
    const destroyedRef = useRef(false);

    useImperativeHandle(ref, () => ({
      triggerAllMeeting() {
        const seats = MEETING_SEATS;
        let i = 0;
        for (const [, node] of nodesRef.current) {
          const seat = seats[i % seats.length];
          node.interactTarget = "__meeting__";
          node.targetX = MEETING_TABLE_POS.x + seat.x;
          node.targetY = MEETING_TABLE_POS.y + seat.y;
          transitionTo(node, "WALKING_TO");
          i++;
        }
      },
    }));

    useEffect(() => {
      if (!containerRef.current) return;
      destroyedRef.current = false;
      const el = containerRef.current;
      const app = new Application();
      appRef.current = app;
      let rafId: number;

      (async () => {
        try {
          await app.init({
            width: CANVAS_W,
            height: CANVAS_H,
            backgroundColor: BG_COLOR,
            antialias: false,
            resolution: 1,
            autoDensity: true,
            preference: "webgl",
          });

          if (destroyedRef.current) { app.destroy(true); return; }

          app.canvas.style.width = "100%";
          app.canvas.style.height = "100%";
          app.canvas.style.objectFit = "contain";
          app.canvas.style.imageRendering = "pixelated";
          el.appendChild(app.canvas);

          const environment = createOfficeEnvironment(CANVAS_W, CANVAS_H);
          app.stage.addChild(environment);

          const agentsLayer = new Container();
          agentsLayer.label = "agents-layer";
          agentsLayer.sortableChildren = true;
          app.stage.addChild(agentsLayer);

          let lastTime = performance.now();
          let meetingTimer = randomRange(120, 240);
          let meetingActive = false;
          let meetingDuration = 0;

          function animate() {
            if (destroyedRef.current) return;
            const now = performance.now();
            const dt = (now - lastTime) / 1000;
            lastTime = now;

            meetingTimer -= dt;
            if (meetingActive) {
              meetingDuration -= dt;
              if (meetingDuration <= 0) {
                for (const [, node] of nodesRef.current) {
                  if (node.moveState === "AT_MEETING") {
                    transitionTo(node, "WALKING_BACK");
                  }
                }
                meetingActive = false;
                meetingTimer = randomRange(180, 360);
              }
            } else if (meetingTimer <= 0) {
              const idleAgents = Array.from(nodesRef.current.entries())
                .filter(([, n]) => n.apiStatus === "idle" && n.moveState === "SITTING");
              if (idleAgents.length >= 2) {
                const count = Math.min(idleAgents.length, 2 + Math.floor(Math.random() * 2));
                const shuffled = idleAgents.sort(() => Math.random() - 0.5).slice(0, count);
                const seats = MEETING_SEATS;
                shuffled.forEach(([, node], idx) => {
                  const seat = seats[idx % seats.length];
                  node.interactTarget = "__meeting__";
                  node.targetX = MEETING_TABLE_POS.x + seat.x;
                  node.targetY = MEETING_TABLE_POS.y + seat.y;
                  transitionTo(node, "WALKING_TO");
                });
                meetingActive = true;
                meetingDuration = randomRange(20, 40);
              } else {
                meetingTimer = randomRange(60, 120);
              }
            }

            for (const [, node] of nodesRef.current) {
              node.animTime += dt;
              updateMovement(node, dt, nodesRef.current);
              animateAgent(node, dt);
              node.container.zIndex = node.container.y;
            }
            rafId = requestAnimationFrame(animate);
          }
          rafId = requestAnimationFrame(animate);
        } catch (err) {
          console.error("Pixi init failed:", err);
          if (el) {
            el.innerHTML = `<div style="color:#ff6b6b;padding:20px;font-family:monospace;font-size:12px;background:#1a1a2e;border:1px solid #ff6b6b;border-radius:4px;margin:20px">
              <b>⚠️ Pixi.js init error:</b><br>${String(err)}<br><br>
              <small>Agents loaded: check /api/agents</small>
            </div>`;
          }
        }
      })();

      return () => {
        destroyedRef.current = true;
        cancelAnimationFrame(rafId!);
        nodesRef.current.clear();
        try { app.destroy(true); } catch (_) {}
        appRef.current = null;
      };
    }, []);

    const syncAgents = useCallback(
      (agentList: Agent[]) => {
        const app = appRef.current;
        if (!app || destroyedRef.current) return;

        const agentsLayer = app.stage.children.find(
          (c) => c.label === "agents-layer",
        ) as Container | undefined;
        if (!agentsLayer) return;

        // Build desk positions dynamically from current agent list
        const positions = buildDeskPositions(agentList.map((a) => a.id));
        // Mutate the exported DESK_POSITIONS so drawOffice ambient lights stay in sync
        Object.keys(DESK_POSITIONS).forEach((k) => delete DESK_POSITIONS[k]);
        Object.assign(DESK_POSITIONS, positions);

        const validIds = new Set(agentList.map((a) => a.id));

        for (const [id, node] of nodesRef.current) {
          if (!validIds.has(id)) {
            agentsLayer.removeChild(node.container);
            nodesRef.current.delete(id);
          }
        }

        for (const agent of agentList) {
          const pos = DESK_POSITIONS[agent.id];
          if (!pos) continue;

          let node = nodesRef.current.get(agent.id);

          if (!node) {
            node = createAgentNode(agent.id as AgentId, pos.x, pos.y, onAgentClick);
            // Update label with the display name derived from agent metadata
            node.label.text = getAgentDisplayName(agent);
            nodesRef.current.set(agent.id, node);
            agentsLayer.addChild(node.container);
            const initStatus = (agent.currentStatus || "idle") as AgentStatus;
            node.apiStatus = initStatus;
            updateStatusBubble(node, initStatus, agent);
          }

          const status = (agent.currentStatus || "idle") as AgentStatus;
          if (node.apiStatus !== status) {
            const oldStatus = node.apiStatus;
            node.apiStatus = status;
            node.animTime = 0;

            if (status !== "idle" && status !== "offline") {
              if (node.moveState !== "SITTING") {
                node.container.x = node.homeX;
                node.container.y = node.homeY;
                transitionTo(node, "SITTING");
              }
            }

            if (status === "idle" && oldStatus !== "idle") {
              node.idleTimer = 0;
              node.idleInterval = randomRange(45, 90);
            }

            updateStatusBubble(node, status, agent);
          } else {
            updateStatusBubble(node, status, agent);
          }

          // Update context bar
          const pct = (agent as any).contextPct || 0;
          const ctxBar = node.container.children.find(c => c.label === "context-bar");
          if (ctxBar) {
            const fill = (ctxBar as Container).children.find(c => c.label === "bar-fill") as Graphics | undefined;
            if (fill) {
              fill.clear();
              const barW = Math.max(1, Math.round(38 * pct / 100));
              const color = pct > 80 ? 0xff1744 : pct > 50 ? 0xfdcb6e : 0x00b894;
              fill.roundRect(-19, 0.5, barW, 3, 1);
              fill.fill(color);
            }
          }
        }
      },
      [onAgentClick],
    );

    useEffect(() => {
      syncAgents(agents);
    }, [agents, syncAgents]);

    return (
      <div
        ref={containerRef}
        className={`relative overflow-hidden bg-[#0a0a12] ${className ?? ""}`}
        style={{ aspectRatio: `${CANVAS_W}/${CANVAS_H}` }}
      />
    );
  },
);

function createAgentNode(
  agentId: AgentId,
  x: number,
  y: number,
  onClick?: (id: string) => void,
): AgentNode {
  const container = new Container();
  container.label = `agent-node-${agentId}`;
  container.x = x;
  container.y = y;
  container.scale.set(1.8);

  const glowOverlay = new Graphics();
  glowOverlay.circle(0, 0, 20);
  glowOverlay.fill({ color: 0xffffff, alpha: 0 });
  glowOverlay.y = -10;
  container.addChild(glowOverlay);

  const sprite = createAgentSprite(agentId);
  sprite.y = -10;
  container.addChild(sprite);

  const walk0 = createWalkingSprite(agentId, 0);
  walk0.y = -10;
  walk0.visible = false;
  container.addChild(walk0);

  const walk1 = createWalkingSprite(agentId, 1);
  walk1.y = -10;
  walk1.visible = false;
  container.addChild(walk1);

  const stretchSprite = createStretchSprite(agentId);
  stretchSprite.y = -10;
  stretchSprite.visible = false;
  container.addChild(stretchSprite);

  const coolerSprite = createCoolerSprite(agentId);
  coolerSprite.y = -10;
  coolerSprite.visible = false;
  container.addChild(coolerSprite);

  // Label placeholder — overwritten in syncAgents with getAgentDisplayName
  const label = createAgentLabel(agentId);
  label.y = -50;
  label.scale.set(0.5);
  container.addChild(label);

  // Context bar
  const contextBar = new Container();
  contextBar.label = "context-bar";
  contextBar.y = -43;
  contextBar.scale.set(0.5);
  const barBg = new Graphics();
  barBg.roundRect(-20, 0, 40, 4, 2);
  barBg.fill({ color: 0x1a1a2e, alpha: 0.8 });
  contextBar.addChild(barBg);
  const barFill = new Graphics();
  barFill.label = "bar-fill";
  barFill.roundRect(-19, 0.5, 1, 3, 1);
  barFill.fill(0x00b894);
  contextBar.addChild(barFill);
  container.addChild(contextBar);

  const statusBubble = new Container();
  statusBubble.label = "status-bubble";
  statusBubble.visible = false;
  statusBubble.y = -60;
  statusBubble.scale.set(0.45);
  container.addChild(statusBubble);

  const particles = new Container();
  particles.label = "particles";
  container.addChild(particles);

  container.eventMode = "static";
  container.cursor = "pointer";
  container.hitArea = {
    contains: (px: number, py: number) =>
      px >= -20 && px <= 20 && py >= -55 && py <= 15,
  };

  container.on("pointerover", () => {
    glowOverlay.clear();
    glowOverlay.circle(0, 0, 22);
    glowOverlay.fill({ color: 0xecb00a, alpha: 0.2 });
  });

  container.on("pointerout", () => {
    glowOverlay.clear();
    glowOverlay.circle(0, 0, 20);
    glowOverlay.fill({ color: 0xffffff, alpha: 0 });
  });

  if (onClick) {
    container.on("pointertap", () => onClick(agentId));
  }

  return {
    container,
    sprite,
    walkFrames: [walk0, walk1],
    stretchSprite,
    coolerSprite,
    label,
    statusBubble,
    particles,
    glowOverlay,
    agentId,
    apiStatus: "idle",
    moveState: "SITTING",
    animTime: Math.random() * 10,
    particleTimer: 0,
    homeX: x,
    homeY: y,
    targetX: x,
    targetY: y,
    walkFrame: 0,
    walkFrameTimer: 0,
    idleTimer: randomRange(5, 20),
    idleInterval: randomRange(45, 90),
    stateTimer: 0,
    stateDuration: 0,
    interactTarget: null,
    lookDir: 0,
    lookTimer: 0,
  };
}

function transitionTo(node: AgentNode, newState: MovementState) {
  node.moveState = newState;
  node.stateTimer = 0;

  switch (newState) {
    case "SITTING":
      node.container.x = node.homeX;
      node.container.y = node.homeY;
      showSpriteVariant(node, "sit");
      node.sprite.rotation = 0;
      node.interactTarget = null;
      node.idleTimer = 0;
      node.idleInterval = randomRange(45, 90);
      hideChatBubble(node);
      hideMeetingBubble(node);
      break;
    case "WALKING_TO":
    case "WALKING_BACK":
      showSpriteVariant(node, "walk");
      node.walkFrameTimer = 0;
      break;
    case "AT_COOLER":
      showSpriteVariant(node, "cooler");
      node.stateDuration = randomRange(3, 6);
      break;
    case "INTERACTING":
      showSpriteVariant(node, "sit");
      node.stateDuration = randomRange(3, 6);
      break;
    case "STRETCHING":
      showSpriteVariant(node, "stretch");
      node.stateDuration = randomRange(2, 3.5);
      break;
    case "LOOKING_AROUND":
      showSpriteVariant(node, "sit");
      node.stateDuration = randomRange(2, 4);
      node.lookDir = Math.random() < 0.5 ? -1 : 1;
      node.lookTimer = 0;
      break;
    case "AT_MEETING":
      showSpriteVariant(node, "sit");
      node.stateDuration = randomRange(8, 12);
      break;
  }
}

function updateMovement(node: AgentNode, dt: number, allNodes: Map<string, AgentNode>) {
  if (node.apiStatus === "working" || node.apiStatus === "thinking" || node.apiStatus === "busy") {
    if (node.moveState !== "SITTING") {
      node.container.x = node.homeX;
      node.container.y = node.homeY;
      transitionTo(node, "SITTING");
    }
    return;
  }

  switch (node.moveState) {
    case "SITTING": {
      if (node.apiStatus !== "idle") return;
      node.idleTimer += dt;
      if (node.idleTimer >= node.idleInterval) {
        node.idleTimer = 0;
        const roll = Math.random();
        if (roll < 0.25) {
          // Go to cooler
          node.interactTarget = null;
          node.targetX = WATER_COOLER_POS.x + randomRange(-15, 15);
          node.targetY = WATER_COOLER_POS.y + randomRange(-5, 10);
          transitionTo(node, "WALKING_TO");
        } else if (roll < 0.40) {
          // Go to coffee machine
          node.interactTarget = null;
          node.targetX = COFFEE_MACHINE_POS.x + randomRange(-15, 15);
          node.targetY = COFFEE_MACHINE_POS.y + randomRange(-5, 10);
          transitionTo(node, "WALKING_TO");
        } else if (roll < 0.55) {
          // Go chat with another agent
          const others = Array.from(allNodes.entries())
            .filter(([id, n]) => id !== node.agentId && n.moveState === "SITTING");
          if (others.length > 0) {
            const pick = others[Math.floor(Math.random() * others.length)];
            node.interactTarget = pick[0];
            node.targetX = pick[1].homeX + randomRange(-10, 10);
            node.targetY = pick[1].homeY + 15;
            transitionTo(node, "WALKING_TO");
          } else {
            transitionTo(node, "STRETCHING");
          }
        } else if (roll < 0.75) {
          transitionTo(node, "STRETCHING");
        } else {
          transitionTo(node, "LOOKING_AROUND");
        }
      }
      break;
    }

    case "WALKING_TO":
    case "WALKING_BACK": {
      const tx = node.moveState === "WALKING_BACK" ? node.homeX : node.targetX;
      const ty = node.moveState === "WALKING_BACK" ? node.homeY : node.targetY;
      const dx = tx - node.container.x;
      const dy = ty - node.container.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < 2) {
        node.container.x = tx;
        node.container.y = ty;
        if (node.moveState === "WALKING_BACK") {
          transitionTo(node, "SITTING");
        } else if (node.interactTarget === "__meeting__") {
          transitionTo(node, "AT_MEETING");
          showMeetingBubble(node);
        } else if (node.interactTarget) {
          transitionTo(node, "INTERACTING");
          showChatBubble(node);
          const targetNode = allNodes.get(node.interactTarget);
          if (targetNode) showChatBubble(targetNode);
        } else {
          transitionTo(node, "AT_COOLER");
        }
      } else {
        const step = WALK_SPEED * dt;
        const ratio = Math.min(step / dist, 1);
        node.container.x += dx * ratio;
        node.container.y += dy * ratio;

        node.walkFrameTimer += dt;
        if (node.walkFrameTimer >= WALK_FRAME_INTERVAL) {
          node.walkFrameTimer = 0;
          node.walkFrame = node.walkFrame === 0 ? 1 : 0;
        }
        showSpriteVariant(node, "walk");

        const bounce = Math.sin(node.animTime * 10) * 1.5;
        node.walkFrames[0].y = -10 + bounce;
        node.walkFrames[1].y = -10 + bounce;

        const scaleX = dx < 0 ? -1 : 1;
        node.walkFrames[0].scale.x = scaleX;
        node.walkFrames[1].scale.x = scaleX;
      }
      break;
    }

    case "AT_COOLER":
    case "INTERACTING":
    case "AT_MEETING": {
      node.stateTimer += dt;
      if (node.stateTimer >= node.stateDuration) {
        if (node.moveState === "INTERACTING" && node.interactTarget) {
          const targetNode = allNodes.get(node.interactTarget);
          if (targetNode) hideChatBubble(targetNode);
        }
        transitionTo(node, "WALKING_BACK");
      }
      break;
    }

    case "STRETCHING": {
      node.stateTimer += dt;
      node.stretchSprite.y = -10 + Math.sin(node.stateTimer * 2) * 1.5;
      if (node.stateTimer >= node.stateDuration) {
        transitionTo(node, "SITTING");
      }
      break;
    }

    case "LOOKING_AROUND": {
      node.stateTimer += dt;
      node.lookTimer += dt;
      if (node.lookTimer > 1) {
        node.lookTimer = 0;
        node.lookDir = node.lookDir === -1 ? 1 : -1;
      }
      node.sprite.x = node.lookDir * 1.5;
      if (node.stateTimer >= node.stateDuration) {
        node.sprite.x = 0;
        transitionTo(node, "SITTING");
      }
      break;
    }
  }
}

function showChatBubble(node: AgentNode) {
  if (node.container.children.find(c => c.label === "chat-bubble")) return;
  const chatBubble = new Container();
  chatBubble.label = "chat-bubble";
  chatBubble.y = -55;
  chatBubble.scale.set(0.45);
  const bg = new Graphics();
  bg.roundRect(-14, -10, 28, 20, 4);
  bg.fill(0x6c5ce7);
  bg.moveTo(-3, 10);
  bg.lineTo(0, 14);
  bg.lineTo(3, 10);
  bg.closePath();
  bg.fill(0x6c5ce7);
  chatBubble.addChild(bg);
  const emoji = new Text({ text: "💬", style: CHAT_BUBBLE_STYLE });
  emoji.anchor.set(0.5, 0.5);
  chatBubble.addChild(emoji);
  node.container.addChild(chatBubble);
}

function hideChatBubble(node: AgentNode) {
  const b = node.container.children.find(c => c.label === "chat-bubble");
  if (b) { node.container.removeChild(b); b.destroy(); }
}

function showMeetingBubble(node: AgentNode) {
  if (node.container.children.find(c => c.label === "meeting-bubble")) return;
  const bubble = new Container();
  bubble.label = "meeting-bubble";
  bubble.y = -60;
  bubble.scale.set(0.45);
  const bg = new Graphics();
  bg.roundRect(-30, -10, 60, 20, 4);
  bg.fill(0xecb00a);
  bg.moveTo(-3, 10);
  bg.lineTo(0, 14);
  bg.lineTo(3, 10);
  bg.closePath();
  bg.fill(0xecb00a);
  bubble.addChild(bg);
  const txt = new Text({ text: "📋 Meeting", style: new TextStyle({ fontFamily: '"Courier New", monospace', fontSize: 10, fill: 0x000000 }) });
  txt.anchor.set(0.5, 0.5);
  bubble.addChild(txt);
  node.container.addChild(bubble);
}

function hideMeetingBubble(node: AgentNode) {
  const b = node.container.children.find(c => c.label === "meeting-bubble");
  if (b) { node.container.removeChild(b); b.destroy(); }
}

function updateStatusBubble(node: AgentNode, status: AgentStatus, agent: Agent) {
  const bubble = node.statusBubble;
  bubble.removeChildren();

  const statusText = getStatusText(status, agent);
  if (!statusText) { bubble.visible = false; return; }

  const bg = new Graphics();
  const truncated = statusText.length > 30 ? statusText.slice(0, 28) + "…" : statusText;
  const text = new Text({ text: truncated, style: BUBBLE_STYLE });
  text.anchor.set(0.5, 0.5);

  const padX = 6;
  const padY = 3;
  const w = Math.max(text.width + padX * 2, 30);
  const h = text.height + padY * 2;

  bg.roundRect(-w / 2, -h / 2, w, h, 3);
  bg.fill(STATUS_COLORS[status] || 0x636e72);
  bg.moveTo(-3, h / 2);
  bg.lineTo(0, h / 2 + 4);
  bg.lineTo(3, h / 2);
  bg.closePath();
  bg.fill(STATUS_COLORS[status] || 0x636e72);

  bubble.addChild(bg);
  bubble.addChild(text);
  bubble.visible = true;
}

function getStatusText(status: AgentStatus, agent: Agent): string | null {
  switch (status) {
    case "working": return agent.description || "Working...";
    case "thinking": return "Thinking...";
    case "busy": return agent.description || "Busy";
    default: return null;
  }
}

function animateAgent(node: AgentNode, dt: number) {
  const t = node.animTime;

  if (node.moveState !== "SITTING") {
    updateParticles(node.particles, dt);
    if (node.statusBubble.visible) node.statusBubble.y = -60 + Math.sin(t * 2) * 1.5;
    return;
  }

  switch (node.apiStatus) {    case "idle":
      node.sprite.y = -10 + Math.sin(t * 1.5) * 0.8;
      break;
    case "working":
      node.sprite.y = -10 + Math.sin(t * 3) * 0.5;
      node.particleTimer += dt;
      if (node.particleTimer > 0.3) {
        node.particleTimer = 0;
        spawnParticle(node.particles, 0xecb00a, node.sprite.x, -20);
      }
      break;
    case "thinking":
      node.sprite.y = -10 + Math.sin(t * 1.2) * 1;
      animateThoughtDots(node, t);
      break;
    case "busy":
      node.sprite.y = -10 + Math.sin(t * 4) * 0.6;
      node.particleTimer += dt;
      if (node.particleTimer > 0.2) {
        node.particleTimer = 0;
        spawnParticle(node.particles, 0xe17055, node.sprite.x, -20);
      }
      break;
    case "offline":
      node.sprite.y = -8;
      node.sprite.rotation = 0.05;
      break;
    default:
      node.sprite.y = -10 + Math.sin(t * 1.5) * 0.8;
  }

  updateParticles(node.particles, dt);
  if (node.statusBubble.visible) node.statusBubble.y = -60 + Math.sin(t * 2) * 1.5;
}

function spawnParticle(container: Container, color: number, baseX: number, baseY: number) {
  if (container.children.length > 8) return;
  const p = new Graphics();
  p.rect(-1, -1, 2, 2);
  p.fill(color);
  p.x = baseX + (Math.random() - 0.5) * 20;
  p.y = baseY;
  p.alpha = 1;
  (p as any).vy = -15 - Math.random() * 10;
  (p as any).life = 0.8 + Math.random() * 0.4;
  container.addChild(p);
}

function updateParticles(container: Container, dt: number) {
  for (let i = container.children.length - 1; i >= 0; i--) {
    const p = container.children[i] as any;
    if (p.vy === undefined) continue;
    p.y += p.vy * dt;
    p.life -= dt;
    p.alpha = Math.max(0, p.life);
    if (p.life <= 0) { container.removeChild(p); p.destroy(); }
  }
}

function animateThoughtDots(node: AgentNode, t: number) {
  if (!node.statusBubble.visible) {
    const bubble = node.statusBubble;
    bubble.removeChildren();
    const bg = new Graphics();
    bg.roundRect(-16, -8, 32, 16, 4);
    bg.fill(0xfdcb6e);
    bubble.addChild(bg);
    for (let i = 0; i < 3; i++) {
      const dot = new Graphics();
      dot.circle(0, 0, 2);
      dot.fill(0x2d3436);
      dot.x = -8 + i * 8;
      dot.y = 0;
      dot.label = `dot-${i}`;
      bubble.addChild(dot);
    }
    bubble.visible = true;
  }
  for (let i = 1; i <= 3; i++) {
    const dot = node.statusBubble.children[i];
    if (dot) dot.y = Math.sin(t * 3 + i * 0.8) * 2;
  }
}
