import sys
import json
import time
import base64

# Force UTF-8 for stdin/stdout using reconfigure (Python 3.7+)
# This avoids buffering issues caused by detach()
if sys.platform == 'win32':
    if hasattr(sys.stdin, 'reconfigure'):
        sys.stdin.reconfigure(encoding='utf-8')
        sys.stdout.reconfigure(encoding='utf-8')

from pypdf import PdfWriter

def parse_page_ranges(range_str, max_pages):
    pages = set()
    parts = range_str.split(',')
    for part in parts:
        part = part.strip()
        if '-' in part:
            start, end = map(int, part.split('-'))
            # Convert 1-based to 0-based, inclusive
            for i in range(start - 1, end):
                if 0 <= i < max_pages:
                    pages.add(i)
        else:
            page = int(part) - 1
            if 0 <= page < max_pages:
                pages.add(page)
    return sorted(list(pages))

RENDER_SCALE = 1.5

def hex_to_rgb(hex_color: str):
    h = hex_color.lstrip('#')
    if len(h) != 6:
        return (0.0, 0.0, 0.0)
    return tuple(int(h[i:i+2], 16) / 255.0 for i in (0, 2, 4))

THUMB_SCALE = 0.5

def handle_get_thumbnails(command):
    try:
        import fitz  # pymupdf
        file_path = command.get('file')
        if not file_path:
            return {'status': 'error', 'message': 'Missing file path'}

        doc = fitz.open(file_path)
        pages = []
        for i in range(len(doc)):
            pix = doc[i].get_pixmap(matrix=fitz.Matrix(THUMB_SCALE, THUMB_SCALE))
            pages.append({
                'page_no': i,
                'width': pix.width,
                'height': pix.height,
                'image': base64.b64encode(pix.tobytes('png')).decode('utf-8'),
            })
        count = len(doc)
        doc.close()
        return {'status': 'success', 'data': {'pages': pages, 'page_count': count}}
    except Exception as e:
        return {'status': 'error', 'message': str(e)}


def handle_get_pages(command):
    try:
        import fitz  # pymupdf
        file_path = command.get('file')
        if not file_path:
            return {'status': 'error', 'message': 'Missing file path'}

        doc = fitz.open(file_path)
        pages = []

        for page_num in range(len(doc)):
            page = doc[page_num]
            pix = page.get_pixmap(matrix=fitz.Matrix(RENDER_SCALE, RENDER_SCALE))
            img_b64 = base64.b64encode(pix.tobytes("png")).decode('utf-8')

            blocks_data = []
            for block in page.get_text("dict").get("blocks", []):
                if block.get("type") != 0:
                    continue  # skip image blocks

                line_texts = []
                font_sizes = []
                for line in block.get("lines", []):
                    line_parts = []
                    for span in line.get("spans", []):
                        line_parts.append(span.get("text", ""))
                        size = span.get("size", 12)
                        if size > 0:
                            font_sizes.append(size)
                    line_texts.append("".join(line_parts))

                # Join with spaces so the textarea shows a natural paragraph.
                # Preserving the original PDF line-break positions would cause
                # the replacement text to wrap at those same fixed points, which
                # produces overflow when the substitution font has different metrics.
                text = " ".join(part for part in line_texts if part).strip()
                if not text:
                    continue

                bbox = block["bbox"]
                avg_size = sum(font_sizes) / len(font_sizes) if font_sizes else 12
                blocks_data.append({
                    "x0": bbox[0] * RENDER_SCALE,
                    "y0": bbox[1] * RENDER_SCALE,
                    "x1": bbox[2] * RENDER_SCALE,
                    "y1": bbox[3] * RENDER_SCALE,
                    "text": text,
                    "block_no": block.get("number", 0),
                    "font_size": round(avg_size, 1)
                })

            pages.append({
                "page_no": page_num,
                "width": pix.width,
                "height": pix.height,
                "image": img_b64,
                "blocks": blocks_data
            })

        doc.close()
        return {"status": "success", "data": pages}
    except Exception as e:
        return {"status": "error", "message": str(e)}


def handle_edit_pdf(command):
    try:
        import fitz  # pymupdf
        file_path = command.get('file')
        output = command.get('output')
        edits = command.get('edits', [])

        if not file_path or not output:
            return {'status': 'error', 'message': 'Missing file or output path'}

        doc = fitz.open(file_path)

        edits_by_page = {}
        for edit in edits:
            edits_by_page.setdefault(edit['page'], []).append(edit)

        for page_num, page_edits in edits_by_page.items():
            page = doc[page_num]

            for edit in page_edits:
                bbox = edit['bbox']
                rect = fitz.Rect(
                    bbox[0] / RENDER_SCALE, bbox[1] / RENDER_SCALE,
                    bbox[2] / RENDER_SCALE, bbox[3] / RENDER_SCALE
                )
                new_text = edit.get('new_text', '')
                font_size = edit.get('font_size', 12)
                bold      = bool(edit.get('bold', False))
                italic    = bool(edit.get('italic', False))
                color     = hex_to_rgb(edit.get('color', '#000000'))
                align     = int(edit.get('align', 0))

                # Map bold/italic to one of the four Helvetica Base-14 variants.
                # Use full PDF font names — short aliases (helv/hebo) are not
                # reliably supported by all pymupdf versions for FreeText annots.
                font_map = {
                    (False, False): "Helvetica",
                    (True,  False): "Helvetica-Bold",
                    (False, True):  "Helvetica-Oblique",
                    (True,  True):  "Helvetica-BoldOblique",
                }
                fontname = font_map[(bold, italic)]

                # Annotations live in a dedicated layer (page /Annots array)
                # that is always rendered above all page content streams by the
                # PDF spec — regardless of Form XObjects or content structure.
                #
                # Step 1: white-filled rect annotation buries the original text.
                cover = page.add_rect_annot(rect)
                cover.set_colors(stroke=(1, 1, 1), fill=(1, 1, 1))
                cover.set_border({"width": 0})
                cover.update()

                # Step 2: FreeText annotation renders the replacement text on
                # top of the white cover (later in /Annots = higher in z-order).
                if new_text:
                    freetext = page.add_freetext_annot(
                        rect, new_text,
                        fontsize=font_size,
                        fontname=fontname,
                        text_color=color,
                        fill_color=(1, 1, 1),
                        align=align
                    )
                    freetext.set_border({"width": 0})
                    freetext.update()

        doc.save(output, garbage=4, deflate=True)
        doc.close()
        return {"status": "success", "data": output}
    except Exception as e:
        return {"status": "error", "message": str(e)}


def process_command(command):
    # dedicated function to handle commands
    cmd_type = command.get('type')
    if cmd_type == 'ping':
        return {'status': 'success', 'data': 'pong from python'}
    
    if cmd_type == 'merge':
        try:
            files = command.get('files')
            output = command.get('output')
            
            if not files or not output:
                return {'status': 'error', 'message': 'Missing files or output path'}

            merger = PdfWriter()
            for pdf in files:
                merger.append(pdf)
            
            merger.write(output)
            merger.close()
            
            return {'status': 'success', 'data': output}
        except Exception as e:
            return {'status': 'error', 'message': str(e)}

    if cmd_type == 'extract':
        try:
            input_file = command.get('file')
            range_str = command.get('pages')
            output = command.get('output')
            
            if not input_file or not range_str or not output:
                 return {'status': 'error', 'message': 'Missing arguments'}

            reader = PdfWriter(clone_from=input_file)
            total_pages = len(reader.pages)
            
            try:
                selected_indices = parse_page_ranges(range_str, total_pages)
            except ValueError:
                 return {'status': 'error', 'message': 'Invalid page range format'}

            if not selected_indices:
                 return {'status': 'error', 'message': 'No valid pages selected'}

            writer = PdfWriter()
            for idx in selected_indices:
                writer.add_page(reader.pages[idx])
            
            writer.write(output)
            writer.close()
            
            return {'status': 'success', 'data': output}
        except Exception as e:
            return {'status': 'error', 'message': str(e)}

    if cmd_type == 'compress':
        try:
             import pikepdf
             input_file = command.get('file')
             output = command.get('output')
             # level could be used to determine image quality, etc. For now we use default linearize.
             
             if not input_file or not output:
                 return {'status': 'error', 'message': 'Missing arguments'}

             with pikepdf.open(input_file) as pdf:
                 pdf.remove_unreferenced_resources()
                 pdf.save(output, compress_streams=True, object_stream_mode=pikepdf.ObjectStreamMode.generate)
             
             return {'status': 'success', 'data': output}
        except Exception as e:
             return {'status': 'error', 'message': str(e)}

    if cmd_type == 'get_pages':
        return handle_get_pages(command)

    if cmd_type == 'get_thumbnails':
        return handle_get_thumbnails(command)

    if cmd_type == 'edit_pdf':
        return handle_edit_pdf(command)

    return {'status': 'error', 'message': 'Unknown command'}

def main():
    while True:
        try:
            line = sys.stdin.readline()
            if not line:
                break
            
            try:
                command = json.loads(line)
                response = process_command(command)
                print(json.dumps(response))
                sys.stdout.flush()
            except json.JSONDecodeError:
                print(json.dumps({'status': 'error', 'message': 'Invalid JSON'}))
                sys.stdout.flush()
        except KeyboardInterrupt:
            break

if __name__ == '__main__':
    main()
