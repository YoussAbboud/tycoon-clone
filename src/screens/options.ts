// Options: volume/music/sfx, save export/import, reset.

import type { Screen } from '../main.ts';
import { el } from '../ui.ts';
import { clearSave, exportSave, importSave, saveGame } from '../game.ts';

export const optionsScreen: Screen = {
  mount(root, ctx) {
    const panel = el('div', 'panel');
    panel.appendChild(el('h2', '', '⚙ Options'));

    // Volume
    const volRow = el('div', 'opt-row');
    volRow.innerHTML = `<label for="opt-vol">Volume</label>`;
    const vol = el('input') as HTMLInputElement;
    vol.type = 'range';
    vol.id = 'opt-vol';
    vol.min = '0';
    vol.max = '1';
    vol.step = '0.05';
    vol.value = String(ctx.options.volume);
    vol.oninput = () => {
      ctx.options.volume = Number(vol.value);
      ctx.save();
    };
    volRow.appendChild(vol);
    panel.appendChild(volRow);

    const toggle = (label: string, key: 'music' | 'sfx') => {
      const row = el('div', 'opt-row');
      const cb = el('input') as HTMLInputElement;
      cb.type = 'checkbox';
      cb.checked = ctx.options[key];
      cb.onchange = () => {
        ctx.options[key] = cb.checked;
        ctx.save();
        if (key === 'music') (cb.checked ? ctx.audio.startMusic() : ctx.audio.stopMusic());
      };
      const lab = el('label', '', label);
      lab.prepend(cb);
      row.appendChild(lab);
      panel.appendChild(row);
    };
    toggle(' Music', 'music');
    toggle(' Sound effects', 'sfx');

    // Save management
    const savePanel = el('div', 'panel');
    savePanel.appendChild(el('div', 'panel-title', '💾 Save data'));
    const box = el('textarea', 'savebox') as HTMLTextAreaElement;
    box.placeholder = 'Exported save JSON appears here; paste a save here to import.';
    const row = el('div', 'row');
    const btnExport = el('button', 'candy small', 'Export to text');
    const btnDownload = el('button', 'candy small blue', 'Download .json');
    const btnImport = el('button', 'candy small green', 'Import from text');
    const btnReset = el('button', 'candy small red', 'Delete save');
    const msg = el('span', 'muted');

    btnExport.onclick = () => {
      if (!ctx.state) {
        msg.textContent = 'No game in progress.';
        return;
      }
      box.value = exportSave(ctx.state);
      msg.textContent = 'Copied into the box below.';
    };
    btnDownload.onclick = () => {
      if (!ctx.state) {
        msg.textContent = 'No game in progress.';
        return;
      }
      const blob = new Blob([exportSave(ctx.state)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `fresh-squeeze-day${ctx.state.day}.json`;
      a.click();
      URL.revokeObjectURL(a.href);
    };
    btnImport.onclick = () => {
      try {
        const s = importSave(box.value);
        ctx.state = s;
        saveGame(s);
        msg.textContent = 'Save imported!';
      } catch (err) {
        msg.textContent = `Import failed: ${(err as Error).message}`;
      }
    };
    btnReset.onclick = () => {
      if (confirm('Delete the saved game? This cannot be undone.')) {
        clearSave();
        ctx.state = null;
        msg.textContent = 'Save deleted.';
      }
    };
    row.append(btnExport, btnDownload, btnImport, btnReset, msg);
    savePanel.append(row, box);

    const back = el('button', 'candy big', '← Back');
    back.style.marginTop = '12px';
    back.onclick = () => {
      ctx.audio.click();
      ctx.goto(ctx.state ? 'planning' : 'menu');
    };

    root.append(panel, savePanel, back);
  },
};
