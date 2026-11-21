const { PDFDocument, PDFName } = require('pdf-lib');
const { crc32 } = require('node:zlib');
async function pdf(active = false) {
  const doc = await PDFDocument.create();
  doc.addPage().drawText('Study outline: algorithms');
  if (active) doc.addJavaScript('test', 'app.alert(1)');
  if (active === 'launch') {
    doc.catalog.delete(PDFName.of('Names'));
    doc.catalog.set(
      PDFName.of('TestAction'),
      doc.context.obj({ S: PDFName.of('Launch'), F: 'external.exe' })
    );
  }
  return Buffer.from(await doc.save());
}
function zip(files) {
  const local = [],
    central = [];
  let offset = 0;
  for (const [name, value] of Object.entries(files)) {
    const filename = Buffer.from(name),
      data = Buffer.from(value),
      crc = crc32(data);
    const header = Buffer.alloc(30);
    header.writeUInt32LE(0x04034b50);
    header.writeUInt16LE(20, 4);
    header.writeUInt32LE(crc, 14);
    header.writeUInt32LE(data.length, 18);
    header.writeUInt32LE(data.length, 22);
    header.writeUInt16LE(filename.length, 26);
    const entry = Buffer.alloc(46);
    entry.writeUInt32LE(0x02014b50);
    entry.writeUInt16LE(20, 4);
    entry.writeUInt16LE(20, 6);
    entry.writeUInt32LE(crc, 16);
    entry.writeUInt32LE(data.length, 20);
    entry.writeUInt32LE(data.length, 24);
    entry.writeUInt16LE(filename.length, 28);
    entry.writeUInt32LE(offset, 42);
    local.push(header, filename, data);
    central.push(entry, filename);
    offset += header.length + filename.length + data.length;
  }
  const directory = Buffer.concat(central),
    end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50);
  end.writeUInt16LE(central.length / 2, 8);
  end.writeUInt16LE(central.length / 2, 10);
  end.writeUInt32LE(directory.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...local, directory, end]);
}
function office(format, extra = {}) {
  const word = format === 'docx',
    main = word ? 'word/document.xml' : 'ppt/presentation.xml';
  return zip({
    '[Content_Types].xml': `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Override PartName="/${main}" ContentType="application/vnd.openxmlformats-officedocument.${word ? 'wordprocessingml.document' : 'presentationml.presentation'}.main+xml"/></Types>`,
    '_rels/.rels': `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="${main}"/></Relationships>`,
    [main]: word
      ? '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>Study outline</w:t></w:r></w:p></w:body></w:document>'
      : '<p:presentation xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:sldIdLst/></p:presentation>',
    ...extra,
  });
}
module.exports = { pdf, office, zip };
