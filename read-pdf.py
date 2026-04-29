import pdfplumber

pdf = pdfplumber.open(r'C:\Users\jorge\Downloads\POLIZA HOGAR HDI No. 93065150 MARIA EUGENIA GRUESO DE ESTRADA.pdf')
# Print page 1 only
p = pdf.pages[0]
text = p.extract_text()
print(text)
pdf.close()
