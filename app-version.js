(async function showAppVersion({ $versionEl }) {
  try {
    const res = await fetch('./version.json', { cache: 'no-store' });
    if (!res.ok) {
      console.warn('version response error', res);
      return;
    }
    const versionData = await res.json();
    if ($versionEl)
      $versionEl.textContent = `
    🪾${versionData.version}
    🕰️${new Date(versionData.timestamp).toLocaleString()}`;
  } catch (e) {
    console.warn('fetch version error', e);
  }
})({ $versionEl: $appVersion });
