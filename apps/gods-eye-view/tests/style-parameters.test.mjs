import test from "node:test";
import assert from "node:assert/strict";
import { createStaticVisualEffects } from "../src/static-effects.js";
import {
  STYLES,
  STYLE_PRESET_DEFAULTS,
} from "../vendor/src/ui/visualPresets.js";

function effectProbe() {
  const stages = [];
  let renders = 0,
    failSharpen = false;
  const bloom = { enabled: true, uniforms: { contrast: 7 } };
  const viewer = {
    isDestroyed: () => false,
    scene: {
      requestRender() {
        renders++;
      },
      postProcessStages: {
        bloom,
        add(stage) {
          stages.push(stage);
        },
        remove(stage) {
          const i = stages.indexOf(stage);
          if (i < 0) return false;
          stages.splice(i, 1);
          return true;
        },
      },
    },
  };
  const effects = createStaticVisualEffects({
    viewer,
    createStage: (o) => {
      if (failSharpen && o.name === "godsEyeView_sharpen")
        throw new Error("sharpen construction failed");
      return { ...o };
    },
  });
  return {
    effects,
    viewer,
    stages,
    bloom,
    renders: () => renders,
    failSharpen() {
      failSharpen = true;
    },
  };
}

test("selected style parameters use upstream bounds only, preserve other stages, time and borrowed bloom", () => {
  const p = effectProbe();
  try {
    assert.equal(typeof p.effects.getStyleParameters, "function");
    assert.deepEqual(p.effects.getStyleParameters(), {
      style: "normal",
      values: {},
    });
    assert.deepEqual(p.effects.getStyleParameterMetadata(), {});
    p.effects.setStyle("thermal");
    const all = p.stages.map((s) => ({ ...s.uniforms }));
    const before = p.renders();
    assert.equal(p.effects.setStyleParameter("palette", 0.7), true);
    const active = p.stages.find((s) => s.enabled);
    assert.equal(active.uniforms.palette, 0.7);
    assert.equal(active.uniforms.time, 0);
    assert.equal(p.renders(), before + 1);
    for (const [i, stage] of p.stages.entries())
      if (stage !== active) assert.deepEqual(stage.uniforms, all[i]);
    assert.deepEqual(p.bloom, { enabled: true, uniforms: { contrast: 7 } });
    for (const [name, value] of [
      ["time", 1],
      ["intensity", 1],
      ["__proto__", 0],
      ["palette", NaN],
      ["palette", Infinity],
      ["palette", -0.01],
      ["palette", 1.01],
      ["palette", "0.4"],
    ])
      assert.throws(() => p.effects.setStyleParameter(name, value));
    assert.equal(active.uniforms.palette, 0.7);
    const metadata = p.effects.getStyleParameterMetadata();
    metadata.palette.max = 99;
    assert.equal(p.effects.getStyleParameterMetadata().palette.max, 1);
    assert.throws(() => p.effects.setStyleParameter("palette", 4));
  } finally {
    p.effects.destroy();
  }
  assert.equal(p.stages.length, 0);
  assert.equal(p.effects.setStyleParameter("palette", 0.1), false);
});

test("every original parameter is enumerated; reset and old scene style selection restore complete defaults without animation", () => {
  const p = effectProbe(),
    previous = globalThis.requestAnimationFrame;
  let scheduled = 0,
    count = 0;
  globalThis.requestAnimationFrame = () => {
    scheduled++;
    return 1;
  };
  try {
    for (const [style, shader] of Object.entries(STYLES)) {
      p.effects.setStyle(style);
      const metadata = p.effects.getStyleParameterMetadata();
      assert.deepEqual(Object.keys(metadata), Object.keys(shader.uniforms));
      for (const [name, raw] of Object.entries(shader.uniforms)) {
        count++;
        assert.deepEqual(
          {
            default: metadata[name].default,
            min: metadata[name].min,
            max: metadata[name].max,
            label: metadata[name].label,
          },
          raw,
        );
        if (style === "snow" && name === "wind") {
          assert.equal(metadata[name].editable, false);
          assert.throws(() => p.effects.setStyleParameter(name, 0.8));
        } else {
          assert.equal(metadata[name].editable, true);
          p.effects.setStyleParameter(name, raw.max);
        }
      }
      p.effects.setStyle(style);
      const expected = Object.fromEntries(
        Object.entries(shader.uniforms).map(([name, raw]) => [
          name,
          raw.default,
        ]),
      );
      Object.assign(
        expected,
        STYLE_PRESET_DEFAULTS[style]?.styleParams?.[style],
      );
      assert.deepEqual(p.effects.getStyleParameters(), {
        style,
        values: expected,
      });
      const snapshot = p.effects.getStyleParameters();
      snapshot.values[Object.keys(snapshot.values)[0]] = 999;
      assert.notDeepEqual(p.effects.getStyleParameters(), snapshot);
    }
    assert.equal(count, 19);
    assert.equal(scheduled, 0);
    p.effects.setStyle("normal");
    assert.deepEqual(p.effects.getStyleParameters(), {
      style: "normal",
      values: {},
    });
    assert.equal(p.stages.length, 0);
  } finally {
    p.effects.destroy();
    globalThis.requestAnimationFrame = previous;
  }
});

test("internal parameter recovery is strict and atomic and does not permit arbitrary stage or uniform injection", () => {
  const p = effectProbe();
  try {
    p.effects.setStyle("thermal");
    p.effects.setStyleParameter("palette", 0.7);
    const saved = p.effects.getStyleParameters();
    p.effects.setStyle("thermal");
    assert.notDeepEqual(p.effects.getStyleParameters(), saved);
    p.effects.restoreStyleParameters(saved);
    assert.deepEqual(p.effects.getStyleParameters(), saved);
    for (const bad of [
      { ...saved, token: "extra" },
      { style: "normal", values: saved.values },
      { ...saved, values: { ...saved.values, time: 1 } },
      { ...saved, values: { ...saved.values, sensitivity: -1 } },
      { ...saved, values: { palette: 0.1 } },
      { ...saved, values: Object.create(saved.values) },
    ]) {
      assert.throws(() => p.effects.restoreStyleParameters(bad));
      assert.deepEqual(p.effects.getStyleParameters(), saved);
    }
  } finally {
    p.effects.destroy();
  }
});

async function controlProbe() {
  const { JSDOM } = await import("jsdom");
  const { installStyleParameterControls } =
    await import("../src/style-parameters-controls.js");
  const dom = new JSDOM(
    `<select id="style"><option value="thermal">Thermal</option><option value="normal">Normal</option><option value="snow">Snow</option><option value="noir">Noir</option></select><details open id="panel"><div id="container"></div><button id="reset"></button><p id="status"></p></details>`,
    { pretendToBeVisual: true },
  );
  const nodes = Object.fromEntries(
    ["style", "panel", "container", "reset", "status"].map((k) => [
      k,
      dom.window.document.getElementById(k),
    ]),
  );
  const p = effectProbe(),
    signal = new AbortController();
  let changed = 0,
    failures = 0;
  p.effects.setStyle("thermal");
  const controls = installStyleParameterControls({
    ...p,
    nodes,
    signal: signal.signal,
    onChange() {
      changed++;
    },
    onError() {
      failures++;
      p.effects.clear();
      nodes.style.value = "normal";
    },
  });
  const input = (node, value) => {
    node.value = String(value);
    node.dispatchEvent(new dom.window.Event("input", { bubbles: true }));
  };
  return {
    ...p,
    dom,
    nodes,
    signal,
    controls,
    input,
    changed: () => changed,
    failures: () => failures,
    close() {
      controls.destroy();
      p.effects.destroy();
      dom.window.close();
    },
  };
}

test("byte-exact upstream native parameter rows change only current shader, reset defaults, and retire old rows on style/panel change", async () => {
  const p = await controlProbe();
  try {
    const sliders = [...p.nodes.container.querySelectorAll("input")];
    assert.equal(sliders.length, 5);
    assert.equal(sliders[4].getAttribute("aria-label"), "Ironbow");
    assert.equal(sliders[4].step, "0.01");
    p.input(sliders[4], 0.71);
    assert.equal(p.effects.getStyleParameters().values.palette, 0.71);
    assert.equal(p.changed(), 1);
    assert.match(p.nodes.status.textContent, /静态模拟/);
    assert.match(p.nodes.status.textContent, /不写入场景 JSON/);
    p.nodes.reset.click();
    assert.equal(p.effects.getStyleParameters().values.palette, 0);
    p.input(sliders[4], 0.9);
    assert.equal(
      p.effects.getStyleParameters().values.palette,
      0,
      "reset revoked previous handlers",
    );
    p.effects.setStyle("snow");
    p.nodes.style.value = "snow";
    p.controls.refresh();
    const snow = [...p.nodes.container.querySelectorAll("input")];
    assert.equal(snow.length, 2);
    assert.equal(snow[1].disabled, true);
    p.input(snow[0], 0.8);
    assert.equal(p.effects.getStyleParameters().values.density, 0.8);
    const changes = p.changed();
    p.input(snow[1], 0.8);
    assert.equal(p.effects.getStyleParameters().values.wind, 0.5);
    assert.equal(p.changed(), changes);
    assert.equal(p.failures(), 0);
    p.nodes.panel.open = false;
    p.nodes.panel.dispatchEvent(new p.dom.window.Event("toggle"));
    assert.equal(p.nodes.container.childNodes.length, 0);
    assert.equal(p.nodes.reset.disabled, true);
    p.input(snow[0], 0.1);
    assert.equal(p.effects.getStyleParameters().values.density, 0.8);
    p.nodes.panel.open = true;
    p.controls.refresh();
    assert.equal(p.nodes.container.querySelectorAll("input").length, 2);
    p.effects.setStyle("normal");
    p.nodes.style.value = "normal";
    p.controls.refresh();
    assert.equal(p.nodes.container.childNodes.length, 0);
    assert.equal(p.nodes.reset.disabled, true);
    assert.equal(p.stages.length, 0);
  } finally {
    p.close();
  }
});

test("native parameter rows stop on hide/abort, and abort during real effects requestRender cannot revive callbacks", async () => {
  const p = await controlProbe();
  try {
    const old = [...p.nodes.container.querySelectorAll("input")];
    Object.defineProperty(p.dom.window.document, "hidden", {
      value: true,
      configurable: true,
    });
    p.dom.window.document.dispatchEvent(
      new p.dom.window.Event("visibilitychange"),
    );
    assert.equal(p.nodes.container.childNodes.length, 0);
    p.input(old[0], 0.2);
    assert.equal(p.changed(), 0);
    Object.defineProperty(p.dom.window.document, "hidden", {
      value: false,
      configurable: true,
    });
    p.controls.refresh();
    const current = p.nodes.container.querySelector("input");
    p.viewer.scene.requestRender = () => p.signal.abort();
    p.input(current, 0.2);
    assert.equal(p.changed(), 0);
    assert.equal(p.nodes.container.childNodes.length, 0);
    p.controls.refresh();
    p.nodes.reset.click();
    p.input(current, 0.7);
    assert.equal(p.nodes.container.childNodes.length, 0);
    assert.equal(p.changed(), 0);
  } finally {
    p.close();
  }
});

async function installRealDisplay(p) {
  const { installDisplayControls } = await import("../src/display-controls.js");
  const d = p.dom.window.document,
    overlay = d.createElement("section");
  d.body.append(overlay);
  overlay.append(p.nodes.panel);
  const nodes = Object.fromEntries(
    [
      "overhead",
      "oblique",
      "save",
      "restore",
      "cameraStatus",
      "clean",
      "sharpen",
      "bloom",
      "sharpenIntensity",
      "bloomIntensity",
      "effectStatus",
    ].map((name) => [
      name,
      d.createElement(
        name.includes("Intensity") || ["sharpen", "bloom"].includes(name)
          ? "input"
          : "button",
      ),
    ]),
  );
  nodes.style = p.nodes.style;
  const release = installDisplayControls({
    ...p,
    nodes,
    overlays: [overlay],
    signal: p.signal.signal,
    onCleanChange: (visible) => p.controls.setVisible?.(visible),
    onEffectsChange: () => p.controls.refresh(),
  });
  return { nodes, overlay, release };
}

test("actual Clean View retires hidden parameter rows and queued callbacks; restore reconstructs current rows", async () => {
  const p = await controlProbe();
  let display;
  try {
    display = await installRealDisplay(p);
    const old = p.nodes.container.querySelectorAll("input")[4];
    display.nodes.clean.click();
    assert.equal(display.overlay.hidden, true);
    assert.equal(p.nodes.container.childNodes.length, 0);
    assert.equal(p.nodes.reset.disabled, true);
    p.input(old, 0.7);
    p.nodes.reset.click();
    assert.equal(p.effects.getStyleParameters().values.palette, 0);
    assert.equal(p.changed(), 0);
    p.controls.refresh();
    assert.equal(p.nodes.container.childNodes.length, 0);
    display.nodes.clean.click();
    assert.equal(display.overlay.hidden, false);
    const current = p.nodes.container.querySelectorAll("input")[4];
    assert.ok(current);
    p.input(current, 0.7);
    assert.equal(p.effects.getStyleParameters().values.palette, 0.7);
    assert.equal(p.changed(), 1);
    p.signal.abort();
    display.nodes.clean.click();
    assert.equal(p.nodes.container.childNodes.length, 0);
  } finally {
    display?.release();
    p.close();
  }
});

test("actual display postprocess acquisition fallback to normal clears parameter rows, reset and stale callbacks", async () => {
  const p = await controlProbe();
  let display;
  try {
    display = await installRealDisplay(p);
    const old = p.nodes.container.querySelectorAll("input")[4];
    p.failSharpen();
    display.nodes.sharpen.checked = true;
    display.nodes.sharpen.dispatchEvent(new p.dom.window.Event("change"));
    assert.equal(p.effects.getStyleParameters().style, "normal");
    assert.equal(p.nodes.style.value, "normal");
    assert.equal(p.nodes.container.childNodes.length, 0);
    assert.equal(p.nodes.reset.disabled, true);
    assert.match(p.nodes.status.textContent, /选择模拟视觉风格/);
    p.input(old, 0.7);
    assert.equal(p.changed(), 0);
    assert.equal(p.failures(), 0);
    assert.equal(p.stages.length, 0);
  } finally {
    display?.release();
    p.close();
  }
});

test("parameter restore rejects changing getters without reading them or partially mutating current values", () => {
  const p = effectProbe();
  let reads = 0;
  try {
    p.effects.setStyle("thermal");
    const before = p.effects.getStyleParameters();
    const values = { ...before.values };
    Object.defineProperty(values, "palette", {
      enumerable: true,
      get() {
        return ++reads === 1 ? 0.7 : 4;
      },
    });
    assert.throws(() =>
      p.effects.restoreStyleParameters({ style: "thermal", values }),
    );
    assert.equal(reads, 0);
    assert.deepEqual(p.effects.getStyleParameters(), before);
    const root = { values: before.values };
    Object.defineProperty(root, "style", {
      enumerable: true,
      get() {
        reads++;
        return "thermal";
      },
    });
    assert.throws(() => p.effects.restoreStyleParameters(root));
    assert.equal(reads, 0);
  } finally {
    p.effects.destroy();
  }
});

test("parameter names reject coercible objects before any conversion or time mutation", () => {
  const p = effectProbe();
  let coercions = 0;
  try {
    p.effects.setStyle("thermal");
    const key = {
      [Symbol.toPrimitive]() {
        return ++coercions <= 3 ? "palette" : "time";
      },
    };
    assert.throws(() => p.effects.setStyleParameter(key, 0.7));
    assert.equal(coercions, 0);
    assert.equal(p.stages.find((s) => s.enabled).uniforms.time, 0);
  } finally {
    p.effects.destroy();
  }
});
