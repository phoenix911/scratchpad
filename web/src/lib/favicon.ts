// Dynamic tab chrome: a calendar-style favicon showing today's date, and a tab
// title that reflects the open file.

export function setDateFavicon() {
  const now = new Date();
  const day = now.getDate();
  const month = now.toLocaleString("en-US", { month: "short" }).toUpperCase();
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
    <rect x="1" y="1" width="30" height="30" rx="6" fill="#ffffff" stroke="#e3e3e0"/>
    <path d="M1 7a6 6 0 0 1 6-6h18a6 6 0 0 1 6 6v3H1Z" fill="#2383e2"/>
    <text x="16" y="8" font-family="ui-monospace,monospace" font-size="5.5" font-weight="700" fill="#fff" text-anchor="middle">${month}</text>
    <text x="16" y="27" font-family="ui-monospace,monospace" font-size="17" font-weight="700" fill="#1a1a1a" text-anchor="middle">${day}</text>
  </svg>`;
  const href = "data:image/svg+xml," + encodeURIComponent(svg);

  let link = document.querySelector<HTMLLinkElement>("link[rel='icon']");
  if (!link) {
    link = document.createElement("link");
    link.rel = "icon";
    document.head.appendChild(link);
  }
  link.type = "image/svg+xml";
  link.href = href;
}

export function setTitle(name?: string) {
  document.title = name ? `${name} · scratchpad` : "scratchpad";
}
