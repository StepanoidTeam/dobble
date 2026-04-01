// ===== <input-range> Web Component =====
// Light DOM range slider with auto-updating progress track.
// Usage: <input-range id="$timer" min="5" max="100" step="5" value="10"></input-range>
// Access .value / .min / .max / .step as on a native <input type="range">.

import { roundUiNumber } from '../helpers/ui-utils.js';

class DobbleRange extends HTMLElement {
  connectedCallback() {
    const $input = document.createElement('input');
    $input.type = 'range';
    $input.min = this.getAttribute('min') ?? '0';
    $input.max = this.getAttribute('max') ?? '100';
    $input.step = this.getAttribute('step') ?? '1';
    $input.value = this.getAttribute('value') ?? '50';

    this.appendChild($input);
    this._$input = $input;

    this._updateProgress();

    $input.addEventListener('input', () => {
      this._updateProgress();
    });
  }

  _updateProgress() {
    const $input = this._$input;
    if (!$input) return;

    const min = parseFloat($input.min || '0');
    const max = parseFloat($input.max || '100');
    const value = parseFloat($input.value || '0');
    const span = max - min;
    const progress = span <= 0 ? 0 : ((value - min) / span) * 100;
    const normalized = Math.max(0, Math.min(100, progress));

    $input.style.setProperty(
      '--range-progress',
      `${roundUiNumber(normalized)}%`,
    );
  }

  // ===== Proxy properties to inner <input> =====
  get value() {
    return this._$input?.value ?? this.getAttribute('value') ?? '';
  }
  set value(v) {
    if (this._$input) {
      this._$input.value = v;
      this._updateProgress();
    }
  }

  get min() {
    return this._$input?.min ?? this.getAttribute('min') ?? '0';
  }
  set min(v) {
    if (this._$input) {
      this._$input.min = v;
      this._updateProgress();
    }
  }

  get max() {
    return this._$input?.max ?? this.getAttribute('max') ?? '100';
  }
  set max(v) {
    if (this._$input) {
      this._$input.max = v;
      this._updateProgress();
    }
  }

  get step() {
    return this._$input?.step ?? this.getAttribute('step') ?? '1';
  }
  set step(v) {
    if (this._$input) this._$input.step = v;
  }
}

customElements.define('input-range', DobbleRange);
