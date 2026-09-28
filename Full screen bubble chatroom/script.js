function preferredChatName(displayName, login = '') {
  const display = String(displayName || '').trim();
  const id = String(login || '').trim();
  const hasChinese = value => /\p{Script=Han}/u.test(value);
  // Streamlabs may supply the localized name with its Latin login in parentheses.
  const parts = display.match(/^(.*?)\s*[（(]([^()（）]+)[)）]\s*$/u);
  const candidates = parts ? [parts[1].trim(), parts[2].trim(), id] : [display, id];
  const chinese = candidates.find(hasChinese);
  if (chinese) return chinese;
  if (id && /^[a-zA-Z0-9_]+$/.test(id)) return id;
  if (parts && /^[a-zA-Z0-9_]+$/.test(parts[2].trim())) return parts[2].trim();
  return display || id;
}

/* Streamlabs Chat Box → JS. Messages are inserted by Streamlabs, not a separate Twitch login. */
(() => {
  const log = document.getElementById('log');
  if (!log) return;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const preview = new URLSearchParams(location.search).get('preview') === '1';
  let count = 0;
  let demoTimer;
  const lifetimes = new Map();
  function layout(node, n) {
    const preferred = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--bubble-width')) || 290;
    // Size to the content, capped at the normal width; only short messages shrink.
    const text = node.querySelector('.chat-text');
    const name = node.querySelector('.chat-name');
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    function measure(element) {
      if (!element) return 0;
      const style = getComputedStyle(element);
      context.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
      const textWidth = Math.max(0, ...element.textContent.split('\n').map(line => context.measureText(line).width));
      const imageWidth = [...element.querySelectorAll('img')].reduce((sum, image) => sum + (image.width || 32), 0);
      return textWidth + imageWidth;
    }
    const contentWidth = Math.max(measure(text), measure(name));
    const compact = contentWidth < preferred - 64 && n % 3 !== 0;
    const paddingX = compact ? 25 : 32;
    const width = Math.min(preferred, Math.max(160, contentWidth + paddingX * 2 + 4), Math.max(100, log.clientWidth - 32));
    const lanes = Math.max(1, Math.floor(log.clientWidth / (preferred + 28)));
    const lane = n % lanes;
    const room = Math.max(0, log.clientWidth - width - 32);
    node.style.setProperty('--width', width + 'px');
    node.style.setProperty('--height', '0px');
    node.style.setProperty('--pad-y', (compact ? 25 : 32) + 'px');
    node.style.setProperty('--pad-x', paddingX + 'px');
    node.style.setProperty('--x', (16 + (lanes === 1 ? room / 2 : room * lane / (lanes - 1))) + 'px');
    node.style.setProperty('--travel', (log.clientHeight + 80) + 'px');
    node.style.setProperty('--sway', (lane % 2 ? -12 : 12) + 'px');
    node.style.setProperty('--rest', (10 + n % 3 * 28) + '%');
  }
  function remove(node) { clearTimeout(lifetimes.get(node)); lifetimes.delete(node); node.remove(); }
  function decorate() {
    for (const [node, timer] of lifetimes) if (!node.isConnected) { clearTimeout(timer); lifetimes.delete(node); }
    for (const node of log.children) {
      if (node.dataset.decorated) continue;
      const name = node.querySelector('.name');
      if (name) name.textContent = preferredChatName(name.textContent, node.dataset.from);
      const n = count++;
      node.dataset.decorated = 'true';
      node.dataset.order = n;
      node.dataset.tone = n % 3;
      node.dataset.depth = ['near', 'far', 'middle', 'near', 'middle', 'far'][n % 6];
      node.classList.add('chat-message');
      layout(node, n);
      node.addEventListener('animationend', () => remove(node), { once: true });
      // Cleanup also runs when animation is disabled by accessibility preferences.
      const seconds = parseFloat(getComputedStyle(node).animationDuration) || 26;
      lifetimes.set(node, setTimeout(() => remove(node), (seconds + 2) * 1000));
    }
    while (log.children.length > (reduced.matches ? 3 : 35)) remove(log.firstElementChild);
  }
  new MutationObserver(decorate).observe(log, { childList: true });
  function liveMode() {
    clearInterval(demoTimer);
    log.querySelectorAll('[data-demo]').forEach(remove);
    decorate();
  }
  document.addEventListener('onLoad', liveMode);
  document.addEventListener('onEventReceived', liveMode);
  window.addEventListener('resize', () => {
    for (const node of log.children) layout(node, Number(node.dataset.order));
  });
  decorate();
  // Only an explicit local preview opts into simulated chat. Live mode is empty until a real message arrives.
  if (preview && ['127.0.0.1', 'localhost', ''].includes(location.hostname)) {
    const samples = [['小海獺 (sea_otter)', '安安！今天也來報到了 🫧'], ['momo', '這個泡泡好可愛！'], ['星星糖（star_candy）', '實況主加油 ✨'], ['Sinsi', '歡迎來到聊天室 🐚'], ['藍鯨先生', '這場太精彩了！！！'], ['小島', '大家晚上好 💜']];
    function demo(i, delay = 0) {
      const node = document.createElement('div');
      node.dataset.demo = 'true';
      node.style.setProperty('--delay', delay + 's');
      const name = document.createElement('div'); name.className = 'chat-name'; const label = document.createElement('span'); label.className = 'name'; label.textContent = samples[i % samples.length][0]; name.append(label);
      const text = document.createElement('div'); text.className = 'chat-text'; text.textContent = samples[i % samples.length][1];
      node.append(name, text); log.append(node); decorate();
    }
    samples.forEach((_, i) => demo(i, -3 - i * 3.5));
    let i = 0;
    demoTimer = setInterval(() => { if (!document.hidden) demo(i++); }, 3500);
  }
})();




