// ===== <dobble-player> Web Component =====
// Light DOM player row with avatar, name, and score.
// Usage: <dobble-player class="mp-player-row"></dobble-player>
// Call .update({ avatar, name, score, useCustomImages }) to populate.

import { renderAvatarHtml } from '../helpers/ui-utils.js';

class DobblePlayer extends HTMLElement {
  connectedCallback() {
    this._ensureBuilt();
  }

  _ensureBuilt() {
    if (this._built) return;
    this._built = true;

    const $topRow = document.createElement('span');
    $topRow.className = 'mp-player-top';

    this._$avatar = document.createElement('span');
    this._$avatar.className = 'mp-player-avatar';

    this._$score = document.createElement('span');
    this._$score.className = 'mp-player-score';

    $topRow.append(this._$avatar, this._$score);

    this._$name = document.createElement('span');
    this._$name.className = 'mp-player-name';

    this.append($topRow, this._$name);
  }

  update({ avatar, name, score, useCustomImages } = {}) {
    this._ensureBuilt();
    this._$avatar.innerHTML = renderAvatarHtml(avatar || '', useCustomImages);
    this._$name.textContent = name || 'Anonymous';
    this._$score.textContent = score ?? 0;
  }
}

customElements.define('dobble-player', DobblePlayer);
