export function getDocumentStylesHtml(doc = document) {
  return Array.from(doc.querySelectorAll('style, link[rel="stylesheet"]'))
    .map((node) => node.outerHTML)
    .join("\n");
}

export function openAndPrintHtml({ title, bodyHtml, stylesHtml = "", windowFeatures = "noopener,noreferrer" }) {
  const printWindow = window.open("", "_blank", windowFeatures);
  if (!printWindow) {
    return false;
  }

  printWindow.document.open();
  printWindow.document.write(`<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>${title}</title>
    ${stylesHtml}
  </head>
  <body>
    ${bodyHtml}
    <script>
      window.addEventListener("load", function () {
        setTimeout(function () { window.print(); }, 80);
      });
    </script>
  </body>
</html>`);
  printWindow.document.close();
  printWindow.focus();
  return true;
}
