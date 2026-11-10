"""Build twelve independently readable German manuals from reviewed UI screenshots.

Run with a Python environment providing reportlab, Pillow and PyMuPDF.
No network, user accounts or application backends are used by this script.
"""
from __future__ import annotations

import json
import pathlib
import sys
import zipfile
from html import escape

ROOT = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'node_modules/.tmp/docs-runtime'))
import pymupdf as fitz
from PIL import Image as PILImage, ImageDraw
from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Image, Table, TableStyle, PageBreak, KeepTogether

SOURCE = ROOT / 'docs/handbuecher'
OUT = ROOT / 'output/pdf'
QA = ROOT / 'tmp/pdfs'
BLUE = colors.HexColor('#1758c4')
INK = colors.HexColor('#202f46')
MUTED = colors.HexColor('#52617a')
PALE = colors.HexColor('#edf3fc')
PAGE_W, PAGE_H = landscape(A4)
WIDTH = PAGE_W - 80


def setup_fonts():
    font_root = pathlib.Path('C:/Windows/Fonts')
    for name, file in [('Manual', 'arial.ttf'), ('Manual-Bold', 'arialbd.ttf'), ('Manual-Italic', 'ariali.ttf')]:
        pdfmetrics.registerFont(TTFont(name, str(font_root / file)))
    pdfmetrics.registerFontFamily('Manual', normal='Manual', bold='Manual-Bold', italic='Manual-Italic', boldItalic='Manual-Bold')


class ManualDoc(SimpleDocTemplate):
    def afterFlowable(self, flowable):
        bookmark = getattr(flowable, 'manual_bookmark', None)
        if bookmark:
            self.canv.bookmarkPage(bookmark)
            self.canv.addOutlineEntry(flowable.getPlainText(), bookmark, level=0, closed=False)


def build(guide, version):
    styles = getSampleStyleSheet()
    for name, size, leading, color in [('Body', 10.8, 15.3, INK), ('Small', 9, 12.5, MUTED), ('Cell', 10, 14, INK), ('Label', 10, 14, BLUE)]:
        styles.add(ParagraphStyle(name=name, fontName='Manual-Bold' if name == 'Label' else 'Manual', fontSize=size, leading=leading, textColor=color, spaceAfter=8, alignment=TA_LEFT))
    styles.add(ParagraphStyle(name='TitleManual', fontName='Manual-Bold', fontSize=33, leading=38, textColor=INK, spaceAfter=14))
    styles.add(ParagraphStyle(name='HeadingManual', fontName='Manual-Bold', fontSize=20, leading=25, textColor=INK, spaceAfter=14))
    styles.add(ParagraphStyle(name='SubManual', fontName='Manual-Bold', fontSize=13, leading=18, textColor=BLUE, spaceAfter=9))

    def p(text, style='Body'):
        return Paragraph(escape(str(text)).replace('\n', '<br/>'), styles[style])

    def heading(text, key):
        item = p(text, 'HeadingManual')
        item.manual_bookmark = key
        return item

    def table(rows, widths):
        result = Table([[p(a, 'Label'), p(b, 'Cell')] for a, b in rows], colWidths=widths, hAlign='LEFT')
        result.setStyle(TableStyle([
            ('VALIGN', (0, 0), (-1, -1), 'TOP'),
            ('BACKGROUND', (0, 0), (0, -1), PALE),
            ('LINEBELOW', (0, 0), (-1, -1), 0.5, colors.HexColor('#dce4ef')),
            ('LEFTPADDING', (0, 0), (-1, -1), 11), ('RIGHTPADDING', (0, 0), (-1, -1), 11),
            ('TOPPADDING', (0, 0), (-1, -1), 8), ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
        ]))
        return result

    def footer(canvas, doc):
        canvas.saveState()
        canvas.setFillColor(BLUE)
        canvas.rect(0, PAGE_H - 8, PAGE_W, 8, fill=1, stroke=0)
        canvas.setFont('Manual-Bold', 9)
        canvas.setFillColor(INK)
        canvas.drawString(40, PAGE_H - 26, 'ForgeFlow / ' + guide['title'])
        canvas.setStrokeColor(colors.HexColor('#dce4ef'))
        canvas.line(40, 32, PAGE_W - 40, 32)
        canvas.setFont('Manual', 8)
        canvas.setFillColor(MUTED)
        canvas.drawString(40, 19, 'Benutzerhandbuch | Stand ' + version + ' | Screenshots mit synthetischen Beispieldaten')
        canvas.drawRightString(PAGE_W - 40, 19, str(doc.page))
        canvas.restoreState()

    story = [Spacer(1, 22), p('BENUTZERHANDBUCH · DEUTSCH', 'Label'), p(guide['title'], 'TitleManual'), p(guide['subtitle'], 'SubManual'), Spacer(1, 9), p(guide['purpose']), Spacer(1, 10),
             table([('Öffnen', guide['entry']), ('Voraussetzungen', guide['requires']), ('In diesem Handbuch', 'Zweck und Einstieg · Funktionen und Felder · kommentierte Bildschirmansichten · typischer Ablauf · Grenzen und Hilfe')], [140, WIDTH-140]),
             Spacer(1, 14), p('Die Abbildungen zeigen die tatsächlichen lokalen Anwendungsversionen mit eigens erzeugten Beispieldaten. Antworten, Statuswerte und Datensätze sind keine Produktivdaten und kein Nachweis einer echten externen Ausführung.', 'Small'), PageBreak(), heading('Funktionen und Felder', 'functions'), table(guide['features'], [160, WIDTH-160]), PageBreak()]
    for index, (key, title, caption) in enumerate(guide['screens']):
        image_file = SOURCE / 'screenshots' / (key + '.png')
        if not image_file.is_file():
            raise FileNotFoundError(image_file)
        story.append(heading(title, f'screen-{index}'))
        with PILImage.open(image_file) as source:
            width, height = source.size
        scale = min(WIDTH / width, 401 / height)
        picture = Image(str(image_file), width=width*scale, height=height*scale)
        picture.hAlign = 'LEFT'
        story.extend([picture, Spacer(1, 8), p(caption, 'Small'), PageBreak()])
    story.append(heading('Schritt für Schritt', 'workflow'))
    for index, step in enumerate(guide['workflow'], 1):
        story.append(KeepTogether([p(f'{index:02d}  {step}'), Spacer(1, 5)]))
    story.extend([Spacer(1, 6), p('Grenzen und wichtige Hinweise', 'SubManual')])
    for item in guide['limits']:
        story.append(p('• ' + item))
    story.extend([PageBreak(), heading('Wenn etwas nicht funktioniert', 'help'), table(guide['troubleshooting'], [180, WIDTH-180]), Spacer(1, 22), p('Weitere Hilfe', 'SubManual'),
                  p('Installation, Start, Ports, Sicherung und Serverupdates: README.md im ForgeFlow-Projekt. Die übrigen Handbücher liegen im selben PDF-Ordner. Für Kundenportal, Einstellungen und die einzelnen Apps gibt es jeweils ein eigenes Dokument.'),
                  p('Bei einer Fehlermeldung zuerst die betroffene Ansicht, den Zeitpunkt und den Speicher- beziehungsweise Verarbeitungsstatus notieren. Zugangsdaten, private Dokumentinhalte und API-Schlüssel nicht in Fehlermeldungen oder Screenshots weitergeben.', 'Small')])
    target = OUT / (guide['id'] + '.pdf')
    doc = ManualDoc(str(target), pagesize=landscape(A4), rightMargin=40, leftMargin=40, topMargin=45, bottomMargin=43,
                    title=guide['title'] + ' - ForgeFlow Benutzerhandbuch', author='ForgeFlow', subject=guide['subtitle'], pageCompression=1)
    doc.build(story, onFirstPage=footer, onLaterPages=footer)
    return target


def verify_and_render(target):
    directory = QA / target.stem
    directory.mkdir(parents=True, exist_ok=True)
    with fitz.open(target) as pdf:
        text = []
        for index, page in enumerate(pdf):
            value = page.get_text()
            if len(value.strip()) < 45:
                raise ValueError(f'Empty page: {target.name}/{index+1}')
            for block in page.get_text('blocks'):
                if block[6] == 0 and (block[0] < 25 or block[1] < 13 or block[2] > page.rect.width-24 or block[3] > page.rect.height-8):
                    raise ValueError(f'Text outside safe page area: {target.name}/{index+1}: {block[:4]}')
            text.append(value)
            page.get_pixmap(matrix=fitz.Matrix(1.2, 1.2), alpha=False).save(directory / f'{index+1:02d}.png')
        (directory / 'text.txt').write_text('\n\n'.join(text), encoding='utf-8')
        count = len(pdf)
    rows = (count + 2) // 3
    sheet = PILImage.new('RGB', (1260, rows*320), '#dce4ef')
    draw = ImageDraw.Draw(sheet)
    for index in range(count):
        with PILImage.open(directory / f'{index+1:02d}.png') as img:
            img.thumbnail((410, 292))
            x, y = (index % 3)*420 + 5, (index // 3)*320 + 19
            sheet.paste(img, (x, y))
            draw.text((x, y-15), f'{target.stem} / {index+1}', fill='#15243b')
    sheet.save(QA / (target.stem + '-contact.png'))
    return count


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    QA.mkdir(parents=True, exist_ok=True)
    setup_fonts()
    source = json.loads((SOURCE / 'inhalte.json').read_text(encoding='utf-8'))
    results = []
    for guide in source['guides']:
        target = build(guide, source['version'])
        pages = verify_and_render(target)
        results.append({'file': target.name, 'title': guide['title'], 'pages': pages, 'screenshots': len(guide['screens'])})
        print(f'{target.name}: {pages} pages, {len(guide["screens"])} screenshots')
    (OUT / 'manifest.json').write_text(json.dumps({'version':source['version'], 'manuals':results},ensure_ascii=False,indent=2), encoding='utf-8')
    with zipfile.ZipFile(OUT / 'ForgeFlow-Alle-Handbuecher.zip', 'w', zipfile.ZIP_DEFLATED) as archive:
        for result in results:
            archive.write(OUT / result['file'], result['file'])
        archive.write(OUT / 'manifest.json', 'manifest.json')
    print(f'Created {len(results)} manuals and archive; rendered every page under tmp/pdfs/.')


if __name__ == '__main__':
    main()
