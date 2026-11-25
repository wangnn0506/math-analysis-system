if (typeof window.renderMathInElement === 'function') {
  for (const stem of document.querySelectorAll('.stem')) {
    window.renderMathInElement(stem, {
      delimiters: [
        { left: '$$', right: '$$', display: true },
        { left: '$', right: '$', display: false },
        { left: '\\[', right: '\\]', display: true },
        { left: '\\(', right: '\\)', display: false },
      ],
      throwOnError: true,
      trust: false,
      maxExpand: 200,
      maxSize: 20,
      errorCallback: () => {},
    });
  }
}
