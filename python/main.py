import sys
import json
import time

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
