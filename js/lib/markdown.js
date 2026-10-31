// A tiny, safe Markdown renderer for recipes pasted from Claude.
// Supports: headings, bullet and numbered lists, tables, bold, italic,
// horizontal rules and paragraphs. Everything is HTML-escaped first,
// so pasted text can never inject scripts into the page.

function escapeHtml(text) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function inline(text) {
  return escapeHtml(text)
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/__(.+?)__/g, "<strong>$1</strong>")
    .replace(/(^|[^*])\*([^*\s][^*]*?)\*(?!\*)/g, "$1<em>$2</em>")
    .replace(/`([^`]+)`/g, "<code>$1</code>");
}

function tableCells(line) {
  return line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => cell.trim());
}

export function renderMarkdown(source) {
  const lines = (source || "").replace(/\r\n/g, "\n").split("\n");
  const html = [];
  let listType = null; // "ul", "ol" or null
  let paragraph = [];
  let table = [];

  function closeParagraph() {
    if (paragraph.length) {
      html.push("<p>" + paragraph.map(inline).join("<br>") + "</p>");
      paragraph = [];
    }
  }
  function closeList() {
    if (listType) {
      html.push("</" + listType + ">");
      listType = null;
    }
  }
  function closeTable() {
    if (!table.length) {
      return;
    }
    // Skip the |---|---| separator row.
    const rows = table.filter((row) => !/^\s*\|?[\s:|-]+\|?\s*$/.test(row));
    let out = '<div class="table-wrap"><table>';
    rows.forEach(function (row, index) {
      const tag = index === 0 ? "th" : "td";
      out += "<tr>" + tableCells(row).map((c) => "<" + tag + ">" + inline(c) + "</" + tag + ">").join("") + "</tr>";
    });
    html.push(out + "</table></div>");
    table = [];
  }
  function closeAll() {
    closeParagraph();
    closeList();
    closeTable();
  }

  for (const line of lines) {
    const trimmed = line.trim();

    if (trimmed.startsWith("|")) {
      closeParagraph();
      closeList();
      table.push(trimmed);
      continue;
    }
    closeTable();

    if (trimmed === "") {
      closeParagraph();
      closeList();
      continue;
    }

    const heading = trimmed.match(/^(#{1,6})\s+(.*)$/);
    if (heading) {
      closeAll();
      // h1 is the recipe title, so headings start at h2.
      const level = Math.min(heading[1].length + 1, 4);
      html.push("<h" + level + ">" + inline(heading[2]) + "</h" + level + ">");
      continue;
    }

    if (/^(-{3,}|\*{3,}|_{3,})$/.test(trimmed)) {
      closeAll();
      html.push("<hr>");
      continue;
    }

    const bullet = trimmed.match(/^[-*•]\s+(.*)$/);
    const numbered = trimmed.match(/^\d+[.)]\s+(.*)$/);
    if (bullet || numbered) {
      closeParagraph();
      const type = bullet ? "ul" : "ol";
      if (listType !== type) {
        closeList();
        html.push("<" + type + ">");
        listType = type;
      }
      html.push("<li>" + inline((bullet || numbered)[1]) + "</li>");
      continue;
    }

    closeList();
    paragraph.push(trimmed);
  }

  closeAll();
  return html.join("\n");
}
