#!/usr/bin/env python3
"""
Render the synthetic document corpus to PDF.

    python scripts/generate_corpus.py [--out rag/documents]

Output is deterministic: the same content produces byte-comparable text, so a
regenerated corpus does not silently invalidate retrieval fixtures. PDF
metadata (title, author, subject, keywords) is populated so the ingestion
pipeline can capture document metadata from the file itself rather than from a
side-car manifest.

Documents are laid out like controlled site documentation — front matter,
numbered sections, running header and footer with document ID, revision and
page number — so that page-based citation locators are meaningful.
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_JUSTIFY
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import (
    BaseDocTemplate,
    Frame,
    KeepTogether,
    PageBreak,
    PageTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
)

sys.path.insert(0, str(Path(__file__).resolve().parent))
from corpus_content import CORPUS, output_path  # noqa: E402

ACCENT = colors.HexColor("#1F3A5F")
RULE = colors.HexColor("#B8C2CC")
WARN_BG = colors.HexColor("#FDF3F3")
WARN_BORDER = colors.HexColor("#C0392B")
NOTE_BG = colors.HexColor("#F2F6FA")
NOTE_BORDER = colors.HexColor("#5A7DA0")

PAGE_W, PAGE_H = A4
MARGIN = 22 * mm
TOP_MARGIN = 30 * mm
BOTTOM_MARGIN = 24 * mm


def build_styles() -> dict[str, ParagraphStyle]:
    base = getSampleStyleSheet()["Normal"]
    return {
        "body": ParagraphStyle(
            "body", parent=base, fontName="Times-Roman", fontSize=10.5, leading=15,
            alignment=TA_JUSTIFY, spaceAfter=7,
        ),
        "h1": ParagraphStyle(
            "h1", parent=base, fontName="Helvetica-Bold", fontSize=13, leading=17,
            textColor=ACCENT, spaceBefore=14, spaceAfter=7,
        ),
        "h2": ParagraphStyle(
            "h2", parent=base, fontName="Helvetica-Bold", fontSize=11, leading=15,
            textColor=ACCENT, spaceBefore=10, spaceAfter=5,
        ),
        "title": ParagraphStyle(
            "title", parent=base, fontName="Helvetica-Bold", fontSize=19, leading=24,
            textColor=ACCENT, spaceAfter=4,
        ),
        "subtitle": ParagraphStyle(
            "subtitle", parent=base, fontName="Helvetica", fontSize=11, leading=15,
            textColor=colors.HexColor("#555F6B"), spaceAfter=14,
        ),
        "callout": ParagraphStyle(
            "callout", parent=base, fontName="Times-Roman", fontSize=10, leading=14,
            alignment=TA_JUSTIFY,
        ),
        "caption": ParagraphStyle(
            "caption", parent=base, fontName="Helvetica-Oblique", fontSize=8.5,
            leading=11, textColor=colors.HexColor("#5A6270"), spaceBefore=3, spaceAfter=10,
        ),
        "cell": ParagraphStyle(
            "cell", parent=base, fontName="Times-Roman", fontSize=9.5, leading=12.5,
        ),
        "cellhead": ParagraphStyle(
            "cellhead", parent=base, fontName="Helvetica-Bold", fontSize=9.5,
            leading=12.5, textColor=colors.white,
        ),
        "meta": ParagraphStyle(
            "meta", parent=base, fontName="Helvetica", fontSize=9, leading=12.5,
        ),
        "metalabel": ParagraphStyle(
            "metalabel", parent=base, fontName="Helvetica-Bold", fontSize=9,
            leading=12.5, textColor=colors.HexColor("#5A6270"),
        ),
    }


class ControlledDocTemplate(BaseDocTemplate):
    """Adds the running header and footer that make page locators readable."""

    def __init__(self, path: str, spec: dict, **kw):
        super().__init__(
            path, pagesize=A4,
            leftMargin=MARGIN, rightMargin=MARGIN,
            topMargin=TOP_MARGIN, bottomMargin=BOTTOM_MARGIN,
            title=f"{spec['doc_id']} — {spec['title']}",
            author=spec["owner"],
            subject=spec["kind"],
            keywords=", ".join(spec["tags"]),
            **kw,
        )
        self.spec = spec
        frame = Frame(
            self.leftMargin, self.bottomMargin,
            self.width, self.height, id="body",
        )
        self.addPageTemplates([PageTemplate(id="main", frames=[frame], onPage=self._decorate)])

    def _decorate(self, canvas, _doc):
        s = self.spec
        canvas.saveState()

        canvas.setFont("Helvetica", 7.5)
        canvas.setFillColor(colors.HexColor("#5A6270"))
        canvas.drawString(MARGIN, PAGE_H - 18 * mm, f"{s['doc_id']}  {s['revision']}")
        canvas.drawRightString(PAGE_W - MARGIN, PAGE_H - 18 * mm, s["title"])
        canvas.setStrokeColor(RULE)
        canvas.setLineWidth(0.5)
        canvas.line(MARGIN, PAGE_H - 20 * mm, PAGE_W - MARGIN, PAGE_H - 20 * mm)

        canvas.line(MARGIN, BOTTOM_MARGIN - 5 * mm, PAGE_W - MARGIN, BOTTOM_MARGIN - 5 * mm)
        canvas.drawString(
            MARGIN, BOTTOM_MARGIN - 10 * mm,
            f"{s['classification']} — uncontrolled when printed",
        )
        canvas.drawRightString(
            PAGE_W - MARGIN, BOTTOM_MARGIN - 10 * mm, f"Page {canvas.getPageNumber()}",
        )
        canvas.restoreState()


def front_matter(spec: dict, st: dict) -> list:
    rows = [
        ("Document ID", spec["doc_id"]),
        ("Revision", spec["revision"]),
        ("Document type", spec["kind"].replace("-", " ").capitalize()),
        ("Effective date", spec["effective_date"]),
        ("Next review", spec["review_date"]),
        ("Document owner", spec["owner"]),
        ("Applicable site", spec["site"]),
        ("Applicable unit", spec["unit"]),
        ("Asset class", spec["asset_class"]),
        ("Classification", spec["classification"]),
    ]
    table = Table(
        [[Paragraph(k, st["metalabel"]), Paragraph(v, st["meta"])] for k, v in rows],
        colWidths=[42 * mm, None],
        hAlign="LEFT",
    )
    table.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("TOPPADDING", (0, 0), (-1, -1), 2),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
        ("LINEBELOW", (0, 0), (-1, -2), 0.25, RULE),
    ]))
    return [
        Paragraph(spec["doc_id"], st["title"]),
        Paragraph(spec["title"], st["subtitle"]),
        table,
        Spacer(1, 10 * mm),
    ]


def callout(text: str, label: str, bg, border, st: dict) -> Table:
    inner = Paragraph(f"<b>{label}</b>&nbsp;&nbsp;{text}", st["callout"])
    table = Table([[inner]], colWidths=[PAGE_W - 2 * MARGIN])
    table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), bg),
        ("LINEBEFORE", (0, 0), (0, -1), 2.2, border),
        ("BOX", (0, 0), (-1, -1), 0.25, border),
        ("LEFTPADDING", (0, 0), (-1, -1), 8),
        ("RIGHTPADDING", (0, 0), (-1, -1), 8),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
    ]))
    return table


def data_table(caption: str, rows: list[list[str]], st: dict) -> KeepTogether:
    head, *body = rows
    cells = [[Paragraph(c, st["cellhead"]) for c in head]]
    cells += [[Paragraph(c, st["cell"]) for c in r] for r in body]

    table = Table(cells, repeatRows=1, hAlign="LEFT", colWidths=[(PAGE_W - 2 * MARGIN) / len(head)] * len(head))
    table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), ACCENT),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("GRID", (0, 0), (-1, -1), 0.25, RULE),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#F7F9FB")]),
        ("LEFTPADDING", (0, 0), (-1, -1), 5),
        ("RIGHTPADDING", (0, 0), (-1, -1), 5),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ]))
    return KeepTogether([table, Paragraph(caption, st["caption"])])


def render_blocks(spec: dict, st: dict) -> list:
    flow: list = []
    for block in spec["blocks"]:
        kind = block[0]

        if kind == "h1":
            _, num, text = block
            flow.append(Paragraph(f"{num}&nbsp;&nbsp;&nbsp;{text}", st["h1"]))
        elif kind == "h2":
            _, num, text = block
            flow.append(Paragraph(f"{num}&nbsp;&nbsp;&nbsp;{text}", st["h2"]))
        elif kind == "p":
            flow.append(Paragraph(block[1], st["body"]))
        elif kind == "steps":
            for i, item in enumerate(block[1], start=1):
                flow.append(Paragraph(f"{i}.&nbsp;&nbsp;{item}", st["body"]))
        elif kind == "bullets":
            for item in block[1]:
                flow.append(Paragraph(f"&bull;&nbsp;&nbsp;{item}", st["body"]))
        elif kind == "table":
            _, caption, rows = block
            flow.append(Spacer(1, 3 * mm))
            flow.append(data_table(caption, rows, st))
        elif kind == "note":
            flow.append(Spacer(1, 2 * mm))
            flow.append(callout(block[1], "NOTE", NOTE_BG, NOTE_BORDER, st))
            flow.append(Spacer(1, 4 * mm))
        elif kind == "warning":
            flow.append(Spacer(1, 2 * mm))
            flow.append(callout(block[1], "WARNING", WARN_BG, WARN_BORDER, st))
            flow.append(Spacer(1, 4 * mm))
        elif kind == "pagebreak":
            flow.append(PageBreak())
        else:  # pragma: no cover - guards against a typo in the content module
            raise ValueError(f"Unknown block type {kind!r} in {spec['doc_id']}")

    return flow


def generate(spec: dict, out_dir: Path, styles: dict) -> Path:
    path = out_dir / output_path(spec)
    path.parent.mkdir(parents=True, exist_ok=True)
    doc = ControlledDocTemplate(str(path), spec)
    doc.build(front_matter(spec, styles) + render_blocks(spec, styles))
    return path


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--out", default="rag/documents", type=Path,
        help="Output directory for the generated PDFs (default: rag/documents)",
    )
    args = parser.parse_args()

    out_dir: Path = args.out
    out_dir.mkdir(parents=True, exist_ok=True)
    styles = build_styles()

    print(f"Generating {len(CORPUS)} documents into {out_dir}/\n")
    last_folder = None
    for spec in sorted(CORPUS, key=output_path):
        path = generate(spec, out_dir, styles)
        folder = path.parent.name
        if folder != last_folder:
            print(f"  {folder}/")
            last_folder = folder
        flag = "   [prompt-injection fixture]" if spec.get("is_injection_fixture") else ""
        print(f"    {path.name:<52} {path.stat().st_size / 1024:5.1f} KB{flag}")

    print(f"\nDone. {len(CORPUS)} PDFs written.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
