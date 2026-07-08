#!/usr/bin/env python3
import os
import re
import sys
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch

# Brand Design Tokens
BG_COLOR = colors.HexColor("#FCF9F3")      # Warm cream
TEXT_COLOR = colors.HexColor("#2D241E")    # Dark chocolate
MUTED_COLOR = colors.HexColor("#5C524A")   # Medium brown
PRIMARY_COLOR = colors.HexColor("#FF7020") # Appetizing orange
SECONDARY_COLOR = colors.HexColor("#4CAF50") # Organic green
BORDER_COLOR = colors.HexColor("#EDE4D7")   # Subtle border cream
CALLOUT_BG = colors.HexColor("#FFF7F2")     # Light primary tint

def draw_background(canvas, doc):
    """Draws a premium warm cream background on all pages."""
    canvas.saveState()
    # Draw background color
    canvas.setFillColor(BG_COLOR)
    canvas.rect(0, 0, doc.pagesize[0], doc.pagesize[1], fill=1, stroke=0)
    canvas.restoreState()

def draw_header_footer(canvas, doc):
    """Draws running header and footer with page numbers."""
    canvas.saveState()
    width, height = doc.pagesize
    
    # Running background (already drawn by draw_background)
    draw_background(canvas, doc)
    
    # Running Header
    canvas.setFont("Helvetica-Bold", 8)
    canvas.setFillColor(MUTED_COLOR)
    canvas.drawString(54, height - 36, "THE HAPPY TIFFIN SYSTEM")
    canvas.setStrokeColor(BORDER_COLOR)
    canvas.setLineWidth(0.5)
    canvas.line(54, height - 42, width - 54, height - 42)
    
    # Running Footer
    canvas.setFont("Helvetica", 8)
    canvas.setFillColor(MUTED_COLOR)
    canvas.drawString(54, 36, "World-Class Pediatric Nutrition & Family Recipes")
    canvas.drawRightString(width - 54, 36, f"Page {doc.page}")
    canvas.line(54, 46, width - 54, 46)
    
    canvas.restoreState()

def draw_first_page_background(canvas, doc):
    """First page background callback."""
    draw_background(canvas, doc)
    canvas.saveState()
    width, height = doc.pagesize
    # running footer on first page
    canvas.setFont("Helvetica", 8)
    canvas.setFillColor(MUTED_COLOR)
    canvas.drawString(54, 36, "The Happy Tiffin System - Confidential")
    canvas.drawRightString(width - 54, 36, f"Page {doc.page}")
    canvas.restoreState()

def parse_markdown_to_story(md_content, styles):
    """Parses markdown text into ReportLab Flowables."""
    story = []
    
    # Preprocess markdown styles: bold and italic (HTML replacements)
    # Bold: **text** -> <b>text</b>
    md_content = re.sub(r'\*\*(.*?)\*\*', r'<b>\1</b>', md_content)
    # Italic: *text* -> <i>text</i>
    md_content = re.sub(r'\*(.*?)\*', r'<i>\1</i>', md_content)
    
    lines = md_content.split('\n')
    
    i = 0
    in_list = False
    in_table = False
    table_rows = []
    in_quote = False
    quote_text = []

    # Simple styles lookup
    title_style = styles['TitleStyle']
    h1_style = styles['H1Style']
    h2_style = styles['H2Style']
    h3_style = styles['H3Style']
    body_style = styles['BodyStyle']
    bullet_style = styles['BulletStyle']
    quote_style = styles['QuoteStyle']

    while i < len(lines):
        line = lines[i]
        stripped = line.strip()
        
        # 1. Handle Tables
        if stripped.startswith('|'):
            if not in_table:
                in_table = True
                table_rows = []
            
            # Parse cells
            cells = [c.strip() for c in line.split('|')[1:-1]]
            # If it's the header separator row (e.g. | :--- | :--- |), skip it
            if all(re.match(r'^:?-+:?$', c) for c in cells):
                i += 1
                continue
            
            table_rows.append(cells)
            i += 1
            continue
        elif in_table:
            # End of table, compile it
            in_table = False
            if table_rows:
                # Convert cells to Paragraphs for word wrapping
                data = []
                # Determine columns width
                col_widths = None
                num_cols = len(table_rows[0])
                available_width = letter[0] - 108 # margins
                col_w = available_width / num_cols
                col_widths = [col_w] * num_cols
                
                # Custom column widths if specific table types
                if num_cols == 4: # Empty Tiffin Calendar table
                    col_widths = [col_w * 0.8, col_w * 1.3, col_w * 0.9, col_w * 1.0]
                elif num_cols == 3: # Swap card / pantry table
                    col_widths = [col_w * 0.8, col_w * 1.2, col_w * 1.0]

                for row_idx, row in enumerate(table_rows):
                    row_data = []
                    for cell in row:
                        cell_style = styles['TableHeaderStyle'] if row_idx == 0 else styles['TableCellStyle']
                        row_data.append(Paragraph(cell, cell_style))
                    data.append(row_data)
                
                t = Table(data, colWidths=col_widths)
                t_style = TableStyle([
                    ('BACKGROUND', (0,0), (-1,0), PRIMARY_COLOR if num_cols != 5 else SECONDARY_COLOR),
                    ('TEXTCOLOR', (0,0), (-1,0), colors.white),
                    ('VALIGN', (0,0), (-1,-1), 'TOP'),
                    ('GRID', (0,0), (-1,-1), 0.5, BORDER_COLOR),
                    ('TOPPADDING', (0,0), (-1,-1), 8),
                    ('BOTTOMPADDING', (0,0), (-1,-1), 8),
                    ('LEFTPADDING', (0,0), (-1,-1), 8),
                    ('RIGHTPADDING', (0,0), (-1,-1), 8),
                ])
                # Alternate row coloring
                for r_idx in range(1, len(data)):
                    if r_idx % 2 == 0:
                        t_style.add('BACKGROUND', (0, r_idx), (-1, r_idx), colors.HexColor("#FDFDFD"))
                t.setStyle(t_style)
                story.append(t)
                story.append(Spacer(1, 15))
            table_rows = []
            
        # 2. Handle Blockquotes
        if stripped.startswith('>'):
            if not in_quote:
                in_quote = True
                quote_text = []
            content = stripped[1:].strip()
            # remove leading space or nested quote
            if content.startswith('>'):
                content = content[1:].strip()
            quote_text.append(content)
            i += 1
            continue
        elif in_quote:
            in_quote = False
            # Render quote box
            full_quote = " ".join(quote_text)
            # Remove custom markup like "[!NOTE]" or "[!TIP]"
            alert_match = re.match(r'^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]\s*(.*)', full_quote, re.IGNORECASE)
            bg_theme = CALLOUT_BG
            border_theme = PRIMARY_COLOR
            q_label = ""
            if alert_match:
                alert_type = alert_match.group(1).upper()
                full_quote = alert_match.group(2)
                q_label = f"<b>{alert_type}:</b> "
                if alert_type in ['IMPORTANT', 'WARNING', 'CAUTION']:
                    bg_theme = colors.HexColor("#FFF0F0")
                    border_theme = colors.HexColor("#E53935")
                elif alert_type in ['TIP', 'NOTE']:
                    bg_theme = colors.HexColor("#F1F8E9")
                    border_theme = SECONDARY_COLOR
            
            p_text = f"{q_label}{full_quote}"
            q_paragraph = Paragraph(p_text, quote_style)
            
            # Put in a single cell table for box borders
            q_table = Table([[q_paragraph]], colWidths=[letter[0] - 108])
            q_table.setStyle(TableStyle([
                ('BACKGROUND', (0,0), (0,0), bg_theme),
                ('VALIGN', (0,0), (0,0), 'MIDDLE'),
                ('LINELEFT', (0,0), (0,0), 3.5, border_theme),
                ('TOPPADDING', (0,0), (0,0), 10),
                ('BOTTOMPADDING', (0,0), (0,0), 10),
                ('LEFTPADDING', (0,0), (0,0), 12),
                ('RIGHTPADDING', (0,0), (0,0), 12),
                ('BOX', (0,0), (-1,-1), 0.5, BORDER_COLOR),
            ]))
            story.append(q_table)
            story.append(Spacer(1, 15))
            quote_text = []

        # 3. Handle Page Breaks and Line Dividers
        if stripped == '---':
            story.append(Spacer(1, 10))
            # Draw a subtle line
            divider = Table([[""]], colWidths=[letter[0] - 108], rowHeights=[1])
            divider.setStyle(TableStyle([
                ('LINEBELOW', (0,0), (-1,-1), 1.5, PRIMARY_COLOR),
                ('BOTTOMPADDING', (0,0), (-1,-1), 0),
                ('TOPPADDING', (0,0), (-1,-1), 0),
            ]))
            story.append(divider)
            story.append(Spacer(1, 15))
            i += 1
            continue
            
        if stripped == '<br>' or stripped == '<br/>':
            story.append(Spacer(1, 15))
            i += 1
            continue

        # 4. Handle Headings
        if stripped.startswith('# '):
            text = stripped[2:].strip()
            # Main Title (Document H1)
            story.append(Paragraph(text, title_style))
            story.append(Spacer(1, 15))
            i += 1
            continue
            
        if stripped.startswith('## '):
            text = stripped[3:].strip()
            story.append(Paragraph(text, h1_style))
            story.append(Spacer(1, 10))
            i += 1
            continue

        if stripped.startswith('### '):
            text = stripped[4:].strip()
            story.append(Paragraph(text, h2_style))
            story.append(Spacer(1, 8))
            i += 1
            continue

        if stripped.startswith('#### '):
            text = stripped[5:].strip()
            story.append(Paragraph(text, h3_style))
            story.append(Spacer(1, 6))
            i += 1
            continue

        # 5. Handle Lists (Unordered)
        if stripped.startswith('* ') or stripped.startswith('- ') or (stripped.startswith('[ ]') or stripped.startswith('[x]')):
            in_list = True
            content = stripped[2:].strip()
            # Handle checkboxes
            if stripped.startswith('[ ]'):
                content = f"☐  {stripped[3:].strip()}"
            elif stripped.startswith('[x]'):
                content = f"☑  {stripped[3:].strip()}"
            elif stripped.startswith('- [ ]'):
                content = f"☐  {stripped[5:].strip()}"
            elif stripped.startswith('- [x]'):
                content = f"☑  {stripped[5:].strip()}"

            story.append(Paragraph(content, bullet_style))
            story.append(Spacer(1, 4))
            i += 1
            continue
            
        # Standard paragraph line
        if stripped:
            # Handle list breaks
            in_list = False
            story.append(Paragraph(line, body_style))
            story.append(Spacer(1, 8))
        else:
            if not in_list and not in_table and not in_quote:
                story.append(Spacer(1, 6))
        
        i += 1
        
    return story

def compile_markdown_to_pdf(md_path, pdf_path):
    """Compiles a markdown file to a highly premium PDF."""
    print(f"Compiling: {os.path.basename(md_path)} -> {os.path.basename(pdf_path)}")
    
    with open(md_path, 'r', encoding='utf-8') as f:
        md_content = f.read()

    # Document Setup
    # 0.75-inch margins (54 points)
    doc = SimpleDocTemplate(
        pdf_path,
        pagesize=letter,
        leftMargin=54,
        rightMargin=54,
        topMargin=54,
        bottomMargin=54
    )
    
    # Styles Definition
    styles = getSampleStyleSheet()
    
    # Custom styled paragraph wrappers
    title_style = ParagraphStyle(
        'DocTitle',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=24,
        leading=28,
        textColor=PRIMARY_COLOR,
        alignment=0, # Left-aligned
        spaceAfter=15
    )
    
    h1_style = ParagraphStyle(
        'Heading1Custom',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=15,
        leading=19,
        textColor=SECONDARY_COLOR,
        spaceBefore=15,
        spaceAfter=8,
        keepWithNext=True
    )

    h2_style = ParagraphStyle(
        'Heading2Custom',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=12,
        leading=16,
        textColor=PRIMARY_COLOR,
        spaceBefore=10,
        spaceAfter=6,
        keepWithNext=True
    )

    h3_style = ParagraphStyle(
        'Heading3Custom',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=10,
        leading=14,
        textColor=TEXT_COLOR,
        spaceBefore=8,
        spaceAfter=4,
        keepWithNext=True
    )

    body_style = ParagraphStyle(
        'BodyCustom',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=9.5,
        leading=13.5,
        textColor=TEXT_COLOR,
        spaceAfter=8
    )

    bullet_style = ParagraphStyle(
        'BulletCustom',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=9.5,
        leading=13.5,
        textColor=TEXT_COLOR,
        leftIndent=15,
        firstLineIndent=-10,
        spaceAfter=4
    )

    quote_style = ParagraphStyle(
        'QuoteCustom',
        parent=styles['Normal'],
        fontName='Helvetica-Oblique',
        fontSize=9.0,
        leading=13.0,
        textColor=MUTED_COLOR
    )

    table_header_style = ParagraphStyle(
        'TableHeader',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=8.5,
        leading=11.5,
        textColor=colors.white
    )

    table_cell_style = ParagraphStyle(
        'TableCell',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=8.5,
        leading=11.5,
        textColor=TEXT_COLOR
    )
    
    custom_styles = {
        'TitleStyle': title_style,
        'H1Style': h1_style,
        'H2Style': h2_style,
        'H3Style': h3_style,
        'BodyStyle': body_style,
        'BulletStyle': bullet_style,
        'QuoteStyle': quote_style,
        'TableHeaderStyle': table_header_style,
        'TableCellStyle': table_cell_style
    }
    
    story = parse_markdown_to_story(md_content, custom_styles)
    
    # Build document
    doc.build(
        story,
        onFirstPage=draw_first_page_background,
        onLaterPages=draw_header_footer
    )

def main():
    # Find all .md files in the deliverables folder
    deliverables_dir = os.path.dirname(os.path.abspath(__file__))
    files = [f for f in os.listdir(deliverables_dir) if f.endswith('.md')]
    
    if len(sys.argv) > 1:
        target_md = sys.argv[1]
        if not target_md.endswith('.md'):
            target_md += '.md'
        files = [target_md] if target_md in files else []
        if not files:
            print(f"File '{target_md}' not found in deliverables directory.")
            sys.exit(1)
            
    compiled_count = 0
    for file in files:
        md_path = os.path.join(deliverables_dir, file)
        pdf_name = file[:-3] + '.pdf'
        pdf_path = os.path.join(deliverables_dir, pdf_name)
        try:
            compile_markdown_to_pdf(md_path, pdf_path)
            compiled_count += 1
        except Exception as e:
            print(f"Error compiling {file}: {e}", file=sys.stderr)
            
    print(f"Batch compilation complete. Successfully compiled {compiled_count} files.")

if __name__ == '__main__':
    main()
