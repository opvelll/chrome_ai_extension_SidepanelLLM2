function normalizeText(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function getPageText(): string {
  const article = document.querySelector('main, article, [role="main"]');
  const source = article?.textContent || document.body?.innerText || '';
  return normalizeText(source).slice(0, 12000);
}

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
