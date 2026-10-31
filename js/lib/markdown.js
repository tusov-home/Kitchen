// A tiny, safe Markdown renderer for recipes pasted from Claude.
// Supports: headings, bullet and numbered lists, tables, bold, italic,
// horizontal rules and paragraphs. Everything is HTML-escaped first,
// so pasted text can never inject scripts into the page.
//
// With options.scale (e.g. 2 for double), amounts in the ingredients
// part are multiplied and highlighted. The method is never scaled, so
// oven temperatures and cooking times stay as they are.
import { scaleLine } from "./scale.js";
import { STARTS_WITH_AMOUNT, headingOf, createSectionTracker } from "./sections.js";

// Invisible markers around scaled amounts, turned into <span>s after escaping.
const MARK_START = "\u0001";
const MARK_END = "\u0002";


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
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(new RegExp(MARK_START + "(.*?)" + MARK_END, "g"), '<span class="scaled">$1</span>');
}

function tableCells(line) {
  return line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => cell.trim());
}

export function renderMarkdown(source, options) {
  const factor = (options && options.scale) || 1;
  const lines = (source || "").replace(/\r\n/g, "\n").split("\n");
  const html = [];
  let listType = null; // "ul", "ol" or null
  let paragraph = [];
  let table = [];

  // Is there a clear "Ingredients" section? If not, we only scale
  // bullet points that start with an amount.
  const tracker = createSectionTracker(lines);

  function mark(text) {
    return MARK_START + text + MARK_END;
  }
  function scaled(text, kind) {
    if (factor === 1) {
      return text;
    }
    if (tracker.hasIngredientSection) {
      if (!tracker.isInIngredients()) {
        return text;
      }
      if (kind === "paragraph" && !STARTS_WITH_AMOUNT.test(text)) {
        return text;
      }
      return scaleLine(text, factor, mark);
    }
    if (kind === "ul" && STARTS_WITH_AMOUNT.test(text)) {
      return scaleLine(text, factor, mark);
    }
    return text;
  }

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
      const cells = tableCells(row).map(function (cell) {
        const text = index === 0 ? cell : scaled(cell, "table");
        return "<" + tag + ">" + inline(text) + "</" + tag + ">";
      });
      out += "<tr>" + cells.join("") + "</tr>";
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
      tracker.heading(heading[2], heading[1].length);
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
      html.push("<li>" + inline(scaled((bullet || numbered)[1], type)) + "</li>");
      continue;
    }

    // "**Ingredients**" or "Method:" on its own line also starts a section.
    const pseudo = headingOf(trimmed);
    if (pseudo !== null && pseudo.level === 7) {
      closeAll();
      tracker.heading(pseudo.text, 7);
      paragraph.push(trimmed);
      closeParagraph();
      continue;
    }

    closeList();
    paragraph.push(scaled(trimmed, "paragraph"));
  }

  closeAll();
  return html.join("\n");
}
