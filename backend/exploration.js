// Pause physics during the entrance animation, then let the whole network settle again.
const expansionHistory = [];
let neighborhoodExtraEdgeIds = [];
let expansionInProgress = false;
let expansionAnimation = 0;
let physicsRestTimer;
let draggingGraphNode = false;
function schedulePhysicsRest(delay = 2500) {
  window.clearTimeout(physicsRestTimer);
  physicsRestTimer = window.setTimeout(() => {
    if (!expansionInProgress && !draggingGraphNode) network.stopSimulation();
  }, delay);
}
// Straight edges avoid the extra moving control nodes used by dynamic curves.
network.setOptions({ edges: { smooth: { enabled: false } }, physics: {
  maxVelocity: 4, minVelocity: 0.4, timestep: 0.35,
  barnesHut: { damping: 0.55, avoidOverlap: 0.2 }
} });
network.once('stabilizationIterationsDone', () => schedulePhysicsRest());
network.on('dragStart', event => {
  if (!event.nodes || !event.nodes.length) return;
  draggingGraphNode = true;
  window.clearTimeout(physicsRestTimer);
});
network.on('dragEnd', () => {
  if (!draggingGraphNode) return;
  draggingGraphNode = false;
  schedulePhysicsRest(1800);
});
function resumeGraphPhysics() {
  network.storePositions();
  nodes.update(nodes.getIds().map(id => ({ id: id, physics: true })));
  // Keep the network responsive while limiting the impulse from new connections.
  network.setOptions({ physics: {
    enabled: true,
    stabilization: false,
    solver: 'barnesHut',
    maxVelocity: 4,
    minVelocity: 0.4,
    timestep: 0.35,
    barnesHut: {
      damping: 0.55,
      springConstant: 0.02,
      springLength: 120,
      centralGravity: 0.15,
      avoidOverlap: 0.2
    }
  } });
  network.startSimulation();
  schedulePhysicsRest();
}
function publishGraphState(requestId, includeEdges = true) {
  const selected = network.getSelectedNodes()[0];
  window.parent.postMessage({
    type: 'prote-prote:graph-state', requestId: requestId,
    edges: includeEdges ? edges.get().map(edge => [String(edge.from), String(edge.to)]) : undefined,
    ids: nodes.getIds().map(String), canUndo: !expansionInProgress && expansionHistory.length > 0,
    selectedId: selected === undefined ? null : String(selected),
    visibleNeighbors: selected === undefined ? [] : network.getConnectedNodes(selected).map(String)
  }, '*');
}
function publishSelection(id) {
  const node = nodes.get(id);
  if (node && node.protein_details) {
    network.selectNodes([id]);
    window.parent.postMessage({ type: 'prote-prote:protein-selected', id: String(id),
      details: node.protein_details, visible_neighbors: network.getConnectedNodes(id).map(String) }, '*');
  } else {
    network.unselectAll();
    window.parent.postMessage({ type: 'prote-prote:protein-cleared' }, '*');
  }
}
window.addEventListener('message', function (event) {
  if (event.source !== window.parent || !event.data) return;
  const command = event.data;
  if (command.type !== 'prote-prote:exploration') return;
  if (command.action === 'select') { publishSelection(command.id); publishGraphState(); return; }
  if (command.action === 'state') { publishGraphState(); return; }
  if (command.action === 'neighbor-edges') {
    if (expansionInProgress) return;
    if (command.enabled) {
      const knownPairs = new Set(edges.get().map(edge => JSON.stringify([String(edge.from), String(edge.to)].sort())));
      const additions = command.edges.filter(pair => !knownPairs.has(JSON.stringify(pair.slice().sort())))
        .map((pair, index) => ({ id: 'neighborhood-extra:' + index, from: pair[0], to: pair[1] }));
      if (!neighborhoodExtraEdgeIds.length) {
        edges.add(additions);
        neighborhoodExtraEdgeIds = additions.map(edge => edge.id);
      }
    } else {
      edges.remove(neighborhoodExtraEdgeIds);
      neighborhoodExtraEdgeIds = [];
    }
    resumeGraphPhysics();
    publishGraphState();
    return;
  }
  if (command.action === 'center') {
    if (nodes.get(command.id)) network.focus(command.id, { scale: network.getScale(), animation: true });
    return;
  }
  if (command.action === 'undo') {
    if (expansionInProgress) return;
    const previous = expansionHistory.pop();
    if (!previous) return;
    edges.remove(previous.edges);
    nodes.remove(previous.nodes);
    previous.nodes.forEach(id => originalNodeColors.delete(id));
    publishSelection(previous.selected);
    resumeGraphPhysics();
    network.redraw();
    publishGraphState(command.requestId);
    return;
  }
  if (command.action !== 'expand' || expansionInProgress) return;
  expansionInProgress = true;
  window.clearTimeout(physicsRestTimer);
  const previousSelection = network.getSelectedNodes()[0];
  const addedNodes = command.nodes.filter(node => !nodes.get(node.id));
  const knownPairs = new Set(edges.get().map(edge => JSON.stringify([String(edge.from), String(edge.to)].sort())));
  const addedEdges = command.edges.filter(edge => !knownPairs.has(JSON.stringify([String(edge.from), String(edge.to)].sort())));
  network.setOptions({ physics: { enabled: false } });
  network.stopSimulation();
  network.storePositions();
  const positions = network.getPositions();
  const existingPositions = Object.values(positions);
  const anchor = positions[command.root] || {
    x: existingPositions.length ? existingPositions.reduce((max, position) => Math.max(max, position.x), -Infinity) + 350 : 0,
    y: existingPositions.length ? existingPositions.reduce((sum, position) => sum + position.y, 0) / existingPositions.length : 0
  };
  // Golden-angle placement fills the surrounding area instead of stacking narrow rings.
  const occupied = existingPositions.slice();
  const targets = new Map();
  let slot = 0;
  addedNodes.forEach(node => {
    let target = anchor;
    if (node.id !== command.root) {
      do {
        const radius = 120 + Math.sqrt(slot) * 55;
        const angle = slot * Math.PI * (3 - Math.sqrt(5));
        target = { x: anchor.x + radius * Math.cos(angle), y: anchor.y + radius * Math.sin(angle) };
        slot++;
      } while (occupied.some(other => Math.hypot(other.x - target.x, other.y - target.y) < 90));
    }
    occupied.push(target);
    targets.set(node.id, target);
    originalNodeColors.set(node.id, node.color);
  });
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const stagger = reducedMotion ? 0 : Math.min(115, 4500 / Math.max(addedNodes.length || addedEdges.length, 1));
  const duration = reducedMotion ? 0 : 650;
  const revealTimes = new Map(addedNodes.map((node, index) => [node.id, index * stagger]));
  const revealed = new Set();
  const revealedEdges = new Set();
  const completed = new Set();
  const started = performance.now();
  let lastState = 0;
  let rootSelected = false;
  function animateExpansion(now) {
    const elapsed = now - started;
    const updates = [];
    addedNodes.forEach((node, index) => {
      if (completed.has(node.id)) return;
      const age = elapsed - revealTimes.get(node.id);
      if (age < 0) return;
      const progress = duration ? Math.min(1, age / duration) : 1;
      const eased = 1 - Math.pow(1 - progress, 3);
      const target = targets.get(node.id);
      const bend = Math.sin(progress * Math.PI) * 18;
      const position = {
        x: anchor.x + (target.x - anchor.x) * eased + bend * Math.sin(index),
        y: anchor.y + (target.y - anchor.y) * eased + bend * Math.cos(index)
      };
      const visual = { ...position, shape: 'dot', size: Math.max(1, 22 * eased), opacity: eased, physics: true };
      if (!revealed.has(node.id)) {
        nodes.add({ ...node, ...visual });
        revealed.add(node.id);
      } else updates.push({ id: node.id, ...visual });
      if (progress === 1) completed.add(node.id);
    });
    if (updates.length) nodes.update(updates);
    addedEdges.forEach((edge, index) => {
      if (revealedEdges.has(edge.id) || !nodes.get(edge.from) || !nodes.get(edge.to)) return;
      const revealAt = addedNodes.length
        ? Math.max(revealTimes.get(edge.from) || 0, revealTimes.get(edge.to) || 0)
        : index * stagger;
      if (elapsed < revealAt) return;
      edges.add(edge);
      revealedEdges.add(edge.id);
    });
    if (!rootSelected && nodes.get(command.root)) {
      publishSelection(command.root);
      if (command.focus) network.focus(command.root, { scale: Math.min(network.getScale(), 0.8), animation: true });
      rootSelected = true;
    }
    network.redraw();
    if (completed.size === addedNodes.length && revealedEdges.size === addedEdges.length) {
      if (addedNodes.length || addedEdges.length) {
        expansionHistory.push({ nodes: addedNodes.map(node => node.id), edges: addedEdges.map(edge => edge.id), selected: previousSelection });
      }
      expansionInProgress = false;
      resumeGraphPhysics();
      publishGraphState(command.requestId);
      return;
    }
    // Keep visible-connection counts up to date while the expansion unfolds.
    if (now - lastState > 180) { publishGraphState(undefined, false); lastState = now; }
    expansionAnimation = window.requestAnimationFrame(animateExpansion);
  }
  expansionAnimation = window.requestAnimationFrame(animateExpansion);
});
window.addEventListener('pagehide', function () {
  window.cancelAnimationFrame(expansionAnimation);
  window.clearTimeout(physicsRestTimer);
});
