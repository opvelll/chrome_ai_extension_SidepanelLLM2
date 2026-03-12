function normalizeText(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function getPageText(): string {
  const article = document.querySelector('main, article, [role="main"]');
  const source = article?.textContent || document.body?.innerText || '';
  return normalizeText(source).slice(0, 12000);
}

let lastSelection = '';

async function publishSelectionSnapshot() {
  const nextSelection = normalizeText(window.getSelection()?.toString() ?? '');

  if (nextSelection === lastSelection) {
    return;
  }

  lastSelection = nextSelection;

  try {
    await chrome.runtime.sendMessage({
      type: 'context.selectionChanged',
      payload: { text: nextSelection },
    });
  } catch {
    // Ignore transient runtime disconnects while pages are reloading.
  }
}

document.addEventListener('selectionchange', () => {
  void publishSelectionSnapshot();
});

document.addEventListener('mouseup', () => {
  void publishSelectionSnapshot();
});

document.addEventListener('keyup', () => {
  void publishSelectionSnapshot();
});

chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
  if (request?.type === 'content.getSelection') {
    const selection = window.getSelection()?.toString() ?? '';
    sendResponse({ text: normalizeText(selection) });
    return;
  }

  if (request?.type === 'content.getPageText') {
    sendResponse({ text: getPageText() });
  }
});
