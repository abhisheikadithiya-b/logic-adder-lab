/**
 * Interactive Logic Adder Lab - Logic & Interface Engine
 */

// Global App State
const state = {
  activeModule: 'module-intro',
  completedModules: new Set(),
  exam: {
    isActive: false,
    timeLeft: 600,
    violations: 0,
    timerId: null
  },
  soundEnabled: false,
  clicksCount: 0,
  correctCount: 0,

  // Module 1 (Intro) inputs
  intro: { a: 0, b: 0 },

  // Module 2 (Half Adder) inputs
  halfAdder: { a: 0, b: 0 },

  // Module 3 (Full Adder) inputs & views
  fullAdder: { a: 0, b: 0, cin: 0, view: 'gates' },

  // Module 4 (Sandbox) circuit editor data
  sandbox: {
    mission: 'ha', // 'ha' or 'fa'
    gates: [],     // { id, type, x, y, inputs: [{v, wireId}, {v, wireId}], output: {v, wireIds: []} }
    selectedPaletteType: null,
    wires: [],     // { id, fromNode: {type, id, pinIndex}, toNode: {type, id, pinIndex} }
    selectedGate: null,
    selectedWire: null,
    draggingGate: null,
    dragOffset: { x: 0, y: 0 },
    connectingPin: null, // { type, id, pinIndex, isOutput, x, y }
    mousePos: { x: 0, y: 0 }
  },

  // Module 5 (Ripple Carry) data
  ripple: {
    a: [0, 0, 0, 0], // MSB -> LSB [A3, A2, A1, A0]
    b: [0, 0, 0, 0], // MSB -> LSB
    delay: 400,
    animating: false,
    timeoutIds: []
  },

  // Module 6 (Breadboard) data
  breadboard: { a: 0, b: 0, cin: 0, view: 'ha' },

  // Module 4 (K-Map Lab) data
  kmap: {
    view: 'ha',
    target: 'sum',
    mode: 'guided',
    selection: [],
    groups: [],
    guidedStep: 0,
    practiceChoices: [],
    selectedChoiceIdx: -1
  },

  // Module 7 (Arcade) data
  arcade: {
    mode: 'predict', // 'predict', 'table', 'time'
    score: 0,
    highScore: 0,
    streak: 0,
    predict: {
      a: 0, b: 0, cin: 0, isFull: false,
      selectedS: 0, selectedC: 0,
      answered: false
    },
    table: {
      isFull: false,
      userCells: {}, // "row-col": value
      targetAnswers: {}
    },
    timer: {
      duration: 30,
      timeLeft: 30,
      intervalId: null,
      active: false,
      currentA: 0,
      currentB: 0,
      currentCin: 0,
      answerS: 0,
      answerC: 0
    }
  },

  // User session
  currentUser: null,
  currentRoll: null,
  currentClass: null
};

// AUDIO SYNTH ENGINE (Web Audio API)
let audioCtx = null;

function initAudio() {
  if (audioCtx) return;
  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    audioCtx = new AudioContextClass();
    state.soundEnabled = true;
    updateSoundUI();
    playChime('welcome');
  } catch (e) {
    console.warn("Web Audio API not supported", e);
  }
}

function updateSoundUI() {
  const btn = document.getElementById('btn-sound-toggle');
  const onIcon = document.getElementById('sound-icon-on');
  const offIcon = document.getElementById('sound-icon-off');
  
  if (state.soundEnabled) {
    btn.classList.remove('muted');
    onIcon.classList.remove('hidden');
    offIcon.classList.add('hidden');
  } else {
    btn.classList.add('muted');
    onIcon.classList.add('hidden');
    offIcon.classList.remove('hidden');
  }
}

function toggleSound() {
  if (!audioCtx) {
    initAudio();
  } else {
    state.soundEnabled = !state.soundEnabled;
    updateSoundUI();
  }
}

// Dynamically synthesize sound effects
function playSound(type) {
  if (!state.soundEnabled || !audioCtx) return;
  
  // Resume context if suspended
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }

  const t = audioCtx.currentTime;
  
  switch(type) {
    case 'click': {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(600, t);
      osc.frequency.exponentialRampToValueAtTime(100, t + 0.05);
      gain.gain.setValueAtTime(0.1, t);
      gain.gain.linearRampToValueAtTime(0.001, t + 0.05);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start(t);
      osc.stop(t + 0.05);
      break;
    }
    case 'correct': {
      // Arpeggio C5 -> E5 -> G5
      const notes = [523.25, 659.25, 783.99];
      notes.forEach((freq, idx) => {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, t + idx * 0.06);
        gain.gain.setValueAtTime(0.0, t + idx * 0.06);
        gain.gain.linearRampToValueAtTime(0.1, t + idx * 0.06 + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, t + idx * 0.06 + 0.15);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start(t + idx * 0.06);
        osc.stop(t + idx * 0.06 + 0.2);
      });
      break;
    }
    case 'incorrect': {
      // Low buzz
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(130, t);
      osc.frequency.linearRampToValueAtTime(80, t + 0.25);
      gain.gain.setValueAtTime(0.15, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start(t);
      osc.stop(t + 0.25);
      break;
    }
    case 'success': {
      playChime('victory');
      break;
    }
    case 'ripple': {
      // Short high pulse
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, t);
      gain.gain.setValueAtTime(0.08, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start(t);
      osc.stop(t + 0.1);
      break;
    }
  }
}

function playChime(theme) {
  const t = audioCtx.currentTime;
  if (theme === 'welcome') {
    const notes = [440, 554, 659, 880]; // A major
    notes.forEach((freq, idx) => {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t + idx * 0.1);
      gain.gain.setValueAtTime(0.0, t + idx * 0.1);
      gain.gain.linearRampToValueAtTime(0.08, t + idx * 0.1 + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, t + idx * 0.1 + 0.4);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start(t + idx * 0.1);
      osc.stop(t + idx * 0.1 + 0.5);
    });
  } else if (theme === 'victory') {
    const notes = [523, 659, 784, 1046, 1318]; // C major triad chord sweep
    notes.forEach((freq, idx) => {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, t + idx * 0.08);
      gain.gain.setValueAtTime(0.0, t + idx * 0.08);
      gain.gain.linearRampToValueAtTime(0.1, t + idx * 0.08 + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.001, t + idx * 0.08 + 0.5);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start(t + idx * 0.08);
      osc.stop(t + idx * 0.08 + 0.6);
    });
  }
}

// HELPER STATE SYNCS & PROGRESS TRACKING
function logClick() {
  state.clicksCount++;
  updateMasteryStats();
}

function completeModule(moduleId) {
  if (!state.completedModules.has(moduleId)) {
    state.completedModules.add(moduleId);
    playSound('correct');
    updateProgressUI();
    updateStudentCompletionInRegistry();
    // Sync progress to Google Sheet (async, non-blocking)
    syncStudentToSheet();
  }
}

function updateProgressUI() {
  const total = 8; // Modules 1 to 8 (excluding mastery report)
  const current = state.completedModules.size;
  const pct = Math.round((current / total) * 100);
  
  document.getElementById('completion-text').innerText = `${pct}%`;
  document.getElementById('completion-bar').style.width = `${pct}%`;

  // Update navigation visual checkmarks
  const navItems = document.querySelectorAll('.nav-item');
  navItems.forEach(item => {
    const target = item.getAttribute('data-target');
    if (state.completedModules.has(target)) {
      item.classList.add('completed');
    } else {
      item.classList.remove('completed');
    }
  });

  updateMasteryStats();
}

function updateMasteryStats() {
  document.getElementById('stat-modules-done').innerText = `${state.completedModules.size} / 8`;
  document.getElementById('stat-clicks-count').innerText = state.clicksCount;
  document.getElementById('stat-correct-count').innerText = state.correctCount;
  document.getElementById('stat-arcade-high').innerText = state.arcade.highScore;

  // Unlock badges on mastery screen
  const badges = [
    { id: 'badge-intro', unlocked: state.completedModules.has('module-intro') },
    { id: 'badge-half', unlocked: state.completedModules.has('module-half-adder') },
    { id: 'badge-full', unlocked: state.completedModules.has('module-full-adder') },
    { id: 'badge-sandbox', unlocked: state.completedModules.has('module-sandbox') },
    { id: 'badge-ripple', unlocked: state.completedModules.has('module-ripple-carry') },
    { id: 'badge-breadboard', unlocked: state.completedModules.has('module-breadboard') },
    { id: 'badge-arcade', unlocked: state.arcade.highScore >= 150 }
  ];

  badges.forEach(b => {
    const el = document.getElementById(b.id);
    if (el) {
      if (b.unlocked) {
        el.classList.remove('locked');
        el.classList.add('unlocked');
      } else {
        el.classList.add('locked');
        el.classList.remove('unlocked');
      }
    }
  });
}

// NAVIGATION STATE
function initNavigation() {
  const navItems = document.querySelectorAll('.nav-item');
  navItems.forEach(item => {
    item.addEventListener('click', () => {
      const target = item.getAttribute('data-target');
      switchModule(target);
    });
  });

  const nextBtns = document.querySelectorAll('.next-step-btn');
  nextBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const next = btn.getAttribute('data-next');
      switchModule(next);
    });
  });
}

let sandboxAnimationId = null;
function startSandboxAnimation() {
  if (sandboxAnimationId) return;
  function anim() {
    drawSandbox();
    sandboxAnimationId = requestAnimationFrame(anim);
  }
  sandboxAnimationId = requestAnimationFrame(anim);
}

function stopSandboxAnimation() {
  if (sandboxAnimationId) {
    cancelAnimationFrame(sandboxAnimationId);
    sandboxAnimationId = null;
  }
}

function switchModule(targetId) {
  playSound('click');
  // Mark current as complete on navigation click to encourage user journey completion
  if (state.activeModule !== 'module-arcade' && state.activeModule !== 'module-mastery' && state.activeModule !== 'module-sandbox' && state.activeModule !== 'module-kmap') {
    completeModule(state.activeModule);
  }

  // Deactivate current
  document.getElementById(state.activeModule).classList.remove('active');
  const oldNav = document.querySelector(`.nav-item[data-target="${state.activeModule}"]`);
  if (oldNav) {
    oldNav.classList.remove('active');
    oldNav.removeAttribute('aria-current');
  }

  // Activate target
  document.getElementById(targetId).classList.add('active');
  const newNav = document.querySelector(`.nav-item[data-target="${targetId}"]`);
  if (newNav) {
    newNav.classList.add('active');
    newNav.setAttribute('aria-current', 'page');
  }

  state.activeModule = targetId;

  // Sandbox setup or resize redraw if target is sandbox
  if (targetId === 'module-sandbox') {
    initSandboxCanvas();
    startSandboxAnimation();
  } else {
    stopSandboxAnimation();
  }
}

// MODULE 1: INTRO LOGIC
function initIntroModule() {
  const toggleA = document.getElementById('intro-bit-a');
  const toggleB = document.getElementById('intro-bit-b');

  function updateIntro() {
    const sum = state.intro.a + state.intro.b;
    const binS = sum & 1;
    const binC = (sum >> 1) & 1;

    // Binary elements
    document.getElementById('binary-carry-val').innerText = binC;
    document.getElementById('binary-carry-val').className = `bit-box carry-bit ${binC ? 'active' : ''}`;
    
    document.getElementById('binary-res-s').innerText = binS;
    document.getElementById('binary-res-s').className = `bit-box ${binS ? 'active' : ''}`;
    document.getElementById('binary-res-c').innerText = binC;
    document.getElementById('binary-res-c').className = `bit-box active-carry ${binC ? 'active' : ''}`;

    // Decimal elements
    document.getElementById('dec-a').innerText = state.intro.a;
    document.getElementById('dec-b').innerText = state.intro.b;
    document.getElementById('dec-sum').innerText = sum;

    // Explanations
    let desc = "";
    if (state.intro.a === 0 && state.intro.b === 0) {
      desc = "Both inputs are 0. No carry is generated. Output is 0.";
    } else if (state.intro.a !== state.intro.b) {
      desc = "One input is 1. The result is 1. No carry needed.";
    } else {
      desc = "Both inputs are 1! The sum is 2 (decimal). In binary, we write 0 in the current column and Carry a 1 to the next column: 10₂.";
      completeModule('module-intro');
    }
    document.getElementById('intro-explanation').innerText = desc;
  }

  toggleA.addEventListener('click', () => {
    logClick();
    state.intro.a = state.intro.a ? 0 : 1;
    toggleA.innerText = state.intro.a;
    toggleA.classList.toggle('active', state.intro.a === 1);
    playSound('click');
    updateIntro();
  });

  toggleB.addEventListener('click', () => {
    logClick();
    state.intro.b = state.intro.b ? 0 : 1;
    toggleB.innerText = state.intro.b;
    toggleB.classList.toggle('active', state.intro.b === 1);
    playSound('click');
    updateIntro();
  });

  updateIntro();
}

// MODULE 2: HALF ADDER LOGIC
function initHalfAdderModule() {
  const switchA = document.getElementById('ha-switch-a');
  const switchB = document.getElementById('ha-switch-b');

  function evaluateHalfAdder() {
    const a = state.halfAdder.a;
    const b = state.halfAdder.b;
    const sum = a ^ b;
    const carry = a & b;

    // Visual switches update
    switchA.innerText = a;
    switchA.classList.toggle('active', a === 1);
    switchB.innerText = b;
    switchB.classList.toggle('active', b === 1);

    // Wire path signals
    setWireState('ha-wire-a-xor', a);
    setWireState('ha-wire-a-and', a);
    setWireState('ha-wire-b-xor', b);
    setWireState('ha-wire-b-and', b);
    setWireState('ha-wire-xor-sum', sum);
    setWireState('ha-wire-and-carry', carry);

    // Pulse animation flow
    setPulseState('ha-pulse-a-xor', a, 'active-input');
    setPulseState('ha-pulse-a-and', a, 'active-input');
    setPulseState('ha-pulse-b-xor', b, 'active-input');
    setPulseState('ha-pulse-b-and', b, 'active-input');
    setPulseState('ha-pulse-xor-sum', sum, 'active-sum');
    setPulseState('ha-pulse-and-carry', carry, 'active-carry');

    // Gate Active styles
    document.getElementById('ha-xor-gate').classList.toggle('active', (a || b) && !(a && b));
    document.getElementById('ha-and-gate').classList.toggle('active', a && b);

    // LEDs
    document.getElementById('ha-led-sum').classList.toggle('active', sum === 1);
    document.getElementById('ha-led-carry').classList.toggle('active', carry === 1);

    // Truth Table highlight
    const rowKey = `${a}${b}`;
    const tableRows = document.querySelectorAll('#ha-truth-table tbody tr');
    tableRows.forEach(row => {
      if (row.getAttribute('data-inputs') === rowKey) {
        row.classList.add('active-row');
      } else {
        row.classList.remove('active-row');
      }
    });

    // Solve condition check
    if (a === 1 && b === 1) {
      completeModule('module-half-adder');
    }
  }

  switchA.addEventListener('click', () => {
    logClick();
    state.halfAdder.a = state.halfAdder.a ? 0 : 1;
    playSound('click');
    evaluateHalfAdder();
  });

  switchB.addEventListener('click', () => {
    logClick();
    state.halfAdder.b = state.halfAdder.b ? 0 : 1;
    playSound('click');
    evaluateHalfAdder();
  });

  evaluateHalfAdder();
}

// Utility SVG Wire Manipulation Helpers
function setWireState(id, active) {
  const el = document.getElementById(id);
  if (el) {
    el.classList.toggle('active', active === 1);
  }
}

function setPulseState(id, active, activeClass) {
  const el = document.getElementById(id);
  if (el) {
    if (active === 1) {
      el.classList.remove('hidden');
      el.classList.add(activeClass);
    } else {
      el.classList.add('hidden');
      el.classList.remove('active-input', 'active-sum', 'active-carry');
    }
  }
}

// MODULE 3: FULL ADDER LOGIC
function initFullAdderModule() {
  const swA = document.getElementById('fa-switch-a');
  const swB = document.getElementById('fa-switch-b');
  const swCin = document.getElementById('fa-switch-cin');
  
  const blockSwA = document.getElementById('fa-block-switch-a');
  const blockSwB = document.getElementById('fa-block-switch-b');
  const blockSwCin = document.getElementById('fa-block-switch-cin');

  const btnViewGates = document.getElementById('btn-fa-view-gates');
  const btnViewBlocks = document.getElementById('btn-fa-view-blocks');
  const faGateSvg = document.getElementById('fa-gate-svg');
  const faBlockSvg = document.getElementById('fa-block-svg');

  function evaluateFullAdder() {
    const a = state.fullAdder.a;
    const b = state.fullAdder.b;
    const cin = state.fullAdder.cin;

    const sum = a ^ b ^ cin;
    const xor1_out = a ^ b;
    const and1_out = a & b;
    const and2_out = cin & xor1_out;
    const cout = and1_out | and2_out;

    // Switch text update
    swA.innerText = a; swA.classList.toggle('active', a === 1);
    swB.innerText = b; swB.classList.toggle('active', b === 1);
    swCin.innerText = cin; swCin.classList.toggle('active', cin === 1);

    if (blockSwA) {
      blockSwA.innerText = a; blockSwA.classList.toggle('active', a === 1);
    }
    if (blockSwB) {
      blockSwB.innerText = b; blockSwB.classList.toggle('active', b === 1);
    }
    if (blockSwCin) {
      blockSwCin.innerText = cin; blockSwCin.classList.toggle('active', cin === 1);
    }

    // GATE VIEW WIRE signals
    setWireState('fa-w-a-xor1', a);
    setWireState('fa-w-a-and1', a);
    setWireState('fa-w-b-xor1', b);
    setWireState('fa-w-b-and1', b);
    setWireState('fa-w-cin-xor2', cin);
    setWireState('fa-w-cin-and2', cin);
    setWireState('fa-w-xor1-xor2', xor1_out);
    setWireState('fa-w-xor1-and2', xor1_out);
    setWireState('fa-w-and1-or', and1_out);
    setWireState('fa-w-and2-or', and2_out);
    setWireState('fa-w-xor2-sum', sum);
    setWireState('fa-w-or-carry', cout);

    // GATE VIEW Pulse flow
    setPulseState('fa-p-a-xor1', a, 'active-input');
    setPulseState('fa-p-a-and1', a, 'active-input');
    setPulseState('fa-p-b-xor1', b, 'active-input');
    setPulseState('fa-p-b-and1', b, 'active-input');
    setPulseState('fa-p-cin-xor2', cin, 'active-input');
    setPulseState('fa-p-cin-and2', cin, 'active-input');
    setPulseState('fa-p-xor1-xor2', xor1_out, 'active-input');
    setPulseState('fa-p-xor1-and2', xor1_out, 'active-input');
    setPulseState('fa-p-and1-or', and1_out, 'active-input');
    setPulseState('fa-p-and2-or', and2_out, 'active-input');
    setPulseState('fa-p-xor2-sum', sum, 'active-sum');
    setPulseState('fa-p-or-carry', cout, 'active-carry');

    // BLOCK VIEW WIRE signals
    setWireState('fa-wb-a', a);
    setWireState('fa-wb-b', b);
    setWireState('fa-wb-cin', cin);
    setWireState('fa-wb-ha1s', xor1_out);
    setWireState('fa-wb-ha1c', and1_out);
    setWireState('fa-wb-ha2c', and2_out);
    setWireState('fa-wb-sum', sum);
    setWireState('fa-wb-carry', cout);

    // BLOCK VIEW Pulse flow
    setPulseState('fa-pb-a', a, 'active-input');
    setPulseState('fa-pb-b', b, 'active-input');
    setPulseState('fa-pb-cin', cin, 'active-input');
    setPulseState('fa-pb-ha1s', xor1_out, 'active-input');
    setPulseState('fa-pb-ha1c', and1_out, 'active-input');
    setPulseState('fa-pb-ha2c', and2_out, 'active-input');
    setPulseState('fa-pb-sum', sum, 'active-sum');
    setPulseState('fa-pb-carry', cout, 'active-carry');

    // Gate Active outlines
    document.getElementById('fa-xor1').classList.toggle('active', xor1_out === 1);
    document.getElementById('fa-and1').classList.toggle('active', and1_out === 1);
    document.getElementById('fa-xor2').classList.toggle('active', sum === 1);
    document.getElementById('fa-and2').classList.toggle('active', and2_out === 1);
    document.getElementById('fa-or').classList.toggle('active', cout === 1);

    // Block visual active states
    document.getElementById('fa-ha1-block').classList.toggle('active', a || b);
    document.getElementById('fa-ha2-block').classList.toggle('active', xor1_out || cin);
    document.getElementById('fa-block-or-gate').classList.toggle('active', cout === 1);

    // LEDs
    document.getElementById('fa-led-sum').classList.toggle('active', sum === 1);
    document.getElementById('fa-led-carry').classList.toggle('active', cout === 1);
    document.getElementById('fa-led-sum-block').classList.toggle('active', sum === 1);
    document.getElementById('fa-led-carry-block').classList.toggle('active', cout === 1);

    // Truth Table active row
    const rowKey = `${a}${b}${cin}`;
    const tableRows = document.querySelectorAll('#fa-truth-table tbody tr');
    tableRows.forEach(row => {
      if (row.getAttribute('data-inputs') === rowKey) {
        row.classList.add('active-row');
      } else {
        row.classList.remove('active-row');
      }
    });

    // Check completion condition (all 3 inputs HIGH demonstrates all carrying pathways)
    if (a === 1 && b === 1 && cin === 1) {
      completeModule('module-full-adder');
    }
  }

  // View switches
  btnViewGates.addEventListener('click', () => {
    logClick();
    state.fullAdder.view = 'gates';
    btnViewGates.classList.add('active');
    btnViewBlocks.classList.remove('active');
    faGateSvg.classList.remove('hidden');
    faBlockSvg.classList.add('hidden');
    playSound('click');
  });

  btnViewBlocks.addEventListener('click', () => {
    logClick();
    state.fullAdder.view = 'blocks';
    btnViewBlocks.classList.add('active');
    btnViewGates.classList.remove('active');
    faBlockSvg.classList.remove('hidden');
    faGateSvg.classList.add('hidden');
    playSound('click');
  });

  // Toggles
  const toggleA = () => {
    logClick();
    state.fullAdder.a = state.fullAdder.a ? 0 : 1;
    playSound('click');
    evaluateFullAdder();
  };
  swA.addEventListener('click', toggleA);
  if (blockSwA) blockSwA.addEventListener('click', toggleA);

  const toggleB = () => {
    logClick();
    state.fullAdder.b = state.fullAdder.b ? 0 : 1;
    playSound('click');
    evaluateFullAdder();
  };
  swB.addEventListener('click', toggleB);
  if (blockSwB) blockSwB.addEventListener('click', toggleB);

  const toggleCin = () => {
    logClick();
    state.fullAdder.cin = state.fullAdder.cin ? 0 : 1;
    playSound('click');
    evaluateFullAdder();
  };
  swCin.addEventListener('click', toggleCin);
  if (blockSwCin) blockSwCin.addEventListener('click', toggleCin);

  evaluateFullAdder();
}

// MODULE 4: DRAG AND DROP CIRCUIT SANDBOX ENGINE
let sandboxCanvas = null;
let sandboxCtx = null;
const GRID_SIZE = 20;

function initSandboxCanvas() {
  sandboxCanvas = document.getElementById('sandbox-canvas');
  if (!sandboxCanvas) return;
  sandboxCtx = sandboxCanvas.getContext('2d');
  
  // Set dimensions correctly and clear listeners to prevent duplicates
  sandboxCanvas.width = 700;
  sandboxCanvas.height = 480;

  // Setup click triggers
  sandboxCanvas.removeEventListener('mousedown', onSandboxMouseDown);
  sandboxCanvas.addEventListener('mousedown', onSandboxMouseDown);
  sandboxCanvas.removeEventListener('mousemove', onSandboxMouseMove);
  sandboxCanvas.addEventListener('mousemove', onSandboxMouseMove);
  window.removeEventListener('mouseup', onSandboxMouseUp);
  window.addEventListener('mouseup', onSandboxMouseUp);

  // Setup Touch support triggers for mobile
  sandboxCanvas.removeEventListener('touchstart', onSandboxTouchStart);
  sandboxCanvas.addEventListener('touchstart', onSandboxTouchStart, { passive: false });
  sandboxCanvas.removeEventListener('touchmove', onSandboxTouchMove);
  sandboxCanvas.addEventListener('touchmove', onSandboxTouchMove, { passive: false });
  window.removeEventListener('touchend', onSandboxTouchEnd);
  window.addEventListener('touchend', onSandboxTouchEnd);

  resetSandboxElements();
  drawSandbox();
}

function resetSandboxElements() {
  state.sandbox.gates = [];
  state.sandbox.wires = [];
  state.sandbox.selectedGate = null;
  state.sandbox.selectedWire = null;
  
  updatePaletteDraggables();
  updateSandboxSidepanels();
  updateGraderStatus();
}

function addGateToSandbox(type, x, y) {
  const snapX = Math.round(x / GRID_SIZE) * GRID_SIZE - 30; // center it offset
  const snapY = Math.round(y / GRID_SIZE) * GRID_SIZE - 20;

  // Create sandbox gate
  const gateId = 'gate_' + Date.now();
  const newGate = {
    id: gateId,
    type: type,
    x: snapX,
    y: snapY,
    width: 60,
    height: 40,
    inputs: [
      { v: 0, wireId: null, x: snapX, y: snapY + 12 },
      { v: 0, wireId: null, x: snapX, y: snapY + 28 }
    ],
    output: { v: 0, wireIds: [], x: snapX + 60, y: snapY + 20 }
  };

  state.sandbox.gates.push(newGate);
  playSound('click');
  evaluateSandboxCircuit();
  drawSandbox();
}

function updatePaletteDraggables() {
  const items = document.querySelectorAll('.palette-item');
  const isTouchDevice = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);

  items.forEach(item => {
    // Remove draggable on touch devices — it suppresses click/tap events
    if (isTouchDevice) {
      item.removeAttribute('draggable');
    }

    // Desktop: HTML5 drag-and-drop
    item.addEventListener('dragstart', (e) => {
      e.dataTransfer.setData('gate-type', item.getAttribute('data-gate-type'));
    });

    // Gate selection handler (shared by click and touch)
    function selectGate(e) {
      if (e && e.preventDefault) e.preventDefault();
      const type = item.getAttribute('data-gate-type');
      
      // If already selected, deselect
      if (state.sandbox.selectedPaletteType === type) {
        state.sandbox.selectedPaletteType = null;
        item.classList.remove('selected-palette-item');
      } else {
        // Deselect others
        items.forEach(el => el.classList.remove('selected-palette-item'));
        state.sandbox.selectedPaletteType = type;
        item.classList.add('selected-palette-item');
      }
      playSound('click');
    }

    // Click for desktop
    item.addEventListener('click', selectGate);

    // Touchend for mobile (fires reliably even when draggable="true")
    item.addEventListener('touchend', (e) => {
      e.preventDefault(); // Prevent subsequent click (double-fire)
      e.stopPropagation();
      selectGate(e);
    });
  });

  const wrapper = document.querySelector('.sandbox-canvas-wrapper');
  wrapper.addEventListener('dragover', (e) => {
    e.preventDefault();
  });

  wrapper.addEventListener('drop', (e) => {
    e.preventDefault();
    const type = e.dataTransfer.getData('gate-type');
    if (!type) return;

    // Get drop coordinate relative to canvas bounds
    const rect = sandboxCanvas.getBoundingClientRect();
    const dropX = e.clientX - rect.left;
    const dropY = e.clientY - rect.top;

    addGateToSandbox(type, dropX, dropY);
  });
}

// Side panels containing interactive Switch buttons and glowing output LEDs
function updateSandboxSidepanels() {
  const inPanel = document.getElementById('canvas-inputs-panel');
  const outPanel = document.getElementById('canvas-outputs-panel');

  inPanel.innerHTML = '';
  outPanel.innerHTML = '';

  const isFA = (state.sandbox.mission === 'fa');

  // Input Toggles
  const inputsList = isFA ? ['A', 'B', 'Cin'] : ['A', 'B'];
  inputsList.forEach((lbl, idx) => {
    const btn = document.createElement('button');
    btn.className = `bit-toggle ${state.sandbox[lbl.toLowerCase()] ? 'active' : ''}`;
    btn.innerText = state.sandbox[lbl.toLowerCase()] || 0;
    btn.title = `Toggle input ${lbl}`;
    btn.addEventListener('click', () => {
      logClick();
      const val = state.sandbox[lbl.toLowerCase()] ? 0 : 1;
      state.sandbox[lbl.toLowerCase()] = val;
      btn.innerText = val;
      btn.classList.toggle('active', val === 1);
      playSound('click');
      evaluateSandboxCircuit();
      drawSandbox();
    });
    
    const wrapper = document.createElement('div');
    wrapper.style.display = 'flex';
    wrapper.style.flexDirection = 'column';
    wrapper.style.alignItems = 'center';
    wrapper.style.gap = '4px';
    
    // Absolute position relative to canvas coordinate system (offset to the left of the pin at x = 30)
    const pinPos = getPinPosition('input_port', lbl.toLowerCase());
    wrapper.style.position = 'absolute';
    wrapper.style.left = `${(15 / 700) * 100}%`;
    wrapper.style.top = `${(pinPos.y / 480) * 100}%`;
    wrapper.style.transform = 'translate(-50%, -25px)';
    
    const label = document.createElement('span');
    label.style.fontFamily = 'JetBrains Mono';
    label.style.fontSize = '10px';
    label.style.color = 'var(--text-muted)';
    label.innerText = lbl;

    wrapper.appendChild(label);
    wrapper.appendChild(btn);
    inPanel.appendChild(wrapper);
  });

  // Output Indicators
  const outputsList = ['SUM', 'CARRY'];
  outputsList.forEach(lbl => {
    const ledWrapper = document.createElement('div');
    ledWrapper.className = 'led-node-overlay';
    ledWrapper.style.display = 'flex';
    ledWrapper.style.flexDirection = 'column';
    ledWrapper.style.alignItems = 'center';
    ledWrapper.style.gap = '4px';
    
    // Absolute position relative to canvas coordinate system (offset to the right of the pin at x = 670)
    const pinPos = getPinPosition('output_port', lbl.toLowerCase());
    ledWrapper.style.position = 'absolute';
    ledWrapper.style.left = `${(685 / 700) * 100}%`;
    ledWrapper.style.top = `${(pinPos.y / 480) * 100}%`;
    ledWrapper.style.transform = 'translate(-50%, -23px)';

    const led = document.createElement('div');
    led.id = `sandbox-led-${lbl.toLowerCase()}`;
    led.className = 'led-bulb small';
    led.style.width = '18px';
    led.style.height = '18px';
    led.style.borderRadius = '50%';
    led.style.border = '2px solid #4b5563';
    led.style.background = '#1f2937';

    const label = document.createElement('span');
    label.style.fontFamily = 'JetBrains Mono';
    label.style.fontSize = '10px';
    label.style.color = 'var(--text-muted)';
    label.innerText = lbl;

    ledWrapper.appendChild(label);
    ledWrapper.appendChild(led);
    outPanel.appendChild(ledWrapper);
  });
}

// Logic solver for Sandbox node inputs & wire loops
function evaluateSandboxCircuit() {
  const isFA = (state.sandbox.mission === 'fa');
  
  // Clean values
  state.sandbox.gates.forEach(g => {
    g.inputs[0].v = 0;
    g.inputs[1].v = 0;
    g.output.v = 0;
  });

  // Recursively evaluate pin value
  function evaluatePin(pinType, componentId, pinIdx, visitedGates = new Set()) {
    if (pinType === 'input_port') {
      const pinName = componentId; // 'a', 'b', or 'cin'
      return state.sandbox[pinName] || 0;
    }

    if (pinType === 'gate_input') {
      // Find wire connecting to this input
      const incomingWire = state.sandbox.wires.find(w => 
        w.toNode.type === 'gate' && w.toNode.id === componentId && w.toNode.pinIndex === pinIdx
      );
      if (!incomingWire) return 0;
      return evaluatePin(incomingWire.fromNode.type, incomingWire.fromNode.id, incomingWire.fromNode.pinIndex, visitedGates);
    }

    if (pinType === 'gate_output' || pinType === 'gate') {
      const gate = state.sandbox.gates.find(g => g.id === componentId);
      if (!gate) return 0;
      
      // Cycle detection protection
      if (visitedGates.has(componentId)) {
        return 0; // Cycle detected: feedback loops are calculated as 0
      }
      visitedGates.add(componentId);

      // Evaluate the gate inputs
      const v0 = evaluatePin('gate_input', componentId, 0, new Set(visitedGates));
      const v1 = evaluatePin('gate_input', componentId, 1, new Set(visitedGates));
      gate.inputs[0].v = v0;
      gate.inputs[1].v = v1;

      let outVal = 0;
      if (gate.type === 'AND') outVal = v0 & v1;
      else if (gate.type === 'OR') outVal = v0 | v1;
      else if (gate.type === 'XOR') outVal = v0 ^ v1;

      gate.output.v = outVal;
      return outVal;
    }

    return 0;
  }

  // Evaluate the global outputs SUM and CARRY
  const outPins = ['sum', 'carry'];
  const results = {};
  
  outPins.forEach(p => {
    const ledEl = document.getElementById(`sandbox-led-${p}`);
    const wire = state.sandbox.wires.find(w => w.toNode.type === 'output_port' && w.toNode.id === p);
    
    let val = 0;
    if (wire) {
      val = evaluatePin(wire.fromNode.type, wire.fromNode.id, wire.fromNode.pinIndex);
    }
    
    results[p] = val;
    if (ledEl) {
      if (val === 1) {
        ledEl.style.background = 'var(--accent-amber)';
        ledEl.style.borderColor = 'var(--text-bright)';
        ledEl.style.boxShadow = '0 0 10px var(--accent-amber)';
      } else {
        ledEl.style.background = '#1f2937';
        ledEl.style.borderColor = '#4b5563';
        ledEl.style.boxShadow = 'none';
      }
    }
  });

  updateGraderStatus();
}

// Background auto-grader: verify full truth table combinational mapping
function checkCircuitCorrectness() {
  const isFA = (state.sandbox.mission === 'fa');
  const statesToTest = isFA ? 8 : 4;
  let correctMatches = 0;
  const coverage = [];

  // Temporary snapshot of current UI values to restore later
  const snapA = state.sandbox.a || 0;
  const snapB = state.sandbox.b || 0;
  const snapCin = state.sandbox.cin || 0;

  // Topological gate solver inside checker
  function solveTemp(inA, inB, inCin) {
    const tempInputs = { a: inA, b: inB, cin: inCin };
    const tempGateVals = {};
    
    function evalTempPin(type, id, idx, visited = new Set()) {
      if (type === 'input_port') return tempInputs[id] || 0;
      if (type === 'gate_input') {
        const wire = state.sandbox.wires.find(w => w.toNode.type === 'gate' && w.toNode.id === id && w.toNode.pinIndex === idx);
        if (!wire) return 0;
        return evalTempPin(wire.fromNode.type, wire.fromNode.id, wire.fromNode.pinIndex, visited);
      }
      if (type === 'gate_output' || type === 'gate') {
        if (visited.has(id)) return 0;
        visited.add(id);
        
        const g = state.sandbox.gates.find(item => item.id === id);
        if (!g) return 0;
        const v0 = evalTempPin('gate_input', id, 0, new Set(visited));
        const v1 = evalTempPin('gate_input', id, 1, new Set(visited));
        
        let res = 0;
        if (g.type === 'AND') res = v0 & v1;
        else if (g.type === 'OR') res = v0 | v1;
        else if (g.type === 'XOR') res = v0 ^ v1;
        
        return res;
      }
      return 0;
    }

    const outResults = {};
    ['sum', 'carry'].forEach(p => {
      const wire = state.sandbox.wires.find(w => w.toNode.type === 'output_port' && w.toNode.id === p);
      outResults[p] = wire ? evalTempPin(wire.fromNode.type, wire.fromNode.id, wire.fromNode.pinIndex) : 0;
    });

    return outResults;
  }

  // Iterate over truth table combinations
  for (let i = 0; i < statesToTest; i++) {
    const a = (i >> 1) & 1;
    const b = i & 1;
    const cin = isFA ? ((i >> 2) & 1) : 0;

    // Expected Output
    const targetSum = a ^ b ^ cin;
    const targetCarry = isFA ? ((a & b) | (cin & (a ^ b))) : (a & b);

    // Actual sandbox output
    const res = solveTemp(a, b, cin);
    const correct = (res.sum === targetSum && res.carry === targetCarry);
    
    if (correct) {
      correctMatches++;
    }
    coverage.push({ correct, inputLabel: isFA ? `${cin}${a}${b}` : `${a}${b}` });
  }

  // Restore snapshots
  state.sandbox.a = snapA;
  state.sandbox.b = snapB;
  state.sandbox.cin = snapCin;

  return {
    isCorrect: correctMatches === statesToTest,
    coverage: coverage
  };
}

function updateGraderStatus() {
  const check = checkCircuitCorrectness();
  const eqEl = document.getElementById('sandbox-equation-status');
  const miniTable = document.getElementById('sandbox-mini-table');

  miniTable.innerHTML = '';
  
  if (state.sandbox.mission === 'fa') {
    miniTable.className = 'mini-grid fa-cols';
  } else {
    miniTable.className = 'mini-grid';
  }

  // Draw cells
  check.coverage.forEach(cov => {
    const cell = document.createElement('div');
    cell.className = `mini-cell ${cov.correct ? 'success' : ''}`;
    cell.innerText = cov.inputLabel;
    cell.title = cov.correct ? `Combination ${cov.inputLabel} CORRECT` : `Combination ${cov.inputLabel} INCORRECT`;
    miniTable.appendChild(cell);
  });

  // Global verified trigger
  if (check.isCorrect) {
    eqEl.innerText = 'VERIFIED';
    eqEl.className = 'status-badge success';
    triggerSandboxSuccess();
  } else {
    eqEl.innerText = 'INCOMPLETE';
    eqEl.className = 'status-badge error';
  }
}

function triggerSandboxSuccess() {
  const overlay = document.getElementById('sandbox-success-overlay');
  const msg = document.getElementById('sandbox-success-msg');
  
  if (state.sandbox.mission === 'ha') {
    msg.innerHTML = 'Your custom circuit successfully validates the <strong>Half Adder</strong> truth table. High five! ⚡';
  } else {
    msg.innerHTML = 'Excellent! You have successfully built a full gate-level <strong>Full Adder</strong>. You are ready for high-speed ripple chains!';
  }

  overlay.classList.remove('hidden');
  playSound('success');
  completeModule('module-sandbox');
}

// Mouse coordinates logic in canvas workspace (supporting touch and mouse events)
function getMouseCoordinates(e) {
  const rect = sandboxCanvas.getBoundingClientRect();
  
  let clientX = e.clientX;
  let clientY = e.clientY;
  
  if (e.touches && e.touches.length > 0) {
    clientX = e.touches[0].clientX;
    clientY = e.touches[0].clientY;
  } else if (e.changedTouches && e.changedTouches.length > 0) {
    clientX = e.changedTouches[0].clientX;
    clientY = e.changedTouches[0].clientY;
  }
  
  // Guard against division by zero if canvas is hidden
  const widthRatio = rect.width > 0 ? (sandboxCanvas.width / rect.width) : 1;
  const heightRatio = rect.height > 0 ? (sandboxCanvas.height / rect.height) : 1;

  return {
    x: (clientX - rect.left) * widthRatio,
    y: (clientY - rect.top) * heightRatio
  };
}

// Coordinate mappings for pin connectors on the Canvas layout
function getPinPosition(type, id, pinIdx) {
  if (type === 'input_port') {
    const isFA = (state.sandbox.mission === 'fa');
    const x = 30;
    if (id === 'a') return { x, y: 120 };
    if (id === 'b') return { x, y: 240 };
    if (id === 'cin') return { x, y: 360 };
  }
  if (type === 'output_port') {
    const x = 670;
    if (id === 'sum') return { x, y: 180 };
    if (id === 'carry') return { x, y: 300 };
  }
  if (type === 'gate') {
    const gate = state.sandbox.gates.find(g => g.id === id);
    if (!gate) return { x: 0, y: 0 };
    if (pinIdx === 'out' || pinIdx === 2) {
      return { x: gate.x + 60, y: gate.y + 20 };
    } else {
      return { x: gate.x, y: gate.y + (pinIdx === 0 ? 12 : 28) };
    }
  }
  return { x: 0, y: 0 };
}

// Pin hover detection bounds
function getPinAtPosition(pos) {
  const isFA = (state.sandbox.mission === 'fa');
  const isTouch = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0) || (window.innerWidth < 640);
  
  const portTolerance = isTouch ? 35 : 26;
  const gateOutTolerance = isTouch ? 24 : 18;
  const gateInTolerance = isTouch ? 20 : 14;

  let bestPin = null;
  let bestDist = Infinity;

  // 1. Check global inputs (larger tolerance since they are far apart)
  const inputs = isFA ? ['a', 'b', 'cin'] : ['a', 'b'];
  for (let inId of inputs) {
    const pinPos = getPinPosition('input_port', inId);
    const dist = Math.hypot(pos.x - pinPos.x, pos.y - pinPos.y);
    if (dist <= portTolerance && dist < bestDist) {
      bestPin = { type: 'input_port', id: inId, pinIndex: 0, isOutput: true, x: pinPos.x, y: pinPos.y };
      bestDist = dist;
    }
  }

  // 2. Check global outputs
  const outputs = ['sum', 'carry'];
  for (let outId of outputs) {
    const pinPos = getPinPosition('output_port', outId);
    const dist = Math.hypot(pos.x - pinPos.x, pos.y - pinPos.y);
    if (dist <= portTolerance && dist < bestDist) {
      bestPin = { type: 'output_port', id: outId, pinIndex: 0, isOutput: false, x: pinPos.x, y: pinPos.y };
      bestDist = dist;
    }
  }

  // 3. Check gate pins (tighter tolerance since gate input pins are close together)
  for (let gate of state.sandbox.gates) {
    // Output pin
    const outPos = getPinPosition('gate', gate.id, 'out');
    const outDist = Math.hypot(pos.x - outPos.x, pos.y - outPos.y);
    if (outDist <= gateOutTolerance && outDist < bestDist) {
      bestPin = { type: 'gate', id: gate.id, pinIndex: 0, isOutput: true, x: outPos.x, y: outPos.y };
      bestDist = outDist;
    }
    // Input 0
    const in0Pos = getPinPosition('gate', gate.id, 0);
    const in0Dist = Math.hypot(pos.x - in0Pos.x, pos.y - in0Pos.y);
    if (in0Dist <= gateInTolerance && in0Dist < bestDist) {
      bestPin = { type: 'gate', id: gate.id, pinIndex: 0, isOutput: false, x: in0Pos.x, y: in0Pos.y };
      bestDist = in0Dist;
    }
    // Input 1
    const in1Pos = getPinPosition('gate', gate.id, 1);
    const in1Dist = Math.hypot(pos.x - in1Pos.x, pos.y - in1Pos.y);
    if (in1Dist <= gateInTolerance && in1Dist < bestDist) {
      bestPin = { type: 'gate', id: gate.id, pinIndex: 1, isOutput: false, x: in1Pos.x, y: in1Pos.y };
      bestDist = in1Dist;
    }
  }

  return bestPin;
}

function getGateAtPosition(pos) {
  for (let gate of state.sandbox.gates) {
    if (pos.x >= gate.x && pos.x <= gate.x + gate.width &&
        pos.y >= gate.y && pos.y <= gate.y + gate.height) {
      return gate;
    }
  }
  return null;
}

// Distance from point to bezier line to delete wires
function getWireAtPosition(pos) {
  const clickTolerance = 6;
  for (let wire of state.sandbox.wires) {
    const p1 = getPinPosition(wire.fromNode.type, wire.fromNode.id, wire.fromNode.type === 'gate' ? 'out' : 0);
    const p2 = getPinPosition(wire.toNode.type, wire.toNode.id, wire.toNode.pinIndex);
    
    // Midpoint check as simple distance approximation
    const midX = (p1.x + p2.x) / 2;
    const midY = (p1.y + p2.y) / 2;
    if (Math.hypot(pos.x - midX, pos.y - midY) <= clickTolerance + 15) {
      return wire;
    }
  }
  return null;
}

// Drag & drop mousedown handling
function onSandboxMouseDown(e) {
  const pos = getMouseCoordinates(e);
  logClick();

  // 1. Check if clicked a connector pin to start drawing a wire
  const pin = getPinAtPosition(pos);
  if (pin && pin.isOutput) {
    state.sandbox.connectingPin = pin;
    state.sandbox.selectedGate = null;
    state.sandbox.selectedWire = null;
    const wrapper = document.querySelector('.sandbox-canvas-wrapper');
    if (wrapper) wrapper.classList.add('dragging');
    drawSandbox();
    return;
  }

  // 2. Check if clicked on a gate to select/drag
  const gate = getGateAtPosition(pos);
  if (gate) {
    state.sandbox.draggingGate = gate;
    state.sandbox.selectedGate = gate;
    state.sandbox.selectedWire = null;
    state.sandbox.dragOffset.x = pos.x - gate.x;
    state.sandbox.dragOffset.y = pos.y - gate.y;
    const wrapper = document.querySelector('.sandbox-canvas-wrapper');
    if (wrapper) wrapper.classList.add('dragging');
    document.getElementById('btn-delete-selected').classList.remove('disabled');
    document.getElementById('btn-delete-selected').disabled = false;
    drawSandbox();
    return;
  }

  // 3. Check if clicked a wire path
  const wire = getWireAtPosition(pos);
  if (wire) {
    state.sandbox.selectedWire = wire;
    state.sandbox.selectedGate = null;
    document.getElementById('btn-delete-selected').classList.remove('disabled');
    document.getElementById('btn-delete-selected').disabled = false;
    drawSandbox();
    return;
  }

  // 4. Tap-to-place check
  if (state.sandbox.selectedPaletteType) {
    addGateToSandbox(state.sandbox.selectedPaletteType, pos.x, pos.y);
    state.sandbox.selectedPaletteType = null;
    document.querySelectorAll('.palette-item').forEach(el => el.classList.remove('selected-palette-item'));
    return;
  }

  // Deselect all
  state.sandbox.selectedGate = null;
  state.sandbox.selectedWire = null;
  document.getElementById('btn-delete-selected').classList.add('disabled');
  document.getElementById('btn-delete-selected').disabled = true;
  drawSandbox();
}

function onSandboxMouseMove(e) {
  const pos = getMouseCoordinates(e);
  state.sandbox.mousePos = pos;
  document.getElementById('canvas-coordinates').innerText = `X: ${Math.round(pos.x)}, Y: ${Math.round(pos.y)}`;

  // Moving a gate on the grid workspace
  if (state.sandbox.draggingGate) {
    const newX = Math.round((pos.x - state.sandbox.dragOffset.x) / GRID_SIZE) * GRID_SIZE;
    const newY = Math.round((pos.y - state.sandbox.dragOffset.y) / GRID_SIZE) * GRID_SIZE;
    
    // Bounds restrict
    state.sandbox.draggingGate.x = Math.max(80, Math.min(sandboxCanvas.width - 150, newX));
    state.sandbox.draggingGate.y = Math.max(20, Math.min(sandboxCanvas.height - 60, newY));
    
    evaluateSandboxCircuit();
    drawSandbox();
  }

  // Refresh drawing when dragging connections
  if (state.sandbox.connectingPin) {
    drawSandbox();
  }
}

function onSandboxMouseUp(e) {
  const wrapper = document.querySelector('.sandbox-canvas-wrapper');
  if (wrapper) wrapper.classList.remove('dragging');

  if (state.sandbox.draggingGate) {
    state.sandbox.draggingGate = null;
    playSound('click');
    drawSandbox();
  }

  if (state.sandbox.connectingPin) {
    const pos = getMouseCoordinates(e);
    const targetPin = getPinAtPosition(pos);

    // Connect wire if released over a compatible input pin
    if (targetPin && !targetPin.isOutput) {
      // Pin compatibility check (avoid shorting logic)
      const exists = state.sandbox.wires.find(w => 
        w.toNode.type === targetPin.type && 
        w.toNode.id === targetPin.id && 
        w.toNode.pinIndex === targetPin.pinIndex
      );

      if (!exists) {
        const wireId = 'wire_' + Date.now();
        const newWire = {
          id: wireId,
          fromNode: {
            type: state.sandbox.connectingPin.type,
            id: state.sandbox.connectingPin.id,
            pinIndex: state.sandbox.connectingPin.pinIndex
          },
          toNode: {
            type: targetPin.type,
            id: targetPin.id,
            pinIndex: targetPin.pinIndex
          }
        };

        state.sandbox.wires.push(newWire);
        playSound('click');
        evaluateSandboxCircuit();
      }
    }
    state.sandbox.connectingPin = null;
    drawSandbox();
  }
}

// Touch support wrapper functions for mobile devices
function onSandboxTouchStart(e) {
  if (e.touches && e.touches.length > 1) {
    // Abort active drag/wire drawing so pinch-zoom gesture works cleanly
    state.sandbox.draggingGate = null;
    state.sandbox.connectingPin = null;
    const wrapper = document.querySelector('.sandbox-canvas-wrapper');
    if (wrapper) wrapper.classList.remove('dragging');
    return;
  }

  if (e.touches && e.touches.length === 1) {
    const pos = getMouseCoordinates(e);
    const pin = getPinAtPosition(pos);
    const gate = getGateAtPosition(pos);
    
    // Only prevent default (stop scrolling) if interacting with interactive elements
    if ((pin && pin.isOutput) || gate) {
      e.preventDefault();
    }
    
    onSandboxMouseDown(e);
  }
}

function onSandboxTouchMove(e) {
  if (e.touches && e.touches.length > 1) {
    return;
  }

  if (e.touches && e.touches.length === 1) {
    // Only prevent default (stop scrolling) if currently dragging or wiring
    if (state.sandbox.draggingGate || state.sandbox.connectingPin) {
      e.preventDefault();
    }
    onSandboxMouseMove(e);
  }
}

function onSandboxTouchEnd(e) {
  if (e.changedTouches && e.changedTouches.length > 0) {
    const synthEvent = {
      clientX: e.changedTouches[0].clientX,
      clientY: e.changedTouches[0].clientY,
      touches: e.changedTouches
    };
    onSandboxMouseUp(synthEvent);
  } else {
    onSandboxMouseUp(e);
  }
}

// RENDER FUNCTION FOR SANDBOX CANVAS
function drawSandbox() {
  if (!sandboxCtx) return;
  
  // Clear
  sandboxCtx.fillStyle = '#080b15';
  sandboxCtx.fillRect(0, 0, sandboxCanvas.width, sandboxCanvas.height);

  // Draw grid background dots
  sandboxCtx.fillStyle = 'rgba(255,255,255,0.03)';
  for (let x = GRID_SIZE; x < sandboxCanvas.width; x += GRID_SIZE) {
    for (let y = GRID_SIZE; y < sandboxCanvas.height; y += GRID_SIZE) {
      sandboxCtx.beginPath();
      sandboxCtx.arc(x, y, 1, 0, Math.PI * 2);
      sandboxCtx.fill();
    }
  }

  // Draw Wires (bezier curves)
  state.sandbox.wires.forEach(wire => {
    const p1 = getPinPosition(wire.fromNode.type, wire.fromNode.id, wire.fromNode.type === 'gate' ? 'out' : 0);
    const p2 = getPinPosition(wire.toNode.type, wire.toNode.id, wire.toNode.pinIndex);

    const isSelected = state.sandbox.selectedWire === wire;
    
    // Evaluate active status of wire line
    let wireActive = 0;
    if (wire.fromNode.type === 'input_port') {
      wireActive = state.sandbox[wire.fromNode.id];
    } else if (wire.fromNode.type === 'gate') {
      const g = state.sandbox.gates.find(item => item.id === wire.fromNode.id);
      if (g) wireActive = g.output.v;
    }

    // Bezier control coordinate adjustments
    sandboxCtx.beginPath();
    sandboxCtx.moveTo(p1.x, p1.y);
    sandboxCtx.bezierCurveTo(p1.x + 50, p1.y, p2.x - 50, p2.y, p2.x, p2.y);
    
    if (wireActive) {
      // 1. Draw glowing background shadow (wide solid amber)
      sandboxCtx.strokeStyle = 'rgba(255, 159, 28, 0.25)';
      sandboxCtx.lineWidth = 6;
      sandboxCtx.stroke();
      
      // 2. Draw solid amber core wire
      sandboxCtx.strokeStyle = isSelected ? 'var(--accent-cyan)' : 'var(--accent-amber)';
      sandboxCtx.lineWidth = isSelected ? 3.5 : 2.5;
      sandboxCtx.stroke();

      // 3. Draw moving bright signal dashes
      sandboxCtx.save();
      sandboxCtx.strokeStyle = 'rgba(255, 255, 255, 0.9)'; // bright signal pulses
      sandboxCtx.lineWidth = isSelected ? 3.0 : 2.0;
      sandboxCtx.setLineDash([8, 12]); // 8px pulse, 12px gap
      sandboxCtx.lineDashOffset = -((Date.now() / 30) % 20); // scroll direction (flowing forward)
      sandboxCtx.stroke();
      sandboxCtx.restore();
    } else {
      // Inactive wire
      sandboxCtx.strokeStyle = isSelected ? 'var(--accent-cyan)' : 'var(--signal-low)';
      sandboxCtx.lineWidth = isSelected ? 3.5 : 2.5;
      sandboxCtx.stroke();
    }
  });

  // Draw current live wire connection being drawn by user
  if (state.sandbox.connectingPin) {
    const p1 = { x: state.sandbox.connectingPin.x, y: state.sandbox.connectingPin.y };
    const p2 = state.sandbox.mousePos;

    sandboxCtx.beginPath();
    sandboxCtx.moveTo(p1.x, p1.y);
    sandboxCtx.bezierCurveTo(p1.x + 50, p1.y, p2.x - 50, p2.y, p2.x, p2.y);
    sandboxCtx.strokeStyle = 'var(--accent-cyan)';
    sandboxCtx.lineWidth = 2;
    sandboxCtx.setLineDash([6, 6]);
    sandboxCtx.lineDashOffset = -((Date.now() / 20) % 12);
    sandboxCtx.stroke();
    sandboxCtx.setLineDash([]); // Reset
  }

  // Draw global input/output connector nodes
  const isFA = (state.sandbox.mission === 'fa');
  const inNames = isFA ? ['a', 'b', 'cin'] : ['a', 'b'];
  inNames.forEach(inId => {
    const pos = getPinPosition('input_port', inId);
    sandboxCtx.beginPath();
    sandboxCtx.arc(pos.x, pos.y, 6, 0, Math.PI * 2);
    sandboxCtx.fillStyle = state.sandbox[inId] ? 'var(--accent-amber)' : 'var(--signal-low)';
    sandboxCtx.fill();
    sandboxCtx.strokeStyle = '#fff';
    sandboxCtx.lineWidth = 1.5;
    sandboxCtx.stroke();
  });

  const outNames = ['sum', 'carry'];
  outNames.forEach(outId => {
    const pos = getPinPosition('output_port', outId);
    sandboxCtx.beginPath();
    sandboxCtx.arc(pos.x, pos.y, 6, 0, Math.PI * 2);
    sandboxCtx.fillStyle = 'var(--bg-dark)';
    sandboxCtx.fill();
    sandboxCtx.strokeStyle = 'var(--border-color)';
    sandboxCtx.lineWidth = 1.5;
    sandboxCtx.stroke();
  });

  // Draw placed logic Gates on the grid
  state.sandbox.gates.forEach(gate => {
    const isSelected = state.sandbox.selectedGate === gate;
    
    // Draw gate body block
    sandboxCtx.fillStyle = 'var(--bg-panel)';
    sandboxCtx.strokeStyle = isSelected ? 'var(--accent-cyan)' : 'var(--border-color)';
    sandboxCtx.lineWidth = isSelected ? 2.5 : 1.5;
    
    // Glow effect for active gates
    if (gate.output.v === 1) {
      sandboxCtx.shadowColor = 'rgba(0, 210, 255, 0.2)';
      sandboxCtx.shadowBlur = 8;
    }
    
    // Draw rounded block rectangle representation
    sandboxCtx.beginPath();
    sandboxCtx.roundRect(gate.x, gate.y, gate.width, gate.height, 6);
    sandboxCtx.fill();
    sandboxCtx.stroke();
    sandboxCtx.shadowBlur = 0; // Reset

    // Gate title text
    sandboxCtx.fillStyle = 'var(--text-bright)';
    sandboxCtx.font = 'bold 10px JetBrains Mono';
    sandboxCtx.textAlign = 'center';
    sandboxCtx.fillText(gate.type, gate.x + 30, gate.y + 24);

    // Draw Input connection nodes (circles)
    [0, 1].forEach(idx => {
      const pinPos = getPinPosition('gate', gate.id, idx);
      sandboxCtx.beginPath();
      sandboxCtx.arc(pinPos.x, pinPos.y, 5, 0, Math.PI * 2);
      sandboxCtx.fillStyle = gate.inputs[idx].v ? 'var(--accent-amber)' : 'var(--bg-dark)';
      sandboxCtx.fill();
      sandboxCtx.strokeStyle = 'var(--border-color)';
      sandboxCtx.lineWidth = 1;
      sandboxCtx.stroke();
    });

    // Draw Output node
    const outPos = getPinPosition('gate', gate.id, 'out');
    sandboxCtx.beginPath();
    sandboxCtx.arc(outPos.x, outPos.y, 5, 0, Math.PI * 2);
    sandboxCtx.fillStyle = gate.output.v ? 'var(--accent-amber)' : 'var(--bg-dark)';
    sandboxCtx.fill();
    sandboxCtx.strokeStyle = 'var(--border-color)';
    sandboxCtx.lineWidth = 1;
    sandboxCtx.stroke();
  });
}

// Tool events inside Sandbox Panel
function initSandboxTools() {
  const btnClear = document.getElementById('btn-clear-sandbox');
  const btnDelete = document.getElementById('btn-delete-selected');
  const missionHA = document.getElementById('btn-mission-ha');
  const missionFA = document.getElementById('btn-mission-fa');
  const btnSuccessClose = document.getElementById('btn-sandbox-success-close');

  btnClear.addEventListener('click', () => {
    logClick();
    playSound('click');
    resetSandboxElements();
    drawSandbox();
  });

  btnDelete.addEventListener('click', () => {
    logClick();
    if (state.sandbox.selectedGate) {
      // Remove selected gate and all connected wires
      const gId = state.sandbox.selectedGate.id;
      state.sandbox.gates = state.sandbox.gates.filter(g => g.id !== gId);
      state.sandbox.wires = state.sandbox.wires.filter(w => 
        !(w.fromNode.type === 'gate' && w.fromNode.id === gId) && 
        !(w.toNode.type === 'gate' && w.toNode.id === gId)
      );
      state.sandbox.selectedGate = null;
      playSound('incorrect');
    } else if (state.sandbox.selectedWire) {
      const wId = state.sandbox.selectedWire.id;
      state.sandbox.wires = state.sandbox.wires.filter(w => w.id !== wId);
      state.sandbox.selectedWire = null;
      playSound('incorrect');
    }

    btnDelete.classList.add('disabled');
    btnDelete.disabled = true;
    evaluateSandboxCircuit();
    drawSandbox();
  });

  missionHA.addEventListener('click', () => {
    logClick();
    state.sandbox.mission = 'ha';
    missionHA.classList.add('active');
    missionFA.classList.remove('active');
    document.getElementById('sandbox-goal-text').innerHTML = 'Construct a working <strong>Half Adder</strong>! Place gates on the grid and wire inputs to outputs. Complete the truth table to unlock.';
    playSound('click');
    resetSandboxElements();
    updateSandboxSidepanels();
    drawSandbox();
  });

  missionFA.addEventListener('click', () => {
    logClick();
    state.sandbox.mission = 'fa';
    missionFA.classList.add('active');
    missionHA.classList.remove('active');
    document.getElementById('sandbox-goal-text').innerHTML = 'Construct a working <strong>Full Adder</strong>! Connect inputs A, B, and C<sub>in</sub> to SUM and CARRY outputs.';
    playSound('click');
    resetSandboxElements();
    updateSandboxSidepanels();
    drawSandbox();
  });

  btnSuccessClose.addEventListener('click', () => {
    logClick();
    document.getElementById('sandbox-success-overlay').classList.add('hidden');
    playSound('click');
  });

  // Fullscreen Landscape Toggle for Sandbox Module
  const btnFullscreen = document.getElementById('btn-sandbox-fullscreen');
  if (btnFullscreen) {
    btnFullscreen.addEventListener('click', () => {
      logClick();
      playSound('click');
      const sandbox = document.getElementById('module-sandbox');
      if (!document.fullscreenElement && !document.webkitFullscreenElement) {
        if (sandbox.requestFullscreen) {
          sandbox.requestFullscreen().then(() => {
            if (screen.orientation && screen.orientation.lock) {
              screen.orientation.lock('landscape').catch(err => console.log('Orientation lock error:', err));
            }
          }).catch(err => console.log('Fullscreen error:', err));
        } else if (sandbox.webkitRequestFullscreen) {
          sandbox.webkitRequestFullscreen();
        }
      } else {
        if (document.exitFullscreen) {
          document.exitFullscreen();
        } else if (document.webkitExitFullscreen) {
          document.webkitExitFullscreen();
        }
      }
    });
  }

  // Fullscreen change events
  document.removeEventListener('fullscreenchange', onSandboxFullscreenChange);
  document.addEventListener('fullscreenchange', onSandboxFullscreenChange);
  document.removeEventListener('webkitfullscreenchange', onSandboxFullscreenChange);
  document.addEventListener('webkitfullscreenchange', onSandboxFullscreenChange);
}

function onSandboxFullscreenChange() {
  const sandbox = document.getElementById('module-sandbox');
  const btn = document.getElementById('btn-sandbox-fullscreen');
  const isFs = !!(document.fullscreenElement || document.webkitFullscreenElement);
  
  if (sandbox) {
    if (isFs && (document.fullscreenElement === sandbox || document.webkitFullscreenElement === sandbox)) {
      sandbox.classList.add('sandbox-fullscreen-mode');
      if (btn) btn.innerText = 'Exit Fullscreen';
    } else {
      sandbox.classList.remove('sandbox-fullscreen-mode');
      if (btn) btn.innerText = '📱 Fullscreen';
      if (screen.orientation && screen.orientation.unlock) {
        screen.orientation.unlock().catch(() => {});
      }
    }

    // Re-initialize canvas after layout settles (100ms debounce)
    setTimeout(() => {
      if (sandboxCanvas) {
        // Re-bind touch listeners (they can detach after DOM re-parenting in fullscreen)
        sandboxCanvas.removeEventListener('touchstart', onSandboxTouchStart);
        sandboxCanvas.addEventListener('touchstart', onSandboxTouchStart, { passive: false });
        sandboxCanvas.removeEventListener('touchmove', onSandboxTouchMove);
        sandboxCanvas.addEventListener('touchmove', onSandboxTouchMove, { passive: false });
        window.removeEventListener('touchend', onSandboxTouchEnd);
        window.addEventListener('touchend', onSandboxTouchEnd);
        
        sandboxCanvas.removeEventListener('mousedown', onSandboxMouseDown);
        sandboxCanvas.addEventListener('mousedown', onSandboxMouseDown);
        sandboxCanvas.removeEventListener('mousemove', onSandboxMouseMove);
        sandboxCanvas.addEventListener('mousemove', onSandboxMouseMove);
        window.removeEventListener('mouseup', onSandboxMouseUp);
        window.addEventListener('mouseup', onSandboxMouseUp);

        drawSandbox();
      }
    }, 150);
  }
}

// MODULE 5: 4-BIT RIPPLE CARRY LAB
function initRippleCarryModule() {
  const speedEl = document.getElementById('ripple-speed');
  const btnRun = document.getElementById('btn-ripple-calculate');

  // Speed selection update
  speedEl.addEventListener('change', () => {
    logClick();
    state.ripple.delay = parseInt(speedEl.value);
    playSound('click');
  });

  // Generate binary switches
  const nibbles = ['a', 'b'];
  nibbles.forEach(nibble => {
    for (let i = 0; i < 4; i++) {
      const btn = document.getElementById(`btn-${nibble}${i}`);
      if (btn) {
        btn.addEventListener('click', () => {
          logClick();
          if (state.ripple.animating) return; // Prevent change during active animation
          const val = state.ripple[nibble][i] ? 0 : 1;
          state.ripple[nibble][i] = val;
          btn.innerText = val;
          btn.classList.toggle('active', val === 1);
          playSound('click');
          updateRippleStaticUI();
        });
      }
    }
  });

  btnRun.addEventListener('click', () => {
    logClick();
    runRippleAnimation();
  });

  updateRippleStaticUI();
}

function updateRippleStaticUI() {
  // Convert binary array to string representations
  const binA = state.ripple.a.join('');
  const binB = state.ripple.b.join('');
  const decA = parseInt(binA, 2);
  const decB = parseInt(binB, 2);

  document.getElementById('formula-bin-a').innerText = `${binA}₂`;
  document.getElementById('formula-bin-b').innerText = `${binB}₂`;
  document.getElementById('formula-dec-a').innerText = `(${decA})`;
  document.getElementById('formula-dec-b').innerText = `(${decB})`;

  // Instantly resolve display if not animating
  if (!state.ripple.animating) {
    const sumVal = decA + decB;
    const binSum = sumVal.toString(2).padStart(5, '0');
    
    document.getElementById('formula-bin-sum').innerText = `${binSum}₂`;
    document.getElementById('formula-dec-sum').innerText = `(${sumVal})`;
    
    // LEDs matching LSB -> MSB
    const bits = binSum.split('').reverse(); // index 0 = S0
    for (let i = 0; i < 4; i++) {
      const bitVal = parseInt(bits[i] || '0');
      document.getElementById(`rc-led-s${i}`).classList.toggle('active', bitVal === 1);
    }
    
    // Overflow bit C4
    const ovVal = parseInt(bits[4] || '0');
    document.getElementById('rc-led-c4').classList.toggle('active', ovVal === 1);
    document.getElementById('ripple-overflow-alert').classList.toggle('hidden', ovVal === 0);
  }
}

// Scheduled delay animator for Ripple Carry carry-bits
function runRippleAnimation() {
  if (state.ripple.animating) return;
  state.ripple.animating = true;
  document.getElementById('btn-ripple-calculate').disabled = true;

  // Clear pending timers
  state.ripple.timeoutIds.forEach(clearTimeout);
  state.ripple.timeoutIds = [];

  // Reset visual stages
  const stages = document.querySelectorAll('.ripple-stage');
  stages.forEach(s => s.classList.remove('active-stage'));

  // Reset active wire highlights
  const wiresToReset = [
    'rc-carry-wire-0-1', 'rc-carry-wire-1-2', 'rc-carry-wire-2-3', 'rc-carry-wire-3-ov',
    'rc-s0-wire', 'rc-s1-wire', 'rc-s2-wire', 'rc-s3-wire'
  ];
  wiresToReset.forEach(wId => {
    document.getElementById(wId).classList.remove('active');
    document.getElementById(wId).classList.remove('cin-active');
  });

  const pulsesToHide = [
    'rc-carry-pulse-0-1', 'rc-carry-pulse-1-2', 'rc-carry-pulse-2-3', 'rc-carry-pulse-3-ov'
  ];
  pulsesToHide.forEach(pId => document.getElementById(pId).classList.add('hidden'));

  const ledsToReset = ['rc-led-s0', 'rc-led-s1', 'rc-led-s2', 'rc-led-s3', 'rc-led-c4'];
  ledsToReset.forEach(led => document.getElementById(led).classList.remove('active'));

  // Propagation execution scheduler
  let currentCarry = 0;
  const A = [...state.ripple.a].reverse(); // A[0] is LSB
  const B = [...state.ripple.b].reverse();

  const delayStep = state.ripple.delay;

  function processStage(stageIdx) {
    if (stageIdx > 3) {
      // Done propagation
      const finalSum = parseInt(state.ripple.a.join(''), 2) + parseInt(state.ripple.b.join(''), 2);
      const binSum = finalSum.toString(2).padStart(5, '0');
      document.getElementById('formula-bin-sum').innerText = `${binSum}₂`;
      document.getElementById('formula-dec-sum').innerText = `(${finalSum})`;
      
      // Animate carry-out/overflow path
      if (currentCarry === 1) {
        document.getElementById('rc-carry-wire-3-ov').classList.add('active');
        document.getElementById('rc-carry-pulse-3-ov').classList.remove('hidden');
        document.getElementById('rc-led-c4').classList.add('active');
        document.getElementById('ripple-overflow-alert').classList.remove('hidden');
      }

      state.ripple.animating = false;
      document.getElementById('btn-ripple-calculate').disabled = false;
      completeModule('module-ripple-carry');
      return;
    }

    // Activate current Stage card
    document.getElementById(`rc-stage-${stageIdx}`).classList.add('active-stage');
    playSound('ripple');

    // Calculate sum & carry-out for this column
    const aVal = A[stageIdx];
    const bVal = B[stageIdx];
    const sumOut = aVal ^ bVal ^ currentCarry;
    const nextCarry = (aVal & bVal) | (currentCarry & (aVal ^ bVal));

    // LED glow sum output node for this column
    if (sumOut === 1) {
      document.getElementById(`rc-s${stageIdx}-wire`).classList.add('active');
      document.getElementById(`rc-led-s${stageIdx}`).classList.add('active');
    }

    // Schedule carry-out wire glow & propagation to the next column
    if (stageIdx < 3) {
      const nextTimer = setTimeout(() => {
        // Toggle carry wire active color before calculation starts
        if (nextCarry === 1) {
          document.getElementById(`rc-carry-wire-${stageIdx}-${stageIdx+1}`).classList.add('cin-active');
          document.getElementById(`rc-carry-pulse-${stageIdx}-${stageIdx+1}`).classList.remove('hidden');
        }
        
        currentCarry = nextCarry;
        // Proceed recursively
        processStage(stageIdx + 1);
      }, delayStep);
      state.ripple.timeoutIds.push(nextTimer);
    } else {
      // final stage carry-out evaluation
      currentCarry = nextCarry;
      const finalTimer = setTimeout(() => {
        processStage(4);
      }, delayStep);
      state.ripple.timeoutIds.push(finalTimer);
    }
  }

  // Start with column Stage 0 (LSB)
  processStage(0);
}

// MODULE 6: PHYSICAL BREADBOARD INTERACTIVITY
function initBreadboardModule() {
  const switchHaA = document.getElementById('bb-ha-switch-a-knob');
  const switchHaB = document.getElementById('bb-ha-switch-b-knob');
  const switchFaA = document.getElementById('bb-fa-switch-a-knob');
  const switchFaB = document.getElementById('bb-fa-switch-b-knob');
  const switchFaCin = document.getElementById('bb-fa-switch-cin-knob');
  
  const btnA = document.getElementById('bb-btn-switch-a');
  const btnB = document.getElementById('bb-btn-switch-b');
  const btnCin = document.getElementById('bb-btn-switch-cin');

  const btnViewHa = document.getElementById('btn-bb-view-ha');
  const btnViewFa = document.getElementById('btn-bb-view-fa');
  const svgHa = document.getElementById('breadboard-ha-svg');
  const svgFa = document.getElementById('breadboard-fa-svg');
  const bbLabTitle = document.getElementById('bb-lab-title');
  const bbInfoOr = document.getElementById('bb-info-or');

  // Toggle view between Half Adder and Full Adder breadboards
  btnViewHa.addEventListener('click', () => {
    logClick();
    playSound('click');
    state.breadboard.view = 'ha';
    btnViewHa.classList.add('active');
    btnViewFa.classList.remove('active');
    svgHa.classList.remove('hidden');
    svgFa.classList.add('hidden');
    btnCin.classList.add('hidden');
    bbInfoOr.classList.add('hidden');
    bbLabTitle.innerText = "Breadboard Lab (Half Adder Mapping)";
    updateBreadboard();
  });

  btnViewFa.addEventListener('click', () => {
    logClick();
    playSound('click');
    state.breadboard.view = 'fa';
    btnViewHa.classList.remove('active');
    btnViewFa.classList.add('active');
    svgHa.classList.add('hidden');
    svgFa.classList.remove('hidden');
    btnCin.classList.remove('hidden');
    bbInfoOr.classList.remove('hidden');
    bbLabTitle.innerText = "Breadboard Lab (Full Adder Mapping)";
    updateBreadboard();
  });

  function updateBreadboard() {
    const a = state.breadboard.a;
    const b = state.breadboard.b;
    const cin = state.breadboard.cin;
    const view = state.breadboard.view;

    // Update button states
    btnA.innerText = `Toggle Switch A (${a})`;
    btnA.classList.toggle('primary', a === 1);
    btnA.classList.toggle('secondary', a === 0);
    
    btnB.innerText = `Toggle Switch B (${b})`;
    btnB.classList.toggle('primary', b === 1);
    btnB.classList.toggle('secondary', b === 0);

    btnCin.innerText = `Toggle Switch C_in (${cin})`;
    btnCin.classList.toggle('primary', cin === 1);
    btnCin.classList.toggle('secondary', cin === 0);

    if (view === 'ha') {
      const sum = a ^ b;
      const carry = a & b;

      // Switch knob displacements relative to center (0,0) inside translated group
      switchHaA.setAttribute('cy', a ? 5 : -5);
      switchHaB.setAttribute('cy', b ? 5 : -5);

      // Highlight active logic wires
      document.getElementById('bb-ha-wire-a1').classList.toggle('active', a === 1);
      document.getElementById('bb-ha-wire-a2').classList.toggle('active', a === 1);
      document.getElementById('bb-ha-wire-b1').classList.toggle('active', b === 1);
      document.getElementById('bb-ha-wire-b2').classList.toggle('active', b === 1);
      document.getElementById('bb-ha-wire-sum').classList.toggle('active', sum === 1);
      document.getElementById('bb-ha-wire-carry').classList.toggle('active', carry === 1);

      // LEDs
      document.getElementById('bb-ha-led-sum').classList.toggle('active', sum === 1);
      document.getElementById('bb-ha-led-carry').classList.toggle('active', carry === 1);

      // Chip glowing outlines
      document.getElementById('ic-bb-ha-74ls86').classList.toggle('active', sum === 1);
      document.getElementById('ic-bb-ha-74ls08').classList.toggle('active', carry === 1);

      // HA completion condition: both switches on
      if (a === 1 && b === 1) {
        completeModule('module-breadboard');
      }
    } else {
      const xor1 = a ^ b;
      const sum = xor1 ^ cin;
      const and1 = a & b;
      const and2 = xor1 & cin;
      const carry = and1 | and2;

      // Switch knob displacements relative to center (0,0) inside translated group
      switchFaA.setAttribute('cy', a ? 5 : -5);
      switchFaB.setAttribute('cy', b ? 5 : -5);
      switchFaCin.setAttribute('cy', cin ? 5 : -5);

      // Highlight active logic wires
      document.getElementById('bb-fa-wire-a1').classList.toggle('active', a === 1);
      document.getElementById('bb-fa-wire-a2').classList.toggle('active', a === 1);
      document.getElementById('bb-fa-wire-b1').classList.toggle('active', b === 1);
      document.getElementById('bb-fa-wire-b2').classList.toggle('active', b === 1);
      document.getElementById('bb-fa-wire-xor1-xor4').classList.toggle('active', xor1 === 1);
      document.getElementById('bb-fa-wire-xor1-and4').classList.toggle('active', xor1 === 1);
      document.getElementById('bb-fa-wire-cin1').classList.toggle('active', cin === 1);
      document.getElementById('bb-fa-wire-cin2').classList.toggle('active', cin === 1);
      document.getElementById('bb-fa-wire-sum').classList.toggle('active', sum === 1);
      document.getElementById('bb-fa-wire-and1').classList.toggle('active', and1 === 1);
      document.getElementById('bb-fa-wire-and2').classList.toggle('active', and2 === 1);
      document.getElementById('bb-fa-wire-carry').classList.toggle('active', carry === 1);

      // LEDs
      document.getElementById('bb-fa-led-sum').classList.toggle('active', sum === 1);
      document.getElementById('bb-fa-led-carry').classList.toggle('active', carry === 1);

      // Chip glowing outlines
      document.getElementById('ic-bb-fa-74ls86').classList.toggle('active', xor1 === 1 || sum === 1);
      document.getElementById('ic-bb-fa-74ls08').classList.toggle('active', and1 === 1 || and2 === 1);
      document.getElementById('ic-bb-fa-74ls32').classList.toggle('active', carry === 1);

      // FA completion condition: inputs a, b, cin = 1, 1, 1
      if (a === 1 && b === 1 && cin === 1) {
        completeModule('module-breadboard');
      }
    }
  }

  const triggerToggleA = () => {
    logClick();
    state.breadboard.a = state.breadboard.a ? 0 : 1;
    playSound('click');
    updateBreadboard();
  };

  const triggerToggleB = () => {
    logClick();
    state.breadboard.b = state.breadboard.b ? 0 : 1;
    playSound('click');
    updateBreadboard();
  };

  const triggerToggleCin = () => {
    logClick();
    state.breadboard.cin = state.breadboard.cin ? 0 : 1;
    playSound('click');
    updateBreadboard();
  };

  btnA.addEventListener('click', triggerToggleA);
  btnB.addEventListener('click', triggerToggleB);
  btnCin.addEventListener('click', triggerToggleCin);

  switchHaA.parentElement.addEventListener('click', triggerToggleA);
  switchHaB.parentElement.addEventListener('click', triggerToggleB);
  switchFaA.parentElement.addEventListener('click', triggerToggleA);
  switchFaB.parentElement.addEventListener('click', triggerToggleB);
  switchFaCin.parentElement.addEventListener('click', triggerToggleCin);

  updateBreadboard();
}

// MODULE 4: KARNAUGH MAP (K-MAP) LAB LOGIC
function initKMapModule() {
  const btnViewHa = document.getElementById('btn-kmap-view-ha');
  const btnViewFa = document.getElementById('btn-kmap-view-fa');
  const targetsHa = document.getElementById('kmap-targets-ha');
  const targetsFa = document.getElementById('kmap-targets-fa');

  const btnTargetHaSum = document.getElementById('btn-kmap-target-ha-sum');
  const btnTargetHaCarry = document.getElementById('btn-kmap-target-ha-carry');
  const btnTargetFaSum = document.getElementById('btn-kmap-target-fa-sum');
  const btnTargetFaCarry = document.getElementById('btn-kmap-target-fa-carry');

  const btnModeGuided = document.getElementById('btn-kmap-mode-guided');
  const btnModePractice = document.getElementById('btn-kmap-mode-practice');

  const btnGroup = document.getElementById('btn-kmap-group');
  const btnClear = document.getElementById('btn-kmap-clear');
  const btnReset = document.getElementById('btn-kmap-reset');

  const svgHa = document.getElementById('kmap-ha-svg');
  const svgFa = document.getElementById('kmap-fa-svg');
  const overlayToggle = document.getElementById('kmap-circuit-overlay-toggle');

  // VIEW toggles
  btnViewHa.addEventListener('click', () => {
    logClick();
    playSound('click');
    state.kmap.view = 'ha';
    btnViewHa.classList.add('active');
    btnViewFa.classList.remove('active');
    targetsHa.classList.remove('hidden');
    targetsFa.classList.add('hidden');
    svgHa.classList.remove('hidden');
    svgFa.classList.add('hidden');
    selectTarget('sum');
  });

  btnViewFa.addEventListener('click', () => {
    logClick();
    playSound('click');
    state.kmap.view = 'fa';
    btnViewHa.classList.remove('active');
    btnViewFa.classList.add('active');
    targetsHa.classList.add('hidden');
    targetsFa.classList.remove('hidden');
    svgHa.classList.add('hidden');
    svgFa.classList.remove('hidden');
    selectTarget('carry');
  });

  // TARGET toggles
  btnTargetHaSum.addEventListener('click', () => { selectTarget('sum'); });
  btnTargetHaCarry.addEventListener('click', () => { selectTarget('carry'); });
  btnTargetFaSum.addEventListener('click', () => { selectTarget('sum'); });
  btnTargetFaCarry.addEventListener('click', () => { selectTarget('carry'); });

  function selectTarget(target) {
    logClick();
    playSound('click');
    state.kmap.target = target;
    
    // Toggle active state
    btnTargetHaSum.classList.toggle('active', target === 'sum');
    btnTargetHaCarry.classList.toggle('active', target === 'carry');
    btnTargetFaSum.classList.toggle('active', target === 'sum');
    btnTargetFaCarry.classList.toggle('active', target === 'carry');

    // Update FA title text dynamically
    if (state.kmap.view === 'fa') {
      const titleEl = document.getElementById('kmap-fa-title');
      if (titleEl) {
        titleEl.textContent = target === 'sum' ? "SUM (S) K-Map" : "CARRY (Cout) K-Map";
        titleEl.setAttribute('fill', target === 'sum' ? 'var(--accent-cyan)' : 'var(--accent-amber)');
      }
    }

    if (state.kmap.mode === 'practice') {
      setupKMapPractice();
    } else {
      resetKMapLoops();
    }
  }

  // MODE toggles
  btnModeGuided.addEventListener('click', () => {
    logClick();
    playSound('click');
    state.kmap.mode = 'guided';
    btnModeGuided.classList.add('active');
    btnModePractice.classList.remove('active');
    document.getElementById('kmap-practice-mcq-container').classList.add('hidden');
    resetKMapLoops();
  });

  btnModePractice.addEventListener('click', () => {
    logClick();
    playSound('click');
    state.kmap.mode = 'practice';
    btnModeGuided.classList.remove('active');
    btnModePractice.classList.add('active');
    setupKMapPractice();
  });

  // Action buttons
  btnGroup.addEventListener('click', () => {
    logClick();
    validateKMapSelection();
  });

  btnClear.addEventListener('click', () => {
    logClick();
    playSound('click');
    state.kmap.selection = [];
    document.querySelectorAll('.kmap-cell-g').forEach(c => c.classList.remove('selected'));
    showKMapAlert("Selection cleared.");
  });

  btnReset.addEventListener('click', () => {
    logClick();
    playSound('click');
    resetKMapLoops();
    showKMapAlert("Loops reset.");
  });

  // MCQ Practice submit
  document.getElementById('btn-kmap-submit-practice').addEventListener('click', () => {
    logClick();
    submitKMapPractice();
  });

  // Circuit diagram overlay toggle
  overlayToggle.addEventListener('change', (e) => {
    logClick();
    playSound('click');
    document.body.classList.toggle('kmap-overlay-active', e.target.checked);
  });

  // Bind cell click events
  bindKMapCellClicks();

  // Initial update
  updateKMapEquation();
  updateGuidedInstructions();
}

function getCellValue(r, c) {
  const view = state.kmap.view;
  const target = state.kmap.target;
  if (view === 'ha') {
    if (target === 'sum') {
      return (r === 0 && c === 1) || (r === 1 && c === 0) ? 1 : 0;
    } else {
      return (r === 1 && c === 1) ? 1 : 0;
    }
  } else {
    if (target === 'sum') {
      return (r === 0 && c === 1) || (r === 1 && c === 0) || (r === 2 && c === 1) || (r === 3 && c === 0) ? 1 : 0;
    } else {
      return (r === 1 && c === 1) || (r === 2 && c === 0) || (r === 2 && c === 1) || (r === 3 && c === 1) ? 1 : 0;
    }
  }
}

function validateKMapSelection() {
  const selection = state.kmap.selection;
  if (selection.length === 0) {
    showKMapAlert("Select cells first!", false);
    triggerKMapFlash('flash-incorrect');
    return;
  }

  // Check if all selected cells contain 1
  for (let cell of selection) {
    if (getCellValue(cell.r, cell.c) !== 1) {
      showKMapAlert("Group must only contain cells with value 1!", false);
      triggerKMapFlash('flash-incorrect');
      if (state.soundEnabled) playSound('incorrect');
      recordStudentMistake('K-Map: Selecting Cells containing 0');
      return;
    }
  }

  const size = selection.length;
  if (size !== 1 && size !== 2 && size !== 4 && size !== 8) {
    showKMapAlert("Group size must be 1, 2, or 4 cells!", false);
    triggerKMapFlash('flash-incorrect');
    if (state.soundEnabled) playSound('incorrect');
    recordStudentMistake('K-Map: Invalid Grouping Size');
    return;
  }

  // Single cell is always valid
  if (size === 1) {
    createGroup(selection);
    return;
  }

  if (size === 2) {
    const c1 = selection[0];
    const c2 = selection[1];
    
    // Check horizontal adjacency (same row, adjacent columns)
    const isRowAdjacent = (c1.r === c2.r && Math.abs(c1.c - c2.c) === 1);
    
    // Check vertical adjacency (same column, adjacent rows considering wrapping)
    const numRows = state.kmap.view === 'ha' ? 2 : 4;
    let isColAdjacent = false;
    if (c1.c === c2.c) {
      const diff = Math.abs(c1.r - c2.r);
      if (numRows === 2) {
        isColAdjacent = (diff === 1);
      } else {
        isColAdjacent = (diff === 1 || diff === 3); // wrapping row 0 and 3
      }
    }

    if (isRowAdjacent || isColAdjacent) {
      createGroup(selection);
    } else {
      showKMapAlert("Selected cells are not adjacent!", false);
      triggerKMapFlash('flash-incorrect');
      if (state.soundEnabled) playSound('incorrect');
      recordStudentMistake('K-Map: Cells Not Adjacent');
    }
    return;
  }

  if (size === 4) {
    // Check vertical full column block
    const allSameCol = selection.every(c => c.c === selection[0].c);
    if (allSameCol && state.kmap.view === 'fa') {
      createGroup(selection);
      return;
    }

    // Check 2x2 contiguous block
    const rowsSet = new Set(selection.map(c => c.r));
    const colsSet = new Set(selection.map(c => c.c));
    if (rowsSet.size === 2 && colsSet.size === 2) {
      const rows = Array.from(rowsSet).sort((a,b)=>a-b);
      const cols = Array.from(colsSet).sort((a,b)=>a-b);
      const isColsAdjacent = Math.abs(cols[0] - cols[1]) === 1;
      const isRowsAdjacent = Math.abs(rows[0] - rows[1]) === 1 || (rows[0] === 0 && rows[1] === 3);
      if (isColsAdjacent && isRowsAdjacent) {
        createGroup(selection);
        return;
      }
    }

    showKMapAlert("Selected cells must form a contiguous 2x2 or column block!", false);
    triggerKMapFlash('flash-incorrect');
    if (state.soundEnabled) playSound('incorrect');
    recordStudentMistake('K-Map: Size 4 Group Not Contiguous');
    return;
  }
}

function getTermForGroup(cells) {
  const view = state.kmap.view;

  if (view === 'ha') {
    if (cells.length === 1) {
      const r = cells[0].r;
      const c = cells[0].c;
      const termA = c === 1 ? "A" : "A'";
      const termB = r === 1 ? "B" : "B'";
      return `${termA}·${termB}`;
    }
  } else {
    // Full Adder (Rows: AB 00, 01, 11, 10; Columns: Cin 0, 1)
    const rowAB = [
      {a: 0, b: 0},
      {a: 0, b: 1},
      {a: 1, b: 1},
      {a: 1, b: 0}
    ];

    if (cells.length === 1) {
      const r = cells[0].r;
      const c = cells[0].c;
      const ab = rowAB[r];
      const termA = ab.a === 1 ? "A" : "A'";
      const termB = ab.b === 1 ? "B" : "B'";
      const termCin = c === 1 ? "Cin" : "Cin'";
      return `${termA}·${termB}·${termCin}`;
    }

    if (cells.length === 2) {
      const r1 = cells[0].r, c1 = cells[0].c;
      const r2 = cells[1].r, c2 = cells[1].c;

      if (r1 === r2) {
        // Horizontal: Cin is eliminated
        const ab = rowAB[r1];
        const termA = ab.a === 1 ? "A" : "A'";
        const termB = ab.b === 1 ? "B" : "B'";
        return `${termA}·${termB}`;
      } else {
        // Vertical: Cin is kept, one of AB is eliminated
        const ab1 = rowAB[r1];
        const ab2 = rowAB[r2];
        const termCin = c1 === 1 ? "Cin" : "Cin'";
        
        let term = "";
        if (ab1.a === ab2.a) {
          term = ab1.a === 1 ? "A" : "A'";
        } else if (ab1.b === ab2.b) {
          term = ab1.b === 1 ? "B" : "B'";
        }
        return `${term}·${termCin}`;
      }
    }

    if (cells.length === 4) {
      const cols = Array.from(new Set(cells.map(c=>c.c)));
      const rows = Array.from(new Set(cells.map(c=>c.r)));

      if (rows.length === 4) {
        // Full column: only Cin is constant
        return cols[0] === 1 ? "Cin" : "Cin'";
      }

      if (rows.length === 2 && cols.length === 2) {
        // 2x2 block
        const ab0 = rowAB[rows[0]];
        const ab1 = rowAB[rows[1]];
        if (ab0.a === ab1.a) return ab0.a === 1 ? "A" : "A'";
        if (ab0.b === ab1.b) return ab0.b === 1 ? "B" : "B'";
      }
    }
  }
  return "";
}

function drawGroupLoop(cells, colorIndex) {
  const colors = ["#00f5d4", "#ff9f1c", "#ff007f", "#ff0055"]; // teal, orange, hotpink, neon red
  const color = colors[colorIndex % colors.length];

  const view = state.kmap.view;
  const target = state.kmap.target;
  const targetLoopsContainerId = view === 'ha' 
    ? (target === 'sum' ? 'kmap-ha-sum-loops' : 'kmap-ha-carry-loops')
    : 'kmap-fa-loops';
  
  const container = document.getElementById(targetLoopsContainerId);
  if (!container) return;

  let pathElement = document.createElementNS("http://www.w3.org/2000/svg", "path");
  pathElement.setAttribute("class", "kmap-loop-path");
  pathElement.style.setProperty("--loop-color", color);

  if (view === 'ha') {
    // 2x2 grid. Cell size 60x60, starting at X=40, Y=70
    if (cells.length === 1) {
      const r = cells[0].r;
      const c = cells[0].c;
      const x = 40 + c * 60;
      const y = 70 + r * 60;
      pathElement.setAttribute("d", `M ${x + 6} ${y + 30} A 24 24 0 1 1 ${x + 54} ${y + 30} A 24 24 0 1 1 ${x + 6} ${y + 30}`);
    } else if (cells.length === 2) {
      const r1 = cells[0].r, c1 = cells[0].c;
      const r2 = cells[1].r, c2 = cells[1].c;
      if (r1 === r2) {
        const xMin = 40 + Math.min(c1, c2) * 60;
        const y = 70 + r1 * 60;
        pathElement.setAttribute("d", `M ${xMin + 6} ${y + 30} A 24 24 0 0 1 ${xMin + 114} ${y + 30} A 24 24 0 0 1 ${xMin + 6} ${y + 30}`);
      } else {
        const x = 40 + c1 * 60;
        const yMin = 70 + Math.min(r1, r2) * 60;
        pathElement.setAttribute("d", `M ${x + 30} ${yMin + 6} A 24 24 0 0 1 ${x + 30} ${yMin + 114} A 24 24 0 0 1 ${x + 30} ${yMin + 6}`);
      }
    }
  } else {
    // Full Adder 4x2 grid. Cell W=100, H=60, starting at X=120, Y=65
    if (cells.length === 1) {
      const r = cells[0].r;
      const c = cells[0].c;
      const x = 120 + c * 100;
      const y = 65 + r * 60;
      pathElement.setAttribute("d", `M ${x + 8} ${y + 30} A 22 22 0 0 1 ${x + 92} ${y + 30} A 22 22 0 0 1 ${x + 8} ${y + 30}`);
    } else if (cells.length === 2) {
      const r1 = cells[0].r, c1 = cells[0].c;
      const r2 = cells[1].r, c2 = cells[1].c;
      if (r1 === r2) {
        const xMin = 120 + Math.min(c1, c2) * 100;
        const y = 65 + r1 * 60;
        pathElement.setAttribute("d", `M ${xMin + 8} ${y + 30} A 22 22 0 0 1 ${xMin + 192} ${y + 30} A 22 22 0 0 1 ${xMin + 8} ${y + 30}`);
      } else {
        const diff = Math.abs(r1 - r2);
        const xCol = 120 + c1 * 100;
        if (diff === 3) {
          // Wrap-around split loop!
          pathElement.setAttribute("d", `M ${xCol + 8} ${65 + 25} L ${xCol + 8} ${65 + 8} A 22 22 0 0 1 ${xCol + 92} ${65 + 8} L ${xCol + 92} ${65 + 25} M ${xCol + 8} ${245 + 35} L ${xCol + 8} ${245 + 52} A 22 22 0 0 0 ${xCol + 92} ${245 + 52} L ${xCol + 92} ${245 + 35}`);
        } else {
          const yMin = 65 + Math.min(r1, r2) * 60;
          pathElement.setAttribute("d", `M ${xCol + 8} ${yMin + 30} A 22 22 0 0 1 ${xCol + 92} ${yMin + 90} A 22 22 0 0 1 ${xCol + 8} ${yMin + 30}`);
        }
      }
    } else if (cells.length === 4) {
      const rows = Array.from(new Set(cells.map(c=>c.r))).sort((a,b)=>a-b);
      const cols = Array.from(new Set(cells.map(c=>c.c))).sort((a,b)=>a-b);
      if (rows.length === 4) {
        // Full column
        const xCol = 120 + cols[0] * 100;
        pathElement.setAttribute("d", `M ${xCol + 8} ${65 + 30} L ${xCol + 8} ${65 + 8} A 22 22 0 0 1 ${xCol + 92} ${65 + 8} L ${xCol + 92} ${245 + 52} A 22 22 0 0 1 ${xCol + 8} ${245 + 52} Z`);
      } else {
        const xMin = 120 + cols[0] * 100;
        const yMin = 65 + rows[0] * 60;
        if (rows[0] === 0 && rows[1] === 3) {
          // Wrap-around quad
          pathElement.setAttribute("d", `M ${xMin + 8} ${65 + 25} L ${xMin + 8} ${65 + 8} A 22 22 0 0 1 ${xMin + 192} ${65 + 8} L ${xMin + 192} ${65 + 25} M ${xMin + 8} ${245 + 35} L ${xMin + 8} ${245 + 52} A 22 22 0 0 0 ${xMin + 192} ${245 + 52} L ${xMin + 192} ${245 + 35}`);
        } else {
          pathElement.setAttribute("d", `M ${xMin + 8} ${yMin + 30} A 22 22 0 0 1 ${xMin + 192} ${yMin + 30} L ${xMin + 192} ${yMin + 90} A 22 22 0 0 1 ${xMin + 8} ${yMin + 90} Z`);
        }
      }
    }
  }

  container.appendChild(pathElement);
}

function checkGuidedStep(selection, term) {
  const target = state.kmap.target;
  const view = state.kmap.view;
  const step = state.kmap.guidedStep;

  if (view === 'ha') {
    if (target === 'carry') {
      if (selection.length === 1 && selection[0].r === 1 && selection[0].c === 1) {
        showKMapAlert("Correct! You grouped the cell (A=1, B=1).", true);
        triggerKMapFlash('flash-correct');
        return true;
      } else {
        showKMapAlert("Select the single cell where A=1 and B=1 (bottom-right cell).", false);
        return false;
      }
    } else {
      if (selection.length === 2) {
        showKMapAlert("Diagonal grouping is not allowed! Select and group each cell individually.", false);
        return false;
      }
      if (selection.length === 1) {
        const r = selection[0].r, c = selection[0].c;
        if ((r === 0 && c === 1) || (r === 1 && c === 0)) {
          const already = state.kmap.groups.some(g => g.cells[0].r === r && g.cells[0].c === c);
          if (already) {
            showKMapAlert("This cell is already grouped!", false);
            return false;
          }
          showKMapAlert(`Correct! You grouped cell (${r === 0 ? "A=1, B=0" : "A=0, B=1"}) individually.`, true);
          triggerKMapFlash('flash-correct');
          return true;
        }
      }
      showKMapAlert("Select one of the '1' cells to group it individually.", false);
      return false;
    }
  } else {
    // Full Adder
    if (target === 'carry') {
      if (step === 0) {
        // Target is horizontal pair AB=11: cells (2,0) and (2,1)
        const isTarget = selection.length === 2 && 
                         selection.some(s => s.r === 2 && s.c === 0) && 
                         selection.some(s => s.r === 2 && s.c === 1);
        if (isTarget) {
          showKMapAlert("Correct! You found the horizontal pair for AB=11. It simplifies to A·B.", true);
          triggerKMapFlash('flash-correct');
          state.kmap.guidedStep = 1;
          return true;
        } else {
          showKMapAlert("Select the horizontal pair in row AB=11 (representing A=1, B=1).", false);
          return false;
        }
      } else if (step === 1) {
        // Target is vertical pair Cin=1, B=1: cells (1,1) and (2,1)
        const isTarget = selection.length === 2 && 
                         selection.some(s => s.r === 1 && s.c === 1) && 
                         selection.some(s => s.r === 2 && s.c === 1);
        if (isTarget) {
          showKMapAlert("Correct! You found the vertical pair representing B·Cin.", true);
          triggerKMapFlash('flash-correct');
          state.kmap.guidedStep = 2;
          return true;
        } else {
          showKMapAlert("Select the vertical pair in column Cin=1 representing B=1 (rows AB=01 and AB=11).", false);
          return false;
        }
      } else if (step === 2) {
        // Target is vertical pair Cin=1, A=1: cells (2,1) and (3,1)
        const isTarget = selection.length === 2 && 
                         selection.some(s => s.r === 2 && s.c === 1) && 
                         selection.some(s => s.r === 3 && s.c === 1);
        if (isTarget) {
          showKMapAlert("Correct! You found the vertical pair representing A·Cin.", true);
          triggerKMapFlash('flash-correct');
          state.kmap.guidedStep = 3;
          return true;
        } else {
          showKMapAlert("Select the vertical pair in column Cin=1 representing A=1 (rows AB=11 and AB=10).", false);
          return false;
        }
      }
    } else {
      // SUM: 4 individual cells
      if (selection.length > 1) {
        showKMapAlert("No groupings are possible on this checkerboard map! Select and group each cell individually.", false);
        return false;
      }
      if (selection.length === 1) {
        const r = selection[0].r, c = selection[0].c;
        const isValidSumCell = (r === 0 && c === 1) || (r === 1 && c === 0) || (r === 2 && c === 1) || (r === 3 && c === 0);
        if (isValidSumCell) {
          const already = state.kmap.groups.some(g => g.cells[0].r === r && g.cells[0].c === c);
          if (already) {
            showKMapAlert("This cell is already grouped!", false);
            return false;
          }
          showKMapAlert("Correct! Cell grouped individually.", true);
          triggerKMapFlash('flash-correct');
          return true;
        }
      }
      showKMapAlert("Select one of the '1' cells to group it individually.", false);
      return false;
    }
  }
  return false;
}

function createGroup(selection) {
  const term = getTermForGroup(selection);
  
  if (state.kmap.mode === 'guided') {
    const isCorrect = checkGuidedStep(selection, term);
    if (!isCorrect) {
      if (state.soundEnabled) playSound('incorrect');
      triggerKMapFlash('flash-incorrect');
      return;
    }
  }

  // Push valid group
  state.kmap.groups.push({
    cells: [...selection],
    term: term
  });

  if (state.soundEnabled) playSound('correct');
  
  // Clean up selected styles
  selection.forEach(cellCoords => {
    const cellEl = findCellElement(cellCoords);
    if (cellEl) {
      cellEl.classList.remove('selected');
      cellEl.classList.add('grouped');
    }
  });

  // Render SVG loop path
  const colorIndex = state.kmap.groups.length - 1;
  drawGroupLoop(selection, colorIndex);

  state.kmap.selection = [];
  updateKMapEquation();
  updateGuidedInstructions();
  checkKMapCompletion();
}

function findCellElement(coords) {
  const view = state.kmap.view;
  const target = state.kmap.target;
  if (view === 'ha') {
    const mapName = target === 'sum' ? 'ha-sum' : 'ha-carry';
    return document.querySelector(`.kmap-cell-g[data-map="${mapName}"][data-row="${coords.r}"][data-col="${coords.c}"]`);
  } else {
    return document.querySelector(`.kmap-cell-g[data-map="fa"][data-row="${coords.r}"][data-col="${coords.c}"]`);
  }
}

function updateKMapEquation() {
  const view = state.kmap.view;
  const target = state.kmap.target;
  const groups = state.kmap.groups;

  let lhs = "";
  if (view === 'ha') {
    lhs = target === 'sum' ? "SUM (S) = " : "CARRY (C) = ";
  } else {
    lhs = target === 'sum' ? "SUM (S) = " : "C<sub>out</sub> = ";
  }
  document.getElementById('kmap-eq-lhs').innerHTML = lhs;

  if (groups.length === 0) {
    document.getElementById('kmap-eq-rhs').innerText = "...";
    return;
  }

  let termsHtml = groups.map(g => `<span class="formula-term">${g.term}</span>`).join(" + ");
  
  if (view === 'ha' && target === 'sum' && groups.length === 2) {
    termsHtml += ` <span class="formula-term" style="color: var(--accent-amber);">→ A ⊕ B</span>`;
  }
  if (view === 'fa' && target === 'sum' && groups.length === 4) {
    termsHtml += ` <span class="formula-term" style="color: var(--accent-amber);">→ A ⊕ B ⊕ Cin</span>`;
  }

  document.getElementById('kmap-eq-rhs').innerHTML = termsHtml;
}

function updateGuidedInstructions() {
  const view = state.kmap.view;
  const target = state.kmap.target;
  const step = state.kmap.guidedStep;
  const numGroups = state.kmap.groups.length;

  let title = "Guided Task";
  let instructions = "";

  if (state.kmap.mode === 'practice') {
    title = "Practice Mode";
    instructions = "Define your loops by selecting adjacent 1-cells, click 'Group Selection', then pick the correct simplified Boolean expression below.";
    document.getElementById('kmap-step-title').innerText = title;
    document.getElementById('kmap-instructions').innerText = instructions;
    return;
  }

  if (view === 'ha') {
    if (target === 'carry') {
      if (numGroups === 0) {
        instructions = "Select the single cell where A=1 and B=1 (bottom-right cell) and click 'Group Selection'.";
      } else {
        instructions = "Great! You derived C = A·B. Carry K-map is complete!";
      }
    } else {
      if (numGroups === 0) {
        instructions = "Group the cell at row B=0, col A=1 (representing A·B') individually.";
      } else if (numGroups === 1) {
        instructions = "Now group the other '1' cell at row B=1, col A=0 (representing A'·B) individually.";
      } else {
        instructions = "Excellent! You derived SUM = A·B' + A'·B. Since they are diagonal, no simplification is possible, so SUM remains as A ⊕ B.";
      }
    }
  } else {
    if (target === 'carry') {
      if (step === 0) {
        instructions = "Step 1/3: Select the horizontal pair of 1s in row AB=11 (representing A=1, B=1) and click 'Group Selection'.";
      } else if (step === 1) {
        instructions = "Step 2/3: Now select the vertical pair of 1s in column Cin=1 representing B=1 (rows AB=01 and AB=11) and click 'Group Selection'.";
      } else if (step === 2) {
        instructions = "Step 3/3: Finally, select the vertical pair of 1s in column Cin=1 representing A=1 (rows AB=11 and AB=10) and click 'Group Selection'.";
      } else {
        instructions = "Success! You found all 3 loops. These represent the terms AB, BCin, and ACin. Thus Cout = AB + BCin + ACin. They overlap beautifully!";
      }
    } else {
      if (numGroups < 4) {
        instructions = `Group each of the four '1' cells individually. (${numGroups}/4 grouped). Click a cell and click 'Group Selection'.`;
      } else {
        instructions = "Success! You grouped all 4 cells. In this checkerboard pattern, no adjacency simplification is possible. Thus SUM stays as A ⊕ B ⊕ Cin.";
      }
    }
  }

  document.getElementById('kmap-step-title').innerText = title;
  document.getElementById('kmap-instructions').innerText = instructions;
}

function checkKMapCompletion() {
  const view = state.kmap.view;
  const target = state.kmap.target;
  const numGroups = state.kmap.groups.length;

  if (state.kmap.mode === 'guided') {
    let done = false;
    if (view === 'ha') {
      if (target === 'carry' && numGroups === 1) done = true;
      if (target === 'sum' && numGroups === 2) done = true;
    } else {
      if (target === 'carry' && state.kmap.guidedStep === 3) done = true;
      if (target === 'sum' && numGroups === 4) done = true;
    }

    if (done) {
      completeModule('module-kmap');
    }
  }
}

function setupKMapPractice() {
  resetKMapLoops();
  state.kmap.selectedChoiceIdx = -1;

  const view = state.kmap.view;
  const target = state.kmap.target;
  
  document.getElementById('kmap-practice-mcq-container').classList.remove('hidden');
  document.getElementById('btn-kmap-submit-practice').disabled = true;

  let choices = [];
  let correctIdx = 0;

  if (view === 'ha') {
    if (target === 'carry') {
      choices = [
        "C = A·B",
        "C = A + B",
        "C = A'·B",
        "C = A ⊕ B"
      ];
    } else {
      choices = [
        "S = A ⊕ B",
        "S = A·B",
        "S = A + B",
        "S = A'·B'"
      ];
    }
  } else {
    if (target === 'carry') {
      choices = [
        "Cout = A·B + B·Cin + A·Cin",
        "Cout = A·B·Cin",
        "Cout = A·B + Cin",
        "Cout = A + B + Cin"
      ];
    } else {
      choices = [
        "SUM = A ⊕ B ⊕ Cin",
        "SUM = A·B + B·Cin + A·Cin",
        "SUM = A·B·Cin",
        "SUM = A'·B'·Cin + A·B"
      ];
    }
  }

  const correctText = choices[0];
  state.kmap.practiceChoices = shuffleArray([...choices]);
  state.kmap.correctChoiceIdx = state.kmap.practiceChoices.indexOf(correctText);

  const container = document.getElementById('kmap-mcq-options');
  container.innerHTML = "";
  state.kmap.practiceChoices.forEach((choice, idx) => {
    const btn = document.createElement('button');
    btn.className = "mcq-btn";
    btn.innerHTML = choice.replace(/Cin/g, "C<sub>in</sub>");
    btn.addEventListener('click', () => {
      logClick();
      playSound('click');
      selectMCQOption(idx);
    });
    container.appendChild(btn);
  });

  updateGuidedInstructions();
}

function selectMCQOption(idx) {
  state.kmap.selectedChoiceIdx = idx;
  const buttons = document.querySelectorAll('#kmap-mcq-options .mcq-btn');
  buttons.forEach((btn, i) => {
    btn.classList.toggle('selected', i === idx);
  });
  document.getElementById('btn-kmap-submit-practice').disabled = false;
}

function submitKMapPractice() {
  const selected = state.kmap.selectedChoiceIdx;
  const correct = state.kmap.correctChoiceIdx;

  if (selected === correct) {
    const view = state.kmap.view;
    const target = state.kmap.target;
    const numGroups = state.kmap.groups.length;
    let expectedGroups = 1;
    if (view === 'ha' && target === 'sum') expectedGroups = 2;
    if (view === 'fa' && target === 'carry') expectedGroups = 3;
    if (view === 'fa' && target === 'sum') expectedGroups = 4;

    if (numGroups < expectedGroups) {
      showKMapAlert(`Equation is correct, but you have only grouped ${numGroups}/${expectedGroups} loops! Find all groups on the map first for full credit.`, false);
      triggerKMapFlash('flash-incorrect');
      if (state.soundEnabled) playSound('incorrect');
      recordStudentMistake('K-Map: Incomplete Grouping Loops');
      return;
    }

    showKMapAlert("Correct! You solved the K-map and selected the minimal Boolean equation.", true);
    triggerKMapFlash('flash-correct');
    if (state.soundEnabled) playSound('correct');
    completeModule('module-kmap');
  } else {
    showKMapAlert("Incorrect equation selection. Review your groupings and try again!", false);
    triggerKMapFlash('flash-incorrect');
    if (state.soundEnabled) playSound('incorrect');
    recordStudentMistake('K-Map: Incorrect Equation Option');
  }
}

function shuffleArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

function resetKMapLoops() {
  state.kmap.groups = [];
  state.kmap.selection = [];
  state.kmap.guidedStep = 0;

  const containers = ['kmap-ha-sum-loops', 'kmap-ha-carry-loops', 'kmap-fa-loops'];
  containers.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.innerHTML = "";
  });

  const cells = document.querySelectorAll('.kmap-cell-g');
  cells.forEach(cell => {
    cell.classList.remove('selected', 'grouped');
  });

  updateKMapEquation();
  updateGuidedInstructions();
}

function bindKMapCellClicks() {
  const cells = document.querySelectorAll('.kmap-cell-g');
  cells.forEach(cell => {
    cell.addEventListener('click', (e) => {
      const mapName = cell.getAttribute('data-map');
      const view = state.kmap.view;
      const target = state.kmap.target;

      if (view === 'ha') {
        const expectedMap = target === 'sum' ? 'ha-sum' : 'ha-carry';
        if (mapName !== expectedMap) return;
      } else {
        if (mapName !== 'fa') return;
      }

      const r = parseInt(cell.getAttribute('data-row'));
      const c = parseInt(cell.getAttribute('data-col'));

      logClick();
      playSound('click');

      const index = state.kmap.selection.findIndex(s => s.r === r && s.c === c);
      if (index !== -1) {
        state.kmap.selection.splice(index, 1);
        cell.classList.remove('selected');
      } else {
        state.kmap.selection.push({ r, c });
        cell.classList.add('selected');
      }
    });
  });
}

function showKMapAlert(msg, isSuccess = true) {
  const box = document.getElementById('kmap-alert-box');
  if (!box) return;
  box.innerText = msg;
  box.className = `feedback-text ${isSuccess ? 'success' : 'error'}`;
}

function triggerKMapFlash(className) {
  const alertBox = document.getElementById('kmap-alert-box');
  if (!alertBox) return;
  alertBox.classList.add(className);
  setTimeout(() => alertBox.classList.remove(className), 400);
}

// MODULE 8: LOGIC ARCADE (PRACTICE)
function initArcadeModule() {
  const predictBtn = document.getElementById('btn-mode-predict');
  const tableBtn = document.getElementById('btn-mode-table');
  const timeBtn = document.getElementById('btn-mode-time');

  // Mode select events
  predictBtn.addEventListener('click', () => { selectArcadeMode('predict'); });
  tableBtn.addEventListener('click', () => { selectArcadeMode('table'); });
  timeBtn.addEventListener('click', () => { selectArcadeMode('time'); });

  // Quiz submission buttons
  document.getElementById('btn-predict-s').addEventListener('click', () => togglePredictLed('s'));
  document.getElementById('btn-predict-c').addEventListener('click', () => togglePredictLed('c'));
  document.getElementById('btn-predict-submit').addEventListener('click', verifyPredictAnswer);
  document.getElementById('btn-predict-next').addEventListener('click', setupPredictQuestion);

  document.getElementById('btn-table-verify').addEventListener('click', verifyTableAnswer);
  document.getElementById('btn-table-new').addEventListener('click', setupTableQuestion);

  document.getElementById('btn-time-start').addEventListener('click', startTimedRun);

  // Load highscore
  const cachedHigh = localStorage.getItem('arcade_highscore') || 0;
  state.arcade.highScore = parseInt(cachedHigh);
  document.getElementById('arcade-highscore').innerText = state.arcade.highScore;

  // Initialize view state (hidden initially)
  const examInitPanel = document.getElementById('exam-initiation-panel');
  const arcadeMainContainer = document.getElementById('arcade-main-container');
  const examStatusBar = document.getElementById('exam-status-bar');
  const examWarningModal = document.getElementById('exam-warning-modal');
  const examResultOverlay = document.getElementById('exam-result-overlay');
  const arcadeStepFooter = document.getElementById('arcade-step-footer');

  if (examInitPanel) examInitPanel.classList.remove('hidden');
  if (arcadeMainContainer) arcadeMainContainer.classList.add('hidden');
  if (examStatusBar) examStatusBar.classList.add('hidden');
  if (examResultOverlay) examResultOverlay.classList.add('hidden');

  // ==================== EXAM MODE PROCTORING CONTROLLER ====================
  const btnStartExam = document.getElementById('btn-start-exam');
  const btnResumeExam = document.getElementById('btn-resume-exam');
  const btnFinishReturn = document.getElementById('btn-finish-exam-return');

  function enterFullscreen() {
    const elem = document.documentElement;
    if (elem.requestFullscreen) {
      elem.requestFullscreen().catch(err => console.log(err));
    } else if (elem.webkitRequestFullscreen) {
      elem.webkitRequestFullscreen();
    } else if (elem.msRequestFullscreen) {
      elem.msRequestFullscreen();
    }
  }

  if (btnStartExam) {
    btnStartExam.addEventListener('click', () => {
      logClick();
      playSound('click');
      
      state.exam.isActive = true;
      state.exam.timeLeft = 600; // 10 minutes
      state.exam.violations = 0;
      state.arcade.score = 0;
      state.arcade.streak = 0;
      
      document.getElementById('arcade-score').innerText = '0';
      document.getElementById('arcade-streak').innerText = '0';
      document.getElementById('exam-violations-val').innerText = '0 / 3';
      document.getElementById('exam-current-score').innerText = '0';

      enterFullscreen();

      if (examInitPanel) examInitPanel.classList.add('hidden');
      if (arcadeMainContainer) arcadeMainContainer.classList.remove('hidden');
      if (examStatusBar) examStatusBar.classList.remove('hidden');
      if (arcadeStepFooter) arcadeStepFooter.classList.add('hidden');
      
      const moduleArcade = document.getElementById('module-arcade');
      if (moduleArcade) moduleArcade.classList.add('exam-active');

      if (state.exam.timerId) clearInterval(state.exam.timerId);
      state.exam.timerId = setInterval(updateExamTimer, 1000);
      
      selectArcadeMode('predict');
    });
  }

  if (btnResumeExam) {
    btnResumeExam.addEventListener('click', () => {
      logClick();
      playSound('click');
      enterFullscreen();
      if (examWarningModal) examWarningModal.classList.add('hidden');
    });
  }

  if (btnFinishReturn) {
    btnFinishReturn.addEventListener('click', () => {
      logClick();
      playSound('click');
      if (examResultOverlay) examResultOverlay.classList.add('hidden');
      if (examInitPanel) examInitPanel.classList.remove('hidden');
      if (arcadeStepFooter) arcadeStepFooter.classList.remove('hidden');
      state.completedModules.add('module-arcade');
      updateProgressUI();
    });
  }

  function updateExamTimer() {
    if (!state.exam.isActive) return;

    state.exam.timeLeft--;
    
    const minutes = Math.floor(state.exam.timeLeft / 60);
    const seconds = state.exam.timeLeft % 60;
    const timeStr = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    
    const timerValEl = document.getElementById('exam-timer-val');
    if (timerValEl) timerValEl.innerText = timeStr;

    if (state.exam.timeLeft <= 0) {
      endExam(false);
    }
  }

  function triggerExamViolation(reason) {
    if (!state.exam.isActive) return;

    state.exam.violations++;
    playSound('incorrect');

    recordStudentMistake(`Exam Violation: ${reason}`);

    const violationsValEl = document.getElementById('exam-violations-val');
    const violationsCountEl = document.getElementById('exam-violations-count');
    
    if (violationsValEl) violationsValEl.innerText = `${state.exam.violations} / 3`;
    if (violationsCountEl) violationsCountEl.innerText = `${state.exam.violations} / 3`;

    if (state.exam.violations > 3) {
      endExam(true);
    } else {
      const warningMsgEl = document.getElementById('exam-warning-msg');
      if (warningMsgEl) warningMsgEl.innerText = `Proctoring Alert: ${reason}. Exit from fullscreen or tab switching is forbidden.`;
      if (examWarningModal) examWarningModal.classList.remove('hidden');
    }
  }

  function endExam(isViolated) {
    state.exam.isActive = false;
    if (state.exam.timerId) {
      clearInterval(state.exam.timerId);
      state.exam.timerId = null;
    }

    try {
      if (document.exitFullscreen && document.fullscreenElement) {
        document.exitFullscreen();
      }
    } catch (e) {
      console.log(e);
    }

    if (arcadeMainContainer) arcadeMainContainer.classList.add('hidden');
    if (examStatusBar) examStatusBar.classList.add('hidden');
    if (examWarningModal) examWarningModal.classList.add('hidden');

    const moduleArcade = document.getElementById('module-arcade');
    if (moduleArcade) moduleArcade.classList.remove('exam-active');

    const finalScore = state.arcade.score;
    const finalHigh = Math.max(state.arcade.highScore, finalScore);
    state.arcade.highScore = finalHigh;
    localStorage.setItem('arcade_highscore', finalHigh);
    document.getElementById('arcade-highscore').innerText = finalHigh;

    const totalAttempts = state.correctCount + state.exam.violations;
    const accuracy = totalAttempts > 0 ? Math.round((state.correctCount / totalAttempts) * 100) : 100;

    document.getElementById('exam-res-score').innerText = finalScore;
    document.getElementById('exam-res-accuracy').innerText = `${accuracy}%`;
    document.getElementById('exam-res-clicks').innerText = state.clicksCount;
    document.getElementById('exam-res-faults').innerText = state.exam.violations;

    const resTitle = document.getElementById('exam-result-title');
    const resMsg = document.getElementById('exam-result-msg');
    const resBadge = document.getElementById('exam-result-badge');

    if (isViolated) {
      resTitle.innerText = "Exam Terminated (Security Fault)";
      resTitle.style.color = "#ff0055";
      resMsg.innerText = "Proctoring checks logged more than 3 violations. Access terminated. Your last score has been recorded.";
      resBadge.innerText = "❌";
      recordStudentMistake("Exam: Terminated due to Security Violation limit");
    } else {
      resTitle.innerText = "Exam Completed Successfully";
      resTitle.style.color = "var(--accent-cyan)";
      resMsg.innerText = "Your assessment details have been written to the database roster.";
      resBadge.innerText = "🏆";
      completeModule('module-arcade');
    }

    if (state.currentUser && state.currentUser !== 'Guest') {
      let registry = JSON.parse(localStorage.getItem('logic_adder_students') || '[]');
      let idx = registry.findIndex(s => s.rollNo === state.currentRoll);
      if (idx !== -1) {
        registry[idx].clicksCount = state.clicksCount;
        registry[idx].correctCount = state.correctCount;
        registry[idx].accuracy = accuracy;
        registry[idx].lastActive = getFormattedDate();
        if (!isViolated) {
          if (!registry[idx].completedModules.includes('module-arcade')) {
            registry[idx].completedModules.push('module-arcade');
          }
          registry[idx].completionPct = Math.round((registry[idx].completedModules.length / 8) * 100);
        }
        localStorage.setItem('logic_adder_students', JSON.stringify(registry));
      }
    }

    if (examResultOverlay) examResultOverlay.classList.remove('hidden');
  }

  document.addEventListener('fullscreenchange', () => {
    if (state.exam.isActive && !document.fullscreenElement) {
      triggerExamViolation('Exited fullscreen mode');
    }
  });

  document.addEventListener('visibilitychange', () => {
    if (state.exam.isActive && document.hidden) {
      triggerExamViolation('Swapped browser tab/minimized');
    }
  });

  window.addEventListener('blur', () => {
    if (state.exam.isActive) {
      triggerExamViolation('Window focus lost (possible Google Lens scan)');
    }
  });

  document.addEventListener('copy', (e) => {
    if (state.exam.isActive) {
      e.preventDefault();
      triggerExamViolation('Copy attempt detected');
    }
  });

  document.addEventListener('contextmenu', (e) => {
    if (state.exam.isActive) {
      e.preventDefault();
      triggerExamViolation('Right-click context menu (possible Google Lens scan)');
    }
  });

  document.addEventListener('dragstart', (e) => {
    if (state.exam.isActive) {
      e.preventDefault();
      triggerExamViolation('Element drag attempt');
    }
  });

  document.addEventListener('keydown', (e) => {
    if (!state.exam.isActive) return;

    if (e.key === 'PrintScreen' || e.keyCode === 44) {
      e.preventDefault();
      triggerExamViolation('Screenshot key (PrintScreen) pressed');
    }

    if (e.metaKey && e.shiftKey && (e.key === 'S' || e.key === 's')) {
      triggerExamViolation('Screenshot shortcut (Win+Shift+S) pressed');
    }

    if (e.ctrlKey && (e.key === 'p' || e.key === 'P')) {
      e.preventDefault();
      triggerExamViolation('Print/screenshot attempt');
    }

    if (e.ctrlKey && (e.key === 'c' || e.key === 'C' || e.key === 'x' || e.key === 'X')) {
      e.preventDefault();
      triggerExamViolation('Keyboard copy/cut shortcut');
    }

    if (e.key === 'F12' || (e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'i'))) {
      e.preventDefault();
      triggerExamViolation('Dev tools access blocked');
    }
  });
}

function selectArcadeMode(mode) {
  logClick();
  playSound('click');

  // Stop running timers
  if (state.arcade.timer.intervalId) {
    clearInterval(state.arcade.timer.intervalId);
    state.arcade.timer.active = false;
  }

  // UI button updates
  document.getElementById('btn-mode-predict').classList.toggle('active', mode === 'predict');
  document.getElementById('btn-mode-table').classList.toggle('active', mode === 'table');
  document.getElementById('btn-mode-time').classList.toggle('active', mode === 'time');

  // Panels visible updates
  document.getElementById('game-panel-predict').classList.toggle('active', mode === 'predict');
  document.getElementById('game-panel-table').classList.toggle('active', mode === 'table');
  document.getElementById('game-panel-time').classList.toggle('active', mode === 'time');

  state.arcade.mode = mode;

  // Initialize specific game variables
  if (mode === 'predict') setupPredictQuestion();
  else if (mode === 'table') setupTableQuestion();
  else if (mode === 'time') resetTimedGame();
}

function addScore(points) {
  // Streak multiplier calculations
  let mult = 1;
  if (state.arcade.streak >= 8) mult = 4;
  else if (state.arcade.streak >= 5) mult = 3;
  else if (state.arcade.streak >= 3) mult = 2;

  const scoreAdd = points * mult;
  state.arcade.score += scoreAdd;
  state.correctCount++;

  if (state.arcade.score > state.arcade.highScore) {
    state.arcade.highScore = state.arcade.score;
    localStorage.setItem('arcade_highscore', state.arcade.highScore);
  }

  document.getElementById('arcade-score').innerText = state.arcade.score;
  document.getElementById('arcade-highscore').innerText = state.arcade.highScore;
  const curScoreEl = document.getElementById('exam-current-score');
  if (curScoreEl) curScoreEl.innerText = state.arcade.score;
  updateMasteryStats();
}

// GAME 1: PREDICT OUTPUT ACTIONS
function setupPredictQuestion() {
  const isFull = Math.random() > 0.5;
  state.arcade.predict.isFull = isFull;
  state.arcade.predict.a = Math.random() > 0.5 ? 1 : 0;
  state.arcade.predict.b = Math.random() > 0.5 ? 1 : 0;
  state.arcade.predict.cin = isFull ? (Math.random() > 0.5 ? 1 : 0) : 0;
  state.arcade.predict.selectedS = 0;
  state.arcade.predict.selectedC = 0;
  state.arcade.predict.answered = false;

  // Labels update
  document.getElementById('predict-gate-type').innerText = isFull ? 'FULL ADDER' : 'HALF ADDER';
  document.getElementById('predict-val-a').innerText = state.arcade.predict.a;
  document.getElementById('predict-val-b').innerText = state.arcade.predict.b;
  
  const cinRow = document.getElementById('predict-cin-row');
  if (isFull) {
    cinRow.style.display = 'block';
    document.getElementById('predict-val-cin').innerText = state.arcade.predict.cin;
  } else {
    cinRow.style.display = 'none';
  }

  // Reset LED values
  document.getElementById('btn-predict-s').classList.remove('active');
  document.getElementById('btn-predict-c').classList.remove('active');
  document.getElementById('predict-val-s-lbl').innerText = '0';
  document.getElementById('predict-val-c-lbl').innerText = '0';

  // Feedback elements
  document.getElementById('predict-feedback-msg').innerText = '';
  document.getElementById('predict-feedback-msg').className = 'feedback-text';
  document.getElementById('btn-predict-submit').classList.remove('hidden');
  document.getElementById('btn-predict-next').classList.add('hidden');
}

function togglePredictLed(ledType) {
  if (state.arcade.predict.answered) return;
  playSound('click');
  
  if (ledType === 's') {
    state.arcade.predict.selectedS = state.arcade.predict.selectedS ? 0 : 1;
    document.getElementById('btn-predict-s').classList.toggle('active', state.arcade.predict.selectedS === 1);
    document.getElementById('predict-val-s-lbl').innerText = state.arcade.predict.selectedS;
  } else {
    state.arcade.predict.selectedC = state.arcade.predict.selectedC ? 0 : 1;
    document.getElementById('btn-predict-c').classList.toggle('active', state.arcade.predict.selectedC === 1);
    document.getElementById('predict-val-c-lbl').innerText = state.arcade.predict.selectedC;
  }
}

function verifyPredictAnswer() {
  const p = state.arcade.predict;
  const expectedSum = p.a ^ p.b ^ p.cin;
  const expectedCarry = p.isFull ? ((p.a & p.b) | (p.cin & (p.a ^ p.b))) : (p.a & p.b);

  const correct = (p.selectedS === expectedSum && p.selectedC === expectedCarry);
  p.answered = true;

  const fMsg = document.getElementById('predict-feedback-msg');
  const panel = document.getElementById('game-panel-predict');

  if (correct) {
    playSound('correct');
    state.arcade.streak++;
    fMsg.innerText = `CORRECT! +10 Points (Streak: ${state.arcade.streak})`;
    fMsg.className = 'feedback-text correct';
    addScore(10);
    panel.classList.add('flash-correct');
    setTimeout(() => panel.classList.remove('flash-correct'), 400);
  } else {
    playSound('incorrect');
    state.arcade.streak = 0;
    recordStudentMistake('Arcade: Incorrect Output Prediction');
    
    // Context feedback explanations
    let hint = "";
    if (p.isFull) {
      hint = `Expected: SUM=${expectedSum}, CARRY=${expectedCarry}. CARRY is 1 when at least TWO inputs are 1.`;
    } else {
      hint = `Expected: SUM=${expectedSum}, CARRY=${expectedCarry}. XOR outputs 1 when inputs are DIFFERENT.`;
    }
    
    fMsg.innerText = `WRONG. ${hint}`;
    fMsg.className = 'feedback-text incorrect';
    panel.classList.add('flash-incorrect');
    setTimeout(() => panel.classList.remove('flash-incorrect'), 400);
  }

  document.getElementById('arcade-streak').innerText = state.arcade.streak;
  document.getElementById('btn-predict-submit').classList.add('hidden');
  document.getElementById('btn-predict-next').classList.remove('hidden');

  // Completed Arcade benchmark check
  if (state.arcade.score >= 100) {
    completeModule('module-arcade');
  }
}

// GAME 2: TRUTH TABLE COMPLETION
function setupTableQuestion() {
  const isFull = Math.random() > 0.5;
  state.arcade.table.isFull = isFull;
  state.arcade.table.userCells = {};
  state.arcade.table.targetAnswers = {};

  const tableEl = document.getElementById('arcade-fill-table');
  tableEl.innerHTML = '';

  const header = document.createElement('thead');
  header.innerHTML = isFull 
    ? '<tr><th>A</th><th>B</th><th>C<sub>in</sub></th><th>SUM</th><th>C<sub>out</sub></th></tr>'
    : '<tr><th>A</th><th>B</th><th>SUM</th><th>CARRY</th></tr>';
  tableEl.appendChild(header);

  const tbody = document.createElement('tbody');
  const rowsCount = isFull ? 8 : 4;

  // We randomly choose 3 cells to blank out and ask the user to fill in
  const blankCells = [];
  while (blankCells.length < 3) {
    const r = Math.floor(Math.random() * rowsCount);
    const c = Math.floor(Math.random() * 2); // 0 = SUM, 1 = CARRY/Cout
    const key = `${r}-${c}`;
    if (!blankCells.includes(key)) {
      blankCells.push(key);
    }
  }

  for (let r = 0; r < rowsCount; r++) {
    const a = (r >> 1) & 1;
    const b = r & 1;
    const cin = isFull ? ((r >> 2) & 1) : 0;

    const correctSum = a ^ b ^ cin;
    const correctCarry = isFull ? ((a & b) | (cin & (a ^ b))) : (a & b);

    const row = document.createElement('tr');
    
    // Input Columns
    let rowHtml = `<td>${a}</td><td>${b}</td>`;
    if (isFull) rowHtml += `<td>${cin}</td>`;
    row.innerHTML = rowHtml;

    // SUM Cell
    const cellSum = document.createElement('td');
    const keyS = `${r}-0`;
    state.arcade.table.targetAnswers[keyS] = correctSum;

    if (blankCells.includes(keyS)) {
      cellSum.className = 'input-cell cell-unset';
      cellSum.innerText = '?';
      cellSum.addEventListener('click', () => toggleTableCell(cellSum, keyS));
      state.arcade.table.userCells[keyS] = null;
    } else {
      cellSum.innerText = correctSum;
      cellSum.style.opacity = 0.7;
    }
    row.appendChild(cellSum);

    // CARRY Cell
    const cellCarry = document.createElement('td');
    const keyC = `${r}-1`;
    state.arcade.table.targetAnswers[keyC] = correctCarry;

    if (blankCells.includes(keyC)) {
      cellCarry.className = 'input-cell cell-unset';
      cellCarry.innerText = '?';
      cellCarry.addEventListener('click', () => toggleTableCell(cellCarry, keyC));
      state.arcade.table.userCells[keyC] = null;
    } else {
      cellCarry.innerText = correctCarry;
      cellCarry.style.opacity = 0.7;
    }
    row.appendChild(cellCarry);

    tbody.appendChild(row);
  }

  tableEl.appendChild(tbody);

  document.getElementById('table-feedback-msg').innerText = '';
  document.getElementById('table-feedback-msg').className = 'feedback-text';
  document.getElementById('btn-table-verify').classList.remove('hidden');
}

function toggleTableCell(cellEl, key) {
  playSound('click');
  let currentVal = state.arcade.table.userCells[key];
  
  if (currentVal === null) currentVal = 0;
  else if (currentVal === 0) currentVal = 1;
  else currentVal = null; // Reset to unset

  state.arcade.table.userCells[key] = currentVal;
  
  if (currentVal === null) {
    cellEl.innerText = '?';
    cellEl.className = 'input-cell cell-unset';
  } else {
    cellEl.innerText = currentVal;
    cellEl.className = 'input-cell';
  }
}

function verifyTableAnswer() {
  const t = state.arcade.table;
  let correct = true;
  let missing = false;

  for (let key in t.userCells) {
    if (t.userCells[key] === null) {
      missing = true;
    } else if (t.userCells[key] !== t.targetAnswers[key]) {
      correct = false;
    }
  }

  const fMsg = document.getElementById('table-feedback-msg');
  if (missing) {
    playSound('incorrect');
    fMsg.innerText = "Please fill in all empty cells marked with '?' before submitting.";
    fMsg.className = 'feedback-text incorrect';
    return;
  }

  const panel = document.getElementById('game-panel-table');

  if (correct) {
    playSound('correct');
    state.arcade.streak += 2;
    fMsg.innerText = `EXCELLENT! Full table completed. +25 Points (Streak: ${state.arcade.streak})`;
    fMsg.className = 'feedback-text correct';
    addScore(25);
    panel.classList.add('flash-correct');
    setTimeout(() => panel.classList.remove('flash-correct'), 400);
    document.getElementById('btn-table-verify').classList.add('hidden');
  } else {
    playSound('incorrect');
    state.arcade.streak = 0;
    recordStudentMistake('Arcade: Incorrect Truth Table Fill-in');
    fMsg.innerText = "Some inputs do not match standard adder outputs. Try recalculating XOR/AND paths.";
    fMsg.className = 'feedback-text incorrect';
    panel.classList.add('flash-incorrect');
    setTimeout(() => panel.classList.remove('flash-incorrect'), 400);
  }

  document.getElementById('arcade-streak').innerText = state.arcade.streak;
  if (state.arcade.score >= 100) {
    completeModule('module-arcade');
  }
}

// GAME 3: TIMED CHALLENGE SPRINTS
function resetTimedGame() {
  state.arcade.timer.active = false;
  state.arcade.timer.timeLeft = 30;
  document.getElementById('time-left-sec').innerText = '30';
  document.getElementById('time-feedback').innerText = '';
  document.getElementById('btn-time-start').classList.remove('hidden');

  // Disable timed choices until start button clicked
  toggleChoiceButtons(true);
}

function toggleChoiceButtons(disabled) {
  const choices = document.querySelectorAll('.choice-btn');
  choices.forEach(btn => {
    btn.disabled = disabled;
    btn.removeEventListener('click', handleTimedChoice);
    if (!disabled) {
      btn.addEventListener('click', handleTimedChoice);
    }
  });
}

function startTimedRun() {
  logClick();
  playSound('correct');
  state.arcade.timer.active = true;
  state.arcade.timer.timeLeft = 30;
  document.getElementById('btn-time-start').classList.add('hidden');
  toggleChoiceButtons(false);

  // Start timer loop
  state.arcade.timer.intervalId = setInterval(() => {
    state.arcade.timer.timeLeft--;
    document.getElementById('time-left-sec').innerText = state.arcade.timer.timeLeft;

    if (state.arcade.timer.timeLeft <= 0) {
      clearInterval(state.arcade.timer.intervalId);
      endTimedRun();
    }
  }, 1000);

  nextTimedQuestion();
}

function nextTimedQuestion() {
  const t = state.arcade.timer;
  t.currentA = Math.random() > 0.5 ? 1 : 0;
  t.currentB = Math.random() > 0.5 ? 1 : 0;
  t.currentCin = Math.random() > 0.5 ? 1 : 0;

  t.answerS = t.currentA ^ t.currentB ^ t.currentCin;
  t.answerC = (t.currentA & t.currentB) | (t.currentCin & (t.currentA ^ t.currentB));

  // Update formula labels
  document.getElementById('timed-expr-a').innerText = t.currentA;
  document.getElementById('timed-expr-b').innerText = t.currentB;
  document.getElementById('timed-expr-cin').innerText = t.currentCin;
}

function handleTimedChoice(e) {
  logClick();
  const choiceBtn = e.currentTarget;
  const userS = parseInt(choiceBtn.getAttribute('data-s'));
  const userC = parseInt(choiceBtn.getAttribute('data-c'));

  const t = state.arcade.timer;
  const correct = (userS === t.answerS && userC === t.answerC);

  const panel = document.getElementById('game-panel-time');
  const fText = document.getElementById('time-feedback');

  if (correct) {
    playSound('click');
    state.arcade.streak++;
    fText.innerText = `Streak: ${state.arcade.streak}!`;
    fText.className = 'feedback-text correct';
    addScore(5);
    panel.classList.add('flash-correct');
    setTimeout(() => panel.classList.remove('flash-correct'), 300);
  } else {
    playSound('incorrect');
    state.arcade.streak = 0;
    recordStudentMistake('Arcade: Incorrect Timed Choice');
    fText.innerText = "INCORRECT choice! Streak reset.";
    fText.className = 'feedback-text incorrect';
    panel.classList.add('flash-incorrect');
    setTimeout(() => panel.classList.remove('flash-incorrect'), 300);
  }

  document.getElementById('arcade-streak').innerText = state.arcade.streak;
  nextTimedQuestion();
}

function endTimedRun() {
  playSound('success');
  toggleChoiceButtons(true);
  document.getElementById('time-feedback').innerText = `Timed Run Complete! Final score incremented.`;
  document.getElementById('time-feedback').className = 'feedback-text correct';
  document.getElementById('btn-time-start').classList.remove('hidden');
  document.getElementById('btn-time-start').innerText = 'Restart Sprint';

  if (state.arcade.score >= 100) {
    completeModule('module-arcade');
  }
}

// SETUP RESTARTS & GLOBAL MODALS
function initControls() {
  const btnReset = document.getElementById('btn-global-reset');
  const soundToggle = document.getElementById('btn-sound-toggle');
  
  // Welcome Modal actions
  const soundModal = document.getElementById('sound-modal');
  document.getElementById('btn-sound-enable').addEventListener('click', () => {
    initAudio();
    soundModal.style.opacity = 0;
    setTimeout(() => soundModal.style.display = 'none', 300);
  });

  document.getElementById('btn-sound-disable').addEventListener('click', () => {
    state.soundEnabled = false;
    updateSoundUI();
    soundModal.style.opacity = 0;
    setTimeout(() => soundModal.style.display = 'none', 300);
  });

  soundToggle.addEventListener('click', toggleSound);

  btnReset.addEventListener('click', () => {
    const proceed = confirm("Are you sure you want to reset all module completion progress?");
    if (proceed) {
      localStorage.clear();
      state.completedModules.clear();
      state.arcade.score = 0;
      state.arcade.streak = 0;
      document.getElementById('arcade-score').innerText = '0';
      
      resetSandboxElements();
      updateProgressUI();
      switchModule('module-intro');
      
      if (state.soundEnabled) playSound('incorrect');
    }
  });

  // Module 8 Dashboard reset
  document.getElementById('btn-restart-lab').addEventListener('click', () => {
    localStorage.clear();
    state.completedModules.clear();
    state.arcade.score = 0;
    state.arcade.streak = 0;
    document.getElementById('arcade-score').innerText = '0';
    
    resetSandboxElements();
    updateProgressUI();
    switchModule('module-intro');
  });

  // Save certificate export handler
  const btnSaveCert = document.getElementById('btn-save-certificate');
  if (btnSaveCert) {
    btnSaveCert.addEventListener('click', () => {
      playSound('click');
      const card = document.querySelector('.mastery-summary-card');
      
      // Hide button temporarily to avoid rendering in image
      btnSaveCert.style.display = 'none';
      
      html2canvas(card, {
        backgroundColor: '#0a0e1a',
        scale: 2,
        useCORS: true
      }).then(canvas => {
        btnSaveCert.style.display = '';
        const link = document.createElement('a');
        link.download = 'logic_lab_mastery_certificate.png';
        link.href = canvas.toDataURL('image/png');
        link.click();
      }).catch(err => {
        btnSaveCert.style.display = '';
        console.error('Error generating certificate:', err);
        alert('Could not save certificate. Please try again.');
      });
    });
  }
}

// ============================================================
// GOOGLE SHEETS API LAYER
// ============================================================

function getSheetURL() {
  return localStorage.getItem('logic_adder_sheet_url') || '';
}

function setSheetURL(url) {
  localStorage.setItem('logic_adder_sheet_url', url);
}

// Generic POST/GET to the Google Apps Script Web App
async function sheetFetch(action, data = {}) {
  const url = getSheetURL();
  if (!url) throw new Error('No Google Sheet URL configured.');

  const payload = { action, ...data };
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
    body: JSON.stringify(payload)
  });
  
  if (!res.ok) throw new Error('Network error: ' + res.status);
  return await res.json();
}

// Authenticate a student against the Google Sheet
async function authenticateStudent(rollNo, className, password) {
  return await sheetFetch('login', { rollNo, className, password });
}

// Save student progress back to Google Sheet
async function syncStudentToSheet() {
  if (!state.currentUser || state.currentUser === 'Guest') return;
  try {
    await sheetFetch('saveProgress', {
      rollNo: state.currentRoll,
      completedModules: Array.from(state.completedModules).join(','),
      completionPct: Math.round((state.completedModules.size / 8) * 100),
      clicks: state.clicksCount,
      correct: state.correctCount,
      accuracy: state.clicksCount > 0 ? Math.round((state.correctCount / Math.max(1, state.correctCount + (state.clicksCount - state.correctCount))) * 100) : 100,
      lastActive: getFormattedDate(),
      mistakes: (JSON.parse(localStorage.getItem('logic_adder_students') || '[]').find(s => s.rollNo === state.currentRoll) || {}).mistakes || [],
      arcadeScore: state.arcade.highScore
    });
  } catch (e) {
    console.warn('Sheet sync failed (offline mode):', e.message);
  }
}

// Fetch all students from Google Sheet for admin roster
async function fetchAllStudentsFromSheet() {
  return await sheetFetch('getAllStudents');
}

// Test connection to Google Sheet
async function testSheetConnection() {
  return await sheetFetch('ping');
}

// ============================================================
// LANDING PAGE & ADMIN DASHBOARD LOGIC
// ============================================================
let demoA = 0;
let demoB = 0;

function initLandingPageModule() {
  // Student login form handler
  const studentForm = document.getElementById('student-login-form');
  studentForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const rollNo = document.getElementById('student-roll').value.trim();
    const className = document.getElementById('student-class').value.trim();
    const password = document.getElementById('student-password').value;
    
    const errorEl = document.getElementById('login-error-msg');
    const spinnerEl = document.getElementById('login-spinner');
    const submitBtn = document.getElementById('btn-student-login');
    
    errorEl.classList.add('hidden');
    
    const sheetURL = getSheetURL();
    
    if (sheetURL) {
      // Online mode: authenticate against Google Sheet
      spinnerEl.classList.remove('hidden');
      submitBtn.disabled = true;
      
      try {
        const result = await authenticateStudent(rollNo, className, password);
        spinnerEl.classList.add('hidden');
        submitBtn.disabled = false;
        
        if (result.success) {
          loginStudent(result.student.name, className, rollNo, result.student);
        } else {
          errorEl.innerText = result.message || 'Invalid credentials. Please check your roll number, class, and password.';
          errorEl.classList.remove('hidden');
        }
      } catch (err) {
        spinnerEl.classList.add('hidden');
        submitBtn.disabled = false;
        // Fallback to offline mode
        loginStudentOffline(rollNo, className, password);
      }
    } else {
      // Offline mode: use localStorage
      loginStudentOffline(rollNo, className, password);
    }
  });

  document.getElementById('btn-login-guest').addEventListener('click', () => {
    loginStudent('Guest', 'GUEST', 'GUEST', null);
  });

  // Admin panel navigation
  document.getElementById('btn-footer-admin-login').addEventListener('click', () => {
    logClick();
    playSound('click');
    document.getElementById('student-login-box').classList.add('hidden');
    document.getElementById('admin-login-box').classList.remove('hidden');
  });

  document.getElementById('btn-admin-cancel').addEventListener('click', () => {
    logClick();
    playSound('click');
    document.getElementById('admin-login-box').classList.add('hidden');
    document.getElementById('student-login-box').classList.remove('hidden');
  });

  const adminForm = document.getElementById('admin-login-form');
  adminForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const user = document.getElementById('admin-username').value.trim();
    const pass = document.getElementById('admin-password').value.trim();
    if (user === 'admin' && pass === 'admin123') {
      loginAdmin();
    } else {
      alert("Invalid administrator credentials!");
    }
  });

  document.getElementById('btn-hero-admin').addEventListener('click', () => {
    logClick();
    playSound('click');
    document.getElementById('student-login-box').classList.add('hidden');
    document.getElementById('admin-login-box').classList.remove('hidden');
    document.getElementById('admin-login-box').scrollIntoView({ behavior: 'smooth' });
  });

  document.getElementById('btn-admin-logout').addEventListener('click', () => {
    logClick();
    playSound('click');
    document.getElementById('app-admin').classList.add('hidden');
    document.getElementById('app-landing').classList.remove('hidden');
  });

  // Admin Database Settings handlers
  const savedURL = getSheetURL();
  if (savedURL) {
    document.getElementById('admin-sheet-url').value = savedURL;
  }

  document.getElementById('btn-save-sheet-url').addEventListener('click', async () => {
    logClick();
    playSound('click');
    const url = document.getElementById('admin-sheet-url').value.trim();
    const statusEl = document.getElementById('sheet-status-msg');
    const badge = document.getElementById('db-connection-badge');

    if (!url) {
      statusEl.className = 'sheet-status-msg error';
      statusEl.innerText = '✗ Please enter a valid URL.';
      statusEl.classList.remove('hidden');
      return;
    }

    setSheetURL(url);
    statusEl.className = 'sheet-status-msg info';
    statusEl.innerText = '⏳ Testing connection...';
    statusEl.classList.remove('hidden');

    try {
      const result = await testSheetConnection();
      if (result.success) {
        statusEl.className = 'sheet-status-msg success';
        statusEl.innerText = '✓ Connected successfully! Sheet: ' + (result.sheetName || 'LogicAdderLab_DB');
        badge.innerText = 'CONNECTED';
        badge.className = 'badge connected';
        playSound('correct');
      } else {
        throw new Error(result.message || 'Connection failed');
      }
    } catch (err) {
      statusEl.className = 'sheet-status-msg error';
      statusEl.innerText = '✗ Connection failed: ' + err.message;
      badge.innerText = 'ERROR';
      badge.className = 'badge disconnected';
      playSound('incorrect');
    }
  });

  document.getElementById('btn-sync-from-sheet').addEventListener('click', async () => {
    logClick();
    playSound('click');
    const statusEl = document.getElementById('sheet-status-msg');

    if (!getSheetURL()) {
      statusEl.className = 'sheet-status-msg error';
      statusEl.innerText = '✗ Save a Sheet URL first.';
      statusEl.classList.remove('hidden');
      return;
    }

    statusEl.className = 'sheet-status-msg info';
    statusEl.innerText = '⏳ Syncing students from Google Sheet...';
    statusEl.classList.remove('hidden');

    try {
      const result = await fetchAllStudentsFromSheet();
      if (result.success && result.students) {
        // Merge sheet data into localStorage registry
        localStorage.setItem('logic_adder_students', JSON.stringify(result.students));
        renderAdminStats();
        renderAdminRoster();
        statusEl.className = 'sheet-status-msg success';
        statusEl.innerText = `✓ Synced ${result.students.length} student(s) from sheet.`;
        playSound('correct');
      } else {
        throw new Error(result.message || 'No data returned');
      }
    } catch (err) {
      statusEl.className = 'sheet-status-msg error';
      statusEl.innerText = '✗ Sync failed: ' + err.message;
      playSound('incorrect');
    }
  });

  document.getElementById('btn-demo-toggle-a').addEventListener('click', () => {
    logClick();
    playSound('click');
    demoA = demoA === 0 ? 1 : 0;
    document.getElementById('btn-demo-toggle-a').innerText = `Toggle Switch A (${demoA})`;
    document.getElementById('btn-demo-toggle-a').classList.toggle('primary', demoA === 1);
    document.getElementById('btn-demo-toggle-a').classList.toggle('secondary', demoA === 0);
    evaluateDemoHA();
  });

  document.getElementById('btn-demo-toggle-b').addEventListener('click', () => {
    logClick();
    playSound('click');
    demoB = demoB === 0 ? 1 : 0;
    document.getElementById('btn-demo-toggle-b').innerText = `Toggle Switch B (${demoB})`;
    document.getElementById('btn-demo-toggle-b').classList.toggle('primary', demoB === 1);
    document.getElementById('btn-demo-toggle-b').classList.toggle('secondary', demoB === 0);
    evaluateDemoHA();
  });

  let searchTimeout = null;
  document.getElementById('admin-search-input').addEventListener('input', () => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      renderAdminRoster();
    }, 200);
  });

  document.getElementById('admin-sort-select').addEventListener('change', () => {
    logClick();
    renderAdminRoster();
  });

  document.getElementById('admin-filter-select').addEventListener('change', () => {
    logClick();
    renderAdminRoster();
  });

  document.getElementById('btn-admin-detail-close').addEventListener('click', () => {
    logClick();
    playSound('click');
    document.getElementById('admin-detail-modal').classList.add('hidden');
  });

  startHeroLoop();
  initStudentDirectory();
  evaluateDemoHA();

  // Hide trainer initially on page load
  document.getElementById('app-trainer-container').classList.add('hidden');
}

function evaluateDemoHA() {
  const sum = demoA ^ demoB;
  const carry = demoA & demoB;

  document.getElementById('demo-w-a-xor').classList.toggle('active', demoA === 1);
  document.getElementById('demo-w-a-and').classList.toggle('active', demoA === 1);
  document.getElementById('demo-w-b-xor').classList.toggle('active', demoB === 1);
  document.getElementById('demo-w-b-and').classList.toggle('active', demoB === 1);

  document.getElementById('demo-w-xor-sum').classList.toggle('active', sum === 1);
  document.getElementById('demo-w-and-carry').classList.toggle('active', carry === 1);

  document.getElementById('demo-led-sum').setAttribute('fill', sum ? 'var(--accent-cyan)' : '#1f2937');
  document.getElementById('demo-led-carry').setAttribute('fill', carry ? 'var(--accent-amber)' : '#1f2937');
  
  document.getElementById('demo-led-sum').style.filter = sum ? 'drop-shadow(0 0 8px rgba(0, 240, 255, 0.5))' : 'none';
  document.getElementById('demo-led-carry').style.filter = carry ? 'drop-shadow(0 0 8px rgba(255, 160, 0, 0.5))' : 'none';
}

function startHeroLoop() {
  let heroStateIdx = 0;
  setInterval(() => {
    const states = [
      {a: 0, b: 0},
      {a: 0, b: 1},
      {a: 1, b: 1},
      {a: 1, b: 0}
    ];
    const s = states[heroStateIdx];
    heroStateIdx = (heroStateIdx + 1) % states.length;
    
    const sum = s.a ^ s.b;
    const carry = s.a & s.b;
    
    const lblA = document.getElementById('hero-lbl-a');
    const lblB = document.getElementById('hero-lbl-b');
    if (lblA) lblA.textContent = `A=${s.a}`;
    if (lblB) lblB.textContent = `B=${s.b}`;
    
    document.getElementById('hero-wire-a-xor').classList.toggle('active', s.a === 1);
    document.getElementById('hero-wire-a-and').classList.toggle('active', s.a === 1);
    document.getElementById('hero-wire-b-xor').classList.toggle('active', s.b === 1);
    document.getElementById('hero-wire-b-and').classList.toggle('active', s.b === 1);
    
    document.getElementById('hero-wire-sum').classList.toggle('active', sum === 1);
    document.getElementById('hero-wire-carry').classList.toggle('active', carry === 1);
    
    const ledSum = document.getElementById('hero-led-sum');
    const ledCarry = document.getElementById('hero-led-carry');
    if (ledSum) {
      ledSum.setAttribute('fill', sum ? 'var(--accent-cyan)' : '#1f2937');
      ledSum.style.filter = sum ? 'drop-shadow(0 0 5px rgba(0, 240, 255, 0.4))' : 'none';
    }
    if (ledCarry) {
      ledCarry.setAttribute('fill', carry ? 'var(--accent-amber)' : '#1f2937');
      ledCarry.style.filter = carry ? 'drop-shadow(0 0 5px rgba(255, 160, 0, 0.4))' : 'none';
    }
  }, 2000);
}

function initStudentDirectory() {
  if (!localStorage.getItem('logic_adder_students')) {
    const mockStudents = [
      {
        name: "Alice Smith",
        classCode: "CS101-FALL",
        completedModules: ["module-intro", "module-half-adder", "module-full-adder", "module-kmap", "module-sandbox", "module-ripple-carry"],
        completionPct: 75,
        clicksCount: 342,
        correctCount: 22,
        accuracy: 88,
        lastActive: "2026-07-17 14:32",
        mistakes: ["Arcade Predict SUM", "Table Full Adder Carry", "XOR Gate Sandbox Circuit"]
      },
      {
        name: "Bob Jones",
        classCode: "CS101-FALL",
        completedModules: ["module-intro", "module-half-adder", "module-full-adder", "module-kmap"],
        completionPct: 50,
        clicksCount: 198,
        correctCount: 9,
        accuracy: 64,
        lastActive: "2026-07-17 18:10",
        mistakes: ["Carry intro toggle", "Breadboard switch knob Cy", "Arcade Table SUM", "K-Map adjacent cells"]
      },
      {
        name: "Charlie Brown",
        classCode: "CS101-FALL",
        completedModules: ["module-intro", "module-half-adder", "module-full-adder", "module-kmap", "module-sandbox", "module-ripple-carry", "module-breadboard", "module-arcade"],
        completionPct: 100,
        clicksCount: 512,
        correctCount: 40,
        accuracy: 95,
        lastActive: "2026-07-17 21:05",
        mistakes: []
      },
      {
        name: "Diana Prince",
        classCode: "GUEST",
        completedModules: ["module-intro"],
        completionPct: 12,
        clicksCount: 24,
        correctCount: 2,
        accuracy: 80,
        lastActive: "2026-07-18 01:20",
        mistakes: ["Intro binary math"]
      }
    ];
    localStorage.setItem('logic_adder_students', JSON.stringify(mockStudents));
  }
}

function loginStudent(name, classCode, rollNo, sheetData) {
  state.currentUser = name;
  state.currentRoll = rollNo;
  state.currentClass = classCode;
  
  if (name !== 'Guest') {
    let registry = JSON.parse(localStorage.getItem('logic_adder_students') || '[]');
    let profile = registry.find(s => s.rollNo === rollNo);
    
    if (sheetData) {
      // Merge sheet data into local profile
      const completedArr = (sheetData.completedModules || '').split(',').filter(m => m);
      if (!profile) {
        profile = {
          rollNo: rollNo,
          name: sheetData.name || name,
          classCode: classCode,
          password: sheetData.password || '',
          completedModules: completedArr,
          completionPct: sheetData.completionPct || 0,
          clicksCount: sheetData.clicks || 0,
          correctCount: sheetData.correct || 0,
          accuracy: sheetData.accuracy || 100,
          lastActive: getFormattedDate(),
          mistakes: sheetData.mistakes || [],
          arcadeScore: sheetData.arcadeScore || 0
        };
        registry.push(profile);
      } else {
        profile.completedModules = completedArr;
        profile.completionPct = sheetData.completionPct || profile.completionPct;
        profile.clicksCount = sheetData.clicks || profile.clicksCount;
        profile.correctCount = sheetData.correct || profile.correctCount;
        profile.accuracy = sheetData.accuracy || profile.accuracy;
        profile.lastActive = getFormattedDate();
      }
      localStorage.setItem('logic_adder_students', JSON.stringify(registry));
    } else if (!profile) {
      profile = {
        rollNo: rollNo,
        name: name,
        classCode: classCode,
        password: '',
        completedModules: [],
        completionPct: 0,
        clicksCount: 0,
        correctCount: 0,
        accuracy: 100,
        lastActive: getFormattedDate(),
        mistakes: [],
        arcadeScore: 0
      };
      registry.push(profile);
      localStorage.setItem('logic_adder_students', JSON.stringify(registry));
    }
    
    state.completedModules = new Set(profile.completedModules);
    state.clicksCount = profile.clicksCount;
    state.correctCount = profile.correctCount;
  } else {
    state.completedModules = new Set();
    state.clicksCount = 0;
    state.correctCount = 0;
  }

  updateProgressUI();

  document.getElementById('app-landing').classList.add('hidden');
  document.getElementById('app-trainer-container').classList.remove('hidden');

  const modulesList = ["module-intro", "module-half-adder", "module-full-adder", "module-kmap", "module-sandbox", "module-ripple-carry", "module-breadboard", "module-arcade"];
  let target = "module-intro";
  for (let m of modulesList) {
    if (!state.completedModules.has(m)) {
      target = m;
      break;
    }
  }
  switchModule(target);
}

// Offline fallback login: validates against localStorage registry
function loginStudentOffline(rollNo, className, password) {
  const registry = JSON.parse(localStorage.getItem('logic_adder_students') || '[]');
  const profile = registry.find(s => 
    s.rollNo === rollNo && 
    s.classCode === className && 
    s.password === password
  );

  const errorEl = document.getElementById('login-error-msg');

  if (profile) {
    loginStudent(profile.name, className, rollNo, null);
  } else if (registry.length === 0) {
    // No students registered yet — allow first login and create profile
    loginStudent(rollNo, className, rollNo, null);
    // Save the password for future offline logins
    const reg = JSON.parse(localStorage.getItem('logic_adder_students') || '[]');
    const idx = reg.findIndex(s => s.rollNo === rollNo);
    if (idx !== -1) {
      reg[idx].password = password;
      localStorage.setItem('logic_adder_students', JSON.stringify(reg));
    }
  } else {
    errorEl.innerText = 'Invalid credentials. If this is your first time, ask your teacher to add you to the Google Sheet or connect the database.';
    errorEl.classList.remove('hidden');
  }
}

function loginAdmin() {
  logClick();
  playSound('correct');
  
  document.getElementById('admin-username').value = "";
  document.getElementById('admin-password').value = "";

  document.getElementById('app-landing').classList.add('hidden');
  document.getElementById('app-admin').classList.remove('hidden');

  renderAdminStats();
  renderAdminRoster();
}

function getFormattedDate() {
  const d = new Date();
  return d.toISOString().replace('T', ' ').substring(0, 16);
}

function recordStudentMistake(topic) {
  if (!state.currentUser || state.currentUser === 'Guest') return;
  
  let registry = JSON.parse(localStorage.getItem('logic_adder_students') || '[]');
  let idx = registry.findIndex(s => s.rollNo === state.currentRoll);
  if (idx !== -1) {
    if (!registry[idx].mistakes.includes(topic)) {
      registry[idx].mistakes.push(topic);
    }
    syncStudentSessionStats();
  }
}

function updateStudentCompletionInRegistry() {
  if (!state.currentUser || state.currentUser === 'Guest') return;
  let registry = JSON.parse(localStorage.getItem('logic_adder_students') || '[]');
  let idx = registry.findIndex(s => s.rollNo === state.currentRoll);
  if (idx !== -1) {
    registry[idx].completedModules = Array.from(state.completedModules);
    registry[idx].completionPct = Math.round((state.completedModules.size / 8) * 100);
    registry[idx].lastActive = getFormattedDate();
    localStorage.setItem('logic_adder_students', JSON.stringify(registry));
  }
}

function syncStudentSessionStats() {
  if (!state.currentUser || state.currentUser === 'Guest') return;
  let registry = JSON.parse(localStorage.getItem('logic_adder_students') || '[]');
  let idx = registry.findIndex(s => s.rollNo === state.currentRoll);
  if (idx !== -1) {
    registry[idx].clicksCount = state.clicksCount;
    registry[idx].correctCount = state.correctCount;
    const totalAttempts = state.correctCount + registry[idx].mistakes.length;
    registry[idx].accuracy = totalAttempts > 0 ? Math.round((state.correctCount / totalAttempts) * 100) : 100;
    registry[idx].lastActive = getFormattedDate();
    localStorage.setItem('logic_adder_students', JSON.stringify(registry));
  }
}

function renderAdminStats() {
  const registry = JSON.parse(localStorage.getItem('logic_adder_students') || '[]');
  
  document.getElementById('admin-stat-total-students').innerText = registry.length;

  if (registry.length === 0) {
    document.getElementById('admin-stat-avg-completion').innerText = "0%";
    document.getElementById('admin-stat-avg-accuracy').innerText = "0%";
    document.getElementById('admin-stat-missed-concept').innerText = "None";
    return;
  }

  let totalComp = 0;
  let totalAcc = 0;
  const conceptCounts = {};

  registry.forEach(s => {
    totalComp += s.completionPct;
    totalAcc += s.accuracy;
    s.mistakes.forEach(m => {
      let key = m.split(':')[0] || m;
      conceptCounts[key] = (conceptCounts[key] || 0) + 1;
    });
  });

  const avgComp = Math.round(totalComp / registry.length);
  const avgAcc = Math.round(totalAcc / registry.length);

  document.getElementById('admin-stat-avg-completion').innerText = `${avgComp}%`;
  document.getElementById('admin-bar-avg-completion').style.width = `${avgComp}%`;
  document.getElementById('admin-stat-avg-accuracy').innerText = `${avgAcc}%`;
  document.getElementById('admin-bar-avg-accuracy').style.width = `${avgAcc}%`;

  let worstConcept = "None";
  let maxCount = 0;
  for (let concept in conceptCounts) {
    if (conceptCounts[concept] > maxCount) {
      maxCount = conceptCounts[concept];
      worstConcept = concept;
    }
  }
  document.getElementById('admin-stat-missed-concept').innerText = worstConcept;
}

function renderAdminRoster() {
  const registry = JSON.parse(localStorage.getItem('logic_adder_students') || '[]');
  const searchQuery = document.getElementById('admin-search-input').value.toLowerCase();
  const sortBy = document.getElementById('admin-sort-select').value;
  const filterClass = document.getElementById('admin-filter-select').value;

  let filtered = registry.filter(s => {
    const matchesSearch = (s.name || '').toLowerCase().includes(searchQuery) || (s.rollNo || '').toLowerCase().includes(searchQuery);
    const matchesFilter = filterClass === 'all' || s.classCode === filterClass;
    return matchesSearch && matchesFilter;
  });

  filtered.sort((x, y) => {
    if (sortBy === 'name') {
      return x.name.localeCompare(y.name);
    } else if (sortBy === 'completion') {
      return y.completionPct - x.completionPct;
    } else if (sortBy === 'accuracy') {
      return y.accuracy - x.accuracy;
    } else if (sortBy === 'active') {
      return y.lastActive.localeCompare(x.lastActive);
    }
    return 0;
  });

  const tbody = document.getElementById('admin-roster-tbody');
  tbody.innerHTML = "";

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; font-style:italic;" class="text-muted">No students matching filters.</td></tr>`;
    return;
  }

  filtered.forEach(s => {
    const tr = document.createElement('tr');
    const completedLen = Array.isArray(s.completedModules) ? s.completedModules.length : 0;
    
    const escapedRoll = escapeHtml(s.rollNo || '-');
    const escapedName = escapeHtml(s.name || s.rollNo || '');
    const escapedClass = escapeHtml(s.classCode || '');
    const escapedActive = escapeHtml(s.lastActive || '-');

    tr.innerHTML = `
      <td class="font-mono text-bright">${escapedRoll}</td>
      <td class="bold text-bright">${escapedName}</td>
      <td><span class="badge secondary">${escapedClass}</span></td>
      <td>
        <div style="display:flex; align-items:center; gap:8px;">
          <span>${completedLen} / 8</span>
          <div class="mini-bar-track" style="width:60px;"><div class="mini-bar-fill fill-green" style="width:${s.completionPct || 0}%;"></div></div>
        </div>
      </td>
      <td>
        <div style="display:flex; align-items:center; gap:8px;">
          <span class="bold ${(s.accuracy || 0) >= 80 ? 'text-bright' : 'text-muted'}">${s.accuracy || 0}%</span>
          <div class="mini-bar-track" style="width:60px;"><div class="mini-bar-fill fill-cyan" style="width:${s.accuracy || 0}%;"></div></div>
        </div>
      </td>
      <td class="font-mono text-muted">${escapedActive}</td>
      <td>
        <button class="btn primary compact btn-view-dossier" data-roll="${escapedRoll}">View Dossier</button>
      </td>
    `;
    tbody.appendChild(tr);
  });

  document.querySelectorAll('.btn-view-dossier').forEach(btn => {
    btn.addEventListener('click', () => {
      logClick();
      playSound('click');
      const rollNo = btn.getAttribute('data-roll');
      openStudentDossier(rollNo);
    });
  });
}

function openStudentDossier(rollNo) {
  const registry = JSON.parse(localStorage.getItem('logic_adder_students') || '[]');
  const student = registry.find(s => s.rollNo === rollNo);
  if (!student) return;

  document.getElementById('admin-detail-name').innerText = student.name;
  document.getElementById('admin-detail-class').innerText = student.classCode;
  document.getElementById('admin-detail-active').innerText = student.lastActive;
  document.getElementById('admin-detail-clicks').innerText = student.clicksCount;
  document.getElementById('admin-detail-correct').innerText = student.correctCount;

  const allModules = [
    { id: "module-intro", label: "01. Binary Carry" },
    { id: "module-half-adder", label: "02. Half Adder Lab" },
    { id: "module-full-adder", label: "03. Full Adder Lab" },
    { id: "module-kmap", label: "04. K-Map Lab" },
    { id: "module-sandbox", label: "05. Gate Sandbox" },
    { id: "module-ripple-carry", label: "06. Ripple Playground" },
    { id: "module-breadboard", label: "07. Breadboard/IC" },
    { id: "module-arcade", label: "08. Logic Arcade" }
  ];

  const modulesContainer = document.getElementById('admin-detail-modules');
  modulesContainer.innerHTML = "";
  allModules.forEach(m => {
    const isDone = student.completedModules.includes(m.id);
    const row = document.createElement('div');
    row.className = "detail-module-row";
    row.innerHTML = `
      <span>${m.label}</span>
      <span class="detail-module-status ${isDone ? 'done' : 'pending'}">${isDone ? 'COMPLETED' : 'IN PROGRESS'}</span>
    `;
    modulesContainer.appendChild(row);
  });

  const badgesContainer = document.getElementById('admin-detail-badges');
  badgesContainer.innerHTML = "";
  const badges = [];
  if (student.completedModules.includes('module-half-adder')) badges.push({ emoji: "⚡", label: "Half Adder Master" });
  if (student.completedModules.includes('module-full-adder')) badges.push({ emoji: "🔋", label: "Full Adder Master" });
  if (student.completedModules.includes('module-kmap')) badges.push({ emoji: "🗺️", label: "K-Map Solver" });
  if (student.completedModules.includes('module-ripple-carry')) badges.push({ emoji: "🌊", label: "Ripple Propagator" });
  if (student.completedModules.includes('module-arcade') && student.accuracy >= 90) badges.push({ emoji: "🎖️", label: "Perfect Arcade" });
  
  if (badges.length === 0) {
    badgesContainer.innerHTML = `<span class="text-muted font-italic" style="font-size:0.85rem;">No badges earned yet.</span>`;
  } else {
    badges.forEach(b => {
      const el = document.createElement('span');
      el.className = "badge secondary";
      el.style.margin = "2px";
      el.innerHTML = `${b.emoji} ${b.label}`;
      badgesContainer.appendChild(el);
    });
  }

  const mistakesContainer = document.getElementById('admin-detail-mistakes');
  mistakesContainer.innerHTML = "";
  if (student.mistakes.length === 0) {
    mistakesContainer.innerHTML = `<li class="mistake-empty">No mistakes recorded. Perfect logic record!</li>`;
  } else {
    student.mistakes.forEach(m => {
      const li = document.createElement('li');
      li.className = "mistake-item";
      li.innerText = m;
      mistakesContainer.appendChild(li);
    });
  }

  document.getElementById('admin-detail-modal').classList.remove('hidden');
}

function escapeHtml(str) {
  if (typeof str !== 'string') {
    if (str === null || str === undefined) return '';
    return String(str);
  }
  return str.replace(/[&<>"']/g, function(m) {
    switch (m) {
      case '&': return '&amp;';
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '"': return '&quot;';
      case "'": return '&#039;';
      default: return m;
    }
  });
}

// ONLOAD BOOTSTRAPPER
window.addEventListener('DOMContentLoaded', () => {
  // Initialize module components
  initNavigation();
  initLandingPageModule();
  initIntroModule();
  initHalfAdderModule();
  initFullAdderModule();
  initKMapModule();
  initSandboxTools();
  initRippleCarryModule();
  initBreadboardModule();
  initArcadeModule();
  initControls();

  // Load state from local memory cache if present
  updateProgressUI();

  // Register Service Worker for offline PWA support
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js')
        .then(reg => console.log('ServiceWorker registered:', reg.scope))
        .catch(err => console.log('ServiceWorker registration failed:', err));
    });
  }
});
