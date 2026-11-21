const fs = require('node:fs/promises');
const path = require('node:path');
const yauzl = require('yauzl');
const { crc32 } = require('node:zlib');
const { SaxesParser } = require('saxes');
const { PDFDocument, PDFDict, PDFArray, PDFName } = require('pdf-lib');
const AppError = require('@ptitsocial/service-kit/appError');
const { Document, Favorite, Vote, Comment, Report, Cleanup } = require('./models');
const maxBytes = 20 * 1024 * 1024;
const types = {
  pdf: 'application/pdf',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
};
const root = path.resolve(
  process.env.DOCUMENT_STORAGE_DIR || path.join(__dirname, '../../../private-documents')
);
const incoming = path.join(root, '.incoming');
function location(key) {
  if (!/^[a-f0-9-]+\.(pdf|docx|pptx)$/.test(key)) throw new Error('Invalid storage key');
  return path.join(root, key);
}
async function office(buffer, format) {
  await new Promise((resolve, reject) =>
    yauzl.fromBuffer(buffer, { lazyEntries: true, validateEntrySizes: true }, (error, zip) => {
      if (error) return reject(error);
      let size = 0,
        count = 0,
        ended = false;
      const names = new Set();
      const main = format === 'docx' ? 'word/document.xml' : 'ppt/presentation.xml';
      const required = new Set(['[Content_Types].xml', '_rels/.rels', main]);
      const fail = (err) => {
        if (!ended) {
          ended = true;
          zip.close();
          reject(err);
        }
      };
      zip.on('error', fail);
      zip.on('entry', (entry) => {
        size += entry.uncompressedSize;
        if (
          ++count > 3000 ||
          size > 80 * 1024 * 1024 ||
          entry.uncompressedSize > Math.max(entry.compressedSize * 200, 1024 * 1024) ||
          entry.generalPurposeBitFlag & 1 ||
          names.has(entry.fileName) ||
          /vbaProject|embeddings\/|\.exe$|\.dll$/i.test(entry.fileName) ||
          (/\.bin$/i.test(entry.fileName) &&
            !/^(word|ppt)\/printerSettings\/[^/]+\.bin$/i.test(entry.fileName))
        )
          return fail(new Error('Unsafe Office package'));
        names.add(entry.fileName);
        if (entry.fileName.endsWith('/')) return zip.readEntry();
        zip.openReadStream(entry, (err, stream) => {
          if (err) return fail(err);
          const inspect = /\.xml$|\.rels$/i.test(entry.fileName);
          let read = 0,
            checksum = 0;
          const chunks = [];
          stream.on('error', fail);
          stream.on('data', (chunk) => {
            read += chunk.length;
            checksum = crc32(chunk, checksum);
            if (read > entry.uncompressedSize || (inspect && read > 8 * 1024 * 1024)) {
              stream.destroy();
              return fail(new Error('Expanded file too large'));
            }
            if (inspect) chunks.push(chunk);
          });
          stream.on('end', () => {
            if (ended) return;
            if (checksum !== entry.crc32) return fail(new Error('Corrupt ZIP entry'));
            if (inspect) {
              const xml = Buffer.concat(chunks).toString('utf8');
              try {
                const parser = new SaxesParser({ xmlns: true });
                parser.on('doctype', () => {
                  throw new Error('DTD not allowed');
                });
                parser.on('error', (error) => {
                  throw error;
                });
                parser.on('opentag', (tag) => {
                  for (const attribute of Object.values(tag.attributes)) {
                    if (/macroEnabled|vbaProject|oleObject|attachedTemplate/i.test(attribute.value))
                      throw new Error('Active Office content');
                  }
                  if (
                    tag.local === 'Relationship' &&
                    tag.attributes.TargetMode?.value === 'External' &&
                    !/^(https?:|mailto:)/i.test(tag.attributes.Target?.value || '')
                  )
                    throw new Error('Unsafe external relationship');
                });
                parser.write(xml).close();
              } catch (error) {
                return fail(error);
              }
              if (
                !xml.includes('<') ||
                /<!DOCTYPE|<!ENTITY|macroEnabled|vbaProject|oleObject|attachedTemplate/i.test(xml)
              )
                return fail(new Error('Unsafe XML'));
              if (
                entry.fileName === '[Content_Types].xml' &&
                !xml.includes(
                  format === 'docx'
                    ? 'wordprocessingml.document.main+xml'
                    : 'presentationml.presentation.main+xml'
                )
              )
                return fail(new Error('Wrong Office type'));
              if (
                entry.fileName === main &&
                !xml.includes(format === 'docx' ? ':document' : ':presentation')
              )
                return fail(new Error('Missing Office root'));
            }
            required.delete(entry.fileName);
            zip.readEntry();
          });
        });
      });
      zip.on('end', () => {
        if (!ended) {
          ended = true;
          required.size ? reject(new Error('Incomplete Office file')) : resolve();
        }
      });
      zip.readEntry();
    })
  );
}
async function validate(file) {
  if (!file || file.buffer.length === 0 || file.buffer.length > maxBytes)
    throw new AppError('Chọn một tệp PDF, DOCX hoặc PPTX, tối đa 20 MB.', 400);
  const decodedName = Buffer.from(file.originalname, 'latin1').toString('utf8');
  if (!decodedName.includes('\ufffd')) file.originalname = decodedName;
  const format = path.extname(file.originalname).slice(1).toLowerCase();
  if (!types[format] || file.mimetype !== types[format])
    throw new AppError('Định dạng tệp không được hỗ trợ.', 400);
  try {
    if (format === 'pdf') {
      if (
        file.buffer.subarray(0, 5).toString() !== '%PDF-' ||
        !file.buffer.subarray(-2048).includes(Buffer.from('%%EOF'))
      )
        throw new Error('Not PDF');
      const pdf = await PDFDocument.load(file.buffer, {
        throwOnInvalidObject: true,
        updateMetadata: false,
      });
      if (!pdf.getPageCount()) throw new Error('Empty PDF');
      const seen = new Set();
      function inspect(object) {
        if (!object || seen.has(object)) return;
        seen.add(object);
        if (
          object instanceof PDFName &&
          ['JavaScript', 'Launch', 'RichMedia', 'EmbeddedFile'].includes(object.decodeText())
        )
          throw new Error('Active PDF action');
        if (object instanceof PDFDict)
          for (const [key, value] of object.entries()) {
            if (
              key.decodeText() === 'URI' &&
              value.decodeText &&
              !/^(https?:|mailto:)/i.test(value.decodeText())
            )
              throw new Error('Unsafe PDF link');
            if (
              [
                'JS',
                'JavaScript',
                'AA',
                'OpenAction',
                'Launch',
                'RichMedia',
                'EmbeddedFiles',
                'EmbeddedFile',
                'XFA',
                'Encrypt',
              ].includes(key.decodeText())
            )
              throw new Error('Active PDF');
            inspect(value);
          }
        if (object instanceof PDFArray) object.asArray().forEach(inspect);
        if (object.dict) inspect(object.dict);
      }
      for (const [, object] of pdf.context.enumerateIndirectObjects()) inspect(object);
    } else await office(file.buffer, format);
  } catch {
    throw new AppError(
      'Tệp bị hỏng, mã hóa, sai định dạng hoặc chứa nội dung chủ động không được phép.',
      400
    );
  }
  return {
    format,
    mime: types[format],
    bytes: file.buffer.length,
    originalName: path
      .basename(file.originalname.replace(/\\/g, '/'))
      .replace(/[\x00-\x1f\x7f]/g, '')
      .slice(0, 180),
  };
}
async function remove(key) {
  await fs.unlink(location(key)).catch((err) => {
    if (err.code !== 'ENOENT') throw err;
  });
}
function isReferenced(key) {
  return Document.exists({ $or: [{ storageKey: key }, { 'additionalFiles.storageKey': key }] });
}
async function sweep() {
  // Multer removes rejected uploads. Reclaim interrupted requests left by a process exit.
  for (const name of await fs.readdir(incoming).catch((err) => {
    if (err.code === 'ENOENT') return [];
    throw err;
  })) {
    if (!/^[0-9a-f]{32}$/.test(name)) continue;
    const temp = path.join(incoming, name);
    const info = await fs.stat(temp).catch((err) => {
      if (err.code !== 'ENOENT') throw err;
    });
    if (info && info.mtimeMs < Date.now() - 86400000) await fs.rm(temp, { force: true });
  }
  for (const doc of await Document.find({ status: 'deleted' })
    .select('+storageKey +additionalFiles.storageKey')
    .limit(30)) {
    try {
      const keys = [doc.storageKey, ...(doc.additionalFiles || []).map((f) => f.storageKey)];
      for (const key of keys) await remove(key);
      for (const Model of [Favorite, Vote, Comment, Report])
        await Model.deleteMany({ document: doc._id });
      await Cleanup.deleteMany({ key: { $in: keys } });
      await Document.deleteOne({ _id: doc._id, status: 'deleted' });
    } catch (error) {
      console.error('Document deletion pending:', error.message);
    }
  }
  for (const job of await Cleanup.find({ createdAt: { $lt: new Date(Date.now() - 300000) } }).limit(
    30
  )) {
    try {
      if (!(await isReferenced(job.key))) await remove(job.key);
      await job.deleteOne();
    } catch (error) {
      console.error('Document cleanup pending:', error.message);
    }
  }
}
async function write(key, buffer) {
  await fs.mkdir(root, { recursive: true });
  await fs.writeFile(location(key), buffer, { flag: 'wx' });
}
module.exports = {
  validate,
  location,
  write,
  remove,
  sweep,
  maxBytes,
  types,
  incoming,
  isReferenced,
};
