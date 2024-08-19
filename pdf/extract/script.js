document.getElementById('exportButton').addEventListener('click', async () => {
    const fileInput = document.getElementById('pdfInput');
    const pageRangeInput = document.getElementById('pageRange').value;

    if (fileInput.files.length === 0) {
        alert('Please select a PDF file.');
        return;
    }

    const file = fileInput.files[0];
    const reader = new FileReader();
    reader.onload = async (event) => {
        const arrayBuffer = event.target.result;
        const uint8Array = new Uint8Array(arrayBuffer);

        const pyodide = await loadPyodide();

        await pyodide.loadPackage('micropip');
        const micropip = pyodide.pyimport('micropip');
        await micropip.install('pypdf2');

        pyodide.runPython(`
            import io
            from PyPDF2 import PdfReader, PdfWriter

            def extract_pages(pdf_data, page_range):
                pdf_data = pdf_data.to_py()
                reader = PdfReader(io.BytesIO(pdf_data))
                writer = PdfWriter()
                
                page_numbers = []
                for part in page_range.split(','):
                    if '-' in part:
                        start, end = map(int, part.split('-'))
                        page_numbers.extend(range(start - 1, end))
                    else:
                        page_numbers.append(int(part) - 1)
                
                for page_num in page_numbers:
                    writer.add_page(reader.pages[page_num])
                
                output = io.BytesIO()
                writer.write(output)
                return output.getvalue()
        `);

        const extractPages = pyodide.globals.get('extract_pages');
        const outputPdf = extractPages(uint8Array, pageRangeInput);
        const outputBlob = new Blob([outputPdf.toJs()], { type: 'application/pdf' });

        const outputUrl = URL.createObjectURL(outputBlob);
        const originalFileName = file.name.replace(/\.pdf$/, '');
        const pageRangeText = pageRangeInput.replace(/,/g, '-');
        const outputFileName = `${originalFileName}_pages_${pageRangeText}.pdf`;
        const outputLink = document.createElement('a');
        outputLink.href = outputUrl;
        outputLink.download = outputFileName;
        outputLink.textContent = `Download ${outputFileName}`;
        document.getElementById('output').appendChild(outputLink);
    };
    reader.readAsArrayBuffer(file);
});