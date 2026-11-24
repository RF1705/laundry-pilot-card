const samsung = {
  cycle: "select.cycle",
  temperature: "select.wash_temperature",
  rinses: "select.rinse_cycles",
  spin: "select.spin_speed",
  soil: "select.soil_level",
  intensive: "switch.intensive",
  operation: "sensor.machine_state",
  phase: "sensor.progress",
  remaining: "sensor.completion_time",
  finish: "sensor.estimated_finish",
  progress: "sensor.progress_percent",
  running: "binary_sensor.running",
  remote: "binary_sensor.smart_control",
  start: "button.start",
  pause: "button.pause",
  stop: "button.stop",
};

const settings = {
  temperature: "Temperatur",
  rinses: "Spülgänge",
  spin: "Schleudern",
  soil: "Verschmutzung",
  intensive: "Flecken intensiv",
};

const laundry = {
  jeans: "Jeans",
  socks: "Socken",
  shirts: "T-Shirts",
  towels: "Handtücher",
  sports: "Sportwäsche",
  delicates: "Feinwäsche",
  wool: "Wolle",
};

const programs = {
  cotton: ["2f", "5b", "d0"],
  daily: ["01", "1f", "e3"],
  denim: ["30", "6c"],
  sports: ["42", "74", "a3"],
  towels: ["94"],
  delicates: ["48", "5e", "75", "a2", "d3"],
  wool: ["11", "65", "d8"],
};

const styles = `
  ha-card{overflow:hidden;padding:20px;color:var(--primary-text-color)}
  h2{margin:0;font-size:1.2rem} p{margin:8px 0}
  .muted{color:var(--secondary-text-color)}
  .actions,.chips{display:flex;flex-wrap:wrap;gap:8px;margin-top:14px}
  button,select{font:inherit;color:inherit;background:var(--secondary-background-color);
    border:1px solid var(--divider-color);border-radius:12px;padding:10px 14px}
  button{cursor:pointer} button:disabled{opacity:.48;cursor:default}
  button.primary,button[aria-pressed=true]{background:var(--primary-color);
    color:var(--text-primary-color,#fff);border-color:transparent}
  label{display:flex;gap:12px;align-items:center;justify-content:space-between;margin:10px 0}
  select{min-width:0;max-width:64%}
  .running{text-align:center} .running .actions{justify-content:center}
  .ring{--size:168px;width:var(--size);height:var(--size);margin:18px auto 10px;
    display:grid;place-items:center;border-radius:50%;position:relative;
    background:conic-gradient(var(--primary-color) var(--progress,0%),var(--divider-color) 0)}
  .drum{box-sizing:border-box;position:absolute;inset:5px;overflow:hidden;
    border-radius:50%;border:7px solid var(--card-background-color);
    background:radial-gradient(circle at 35% 25%,#25405a,#0b192b 75%)}
  .rotor{position:absolute;inset:13px;border-radius:50%;border:3px dotted #7dabc8;
    border-top:6px solid #b9d6de;border-bottom:6px solid #4d759b}
  .rotor.wash,.rotor.prewash{animation:turn 5s ease-in-out infinite alternate}
  .rotor.spin{animation:turn 1.05s linear infinite}
  .water{position:absolute;inset:65% -15% -35%;border-radius:40%;
    background:#2d9ab481;animation:sway 2.7s ease-in-out infinite alternate}
  .time{z-index:1;color:#fff;font-size:2rem;font-weight:650;text-shadow:0 2px 8px #071627}
  @keyframes turn{to{transform:rotate(360deg)}}
  @keyframes sway{to{transform:translateY(-9%) rotate(9deg)}}
  @media(prefers-reduced-motion:reduce){.rotor,.water{animation:none!important}}
`;

class LaundryPilotCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this.view = "home";
    this.load = new Set();
    this.dirt = "normal";
  }

  setConfig(config) {
    if (!config.prefix && !config.entities?.cycle) {
      throw new Error("Bitte prefix oder entities.cycle konfigurieren.");
    }
    this.config = config;
    this.entities = {};
    if (config.prefix) {
      for (const [role, pattern] of Object.entries(samsung)) {
        const [domain, suffix] = pattern.split(".");
        this.entities[role] = `${domain}.${config.prefix}_${suffix}`;
      }
    }
    Object.assign(this.entities, config.entities);
    this.render();
  }

  set hass(hass) {
    const previous = this._hass;
    this._hass = hass;
    if (!previous || Object.values(this.entities || {}).some(
      (id) => previous.states[id] !== hass.states[id],
    )) this.render();
  }

  connectedCallback() {
    this.render();
    this.clock = setInterval(() => this.updateClock(), 1000);
  }

  disconnectedCallback() {
    clearInterval(this.clock);
  }

  state(role) {
    const entity = this._hass.states[this.entities[role]];
    return entity && !["unknown", "unavailable"].includes(entity.state) ? entity : undefined;
  }

  label(entity, value = entity?.state) {
    if (!entity || value == null) return "–";
    return this._hass.formatEntityState?.(entity, value) ?? value;
  }

  node(tag, text, className) {
    const element = document.createElement(tag);
    if (text != null) element.textContent = text;
    if (className) element.className = className;
    return element;
  }

  button(text, action, { primary = false, disabled = false } = {}) {
    const button = this.node("button", text, primary ? "primary" : "");
    button.type = "button";
    button.disabled = disabled || Boolean(this.pending);
    button.onclick = action;
    return button;
  }

  choices(parent, title, options, value, change, disabled = false) {
    const label = this.node("label", title);
    const select = this.node("select");
    for (const [key, name] of options) {
      const option = this.node("option", name);
      option.value = key;
      select.append(option);
    }
    select.value = value ?? "";
    select.disabled = disabled || Boolean(this.pending);
    select.onchange = () => change(select.value);
    label.append(select);
    parent.append(label);
  }

  navigate(view) {
    this.error = "";
    this.advice = "";
    this.confirmStop = false;
    this.view = view;
    this.render();
  }

  get operation() {
    const machine = this.state("operation")?.state;
    const phase = this.state("phase")?.state;
    if (["pause", "paused"].includes(machine)) return "paused";
    if (phase === "finish") return "finished";
    if (["active", "run", "running"].includes(machine) || this.state("running")?.state === "on") {
      return "running";
    }
    return "idle";
  }

  get locked() {
    return Boolean(this._hass.states[this.entities.remote]) && this.state("remote")?.state !== "on";
  }

  async write(role, value) {
    if (this.pending || this.locked || !this.state(role)) return;
    const entity = this.entities[role];
    const domain = entity.split(".")[0];
    const services = { select: "select_option", button: "press", switch: value ? "turn_on" : "turn_off" };
    if (!services[domain]) return;
    this.pending = role;
    this.error = "";
    this.render();
    try {
      const data = { entity_id: entity };
      if (domain === "select") data.option = value;
      await this._hass.callService(domain, services[domain], data);
      this.confirmStop = false;
    } catch (error) {
      this.error = error.message || "Die Aktion ist fehlgeschlagen.";
    } finally {
      this.pending = null;
      this.render();
    }
  }

  appendActions(parent, ...buttons) {
    const actions = this.node("div", null, "actions");
    actions.append(...buttons.filter(Boolean));
    parent.append(actions);
  }

  recommend() {
    const has = (item) => this.load.has(item);
    const mixedWool = has("wool") && this.load.size > 1;
    const mixedTowels = has("towels") && this.load.size > 1;
    const mixedSensitive = (has("sports") || has("delicates")) && this.load.size > 1;
    if (mixedWool || mixedTowels || mixedSensitive) {
      this.advice = "Für diese Textilien sind getrennte Ladungen sinnvoll. Bitte prüfe die Pflegeetiketten.";
      this.render();
      return;
    }
    const cycle = this.state("cycle");
    const available = cycle?.attributes.options ?? [];
    let categories = ["daily", "cotton"];
    if (has("wool")) categories = ["wool"];
    else if (has("delicates")) categories = ["delicates"];
    else if (has("sports")) categories = ["sports"];
    else if (has("towels")) categories = ["towels", "cotton"];
    else if (has("jeans") && this.load.size === 1) categories = ["denim", "daily"];
    else if (this.dirt === "heavy") categories = ["cotton", "daily"];

    const mapped = this.config.prefix ? programs : {};
    const candidate = categories.flatMap((key) => this.config.programs?.[key] ?? mapped[key] ?? [])
      .find((option) => available.includes(option));
    if (!candidate) {
      this.advice = "Für diese Ladung ist kein passendes Programm zugeordnet.";
      this.render();
      return;
    }
    this.suggestedCycle = candidate;
    this.suggestedSoil = this.dirt;
    this.navigate("program");
    this.advice = `Vorschlag: ${this.label(cycle, candidate)}. Pflegeetiketten und Einstellungen prüfen.`;
    this.render();
  }

  renderAssistant(card) {
    card.append(this.node("p", "Was ist in der Trommel?"));
    const chips = this.node("div", null, "chips");
    for (const [key, title] of Object.entries(laundry)) {
      const button = this.button(title, () => {
        if (!this.load.delete(key)) this.load.add(key);
        this.advice = "";
        this.render();
        this.shadowRoot.querySelector(`[data-laundry="${key}"]`)?.focus();
      });
      button.dataset.laundry = key;
      button.setAttribute("aria-pressed", String(this.load.has(key)));
      chips.append(button);
    }
    card.append(chips);
    this.choices(card, "Verschmutzung", [
      ["light", "Leicht"], ["normal", "Normal"], ["heavy", "Stark"],
    ], this.dirt, (value) => { this.dirt = value; this.advice = ""; });
    this.appendActions(card,
      this.button("Zurück", () => this.navigate("home")),
      this.button("Vorschlag anzeigen", () => this.recommend(), {
        primary: true, disabled: !this.load.size,
      }),
    );
  }

  renderProgram(card) {
    const cycle = this.state("cycle");
    const options = cycle?.attributes.options ?? [];
    const proposed = this.suggestedCycle;
    if (options.length) {
      this.choices(card, "Programm", options.map((value) => [value, this.label(cycle, value)]),
        proposed ?? cycle.state, (value) => {
          this.suggestedCycle = value;
          this.suggestedSoil = null;
          this.advice = "";
          this.render();
        });
    } else {
      card.append(this.node("p", "Die Programmliste ist derzeit nicht verfügbar."));
    }
    const needsProgram = Boolean(proposed && proposed !== cycle?.state);
    if (!needsProgram) {
      for (const [role, title] of Object.entries(settings)) {
        const entity = this.state(role);
        if (!entity) continue;
        if (entity.attributes.options?.length) {
          this.choices(card, title,
            entity.attributes.options.map((value) => [value, this.label(entity, value)]),
            entity.state, (value) => this.write(role, value), this.locked);
        } else if (this.entities[role].startsWith("switch.")) {
          const button = this.button(title, () => this.write(role, entity.state !== "on"),
            { disabled: this.locked });
          button.setAttribute("aria-pressed", String(entity.state === "on"));
          card.append(button);
        }
      }
      const soil = this.state("soil");
      if (this.advice && soil?.attributes.options?.includes(this.suggestedSoil) && soil.state !== this.suggestedSoil) {
        card.append(this.button("Verschmutzungsgrad übernehmen", () => this.write("soil", this.suggestedSoil),
          { disabled: this.locked }));
      }
    }
    this.appendActions(card,
      this.button("Zurück", () => this.navigate("home")),
      needsProgram
        ? this.button("Programm übernehmen", () => this.write("cycle", proposed),
          { primary: true, disabled: this.locked || !options.includes(proposed) })
        : this.state("start") && this.button("Starten", () => this.write("start"),
          { primary: true, disabled: this.locked || !cycle }),
    );
  }

  finishTime() {
    const finish = this.state("finish")?.state;
    const timestamp = finish && Date.parse(finish);
    return Number.isFinite(timestamp) ? timestamp : null;
  }

  updateClock() {
    const time = this.shadowRoot.querySelector(".time");
    if (!time) return;
    const remaining = this.state("remaining");
    const finish = this.finishTime();
    const unit = remaining?.attributes.unit_of_measurement;
    const number = Number(remaining?.state);
    let minutes;
    if (this.operation === "running" && finish != null) {
      minutes = Math.max(0, Math.ceil((finish - Date.now()) / 60000));
    } else if (Number.isFinite(number) && (!unit || ["min", "s", "h"].includes(unit))) {
      minutes = Math.ceil(number * { min: 1, s: 1 / 60, h: 60 }[unit ?? "min"]);
    }
    time.textContent = minutes == null ? "–" :
      `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, "0")}`;
  }

  renderRunning(card, operation) {
    card.classList.add("running");
    const phase = this.state("phase");
    const ring = this.node("div", null, "ring");
    const progress = Number(this.state("progress")?.state);
    if (Number.isFinite(progress) && progress >= 0 && progress <= 100) {
      ring.style.setProperty("--progress", `${progress}%`);
      ring.setAttribute("role", "progressbar");
      ring.setAttribute("aria-label", "Waschfortschritt");
      ring.setAttribute("aria-valuenow", String(progress));
    }
    const drum = this.node("div", null, "drum");
    drum.setAttribute("aria-hidden", "true");
    const motion = operation === "running" && ["wash", "prewash", "spin"].includes(phase?.state)
      ? phase.state : "";
    drum.append(this.node("div", null, `rotor ${motion}`));
    if (operation === "running" && phase?.state === "rinse") drum.append(this.node("div", null, "water"));
    ring.append(drum, this.node("span", null, "time"));
    card.append(ring, this.node("p", operation === "paused" ? "Pausiert" : phase ? this.label(phase) : "Läuft"));
    const finish = this.finishTime();
    if (operation === "running" && finish !== null) {
      const clock = new Intl.DateTimeFormat(this._hass.locale?.language, {
        hour: "2-digit", minute: "2-digit",
      }).format(finish);
      card.append(this.node("p", `Voraussichtlich fertig um ${clock}`, "muted"));
    }
    if (this.confirmStop) {
      this.appendActions(card,
        this.button("Weiter anzeigen", () => { this.confirmStop = false; this.render(); }),
        this.button("Waschgang abbrechen", () => this.write("stop"), { disabled: this.locked }),
      );
    } else {
      const paused = operation === "paused";
      const role = paused && this.state("resume") ? "resume" : paused && this.config.prefix ? "start" : paused ? "resume" : "pause";
      this.appendActions(card,
        this.state(role) && this.button(paused ? "Fortsetzen" : "Pause", () => this.write(role),
          { primary: true, disabled: this.locked }),
        this.state("stop") && this.button("Abbrechen", () => { this.confirmStop = true; this.render(); },
          { disabled: this.locked }),
      );
    }
  }

  render() {
    if (!this.config || !this._hass) return;
    const operation = this.operation;
    if (operation !== this.lastOperation && ["running", "paused"].includes(operation)) {
      this.view = "home";
      this.suggestedCycle = null;
      this.advice = "";
      this.confirmStop = false;
    }
    this.lastOperation = operation;
    const card = this.node("ha-card");
    const style = this.node("style", styles);
    card.append(this.node("h2", this.config.title || "Waschpilot"));
    if (["running", "paused"].includes(operation)) this.renderRunning(card, operation);
    else if (this.view === "assistant") this.renderAssistant(card);
    else if (this.view === "program") this.renderProgram(card);
    else {
      card.append(this.node("p", operation === "finished" ? "Wäsche fertig" : this.label(this.state("cycle")), "muted"));
      this.appendActions(card,
        this.button("Waschprogramm wählen", () => { this.suggestedCycle = null; this.navigate("program"); }, { primary: true }),
        this.button("Programm empfehlen lassen", () => this.navigate("assistant")),
      );
    }
    if (this.advice) card.append(this.node("p", this.advice, "muted"));
    if (this.locked) card.append(this.node("p", "Fernsteuerung an der Waschmaschine aktivieren.", "muted"));
    if (this.error) {
      const error = this.node("p", this.error);
      error.setAttribute("role", "alert");
      card.append(error);
    }
    this.shadowRoot.replaceChildren(style, card);
    this.updateClock();
  }

  getCardSize() { return 5; }

  static getStubConfig() { return { prefix: "waschmaschine" }; }
}

if (!customElements.get("laundry-pilot-card")) {
  customElements.define("laundry-pilot-card", LaundryPilotCard);
  (window.customCards ||= []).push({
    type: "laundry-pilot-card",
    name: "Laundry Pilot Card",
    description: "Waschprogramme wählen, Empfehlungen erhalten und den Waschgang verfolgen.",
  });
}
