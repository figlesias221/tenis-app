/**
 * Upgrades every `[data-cselect]` on the page into a custom listbox.
 *
 * Lives in its own module, loaded once from the layout, because some pages
 * (head-to-head) render their selects without using the Select component and
 * still need the behaviour.
 *
 * The native <select> stays the source of truth, so the controls keep working
 * with scripting off.
 */

function enhance(root: HTMLElement) {
  const found = root.querySelector<HTMLSelectElement>("select");
  if (!found || found.dataset.enhanced) return;
  // Bound to a non-nullable const so the narrowing survives into the
  // closures below.
  const native: HTMLSelectElement = found;
  native.dataset.enhanced = "true";
  native.classList.add("is-enhanced");

  const navigate = root.dataset.navigate !== undefined;
  const listId = `${native.id}-list`;

  const button = document.createElement("button");
  button.type = "button";
  button.className = "cselect-button";
  button.setAttribute("aria-haspopup", "listbox");
  button.setAttribute("aria-expanded", "false");
  button.setAttribute("aria-controls", listId);
  button.setAttribute("aria-labelledby", `${native.id}-label ${native.id}-value`);

  const value = document.createElement("span");
  value.className = "cselect-value";
  value.id = `${native.id}-value`;
  const caret = document.createElement("span");
  caret.className = "cselect-caret";
  caret.setAttribute("aria-hidden", "true");
  button.append(value, caret);

  const list = document.createElement("ul");
  list.className = "cselect-list";
  list.id = listId;
  list.setAttribute("role", "listbox");
  list.hidden = true;

  const label = root.querySelector("label");
  if (label) label.id = `${native.id}-label`;

  const items: HTMLLIElement[] = [...native.options].map((opt, i) => {
    const li = document.createElement("li");
    li.className = "cselect-option";
    li.id = `${native.id}-opt-${i}`;
    li.setAttribute("role", "option");
    li.textContent = opt.label;
    li.dataset.value = opt.value;
    li.setAttribute("aria-selected", String(opt.selected));
    list.append(li);
    return li;
  });

  root.append(button, list);
  const sync = () => { value.textContent = native.options[native.selectedIndex]?.label ?? ""; };
  sync();

  let open = false;
  let active = Math.max(0, native.selectedIndex);

  function paint() {
    items.forEach((li, i) => {
      li.setAttribute("aria-selected", String(i === native.selectedIndex));
      li.classList.toggle("is-active", i === active);
    });
    if (open) list.setAttribute("aria-activedescendant", items[active]?.id ?? "");
  }

  function setOpen(next: boolean) {
    open = next;
    list.hidden = !next;
    button.setAttribute("aria-expanded", String(next));
    if (next) {
      active = Math.max(0, native.selectedIndex);
      paint();
      items[active]?.scrollIntoView({ block: "nearest" });
    }
  }

  function choose(i: number) {
    if (i < 0 || i >= items.length) return;
    native.selectedIndex = i;
    sync();
    paint();
    setOpen(false);
    button.focus();
    if (navigate) {
      const v = items[i].dataset.value;
      if (v) location.href = `${root.dataset.base ?? ""}${v}`;
    } else {
      native.dispatchEvent(new Event("change", { bubbles: true }));
    }
  }

  button.addEventListener("click", () => setOpen(!open));

  list.addEventListener("click", (e) => {
    const li = (e.target as HTMLElement).closest("li");
    if (li) choose(items.indexOf(li as HTMLLIElement));
  });
  list.addEventListener("mousemove", (e) => {
    const li = (e.target as HTMLElement).closest("li");
    if (li) { active = items.indexOf(li as HTMLLIElement); paint(); }
  });

  let typed = "";
  let typedAt = 0;

  button.addEventListener("keydown", (e) => {
    const k = e.key;
    if (!open && (k === "ArrowDown" || k === "ArrowUp" || k === "Enter" || k === " ")) {
      e.preventDefault(); setOpen(true); return;
    }
    if (!open) return;

    if (k === "Escape") { e.preventDefault(); setOpen(false); button.focus(); return; }
    if (k === "Enter" || k === " ") { e.preventDefault(); choose(active); return; }
    if (k === "Tab") { setOpen(false); return; }
    if (k === "ArrowDown") { e.preventDefault(); active = Math.min(items.length - 1, active + 1); }
    else if (k === "ArrowUp") { e.preventDefault(); active = Math.max(0, active - 1); }
    else if (k === "Home") { e.preventDefault(); active = 0; }
    else if (k === "End") { e.preventDefault(); active = items.length - 1; }
    else if (k.length === 1) {
      // Type-ahead, the way a native select behaves.
      const now = Date.now();
      typed = now - typedAt > 800 ? k : typed + k;
      typedAt = now;
      const hit = items.findIndex((li) => li.textContent?.toLowerCase().startsWith(typed.toLowerCase()));
      if (hit >= 0) active = hit;
    } else return;

    paint();
    items[active]?.scrollIntoView({ block: "nearest" });
  });

  document.addEventListener("click", (e) => {
    if (open && !root.contains(e.target as Node)) setOpen(false);
  });

  // Something else may drive the native control (a reset, or another script).
  native.addEventListener("change", () => { sync(); paint(); });

  // Some selects are filled in after load. Rebuild the list when the native
  // options change, so the custom control never shows a stale set.
  new MutationObserver(() => {
    list.textContent = "";
    items.length = 0;
    [...native.options].forEach((opt, i) => {
      const li = document.createElement("li");
      li.className = "cselect-option";
      li.id = `${native.id}-opt-${i}`;
      li.setAttribute("role", "option");
      li.textContent = opt.label;
      li.dataset.value = opt.value;
      list.append(li);
      items.push(li);
    });
    active = Math.max(0, native.selectedIndex);
    sync();
    paint();
  }).observe(native, { childList: true });

  paint();
}


export function initSelects(scope: ParentNode = document) {
  for (const el of scope.querySelectorAll<HTMLElement>("[data-cselect]")) enhance(el);
}

initSelects();
